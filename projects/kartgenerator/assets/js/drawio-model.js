import { drawioLabelToText, isPlaceBoxLabel, normalizePlaceCode } from "./kartgenerator-utils.js";

export const newPlacePlaceholder = "ny plats";
export const newPlaceBoxStyle = "rounded=0;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;";

const mapPlaceMissingInExcelHighlight = {
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
    const shouldRemoveMapPlaceMissingInExcelHighlight = Boolean(placeCode) && hasMapPlaceMissingInExcelHighlight(cell);

    if (cell.getAttribute("data-kartgenerator-duplicate-highlight") === "duplicate-map-place" || shouldRemoveDuplicateMapPlaceHighlight) {
      removeDuplicateMapPlaceHighlight(cell);
    }

    if (cell.getAttribute("data-kartgenerator-highlight") === "missing-excel" || shouldRemoveMapPlaceMissingInExcelHighlight) {
      removeMapPlaceMissingInExcelHighlight(cell);
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

export function createDrawioXmlWithHighlightedMapPlacesMissingInExcel(xml, places) {
  if (!xml) {
    return xml;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const place = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");

    if (cell.getAttribute("data-kartgenerator-highlight") === "missing-excel" || hasMapPlaceMissingInExcelHighlight(cell)) {
      removeMapPlaceMissingInExcelHighlight(cell);
    }

    if (places.has(normalizePlaceCode(place))) {
      markCellAsMapPlaceMissingInExcel(cell, { temporary: true });
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

export function createDrawioXmlWithHighlightedDuplicatePlaces(xml, places) {
  if (!xml) {
    return xml;
  }

  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    return xml;
  }

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const place = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");

    if (cell.getAttribute("data-kartgenerator-duplicate-highlight") === "duplicate-map-place" || hasDuplicateMapPlaceHighlight(cell)) {
      removeDuplicateMapPlaceHighlight(cell);
    }

    if (places.has(normalizePlaceCode(place))) {
      markCellAsDuplicateMapPlace(cell, { temporary: true });
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function getCellGeometry(cell) {
  const geometry = [...cell.children].find((child) => child.tagName === "mxGeometry");

  if (!geometry) {
    return null;
  }

  const parsedGeometry = {
    x: Number(geometry.getAttribute("x") || 0),
    y: Number(geometry.getAttribute("y") || 0),
    width: Number(geometry.getAttribute("width") || 0),
    height: Number(geometry.getAttribute("height") || 0)
  };

  return Object.values(parsedGeometry).every(Number.isFinite) ? parsedGeometry : null;
}

function getNewBoxStartPosition(documentXml) {
  const placeCells = [];
  const generatedPlaceCells = [];
  const fallbackCells = [];

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const geometry = getCellGeometry(cell);

    if (!geometry) {
      return;
    }

    const placeCode = getPlaceCodeFromCellLabel(cell.getAttribute("value")) || cell.getAttribute("data-place-code");
    const cellInfo = {
      geometry,
      placeNumber: Number.parseInt(placeCode, 10),
      isGenerated: String(cell.getAttribute("id") || "").startsWith("kartgenerator-missing-")
    };

    if (placeCode) {
      placeCells.push(cellInfo);

      if (cellInfo.isGenerated) {
        generatedPlaceCells.push(cellInfo);
      }
    } else {
      fallbackCells.push(cellInfo);
    }
  });

  const bottomCell = (cells) => cells.reduce((bottomCellInfo, cellInfo) => {
    const bottomEdge = cellInfo.geometry.y + cellInfo.geometry.height;
    const currentBottomEdge = bottomCellInfo.geometry.y + bottomCellInfo.geometry.height;

    if (bottomEdge > currentBottomEdge) {
      return cellInfo;
    }

    if (bottomEdge === currentBottomEdge && cellInfo.geometry.x < bottomCellInfo.geometry.x) {
      return cellInfo;
    }

    return bottomCellInfo;
  }, cells[0]);

  if (generatedPlaceCells.length > 0) {
    const anchor = bottomCell(generatedPlaceCells).geometry;

    return {
      x: Math.round(anchor.x / 10) * 10,
      y: Math.ceil((anchor.y + anchor.height + 16) / 10) * 10
    };
  }

  const existingCells = placeCells.length > 0 ? placeCells : fallbackCells;

  if (existingCells.length === 0) {
    return { x: 0, y: 0 };
  }

  const anchor = existingCells.reduce((anchorCell, cellInfo) => {
    if (Number.isFinite(cellInfo.placeNumber) && Number.isFinite(anchorCell.placeNumber)) {
      return cellInfo.placeNumber > anchorCell.placeNumber ? cellInfo : anchorCell;
    }

    if (Number.isFinite(cellInfo.placeNumber)) {
      return cellInfo;
    }

    if (Number.isFinite(anchorCell.placeNumber)) {
      return anchorCell;
    }

    const rightEdge = cellInfo.geometry.x + cellInfo.geometry.width;
    const currentRightEdge = anchorCell.geometry.x + anchorCell.geometry.width;

    return rightEdge > currentRightEdge ? cellInfo : anchorCell;
  }, existingCells[0]).geometry;

  return {
    x: Math.ceil((anchor.x + anchor.width + 56) / 10) * 10,
    y: Math.round(anchor.y / 10) * 10
  };
}

function createAddedPlaceBoxId(place, index) {
  const normalizedPlace = normalizePlaceCode(place).replace(/[^a-z0-9_-]/gi, "-") || `plats-${index + 1}`;

  return `kartgenerator-missing-${Date.now()}-${index}-${normalizedPlace}`;
}

function createDrawioCell(documentXml, row, index, x, y) {
  const cell = documentXml.createElement("mxCell");
  const geometry = documentXml.createElement("mxGeometry");
  const isNewPlacePlaceholder = row.isNewPlacePlaceholder === true;

  cell.setAttribute("id", createAddedPlaceBoxId(row.place, index));
  cell.setAttribute("value", row.place);
  cell.setAttribute("style", isNewPlacePlaceholder ? newPlaceBoxStyle : "rounded=0;whiteSpace=wrap;html=1;");
  cell.setAttribute("vertex", "1");
  cell.setAttribute("parent", "1");

  if (isNewPlacePlaceholder) {
    cell.setAttribute("data-kartgenerator-placeholder", "new-place");
  }

  geometry.setAttribute("x", String(x));
  geometry.setAttribute("y", String(y));
  geometry.setAttribute("width", "120");
  geometry.setAttribute("height", "40");
  geometry.setAttribute("as", "geometry");

  cell.append(geometry);

  return cell;
}

export function createDrawioXmlWithAddedPlaceBoxes(xml, rows) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    throw new Error("Kunde inte tolka kartfilen.");
  }

  const root = documentXml.querySelector("mxGraphModel > root");

  if (!root) {
    throw new Error("Kunde inte hitta kartans innehåll.");
  }

  const startPosition = getNewBoxStartPosition(documentXml);

  rows.forEach((row, index) => {
    root.append(createDrawioCell(documentXml, row, index, startPosition.x, startPosition.y + index * 56));
  });

  return new XMLSerializer().serializeToString(documentXml);
}

export function makeDrawioLabel(row, options) {
  const shouldCombineName = options.selectedColumnIndexes.includes(options.firstNameColumnIndex)
    && options.selectedColumnIndexes.includes(options.lastNameColumnIndex);
  const lines = [];

  options.selectedColumnIndexes.forEach((columnIndex) => {
    const value = row[columnIndex];

    if (value === null || value === undefined || String(value).trim() === "") {
      return;
    }

    if (columnIndex === options.placeColumnIndex) {
      if (options.showPlaceNumber) {
        lines.push(String(value).trim());
      }
      return;
    }

    if (shouldCombineName && columnIndex === options.firstNameColumnIndex) {
      const firstName = String(value).trim();
      const lastName = row[options.lastNameColumnIndex] === null || row[options.lastNameColumnIndex] === undefined
        ? ""
        : String(row[options.lastNameColumnIndex]).trim();
      const fullName = `${firstName} ${lastName}`.trim();

      lines.push(options.showColumnNames ? `Namn: ${fullName}` : fullName);
      return;
    }

    if (shouldCombineName && columnIndex === options.lastNameColumnIndex) {
      return;
    }

    lines.push(options.showColumnNames
      ? `${options.columns[columnIndex].name}: ${String(value).trim()}`
      : String(value).trim());
  });

  return lines.join("<br>");
}

export function createGeneratedDrawioXml(xml, rows, options) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");

  if (documentXml.querySelector("parsererror")) {
    throw new Error("Kunde inte tolka kartfilen.");
  }

  const rowsByPlace = new Map();

  rows.forEach((row) => {
    const place = String(row[options.placeColumnIndex] || "").trim();
    const normalizedPlace = normalizePlaceCode(place);

    if (normalizedPlace) {
      rowsByPlace.set(normalizedPlace, row);
    }
  });

  documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
    const label = drawioLabelToText(cell.getAttribute("value"));

    if (!isPlaceBoxLabel(label)) {
      return;
    }

    const row = rowsByPlace.get(normalizePlaceCode(label));

    cell.setAttribute("data-place-code", label);

    if (row) {
      const generatedLabel = options.isEmptyRow(row) ? "" : makeDrawioLabel(row, options.labelOptions);
      cell.setAttribute("value", generatedLabel || `${label}<br>Ledig plats`);
    } else if (label) {
      cell.setAttribute("value", `${label}<br>Ledig plats`);
      markCellAsMapPlaceMissingInExcel(cell);
    }
  });

  return new XMLSerializer().serializeToString(documentXml);
}

function hasMapPlaceMissingInExcelHighlight(cell) {
  return hasCellHighlight(cell, mapPlaceMissingInExcelHighlight);
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

function removeMapPlaceMissingInExcelHighlight(cell) {
  const originalStyle = cell.getAttribute("data-kartgenerator-original-style");

  cell.removeAttribute("data-kartgenerator-highlight");
  cell.removeAttribute("data-kartgenerator-original-style");

  if (originalStyle !== null) {
    cell.setAttribute("style", originalStyle);
    return;
  }

  cell.setAttribute("style", `${getCellStyleWithoutColor(cell).join(";")};`);
}

export function markCellAsMapPlaceMissingInExcel(cell, options = {}) {
  const styleParts = getCellStyleWithoutColor(cell);

  styleParts.push(
    `fillColor=${mapPlaceMissingInExcelHighlight.fill}`,
    `strokeColor=${mapPlaceMissingInExcelHighlight.stroke}`
  );

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
