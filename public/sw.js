const CACHE_NAME = "glyteos-v1"
const STATIC_ASSETS = ["/", "/chat", "/files", "/agents", "/analytics"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  // Network-first for API calls, cache-first for assets
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request).catch(() => new Response("Offline", { status: 503 }))
    )
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached)
        return cached || fetched
      })
    )
  }
})

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {}
  const title = data.title || "GlyteOS"
  const body = data.body || "New update"
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "https://ik.imagekit.io/ecuuhbi4w/Glyte-GPT%20logo.png?updatedAt=1755967856964",
      badge: "https://ik.imagekit.io/ecuuhbi4w/Glyte-GPT%20logo.png?updatedAt=1755967856964",
      data: data.url || "/",
      tag: data.tag || "glyteos-notification",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data || "/"
  event.waitUntil(self.clients.openWindow(url))
})
