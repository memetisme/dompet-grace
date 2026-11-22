// Naikkan nomor versi ini setiap kali file aplikasi diubah
const CACHE = "dompet-grace-v2";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tampilkan dari cache dulu supaya cepat dan jalan offline, lalu perbarui cache di belakang layar.
// Font Google ikut tersimpan setelah pertama kali dimuat saat online.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const allowed =
    url.origin === self.location.origin ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";
  if (!allowed) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
