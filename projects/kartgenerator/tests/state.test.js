import { describe, expect, it } from "vitest";
import {
  createInitialKartgeneratorState,
  resetDiagnosticsState,
  resetDrawioState,
  resetExcelState
} from "../assets/js/state.js";

describe("createInitialKartgeneratorState", () => {
  it("creates independent initial state objects", () => {
    const firstState = createInitialKartgeneratorState();
    const secondState = createInitialKartgeneratorState();

    firstState.excelRows.push(["12"]);

    expect(secondState.excelRows).toEqual([]);
    expect(secondState.currentDrawioMode).toBe("clean");
    expect(secondState.missingSortColumn).toBe("place");
  });

  it("resets Excel state without touching map state", () => {
    const testState = createInitialKartgeneratorState();

    testState.excelRows = [["12"]];
    testState.selectedColumnIndexes = [0, 1];
    testState.parsedOmradePlatsColumnIndex = 0;
    testState.sourceDrawioXml = "<xml />";

    resetExcelState(testState);

    expect(testState.excelRows).toEqual([]);
    expect(testState.selectedColumnIndexes).toEqual([]);
    expect(testState.parsedOmradePlatsColumnIndex).toBeNull();
    expect(testState.sourceDrawioXml).toBe("<xml />");
  });

  it("resets map state without touching Excel state", () => {
    const testState = createInitialKartgeneratorState();

    testState.excelRows = [["12"]];
    testState.sourceDrawioXml = "<xml />";
    testState.sourceDrawioFileName = "karta.drawio";
    testState.generatedDrawioXml = "<generated />";
    testState.currentDrawioMode = "generated";
    testState.hasManualDrawioMode = true;

    resetDrawioState(testState);

    expect(testState.excelRows).toEqual([["12"]]);
    expect(testState.sourceDrawioXml).toBe("");
    expect(testState.sourceDrawioFileName).toBe("");
    expect(testState.generatedDrawioXml).toBe("");
    expect(testState.currentDrawioMode).toBe("clean");
    expect(testState.hasManualDrawioMode).toBe(false);
  });

  it("resets diagnostic rows and their sort state", () => {
    const testState = createInitialKartgeneratorState();

    testState.missingPeopleRows = [{ place: "75" }];
    testState.emptyPlaceRows = [{ place: "57" }];
    testState.duplicateMapPlaceRows = [{ place: "54" }];
    testState.emptyPlacesSortColumn = "count";
    testState.emptyPlacesSortDirection = "desc";

    resetDiagnosticsState(testState);

    expect(testState.missingPeopleRows).toEqual([]);
    expect(testState.emptyPlaceRows).toEqual([]);
    expect(testState.duplicateMapPlaceRows).toEqual([]);
    expect(testState.emptyPlacesSortColumn).toBe("place");
    expect(testState.emptyPlacesSortDirection).toBe("asc");
  });
});
