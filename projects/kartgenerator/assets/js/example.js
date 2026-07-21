import { drawioExampleElements, excelExampleElements } from "./elements.js";
import { renderClosedExampleMenus, renderExampleMenu } from "./renderers.js";

const examples = {
  excel: {
    url: "assets/examples/exempel.xlsx",
    fileName: "exempel.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  drawio: {
    url: "assets/examples/exempel.drawio",
    fileName: "exempel.drawio",
    type: "application/xml"
  }
};

export function createExampleController(callbacks) {
  async function fetchBlob(example) {
    const response = await fetch(example.url);

    if (!response.ok) {
      throw new Error("Kunde inte hämta exempelfilen.");
    }

    return response.blob();
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function download(example) {
    closeMenus();

    try {
      downloadBlob(await fetchBlob(example), example.fileName);
    } catch (error) {
      window.location.href = example.url;
    }
  }

  async function getFile(example) {
    const blob = await fetchBlob(example);

    return new File([blob], example.fileName, { type: example.type });
  }

  async function load(example, onLoad) {
    closeMenus();
    onLoad(await getFile(example));
  }

  function closeMenus() {
    renderClosedExampleMenus({
      menus: [excelExampleElements.menuElements, drawioExampleElements.menuElements]
    });
  }

  function toggleMenu(elements) {
    const isOpening = elements.options.hidden;

    callbacks.closeDownloadMenu();
    closeMenus();
    renderExampleMenu({ isOpen: isOpening, elements });
  }

  function bindEvents() {
    excelExampleElements.button.addEventListener("click", () =>
      toggleMenu(excelExampleElements.menuElements)
    );
    drawioExampleElements.button.addEventListener("click", () =>
      toggleMenu(drawioExampleElements.menuElements)
    );
    excelExampleElements.downloadButton.addEventListener("click", () => download(examples.excel));
    drawioExampleElements.downloadButton.addEventListener("click", () => download(examples.drawio));
    excelExampleElements.loadButton.addEventListener("click", () => load(examples.excel, callbacks.onLoadExcel));
    drawioExampleElements.loadButton.addEventListener("click", () => load(examples.drawio, callbacks.onLoadDrawio));
  }

  return { bindEvents, closeMenus };
}
