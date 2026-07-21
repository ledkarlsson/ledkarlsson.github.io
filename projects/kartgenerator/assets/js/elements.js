// @ts-check

export const excelElements = {
  uploadZone: document.querySelector("#upload-zone"),
  upload: document.querySelector("#excel-upload"),
  fileStatus: document.querySelector("#file-status"),
  panelTitle: document.querySelector("#excel-panel-title"),
  clearButton: document.querySelector("#clear-excel")
};

const excelExampleButton = document.querySelector("#excel-example-button");
const excelExampleOptions = document.querySelector("#excel-example-options");
const drawioExampleButton = document.querySelector("#drawio-example-button");
const drawioExampleOptions = document.querySelector("#drawio-example-options");

export const excelExampleElements = {
  menu: document.querySelector("#excel-example-menu"),
  button: excelExampleButton,
  options: excelExampleOptions,
  downloadButton: document.querySelector("#download-example-excel"),
  loadButton: document.querySelector("#load-example-excel"),
  menuElements: {
    button: excelExampleButton,
    options: excelExampleOptions
  }
};

export const drawioElements = {
  uploadZone: document.querySelector("#drawio-upload-zone"),
  upload: document.querySelector("#drawio-upload"),
  panelTitle: document.querySelector("#drawio-panel-title"),
  clearButton: document.querySelector("#clear-drawio"),
  viewer: document.querySelector("#drawio-viewer"),
  frame: document.querySelector("#drawio-frame")
};

export const drawioExampleElements = {
  menu: document.querySelector("#drawio-example-menu"),
  button: drawioExampleButton,
  options: drawioExampleOptions,
  downloadButton: document.querySelector("#download-example-drawio"),
  loadButton: document.querySelector("#load-example-drawio"),
  menuElements: {
    button: drawioExampleButton,
    options: drawioExampleOptions
  }
};

export const workspaceElements = {
  mapWorkspace: document.querySelector(".workspace")
};

export const drawioControlElements = {
  actions: document.querySelector(".drawio-actions"),
  downloadMenu: document.querySelector("#download-menu"),
  addPlaceButton: document.querySelector("#add-place-box"),
  showCleanButton: document.querySelector("#show-clean-map"),
  showGeneratedButton: document.querySelector("#show-generated-map"),
  generatedOptions: document.querySelector("#generated-options"),
  downloadMenuButton: document.querySelector("#download-menu-button"),
  downloadCleanDrawioButton: document.querySelector("#download-clean-drawio"),
  downloadCleanPngButton: document.querySelector("#download-clean-png"),
  downloadGeneratedDrawioButton: document.querySelector("#download-generated-drawio"),
  downloadGeneratedPngButton: document.querySelector("#download-generated-png"),
  fullscreenButton: document.querySelector("#fullscreen-map")
};

export const downloadMenuElements = {
  options: document.querySelector("#download-options"),
  button: document.querySelector("#download-menu-button")
};

export const missingPeopleElements = {
  panel: document.querySelector("#missing-panel"),
  meta: document.querySelector("#missing-meta"),
  wrap: document.querySelector("#missing-wrap"),
  table: document.querySelector("#missing-table"),
  addButton: document.querySelector("#add-missing-boxes"),
  downloadButton: document.querySelector("#download-missing")
};

export const lastUpdatedElements = {
  container: document.querySelector("#last-updated"),
  date: document.querySelector("#last-updated-date")
};

export const helpElements = {
  buttons: document.querySelectorAll("[data-help-target]"),
  getDialog: (/** @type {any} */ id) => document.querySelector(`#${id}`)
};

export const columnsElements = {
  meta: document.querySelector("#columns-meta"),
  panel: document.querySelector("#columns-panel"),
  list: document.querySelector("#columns-list"),
  selectedStatus: document.querySelector("#selected-columns")
};

export const parseElements = {
  controls: document.querySelector("#parse-controls"),
  sourceInputs: document.querySelectorAll("input[name='omrade-plats-source']"),
  showPlaceNumberInput: document.querySelector("#show-place-number"),
  showColumnNamesInput: document.querySelector("#show-column-names"),
  showEmptyExcelPlacesInput: document.querySelector("#show-empty-excel-places")
};

export const selectedTableElements = {
  title: document.querySelector("#table-title"),
  meta: document.querySelector("#table-meta"),
  wrap: document.querySelector("#table-wrap"),
  table: document.querySelector("#selected-table"),
  duplicateWarning: document.querySelector("#duplicate-place-warning"),
  panel: document.querySelector("#table-panel")
};

export const clearedExcelElements = {
  columnsMeta: columnsElements.meta,
  columnsPanel: columnsElements.panel,
  tablePanel: selectedTableElements.panel,
  tableTitle: selectedTableElements.title,
  duplicateWarning: selectedTableElements.duplicateWarning,
  columnsList: columnsElements.list,
  parseControls: parseElements.controls,
  selectedColumnsStatus: columnsElements.selectedStatus
};

export const emptyPlacesElements = {
  panel: document.querySelector("#empty-places-panel"),
  meta: document.querySelector("#empty-places-meta"),
  wrap: document.querySelector("#empty-places-wrap"),
  table: document.querySelector("#empty-places-table")
};

export const duplicateMapPlacesElements = {
  panel: document.querySelector("#duplicate-map-places-panel"),
  meta: document.querySelector("#duplicate-map-places-meta"),
  wrap: document.querySelector("#duplicate-map-places-wrap"),
  table: document.querySelector("#duplicate-map-places-table")
};
