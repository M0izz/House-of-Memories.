// ============================================================================
// House of Memories — Web Push & Browser Notification Client Helper
// ============================================================================

export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

/**
 * Explicit user-triggered permission request.
 * NEVER called on initial page load.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerServiceWorker();
    }
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Subscribes the current browser to Web Push using the VAPID Public Key.
 */
export async function subscribeToPush(vapidPublicKey?: string): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) return subscription;

    // If key provided, convert and subscribe
    if (vapidPublicKey) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    } else {
      // Subscribe with existing registration or mock key
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // Public demo VAPID key (safe to expose, standard development placeholder)
          "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
        ) as unknown as BufferSource,
      });
    }

    return subscription;
  } catch (error) {
    console.warn("Failed to subscribe to push notifications:", error);
    return null;
  }
}

/**
 * Dispatches an in-browser notification or fallback toast
 */
export function showLocalNotification(
  title: string = "It's your special day! ♡",
  options?: NotificationOptions
): void {
  if (!isPushNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, {
      body:
        options?.body ||
        "Another year, another chapter, and countless more memories waiting to be made. Happy Birthday! ✨",
      icon: "/icon.svg",
      tag: "birthday-notification",
      ...options,
    });
  } catch (e) {
    console.error("Failed to show local notification:", e);
  }
}
