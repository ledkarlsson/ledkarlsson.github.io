import { drawioLabelToText, normalizePlaceCode } from "./kartgenerator-utils.js";

const fields = ["area", "place", "category", "firstName", "lastName", "boat", "width", "length", "boatWidth", "boatLength"];
export function validateBasPayload(input) {
  const text = (value, max = 500) => typeof value === "string" && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
  if (!input || input.version !== 1 || !text(input.club, 200) || !input.club.trim() || !text(input.area, 500) || !input.area.trim() ||
      typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) ||
      !Array.isArray(input.rows) || !input.rows.length || input.rows.length > 5000) throw new Error("Ogiltigt BAS-underlag.");
  const seen = new Set();
  const rows = input.rows.map(row => {
    if (!row || !fields.every(key => text(row[key])) || row.area !== input.area || !row.place.trim()) throw new Error("BAS-underlaget måste innehålla ett område och fullständiga platsrader.");
    const key = normalizePlaceCode(row.place);
    if (seen.has(key)) throw new Error("Flera BAS-rader har samma platsnamn. Begränsa urvalet före import.");
    seen.add(key);
    return Object.fromEntries(fields.map(key => [key, row[key].trim()]));
  });
  return { version: 1, club: input.club.trim(), area: input.area.trim(), capturedAt: input.capturedAt, rows };
}

export function basRowsToTable(payload) {
  const names = ["Område/Plats", "Förnamn", "Efternamn", "Område", "Områdeskategori", "Båtmodell", "Platsbredd", "Platslängd", "Båtbredd", "Båtlängd"];
  return {
    columns: names.map((name, index) => ({ name, index })),
    rows: payload.rows.map(row => {
      const values = [row.place, row.firstName, row.lastName, row.area, row.category, row.boat, row.width, row.length, row.boatWidth, row.boatLength];
      values.rawOmradePlats = row.area + " / " + row.place;
      return values;
    })
  };
}

// A map is bound to one club + area. No opaque detail URL is treated as a stable ID.
export function prepareBasMap(xml, payload) {
  if (!xml) return xml;
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const model = parsed.querySelector("mxGraphModel");
  if (parsed.querySelector("parsererror") || !model) throw new Error("Kartan kunde inte läsas.");
  const scope = JSON.stringify([payload.club, payload.area]);
  const previous = model.getAttribute("data-bas-scope");
  if (previous && previous !== scope) throw new Error("Kartan är kopplad till ett annat BAS-område eller en annan klubb. Öppna rätt karta eller rensa BAS-datan först.");
  model.setAttribute("data-bas-scope", scope);
  const places = new Map(payload.rows.map(row => [normalizePlaceCode(row.place), row.place]));
  parsed.querySelectorAll("mxCell[vertex='1']").forEach(cell => {
    const label = drawioLabelToText(cell.getAttribute("value"));
    const place = places.get(normalizePlaceCode(label));
    if (place) cell.setAttribute("data-bas-place", place);
  });
  return new XMLSerializer().serializeToString(parsed);
}

export function bindBasReceiver({ document: doc = document, onApply }) {
  const summary = doc.getElementById("bas-import-summary");
  const apply = doc.getElementById("bas-import-apply");
  const discard = doc.getElementById("bas-import-discard");
  let pending = null;
  function receive(event) {
    const detail = event.detail;
    if (!detail || typeof detail.requestId !== "string" || detail.requestId.length > 100) return;
    let ok = false;
    try {
      if (detail.operation === "ping") ok = true;
      if (detail.operation === "stage") {
        pending = validateBasPayload(detail.payload);
        summary.textContent = `${pending.club} · ${pending.area} · ${pending.rows.length} platser · hämtat ${new Date(pending.capturedAt).toLocaleString("sv-SE")}. Granska området innan du ersätter tidigare inläst data.`;
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
      summary.textContent = `${pending.club} · ${pending.area}: ${pending.rows.length} BAS-platser inlästa. Spara kartan via Ladda ner när du är klar.`;
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
