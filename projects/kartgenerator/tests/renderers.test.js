import { describe, expect, it } from "vitest";
import {
  renderColumnsList,
  renderClearedDrawioFile,
  renderClearedExcelFile,
  renderClearedExcelState,
  renderClosedExampleMenus,
  renderDuplicateMapPlacesTable,
  renderDownloadMenu,
  renderDrawioControls,
  renderDrawioReadError,
  renderDrawioUploadMessage,
  renderDragState,
  renderExcelReadError,
  renderMapPlacesMissingInExcelTable,
  renderExampleMenu,
  renderFullscreenButton,
  renderLastUpdatedDate,
  renderPeopleMissingFromMapUnavailable,
  renderParseControls,
  renderRejectedDrawioFile,
  renderRejectedExcelFile,
  renderSelectedDrawioFile,
  renderPeopleMissingFromMapTable,
  renderSelectedColumnsStatus,
  renderSelectedDataTable,
  renderSelectedExcelFile
} from "../assets/js/renderers.js";

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

function createPeopleMissingFromMapElements() {
  const elements = createTablePanelElements();
  const addButton = document.createElement("button");
  const downloadButton = document.createElement("button");

  addButton.hidden = true;
  downloadButton.disabled = true;

  return {
    ...elements,
    addButton,
    downloadButton
  };
}

function createDuplicateMapPlacesElements() {
  return createTablePanelElements();
}

function createColumnsElements() {
  document.body.innerHTML = `
    <p id="meta"></p>
    <ul id="list"></ul>
  `;

  return {
    meta: document.querySelector("#meta"),
    list: document.querySelector("#list")
  };
}

function createSelectedTableElements() {
  document.body.innerHTML = `
    <h2 id="title"></h2>
    <p id="meta"></p>
    <p id="duplicate-warning"></p>
    <div id="wrap" hidden>
      <table id="table"></table>
    </div>
  `;

  return {
    title: document.querySelector("#title"),
    meta: document.querySelector("#meta"),
    wrap: document.querySelector("#wrap"),
    table: document.querySelector("#table"),
    duplicateWarning: document.querySelector("#duplicate-warning")
  };
}

function createClearedExcelElements() {
  document.body.innerHTML = `
    <p id="columns-meta"></p>
    <section id="columns-panel"></section>
    <section id="table-panel"></section>
    <h2 id="table-title">Gammal titel</h2>
    <p id="duplicate-warning">Gammal varning</p>
    <ul id="columns-list"><li>Gammal kolumn</li></ul>
    <div id="parse-controls" class="is-visible"></div>
    <p id="selected-columns">2 valda</p>
  `;

  return {
    columnsMeta: document.querySelector("#columns-meta"),
    columnsPanel: document.querySelector("#columns-panel"),
    tablePanel: document.querySelector("#table-panel"),
    tableTitle: document.querySelector("#table-title"),
    duplicateWarning: document.querySelector("#duplicate-warning"),
    columnsList: document.querySelector("#columns-list"),
    parseControls: document.querySelector("#parse-controls"),
    selectedColumnsStatus: document.querySelector("#selected-columns")
  };
}

function createDrawioControlElements() {
  document.body.innerHTML = `
    <section id="actions"></section>
    <div id="download-menu"></div>
    <button id="add-place"></button>
    <button id="show-clean"></button>
    <button id="show-generated"></button>
    <div id="generated-options"></div>
    <button id="download-menu-button"></button>
    <button id="download-clean-drawio"></button>
    <button id="download-clean-png"></button>
    <button id="download-generated-drawio"></button>
    <button id="download-generated-png"></button>
    <button id="fullscreen"></button>
  `;

  return {
    actions: document.querySelector("#actions"),
    downloadMenu: document.querySelector("#download-menu"),
    addPlaceButton: document.querySelector("#add-place"),
    showCleanButton: document.querySelector("#show-clean"),
    showGeneratedButton: document.querySelector("#show-generated"),
    generatedOptions: document.querySelector("#generated-options"),
    downloadMenuButton: document.querySelector("#download-menu-button"),
    downloadCleanDrawioButton: document.querySelector("#download-clean-drawio"),
    downloadCleanPngButton: document.querySelector("#download-clean-png"),
    downloadGeneratedDrawioButton: document.querySelector("#download-generated-drawio"),
    downloadGeneratedPngButton: document.querySelector("#download-generated-png"),
    fullscreenButton: document.querySelector("#fullscreen")
  };
}

function createExcelUploadElements() {
  document.body.innerHTML = `
    <label id="upload-zone" class="has-file" hidden>
      <input id="upload" />
    </label>
    <p id="status" class="has-file has-error">Gammal status</p>
    <h2 id="title">Gammal titel</h2>
    <button id="clear"></button>
    <div id="example-menu"></div>
    <section id="columns" hidden></section>
    <section id="table" hidden></section>
  `;

  return {
    elements: {
      uploadZone: document.querySelector("#upload-zone"),
      upload: document.querySelector("#upload"),
      fileStatus: document.querySelector("#status"),
      panelTitle: document.querySelector("#title"),
      clearButton: document.querySelector("#clear")
    },
    exampleElements: {
      menu: document.querySelector("#example-menu")
    },
    columnsPanel: document.querySelector("#columns"),
    tablePanel: document.querySelector("#table")
  };
}

function createDrawioUploadElements() {
  document.body.innerHTML = `
    <label id="upload-zone" class="has-error has-file" hidden>
      <input id="upload" />
    </label>
    <h2 id="title">Gammal titel</h2>
    <button id="clear"></button>
    <div id="example-menu"></div>
    <div id="viewer"></div>
  `;

  return {
    elements: {
      uploadZone: document.querySelector("#upload-zone"),
      upload: document.querySelector("#upload"),
      panelTitle: document.querySelector("#title"),
      clearButton: document.querySelector("#clear"),
      viewer: document.querySelector("#viewer")
    },
    exampleElements: {
      menu: document.querySelector("#example-menu")
    }
  };
}

describe("renderColumnsList", () => {
  it("renders an empty column message", () => {
    const elements = createColumnsElements();

    renderColumnsList({
      columns: [],
      sheetName: "Rapport",
      selectedColumnIndexes: [],
      elements,
      isRequiredColumn: () => false,
      onToggleColumn: () => {}
    });

    expect(elements.meta.textContent).toBe('Inga kolumner hittades i "Rapport".');
    expect(elements.list.children).toHaveLength(0);
  });

  it("renders non-required column buttons and reports toggles", () => {
    const elements = createColumnsElements();
    const toggles = [];

    renderColumnsList({
      columns: [
        { index: 0, name: "Område/Plats" },
        { index: 1, name: "Förnamn" },
        { index: 2, name: "Efternamn" }
      ],
      sheetName: "Rapport",
      selectedColumnIndexes: [1],
      elements,
      isRequiredColumn: (column) => column.name === "Område/Plats",
      onToggleColumn: (columnIndex, isSelected) => toggles.push({ columnIndex, isSelected })
    });

    const buttons = [...elements.list.querySelectorAll("button")];

    expect(elements.meta.textContent).toBe('2 kolumner hittades i "Rapport". Samt matchningskolumn område/plats. Välj vilken data som ska in i kartan.');
    expect(buttons.map((button) => button.textContent)).toEqual(["Förnamn", "Efternamn"]);
    expect(buttons[0].classList.contains("is-selected")).toBe(true);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");

    buttons[0].click();
    buttons[1].click();

    expect(toggles).toEqual([
      { columnIndex: 1, isSelected: false },
      { columnIndex: 2, isSelected: true }
    ]);
  });
});

describe("upload renderers", () => {
  it("renders Excel selected, rejected, cleared and read-error states", () => {
    const { elements, exampleElements, columnsPanel, tablePanel } = createExcelUploadElements();

    renderSelectedExcelFile({
      fileName: "rapport.xlsx",
      elements,
      exampleElements,
      columnsPanel,
      tablePanel
    });

    expect(elements.panelTitle.textContent).toBe("rapport.xlsx");
    expect(elements.fileStatus.classList.contains("has-file")).toBe(true);
    expect(elements.fileStatus.classList.contains("has-error")).toBe(false);
    expect(elements.uploadZone.hidden).toBe(true);
    expect(elements.clearButton.hidden).toBe(false);
    expect(exampleElements.menu.hidden).toBe(true);
    expect(columnsPanel.hidden).toBe(false);
    expect(tablePanel.hidden).toBe(false);

    renderRejectedExcelFile({ message: "Fel fil.", elements });
    expect(elements.fileStatus.textContent).toBe("Fel fil.");
    expect(elements.fileStatus.classList.contains("has-error")).toBe(true);
    expect(elements.panelTitle.textContent).toBe("Excel-data");
    expect(elements.uploadZone.hidden).toBe(false);

    renderExcelReadError({ message: "Kunde inte läsa.", elements });
    expect(elements.fileStatus.textContent).toBe("Kunde inte läsa.");

    renderClearedExcelFile({ elements, exampleElements });
    expect(elements.panelTitle.textContent).toBe("Excel-data från BAS-rapport");
    expect(elements.clearButton.hidden).toBe(true);
    expect(exampleElements.menu.hidden).toBe(false);
    expect(elements.fileStatus.textContent).toBe("");
  });

  it("renders draw.io upload states", () => {
    const { elements, exampleElements } = createDrawioUploadElements();

    renderDrawioUploadMessage({
      title: "Ladda upp karta",
      help: "Dra hit filen",
      elements
    });
    expect(elements.uploadZone.textContent).toContain("Ladda upp karta");
    expect(elements.uploadZone.textContent).toContain("Dra hit filen");
    expect(elements.uploadZone.querySelector("#upload")).toBe(elements.upload);

    renderSelectedDrawioFile({ fileName: "karta.drawio", elements, exampleElements });
    expect(elements.panelTitle.textContent).toBe("karta.drawio");
    expect(elements.clearButton.hidden).toBe(false);
    expect(exampleElements.menu.hidden).toBe(true);
    expect(elements.uploadZone.hidden).toBe(true);
    expect(elements.uploadZone.classList.contains("has-file")).toBe(true);

    renderRejectedDrawioFile({ message: "Fel kartfil.", elements });
    expect(elements.panelTitle.textContent).toBe("Karta");
    expect(elements.uploadZone.textContent).toContain("Fel kartfil.");
    expect(elements.uploadZone.classList.contains("has-error")).toBe(true);
    expect(elements.viewer.hidden).toBe(true);

    renderDrawioReadError({ message: "Tom karta.", elements });
    expect(elements.uploadZone.textContent).toContain("Tom karta.");

    renderClearedDrawioFile({ elements, exampleElements });
    expect(elements.panelTitle.textContent).toBe("Karta");
    expect(elements.clearButton.hidden).toBe(true);
    expect(exampleElements.menu.hidden).toBe(false);
    expect(elements.viewer.hidden).toBe(true);
    expect(elements.uploadZone.textContent).toContain("Ladda upp karta");
  });
});

describe("small DOM renderers", () => {
  it("renders last updated date", () => {
    document.body.innerHTML = `<p id="container" hidden><time id="date"></time></p>`;
    const elements = {
      container: document.querySelector("#container"),
      date: document.querySelector("#date")
    };

    renderLastUpdatedDate({
      modifiedDate: new Date("2026-07-21T12:00:00Z"),
      elements
    });

    expect(elements.container.hidden).toBe(false);
    expect(elements.date.getAttribute("datetime")).toBe("2026-07-21");
    expect(elements.date.textContent).toContain("2026");
  });

  it("renders parse controls and drag state", () => {
    document.body.innerHTML = `
      <div id="controls"></div>
      <label id="first"><input value="brygga"></label>
      <label id="second"><input value="vinterplats"></label>
      <div id="drop"></div>
    `;
    const elements = {
      controls: document.querySelector("#controls"),
      sourceInputs: document.querySelectorAll("input")
    };
    const drop = document.querySelector("#drop");

    renderParseControls({ availableSources: ["brygga"], shouldShow: false, elements });
    expect(document.querySelector("#first").hidden).toBe(false);
    expect(document.querySelector("#second").hidden).toBe(true);
    expect(elements.controls.classList.contains("is-visible")).toBe(false);

    renderDragState({ element: drop, className: "is-dragging", isDragging: true });
    expect(drop.classList.contains("is-dragging")).toBe(true);
    renderDragState({ element: drop, className: "is-dragging", isDragging: false });
    expect(drop.classList.contains("is-dragging")).toBe(false);
  });

  it("renders unavailable people-missing-from-map controls", () => {
    const elements = createPeopleMissingFromMapElements();

    renderPeopleMissingFromMapUnavailable({ elements });

    expect(elements.panel.hidden).toBe(true);
    expect(elements.addButton.hidden).toBe(true);
    expect(elements.downloadButton.disabled).toBe(true);
  });
});

describe("renderFullscreenButton", () => {
  it("shows the current fullscreen state", () => {
    const element = document.createElement("button");

    renderFullscreenButton({ isFullscreen: true, element });

    expect(element.textContent).toBe("Avsluta helskärm");
    expect(element.getAttribute("aria-pressed")).toBe("true");

    renderFullscreenButton({ isFullscreen: false, element });

    expect(element.textContent).toBe("Helskärm");
    expect(element.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("renderDrawioControls", () => {
  it("disables map controls when no map is loaded", () => {
    const elements = createDrawioControlElements();

    renderDrawioControls({
      hasSource: false,
      hasGenerated: false,
      currentMode: "clean",
      fullscreenEnabled: true,
      isFullscreen: false,
      elements
    });

    expect(elements.actions.hidden).toBe(true);
    expect(elements.downloadMenu.hidden).toBe(true);
    expect(elements.addPlaceButton.disabled).toBe(true);
    expect(elements.showCleanButton.disabled).toBe(true);
    expect(elements.showGeneratedButton.disabled).toBe(true);
    expect(elements.downloadMenuButton.disabled).toBe(true);
    expect(elements.fullscreenButton.disabled).toBe(true);
    expect(elements.fullscreenButton.textContent).toBe("Helskärm");
  });

  it("enables relevant map controls when generated mode is available", () => {
    const elements = createDrawioControlElements();

    renderDrawioControls({
      hasSource: true,
      hasGenerated: true,
      currentMode: "generated",
      fullscreenEnabled: true,
      isFullscreen: true,
      elements
    });

    expect(elements.actions.hidden).toBe(false);
    expect(elements.downloadMenu.hidden).toBe(false);
    expect(elements.addPlaceButton.disabled).toBe(false);
    expect(elements.showCleanButton.disabled).toBe(false);
    expect(elements.showCleanButton.getAttribute("aria-pressed")).toBe("false");
    expect(elements.showGeneratedButton.disabled).toBe(true);
    expect(elements.showGeneratedButton.getAttribute("aria-pressed")).toBe("true");
    expect(elements.generatedOptions.hidden).toBe(false);
    expect(elements.downloadGeneratedDrawioButton.disabled).toBe(false);
    expect(elements.downloadGeneratedPngButton.disabled).toBe(false);
    expect(elements.fullscreenButton.disabled).toBe(false);
    expect(elements.fullscreenButton.textContent).toBe("Avsluta helskärm");
  });
});

describe("download and example menu renderers", () => {
  it("renders download menu open and closed states", () => {
    document.body.innerHTML = `<button id="button"></button><div id="options"></div>`;
    const elements = {
      button: document.querySelector("#button"),
      options: document.querySelector("#options")
    };

    renderDownloadMenu({ isOpen: true, elements });
    expect(elements.options.hidden).toBe(false);
    expect(elements.button.getAttribute("aria-expanded")).toBe("true");

    renderDownloadMenu({ isOpen: false, elements });
    expect(elements.options.hidden).toBe(true);
    expect(elements.button.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders example menus and closes all example menus", () => {
    document.body.innerHTML = `
      <button id="first-button"></button><div id="first-options"></div>
      <button id="second-button"></button><div id="second-options"></div>
    `;
    const first = {
      button: document.querySelector("#first-button"),
      options: document.querySelector("#first-options")
    };
    const second = {
      button: document.querySelector("#second-button"),
      options: document.querySelector("#second-options")
    };

    renderExampleMenu({ isOpen: true, elements: first });
    renderExampleMenu({ isOpen: true, elements: second });
    renderClosedExampleMenus({ menus: [first, second] });

    expect(first.options.hidden).toBe(true);
    expect(first.button.getAttribute("aria-expanded")).toBe("false");
    expect(second.options.hidden).toBe(true);
    expect(second.button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("renderSelectedColumnsStatus", () => {
  it("shows selected column names", () => {
    const element = document.createElement("p");

    renderSelectedColumnsStatus({
      columnNames: ["Förnamn", "Efternamn"],
      element
    });

    expect(element.textContent).toBe("2 valda: Förnamn, Efternamn");
  });

  it("clears the status when no columns are selected", () => {
    const element = document.createElement("p");

    element.textContent = "Gammal text";
    renderSelectedColumnsStatus({ columnNames: [], element });

    expect(element.textContent).toBe("");
  });
});

describe("renderClearedExcelState", () => {
  it("clears Excel panels and status text", () => {
    const elements = createClearedExcelElements();

    renderClearedExcelState({
      message: "Ladda upp en Excel-fil för att visa kolumnerna.",
      elements
    });

    expect(elements.columnsMeta.textContent).toBe("Ladda upp en Excel-fil för att visa kolumnerna.");
    expect(elements.columnsPanel.hidden).toBe(true);
    expect(elements.tablePanel.hidden).toBe(true);
    expect(elements.tableTitle.textContent).toBe("Vald data");
    expect(elements.duplicateWarning.hidden).toBe(true);
    expect(elements.columnsList.children).toHaveLength(0);
    expect(elements.parseControls.classList.contains("is-visible")).toBe(false);
    expect(elements.selectedColumnsStatus.textContent).toBe("");
  });
});

describe("renderSelectedDataTable", () => {
  const excelColumns = [
    { index: 0, name: "Område/Plats" },
    { index: 1, name: "Förnamn" },
    { index: 2, name: "Efternamn" }
  ];

  it("shows a message when no columns are selected", () => {
    const elements = createSelectedTableElements();

    renderSelectedDataTable({
      rows: [],
      visibleRowCount: 0,
      selectedColumnIndexes: [],
      parsedOmradePlatsColumnIndex: 0,
      excelColumns,
      sortColumnIndex: null,
      sortDirection: "asc",
      duplicatePlaces: [],
      elements,
      getColumnDisplayName: (column) => column.name,
      isDuplicateRow: () => false,
      onSort: () => {}
    });

    expect(elements.title.textContent).toBe("Vald data");
    expect(elements.meta.textContent).toBe("Välj kolumner för att skapa en tabell.");
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.duplicateWarning.hidden).toBe(true);
    expect(elements.table.children).toHaveLength(0);
  });

  it("shows a message when selected data has no rows", () => {
    const elements = createSelectedTableElements();

    renderSelectedDataTable({
      rows: [],
      visibleRowCount: 0,
      selectedColumnIndexes: [1, 2],
      parsedOmradePlatsColumnIndex: 0,
      excelColumns,
      sortColumnIndex: null,
      sortDirection: "asc",
      duplicatePlaces: [],
      elements,
      getColumnDisplayName: (column) => column.name,
      isDuplicateRow: () => false,
      onSort: () => {}
    });

    expect(elements.title.textContent).toBe("Vald data");
    expect(elements.meta.textContent).toBe("Inga datarader hittades under rubrikraden.");
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.duplicateWarning.hidden).toBe(true);
  });

  it("renders selected rows and reports sort clicks", () => {
    const elements = createSelectedTableElements();
    const sortedColumns = [];

    renderSelectedDataTable({
      rows: [
        { 1: "Anna", 2: "Andersson", rawOmradePlats: "Brygga 54" },
        { 1: "Bertil", 2: "Bengtsson", rawOmradePlats: "Brygga 55" }
      ],
      visibleRowCount: 2,
      selectedColumnIndexes: [1, 2],
      parsedOmradePlatsColumnIndex: 0,
      excelColumns,
      sortColumnIndex: 1,
      sortDirection: "desc",
      duplicatePlaces: ["54"],
      elements,
      getColumnDisplayName: (column) => column.name,
      isDuplicateRow: (row) => row.rawOmradePlats === "Brygga 54",
      onSort: (columnIndex) => sortedColumns.push(columnIndex)
    });

    expect(elements.title.textContent).toBe("Vald data (2 rader)");
    expect(elements.meta.textContent).toBe("");
    expect(elements.wrap.hidden).toBe(false);
    expect(elements.duplicateWarning.hidden).toBe(false);
    expect(elements.duplicateWarning.textContent).toBe("Varning: flera medlemmar har samma plats: 54.");
    expect(elements.table.textContent).toContain("Område/Plats");
    expect(elements.table.textContent).toContain("Förnamn v");
    expect(elements.table.textContent).toContain("Efternamn");
    expect(elements.table.textContent).toContain("Brygga 54");
    expect(elements.table.textContent).toContain("Anna");
    expect(elements.table.querySelector("tbody tr").classList.contains("has-duplicate-place")).toBe(true);

    elements.table.querySelector("button").click();

    expect(sortedColumns).toEqual([1]);
  });
});

describe("renderPeopleMissingFromMapTable", () => {
  it("hides the panel and disables actions when nobody is missing from the map", () => {
    const elements = createPeopleMissingFromMapElements();

    renderPeopleMissingFromMapTable({
      rows: [],
      sortColumn: "place",
      sortDirection: "asc",
      elements,
      onSort: () => {}
    });

    expect(elements.panel.hidden).toBe(true);
    expect(elements.wrap.hidden).toBe(true);
    expect(elements.addButton.hidden).toBe(true);
    expect(elements.downloadButton.disabled).toBe(true);
    expect(elements.meta.textContent).toBe("Alla rader med förnamn, efternamn och plats finns i kartan.");
  });

  it("renders people missing from the map and wires sort buttons", () => {
    const elements = createPeopleMissingFromMapElements();
    const sortedColumns = [];

    renderPeopleMissingFromMapTable({
      rows: [{ place: "75", firstName: "Josefin", lastName: "Josefinsson" }],
      sortColumn: "firstName",
      sortDirection: "desc",
      elements,
      onSort: (column) => sortedColumns.push(column)
    });

    expect(elements.panel.hidden).toBe(false);
    expect(elements.wrap.hidden).toBe(false);
    expect(elements.addButton.hidden).toBe(false);
    expect(elements.addButton.textContent).toBe("Lägg till 1 saknade platser i kartan");
    expect(elements.downloadButton.disabled).toBe(false);
    expect(elements.meta.textContent).toBe("1 person finns i BAS men saknas i kartan.");
    expect(elements.table.textContent).toContain("Fornamn v");
    expect(elements.table.textContent).toContain("75");
    expect(elements.table.textContent).toContain("Josefin");
    expect(elements.table.textContent).toContain("Josefinsson");

    elements.table.querySelector("button").click();

    expect(sortedColumns).toEqual(["place"]);
  });
});

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

describe("renderMapPlacesMissingInExcelTable", () => {
  it("hides the panel when Excel or map input is missing", () => {
    const elements = createTablePanelElements();

    renderMapPlacesMissingInExcelTable({
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

    renderMapPlacesMissingInExcelTable({
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

    renderMapPlacesMissingInExcelTable({
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
