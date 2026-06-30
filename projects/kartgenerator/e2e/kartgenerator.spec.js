import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const examplesDir = path.join(projectRoot, "assets", "examples");
const excelExamplePath = path.join(examplesDir, "exempel.xlsx");
const drawioExamplePath = path.join(examplesDir, "exempel.drawio");

async function mockExternalScripts(page) {
  await page.route("https://cdn.sheetjs.com/**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.XLSX = {
          read() {
            return {
              SheetNames: ["BAS"],
              Sheets: { BAS: {} }
            };
          },
          utils: {
            sheet_to_json() {
              return [
                ["Omrade/Plats", "Fornamn", "Efternamn"],
                ["Varvsomrade Alpha plats: 53", "Anna", "Andersson"],
                ["Varvsomrade Alpha plats: 99", "Bo", "Bengtsson"]
              ];
            },
            json_to_sheet(rows) {
              return { rows };
            },
            book_new() {
              return {};
            },
            book_append_sheet() {}
          },
          writeFile() {}
        };
      `
    });
  });

  await page.route("https://embed.diagrams.net/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>draw.io test frame</title>"
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockExternalScripts(page);
});

test("renders the kartgenerator workspace", async ({ page }) => {
  await page.goto("/projects/kartgenerator/");

  await expect(page.getByRole("heading", { name: "kartgenerator" })).toBeVisible();
  await expect(page.locator("#upload-zone .upload-title")).toHaveText("Ladda upp Excel-fil");
  await expect(page.getByLabel("Kartgenerator workspace preview")).toContainText("Ladda upp en draw.io fil");
  await expect(page.locator("#generated-empty")).toHaveText("Ladda upp Excel-fil och drawio-fil.");
  await expect(page.locator("#download-generated")).toBeDisabled();
  await expect(page.locator("#download-generated-png")).toBeDisabled();
});

test("loads Excel data and renders the selected columns table", async ({ page }) => {
  await page.goto("/projects/kartgenerator/");

  await page.locator("#excel-upload").setInputFiles(excelExamplePath);

  await expect(page.locator("#columns-panel")).toBeVisible();
  await expect(page.locator("#columns-meta")).toHaveText('3 columns found in "BAS".');
  await expect(page.locator("#selected-columns")).toHaveText("3 selected: Omrade/Plats, Fornamn, Efternamn");
  await expect(page.locator("#table-meta")).toHaveText("2 rows shown with 3 selected columns.");
  await expect(page.locator("#selected-table")).toContainText("Anna");
  await expect(page.locator("#selected-table")).toContainText("Andersson");
  await expect(page.locator("#selected-table")).toContainText("53");
});

test("enables generated draw.io output after Excel and draw.io uploads", async ({ page }) => {
  await page.goto("/projects/kartgenerator/");

  await page.locator("#excel-upload").setInputFiles(excelExamplePath);
  await page.locator("#drawio-upload").setInputFiles(drawioExamplePath);

  await expect(page.locator("#download-generated")).toBeEnabled();
  await expect(page.locator("#download-generated-png")).toBeEnabled();
  await expect(page.locator("#generated-viewer")).toBeVisible();
  await expect(page.locator("#missing-panel")).toBeVisible();
  await expect(page.locator("#missing-meta")).toHaveText("1 person finns i BAS men saknas i kartan.");
  await expect(page.locator("#missing-table")).toContainText("99");
  await expect(page.locator("#missing-table")).toContainText("Bo");
});
