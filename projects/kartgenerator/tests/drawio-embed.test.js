import { describe, expect, it, vi } from "vitest";
import {
  exportDrawioPng,
  handleDrawioMessage,
  loadDrawioXml,
  loadDrawioXmlWhenVisible,
  postDrawioMessage
} from "../assets/js/drawio-embed.js";

function createFrame() {
  return {
    contentWindow: {
      postMessage: vi.fn()
    },
    offsetWidth: 100,
    offsetHeight: 80
  };
}

describe("postDrawioMessage", () => {
  it("serializes messages to the draw.io iframe", () => {
    const frame = createFrame();

    postDrawioMessage(frame, { action: "configure" }, "https://app.diagrams.net");

    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith('{"action":"configure"}', "https://app.diagrams.net");
  });
});

describe("loadDrawioXml", () => {
  it("loads XML with autosave enabled", () => {
    const frame = createFrame();

    loadDrawioXml(frame, "<mxfile />", { autosave: true });

    expect(JSON.parse(frame.contentWindow.postMessage.mock.calls[0][0])).toEqual({
      action: "load",
      xml: "<mxfile />",
      autosave: 1,
      modified: 0
    });
  });

  it("merges XML when keeping zoom", () => {
    const frame = createFrame();

    loadDrawioXml(frame, "<mxfile />", { keepZoom: true });

    expect(JSON.parse(frame.contentWindow.postMessage.mock.calls[0][0]).action).toBe("merge");
  });
});

describe("loadDrawioXmlWhenVisible", () => {
  it("waits until the iframe has size before loading XML", () => {
    const frame = createFrame();
    const callbacks = [];
    const requestFrame = (callback) => callbacks.push(callback);

    frame.offsetWidth = 0;
    frame.offsetHeight = 0;
    loadDrawioXmlWhenVisible(frame, "<hidden />", { attemptsLeft: 1, requestFrame });
    expect(frame.contentWindow.postMessage).not.toHaveBeenCalled();

    frame.offsetWidth = 100;
    frame.offsetHeight = 80;
    callbacks.shift()();
    callbacks.shift()();
    callbacks.shift()();

    expect(JSON.parse(frame.contentWindow.postMessage.mock.calls[0][0]).xml).toBe("<hidden />");
  });
});

describe("exportDrawioPng", () => {
  it("requests PNG export with a white background", () => {
    const frame = createFrame();

    exportDrawioPng(frame, "<mxfile />");

    expect(JSON.parse(frame.contentWindow.postMessage.mock.calls[0][0])).toEqual({
      action: "export",
      format: "png",
      xml: "<mxfile />",
      scale: 1,
      border: 8,
      bg: "#ffffff",
      background: "#ffffff"
    });
  });
});

describe("handleDrawioMessage", () => {
  it("ignores messages outside diagrams.net", () => {
    const frame = createFrame();
    const onSave = vi.fn();

    const handled = handleDrawioMessage({
      origin: "https://example.com",
      source: frame.contentWindow,
      data: JSON.stringify({ event: "save", xml: "<mxfile />" })
    }, {
      frame,
      pendingXml: "",
      onConfigure: () => {},
      onInit: () => {},
      onSave,
      onExport: () => {}
    });

    expect(handled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("routes configure, init, save and export events", () => {
    const frame = createFrame();
    const calls = [];
    const handlers = {
      frame,
      pendingXml: "<pending />",
      onConfigure: (origin) => calls.push(["configure", origin]),
      onInit: (xml) => calls.push(["init", xml]),
      onSave: (xml) => calls.push(["save", xml]),
      onExport: (dataUrl) => calls.push(["export", dataUrl])
    };

    [
      { event: "configure" },
      { event: "init" },
      { event: "autosave", xml: "<saved />" },
      { event: "export", data: "data:image/png;base64,abc" }
    ].forEach((message) => {
      expect(handleDrawioMessage({
        origin: "https://app.diagrams.net",
        source: frame.contentWindow,
        data: JSON.stringify(message)
      }, handlers)).toBe(true);
    });

    expect(calls).toEqual([
      ["configure", "https://app.diagrams.net"],
      ["init", "<pending />"],
      ["save", "<saved />"],
      ["export", "data:image/png;base64,abc"]
    ]);
  });
});
