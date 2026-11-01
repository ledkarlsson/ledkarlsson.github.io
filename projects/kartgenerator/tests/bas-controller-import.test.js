import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
let finishExcel;
vi.mock('../assets/js/excel-reader.js', () => ({ ExcelReadError: class extends Error {}, readExcelFile: () => new Promise(resolve => { finishExcel = resolve; }) }));

describe('BAS import into existing map workflow', () => {
  it('replaces old rows, preserves full names, guards the map scope and ignores a stale Excel read', async () => {
    document.documentElement.innerHTML = readFileSync('projects/kartgenerator/index.html','utf8');
    const { createExcelController } = await import('../assets/js/excel-controller.js');
    const { state } = await import('../assets/js/state.js');
    const callbacks={ updateGeneratedDiagram:vi.fn(),updatePeopleMissingFromMapList:vi.fn(),updateMapPlacesMissingInExcelList:vi.fn(),updateDuplicateMapPlacesList:vi.fn(),preserveWindowScroll:fn=>fn() };
    const controller=createExcelController(callbacks);
    const payload={version:1,club:'Testklubb',area:'A',capturedAt:'2026-11-01T12:00:00Z',rows:[{area:'A',place:'71-73/1',firstName:'Test',lastName:'Person',category:'Sommar',boat:'Testbåt',width:'3',length:'8',boatWidth:'2',boatLength:'7'}]};
    state.sourceDrawioXml='<mxGraphModel><root><mxCell id="1" vertex="1" value="71-73/1"/></root></mxGraphModel>';
    controller.showFile(new File([''],'old.xlsx'));
    controller.importBas(payload);
    expect(state.excelRows[0][0]).toBe('71-73');
    expect(state.excelRows[0].rawOmradePlats).toBe('A / 71-73/1');
    expect(document.getElementById('table-panel').hidden).toBe(false);
    expect(document.getElementById('parse-controls').classList.contains('is-visible')).toBe(false);
    finishExcel({columns:[{index:0,name:'Old'}],rows:[['STALE']],sheetName:'Old'});
    await Promise.resolve();await Promise.resolve();
    expect(state.excelRows[0][0]).toBe('71-73');
    expect(()=>controller.importBas({...payload,club:'Different'})).toThrow(/annat BAS/);
    expect(state.basSource.club).toBe('Testklubb');
    controller.reparseRows(true);
    expect(state.excelRows[0][0]).toBe('71-73');
    controller.clearFile();expect(state.basSource).toBeNull();
  });
});
