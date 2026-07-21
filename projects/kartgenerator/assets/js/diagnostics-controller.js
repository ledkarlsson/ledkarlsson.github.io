import {
  getDuplicateMapPlaceRows,
  getMapPlacesMissingInExcelRows,
  getPeopleMissingFromMapRows
} from "./diagnostics.js";
import {
  duplicateMapPlacesElements,
  mapPlacesMissingInExcelElements,
  peopleMissingFromMapElements
} from "./elements.js";
import {
  renderDuplicateMapPlacesTable,
  renderMapPlacesMissingInExcelTable,
  renderPeopleMissingFromMapPanelVisible,
  renderPeopleMissingFromMapTable,
  renderPeopleMissingFromMapUnavailable
} from "./renderers.js";
import { state } from "./state.js";

export function createDiagnosticsController(callbacks) {
  function getSortedPeopleMissingFromMapRows() {
    return [...state.peopleMissingFromMapRows].sort((left, right) => {
      const result = String(left[state.peopleMissingFromMapSortColumn] || "").localeCompare(
        String(right[state.peopleMissingFromMapSortColumn] || ""),
        "sv",
        { numeric: true, sensitivity: "base" }
      );

      return state.peopleMissingFromMapSortDirection === "asc" ? result : -result;
    });
  }

  function renderPeopleMissingFromMap() {
    renderPeopleMissingFromMapTable({
      rows: getSortedPeopleMissingFromMapRows(),
      sortColumn: state.peopleMissingFromMapSortColumn,
      sortDirection: state.peopleMissingFromMapSortDirection,
      elements: peopleMissingFromMapElements,
      onSort: sortPeopleMissingFromMap
    });
  }

  function sortPeopleMissingFromMap(columnKey) {
    if (state.peopleMissingFromMapSortColumn === columnKey) {
      state.peopleMissingFromMapSortDirection = state.peopleMissingFromMapSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.peopleMissingFromMapSortColumn = columnKey;
      state.peopleMissingFromMapSortDirection = "asc";
    }

    renderPeopleMissingFromMap();
  }

  function getSortedMapPlacesMissingInExcelRows() {
    return [...state.mapPlacesMissingInExcelRows].sort((left, right) => {
      const result = String(left[state.mapPlacesMissingInExcelSortColumn] || "").localeCompare(
        String(right[state.mapPlacesMissingInExcelSortColumn] || ""),
        "sv",
        { numeric: true, sensitivity: "base" }
      );

      return state.mapPlacesMissingInExcelSortDirection === "asc" ? result : -result;
    });
  }

  function renderMapPlacesMissingInExcel() {
    renderMapPlacesMissingInExcelTable({
      rows: getSortedMapPlacesMissingInExcelRows(),
      hasRequiredInput: Boolean(state.sourceDrawioXml)
        && state.parsedOmradePlatsColumnIndex !== null
        && state.excelRows.length > 0,
      sortColumn: state.mapPlacesMissingInExcelSortColumn,
      sortDirection: state.mapPlacesMissingInExcelSortDirection,
      elements: mapPlacesMissingInExcelElements,
      onSort: sortMapPlacesMissingInExcel
    });
  }

  function sortMapPlacesMissingInExcel(columnKey) {
    callbacks.preserveWindowScroll(() => {
      if (state.mapPlacesMissingInExcelSortColumn === columnKey) {
        state.mapPlacesMissingInExcelSortDirection = state.mapPlacesMissingInExcelSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.mapPlacesMissingInExcelSortColumn = columnKey;
        state.mapPlacesMissingInExcelSortDirection = "asc";
      }

      renderMapPlacesMissingInExcel();
    });
  }

  function renderDuplicateMapPlaces() {
    renderDuplicateMapPlacesTable({
      rows: state.duplicateMapPlaceRows,
      hasSource: Boolean(state.sourceDrawioXml),
      elements: duplicateMapPlacesElements
    });
  }

  function getDuplicateMapPlaceKey(rows) {
    return rows.map((row) => `${row.normalizedPlace}:${row.count}`).join("|");
  }

  function getMapPlacesMissingInExcelKey(rows) {
    return rows.map((row) => row.normalizedPlace).join("|");
  }

  function updateDuplicateMapPlacesList(options = {}) {
    const previousKey = getDuplicateMapPlaceKey(state.duplicateMapPlaceRows);

    state.duplicateMapPlaceRows = getDuplicateMapPlaceRows(state.sourceDrawioXml);
    renderDuplicateMapPlaces();

    const hasChanged = getDuplicateMapPlaceKey(state.duplicateMapPlaceRows) !== previousKey;

    if (options.reloadCleanMap && hasChanged && state.currentDrawioMode === "clean") {
      callbacks.scheduleCleanMapRefresh();
    }

    return hasChanged;
  }

  function updateMapPlacesMissingInExcelList() {
    if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || state.excelRows.length === 0) {
      state.mapPlacesMissingInExcelRows = [];
      renderMapPlacesMissingInExcel();

      if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer && state.sourceDrawioXml) {
        callbacks.loadViewer(callbacks.getCleanXmlForDisplay(), { keepZoom: true });
      }
      return;
    }

    state.mapPlacesMissingInExcelRows = getMapPlacesMissingInExcelRows(
      state.sourceDrawioXml,
      state.excelRows,
      state.parsedOmradePlatsColumnIndex
    );
    renderMapPlacesMissingInExcel();

    if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer) {
      callbacks.loadViewer(callbacks.getCleanXmlForDisplay(), { keepZoom: true });
    }
  }

  function updatePeopleMissingFromMapList() {
    const firstNameColumnIndex = callbacks.getColumnIndexByName("fornamn");
    const lastNameColumnIndex = callbacks.getColumnIndexByName("efternamn");

    if (
      !state.sourceDrawioXml
      || state.parsedOmradePlatsColumnIndex === null
      || firstNameColumnIndex < 0
      || lastNameColumnIndex < 0
      || state.excelRows.length === 0
    ) {
      state.peopleMissingFromMapRows = [];
      renderPeopleMissingFromMapUnavailable({ elements: peopleMissingFromMapElements });
      return;
    }

    renderPeopleMissingFromMapPanelVisible({ elements: peopleMissingFromMapElements });
    state.peopleMissingFromMapRows = getPeopleMissingFromMapRows(state.sourceDrawioXml, state.excelRows, {
      placeColumnIndex: state.parsedOmradePlatsColumnIndex,
      firstNameColumnIndex,
      lastNameColumnIndex
    });
    renderPeopleMissingFromMap();
  }

  return {
    getMapPlacesMissingInExcelKey,
    getSortedPeopleMissingFromMapRows,
    updateDuplicateMapPlacesList,
    updateMapPlacesMissingInExcelList,
    updatePeopleMissingFromMapList
  };
}
