/* My Tasks, Users (admin), Projects page, invites, document catalogue */
const ROLE_REQUIRED={"Project lead":["firstProject","createTenders","assignIC"],"Contract project IC":["assignSme","chooseDocs","assignOwner","collate","tecApprove","sendCR","resendCR","sendTD"],"SME":["publish","own"]};
const reqTasks=u=>myTasks(u).filter(t=>!t.opt);
function myTasks(u){
  const out=[],add=(key,what,ctx,link,status,r)=>out.push({key,what,ctx,link,status,r});
  S.docs.forEach(d=>{const t=T(d.tenderId);if(!t||t.manual)return;const tc=t.code+" "+t.title;
    if(d.ownerId===u.id){
      if(d.status===DS.NS)add("publish:"+d.id,"Start drafting "+d.name,tc+", "+dueTxt(d.due),"#/doc/"+d.id,d.status,docRag(d));
      else if(d.status===DS.DR){
        if(d.remarks){
          const lastAppr=d.approvals&&d.approvals.slice().reverse().find(a=>a.decision==="Returned");
          const supName=lastAppr?uname(lastAppr.approverId):(U(d.ownerId).superiorId?uname(U(d.ownerId).superiorId):"superior");
          add("own:"+d.id,"Revise "+d.name+" and send to "+supName+" for review",tc+(d.remarks?' — "'+d.remarks+'"':''),"#/doc/"+d.id,d.status,"b");
        } else {
          add("publish:"+d.id,"Finish "+d.name+" and send for approval",tc+", "+dueTxt(d.due),"#/doc/"+d.id,d.status,docRag(d));
        }
      }
      else if(d.status===DS.IR)add("own:"+d.id,"Send "+d.name+" for approval",tc+", "+dueTxt(d.due),"#/doc/"+d.id,d.status,docRag(d));
      else if(d.status===DS.RT){
        const lastAppr=d.approvals&&d.approvals.slice().reverse().find(a=>a.decision==="Returned");
        const supName=lastAppr?uname(lastAppr.approverId):(U(d.ownerId).superiorId?uname(U(d.ownerId).superiorId):"superior");
        add("own:"+d.id,"Revise "+d.name+" ("+supName+"'s remarks) and send for approval",tc+(d.remarks?' — "'+d.remarks+'"':''),"#/doc/"+d.id,d.status,"b");
      }
      const oc=d.comments.filter(c=>!c.resolved);
      if(oc.length&&EDITABLE.includes(d.status))add("comments:"+d.id,"Respond to "+oc.length+" open "+(oc.length===1?"comment":"comments")+" on "+d.name,tc,"#/doc/"+d.id,d.status,"g");}

    if(d.status===DS.PA&&isSuperiorOf(u,d.ownerId))add("approve:"+d.id,"Approve "+d.name,"From "+U(d.ownerId).name+", "+tc,"#/doc/"+d.id,d.status,"w");
  });
  S.tenders.forEach(t=>{if(t.manual)return;const p=pkgOf(t);
    if(isPL(u,projOf(t))){if(!t.icId)add("assignIC:"+t.id,"Assign a contract project IC to "+t.code,t.title,"#/tender/"+t.id+"/overview","Planned","w");
      else if(!t.tec.length)add("nominateTec:"+t.id,"Nominate the TEC for "+t.code,t.title,"#/tender/"+t.id+"/overview",tStatus(t),"g");}
    if(isIC(u,t)){const ds=reqDocs(t);
      if(!t.smes.length)add("assignSme:"+t.id,"Assign SMEs to "+t.code,t.title,"#/tender/"+t.id+"/team",tStatus(t),"g");
      else if(!ds.length)add("chooseDocs:"+t.id,"Create documents for "+t.code,t.title,"#/tender/"+t.id+"/documents",tStatus(t),"g");
      const un=ds.filter(d=>!d.ownerId&&!isApproved(d));if(un.length)add("assignOwner:"+t.id,"Assign an SME to "+un.length+(un.length===1?" document":" documents")+" on "+t.code,t.title,"#/tender/"+t.id+"/documents",tStatus(t),"w");

      if(!S.metrics.some(m=>m.tenderId===t.id))add("metrics:"+t.id,"Set success metrics for "+t.code,t.title,"#/tender/"+t.id+"/metrics",tStatus(t),"g");
      if(!p&&ds.length&&ds.every(isApproved))add("collate:"+t.id,"Collate the package for "+t.code,"All documents approved and ready to collate","#/tender/"+t.id+"/documents","Ready to collate","w");
      if(p&&p.status===PS.COL){
        if(!p.tecApproved)add("tecApprove:"+p.id,"TEC Approve "+t.code,"Package v"+p.version+" pending TEC approval","#/package/"+p.id,p.status,"w");
        add("sendCR:"+p.id,"Send "+t.code+" for contracts review","Package v"+p.version+(p.tecApproved?" (TEC approved)":""),"#/package/"+p.id,p.status,"g");
      }
      if(p&&p.status===PS.CHG)add("resendCR:"+p.id,"Resubmit "+t.code+" to contracts reviewer","Contracts reviewer returned package v"+p.version,"#/package/"+p.id,p.status,"b");
      if(p&&TD_READY.includes(p.status))add("sendTD:"+p.id,"Send "+t.code+" to Tender Division","Approved by the contracts team. Download the package and confirm it was sent","#/package/"+p.id,p.status,"w");}
    if(isCR(u)&&p){if(p.status===PS.ICR)add("crReview:"+p.id,"Review "+t.code+" "+t.title,"Package v"+p.version+" from "+U(t.icId).name,"#/package/"+p.id,p.status,"w");}
    if(p&&p.status===PS.TEC&&isTEC(u,t)&&!p.tecViews[u.id])add("tecRead:"+p.id,"Read "+t.code+" "+t.title,"Submitted "+rel(p.submittedAt),"#/tec/"+p.id,p.status,"w");
  });
  S.projects.forEach(pr=>{if(isPL(u,pr)&&!tendersOf(pr).length)add("createTenders:"+pr.id,"Create the list of tenders for "+pr.code+" "+pr.name,"Add each contract this project will tender.","#/search/"+pr.id,"Set up","w");});
  if(u.role==="Project lead"&&canCreateProject(u)&&!S.projects.some(p=>isPL(u,p)))add("firstProject","Create a project","Start by setting up the project","#/projects","Set up","w");
  if(isAdmin(u))S.users.filter(x=>x.status==="Invited").forEach(x=>add("invite:"+x.id,"Invitation pending for "+x.name,x.email,"#/users","Invited","g"));
  out.forEach(t=>{const req=ROLE_REQUIRED[u.role];t.opt=!!req&&!req.includes(t.key.split(":")[0]);});
  const w={b:0,w:1,g:2};return out.sort((a,b)=>w[a.r]-w[b.r]);
}
const taskList=ts=>ts.length?'<div class="list">'+ts.map(t=>'<a class="task" href="'+t.link+'" title="'+esc(t.ctx)+'">'+adot(true)+'<span class="what">'+esc(t.what)+'</span>'+badge(t.status)+'</a>').join("")+'</div>':'<div class="empty">Nothing to do right now.</div>';

route("dashboard",(tab)=>{
  const u=me(),ts=reqTasks(u);
  const curTab=tab||"tasks";
  return '<div class="head"><div><h1>My Tasks</h1></div></div>'+
    '<nav class="tabs" aria-label="Tasks sections" style="margin-top:14px">'+
      '<a href="#/dashboard"'+(curTab==="tasks"?' aria-current="page"':'')+'>To do <span class="muted small">'+ts.length+'</span></a>'+
    '</nav>'+
    '<div class="legend"><span>'+adot(true)+'To do</span><span>'+ragDot("w")+'Due soon</span><span>'+ragDot("b")+'Overdue</span></div>'+
    '<h2 class="sec" style="margin-top:8px">To do</h2>'+taskList(ts);
});

/* Old addresses (notifications, bookmarks) open their current equivalents */
["home","projects","board","tenders"].forEach(n=>route(n,()=>{go("#/search");return "";}));
["mydocs","approvals","contracts","evaluation"].forEach(n=>route(n,()=>{go("#/dashboard");return "";}));

/* ---------- Admin ---------- */
let USER_SEARCH="";
const userSearchText=u=>{const c=byId(S.companies,u.companyId)||{};return [u.name,u.email,c.name,team(u).name,u.role,u.status].join(" ").toLowerCase();};
function applyUserSearch(){const q=USER_SEARCH;let n=0;
  document.querySelectorAll("#usersTable tbody tr[data-q]").forEach(tr=>{const hit=!q||tr.dataset.q.includes(q);tr.hidden=!hit;if(hit)n++;});
  const meta=document.getElementById("userSearchMeta");if(meta)meta.innerHTML=q?'Showing <b>'+n+'</b> of '+S.users.length:S.users.length+' '+(S.users.length===1?'user':'users');
  const empty=document.getElementById("userSearchEmpty");if(empty)empty.hidden=!(q&&!n);
  if(typeof paginateAll==="function")paginateAll();}
ACT.userSearch=el=>{USER_SEARCH=el.value.trim().toLowerCase();const clr=document.getElementById("userSearchClear");if(clr)clr.style.display=USER_SEARCH?"block":"none";applyUserSearch();};
ACT.clearUserSearch=()=>{USER_SEARCH="";const inp=document.getElementById("userSearchInp");if(inp){inp.value="";inp.focus();}const clr=document.getElementById("userSearchClear");if(clr)clr.style.display="none";applyUserSearch();};
route("users",()=>{if(!isAdmin(me()))return denied("Only system admins manage users.");
  afterRender.push(applyUserSearch);
  const rows=S.users.map(u=>{const c=byId(S.companies,u.companyId);return '<tr data-q="'+esc(userSearchText(u))+'"><td><b>'+esc(u.name)+'</b><br><span class="small muted">'+esc(u.email)+'</span></td><td>'+esc(c.name)+'<br><span class="small muted">'+esc(team(u).name||"")+'</span></td>'+
   '<td><select data-chg="setRole" data-id="'+u.id+'" aria-label="Platform role for '+esc(u.name)+'">'+opts(PLATFORM_ROLES.map(r=>({v:r,l:r})),u.role)+'</select></td>'+
   '<td class="nowrap">'+(u.status==="Invited"?badge(u.status)+' <button class="btn sm sec" data-act="acceptInvite" data-id="'+u.id+'"'+dA(has("invite:"+u.id))+'>Simulate acceptance'+dSR(has("invite:"+u.id))+'</button>':
     '<label class="switch"'+(u.id===S.me?' title="You can\'t deactivate yourself"':'')+'><input type="checkbox" role="switch" data-chg="toggleActive" data-id="'+u.id+'"'+(u.status==="Active"?" checked":"")+(u.id===S.me?" disabled":"")+' aria-label="'+esc(u.name)+' active"><span class="switch-track"></span><span class="switch-lbl">'+(u.status==="Active"?"Active":"Inactive")+'</span></label>')+'</td></tr>';}).join("");
  return '<div class="head"><div><h1>Users</h1></div><div class="acts"><button class="btn" data-act="invite">Invite user</button></div></div>'+
  '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 18px;flex-wrap:wrap">'+
    '<div class="proj-search-wrap" style="flex:1">'+
      '<svg class="search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'+
      '<input type="text" id="userSearchInp" class="proj-search-inp" placeholder="Search by name, email, company, team, role..." value="'+esc(USER_SEARCH)+'" data-inp="userSearch" autocomplete="off" aria-label="Search users">'+
      '<button type="button" id="userSearchClear" class="proj-search-clear" data-act="clearUserSearch" title="Clear search" style="'+(USER_SEARCH?'display:block':'display:none')+'">&times;</button>'+
    '</div>'+
    '<span id="userSearchMeta" class="small muted"></span>'+
  '</div>'+
  '<div class="panel muted" id="userSearchEmpty" hidden style="padding:24px 20px;text-align:center">No users match your search.</div>'+
  '<div class="scroll"><table class="t" id="usersTable"><thead><tr><th>Name</th><th>Company and team</th><th>Platform role</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>';});
/* ---------- Projects: project management, not tied to a contract stage ---------- */
let PROJ_SEARCH="";
const projSearchText=p=>[p.code,p.name,p.client,uname(p.leadId)].join(" ").toLowerCase();
function applyProjSearch(){const q=PROJ_SEARCH;let n=0;const rows=document.querySelectorAll("#projectsTable tbody tr[data-q]");
  rows.forEach(tr=>{const hit=!q||tr.dataset.q.includes(q);tr.hidden=!hit;if(hit)n++;});
  const meta=document.getElementById("projSearchMeta");if(meta)meta.innerHTML=q?'Showing <b>'+n+'</b> of '+rows.length:rows.length+' '+(rows.length===1?'project':'projects');
  const empty=document.getElementById("projSearchEmpty");if(empty)empty.hidden=!(q&&!n);
  if(typeof paginateAll==="function")paginateAll();}
ACT.projSearch=el=>{PROJ_SEARCH=el.value.trim().toLowerCase();const clr=document.getElementById("projSearchClear");if(clr)clr.style.display=PROJ_SEARCH?"block":"none";applyProjSearch();};
ACT.clearProjSearch=()=>{PROJ_SEARCH="";const inp=document.getElementById("projSearchInp");if(inp){inp.value="";inp.focus();}const clr=document.getElementById("projSearchClear");if(clr)clr.style.display="none";applyProjSearch();};
route("projects",()=>{const u=me();
  if(!(isAdmin(u)||canCreateProject(u)||isProjectLeadUser(u)))return denied("Only project leads and system admins manage projects.");
  afterRender.push(applyProjSearch);
  const list=(isAdmin(u)||isProjectLeadUser(u)?S.projects:S.projects.filter(p=>userRelatesToProject(u,p))).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const open='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  const rows=list.map(p=>'<tr data-q="'+esc(projSearchText(p))+'">'+
    '<td><a href="#/search/'+p.id+'" style="font-weight:600;color:inherit;text-decoration:none"><span class="proj-badge" style="font-size:10.5px;padding:1.5px 5.5px;margin-right:6px">'+esc(p.code)+'</span>'+esc(p.name)+'</a></td>'+
    '<td>'+(p.leadId?uname(p.leadId):'<span class="muted">Unassigned</span>')+'</td>'+
    '<td class="c">'+tendersOf(p).length+'</td>'+
    '<td class="nowrap small">'+(p.updatedAt?fmtDT(p.updatedAt)+(p.updatedBy?'<br><span class="small muted">by '+uname(p.updatedBy)+'</span>':''):'<span class="muted">–</span>')+'</td>'+
    '<td class="c"><a class="circle-btn" href="#/search/'+p.id+'" title="Open '+esc(p.code+" "+p.name)+'" aria-label="Open '+esc(p.code+" "+p.name)+'">'+open+'</a></td>'+
  '</tr>').join("");
  return '<div class="head"><div><h1>Projects</h1></div>'+(canCreateProject(u)?'<div class="acts"><button class="btn" data-act="newProject"'+dA(has("firstProject"))+'>Create project'+dSR(has("firstProject"))+'</button></div>':'')+'</div>'+
  '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 18px;flex-wrap:wrap">'+
    '<div class="proj-search-wrap" style="flex:1">'+
      '<svg class="search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'+
      '<input type="text" id="projSearchInp" class="proj-search-inp" placeholder="Search by code, name, client, lead..." value="'+esc(PROJ_SEARCH)+'" data-inp="projSearch" autocomplete="off" aria-label="Search projects">'+
      '<button type="button" id="projSearchClear" class="proj-search-clear" data-act="clearProjSearch" title="Clear search" style="'+(PROJ_SEARCH?'display:block':'display:none')+'">&times;</button>'+
    '</div>'+
    '<span id="projSearchMeta" class="small muted"></span>'+
  '</div>'+
  '<div class="panel muted" id="projSearchEmpty" hidden style="padding:24px 20px;text-align:center">No projects match your search.</div>'+
  (list.length?'<div class="scroll"><table class="t" id="projectsTable"><thead><tr><th>Project</th><th>Project lead</th><th class="c">Tenders</th><th>Last updated</th><th class="no-sort" style="width:40px"><span class="sr-only">Open</span></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
   :'<div class="empty">No projects yet.'+(canCreateProject(u)?' Use <b>Create project</b> to add one.':'')+'</div>');});
ACT.invite=()=>openModal({title:"Invite user",body:fld("Full name",'<input type="text" name="name" id="f1" required>',"f1")+fld("Work email",'<input type="email" name="email" id="f2" required>',"f2")+
  fld("Company",'<input type="text" name="company" id="f3" list="dlCompanies" placeholder="e.g. Harbourline Engineering" required><datalist id="dlCompanies">'+S.companies.map(c=>'<option value="'+esc(c.name)+'">').join("")+'</datalist>',"f3")+
  fld("Team",'<input type="text" name="team" id="f4" list="dlTeams" placeholder="e.g. Design" required><datalist id="dlTeams">'+[...new Set(S.teams.map(t=>t.name))].map(n=>'<option value="'+esc(n)+'">').join("")+'</datalist>',"f4")+
  fld("Platform role",'<select name="role" id="f5">'+opts(PLATFORM_ROLES.map(r=>({v:r,l:r})),"SME")+'</select>',"f5")+'',
  submit:"Send invitation",onSubmit:fd=>{const name=fd.get("name").trim(),email=fd.get("email").trim().toLowerCase();
   if(!name)return "Enter the person's name.";if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return "Enter a valid email address.";
   if(S.users.some(u=>u.email===email))return "Someone with this email is already registered.";
   const coName=(fd.get("company")||"").trim(),tmName=(fd.get("team")||"").trim();if(!coName)return "Enter the company.";if(!tmName)return "Enter the team.";
   const tm=findOrAddTeam(coName,tmName);S.users.push({id:uid("u"),name,email,companyId:tm.companyId,teamId:tm.id,title:tm.name,superiorId:null,sys:"user",creator:false,status:"Invited",role:fd.get("role")});rerender();toast("Invitation sent to "+email);}});
/* Company and team are typed in on invite; reuse a match (any case) or create one */
function findOrAddTeam(coName,tmName){const lc=x=>x.toLowerCase();
  let c=S.companies.find(x=>lc(x.name)===lc(coName));
  if(!c){const base=(coName.match(/\b[A-Za-z0-9]/g)||[]).join("").toUpperCase().slice(0,3)||coName.slice(0,3).toUpperCase();let code=base,i=2;while(S.companies.some(x=>x.code===code))code=base+(i++);
    c={id:uid("c"),name:coName,code};S.companies.push(c);}
  let t=S.teams.find(x=>x.companyId===c.id&&lc(x.name)===lc(tmName));
  if(!t){t={id:uid("t"),companyId:c.id,name:tmName,cr:false};S.teams.push(t);}
  return t;}
ACT.setRole=el=>{const u=U(el.dataset.id);u.role=el.value;rerender();toast(u.name+" is now "+el.value);};
ACT.acceptInvite=el=>{U(el.dataset.id).status="Active";rerender();toast(U(el.dataset.id).name+" is now active");};
ACT.deactivate=el=>{const u=U(el.dataset.id);openModal({title:"Deactivate "+u.name+"?",body:'<p>Their sessions end straight away and they can no longer sign in. Their name stays on past records.</p>',submit:"Deactivate",danger:true,onSubmit:()=>{
  u.status="Inactive";

  rerender();toast(u.name+" deactivated");}});};
ACT.toggleActive=el=>{const u=U(el.dataset.id);if(el.checked){u.status="Active";rerender();toast(u.name+" reactivated");}else{el.checked=true;ACT.deactivate(el);}};

route("catalogue",()=>{if(!isAdmin(me()))return denied("Only system admins maintain the catalogue.");
  return '<div class="head"><div><h1>Document catalogue</h1></div><div class="acts"><button class="btn" data-act="addCat">Add document type</button></div></div>'+
  '<div class="scroll"><table class="t"><thead><tr><th>Document</th><th>Spec type</th><th>Audience</th><th>Usual owner</th><th>Default</th></tr></thead><tbody>'+
  S.catalogue.map(k=>{return '<tr><td><b>'+esc(k.name)+'</b></td><td>'+esc(k.spec)+'</td><td>'+(k.audience==="Internal"?"Internal":"Tenderer")+'</td><td>'+esc(k.discipline)+'</td><td>'+(k.required?"Required":"Optional")+'</td></tr>';}).join("")+'</tbody></table></div>';});
ACT.addCat=()=>openModal({title:"Add document type",body:fld("Document name",'<input type="text" name="n" id="k1">',"k1")+
  fld("Spec type",'<select name="s" id="k2"><option>Particular</option><option>General</option></select>',"k2")+fld("Audience",'<select name="a" id="k3"><option value="Tenderers">Tenderer</option><option value="Internal">Internal</option></select>',"k3")+
  fld("Usual owner discipline",'<input type="text" name="d" id="k4" value="Design">',"k4")+'<label class="check"><input type="checkbox" name="r" checked> Required by default</label>',onSubmit:fd=>{
  const n=fd.get("n").trim();if(!n)return "Enter a document name.";if(S.catalogue.some(k=>k.name.toLowerCase()===n.toLowerCase()))return "That document type already exists.";
  const k={id:uid("k"),name:n,spec:fd.get("s"),audience:fd.get("a"),discipline:fd.get("d").trim()||"Unassigned",required:!!fd.get("r")};S.catalogue.push(k);
  rerender();toast(n+" added to the catalogue");}});
