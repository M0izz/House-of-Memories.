// ============================================================================
// House of Memories — Cloudflare Worker (Birthday Push Notification Engine)
// ============================================================================

export interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  APP_URL: string;
}

interface NotificationPreference {
  id: string;
  user_id: string;
  space_id: string;
  birthday_notifications_enabled: number;
  day_before_reminder_enabled: number;
  preferred_time: string; // e.g., "09:00"
  timezone: string; // e.g., "America/New_York"
}

interface BirthdaySetting {
  recipient_name: string;
  birth_month: number;
  birth_day: number;
  initial_year: number;
}

export default {
  // 1. Cron Trigger Handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processScheduledNotifications(env));
  },

  // 2. HTTP Request Handler (API endpoints & manual trigger)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({ status: "healthy", service: "birthday-notifier" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Manual test trigger endpoint
    if (url.pathname === "/api/trigger-cron-now" && request.method === "POST") {
      const summary = await processScheduledNotifications(env);
      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Register / update push subscription in D1
    if (url.pathname === "/api/subscribe" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { userId, endpoint, p256dh, auth, userAgent } = body;

        if (!userId || !endpoint || !p256dh || !auth) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(endpoint) DO UPDATE SET
             p256dh = excluded.p256dh,
             auth = excluded.auth,
             updated_at = excluded.updated_at`
        )
          .bind(id, userId, endpoint, p256dh, auth, userAgent || null, now, now)
          .run();

        return new Response(JSON.stringify({ success: true, message: "Subscription saved to D1" }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
  },
};

/**
 * Main cron processor: checks due notifications, validates idempotency, and dispatches push notifications
 */
async function processScheduledNotifications(env: Env) {
  const results = {
    checked: 0,
    delivered: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // 1. Fetch enabled notification preferences from D1
    const prefsQuery = await env.DB.prepare(
      `SELECT * FROM notification_preferences WHERE birthday_notifications_enabled = 1`
    ).all<NotificationPreference>();

    const preferences = prefsQuery.results || [];
    results.checked = preferences.length;

    for (const pref of preferences) {
      // 2. Fetch birthday settings for this space
      const settingsQuery = await env.DB.prepare(
        `SELECT * FROM birthday_settings WHERE space_id = ? LIMIT 1`
      )
        .bind(pref.space_id)
        .first<BirthdaySetting>();

      const birthMonth = settingsQuery?.birth_month ?? 11;
      const birthDay = settingsQuery?.birth_day ?? 24;
      const initialYear = settingsQuery?.initial_year ?? 2027;
      const recipientName = settingsQuery?.recipient_name ?? "Maya";

      // 3. Compute recipient's current local time in their timezone
      const userTz = pref.timezone || "UTC";
      const now = new Date();
      const localTimeParts = getLocalParts(now, userTz);

      const currentYear = localTimeParts.year;
      const currentMonth = localTimeParts.month;
      const currentDay = localTimeParts.day;
      const currentHourMinute = `${String(localTimeParts.hour).padStart(2, "0")}:${String(localTimeParts.minute).padStart(2, "0")}`;

      const preferredTime = pref.preferred_time || "09:00";

      // Only dispatch if current local time is at or past preferred delivery time
      if (currentHourMinute < preferredTime) {
        results.skipped++;
        continue;
      }

      // Determine target birthday year
      let targetYear = currentYear < initialYear ? initialYear : currentYear;

      // Check if today is the Birthday (Nov 24)
      const isBirthdayDay = currentMonth === birthMonth && currentDay === birthDay && currentYear >= initialYear;

      // Check if today is the Day Before (Nov 23)
      const isDayBefore =
        pref.day_before_reminder_enabled === 1 &&
        currentMonth === birthMonth &&
        currentDay === birthDay - 1 &&
        currentYear >= initialYear;

      if (!isBirthdayDay && !isDayBefore) {
        results.skipped++;
        continue;
      }

      const notifType = isBirthdayDay ? "birthday_day" : "day_before";
      const idempotencyKey = `user_${pref.user_id}_${notifType}_${targetYear}_${currentYear}`;

      // 4. Idempotency Check in D1
      const existingDelivery = await env.DB.prepare(
        `SELECT id, status FROM notification_deliveries WHERE idempotency_key = ?`
      )
        .bind(idempotencyKey)
        .first();

      if (existingDelivery && existingDelivery.status === "delivered") {
        results.skipped++;
        continue;
      }

      // 5. Prepare Notification Payload
      const title = isBirthdayDay
        ? "It's your special day! ♡"
        : `Tomorrow is ${recipientName}'s Birthday! ✨`;

      const body = isBirthdayDay
        ? `Another year, another chapter, and countless more memories waiting to be made. Happy Birthday, ${recipientName}! ✨`
        : `The countdown is almost over. A private surprise is ready in House of Memories. ♡`;

      // 6. Find push subscriptions for this user
      const subscriptions = await env.DB.prepare(
        `SELECT * FROM push_subscriptions WHERE user_id = ?`
      )
        .bind(pref.user_id)
        .all();

      const userSubs = subscriptions.results || [];
      let deliverySuccessful = false;
      let lastError = "";

      for (const sub of userSubs) {
        try {
          await sendWebPush(
            {
              endpoint: sub.endpoint as string,
              p256dh: sub.p256dh as string,
              auth: sub.auth as string,
            },
            {
              title,
              body,
              url: "/birthday",
            },
            env
          );
          deliverySuccessful = true;
        } catch (pushErr: any) {
          lastError = pushErr?.message || "Push dispatch failed";
          // If subscription has expired / 410 Gone, remove it
          if (pushErr?.status === 410 || pushErr?.status === 404) {
            await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)
              .bind(sub.endpoint)
              .run();
          }
        }
      }

      // 7. Record Delivery Result
      const deliveryId = crypto.randomUUID();
      const status = deliverySuccessful ? "delivered" : "failed";
      const deliveredAt = deliverySuccessful ? new Date().toISOString() : null;

      await env.DB.prepare(
        `INSERT INTO notification_deliveries
         (id, user_id, space_id, notification_type, target_year, scheduled_date, idempotency_key, status, error_message, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           status = excluded.status,
           error_message = excluded.error_message,
           delivered_at = excluded.delivered_at`
      )
        .bind(
          deliveryId,
          pref.user_id,
          pref.space_id,
          notifType,
          targetYear,
          `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`,
          idempotencyKey,
          status,
          deliverySuccessful ? null : lastError,
          deliveredAt
        )
        .run();

      if (deliverySuccessful) {
        results.delivered++;
      } else {
        results.errors++;
      }
    }
  } catch (err) {
    console.error("Scheduled notification error:", err);
  }

  return results;
}

/**
 * Web Push delivery using standard Web Push protocols
 */
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
  env: Env
) {
  // Web Push sends a POST to the push service endpoint
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 201) {
    const error: any = new Error(`Push service returned status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

/**
 * Extracts year, month, day, hour, minute in the user's specific timezone
 */
function getLocalParts(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = parseInt(part.value, 10);
      }
    }

    return {
      year: map.year ?? date.getFullYear(),
      month: map.month ?? date.getMonth() + 1,
      day: map.day ?? date.getDate(),
      hour: map.hour ?? date.getHours(),
      minute: map.minute ?? date.getMinutes(),
    };
  } catch {
    // Fallback to UTC
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
}
