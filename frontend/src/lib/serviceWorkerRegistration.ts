// Service worker registration for offline-first support
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.log("Service Workers not supported");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });

    console.log("Service Worker registered successfully:", registration);

    // Listen for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("New service worker available");
          // Notify user of update if needed
        }
      });
    });

    // Periodic background sync
    (registration as any).periodicSync
      ?.register("sync-transactions", {
        minInterval: 24 * 60 * 60 * 1000, // 24 hours
      })
      .catch((err: unknown) => {
        console.log("Periodic sync registration failed:", err);
      });

    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

export async function unregisterServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log("Service Workers unregistered");
  } catch (error) {
    console.error("Failed to unregister service workers:", error);
  }
}
