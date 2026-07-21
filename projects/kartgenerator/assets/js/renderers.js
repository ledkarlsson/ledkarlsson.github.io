export function renderColumnsList({ columns, sheetName, selectedColumnIndexes, elements, isRequiredColumn, onToggleColumn }) {
  const { meta, list } = elements;

  list.replaceChildren();

  if (columns.length === 0) {
    meta.textContent = `Inga kolumner hittades i "${sheetName}".`;
    return;
  }

  const requiredColumnCount = columns.filter(isRequiredColumn).length;
  const visibleColumnCount = columns.length - requiredColumnCount;

  meta.textContent = `${visibleColumnCount} ${visibleColumnCount === 1 ? "kolumn hittades" : "kolumner hittades"} i "${sheetName}". Samt matchningskolumn område/plats. Välj vilken data som ska in i kartan.`;

  columns.forEach((column) => {
    if (isRequiredColumn(column)) {
      return;
    }

    const item = document.createElement("li");
    const button = document.createElement("button");
    const columnIndex = column.index;

    button.className = "column-button";
    button.type = "button";
    button.textContent = column.name;

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
      const isSelected = button.classList.toggle("is-selected");

      button.setAttribute("aria-pressed", String(isSelected));
      onToggleColumn(columnIndex, isSelected);
    });

    item.append(button);
    list.append(item);
  });
}

export function renderSelectedColumnsStatus({ columnNames, element }) {
  element.textContent = columnNames.length === 0
    ? ""
    : `${columnNames.length} valda: ${columnNames.join(", ")}`;
}

export function renderClearedExcelState({ message, elements }) {
  const {
    columnsMeta,
    columnsPanel,
    tablePanel,
    tableTitle,
    duplicateWarning,
    columnsList,
    parseControls,
    selectedColumnsStatus
  } = elements;

  columnsMeta.textContent = message;
  columnsPanel.hidden = true;
  tablePanel.hidden = true;
  tableTitle.textContent = "Vald data";
  duplicateWarning.hidden = true;
  columnsList.replaceChildren();
  parseControls.classList.remove("is-visible");
  selectedColumnsStatus.textContent = "";
}

export function renderExcelReadError({ message, elements }) {
  elements.fileStatus.textContent = message;
  elements.fileStatus.classList.add("has-error");
}

export function renderRejectedExcelFile({ message, elements }) {
  elements.uploadZone.classList.remove("has-file");
  elements.fileStatus.classList.remove("has-file", "has-error");
  elements.fileStatus.textContent = message;
  elements.fileStatus.classList.add("has-error");
  elements.panelTitle.textContent = "Excel-data";
  elements.upload.value = "";
  elements.uploadZone.hidden = false;
}

export function renderSelectedExcelFile({ fileName, elements, exampleElements, columnsPanel, tablePanel }) {
  elements.uploadZone.classList.remove("has-file");
  elements.fileStatus.classList.remove("has-file", "has-error");
  elements.fileStatus.textContent = "";
  elements.fileStatus.classList.add("has-file");
  elements.panelTitle.textContent = fileName;
  elements.clearButton.hidden = false;
  exampleElements.menu.hidden = true;
  elements.uploadZone.classList.add("has-file");
  elements.uploadZone.hidden = true;
  columnsPanel.hidden = false;
  tablePanel.hidden = false;
}

export function renderClearedExcelFile({ elements, exampleElements }) {
  elements.upload.value = "";
  elements.panelTitle.textContent = "Excel-data från BAS-rapport";
  elements.clearButton.hidden = true;
  exampleElements.menu.hidden = false;
  elements.uploadZone.hidden = false;
  elements.uploadZone.classList.remove("has-file");
  elements.fileStatus.textContent = "";
  elements.fileStatus.classList.remove("has-file", "has-error");
}

export function renderDrawioUploadMessage({ title, help = "", elements }) {
  elements.uploadZone.replaceChildren();

  const titleElement = document.createElement("span");
  titleElement.className = "drawio-title";
  titleElement.textContent = title;
  elements.uploadZone.append(titleElement);

  if (help) {
    const helpElement = document.createElement("span");
    helpElement.className = "drawio-help";
    helpElement.textContent = help;
    elements.uploadZone.append(helpElement);
  }

  elements.uploadZone.append(elements.upload);
}

export function renderRejectedDrawioFile({ message, elements }) {
  elements.uploadZone.classList.remove("has-error", "has-file");
  renderDrawioUploadMessage({ title: message, elements });
  elements.uploadZone.classList.add("has-error");
  elements.panelTitle.textContent = "Karta";
  elements.upload.value = "";
  elements.viewer.hidden = true;
  elements.uploadZone.hidden = false;
}

export function renderSelectedDrawioFile({ fileName, elements, exampleElements }) {
  elements.uploadZone.classList.remove("has-error", "has-file");
  elements.panelTitle.textContent = fileName;
  elements.clearButton.hidden = false;
  exampleElements.menu.hidden = true;
  elements.uploadZone.replaceChildren();
  elements.uploadZone.classList.add("has-file");
  elements.uploadZone.append(elements.upload);
  elements.uploadZone.hidden = true;
}

export function renderClearedDrawioFile({ elements, exampleElements }) {
  elements.upload.value = "";
  elements.panelTitle.textContent = "Karta";
  elements.clearButton.hidden = true;
  exampleElements.menu.hidden = false;
  elements.uploadZone.hidden = false;
  elements.uploadZone.classList.remove("has-file", "has-error");
  renderDrawioUploadMessage({
    title: "Ladda upp karta",
    help: "Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja",
    elements
  });
  elements.viewer.hidden = true;
}

export function renderDrawioReadError({ message, elements }) {
  renderDrawioUploadMessage({ title: message, elements });
  elements.uploadZone.classList.add("has-error");
  elements.viewer.hidden = true;
  elements.uploadZone.hidden = false;
}

export function renderDrawioViewer({ isVisible, elements }) {
  elements.viewer.hidden = !isVisible;
}

export function renderLastUpdatedDate({ modifiedDate, elements }) {
  elements.date.dateTime = modifiedDate.toISOString().slice(0, 10);
  elements.date.textContent = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(modifiedDate);
  elements.container.hidden = false;
}

export function renderParseControls({ availableSources, shouldShow, elements }) {
  elements.sourceInputs.forEach((input) => {
    const label = input.closest("label");

    if (label) {
      label.hidden = !availableSources.includes(input.value);
    }
  });

  elements.controls.classList.toggle("is-visible", shouldShow);
}

export function renderPeopleMissingFromMapUnavailable({ elements }) {
  elements.panel.hidden = true;
  elements.addButton.hidden = true;
  elements.downloadButton.disabled = true;
}

export function renderPeopleMissingFromMapPanelVisible({ elements }) {
  elements.panel.hidden = false;
}

export function renderDrawioAddPlaceError({ message, elements }) {
  elements.panelTitle.textContent = message;
}

export function renderPeopleMissingFromMapError({ message, elements }) {
  elements.meta.textContent = message;
}

export function renderDragState({ element, className, isDragging }) {
  element.classList.toggle(className, isDragging);
}

export function renderFullscreenButton({ isFullscreen, element }) {
  element.textContent = isFullscreen ? "Avsluta helskärm" : "Helskärm";
  element.setAttribute("aria-pressed", String(isFullscreen));
}

export function renderDrawioControls({
  hasSource,
  hasGenerated,
  currentMode,
  fullscreenEnabled,
  isFullscreen,
  elements
}) {
  const {
    actions,
    downloadMenu,
    addPlaceButton,
    showCleanButton,
    showGeneratedButton,
    generatedOptions,
    downloadMenuButton,
    downloadCleanDrawioButton,
    downloadCleanPngButton,
    downloadGeneratedDrawioButton,
    downloadGeneratedPngButton,
    fullscreenButton
  } = elements;

  actions.hidden = !hasSource;
  downloadMenu.hidden = !hasSource;
  addPlaceButton.disabled = !hasSource;
  showCleanButton.disabled = !hasSource || currentMode === "clean";
  showGeneratedButton.disabled = !hasGenerated || currentMode === "generated";
  generatedOptions.hidden = currentMode !== "generated" || !hasGenerated;
  downloadMenuButton.disabled = !hasSource;
  downloadCleanDrawioButton.disabled = !hasSource;
  downloadCleanPngButton.disabled = !hasSource;
  downloadGeneratedDrawioButton.disabled = !hasGenerated;
  downloadGeneratedPngButton.disabled = !hasGenerated;
  fullscreenButton.disabled = !hasSource || !fullscreenEnabled;
  showCleanButton.setAttribute("aria-pressed", String(currentMode === "clean"));
  showGeneratedButton.setAttribute("aria-pressed", String(currentMode === "generated"));
  renderFullscreenButton({ isFullscreen, element: fullscreenButton });
}

export function renderDownloadMenu({ isOpen, elements }) {
  const { options, button } = elements;

  options.hidden = !isOpen;
  button.setAttribute("aria-expanded", String(isOpen));
}

export function renderExampleMenu({ isOpen, elements }) {
  const { options, button } = elements;

  options.hidden = !isOpen;
  button.setAttribute("aria-expanded", String(isOpen));
}

export function renderClosedExampleMenus({ menus }) {
  menus.forEach((elements) => renderExampleMenu({ isOpen: false, elements }));
}

export function renderSelectedDataTable({
  rows,
  visibleRowCount,
  selectedColumnIndexes,
  parsedOmradePlatsColumnIndex,
  excelColumns,
  sortColumnIndex,
  sortDirection,
  duplicatePlaces,
  elements,
  getColumnDisplayName,
  isDuplicateRow,
  onSort
}) {
  const { title, meta, wrap, table, duplicateWarning } = elements;

  table.replaceChildren();
  title.textContent = "Vald data";

  if (selectedColumnIndexes.length === 0) {
    meta.textContent = "Välj kolumner för att skapa en tabell.";
    duplicateWarning.hidden = true;
    wrap.hidden = true;
    return;
  }

  if (visibleRowCount === 0) {
    meta.textContent = "Inga datarader hittades under rubrikraden.";
    duplicateWarning.hidden = true;
    wrap.hidden = true;
    return;
  }

  duplicateWarning.hidden = duplicatePlaces.length === 0;
  duplicateWarning.textContent = duplicatePlaces.length === 0
    ? ""
    : `Varning: flera medlemmar har samma plats: ${duplicatePlaces.join(", ")}.`;

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
    const directionMarker = sortColumnIndex === columnIndex
      ? ` ${sortDirection === "asc" ? "^" : "v"}`
      : "";

    button.className = "sort-button";
    button.type = "button";
    button.textContent = `${getColumnDisplayName(excelColumns[columnIndex])}${directionMarker}`;
    button.addEventListener("click", () => onSort(columnIndex));
    headerCell.append(button);
    headerRow.append(headerCell);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  const bodyFragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    if (isDuplicateRow(row)) {
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
  table.append(thead, tbody);
  title.textContent = `Vald data (${visibleRowCount} ${visibleRowCount === 1 ? "rad" : "rader"})`;
  meta.textContent = "";
  wrap.hidden = false;
}

export function renderPeopleMissingFromMapTable({ rows, sortColumn, sortDirection, elements, onSort }) {
  const { panel, meta, wrap, table, addButton, downloadButton } = elements;

  table.replaceChildren();

  if (rows.length === 0) {
    meta.textContent = "Alla rader med förnamn, efternamn och plats finns i kartan.";
    panel.hidden = true;
    wrap.hidden = true;
    addButton.hidden = true;
    downloadButton.disabled = true;
    return;
  }

  panel.hidden = false;
  addButton.hidden = false;
  addButton.textContent = `Lägg till ${rows.length} saknade platser i kartan`;

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  [
    ["place", "Plats"],
    ["firstName", "Fornamn"],
    ["lastName", "Efternamn"]
  ].forEach(([columnKey, header]) => {
    const headerCell = document.createElement("th");
    const button = document.createElement("button");
    const directionMarker = sortColumn === columnKey
      ? ` ${sortDirection === "asc" ? "^" : "v"}`
      : "";

    button.className = "sort-button";
    button.type = "button";
    button.textContent = `${header}${directionMarker}`;
    button.addEventListener("click", () => onSort(columnKey));
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
  table.append(thead, tbody);
  meta.textContent = `${rows.length} person${rows.length === 1 ? "" : "er"} finns i BAS men saknas i kartan.`;
  wrap.hidden = false;
  downloadButton.disabled = false;
}

export function renderMapPlacesMissingInExcelTable({ rows, hasRequiredInput, sortColumn, sortDirection, elements, onSort }) {
  const { panel, meta, wrap, table } = elements;

  table.replaceChildren();

  if (!hasRequiredInput) {
    panel.hidden = true;
    wrap.hidden = true;
    meta.textContent = "Ladda upp Excel och karta för att se platser som saknas i Excel.";
    return;
  }

  panel.hidden = false;

  if (rows.length === 0) {
    meta.textContent = "Alla platser i kartan finns i Excel.";
    wrap.hidden = true;
    return;
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headerCell = document.createElement("th");
  const button = document.createElement("button");
  const directionMarker = sortColumn === "place"
    ? ` ${sortDirection === "asc" ? "^" : "v"}`
    : "";

  button.className = "sort-button";
  button.type = "button";
  button.textContent = `Plats${directionMarker}`;
  button.addEventListener("click", () => onSort("place"));
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
  table.append(thead, tbody);
  meta.textContent = `${rows.length} plats${rows.length === 1 ? "" : "er"} finns i kartan men saknas i Excel. Dessa platser markeras med gult i kartan.`;
  wrap.hidden = false;
}

export function renderDuplicateMapPlacesTable({ rows, hasSource, elements }) {
  const { panel, meta, wrap, table } = elements;

  table.replaceChildren();

  if (!hasSource) {
    panel.hidden = true;
    wrap.hidden = true;
    meta.textContent = "Ladda upp en karta för att se duplicerade platser.";
    return;
  }

  panel.hidden = false;

  if (rows.length === 0) {
    meta.textContent = "Inga duplicerade platser hittades i kartan.";
    wrap.hidden = true;
    return;
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Plats", "Antal rutor"].forEach((header) => {
    const headerCell = document.createElement("th");

    headerCell.textContent = header;
    headerRow.append(headerCell);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");

    [row.place, String(row.count)].forEach((value) => {
      const cell = document.createElement("td");

      cell.textContent = value;
      tableRow.append(cell);
    });

    fragment.append(tableRow);
  });

  tbody.append(fragment);
  table.append(thead, tbody);
  meta.textContent = `${rows.length} plats${rows.length === 1 ? "" : "er"} finns på flera ställen i kartan. Dessa platser markeras med blått i kartan.`;
  wrap.hidden = false;
}
