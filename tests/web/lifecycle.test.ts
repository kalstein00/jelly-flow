import {mkdtempSync, writeFileSync, mkdirSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {execFileSync} from "child_process";
import {startWebServer} from "../../src/web/server";
import type {Project} from "../../src/web/projects";
import type {ReportModel} from "../../src/report/report";
import {generateReport} from "../../src/report/report";
import {reportFixture} from "../output/report-fixture";
import {digest} from "../../src/report/identity";

let app: Awaited<ReturnType<typeof startWebServer>>;
let root: string, dataDir: string;
beforeAll(() => {
    execFileSync(process.execPath,["node_modules/typescript/bin/tsc","--build","tsconfig-build.json"],{windowsHide:true});
},30000);
beforeEach(async () => {
    root=mkdtempSync(path.join(tmpdir(),"web-lifecycle-source-"));
    dataDir=mkdtempSync(path.join(tmpdir(),"web-lifecycle-data-"));
    writeFileSync(path.join(root,"main.ts"),"export function run(){}");
    app=await startWebServer({dataDir});
});
afterEach(async () => {await app.close();});

async function post(route: string, value: unknown) {
    return fetch(app.url+route,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
}
async function register() {
    return (await post("/api/projects",{config:{root,areas:[{name:"app",entries:["main.ts"],roots:["."]}]}})).json() as Promise<Project>;
}
async function waitForAnalysis(id: string) {
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
        const project=await (await fetch(app.url+"/api/projects/"+id)).json() as Project;
        if(project.attempt!.status!=="running")return project;
        await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error("Analysis did not finish within the fixture budget");
}

test("validate target boundaries and stop an active analysis with the server",async()=>{
    const outside=await post("/api/projects",{config:{root,areas:[{name:"bad",entries:["../outside.ts"],roots:["."]}]}});
    expect(outside.ok).toBe(false);
    const foreign=await fetch(app.url+"/api/projects",{headers:{Origin:"https://example.org"}});
    expect(foreign.ok).toBe(false);
    const project=await register();
    await post(`/api/projects/${project.id}/analyze`,{});
    const oldUrl=app.url;
    await app.close();
    await expect(fetch(oldUrl+"/api/projects")).rejects.toThrow();
    app=await startWebServer({dataDir});
    const restored=await (await fetch(app.url+"/api/projects/"+project.id)).json() as Project;
    expect(restored.attempt!.status).toBe("failed");
    expect(restored.current).toBeUndefined();
},30000);

test("reject an in-target storage folder whose name begins with two dots",async()=>{
    await app.close();
    app=await startWebServer({dataDir:path.join(root,"..jelly-data")});
    const response=await post("/api/projects",{config:{root,areas:[{name:"app",entries:["main.ts"],roots:["."]}]}});
    expect(response.ok).toBe(false);
});

test("restore and switch partial results, rejecting damaged stored artifacts",async()=>{
    const project=await register();
    await app.close();
    for(const id of ["partial-one","partial-two"]){
        const input=reportFixture();input.snapshot=id;
        input.runs[0].status="partial";
        const result=generateReport(input), directory=path.join(dataDir,project.id,id);
        mkdirSync(directory,{recursive:true});
        const artifacts={"input.json":JSON.stringify(input),"model.json":JSON.stringify(result.model),"report.html":result.html};
        for(const [name,contents] of Object.entries(artifacts))writeFileSync(path.join(directory,name),contents);
        writeFileSync(path.join(directory,"artifacts.json"),JSON.stringify({status:"partial",snapshot:id,
            digests:Object.fromEntries(Object.entries(artifacts).map(([name,contents])=>[name,digest(contents)]))}));
        project.results.push({id,status:"partial",snapshot:id,created:input.created});
    }
    project.attempt={id:"partial-two",status:"partial"};
    writeFileSync(path.join(dataDir,"projects.json"),JSON.stringify([project]));
    app=await startWebServer({dataDir});
    expect((await post(`/api/projects/${project.id}/display`,{resultId:"partial-one"})).ok).toBe(true);
    const response=await post(`/api/projects/${project.id}/display`,{resultId:"partial-two"});
    expect(await response.json()).toMatchObject({displayed:"partial-two",previous:"partial-one"});
    await app.close();app=await startWebServer({dataDir});
    expect(await (await fetch(`${app.url}/api/projects/${project.id}`)).json()).toMatchObject({displayed:"partial-two",previous:"partial-one"});
    writeFileSync(path.join(dataDir,project.id,"partial-one","report.html"),"damaged");
    expect((await fetch(`${app.url}/api/projects/${project.id}/results/partial-one/view`)).ok).toBe(false);
    expect((await post(`/api/projects/${project.id}/display`,{resultId:"partial-one"})).ok).toBe(false);
    expect(await (await fetch(`${app.url}/api/projects/${project.id}`)).json()).toMatchObject({displayed:"partial-two",previous:"partial-one"});
});

test("damaged artifacts and changed settings regenerate; moving input preserves the previous result",async()=>{
    let project=await register();
    await post(`/api/projects/${project.id}/analyze`,{});
    project=await waitForAnalysis(project.id);
    expect(project.attempt!.status).toBe("completed");
    const first=project.current!;
    writeFileSync(path.join(dataDir,project.id,first,"report.html"),"damaged cache");
    await post(`/api/projects/${project.id}/analyze`,{});
    project=await waitForAnalysis(project.id);
    expect(project.attempt!.status).toBe("completed");
    expect(project.current).not.toBe(first);
    project.config.areas[0].name="renamed";
    await post("/api/projects",{id:project.id,config:project.config});
    await post(`/api/projects/${project.id}/analyze`,{});
    project=await waitForAnalysis(project.id);
    expect(project.attempt!.status).toBe("completed");
    const model=await (await fetch(`${app.url}/api/projects/${project.id}/results/${project.current}`)).json() as ReportModel;
    expect(model.runs[0].area).toBe("renamed");
    const previous=project.current;
    let revision=0;
    const mutate=()=>writeFileSync(path.join(root,"main.ts"),`export function run(){return ${++revision};}`);
    mutate();
    await post(`/api/projects/${project.id}/analyze`,{});
    const timer=setInterval(mutate,250);
    try{project=await waitForAnalysis(project.id);}finally{clearInterval(timer);}
    expect(project.attempt!.status).toBe("failed");
    expect(project.attempt!.message).toContain("Inputs changed during analysis");
    expect(project.current).toBe(previous);
},720000);
