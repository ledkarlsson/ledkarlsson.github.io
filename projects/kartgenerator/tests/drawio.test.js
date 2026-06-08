import { describe, it, expect } from "vitest";
import { getMapPlaceLabels } from "../assets/js/drawio.js";

describe("getMapPlaceLabels", () => {
    it("Null ger tom set", () => {
        const input = null;
        expect(getMapPlaceLabels(input)).toStrictEqual(new Set())
    });

    it("Felaktig xml ger tom set", () => {
        const input = "abc123";
        expect(getMapPlaceLabels(input)).toStrictEqual(new Set())
    });

    it("Enkel xml ger tillbaka plats", () => {
        const input = `
        <mxGraphModel>
        <root>
            <mxCell id="1" vertex="1" value="12B" />
        </root>
        </mxGraphModel>
        `;
        expect(getMapPlaceLabels(input)).toStrictEqual(new Set(["12B"]))
    });

    it("Samlar flera giltiga platsnummer i en Set", () => {
        const input = `
        <mxGraphModel>
        <root>
            <mxCell id="1" vertex="1" value="12A" />
            <mxCell id="2" vertex="1" value="12B" />
            <mxCell id="3" vertex="1" value="Anna" />
            <mxCell id="4" vertex="0" value="25C" />
        </root>
        </mxGraphModel>
        `;
        expect(getMapPlaceLabels(input)).toStrictEqual(new Set(["12A", "12B"]))
    });

});
