// Local UI demo only. Not included in the extension or build output.
(() => {
  const demoAreas = [{area:"Brygga A",count:2},{area:"Brygga B",count:1},{area:"Varvsplatser 1",count:3},{area:"Varvsområde 2",count:4},{area:"Vinterplats",count:5}];
  window.chrome = { permissions: { request: async () => true }, runtime: { sendMessage: async ({ action, areas }) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    if (action === "bas-read") return { ok: true, data: { id: "demo", club: "Testklubb", capturedAt: new Date().toISOString(), areas: demoAreas } };
    if (action === "bas-send") return { ok: true, data: { count: demoAreas.filter(item=>areas.includes(item.area)).reduce((sum,item)=>sum+item.count,0) } };
    return { ok: false, error: { message: "Detta är en lokal demo. Inga externa sidor öppnas." } };
  } } };
  document.addEventListener("DOMContentLoaded", () => {
    document.title = "BAS till kartgeneratorn · lokal demo med testdata";
    document.querySelector(".version").textContent = "DEMO · TESTDATA";
  });
})();
