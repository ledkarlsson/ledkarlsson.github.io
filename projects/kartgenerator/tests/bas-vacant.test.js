import { describe, it, expect } from 'vitest';
import { validateBasPayload, prepareBasMap, basRowsToTable } from '../assets/js/bas-import.js';
import { createGeneratedDrawioXml, createCleanDrawioXml } from '../assets/js/drawio-model.js';

const row=(place,extra={})=>({area:'Varvsområde 1',place,firstName:'',lastName:'',boat:'',category:'Varv',width:'3',length:'8',boatWidth:'',boatLength:'',...extra});
const data=rows=>validateBasPayload({version:3,club:'Testklubb',areas:[...new Set(rows.map(row=>row.area))],capturedAt:'2026-11-01T12:00:00Z',rows});
const xml='<mxGraphModel><root><mxCell id="1" vertex="1" value="112" style="rounded=1;fillColor=#abcdef;strokeColor=#123456;"/><mxCell id="2" vertex="1" value="999"/></root></mxGraphModel>';
const labelOptions={columns:[{name:'Plats'},{name:'Förnamn'},{name:'Efternamn'}],selectedColumnIndexes:[0,1,2],placeColumnIndex:0,firstNameColumnIndex:1,lastNameColumnIndex:2,showPlaceNumber:true,showColumnNames:false};
const generate=(source,payload)=>createGeneratedDrawioXml(prepareBasMap(source,payload),basRowsToTable(payload).rows,{placeColumnIndex:0,isEmptyRow:row=>!row[1]&&!row[2]&&!row[5],labelOptions,basSource:payload});
const cell=xml=>new DOMParser().parseFromString(xml,'application/xml').querySelector('[id="1"]');

describe('vacant BAS places',()=>{
  it('shows Ledig and a blue box only when a matched BAS row has no member or boat',()=>{
    const generated=generate(xml,data([row('112/SSR')]));
    expect(cell(generated).getAttribute('value')).toBe('112<br>Ledig');
    expect(cell(generated).getAttribute('style')).toContain('fillColor=#dbeafe');
    expect(cell(generated).getAttribute('style')).toContain('strokeColor=#2563eb');
    const missing=new DOMParser().parseFromString(generated,'application/xml').querySelector('[id="2"]');
    expect(missing.getAttribute('value')).toContain('Saknas i BAS-urvalet');
    expect(missing.getAttribute('style')).toContain('fillColor=#fff2cc');
  });
  it.each([{firstName:'Test'},{lastName:'Person'},{boat:'Testbåt'}])('does not mark a place vacant when it has a link: %j',extra=>{
    const generated=generate(xml,data([row('112',extra)]));
    expect(cell(generated).getAttribute('value')).not.toContain('Ledig');
    expect(cell(generated).getAttribute('style')).toBe('rounded=1;fillColor=#abcdef;strokeColor=#123456;');
  });
  it('restores the original style when cleaning or when a vacant place becomes occupied',()=>{
    const vacant=generate(xml,data([row('112')]));
    const clean=createCleanDrawioXml(vacant);
    expect(cell(clean).getAttribute('value')).toBe('112');
    expect(cell(clean).getAttribute('style')).toBe('rounded=1;fillColor=#abcdef;strokeColor=#123456;');
    expect(clean).not.toContain('data-bas-vacant-style');
    const occupied=generate(clean,data([row('112',{firstName:'Test',lastName:'Person'})]));
    expect(cell(occupied).getAttribute('value')).toContain('Test Person');
    expect(cell(occupied).getAttribute('style')).toBe('rounded=1;fillColor=#abcdef;strokeColor=#123456;');
  });
  it('keeps ambiguous empty BAS rows red instead of declaring them vacant',()=>{
    const generated=generate(xml,data([row('112'),row('112',{area:'Varvsområde 2'})]));
    expect(cell(generated).getAttribute('value')).toContain('Tvetydig BAS-plats');
    expect(cell(generated).getAttribute('value')).not.toContain('Ledig');
    expect(cell(generated).getAttribute('style')).toContain('fillColor=#f8cecc');
  });
});
