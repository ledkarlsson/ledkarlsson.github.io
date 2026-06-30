import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const sheetJsBundlePath = path.join(process.cwd(), "node_modules", "xlsx", "dist", "xlsx.full.min.js");

async function mockExternalScripts(page) {
  await page.route("https://cdn.sheetjs.com/**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: await readFile(sheetJsBundlePath, "utf8")
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
  return test.step(`Ladda ner ${linkName}`, async () => {
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

function addDrawioPlaceBox(xml, place) {
  const cell = `<mxCell id="playwright-place-${place}" value="${place}" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="40" as="geometry"/></mxCell>`;

  return xml.replace("</root>", `${cell}</root>`);
}

test.beforeEach(async ({ page }) => {
  await mockExternalScripts(page);
});

test("visar kartgeneratorns arbetsyta", async ({ page }) => {
  await test.step("Öppna kartgeneratorn", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  await test.step("Kontrollera startläget", async () => {
    await expect(page.getByRole("heading", { name: "kartgenerator" })).toBeVisible();
    await expect(page.locator("#upload-zone .upload-title")).toHaveText("Ladda upp Excel-fil");
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Ladda upp draw.io-fil");
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja");
    await expect(page.locator("#feedback-email")).toHaveAttribute("href", "mailto:led.karlsson@gmail.com?subject=Feedback%20kartgenerator");
    await expect(page.locator("#generated-empty")).toHaveText("Ladda upp Excel-fil och drawio-fil.");
    await expect(page.locator("#download-generated")).toBeDisabled();
    await expect(page.locator("#download-generated-png")).toBeDisabled();
  });
});

test("genererar karta från nedladdade exempelfiler och visar saknad BAS-rad", async ({ page }, testInfo) => {
  await test.step("Öppna kartgeneratorn", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  const excelExamplePath = await downloadExampleFile(page, "Ladda ner exempel-Excel", testInfo);
  const drawioExamplePath = await downloadExampleFile(page, "Ladda ner exempel-draw.io", testInfo);

  await test.step("Ladda upp nedladdade exempel", async () => {
    await page.locator("#excel-upload").setInputFiles(excelExamplePath);
    await page.locator("#drawio-upload").setInputFiles(drawioExamplePath);
  });

  await test.step("Skrolla till vald tabell", async () => {
    await scrollToCenter(page, "#table-panel");
  });

  await test.step("Kontrollera vald kolumntabell", async () => {
    await expect(page.locator("#columns-panel")).toBeVisible();
    await expect(page.locator("#columns-meta")).toHaveText('5 kolumner hittades i "Rapport".');
    await expect(page.locator("#selected-columns")).toHaveText("3 valda: Område/plats, Förnamn, Efternamn");
    await expect(page.locator("#table-meta")).toHaveText("4 rader visas med 3 valda kolumner.");
    await expect(page.locator("#selected-table")).toContainText("Pelle");
    await expect(page.locator("#selected-table")).toContainText("Pelleson");
    await expect(page.locator("#selected-table")).toContainText("51");
  });

  await test.step("Skrolla till genererat diagram", async () => {
    await scrollToCenter(page, "#generated-title");
  });

  await test.step("Kontrollera genererat diagram", async () => {
    await expect(page.locator("#download-generated")).toBeEnabled();
    await expect(page.locator("#download-generated-png")).toBeEnabled();
    await expect(page.locator("#generated-viewer")).toBeVisible();
  });

  await test.step("Skrolla till rapport över saknade platser", async () => {
    await scrollToCenter(page, "#missing-title");
  });

  await test.step("Kontrollera rapport över saknade platser", async () => {
    await expect(page.locator("#missing-panel")).toBeVisible();
    await expect(page.locator("#missing-meta")).toHaveText("1 person finns i BAS men saknas i kartan.");
    const missingRows = await page.locator("#missing-table tbody tr").evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()))
    );

    expect(missingRows).toContainEqual(["75", "Josefin", "Josefinsson"]);
  });

  await test.step("Lägg till plats 75 i originalkartan", async () => {
    const drawioXml = await readFile(drawioExamplePath, "utf8");
    const sourceFrameElement = await page.locator("#drawio-frame").elementHandle();
    const sourceFrame = await sourceFrameElement.contentFrame();

    expect(sourceFrame).not.toBeNull();

    await sourceFrame.evaluate((updatedXml) => {
      window.parent.postMessage(JSON.stringify({
        event: "autosave",
        xml: updatedXml
      }), "*");
    }, addDrawioPlaceBox(drawioXml, "75"));
  });

  await test.step("Kontrollera att saknad BAS-rad flyttas till den genererade kartan", async () => {
    await expect(page.locator("#missing-panel")).toBeHidden();

    const downloadPromise = page.waitForEvent("download");

    await page.locator("#download-generated").click();

    const download = await downloadPromise;
    const generatedPath = testInfo.outputPath(download.suggestedFilename());

    await download.saveAs(generatedPath);

    const generatedXml = await readFile(generatedPath, "utf8");

    expect(generatedXml).toContain("75");
    expect(generatedXml).toContain("Josefin Josefinsson");
  });
});
