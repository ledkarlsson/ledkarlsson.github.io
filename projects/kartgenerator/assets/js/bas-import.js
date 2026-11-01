import { basPlaceName, drawioLabelToText, normalizePlaceCode } from "./kartgenerator-utils.js";

const fields = ["area", "place", "category", "firstName", "lastName", "boat", "width", "length", "boatWidth", "boatLength"];
const areasOf = payload => payload.version === 1 ? [payload.area] : payload.areas;
const qualified = row => `${row.area} / ${basPlaceName(row.place)}`;
const keyOf = (row, payload) => areasOf(payload).length > 1 ? qualified(row) : basPlaceName(row.place);
const identity = row => JSON.stringify([normalizePlaceCode(row.area), normalizePlaceCode(basPlaceName(row.place))]);

export function validateBasPayload(input) {
  const text = (value, max = 500) => typeof value === "string" && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
  if (!input || ![1, 2, 3].includes(input.version) || !text(input.club, 200) || !input.club.trim() ||
      typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) ||
      !Array.isArray(input.rows) || !input.rows.length || input.rows.length > 5000) throw new Error("Ogiltigt BAS-underlag.");
  const supplied = areasOf(input);
  if (!Array.isArray(supplied) || !supplied.length || supplied.length > 5000 || !supplied.every(area => text(area) && area.trim())) throw new Error("Ogiltiga BAS-områden.");
  const areas = supplied.map(area => area.trim());
  if (new Set(areas.map(normalizePlaceCode)).size !== areas.length) throw new Error("Dubbla BAS-områden.");
  const seen = new Set();
  const rows = input.rows.map(row => {
    if (!row || !fields.every(key => text(row[key])) || !areas.includes(row.area.trim()) || !basPlaceName(row.place)) throw new Error("BAS-underlaget måste innehålla valda områden och fullständiga platsrader.");
    const key = identity(row);
    if (seen.has(key)) throw new Error("Flera BAS-rader har samma platsnamn före / eller ( inom ett område. Begränsa urvalet före import.");
    seen.add(key);
    return Object.fromEntries(fields.map(key => [key, row[key].trim()]));
  });
  const skippedInput = input.skippedPlaces ?? [];
  if (!Array.isArray(skippedInput) || skippedInput.length > 5000) throw new Error("Ogiltiga överhoppade BAS-platser.");
  const skippedPlaces = skippedInput.map(row => {
    if (!row || !text(row.area) || !text(row.place) || !areas.includes(row.area.trim())) throw new Error("Ogiltig överhoppad BAS-plats.");
    const key = identity(row);
    if (seen.has(key)) throw new Error("En BAS-plats kan inte både importeras och hoppas över.");
    seen.add(key);
    return {area:row.area.trim(),place:basPlaceName(row.place)};
  });
  const representedAreas = new Set([...rows, ...skippedPlaces].map(row => row.area));
  if (areas.some(area => !representedAreas.has(area))) throw new Error("Ett valt BAS-område saknar rader.");
  if (new Set([...rows, ...skippedPlaces].map(row => normalizePlaceCode(qualified(row)))).size !== rows.length + skippedPlaces.length) throw new Error("Områdes- och platsnamn ger tvetydiga kartetiketter.");
  return { version: input.version, club: input.club.trim(), ...(input.version === 1 ? {area: areas[0]} : {}), areas, capturedAt: input.capturedAt, rows, skippedPlaces };
}

export function basRowsToTable(payload) {
  const names = ["Område/Plats", "Förnamn", "Efternamn", "Område", "Områdeskategori", "Båtmodell", "Platsbredd", "Platslängd", "Båtbredd", "Båtlängd"];
  return {
    columns: names.map((name, index) => ({ name, index })),
    rows: payload.rows.map(row => {
      const values = [keyOf(row, payload), row.firstName, row.lastName, row.area, row.category, row.boat, row.width, row.length, row.boatWidth, row.boatLength];
      values.rawOmradePlats = `${row.area} / ${row.place}`;
      return values;
    })
  };
}

// Names identify rows within a club and area; they are not stable BAS IDs.
export function prepareBasMap(xml, payload) {
  if (!xml) return xml;
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const model = parsed.querySelector("mxGraphModel");
  if (parsed.querySelector("parsererror") || !model) throw new Error("Kartan kunde inte läsas.");
  const areas = areasOf(payload);
  const previous = model.getAttribute("data-bas-scope");
  let previousAreas = [];
  if (previous) {
    let scope;
    try { scope = JSON.parse(previous); } catch { throw new Error("Ogiltig BAS-koppling i kartan."); }
    previousAreas = Array.isArray(scope?.[1]) ? scope[1] : [scope?.[1]];
    if (scope?.[0] !== payload.club || !previousAreas.some(area => areas.includes(area))) throw new Error("Kartan är kopplad till ett annat BAS-område eller en annan klubb. Öppna rätt karta.");
  }
  model.setAttribute("data-bas-scope", JSON.stringify([payload.club, areas]));
  const rowsByIdentity = new Map(payload.rows.map(row => [identity(row), row]));
  const candidates = new Map();
  for (const row of [...payload.rows, ...(payload.skippedPlaces ?? []).map(row => ({...row, skipped:true}))]) for (const name of new Set([basPlaceName(row.place), qualified(row)])) {
    const key = normalizePlaceCode(name);
    candidates.set(key, [...(candidates.get(key) ?? []), row]);
  }
  // Recognize the area separator before stripping a place comment. Longest
  // area first also supports area names that themselves contain a slash.
  const labelAreas = [...new Set([...areas, ...previousAreas])].sort((a,b) => b.length - a.length);
  function labelKey(label) {
    const normalized = normalizePlaceCode(label);
    for (const area of labelAreas) {
      const prefix = normalizePlaceCode(area);
      if (!normalized.startsWith(prefix)) continue;
      const remainder = label.slice(area.length).trimStart();
      if (remainder.startsWith("/")) return normalizePlaceCode(qualified({area,place:remainder.slice(1)}));
    }
    return normalizePlaceCode(basPlaceName(label));
  }
  parsed.querySelectorAll("mxCell[vertex='1']").forEach(cell => {
    const label = drawioLabelToText(cell.getAttribute("value"));
    let savedArea = cell.getAttribute("data-bas-area");
    let savedName = cell.getAttribute("data-bas-name");
    let savedLabel = cell.getAttribute("data-bas-label");
    if (!savedArea && cell.hasAttribute("data-bas-place") && previousAreas.length === 1) {
      savedArea = previousAreas[0]; savedName = cell.getAttribute("data-bas-place"); savedLabel = savedName;
    }
    let row;
    if (savedArea && savedLabel === label) {
      row = rowsByIdentity.get(identity({area:savedArea, place:savedName}));
      if (!row) {
        cell.setAttribute("data-bas-area", savedArea);
        cell.setAttribute("data-bas-name", savedName);
        cell.setAttribute("data-bas-label", label);
        cell.setAttribute("data-bas-place", qualified({area:savedArea, place:savedName}));
        return; // Never assign an absent saved place to another area's number.
      }
    } else {
      const matches = [...new Set(candidates.get(labelKey(label)) ?? [])];
      if (matches.some(match => match.skipped)) {
        // An unbound label touching an omitted duplicate must not fall through
        // to a retained place with the same number in another area.
        cell.setAttribute("data-bas-place", labelKey(label));
        for (const name of ["area", "name", "label"]) cell.removeAttribute(`data-bas-${name}`);
        return;
      }
      if (matches.length > 1) throw new Error(`Platsen ”${label}” finns i flera områden. Ange område i kartans ruta, exempelvis ”${qualified(matches[0])}”.`);
      row = matches[0];
    }
    if (row) {
      cell.setAttribute("data-bas-place", keyOf(row, payload));
      cell.setAttribute("data-bas-area", row.area);
      cell.setAttribute("data-bas-name", row.place);
      cell.setAttribute("data-bas-label", label);
    } else {
      for (const name of ["place", "area", "name", "label"]) cell.removeAttribute(`data-bas-${name}`);
    }
  });
  return new XMLSerializer().serializeToString(parsed);
}

export function bindBasReceiver({ document: doc = document, onApply }) {
  const summary = doc.getElementById("bas-import-summary");
  const apply = doc.getElementById("bas-import-apply");
  const discard = doc.getElementById("bas-import-discard");
  let pending = null;
  const skippedNotice = data => data.skippedPlaces.length ? " Överhoppade dubblettplatser: " + data.skippedPlaces.map(qualified).join(", ") + "." : "";
  function receive(event) {
    const detail = event.detail;
    if (!detail || typeof detail.requestId !== "string" || detail.requestId.length > 100) return;
    let ok = false;
    try {
      if (detail.operation === "ping") ok = true;
      if (detail.operation === "stage") {
        pending = validateBasPayload(detail.payload);
        summary.textContent = `${pending.club} · ${pending.areas.join(", ")} · ${pending.rows.length} platser · hämtat ${new Date(pending.capturedAt).toLocaleString("sv-SE")}. Granska områdena innan du ersätter tidigare inläst data.${skippedNotice(pending)}`;
        apply.hidden = false;
        discard.hidden = false;
        ok = true;
      }
    } catch { /* Invalid messages cannot replace current data or leak their contents. */ }
    doc.dispatchEvent(new CustomEvent("koppla:bas:reply", { detail: { requestId: detail.requestId, ok } }));
  }
  function clearPending() { pending = null; apply.hidden = true; discard.hidden = true; }
  function applyPending() {
    if (!pending) return;
    try {
      onApply(pending);
      summary.textContent = `${pending.club} · ${pending.areas.join(", ")}: ${pending.rows.length} BAS-platser inlästa. Spara kartan via Ladda ner när du är klar.${skippedNotice(pending)}`;
      clearPending();
    } catch (error) { summary.textContent = error.message; }
  }
  function discardPending() { clearPending(); summary.textContent = "BAS-underlaget har kastats. Tidigare inläst data är kvar."; }
  doc.addEventListener("koppla:bas:request", receive);
  apply.addEventListener("click", applyPending);
  discard.addEventListener("click", discardPending);
  return () => {
    clearPending();
    doc.removeEventListener("koppla:bas:request", receive);
    apply.removeEventListener("click", applyPending);
    discard.removeEventListener("click", discardPending);
  };
}
