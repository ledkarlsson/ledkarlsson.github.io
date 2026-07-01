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
      body: `<!doctype html>
        <title>draw.io test frame</title>
        <script>
          window.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);

            if (message.action === "export") {
              window.parent.postMessage(JSON.stringify({
                event: "export",
                data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
              }), "*");
            }
          });
        </script>`
    });
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
    await expect(page.locator("#excel-example-menu")).toBeVisible();
    await expect(page.locator("#excel-example-button")).toHaveText("Exempel-Excel");
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Ladda upp draw.io-fil");
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja");
    await expect(page.locator("#drawio-example-menu")).toBeVisible();
    await expect(page.locator("#drawio-example-button")).toHaveText("Exempel-draw.io");
    await expect(page.locator("#feedback-email")).toHaveAttribute("href", "mailto:led.karlsson@gmail.com?subject=Feedback%20kartgenerator");
    await expect(page.locator(".drawio-actions")).toBeHidden();
    await expect(page.locator("#show-clean-map")).toBeDisabled();
    await expect(page.locator("#show-generated-map")).toBeDisabled();
    await expect(page.locator("#generated-options")).toBeHidden();
    await expect(page.locator("#download-menu-button")).toBeDisabled();
  });
});

test("genererar karta från nedladdade exempelfiler och visar saknad BAS-rad", async ({ page }, testInfo) => {
  await test.step("Öppna kartgeneratorn", async () => {
    await page.goto("/projects/kartgenerator/");
  });

  const drawioExamplePath = path.join(process.cwd(), "projects", "kartgenerator", "assets", "examples", "exempel.drawio");

  await test.step("Läs in exempelfiler direkt", async () => {
    await page.locator("#excel-example-button").click();
    await page.locator("#load-example-excel").click();
    await page.locator("#drawio-example-button").click();
    await page.locator("#load-example-drawio").click();
    await expect(page.locator("#excel-example-menu")).toBeHidden();
    await expect(page.locator("#drawio-example-menu")).toBeHidden();
    await expect(page.locator(".drawio-actions")).toBeVisible();
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

  await test.step("Kontrollera draw.io-visning och nedladdningslägen", async () => {
    await expect(page.locator("#drawio-viewer")).toBeVisible();
    await expect(page.locator("#generated-options")).toBeVisible();
    await expect(page.locator("#show-clean-map")).toBeEnabled();
    await expect(page.locator("#show-generated-map")).toBeDisabled();
    await expect(page.locator("#download-menu-button")).toBeEnabled();

    const cleanDownloadPromise = page.waitForEvent("download");

    await page.locator("#download-menu-button").click();
    await page.locator("#download-clean-drawio").click();

    const cleanDownload = await cleanDownloadPromise;
    const cleanPath = testInfo.outputPath(cleanDownload.suggestedFilename());

    await cleanDownload.saveAs(cleanPath);

    const cleanXml = await readFile(cleanPath, "utf8");

    expect(cleanXml).toContain("51");
    expect(cleanXml).not.toContain("Pelle Pelleson");

    const cleanPngDownloadPromise = page.waitForEvent("download");

    await page.locator("#download-menu-button").click();
    await page.locator("#download-clean-png").click();

    const cleanPngDownload = await cleanPngDownloadPromise;

    expect(cleanPngDownload.suggestedFilename()).toMatch(/utan-bas-info\.png$/);

    await page.locator("#show-clean-map").click();
    await expect(page.locator("#generated-options")).toBeHidden();
    await expect(page.locator("#show-generated-map")).toBeEnabled();
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

    await page.locator("#download-menu-button").click();
    await page.locator("#download-generated-drawio").click();

    const download = await downloadPromise;
    const generatedPath = testInfo.outputPath(download.suggestedFilename());

    await download.saveAs(generatedPath);

    const generatedXml = await readFile(generatedPath, "utf8");

    expect(generatedXml).toContain("75");
    expect(generatedXml).toContain("Josefin Josefinsson");

    const generatedPngDownloadPromise = page.waitForEvent("download");

    await page.locator("#download-menu-button").click();
    await page.locator("#download-generated-png").click();

    const generatedPngDownload = await generatedPngDownloadPromise;

    expect(generatedPngDownload.suggestedFilename()).toMatch(/genererad\.png$/);
  });
});
