import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

for (const count of [0, 1]) test(`popup keeps skipped-place details visible when ${count} unique rows are sent`, async () => {
  const dom = new JSDOM(readFileSync(new URL('../extension/popup.html', import.meta.url), 'utf8'));
  const previousDocument = globalThis.document;
  const previousChrome = globalThis.chrome;
  const warning = '2 rader hoppas över:\n\nBrygga A: 112/SSR, 112 (<img src=x>)';
  globalThis.document = dom.window.document;
  globalThis.chrome = {
    permissions: { request: async () => true },
    runtime: { sendMessage: async ({action}) => ({ok:true,data:action === 'bas-read'
      ? {id:'test',club:'Testklubb',capturedAt:'2026-11-01T12:00:00Z',areas:[{area:'Brygga A',count:count+2}]}
      : {count,skippedCount:2,warning}}) }
  };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  try {
    await import(`../extension/bas-popup.js?count=${count}`);
    const doc = dom.window.document;
    doc.getElementById('bas-read').click(); await settle();
    doc.getElementById('bas-all').click();
    doc.getElementById('bas-send').click(); await settle();
    const notice = doc.getElementById('bas-notice');
    assert.equal(notice.hidden,false);
    assert.ok(notice.textContent.includes(warning));
    assert.equal(notice.querySelector('img'),null);
    assert.equal(doc.getElementById('bas-review').hidden,count > 0);
    assert.ok(notice.textContent.includes(count ? '1 rader väntar i kartgeneratorn' : 'Inget har skickats'));
    if (!count) assert.equal(doc.getElementById('bas-send').disabled,false);
  } finally {
    globalThis.document = previousDocument; globalThis.chrome = previousChrome;
    dom.window.close();
  }
});
