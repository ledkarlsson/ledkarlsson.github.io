export function parseOmradePlatsValue(value, source) {
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