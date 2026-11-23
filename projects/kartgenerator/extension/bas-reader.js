// Runs in BAS's isolated world. Reads rendered cells only; no cookies or requests.
export function readBasPlaces() {
  const fail = code => ({ ok: false, code });
  if (location.origin !== "https://bas.batunionen.se" || location.pathname !== "/BasK/Storage/StorageSearch") return fail("BAS_PAGE");
  const grid = document.querySelector("#StorageListGrid");
  if (!grid) return fail("BAS_PAGE");
  if ([...grid.querySelectorAll(".k-loading-mask")].some(el => el.getClientRects().length)) return fail("BAS_LOADING");
  if (grid.querySelector(".k-grouping-row, .k-detail-row, input, textarea")) return fail("BAS_LAYOUT");
  const fields = [...grid.querySelectorAll("thead th")].map(el => el.getAttribute("data-field"));
  const required = ["PlaceName", "StorageName", "AreaType", "FirstName", "LastName", "BrandName", "Width", "Length", "BoatWidth", "BoatLength"];
  if (!required.every(field => fields.filter(x => x === field).length === 1)) return fail("BAS_LAYOUT");
  const trs = [...grid.querySelectorAll("tbody tr[data-uid]")];
  const pager = grid.querySelector(".k-pager-info")?.textContent?.replace(/[\u00a0\u202f]/g, " ").trim() ?? "";
  const match = pager.match(/^([\d ]+)\s*[-–]\s*([\d ]+)\s+av\s+([\d ]+)\s+poster$/i);
  if (!match) return fail("BAS_INCOMPLETE");
  const [start, end, total] = match.slice(1).map(x => Number(x.replaceAll(" ", "")));
  if (start !== 1 || end !== total || total !== trs.length || total < 1 || total > 5000) return fail("BAS_INCOMPLETE");
  const clubLabel = [...document.querySelectorAll("span.bas-link")].find(el => [...el.children].some(child => child.textContent.trim() === "BAS-K"));
  const club = clubLabel ? [...clubLabel.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join("").trim() : "";
  if (!club || club.length > 200) return fail("BAS_LAYOUT");
  const rows = [];
  for (const tr of trs) {
    if (tr.cells.length !== fields.length) return fail("BAS_LAYOUT");
    const read = field => tr.cells[fields.indexOf(field)].textContent.trim();
    const values = required.map(read);
    if (values.some(value => value.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))) return fail("BAS_LAYOUT");
    const [area, place, category, firstName, lastName, boat, width, length, boatWidth, boatLength] = values;
    if (!area || !place) return fail("BAS_LAYOUT");
    // BAS appends a membership number to LastName. It is unnecessary for the map.
    rows.push({ area, place, category, firstName, lastName: lastName.replace(/\s*\(\s*\d+\s*\)\s*$/, ""), boat, width, length, boatWidth, boatLength });
  }
  return { ok: true, data: { version: 1, club, capturedAt: new Date().toISOString(), rows } };
}
