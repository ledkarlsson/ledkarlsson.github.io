import { describe, expect, it } from "vitest";
import {
  clearGeneratedDrawioXml,
  createInitialKartgeneratorState,
  resetDiagnosticsState,
  resetDrawioState,
  resetExcelState,
  setCurrentDrawioMode,
  setGeneratedDrawioXml,
  setManualDrawioMode,
  setSourceDrawioXml
} from "../assets/js/state.js";

describe("createInitialKartgeneratorState", () => {
  it("creates independent initial state objects", () => {
    const firstState = createInitialKartgeneratorState();
    const secondState = createInitialKartgeneratorState();

    firstState.excelRows.push(["12"]);

    expect(secondState.excelRows).toEqual([]);
    expect(secondState.currentDrawioMode).toBe("clean");
    expect(secondState.peopleMissingFromMapSortColumn).toBe("place");
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

  it("sets source and pending map XML together", () => {
    const testState = createInitialKartgeneratorState();

    testState.pendingDrawioXml = "<old />";

    setSourceDrawioXml("<new />", testState);

    expect(testState.sourceDrawioXml).toBe("<new />");
    expect(testState.pendingDrawioXml).toBe("<new />");
  });

  it("sets generated map XML and reports whether one already existed", () => {
    const testState = createInitialKartgeneratorState();

    expect(setGeneratedDrawioXml("<first />", testState)).toEqual({ hadGeneratedDrawioXml: false });
    expect(setGeneratedDrawioXml("<second />", testState)).toEqual({ hadGeneratedDrawioXml: true });
    expect(testState.generatedDrawioXml).toBe("<second />");
  });

  it("clears generated map XML and falls back from generated mode to clean", () => {
    const testState = createInitialKartgeneratorState();

    testState.generatedDrawioXml = "<generated />";
    testState.currentDrawioMode = "generated";

    expect(clearGeneratedDrawioXml(testState)).toEqual({ wasShowingGenerated: true });
    expect(testState.generatedDrawioXml).toBe("");
    expect(testState.currentDrawioMode).toBe("clean");
  });

  it("sets map mode and manual map flag", () => {
    const testState = createInitialKartgeneratorState();

    setCurrentDrawioMode("generated", testState);
    setManualDrawioMode(true, testState);

    expect(testState.currentDrawioMode).toBe("generated");
    expect(testState.hasManualDrawioMode).toBe(true);
    expect(() => setCurrentDrawioMode("unknown", testState)).toThrow("Okänt kartläge");
  });

  it("resets diagnostic rows and their sort state", () => {
    const testState = createInitialKartgeneratorState();

    testState.peopleMissingFromMapRows = [{ place: "75" }];
    testState.mapPlacesMissingInExcelRows = [{ place: "57" }];
    testState.duplicateMapPlaceRows = [{ place: "54" }];
    testState.mapPlacesMissingInExcelSortColumn = "count";
    testState.mapPlacesMissingInExcelSortDirection = "desc";

    resetDiagnosticsState(testState);

    expect(testState.peopleMissingFromMapRows).toEqual([]);
    expect(testState.mapPlacesMissingInExcelRows).toEqual([]);
    expect(testState.duplicateMapPlaceRows).toEqual([]);
    expect(testState.mapPlacesMissingInExcelSortColumn).toBe("place");
    expect(testState.mapPlacesMissingInExcelSortDirection).toBe("asc");
  });
});
