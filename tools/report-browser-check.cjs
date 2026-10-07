// Live acceptance helper: node tools/report-browser-check.cjs <report.html> <artifact-directory>
const {chromium} = require("playwright");
const {mkdirSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
(async () => {
    const [file, artifacts] = process.argv.slice(2);
    if (!file || !artifacts) throw new Error("Expected report.html and artifact directory");
    mkdirSync(artifacts, {recursive: true});
    const browser = await chromium.launch({headless: process.env.REPORT_HEADLESS === "1",
        executablePath: process.env.REPORT_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe"});
    try {
        const context = await browser.newContext({offline: true, viewport: {width: 1500, height: 960}});
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const external = [], errors = [], timings = {};
        page.on("request", r => {if (!r.url().startsWith("file:")) external.push(r.url());});
        page.on("pageerror", e => errors.push(e.message));
        let start = performance.now();
        await page.goto(pathToFileURL(path.resolve(file)).href);
        await page.locator("#files button").first().waitFor();
        timings.initialMs = performance.now() - start;
        await page.screenshot({path: path.join(artifacts, "overview.png")});
        start = performance.now();
        await page.getByLabel("Search files or functions").fill("main");
        timings.searchMs = performance.now() - start;
        if (!await page.locator("#files button").count()) await page.getByLabel("Search files or functions").fill("");
        start = performance.now();
        await page.locator("#files button").first().click();
        timings.selectMs = performance.now() - start;
        start = performance.now();
        await page.getByRole("button", {name: "Expand functions", exact: true}).click();
        timings.expandMs = performance.now() - start;
        await page.getByRole("button", {name: "Expand two steps", exact: true}).click();
        await page.getByLabel("Imports", {exact: true}).check();
        await page.getByLabel("Highlight cycles").check();
        await page.getByLabel("Highlight across areas").check();
        await page.getByRole("button", {name: "Copy path", exact: true}).click();
        await page.locator("#copyStatus").filter({hasText: /Copied|Copy unavailable/}).waitFor();
        await page.screenshot({path: path.join(artifacts, "selection.png")});
        start = performance.now();
        const areas = await page.getByLabel("Execution area").locator("option").allTextContents();
        if (areas.length > 1) await page.getByLabel("Execution area").selectOption({index: 1});
        timings.filterMs = performance.now() - start;
        const result = {browser: browser.version(), file, timings, external, errors,
            status: await page.locator("#status").innerText(), clipboard: await page.locator("#copyStatus").innerText()};
        writeFileSync(path.join(artifacts, "browser.json"), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
        if (external.length || errors.length) process.exitCode = 1;
    } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
