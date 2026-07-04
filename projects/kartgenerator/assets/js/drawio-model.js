import { drawioLabelToText, isPlaceBoxLabel, normalizePlaceCode } from "./kartgenerator-utils.js";

export const newPlacePlaceholder = "ny plats";
export const newPlaceBoxStyle = "rounded=0;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;";

const missingExcelHighlight = {
  fill: "#fff2cc",
  stroke: "#d6b656"
};
const duplicateMapPlaceHighlight = {
  fill: "#dae8fc",
  stroke: "#6c8ebf"
};

function getCellStyleWithoutColor(cell) {
  const style = cell.getAttribute("style") || "";
  return style
    .split(";")
    .filter((part) => part && !part.startsWith("fillColor=") && !part.startsWith("strokeColor="));
}

export function removeNewPlacePlaceholder(cell) {
  cell.removeAttribute("data-kartgenerator-placeholder");
  cell.setAttribute("style", `${getCellStyleWithoutColor(cell).join(";")};`);
}

export function getPlaceCodeFromCellLabel(label) {
  const text = drawioLabelToText(label);
  const [firstLine] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return firstLine && isPlaceBoxLabel(firstLine) ? firstLine : "";
}

export function createCleanDrawioXml(xml) {
  if (!xml) {
    return "";
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    if (
      cell.getAttribute("data-kartgenerator-placeholder") === "new-place"
      && drawioLabelToText(cell.getAttribute("value")).toLowerCase() !== newPlacePlaceholder
    ) {
      removeNewPlacePlaceholder(cell);
    }

    const placeCode = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");
    const shouldRemoveDuplicateMapPlaceHighlight = Boolean(placeCode) && hasDuplicateMapPlaceHighlight(cell);
    const shouldRemoveMissingExcelHighlight = Boolean(placeCode) && hasMissingExcelHighlight(cell);

    if (cell.getAttribute("data-kartgenerator-duplicate-highlight") === "duplicate-map-place" || shouldRemoveDuplicateMapPlaceHighlight) {
      removeDuplicateMapPlaceHighlight(cell);
    }

    if (cell.getAttribute("data-kartgenerator-highlight") === "missing-excel" || shouldRemoveMissingExcelHighlight) {
      removeMissingExcelHighlight(cell);
    }

    if (placeCode) {
      cell.setAttribute("value", placeCode);
      cell.removeAttribute("data-place-code");
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

export function hasRenamedNewPlacePlaceholder(xml) {
  if (!xml) {
    return false;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return false;
  }

  return [...documentXml.querySelectorAll("mxCell[data-kartgenerator-placeholder='new-place']")]
    .some((cell) => drawioLabelToText(cell.getAttribute("value")).toLowerCase() !== newPlacePlaceholder);
}

export function createDrawioXmlWithHighlightedPlaces(xml, places) {
  if (!xml || places.size === 0) {
    return xml;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const label = drawioLabelToText(cell.getAttribute("value"));

    if (places.has(normalizePlaceCode(label))) {
      markCellAsMissingExcelPlace(cell, { temporary: true });
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

export function createDrawioXmlWithHighlightedDuplicatePlaces(xml, places) {
  if (!xml || places.size === 0) {
    return xml;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const label = drawioLabelToText(cell.getAttribute("value"));

    if (places.has(normalizePlaceCode(label))) {
      markCellAsDuplicateMapPlace(cell, { temporary: true });
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function hasMissingExcelHighlight(cell) {
  return hasCellHighlight(cell, missingExcelHighlight);
}

function hasDuplicateMapPlaceHighlight(cell) {
  return hasCellHighlight(cell, duplicateMapPlaceHighlight);
}

function hasCellHighlight(cell, highlight) {
  const style = cell.getAttribute("style") || "";
  const fillPattern = new RegExp(`(?:^|;)fillColor=${highlight.fill}(?:;|$)`, "i");
  const strokePattern = new RegExp(`(?:^|;)strokeColor=${highlight.stroke}(?:;|$)`, "i");

  return fillPattern.test(style) && strokePattern.test(style);
}

function removeMissingExcelHighlight(cell) {
  const originalStyle = cell.getAttribute("data-kartgenerator-original-style");

  cell.removeAttribute("data-kartgenerator-highlight");
  cell.removeAttribute("data-kartgenerator-original-style");

  if (originalStyle !== null) {
    cell.setAttribute("style", originalStyle);
    return;
  }

  cell.setAttribute("style", `${getCellStyleWithoutColor(cell).join(";")};`);
}

export function markCellAsMissingExcelPlace(cell, options = {}) {
  const styleParts = getCellStyleWithoutColor(cell);

  styleParts.push(`fillColor=${missingExcelHighlight.fill}`, `strokeColor=${missingExcelHighlight.stroke}`);

  if (options.temporary) {
    cell.setAttribute("data-kartgenerator-highlight", "missing-excel");
    if (!cell.hasAttribute("data-kartgenerator-original-style")) {
      cell.setAttribute("data-kartgenerator-original-style", cell.getAttribute("style") || "");
    }
  }

  cell.setAttribute("style", `${styleParts.join(";")};`);
}

function removeDuplicateMapPlaceHighlight(cell) {
  const originalStyle = cell.getAttribute("data-kartgenerator-original-style");

  cell.removeAttribute("data-kartgenerator-duplicate-highlight");
  cell.removeAttribute("data-kartgenerator-original-style");

  if (originalStyle !== null) {
    cell.setAttribute("style", originalStyle);
    return;
  }

  cell.setAttribute("style", `${getCellStyleWithoutColor(cell).join(";")};`);
}

function markCellAsDuplicateMapPlace(cell, options = {}) {
  const styleParts = getCellStyleWithoutColor(cell);

  styleParts.push(`fillColor=${duplicateMapPlaceHighlight.fill}`, `strokeColor=${duplicateMapPlaceHighlight.stroke}`);

  if (options.temporary) {
    cell.setAttribute("data-kartgenerator-duplicate-highlight", "duplicate-map-place");
    if (!cell.hasAttribute("data-kartgenerator-original-style")) {
      cell.setAttribute("data-kartgenerator-original-style", cell.getAttribute("style") || "");
    }
  }

  cell.setAttribute("style", `${styleParts.join(";")};`);
}
