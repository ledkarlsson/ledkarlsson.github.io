// Wildcards are literal except for *. No regular-expression syntax is accepted.
export function matchAreaPatterns(areas, input) {
  const patterns = String(input).split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
  const expressions = patterns.map(pattern => new RegExp(`^${pattern.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "iu"));
  return areas.filter(area => expressions.some(expression => expression.test(area)));
}
