import { drawioLabelToText } from "./kartgenerator-utils.js";

export function readBasCellConflicts(cell) {
  try {
    const rows = JSON.parse(cell.getAttribute("data-bas-conflicts") || "[]");
    return Array.isArray(rows) && rows.length > 1 && rows.length <= 5000 && rows.every(row =>
      row && ["area", "place", "key"].every(key => typeof row[key] === "string" && row[key].length <= 1100)
    ) ? rows : [];
  } catch { return []; }
}

export function getBasMapConflicts(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  return [...doc.querySelectorAll("mxCell[vertex='1'][data-bas-conflicts]")].flatMap(cell => {
    const candidates = readBasCellConflicts(cell);
    return candidates.length ? [{
      place: cell.getAttribute("data-place-code") || drawioLabelToText(cell.getAttribute("value")).split("\n")[0],
      candidates
    }] : [];
  });
}

export function markBasConflict(cell) {
  if (!cell.hasAttribute("data-bas-conflict-style")) cell.setAttribute("data-bas-conflict-style", cell.getAttribute("style") || "");
  const parts = (cell.getAttribute("style") || "").split(";").filter(part => part && !/^(fillColor|strokeColor)=/.test(part));
  cell.setAttribute("style", [...parts, "fillColor=#f8cecc", "strokeColor=#b85450", ""].join(";"));
}

export function clearBasConflictHighlight(cell) {
  const original = cell.getAttribute("data-bas-conflict-style");
  if (original !== null) {
    cell.setAttribute("style", original);
    cell.removeAttribute("data-bas-conflict-style");
  }
}

export function highlightBasMapConflicts(xml) {
  if (!xml) return xml;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return xml;
  doc.querySelectorAll("mxCell[vertex='1']").forEach(cell => {
    if (readBasCellConflicts(cell).length) markBasConflict(cell);
  });
  return new XMLSerializer().serializeToString(doc);
}
