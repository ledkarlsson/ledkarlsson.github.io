import { describe, expect, it } from "vitest";
import { renderDuplicateMapPlacesTable } from "../assets/js/renderers.js";

function createDuplicateMapPlacesElements() {
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
