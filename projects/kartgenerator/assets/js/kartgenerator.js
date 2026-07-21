
import { exportDrawioPng } from "./drawio-embed.js"
import { createDrawioController } from "./drawio-controller.js"
import { createExcelController } from "./excel-controller.js"
import {
  getDuplicateMapPlaceRows,
  getEmptyMapPlaceRows,
  getMissingPeopleRows
} from "./diagnostics.js"
import { createCleanDrawioXml } from "./drawio-model.js"
import { state } from "./state.js"
import {
  renderClosedExampleMenus as showClosedExampleMenus,
  renderDuplicateMapPlacesTable as showDuplicateMapPlacesTableView,
  renderDownloadMenu as showDownloadMenu,
  renderEmptyPlacesTable as showEmptyPlacesTableView,
  renderExampleMenu as showExampleMenu,
  renderLastUpdatedDate as showLastUpdatedDateView,
  renderMissingPeoplePanelVisible as showMissingPeoplePanelVisible,
  renderMissingPeopleTable as showMissingPeopleTableView,
  renderMissingPeopleUnavailable as showMissingPeopleUnavailable
} from "./renderers.js"
import {
  drawioElements,
  drawioExampleElements,
  downloadMenuElements,
  duplicateMapPlacesElements,
  emptyPlacesElements,
  excelExampleElements,
  helpElements,
  lastUpdatedElements,
  missingPeopleElements
} from "./elements.js"

const excelExample = {
  url: "assets/examples/exempel.xlsx",
  fileName: "exempel.xlsx",
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
const drawioExample = {
  url: "assets/examples/exempel.drawio",
  fileName: "exempel.drawio",
  type: "application/xml"
};

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

  showLastUpdatedDateView({ modifiedDate, elements: lastUpdatedElements });
}

function showHelpDialog(event) {
  const dialog = helpElements.getDialog(event.currentTarget.dataset.helpTarget);

  if (dialog instanceof HTMLDialogElement) {
    dialog.showModal();
  }
}

async function fetchExampleBlob(example) {
  const response = await fetch(example.url);

  if (!response.ok) {
    throw new Error("Kunde inte hämta exempelfilen.");
  }

  return response.blob();
}

async function downloadExampleAsset(example) {
  closeExampleMenus();

  try {
    const blob = await fetchExampleBlob(example);

    downloadBlob(blob, example.fileName);
  } catch (error) {
    window.location.href = example.url;
  }
}

async function getExampleFile(example) {
  const blob = await fetchExampleBlob(example);

  return new File([blob], example.fileName, { type: example.type });
}

async function loadExcelExample() {
  closeExampleMenus();
  excelController.showFile(await getExampleFile(excelExample));
}

async function loadDrawioExample() {
  closeExampleMenus();
  drawioController.showFile(await getExampleFile(drawioExample));
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

function downloadCleanDiagram() {
  downloadDrawioXml(createCleanDrawioXml(state.sourceDrawioXml), getCleanDrawioFileName());
}

function downloadGeneratedDiagram() {
  downloadDrawioXml(state.generatedDrawioXml, getGeneratedDrawioFileName());
}

function downloadCleanPng() {
  downloadDrawioPng(createCleanDrawioXml(state.sourceDrawioXml), getCleanPngFileName());
}

function downloadGeneratedPng() {
  downloadDrawioPng(state.generatedDrawioXml, getGeneratedPngFileName());
}

function toggleDownloadMenu() {
  const isOpening = downloadMenuElements.options.hidden;

  closeExampleMenus();
  showDownloadMenu({ isOpen: isOpening, elements: downloadMenuElements });
}

function closeDownloadMenu() {
  showDownloadMenu({ isOpen: false, elements: downloadMenuElements });
}

function toggleExampleMenu(options, button) {
  const isOpening = options.hidden;

  closeDownloadMenu();
  closeExampleMenus();
  showExampleMenu({
    isOpen: isOpening,
    elements: { options, button }
  });
}

function closeExampleMenus() {
  showClosedExampleMenus({
    menus: [excelExampleElements.menuElements, drawioExampleElements.menuElements]
  });
}

function runDownloadAction(action) {
  action();
  closeDownloadMenu();
}

function downloadDrawioPng(xml, fileName) {
  if (!xml) {
    return;
  }

  state.pendingPngFileName = fileName;
  exportDrawioPng(drawioElements.frame, xml);
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

function getGeneratedDrawioFileName() {
  const fallbackName = "genererad_karta.drawio";
  const fileName = state.sourceDrawioFileName || fallbackName;
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

function getCleanDrawioFileName() {
  const fallbackName = "karta.drawio";
  const fileName = state.sourceDrawioFileName || fallbackName;
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

function getPngFileName(drawioFileName) {
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

function getCleanPngFileName() {
  return getPngFileName(getCleanDrawioFileName());
}

function getGeneratedPngFileName() {
  return getPngFileName(getGeneratedDrawioFileName());
}

function showMissingPeopleTable(rows) {
  showMissingPeopleTableView({
    rows,
    sortColumn: state.missingSortColumn,
    sortDirection: state.missingSortDirection,
    elements: missingPeopleElements,
    onSort: sortMissingPeople
  });
}

function getSortedMissingPeopleRows() {
  return [...state.missingPeopleRows].sort((left, right) => {
    const leftValue = String(left[state.missingSortColumn] || "").localeCompare(
      String(right[state.missingSortColumn] || ""),
      "sv",
      { numeric: true, sensitivity: "base" }
    );

    return state.missingSortDirection === "asc" ? leftValue : -leftValue;
  });
}

function sortMissingPeople(columnKey) {
  if (state.missingSortColumn === columnKey) {
    state.missingSortDirection = state.missingSortDirection === "asc" ? "desc" : "asc";
  } else {
    state.missingSortColumn = columnKey;
    state.missingSortDirection = "asc";
  }

  showMissingPeopleTable(getSortedMissingPeopleRows());
}

function showEmptyPlacesTable(rows) {
  showEmptyPlacesTableView({
    rows,
    hasRequiredInput: Boolean(state.sourceDrawioXml) && state.parsedOmradePlatsColumnIndex !== null && state.excelRows.length > 0,
    sortColumn: state.emptyPlacesSortColumn,
    sortDirection: state.emptyPlacesSortDirection,
    elements: emptyPlacesElements,
    onSort: sortEmptyPlaces
  });
}

function getSortedEmptyPlaceRows() {
  return [...state.emptyPlaceRows].sort((left, right) => {
    const result = String(left[state.emptyPlacesSortColumn] || "").localeCompare(
      String(right[state.emptyPlacesSortColumn] || ""),
      "sv",
      { numeric: true, sensitivity: "base" }
    );

    return state.emptyPlacesSortDirection === "asc" ? result : -result;
  });
}

function sortEmptyPlaces(columnKey) {
  preserveWindowScroll(() => {
    if (state.emptyPlacesSortColumn === columnKey) {
      state.emptyPlacesSortDirection = state.emptyPlacesSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.emptyPlacesSortColumn = columnKey;
      state.emptyPlacesSortDirection = "asc";
    }

    showEmptyPlacesTable(getSortedEmptyPlaceRows());
  });
}

function showDuplicateMapPlacesTable(rows) {
  showDuplicateMapPlacesTableView({
    rows,
    hasSource: Boolean(state.sourceDrawioXml),
    elements: duplicateMapPlacesElements
  });
}

function getDuplicateMapPlaceKey(rows) {
  return rows.map((row) => `${row.normalizedPlace}:${row.count}`).join("|");
}

function getEmptyPlaceKey(rows) {
  return rows.map((row) => row.normalizedPlace).join("|");
}

function updateDuplicateMapPlacesList(options = {}) {
  const previousKey = getDuplicateMapPlaceKey(state.duplicateMapPlaceRows);

  state.duplicateMapPlaceRows = getDuplicateMapPlaceRows(state.sourceDrawioXml);
  showDuplicateMapPlacesTable(state.duplicateMapPlaceRows);

  const hasChanged = getDuplicateMapPlaceKey(state.duplicateMapPlaceRows) !== previousKey;

  if (options.reloadCleanMap && hasChanged && state.currentDrawioMode === "clean") {
    drawioController.scheduleCleanMapRefresh();
  }

  return hasChanged;
}

function updateEmptyPlacesList() {
  if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || state.excelRows.length === 0) {
    state.emptyPlaceRows = [];
    showEmptyPlacesTable([]);
    if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer && state.sourceDrawioXml) {
      drawioController.loadViewer(drawioController.getCleanXmlForDisplay(), { keepZoom: true });
    }
    return;
  }

  state.emptyPlaceRows = getEmptyMapPlaceRows(state.sourceDrawioXml, state.excelRows, state.parsedOmradePlatsColumnIndex);

  showEmptyPlacesTable(getSortedEmptyPlaceRows());

  if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer) {
    drawioController.loadViewer(drawioController.getCleanXmlForDisplay(), { keepZoom: true });
  }
}

function updateMissingPeopleList() {
  const firstNameColumnIndex = excelController.getColumnIndexByName("fornamn");
  const lastNameColumnIndex = excelController.getColumnIndexByName("efternamn");

  if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || firstNameColumnIndex < 0 || lastNameColumnIndex < 0 || state.excelRows.length === 0) {
    state.missingPeopleRows = [];
    showMissingPeopleUnavailable({ elements: missingPeopleElements });
    return;
  }

  showMissingPeoplePanelVisible({ elements: missingPeopleElements });
  state.missingPeopleRows = getMissingPeopleRows(state.sourceDrawioXml, state.excelRows, {
    placeColumnIndex: state.parsedOmradePlatsColumnIndex,
    firstNameColumnIndex,
    lastNameColumnIndex
  });
  showMissingPeopleTable(getSortedMissingPeopleRows());
}

function downloadMissingPeopleExcel() {
  if (!window.XLSX || state.missingPeopleRows.length === 0) {
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(getSortedMissingPeopleRows().map((row) => ({
    Plats: row.place,
    Fornamn: row.firstName,
    Efternamn: row.lastName
  })));
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Saknas i kartan");
  XLSX.writeFile(workbook, "saknas_i_kartan.xlsx");
}

const excelController = createExcelController({
  preserveWindowScroll,
  updateDuplicateMapPlacesList,
  updateEmptyPlacesList,
  updateGeneratedDiagram: () => drawioController.updateGeneratedDiagram(),
  updateMissingPeopleList
});

const drawioController = createDrawioController({
  closeDownloadMenu,
  downloadPngWithWhiteBackground,
  getEmptyPlaceKey,
  getRowsForGeneratedDiagram: excelController.getRowsForGeneratedDiagram,
  getSortedMissingPeopleRows,
  isEmptyExcelPlaceRow: excelController.isEmptyExcelPlaceRow,
  makeDrawioLabel: excelController.makeDrawioLabel,
  preserveWindowScroll,
  reparseRows: excelController.reparseRows,
  updateDuplicateMapPlacesList,
  updateEmptyPlacesList,
  updateMissingPeopleList
});

drawioController.bindEvents({
  toggleMenu: toggleDownloadMenu,
  cleanDrawio: () => runDownloadAction(downloadCleanDiagram),
  cleanPng: () => runDownloadAction(downloadCleanPng),
  generatedDrawio: () => runDownloadAction(downloadGeneratedDiagram),
  generatedPng: () => runDownloadAction(downloadGeneratedPng)
});
excelController.bindEvents();

showLastUpdatedDate();
window.kartgeneratorReady = true;

helpElements.buttons.forEach((button) => {
  button.addEventListener("click", showHelpDialog);
});
excelExampleElements.button.addEventListener("click", () => toggleExampleMenu(excelExampleElements.options, excelExampleElements.button));
drawioExampleElements.button.addEventListener("click", () => toggleExampleMenu(drawioExampleElements.options, drawioExampleElements.button));
excelExampleElements.downloadButton.addEventListener("click", () => downloadExampleAsset(excelExample));
drawioExampleElements.downloadButton.addEventListener("click", () => downloadExampleAsset(drawioExample));
excelExampleElements.loadButton.addEventListener("click", loadExcelExample);
drawioExampleElements.loadButton.addEventListener("click", loadDrawioExample);
missingPeopleElements.downloadButton.addEventListener("click", downloadMissingPeopleExcel);
document.addEventListener("click", (event) => {
  if (!downloadMenuElements.options.hidden && !event.target.closest("#download-menu")) {
    closeDownloadMenu();
  }

  if (!event.target.closest(".example-menu")) {
    closeExampleMenus();
  }
});
window.addEventListener("wheel", cancelPendingScrollRestore, { passive: true });
window.addEventListener("touchmove", cancelPendingScrollRestore, { passive: true });
window.addEventListener("keydown", (event) => {
  if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) {
    cancelPendingScrollRestore();
  }
});
