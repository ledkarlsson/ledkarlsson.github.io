import { getMapPlaceLabels, getMapPlaces } from "./drawio.js";
import { getPlaceCodeFromCellLabel } from "./drawio-model.js";
import { normalizePlaceCode } from "./kartgenerator-utils.js";

export function isEmptyExcelPlaceRow(row, { placeColumnIndex, firstNameColumnIndex, lastNameColumnIndex }) {
  if (placeColumnIndex === null) {
    return false;
  }

  const place = row[placeColumnIndex];
  const hasPlace = place !== null && place !== undefined && String(place).trim() !== "";
  const firstName = firstNameColumnIndex >= 0 ? row[firstNameColumnIndex] : "";
  const lastName = lastNameColumnIndex >= 0 ? row[lastNameColumnIndex] : "";
  const hasFirstName = firstName !== null && firstName !== undefined && String(firstName).trim() !== "";
  const hasLastName = lastName !== null && lastName !== undefined && String(lastName).trim() !== "";

  return hasPlace && (!hasFirstName || !hasLastName);
}

export function getDuplicatePlaceInfo(rows, placeColumnIndex) {
  if (placeColumnIndex === null) {
    return { duplicatePlaces: [], duplicatePlaceCodes: new Set() };
  }

  const placeCounts = new Map();
  const placeLabels = new Map();

  rows.forEach((row) => {
    const place = String(row[placeColumnIndex] || "").trim();
    const normalizedPlace = normalizePlaceCode(place);

    if (!normalizedPlace) {
      return;
    }

    placeCounts.set(normalizedPlace, (placeCounts.get(normalizedPlace) || 0) + 1);

    if (!placeLabels.has(normalizedPlace)) {
      placeLabels.set(normalizedPlace, place);
    }
  });

  const duplicatePlaceCodes = new Set(
    [...placeCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([place]) => place)
  );
  const duplicatePlaces = [...duplicatePlaceCodes]
    .map((place) => placeLabels.get(place) || place)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "sv", { numeric: true, sensitivity: "base" }));

  return { duplicatePlaces, duplicatePlaceCodes };
}

export function hasDuplicatePlace(row, duplicatePlaceCodes, placeColumnIndex) {
  if (placeColumnIndex === null || duplicatePlaceCodes.size === 0) {
    return false;
  }

  return duplicatePlaceCodes.has(normalizePlaceCode(row[placeColumnIndex]));
}

export function getDuplicateMapPlaceRows(xml) {
  if (!xml) {
    return [];
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return [];
  }

  const placesByCode = new Map();

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const place = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");
    const normalizedPlace = normalizePlaceCode(place);

    if (!normalizedPlace) {
      return;
    }

    const entry = placesByCode.get(normalizedPlace) || { place, normalizedPlace, count: 0 };

    entry.count += 1;
    placesByCode.set(normalizedPlace, entry);
  });

  return [...placesByCode.values()]
    .filter((row) => row.count > 1)
    .sort((left, right) => String(left.place).localeCompare(String(right.place), "sv", { numeric: true, sensitivity: "base" }));
}

export function getEmptyMapPlaceRows(xml, rows, placeColumnIndex) {
  if (!xml || placeColumnIndex === null || rows.length === 0) {
    return [];
  }

  const occupiedPlaces = new Set(
    rows
      .map((row) => normalizePlaceCode(row[placeColumnIndex]))
      .filter(Boolean)
  );

  return getMapPlaces(xml)
    .filter((place) => !occupiedPlaces.has(place.normalizedPlace));
}

export function getMissingPeopleRows(xml, rows, { placeColumnIndex, firstNameColumnIndex, lastNameColumnIndex }) {
  if (!xml || placeColumnIndex === null || firstNameColumnIndex < 0 || lastNameColumnIndex < 0 || rows.length === 0) {
    return [];
  }

  const mapPlaces = getMapPlaceLabels(xml);

  return rows
    .map((row) => ({
      place: String(row[placeColumnIndex] || "").trim(),
      firstName: String(row[firstNameColumnIndex] || "").trim(),
      lastName: String(row[lastNameColumnIndex] || "").trim()
    }))
    .filter((row) => row.place && row.firstName && row.lastName && !mapPlaces.has(normalizePlaceCode(row.place)));
}
