import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const routes = new Map([
  ["/bas-map.drawio", ["extension-tests/fixtures/bas-map.drawio", "application/xml; charset=utf-8"]],
  ["/map-fixture.js", ["extension-tests/fixtures/map-fixture.js", "text/javascript; charset=utf-8"]],
  ["/", ["extension/popup.html", "text/html; charset=utf-8"]],
  ["/popup.css", ["extension/popup.css", "text/css; charset=utf-8"]],
  ["/bas-popup.js", ["extension/bas-popup.js", "text/javascript; charset=utf-8"]],
  ["/bas-selection.js", ["extension/bas-selection.js", "text/javascript; charset=utf-8"]],
  ["/preview-fixture.js", ["extension-tests/fixtures/preview-fixture.js", "text/javascript; charset=utf-8"]]
]);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname.startsWith("/map/") && request.method === "GET") {
    const relative = url.pathname.slice(5);
    const allowed = relative === "" || /^assets\/(js\/[a-z-]+\.js|css\/kartgenerator\.css)$/.test(relative);
    if (!allowed) { response.writeHead(404).end(); return; }
    try {
      let content = await readFile(new URL(relative || "index.html", root), "utf8");
      if (!relative) content = content.replace('</body>', '<script type="module" src="/map-fixture.js"></script></body>');
      response.writeHead(200, { "Content-Type": relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : relative.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', "Cache-Control": "no-store" });
      response.end(content);
    } catch { response.writeHead(500).end('Local map preview unavailable'); }
    return;
  }
  const route = routes.get(url.pathname);
  if (!route || request.method !== "GET") { response.writeHead(404).end(); return; }
  try {
    let content = await readFile(fileURLToPath(new URL(route[0], root)), "utf8");
    if (url.pathname === "/") content = content.replace('<script type="module" src="bas-popup.js"></script>', '<script src="preview-fixture.js"></script><script type="module" src="bas-popup.js"></script>');
    response.writeHead(200, { "Content-Type": route[1], "Cache-Control": "no-store" });
    response.end(content);
  } catch { response.writeHead(500).end("Preview unavailable"); }
});
server.listen(4178, "127.0.0.1", () => console.log("Demo med enbart testdata: http://127.0.0.1:4178 — inga anrop till BAS."));
