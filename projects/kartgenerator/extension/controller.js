import { createBasController } from "./bas-controller.js";

export function createController(browser) {
  const bas = createBasController(browser);

  return {
    async handle(message, sender) {
      if (sender?.id !== browser.runtime.id || sender?.url !== browser.runtime.getURL("popup.html") || sender.tab) {
        return { ok: false, error: { code: "NOT_ALLOWED", message: "Öppna BAS-tillägget från tilläggsikonen i Chrome." } };
      }
      return bas.handle(message);
    }
  };
}
