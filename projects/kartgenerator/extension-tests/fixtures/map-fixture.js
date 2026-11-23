// Local test page only. Never packaged or published with either production app.
const scenario = new URLSearchParams(location.search).get('scenario');
const conflictScenario = ['bas-conflict','bas-vacant'].includes(scenario);
const vacantScenario = scenario === 'bas-vacant';
const button = document.createElement('button');
button.type = 'button'; button.className = 'button'; button.textContent = 'DEMO: Ta emot BAS-testdata';
document.getElementById('bas-import-summary').after(button);
const mapButton = document.createElement('button');
mapButton.type='button'; mapButton.className='button'; mapButton.textContent='DEMO: Ladda testkarta';
button.after(mapButton);
mapButton.addEventListener('click', async () => {
  let xml = await (await fetch('/bas-map.drawio')).text();
  if (conflictScenario) xml = xml.replace('Brygga A / 12','103').replace('Brygga B / 12','104').replace('value="99"','value="999"');
  const transfer = new DataTransfer();
  transfer.items.add(new File([xml], 'bas-map.drawio', {type:'application/xml'}));
  const input=document.getElementById('drawio-upload');
  input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
});
button.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('koppla:bas:request', { detail: { requestId:'demo', operation:'stage', payload: {
    version:3,club:'Testklubb',areas:conflictScenario?['Varvsområde 1','Varvsområde 2']:['Brygga A','Brygga B'],capturedAt:new Date().toISOString(),rows:(conflictScenario?['103/SSR','103 (annan)','104']:['12','12','71-73/1']).map((place,i)=>({area:conflictScenario?(i===1?'Varvsområde 2':'Varvsområde 1'):(i===1?'Brygga B':'Brygga A'),place,category:'Sommarområde',firstName:vacantScenario&&i===2?'':(i?'Exempel':'Test'),lastName:vacantScenario&&i===2?'':'Person',boat:vacantScenario&&i===2?'':'Testbåt',width:'3,00',length:'8,00',boatWidth:'2,50',boatLength:'7,00'}))
  } } }));
});
