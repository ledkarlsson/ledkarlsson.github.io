import { matchAreaPatterns } from "./bas-selection.js";
const el = id => document.getElementById(id);
let preview = null;
let busy = false;
const controls = ["bas-read", "bas-send", "bas-open", "map-open", "bas-pattern", "bas-match", "bas-piers", "bas-yards", "bas-all", "bas-none"];
function selectedAreas() { return [...el("bas-areas").querySelectorAll("input:checked")].map(input => input.value); }
function updateSelection() {
  const selected = selectedAreas();
  const count = preview?.areas.filter(item => selected.includes(item.area)).reduce((sum, item) => sum + item.count, 0) ?? 0;
  el("bas-selection-summary").textContent = `${selected.length} områden · ${count} platser valda`;
  el("bas-send").disabled = busy || selected.length === 0;
}
function choose(pattern) {
  el("bas-pattern").value = pattern;
  const matches = matchAreaPatterns(preview?.areas.map(item => item.area) ?? [], pattern);
  for (const input of el("bas-areas").querySelectorAll("input")) input.checked = matches.includes(input.value);
  updateSelection();
}
el("bas-piers").addEventListener("click", () => choose("Brygga*"));
el("bas-yards").addEventListener("click", () => choose("Varvsområde*, Varvsplats*"));
el("bas-all").addEventListener("click", () => choose("*"));
el("bas-none").addEventListener("click", () => choose(""));
el("bas-match").addEventListener("click", () => choose(el("bas-pattern").value));
el("bas-pattern").addEventListener("keydown", event => { if (event.key === "Enter") choose(el("bas-pattern").value); });
function notice(text, error = false) {
  el("bas-notice").hidden = !text;
  el("bas-notice").textContent = text;
  el("bas-notice").classList.toggle("error", error);
}
async function send(action, extra = {}) {
  const result = await chrome.runtime.sendMessage({ action, ...extra });
  if (!result?.ok) throw new Error(result?.error?.message ?? "BAS-kopplingen svarade inte.");
  return result.data;
}
async function run(fn) {
  if (busy) return;
  busy = true;
  notice("");
  for (const id of controls) el(id).disabled = true;
  for (const input of el("bas-areas").querySelectorAll("input")) input.disabled = true;
  try { await fn(); } catch (error) { notice(error.message, true); }
  finally {
    busy = false;
    for (const id of controls) el(id).disabled = false;
    for (const input of el("bas-areas").querySelectorAll("input")) input.disabled = false;
    updateSelection();
  }
}
for (const action of ["bas-open", "map-open"]) el(action).addEventListener("click", () => run(() => send(action)));
el("bas-read").addEventListener("click", () => run(async () => {
  preview = null;
  el("bas-review").hidden = true;
  // Request inside the click gesture. Chrome prompts only for missing permissions.
  const allowed = await chrome.permissions.request({ origins: ["https://bas.batunionen.se/*", "https://ledkarlsson.github.io/*"] });
  if (!allowed) throw new Error("Åtkomst behövs till BAS och kartgeneratorn för att läsa och överföra platser.");
  preview = await send("bas-read");
  el("bas-summary").textContent = `${preview.club} · hämtad ${new Date(preview.capturedAt).toLocaleTimeString("sv-SE")}`;
  el("bas-areas").replaceChildren(...preview.areas.map(({ area, count }) => {
    const label = document.createElement("label");
    const input = document.createElement("input"); input.type = "checkbox"; input.value = area;
    input.addEventListener("change", updateSelection);
    label.append(input, document.createTextNode(`${area} · ${count} platser`));
    return label;
  }));
  choose("");
  el("bas-review").hidden = false;
}));
el("bas-send").addEventListener("click", () => run(async () => {
  if (!preview) throw new Error("Läs BAS-listan först.");
  const result = await send("bas-send", { snapshotId: preview.id, areas: selectedAreas() });
  if (!result.count) {
    notice(`Inga entydiga platser finns i urvalet. Inget har skickats och tidigare data i kartgeneratorn är kvar.\n\n${result.warning ?? ""}`);
    return;
  }
  preview = null;
  el("bas-review").hidden = true;
  notice(`Skickat till kartgeneratorn: ${result.count} BAS-platser.${result.warning ? `\n\n${result.warning}` : ""}`);
}));
