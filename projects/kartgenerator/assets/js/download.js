import { exportDrawioPng } from "./drawio-embed.js";
import { createCleanDrawioXml } from "./drawio-model.js";
import { downloadMenuElements, drawioElements, missingPeopleElements } from "./elements.js";
import { renderDownloadMenu } from "./renderers.js";
import { state } from "./state.js";

export function getGeneratedDrawioFileName(sourceFileName = "") {
  const fallbackName = "genererad_karta.drawio";
  const fileName = sourceFileName || fallbackName;
  const drawioXmlSuffix = ".drawio.xml";

  if (fileName.toLowerCase().endsWith(drawioXmlSuffix)) {
    return `${fileName.slice(0, -drawioXmlSuffix.length)}-genererad${drawioXmlSuffix}`;
  }

  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex > 0) {
    return `${fileName.slice(0, dotIndex)}-genererad${fileName.slice(dotIndex)}`;
  }

  return `${fileName}-genererad.drawio`;
}

export function getCleanDrawioFileName(sourceFileName = "") {
  const fallbackName = "karta.drawio";
  const fileName = sourceFileName || fallbackName;
  const drawioXmlSuffix = ".drawio.xml";

  if (fileName.toLowerCase().endsWith(drawioXmlSuffix)) {
    return `${fileName.slice(0, -drawioXmlSuffix.length)}-utan-bas-info${drawioXmlSuffix}`;
  }

  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex > 0) {
    return `${fileName.slice(0, dotIndex)}-utan-bas-info${fileName.slice(dotIndex)}`;
  }

  return `${fileName}-utan-bas-info.drawio`;
}

export function getPngFileName(drawioFileName) {
  const drawioXmlSuffix = ".drawio.xml";

  if (drawioFileName.toLowerCase().endsWith(drawioXmlSuffix)) {
    return `${drawioFileName.slice(0, -drawioXmlSuffix.length)}.png`;
  }

  const dotIndex = drawioFileName.lastIndexOf(".");

  if (dotIndex > 0) {
    return `${drawioFileName.slice(0, dotIndex)}.png`;
  }

  return `${drawioFileName}.png`;
}

export function createDownloadController(callbacks) {
  function closeMenu() {
    renderDownloadMenu({ isOpen: false, elements: downloadMenuElements });
  }

  function toggleMenu() {
    const isOpening = downloadMenuElements.options.hidden;

    callbacks.closeExampleMenus();
    renderDownloadMenu({ isOpen: isOpening, elements: downloadMenuElements });
  }

  function downloadDrawioXml(xml, fileName) {
    if (!xml) {
      return;
    }

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadDrawioPng(xml, fileName) {
    if (!xml) {
      return;
    }

    state.pendingPngFileName = fileName;
    exportDrawioPng(drawioElements.frame, xml);
  }

  function run(action) {
    action();
    closeMenu();
  }

  function downloadCleanDiagram() {
    run(() => downloadDrawioXml(
      createCleanDrawioXml(state.sourceDrawioXml),
      getCleanDrawioFileName(state.sourceDrawioFileName)
    ));
  }

  function downloadGeneratedDiagram() {
    run(() => downloadDrawioXml(
      state.generatedDrawioXml,
      getGeneratedDrawioFileName(state.sourceDrawioFileName)
    ));
  }

  function downloadCleanPng() {
    run(() => {
      const fileName = getCleanDrawioFileName(state.sourceDrawioFileName);
      downloadDrawioPng(createCleanDrawioXml(state.sourceDrawioXml), getPngFileName(fileName));
    });
  }

  function downloadGeneratedPng() {
    run(() => {
      const fileName = getGeneratedDrawioFileName(state.sourceDrawioFileName);
      downloadDrawioPng(state.generatedDrawioXml, getPngFileName(fileName));
    });
  }

  function downloadDataUrl(dataUrl, fileName) {
    const link = document.createElement("a");

    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  function downloadPngWithWhiteBackground(dataUrl, fileName) {
    const image = new Image();

    image.addEventListener("load", () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      downloadDataUrl(canvas.toDataURL("image/png"), fileName);
    });

    image.addEventListener("error", () => {
      downloadDataUrl(dataUrl, fileName);
    });

    image.src = dataUrl;
  }

  function downloadMissingPeopleExcel() {
    const rows = callbacks.getSortedMissingPeopleRows();

    if (!window.XLSX || rows.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      Plats: row.place,
      Fornamn: row.firstName,
      Efternamn: row.lastName
    })));
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Saknas i kartan");
    XLSX.writeFile(workbook, "saknas_i_kartan.xlsx");
  }

  function bindEvents() {
    missingPeopleElements.downloadButton.addEventListener("click", downloadMissingPeopleExcel);
    document.addEventListener("click", (event) => {
      if (!downloadMenuElements.options.hidden && !event.target.closest("#download-menu")) {
        closeMenu();
      }
    });
  }

  return {
    bindEvents,
    closeMenu,
    downloadCleanDiagram,
    downloadCleanPng,
    downloadGeneratedDiagram,
    downloadGeneratedPng,
    downloadPngWithWhiteBackground,
    toggleMenu
  };
}
