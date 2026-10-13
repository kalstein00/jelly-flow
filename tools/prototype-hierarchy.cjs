// THROWAWAY UI prototype. Reads one verified result into memory; never writes to the analysis server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
if (process.env.NODE_ENV === 'production') throw new Error('Prototype is development-only.');
const source = process.argv[2] || 'http://127.0.0.1:55704';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(source).hostname)) throw new Error('Use a local analysis server.');
(async () => {
    const get = async url => { const response = await fetch(url); if (!response.ok) throw new Error(await response.text()); return response.json(); };
    const projects = await get(source + '/api/projects');
    const project = projects.find(p => process.argv[3] ? p.id === process.argv[3] : p.config.areas.some(a => a.name === 'log-viewer-app/main'));
    if (!project) throw new Error('No saved DART project. Pass the local server URL and optional project ID.');
    const resultId = project.displayed || project.current;
    if (!resultId) throw new Error('Analyze the project first.');
    const model = await get(`${source}/api/projects/${project.id}/results/${resultId}`);
    const data = JSON.stringify({project, model, source, resultId});
    const assets = {'/':['prototype-hierarchy.html','text/html'], '/prototype.js':['prototype-hierarchy.js','text/javascript'], '/prototype.css':['prototype-hierarchy.css','text/css']};
    const server = http.createServer((req,res) => {
        res.setHeader('Cache-Control','no-store');
        res.setHeader('X-Content-Type-Options','nosniff');
        if (req.headers.host !== `127.0.0.1:${server.address().port}` || req.method !== 'GET') {res.writeHead(403);res.end();return;}
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/prototype-data') {res.setHeader('Content-Type','application/json');res.end(data);return;}
        const asset = assets[pathname];
        if (!asset) {res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',asset[1]+'; charset=utf-8');
        res.end(fs.readFileSync(path.join(__dirname,'../resources/web',asset[0])));
    });
    server.listen(Number(process.env.PROTOTYPE_PORT || 55705),'127.0.0.1',()=>console.log(`Hierarchy prototype: http://127.0.0.1:${server.address().port}/?variant=A\nRead-only snapshot ${model.snapshot}; ${model.files.length} files. Ctrl+C to stop.`));
    process.on('SIGINT',()=>server.close(()=>process.exit()));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
