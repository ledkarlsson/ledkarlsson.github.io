import { getMapPlaceLabels } from "./drawio.js";
import {
  getDuplicatePlaceInfo,
  hasDuplicatePlace,
  isEmptyExcelPlaceRow as isEmptyExcelPlaceRowByIndexes
} from "./diagnostics.js";
import { ExcelReadError, readExcelFile } from "./excel-reader.js";
import { normalizeColumnName, normalizePlaceCode, parseOmradePlatsValue } from "./kartgenerator-utils.js";
import {
  resetDiagnosticsState,
  resetExcelState,
  resetSelectedTableSort,
  state
} from "./state.js";
import {
  renderClearedExcelFile,
  renderClearedExcelState,
  renderColumnsList,
  renderDragState,
  renderExcelReadError,
  renderParseControls,
  renderRejectedExcelFile,
  renderSelectedColumnsStatus,
  renderSelectedDataTable,
  renderSelectedExcelFile
} from "./renderers.js";
import {
  clearedExcelElements,
  columnsElements,
  excelElements,
  excelExampleElements,
  parseElements,
  selectedTableElements
} from "./elements.js";

const excelTypes = [".xls", ".xlsx"];
const parseSourceValues = ["varvsomrade", "brygga", "vinterplats"];

export function createExcelController(callbacks) {
  function clearColumns(message) {
    renderClearedExcelState({ message, elements: clearedExcelElements });
    resetExcelState();
    resetDiagnosticsState();
    updateSelectedTable();
    callbacks.updateGeneratedDiagram();
    callbacks.updatePeopleMissingFromMapList();
    callbacks.updateMapPlacesMissingInExcelList();
    callbacks.updateDuplicateMapPlacesList();
  }

  function isRequiredColumn(column) {
    return normalizeColumnName(column.name) === "omrade/plats";
  }

  function getColumnDisplayName(column) {
    return isRequiredColumn(column) ? "Plats" : column.name;
  }

  function updateSelectedColumnsStatus() {
    const visibleColumnNames = state.selectedColumnIndexes
      .map((columnIndex) => state.excelColumns[columnIndex])
      .filter((column) => column && !isRequiredColumn(column))
      .map((column) => column.name);

    renderSelectedColumnsStatus({
      columnNames: visibleColumnNames,
      element: columnsElements.selectedStatus
    });
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
      parsedRow[omradePlatsColumn.index] = parseOmradePlatsValue(
        row[omradePlatsColumn.index],
        getSelectedParseSource()
      );
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

    renderParseControls({ availableSources, shouldShow, elements: parseElements });
  }

  function getColumnIndexByName(columnName) {
    const normalizedName = normalizeColumnName(columnName);
    return state.excelColumns.findIndex((column) => normalizeColumnName(column.name) === normalizedName);
  }

  function isEmptyExcelPlaceRow(row) {
    return isEmptyExcelPlaceRowByIndexes(row, {
      placeColumnIndex: state.parsedOmradePlatsColumnIndex,
      firstNameColumnIndex: getColumnIndexByName("fornamn"),
      lastNameColumnIndex: getColumnIndexByName("efternamn")
    });
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
        return value !== null && value !== undefined && String(value).trim() !== "";
      })
      : state.excelRows;
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
    callbacks.preserveWindowScroll(() => {
      if (state.selectedTableSortColumnIndex === columnIndex) {
        state.selectedTableSortDirection = state.selectedTableSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.selectedTableSortColumnIndex = columnIndex;
        state.selectedTableSortDirection = "asc";
      }

      updateSelectedTable();
    });
  }

  function renderSelectedTable(rows, visibleRowCount, duplicatePlaces = [], duplicatePlaceCodes = new Set()) {
    renderSelectedDataTable({
      rows,
      visibleRowCount,
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
  }

  function updateSelectedTable(options = {}) {
    const shouldUpdateGeneratedDiagram = options.updateGeneratedDiagram !== false;

    updateParseControlsVisibility();

    if (state.selectedTableSortColumnIndex !== null && !state.selectedColumnIndexes.includes(state.selectedTableSortColumnIndex)) {
      resetSelectedTableSort();
    }

    if (state.selectedColumnIndexes.length === 0) {
      renderSelectedTable([], 0);
      callbacks.updatePeopleMissingFromMapList();
      callbacks.updateMapPlacesMissingInExcelList();
      if (shouldUpdateGeneratedDiagram) {
        callbacks.updateGeneratedDiagram();
      }
      return;
    }

    const visibleRows = getVisibleRows();
    callbacks.updatePeopleMissingFromMapList();
    callbacks.updateMapPlacesMissingInExcelList();

    if (visibleRows.length === 0) {
      renderSelectedTable([], 0);
      callbacks.updateMapPlacesMissingInExcelList();
      if (shouldUpdateGeneratedDiagram) {
        callbacks.updateGeneratedDiagram();
      }
      return;
    }

    const sortedRows = getSortedSelectedRows(visibleRows);
    const { duplicatePlaces, duplicatePlaceCodes } = getDuplicatePlaceInfo(
      visibleRows,
      state.parsedOmradePlatsColumnIndex
    );
    renderSelectedTable(sortedRows, visibleRows.length, duplicatePlaces, duplicatePlaceCodes);

    if (shouldUpdateGeneratedDiagram) {
      callbacks.updateGeneratedDiagram();
    }
  }

  function updateColumns(columns, sheetName) {
    state.excelColumns = columns;
    state.selectedColumnIndexes = ["omrade/plats", "fornamn", "efternamn"]
      .map((columnName) => columns.find((column) => normalizeColumnName(column.name) === columnName))
      .filter(Boolean)
      .map((column) => column.index);

    renderColumnsList({
      columns,
      sheetName,
      selectedColumnIndexes: state.selectedColumnIndexes,
      elements: columnsElements,
      isRequiredColumn,
      onToggleColumn: (columnIndex, isSelected) => {
        callbacks.preserveWindowScroll(() => {
          if (isSelected) {
            state.selectedColumnIndexes.push(columnIndex);
          } else {
            state.selectedColumnIndexes = state.selectedColumnIndexes.filter(
              (selectedColumnIndex) => selectedColumnIndex !== columnIndex
            );
          }

          updateSelectedColumnsStatus();
          updateSelectedTable();
        });
      }
    });

    updateSelectedColumnsStatus();
    updateSelectedTable();
  }

  async function loadFile(file) {
    try {
      const { columns, rows, sheetName } = await readExcelFile(file);

      state.rawExcelRows = rows;
      state.excelRows = parseRows(columns, rows);
      updateColumns(columns, sheetName);
    } catch (error) {
      if (error instanceof ExcelReadError && error.code === "unavailable") {
        renderExcelReadError({
          message: "Excel-läsaren kunde inte laddas. Kontrollera internetanslutningen och uppdatera sidan.",
          elements: excelElements
        });
        clearColumns("Excel-läsaren är inte tillgänglig.");
        return;
      }

      if (error instanceof ExcelReadError && error.code === "no-sheets") {
        clearColumns("Inga blad hittades i arbetsboken.");
        return;
      }

      renderExcelReadError({ message: "Kunde inte läsa Excel-filen.", elements: excelElements });
      clearColumns("Försök med en annan .xls- eller .xlsx-fil.");
    }
  }

  function showFile(file) {
    const fileName = file.name.toLowerCase();
    const isExcelFile = excelTypes.some((extension) => fileName.endsWith(extension));

    if (!isExcelFile) {
      renderRejectedExcelFile({
        message: "Välj en Excel-fil som slutar med .xls eller .xlsx.",
        elements: excelElements
      });
      clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
      return;
    }

    clearColumns("Läser kolumner...");
    renderSelectedExcelFile({
      fileName: file.name,
      elements: excelElements,
      exampleElements: excelExampleElements,
      columnsPanel: columnsElements.panel,
      tablePanel: selectedTableElements.panel
    });
    loadFile(file);
  }

  function clearFile() {
    renderClearedExcelFile({ elements: excelElements, exampleElements: excelExampleElements });
    clearColumns("Ladda upp en Excel-fil för att visa kolumnerna.");
  }

  function getDrawioLabelOptions() {
    return {
      columns: state.excelColumns,
      selectedColumnIndexes: state.selectedColumnIndexes,
      placeColumnIndex: state.parsedOmradePlatsColumnIndex,
      firstNameColumnIndex: getColumnIndexByName("fornamn"),
      lastNameColumnIndex: getColumnIndexByName("efternamn"),
      showPlaceNumber: parseElements.showPlaceNumberInput.checked,
      showColumnNames: parseElements.showColumnNamesInput.checked
    };
  }

  function bindEvents() {
    excelElements.upload.addEventListener("change", () => {
      const [file] = excelElements.upload.files;

      if (file) {
        showFile(file);
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      excelElements.uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        renderDragState({
          element: excelElements.uploadZone,
          className: "is-dragging",
          isDragging: true
        });
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      excelElements.uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        renderDragState({
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

    parseElements.sourceInputs.forEach((input) => {
      input.addEventListener("change", () => callbacks.preserveWindowScroll(() => reparseRows(false)));
    });
    parseElements.showPlaceNumberInput.addEventListener("change", () =>
      callbacks.preserveWindowScroll(callbacks.updateGeneratedDiagram)
    );
    parseElements.showColumnNamesInput.addEventListener("change", () =>
      callbacks.preserveWindowScroll(callbacks.updateGeneratedDiagram)
    );
    parseElements.showEmptyExcelPlacesInput.addEventListener("change", () =>
      callbacks.preserveWindowScroll(() => updateSelectedTable({ updateGeneratedDiagram: false }))
    );
    excelElements.clearButton.addEventListener("click", clearFile);
  }

  return {
    bindEvents,
    clearFile,
    getColumnIndexByName,
    getDrawioLabelOptions,
    getRowsForGeneratedDiagram,
    isEmptyExcelPlaceRow,
    reparseRows,
    showFile,
    updateSelectedTable
  };
}
