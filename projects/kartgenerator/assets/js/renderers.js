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
