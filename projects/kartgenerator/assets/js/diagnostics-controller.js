import {
  getDuplicateMapPlaceRows,
  getEmptyMapPlaceRows,
  getMissingPeopleRows
} from "./diagnostics.js";
import {
  duplicateMapPlacesElements,
  emptyPlacesElements,
  missingPeopleElements
} from "./elements.js";
import {
  renderDuplicateMapPlacesTable,
  renderEmptyPlacesTable,
  renderMissingPeoplePanelVisible,
  renderMissingPeopleTable,
  renderMissingPeopleUnavailable
} from "./renderers.js";
import { state } from "./state.js";

export function createDiagnosticsController(callbacks) {
  function getSortedMissingPeopleRows() {
    return [...state.missingPeopleRows].sort((left, right) => {
      const result = String(left[state.missingSortColumn] || "").localeCompare(
        String(right[state.missingSortColumn] || ""),
        "sv",
        { numeric: true, sensitivity: "base" }
      );

      return state.missingSortDirection === "asc" ? result : -result;
    });
  }

  function renderMissingPeople() {
    renderMissingPeopleTable({
      rows: getSortedMissingPeopleRows(),
      sortColumn: state.missingSortColumn,
      sortDirection: state.missingSortDirection,
      elements: missingPeopleElements,
      onSort: sortMissingPeople
    });
  }

  function sortMissingPeople(columnKey) {
    if (state.missingSortColumn === columnKey) {
      state.missingSortDirection = state.missingSortDirection === "asc" ? "desc" : "asc";
    } else {
      state.missingSortColumn = columnKey;
      state.missingSortDirection = "asc";
    }

    renderMissingPeople();
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

  function renderEmptyPlaces() {
    renderEmptyPlacesTable({
      rows: getSortedEmptyPlaceRows(),
      hasRequiredInput: Boolean(state.sourceDrawioXml)
        && state.parsedOmradePlatsColumnIndex !== null
        && state.excelRows.length > 0,
      sortColumn: state.emptyPlacesSortColumn,
      sortDirection: state.emptyPlacesSortDirection,
      elements: emptyPlacesElements,
      onSort: sortEmptyPlaces
    });
  }

  function sortEmptyPlaces(columnKey) {
    callbacks.preserveWindowScroll(() => {
      if (state.emptyPlacesSortColumn === columnKey) {
        state.emptyPlacesSortDirection = state.emptyPlacesSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.emptyPlacesSortColumn = columnKey;
        state.emptyPlacesSortDirection = "asc";
      }

      renderEmptyPlaces();
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

  function getEmptyPlaceKey(rows) {
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

  function updateEmptyPlacesList() {
    if (!state.sourceDrawioXml || state.parsedOmradePlatsColumnIndex === null || state.excelRows.length === 0) {
      state.emptyPlaceRows = [];
      renderEmptyPlaces();

      if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer && state.sourceDrawioXml) {
        callbacks.loadViewer(callbacks.getCleanXmlForDisplay(), { keepZoom: true });
      }
      return;
    }

    state.emptyPlaceRows = getEmptyMapPlaceRows(
      state.sourceDrawioXml,
      state.excelRows,
      state.parsedOmradePlatsColumnIndex
    );
    renderEmptyPlaces();

    if (state.currentDrawioMode === "clean" && state.shouldReloadDrawioViewer) {
      callbacks.loadViewer(callbacks.getCleanXmlForDisplay(), { keepZoom: true });
    }
  }

  function updateMissingPeopleList() {
    const firstNameColumnIndex = callbacks.getColumnIndexByName("fornamn");
    const lastNameColumnIndex = callbacks.getColumnIndexByName("efternamn");

    if (
      !state.sourceDrawioXml
      || state.parsedOmradePlatsColumnIndex === null
      || firstNameColumnIndex < 0
      || lastNameColumnIndex < 0
      || state.excelRows.length === 0
    ) {
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
    renderMissingPeople();
  }

  return {
    getEmptyPlaceKey,
    getSortedMissingPeopleRows,
    updateDuplicateMapPlacesList,
    updateEmptyPlacesList,
    updateMissingPeopleList
  };
}
