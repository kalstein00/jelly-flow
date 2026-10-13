"use strict";
const $ = id => document.getElementById(id);
let active, shown, polling, requestedResult;
let formVersion=0, selectionVersion=0;
const viewStates = new Map();
function rememberView() {
    if (!shown) return;
    if ($("graph").contentWindow?.location.pathname !== new URL($("graph").src).pathname) return;
    const state = $("graph").contentWindow?.jellyView?.capture();
    if (state) viewStates.set(shown.split(":")[0], state);
}
async function api(url, data) {
    const response = await fetch(url, data === undefined ? {} : {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const value = await response.json(); if (!response.ok) throw new Error(value.error); return value;
}
function failure(error) {$("error").textContent = error.message;}
function button(parent, text, action) {const element=document.createElement("button");element.textContent=text;element.onclick=()=>Promise.resolve(action()).catch(failure);parent.append(element);}
async function listProjects() {
    const projects = await api("/api/projects"); $("projects").replaceChildren();
    for (const project of projects) button($("projects"),project.name,()=>selectProject(project.id));
}
async function openResult(project, resultId) {
    const target=project.id+":"+resultId;
    const version=selectionVersion;
    if(shown===target || requestedResult===target)return;
    requestedResult=target;
    try {await api(`/api/projects/${project.id}/results/${resultId}`);}
    catch(error){if(requestedResult===target){requestedResult=undefined;failure(error);}return;}
    if(active!==project.id || requestedResult!==target || version!==selectionVersion)return;
    rememberView();
    const restore = viewStates.get(project.id);
    shown=target;requestedResult=undefined;
    const url=`/api/projects/${project.id}/results/${resultId}/view`;
    $("graph").hidden=true;$("empty").hidden=false;$("empty").textContent="Opening verified result…";
    $("graph").onload=()=>{
        if(shown!==target || active!==project.id || version!==selectionVersion || $("graph").contentWindow?.location.pathname!==url)return;
        const viewer=$("graph").contentWindow?.jellyView;
        if(!viewer){failure(new Error("The graph could not be opened. Reanalyze or reload this project."));return;}
        if(restore)viewer.restore(restore);
        $("graph").hidden=false;$("empty").hidden=true;
    };
    $("graph").src=url;
    renderActions(project);
}
function render(project) {
    $("projectName").textContent=project.name;
    const attempt=project.attempt;
    $("analyze").disabled=attempt?.status==="running";
    $("jobStatus").textContent=attempt ? ({running:"Analyzing…",completed:"Completed",partial:"Partial analysis",failed:"Analysis failed",reused:"Reused"}[attempt.status]+(attempt.message?" — "+attempt.message:"")) : "Ready to analyze";
    const desired=project.displayed || project.current;
    if(desired)openResult(project,desired).catch(failure);
    renderActions(project);
}
async function showResult(project, resultId) {
    const updated=await api(`/api/projects/${project.id}/display`,{resultId});
    if(active!==project.id)return;
    await openResult(updated,resultId);
    await refresh();
}
function renderActions(project) {
    $("resultActions").replaceChildren();
    const attempt=project.attempt;
    const resultId=shown?.split(":")[1];
    const result=project.results.find(item=>item.id===resultId);
    if(result){
        const label=document.createElement("span");
        const previous=attempt && ["running","partial","failed"].includes(attempt.status) && result.id!==attempt.id;
        label.textContent=`Viewing ${previous?"previous result":result.status+" result"} · ${new Date(result.created).toLocaleString()}`;
        $("resultActions").append(label);
    } else {
        $("empty").textContent=attempt?.status==="failed"?"Analysis failed. No successful result is available. Review the error and settings, then retry.":
            attempt?.status==="partial"?"Partial analysis is available. Open it explicitly to review its coverage and limitations.":
            "Save a project and run analysis to explore its structure.";
    }
    if(attempt?.status==="partial" && resultId!==attempt.id)button($("resultActions"),"Open partial result",()=>showResult(project,attempt.id));
    const previous=project.previous || (resultId!==project.current?project.current:undefined);
    if(previous && resultId!==previous)button($("resultActions"),"Show previous result",()=>showResult(project,previous));
}
async function refresh() {
    const id=active, version=selectionVersion;if(!id)return;
    const project=await api("/api/projects/"+id);if(id!==active || version!==selectionVersion)return;
    render(project);clearTimeout(polling);
    if(project.attempt?.status==="running")polling=setTimeout(()=>refresh().catch(failure),500);
}
async function selectProject(id) {
    const selection=++selectionVersion;formVersion++;
    rememberView();clearTimeout(polling);active=id;shown=undefined;requestedResult=undefined;$("graph").hidden=true;$("empty").hidden=false;
    $("proposal").textContent="";
    const project=await api("/api/projects/"+id);if(active!==id || selection!==selectionVersion)return;
    $("root").value=project.config.root;$("areas").value=JSON.stringify(project.config.areas,null,2);await refresh();
}
$("projectForm").onsubmit=async event=>{event.preventDefault();$("error").textContent="";try{
    const version=formVersion;
    const project=await api("/api/projects",{id:active,config:{root:$("root").value,areas:JSON.parse($("areas").value)}});
    await listProjects();if(version===formVersion)await selectProject(project.id);
}catch(error){failure(error);}};
$("analyze").onclick=async()=>{try{
    $("error").textContent="";$("analyze").disabled=true;$("jobStatus").textContent="Analyzing…";
    await api("/api/projects/"+active+"/analyze",{});await refresh();
}catch(error){failure(error);$("analyze").disabled=false;}};
$("suggest").onclick=async()=>{try{
    $("error").textContent="";$("suggest").disabled=true;
    const version=formVersion;
    const proposal=await api("/api/suggest",{root:$("root").value});
    if(version!==formVersion)return;
    $("areas").value=JSON.stringify(proposal.areas,null,2);
    $("proposal").textContent=[...proposal.evidence,...proposal.warnings].join("\n");
}catch(error){failure(error);}finally{$("suggest").disabled=false;}};
$("newProject").onclick=()=>{
    formVersion++;selectionVersion++;
    rememberView();active=undefined;shown=undefined;requestedResult=undefined;clearTimeout(polling);
    $("graph").hidden=true;$("empty").hidden=false;$("resultActions").replaceChildren();$("jobStatus").textContent="";
    $("root").value="";$("proposal").textContent="";$("error").textContent="";
    $("analyze").disabled=true;$("projectName").textContent="Add a project";$("root").focus();
};
listProjects().catch(failure);
for(const id of ["root","areas"])$(id).addEventListener("input",()=>formVersion++);
$("toggleProjects").onclick=()=>{
    const hidden=$("projectsPanel").hidden=!$("projectsPanel").hidden;
    $("workspace").classList.toggle("projects-hidden",hidden);
    $("toggleProjects").setAttribute("aria-expanded",String(!hidden));
};
