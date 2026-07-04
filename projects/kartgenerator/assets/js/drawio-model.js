export const newPlacePlaceholder = "ny plats";
export const newPlaceBoxStyle = "rounded=0;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;";

function getCellStyleWithoutColor(cell) {
  const style = cell.getAttribute("style") || "";
  return style
    .split(";")
    .filter((part) => part && !part.startsWith("fillColor=") && !part.startsWith("strokeColor="));
}

export function removeNewPlacePlaceholder(cell) {
  cell.removeAttribute("data-kartgenerator-placeholder");
  cell.setAttribute("style", `${getCellStyleWithoutColor(cell).join(";")};`);
}
