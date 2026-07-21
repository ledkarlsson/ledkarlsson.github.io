import { describe, expect, it } from "vitest";
import { ExcelReadError, parseExcelWorkbook } from "../assets/js/excel-reader.js";

function createXlsx(rows, sheetNames = ["Medlemmar"]) {
  return {
    read: () => ({
      SheetNames: sheetNames,
      Sheets: sheetNames.length > 0 ? { [sheetNames[0]]: {} } : {}
    }),
    utils: {
      sheet_to_json: () => rows
    }
  };
}

describe("parseExcelWorkbook", () => {
  it("finds the first populated row and creates named columns", () => {
    const result = parseExcelWorkbook(new ArrayBuffer(0), createXlsx([
      [],
      ["Område/Plats", "", "Förnamn"],
      ["Brygga 75", "A", "Josefin"]
    ]));

    expect(result).toEqual({
      columns: [
        { index: 0, name: "Område/Plats" },
        { index: 1, name: "Kolumn 2" },
        { index: 2, name: "Förnamn" }
      ],
      rows: [["Brygga 75", "A", "Josefin"]],
      sheetName: "Medlemmar"
    });
  });

  it("reports a workbook without sheets", () => {
    expect(() => parseExcelWorkbook(new ArrayBuffer(0), createXlsx([], [])))
      .toThrowError(new ExcelReadError("no-sheets", "Inga blad hittades i arbetsboken."));
  });
});
