/* Document library: status pipeline, categories/types config, list, upload */
/* ---------- Document library ---------- */
let LIB_SEARCH="";

function docMatchesSearch(d){
  if(!LIB_SEARCH)return true;
  const q=LIB_SEARCH.toLowerCase();
  const nameMatch=d.name&&d.name.toLowerCase().includes(q);
  const fileMatch=d.fileName&&d.fileName.toLowerCase().includes(q);
  const p=libProj(d);
  const pMatch=p&&((p.code&&p.code.toLowerCase().includes(q))||(p.name&&p.name.toLowerCase().includes(q)));
  const ct=libCatType(d);
  const typeMatch=(ct.cat+" "+ct.type).toLowerCase().includes(q);
  const up=libUploader(d);
  const ownerMatch=up&&U(up)&&U(up).name.toLowerCase().includes(q);
  const statusMatch=libStatus(d).toLowerCase().includes(q);
  return nameMatch||fileMatch||pMatch||typeMatch||ownerMatch||statusMatch;
}

function highlightSearch(text,q){
  if(!q)return esc(text||"");
  const s=text||"";
  const idx=s.toLowerCase().indexOf(q.toLowerCase());
  if(idx===-1)return esc(s);
  return esc(s.slice(0,idx))+'<mark style="background:#ffd166;color:#111;border-radius:2px;padding:0 2px">'+esc(s.slice(idx,idx+q.length))+'</mark>'+esc(s.slice(idx+q.length));
}

/* Library file status: Uploading → Scanning → Processing → Ready, or Failed */
const LIB_ST={Uploading:"",Scanning:"a",Processing:"w",Ready:"g",Failed:"b"};
const LIB_ST_FLOW=["Uploading","Scanning","Processing","Ready"];
const LIB_ST_TIP={Uploading:"File is being uploaded",Scanning:"Checking the file for viruses and malware",Processing:"Extracting text and preparing the preview",Ready:"Available to open and download",Failed:"The file couldn't be processed. Retry or upload it again."};
function libStatus(d){
  if(d.libStatus&&LIB_ST[d.libStatus]!==undefined)return d.libStatus;
  // Seeded documents get a stable demo status so every state is visible
  let h=0;const s=String(d.id||d.name||"");
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  const r=h%40;
  return r===0?"Failed":r===1?"Processing":r===2?"Scanning":r===3?"Uploading":"Ready";
}
function libStatusBadge(d){
  const st=libStatus(d);
  return '<span class="badge'+(LIB_ST[st]?' '+LIB_ST[st]:'')+'" title="'+esc(LIB_ST_TIP[st])+'">'+
    esc(st)+'</span>'+
    (st==="Failed"&&d.libStatus?' <button type="button" class="btn sec sm" style="margin-left:4px;padding:1px 8px" data-act="libRetry" data-id="'+d.id+'">Retry</button>':'');
}
const LIB_TIMERS={};
function libAdvance(id){
  const d=byId(S.docs,id);
  if(!d||!d.libStatus||d.libStatus==="Ready"||d.libStatus==="Failed"){delete LIB_TIMERS[id];return;}
  LIB_TIMERS[id]=setTimeout(()=>{
    const i=LIB_ST_FLOW.indexOf(d.libStatus);
    d.libStatus=d.libFail&&d.libStatus==="Processing"?"Failed":LIB_ST_FLOW[i+1]||"Ready";
    save();
    updateLibTable();
    if(d.libStatus==="Ready")toast("'"+d.name+"' is ready");
    else if(d.libStatus==="Failed")toast("'"+d.name+"' failed to process");
    libAdvance(id);
  },1800+Math.random()*1400);
}
function libResume(){S.docs.forEach(d=>{if(d.libStatus&&!LIB_TIMERS[d.id])libAdvance(d.id);});}
ACT.libRetry=el=>{
  const d=byId(S.docs,el.dataset.id);if(!d)return;
  d.libStatus="Uploading";d.libFail=false;save();updateLibTable();libAdvance(d.id);
};

/* Library documents belong to a project (no tender).
   Document categories and their types are a pre-defined list kept in the back end as configuration (more categories to come).
   A category without its own types yet uses its name as the only type. */
const LIB_DOC_CONFIG=[
  {cat:"Instructions to Tenderers",types:["ITT-Appendix A","ITT-Appendix B"]},
  {cat:"Condition of Contracts",types:["CoC-A","CoC-B"]},
  {cat:"General Specs",types:[]},
  {cat:"Particular Specs",types:[]},
  {cat:"Funding Paper",types:[]},
  {cat:"Letter of Acceptance",types:[]}
];
const LIB_DOC_TYPES=Object.fromEntries(LIB_DOC_CONFIG.map(c=>[c.cat,c.types.length?c.types:[c.cat]]));
const LIB_CATS=LIB_DOC_CONFIG.map(c=>c.cat);
const LIB_CAT_RENAMED={"Instruction to Tenderers":"Instructions to Tenderers"};
function libProj(d){if(d.projectId)return PR(d.projectId);const t=T(d.tenderId);return t?projOf(t):null;}
function libCatType(d){
  const saved=LIB_CAT_RENAMED[d.libCat]||d.libCat;
  if(saved&&LIB_DOC_TYPES[saved])return {cat:saved,type:LIB_DOC_TYPES[saved].includes(d.libType)?d.libType:LIB_DOC_TYPES[saved][0]};
  // Older sample documents: map by name where it's obvious, otherwise a stable pick so every pair shows up
  const n=(d.name||"").toLowerCase();
  let h=0;const k=String(d.id||n);for(let i=0;i<k.length;i++)h=(h*31+k.charCodeAt(i))>>>0;
  const cat=/condition|contract form/.test(n)?"Condition of Contracts":/instruction|invitation|form of tender|returnable/.test(n)?"Instructions to Tenderers":/general spec/.test(n)?"General Specs":/particular spec/.test(n)?"Particular Specs":/funding/.test(n)?"Funding Paper":/letter of acceptance/.test(n)?"Letter of Acceptance":LIB_CATS[h%LIB_CATS.length];
  const types=LIB_DOC_TYPES[cat];
  return {cat,type:types[(h>>>3)%types.length]};
}

/* Who uploaded the file (first version's author), which may differ from the document owner */
function libUploader(d){return (d.versions&&d.versions[0]&&d.versions[0].by)||d.ownerId||null;}

/* Download straight from the list; only files that finished processing can be downloaded */
function libDownloadBtn(d,docName){
  const ready=libStatus(d)==="Ready";
  const tip=ready?"Download "+(d.fileName||docName):"Download available once the file is Ready ("+libStatus(d)+")";
  return '<button type="button" class="circle-btn" data-act="downloadDocFile" data-id="'+d.id+'" title="'+esc(tip)+'" aria-label="'+esc(tip)+'"'+(ready?'':' disabled style="opacity:.4;cursor:not-allowed"')+'>'+
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>';
}

function libDocRow(d){
  const t=T(d.tenderId);
  const p=libProj(d);
  const cat=d.catId?byId(S.catalogue,d.catId):null;
  const ct=libCatType(d);
  const docName=(cat&&d.name===cat.name&&t)?t.code+" "+d.name:d.name;

  const extBadge=d.fileName?' <span class="badge" style="font-size:10px;padding:1px 5px;margin-left:4px">'+esc((d.fileName.split('.').pop()||'DOC').toUpperCase())+'</span>':'';
  const fileSub=d.fileName?'<div class="small muted" style="margin-top:2px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'+highlightSearch(d.fileName,LIB_SEARCH)+'</div>':'';

  return '<tr>'+
    '<td>'+(p?'<a href="#/search/'+p.id+'" style="font-weight:600;color:inherit;text-decoration:none">'+highlightSearch(p.name,LIB_SEARCH)+'</a>':'<span class="muted">–</span>')+'</td>'+
    '<td><b>'+highlightSearch(docName,LIB_SEARCH)+'</b>'+extBadge+adot(docNeeds(d))+fileSub+'</td>'+
    '<td>'+highlightSearch(ct.cat,LIB_SEARCH)+'</td>'+
    '<td>'+highlightSearch(ct.type,LIB_SEARCH)+(d.audience==="Internal"?' <span class="tag">Internal</span>':'')+'</td>'+
    '<td>'+(libUploader(d)?highlightSearch(uname(libUploader(d)),LIB_SEARCH):'<span class="muted">Unknown</span>')+'</td>'+
    '<td class="nowrap">'+libStatusBadge(d)+'</td>'+
    '<td class="nowrap small">'+updTxt(d)+'</td>'+
    '<td class="c nowrap">'+libDownloadBtn(d,docName)+' <button type="button" class="circle-btn lib-del" data-act="delDoc" data-id="'+d.id+'" data-back="#/library" title="Delete '+esc(docName)+'" aria-label="Delete '+esc(docName)+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></td>'+
  '</tr>';
}

function renderDocumentLibraryTable(){
  const allApproved=S.docs.filter(isApproved);
  const filteredDocs=allApproved.filter(docMatchesSearch);

  if(!allApproved.length){
    return '<div class="empty">No approved documents in the library. Documents will be recorded here once approved.</div>';
  }
  if(LIB_SEARCH&&!filteredDocs.length){
    return '<div class="empty" style="padding:36px 20px">'+
      '<p style="margin:0 0 10px">No approved documents found matching &ldquo;<b>'+esc(LIB_SEARCH)+'</b>&rdquo;.</p>'+
      '<button type="button" class="btn sec sm" data-act="clearLibSearch">Clear search</button>'+
    '</div>';
  }

  const sortedDocs=[...filteredDocs].sort((a,b)=>{
    const pa=libProj(a), pb=libProj(b);
    const pCmp=(pa&&pa.name?pa.name:"").localeCompare(pb&&pb.name?pb.name:"");
    if(pCmp!==0)return pCmp;
    return (a.name||"").localeCompare(b.name||"");
  });

  return '<div class="scroll"><table class="t"><thead><tr>'+
    '<th>Project</th>'+
    '<th>Document name</th>'+
    '<th>Document category</th>'+
    '<th>Document type</th>'+
    '<th>Uploaded by</th>'+
    '<th>Status</th>'+
    '<th>Last updated</th>'+
    '<th class="no-sort" style="width:84px"><span class="sr-only">Actions</span></th>'+
  '</tr></thead><tbody>'+
  sortedDocs.map(libDocRow).join("")+
  '</tbody></table></div>';
}

function updateLibTable(){
  const view=document.getElementById("libTableView");
  if(view)view.innerHTML=renderDocumentLibraryTable();
  const meta=document.getElementById("libSearchMeta");
  if(meta){
    const allApproved=S.docs.filter(isApproved);
    const matched=allApproved.filter(docMatchesSearch);
    meta.innerHTML=LIB_SEARCH?'Showing <b>'+matched.length+'</b> of '+allApproved.length:allApproved.length+' '+(allApproved.length===1?'document':'documents');
  }
  initSortableHeaders();
  if(typeof paginateAll==="function")paginateAll();
}

ACT.libSearch=el=>{
  LIB_SEARCH=el.value.trim().toLowerCase();
  const clr=document.getElementById("libSearchClear");
  if(clr)clr.style.display=LIB_SEARCH?"block":"none";
  updateLibTable();
};

ACT.clearLibSearch=()=>{
  LIB_SEARCH="";
  const inp=document.getElementById("libSearchInp");
  if(inp){inp.value="";if(inp.focus)inp.focus();}
  const clr=document.getElementById("libSearchClear");
  if(clr)clr.style.display="none";
  updateLibTable();
};

route("library",()=>{
  setTimeout(libResume,0);
  const allApproved=S.docs.filter(isApproved);
  const matchedDocs=allApproved.filter(docMatchesSearch);

  return '<div class="head"><div><h1>Document library</h1></div>'+
    '<div class="acts"><button class="btn" data-act="uploadDoc"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Upload document</button></div>'+
  '</div>'+
  '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 18px;flex-wrap:wrap">'+
    '<div class="proj-search-wrap" style="flex:1">'+
      '<svg class="search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'+
      '<input type="text" id="libSearchInp" class="proj-search-inp" placeholder="Search by document name, project, type..." value="'+esc(LIB_SEARCH)+'" data-inp="libSearch" autocomplete="off" aria-label="Search by document name">'+
      '<button type="button" id="libSearchClear" class="proj-search-clear" data-act="clearLibSearch" title="Clear search" style="'+(LIB_SEARCH?'display:block':'display:none')+'">&times;</button>'+
    '</div>'+
    '<span id="libSearchMeta" class="small muted">'+(LIB_SEARCH?'Showing <b>'+matchedDocs.length+'</b> of '+allApproved.length:allApproved.length+' '+(allApproved.length===1?'document':'documents'))+'</span>'+
  '</div>'+
  '<div id="libTableView">'+
    renderDocumentLibraryTable()+
  '</div>';
});
