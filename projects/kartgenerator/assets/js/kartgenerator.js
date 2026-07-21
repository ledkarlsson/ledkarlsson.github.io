
import { createDrawioController } from "./drawio-controller.js"
import { createDiagnosticsController } from "./diagnostics-controller.js"
import { createDownloadController } from "./download.js"
import { createExcelController } from "./excel-controller.js"
import { createExampleController } from "./example.js"
import { state } from "./state.js"
import { renderLastUpdatedDate } from "./renderers.js"
import {
  helpElements,
  lastUpdatedElements
} from "./elements.js"

function preserveWindowScroll(callback) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const token = ++state.scrollRestoreToken;
  const restoreScroll = () => {
    if (token === state.scrollRestoreToken) {
      window.scrollTo(scrollX, scrollY);
    }
  };

  callback();
  restoreScroll();
  requestAnimationFrame(() => {
    restoreScroll();
    requestAnimationFrame(restoreScroll);
  });
  [0, 50, 150, 300].forEach((delay) => {
    setTimeout(restoreScroll, delay);
  });
}

function cancelPendingScrollRestore() {
  state.scrollRestoreToken += 1;
}

function showLastUpdatedDate() {
  const modifiedDate = new Date(document.lastModified);

  if (Number.isNaN(modifiedDate.getTime())) {
    modifiedDate.setTime(Date.now());
  }

  renderLastUpdatedDate({ modifiedDate, elements: lastUpdatedElements });
}

function showHelpDialog(event) {
  const dialog = helpElements.getDialog(event.currentTarget.dataset.helpTarget);

  if (dialog instanceof HTMLDialogElement) {
    dialog.showModal();
  }
}

const diagnosticsController = createDiagnosticsController({
  getCleanXmlForDisplay: () => drawioController.getCleanXmlForDisplay(),
  getColumnIndexByName: (columnName) => excelController.getColumnIndexByName(columnName),
  loadViewer: (xml, options) => drawioController.loadViewer(xml, options),
  preserveWindowScroll,
  scheduleCleanMapRefresh: () => drawioController.scheduleCleanMapRefresh()
});

const excelController = createExcelController({
  preserveWindowScroll,
  updateDuplicateMapPlacesList: diagnosticsController.updateDuplicateMapPlacesList,
  updateEmptyPlacesList: diagnosticsController.updateEmptyPlacesList,
  updateGeneratedDiagram: () => drawioController.updateGeneratedDiagram(),
  updateMissingPeopleList: diagnosticsController.updateMissingPeopleList
});

const downloadController = createDownloadController({
  closeExampleMenus: () => exampleController.closeMenus(),
  getSortedMissingPeopleRows: diagnosticsController.getSortedMissingPeopleRows
});

const drawioController = createDrawioController({
  closeDownloadMenu: downloadController.closeMenu,
  downloadPngWithWhiteBackground: downloadController.downloadPngWithWhiteBackground,
  getEmptyPlaceKey: diagnosticsController.getEmptyPlaceKey,
  getDrawioLabelOptions: excelController.getDrawioLabelOptions,
  getRowsForGeneratedDiagram: excelController.getRowsForGeneratedDiagram,
  getSortedMissingPeopleRows: diagnosticsController.getSortedMissingPeopleRows,
  isEmptyExcelPlaceRow: excelController.isEmptyExcelPlaceRow,
  preserveWindowScroll,
  reparseRows: excelController.reparseRows,
  updateDuplicateMapPlacesList: diagnosticsController.updateDuplicateMapPlacesList,
  updateEmptyPlacesList: diagnosticsController.updateEmptyPlacesList,
  updateMissingPeopleList: diagnosticsController.updateMissingPeopleList
});

const exampleController = createExampleController({
  closeDownloadMenu: downloadController.closeMenu,
  onLoadExcel: excelController.showFile,
  onLoadDrawio: drawioController.showFile
});

drawioController.bindEvents({
  toggleMenu: downloadController.toggleMenu,
  cleanDrawio: downloadController.downloadCleanDiagram,
  cleanPng: downloadController.downloadCleanPng,
  generatedDrawio: downloadController.downloadGeneratedDiagram,
  generatedPng: downloadController.downloadGeneratedPng
});
excelController.bindEvents();
exampleController.bindEvents();
downloadController.bindEvents();

showLastUpdatedDate();
window.kartgeneratorReady = true;

helpElements.buttons.forEach((button) => {
  button.addEventListener("click", showHelpDialog);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".example-menu")) {
    exampleController.closeMenus();
  }
});
window.addEventListener("wheel", cancelPendingScrollRestore, { passive: true });
window.addEventListener("touchmove", cancelPendingScrollRestore, { passive: true });
window.addEventListener("keydown", (event) => {
  if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) {
    cancelPendingScrollRestore();
  }
});
