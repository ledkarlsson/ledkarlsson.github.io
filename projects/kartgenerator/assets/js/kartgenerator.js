import { parseOmradePlatsValue, isPlaceBoxLabel, normalizePlaceCode, normalizeColumnName, drawioLabelToText } from "./kartgenerator-utils.js";
import { getMapPlaceLabels } from "./drawio.js"
import {
  drawioEditorConfig,
  exportDrawioPng,
  handleDrawioMessage,
  loadDrawioXmlWhenVisible,
  postDrawioMessage
} from "./drawio-embed.js"
import {
  getDuplicateMapPlaceRows,
  getDuplicatePlaceInfo,
  getEmptyMapPlaceRows,
  getMissingPeopleRows,
  hasDuplicatePlace,
  isEmptyExcelPlaceRow as isEmptyExcelPlaceRowByIndexes
} from "./diagnostics.js"
import {
  createCleanDrawioXml,
  createDrawioXmlWithHighlightedDuplicatePlaces,
  createDrawioXmlWithHighlightedPlaces,
  getPlaceCodeFromCellLabel,
  hasRenamedNewPlacePlaceholder,
  markCellAsMissingExcelPlace,
  newPlaceBoxStyle,
  newPlacePlaceholder
} from "./drawio-model.js"
import {
  clearGeneratedDrawioXml,
  resetDiagnosticsState,
  resetDrawioState,
  resetExcelState,
  resetSelectedTableSort,
  setCurrentDrawioMode,
  setGeneratedDrawioXml,
  setManualDrawioMode,
  setSourceDrawioXml,
  state
} from "./state.js"
import {
  renderColumnsList as showColumnsList,
  renderClearedExcelState as showClearedExcelState,
  renderClosedExampleMenus as showClosedExampleMenus,
  renderDuplicateMapPlacesTable as showDuplicateMapPlacesTableView,
  renderDownloadMenu as showDownloadMenu,
  renderDrawioControls as showDrawioControls,
  renderEmptyPlacesTable as showEmptyPlacesTableView,
  renderExampleMenu as showExampleMenu,
  renderFullscreenButton as showFullscreenButton,
  renderMissingPeopleTable as showMissingPeopleTableView,
  renderSelectedColumnsStatus as showSelectedColumnsStatus,
  renderSelectedDataTable as showSelectedDataTable
} from "./renderers.js"
import {
  clearedExcelElements,
  columnsElements,
  drawioControlElements,
  drawioElements,
  drawioExampleElements,
  downloadMenuElements,
  duplicateMapPlacesElements,
  emptyPlacesElements,
  excelElements,
  excelExampleElements,
  helpElements,
  lastUpdatedElements,
  missingPeopleElements,
  parseElements,
  selectedTableElements,
  workspaceElements
} from "./elements.js"

const excelTypes = [".xls", ".xlsx"];
const drawioTypes = [".drawio", ".drawio.xml"];
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

const parseSourceValues = ["varvsomrade", "brygga", "vinterplats"];

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

  lastUpdatedElements.date.dateTime = modifiedDate.toISOString().slice(0, 10);
  lastUpdatedElements.date.textContent = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(modifiedDate);
  lastUpdatedElements.container.hidden = false;
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
  showFile(await getExampleFile(excelExample));
}

async function loadDrawioExample() {
  closeExampleMenus();
  showDrawioFile(await getExampleFile(drawioExample));
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function clearColumns(message) {
  showClearedExcelState({ message, elements: clearedExcelElements });
  resetExcelState();
  resetDiagnosticsState();
  updateSelectedTable();
  updateGeneratedDiagram();
  updateMissingPeopleList();
  updateEmptyPlacesList();
  updateDuplicateMapPlacesList();
}

function updateSelectedColumnsStatus() {
  const visibleColumnNames = state.selectedColumnIndexes
    .map((columnIndex) => state.excelColumns[columnIndex])
    .filter((column) => column && !isRequiredColumn(column))
    .map((column) => column.name);

  showSelectedColumnsStatus({
    columnNames: visibleColumnNames,
    element: columnsElements.selectedStatus
  });
}

function isRequiredColumn(column) {
  return normalizeColumnName(column.name) === "omrade/plats";
}

function getColumnDisplayName(column) {
  return isRequiredColumn(column) ? "Plats" : column.name;
}

function getSelectedParseSource() {
  const selectedInput = [...parseElements.sourceInputs].find((input) => input.checked);
  return selectedInput ? selectedInput.value : "varvsomrade";
}

function setSelectedParseSource(source) {
  parseElements.sourceInputs.forEach((input) => {
    input.checked = input.value === source;
  });
}

function getAvailableParseSources(rows, omradePlatsColumnIndex) {
  if (omradePlatsColumnIndex === null) {
    return [];
  }

  return parseSourceValues.filter((source) =>
    rows.some((row) => parseOmradePlatsValue(row[omradePlatsColumnIndex], source))
  );
}

function countMatchingMapPlaces(rows, omradePlatsColumnIndex, source) {
  const mapPlaces = getMapPlaceLabels(state.sourceDrawioXml);
  const matchedPlaces = new Set();

  rows.forEach((row) => {
    const place = parseOmradePlatsValue(row[omradePlatsColumnIndex], source);
    const normalizedPlace = normalizePlaceCode(place);

    if (normalizedPlace && mapPlaces.has(normalizedPlace)) {
      matchedPlaces.add(normalizedPlace);
    }
  });

  return matchedPlaces.size;
}

function getParseSourceMatchCounts(rows, omradePlatsColumnIndex) {
  if (!state.sourceDrawioXml || omradePlatsColumnIndex === null) {
    return Object.fromEntries(parseSourceValues.map((source) => [source, 0]));
  }

  return Object.fromEntries(parseSourceValues.map((source) => [
    source,
    countMatchingMapPlaces(rows, omradePlatsColumnIndex, source)
  ]));
}

function detectParseSource(rows, omradePlatsColumnIndex) {
  const availableSources = getAvailableParseSources(rows, omradePlatsColumnIndex);

  if (availableSources.length === 0) {
    return;
  }

  if (state.sourceDrawioXml) {
    const matchCounts = getParseSourceMatchCounts(rows, omradePlatsColumnIndex);
    const bestSource = availableSources
      .map((source) => ({ source, count: matchCounts[source] || 0 }))
      .sort((left, right) => right.count - left.count)[0];
    const bestCount = bestSource ? bestSource.count : 0;
    const sourcesWithBestCount = availableSources.filter((source) => (matchCounts[source] || 0) === bestCount);

    if (bestCount > 0 && sourcesWithBestCount.length === 1) {
      setSelectedParseSource(bestSource.source);
      return;
    }
  }

  if (availableSources.length === 1) {
    setSelectedParseSource(availableSources[0]);
  }
}

function parseRows(columns, rows, shouldDetectParseSource = true) {
  const omradePlatsColumn = columns.find((column) => normalizeColumnName(column.name) === "omrade/plats");

  if (!omradePlatsColumn) {
    state.parsedOmradePlatsColumnIndex = null;
    return rows;
  }

  state.parsedOmradePlatsColumnIndex = omradePlatsColumn.index;

  if (shouldDetectParseSource) {
    detectParseSource(rows, omradePlatsColumn.index);
  }

  return rows.map((row) => {
    const parsedRow = [...row];
    parsedRow.rawOmradePlats = row[omradePlatsColumn.index];
    parsedRow[omradePlatsColumn.index] = parseOmradePlatsValue(row[omradePlatsColumn.index], getSelectedParseSource());
    return parsedRow;
  });
}

function reparseRows(shouldDetectParseSource = false) {
  if (state.excelColumns.length === 0 || state.rawExcelRows.length === 0) {
    return;
  }

  state.excelRows = parseRows(state.excelColumns, state.rawExcelRows, shouldDetectParseSource);
  updateSelectedTable();
}

function updateParseControlsVisibility() {
  const availableSources = state.parsedOmradePlatsColumnIndex !== null
    && state.selectedColumnIndexes.includes(state.parsedOmradePlatsColumnIndex)
    && state.rawExcelRows.length > 0
    ? getAvailableParseSources(state.rawExcelRows, state.parsedOmradePlatsColumnIndex)
    : [];
  const shouldShow = availableSources.length > 1;

  parseElements.sourceInputs.forEach((input) => {
    const label = input.closest("label");

    if (label) {
      label.hidden = !availableSources.includes(input.value);
    }
  });

  if (availableSources.length === 1) {
    setSelectedParseSource(availableSources[0]);
  } else if (availableSources.length > 1 && !availableSources.includes(getSelectedParseSource())) {
    setSelectedParseSource(availableSources[0]);
  }

  parseElements.controls.classList.toggle("is-visible", shouldShow);
}

function getVisibleRows() {
  return state.selectedColumnIndexes.includes(state.parsedOmradePlatsColumnIndex)
    ? state.excelRows.filter((row) => {
      const value = row[state.parsedOmradePlatsColumnIndex];
      const hasPlace = value !== null && value !== undefined && String(value).trim() !== "";

      return hasPlace && (parseElements.showEmptyExcelPlacesInput.checked || !isEmptyExcelPlaceRow(row));
    })
    : state.excelRows;
}

function getRowsForGeneratedDiagram() {
  return state.selectedColumnIndexes.includes(state.parsedOmradePlatsColumnIndex)
    ? state.excelRows.filter((row) => {
      const value = row[state.parsedOmradePlatsColumnIndex];
      const hasPlace = value !== null && value !== undefined && String(value).trim() !== "";

      return hasPlace;
    })
    : state.excelRows;
}

function isEmptyExcelPlaceRow(row) {
  return isEmptyExcelPlaceRowByIndexes(row, {
    placeColumnIndex: state.parsedOmradePlatsColumnIndex,
    firstNameColumnIndex: getColumnIndexByName("fornamn"),
    lastNameColumnIndex: getColumnIndexByName("efternamn")
  });
}

function getSortedSelectedRows(rows) {
  if (state.selectedTableSortColumnIndex === null || !state.selectedColumnIndexes.includes(state.selectedTableSortColumnIndex)) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[state.selectedTableSortColumnIndex] === null || left[state.selectedTableSortColumnIndex] === undefined
      ? ""
      : String(left[state.selectedTableSortColumnIndex]);
    const rightValue = right[state.selectedTableSortColumnIndex] === null || right[state.selectedTableSortColumnIndex] === undefined
      ? ""
      : String(right[state.selectedTableSortColumnIndex]);
    const result = leftValue.localeCompare(rightValue, "sv", { numeric: true, sensitivity: "base" });

    return state.selectedTableSortDirection === "asc" ? result : -result;
  });
}

function sortSelectedTable(columnIndex) {
  preserveWindowScroll(() => {
    if (state.selectedTableSortColumnIndex === columnIndex) {
      state.selectedTableSortDirection = state.selectedTableSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.selectedTableSortColumnIndex = columnIndex;
      state.selectedTableSortDirection = "asc";
    }

    updateSelectedTable();
  });
}

function updateSelectedTable(options = {}) {
  const shouldUpdateGeneratedDiagram = options.updateGeneratedDiagram !== false;

  updateParseControlsVisibility();

  if (state.selectedTableSortColumnIndex !== null && !state.selectedColumnIndexes.includes(state.selectedTableSortColumnIndex)) {
    resetSelectedTableSort();
  }

  if (state.selectedColumnIndexes.length === 0) {
    showSelectedDataTable({
      rows: [],
      visibleRowCount: 0,
      selectedColumnIndexes: state.selectedColumnIndexes,
      parsedOmradePlatsColumnIndex: state.parsedOmradePlatsColumnIndex,
      excelColumns: state.excelColumns,
      sortColumnIndex: state.selectedTableSortColumnIndex,
      sortDirection: state.selectedTableSortDirection,
      duplicatePlaces: [],
      elements: selectedTableElements,
      getColumnDisplayName,
      isDuplicateRow: () => false,
      onSort: sortSelectedTable
    });
    updateMissingPeopleList();
    updateEmptyPlacesList();
    if (shouldUpdateGeneratedDiagram) {
      updateGeneratedDiagram();
    }
    return;
  }

  const visibleRows = getVisibleRows();
  updateMissingPeopleList();
  updateEmptyPlacesList();

  if (visibleRows.length === 0) {
    showSelectedDataTable({
      rows: [],
      visibleRowCount: 0,
      selectedColumnIndexes: state.selectedColumnIndexes,
      parsedOmradePlatsColumnIndex: state.parsedOmradePlatsColumnIndex,
      excelColumns: state.excelColumns,
      sortColumnIndex: state.selectedTableSortColumnIndex,
      sortDirection: state.selectedTableSortDirection,
      duplicatePlaces: [],
      elements: selectedTableElements,
      getColumnDisplayName,
      isDuplicateRow: () => false,
      onSort: sortSelectedTable
    });
    updateEmptyPlacesList();
    if (shouldUpdateGeneratedDiagram) {
      updateGeneratedDiagram();
    }
    return;
  }

  const sortedRows = getSortedSelectedRows(visibleRows);
  const { duplicatePlaces, duplicatePlaceCodes } = getDuplicatePlaceInfo(visibleRows, state.parsedOmradePlatsColumnIndex);
  showSelectedDataTable({
    rows: sortedRows,
    visibleRowCount: visibleRows.length,
    selectedColumnIndexes: state.selectedColumnIndexes,
    parsedOmradePlatsColumnIndex: state.parsedOmradePlatsColumnIndex,
    excelColumns: state.excelColumns,
    sortColumnIndex: state.selectedTableSortColumnIndex,
    sortDirection: state.selectedTableSortDirection,
    duplicatePlaces,
    elements: selectedTableElements,
    getColumnDisplayName,
    isDuplicateRow: (row) => hasDuplicatePlace(row, duplicatePlaceCodes, state.parsedOmradePlatsColumnIndex),
    onSort: sortSelectedTable
  });
  if (shouldUpdateGeneratedDiagram) {
    updateGeneratedDiagram();
  }
}

function updateColumns(columns, sheetName) {
  state.excelColumns = columns;
  state.selectedColumnIndexes = ["omrade/plats", "fornamn", "efternamn"]
    .map((columnName) => columns.find((column) => normalizeColumnName(column.name) === columnName))
    .filter(Boolean)
    .map((column) => column.index);

  showColumnsList({
    columns,
    sheetName,
    selectedColumnIndexes: state.selectedColumnIndexes,
    elements: columnsElements,
    isRequiredColumn,
    onToggleColumn: (columnIndex, isSelected) => {
      preserveWindowScroll(() => {
        if (isSelected) {
          state.selectedColumnIndexes.push(columnIndex);
        } else {
          state.selectedColumnIndexes = state.selectedColumnIndexes.filter((selectedColumnIndex) => selectedColumnIndex !== columnIndex);
        }

        updateSelectedColumnsStatus();
        updateSelectedTable();
      });
    }
  });

  updateSelectedColumnsStatus();
  updateSelectedTable();
}

function readColumns(file) {
  if (!window.XLSX) {
    excelElements.fileStatus.textContent = "Excel-läsaren kunde inte laddas. Kontrollera internetanslutningen och uppdatera sidan.";
    excelElements.fileStatus.classList.add("has-error");
    clearColumns("Excel-läsaren är inte tillgänglig.");
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", (event) => {
    try {
      const workbook = XLSX.read(event.target.result, { type: "array" });
      const [firstSheetName] = workbook.SheetNames;

      if (!firstSheetName) {
        clearColumns("Inga blad hittades i arbetsboken.");
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
      const headerRowIndex = rows.findIndex((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
      const headerRow = rows[headerRowIndex] || [];
      const columns = Array.from({ length: headerRow.length }, (_, index) => {
        const cell = headerRow[index];
        const value = cell === null || cell === undefined ? "" : String(cell).trim();
        return {
          index,
          name: value || `Kolumn ${index + 1}`
        };
      });

      state.rawExcelRows = rows.slice(headerRowIndex + 1);
      state.excelRows = parseRows(columns, state.rawExcelRows);
      updateColumns(columns, firstSheetName);
    } catch (error) {
      excelElements.fileStatus.textContent = "Kunde inte läsa Excel-filen.";
      excelElements.fileStatus.classList.add("has-error");
      clearColumns("Försök med en annan .xls- eller .xlsx-fil.");
    }
  });

  reader.readAsArrayBuffer(file);
}

function showFile(file) {
  const fileName = file.name.toLowerCase();
  const isExcelFile = excelTypes.some((extension) => fileName.endsWith(extension));

  excelElements.uploadZone.classList.remove("has-file");
  excelElements.fileStatus.classList.remove("has-file", "has-error");

  if (!isExcelFile) {
    excelElements.fileStatus.textContent = "Välj en Excel-fil som slutar med .xls eller .xlsx.";
    excelElements.fileStatus.classList.add("has-error");
    excelElements.panelTitle.textContent = "Excel-data";
    excelElements.upload.value = "";
    excelElements.uploadZone.hidden = false;
    clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
    return;
  }

  excelElements.fileStatus.textContent = "";
  excelElements.fileStatus.classList.add("has-file");
  excelElements.panelTitle.textContent = file.name;
  excelElements.clearButton.hidden = false;
  excelExampleElements.menu.hidden = true;
  excelElements.uploadZone.classList.add("has-file");
  excelElements.uploadZone.hidden = true;
  clearColumns("Läser kolumner...");
  columnsElements.panel.hidden = false;
  selectedTableElements.panel.hidden = false;
  readColumns(file);
}

function setDrawioUploadMessage(title, help = "") {
  drawioElements.uploadZone.replaceChildren();

  const titleElement = document.createElement("span");
  titleElement.className = "drawio-title";
  titleElement.textContent = title;
  drawioElements.uploadZone.append(titleElement);

  if (help) {
    const helpElement = document.createElement("span");
    helpElement.className = "drawio-help";
    helpElement.textContent = help;
    drawioElements.uploadZone.append(helpElement);
  }

  drawioElements.uploadZone.append(drawioElements.upload);
}

function resetDrawioUploadMessage() {
  setDrawioUploadMessage(
    "Ladda upp karta",
    "Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja"
  );
}

function showDrawioFile(file) {
  const fileName = file.name.toLowerCase();
  const isDrawioFile = drawioTypes.some((extension) => fileName.endsWith(extension));

  drawioElements.uploadZone.classList.remove("has-error", "has-file");

  if (!isDrawioFile) {
    setDrawioUploadMessage("Välj en kartfil som slutar med .drawio eller .drawio.xml.");
    drawioElements.uploadZone.classList.add("has-error");
    drawioElements.panelTitle.textContent = "Karta";
    drawioElements.upload.value = "";
    resetDrawioState();
    drawioElements.viewer.hidden = true;
    drawioElements.uploadZone.hidden = false;
    updateDrawioButtons();
    updateMissingPeopleList();
    updateEmptyPlacesList();
    updateDuplicateMapPlacesList();
    updateGeneratedDiagram();
    return;
  }

  drawioElements.panelTitle.textContent = file.name;
  drawioElements.clearButton.hidden = false;
  drawioExampleElements.menu.hidden = true;
  state.sourceDrawioFileName = file.name;
  drawioElements.uploadZone.replaceChildren();
  drawioElements.uploadZone.classList.add("has-file");
  drawioElements.uploadZone.append(drawioElements.upload);
  drawioElements.uploadZone.hidden = true;
  readDrawioFile(file);
}

function clearExcelFile() {
  excelElements.upload.value = "";
  excelElements.panelTitle.textContent = "Excel-data från BAS-rapport";
  excelElements.clearButton.hidden = true;
  excelExampleElements.menu.hidden = false;
  excelElements.uploadZone.hidden = false;
  excelElements.uploadZone.classList.remove("has-file");
  excelElements.fileStatus.textContent = "";
  excelElements.fileStatus.classList.remove("has-file", "has-error");
  clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
}

function clearDrawioFile() {
  drawioElements.upload.value = "";
  drawioElements.panelTitle.textContent = "Karta";
  drawioElements.clearButton.hidden = true;
  drawioExampleElements.menu.hidden = false;
  drawioElements.uploadZone.hidden = false;
  drawioElements.uploadZone.classList.remove("has-file", "has-error");
  resetDrawioUploadMessage();
  drawioElements.viewer.hidden = true;
  resetDrawioState();
  updateDrawioButtons();
  updateMissingPeopleList();
  updateEmptyPlacesList();
  updateDuplicateMapPlacesList();
  updateGeneratedDiagram();
}

function loadDrawioViewer(xml, options = {}) {
  state.pendingDrawioXml = xml;
  drawioElements.viewer.hidden = false;
  loadDrawioXmlWhenVisible(drawioElements.frame, xml, { autosave: true, keepZoom: options.keepZoom });
}

function showCleanMap() {
  if (!state.sourceDrawioXml) {
    return;
  }

  setManualDrawioMode(true);
  setCurrentDrawioMode("clean");
  loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
  updateDrawioButtons();
}

function showGeneratedMap() {
  if (!state.generatedDrawioXml) {
    return;
  }

  setManualDrawioMode(true);
  setCurrentDrawioMode("generated");
  loadDrawioViewer(state.generatedDrawioXml, { keepZoom: true });
  updateDrawioButtons();
}

function scheduleCleanMapRefresh() {
  window.clearTimeout(state.cleanMapRefreshTimer);
  state.cleanMapRefreshTimer = window.setTimeout(() => {
    state.cleanMapRefreshTimer = 0;

    if (state.currentDrawioMode === "clean" && state.sourceDrawioXml) {
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }
  }, 350);
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement === workspaceElements.mapWorkspace;

  showFullscreenButton({ isFullscreen, element: drawioControlElements.fullscreenButton });
}

function getCurrentDrawioXml() {
  return state.currentDrawioMode === "generated" && state.generatedDrawioXml ? state.generatedDrawioXml : getCleanDrawioXmlForDisplay();
}

function refitMapAfterFullscreenExit() {
  const xml = getCurrentDrawioXml();

  if (!xml || document.fullscreenElement === workspaceElements.mapWorkspace) {
    return;
  }

  loadDrawioViewer(xml);
}

function handleFullscreenChange() {
  const isMapFullscreen = document.fullscreenElement === workspaceElements.mapWorkspace;

  updateFullscreenButton();

  if (state.wasMapFullscreen && !isMapFullscreen) {
    requestAnimationFrame(() => {
      requestAnimationFrame(refitMapAfterFullscreenExit);
    });
  }

  state.wasMapFullscreen = isMapFullscreen;
}

async function toggleMapFullscreen() {
  if (!state.sourceDrawioXml || !document.fullscreenEnabled) {
    return;
  }

  try {
    if (document.fullscreenElement === workspaceElements.mapWorkspace) {
      await document.exitFullscreen();
    } else {
      await workspaceElements.mapWorkspace.requestFullscreen();
    }
  } finally {
    updateFullscreenButton();
  }
}

function updateDrawioButtons() {
  const hasSource = Boolean(state.sourceDrawioXml);
  const hasGenerated = Boolean(state.generatedDrawioXml);

  showDrawioControls({
    hasSource,
    hasGenerated,
    currentMode: state.currentDrawioMode,
    fullscreenEnabled: document.fullscreenEnabled,
    isFullscreen: document.fullscreenElement === workspaceElements.mapWorkspace,
    elements: drawioControlElements
  });

  if (!hasSource) {
    closeDownloadMenu();
  }
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
  URL.revokeObjectURL(url);
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

function makeDrawioLabel(row) {
  const fornamnColumnIndex = state.excelColumns.findIndex((column) => normalizeColumnName(column.name) === "fornamn");
  const efternamnColumnIndex = state.excelColumns.findIndex((column) => normalizeColumnName(column.name) === "efternamn");
  const shouldCombineName = state.selectedColumnIndexes.includes(fornamnColumnIndex)
    && state.selectedColumnIndexes.includes(efternamnColumnIndex);
  const lines = [];

  state.selectedColumnIndexes.forEach((columnIndex) => {
    const value = row[columnIndex];

    if (value === null || value === undefined || String(value).trim() === "") {
      return;
    }

    if (columnIndex === state.parsedOmradePlatsColumnIndex) {
      if (parseElements.showPlaceNumberInput.checked) {
        lines.push(String(value).trim());
      }

      return;
    }

    if (shouldCombineName && columnIndex === fornamnColumnIndex) {
      const firstName = String(value).trim();
      const lastName = row[efternamnColumnIndex] === null || row[efternamnColumnIndex] === undefined
        ? ""
        : String(row[efternamnColumnIndex]).trim();
      const fullName = `${firstName} ${lastName}`.trim();

      lines.push(parseElements.showColumnNamesInput.checked ? `Namn: ${fullName}` : fullName);
      return;
    }

    if (shouldCombineName && columnIndex === efternamnColumnIndex) {
      return;
    }

    lines.push(parseElements.showColumnNamesInput.checked
      ? `${state.excelColumns[columnIndex].name}: ${String(value).trim()}`
      : String(value).trim());
  });

  return lines.join("<br>");
}


function getColumnIndexByName(columnName) {
  const normalizedName = normalizeColumnName(columnName);
  return state.excelColumns.findIndex((column) => normalizeColumnName(column.name) === normalizedName);
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
    scheduleCleanMapRefresh();
  }

  return hasChanged;
}

function updateEmptyPlacesList() {
  if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || state.excelRows.length === 0) {
    state.emptyPlaceRows = [];
    showEmptyPlacesTable([]);
    if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer && state.sourceDrawioXml) {
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }
    return;
  }

  state.emptyPlaceRows = getEmptyMapPlaceRows(state.sourceDrawioXml, state.excelRows, state.parsedOmradePlatsColumnIndex);

  showEmptyPlacesTable(getSortedEmptyPlaceRows());

  if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer) {
    loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
  }
}

function updateMissingPeopleList() {
  const firstNameColumnIndex = getColumnIndexByName("fornamn");
  const lastNameColumnIndex = getColumnIndexByName("efternamn");

  if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || firstNameColumnIndex < 0 || lastNameColumnIndex < 0 || state.excelRows.length === 0) {
    missingPeopleElements.panel.hidden = true;
    state.missingPeopleRows = [];
    missingPeopleElements.addButton.hidden = true;
    missingPeopleElements.downloadButton.disabled = true;
    return;
  }

  missingPeopleElements.panel.hidden = false;
  state.missingPeopleRows = getMissingPeopleRows(state.sourceDrawioXml, state.excelRows, {
    placeColumnIndex: state.parsedOmradePlatsColumnIndex,
    firstNameColumnIndex,
    lastNameColumnIndex
  });
  showMissingPeopleTable(getSortedMissingPeopleRows());
}

function updateSourceDrawioXml(xml) {
  const rawXml = String(xml || "").trim();
  const shouldRefreshRenamedNewPlace = state.currentDrawioMode === "clean" && hasRenamedNewPlacePlaceholder(rawXml);
  const updatedXml = createCleanDrawioXml(rawXml).trim();
  const previousEmptyPlaceKey = getEmptyPlaceKey(state.emptyPlaceRows);

  if (!updatedXml || updatedXml === state.sourceDrawioXml) {
    return;
  }

  const shouldRefreshGeneratedView = state.currentDrawioMode === "generated";

  setSourceDrawioXml(updatedXml);
  const shouldRefreshDuplicateMapPlaces = updateDuplicateMapPlacesList();

  preserveWindowScroll(() => {
    state.shouldReloadDrawioViewer = shouldRefreshGeneratedView;

    try {
      if (state.excelColumns.length > 0 && state.rawExcelRows.length > 0) {
        reparseRows(true);
      } else {
        updateMissingPeopleList();
        updateEmptyPlacesList();
        updateGeneratedDiagram();
      }
    } finally {
      state.shouldReloadDrawioViewer = true;
    }
  });

  const shouldRefreshEmptyPlaces = getEmptyPlaceKey(state.emptyPlaceRows) !== previousEmptyPlaceKey;

  if (shouldRefreshRenamedNewPlace) {
    scheduleCleanMapRefresh();
  }

  if (shouldRefreshDuplicateMapPlaces && state.currentDrawioMode === "clean") {
    scheduleCleanMapRefresh();
  }

  if (shouldRefreshEmptyPlaces && state.currentDrawioMode === "clean") {
    scheduleCleanMapRefresh();
  }
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

function getCellGeometry(cell) {
  const geometry = [...cell.children].find((child) => child.tagName === "mxGeometry");

  if (!geometry) {
    return null;
  }

  const parsedGeometry = {
    x: Number(geometry.getAttribute("x") || 0),
    y: Number(geometry.getAttribute("y") || 0),
    width: Number(geometry.getAttribute("width") || 0),
    height: Number(geometry.getAttribute("height") || 0)
  };

  return Object.values(parsedGeometry).every(Number.isFinite) ? parsedGeometry : null;
}

function getNewBoxStartPosition(documentXml) {
  const placeCells = [];
  const generatedPlaceCells = [];
  const fallbackCells = [];

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const geometry = getCellGeometry(cell);

    if (!geometry) {
      return;
    }

    const placeCode = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");
    const cellInfo = {
      geometry,
      placeNumber: Number.parseInt(placeCode, 10),
      isGenerated: String(cell.getAttribute("id") || "").startsWith("kartgenerator-missing-")
    };

    if (placeCode) {
      placeCells.push(cellInfo);

      if (cellInfo.isGenerated) {
        generatedPlaceCells.push(cellInfo);
      }
    } else {
      fallbackCells.push(cellInfo);
    }
  });

  const bottomCell = (cells) => cells.reduce((bottomCellInfo, cellInfo) => {
    const bottomEdge = cellInfo.geometry.y + cellInfo.geometry.height;
    const currentBottomEdge = bottomCellInfo.geometry.y + bottomCellInfo.geometry.height;

    if (bottomEdge > currentBottomEdge) {
      return cellInfo;
    }

    if (bottomEdge === currentBottomEdge && cellInfo.geometry.x < bottomCellInfo.geometry.x) {
      return cellInfo;
    }

    return bottomCellInfo;
  }, cells[0]);

  if (generatedPlaceCells.length > 0) {
    const anchor = bottomCell(generatedPlaceCells).geometry;

    return {
      x: Math.round(anchor.x / 10) * 10,
      y: Math.ceil((anchor.y + anchor.height + 16) / 10) * 10
    };
  }

  const existingCells = placeCells.length > 0 ? placeCells : fallbackCells;

  if (existingCells.length === 0) {
    return { x: 0, y: 0 };
  }

  const anchor = existingCells.reduce((anchorCell, cellInfo) => {
    if (Number.isFinite(cellInfo.placeNumber) && Number.isFinite(anchorCell.placeNumber)) {
      return cellInfo.placeNumber > anchorCell.placeNumber ? cellInfo : anchorCell;
    }

    if (Number.isFinite(cellInfo.placeNumber)) {
      return cellInfo;
    }

    if (Number.isFinite(anchorCell.placeNumber)) {
      return anchorCell;
    }

    const rightEdge = cellInfo.geometry.x + cellInfo.geometry.width;
    const currentRightEdge = anchorCell.geometry.x + anchorCell.geometry.width;

    return rightEdge > currentRightEdge ? cellInfo : anchorCell;
  }, existingCells[0]).geometry;

  return {
    x: Math.ceil((anchor.x + anchor.width + 56) / 10) * 10,
    y: Math.round(anchor.y / 10) * 10
  };
}

function createMissingBoxId(place, index) {
  const normalizedPlace = normalizePlaceCode(place).replace(/[^a-z0-9_-]/gi, "-") || `plats-${index + 1}`;

  return `kartgenerator-missing-${Date.now()}-${index}-${normalizedPlace}`;
}

function createDrawioCell(documentXml, row, index, x, y) {
  const cell = documentXml.createElement("mxCell");
  const geometry = documentXml.createElement("mxGeometry");
  const isNewPlacePlaceholder = row.isNewPlacePlaceholder === true;

  cell.setAttribute("id", createMissingBoxId(row.place, index));
  cell.setAttribute("value", row.place);
  cell.setAttribute("style", isNewPlacePlaceholder ? newPlaceBoxStyle : "rounded=0;whiteSpace=wrap;html=1;");
  cell.setAttribute("vertex", "1");
  cell.setAttribute("parent", "1");

  if (isNewPlacePlaceholder) {
    cell.setAttribute("data-kartgenerator-placeholder", "new-place");
  }

  geometry.setAttribute("x", String(x));
  geometry.setAttribute("y", String(y));
  geometry.setAttribute("width", "120");
  geometry.setAttribute("height", "40");
  geometry.setAttribute("as", "geometry");

  cell.append(geometry);

  return cell;
}

function createDrawioXmlWithMissingBoxes(xml, rows) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    throw new Error("Kunde inte tolka kartfilen.");
  }

  const root = documentXml.querySelector("mxGraphModel > root");

  if (!root) {
    throw new Error("Kunde inte hitta kartans innehåll.");
  }

  const startPosition = getNewBoxStartPosition(documentXml);

  rows.forEach((row, index) => {
    root.append(createDrawioCell(documentXml, row, index, startPosition.x, startPosition.y + index * 56));
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function addPlaceBoxToDrawio() {
  if (!state.sourceDrawioXml) {
    return;
  }

  try {
    updateSourceDrawioXml(createDrawioXmlWithMissingBoxes(state.sourceDrawioXml, [{
      place: newPlacePlaceholder,
      isNewPlacePlaceholder: true
    }]));
    setManualDrawioMode(true);

    if (state.currentDrawioMode === "generated" && state.generatedDrawioXml) {
      loadDrawioViewer(state.generatedDrawioXml, { keepZoom: true });
    } else {
      setCurrentDrawioMode("clean");
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }

    updateDrawioButtons();
  } catch (error) {
    drawioElements.panelTitle.textContent = "Kunde inte lägga till plats.";
  }
}

function addMissingBoxesToDrawio() {
  const rows = getSortedMissingPeopleRows();

  if (!state.sourceDrawioXml || rows.length === 0) {
    return;
  }

  try {
    updateSourceDrawioXml(createDrawioXmlWithMissingBoxes(state.sourceDrawioXml, rows));
    setManualDrawioMode(true);
    setCurrentDrawioMode(state.generatedDrawioXml ? "generated" : "clean");

    if (state.currentDrawioMode === "generated") {
      loadDrawioViewer(state.generatedDrawioXml, { keepZoom: true });
    } else {
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }

    updateDrawioButtons();
  } catch (error) {
    missingPeopleElements.meta.textContent = "Kunde inte lägga till platser i kartan.";
  }
}

function createGeneratedDrawioXml(xml, rows) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    throw new Error("Kunde inte tolka kartfilen.");
  }

  const rowsByPlace = new Map();

  rows.forEach((row) => {
    const place = String(row[state.parsedOmradePlatsColumnIndex] || "").trim();
    const normalizedPlace = normalizePlaceCode(place);

    if (normalizedPlace) {
      rowsByPlace.set(normalizedPlace, row);
    }
  });

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const label = drawioLabelToText(cell.getAttribute("value"));

    if (!isPlaceBoxLabel(label)) {
      return;
    }

    const row = rowsByPlace.get(normalizePlaceCode(label));

    cell.setAttribute("data-place-code", label);

    if (row) {
      const generatedLabel = isEmptyExcelPlaceRow(row) ? "" : makeDrawioLabel(row);
      cell.setAttribute("value", generatedLabel || `${label}<br>Ledig plats`);
    } else if (label) {
      cell.setAttribute("value", `${label}<br>Ledig plats`);
      markCellAsMissingExcelPlace(cell);
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function getCleanDrawioXmlForDisplay() {
  const highlightedMissingPlacesXml = createDrawioXmlWithHighlightedPlaces(
    state.sourceDrawioXml,
    new Set(state.emptyPlaceRows.map((row) => row.normalizedPlace))
  );

  return createDrawioXmlWithHighlightedDuplicatePlaces(
    highlightedMissingPlacesXml,
    new Set(state.duplicateMapPlaceRows.map((row) => row.normalizedPlace))
  );
}

function updateGeneratedDiagram() {
  if (!state.sourceDrawioXml) {
    clearGeneratedDrawioXml();
    updateDrawioButtons();
    return;
  }

  if (state.parsedOmradePlatsColumnIndex === null || !state.selectedColumnIndexes.includes(state.parsedOmradePlatsColumnIndex)) {
    const { wasShowingGenerated } = clearGeneratedDrawioXml();

    if (wasShowingGenerated) {
      if (state.shouldReloadDrawioViewer) {
        loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
      }
    }
    updateDrawioButtons();
    return;
  }

  const visibleRows = getRowsForGeneratedDiagram();

  if (visibleRows.length === 0) {
    const { wasShowingGenerated } = clearGeneratedDrawioXml();

    if (wasShowingGenerated) {
      if (state.shouldReloadDrawioViewer) {
        loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
      }
    }
    updateDrawioButtons();
    return;
  }

  try {
    const generatedXml = createGeneratedDrawioXml(state.sourceDrawioXml, visibleRows);
    const { hadGeneratedDrawioXml } = setGeneratedDrawioXml(generatedXml);

    if (!hadGeneratedDrawioXml && !state.hasManualDrawioMode) {
      setCurrentDrawioMode("generated");
    }

    if (state.shouldReloadDrawioViewer && state.currentDrawioMode === "generated") {
      loadDrawioViewer(state.generatedDrawioXml, { keepZoom: true });
    }
  } catch (error) {
    clearGeneratedDrawioXml();
  }

  updateDrawioButtons();
}

function readDrawioFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", (event) => {
    const xml = String(event.target.result || "").trim();

    if (!xml) {
      setDrawioUploadMessage("Den här kartfilen är tom.");
      drawioElements.uploadZone.classList.add("has-error");
      resetDrawioState();
      drawioElements.viewer.hidden = true;
      drawioElements.uploadZone.hidden = false;
      updateDrawioButtons();
      updateMissingPeopleList();
      updateEmptyPlacesList();
      updateDuplicateMapPlacesList();
      updateGeneratedDiagram();
      return;
    }

    setSourceDrawioXml(createCleanDrawioXml(xml));
    setCurrentDrawioMode("clean");
    setManualDrawioMode(true);
    updateDuplicateMapPlacesList();
    loadDrawioViewer(getCleanDrawioXmlForDisplay());
    if (state.excelColumns.length > 0 && state.rawExcelRows.length > 0) {
      reparseRows(true);
    } else {
      updateMissingPeopleList();
      updateEmptyPlacesList();
      updateGeneratedDiagram();
    }
  });

  reader.addEventListener("error", () => {
    setDrawioUploadMessage("Kunde inte läsa kartfilen.");
    drawioElements.uploadZone.classList.add("has-error");
    resetDrawioState();
    updateDrawioButtons();
    updateMissingPeopleList();
    updateEmptyPlacesList();
    updateDuplicateMapPlacesList();
    updateGeneratedDiagram();
  });

  reader.readAsText(file);
}

excelElements.upload.addEventListener("change", () => {
  const [file] = excelElements.upload.files;

  if (file) {
    showFile(file);
  }
});

drawioElements.upload.addEventListener("change", () => {
  const [file] = drawioElements.upload.files;

  if (file) {
    showDrawioFile(file);
  }
});

showLastUpdatedDate();
window.kartgeneratorReady = true;

parseElements.sourceInputs.forEach((input) => {
  input.addEventListener("change", () => preserveWindowScroll(() => reparseRows(false)));
});

parseElements.showPlaceNumberInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
parseElements.showColumnNamesInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
parseElements.showEmptyExcelPlacesInput.addEventListener("change", () => preserveWindowScroll(() => updateSelectedTable({ updateGeneratedDiagram: false })));
helpElements.buttons.forEach((button) => {
  button.addEventListener("click", showHelpDialog);
});
excelExampleElements.button.addEventListener("click", () => toggleExampleMenu(excelExampleElements.options, excelExampleElements.button));
drawioExampleElements.button.addEventListener("click", () => toggleExampleMenu(drawioExampleElements.options, drawioExampleElements.button));
excelExampleElements.downloadButton.addEventListener("click", () => downloadExampleAsset(excelExample));
drawioExampleElements.downloadButton.addEventListener("click", () => downloadExampleAsset(drawioExample));
excelExampleElements.loadButton.addEventListener("click", loadExcelExample);
drawioExampleElements.loadButton.addEventListener("click", loadDrawioExample);
drawioControlElements.showCleanButton.addEventListener("click", showCleanMap);
drawioControlElements.showGeneratedButton.addEventListener("click", showGeneratedMap);
drawioControlElements.fullscreenButton.addEventListener("click", toggleMapFullscreen);
drawioControlElements.addPlaceButton.addEventListener("click", addPlaceBoxToDrawio);
drawioControlElements.downloadMenuButton.addEventListener("click", toggleDownloadMenu);
drawioControlElements.downloadCleanDrawioButton.addEventListener("click", () => runDownloadAction(downloadCleanDiagram));
drawioControlElements.downloadCleanPngButton.addEventListener("click", () => runDownloadAction(downloadCleanPng));
drawioControlElements.downloadGeneratedDrawioButton.addEventListener("click", () => runDownloadAction(downloadGeneratedDiagram));
drawioControlElements.downloadGeneratedPngButton.addEventListener("click", () => runDownloadAction(downloadGeneratedPng));
missingPeopleElements.addButton.addEventListener("click", addMissingBoxesToDrawio);
missingPeopleElements.downloadButton.addEventListener("click", downloadMissingPeopleExcel);
excelElements.clearButton.addEventListener("click", clearExcelFile);
drawioElements.clearButton.addEventListener("click", clearDrawioFile);
document.addEventListener("fullscreenchange", handleFullscreenChange);
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

["dragenter", "dragover"].forEach((eventName) => {
  excelElements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    excelElements.uploadZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  excelElements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    excelElements.uploadZone.classList.remove("is-dragging");
  });
});

excelElements.uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (file) {
    showFile(file);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  drawioElements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    drawioElements.uploadZone.classList.add("is-dragging-drawio");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  drawioElements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    drawioElements.uploadZone.classList.remove("is-dragging-drawio");
  });
});

drawioElements.uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (file) {
    showDrawioFile(file);
  }
});

window.addEventListener("message", (event) => {
  handleDrawioMessage(event, {
    frame: drawioElements.frame,
    pendingXml: state.pendingDrawioXml,
    onConfigure: (origin) => postDrawioMessage(drawioElements.frame, {
      action: "configure",
      config: drawioEditorConfig
    }, origin),
    onInit: (xml) => loadDrawioViewer(xml),
    onSave: (xml) => updateSourceDrawioXml(xml),
    onExport: (dataUrl) => {
      downloadPngWithWhiteBackground(dataUrl, state.pendingPngFileName || "karta.png");
      state.pendingPngFileName = "";
    }
  });
});
