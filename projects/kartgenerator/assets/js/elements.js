// @ts-check

/** @type {{
 *  uploadZone: HTMLLabelElement | null,
 *  upload: HTMLInputElement | null,
 *  fileStatus: HTMLElement | null,
 *  panelTitle: HTMLElement | null,
 *  clearButton: HTMLButtonElement | null
 * }}
 */

export const excelElements = {
  uploadZone: document.querySelector("#upload-zone"),
  upload: document.querySelector("#excel-upload"),
  fileStatus: document.querySelector("#file-status"),
  panelTitle: document.querySelector("#excel-panel-title"),
  clearButton: document.querySelector("#clear-excel")
};

export const drawioElements = {
  uploadZone: document.querySelector("#drawio-upload-zone"),
  upload: document.querySelector("#drawio-upload"),
  viewer: document.querySelector("#drawio-viewer"),
  frame: document.querySelector("#drawio-frame")
};

export const selectedTableElements = {
  title: document.querySelector("#table-title"),
  meta: document.querySelector("#table-meta"),
  wrap: document.querySelector("#table-wrap"),
  table: document.querySelector("#selected-table"),
  duplicateWarning: document.querySelector("#duplicate-place-warning")
};
