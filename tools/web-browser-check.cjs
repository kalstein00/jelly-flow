// Build first. Usage: node tools/web-browser-check.cjs <target root> <evidence directory outside target>
const {chromium} = require('playwright');
const {startWebServer} = require('../lib/web/server');
const {existsSync,mkdirSync,writeFileSync} = require('fs');
const {execFileSync} = require('child_process');
const path = require('path');
const {pathToFileURL} = require('url');

async function main() {
    const root=path.resolve(process.argv[2]), output=path.resolve(process.argv[3]);
    const relative=path.relative(root,output);
    if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Evidence must be outside the target.');
    mkdirSync(output,{recursive:true});
    const record={root,node:process.version,timings:{},errors:[]};
    try{record.sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();}catch{}
    const app=await startWebServer({dataDir:path.join(output,'data')});
    const browser=await chromium.launch({headless:true,executablePath:process.env.REPORT_BROWSER||[
        'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'
    ].find(existsSync)});
    record.browser=browser.version();
    const context=await browser.newContext({viewport:{width:1500,height:960},permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',error=>record.errors.push(error.message));
    const save=()=>writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2));
    const measure=async(name,action)=>{const start=Date.now();const value=await action();record.timings[name]=Date.now()-start;save();return value;};
    try {
        await page.goto(app.url);
        await page.getByLabel('Project folder',{exact:true}).fill(root);
        await measure('suggest',async()=>{
            await page.getByRole('button',{name:'Suggest settings',exact:true}).click();
            await page.waitForFunction(()=>!document.querySelector('#suggest').disabled);
        });
        record.proposal=await page.locator('#proposal').innerText();
        record.areas=JSON.parse(await page.getByLabel('Analysis areas (JSON)').inputValue());
        if(!record.areas.length)throw new Error('No suggested areas');
        // Confirm the proposed settings through the same editable public form.
        await page.getByLabel('Analysis areas (JSON)').fill(JSON.stringify(record.areas,null,2));
        await page.getByRole('button',{name:'Save project',exact:true}).click();
        await measure('analysis',async()=>{
            await page.getByRole('button',{name:'Analyze',exact:true}).click();
            await page.locator('#jobStatus').filter({hasText:/Completed|Partial analysis|Analysis failed/}).waitFor({timeout:120000+record.areas.length*120000});
        });
        record.status=await page.locator('#jobStatus').innerText();
        if(record.status.startsWith('Analysis failed'))throw new Error(record.status);
        if(record.status.startsWith('Partial analysis'))await page.getByRole('button',{name:'Open partial result',exact:true}).click();
        const graph=page.frameLocator('#graph');
        await measure('displayAfterStatus',()=>graph.locator('body[data-layout=network]').waitFor());
        const viewUrl=await page.locator('#graph').getAttribute('src');
        const model=await (await page.request.get(app.url+viewUrl.replace(/\/view$/,''))).json();
        record.snapshot=model.snapshot;record.created=model.created;record.provenance=model.provenance;
        record.coverage=model.coverage;record.runs=model.runs;record.files=model.files.length;record.functions=model.files.reduce((sum,file)=>sum+file.functions.length,0);
        record.relations={calls:model.edges.filter(edge=>edge.kind==='call').length,imports:model.edges.filter(edge=>edge.kind==='import').length};
        await page.getByRole('button',{name:'Projects',exact:true}).click();
        await page.screenshot({path:path.join(output,'overview.png')});
        const selected=[...model.files].sort((a,b)=>b.callers-a.callers)[0].path;
        await measure('candidateSelect',()=>graph.locator('#concentration').getByRole('button',{name:selected+' ·',exact:false}).first().click());
        await measure('expandFunctions',()=>graph.getByRole('button',{name:'Expand functions',exact:true}).click());
        await graph.getByRole('button',{name:'Copy review evidence',exact:true}).click();
        await graph.locator('#evidenceStatus').filter({hasText:'Copied'}).waitFor();
        writeFileSync(path.join(output,'review-evidence.txt'),await graph.getByLabel('Review evidence').inputValue());
        await page.screenshot({path:path.join(output,'selected.png')});
        await measure('search',()=>graph.getByLabel('Search files or functions').fill(path.basename(selected)));
        await graph.getByLabel('Search files or functions').fill('');
        await graph.getByLabel('Imports',{exact:true}).check();
        await graph.getByRole('button',{name:'Zoom in',exact:true}).click();
        const view=await graph.locator('#map').getAttribute('viewBox');
        await measure('reanalysis',async()=>{
            await page.getByRole('button',{name:'Analyze',exact:true}).click();
            await page.locator('#jobStatus').filter({hasText:/Reused|Completed|Partial analysis|Analysis failed/}).waitFor({timeout:120000+record.areas.length*120000});
        });
        record.reanalysis=await page.locator('#jobStatus').innerText();
        record.retainedViewport=await graph.locator('#map').getAttribute('viewBox')===view;
        record.retainedSelection=(await graph.locator('#details').innerText()).includes(selected);
        const offline=path.join(output,'moved-offline.html');
        writeFileSync(offline,await (await page.request.get(app.url+viewUrl.replace(/\/view$/,'/html'))).text());
        const offlineContext=await browser.newContext({offline:true});
        const offlinePage=await offlineContext.newPage();const requests=[];
        offlinePage.on('request',request=>{if(!request.url().startsWith('file:'))requests.push(request.url());});
        await offlinePage.goto(pathToFileURL(offline).href);
        await offlinePage.locator('#files').getByRole('button',{name:selected,exact:true}).click();
        record.offline={externalRequests:requests,selected:(await offlinePage.locator('#details').innerText()).includes(selected)};
        await offlineContext.close();
        console.log(JSON.stringify({status:record.status,reanalysis:record.reanalysis,coverage:record.coverage,timings:record.timings,errors:record.errors,output}));
    } finally {
        writeFileSync(path.join(output,'browser.json'),JSON.stringify(record,null,2));
        await browser.close();await app.close();
    }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
