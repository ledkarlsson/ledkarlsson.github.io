import { describe, it, expect } from "vitest";
import { parseOmradePlatsValue, isPlaceBoxLabel, normalizePlaceCode, normalizeColumnName, drawioLabelToText } from "../assets/js/kartgenerator-utils.js";

describe("drawioLabelToText", () => {
    it("Null ger tom sträng", () => {
        const input = null;
        expect(drawioLabelToText(input)).toBe("")
    });

    it("Radbrytning", () => {
        const input = "Rad 1<br>Rad 2";
        expect(drawioLabelToText(input)).toBe("Rad 1\nRad 2")
    });

    it("tar bort övriga html-taggar", () => {
        const input = "<div><strong>Anna</strong><br>12B</div>";
        expect(drawioLabelToText(input)).toBe("Anna\n12B")
    });
});


describe("normalizeColumnName", () => {
    it("Normaliserar namn", () => {
        const input = "  åBc  ";
        expect(normalizeColumnName(input)).toBe("abc")
    });
});

describe("normalizePlaceCode", () => {
    it("Returnerar stor bokstav", () => {
        const input = "a";
        expect(normalizePlaceCode(input)).toBe("A")
    });

    it("Returnerar tom sträng för null objekt", () => {
        const input = null;
        expect(normalizePlaceCode(input)).toBe("")
    });
});


describe("isPlaceBoxLabel", () => {
    it("Returnerar true för ett giltigt platsnummer", () => {
        const input = "12";
        expect(isPlaceBoxLabel(input)).toBe(true)
    });

    it("Returnerar False för flera ord", () => {
        const input = "abc 123";
        expect(isPlaceBoxLabel(input)).toBe(false)
    });

});

describe("parseOmradePlatsValue", () => {
    it("Testa Varvsområde", () => {
        const input = "Varvsområde Alpha plats: 12B";
        const source = "varvsomrade";
        const expected = "12B";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa Bryggområde", () => {
        const input = "Brygga Alpha plats: 12B";
        const source = "brygga";
        const expected = "12B";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa med bindestreck", () => {
        const input = "Brygga Alpha - 12B";
        const source = "brygga";
        const expected = "12B";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa Vinterplats som egen källa", () => {
        const input = "Vinterplats - 88";
        const source = "vinterplats";
        const expected = "88";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Matchar inte Vinterplats när brygga är vald", () => {
        const input = "Vinterplats - 88";
        const source = "brygga";
        const expected = "";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa med kolon", () => {
        const input = "Varvsområde: 12B";
        const source = "varvsomrade";
        const expected = "12B";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa Ingenmatch", () => {
        const input = "Brygga Alpha plats: 12B";
        const source = "abc123";
        const expected = "";

        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

    it("Testa null", () => {
        const input = null;
        const source = "abc123";
        const expected = "";
        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });
});
