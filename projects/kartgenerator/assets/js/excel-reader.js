export class ExcelReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExcelReadError";
    this.code = code;
  }
}

export function parseExcelWorkbook(data, xlsx) {
  const workbook = xlsx.read(data, { type: "array" });
  const [sheetName] = workbook.SheetNames;

  if (!sheetName) {
    throw new ExcelReadError("no-sheets", "Inga blad hittades i arbetsboken.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== "")
  );
  const headerRow = rows[headerRowIndex] || [];
  const columns = Array.from({ length: headerRow.length }, (_, index) => {
    const cell = headerRow[index];
    const value = cell === null || cell === undefined ? "" : String(cell).trim();

    return {
      index,
      name: value || `Kolumn ${index + 1}`
    };
  });

  return {
    columns,
    rows: rows.slice(headerRowIndex + 1),
    sheetName
  };
}

export function readExcelFile(file, options = {}) {
  const xlsx = options.xlsx || window.XLSX;
  const FileReaderClass = options.FileReaderClass || FileReader;

  if (!xlsx) {
    return Promise.reject(new ExcelReadError(
      "unavailable",
      "Excel-läsaren kunde inte laddas."
    ));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReaderClass();

    reader.addEventListener("load", (event) => {
      try {
        resolve(parseExcelWorkbook(event.target.result, xlsx));
      } catch (error) {
        reject(error instanceof ExcelReadError
          ? error
          : new ExcelReadError("invalid", "Kunde inte läsa Excel-filen."));
      }
    });

    reader.addEventListener("error", () => {
      reject(new ExcelReadError("unreadable", "Kunde inte läsa Excel-filen."));
    });

    reader.readAsArrayBuffer(file);
  });
}
