/* Project and tender create/edit/delete, record keeping and document delete */
/* ---------- Projects ---------- */
const projForm=p=>
  '<div class="row">'+
    '<div class="field" style="flex:1;min-width:120px"><label for="p2">Project code</label><input type="text" name="c" id="p2" maxlength="8" placeholder="e.g. NRE" value="'+esc(p?p.code:"")+'"></div>'+
    '<div class="field" style="flex:2.5;min-width:200px"><label for="p1">Project name</label><input type="text" name="n" id="p1" placeholder="e.g. Northshore Rail Extension" value="'+esc(p?p.name:"")+'"></div>'+
  '</div>'+
  fld("Description",'<textarea name="d" id="p6">'+esc(p&&p.desc||"")+'</textarea>',"p6")+
  fld("Target completion",'<input type="date" name="e" id="p5" value="'+(p&&p.end?toISO(p.end):"")+'">',"p5")+
  fld("Funding paper reference",'<input type="text" name="f" id="p7" placeholder="For example FP-2026-014" value="'+esc(p&&p.funding||"")+'">',"p7");
function readProj(fd,self){const n=fd.get("n").trim(),c=fd.get("c").trim().toUpperCase(),e=fromISO(fd.get("e"));
  if(!n||!c)return {err:"Enter a project name and code."};if(S.projects.some(p=>p.code===c&&p!==self))return {err:"That project code is already used."};
  return {v:{name:n,code:c,client:(self&&self.client)||(fd.get("cl")?fd.get("cl").trim():""),desc:fd.get("d").trim(),start:(self&&self.start)||Date.now(),end:e,funding:fd.get("f").trim()}};}

ACT.newProject=()=>openModal({title:"New project",body:projForm(null),submit:"Create project",onSubmit:fd=>{const r=readProj(fd,null);if(r.err)return r.err;
  const p=Object.assign({id:uid("p"),leadId:S.me,status:"Active",createdAt:Date.now(),updatedAt:Date.now(),updatedBy:S.me,dur:DEFAULT_DUR.slice()},r.v);
  S.projects.push(p);
  logProj(p, "created project "+p.code+" "+p.name);
  save();
  toast(p.name+" created");
  GS_STATE.pId = p.id;
  GS_STATE.tId = "";
  GS_STATE.docId = "";
  GS_STATE.query = "";
  closeAllDd();
  go("#/search/"+p.id);
}});
ACT.editProject=el=>{const p=PR(el.dataset.id);openModal({title:"Edit "+p.code+" "+p.name,body:projForm(p),submit:"Save changes",onSubmit:fd=>{const r=readProj(fd,p);if(r.err)return r.err;
  Object.assign(p,r.v);touchProj(p);logProj(p,"edited project details");save();rerender();toast("Project details saved");}});};
ACT.delProject=el=>{
  const p=PR(el.dataset.id);
  if(!p) return;
  const ts=tendersOf(p);
  const tIds=new Set(ts.map(t=>t.id));
  const docs=S.docs.filter(d=>tIds.has(d.tenderId));
  const docIds=new Set(docs.map(d=>d.id));

  let summaryHtml = '';
  if(ts.length || docs.length){
    const items = [];
    if(ts.length) items.push('<b>'+ts.length+'</b> '+(ts.length===1?'tender':'tenders'));
    if(docs.length) items.push('<b>'+docs.length+'</b> '+(docs.length===1?'document':'documents'));
    summaryHtml = '<div style="background:var(--sunk);border:1px solid var(--rule);border-radius:8px;padding:12px;margin:12px 0">'+
      '<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:var(--ink)">This will also permanently delete:</p>'+
      '<ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-2);line-height:1.6">'+
        items.map(it=>'<li>'+it+'</li>').join('')+
      '</ul>'+
    '</div>';
  } else {
    summaryHtml = '<p style="margin:12px 0;color:var(--ink-2)">This will permanently remove the project.</p>';
  }

  openModal({
    title: "Delete "+p.code+" "+p.name+"?",
    danger: true,
    submit: "Delete project",
    body: '<p style="margin-top:0">Are you sure you want to delete <strong>'+esc(p.code+" "+p.name)+'</strong>?</p>'+
      summaryHtml,
    onSubmit: ()=>{
      const notifyUids = [...new Set(ts.map(t=>t.icId).filter(Boolean))];
      if(notifyUids.length){
        notify(notifyUids, p.code+" "+p.name+" was deleted by "+me().name, "#/home");
      }
      ts.forEach(t=>{
        delete SUGG_DOCS[t.id];
        delete SUGG[t.id];
        if(RABORT[t.id]){ try{ RABORT[t.id].abort(); }catch(e){} delete RABORT[t.id]; }
        if(ABORT[t.id]){ try{ ABORT[t.id].abort(); }catch(e){} delete ABORT[t.id]; }
      });
      S.docs = S.docs.filter(d=>!tIds.has(d.tenderId));
      S.packages = S.packages.filter(pk=>!tIds.has(pk.tenderId));
      S.metrics = S.metrics.filter(m=>!tIds.has(m.tenderId));
      S.activity = S.activity.filter(a=>a.projectId!==p.id && (!a.tenderId || !tIds.has(a.tenderId)));
      S.notes = S.notes.filter(x=>{
        if(!x.link) return true;
        if(x.link.includes("/search/"+p.id) || x.link.includes("/project/"+p.id)) return false;
        if([...tIds].some(tid=>x.link.includes("/tender/"+tid) || x.link.includes("/"+tid))) return false;
        if([...docIds].some(did=>x.link.includes("/doc/"+did) || x.link.includes("/"+did))) return false;
        return true;
      });
      S.tenders = S.tenders.filter(t=>!tIds.has(t.id));
      S.projects = S.projects.filter(x=>x!==p);
      save();
      toast(p.name+" deleted");
      const nextH = (location.hash||"").startsWith("#/projects") ? "#/projects" : "#/search";
      GS_STATE.pId = ""; GS_STATE.tId = ""; GS_STATE.docId = "";
      go(nextH);
    }
  });
};

route("project",id=>{
  const p=PR(id);
  if(!p) return denied("This project doesn't exist.");
  GS_STATE.pId = p.id;
  GS_STATE.tId = "";
  GS_STATE.docId = "";
  GS_STATE.query = "";
  closeAllDd();
  go("#/search/"+p.id);
  return "";
});
function segs(t,sm){const n=STAGES.length,all=currentStage(t)>=n,c=stageIdx(t),cls=i=>(i<c||all)?"done":i===c?"cur":"";
  if(!sm)return '<ol class="stages" aria-label="Stage '+(c+1)+' of '+n+'">'+STAGES.map((s,i)=>'<li class="'+cls(i)+'"'+(i===c&&!all?' aria-current="step"':'')+'><i></i><span>'+esc(s)+'</span></li>').join("")+'</ol>';
  return '<div class="segs sm" role="img" aria-label="Stage '+(c+1)+' of '+n+': '+esc(STAGES[c])+'">'+STAGES.map((s,i)=>'<i title="'+esc(s)+'" class="'+cls(i)+'"></i>').join("")+'</div>';}
/* ---------- Tenders ---------- */
const icCandidates=()=>S.users.filter(x=>x.status==="Active"&&x.companyId==="c1"&&x.teamId==="t-pm");
const tenderForm=(t, preProjId)=>{
  const u=me(), myProjs=S.projects.filter(p=>isPL(u,p));
  const targetP = preProjId || (t ? t.projectId : (myProjs[0] && myProjs[0].id));
  const projField = (!t && myProjs.length > 1 && !preProjId) ?
    fld("Project", '<select name="projectId" id="n_p">'+myProjs.map(p=>'<option value="'+p.id+'"'+(p.id===targetP?' selected':'')+'>'+esc(p.code+" "+p.name)+'</option>').join("")+'</select>', "n_p") :
    '<input type="hidden" name="projectId" value="'+esc(targetP||"")+'">';
  return projField +
    '<div class="row"><div class="field" style="flex:1"><label for="n1">Contract number</label><input type="text" name="c" id="n1" placeholder="NRE-C04" value="'+esc(t?t.code:"")+'"></div><div class="field" style="flex:2"><label for="n2">Title</label><input type="text" name="t" id="n2" value="'+esc(t?t.title:"")+'"></div></div>'+
    (t?'':'<div class="field"><label for="n_ic">Contract project IC <span class="req">*</span></label><select name="ic" id="n_ic" required>'+userOpts(icCandidates(),null,"Choose an IC",true)+'</select></div>')+
    fld("Description",'<textarea name="s" id="n5">'+esc(t&&t.scope||"")+'</textarea>',"n5");
};
function readTender(fd,self){const c=fd.get("c").trim().toUpperCase(),t=fd.get("t").trim();if(!c||!t)return {err:"Enter a contract number and title."};
  if(S.tenders.some(x=>x.code===c&&x!==self))return {err:"That contract number already exists."};
  return {v:{code:c,title:t,scope:fd.get("s").trim()}};}
function lastUpdTender(t){
  if(t.updatedAt)return {at:t.updatedAt,by:t.updatedBy};
  const a=S.activity.filter(x=>x.tenderId===t.id).sort((x,y)=>y.at-x.at)[0];
  if(a)return {at:a.at,by:a.by};
  return {at:t.createdAt||null,by:t.icId||null};
}
function updTxtTender(t){
  const l=lastUpdTender(t);
  return l.at?fmtDT(l.at)+(l.by?'<br><span class="small muted">by '+uname(l.by)+'</span>':''):'<span class="muted">–</span>';
}

ACT.newTender=el=>openModal({title:"New tender",body:tenderForm(null, el&&el.dataset.id),submit:"Create tender",onSubmit:fd=>{const r=readTender(fd,null);if(r.err)return r.err;
  const targetP = PR((el&&el.dataset.id) || fd.get("projectId") || (S.projects.find(p=>isPL(me(),p))||{}).id);
  if(!targetP)return "Choose a project.";
  if(!fd.get("ic"))return "Choose a contract project IC.";
  const tn=Object.assign({id:uid("tn"),projectId:targetP.id,createdAt:Date.now(),updatedAt:Date.now(),updatedBy:S.me,icId:null,smes:[],tec:[],manual:null},r.v);
  const ic=fd.get("ic");
  S.tenders.push(tn);touchProj(targetP);log(tn,"created the tender");
  if(ic){tn.icId=ic;log(tn,"assigned "+U(ic).name+" as contract project IC");notify([ic],"You are contract project IC for "+tn.code+" "+tn.title,"#/tender/"+tn.id+"/team","assignSme:"+tn.id);}
  save();rerender();toast(tn.code+" created with "+U(ic).name+" as IC");}});
ACT.editTender=el=>{const t=T(el.dataset.id);openModal({title:"Edit "+t.code,body:tenderForm(t),submit:"Save changes",onSubmit:fd=>{const r=readTender(fd,t);if(r.err)return r.err;
  Object.assign(t,r.v);t.updatedAt=Date.now();t.updatedBy=S.me;touchProj(projOf(t));log(t,"edited the tender details");save();rerender();toast("Tender details saved");}});};
ACT.delTender=el=>{const t=T(el.dataset.id),n=docsOf(t).length;
  if(n||pkgOf(t)){openModal({title:"Can't delete "+t.code,submit:null,body:'<p>'+esc(t.code+" "+t.title)+' already has '+n+(n===1?" document":" documents")+'. Tenders with work in progress can\'t be deleted.</p>'});return;}
  openModal({title:"Delete "+t.code+"?",danger:true,submit:"Delete tender",body:'<p>This permanently removes '+esc(t.code+" "+t.title)+' from '+esc(projOf(t).name)+'.</p>',onSubmit:()=>{
   notify([t.icId],t.code+" "+t.title+" was deleted by "+me().name,"#/home");S.metrics=S.metrics.filter(m=>m.tenderId!==t.id);S.activity=S.activity.filter(a=>a.tenderId!==t.id);
   const nextH = (location.hash||"").startsWith("#/search") && projOf(t) ? "#/search/" + t.projectId : "#/board";
   S.notes=S.notes.filter(x=>!x.link.includes("/tender/"+t.id+"/"));S.tenders=S.tenders.filter(x=>x!==t);save();toast(t.code+" deleted");go(nextH);}});};
/* ---------- Record keeping and document actions ---------- */

function touchDoc(d,by){d.updatedAt=Date.now();d.updatedBy=by||S.me;}
function touchProj(p,by){p.updatedAt=Date.now();p.updatedBy=by||S.me;}
const lastUpd=d=>{if(d.updatedAt)return {at:d.updatedAt,by:d.updatedBy};const a=S.activity.filter(x=>x.docId===d.id).sort((x,y)=>y.at-x.at)[0],v=d.versions.slice(-1)[0];
  if(a&&(!v||a.at>=v.at))return {at:a.at,by:a.by};if(v)return {at:v.at,by:v.by};return {at:d.createdAt||null,by:d.ownerId||null};};
const updTxt=d=>{const l=lastUpd(d);return l.at?fmtDT(l.at)+(l.by?'<br><span class="small muted">by '+uname(l.by)+'</span>':""):'<span class="muted">–</span>';};
const DOC_LOCKED=[DS.PA,DS.CR];

ACT.editDoc=el=>{const d=D(el.dataset.id),t=T(d.tenderId);if(DOC_LOCKED.includes(d.status)){openModal({title:"Can't edit "+d.name,submit:null,body:'<p>'+esc(d.name)+' is '+esc(d.status.toLowerCase())+'. Details can only be edited before the document is sent for approval.</p>'});return;}openModal({title:"Edit "+d.name,submit:"Save changes",body:fld("Document name",'<input type="text" name="n" id="ed1" value="'+esc(d.name)+'">',"ed1")+
  '<div class="row"><div class="field" style="flex:1"><label for="ed2">Spec type</label><select name="s" id="ed2">'+opts(["General","Particular"].map(x=>({v:x,l:x})),d.spec)+'</select></div><div class="field" style="flex:1"><label for="ed4">Due date</label><input type="date" name="due" id="ed4" value="'+(d.due?toISO(d.due):"")+'"></div></div>',
  onSubmit:fd=>{const n=fd.get("n").trim();if(!n)return "Enter a document name.";if(t&&docsOf(t).some(x=>x!==d&&x.name.toLowerCase()===n.toLowerCase()))return "This tender already has a document with that name.";
   d.name=n;d.spec=fd.get("s");d.due=fromISO(fd.get("due"));touchDoc(d);log(t,"edited the details of "+d.name,d.id);rerender();toast("Document details saved");}});};
ACT.delDoc=el=>{const d=D(el.dataset.id),t=T(d.tenderId),p=t?pkgOf(t):null,inPkg=p&&p.items.some(i=>i.docId===d.id);
  if(DOC_LOCKED.includes(d.status)||inPkg){openModal({title:"Can't delete "+d.name,submit:null,body:'<p>'+esc(d.name)+' is '+esc(d.status.toLowerCase())+(inPkg?" and part of the tender package":"")+'. Only documents that haven\'t been sent for approval can be deleted.</p>'});return;}
  openModal({title:"Delete "+d.name+"?",danger:true,submit:"Delete document",body:'<p>This permanently removes '+esc(d.name)+' and its comments and versions from '+(t?esc(t.code):'the Document library')+'.</p>',onSubmit:()=>{
   if(t)notify([t.icId],me().name+" deleted "+d.name+" from "+t.code,"#/tender/"+t.id+"/documents");log(t,"deleted "+d.name);S.notes=S.notes.filter(x=>x.link!=="#/doc/"+d.id);S.docs=S.docs.filter(x=>x!==d);
   save();toast(d.name+" deleted");go(el.dataset.back||(t?"#/tender/"+t.id+"/documents":"#/library"));}});};
