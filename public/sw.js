// ============================================================================
// House of Memories — Service Worker (Web Push & Notification Handling)
// ============================================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification event listener
self.addEventListener("push", (event) => {
  let notificationData = {
    title: "It's your special day! ♡",
    body: "Another year, another chapter, and countless more memories waiting to be made. Happy Birthday! ✨",
    url: "/birthday",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: "birthday-notification",
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || "/icon.svg",
    badge: notificationData.badge || "/icon.svg",
    tag: notificationData.tag || "birthday-notification",
    data: {
      url: notificationData.url || "/birthday",
    },
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event handler — Deep links into the Birthday Experience
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/birthday";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // If no window is open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
