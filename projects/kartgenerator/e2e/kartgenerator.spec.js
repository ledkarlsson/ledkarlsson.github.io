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
        <pre id="loaded-xml"></pre>
        <pre id="editor-config"></pre>
        <pre id="last-load-options"></pre>
        <script>
          let configureInterval = null;

          if (new URL(window.location.href).searchParams.get("configure") === "1") {
            configureInterval = setInterval(() => {
              if (document.querySelector("#editor-config").textContent) {
                clearInterval(configureInterval);
                return;
              }

              window.parent.postMessage(JSON.stringify({ event: "configure" }), "*");
            }, 50);
          }

          window.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);

            if (message.action === "configure") {
              if (configureInterval) {
                clearInterval(configureInterval);
              }

              document.querySelector("#editor-config").textContent = JSON.stringify(message.config);
              window.parent.postMessage(JSON.stringify({ event: "init" }), "*");
            }

            if (["load", "merge"].includes(message.action)) {
              document.querySelector("#loaded-xml").textContent = message.xml;
              document.querySelector("#last-load-options").textContent = JSON.stringify({ action: message.action });
            }

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

async function openKartgenerator(page) {
  await page.goto("/projects/kartgenerator/");
  await page.waitForFunction(() => window.kartgeneratorReady === true);
}

test.beforeEach(async ({ page }) => {
  await mockExternalScripts(page);
});

test("visar kartgeneratorns arbetsyta", async ({ page }) => {
  await test.step("Öppna kartgeneratorn", async () => {
    await openKartgenerator(page);
  });

  await test.step("Kontrollera startläget", async () => {
    await expect(page.getByRole("heading", { name: "kartgenerator" })).toBeVisible();
    await expect(page.locator(".last-updated")).toContainText(/Senast uppdaterad: \d{1,2} [a-zåäö]+ \d{4}/i);
    await expect(page.locator(".last-updated time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    await expect(page.locator("#upload-zone .upload-title")).toHaveText("Ladda upp Excel-fil");
    await expect(page.locator("#excel-example-menu")).toBeVisible();
    await expect(page.locator("#excel-example-button")).toHaveText("Exempel-Excel");
    await expect(page.locator("#drawio-frame")).toHaveAttribute("src", /configure=1/);
    await expect(page.locator("#drawio-frame")).toHaveAttribute("src", /pages=0/);
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Ladda upp karta");
    await expect(page.getByLabel("Förhandsvisning av kartgeneratorns arbetsyta")).toContainText("Dra och släpp en .drawio eller .drawio.xml fil här, eller klicka för att välja");
    await expect(page.locator("#drawio-example-menu")).toBeVisible();
    await expect(page.locator("#drawio-example-button")).toHaveText("Exempelkarta");
    await expect(page.locator(".feedback")).toHaveText("Skicka återkoppling till led.karlsson[snabela]gmail.com.");
    await expect(page.locator("#toggle-map-focus")).toHaveCount(0);
    await expect(page.getByLabel("Hjälp för Excel-data")).toBeVisible();
    await expect(page.getByLabel("Hjälp för kartan")).toBeVisible();
    await expect(page.locator(".drawio-actions")).toBeHidden();
    await expect(page.locator("#show-clean-map")).toBeDisabled();
    await expect(page.locator("#show-generated-map")).toBeDisabled();
    await expect(page.locator("#generated-options")).toBeHidden();
    await expect(page.locator("#download-menu-button")).toBeDisabled();
    await expect(page.locator("#fullscreen-map")).toBeDisabled();
  });

  await test.step("Kontrollera karteditorns inbäddningskonfiguration", async () => {
    const frameElement = await page.locator("#drawio-frame").elementHandle();
    const frame = await frameElement.contentFrame();

    expect(frame).not.toBeNull();
    await expect(frame.locator("#editor-config")).toContainText('"defaultPageVisible":false');
    await expect(frame.locator("#editor-config")).toContainText('"preserveViewState":true');
    await expect(frame.locator("#editor-config")).toContainText(".geTabContainer > :not(:last-child)");
    await expect(frame.locator("#editor-config")).toContainText(".gePageTab");
    await expect(frame.locator("#editor-config")).not.toContainText(".geToolbarButton");
  });
});

test("genererar karta från nedladdade exempelfiler och visar saknad BAS-rad", async ({ page }, testInfo) => {
  await test.step("Öppna kartgeneratorn", async () => {
    await openKartgenerator(page);
  });

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
    await expect(page.locator("#columns-meta")).toHaveText('4 kolumner hittades i "Rapport". Samt matchningskolumn område/plats. Välj vilken data som ska in i kartan.');
    await expect(page.locator("#selected-columns")).toBeHidden();
    await expect(page.locator("#columns-list .column-button", { hasText: "Område/plats" })).toHaveCount(0);
    await expect(page.locator("#parse-controls")).toBeHidden();
    await expect(page.locator("#table-title")).toHaveText("Vald data (4 rader)");
    await expect(page.locator("#show-empty-excel-places")).not.toBeChecked();
    await expect(page.locator("#show-raw-omrade-plats")).toHaveCount(0);
    await expect(page.locator("#duplicate-place-warning")).toBeHidden();
    await expect(page.locator("#table-meta")).toBeHidden();
    await expect(page.locator("#selected-table thead")).toContainText("Plats");
    await expect(page.locator("#selected-table thead")).toContainText("Område/Plats");
    await expect(page.locator("#selected-table tbody tr").first().locator("td").first()).toContainText("Brygga");
    await expect(page.locator("#selected-table")).toContainText("Pelle");
    await expect(page.locator("#selected-table")).toContainText("Pelleson");
    await expect(page.locator("#selected-table")).toContainText("51");
    await expect(page.locator("#selected-table tbody tr")).toHaveCount(4);

    await page.locator("#show-empty-excel-places").check();
    await expect(page.locator("#table-title")).toHaveText("Vald data (7 rader)");
    await expect(page.locator("#selected-table tbody tr")).toHaveCount(7);
    await expect(page.locator("#selected-table")).toContainText("56");

    await page.locator("#show-empty-excel-places").uncheck();
    await expect(page.locator("#table-title")).toHaveText("Vald data (4 rader)");
    await expect(page.locator("#selected-table tbody tr")).toHaveCount(4);
  });

  await test.step("Kontrollera platser som saknas i Excel", async () => {
    await expect(page.locator("#empty-places-panel")).toBeVisible();
    await expect(page.locator("#empty-places-title")).toHaveText("Finns i kartan men saknas i Excel");
    await expect(page.locator("#empty-places-meta")).toHaveText("Alla platser i kartan finns i Excel.");
    await expect(page.locator("#empty-places-wrap")).toBeHidden();
  });

  await test.step("Kontrollera kartvisning och nedladdningslägen", async () => {
    await expect(page.locator("#drawio-viewer")).toBeVisible();
    await expect(page.locator("#generated-options")).toBeHidden();
    await expect(page.locator("#show-clean-map")).toBeDisabled();
    await expect(page.locator("#show-generated-map")).toBeEnabled();
    await expect(page.locator("#download-menu-button")).toBeEnabled();
    await expect(page.locator("#add-place-box")).toBeEnabled();
    await expect(page.locator("#add-place-box")).toHaveText("Skapa ny plats");
    await expect(page.locator("#fullscreen-map")).toBeEnabled();
    await expect(page.locator("#fullscreen-map")).toHaveText("Helskärm");
    await page.locator("#add-place-box").click();
    const frameElement = await page.locator("#drawio-frame").elementHandle();
    const frame = await frameElement.contentFrame();

    expect(frame).not.toBeNull();
    await expect(frame.locator("#loaded-xml")).toContainText("ny plats");
    await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#f8cecc");
    await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#b85450");
    await expect(page.locator("#empty-places-meta")).toHaveText("Alla platser i kartan finns i Excel.");

    const newPlaceXml = await frame.locator("#loaded-xml").textContent();
    const renamedPlaceXml = newPlaceXml.replace(/value="ny plats"/, 'value="57"');

    await frame.evaluate((xml) => {
      window.parent.postMessage(JSON.stringify({
        event: "autosave",
        xml
      }), "*");
    }, renamedPlaceXml);

    expect(renamedPlaceXml).toContain('value="57"');
    expect(renamedPlaceXml).not.toContain('value="ny plats"');

    await expect(page.locator("#empty-places-meta")).toHaveText("1 plats finns i kartan men saknas i Excel. Dessa platser markeras med gult i kartan.");
    await expect(page.locator("#empty-places-wrap")).toBeVisible();
    await expect(page.locator("#empty-places-table")).toContainText("57");
    await expect(frame.locator("#loaded-xml")).toContainText("57");
    await expect(frame.locator("#loaded-xml")).not.toContainText("ny plats");
    await expect(frame.locator("#loaded-xml")).not.toContainText("fillColor=#f8cecc");
    await expect(frame.locator("#loaded-xml")).not.toContainText("strokeColor=#b85450");
    await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#fff2cc");
    await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#d6b656");

    const renamedExistingPlaceXml = (await frame.locator("#loaded-xml").textContent()).replace(/value="57"/, 'value="75"');

    await frame.evaluate((xml) => {
      window.parent.postMessage(JSON.stringify({
        event: "autosave",
        xml
      }), "*");
    }, renamedExistingPlaceXml);

    await expect(page.locator("#empty-places-meta")).toHaveText("Alla platser i kartan finns i Excel.");
    await expect(frame.locator("#loaded-xml")).toContainText("75");
    await expect(frame.locator("#loaded-xml")).not.toContainText("fillColor=#fff2cc");
    await expect(frame.locator("#loaded-xml")).not.toContainText("strokeColor=#d6b656");

    const renamedMissingPlaceXml = (await frame.locator("#loaded-xml").textContent()).replace(/value="75"/, 'value="57"');

    await frame.evaluate((xml) => {
      window.parent.postMessage(JSON.stringify({
        event: "autosave",
        xml
      }), "*");
    }, renamedMissingPlaceXml);

    await expect(page.locator("#empty-places-meta")).toHaveText("1 plats finns i kartan men saknas i Excel. Dessa platser markeras med gult i kartan.");
    await expect(frame.locator("#loaded-xml")).toContainText("57");
    await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#fff2cc");
    await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#d6b656");

    const cleanDownloadPromise = page.waitForEvent("download");

    await page.locator("#download-menu-button").click();
    await expect(page.locator("#download-generated-drawio")).toContainText("Behövs oftast inte");
    await page.locator("#download-clean-drawio").click();

    const cleanDownload = await cleanDownloadPromise;
    const cleanPath = testInfo.outputPath(cleanDownload.suggestedFilename());

    await cleanDownload.saveAs(cleanPath);

    const cleanXml = await readFile(cleanPath, "utf8");

    expect(cleanXml).toContain("51");
    expect(cleanXml).toContain("57");
    expect(cleanXml).toMatch(/value="57"[\s\S]*<mxGeometry x="-450" y="1240" width="120" height="40"/);
    expect(cleanXml).not.toContain("ny plats");
    expect(cleanXml).not.toContain("Pelle Pelleson");
    expect(cleanXml).not.toContain("fillColor=#f8cecc");
    expect(cleanXml).not.toContain("strokeColor=#b85450");
    expect(cleanXml).not.toContain("fillColor=#fff2cc");
    expect(cleanXml).not.toContain("strokeColor=#d6b656");

    const cleanPngDownloadPromise = page.waitForEvent("download");

    await page.locator("#download-menu-button").click();
    await page.locator("#download-clean-png").click();

    const cleanPngDownload = await cleanPngDownloadPromise;

    expect(cleanPngDownload.suggestedFilename()).toMatch(/utan-bas-info\.png$/);

    await page.locator("#show-generated-map").click();
    await expect(page.locator("#generated-options")).toBeVisible();
    await expect(page.locator("#show-clean-map")).toBeEnabled();
    await expect(frame.locator("#last-load-options")).toContainText('"action":"merge"');
    await expect(frame.locator("#loaded-xml")).toContainText("Pelle Pelleson");
    await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#fff2cc");
    await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#d6b656");
    const generatedXmlWithBasInfo = await frame.locator("#loaded-xml").textContent();

    expect(generatedXmlWithBasInfo).toMatch(/value="57&lt;br&gt;Ledig plats"[^>]*style="[^"]*fillColor=#fff2cc[^"]*strokeColor=#d6b656/);
    expect(generatedXmlWithBasInfo).toContain('value="54&lt;br&gt;Ledig plats"');
    expect(generatedXmlWithBasInfo).toContain('value="55&lt;br&gt;Ledig plats"');
    expect(generatedXmlWithBasInfo).toContain('value="56&lt;br&gt;Ledig plats"');
    expect(generatedXmlWithBasInfo).not.toMatch(/value="54"[^>]*style="[^"]*fillColor=#fff2cc/);
    expect(generatedXmlWithBasInfo).not.toMatch(/value="55"[^>]*style="[^"]*fillColor=#fff2cc/);
    expect(generatedXmlWithBasInfo).not.toMatch(/value="56"[^>]*style="[^"]*fillColor=#fff2cc/);

    const generatedXmlBeforeEmptyToggle = generatedXmlWithBasInfo;

    await page.locator("#show-empty-excel-places").check();
    await expect(page.locator("#table-title")).toHaveText("Vald data (7 rader)");
    expect(await frame.locator("#loaded-xml").textContent()).toBe(generatedXmlBeforeEmptyToggle);

    await page.locator("#show-empty-excel-places").uncheck();
    await expect(page.locator("#table-title")).toHaveText("Vald data (4 rader)");
    expect(await frame.locator("#loaded-xml").textContent()).toBe(generatedXmlBeforeEmptyToggle);

    await expect(page.locator("#selected-table thead")).toContainText("Område/Plats");
    expect(await frame.locator("#loaded-xml").textContent()).toBe(generatedXmlBeforeEmptyToggle);

    await page.locator("#show-clean-map").click();
    await expect(page.locator("#generated-options")).toBeHidden();
    await expect(page.locator("#show-generated-map")).toBeEnabled();
    await expect(frame.locator("#last-load-options")).toContainText('"action":"merge"');

    await page.evaluate(() => {
      const workspace = document.querySelector(".workspace");
      let fullscreenElement = workspace;

      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => fullscreenElement
      });

      document.dispatchEvent(new Event("fullscreenchange"));
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    await expect(frame.locator("#last-load-options")).toContainText('"action":"load"');
  });

  await test.step("Skrolla till rapport över saknade platser", async () => {
    await scrollToCenter(page, "#missing-title");
  });

  await test.step("Kontrollera rapport över saknade platser", async () => {
    await expect(page.locator("#missing-panel")).toBeVisible();
    await expect(page.locator("#missing-meta")).toHaveText("1 person finns i BAS men saknas i kartan.");
    await expect(page.getByLabel("Hjälp för saknade platser")).toBeVisible();
    await expect(page.locator("#add-missing-boxes")).toHaveText("Lägg till 1 saknade platser i kartan");
    const missingRows = await page.locator("#missing-table tbody tr").evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()))
    );

    expect(missingRows).toContainEqual(["75", "Josefin", "Josefinsson"]);
  });

  await test.step("Lägg till plats 75 med saknade-boxar-knappen", async () => {
    await page.locator("#show-generated-map").click();
    await expect(page.locator("#generated-options")).toBeVisible();

    await page.locator("#add-missing-boxes").click();
  });

  await test.step("Kontrollera att saknad BAS-rad flyttas till den genererade kartan", async () => {
    await expect(page.locator("#missing-panel")).toBeHidden();
    await expect(page.locator("#add-missing-boxes")).toBeHidden();

    const sourceFrameElement = await page.locator("#drawio-frame").elementHandle();
    const sourceFrame = await sourceFrameElement.contentFrame();

    expect(sourceFrame).not.toBeNull();
    await expect(sourceFrame.locator("#loaded-xml")).toContainText("Josefin Josefinsson");
    await expect(sourceFrame.locator("#last-load-options")).toContainText('"action":"merge"');

    await page.locator("#show-place-number").uncheck();
    await expect(sourceFrame.locator("#loaded-xml")).toContainText("Josefin Josefinsson");

    const generatedWithoutPlaceNumber = await sourceFrame.locator("#loaded-xml").textContent();

    await sourceFrame.evaluate((xml) => {
      window.parent.postMessage(JSON.stringify({
        event: "autosave",
        xml
      }), "*");
    }, generatedWithoutPlaceNumber);

    await page.locator("#show-place-number").check();
    await expect(sourceFrame.locator("#loaded-xml")).toContainText("75");
    await expect(sourceFrame.locator("#loaded-xml")).toContainText("Josefin Josefinsson");

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

test("tolkar mixad brygga, varv och vinterplats vid filuppladdning från disk", async ({ page }) => {
  await openKartgenerator(page);
  await page.waitForFunction(() => window.XLSX);

  await page.locator("#excel-upload").setInputFiles("projects/kartgenerator/assets/examples/exempel_mixad_brygga_varv_duplicerad.xlsx");
  await page.locator("#drawio-upload").setInputFiles("projects/kartgenerator/assets/examples/exempel.drawio");

  await expect(page.locator("#parse-controls")).toBeVisible();
  await expect(page.locator("input[name='omrade-plats-source'][value='varvsomrade']")).toBeVisible();
  await expect(page.locator("input[name='omrade-plats-source'][value='brygga']")).toBeVisible();
  await expect(page.locator("input[name='omrade-plats-source'][value='vinterplats']")).toBeVisible();

  await page.locator("input[name='omrade-plats-source'][value='varvsomrade']").check();
  await expect(page.locator("#duplicate-place-warning")).toHaveText("Varning: flera medlemmar har samma plats: 54.");

  await page.locator("input[name='omrade-plats-source'][value='brygga']").check();
  await expect(page.locator("#duplicate-place-warning")).toBeHidden();
  await expect(page.locator("#selected-table")).not.toContainText("Vinterplats");

  const frameElement = await page.locator("#drawio-frame").elementHandle();
  const frame = await frameElement.contentFrame();

  expect(frame).not.toBeNull();

  await page.locator("input[name='omrade-plats-source'][value='vinterplats']").check();
  await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#fff2cc");
  await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#d6b656");

  const highlightedWinterMap = await frame.locator("#loaded-xml").textContent();

  await frame.evaluate((xml) => {
    window.parent.postMessage(JSON.stringify({
      event: "autosave",
      xml
    }), "*");
  }, highlightedWinterMap);

  await page.locator("input[name='omrade-plats-source'][value='brygga']").check();
  await expect(page.locator("#empty-places-meta")).toHaveText("Alla platser i kartan finns i Excel.");
  await expect(frame.locator("#loaded-xml")).not.toContainText("fillColor=#fff2cc");
  await expect(frame.locator("#loaded-xml")).not.toContainText("strokeColor=#d6b656");

  await page.locator("#show-empty-excel-places").check();
  await expect(page.locator("#selected-table")).toContainText("54");
  await expect(page.locator("#selected-table")).toContainText("55");

  const mapWithDuplicatePlace = (await frame.locator("#loaded-xml").textContent()).replace(/value="53"/, 'value="54"');

  await frame.evaluate((xml) => {
    window.parent.postMessage(JSON.stringify({
      event: "autosave",
      xml
    }), "*");
  }, mapWithDuplicatePlace);

  await expect(page.locator("#duplicate-map-places-panel")).toBeVisible();
  await expect(page.locator("#duplicate-map-places-meta")).toHaveText("1 plats finns på flera ställen i kartan. Dessa platser markeras med blått i kartan.");
  await expect(page.locator("#duplicate-map-places-table")).toContainText("54");
  await expect(page.locator("#duplicate-map-places-table")).toContainText("2");
  await expect(frame.locator("#loaded-xml")).toContainText("fillColor=#dae8fc");
  await expect(frame.locator("#loaded-xml")).toContainText("strokeColor=#6c8ebf");
});
