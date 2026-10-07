/// <reference lib="dom" />
import {chromium, Browser} from "playwright";
import {existsSync, mkdtempSync, writeFileSync} from "fs";
import path from "path";
import {tmpdir} from "os";
import {pathToFileURL} from "url";
import {generateReport} from "../../src/report/report";
import {reportFixture} from "./report-fixture";

let browser: Browser;
beforeAll(async () => {
    const executablePath = process.env.REPORT_BROWSER || [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "/usr/bin/chromium", "/usr/bin/google-chrome"
    ].find(existsSync);
    browser = await chromium.launch({executablePath, headless: true});
}, 30000);
afterAll(async () => { await browser?.close(); });

test("moved standalone HTML works offline and selects a file without external requests", async () => {
    const output = path.join(mkdtempSync(path.join(tmpdir(), "moved-report-")), "map.html");
    const input = reportFixture();
    input.imports = [{source: "app/a.ts", target: "shared/b.ts", specifier: "../shared/b", typeOnly: true, location: "app/a.ts:1:1"}];
    input.inventory.push({path: "worker/c.ts", areas: ["worker"]});
    input.runs.push({area: "worker", status: "failed", diagnostics: {error: "budget"}});
    writeFileSync(output, generateReport(input).html);
    const context = await browser.newContext({offline: true});
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const external: string[] = [], errors: string[] = [];
    page.on("request", r => { if (!r.url().startsWith("file:")) external.push(r.url()); });
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(pathToFileURL(output).href);
    await page.locator("#files").getByRole("button", {name: "shared/b.ts", exact: true}).click();
    expect(await page.locator("#details").innerText()).toContain("Distinct caller files: 1");
    const before = await page.locator("#map").getAttribute("viewBox");
    await page.getByRole("button", {name: "Zoom in", exact: true}).click();
    expect(await page.locator("#map").getAttribute("viewBox")).not.toBe(before);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.getByLabel("Possible calls", {exact: true}).isChecked()).toBe(true);
    expect(await page.getByLabel("Imports", {exact: true}).isChecked()).toBe(false);
    await page.getByLabel("Possible calls", {exact: true}).uncheck();
    await page.getByLabel("Imports", {exact: true}).check();
    expect(await page.locator("#scene line[data-kind=import]").count()).toBe(1);
    expect(await page.locator("#scene line[data-kind=call]").count()).toBe(0);
    await page.getByLabel("Search files or functions").fill("save");
    await page.locator("#files").getByRole("button", {name: "shared/b.ts", exact: true}).click();
    await page.getByRole("button", {name: "Expand functions", exact: true}).click();
    expect(await page.locator("#functions").innerText()).toContain("save");
    await page.locator("#functions").getByRole("button", {name: "save", exact: true}).click();
    expect(await page.locator("#details").innerText()).toContain("shared/b.ts:1:1:3:2");
    await page.getByRole("button", {name: "Copy path", exact: true}).click();
    await page.locator("#copyStatus").filter({hasText: /Copied|Copy unavailable/}).waitFor();
    expect(await page.locator("#copyStatus").innerText()).toMatch(/Copied|Copy unavailable/);
    await page.getByRole("button", {name: "Expand two steps", exact: true}).click();
    await page.getByLabel("Search files or functions").fill("");
    await page.getByLabel("Highlight cycles").check();
    await page.getByLabel("Highlight across areas").check();
    expect(await page.locator("#status").innerText()).toContain("Cycles:");
    await page.getByLabel("Execution area").selectOption("worker");
    expect(await page.locator("#files").innerText()).toContain("worker/c.ts");
    expect(await page.locator("#files").innerText()).not.toContain("app/a.ts");
    await page.locator("#files").getByRole("button").click();
    expect(await page.locator("#details").innerText()).toContain("unanalyzed");
    await context.close();
}, 30000);
