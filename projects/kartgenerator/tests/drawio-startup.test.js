import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

describe("draw.io startup", () => {
  it("answers a one-shot configure request even when the editor starts immediately", async () => {
    document.documentElement.innerHTML = readFileSync("projects/kartgenerator/index.html", "utf8");
    const frame = document.querySelector("#drawio-frame");
    // The editor must not navigate before the parent can answer its handshake.
    expect(frame.hasAttribute("src")).toBe(false);
    const postMessage = vi.spyOn(frame.contentWindow, "postMessage");
    const navigate = vi.fn(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://embed.diagrams.net",
        source: frame.contentWindow,
        data: JSON.stringify({ event: "configure" })
      }));
    });
    Object.defineProperty(frame, "src", { configurable: true, set: navigate });
    const { createDrawioController } = await import("../assets/js/drawio-controller.js");
    const { drawioEditorConfig } = await import("../assets/js/drawio-embed.js");
    const noop = () => {};
    createDrawioController({}).bindEvents({
      toggleMenu: noop, cleanDrawio: noop, cleanPng: noop,
      generatedDrawio: noop, generatedPng: noop
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(frame.dataset.src);
    expect(new URL(frame.dataset.src).searchParams.get("configure")).toBe("1");
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({
      action: "configure", config: drawioEditorConfig
    }), "https://embed.diagrams.net");
  });
});
