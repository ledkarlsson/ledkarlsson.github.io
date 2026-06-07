import { describe, it, expect } from "vitest";
import { parseOmradePlatsValue } from "../assets/js/kartgenerator-utils.js";

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

    it("Testa Ingenmatch", () => {
        const input = "Brygga Alpha plats: 12B";
        const source = "abc123";
        const expected = "";

        expect(parseOmradePlatsValue(input, source)).toBe(expected);
    });

});
