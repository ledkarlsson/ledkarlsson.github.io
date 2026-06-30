import { expect, test } from "@playwright/test";

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

async function downloadExampleFile(page, linkName, testInfo) {
  return test.step(`Download ${linkName}`, async () => {
    const downloadPromise = page.waitForEvent("download");

    await page.getByRole("link", { name: linkName }).click();

    const download = await downloadPromise;
    const filePath = testInfo.outputPath(download.suggestedFilename());

    await download.saveAs(filePath);

    return filePath;
  });
}

async function scrollToCenter(page, selector) {
  await page.waitForTimeout(350);

  const scrollDelta = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2 - window.innerHeight / 2;
  });

  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, scrollDelta);
  await page.waitForTimeout(100);
}

test.beforeEach(async ({ page }) => {
  await mockExternalScripts(page);
});

test("renders the kartgenerator workspace", async ({ page }) => {
  await test.step("Open kartgenerator", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  await test.step("Assert initial workspace state", async () => {
    await expect(page.getByRole("heading", { name: "kartgenerator" })).toBeVisible();
    await expect(page.locator("#upload-zone .upload-title")).toHaveText("Ladda upp Excel-fil");
    await expect(page.getByLabel("Kartgenerator workspace preview")).toContainText("Ladda upp en draw.io fil");
    await expect(page.locator("#generated-empty")).toHaveText("Ladda upp Excel-fil och drawio-fil.");
    await expect(page.locator("#download-generated")).toBeDisabled();
    await expect(page.locator("#download-generated-png")).toBeDisabled();
  });
});

test("loads downloaded Excel example data and renders the selected columns table", async ({ page }, testInfo) => {
  await test.step("Open kartgenerator", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  const excelExamplePath = await downloadExampleFile(page, "Ladda ner exempel-Excel", testInfo);

  await test.step("Upload downloaded Excel example", async () => {
    await page.locator("#excel-upload").setInputFiles(excelExamplePath);
  });

  await test.step("Scroll to selected table", async () => {
    await scrollToCenter(page, "#table-panel");
  });

  await test.step("Assert selected columns table", async () => {
    await expect(page.locator("#columns-panel")).toBeVisible();
    await expect(page.locator("#columns-meta")).toHaveText('3 columns found in "BAS".');
    await expect(page.locator("#selected-columns")).toHaveText("3 selected: Omrade/Plats, Fornamn, Efternamn");
    await expect(page.locator("#table-meta")).toHaveText("2 rows shown with 3 selected columns.");
    await expect(page.locator("#selected-table")).toContainText("Anna");
    await expect(page.locator("#selected-table")).toContainText("Andersson");
    await expect(page.locator("#selected-table")).toContainText("53");
  });
});

test("enables generated draw.io output after downloading and uploading examples", async ({ page }, testInfo) => {
  await test.step("Open kartgenerator", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  const excelExamplePath = await downloadExampleFile(page, "Ladda ner exempel-Excel", testInfo);
  const drawioExamplePath = await downloadExampleFile(page, "Ladda ner exempel-draw.io", testInfo);

  await test.step("Upload downloaded examples", async () => {
    await page.locator("#excel-upload").setInputFiles(excelExamplePath);
    await page.locator("#drawio-upload").setInputFiles(drawioExamplePath);
  });

  await test.step("Scroll to generated diagram", async () => {
    await scrollToCenter(page, "#generated-title");
  });

  await test.step("Assert generated diagram and missing-place report", async () => {
    await expect(page.locator("#download-generated")).toBeEnabled();
    await expect(page.locator("#download-generated-png")).toBeEnabled();
    await expect(page.locator("#generated-viewer")).toBeVisible();
  });

  await test.step("Scroll to missing-place report", async () => {
    await scrollToCenter(page, "#missing-title");
  });

  await test.step("Assert missing-place report", async () => {
    await expect(page.locator("#missing-panel")).toBeVisible();
    await expect(page.locator("#missing-meta")).toHaveText("1 person finns i BAS men saknas i kartan.");
    await expect(page.locator("#missing-table")).toContainText("99");
    await expect(page.locator("#missing-table")).toContainText("Bo");
  });
});
