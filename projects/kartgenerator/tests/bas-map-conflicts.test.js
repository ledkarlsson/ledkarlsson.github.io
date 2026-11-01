import { getBasMapConflicts, highlightBasMapConflicts } from "../assets/js/bas-map-conflicts.js";
import { renderBasMapConflicts } from "../assets/js/renderers.js";
import { describe, it, expect } from 'vitest';
import { validateBasPayload, prepareBasMap, basRowsToTable } from '../assets/js/bas-import.js';
import { createGeneratedDrawioXml, createCleanDrawioXml } from '../assets/js/drawio-model.js';
import { getMapPlacesMissingInExcelRows, getPeopleMissingFromMapRows } from '../assets/js/diagnostics.js';

const row=(area,place,firstName)=>({area,place,firstName,lastName:'Person',category:'Varv',boat:'Testbåt',width:'3',length:'8',boatWidth:'2',boatLength:'7'});
const data=()=>validateBasPayload({version:3,club:'Testklubb',areas:['Varvsområde 1','Varvsområde 2'],capturedAt:'2026-11-01T12:00:00Z',rows:[row('Varvsområde 1','103/SSR','First'),row('Varvsområde 2','103 (annan)','Second'),row('Varvsområde 1','104','Unique') ]});
const map='<mxGraphModel><root><mxCell id="1" vertex="1" value="103" style="rounded=1;fillColor=#ffffff;"/><mxCell id="2" vertex="1" value="104"/><mxCell id="3" vertex="1" value="999"/></root></mxGraphModel>';
const labelOptions={columns:[{name:'Plats'},{name:'Förnamn'},{name:'Efternamn'}],selectedColumnIndexes:[0,1,2],placeColumnIndex:0,firstNameColumnIndex:1,lastNameColumnIndex:2,showPlaceNumber:true,showColumnNames:false};
const generate=(xml,payload)=>createGeneratedDrawioXml(xml,basRowsToTable(payload).rows,{placeColumnIndex:0,isEmptyRow:()=>false,labelOptions,basSource:payload});

describe('visualizing conflicting BAS source data',()=>{
  it('loads an ambiguous map and labels conflicts without choosing a member',()=>{
    const payload=data();const bound=prepareBasMap(map,payload);
    const generated=generate(bound,payload);const doc=new DOMParser().parseFromString(generated,'application/xml');
    const conflict=doc.querySelector('[id="1"]');
    expect(conflict.getAttribute('value')).toContain('Tvetydig BAS-plats');
    expect(conflict.getAttribute('value')).toContain('Varvsområde 1 / 103/SSR');
    expect(conflict.getAttribute('value')).toContain('Varvsområde 2 / 103 (annan)');
    expect(conflict.getAttribute('value')).not.toContain('First Person');
    expect(conflict.getAttribute('value')).not.toContain('Second Person');
    expect(conflict.getAttribute('style')).toContain('fillColor=#f8cecc');
    expect(doc.querySelector('[id="2"]').getAttribute('value')).toContain('Unique Person');
    expect(doc.querySelector('[id="3"]').getAttribute('value')).toContain('Saknas i BAS-urvalet');
  });
  it('does not report ambiguous matches as missing rows or offer to create more boxes',()=>{
    const payload=data();const bound=prepareBasMap(map,payload);const rows=basRowsToTable(payload).rows;
    expect(getMapPlacesMissingInExcelRows(bound,rows,0).map(row=>row.place)).toEqual(['999']);
    expect(getPeopleMissingFromMapRows(bound,rows,{placeColumnIndex:0,firstNameColumnIndex:1,lastNameColumnIndex:2})).toEqual([]);
  });
  it('keeps the original label and style on cleaning, and removes the conflict after BAS correction',()=>{
    const payload=data();const generated=generate(prepareBasMap(map,payload),payload);
    const clean=createCleanDrawioXml(generated);
    const cell=new DOMParser().parseFromString(clean,'application/xml').querySelector('[id="1"]');
    expect(cell.getAttribute('value')).toBe('103');
    expect(cell.getAttribute('style')).toBe('rounded=1;fillColor=#ffffff;');
    const corrected=validateBasPayload({...payload,rows:payload.rows.filter(row=>row.area!=='Varvsområde 2'),areas:['Varvsområde 1']});
    const rebound=prepareBasMap(clean,corrected);
    expect(rebound).not.toContain('data-bas-conflicts');
    expect(generate(rebound,corrected)).toContain('First Person');
  });
  it('resolves a manual qualified label and safely escapes source names',()=>{
    const payload=data();payload.rows[1].place='103 (<img src=x onerror=alert(1)>)';
    const bound=prepareBasMap(map,payload);
    const generated=generate(bound,payload);
    const doc=new DOMParser().parseFromString(generated,'application/xml');
    expect(doc.querySelector('[id="1"]').getAttribute('value')).toContain('&lt;img');
    const clean=new DOMParser().parseFromString(createCleanDrawioXml(generated),'application/xml');
    clean.querySelector('[id="1"]').setAttribute('value','Varvsområde 2 / 103');
    const resolved=generate(prepareBasMap(new XMLSerializer().serializeToString(clean),payload),payload);
    expect(resolved).toContain('Second Person');expect(resolved).not.toContain('Tvetydig BAS-plats');
  });
});

it('shows a safe, clearable conflict list and highlights the clean map too',()=>{
  const input=data();input.rows[1].place='103 (<img src=x>)';
  const bound=prepareBasMap(map,input);
  const rows=getBasMapConflicts(bound);
  document.body.innerHTML='<section id="panel" hidden><ul id="list"></ul></section>';
  const elements={panel:document.getElementById('panel'),list:document.getElementById('list')};
  try {
    renderBasMapConflicts({rows,elements});
    expect(elements.panel.hidden).toBe(false);
    expect(elements.list.textContent).toContain('Plats 103');
    expect(elements.list.textContent).toContain('Varvsområde 2 / 103 (<img src=x>)');
    expect(elements.list.querySelector('img')).toBeNull();
    const colored=highlightBasMapConflicts(bound);
    expect(colored).toContain('fillColor=#f8cecc');
    expect(createCleanDrawioXml(colored)).toContain('rounded=1;fillColor=#ffffff;');
    renderBasMapConflicts({rows:[],elements});
    expect(elements.panel.hidden).toBe(true);expect(elements.list.children).toHaveLength(0);
  } finally { document.body.replaceChildren(); }
});
