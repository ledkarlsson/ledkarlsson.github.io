const uploadZone = document.querySelector("#upload-zone");
    const feedbackEmailButton = document.querySelector("#feedback-email");
    const exampleDownloadLinks = document.querySelectorAll(".example-download");
    const excelUpload = document.querySelector("#excel-upload");
    const fileStatus = document.querySelector("#file-status");
    const excelPanelTitle = document.querySelector("#excel-panel-title");
    const clearExcelButton = document.querySelector("#clear-excel");
    const drawioUploadZone = document.querySelector("#drawio-upload-zone");
    const drawioUpload = document.querySelector("#drawio-upload");
    const drawioPanelTitle = document.querySelector("#drawio-panel-title");
    const clearDrawioButton = document.querySelector("#clear-drawio");
    const drawioViewer = document.querySelector("#drawio-viewer");
    const drawioFrame = document.querySelector("#drawio-frame");
    const generatedEmpty = document.querySelector("#generated-empty");
    const generatedViewer = document.querySelector("#generated-viewer");
    const generatedFrame = document.querySelector("#generated-frame");
    const downloadGeneratedButton = document.querySelector("#download-generated");
    const downloadGeneratedPngButton = document.querySelector("#download-generated-png");
    const missingPanel = document.querySelector("#missing-panel");
    const missingMeta = document.querySelector("#missing-meta");
    const missingWrap = document.querySelector("#missing-wrap");
    const missingTable = document.querySelector("#missing-table");
    const downloadMissingButton = document.querySelector("#download-missing");
    const columnsMeta = document.querySelector("#columns-meta");
    const columnsPanel = document.querySelector("#columns-panel");
    const columnsList = document.querySelector("#columns-list");
    const selectedColumnsStatus = document.querySelector("#selected-columns");
    const parseControls = document.querySelector("#parse-controls");
    const parseSourceInputs = document.querySelectorAll("input[name='omrade-plats-source']");
    const showPlaceNumberInput = document.querySelector("#show-place-number");
    const showColumnNamesInput = document.querySelector("#show-column-names");
    const tableMeta = document.querySelector("#table-meta");
    const tablePanel = document.querySelector("#table-panel");
    const tableWrap = document.querySelector("#table-wrap");
    const selectedTable = document.querySelector("#selected-table");
    const excelTypes = [".xls", ".xlsx"];
    const drawioTypes = [".drawio", ".drawio.xml"];
    let selectedColumnIndexes = [];
    let excelColumns = [];
    let excelRows = [];
    let rawExcelRows = [];
    let parsedOmradePlatsColumnIndex = null;
    let sourceDrawioXml = "";
    let sourceDrawioFileName = "";
    let pendingDrawioXml = "";
    let pendingGeneratedDrawioXml = "";
    let missingPeopleRows = [];
    let selectedTableSortColumnIndex = null;
    let selectedTableSortDirection = "asc";
    let missingSortColumn = "place";
    let missingSortDirection = "asc";
    let scrollRestoreToken = 0;

    function preserveWindowScroll(callback) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const token = ++scrollRestoreToken;
      const restoreScroll = () => {
        if (token === scrollRestoreToken) {
          window.scrollTo(scrollX, scrollY);
        }
      };

      callback();
      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
      [0, 50, 150, 300].forEach((delay) => {
        setTimeout(restoreScroll, delay);
      });
    }

    function cancelPendingScrollRestore() {
      scrollRestoreToken += 1;
    }

    function openFeedbackEmail() {
      const user = ["led", "karsson"].join(".");
      const domain = ["gmail", "com"].join(".");
      const subject = encodeURIComponent("Feedback kartgenerator");

      window.location.href = `mailto:${user}@${domain}?subject=${subject}`;
    }

    async function downloadExampleFile(event) {
      event.preventDefault();

      const link = event.currentTarget;
      const fileName = link.getAttribute("download") || link.href.split("/").pop() || "exempel";

      try {
        const response = await fetch(link.href);

        if (!response.ok) {
          throw new Error("Could not fetch example file.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");

        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        window.location.href = link.href;
      }
    }

    function clearColumns(message) {
      columnsMeta.textContent = message;
      columnsPanel.hidden = true;
      tablePanel.hidden = true;
      columnsList.replaceChildren();
      selectedColumnIndexes = [];
      excelColumns = [];
      excelRows = [];
      rawExcelRows = [];
      missingPeopleRows = [];
      selectedTableSortColumnIndex = null;
      selectedTableSortDirection = "asc";
      parsedOmradePlatsColumnIndex = null;
      parseControls.classList.remove("is-visible");
      selectedColumnsStatus.textContent = "No columns selected.";
      renderSelectedTable();
      updateGeneratedDiagram();
      updateMissingPeopleList();
    }

    function updateSelectedColumnsStatus() {
      if (selectedColumnIndexes.length === 0) {
        selectedColumnsStatus.textContent = "No columns selected.";
        return;
      }

      const selectedNames = selectedColumnIndexes.map((columnIndex) => excelColumns[columnIndex].name);
      selectedColumnsStatus.textContent = `${selectedColumnIndexes.length} selected: ${selectedNames.join(", ")}`;
    }

    function normalizeColumnName(columnName) {
      return String(columnName)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function parseOmradePlatsValue(value, source) {
      const text = value === null || value === undefined ? "" : String(value);
      const sourcePattern = source === "brygga" ? "(?:brygga|vinterplats(?:er)?)" : "varvsomr(?:a|å)de";
      const sourceMatch = text.match(new RegExp(`${sourcePattern}[\\s\\S]*?plats\\s*:\\s*([0-9A-Za-zÅÄÖåäö-]+)`, "i"));

      if (sourceMatch) {
        return sourceMatch[1];
      }

      const directSourceMatch = text.match(new RegExp(`${sourcePattern}\\s*[:\\-]\\s*([0-9]+[A-Za-zÅÄÖåäö-]?)`, "i"));

      if (directSourceMatch) {
        return directSourceMatch[1];
      }

      const dashMatch = text.match(new RegExp(`${sourcePattern}[\\s\\S]*?-\\s*([0-9A-Za-zÅÄÖåäö-]+)`, "i"));

      if (dashMatch) {
        return dashMatch[1];
      }

      return "";
    }

    function normalizePlaceCode(value) {
      return String(value || "").trim().toUpperCase();
    }

    function getSelectedParseSource() {
      const selectedInput = [...parseSourceInputs].find((input) => input.checked);
      return selectedInput ? selectedInput.value : "varvsomrade";
    }

    function setSelectedParseSource(source) {
      parseSourceInputs.forEach((input) => {
        input.checked = input.value === source;
      });
    }

    function countMatchingMapPlaces(rows, omradePlatsColumnIndex, source) {
      const mapPlaces = getMapPlaceLabels(sourceDrawioXml);
      const matchedPlaces = new Set();

      rows.forEach((row) => {
        const place = parseOmradePlatsValue(row[omradePlatsColumnIndex], source);
        const normalizedPlace = normalizePlaceCode(place);

        if (normalizedPlace && mapPlaces.has(normalizedPlace)) {
          matchedPlaces.add(normalizedPlace);
        }
      });

      return matchedPlaces.size;
    }

    function detectParseSource(rows, omradePlatsColumnIndex) {
      if (sourceDrawioXml) {
        const varvsomradeMatches = countMatchingMapPlaces(rows, omradePlatsColumnIndex, "varvsomrade");
        const bryggaMatches = countMatchingMapPlaces(rows, omradePlatsColumnIndex, "brygga");

        if (varvsomradeMatches !== bryggaMatches) {
          setSelectedParseSource(varvsomradeMatches > bryggaMatches ? "varvsomrade" : "brygga");
          return;
        }
      }

      const sampleValues = rows
        .slice(0, 50)
        .map((row) => String(row[omradePlatsColumnIndex] || ""));
      const hasVarvsomrade = sampleValues.some((value) => /varvsomr(?:a|å)de/i.test(value));
      const hasBryggaDashPlace = sampleValues.some((value) => /(?:brygga|vinterplats(?:er)?)[\s\S]*?-\s*[0-9]+[A-Za-zÅÄÖåäö]?/i.test(value));

      if (!hasVarvsomrade && hasBryggaDashPlace) {
        setSelectedParseSource("brygga");
      }
    }

    function parseRows(columns, rows, shouldDetectParseSource = true) {
      const omradePlatsColumn = columns.find((column) => normalizeColumnName(column.name) === "omrade/plats");

      if (!omradePlatsColumn) {
        parsedOmradePlatsColumnIndex = null;
        return rows;
      }

      parsedOmradePlatsColumnIndex = omradePlatsColumn.index;

      if (shouldDetectParseSource) {
        detectParseSource(rows, omradePlatsColumn.index);
      }

      return rows.map((row) => {
        const parsedRow = [...row];
        parsedRow[omradePlatsColumn.index] = parseOmradePlatsValue(row[omradePlatsColumn.index], getSelectedParseSource());
        return parsedRow;
      });
    }

    function reparseRows(shouldDetectParseSource = false) {
      if (excelColumns.length === 0 || rawExcelRows.length === 0) {
        return;
      }

      excelRows = parseRows(excelColumns, rawExcelRows, shouldDetectParseSource);
      renderSelectedTable();
    }

    function updateParseControlsVisibility() {
      const shouldShow = parsedOmradePlatsColumnIndex !== null
        && selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex);

      parseControls.classList.toggle("is-visible", shouldShow);
    }

    function getVisibleRows() {
      return selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)
        ? excelRows.filter((row) => {
          const value = row[parsedOmradePlatsColumnIndex];
          return value !== null && value !== undefined && String(value).trim() !== "";
        })
        : excelRows;
    }

    function getSortedSelectedRows(rows) {
      if (selectedTableSortColumnIndex === null || !selectedColumnIndexes.includes(selectedTableSortColumnIndex)) {
        return rows;
      }

      return [...rows].sort((left, right) => {
        const leftValue = left[selectedTableSortColumnIndex] === null || left[selectedTableSortColumnIndex] === undefined
          ? ""
          : String(left[selectedTableSortColumnIndex]);
        const rightValue = right[selectedTableSortColumnIndex] === null || right[selectedTableSortColumnIndex] === undefined
          ? ""
          : String(right[selectedTableSortColumnIndex]);
        const result = leftValue.localeCompare(rightValue, "sv", { numeric: true, sensitivity: "base" });

        return selectedTableSortDirection === "asc" ? result : -result;
      });
    }

    function sortSelectedTable(columnIndex) {
      preserveWindowScroll(() => {
        if (selectedTableSortColumnIndex === columnIndex) {
          selectedTableSortDirection = selectedTableSortDirection === "asc" ? "desc" : "asc";
        } else {
          selectedTableSortColumnIndex = columnIndex;
          selectedTableSortDirection = "asc";
        }

        renderSelectedTable();
      });
    }

    function renderSelectedTable() {
      selectedTable.replaceChildren();
      updateParseControlsVisibility();

      if (selectedTableSortColumnIndex !== null && !selectedColumnIndexes.includes(selectedTableSortColumnIndex)) {
        selectedTableSortColumnIndex = null;
        selectedTableSortDirection = "asc";
      }

      if (selectedColumnIndexes.length === 0) {
        tableMeta.textContent = "Select columns to build a table.";
        tableWrap.hidden = true;
        updateGeneratedDiagram();
        return;
      }

      const visibleRows = getVisibleRows();
      updateMissingPeopleList();

      if (visibleRows.length === 0) {
        tableMeta.textContent = "No data rows found under the header row.";
        tableWrap.hidden = true;
        updateGeneratedDiagram();
        return;
      }

      const sortedRows = getSortedSelectedRows(visibleRows);
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      selectedColumnIndexes.forEach((columnIndex) => {
        const headerCell = document.createElement("th");
        const button = document.createElement("button");
        const directionMarker = selectedTableSortColumnIndex === columnIndex
          ? ` ${selectedTableSortDirection === "asc" ? "↑" : "↓"}`
          : "";

        button.className = "sort-button";
        button.type = "button";
        button.textContent = `${excelColumns[columnIndex].name}${directionMarker}`;
        button.addEventListener("click", () => sortSelectedTable(columnIndex));
        headerCell.append(button);
        headerRow.append(headerCell);
      });

      thead.append(headerRow);

      const tbody = document.createElement("tbody");
      const bodyFragment = document.createDocumentFragment();

      sortedRows.forEach((row) => {
        const tableRow = document.createElement("tr");

        selectedColumnIndexes.forEach((columnIndex) => {
          const cell = document.createElement("td");
          const value = row[columnIndex];
          cell.textContent = value === null || value === undefined ? "" : String(value);
          tableRow.append(cell);
        });

        bodyFragment.append(tableRow);
      });

      tbody.append(bodyFragment);
      selectedTable.append(thead, tbody);
      tableMeta.textContent = `${visibleRows.length} row${visibleRows.length === 1 ? "" : "s"} shown with ${selectedColumnIndexes.length} selected column${selectedColumnIndexes.length === 1 ? "" : "s"}.`;
      tableWrap.hidden = false;
      updateGeneratedDiagram();
    }

    function renderColumns(columns, sheetName) {
      columnsList.replaceChildren();
      excelColumns = columns;
      selectedColumnIndexes = ["omrade/plats", "fornamn", "efternamn"]
        .map((columnName) => columns.find((column) => normalizeColumnName(column.name) === columnName))
        .filter(Boolean)
        .map((column) => column.index);

      if (columns.length === 0) {
        columnsMeta.textContent = `No columns found in "${sheetName}".`;
        updateSelectedColumnsStatus();
        renderSelectedTable();
        return;
      }

      columnsMeta.textContent = `${columns.length} column${columns.length === 1 ? "" : "s"} found in "${sheetName}".`;

      columns.forEach((columnName) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const columnIndex = columnName.index;

        button.className = "column-button";
        button.type = "button";
        button.textContent = columnName.name;

        if (selectedColumnIndexes.includes(columnIndex)) {
          button.classList.add("is-selected");
          button.setAttribute("aria-pressed", "true");
        } else {
          button.setAttribute("aria-pressed", "false");
        }

        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
        });

        button.addEventListener("click", () => {
          preserveWindowScroll(() => {
            const isSelected = button.classList.toggle("is-selected");

            button.setAttribute("aria-pressed", String(isSelected));

            if (isSelected) {
              selectedColumnIndexes.push(columnIndex);
            } else {
              selectedColumnIndexes = selectedColumnIndexes.filter((selectedColumnIndex) => selectedColumnIndex !== columnIndex);
            }

            updateSelectedColumnsStatus();
            renderSelectedTable();
          });
        });

        item.append(button);
        columnsList.append(item);
      });

      updateSelectedColumnsStatus();
      renderSelectedTable();
    }

    function readColumns(file) {
      if (!window.XLSX) {
        fileStatus.textContent = "Excel reader could not load. Check your internet connection and refresh.";
        fileStatus.classList.add("has-error");
        clearColumns("Excel reader is not available.");
        return;
      }

      const reader = new FileReader();

      reader.addEventListener("load", (event) => {
        try {
          const workbook = XLSX.read(event.target.result, { type: "array" });
          const [firstSheetName] = workbook.SheetNames;

          if (!firstSheetName) {
            clearColumns("No sheets found in this workbook.");
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
          const headerRowIndex = rows.findIndex((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
          const headerRow = rows[headerRowIndex] || [];
          const columns = Array.from({ length: headerRow.length }, (_, index) => {
            const cell = headerRow[index];
            const value = cell === null || cell === undefined ? "" : String(cell).trim();
            return {
              index,
              name: value || `Column ${index + 1}`
            };
          });

          rawExcelRows = rows.slice(headerRowIndex + 1);
          excelRows = parseRows(columns, rawExcelRows);
          renderColumns(columns, firstSheetName);
        } catch (error) {
          fileStatus.textContent = "Could not read this Excel file.";
          fileStatus.classList.add("has-error");
          clearColumns("Try another .xls or .xlsx file.");
        }
      });

      reader.readAsArrayBuffer(file);
    }

    function showFile(file) {
      const fileName = file.name.toLowerCase();
      const isExcelFile = excelTypes.some((extension) => fileName.endsWith(extension));

      uploadZone.classList.remove("has-file");
      fileStatus.classList.remove("has-file", "has-error");

      if (!isExcelFile) {
        fileStatus.textContent = "Choose an Excel file ending in .xls or .xlsx.";
        fileStatus.classList.add("has-error");
        excelPanelTitle.textContent = "Excel data";
        excelUpload.value = "";
        uploadZone.hidden = false;
        clearColumns("Upload an Excel file to list its columns.");
        return;
      }

      fileStatus.textContent = "";
      fileStatus.classList.add("has-file");
      excelPanelTitle.textContent = file.name;
      clearExcelButton.hidden = false;
      uploadZone.classList.add("has-file");
      uploadZone.hidden = true;
      clearColumns("Reading columns...");
      columnsPanel.hidden = false;
      tablePanel.hidden = false;
      readColumns(file);
    }

    function showDrawioFile(file) {
      const fileName = file.name.toLowerCase();
      const isDrawioFile = drawioTypes.some((extension) => fileName.endsWith(extension));

      drawioUploadZone.classList.remove("has-error", "has-file");

      if (!isDrawioFile) {
        drawioUploadZone.textContent = "Choose a draw.io file ending in .drawio or .drawio.xml.";
        drawioUploadZone.classList.add("has-error");
        drawioPanelTitle.textContent = "draw.io diagram";
        drawioUploadZone.append(drawioUpload);
        drawioUpload.value = "";
        sourceDrawioXml = "";
        sourceDrawioFileName = "";
        drawioViewer.hidden = true;
        drawioUploadZone.hidden = false;
        updateMissingPeopleList();
        updateGeneratedDiagram();
        return;
      }

      drawioPanelTitle.textContent = file.name;
      clearDrawioButton.hidden = false;
      sourceDrawioFileName = file.name;
      drawioUploadZone.textContent = "";
      drawioUploadZone.classList.add("has-file");
      drawioUploadZone.append(drawioUpload);
      drawioUploadZone.hidden = true;
      readDrawioFile(file);
    }

    function clearExcelFile() {
      excelUpload.value = "";
      excelPanelTitle.textContent = "Excel data från BAS rapport";
      clearExcelButton.hidden = true;
      uploadZone.hidden = false;
      uploadZone.classList.remove("has-file");
      fileStatus.textContent = "";
      fileStatus.classList.remove("has-file", "has-error");
      clearColumns("Upload an Excel file to list its columns.");
    }

    function clearDrawioFile() {
      drawioUpload.value = "";
      drawioPanelTitle.textContent = "draw.io diagram";
      clearDrawioButton.hidden = true;
      drawioUploadZone.hidden = false;
      drawioUploadZone.classList.remove("has-file", "has-error");
      drawioUploadZone.textContent = "Ladda upp en draw.io fil";
      drawioUploadZone.append(drawioUpload);
      drawioViewer.hidden = true;
      sourceDrawioXml = "";
      sourceDrawioFileName = "";
      pendingDrawioXml = "";
      updateMissingPeopleList();
      updateGeneratedDiagram();
    }

    function loadDrawioXml(frame, xml) {
      frame.contentWindow.postMessage(JSON.stringify({
        action: "load",
        xml,
        autosave: 0,
        modified: 0
      }), "*");
    }

    function loadDrawioViewer(xml) {
      pendingDrawioXml = xml;
      drawioViewer.hidden = false;
      loadDrawioXml(drawioFrame, xml);
    }

    function loadGeneratedViewer(xml) {
      preserveWindowScroll(() => {
        pendingGeneratedDrawioXml = xml;
        generatedEmpty.hidden = true;
        generatedViewer.hidden = false;
        downloadGeneratedButton.disabled = false;
        downloadGeneratedPngButton.disabled = false;
        loadDrawioXml(generatedFrame, xml);
      });
    }

    function showGeneratedMessage(message) {
      preserveWindowScroll(() => {
        pendingGeneratedDrawioXml = "";
        generatedViewer.hidden = true;
        generatedEmpty.hidden = false;
        generatedEmpty.textContent = message;
        downloadGeneratedButton.disabled = true;
        downloadGeneratedPngButton.disabled = true;
      });
    }

    function downloadGeneratedDiagram() {
      if (!pendingGeneratedDrawioXml) {
        return;
      }

      const blob = new Blob([pendingGeneratedDrawioXml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getGeneratedDrawioFileName();
      link.click();
      URL.revokeObjectURL(url);
    }

    function downloadGeneratedPng() {
      if (!pendingGeneratedDrawioXml) {
        return;
      }

      generatedFrame.contentWindow.postMessage(JSON.stringify({
        action: "export",
        format: "png",
        xml: pendingGeneratedDrawioXml,
        scale: 1,
        border: 8,
        bg: "#ffffff",
        background: "#ffffff"
      }), "*");
    }

    function getGeneratedDrawioFileName() {
      const fallbackName = "genererad_karta.drawio";
      const fileName = sourceDrawioFileName || fallbackName;
      const drawioXmlSuffix = ".drawio.xml";

      if (fileName.toLowerCase().endsWith(drawioXmlSuffix)) {
        return `${fileName.slice(0, -drawioXmlSuffix.length)}-genererad${drawioXmlSuffix}`;
      }

      const dotIndex = fileName.lastIndexOf(".");

      if (dotIndex > 0) {
        return `${fileName.slice(0, dotIndex)}-genererad${fileName.slice(dotIndex)}`;
      }

      return `${fileName}-genererad.drawio`;
    }

    function getGeneratedPngFileName() {
      const drawioFileName = getGeneratedDrawioFileName();
      const drawioXmlSuffix = ".drawio.xml";

      if (drawioFileName.toLowerCase().endsWith(drawioXmlSuffix)) {
        return `${drawioFileName.slice(0, -drawioXmlSuffix.length)}.png`;
      }

      const dotIndex = drawioFileName.lastIndexOf(".");

      if (dotIndex > 0) {
        return `${drawioFileName.slice(0, dotIndex)}.png`;
      }

      return `${drawioFileName}.png`;
    }

    function downloadDataUrl(dataUrl, fileName) {
      const link = document.createElement("a");

      link.href = dataUrl;
      link.download = fileName;
      link.click();
    }

    function downloadPngWithWhiteBackground(dataUrl, fileName) {
      const image = new Image();

      image.addEventListener("load", () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        downloadDataUrl(canvas.toDataURL("image/png"), fileName);
      });

      image.addEventListener("error", () => {
        downloadDataUrl(dataUrl, fileName);
      });

      image.src = dataUrl;
    }

    function drawioLabelToText(value) {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = String(value || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]*>/g, "");

      return textarea.value.trim();
    }

    function makeDrawioLabel(row) {
      const fornamnColumnIndex = excelColumns.findIndex((column) => normalizeColumnName(column.name) === "fornamn");
      const efternamnColumnIndex = excelColumns.findIndex((column) => normalizeColumnName(column.name) === "efternamn");
      const shouldCombineName = selectedColumnIndexes.includes(fornamnColumnIndex)
        && selectedColumnIndexes.includes(efternamnColumnIndex);
      const lines = [];

      selectedColumnIndexes.forEach((columnIndex) => {
        const value = row[columnIndex];

        if (value === null || value === undefined || String(value).trim() === "") {
          return;
        }

        if (columnIndex === parsedOmradePlatsColumnIndex) {
          if (showPlaceNumberInput.checked) {
            lines.push(String(value).trim());
          }

          return;
        }

        if (shouldCombineName && columnIndex === fornamnColumnIndex) {
          const firstName = String(value).trim();
          const lastName = row[efternamnColumnIndex] === null || row[efternamnColumnIndex] === undefined
            ? ""
            : String(row[efternamnColumnIndex]).trim();
          const fullName = `${firstName} ${lastName}`.trim();

          lines.push(showColumnNamesInput.checked ? `Namn: ${fullName}` : fullName);
          return;
        }

        if (shouldCombineName && columnIndex === efternamnColumnIndex) {
          return;
        }

        lines.push(showColumnNamesInput.checked
          ? `${excelColumns[columnIndex].name}: ${String(value).trim()}`
          : String(value).trim());
      });

      return lines.join("<br>");
    }

    function isPlaceBoxLabel(label) {
      return /^[0-9]+[A-Za-zÅÄÖåäö]?$/.test(String(label).trim());
    }

    function getColumnIndexByName(columnName) {
      const normalizedName = normalizeColumnName(columnName);
      return excelColumns.findIndex((column) => normalizeColumnName(column.name) === normalizedName);
    }

    function getMapPlaceLabels(xml) {
      if (!xml) {
        return new Set();
      }

      const parser = new DOMParser();
      const documentXml = parser.parseFromString(xml, "application/xml");

      if (documentXml.querySelector("parsererror")) {
        return new Set();
      }

      const labels = new Set();

      documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
        const label = drawioLabelToText(cell.getAttribute("value"));

        if (isPlaceBoxLabel(label)) {
          labels.add(normalizePlaceCode(label));
        }
      });

      return labels;
    }

    function renderMissingPeopleTable(rows) {
      missingTable.replaceChildren();

      if (rows.length === 0) {
        missingMeta.textContent = "Alla rader med fornamn, efternamn och plats finns i kartan.";
        missingWrap.hidden = true;
        downloadMissingButton.disabled = true;
        return;
      }

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      [
        ["place", "Plats"],
        ["firstName", "Fornamn"],
        ["lastName", "Efternamn"]
      ].forEach(([columnKey, header]) => {
        const headerCell = document.createElement("th");
        const button = document.createElement("button");
        const directionMarker = missingSortColumn === columnKey
          ? ` ${missingSortDirection === "asc" ? "↑" : "↓"}`
          : "";

        button.className = "sort-button";
        button.type = "button";
        button.textContent = `${header}${directionMarker}`;
        button.addEventListener("click", () => sortMissingPeople(columnKey));
        headerCell.append(button);
        headerRow.append(headerCell);
      });

      thead.append(headerRow);

      const tbody = document.createElement("tbody");
      const fragment = document.createDocumentFragment();

      rows.forEach((row) => {
        const tableRow = document.createElement("tr");

        [row.place, row.firstName, row.lastName].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          tableRow.append(cell);
        });

        fragment.append(tableRow);
      });

      tbody.append(fragment);
      missingTable.append(thead, tbody);
      missingMeta.textContent = `${rows.length} person${rows.length === 1 ? "" : "er"} finns i BAS men saknas i kartan.`;
      missingWrap.hidden = false;
      downloadMissingButton.disabled = false;
    }

    function getSortedMissingPeopleRows() {
      return [...missingPeopleRows].sort((left, right) => {
        const leftValue = String(left[missingSortColumn] || "").localeCompare(
          String(right[missingSortColumn] || ""),
          "sv",
          { numeric: true, sensitivity: "base" }
        );

        return missingSortDirection === "asc" ? leftValue : -leftValue;
      });
    }

    function sortMissingPeople(columnKey) {
      if (missingSortColumn === columnKey) {
        missingSortDirection = missingSortDirection === "asc" ? "desc" : "asc";
      } else {
        missingSortColumn = columnKey;
        missingSortDirection = "asc";
      }

      renderMissingPeopleTable(getSortedMissingPeopleRows());
    }

    function updateMissingPeopleList() {
      const firstNameColumnIndex = getColumnIndexByName("fornamn");
      const lastNameColumnIndex = getColumnIndexByName("efternamn");

      if (!sourceDrawioXml || parsedOmradePlatsColumnIndex === null || firstNameColumnIndex < 0 || lastNameColumnIndex < 0 || excelRows.length === 0) {
        missingPanel.hidden = true;
        missingPeopleRows = [];
        downloadMissingButton.disabled = true;
        return;
      }

      const mapPlaces = getMapPlaceLabels(sourceDrawioXml);
      const missingRows = excelRows
        .map((row) => ({
          place: String(row[parsedOmradePlatsColumnIndex] || "").trim(),
          firstName: String(row[firstNameColumnIndex] || "").trim(),
          lastName: String(row[lastNameColumnIndex] || "").trim()
        }))
        .filter((row) => row.place && row.firstName && row.lastName && !mapPlaces.has(normalizePlaceCode(row.place)));

      missingPanel.hidden = false;
      missingPeopleRows = missingRows;
      renderMissingPeopleTable(getSortedMissingPeopleRows());
    }

    function downloadMissingPeopleExcel() {
      if (!window.XLSX || missingPeopleRows.length === 0) {
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(getSortedMissingPeopleRows().map((row) => ({
        Plats: row.place,
        Fornamn: row.firstName,
        Efternamn: row.lastName
      })));
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Saknas i kartan");
      XLSX.writeFile(workbook, "saknas_i_kartan.xlsx");
    }

    function createGeneratedDrawioXml(xml, rows) {
      const parser = new DOMParser();
      const documentXml = parser.parseFromString(xml, "application/xml");

      if (documentXml.querySelector("parsererror")) {
        throw new Error("Could not parse draw.io XML.");
      }

      const rowsByPlace = new Map();

      rows.forEach((row) => {
        const place = String(row[parsedOmradePlatsColumnIndex] || "").trim();
        const normalizedPlace = normalizePlaceCode(place);

        if (normalizedPlace) {
          rowsByPlace.set(normalizedPlace, row);
        }
      });

      documentXml.querySelectorAll("mxCell[vertex='1']").forEach((cell) => {
        const label = drawioLabelToText(cell.getAttribute("value"));

        if (!isPlaceBoxLabel(label)) {
          return;
        }

        const row = rowsByPlace.get(normalizePlaceCode(label));

        if (row) {
          const generatedLabel = makeDrawioLabel(row);
          cell.setAttribute("value", generatedLabel || `${label}<br>Tom plats`);

          if (!generatedLabel) {
            markCellAsEmptyPlace(cell);
          }
        } else if (label) {
          cell.setAttribute("value", `${label}<br>Tom plats`);
          markCellAsEmptyPlace(cell);
        }
      });

      return new XMLSerializer().serializeToString(documentXml);
    }

    function markCellAsEmptyPlace(cell) {
      const style = cell.getAttribute("style") || "";
      const styleParts = style
        .split(";")
        .filter((part) => part && !part.startsWith("fillColor=") && !part.startsWith("strokeColor="));

      cell.setAttribute("style", styleParts.join(";"));
    }

    function updateGeneratedDiagram() {
      if (!sourceDrawioXml) {
        showGeneratedMessage("Ladda upp Excel-fil och drawio-fil.");
        return;
      }

      if (parsedOmradePlatsColumnIndex === null || !selectedColumnIndexes.includes(parsedOmradePlatsColumnIndex)) {
        showGeneratedMessage("Ladda upp Excel-fil och drawio-fil.");
        return;
      }

      const visibleRows = getVisibleRows();

      if (visibleRows.length === 0) {
        showGeneratedMessage("No matching område/plats rows to place in the generated diagram.");
        return;
      }

      try {
        loadGeneratedViewer(createGeneratedDrawioXml(sourceDrawioXml, visibleRows));
      } catch (error) {
        showGeneratedMessage("Could not generate a draw.io diagram from this file.");
      }
    }

    function readDrawioFile(file) {
      const reader = new FileReader();

      reader.addEventListener("load", (event) => {
        const xml = String(event.target.result || "").trim();

        if (!xml) {
          drawioUploadZone.textContent = "This draw.io file is empty.";
          drawioUploadZone.classList.add("has-error");
          drawioUploadZone.append(drawioUpload);
          sourceDrawioXml = "";
          sourceDrawioFileName = "";
          drawioViewer.hidden = true;
          drawioUploadZone.hidden = false;
          updateMissingPeopleList();
          updateGeneratedDiagram();
          return;
        }

        sourceDrawioXml = xml;
        loadDrawioViewer(xml);
        if (excelColumns.length > 0 && rawExcelRows.length > 0) {
          reparseRows(true);
        } else {
          updateMissingPeopleList();
          updateGeneratedDiagram();
        }
      });

      reader.addEventListener("error", () => {
        drawioUploadZone.textContent = "Could not read this draw.io file.";
        drawioUploadZone.classList.add("has-error");
        drawioUploadZone.append(drawioUpload);
        sourceDrawioXml = "";
        sourceDrawioFileName = "";
        updateMissingPeopleList();
        updateGeneratedDiagram();
      });

      reader.readAsText(file);
    }

    excelUpload.addEventListener("change", () => {
      const [file] = excelUpload.files;

      if (file) {
        showFile(file);
      }
    });

    drawioUpload.addEventListener("change", () => {
      const [file] = drawioUpload.files;

      if (file) {
        showDrawioFile(file);
      }
    });

    parseSourceInputs.forEach((input) => {
      input.addEventListener("change", () => preserveWindowScroll(() => reparseRows(false)));
    });

    showPlaceNumberInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
    showColumnNamesInput.addEventListener("change", () => preserveWindowScroll(updateGeneratedDiagram));
    feedbackEmailButton.addEventListener("click", openFeedbackEmail);
    exampleDownloadLinks.forEach((link) => {
      link.addEventListener("click", downloadExampleFile);
    });
    downloadGeneratedButton.addEventListener("click", downloadGeneratedDiagram);
    downloadGeneratedPngButton.addEventListener("click", downloadGeneratedPng);
    downloadMissingButton.addEventListener("click", downloadMissingPeopleExcel);
    clearExcelButton.addEventListener("click", clearExcelFile);
    clearDrawioButton.addEventListener("click", clearDrawioFile);
    window.addEventListener("wheel", cancelPendingScrollRestore, { passive: true });
    window.addEventListener("touchmove", cancelPendingScrollRestore, { passive: true });
    window.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) {
        cancelPendingScrollRestore();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.remove("is-dragging");
      });
    });

    uploadZone.addEventListener("drop", (event) => {
      const [file] = event.dataTransfer.files;

      if (file) {
        showFile(file);
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      drawioUploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        drawioUploadZone.classList.add("is-dragging-drawio");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      drawioUploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        drawioUploadZone.classList.remove("is-dragging-drawio");
      });
    });

    drawioUploadZone.addEventListener("drop", (event) => {
      const [file] = event.dataTransfer.files;

      if (file) {
        showDrawioFile(file);
      }
    });

    window.addEventListener("message", (event) => {
      if (!String(event.origin).includes("diagrams.net")) {
        return;
      }

      let message;

      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }

      if (message.event === "init" && event.source === drawioFrame.contentWindow && pendingDrawioXml) {
        loadDrawioViewer(pendingDrawioXml);
      }

      if (message.event === "init" && event.source === generatedFrame.contentWindow && pendingGeneratedDrawioXml) {
        loadGeneratedViewer(pendingGeneratedDrawioXml);
      }

      if (message.event === "export" && event.source === generatedFrame.contentWindow && typeof message.data === "string" && message.data.startsWith("data:image/png")) {
        downloadPngWithWhiteBackground(message.data, getGeneratedPngFileName());
      }
    });


