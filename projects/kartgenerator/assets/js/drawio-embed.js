export const drawioEditorConfig = {
  defaultPageVisible: false,
  preserveViewState: true,
  css: `
    .geTabContainer > :not(:last-child),
    .gePageTab,
    .geFooterContainer .gePageTab {
      display: none !important;
    }
  `
};

export function postDrawioMessage(frame, message, targetOrigin = "*") {
  frame.contentWindow.postMessage(JSON.stringify(message), targetOrigin);
}

export function loadDrawioXml(frame, xml, options = {}) {
  postDrawioMessage(frame, {
    action: options.keepZoom ? "merge" : "load",
    xml,
    autosave: options.autosave ? 1 : 0,
    modified: 0
  });
}

export function loadDrawioXmlWhenVisible(frame, xml, options = {}) {
  const {
    attemptsLeft = 12,
    requestFrame = requestAnimationFrame
  } = options;
  const hasSize = frame.offsetWidth > 0 && frame.offsetHeight > 0;

  if (!hasSize && attemptsLeft > 0) {
    requestFrame(() => loadDrawioXmlWhenVisible(frame, xml, {
      ...options,
      attemptsLeft: attemptsLeft - 1
    }));
    return;
  }

  requestFrame(() => {
    requestFrame(() => {
      loadDrawioXml(frame, xml, options);
    });
  });
}

export function exportDrawioPng(frame, xml) {
  postDrawioMessage(frame, {
    action: "export",
    format: "png",
    xml,
    scale: 1,
    border: 8,
    bg: "#ffffff",
    background: "#ffffff"
  });
}

export function handleDrawioMessage(event, { frame, pendingXml, onConfigure, onInit, onSave, onExport }) {
  if (!String(event.origin).includes("diagrams.net")) {
    return false;
  }

  let message;

  try {
    message = JSON.parse(event.data);
  } catch (error) {
    return false;
  }

  if (event.source !== frame.contentWindow) {
    return false;
  }

  if (message.event === "configure") {
    onConfigure(event.origin);
    return true;
  }

  if (message.event === "init" && pendingXml) {
    onInit(pendingXml);
    return true;
  }

  if (typeof message.xml === "string" && ["autosave", "save"].includes(message.event)) {
    onSave(message.xml);
    return true;
  }

  if (message.event === "export" && typeof message.data === "string" && message.data.startsWith("data:image/png")) {
    onExport(message.data);
    return true;
  }

  return false;
}
