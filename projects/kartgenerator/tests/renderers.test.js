import { describe, expect, it } from "vitest";
import { renderDuplicateMapPlacesTable, renderEmptyPlacesTable } from "../assets/js/renderers.js";

function createTablePanelElements() {
  document.body.innerHTML = `
    <section id="panel" hidden>
      <p id="meta"></p>
      <div id="wrap" hidden>
        <table id="table"></table>
      </div>
    </section>
  `;

  return {
    panel: document.querySelector("#panel"),
    meta: document.querySelector("#meta"),
    wrap: document.querySelector("#wrap"),
    table: document.querySelector("#table")
  };
}

function createDuplicateMapPlacesElements() {
  return createTablePanelElements();
}

describe("renderDuplicateMapPlacesTable", () => {
  it("hides the panel when no map is loaded", () => {
    const elements = createDuplicateMapPlacesElements();

    renderDuplicateMapPlacesTable({ rows: [], hasSource: false, elements });

    expect(elements.panel.hidden).toBe(true);
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.meta.textContent).toBe("Ladda upp en karta för att se duplicerade platser.");
  });

  it("shows an empty message when the map has no duplicates", () => {
    const elements = createDuplicateMapPlacesElements();

    renderDuplicateMapPlacesTable({ rows: [], hasSource: true, elements });

    expect(elements.panel.hidden).toBe(false);
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.meta.textContent).toBe("Inga duplicerade platser hittades i kartan.");
  });

  it("renders duplicate map places", () => {
    const elements = createDuplicateMapPlacesElements();

    renderDuplicateMapPlacesTable({
      rows: [{ place: "54", count: 2 }],
      hasSource: true,
      elements
    });

    expect(elements.panel.hidden).toBe(false);
    expect(elements.wrap.hidden).toBe(false);
    expect(elements.meta.textContent).toBe("1 plats finns på flera ställen i kartan. Dessa platser markeras med blått i kartan.");
    expect(elements.table.textContent).toContain("Plats");
    expect(elements.table.textContent).toContain("Antal rutor");
    expect(elements.table.textContent).toContain("54");
    expect(elements.table.textContent).toContain("2");
  });
});

describe("renderEmptyPlacesTable", () => {
  it("hides the panel when Excel or map input is missing", () => {
    const elements = createTablePanelElements();

    renderEmptyPlacesTable({
      rows: [],
      hasRequiredInput: false,
      sortColumn: "place",
      sortDirection: "asc",
      elements,
      onSort: () => {}
    });

    expect(elements.panel.hidden).toBe(true);
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.meta.textContent).toBe("Ladda upp Excel och karta för att se platser som saknas i Excel.");
  });

  it("shows an empty message when all map places exist in Excel", () => {
    const elements = createTablePanelElements();

    renderEmptyPlacesTable({
      rows: [],
      hasRequiredInput: true,
      sortColumn: "place",
      sortDirection: "asc",
      elements,
      onSort: () => {}
    });

    expect(elements.panel.hidden).toBe(false);
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.meta.textContent).toBe("Alla platser i kartan finns i Excel.");
  });

  it("renders missing Excel places and wires the sort button", () => {
    const elements = createTablePanelElements();
    const sortedColumns = [];

    renderEmptyPlacesTable({
      rows: [{ place: "57" }],
      hasRequiredInput: true,
      sortColumn: "place",
      sortDirection: "desc",
      elements,
      onSort: (column) => sortedColumns.push(column)
    });

    expect(elements.panel.hidden).toBe(false);
    expect(elements.wrap.hidden).toBe(false);
    expect(elements.meta.textContent).toBe("1 plats finns i kartan men saknas i Excel. Dessa platser markeras med gult i kartan.");
    expect(elements.table.textContent).toContain("Plats v");
    expect(elements.table.textContent).toContain("57");

    elements.table.querySelector("button").click();

    expect(sortedColumns).toEqual(["place"]);
  });
});
