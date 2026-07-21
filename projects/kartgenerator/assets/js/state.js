export function createInitialKartgeneratorState() {
  return {
    selectedColumnIndexes: [],
    excelColumns: [],
    excelRows: [],
    rawExcelRows: [],
    parsedOmradePlatsColumnIndex: null,
    sourceDrawioXml: "",
    sourceDrawioFileName: "",
    pendingDrawioXml: "",
    generatedDrawioXml: "",
    currentDrawioMode: "clean",
    hasManualDrawioMode: false,
    shouldReloadDrawioViewer: true,
    cleanMapRefreshTimer: 0,
    wasMapFullscreen: false,
    pendingPngFileName: "",
    peopleMissingFromMapRows: [],
    mapPlacesMissingInExcelRows: [],
    duplicateMapPlaceRows: [],
    selectedTableSortColumnIndex: null,
    selectedTableSortDirection: "asc",
    peopleMissingFromMapSortColumn: "place",
    peopleMissingFromMapSortDirection: "asc",
    mapPlacesMissingInExcelSortColumn: "place",
    mapPlacesMissingInExcelSortDirection: "asc",
    scrollRestoreToken: 0
  };
}

export const state = createInitialKartgeneratorState();

export function resetExcelState(targetState = state) {
  targetState.selectedColumnIndexes = [];
  targetState.excelColumns = [];
  targetState.excelRows = [];
  targetState.rawExcelRows = [];
  targetState.parsedOmradePlatsColumnIndex = null;
  resetSelectedTableSort(targetState);
}

export function resetDrawioState(targetState = state) {
  targetState.sourceDrawioXml = "";
  targetState.sourceDrawioFileName = "";
  targetState.pendingDrawioXml = "";
  targetState.generatedDrawioXml = "";
  targetState.currentDrawioMode = "clean";
  targetState.hasManualDrawioMode = false;
  targetState.pendingPngFileName = "";
}

export function setSourceDrawioXml(xml, targetState = state) {
  targetState.sourceDrawioXml = xml;
  targetState.pendingDrawioXml = xml;
}

export function setCurrentDrawioMode(mode, targetState = state) {
  if (!["clean", "generated"].includes(mode)) {
    throw new Error(`Okänt kartläge: ${mode}`);
  }

  targetState.currentDrawioMode = mode;
}

export function setManualDrawioMode(isManual = true, targetState = state) {
  targetState.hasManualDrawioMode = isManual;
}

export function setGeneratedDrawioXml(xml, targetState = state) {
  const hadGeneratedDrawioXml = Boolean(targetState.generatedDrawioXml);

  targetState.generatedDrawioXml = xml;

  return { hadGeneratedDrawioXml };
}

export function clearGeneratedDrawioXml(targetState = state) {
  const wasShowingGenerated = targetState.currentDrawioMode === "generated";

  targetState.generatedDrawioXml = "";

  if (wasShowingGenerated) {
    targetState.currentDrawioMode = "clean";
  }

  return { wasShowingGenerated };
}

export function resetDiagnosticsState(targetState = state) {
  targetState.peopleMissingFromMapRows = [];
  targetState.mapPlacesMissingInExcelRows = [];
  targetState.duplicateMapPlaceRows = [];
  resetMapPlacesMissingInExcelSort(targetState);
}

export function resetSelectedTableSort(targetState = state) {
  targetState.selectedTableSortColumnIndex = null;
  targetState.selectedTableSortDirection = "asc";
}

export function resetMapPlacesMissingInExcelSort(targetState = state) {
  targetState.mapPlacesMissingInExcelSortColumn = "place";
  targetState.mapPlacesMissingInExcelSortDirection = "asc";
}
