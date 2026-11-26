/* PSI LMS: plays SCORM packages straight from their .zip files.
   Each package is one zip in assets/pdu/zips/<id>.zip. This worker unzips it in the browser and answers the requests the
   lesson makes under scorm/<id>/..., so the original packages are used exactly as published. Nothing here touches the database. */
importScripts("assets/jszip.min.js");
var BASE = new URL("./", self.location).href, SC = BASE + "scorm/", ZIPS = {};
var TYPES = { html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8", xml: "application/xml; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm",
  txt: "text/plain; charset=utf-8", pdf: "application/pdf", xsd: "application/xml", wasm: "application/wasm", map: "application/json" };
function zipFor(id) {
  if (!ZIPS[id]) ZIPS[id] = fetch(BASE + "assets/pdu/zips/" + encodeURIComponent(id) + ".zip", { credentials: "same-origin" })
    .then(function (r) { if (!r.ok) throw new Error("zip " + r.status); return r.arrayBuffer(); })
    .then(function (b) { return JSZip.loadAsync(b); })
    .catch(function (e) { delete ZIPS[id]; throw e; });
  return ZIPS[id];
}
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  var u = e.request.url.split("#")[0].split("?")[0];
  if (u.indexOf(SC) !== 0) return;
  e.respondWith((function () {
    var rest; try { rest = decodeURIComponent(u.slice(SC.length)); } catch (x) { rest = u.slice(SC.length); }
    var i = rest.indexOf("/"), id = i < 0 ? rest : rest.slice(0, i), path = i < 0 ? "" : rest.slice(i + 1);
    if (!/^[a-z0-9-]+$/.test(id)) return new Response("Not found", { status: 404 });
    if (path === "" || path.slice(-1) === "/") path += "index.html";
    return zipFor(id).then(function (z) {
      var f = z.file(path);
      if (!f) { var low = path.toLowerCase(); z.forEach(function (p, o) { if (!f && !o.dir && p.toLowerCase() === low) f = o; }); }
      if (!f) return new Response("Not found", { status: 404 });
      return f.async("arraybuffer").then(function (buf) {
        var ext = path.split(".").pop().toLowerCase();
        return new Response(buf, { status: 200, headers: { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-cache" } });
      });
    }).catch(function () { return new Response("This lesson could not be loaded. Check your connection and try again.", { status: 503 }); });
  })());
});
