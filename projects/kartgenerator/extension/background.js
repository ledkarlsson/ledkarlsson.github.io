import { createController } from "./controller.js";

const controller = createController(chrome);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  controller.handle(message, sender).then(sendResponse);
  return true;
});
