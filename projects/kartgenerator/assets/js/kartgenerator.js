
import { createDrawioController } from "./drawio-controller.js"
import { createDownloadController } from "./download.js"
import { createExcelController } from "./excel-controller.js"
import { createExampleController } from "./example.js"
import {
  getDuplicateMapPlaceRows,
  getEmptyMapPlaceRows,
  getMissingPeopleRows
} from "./diagnostics.js"
import { state } from "./state.js"
import {
  renderDuplicateMapPlacesTable,
  renderEmptyPlacesTable,
  renderLastUpdatedDate,
  renderMissingPeoplePanelVisible,
  renderMissingPeopleTable,
  renderMissingPeopleUnavailable
} from "./renderers.js"
import {
  duplicateMapPlacesElements,
  emptyPlacesElements,
  helpElements,
  lastUpdatedElements,
  missingPeopleElements
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

function showMissingPeopleTable(rows) {
  renderMissingPeopleTable({
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
  renderEmptyPlacesTable({
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
  renderDuplicateMapPlacesTable({
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
    renderMissingPeopleUnavailable({ elements: missingPeopleElements });
    return;
  }

  renderMissingPeoplePanelVisible({ elements: missingPeopleElements });
  state.missingPeopleRows = getMissingPeopleRows(state.sourceDrawioXml, state.excelRows, {
    placeColumnIndex: state.parsedOmradePlatsColumnIndex,
    firstNameColumnIndex,
    lastNameColumnIndex
  });
  showMissingPeopleTable(getSortedMissingPeopleRows());
}

const excelController = createExcelController({
  preserveWindowScroll,
  updateDuplicateMapPlacesList,
  updateEmptyPlacesList,
  updateGeneratedDiagram: () => drawioController.updateGeneratedDiagram(),
  updateMissingPeopleList
});

const downloadController = createDownloadController({
  closeExampleMenus: () => exampleController.closeMenus(),
  getSortedMissingPeopleRows
});

const drawioController = createDrawioController({
  closeDownloadMenu: downloadController.closeMenu,
  downloadPngWithWhiteBackground: downloadController.downloadPngWithWhiteBackground,
  getEmptyPlaceKey,
  getDrawioLabelOptions: excelController.getDrawioLabelOptions,
  getRowsForGeneratedDiagram: excelController.getRowsForGeneratedDiagram,
  getSortedMissingPeopleRows,
  isEmptyExcelPlaceRow: excelController.isEmptyExcelPlaceRow,
  preserveWindowScroll,
  reparseRows: excelController.reparseRows,
  updateDuplicateMapPlacesList,
  updateEmptyPlacesList,
  updateMissingPeopleList
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
