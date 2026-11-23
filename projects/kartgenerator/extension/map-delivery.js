// Runs in the destination's MAIN world and hands the data to the website.
export function deliverBasPlaces(payload = null) {
  if (location.origin !== "https://ledkarlsson.github.io" || !["/projects/kartgenerator/", "/projects/kartgenerator/index.html"].includes(location.pathname)) return { ok: false, code: "MAP_PAGE" };
  const requestId = crypto.randomUUID();
  let reply = null;
  const onReply = event => {
    if (event.detail?.requestId === requestId) reply = event.detail;
  };
  document.addEventListener("koppla:bas:reply", onReply);
  try {
    document.dispatchEvent(new CustomEvent("koppla:bas:request", { detail: { requestId, operation: payload === null ? "ping" : "stage", payload } }));
  } finally { document.removeEventListener("koppla:bas:reply", onReply); }
  return reply?.ok === true ? { ok: true } : { ok: false, code: "MAP_RECEIVER" };
}
