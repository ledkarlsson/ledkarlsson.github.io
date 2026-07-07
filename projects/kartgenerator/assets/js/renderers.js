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

export function renderMissingPeopleTable({ rows, sortColumn, sortDirection, elements, onSort }) {
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

export function renderEmptyPlacesTable({ rows, hasRequiredInput, sortColumn, sortDirection, elements, onSort }) {
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
