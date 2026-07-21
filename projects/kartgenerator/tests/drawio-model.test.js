import { describe, expect, it } from "vitest";
import {
  createDrawioXmlWithHighlightedPlaces,
  createDrawioXmlWithMissingBoxes,
  createGeneratedDrawioXml,
  makeDrawioLabel
} from "../assets/js/drawio-model.js";

const labelOptions = {
  columns: [
    { name: "Plats" },
    { name: "Förnamn" },
    { name: "Efternamn" }
  ],
  selectedColumnIndexes: [0, 1, 2],
  placeColumnIndex: 0,
  firstNameColumnIndex: 1,
  lastNameColumnIndex: 2,
  showPlaceNumber: true,
  showColumnNames: false
};

function createCellXml(value, attributes = "") {
  return `
    <mxGraphModel>
      <root>
        <mxCell id="1" vertex="1" value="${value}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" data-kartgenerator-highlight="missing-excel" data-kartgenerator-original-style="rounded=0;whiteSpace=wrap;html=1;" ${attributes} />
      </root>
    </mxGraphModel>
  `;
}

describe("createDrawioXmlWithHighlightedPlaces", () => {
  it("removes a stale missing-Excel highlight when the place is no longer missing", () => {
    const xml = createCellXml("75");
    const result = createDrawioXmlWithHighlightedPlaces(xml, new Set());

    expect(result).toContain('value="75"');
    expect(result).not.toContain("fillColor=#fff2cc");
    expect(result).not.toContain("strokeColor=#d6b656");
    expect(result).not.toContain("data-kartgenerator-highlight");
  });

  it("uses the visible place number instead of stale data-place-code when deciding highlight", () => {
    const xml = createCellXml("75", 'data-place-code="555"');
    const result = createDrawioXmlWithHighlightedPlaces(xml, new Set(["555"]));

    expect(result).toContain('value="75"');
    expect(result).not.toContain("fillColor=#fff2cc");
    expect(result).not.toContain("strokeColor=#d6b656");
  });
});

describe("createDrawioXmlWithMissingBoxes", () => {
  it("places the first box to the right and subsequent boxes below it", () => {
    const xml = `
      <mxGraphModel>
        <root>
          <mxCell id="1" vertex="1" value="75">
            <mxGeometry x="100" y="50" width="120" height="40" as="geometry" />
          </mxCell>
        </root>
      </mxGraphModel>
    `;
    const result = createDrawioXmlWithMissingBoxes(xml, [{ place: "76" }, { place: "77" }]);
    const documentXml = new DOMParser().parseFromString(result, "application/xml");
    const addedCells = [...documentXml.querySelectorAll("mxCell[id^='kartgenerator-missing-']")];

    expect(addedCells).toHaveLength(2);
    expect(addedCells[0].querySelector("mxGeometry").getAttribute("x")).toBe("280");
    expect(addedCells[0].querySelector("mxGeometry").getAttribute("y")).toBe("50");
    expect(addedCells[1].querySelector("mxGeometry").getAttribute("x")).toBe("280");
    expect(addedCells[1].querySelector("mxGeometry").getAttribute("y")).toBe("106");
  });
});

describe("createGeneratedDrawioXml", () => {
  it("adds generated labels and marks places missing from Excel", () => {
    const xml = `
      <mxGraphModel>
        <root>
          <mxCell id="1" vertex="1" value="75" style="rounded=0;" />
          <mxCell id="2" vertex="1" value="76" style="rounded=0;" />
        </root>
      </mxGraphModel>
    `;
    const result = createGeneratedDrawioXml(xml, [["75", "Josefin"]], {
      placeColumnIndex: 0,
      isEmptyRow: () => false,
      labelOptions
    });
    const documentXml = new DOMParser().parseFromString(result, "application/xml");
    const cells = [...documentXml.querySelectorAll("mxCell[vertex='1']")];

    expect(cells[0].getAttribute("value")).toBe("75<br>Josefin");
    expect(cells[0].getAttribute("data-place-code")).toBe("75");
    expect(cells[1].getAttribute("value")).toBe("76<br>Ledig plats");
    expect(cells[1].getAttribute("style")).toContain("fillColor=#fff2cc");
  });
});

describe("makeDrawioLabel", () => {
  it("combines first and last name in a generated map label", () => {
    expect(makeDrawioLabel(["75", "Josefin", "Josefinsson"], labelOptions))
      .toBe("75<br>Josefin Josefinsson");
  });

  it("respects display options without reading page elements", () => {
    expect(makeDrawioLabel(["75", "Josefin", "Josefinsson"], {
      ...labelOptions,
      showPlaceNumber: false,
      showColumnNames: true
    })).toBe("Namn: Josefin Josefinsson");
  });
});
