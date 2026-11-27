export interface BirthdayConfig {
  recipientName: string;
  birthMonth: number; // 1 - 12 (11 = November)
  birthDay: number; // 1 - 31 (24)
  initialYear: number; // 2027
  timezone: string; // Canonical IANA timezone for the space
  deliveryTime: string; // "09:00"
  widgetEnabled: boolean;
  dayBeforeReminder: boolean;
  birthdayNotifications: boolean;
}

/**
 * The canonical shared memory-space timezone.
 * Both users in the shared space evaluate birthday boundaries against this timezone,
 * never independently from each user's local operating system clock.
 */
export const CANONICAL_SPACE_TIMEZONE =
  process.env.NEXT_PUBLIC_SPACE_TIMEZONE || "America/New_York";

export const DEFAULT_BIRTHDAY_CONFIG: BirthdayConfig = {
  recipientName: "Maya",
  birthMonth: 11,
  birthDay: 24,
  initialYear: 2027,
  timezone: CANONICAL_SPACE_TIMEZONE,
  deliveryTime: "09:00",
  widgetEnabled: true,
  dayBeforeReminder: true,
  birthdayNotifications: true,
};

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isBirthday: boolean;
  nextBirthdayDate: Date;
  targetYear: number;
  formattedTargetDate: string;
}

/**
 * Validates an IANA timezone string. Returns the timezone if valid,
 * or safely falls back to CANONICAL_SPACE_TIMEZONE.
 */
export function validateTimezone(tz?: string): string {
  if (!tz || typeof tz !== "string") return CANONICAL_SPACE_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return CANONICAL_SPACE_TIMEZONE;
  }
}

/**
 * Extracts date components for a given Date object in a specific IANA timezone.
 */
export function getTimezoneDateParts(date: Date, timeZone: string = CANONICAL_SPACE_TIMEZONE) {
  const safeTz = validateTimezone(timeZone);
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => {
      const p = parts.find((pt) => pt.type === type);
      return p ? parseInt(p.value, 10) : 0;
    };
    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
      hour: getPart("hour"),
      minute: getPart("minute"),
      second: getPart("second"),
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

/**
 * Calculates the exact UTC Date instant for a given year, month, day, hour, minute, second
 * in the specified canonical IANA timezone.
 */
export function getZonedInstant(
  year: number,
  month: number, // 1-12
  day: number,   // 1-31
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  timeZone: string = CANONICAL_SPACE_TIMEZONE
): Date {
  const validTz = validateTimezone(timeZone);

  // Initial naive guess in UTC
  let targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Iteratively converge on the exact UTC instant whose local representation in validTz matches
  for (let i = 0; i < 3; i++) {
    const parts = getTimezoneDateParts(new Date(targetUtcMs), validTz);
    const localUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const desiredLocalMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = desiredLocalMs - localUtcMs;
    if (diff === 0) break;
    targetUtcMs += diff;
  }

  return new Date(targetUtcMs);
}

/**
 * Calculates the next occurrence of the birthday.
 * Supports:
 * - Recurring annually on month/day without hardcoding future years
 * - Initial target floor (e.g., Nov 24, 2027)
 * - Canonical shared memory-space timezone
 * - Celebration state for the entire 24-hour instant window in that timezone
 * - Automatic rollover to the following year once the birthday has passed
 */
export function getNextBirthday(
  now: Date = new Date(),
  config: Partial<BirthdayConfig> = {}
): { nextDate: Date; isBirthday: boolean; targetYear: number; birthdayStart: Date; birthdayEnd: Date } {
  const birthMonth = config.birthMonth ?? DEFAULT_BIRTHDAY_CONFIG.birthMonth; // 11
  const birthDay = config.birthDay ?? DEFAULT_BIRTHDAY_CONFIG.birthDay; // 24
  const initialYear = config.initialYear ?? DEFAULT_BIRTHDAY_CONFIG.initialYear; // 2027
  const timezone = validateTimezone(config.timezone ?? DEFAULT_BIRTHDAY_CONFIG.timezone);

  // Extract current date components strictly in the shared canonical space timezone
  const tzParts = getTimezoneDateParts(now, timezone);
  const currentYear = tzParts.year;

  let targetYear = currentYear;
  if (currentYear < initialYear) {
    targetYear = initialYear;
  }

  // Calculate birthday start (00:00:00) and end (24:00:00 / next day 00:00:00) instants
  let birthdayStart = getZonedInstant(targetYear, birthMonth, birthDay, 0, 0, 0, timezone);
  let birthdayEnd = getZonedInstant(targetYear, birthMonth, birthDay + 1, 0, 0, 0, timezone);

  const nowMs = now.getTime();

  // If we're already past this targetYear's birthday celebration window, roll forward to targetYear + 1
  if (nowMs >= birthdayEnd.getTime()) {
    targetYear = Math.max(initialYear, currentYear + 1);
    birthdayStart = getZonedInstant(targetYear, birthMonth, birthDay, 0, 0, 0, timezone);
    birthdayEnd = getZonedInstant(targetYear, birthMonth, birthDay + 1, 0, 0, 0, timezone);
  }

  const isBirthday = nowMs >= birthdayStart.getTime() && nowMs < birthdayEnd.getTime();
  const nextDate = isBirthday ? birthdayEnd : birthdayStart;

  return {
    nextDate,
    isBirthday,
    targetYear,
    birthdayStart,
    birthdayEnd,
  };
}

/**
 * Calculates the remaining countdown metrics (days, hours, minutes, seconds).
 */
export function calculateCountdown(
  now: Date = new Date(),
  config: Partial<BirthdayConfig> = {}
): CountdownResult {
  const { nextDate, isBirthday, targetYear, birthdayStart } = getNextBirthday(now, config);

  const diffMs = (isBirthday ? nextDate.getTime() : birthdayStart.getTime()) - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const validTz = validateTimezone(config.timezone ?? DEFAULT_BIRTHDAY_CONFIG.timezone);
  const formattedTargetDate = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(birthdayStart);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isBirthday,
    nextBirthdayDate: nextDate,
    targetYear,
    formattedTargetDate,
  };
}

// Client-side storage keys
const STORAGE_KEY_CONFIG = "hom_birthday_config_v1";
const STORAGE_KEY_WIDGET_POS = "hom_widget_pos_v1";
const STORAGE_KEY_WIDGET_MIN = "hom_widget_minimized_v1";

export function loadSavedBirthdayConfig(): BirthdayConfig {
  if (typeof window === "undefined") return DEFAULT_BIRTHDAY_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_BIRTHDAY_CONFIG;
    return { ...DEFAULT_BIRTHDAY_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BIRTHDAY_CONFIG;
  }
}

export function saveBirthdayConfig(config: BirthdayConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save birthday config:", err);
  }
}

export function loadWidgetMinimized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_WIDGET_MIN) === "true";
  } catch {
    return false;
  }
}

export function saveWidgetMinimized(minimized: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_WIDGET_MIN, String(minimized));
  } catch {}
}
