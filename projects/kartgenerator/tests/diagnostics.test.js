import { describe, expect, it } from "vitest";
import {
  getDuplicateMapPlaceRows,
  getDuplicatePlaceInfo,
  getEmptyMapPlaceRows,
  getMissingPeopleRows,
  hasDuplicatePlace,
  isEmptyExcelPlaceRow
} from "../assets/js/diagnostics.js";

function createMapXml(labels) {
  const cells = labels
    .map((label, index) => `<mxCell id="cell-${index}" value="${label}" vertex="1" parent="1"><mxGeometry as="geometry"/></mxCell>`)
    .join("");

  return `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`;
}

describe("isEmptyExcelPlaceRow", () => {
  it("treats a row with place but missing first or last name as empty", () => {
    const options = { placeColumnIndex: 0, firstNameColumnIndex: 1, lastNameColumnIndex: 2 };

    expect(isEmptyExcelPlaceRow(["12", "", "Andersson"], options)).toBe(true);
    expect(isEmptyExcelPlaceRow(["12", "Anna", ""], options)).toBe(true);
    expect(isEmptyExcelPlaceRow(["12", "Anna", "Andersson"], options)).toBe(false);
  });
});

describe("getDuplicatePlaceInfo", () => {
  it("finds duplicate Excel places by normalized place code", () => {
    const rows = [
      ["54", "Anna"],
      ["54", "Bo"],
      ["55", "Cia"]
    ];

    const result = getDuplicatePlaceInfo(rows, 0);

    expect(result.duplicatePlaces).toEqual(["54"]);
    expect(hasDuplicatePlace(rows[0], result.duplicatePlaceCodes, 0)).toBe(true);
    expect(hasDuplicatePlace(rows[2], result.duplicatePlaceCodes, 0)).toBe(false);
  });
});

describe("getDuplicateMapPlaceRows", () => {
  it("finds duplicate places in the map XML", () => {
    expect(getDuplicateMapPlaceRows(createMapXml(["12", "12", "13"]))).toEqual([
      { place: "12", normalizedPlace: "12", count: 2 }
    ]);
  });
});

describe("getEmptyMapPlaceRows", () => {
  it("finds map places that are missing in Excel", () => {
    const rows = [["12"], ["13"]];

    expect(getEmptyMapPlaceRows(createMapXml(["12", "13", "14"]), rows, 0)).toEqual([
      { place: "14", normalizedPlace: "14" }
    ]);
  });
});

describe("getMissingPeopleRows", () => {
  it("finds people with place in Excel that is missing in the map", () => {
    const rows = [
      ["12", "Anna", "Andersson"],
      ["75", "Josefin", "Josefinsson"],
      ["76", "", "Tomsson"]
    ];

    expect(getMissingPeopleRows(createMapXml(["12"]), rows, {
      placeColumnIndex: 0,
      firstNameColumnIndex: 1,
      lastNameColumnIndex: 2
    })).toEqual([
      { place: "75", firstName: "Josefin", lastName: "Josefinsson" }
    ]);
  });
});
