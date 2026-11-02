/* Formatting and HTML helpers, modal, toasts, hash router, sidebar navigation, delegated event handling */
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const p2=n=>String(n).padStart(2,"0");
const fmtD=ts=>{if(!ts)return "–";const d=new Date(ts);return p2(d.getDate())+"/"+p2(d.getMonth()+1)+"/"+d.getFullYear();};
const fmtDT=ts=>{if(!ts)return "–";const d=new Date(ts);return fmtD(ts)+" "+p2(d.getHours())+":"+p2(d.getMinutes());};
function rel(ts){const d=(Date.now()-ts)/DAY;if(d<1/24)return "just now";if(d<1)return Math.round(d*24)+" h ago";if(d<2)return "yesterday";return Math.round(d)+" days ago";}
function dueTxt(ts){if(!ts)return "No due date";const d=Math.round((ts-Date.now())/DAY);if(d<0)return "Overdue by "+(-d)+(d===-1?" day":" days");if(d===0)return "Due today";return "Due in "+d+(d===1?" day":" days");}
const badge=s=>'<span class="badge '+badgeCls(s)+'">'+esc(s)+'</span>';
const ragDot=r=>'<span class="rag '+r+'" title="'+({g:"On track",w:"Due soon",b:"Overdue"})[r]+'" aria-hidden="true"></span>';
let ACTS=new Set();
const refreshActs=()=>{ACTS=new Set(reqTasks(me()).map(t=>t.key));};
const has=(...k)=>k.some(x=>ACTS.has(x));
const cntActs=pre=>[...ACTS].filter(k=>pre.includes(k.split(":")[0])).length;
const docNeeds=d=>[...ACTS].some(k=>/^(own|publish|comments|approve):/.test(k)&&k.split(":")[1]===d.id);
const adot=c=>c?'<span class="adot" role="img" aria-label="Action needed" title="Action needed"></span>':"";
const dA=c=>c?' data-dot title="Action needed"':"";
const dSR=c=>c?'<span class="sr-only">, action needed</span>':"";
const uname=id=>esc(U(id).name);
const toISO=ts=>{const d=new Date(ts);return d.toISOString().slice(0,10);};
const fromISO=s=>s?new Date(s+"T12:00:00").getTime():null;

function toast(msg){const box=document.getElementById("toasts");while(box.children.length>1)box.firstChild.remove();const el=document.createElement("div");el.className="toast";el.textContent=msg;box.appendChild(el);setTimeout(()=>el.remove(),3200);}

/* modal */
const M=document.getElementById("modal");
function openModal({title,body,submit="Save",danger=false,onSubmit,wide}){
  M.style.width=wide?"min(760px,calc(100vw - 24px))":"";
  M.innerHTML='<form method="dialog" novalidate><h2 class="mh">'+esc(title)+'</h2><div class="mb">'+body+'<p class="err" id="mErr" hidden></p></div><div class="mf"><button type="button" class="btn ghost" value="cancel" data-close>'+(submit?"Cancel":"Close")+'</button>'+(submit?'<button class="btn'+(danger?" warn":"")+'" value="ok">'+esc(submit)+'</button>':"")+'</div></form>';
  const f=M.querySelector("form");
  M.querySelector("[data-close]").onclick=()=>M.close();
  M.onclose=()=>{M.style.width="";};
  f.onsubmit=async e=>{e.preventDefault();try{const err=onSubmit?await onSubmit(new FormData(f),f):null;if(err){const p=M.querySelector("#mErr");if(p){p.textContent=err;p.hidden=false;}return;}M.close();}catch(ex){console.error(ex);const p=M.querySelector("#mErr");if(p){p.textContent=ex&&ex.message||"Error";p.hidden=false;}}};
  M.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>M.close()));
  M.showModal();const first=f.querySelector("input:not([type=hidden]),select,textarea");if(first)first.focus();
}
const fld=(label,inner,id)=>'<div class="field"><label'+(id?' for="'+id+'"':"")+'>'+esc(label)+'</label>'+inner+'</div>';
const opts=(list,sel)=>list.map(o=>'<option value="'+esc(o.v)+'"'+(o.v===sel?" selected":"")+'>'+esc(o.l)+'</option>').join("");
const userOpts=(users,sel,blank,short)=>(blank?'<option value="">'+esc(blank)+'</option>':"")+opts(users.map(u=>({v:u.id,l:u.name+(u.title&&!short?", "+u.title:"")})),sel);

/* sanitizer for editor HTML */
const ALLOWED={H3:1,H4:1,P:1,OL:1,UL:1,LI:1,B:1,STRONG:1,I:1,EM:1,BR:1,U:1};
function sanitize(html){
  const doc=new DOMParser().parseFromString("<div>"+html+"</div>","text/html");const root=doc.body.firstChild;
  (function walk(n){[...n.childNodes].forEach(c=>{if(c.nodeType===3)return;if(c.nodeType!==1){c.remove();return;}
    walk(c);if(c.tagName==="DIV"){const p=doc.createElement("p");while(c.firstChild)p.appendChild(c.firstChild);c.replaceWith(p);return;}
    if(!ALLOWED[c.tagName]){while(c.firstChild)c.parentNode.insertBefore(c.firstChild,c);c.remove();return;}
    [...c.attributes].forEach(a=>c.removeAttribute(a.name));});})(root);
  return root.innerHTML;
}

/* routing */
const ROUTES={};
const route=(name,fn)=>ROUTES[name]=fn;
let afterRender=[];
function parse(){const raw=(location.hash||"#/search").slice(2);const qIdx=raw.indexOf("?");const pathPart=qIdx>=0?raw.slice(0,qIdx):raw;const h=pathPart.split("/");return {name:h[0]||"search",args:h.slice(1)};}
function go(h){if(location.hash===h)render();else location.hash=h;}
function denied(msg){return '<h1>Not available for this role</h1><p class="sub">'+esc(msg||"Switch role in the header to see this page.")+'</p><a class="btn sec" href="#/dashboard">Go to My Tasks</a>';}
/* Breadcrumb origin: the last top-level page the user visited */
const HUBS={search:"Home",dashboard:"My Tasks",library:"Document library",tec:"TEC inbox",users:"Users",projects:"Projects",catalogue:"Document catalogue"};
function trackNav(r){if(HUBS[r.name])try{sessionStorage.setItem("tender_proto_hub",JSON.stringify({hash:"#/"+r.name,label:HUBS[r.name]}));}catch(e){}}
function currentOrigin(){try{const s=sessionStorage.getItem("tender_proto_hub");if(s)return JSON.parse(s);}catch(e){}return {hash:"#/dashboard",label:"My Tasks"};}

function backBar(crumbInner, fallbackHash){
  return '<div class="crumbs-bar">' +
    '<button type="button" class="btn-back" data-act="goBack" data-fallback="' + esc(fallbackHash||"") + '" title="Go back to previous step">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>' +
      'Back' +
    '</button>' +
    '<p class="crumbs">' + crumbInner + '</p>' +
  '</div>';
}

const originLink=o=>'<a href="'+o.hash+'">'+esc(o.label)+'</a> / ';
function tenderBreadcrumbs(t){const p=projOf(t),o=currentOrigin();
  if(!p)return backBar(esc(t.code),o.hash);
  return backBar(originLink(o)+'<a href="#/search/'+p.id+'">'+esc(p.name)+'</a> / '+esc(t.code),o.hash);}
function docBreadcrumbs(d,t){const o=currentOrigin();
  if(!t)return backBar('<a href="'+o.hash+'">'+esc(o.label)+'</a>',o.hash);
  return backBar(originLink(o)+(canSeeTender(me(),t)?'<a href="#/tender/'+t.id+'/documents">'+esc(t.code)+'</a>':esc(t.code)),o.hash);}
function packageBreadcrumbs(p,t){const o=currentOrigin();return backBar(originLink(o)+'<a href="#/tender/'+t.id+'/overview">'+esc(t.code)+'</a>',o.hash);}
const tecBreadcrumbs=()=>backBar('<a href="#/tec">TEC inbox</a>',currentOrigin().hash);

let routeStack=[];
function render(keepScroll){
  let r=parse();const u=me();afterRender=[];
  if(u.status!=="Active"){S.me="u-admin";save();}
  const red=gsRedirectHash(r);if(red){history.replaceState(null,"",red);r=parse();}
  trackNav(r);
  const curHash=location.hash||"#/search";
  if(!routeStack.length||routeStack[routeStack.length-1]!==curHash){
    routeStack.push(curHash);
    if(routeStack.length>30)routeStack.shift();
  }
  refreshActs();
  const fn=ROUTES[r.name]||ROUTES.home;
  let html;try{html=fn(...r.args);}catch(e){console.error(e);html=denied("This page could not be shown. "+e.message);}
  const v=document.getElementById("view");const y=window.scrollY;
  v.innerHTML=html;renderNav(r);renderTop();
  afterRender.forEach(f=>f());
  initSortableHeaders();
  if(typeof paginateAll==="function")paginateAll();
  if(keepScroll)window.scrollTo(0,y);else{window.scrollTo(0,0);}
}
function rerender(){save();render(true);}
window.addEventListener("hashchange",()=>render());

/* nav */
let SIDEBAR_COLLAPSED = false;
try {
  SIDEBAR_COLLAPSED = localStorage.getItem("tender_proto_sidebar_collapsed") === "true";
} catch(e){}

function navIcon(r){
  const m={
    search:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    dashboard:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>',
    users:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    catalogue:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="12" y1="6" x2="16" y2="6"></line><line x1="12" y1="10" x2="16" y2="10"></line></svg>',
    tec:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>',
    projects:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    library:'<svg class="nav-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
  };
  return m[r]||m.search;
}

function navItems(u){
  const taskCount = reqTasks(u).length;
  const items=[
    {l:"Home",h:"#/search",r:"search"},
    {l:"My Tasks",h:"#/dashboard",r:"dashboard",n:taskCount}
  ];
  if(isAdmin(u))items.push({l:"Users",h:"#/users",r:"users"});
  if(isAdmin(u)||canCreateProject(u)||isProjectLeadUser(u))items.push({l:"Projects",h:"#/projects",r:"projects"});
  items.push({l:"Document library",h:"#/library",r:"library"});
  if(isAdmin(u))items.push({l:"Document catalogue",h:"#/catalogue",r:"catalogue"});
  if(S.tenders.some(t=>isTEC(u,t)))items.push({l:"TEC inbox",h:"#/tec",r:"tec",n:S.packages.filter(p=>p.status===PS.TEC&&isTEC(u,T(p.tenderId))&&!p.tecViews[u.id]).length});
  return items;
}
const AREA={users:["invite"],library:["review"],tec:["tecApprove","tecRead"]};
function renderNav(r){r=r||parse();refreshActs();
  const shell=document.querySelector(".shell");
  if(shell) shell.classList.toggle("sidebar-collapsed", SIDEBAR_COLLAPSED);
  const nav=document.getElementById("nav");
  if(nav) nav.classList.toggle("collapsed", SIDEBAR_COLLAPSED);
  const u=me(),items=navItems(u);items.forEach(i=>{if(i.r && AREA[i.r])i.n=cntActs(AREA[i.r]);});const cur=r.name;
  const collapseIco = SIDEBAR_COLLAPSED ?
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><polyline points="13 10 15 12 13 14"></polyline></svg>' :
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><polyline points="15 10 13 12 15 14"></polyline></svg>';

  let h='<div class="side-head">'+
    '<span class="side-head-label">App name</span>'+
    '<button type="button" class="side-collapse-btn" data-act="toggleSidebar" title="'+(SIDEBAR_COLLAPSED?'Expand sidebar':'Collapse sidebar')+'" aria-label="'+(SIDEBAR_COLLAPSED?'Expand sidebar':'Collapse sidebar')+'">'+
      collapseIco+
    '</button>'+
  '</div>'+
  '<div class="side-nav">';
  items.forEach(i=>{
    const ico = navIcon(i.r);
    h+='<a href="'+i.h+'"'+(cur===i.r?' aria-current="page"':"")+' title="'+esc(i.l)+'">'+
      '<span class="nav-left">'+ico+'<span class="nav-label">'+esc(i.l)+'</span></span>'+
      (i.n?'<span class="n" aria-label="'+i.n+' to do">'+i.n+'</span>':"")+
    '</a>';
  });
  h+='</div>';
  h+='<div class="who">'+
    '<div class="who-avatar" title="'+esc(u.name)+' ('+esc(u.role||u.title||"")+')">'+
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'+
    '</div>'+
    '<div class="who-info">'+
      '<b>'+esc(u.name)+'</b>'+
      '<span>'+esc(u.role||u.title||"")+'</span>'+
    '</div>'+
    '<button class="who-logout" type="button" data-act="logout" title="Log out" aria-label="Log out">'+
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'+
    '</button>'+
  '</div>';
  document.getElementById("nav").innerHTML=h;
}
function renderTop(){
  const sel=document.getElementById("roleSel");
  if(!sel) return;
  if(!ROLES.some(r=>r.u===S.me)){ S.me="u-ic"; save(); }
  const curU=me();
  const curCount=curU ? reqTasks(curU).length : 0;
  const curBadge=curCount ? " ("+curCount+")" : "";

  sel.innerHTML=ROLES.map(r=>{
    const u=U(r.u);
    const count=u ? reqTasks(u).length : 0;
    const badge=count ? " ("+count+")" : "";
    return '<option value="'+r.u+'"'+(r.u===S.me?" selected":"")+'>'+esc(r.label+" ("+(u?u.name:"")+")"+badge)+'</option>';
  }).join("");
}
function resetSearchState(){
  if(typeof closeAllDd === "function") closeAllDd();
  const dd = document.getElementById("gsSearchDropdown");
  if(dd){
    if(dd.remove) dd.remove();
    else if(dd.parentNode) dd.parentNode.removeChild(dd);
  }
  if(typeof GS_STATE !== "undefined"){
    GS_STATE = { pId: "", tId: "", docId: "", query: "", tenderTab: "overview", tenderDocSubtab: "all", phase: "Tender Preparation", searchDropdownOpen: false, searchDdTab: "all" };
  }
  const mainInp = document.getElementById("gsMainQuery");
  if(mainInp) mainInp.value = "";
}

document.getElementById("roleSel").addEventListener("change",e=>{
  S.me=e.target.value;
  save();
  resetSearchState();
  toast("Now viewing as "+me().name+", "+(ROLES.find(r=>r.u===S.me)||{label:""}).label);
  if(location.hash === "#/search") render();
  else location.hash = "#/search";
});

/* delegated actions */
const ACT={};
document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const f=ACT[el.dataset.act];if(f){e.preventDefault();f(el,e);}});
document.addEventListener("change",e=>{const el=e.target.closest("[data-chg]");if(!el)return;const f=ACT[el.dataset.chg];if(f)f(el,e);});
document.addEventListener("input",e=>{const el=e.target.closest("[data-inp]");if(!el)return;const f=ACT[el.dataset.inp];if(f)f(el,e);});
ACT.goBack=el=>{
  const fallback=el&&el.dataset&&el.dataset.fallback;
  if(routeStack.length>1){
    routeStack.pop();
    const prev=routeStack.pop();
    go(prev);
    return;
  }
  if(window.history.length>1){
    window.history.back();
    return;
  }
  if(fallback){
    go(fallback);
  }else{
    go(currentOrigin().hash||"#/dashboard");
  }
};
ACT.toggleSidebar=()=>{
  SIDEBAR_COLLAPSED = !SIDEBAR_COLLAPSED;
  try {
    localStorage.setItem("tender_proto_sidebar_collapsed", SIDEBAR_COLLAPSED ? "true" : "false");
  } catch(e){}
  const shell=document.querySelector(".shell");
  const nav=document.getElementById("nav");
  if(shell) shell.classList.toggle("sidebar-collapsed", SIDEBAR_COLLAPSED);
  if(nav) nav.classList.toggle("collapsed", SIDEBAR_COLLAPSED);
  renderNav();
};
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="b"){
    const el=document.activeElement;
    if(el && (el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable)) return;
    e.preventDefault();
    ACT.toggleSidebar();
  }
});
ACT.logout=()=>openModal({title:"Log out",body:'<p>You are currently signed in as <b>'+esc(me().name)+'</b> ('+esc(me().role||"User")+').</p>',submit:"Sign out",onSubmit:()=>{S.me="u-admin";save();resetSearchState();rerender();toast("You have been signed out.");go("#/search");}});
ACT.resetDemo=()=>openModal({title:"Reset demo data?",body:'<p>This clears every change you made in this browser and restores the sample programme of 123 projects.</p>',submit:"Reset",danger:true,onSubmit:()=>{const who=S.me;S=seed();migrate();S.me=who;save();resetSearchState();toast("Demo data reset");go("#/search");}});
