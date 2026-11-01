import { describe, it, expect, vi, afterEach } from "vitest";
import { validateBasPayload, basRowsToTable, prepareBasMap, bindBasReceiver } from "../assets/js/bas-import.js";
import { createGeneratedDrawioXml, createCleanDrawioXml, makeDrawioLabel } from "../assets/js/drawio-model.js";
import { getMapPlaceLabels } from "../assets/js/drawio.js";
import { handleDrawioMessage } from "../assets/js/drawio-embed.js";

const row = (place = "71-73/1") => ({ area: "Brygga A", place, category: "Sommar", firstName: "Test", lastName: "Person", boat: "Testbåt", width: "3,00", length: "8,00", boatWidth: "2,50", boatLength: "7,00" });
const payload = () => ({ version: 1, club: "Testklubb", area: "Brygga A", capturedAt: "2026-11-01T12:00:00Z", rows: [row()] });
const xml = '<mxGraphModel><root><mxCell id="1" vertex="1" value="71-73/1"/><mxCell id="2" vertex="1" value="99"/></root></mxGraphModel>';
const labelOptions = { columns:[{name:'Plats'},{name:'Förnamn'},{name:'Efternamn'}],selectedColumnIndexes:[0,1,2],placeColumnIndex:0,firstNameColumnIndex:1,lastNameColumnIndex:2,showPlaceNumber:true,showColumnNames:false };

describe("BAS import contract", () => {
  it("preserves complete names and discards unapproved fields", () => {
    const input = payload(); input.cookie = "secret"; input.rows[0].email = "secret";
    const safe = validateBasPayload(input);
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(basRowsToTable(safe).rows[0][0]).toBe("71-73/1");
  });
  it("rejects mixed areas, duplicates, invalid dates, oversized values and empty payloads", () => {
    const cases = [null, {}, { ...payload(), rows: [] }, {...payload(),capturedAt:'invalid'}, {...payload(),rows:[row(),row()]}, {...payload(),rows:[{...row(),area:'B'}]}, {...payload(),rows:[{...row(),firstName:'a'.repeat(501)}]}];
    for (const input of cases) expect(() => validateBasPayload(input)).toThrow();
  });
  it("binds one club and area and refuses to silently switch a saved map", () => {
    const bound = prepareBasMap(xml,payload());
    expect(() => prepareBasMap(bound,{...payload(),area:'Brygga B'})).toThrow(/annat BAS/);
    expect(() => prepareBasMap(bound,{...payload(),club:'Annan klubb'})).toThrow(/annat BAS/);
    expect(prepareBasMap(bound,payload())).toContain('data-bas-scope');
  });
  it("maps slash names, preserves them through cleaning, and labels missing data honestly", () => {
    const bound = prepareBasMap(xml,payload());
    expect(getMapPlaceLabels(bound).has('71-73/1')).toBe(true);
    const generated = createGeneratedDrawioXml(bound,basRowsToTable(payload()).rows,{placeColumnIndex:0,isEmptyRow:()=>false,labelOptions,basSource:payload()});
    const doc = new DOMParser().parseFromString(generated,'application/xml');
    expect(doc.querySelector('[id="1"]').getAttribute('value')).toContain('Test Person');
    expect(doc.querySelector('[id="2"]').getAttribute('value')).toContain('Saknas i BAS-urvalet');
    const clean = createCleanDrawioXml(generated);
    expect(clean).toContain('value="71-73/1"');expect(clean).toContain('data-bas-scope');expect(clean).not.toContain('Test Person');
  });
  it("does not interpret imported names as HTML", () => {
    const label=makeDrawioLabel(['12','<img src=x onerror=alert(1)>','A&B'],labelOptions);
    expect(label).not.toContain('<img');expect(label).toContain('&lt;img');expect(label).toContain('A&amp;B');
  });
});

describe("BAS receiver", () => {
  let dispose;
  afterEach(()=>{dispose?.();document.body.replaceChildren();});
  function setup() {
    document.body.innerHTML='<p id="bas-import-summary"></p><button id="bas-import-apply" hidden>Use</button><button id="bas-import-discard" hidden>Discard</button>';
    const onApply=vi.fn();dispose=bindBasReceiver({onApply});return onApply;
  }
  function request(data,operation='stage') {
    let reply;const listen=e=>{reply=e.detail;};document.addEventListener('koppla:bas:reply',listen);
    document.dispatchEvent(new CustomEvent('koppla:bas:request',{detail:{requestId:'test',operation,payload:data}}));
    document.removeEventListener('koppla:bas:reply',listen);return reply;
  }
  it("acknowledges readiness and stages without replacing data until the user applies", () => {
    const onApply=setup();expect(request(null,'ping').ok).toBe(true);
    expect(request(payload()).ok).toBe(true);expect(onApply).not.toHaveBeenCalled();
    expect(document.getElementById('bas-import-apply').hidden).toBe(false);
    document.getElementById('bas-import-apply').click();expect(onApply).toHaveBeenCalledOnce();
    document.getElementById('bas-import-apply').click();expect(onApply).toHaveBeenCalledOnce();
  });
  it("rejects bad payloads without losing a pending valid import", () => {
    const onApply=setup();request(payload());expect(request({cookie:'secret'}).ok).toBe(false);
    document.getElementById('bas-import-apply').click();expect(onApply).toHaveBeenCalledOnce();
  });
  it("discard keeps the current data and drops the pending snapshot", () => {
    const onApply=setup();request(payload());document.getElementById('bas-import-discard').click();
    document.getElementById('bas-import-apply').click();expect(onApply).not.toHaveBeenCalled();
  });
  it("renders payload labels as text, never executable markup", () => {
    setup();request({...payload(),club:'<img src=x onerror=alert(1)>'});
    expect(document.querySelector('img')).toBeNull();expect(document.body.textContent).toContain('<img');
  });
});

it("rejects diagrams.net lookalike origins even with the right source window", () => {
  const frame={contentWindow:{}};
  expect(handleDrawioMessage({origin:'https://embed.diagrams.net.evil.test',source:frame.contentWindow,data:'{}'},{frame})).toBe(false);
});

it("preserves a manual rename in a clean BAS map", () => {
  const bound = prepareBasMap(xml,payload());
  const doc = new DOMParser().parseFromString(bound,'application/xml');
  doc.querySelector('[id="1"]').setAttribute('value','71-73/2');
  const clean = createCleanDrawioXml(new XMLSerializer().serializeToString(doc));
  expect(clean).toContain('value="71-73/2"');
  expect(clean).toContain('data-bas-place="71-73/2"');
});
