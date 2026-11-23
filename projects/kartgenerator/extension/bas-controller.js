import { readBasPlaces } from "./bas-reader.js";
import { deliverBasPlaces } from "./map-delivery.js";

export const BAS_ORIGINS = ["https://bas.batunionen.se/*", "https://ledkarlsson.github.io/*"];
const basUrl = "https://bas.batunionen.se/BasK/Storage/StorageSearch";
const mapUrl = "https://ledkarlsson.github.io/projects/kartgenerator/";
const errors = {
  BAS_PERMISSION: "Aktivera BAS-kopplingen för att ge åtkomst till BAS och kartgeneratorn.",
  BAS_PAGE: "Öppna Platshantering → Platser i BAS och låt listan ladda klart.",
  BAS_LOADING: "BAS läser fortfarande listan. Försök igen när den är klar.",
  BAS_LAYOUT: "BAS-listans format kunde inte läsas säkert. Avsluta redigering, ta bort gruppering och visa standardkolumnerna.",
  BAS_INCOMPLETE: "Hela sökresultatet måste vara laddat på en sida. Begränsa sökningen i BAS och försök igen.",
  BAS_MULTIPLE: "Flera BAS-platslistor är öppna. Stäng de andra så att rätt klubb och urval används.",
  BAS_EXPIRED: "Förhandsgranskningen har gått ut. Läs BAS-listan igen.",
  BAS_SELECTION: "Välj minst ett av de inlästa områdena innan du skickar.",
  BAS_BUSY: "En BAS-åtgärd pågår redan.",
  MAP_PAGE: "Öppna kartgeneratorn på ledkarlsson.github.io/projects/kartgenerator/.",
  MAP_MULTIPLE: "Flera kartgeneratorflikar är öppna. Stäng de andra före överföringen.",
  MAP_RECEIVER: "Kartgeneratorns BAS-mottagning saknas eller avvisade datan. Publicera den uppdaterade kartgeneratorn och ladda om fliken.",
  BAS_FAILED: "Kunde inte slutföra BAS-kopplingen. Läs listan på nytt och försök igen."
};

export function createBasController(browser, now = Date.now) {
  let snapshot = null;
  let busy = false;
  function fail(code) { throw Object.assign(new Error(), { code }); }
  async function tabFor(kind) {
    const url = kind === "bas" ? basUrl : mapUrl;
    const tabs = (await browser.tabs.query({ url: kind === "bas" ? `${new URL(url).origin}/*` : `${new URL(url).origin}/projects/kartgenerator/*` })).filter(tab => {
      try {
        const candidate = new URL(tab.url);
        return !tab.incognito && Number.isInteger(tab.id) && candidate.origin === new URL(url).origin &&
          (kind === "bas" ? candidate.pathname === new URL(basUrl).pathname : [new URL(mapUrl).pathname, `${new URL(mapUrl).pathname}index.html`].includes(candidate.pathname));
      } catch { return false; }
    });
    if (tabs.length > 1) fail(kind === "bas" ? "BAS_MULTIPLE" : "MAP_MULTIPLE");
    if (!tabs.length) fail(kind === "bas" ? "BAS_PAGE" : "MAP_PAGE");
    return tabs[0];
  }
  async function execute(tab, func, args, world) {
    const result = (await browser.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world, func, args }))?.find(item => item.frameId === 0)?.result;
    if (!result?.ok) fail(result?.code ?? "BAS_FAILED");
    return result.data;
  }
  async function handle(message) {
    try {
      if (message.action === "bas-open") { await browser.tabs.create({ url: basUrl }); return { ok: true, data: {} }; }
      if (message.action === "map-open") { await browser.tabs.create({ url: mapUrl }); return { ok: true, data: {} }; }
      if (!["bas-read", "bas-send"].includes(message.action)) fail("BAS_FAILED");
      if (busy) fail("BAS_BUSY");
      busy = true;
      try {
        if (!await browser.permissions.contains({ origins: BAS_ORIGINS })) fail("BAS_PERMISSION");
        if (message.action === "bas-read") {
          snapshot = null;
          const data = await execute(await tabFor("bas"), readBasPlaces, [], "ISOLATED");
          const id = crypto.randomUUID();
          snapshot = { id, data, expires: now() + 5 * 60_000 };
          const areas = [...new Set(data.rows.map(row => row.area))].sort((a,b) => a.localeCompare(b,"sv"));
          return { ok: true, data: { id, club: data.club, capturedAt: data.capturedAt, areas: areas.map(area => ({ area, count: data.rows.filter(row => row.area === area).length })) } };
        }
        if (!snapshot || snapshot.id !== message.snapshotId || now() >= snapshot.expires) { snapshot = null; fail("BAS_EXPIRED"); }
        const areas = message.areas ?? [message.area];
        if (!Array.isArray(areas) || !areas.length || areas.length > 5000 ||
            !areas.every(area => typeof area === "string" && snapshot.data.rows.some(row => row.area === area))) fail("BAS_SELECTION");
        const selected = [...new Set(areas)];
        const rows = snapshot.data.rows.filter(row => selected.includes(row.area));
        const placeKey = row => JSON.stringify([row.area.trim().toUpperCase(), row.place.split(/[/(]/)[0].trim().toUpperCase()]);
        const places = new Map();
        for (const row of rows) {
          const place = row.place.split(/[/(]/)[0].trim();
          const key = placeKey(row);
          if (!places.has(key)) places.set(key, { area: row.area, place, names: [] });
          places.get(key).names.push(row.place);
        }
        const duplicates = [...places.values()].filter(group => group.names.length > 1);
        const skippedCount = duplicates.reduce((sum, group) => sum + group.names.length, 0);
        const uniqueRows = rows.filter(row => places.get(placeKey(row)).names.length === 1);
        const details = duplicates.map(group =>
            `• ${group.area} – plats ${group.place || "(tomt platsnamn)"} (${group.names.length} rader): ${group.names.map(name => JSON.stringify(name)).join(", ")}`
          ).join("\n");
        const warning = skippedCount ? `${skippedCount} rader hoppas över eftersom platsnamnen är lika före / eller (. Samtliga rader för dessa platser utesluts:\n\n${details}` : "";
        if (!uniqueRows.length) return { ok: true, data: { count: 0, skippedCount, warning } };
        const tab = await tabFor("map");
        await execute(tab, deliverBasPlaces, [], "MAIN");
        // Keep all selected areas so removing one area's duplicates cannot turn
        // another area's number into an unqualified single-area match.
        await execute(tab, deliverBasPlaces, [{ ...snapshot.data, version: 3, areas: selected, rows: uniqueRows,
          skippedPlaces: duplicates.map(({ area, place }) => ({ area, place })) }], "MAIN");
        snapshot = null;
        return { ok: true, data: { count: uniqueRows.length, skippedCount, warning } };
      } finally { busy = false; }
    } catch (error) {
      const code = Object.hasOwn(errors, error?.code) ? error.code : "BAS_FAILED";
      return { ok: false, error: { code, message: errors[code] } };
    }
  }
  return { handle };
}
