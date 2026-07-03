import { parseOmradePlatsValue, isPlaceBoxLabel, normalizePlaceCode, normalizeColumnName, drawioLabelToText } from "./kartgenerator-utils.js";
import { getMapPlaceLabels, getMapPlaces } from "./drawio.js"

const uploadZone = document.querySelector("#upload-zone");
const excelUpload = document.querySelector("#excel-upload");
const fileStatus = document.querySelector("#file-status");
const excelPanelTitle = document.querySelector("#excel-panel-title");
const clearExcelButton = document.querySelector("#clear-excel");
const excelExampleMenu = document.querySelector("#excel-example-menu");
const excelExampleButton = document.querySelector("#excel-example-button");
const excelExampleOptions = document.querySelector("#excel-example-options");
const downloadExampleExcelButton = document.querySelector("#download-example-excel");
const loadExampleExcelButton = document.querySelector("#load-example-excel");
const drawioUploadZone = document.querySelector("#drawio-upload-zone");
const drawioUpload = document.querySelector("#drawio-upload");
const drawioPanelTitle = document.querySelector("#drawio-panel-title");
const clearDrawioButton = document.querySelector("#clear-drawio");
const drawioExampleMenu = document.querySelector("#drawio-example-menu");
const drawioExampleButton = document.querySelector("#drawio-example-button");
const drawioExampleOptions = document.querySelector("#drawio-example-options");
const downloadExampleDrawioButton = document.querySelector("#download-example-drawio");
const loadExampleDrawioButton = document.querySelector("#load-example-drawio");
const mapWorkspace = document.querySelector(".workspace");
const drawioViewer = document.querySelector("#drawio-viewer");
const drawioFrame = document.querySelector("#drawio-frame");
const drawioActions = document.querySelector(".drawio-actions");
const addPlaceBoxButton = document.querySelector("#add-place-box");
const showCleanMapButton = document.querySelector("#show-clean-map");
const showGeneratedMapButton = document.querySelector("#show-generated-map");
const fullscreenMapButton = document.querySelector("#fullscreen-map");
const generatedOptions = document.querySelector("#generated-options");
const downloadMenu = document.querySelector("#download-menu");
const downloadMenuButton = document.querySelector("#download-menu-button");
const downloadOptions = document.querySelector("#download-options");
const downloadCleanDrawioButton = document.querySelector("#download-clean-drawio");
const downloadCleanPngButton = document.querySelector("#download-clean-png");
const downloadGeneratedDrawioButton = document.querySelector("#download-generated-drawio");
const downloadGeneratedPngButton = document.querySelector("#download-generated-png");
const missingPanel = document.querySelector("#missing-panel");
const missingMeta = document.querySelector("#missing-meta");
const missingWrap = document.querySelector("#missing-wrap");
const missingTable = document.querySelector("#missing-table");
const addMissingBoxesButton = document.querySelector("#add-missing-boxes");
const downloadMissingButton = document.querySelector("#download-missing");
const lastUpdated = document.querySelector("#last-updated");
const lastUpdatedDate = document.querySelector("#last-updated-date");
const helpButtons = document.querySelectorAll("[data-help-target]");
const columnsMeta = document.querySelector("#columns-meta");
const columnsPanel = document.querySelector("#columns-panel");
const columnsList = document.querySelector("#columns-list");
const selectedColumnsStatus = document.querySelector("#selected-columns");
const parseControls = document.querySelector("#parse-controls");
const parseSourceInputs = document.querySelectorAll("input[name='omrade-plats-source']");
const showPlaceNumberInput = document.querySelector("#show-place-number");
const showColumnNamesInput = document.querySelector("#show-column-names");
const showEmptyExcelPlacesInput = document.querySelector("#show-empty-excel-places");
const tableMeta = document.querySelector("#table-meta");
const duplicatePlaceWarning = document.querySelector("#duplicate-place-warning");
const tablePanel = document.querySelector("#table-panel");
const tableTitle = document.querySelector("#table-title");
const tableWrap = document.querySelector("#table-wrap");
const selectedTable = document.querySelector("#selected-table");
const emptyPlacesPanel = document.querySelector("#empty-places-panel");
const emptyPlacesMeta = document.querySelector("#empty-places-meta");
const emptyPlacesWrap = document.querySelector("#empty-places-wrap");
const emptyPlacesTable = document.querySelector("#empty-places-table");
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
let selectedColumnIndexes = [];
let excelColumns = [];
let excelRows = [];
let rawExcelRows = [];
let parsedOmradePlatsColumnIndex = null;
let sourceDrawioXml = "";
let sourceDrawioFileName = "";
let pendingDrawioXml = "";
let generatedDrawioXml = "";
let currentDrawioMode = "clean";
let hasManualDrawioMode = false;
let shouldReloadDrawioViewer = true;
let wasMapFullscreen = false;
let pendingPngFileName = "";
let missingPeopleRows = [];
let emptyPlaceRows = [];
let selectedTableSortColumnIndex = null;
let selectedTableSortDirection = "asc";
let missingSortColumn = "place";
let missingSortDirection = "asc";
let emptyPlacesSortColumn = "place";
let emptyPlacesSortDirection = "asc";
let scrollRestoreToken = 0;

function preserveWindowScroll(callback) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const token = ++scrollRestoreToken;
  const restoreScroll = () => {
    if (token === scrollRestoreToken) {
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
  scrollRestoreToken += 1;
}

function showLastUpdatedDate() {
  const modifiedDate = new Date(document.lastModified);

  if (Number.isNaN(modifiedDate.getTime())) {
    return;
  }

  lastUpdatedDate.dateTime = modifiedDate.toISOString().slice(0, 10);
  lastUpdatedDate.textContent = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(modifiedDate);
  lastUpdated.hidden = false;
}

function showHelpDialog(event) {
  const dialog = document.querySelector(`#${event.currentTarget.dataset.helpTarget}`);

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
  columnsMeta.textContent = message;
  columnsPanel.hidden = true;
  tablePanel.hidden = true;
  tableTitle.textContent = "Vald data";
  duplicatePlaceWarning.hidden = true;
  columnsList.replaceChildren();
  selectedColumnIndexes = [];
  excelColumns = [];
  excelRows = [];
  rawExcelRows = [];
  missingPeopleRows = [];
  emptyPlaceRows = [];
  selectedTableSortColumnIndex = null;
  selectedTableSortDirection = "asc";
  emptyPlacesSortColumn = "place";
  emptyPlacesSortDirection = "asc";
  parsedOmradePlatsColumnIndex = null;
  parseControls.classList.remove("is-visible");
  selectedColumnsStatus.textContent = "";
  renderSelectedTable();
  updateGeneratedDiagram();
  updateMissingPeopleList();
  updateEmptyPlacesList();
}

function updateSelectedColumnsStatus() {
  const visibleColumnNames = selectedColumnIndexes
    .map((columnIndex) => excelColumns[columnIndex])
    .filter((column) => column && !isRequiredColumn(column))
    .map((column) => column.name);

  if (visibleColumnNames.length === 0) {
    selectedColumnsStatus.textContent = "";
    return;
  }

  selectedColumnsStatus.textContent = `${visibleColumnNames.length} valda: ${visibleColumnNames.join(", ")}`;
}

function isRequiredColumn(column) {
  return normalizeColumnName(column.name) === "omrade/plats";
}

function getColumnDisplayName(column) {
  return isRequiredColumn(column) ? "Plats" : column.name;
}

function getSelectedParseSource() {
  const selectedInput = [...parseSourceInputs].find((input) => input.checked);
  return selectedInput ? selectedInput.value : "varvsomrade";
}

function setSelectedParseSource(source) {
  parseSourceInputs.forEach((input) => {
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
  const mapPlaces = getMapPlaceLabels(sourceDrawioXml);
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
  if (!sourceDrawioXml || omradePlatsColumnIndex === null) {
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

  if (sourceDrawioXml) {
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
    parsedOmradePlatsColumnIndex = null;
    return rows;
  }

  parsedOmradePlatsColumnIndex = omradePlatsColumn.index;

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
  if (excelColumns.length === 0 || rawExcelRows.length === 0) {
    return;
  }

  excelRows = parseRows(excelColumns, rawExcelRows, shouldDetectParseSource);
  renderSelectedTable();
}

function updateParseControlsVisibility() {
  const availableSources = parsedOmradePlatsColumnIndex !== null
    && selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)
    && rawExcelRows.length > 0
    ? getAvailableParseSources(rawExcelRows, parsedOmradePlatsColumnIndex)
    : [];
  const shouldShow = availableSources.length > 1;

  parseSourceInputs.forEach((input) => {
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

  parseControls.classList.toggle("is-visible", shouldShow);
}

function getVisibleRows() {
  return selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)
    ? excelRows.filter((row) => {
      const value = row[parsedOmradePlatsColumnIndex];
      const hasPlace = value !== null && value !== undefined && String(value).trim() !== "";

      return hasPlace && (showEmptyExcelPlacesInput.checked || !isEmptyExcelPlaceRow(row));
    })
    : excelRows;
}

function getRowsForGeneratedDiagram() {
  return selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)
    ? excelRows.filter((row) => {
      const value = row[parsedOmradePlatsColumnIndex];
      const hasPlace = value !== null && value !== undefined && String(value).trim() !== "";

      return hasPlace;
    })
    : excelRows;
}

function isEmptyExcelPlaceRow(row) {
  if (parsedOmradePlatsColumnIndex === null) {
    return false;
  }

  const place = row[parsedOmradePlatsColumnIndex];
  const hasPlace = place !== null && place !== undefined && String(place).trim() !== "";
  const firstNameColumnIndex = getColumnIndexByName("fornamn");
  const lastNameColumnIndex = getColumnIndexByName("efternamn");
  const firstName = firstNameColumnIndex >= 0 ? row[firstNameColumnIndex] : "";
  const lastName = lastNameColumnIndex >= 0 ? row[lastNameColumnIndex] : "";
  const hasFirstName = firstName !== null && firstName !== undefined && String(firstName).trim() !== "";
  const hasLastName = lastName !== null && lastName !== undefined && String(lastName).trim() !== "";

  return hasPlace && (!hasFirstName || !hasLastName);
}

function getSortedSelectedRows(rows) {
  if (selectedTableSortColumnIndex === null || !selectedColumnIndexes.includes(selectedTableSortColumnIndex)) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[selectedTableSortColumnIndex] === null || left[selectedTableSortColumnIndex] === undefined
      ? ""
      : String(left[selectedTableSortColumnIndex]);
    const rightValue = right[selectedTableSortColumnIndex] === null || right[selectedTableSortColumnIndex] === undefined
      ? ""
      : String(right[selectedTableSortColumnIndex]);
    const result = leftValue.localeCompare(rightValue, "sv", { numeric: true, sensitivity: "base" });

    return selectedTableSortDirection === "asc" ? result : -result;
  });
}

function sortSelectedTable(columnIndex) {
  preserveWindowScroll(() => {
    if (selectedTableSortColumnIndex === columnIndex) {
      selectedTableSortDirection = selectedTableSortDirection === "asc" ? "desc" : "asc";
    } else {
      selectedTableSortColumnIndex = columnIndex;
      selectedTableSortDirection = "asc";
    }

    renderSelectedTable();
  });
}

function getDuplicatePlaceInfo(rows) {
  if (parsedOmradePlatsColumnIndex === null) {
    return { duplicatePlaces: [], duplicatePlaceCodes: new Set() };
  }

  const placeCounts = new Map();
  const placeLabels = new Map();

  rows.forEach((row) => {
    const place = String(row[parsedOmradePlatsColumnIndex] || "").trim();
    const normalizedPlace = normalizePlaceCode(place);

    if (!normalizedPlace) {
      return;
    }

    placeCounts.set(normalizedPlace, (placeCounts.get(normalizedPlace) || 0) + 1);

    if (!placeLabels.has(normalizedPlace)) {
      placeLabels.set(normalizedPlace, place);
    }
  });

  const duplicatePlaceCodes = new Set(
    [...placeCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([place]) => place)
  );
  const duplicatePlaces = [...duplicatePlaceCodes]
    .map((place) => placeLabels.get(place) || place)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "sv", { numeric: true, sensitivity: "base" }));

  return { duplicatePlaces, duplicatePlaceCodes };
}

function hasDuplicatePlace(row, duplicatePlaceCodes) {
  if (parsedOmradePlatsColumnIndex === null || duplicatePlaceCodes.size === 0) {
    return false;
  }

  return duplicatePlaceCodes.has(normalizePlaceCode(row[parsedOmradePlatsColumnIndex]));
}

function updateDuplicatePlaceWarning(duplicatePlaces) {
  duplicatePlaceWarning.hidden = duplicatePlaces.length === 0;

  if (duplicatePlaces.length === 0) {
    duplicatePlaceWarning.textContent = "";
    return;
  }

  duplicatePlaceWarning.textContent = `Varning: flera medlemmar har samma plats: ${duplicatePlaces.join(", ")}.`;
}

function renderSelectedTable(options = {}) {
  const shouldUpdateGeneratedDiagram = options.updateGeneratedDiagram !== false;

  selectedTable.replaceChildren();
  updateParseControlsVisibility();

  if (selectedTableSortColumnIndex !== null && !selectedColumnIndexes.includes(selectedTableSortColumnIndex)) {
    selectedTableSortColumnIndex = null;
    selectedTableSortDirection = "asc";
  }

  if (selectedColumnIndexes.length === 0) {
    tableTitle.textContent = "Vald data";
    tableMeta.textContent = "Välj kolumner för att skapa en tabell.";
    duplicatePlaceWarning.hidden = true;
    tableWrap.hidden = true;
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
    tableTitle.textContent = "Vald data";
    tableMeta.textContent = "Inga datarader hittades under rubrikraden.";
    duplicatePlaceWarning.hidden = true;
    tableWrap.hidden = true;
    updateEmptyPlacesList();
    if (shouldUpdateGeneratedDiagram) {
      updateGeneratedDiagram();
    }
    return;
  }

  const sortedRows = getSortedSelectedRows(visibleRows);
  const { duplicatePlaces, duplicatePlaceCodes } = getDuplicatePlaceInfo(visibleRows);
  updateDuplicatePlaceWarning(duplicatePlaces);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  if (parsedOmradePlatsColumnIndex !== null) {
    const headerCell = document.createElement("th");
    headerCell.textContent = "Område/Plats";
    headerRow.append(headerCell);
  }

  selectedColumnIndexes.forEach((columnIndex) => {
    const headerCell = document.createElement("th");
    const button = document.createElement("button");
    const directionMarker = selectedTableSortColumnIndex === columnIndex
      ? ` ${selectedTableSortDirection === "asc" ? "↑" : "↓"}`
      : "";

    button.className = "sort-button";
    button.type = "button";
    button.textContent = `${getColumnDisplayName(excelColumns[columnIndex])}${directionMarker}`;
    button.addEventListener("click", () => sortSelectedTable(columnIndex));
    headerCell.append(button);
    headerRow.append(headerCell);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  const bodyFragment = document.createDocumentFragment();

  sortedRows.forEach((row) => {
    const tableRow = document.createElement("tr");

    if (hasDuplicatePlace(row, duplicatePlaceCodes)) {
      tableRow.classList.add("has-duplicate-place");
    }

    if (parsedOmradePlatsColumnIndex !== null) {
      const cell = document.createElement("td");
      const value = row.rawOmradePlats;
      cell.textContent = value === null || value === undefined ? "" : String(value);
      tableRow.append(cell);
    }

    selectedColumnIndexes.forEach((columnIndex) => {
      const cell = document.createElement("td");
      const value = row[columnIndex];
      cell.textContent = value === null || value === undefined ? "" : String(value);
      tableRow.append(cell);
    });

    bodyFragment.append(tableRow);
  });

  tbody.append(bodyFragment);
  selectedTable.append(thead, tbody);
  tableTitle.textContent = `Vald data (${visibleRows.length} ${visibleRows.length === 1 ? "rad" : "rader"})`;
  tableMeta.textContent = "";
  tableWrap.hidden = false;
  if (shouldUpdateGeneratedDiagram) {
    updateGeneratedDiagram();
  }
}

function renderColumns(columns, sheetName) {
  columnsList.replaceChildren();
  excelColumns = columns;
  selectedColumnIndexes = ["omrade/plats", "fornamn", "efternamn"]
    .map((columnName) => columns.find((column) => normalizeColumnName(column.name) === columnName))
    .filter(Boolean)
    .map((column) => column.index);

  if (columns.length === 0) {
    columnsMeta.textContent = `Inga kolumner hittades i "${sheetName}".`;
    updateSelectedColumnsStatus();
    renderSelectedTable();
    return;
  }

  const requiredColumnCount = columns.filter(isRequiredColumn).length;
  const visibleColumnCount = columns.length - requiredColumnCount;

  columnsMeta.textContent = `${visibleColumnCount} ${visibleColumnCount === 1 ? "kolumn hittades" : "kolumner hittades"} i "${sheetName}". Samt matchningskolumn område/plats. Välj vilken data som ska in i kartan.`;

  columns.forEach((columnName) => {
    if (isRequiredColumn(columnName)) {
      return;
    }

    const item = document.createElement("li");
    const button = document.createElement("button");
    const columnIndex = columnName.index;

    button.className = "column-button";
    button.type = "button";
    button.textContent = columnName.name;

    if (selectedColumnIndexes.includes(columnIndex)) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", () => {
      preserveWindowScroll(() => {
        const isSelected = button.classList.toggle("is-selected");

        button.setAttribute("aria-pressed", String(isSelected));

        if (isSelected) {
          selectedColumnIndexes.push(columnIndex);
        } else {
          selectedColumnIndexes = selectedColumnIndexes.filter((selectedColumnIndex) => selectedColumnIndex !== columnIndex);
        }

        updateSelectedColumnsStatus();
        renderSelectedTable();
      });
    });

    item.append(button);
    columnsList.append(item);
  });

  updateSelectedColumnsStatus();
  renderSelectedTable();
}

function readColumns(file) {
  if (!window.XLSX) {
    fileStatus.textContent = "Excel-läsaren kunde inte laddas. Kontrollera internetanslutningen och uppdatera sidan.";
    fileStatus.classList.add("has-error");
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

      rawExcelRows = rows.slice(headerRowIndex + 1);
      excelRows = parseRows(columns, rawExcelRows);
      renderColumns(columns, firstSheetName);
    } catch (error) {
      fileStatus.textContent = "Kunde inte läsa Excel-filen.";
      fileStatus.classList.add("has-error");
      clearColumns("Försök med en annan .xls- eller .xlsx-fil.");
    }
  });

  reader.readAsArrayBuffer(file);
}

function showFile(file) {
  const fileName = file.name.toLowerCase();
  const isExcelFile = excelTypes.some((extension) => fileName.endsWith(extension));

  uploadZone.classList.remove("has-file");
  fileStatus.classList.remove("has-file", "has-error");

  if (!isExcelFile) {
    fileStatus.textContent = "Välj en Excel-fil som slutar med .xls eller .xlsx.";
    fileStatus.classList.add("has-error");
    excelPanelTitle.textContent = "Excel-data";
    excelUpload.value = "";
    uploadZone.hidden = false;
    clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
    return;
  }

  fileStatus.textContent = "";
  fileStatus.classList.add("has-file");
  excelPanelTitle.textContent = file.name;
  clearExcelButton.hidden = false;
  excelExampleMenu.hidden = true;
  uploadZone.classList.add("has-file");
  uploadZone.hidden = true;
  clearColumns("Läser kolumner...");
  columnsPanel.hidden = false;
  tablePanel.hidden = false;
  readColumns(file);
}

function setDrawioUploadMessage(title, help = "") {
  drawioUploadZone.replaceChildren();

  const titleElement = document.createElement("span");
  titleElement.className = "drawio-title";
  titleElement.textContent = title;
  drawioUploadZone.append(titleElement);

  if (help) {
    const helpElement = document.createElement("span");
    helpElement.className = "drawio-help";
    helpElement.textContent = help;
    drawioUploadZone.append(helpElement);
  }

  drawioUploadZone.append(drawioUpload);
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

  drawioUploadZone.classList.remove("has-error", "has-file");

  if (!isDrawioFile) {
    setDrawioUploadMessage("Välj en kartfil som slutar med .drawio eller .drawio.xml.");
    drawioUploadZone.classList.add("has-error");
    drawioPanelTitle.textContent = "Karta";
    drawioUpload.value = "";
    sourceDrawioXml = "";
    sourceDrawioFileName = "";
    generatedDrawioXml = "";
    currentDrawioMode = "clean";
    hasManualDrawioMode = false;
    drawioViewer.hidden = true;
    drawioUploadZone.hidden = false;
    updateDrawioButtons();
    updateMissingPeopleList();
    updateEmptyPlacesList();
    updateGeneratedDiagram();
    return;
  }

  drawioPanelTitle.textContent = file.name;
  clearDrawioButton.hidden = false;
  drawioExampleMenu.hidden = true;
  sourceDrawioFileName = file.name;
  drawioUploadZone.replaceChildren();
  drawioUploadZone.classList.add("has-file");
  drawioUploadZone.append(drawioUpload);
  drawioUploadZone.hidden = true;
  readDrawioFile(file);
}

function clearExcelFile() {
  excelUpload.value = "";
  excelPanelTitle.textContent = "Excel-data från BAS-rapport";
  clearExcelButton.hidden = true;
  excelExampleMenu.hidden = false;
  uploadZone.hidden = false;
  uploadZone.classList.remove("has-file");
  fileStatus.textContent = "";
  fileStatus.classList.remove("has-file", "has-error");
  clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
}

function clearDrawioFile() {
  drawioUpload.value = "";
  drawioPanelTitle.textContent = "Karta";
  clearDrawioButton.hidden = true;
  drawioExampleMenu.hidden = false;
  drawioUploadZone.hidden = false;
  drawioUploadZone.classList.remove("has-file", "has-error");
  resetDrawioUploadMessage();
  drawioViewer.hidden = true;
  sourceDrawioXml = "";
  sourceDrawioFileName = "";
  pendingDrawioXml = "";
  generatedDrawioXml = "";
  currentDrawioMode = "clean";
  hasManualDrawioMode = false;
  updateDrawioButtons();
  updateMissingPeopleList();
  updateEmptyPlacesList();
  updateGeneratedDiagram();
}

function loadDrawioXml(frame, xml, options = {}) {
  const action = options.keepZoom ? "merge" : "load";

  frame.contentWindow.postMessage(JSON.stringify({
    action,
    xml,
    autosave: options.autosave ? 1 : 0,
    modified: 0
  }), "*");
}

function loadDrawioXmlWhenVisible(frame, xml, attemptsLeft = 12, options = {}) {
  const hasSize = frame.offsetWidth > 0 && frame.offsetHeight > 0;

  if (!hasSize && attemptsLeft > 0) {
    requestAnimationFrame(() => loadDrawioXmlWhenVisible(frame, xml, attemptsLeft - 1, options));
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadDrawioXml(frame, xml, options);
    });
  });
}

function loadDrawioViewer(xml, options = {}) {
  pendingDrawioXml = xml;
  drawioViewer.hidden = false;
  loadDrawioXmlWhenVisible(drawioFrame, xml, 12, { autosave: true, keepZoom: options.keepZoom });
}

function showCleanMap() {
  if (!sourceDrawioXml) {
    return;
  }

  hasManualDrawioMode = true;
  currentDrawioMode = "clean";
  loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
  updateDrawioButtons();
}

function showGeneratedMap() {
  if (!generatedDrawioXml) {
    return;
  }

  hasManualDrawioMode = true;
  currentDrawioMode = "generated";
  loadDrawioViewer(generatedDrawioXml, { keepZoom: true });
  updateDrawioButtons();
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement === mapWorkspace;

  fullscreenMapButton.textContent = isFullscreen ? "Avsluta helskärm" : "Helskärm";
  fullscreenMapButton.setAttribute("aria-pressed", String(isFullscreen));
}

function getCurrentDrawioXml() {
  return currentDrawioMode === "generated" && generatedDrawioXml ? generatedDrawioXml : getCleanDrawioXmlForDisplay();
}

function refitMapAfterFullscreenExit() {
  const xml = getCurrentDrawioXml();

  if (!xml || document.fullscreenElement === mapWorkspace) {
    return;
  }

  loadDrawioViewer(xml);
}

function handleFullscreenChange() {
  const isMapFullscreen = document.fullscreenElement === mapWorkspace;

  updateFullscreenButton();

  if (wasMapFullscreen && !isMapFullscreen) {
    requestAnimationFrame(() => {
      requestAnimationFrame(refitMapAfterFullscreenExit);
    });
  }

  wasMapFullscreen = isMapFullscreen;
}

async function toggleMapFullscreen() {
  if (!sourceDrawioXml || !document.fullscreenEnabled) {
    return;
  }

  try {
    if (document.fullscreenElement === mapWorkspace) {
      await document.exitFullscreen();
    } else {
      await mapWorkspace.requestFullscreen();
    }
  } finally {
    updateFullscreenButton();
  }
}

function updateDrawioButtons() {
  const hasSource = Boolean(sourceDrawioXml);
  const hasGenerated = Boolean(generatedDrawioXml);

  drawioActions.hidden = !hasSource;
  downloadMenu.hidden = !hasSource;
  addPlaceBoxButton.disabled = !hasSource;
  showCleanMapButton.disabled = !hasSource || currentDrawioMode === "clean";
  showGeneratedMapButton.disabled = !hasGenerated || currentDrawioMode === "generated";
  generatedOptions.hidden = currentDrawioMode !== "generated" || !hasGenerated;
  downloadMenuButton.disabled = !hasSource;
  downloadCleanDrawioButton.disabled = !hasSource;
  downloadCleanPngButton.disabled = !hasSource;
  downloadGeneratedDrawioButton.disabled = !hasGenerated;
  downloadGeneratedPngButton.disabled = !hasGenerated;
  fullscreenMapButton.disabled = !hasSource || !document.fullscreenEnabled;
  showCleanMapButton.setAttribute("aria-pressed", String(currentDrawioMode === "clean"));
  showGeneratedMapButton.setAttribute("aria-pressed", String(currentDrawioMode === "generated"));
  updateFullscreenButton();

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
  downloadDrawioXml(createCleanDrawioXml(sourceDrawioXml), getCleanDrawioFileName());
}

function downloadGeneratedDiagram() {
  downloadDrawioXml(generatedDrawioXml, getGeneratedDrawioFileName());
}

function downloadCleanPng() {
  downloadDrawioPng(createCleanDrawioXml(sourceDrawioXml), getCleanPngFileName());
}

function downloadGeneratedPng() {
  downloadDrawioPng(generatedDrawioXml, getGeneratedPngFileName());
}

function toggleDownloadMenu() {
  const isOpening = downloadOptions.hidden;

  closeExampleMenus();
  downloadOptions.hidden = !isOpening;
  downloadMenuButton.setAttribute("aria-expanded", String(isOpening));
}

function closeDownloadMenu() {
  downloadOptions.hidden = true;
  downloadMenuButton.setAttribute("aria-expanded", "false");
}

function toggleExampleMenu(options, button) {
  const isOpening = options.hidden;

  closeDownloadMenu();
  closeExampleMenus();
  options.hidden = !isOpening;
  button.setAttribute("aria-expanded", String(isOpening));
}

function closeExampleMenus() {
  excelExampleOptions.hidden = true;
  drawioExampleOptions.hidden = true;
  excelExampleButton.setAttribute("aria-expanded", "false");
  drawioExampleButton.setAttribute("aria-expanded", "false");
}

function runDownloadAction(action) {
  action();
  closeDownloadMenu();
}

function downloadDrawioPng(xml, fileName) {
  if (!xml) {
    return;
  }

  pendingPngFileName = fileName;
  drawioFrame.contentWindow.postMessage(JSON.stringify({
    action: "export",
    format: "png",
    xml,
    scale: 1,
    border: 8,
    bg: "#ffffff",
    background: "#ffffff"
  }), "*");
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
  const fileName = sourceDrawioFileName || fallbackName;
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
  const fileName = sourceDrawioFileName || fallbackName;
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
  const fornamnColumnIndex = excelColumns.findIndex((column) => normalizeColumnName(column.name) === "fornamn");
  const efternamnColumnIndex = excelColumns.findIndex((column) => normalizeColumnName(column.name) === "efternamn");
  const shouldCombineName = selectedColumnIndexes.includes(fornamnColumnIndex)
    && selectedColumnIndexes.includes(efternamnColumnIndex);
  const lines = [];

  selectedColumnIndexes.forEach((columnIndex) => {
    const value = row[columnIndex];

    if (value === null || value === undefined || String(value).trim() === "") {
      return;
    }

    if (columnIndex === parsedOmradePlatsColumnIndex) {
      if (showPlaceNumberInput.checked) {
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

      lines.push(showColumnNamesInput.checked ? `Namn: ${fullName}` : fullName);
      return;
    }

    if (shouldCombineName && columnIndex === efternamnColumnIndex) {
      return;
    }

    lines.push(showColumnNamesInput.checked
      ? `${excelColumns[columnIndex].name}: ${String(value).trim()}`
      : String(value).trim());
  });

  return lines.join("<br>");
}


function getColumnIndexByName(columnName) {
  const normalizedName = normalizeColumnName(columnName);
  return excelColumns.findIndex((column) => normalizeColumnName(column.name) === normalizedName);
}

function renderMissingPeopleTable(rows) {
  missingTable.replaceChildren();

  if (rows.length === 0) {
    missingMeta.textContent = "Alla rader med förnamn, efternamn och plats finns i kartan.";
    missingPanel.hidden = true;
    missingWrap.hidden = true;
    addMissingBoxesButton.hidden = true;
    downloadMissingButton.disabled = true;
    return;
  }

  missingPanel.hidden = false;
  addMissingBoxesButton.hidden = false;
  addMissingBoxesButton.textContent = `Lägg till ${rows.length} saknade platser i kartan`;
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  [
    ["place", "Plats"],
    ["firstName", "Fornamn"],
    ["lastName", "Efternamn"]
  ].forEach(([columnKey, header]) => {
    const headerCell = document.createElement("th");
    const button = document.createElement("button");
    const directionMarker = missingSortColumn === columnKey
      ? ` ${missingSortDirection === "asc" ? "↑" : "↓"}`
      : "";

    button.className = "sort-button";
    button.type = "button";
    button.textContent = `${header}${directionMarker}`;
    button.addEventListener("click", () => sortMissingPeople(columnKey));
    headerCell.append(button);
    headerRow.append(headerCell);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    [row.place, row.firstName, row.lastName].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    });

    fragment.append(tableRow);
  });

  tbody.append(fragment);
  missingTable.append(thead, tbody);
  missingMeta.textContent = `${rows.length} person${rows.length === 1 ? "" : "er"} finns i BAS men saknas i kartan.`;
  missingWrap.hidden = false;
  downloadMissingButton.disabled = false;
}

function getSortedMissingPeopleRows() {
  return [...missingPeopleRows].sort((left, right) => {
    const leftValue = String(left[missingSortColumn] || "").localeCompare(
      String(right[missingSortColumn] || ""),
      "sv",
      { numeric: true, sensitivity: "base" }
    );

    return missingSortDirection === "asc" ? leftValue : -leftValue;
  });
}

function sortMissingPeople(columnKey) {
  if (missingSortColumn === columnKey) {
    missingSortDirection = missingSortDirection === "asc" ? "desc" : "asc";
  } else {
    missingSortColumn = columnKey;
    missingSortDirection = "asc";
  }

  renderMissingPeopleTable(getSortedMissingPeopleRows());
}

function renderEmptyPlacesTable(rows) {
  emptyPlacesTable.replaceChildren();

  if (!sourceDrawioXml || parsedOmradePlatsColumnIndex === null || excelRows.length === 0) {
    emptyPlacesPanel.hidden = true;
    emptyPlacesWrap.hidden = true;
    emptyPlacesMeta.textContent = "Ladda upp Excel och karta för att se platser som saknas i Excel.";
    return;
  }

  emptyPlacesPanel.hidden = false;

  if (rows.length === 0) {
    emptyPlacesMeta.textContent = "Alla platser i kartan finns i Excel.";
    emptyPlacesWrap.hidden = true;
    return;
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headerCell = document.createElement("th");
  const button = document.createElement("button");
  const directionMarker = emptyPlacesSortColumn === "place"
    ? ` ${emptyPlacesSortDirection === "asc" ? "↑" : "↓"}`
    : "";

  button.className = "sort-button";
  button.type = "button";
  button.textContent = `Plats${directionMarker}`;
  button.addEventListener("click", () => sortEmptyPlaces("place"));
  headerCell.append(button);
  headerRow.append(headerCell);
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const cell = document.createElement("td");

    cell.textContent = row.place;
    tableRow.append(cell);
    fragment.append(tableRow);
  });

  tbody.append(fragment);
  emptyPlacesTable.append(thead, tbody);
  emptyPlacesMeta.textContent = `${rows.length} plats${rows.length === 1 ? "" : "er"} finns i kartan men saknas i Excel. Dessa platser markeras med gult i kartan.`;
  emptyPlacesWrap.hidden = false;
}

function getSortedEmptyPlaceRows() {
  return [...emptyPlaceRows].sort((left, right) => {
    const result = String(left[emptyPlacesSortColumn] || "").localeCompare(
      String(right[emptyPlacesSortColumn] || ""),
      "sv",
      { numeric: true, sensitivity: "base" }
    );

    return emptyPlacesSortDirection === "asc" ? result : -result;
  });
}

function sortEmptyPlaces(columnKey) {
  preserveWindowScroll(() => {
    if (emptyPlacesSortColumn === columnKey) {
      emptyPlacesSortDirection = emptyPlacesSortDirection === "asc" ? "desc" : "asc";
    } else {
      emptyPlacesSortColumn = columnKey;
      emptyPlacesSortDirection = "asc";
    }

    renderEmptyPlacesTable(getSortedEmptyPlaceRows());
  });
}

function updateEmptyPlacesList() {
  if (!sourceDrawioXml || parsedOmradePlatsColumnIndex === null || excelRows.length === 0) {
    emptyPlaceRows = [];
    renderEmptyPlacesTable([]);
    if (currentDrawioMode === "clean" && shouldReloadDrawioViewer && sourceDrawioXml) {
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }
    return;
  }

  const occupiedPlaces = new Set(
    excelRows
      .map((row) => normalizePlaceCode(row[parsedOmradePlatsColumnIndex]))
      .filter(Boolean)
  );

  emptyPlaceRows = getMapPlaces(sourceDrawioXml)
    .filter((place) => !occupiedPlaces.has(place.normalizedPlace));

  renderEmptyPlacesTable(getSortedEmptyPlaceRows());

  if (currentDrawioMode === "clean" && shouldReloadDrawioViewer) {
    loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
  }
}

function updateMissingPeopleList() {
  const firstNameColumnIndex = getColumnIndexByName("fornamn");
  const lastNameColumnIndex = getColumnIndexByName("efternamn");

  if (!sourceDrawioXml || parsedOmradePlatsColumnIndex === null || firstNameColumnIndex < 0 || lastNameColumnIndex < 0 || excelRows.length === 0) {
    missingPanel.hidden = true;
    missingPeopleRows = [];
    addMissingBoxesButton.hidden = true;
    downloadMissingButton.disabled = true;
    return;
  }

  const mapPlaces = getMapPlaceLabels(sourceDrawioXml);
  const missingRows = excelRows
    .map((row) => ({
      place: String(row[parsedOmradePlatsColumnIndex] || "").trim(),
      firstName: String(row[firstNameColumnIndex] || "").trim(),
      lastName: String(row[lastNameColumnIndex] || "").trim()
    }))
    .filter((row) => row.place && row.firstName && row.lastName && !mapPlaces.has(normalizePlaceCode(row.place)));

  missingPanel.hidden = false;
  missingPeopleRows = missingRows;
  renderMissingPeopleTable(getSortedMissingPeopleRows());
}

function updateSourceDrawioXml(xml) {
  const updatedXml = createCleanDrawioXml(String(xml || "").trim()).trim();

  if (!updatedXml || updatedXml === sourceDrawioXml) {
    return;
  }

  const shouldRefreshGeneratedView = currentDrawioMode === "generated";

  sourceDrawioXml = updatedXml;
  pendingDrawioXml = updatedXml;

  preserveWindowScroll(() => {
    shouldReloadDrawioViewer = shouldRefreshGeneratedView;

    try {
      if (excelColumns.length > 0 && rawExcelRows.length > 0) {
        reparseRows(true);
      } else {
        updateMissingPeopleList();
        updateEmptyPlacesList();
        updateGeneratedDiagram();
      }
    } finally {
      shouldReloadDrawioViewer = true;
    }
  });
}

function downloadMissingPeopleExcel() {
  if (!window.XLSX || missingPeopleRows.length === 0) {
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

  cell.setAttribute("id", createMissingBoxId(row.place, index));
  cell.setAttribute("value", row.place);
  cell.setAttribute("style", "rounded=0;whiteSpace=wrap;html=1;");
  cell.setAttribute("vertex", "1");
  cell.setAttribute("parent", "1");

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

function getNextMapPlaceNumber(xml) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return 1;
  }

  const placeNumbers = [...documentXml.querySelectorAll("mxCell[vertex='1']")]
    .map((cell) => drawioLabelToText(cell.getAttribute("value")))
    .filter(isPlaceBoxLabel)
    .map((label) => Number.parseInt(label, 10))
    .filter(Number.isFinite);

  return placeNumbers.length > 0 ? Math.max(...placeNumbers) + 1 : 1;
}

function addPlaceBoxToDrawio() {
  if (!sourceDrawioXml) {
    return;
  }

  const place = String(getNextMapPlaceNumber(sourceDrawioXml));

  try {
    updateSourceDrawioXml(createDrawioXmlWithMissingBoxes(sourceDrawioXml, [{ place }]));
    hasManualDrawioMode = true;

    if (currentDrawioMode === "generated" && generatedDrawioXml) {
      loadDrawioViewer(generatedDrawioXml, { keepZoom: true });
    } else {
      currentDrawioMode = "clean";
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }

    updateDrawioButtons();
  } catch (error) {
    drawioPanelTitle.textContent = "Kunde inte lägga till plats.";
  }
}

function addMissingBoxesToDrawio() {
  const rows = getSortedMissingPeopleRows();

  if (!sourceDrawioXml || rows.length === 0) {
    return;
  }

  try {
    updateSourceDrawioXml(createDrawioXmlWithMissingBoxes(sourceDrawioXml, rows));
    hasManualDrawioMode = true;
    currentDrawioMode = generatedDrawioXml ? "generated" : "clean";

    if (currentDrawioMode === "generated") {
      loadDrawioViewer(generatedDrawioXml, { keepZoom: true });
    } else {
      loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
    }

    updateDrawioButtons();
  } catch (error) {
    missingMeta.textContent = "Kunde inte lägga till platser i kartan.";
  }
}

function getPlaceCodeFromCellLabel(label) {
  const text = drawioLabelToText(label);
  const [firstLine] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return firstLine && isPlaceBoxLabel(firstLine) ? firstLine : "";
}

function createCleanDrawioXml(xml) {
  if (!xml) {
    return "";
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const placeCode = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");
    const shouldRemoveMissingExcelHighlight = Boolean(placeCode) && hasMissingExcelHighlight(cell);

    if (cell.getAttribute("data-kartgenerator-highlight") === "missing-excel" || shouldRemoveMissingExcelHighlight) {
      removeMissingExcelHighlight(cell);
    }

    if (placeCode) {
      cell.setAttribute("value", placeCode);
      cell.removeAttribute("data-place-code");
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function createGeneratedDrawioXml(xml, rows) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    throw new Error("Kunde inte tolka kartfilen.");
  }

  const rowsByPlace = new Map();

  rows.forEach((row) => {
    const place = String(row[parsedOmradePlatsColumnIndex] || "").trim();
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
      cell.setAttribute("value", generatedLabel || `${label}<br>Tom plats`);
    } else if (label) {
      cell.setAttribute("value", `${label}<br>Tom plats`);
      markCellAsMissingExcelPlace(cell);
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function createDrawioXmlWithHighlightedPlaces(xml, places) {
  if (!xml || places.size === 0) {
    return xml;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const label = drawioLabelToText(cell.getAttribute("value"));

    if (places.has(normalizePlaceCode(label))) {
      markCellAsMissingExcelPlace(cell, { temporary: true });
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function getCleanDrawioXmlForDisplay() {
  return createDrawioXmlWithHighlightedPlaces(
    sourceDrawioXml,
    new Set(emptyPlaceRows.map((row) => row.normalizedPlace))
  );
}

function setCellStyleWithoutMissingExcelHighlight(cell) {
  const style = cell.getAttribute("style") || "";
  return style
    .split(";")
    .filter((part) => part && !part.startsWith("fillColor=") && !part.startsWith("strokeColor="));
}

function hasMissingExcelHighlight(cell) {
  const style = cell.getAttribute("style") || "";
  return /(?:^|;)fillColor=#fff2cc(?:;|$)/i.test(style) && /(?:^|;)strokeColor=#d6b656(?:;|$)/i.test(style);
}

function removeMissingExcelHighlight(cell) {
  const originalStyle = cell.getAttribute("data-kartgenerator-original-style");

  cell.removeAttribute("data-kartgenerator-highlight");
  cell.removeAttribute("data-kartgenerator-original-style");

  if (originalStyle !== null) {
    cell.setAttribute("style", originalStyle);
    return;
  }

  cell.setAttribute("style", `${setCellStyleWithoutMissingExcelHighlight(cell).join(";")};`);
}

function markCellAsMissingExcelPlace(cell, options = {}) {
  const styleParts = setCellStyleWithoutMissingExcelHighlight(cell);

  styleParts.push("fillColor=#fff2cc", "strokeColor=#d6b656");

  if (options.temporary) {
    cell.setAttribute("data-kartgenerator-highlight", "missing-excel");
    cell.setAttribute("data-kartgenerator-original-style", cell.getAttribute("style") || "");
  }

  cell.setAttribute("style", `${styleParts.join(";")};`);
}

function updateGeneratedDiagram() {
  if (!sourceDrawioXml) {
    generatedDrawioXml = "";
    currentDrawioMode = "clean";
    updateDrawioButtons();
    return;
  }

  if (parsedOmradePlatsColumnIndex === null || !selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)) {
    generatedDrawioXml = "";
    if (currentDrawioMode === "generated") {
      currentDrawioMode = "clean";
      if (shouldReloadDrawioViewer) {
        loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
      }
    }
    updateDrawioButtons();
    return;
  }

  const visibleRows = getRowsForGeneratedDiagram();

  if (visibleRows.length === 0) {
    generatedDrawioXml = "";
    if (currentDrawioMode === "generated") {
      currentDrawioMode = "clean";
      if (shouldReloadDrawioViewer) {
        loadDrawioViewer(getCleanDrawioXmlForDisplay(), { keepZoom: true });
      }
    }
    updateDrawioButtons();
    return;
  }

  try {
    const hadGeneratedDrawioXml = Boolean(generatedDrawioXml);

    generatedDrawioXml = createGeneratedDrawioXml(sourceDrawioXml, visibleRows);

    if (!hadGeneratedDrawioXml && !hasManualDrawioMode) {
      currentDrawioMode = "generated";
    }

    if (shouldReloadDrawioViewer && currentDrawioMode === "generated") {
      loadDrawioViewer(generatedDrawioXml, { keepZoom: true });
    }
  } catch (error) {
    generatedDrawioXml = "";
  }

  updateDrawioButtons();
}

function readDrawioFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", (event) => {
    const xml = String(event.target.result || "").trim();

    if (!xml) {
      setDrawioUploadMessage("Den här kartfilen är tom.");
      drawioUploadZone.classList.add("has-error");
      sourceDrawioXml = "";
      sourceDrawioFileName = "";
      generatedDrawioXml = "";
      currentDrawioMode = "clean";
      hasManualDrawioMode = false;
      drawioViewer.hidden = true;
      drawioUploadZone.hidden = false;
      updateDrawioButtons();
      updateMissingPeopleList();
      updateEmptyPlacesList();
      updateGeneratedDiagram();
      return;
    }

    sourceDrawioXml = createCleanDrawioXml(xml);
    currentDrawioMode = "clean";
    hasManualDrawioMode = true;
    loadDrawioViewer(sourceDrawioXml);
    if (excelColumns.length > 0 && rawExcelRows.length > 0) {
      reparseRows(true);
    } else {
      updateMissingPeopleList();
      updateEmptyPlacesList();
      updateGeneratedDiagram();
    }
  });

  reader.addEventListener("error", () => {
    setDrawioUploadMessage("Kunde inte läsa kartfilen.");
    drawioUploadZone.classList.add("has-error");
    sourceDrawioXml = "";
    sourceDrawioFileName = "";
    generatedDrawioXml = "";
    currentDrawioMode = "clean";
    hasManualDrawioMode = false;
    updateDrawioButtons();
    updateMissingPeopleList();
    updateEmptyPlacesList();
    updateGeneratedDiagram();
  });

  reader.readAsText(file);
}

excelUpload.addEventListener("change", () => {
  const [file] = excelUpload.files;

  if (file) {
    showFile(file);
  }
});

drawioUpload.addEventListener("change", () => {
  const [file] = drawioUpload.files;

  if (file) {
    showDrawioFile(file);
  }
});

showLastUpdatedDate();

parseSourceInputs.forEach((input) => {
  input.addEventListener("change", () => preserveWindowScroll(() => reparseRows(false)));
});

showPlaceNumberInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
showColumnNamesInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
showEmptyExcelPlacesInput.addEventListener("change", () => preserveWindowScroll(() => renderSelectedTable({ updateGeneratedDiagram: false })));
helpButtons.forEach((button) => {
  button.addEventListener("click", showHelpDialog);
});
excelExampleButton.addEventListener("click", () => toggleExampleMenu(excelExampleOptions, excelExampleButton));
drawioExampleButton.addEventListener("click", () => toggleExampleMenu(drawioExampleOptions, drawioExampleButton));
downloadExampleExcelButton.addEventListener("click", () => downloadExampleAsset(excelExample));
downloadExampleDrawioButton.addEventListener("click", () => downloadExampleAsset(drawioExample));
loadExampleExcelButton.addEventListener("click", loadExcelExample);
loadExampleDrawioButton.addEventListener("click", loadDrawioExample);
showCleanMapButton.addEventListener("click", showCleanMap);
showGeneratedMapButton.addEventListener("click", showGeneratedMap);
fullscreenMapButton.addEventListener("click", toggleMapFullscreen);
addPlaceBoxButton.addEventListener("click", addPlaceBoxToDrawio);
downloadMenuButton.addEventListener("click", toggleDownloadMenu);
downloadCleanDrawioButton.addEventListener("click", () => runDownloadAction(downloadCleanDiagram));
downloadCleanPngButton.addEventListener("click", () => runDownloadAction(downloadCleanPng));
downloadGeneratedDrawioButton.addEventListener("click", () => runDownloadAction(downloadGeneratedDiagram));
downloadGeneratedPngButton.addEventListener("click", () => runDownloadAction(downloadGeneratedPng));
addMissingBoxesButton.addEventListener("click", addMissingBoxesToDrawio);
downloadMissingButton.addEventListener("click", downloadMissingPeopleExcel);
clearExcelButton.addEventListener("click", clearExcelFile);
clearDrawioButton.addEventListener("click", clearDrawioFile);
document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("click", (event) => {
  if (!downloadOptions.hidden && !event.target.closest("#download-menu")) {
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
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove("is-dragging");
  });
});

uploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (file) {
    showFile(file);
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  drawioUploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    drawioUploadZone.classList.add("is-dragging-drawio");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  drawioUploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    drawioUploadZone.classList.remove("is-dragging-drawio");
  });
});

drawioUploadZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;

  if (file) {
    showDrawioFile(file);
  }
});

window.addEventListener("message", (event) => {
  if (!String(event.origin).includes("diagrams.net")) {
    return;
  }

  let message;

  try {
    message = JSON.parse(event.data);
  } catch (error) {
    return;
  }

  if (message.event === "init" && event.source === drawioFrame.contentWindow && pendingDrawioXml) {
    loadDrawioViewer(pendingDrawioXml);
  }

  if (event.source === drawioFrame.contentWindow && typeof message.xml === "string" && ["autosave", "save"].includes(message.event)) {
    updateSourceDrawioXml(message.xml);
  }

  if (message.event === "export" && event.source === drawioFrame.contentWindow && typeof message.data === "string" && message.data.startsWith("data:image/png")) {
    downloadPngWithWhiteBackground(message.data, pendingPngFileName || "karta.png");
    pendingPngFileName = "";
  }
});
