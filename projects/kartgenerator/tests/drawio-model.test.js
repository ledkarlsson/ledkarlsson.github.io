import { describe, expect, it } from "vitest";
import { createDrawioXmlWithHighlightedPlaces } from "../assets/js/drawio-model.js";

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
