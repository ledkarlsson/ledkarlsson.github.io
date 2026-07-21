import { parseOmradePlatsValue, normalizePlaceCode, normalizeColumnName } from "./kartgenerator-utils.js";
import { getMapPlaceLabels } from "./drawio.js"
import { exportDrawioPng } from "./drawio-embed.js"
import { createDrawioController } from "./drawio-controller.js"
import {
  getDuplicateMapPlaceRows,
  getDuplicatePlaceInfo,
  getEmptyMapPlaceRows,
  getMissingPeopleRows,
  hasDuplicatePlace,
  isEmptyExcelPlaceRow as isEmptyExcelPlaceRowByIndexes
} from "./diagnostics.js"
import { createCleanDrawioXml } from "./drawio-model.js"
import {
  resetDiagnosticsState,
  resetExcelState,
  resetSelectedTableSort,
  state
} from "./state.js"
import {
  renderColumnsList as showColumnsList,
  renderClearedExcelState as showClearedExcelState,
  renderClosedExampleMenus as showClosedExampleMenus,
  renderClearedExcelFile as showClearedExcelFile,
  renderDuplicateMapPlacesTable as showDuplicateMapPlacesTableView,
  renderDownloadMenu as showDownloadMenu,
  renderDragState as showDragState,
  renderExcelReadError as showExcelReadError,
  renderEmptyPlacesTable as showEmptyPlacesTableView,
  renderExampleMenu as showExampleMenu,
  renderLastUpdatedDate as showLastUpdatedDateView,
  renderMissingPeoplePanelVisible as showMissingPeoplePanelVisible,
  renderMissingPeopleTable as showMissingPeopleTableView,
  renderMissingPeopleUnavailable as showMissingPeopleUnavailable,
  renderParseControls as showParseControls,
  renderRejectedExcelFile as showRejectedExcelFile,
  renderSelectedColumnsStatus as showSelectedColumnsStatus,
  renderSelectedDataTable as showSelectedDataTable,
  renderSelectedExcelFile as showSelectedExcelFile
} from "./renderers.js"
import {
  clearedExcelElements,
  columnsElements,
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
  selectedTableElements
} from "./elements.js"

const excelTypes = [".xls", ".xlsx"];
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
  showFile(await getExampleFile(excelExample));
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

function clearColumns(message) {
  showClearedExcelState({ message, elements: clearedExcelElements });
  resetExcelState();
  resetDiagnosticsState();
  updateSelectedTable();
  drawioController.updateGeneratedDiagram();
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

  if (availableSources.length === 1) {
    setSelectedParseSource(availableSources[0]);
  } else if (availableSources.length > 1 && !availableSources.includes(getSelectedParseSource())) {
    setSelectedParseSource(availableSources[0]);
  }

  showParseControls({ availableSources, shouldShow, elements: parseElements });
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
      drawioController.updateGeneratedDiagram();
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
      drawioController.updateGeneratedDiagram();
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
    drawioController.updateGeneratedDiagram();
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
    showExcelReadError({
      message: "Excel-läsaren kunde inte laddas. Kontrollera internetanslutningen och uppdatera sidan.",
      elements: excelElements
    });
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
      showExcelReadError({
        message: "Kunde inte läsa Excel-filen.",
        elements: excelElements
      });
      clearColumns("Försök med en annan .xls- eller .xlsx-fil.");
    }
  });

  reader.readAsArrayBuffer(file);
}

function showFile(file) {
  const fileName = file.name.toLowerCase();
  const isExcelFile = excelTypes.some((extension) => fileName.endsWith(extension));

  if (!isExcelFile) {
    showRejectedExcelFile({
      message: "Välj en Excel-fil som slutar med .xls eller .xlsx.",
      elements: excelElements
    });
    clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
    return;
  }

  clearColumns("Läser kolumner...");
  showSelectedExcelFile({
    fileName: file.name,
    elements: excelElements,
    exampleElements: excelExampleElements,
    columnsPanel: columnsElements.panel,
    tablePanel: selectedTableElements.panel
  });
  readColumns(file);
}

function clearExcelFile() {
  showClearedExcelFile({
    elements: excelElements,
    exampleElements: excelExampleElements
  });
  clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
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
  const firstNameColumnIndex = getColumnIndexByName("fornamn");
  const lastNameColumnIndex = getColumnIndexByName("efternamn");

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

const drawioController = createDrawioController({
  closeDownloadMenu,
  downloadPngWithWhiteBackground,
  getEmptyPlaceKey,
  getRowsForGeneratedDiagram,
  getSortedMissingPeopleRows,
  isEmptyExcelPlaceRow,
  makeDrawioLabel,
  preserveWindowScroll,
  reparseRows,
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

excelElements.upload.addEventListener("change", () => {
  const [file] = excelElements.upload.files;

  if (file) {
    showFile(file);
  }
});

showLastUpdatedDate();
window.kartgeneratorReady = true;

parseElements.sourceInputs.forEach((input) => {
  input.addEventListener("change", () => preserveWindowScroll(() => reparseRows(false)));
});

parseElements.showPlaceNumberInput.addEventListener("change", () => preserveWindowScroll(drawioController.updateGeneratedDiagram));
parseElements.showColumnNamesInput.addEventListener("change", () => preserveWindowScroll(drawioController.updateGeneratedDiagram));
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
missingPeopleElements.downloadButton.addEventListener("click", downloadMissingPeopleExcel);
excelElements.clearButton.addEventListener("click", clearExcelFile);
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
    showDragState({
      element: excelElements.uploadZone,
      className: "is-dragging",
      isDragging: true
    });
  });
});

["dragleave", "drop"].forEach((eventName) => {
  excelElements.uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    showDragState({
      element: excelElements.uploadZone,
      className: "is-dragging",
      isDragging: false
    });
  });
});

excelElements.uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (file) {
    showFile(file);
  }
});
