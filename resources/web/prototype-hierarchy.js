/* THROWAWAY. Question: can collapsed containment + directed layers make the existing DART snapshot readable?
   A = containment atlas, B = SCC-condensed dependency layers, C = one-hop reading desk.
   No writes, analysis, fabricated IPC edges, persistence or inferred business-module names. */
'use strict';
const $ = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = file => file.split('/').pop();
const variants = {A:'접힌 구조 개요',B:'방향성 계층 그래프',C:'호출 관계 읽기'};
const query = new URLSearchParams(location.search);
let variant = variants[query.get('variant')] ? query.get('variant') : 'A';
let scope = query.get('scope') || (variant === 'A' ? 'overview' : 'log-viewer-app/main');
let relation = query.get('relation') === 'import' ? 'import' : 'call';
let selected = query.get('file') || '', search = '', zoom = 1, neighborhood = false;
let expandedApps = new Set(), expandedFolders = new Set(), selectedCycle = null;
let project, report, byPath, groups, owner, lastState = {}, allEdges = [];
const relationName = () => relation === 'call' ? 'Possible calls' : 'Imports';
const filesInScope = () => scope === 'overview' ? report.files : report.files.filter(f=>f.areas.includes(scope));
const edgesFor = files => {const paths=new Set(files.map(f=>f.path));return allEdges.filter(e=>e.kind===relation&&e.source!==e.target&&paths.has(e.source)&&paths.has(e.target));};
function button(text, attrs='', cls=''){return `<button class="${cls}" ${attrs}>${text}</button>`;}
const fileButton = path => button(esc(short(path)),`data-file="${esc(path)}" title="${esc(path)}"`);
function urlState(){const q=new URLSearchParams({variant,scope,relation});if(selected)q.set('file',selected);history.replaceState(null,'','?'+q);}
function chooseFile(path){selected=path;selectedCycle=null;render();}
function chooseScope(next){scope=next;selected='';selectedCycle=null;search='';neighborhood=false;render();}
function switchVariant(next){variant=next;selectedCycle=null;if(variant!=='A'&&scope==='overview')scope='log-viewer-app/main';render();}

function assignGroups(){
    groups=new Map();owner=new Map();
    for(const file of report.files){
        // Display containment is exclusive. Analysis membership remains many-to-many and is shown separately.
        const candidates=project.config.areas.flatMap(a=>a.roots.map(root=>({area:a.name,root:root.replaceAll('\\','/')}))).filter(x=>file.path===x.root||file.path.startsWith(x.root+'/')).sort((a,b)=>b.root.length-a.root.length);
        let id=candidates[0]?.area;
        if(!id){const parts=file.path.split('/');const src=parts.indexOf('src');id=src>=0?parts.slice(0,src+2).join('/'):parts[0]+'/other';}
        if(!groups.has(id))groups.set(id,{id,app:file.path.split('/')[0],files:[]});
        groups.get(id).files.push(file);owner.set(file.path,id);
    }
}
function aggregateGroups(){const result=new Map();for(const e of allEdges.filter(e=>e.kind===relation&&e.source!==e.target)){
    const a=owner.get(e.source),b=owner.get(e.target);if(!a||!b||a===b)continue;
    const key=a+'\0'+b;if(!result.has(key))result.set(key,{source:a,target:b,edges:[]});result.get(key).edges.push(e);
}return [...result.values()].sort((a,b)=>b.edges.length-a.edges.length);}

function sidebar(){
    $('sidebar').innerHTML=`<small>PROJECTS</small><strong>DART / main</strong><p class="path">${esc(project.config.root)}</p>${button('▦ 전체 개요','data-scope="overview"',scope==='overview'?'active':'')}<small>분석 영역 · 소속은 중복 가능</small>${project.config.areas.map(a=>button(esc(a.name.replace('log-viewer-app/','LV / ').replace('query-service-gui/','QS / ').replace('worker:src/main/','worker / ')),`data-scope="${esc(a.name)}"`,scope===a.name?'active':'plain')).join('')}<small>표시의 의미</small><p style="font-size:11px">화살표는 ${relationName()}의 방향입니다. 시간 순서나 IPC 흐름을 의미하지 않습니다.</p>`;
    if(variant==='C'&&scope!=='overview'){
        const folders=new Map();for(const f of filesInScope()){if(!folders.has(f.folder))folders.set(f.folder,[]);folders.get(f.folder).push(f);}
        $('sidebar').innerHTML+=`<small>폴더에서 파일 선택</small><div class="tree">${[...folders].map(([folder,files])=>`<details><summary>${esc(folder.replace('log-viewer-app/src/',''))} (${files.length})</summary>${files.map(f=>fileButton(f.path)).join('')}</details>`).join('')}</div>`;
    }
}
function overviewA(){
    const apps=[...new Set([...groups.values()].map(g=>g.app))];
    const grouped=aggregateGroups();
    $('content').innerHTML=`<div class="stats"><div><strong>${report.files.length}</strong><span>전체 파일</span></div><div><strong>${project.config.areas.length}</strong><span>분석 영역</span></div><div><strong>${groups.size}</strong><span>표시 그룹 · 파일 중복 없음</span></div><div><strong>${report.coverage.unanalyzed}</strong><span>미분석 파일</span></div></div><div class="apps">${apps.map(app=>{
        const children=[...groups.values()].filter(g=>g.app===app),count=children.reduce((n,g)=>n+g.files.length,0);
        return `<section class="app">${button(`<span>${expandedApps.has(app)?'▾':'▸'} ${esc(app)}</span><span class="metric">${count}</span>`,`data-app="${esc(app)}"`)}<small>${children.length}개 표시 그룹 · ${count} files</small>${expandedApps.has(app)?children.map(g=>button(`<span>${esc(g.id.replace(app+'/','').replace('worker:src/main/','worker / '))}</span><span class="metric">${g.files.length} →</span>`,`data-group="${esc(g.id)}"`,'area')).join(''):'<p style="font-size:12px">앱을 펼쳐 main / renderer / shared 등을 확인합니다.</p>'}</section>`;
    }).join('')}</div><section class="section"><h2>그룹 사이에서 확인된 연결</h2><p style="font-size:12px">독립 파일 쌍을 합산했습니다. 파일의 경로 소속으로 묶으며, 분석 영역 간 통신을 추정하지 않습니다.</p>${groupTable(grouped)}</section>`;
    lastState={display:'collapsed application overview',ownership:'longest matching source root; fallback path group',files:report.files.length,groups:[...groups.values()].map(g=>({name:g.id,files:g.files.length})),expandedApps:[...expandedApps],groupEdges:grouped.map(g=>({from:g.source,to:g.target,filePairs:g.edges.length}))};
}
function groupTable(grouped){return `<table class="table"><thead><tr><th>${relation==='call'?'호출하는 그룹':'가져오는 그룹'}</th><th>→ 대상 그룹</th><th>파일 쌍</th><th></th></tr></thead><tbody>${grouped.map((g,i)=>`<tr><td>${esc(g.source)}</td><td>→ ${esc(g.target)}</td><td>${g.edges.length}</td><td>${button('근거',`data-group-edge="${i}"`)}</td></tr>`).join('')||'<tr><td colspan="4">선택한 관계에서 그룹 간 연결을 확인하지 못했습니다.</td></tr>'}</tbody></table>`;}
function areaA(){
    const files=filesInScope(),folders=new Map(),edges=edgesFor(files);
    for(const f of files){if(!folders.has(f.folder))folders.set(f.folder,[]);folders.get(f.folder).push(f);}
    $('content').innerHTML=`<div class="tools">${button('← 접힌 전체 개요','data-scope="overview"')}${button('방향성 계층으로 보기 →','data-variant="B"','active')}</div><div class="stats"><div><strong>${files.length}</strong><span>영역에 포함된 파일</span></div><div><strong>${edges.length}</strong><span>${relationName()} 파일 쌍</span></div><div><strong>${folders.size}</strong><span>실제 폴더</span></div></div><p>main에 속한 분석 결과에는 shared 파일도 포함됩니다. 아래는 경로의 포함 관계이며 연결 방향은 B에서 확인합니다.</p><div class="folders">${[...folders].map(([folder,items])=>`<section class="folder">${button(`${expandedFolders.has(folder)?'▾':'▸'} ${esc(folder.replace('log-viewer-app/src/',''))} <span class="metric">${items.length}</span>`,`data-folder="${esc(folder)}"`)}<small>${items.filter(f=>f.status==='analyzed').length} analyzed / ${items.length} inventory</small>${expandedFolders.has(folder)?`<div class="list" style="max-height:270px;overflow:auto;margin-top:12px">${items.map(f=>fileButton(f.path)).join('')}</div>`:''}</section>`).join('')}</div>`;
    lastState={display:'folder containment',files:files.length,edges:edges.length,folders:[...folders].map(([name,items])=>({name,files:items.length})),expandedFolders:[...expandedFolders]};
}

// SCC condensation makes every visible component edge a DAG edge; rank uses longest source-to-node path.
function hierarchy(files,edges){
    const adjacency=new Map(files.map(f=>[f.path,[]]));edges.forEach(e=>adjacency.get(e.source).push(e.target));
    let index=0;const indices=new Map(),low=new Map(),stack=[],onStack=new Set(),components=[];
    function visit(v){indices.set(v,index);low.set(v,index++);stack.push(v);onStack.add(v);
        for(const w of adjacency.get(v)){if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(onStack.has(w))low.set(v,Math.min(low.get(v),indices.get(w)));}
        if(low.get(v)===indices.get(v)){const members=[];let w;do{w=stack.pop();onStack.delete(w);members.push(w);}while(w!==v);components.push({id:components.length,members:members.sort(),rank:0});}
    }files.forEach(f=>{if(!indices.has(f.path))visit(f.path);});
    const membership=new Map();components.forEach(c=>c.members.forEach(f=>membership.set(f,c.id)));
    const links=new Map();edges.forEach(e=>{const a=membership.get(e.source),b=membership.get(e.target);if(a!==b){const key=a+':'+b;if(!links.has(key))links.set(key,{source:a,target:b,count:0});links.get(key).count++;}});
    const outgoing=new Map(components.map(c=>[c.id,[]])),incoming=new Map(components.map(c=>[c.id,0]));
    for(const e of links.values()){outgoing.get(e.source).push(e.target);incoming.set(e.target,incoming.get(e.target)+1);}
    const queue=components.filter(c=>!incoming.get(c.id)).map(c=>c.id);
    while(queue.length){const id=queue.shift();for(const target of outgoing.get(id)){components[target].rank=Math.max(components[target].rank,components[id].rank+1);incoming.set(target,incoming.get(target)-1);if(!incoming.get(target))queue.push(target);}}
    const connected=new Set(edges.flatMap(e=>[e.source,e.target]));
    return {components,membership,links:[...links.values()],connected};
}
function layerB(){
    if(scope==='overview'){overviewA();return;}
    const files=filesInScope(),edges=edgesFor(files),h=hierarchy(files,edges);
    let visible=h.components.filter(c=>c.members.some(f=>h.connected.has(f)));
    if(search){const lower=search.toLowerCase(),matched=new Set(files.filter(f=>f.path.toLowerCase().includes(lower)).map(f=>f.path));
        const context=new Set([...matched].map(f=>h.membership.get(f)));edges.forEach(e=>{if(matched.has(e.source)||matched.has(e.target)){context.add(h.membership.get(e.source));context.add(h.membership.get(e.target));}});visible=visible.filter(c=>context.has(c.id));}
    if(neighborhood&&selected){const ids=new Set([h.membership.get(selected)]);edges.forEach(e=>{if(e.source===selected||e.target===selected){ids.add(h.membership.get(e.source));ids.add(h.membership.get(e.target));}});visible=visible.filter(c=>ids.has(c.id));}
    const shown=new Set(visible.map(c=>c.id)),links=h.links.filter(e=>shown.has(e.source)&&shown.has(e.target));
    const ranks=[...new Set(visible.map(c=>c.rank))].sort((a,b)=>a-b);
    const columns=ranks.map(rank=>visible.filter(c=>c.rank===rank).sort((a,b)=>a.members[0].localeCompare(b.members[0])));
    // Two barycentric sweeps reduce crossing without inventing a hierarchy from filenames.
    for(let pass=0;pass<2;pass++)for(let col=1;col<columns.length;col++){
        const order=new Map(columns.slice(0,col).flatMap(column=>column.map((c,i)=>[c.id,i])));
        const mean=c=>{const p=links.filter(e=>e.target===c.id&&order.has(e.source)).map(e=>order.get(e.source));return p.length?p.reduce((a,b)=>a+b,0)/p.length:1e6;};
        columns[col].sort((a,b)=>mean(a)-mean(b)||a.members[0].localeCompare(b.members[0]));
    }
    const positions=new Map();columns.forEach((column,x)=>column.forEach((c,y)=>positions.set(c.id,{x:24+x*280,y:60+y*72})));
    const width=Math.max(650,columns.length*280+20),height=Math.max(350,...columns.map(c=>c.length*72+80));
    const selectedId=h.membership.get(selected),isolated=files.filter(f=>!h.connected.has(f.path)),cycles=h.components.filter(c=>c.members.length>1);
    const entrySet=new Set(project.config.areas.find(a=>a.name===scope)?.entries||[]);
    const selectedLinks=new Set(edges.filter(e=>e.source===selected||e.target===selected).map(e=>h.membership.get(e.source)+':'+h.membership.get(e.target)));
    const paths=links.map(e=>{const a=positions.get(e.source),b=positions.get(e.target),hot=selectedLinks.has(e.source+':'+e.target);return `<path class="edge ${hot?'hot':selected?'dim':''}" d="M${a.x+220},${a.y+25} C${a.x+250},${a.y+25} ${b.x-35},${b.y+25} ${b.x},${b.y+25}" marker-end="url(#arrow)"><title>${e.count} distinct file pairs</title></path>`;}).join('');
    const nodes=visible.map(c=>{const p=positions.get(c.id),cyclic=c.members.length>1,name=cyclic?`↻ 순환 묶음 · ${c.members.length} files`:short(c.members[0]),entry=c.members.some(f=>entrySet.has(f));return `<g class="graphnode ${cyclic?'cyclic':''} ${c.id===selectedId?'selected':''}" transform="translate(${p.x},${p.y})" role="button" tabindex="0" aria-label="${esc(name)}" data-component="${c.id}"><title>${esc(c.members.join('\n'))}</title><rect width="220" height="53" rx="6"/><text x="10" y="21">${esc(name.length>28?name.slice(0,26)+'…':name)}</text><text class="minor" x="10" y="40">${entry?'ENTRY · ':''}${cyclic?'클릭하여 내부 파일 보기':esc(c.members[0].includes('/shared/')?'shared / '+byPath.get(c.members[0]).status:byPath.get(c.members[0]).status)}</text></g>`;}).join('');
    $('content').innerHTML=`<div class="tools"><input id="search" aria-label="계층 파일 검색" placeholder="파일 검색 → 해당 파일과 직접 연결만 표시" value="${esc(search)}">${button('검색','data-search="1"')}${button('전체 계층','data-all="1"',!neighborhood&&!search?'active':'')}${button('선택 주변 1단계','data-neighbors="1"',neighborhood?'active':'')}${button('−','data-zoom="-1"')}${button('+','data-zoom="1"')}</div><p style="font-size:12px">왼쪽 → 오른쪽: ${relation==='call'?'호출하는 파일 → 호출 대상':'가져오는 파일 → 의존 대상'} · 순환을 접은 뒤 관계 깊이로 배치합니다. 계층 0은 이 범위에서 선행 관계가 없는 묶음이며 실행 진입점과 다를 수 있습니다.</p><div class="row"><h2>${visible.reduce((n,c)=>n+c.members.length,0)} / ${files.length} files · ${visible.length}개 묶음</h2><span class="chip">${cycles.length} 순환 묶음 · ${isolated.length} 파일 별도 표시</span></div><div class="graphport" id="graphport"><svg width="${width*zoom}" height="${height*zoom}" viewBox="0 0 ${width} ${height}" aria-label="방향성 계층 파일 지도"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#8dbdcf"/></marker></defs>${ranks.map((rank,x)=>`<text class="ranktitle" x="${24+x*280}" y="28">계층 ${rank} · ${columns[x].length} 묶음</text>`).join('')}${paths}${nodes}</svg></div>${!visible.length?'<p>연결된 결과가 없습니다. 전체 계층으로 돌아가거나 검색어를 바꾸세요.</p>':''}<details class="shelf"><summary>이 범위에서 파일 간 ${relationName()} 연결을 확인하지 못한 ${isolated.length}개 파일</summary><p>미분석 파일과 분석했지만 연결이 없는 파일을 상태로 구별합니다. 파일 내부 호출은 계층에서 제외합니다.</p><div class="list">${isolated.map(f=>button(`${esc(short(f.path))} <span class="chip">${esc(f.status)}</span>`,`data-file="${esc(f.path)}"`)).join('')}</div></details>`;
    $('content').querySelectorAll('[data-component]').forEach(el=>{const activate=()=>{const c=h.components[Number(el.dataset.component)];if(c.members.length>1){selectedCycle=c;selected='';details();state();}else chooseFile(c.members[0]);};el.onclick=activate;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};});
    if(search||neighborhood){const note=document.createElement('p');note.className='notice';note.textContent='필터는 해당 파일의 직접 연결을 기준으로 합니다. 순환 묶음은 전체를 유지하므로 직접 연결되지 않은 내부 파일도 포함될 수 있습니다.';$('graphport').before(note);}
    $('search').onkeydown=e=>{if(e.key==='Enter')applySearch(e.target.value);};
    lastState={display:'SCC condensed DAG; longest-path rank; two barycentric sweeps',files:files.length,filePairs:edges.length,visibleFiles:visible.reduce((n,c)=>n+c.members.length,0),visibleComponents:visible.length,visibleComponentEdges:links.length,cycles:cycles.map(c=>({size:c.members.length,members:c.members})),unconnectedFiles:isolated.map(f=>({path:f.path,status:f.status})),search,neighborhood,zoom,ranks:columns.map((c,i)=>({rank:ranks[i],components:c.length}))};
}
function focusC(){
    if(scope==='overview'){overviewA();return;}
    const files=filesInScope(),edges=edgesFor(files),paths=new Set(files.map(f=>f.path));
    if(!paths.has(selected))selected=project.config.areas.find(a=>a.name===scope)?.entries.find(f=>paths.has(f))||files[0]?.path;
    const incoming=edges.filter(e=>e.target===selected),outgoing=edges.filter(e=>e.source===selected);
    const entry=project.config.areas.find(a=>a.name===scope)?.entries[0];
    const queue=entry&&paths.has(entry)?[entry]:[],previous=new Map(queue.map(f=>[f,null]));
    while(queue.length&&!previous.has(selected)){const file=queue.shift();for(const e of edges.filter(e=>e.source===file))if(!previous.has(e.target)){previous.set(e.target,file);queue.push(e.target);}}
    const trail=[];if(previous.has(selected)){let p=selected;while(p){trail.unshift(p);p=previous.get(p);}}
    $('content').innerHTML=`<div class="tools"><input id="focusSearch" aria-label="집중 화면 파일 검색" placeholder="파일 이름 검색" value="${esc(search)}">${button('찾기','data-focus-search="1"')}${button('전체 계층에서 보기','data-variant="B"')}</div><div id="matches" class="list">${search?files.filter(f=>f.path.toLowerCase().includes(search.toLowerCase())).map(f=>fileButton(f.path)).join(''):''}</div><h2>진입점에서 선택 파일까지</h2><div class="trail">${trail.length?trail.map(f=>fileButton(f)).join('<span>→</span>'):'이 범위의 정적 관계로 진입점에서 이어지는 경로를 확인하지 못했습니다.'}</div><p style="font-size:12px">확인된 최단 연결 경로 하나입니다. 이벤트 실행 순서나 유일한 경로를 뜻하지 않습니다.</p><div class="focusgrid"><section class="focuscol"><h2>${relation==='call'?'호출하는 쪽':'가져오는 쪽'} → <span class="metric">${incoming.length}</span></h2><div class="list">${incoming.map(e=>fileButton(e.source)).join('')||'<span class="muted">확인된 파일 없음</span>'}</div></section><section class="focuscol center"><small>SELECTED FILE</small><p class="bigfile">${esc(short(selected||''))}</p><span class="badge">${esc(byPath.get(selected)?.status||'')}</span><p class="path">${esc(selected||'')}</p><p style="font-size:12px">좌우의 파일을 눌러 한 단계씩 이동합니다. 긴 이름과 많은 연결을 읽는 데 집중한 구성입니다.</p></section><section class="focuscol"><h2>→ ${relation==='call'?'호출받는 쪽':'의존 대상'} <span class="metric">${outgoing.length}</span></h2><div class="list">${outgoing.map(e=>fileButton(e.target)).join('')||'<span class="muted">확인된 파일 없음</span>'}</div></section></div>`;
    $('focusSearch').onkeydown=e=>{if(e.key==='Enter'){search=e.target.value;render();}};
    lastState={display:'one-hop reading desk',files:files.length,selected,incoming:incoming.map(e=>e.source),outgoing:outgoing.map(e=>e.target),entry,shortestConfirmedPath:trail,search};
}
function details(){
    if(selectedCycle){const internal=edgesFor(filesInScope()).filter(e=>selectedCycle.members.includes(e.source)&&selectedCycle.members.includes(e.target));$('detail').innerHTML=`<small>STRONGLY CONNECTED</small><h2 class="cycle">↻ ${selectedCycle.members.length}개 파일의 순환 묶음</h2><p>파일 수준 ${relationName()}에서 서로 도달할 수 있습니다. 함수가 재귀한다는 뜻은 아닙니다.</p><h3>묶음 내부 파일</h3><div class="list">${selectedCycle.members.map(fileButton).join('')}</div><h3>내부 연결 ${internal.length}쌍</h3><div class="list">${internal.map(e=>`<div class="path">${esc(short(e.source))} → ${esc(short(e.target))}</div>`).join('')}</div>`;return;}
    if(!selected||!byPath.has(selected)){$('detail').innerHTML=`<small>READ THE STRUCTURE</small><h2>큰 단위부터 읽기</h2><div class="empty">${variant==='A'?'앱을 펼치고 영역을 선택해 보세요.':variant==='B'?'노드를 클릭하면 파일과 연결을 확인합니다. 노란 묶음은 순환입니다.':'파일을 선택해 앞뒤 관계를 읽어보세요.'}</div><h3>비교할 질문</h3><p>어디부터 들어가야 하는가?<br>의존 방향이 읽히는가?<br>관심 파일까지 길을 잃지 않는가?</p><h3>분석 범위</h3><p>${report.coverage.analyzed} / ${report.coverage.inventory} analyzed<br>${report.coverage.unanalyzed} unanalyzed</p><p style="font-size:12px">완료된 snapshot을 그대로 사용합니다. 실제 소스는 변경하지 않습니다.</p>`;return;}
    const file=byPath.get(selected),edges=edgesFor(filesInScope()),incoming=edges.filter(e=>e.target===selected),outgoing=edges.filter(e=>e.source===selected);
    const allIncident=allEdges.filter(e=>e.kind===relation&&e.source!==e.target&&(e.source===selected||e.target===selected));
    const shown=new Set(filesInScope().map(f=>f.path)),outside=allIncident.filter(e=>!shown.has(e.source)||!shown.has(e.target));
    $('detail').innerHTML=`<small>FILE DETAILS</small><h2>${esc(short(selected))}</h2><div class="path">${esc(selected)}</div><span class="badge">${esc(file.status)}</span><h3>현재 범위에서 확인된 파일 수</h3><div class="stats"><div><strong>${incoming.length}</strong><span>incoming</span></div><div><strong>${outgoing.length}</strong><span>outgoing</span></div></div><p style="font-size:12px">범위 밖 연결 ${outside.length}쌍 · ${file.metricStatus==='known'?'정적 분석 관측값':'부분·미분석으로 전체 수를 확정할 수 없음'}</p>${button('이 파일 중심으로 읽기','data-variant="C"')}<h3>분석 영역 소속</h3><div class="path">${file.areas.map(esc).join('<br>')}</div><h3>호출·의존 대상</h3><div class="list">${outgoing.map(e=>fileButton(e.target)).join('')||'<small>이 범위에서 확인된 대상 없음</small>'}</div><h3>소스 위치 표본</h3><div class="path">${file.functions.slice(0,6).map(f=>esc(f.location)).join('<br>')||'함수 위치 없음'}</div>`;
}
function state(){const current={prototype:true,variant,scope,relation:relationName(),snapshot:report.snapshot,created:report.created,selected,selectedCycle:selectedCycle?.members||null,...lastState};$('state').textContent=JSON.stringify(current,null,2);console.info('[hierarchy prototype]',current);}
function render(){
    if(!report)return;urlState();$('relation').value=relation;
    $('variantLabel').textContent=variant+' · '+variants[variant];
    $('eyebrow').textContent='DART / '+(scope==='overview'?'OVERVIEW':scope);
    $('title').textContent=variant==='A'?(scope==='overview'?'전체 구조를 먼저, 파일은 그다음.':'폴더를 펼쳐 구조를 좁혀보기'):variant==='B'?'연결 방향을 따라 읽는 파일 지도':'하나의 파일에서 앞뒤로 읽기';
    $('subtitle').textContent=variant==='A'?'포함 관계를 접고 펼칩니다. 관심 영역에 들어가면 연결 방향을 볼 수 있습니다.':variant==='B'?'순환은 묶고, 나머지는 방향에 따라 계층으로 배치합니다.':'전체 그림보다 파일 이름과 직접 연결을 읽는 데 집중합니다.';
    $('notice').innerHTML=`<div class="notice">${relationName()} · 정적 관계이며 실행 순서가 아닙니다. ${scope==='overview'?'IPC / 이벤트 연결을 추정해 추가하지 않았습니다.':'영역 소속에는 shared 파일이 포함되며 다른 영역과 겹칠 수 있습니다.'}</div>`;
    sidebar();if(variant==='A'){scope==='overview'?overviewA():areaA();}else if(variant==='B')layerB();else focusC();details();state();urlState();
}
function applySearch(value){search=value;neighborhood=false;selected=filesInScope().find(f=>search&&f.path.toLowerCase().includes(search.toLowerCase()))?.path||'';selectedCycle=null;render();}
document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.scope)chooseScope(d.scope);
    else if(d.variant)switchVariant(d.variant);
    else if(d.file)chooseFile(d.file);
    else if(d.app){expandedApps.has(d.app)?expandedApps.delete(d.app):expandedApps.add(d.app);render();}
    else if(d.folder){expandedFolders.has(d.folder)?expandedFolders.delete(d.folder):expandedFolders.add(d.folder);render();}
    else if(d.group){if(project.config.areas.some(a=>a.name===d.group))chooseScope(d.group);else{$('detail').innerHTML=`<h2>${esc(d.group)}</h2><p>경로 소속 그룹 · ${groups.get(d.group).files.length} files</p><div class="list">${groups.get(d.group).files.map(f=>fileButton(f.path)).join('')}</div>`;}}
    else if(d.groupEdge!==undefined){const g=aggregateGroups()[Number(d.groupEdge)];$('detail').innerHTML=`<h2>그룹 연결 근거</h2><p>${esc(g.source)} → ${esc(g.target)}</p><p>${g.edges.length} distinct file pairs · ${relationName()}</p><div class="list">${g.edges.map(e=>`<div>${fileButton(e.source)}<span> → </span>${fileButton(e.target)}</div>`).join('')}</div>`;}
    else if(d.search)applySearch($('search').value);
    else if(d.focusSearch){search=$('focusSearch').value;render();}
    else if(d.all){neighborhood=false;search='';render();}
    else if(d.neighbors){if(!selected)selected=project.config.areas.find(a=>a.name===scope)?.entries[0];neighborhood=true;search='';render();}
    else if(d.zoom){zoom=Math.max(.45,Math.min(1.6,zoom+Number(d.zoom)*.15));render();}
});
function cycle(delta){const keys=Object.keys(variants);switchVariant(keys[(keys.indexOf(variant)+delta+keys.length)%keys.length]);}
$('previous').onclick=()=>cycle(-1);$('next').onclick=()=>cycle(1);
$('relation').onchange=e=>{relation=e.target.value;selectedCycle=null;render();};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();cycle(e.key==='ArrowLeft'?-1:1);}});
fetch('/prototype-data').then(r=>r.json()).then(data=>{
    project=data.project;report=data.model;byPath=new Map(report.files.map(f=>[f.path,f]));
    // Report edges are file pairs; deduplicate defensively so numbers do not count callsites.
    allEdges=[...new Map(report.edges.map(e=>[e.kind+'\0'+e.source+'\0'+e.target,e])).values()];
    if(scope!=='overview'&&!project.config.areas.some(a=>a.name===scope))scope='overview';
    assignGroups();$('snapshot').textContent=`${report.created.slice(0,16).replace('T',' ')} UTC · ${report.snapshot.slice(0,10)}`;render();
}).catch(error=>{$('title').textContent='시제품 결과를 불러오지 못했습니다.';$('content').textContent=error.message;});
