import { drawioLabelToText, isPlaceBoxLabel, normalizePlaceCode } from "./kartgenerator-utils.js";

function getPlaceLabelFromCell(cell) {
    const text = drawioLabelToText(cell.getAttribute("value"));
    const [firstLine] = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return firstLine && isPlaceBoxLabel(firstLine) ? firstLine : "";
}

export function getMapPlaces(xml) {
    if (!xml) {
        return [];
    }

    const parser = new DOMParser();
    const documentXml = parser.parseFromString(xml, "application/xml");

    if (documentXml.querySelector("parsererror")) {
        return [];
    }

    const placesByKey = new Map();

    documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
        const label = getPlaceLabelFromCell(cell);

        if (label) {
            placesByKey.set(normalizePlaceCode(label), {
                place: label,
                normalizedPlace: normalizePlaceCode(label)
            });
        }
    });

    return [...placesByKey.values()];
}

export function getMapPlaceLabels(xml) {
    return new Set(getMapPlaces(xml).map((place) => place.normalizedPlace));
}
