#!/usr/bin/env node
"use strict";
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = process.env.JELLY_FLOW_HOME;
if (!root) {
    console.error("Set JELLY_FLOW_HOME to the prepared jelly-flow checkout.");
    process.exitCode = 1;
} else {
    const result = spawnSync(process.execPath, [path.join(root, "lib/report/project-main.js"), ...process.argv.slice(2)],
        {stdio: "inherit", windowsHide: true});
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
}
