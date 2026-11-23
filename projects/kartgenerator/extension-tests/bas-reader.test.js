import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readBasPlaces } from "../extension/bas-reader.js";
import { deliverBasPlaces } from "../extension/map-delivery.js";

const fields = ["PlaceName", "StorageName", "AreaType", "FirstName", "LastName", "BrandName", "Width", "Length", "BoatWidth", "BoatLength", "StorageAmount"];
function setup({ url = "https://bas.batunionen.se/BasK/Storage/StorageSearch", pager = "1 - 1 av 1 poster" } = {}) {
  const dom = new JSDOM(`<span class="bas-link">Testklubb<span>BAS-K</span></span><div id="StorageListGrid"><table><thead><tr>${fields.map(f => `<th data-field="${f}"></th>`).join("")}</tr></thead><tbody><tr data-uid="transient">${["Brygga A", "71-73/1", "Sommar", "Test", "Person (123 )", "Båt", "3,50", "0,00", "2,50", "7,00", "SECRET-FEE"].map(value => `<td>${value}</td>`).join("")}</tr></tbody></table><span class="k-pager-info">${pager}</span></div>`, { url });
  globalThis.document = dom.window.document; globalThis.location = dom.window.location;
  return dom;
}
test("reads full place names and only allowed fields, not fee or membership number", () => {
  const dom = setup(); const result = readBasPlaces();
  assert.equal(result.ok,true); assert.equal(result.data.club,"Testklubb");
  assert.equal(result.data.rows[0].place,"71-73/1");
  assert.equal(result.data.rows[0].lastName,"Person");
  assert.equal(result.data.rows[0].width,"3,50");
  assert.equal(JSON.stringify(result).includes("SECRET-FEE"),false);
  assert.equal(JSON.stringify(result).includes("123"),false); dom.window.close();
});
test("column order is derived from headers rather than fixed positions", () => {
  const dom=setup(); const head=document.querySelector('thead tr'); const body=document.querySelector('tbody tr');
  head.append(head.firstElementChild); body.append(body.firstElementChild);
  assert.equal(readBasPlaces().data.rows[0].area,"Brygga A"); dom.window.close();
});
test("partial, paginated and unknown counts are never silently imported", () => {
  for(const pager of ["1 - 1 av 2 poster","2 - 2 av 2 poster","Inga poster","1 - 5001 av 5001 poster"]){
    const dom=setup({pager}); assert.equal(readBasPlaces().code,"BAS_INCOMPLETE");dom.window.close();
  }
});
test("login page, wrong origin and unknown layouts fail closed", () => {
  for(const url of ["https://bas.batunionen.se/", "https://bas.batunionen.se.evil.test/BasK/Storage/StorageSearch"]){
    const dom=setup({url});assert.equal(readBasPlaces().code,"BAS_PAGE");dom.window.close();
  }
  const dom=setup(); document.querySelector('[data-field="Width"]').remove();
  assert.equal(readBasPlaces().code,"BAS_LAYOUT"); dom.window.close();
});
test("editing, grouping and missing cells are rejected", () => {
  for(const kind of ['edit','group','cell']){
    const dom=setup();
    if(kind==='edit')document.querySelector('td').innerHTML='<input value="unsaved">';
    if(kind==='group')document.querySelector('tr[data-uid]').className='k-grouping-row';
    if(kind==='cell')document.querySelector('td').remove();
    assert.equal(readBasPlaces().code,"BAS_LAYOUT");dom.window.close();
  }
});
test("reader remains standalone after Chrome serializes it", () => {
  const dom=setup(); const copy=new Function(`return (${readBasPlaces.toString()})();`);
  assert.equal(copy().ok,true);dom.window.close();
});
test("delivery checks exact origin/path and receiver acknowledgement", () => {
  const dom=setup({url:'https://ledkarlsson.github.io/projects/kartgenerator/'});
  globalThis.CustomEvent=dom.window.CustomEvent;
  assert.equal(deliverBasPlaces().code,"MAP_RECEIVER");
  let staged;
  document.addEventListener('koppla:bas:request',event=>{
    staged=event.detail;
    document.dispatchEvent(new CustomEvent('koppla:bas:reply',{detail:{requestId:event.detail.requestId,ok:true}}));
  });
  assert.equal(deliverBasPlaces().ok,true);assert.equal(staged.operation,'ping');
  assert.equal(deliverBasPlaces({version:1}).ok,true);assert.equal(staged.operation,'stage');
  dom.reconfigure({url:'https://ledkarlsson.github.io/projects/other/'});globalThis.location=dom.window.location;
  assert.equal(deliverBasPlaces({version:1}).code,'MAP_PAGE');dom.window.close();
});
