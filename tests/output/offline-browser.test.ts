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
    writeFileSync(output, generateReport(reportFixture()).html);
    const context = await browser.newContext({offline: true});
    const page = await context.newPage();
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
    await context.close();
}, 30000);
