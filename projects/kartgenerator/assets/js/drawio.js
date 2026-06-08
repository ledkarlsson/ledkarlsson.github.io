import { drawioLabelToText, isPlaceBoxLabel, normalizePlaceCode } from "./kartgenerator-utils.js";

export function getMapPlaceLabels(xml) {
    if (!xml) {
        return new Set();
    }

    const parser = new DOMParser();
    const documentXml = parser.parseFromString(xml, "application/xml");

    if (documentXml.querySelector("parsererror")) {
        return new Set();
    }

    const labels = new Set();

    documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
        const label = drawioLabelToText(cell.getAttribute("value"));

        if (isPlaceBoxLabel(label)) {
            labels.add(normalizePlaceCode(label));
        }
    });

    return labels;
}