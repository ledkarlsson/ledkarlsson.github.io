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
    expect(safe.rows[0].place).toBe("71-73/1");
    expect(basRowsToTable(safe).rows[0][0]).toBe("71-73");
    expect(basRowsToTable(safe).rows[0].rawOmradePlats).toBe("Brygga A / 71-73/1");
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
    expect(getMapPlaceLabels(bound).has('71-73')).toBe(true);
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
  expect(prepareBasMap(clean,{...payload(),rows:[row('71-73/2')]})).toContain('data-bas-place="71-73"');
});

describe('multiple BAS areas', () => {
  const multi = () => validateBasPayload({version:2,club:'Testklubb',areas:['Brygga A','Brygga B'],capturedAt:payload().capturedAt,rows:[row('12'),{...row('12'),area:'Brygga B',firstName:'Other'}]});
  const map = (...labels) => `<mxGraphModel><root>${labels.map((label,i)=>`<mxCell id="${i}" vertex="1" value="${label}"/>`).join('')}</root></mxGraphModel>`;
  const generate = (xml,data) => createGeneratedDrawioXml(xml,basRowsToTable(data).rows,{placeColumnIndex:0,isEmptyRow:()=>false,labelOptions,basSource:data});
  it('qualifies identical place numbers and rejects duplicate identities or unlisted areas', () => {
    const data=multi();
    expect(basRowsToTable(data).rows.map(row=>row[0])).toEqual(['Brygga A / 12','Brygga B / 12']);
    expect(()=>validateBasPayload({...data,rows:[...data.rows,data.rows[0]]})).toThrow(/samma platsnamn/);
    expect(()=>validateBasPayload({...data,areas:['Brygga A']})).toThrow();
    expect(()=>validateBasPayload({...data,areas:['Brygga A','Brygga B','C']})).toThrow();
    expect(()=>validateBasPayload({...data,areas:['Brygga A','brygga a']})).toThrow();
  });
  it('rejects ambiguous bare labels before changing the map; qualified labels select the right person', () => {
    const data=multi();
    expect(()=>prepareBasMap(map('12'),data)).toThrow(/flera områden/);
    const bound=prepareBasMap(map('Brygga A / 12','Brygga B / 12'),data);
    expect([...getMapPlaceLabels(bound)]).toEqual(['BRYGGA A / 12','BRYGGA B / 12']);
    const generated=generate(bound,data);
    const doc=new DOMParser().parseFromString(generated,'application/xml');
    expect(doc.querySelector('[id="0"]').getAttribute('value')).toContain('Test Person');
    expect(doc.querySelector('[id="1"]').getAttribute('value')).toContain('Other Person');
    const clean=createCleanDrawioXml(generated);
    expect(clean).toContain('value="Brygga A / 12"');
    expect(generate(prepareBasMap(clean,data),data)).toContain('Other Person');
  });
  it('expands an existing single-area map without reassigning its bare number', () => {
    const single=validateBasPayload({...payload(),rows:[row('12')]});
    const bound=prepareBasMap(map('12'),single);
    const expanded=prepareBasMap(bound,multi());
    expect(expanded).toContain('data-bas-place="Brygga A / 12"');
    expect(generate(expanded,multi())).toContain('Test Person');
    expect(generate(expanded,multi())).not.toContain('Other Person');
    const clean=createCleanDrawioXml(generate(expanded,multi()));
    expect(clean).toContain('value="12"');
    expect(prepareBasMap(clean,multi())).toContain('data-bas-place="Brygga A / 12"');
  });
  it('binds unique bare numbers and never reassigns a saved place when its area is omitted', () => {
    const data=multi(); data.rows[1].place='13';
    const bound=prepareBasMap(map('12','13'),data);
    const subset=validateBasPayload({...data,areas:['Brygga B'],rows:[{...data.rows[1],place:'12'}]});
    const generated=generate(prepareBasMap(bound,subset),subset);
    expect(generated).not.toContain('Other Person');
    expect(generated).toContain('Saknas i BAS-urvalet');
  });
  it('can rename an existing bound place to another qualified place', () => {
    const bound=prepareBasMap(map('Brygga A / 12'),multi());
    const doc=new DOMParser().parseFromString(bound,'application/xml');
    doc.querySelector('mxCell').setAttribute('value','Brygga B / 12');
    const renamed=createCleanDrawioXml(new XMLSerializer().serializeToString(doc));
    expect(generate(prepareBasMap(renamed,multi()),multi())).toContain('Other Person');
  });
});

it('does not map a removed saved place to a literal area-like name in the same area', () => {
  const single = {...payload(), rows:[row('12')]};
  const bound = prepareBasMap('<mxGraphModel><root><mxCell vertex="1" value="12"/></root></mxGraphModel>',single);
  const replacement = {...payload(), rows:[row('Brygga A / 12')]};
  const generated = createGeneratedDrawioXml(prepareBasMap(bound,replacement),basRowsToTable(replacement).rows,{placeColumnIndex:0,isEmptyRow:()=>false,labelOptions,basSource:replacement});
  expect(generated).not.toContain('Test Person');
  expect(generated).toContain('Saknas i BAS-urvalet');
});

describe('BAS place comments', () => {
  const map = label => `<mxGraphModel><root><mxCell vertex="1" value="${label}"/></root></mxGraphModel>`;
  const generate = (xml,data) => createGeneratedDrawioXml(xml,basRowsToTable(data).rows,{placeColumnIndex:0,isEmptyRow:()=>false,labelOptions,basSource:data});
  it.each([' 112 / SSR/extra ', '112(SSR)', '112 (SSR/extra)', '112/SSR (extra)', '112 (ofullständig'])('matches %s to 112 and preserves the original source name', (sourceName) => {
    const data=validateBasPayload({...payload(),rows:[row(sourceName)]});
    expect(data.rows[0].place).toBe(sourceName.trim());
    const table=basRowsToTable(data);
    expect(table.rows[0][0]).toBe('112');
    expect(table.rows[0].rawOmradePlats).toBe(`Brygga A / ${sourceName.trim()}`);
    for (const label of ['112','112/äldre kommentar','112 (äldre)','Brygga A / 112','Brygga A / 112/äldre','Brygga A / 112 (äldre)']) {
      const bound=prepareBasMap(map(label),data);
      expect(getMapPlaceLabels(bound).has('112')).toBe(true);
      expect(generate(bound,data)).toContain('Test Person');
      expect(generate(prepareBasMap(createCleanDrawioXml(generate(bound,data)),data),data)).toContain('Test Person');
    }
  });
  it('retains a saved binding when only the comment changes, including old map metadata', () => {
    const data=validateBasPayload({...payload(),rows:[row('112/NY')]});
    const old=map('112/SSR').replace('<mxGraphModel>','<mxGraphModel data-bas-scope="[&quot;Testklubb&quot;,&quot;Brygga A&quot;]">').replace('vertex="1"','vertex="1" data-bas-place="112/SSR"');
    const migrated=prepareBasMap(old,data);
    expect(migrated).toContain('data-bas-name="112/NY"');
    expect(generate(migrated,data)).toContain('Test Person');
    const updated=validateBasPayload({...payload(),rows:[row('112 (ÄNDRAD)')]});
    expect(generate(prepareBasMap(migrated,updated),updated)).toContain('Test Person');
  });
  it('keeps area qualification while ignoring comments and rejects ambiguous bare numbers', () => {
    const data=validateBasPayload({version:2,club:'Testklubb',areas:['Brygga A','Brygga B'],capturedAt:payload().capturedAt,rows:[row('112/SSR'),{...row('112 (annan)'),area:'Brygga B',firstName:'Other'}]});
    expect(basRowsToTable(data).rows.map(row=>row[0])).toEqual(['Brygga A / 112','Brygga B / 112']);
    expect(()=>prepareBasMap(map('112'),data)).toThrow(/flera områden/);
    const generated=generate(prepareBasMap(map('Brygga B / 112 (kommentar)'),data),data);
    expect(generated).toContain('Other Person');expect(generated).not.toContain('Test Person');
    const slashArea=validateBasPayload({...payload(),area:'Brygga A/B (yttre)',rows:[{...row('112/SSR'),area:'Brygga A/B (yttre)'}]});
    expect(generate(prepareBasMap(map('Brygga A/B (yttre) / 112 (SSR)'),slashArea),slashArea)).toContain('Test Person');
  });
  it('rejects duplicate normalized places and names containing only a comment', () => {
    expect(()=>validateBasPayload({...payload(),rows:[row('112/SSR'),row(' 112 (annat) ')]})).toThrow(/samma platsnamn före/);
    expect(()=>validateBasPayload({...payload(),rows:[row('(SSR)')]})).toThrow();
  });
});
