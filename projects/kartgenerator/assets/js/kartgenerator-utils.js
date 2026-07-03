export function drawioLabelToText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return textarea.value.trim();
}

export function normalizeColumnName(columnName) {
  return String(columnName)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizePlaceCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function isPlaceBoxLabel(label) {
  return /^[0-9]+[A-Za-zÅÄÖåäö]?$/.test(String(label).trim());
}

export function parseOmradePlatsValue(value, source) {
  const text = value === null || value === undefined ? "" : String(value);
  const sourcePatterns = {
    varvsomrade: "varvsomr(?:a|å)de",
    brygga: "brygga",
    vinterplats: "vinterplats(?:er)?"
  };
  const sourcePattern = sourcePatterns[source];

  if (!sourcePattern) {
    return "";
  }

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
