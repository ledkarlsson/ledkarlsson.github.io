import {
  drawioEditorConfig,
  handleDrawioMessage,
  loadDrawioXmlWhenVisible,
  postDrawioMessage
} from "./drawio-embed.js";
import {
  createCleanDrawioXml,
  createDrawioXmlWithHighlightedDuplicatePlaces,
  createDrawioXmlWithHighlightedMapPlacesMissingInExcel,
  createDrawioXmlWithAddedPlaceBoxes,
  createGeneratedDrawioXml,
  hasRenamedNewPlacePlaceholder,
  newPlacePlaceholder
} from "./drawio-model.js";
import {
  clearGeneratedDrawioXml,
  resetDrawioState,
  setCurrentDrawioMode,
  setGeneratedDrawioXml,
  setManualDrawioMode,
  setSourceDrawioXml,
  state
} from "./state.js";
import {
  renderClearedDrawioFile,
  renderDragState,
  renderDrawioAddPlaceError,
  renderDrawioControls,
  renderDrawioReadError,
  renderDrawioUploadMessage,
  renderDrawioViewer,
  renderFullscreenButton,
  renderPeopleMissingFromMapError,
  renderRejectedDrawioFile,
  renderSelectedDrawioFile
} from "./renderers.js";
import {
  drawioControlElements,
  drawioElements,
  drawioExampleElements,
  peopleMissingFromMapElements,
  workspaceElements
} from "./elements.js";

const drawioTypes = [".drawio", ".drawio.xml"];

export function createDrawioController(callbacks) {
  function setUploadMessage(title, help = "") {
    renderDrawioUploadMessage({ title, help, elements: drawioElements });
  }

  function resetUploadMessage() {
    setUploadMessage(
      "Ladda upp karta",
      "Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja"
    );
  }

  function loadViewer(xml, options = {}) {
    state.pendingDrawioXml = xml;
    renderDrawioViewer({ isVisible: true, elements: drawioElements });
    loadDrawioXmlWhenVisible(drawioElements.frame, xml, { autosave: true, keepZoom: options.keepZoom });
  }

  function getCleanXmlForDisplay() {
    const highlightedMapPlacesMissingInExcelXml = createDrawioXmlWithHighlightedMapPlacesMissingInExcel(
      state.sourceDrawioXml,
      new Set(state.mapPlacesMissingInExcelRows.map((row) => row.normalizedPlace))
    );

    return createDrawioXmlWithHighlightedDuplicatePlaces(
      highlightedMapPlacesMissingInExcelXml,
      new Set(state.duplicateMapPlaceRows.map((row) => row.normalizedPlace))
    );
  }

  function showCleanMap() {
    if (!state.sourceDrawioXml) {
      return;
    }

    setManualDrawioMode(true);
    setCurrentDrawioMode("clean");
    loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
    updateButtons();
  }

  function showGeneratedMap() {
    if (!state.generatedDrawioXml) {
      return;
    }

    setManualDrawioMode(true);
    setCurrentDrawioMode("generated");
    loadViewer(state.generatedDrawioXml, { keepZoom: true });
    updateButtons();
  }

  function scheduleCleanMapRefresh() {
    window.clearTimeout(state.cleanMapRefreshTimer);
    state.cleanMapRefreshTimer = window.setTimeout(() => {
      state.cleanMapRefreshTimer = 0;

      if (state.currentDrawioMode === "clean" && state.sourceDrawioXml) {
        loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
      }
    }, 350);
  }

  function updateFullscreenButton() {
    const isFullscreen = document.fullscreenElement === workspaceElements.mapWorkspace;

    renderFullscreenButton({ isFullscreen, element: drawioControlElements.fullscreenButton });
  }

  function getCurrentXml() {
    return state.currentDrawioMode === "generated" && state.generatedDrawioXml
      ? state.generatedDrawioXml
      : getCleanXmlForDisplay();
  }

  function refitMapAfterFullscreenExit() {
    const xml = getCurrentXml();

    if (!xml || document.fullscreenElement === workspaceElements.mapWorkspace) {
      return;
    }

    loadViewer(xml);
  }

  function handleFullscreenChange() {
    const isMapFullscreen = document.fullscreenElement === workspaceElements.mapWorkspace;

    updateFullscreenButton();

    if (state.wasMapFullscreen && !isMapFullscreen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(refitMapAfterFullscreenExit);
      });
    }

    state.wasMapFullscreen = isMapFullscreen;
  }

  async function toggleMapFullscreen() {
    if (!state.sourceDrawioXml || !document.fullscreenEnabled) {
      return;
    }

    try {
      if (document.fullscreenElement === workspaceElements.mapWorkspace) {
        await document.exitFullscreen();
      } else {
        await workspaceElements.mapWorkspace.requestFullscreen();
      }
    } finally {
      updateFullscreenButton();
    }
  }

  function updateButtons() {
    const hasSource = Boolean(state.sourceDrawioXml);
    const hasGenerated = Boolean(state.generatedDrawioXml);

    renderDrawioControls({
      hasSource,
      hasGenerated,
      currentMode: state.currentDrawioMode,
      fullscreenEnabled: document.fullscreenEnabled,
      isFullscreen: document.fullscreenElement === workspaceElements.mapWorkspace,
      elements: drawioControlElements
    });

    if (!hasSource) {
      callbacks.closeDownloadMenu();
    }
  }

  function refreshAfterReset() {
    updateButtons();
    callbacks.updatePeopleMissingFromMapList();
    callbacks.updateMapPlacesMissingInExcelList();
    callbacks.updateDuplicateMapPlacesList();
    updateGeneratedDiagram();
  }

  function clearFile() {
    renderClearedDrawioFile({
      elements: drawioElements,
      exampleElements: drawioExampleElements
    });
    resetDrawioState();
    refreshAfterReset();
  }

  function showFile(file) {
    const fileName = file.name.toLowerCase();
    const isDrawioFile = drawioTypes.some((extension) => fileName.endsWith(extension));

    if (!isDrawioFile) {
      renderRejectedDrawioFile({
        message: "Välj en kartfil som slutar med .drawio eller .drawio.xml.",
        elements: drawioElements
      });
      resetDrawioState();
      refreshAfterReset();
      return;
    }

    renderSelectedDrawioFile({
      fileName: file.name,
      elements: drawioElements,
      exampleElements: drawioExampleElements
    });
    state.sourceDrawioFileName = file.name;
    readFile(file);
  }

  function updateSourceXml(xml) {
    const rawXml = String(xml || "").trim();
    const shouldRefreshRenamedNewPlace = state.currentDrawioMode === "clean" && hasRenamedNewPlacePlaceholder(rawXml);
    const updatedXml = createCleanDrawioXml(rawXml).trim();
    const previousMapPlacesMissingInExcelKey = callbacks.getMapPlacesMissingInExcelKey(
      state.mapPlacesMissingInExcelRows
    );

    if (!updatedXml || updatedXml === state.sourceDrawioXml) {
      return;
    }

    const shouldRefreshGeneratedView = state.currentDrawioMode === "generated";

    setSourceDrawioXml(updatedXml);
    const shouldRefreshDuplicateMapPlaces = callbacks.updateDuplicateMapPlacesList();

    callbacks.preserveWindowScroll(() => {
      state.shouldReloadDrawioViewer = shouldRefreshGeneratedView;

      try {
        if (state.excelColumns.length > 0 && state.rawExcelRows.length > 0) {
          callbacks.reparseRows(true);
        } else {
          callbacks.updatePeopleMissingFromMapList();
          callbacks.updateMapPlacesMissingInExcelList();
          updateGeneratedDiagram();
        }
      } finally {
        state.shouldReloadDrawioViewer = true;
      }
    });

    const shouldRefreshMapPlacesMissingInExcel = callbacks.getMapPlacesMissingInExcelKey(
      state.mapPlacesMissingInExcelRows
    ) !== previousMapPlacesMissingInExcelKey;

    if (shouldRefreshRenamedNewPlace || shouldRefreshDuplicateMapPlaces || shouldRefreshMapPlacesMissingInExcel) {
      if (state.currentDrawioMode === "clean") {
        scheduleCleanMapRefresh();
      }
    }
  }

  function addPlaceBox() {
    if (!state.sourceDrawioXml) {
      return;
    }

    try {
      updateSourceXml(createDrawioXmlWithAddedPlaceBoxes(state.sourceDrawioXml, [{
        place: newPlacePlaceholder,
        isNewPlacePlaceholder: true
      }]));
      setManualDrawioMode(true);

      if (state.currentDrawioMode === "generated" && state.generatedDrawioXml) {
        loadViewer(state.generatedDrawioXml, { keepZoom: true });
      } else {
        setCurrentDrawioMode("clean");
        loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
      }

      updateButtons();
    } catch (error) {
      renderDrawioAddPlaceError({
        message: "Kunde inte lägga till plats.",
        elements: drawioElements
      });
    }
  }

  function addPeopleMissingFromMapBoxes() {
    const rows = callbacks.getSortedPeopleMissingFromMapRows();

    if (!state.sourceDrawioXml || rows.length === 0) {
      return;
    }

    try {
      updateSourceXml(createDrawioXmlWithAddedPlaceBoxes(state.sourceDrawioXml, rows));
      setManualDrawioMode(true);
      setCurrentDrawioMode(state.generatedDrawioXml ? "generated" : "clean");

      if (state.currentDrawioMode === "generated") {
        loadViewer(state.generatedDrawioXml, { keepZoom: true });
      } else {
        loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
      }

      updateButtons();
    } catch (error) {
      renderPeopleMissingFromMapError({
        message: "Kunde inte lägga till platser i kartan.",
        elements: peopleMissingFromMapElements
      });
    }
  }

  function updateGeneratedDiagram() {
    if (!state.sourceDrawioXml) {
      clearGeneratedDrawioXml();
      updateButtons();
      return;
    }

    if (state.parsedOmradePlatsColumnIndex === null || !state.selectedColumnIndexes.includes(state.parsedOmradePlatsColumnIndex)) {
      const { wasShowingGenerated } = clearGeneratedDrawioXml();

      if (wasShowingGenerated && state.shouldReloadDrawioViewer) {
        loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
      }
      updateButtons();
      return;
    }

    const visibleRows = callbacks.getRowsForGeneratedDiagram();

    if (visibleRows.length === 0) {
      const { wasShowingGenerated } = clearGeneratedDrawioXml();

      if (wasShowingGenerated && state.shouldReloadDrawioViewer) {
        loadViewer(getCleanXmlForDisplay(), { keepZoom: true });
      }
      updateButtons();
      return;
    }

    try {
      const generatedXml = createGeneratedDrawioXml(state.sourceDrawioXml, visibleRows, {
        placeColumnIndex: state.parsedOmradePlatsColumnIndex,
        isEmptyRow: callbacks.isEmptyExcelPlaceRow,
        labelOptions: callbacks.getDrawioLabelOptions()
      });
      const { hadGeneratedDrawioXml } = setGeneratedDrawioXml(generatedXml);

      if (!hadGeneratedDrawioXml && !state.hasManualDrawioMode) {
        setCurrentDrawioMode("generated");
      }

      if (state.shouldReloadDrawioViewer && state.currentDrawioMode === "generated") {
        loadViewer(state.generatedDrawioXml, { keepZoom: true });
      }
    } catch (error) {
      clearGeneratedDrawioXml();
    }

    updateButtons();
  }

  function readFile(file) {
    const reader = new FileReader();

    reader.addEventListener("load", (event) => {
      const xml = String(event.target.result || "").trim();

      if (!xml) {
        renderDrawioReadError({
          message: "Den här kartfilen är tom.",
          elements: drawioElements
        });
        resetDrawioState();
        refreshAfterReset();
        return;
      }

      setSourceDrawioXml(createCleanDrawioXml(xml));
      setCurrentDrawioMode("clean");
      setManualDrawioMode(true);
      callbacks.updateDuplicateMapPlacesList();
      loadViewer(getCleanXmlForDisplay());

      if (state.excelColumns.length > 0 && state.rawExcelRows.length > 0) {
        callbacks.reparseRows(true);
      } else {
        callbacks.updatePeopleMissingFromMapList();
        callbacks.updateMapPlacesMissingInExcelList();
        updateGeneratedDiagram();
      }
    });

    reader.addEventListener("error", () => {
      renderDrawioReadError({
        message: "Kunde inte läsa kartfilen.",
        elements: drawioElements
      });
      resetDrawioState();
      refreshAfterReset();
    });

    reader.readAsText(file);
  }

  function bindEvents(downloadActions) {
    drawioElements.upload.addEventListener("change", () => {
      const [file] = drawioElements.upload.files;

      if (file) {
        showFile(file);
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      drawioElements.uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        renderDragState({
          element: drawioElements.uploadZone,
          className: "is-dragging-drawio",
          isDragging: true
        });
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      drawioElements.uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        renderDragState({
          element: drawioElements.uploadZone,
          className: "is-dragging-drawio",
          isDragging: false
        });
      });
    });

    drawioElements.uploadZone.addEventListener("drop", (event) => {
      const [file] = event.dataTransfer.files;

      if (file) {
        showFile(file);
      }
    });

    drawioControlElements.showCleanButton.addEventListener("click", showCleanMap);
    drawioControlElements.showGeneratedButton.addEventListener("click", showGeneratedMap);
    drawioControlElements.fullscreenButton.addEventListener("click", toggleMapFullscreen);
    drawioControlElements.addPlaceButton.addEventListener("click", addPlaceBox);
    drawioControlElements.downloadMenuButton.addEventListener("click", downloadActions.toggleMenu);
    drawioControlElements.downloadCleanDrawioButton.addEventListener("click", downloadActions.cleanDrawio);
    drawioControlElements.downloadCleanPngButton.addEventListener("click", downloadActions.cleanPng);
    drawioControlElements.downloadGeneratedDrawioButton.addEventListener("click", downloadActions.generatedDrawio);
    drawioControlElements.downloadGeneratedPngButton.addEventListener("click", downloadActions.generatedPng);
    peopleMissingFromMapElements.addButton.addEventListener("click", addPeopleMissingFromMapBoxes);
    drawioElements.clearButton.addEventListener("click", clearFile);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    window.addEventListener("message", (event) => {
      handleDrawioMessage(event, {
        frame: drawioElements.frame,
        pendingXml: state.pendingDrawioXml,
        onConfigure: (origin) => postDrawioMessage(drawioElements.frame, {
          action: "configure",
          config: drawioEditorConfig
        }, origin),
        onInit: (xml) => loadViewer(xml),
        onSave: (xml) => updateSourceXml(xml),
        onExport: (dataUrl) => {
          callbacks.downloadPngWithWhiteBackground(dataUrl, state.pendingPngFileName || "karta.png");
          state.pendingPngFileName = "";
        }
      });
    });
  }

  return {
    bindEvents,
    clearFile,
    getCleanXmlForDisplay,
    loadViewer,
    resetUploadMessage,
    scheduleCleanMapRefresh,
    showFile,
    updateButtons,
    updateGeneratedDiagram,
    updateSourceXml
  };
}
