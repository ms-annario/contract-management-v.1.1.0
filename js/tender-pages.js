/* Tender pages: overview, team, documents, success metrics, AI document recommendations */
/* ---------- Tender pages ---------- */
const TABS=[["overview","Overview"],["team","Team"],["documents","Documents"],["metrics","Success metrics"]];
const SUGG={};

function tabNeeds(t,k){const p=pkgOf(t),pk=x=>p?x.map(y=>y+":"+p.id):[];
  if(k==="overview")return has("assignIC:"+t.id,"nominateTec:"+t.id);if(k==="team")return has("assignSme:"+t.id);
  if(k==="documents")return has("collate:"+t.id,"chooseDocs:"+t.id,"assignOwner:"+t.id)||docsOf(t).some(docNeeds);if(k==="metrics")return has("metrics:"+t.id);
  if(k==="package")return has(...pk(["tecApprove","sendCR","resendCR","sendTD","crReview"]));return false;}
function tenderHead(t,tab){
  const p=projOf(t);
  return tenderBreadcrumbs(t)+'<div class="head"><div><h1>'+esc(t.code+" "+t.title)+'</h1><div class="row">'+badge(tStatus(t))+'</div></div>'+(isPL(me(),p)?'<div class="acts"><button class="btn ghost" data-act="delTender" data-id="'+t.id+'">Delete</button><button class="btn sec" data-act="editTender" data-id="'+t.id+'">Edit details</button></div>':"")+'</div>'+
  '<nav class="tabs" aria-label="Tender sections">'+TABS.map(([k,l])=>{const n=tabNeeds(t,k);return '<a href="#/tender/'+t.id+'/'+k+'"'+(k===tab?' aria-current="page"':"")+dA(n)+'>'+l+dSR(n)+'</a>';}).join("")+'</nav>';
}
route("tender",(id,tab,subtab)=>{const t=T(id),u=me();tab=tab||"overview";if(tab==="activity")tab="overview";if(!t)return denied("This tender doesn't exist.");
  if(!canSeeTender(u,t)){if(isTEC(u,t)&&pkgOf(t))return ROUTES.tec();return denied("You don't have a role on this tender.");}
  const body={overview:tOverview,team:tTeam,documents:tDocs,metrics:tMetrics,activity:tActivity}[tab]||tOverview;
  return tenderHead(t,tab)+body(t,subtab);});

function tOverview(t){const u=me(),pr=projOf(t),lead=isPL(u,pr),ds=reqDocs(t),ok=ds.filter(isApproved).length,cur=currentStage(t);
  const cands=icCandidates();
  return '<div class="grid2"><div><div class="panel">'+
  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px">'+
    '<h3 style="margin:0">Tender details</h3>'+
    '<button type="button" class="btn sec sm" data-act="viewTenderChanges" data-id="'+t.id+'" style="display:inline-flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>View Changes</button>'+
  '</div>'+
  '<dl class="kv"><dt>Contract number</dt><dd>'+esc(t.code)+'</dd><dt>Project</dt><dd>'+esc(pr.code+" "+pr.name)+', led by '+uname(pr.leadId)+'</dd>'+
  '<dt>Contract project IC</dt><dd>'+(lead&&!t.manual?'<span class="sel-dot"'+dA(has("assignIC:"+t.id))+'><select data-chg="setIC" data-id="'+t.id+'" aria-label="Contract project IC">'+userOpts(cands,t.icId,"Choose an IC",true)+'</select></span>':t.icId?uname(t.icId):'<span class="muted">Not assigned</span>')+'</dd>'+
  '<dt>Created</dt><dd>'+fmtD(t.createdAt)+'</dd></dl>'+(t.scope?'<h3>Description</h3><p class="muted" style="max-width:70ch">'+esc(t.scope)+'</p>':"")+'</div>'+
  '<div class="panel"><h3>Progress</h3>'+segs(t)+'</div></div>'+
  '<div><div class="panel"><h3>Tender evaluation committee</h3>'+(t.tec.length?'<ul style="margin:0;padding-left:18px">'+t.tec.map(m=>'<li>'+uname(m.userId)+(m.chair?" (chair)":"")+'</li>').join("")+'</ul>':'<p class="muted">No members nominated yet.</p>')+
  (lead&&!t.manual?'<button class="btn sec sm" data-act="nominateTec" data-id="'+t.id+'"'+dA(has("nominateTec:"+t.id))+'>'+(t.tec.length?"Change members":"Nominate members")+dSR(has("nominateTec:"+t.id))+'</button>':"")+'</div>'+
  '</div></div>';}
ACT.setIC=el=>{const t=T(el.dataset.id);if(!el.value)return;const prev=t.icId;t.icId=el.value;log(t,"assigned "+U(el.value).name+" as contract project IC");notify([el.value],"You are contract project IC for "+t.code+" "+t.title,"#/tender/"+t.id+"/team","assignSme:"+t.id);if(prev&&prev!==el.value)notify([prev],"You are no longer IC for "+t.code,"#/home");rerender();toast(U(el.value).name+" is now IC. Status: "+tStatus(t));};
ACT.nominateTec=el=>{const t=T(el.dataset.id),pool=S.users.filter(x=>x.status==="Active"&&x.companyId==="c1"),cur=t.tec.map(m=>m.userId),ch=(t.tec.find(m=>m.chair)||{}).userId;
  openModal({title:"Nominate TEC for "+t.code,body:'<div style="max-height:320px;overflow:auto">'+pool.map(x=>'<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--rule);padding:4px 0"><label class="check" style="margin:0"><input type="checkbox" name="m" value="'+x.id+'"'+(cur.includes(x.id)?" checked":"")+'> '+esc(x.name)+' <span class="small muted">'+esc(x.title)+'</span></label><label class="small"><input type="radio" name="chair" value="'+x.id+'"'+(ch===x.id?" checked":"")+'> Chair</label></div>').join("")+'</div>',submit:"Save TEC",onSubmit:fd=>{
   const ms=fd.getAll("m"),c=fd.get("chair");if(!ms.length)return "Choose at least one member.";if(!c||!ms.includes(c))return "Choose a chair from the selected members.";
   t.tec=ms.map(id=>({userId:id,chair:id===c}));log(t,"nominated "+ms.length+" TEC members");notify(ms.filter(id=>!cur.includes(id)),"You were nominated to the TEC for "+t.code+" "+t.title+". You get access when the package is submitted.","#/tec");rerender();toast("TEC saved with "+U(c).name+" as chair");}});};
function tTeam(t){const u=me(),ic=isIC(u,t)&&!t.manual;
  return '<div class="head"><div><h2 class="sec" style="margin-top:0">Subject matter experts</h2></div><div class="acts">'+(ic?'<button class="btn" data-act="addSme" data-id="'+t.id+'"'+dA(has("assignSme:"+t.id))+'>Assign SME'+dSR(has("assignSme:"+t.id))+'</button>':"")+'</div></div>'+
  (t.smes.length?'<div class="scroll"><table class="t"><thead><tr><th>Name</th><th>Team</th><th>Superior</th><th>Documents</th><th></th></tr></thead><tbody>'+t.smes.map(s=>{const x=U(s.userId),n=docsOf(t).filter(d=>d.ownerId===x.id).length;
   return '<tr><td><b>'+esc(x.name)+'</b><br><span class="small muted">'+esc(x.title)+'</span></td><td>'+esc(team(x).name||"")+'</td><td>'+(x.superiorId?uname(x.superiorId):'<span class="badge b">None set</span>')+'</td><td>'+n+'</td><td class="c">'+(ic?'<button class="btn ghost sm" data-act="removeSme" data-id="'+t.id+'" data-u="'+x.id+'">Remove</button>':"")+'</td></tr>';}).join("")+'</tbody></table></div>':'<div class="empty">No SMEs assigned yet.</div>');}
ACT.addSme=el=>{const t=T(el.dataset.id),ic=me(),co=byId(S.companies,ic.companyId),pool=S.users.filter(x=>x.status==="Active"&&x.companyId===ic.companyId&&!t.smes.some(s=>s.userId===x.id)&&x.sys!=="admin");
  const selected=new Set();
  const guessDisc=u=>{const tn=(team(u).name||"").toLowerCase(),tit=(u.title||"").toLowerCase();
    if(tn.includes("contract")||tit.includes("contract"))return "Contracts";
    if(tn.includes("design")||tit.includes("design")||tit.includes("engineer"))return "Design";
    if(tn.includes("procurement")||tit.includes("procurement"))return "Procurement";
    if(tn.includes("quantity")||tit.includes("survey")||tit.includes("qs"))return "Quantity surveying";
    if(tn.includes("hse")||tit.includes("safety")||tit.includes("health"))return "HSE";
    if(tn.includes("control")||tn.includes("project management")||tit.includes("director"))return "Project controls";
    return "Design";};
  openModal({title:"Assign team members to "+t.code,submit:"Assign selected",
    body:fld("Search people",'<input type="text" id="smeQ" placeholder="Type a name" autocomplete="off">',"smeQ")+
      ''+
      '<div class="row" style="justify-content:space-between;align-items:center;margin:8px 0 6px">'+
        '<label class="check" style="margin:0"><input type="checkbox" id="smeAll"> <b>Select all</b></label>'+
        '<span id="smeCount" class="small muted">0 selected</span>'+
      '</div>'+
      '<div id="smeList" style="max-height:220px;overflow:auto;border:1px solid var(--rule);border-radius:6px;padding:4px 10px"></div>'+
      fld("Discipline",'<select name="disc" id="smeD">'+
        '<option value="auto">Auto-detect from role/team</option>'+
        ["Design","Contracts","Procurement","Quantity surveying","HSE","Project controls"].map(x=>'<option value="'+x+'">'+x+'</option>').join("")+
      '</select>',"smeD"),
    onSubmit:fd=>{
      const ids=Array.from(new Set([...selected, ...fd.getAll("who")]));
      if(!ids.length)return "Select at least one person to assign.";
      const chosenDisc=fd.get("disc");
      ids.forEach(id=>{
        const x=U(id),disc=chosenDisc==="auto"?guessDisc(x):chosenDisc;
        t.smes.push({userId:id,disc});
        log(t,"assigned "+x.name+" as "+disc+" SME");
        notify([id],"You were assigned as "+disc+" SME on "+t.code+" "+t.title,"#/tender/"+t.id+"/documents");
      });
      rerender();
      toast(ids.length+(ids.length===1?" team member assigned":" team members assigned"));
    }
  });

  const updateHeader=visibleBoxes=>{
    const cnt=document.getElementById("smeCount");
    if(cnt)cnt.textContent=selected.size+" selected";
    const all=document.getElementById("smeAll");
    if(all&&visibleBoxes&&visibleBoxes.length){
      all.checked=visibleBoxes.every(b=>b.checked);
      all.indeterminate=!all.checked&&visibleBoxes.some(b=>b.checked);
    }
  };

  const draw=q=>{
    const l=pool.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())||(team(x).name||"").toLowerCase().includes(q.toLowerCase())||x.title.toLowerCase().includes(q.toLowerCase()));
    const listEl=document.getElementById("smeList");
    if(!listEl)return;
    listEl.innerHTML=l.length?l.map(x=>'<label class="check" style="display:flex;align-items:center;padding:5px 0;margin:0"><input type="checkbox" name="who" value="'+x.id+'"'+(selected.has(x.id)?" checked":"")+'> <span style="margin-left:8px"><b>'+esc(x.name)+'</b> <span class="small muted">'+esc(team(x).name+", "+x.title)+'</span></span></label>').join(""):'<p class="small muted" style="padding:6px 0">No one in '+esc(co.name)+' matches “'+esc(q)+'”.</p>';
    const boxes=[...listEl.querySelectorAll('input[name="who"]')];
    updateHeader(boxes);
  };

  draw("");
  const qEl=document.getElementById("smeQ");
  if(qEl)qEl.addEventListener("input",e=>draw(e.target.value));

  const listEl=document.getElementById("smeList");
  if(listEl){
    listEl.addEventListener("change",e=>{
      if(e.target&&e.target.name==="who"){
        if(e.target.checked)selected.add(e.target.value);
        else selected.delete(e.target.value);
        const boxes=[...listEl.querySelectorAll('input[name="who"]')];
        updateHeader(boxes);
      }
    });
  }

  const allEl=document.getElementById("smeAll");
  if(allEl){
    allEl.addEventListener("change",()=>{
      const boxes=[...document.querySelectorAll('#smeList input[name="who"]')];
      boxes.forEach(b=>{
        b.checked=allEl.checked;
        if(allEl.checked)selected.add(b.value);
        else selected.delete(b.value);
      });
      updateHeader(boxes);
    });
  }
};
ACT.removeSme=el=>{const t=T(el.dataset.id),x=U(el.dataset.u),owned=docsOf(t).filter(d=>d.ownerId===x.id),others=t.smes.filter(s=>s.userId!==x.id).map(s=>U(s.userId));
  const open=owned.filter(d=>!isApproved(d));
  openModal({title:"Remove "+x.name+" from "+t.code+"?",danger:true,submit:"Remove SME",body:(open.length?'<p>'+esc(x.name)+' owns '+open.length+(open.length===1?" document":" documents")+' that are still in progress. Choose who takes them over.</p>'+
    fld("New owner",'<select name="to" id="rs1">'+userOpts(others,null,"Leave unassigned",true)+'</select>',"rs1")+'<ul class="small muted" style="margin:0;padding-left:18px">'+open.map(d=>'<li>'+esc(d.name)+'</li>').join("")+'</ul>':'<p>'+esc(x.name)+' will lose access to this tender'+(owned.length?". Documents they already finished stay credited to them.":".")+'</p>'),
   onSubmit:fd=>{const to=fd.get("to")||null;open.forEach(d=>{d.ownerId=to;touchDoc(d);if(to)notify([to],"You now own "+d.name+" on "+t.code,"#/doc/"+d.id,"own:"+d.id);log(t,"reassigned "+d.name+" to "+(to?U(to).name:"nobody"),d.id);});
    t.smes=t.smes.filter(s=>s.userId!==x.id);notify([x.id],"You were removed from "+t.code+" "+t.title,"#/home");log(t,"removed "+x.name+" from the team");rerender();toast(x.name+" removed"+(open.length?(to?", documents moved to "+U(to).name:", documents unassigned"):""));}});};
ACT.newDoc=el=>{const t=T(el.dataset.id),have=docsOf(t).map(d=>d.catId),avail=S.catalogue.filter(k=>!have.includes(k.id)),smes=t.smes.map(s=>U(s.userId)),due=toISO(plannedDates(t)[STAGES.indexOf("Drafting")]);
  if(!smes.length){openModal({title:"Add an SME first",submit:null,body:'<p>Every document needs an SME as its owner. Assign SMEs on the Team tab, then add documents.</p><p><a class="btn sec sm" href="#/tender/'+t.id+'/team">Go to Team</a></p>'});M.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>M.close()));return;}
  const guess=k=>{const s=t.smes.find(x=>k.discipline.toLowerCase().includes(x.disc.toLowerCase())||x.disc.toLowerCase().includes(k.discipline.toLowerCase()));return s?s.userId:null;};
  const row=k=>'<tr><td><label class="check" style="margin:0"><input type="checkbox" name="k" value="'+k.id+'"'+(k.required?" checked":"")+'> <span>'+esc(k.name)+'<br><span class="small muted">'+esc(k.spec)+(k.audience==="Internal"?", internal":"")+'</span></span></label></td>'+
    '<td><select name="o_'+k.id+'" aria-label="Owner of '+esc(k.name)+'">'+userOpts(smes,guess(k),"Choose an SME",true)+'</select></td><td><input type="date" name="d_'+k.id+'" value="'+due+'" aria-label="Due date for '+esc(k.name)+'" style="width:auto"></td></tr>';
  openModal({title:"Add documents to "+t.code,wide:true,submit:avail.length?"Add selected documents":null,body:
    (avail.length?'<label class="check"><input type="checkbox" id="ndAll"> <b>Select all</b></label><div class="scroll" style="max-height:46vh;overflow:auto;margin:6px 0 14px"><table class="t"><thead><tr><th>Document</th><th>Owner SME</th><th>Due</th></tr></thead><tbody>'+avail.map(row).join("")+'</tbody></table></div>':'<p class="muted">Every catalogue document is already on this tender.</p>')+
    '',
   onSubmit:fd=>{const picks=fd.getAll("k"),list=[];
    if(!picks.length)return "Tick at least one document.";
    const miss=picks.filter(id=>!fd.get("o_"+id)).map(id=>byId(S.catalogue,id).name);if(miss.length)return "Choose an owner SME for: "+miss.join(", ")+".";
    picks.forEach(id=>{const k=byId(S.catalogue,id);list.push({k,owner:fd.get("o_"+id),due:fromISO(fd.get("d_"+id))});});
    list.forEach(({k,owner,due})=>{const html=k.spec==="General"?sampleHtml(k.name,t):"<h3>1. Scope</h3><p></p><h3>2. Requirements</h3><p></p><h3>3. Interfaces</h3><p></p>";
      const d={id:uid("d"),tenderId:t.id,catId:k.id,name:k.name,spec:k.spec,audience:k.audience,ownerId:owner,due,status:DS.NS,html,versions:[],comments:[],approvals:[],remarks:null,contractsFlag:null,createdAt:Date.now(),updatedAt:Date.now(),updatedBy:S.me};
      S.docs.push(d);notify([owner],"You own "+d.name+" on "+t.code+", "+dueTxt(d.due).toLowerCase(),"#/doc/"+d.id,"own:"+d.id);});
    log(t,"added "+list.length+(list.length===1?" document":" documents")+" and assigned owners");rerender();toast(list.length+(list.length===1?" document added":" documents added"));}});
  const all=document.getElementById("ndAll");if(all){const boxes=[...M.querySelectorAll('input[name=k]')],sync=()=>{all.checked=boxes.every(b=>b.checked);all.indeterminate=!all.checked&&boxes.some(b=>b.checked);};
    all.addEventListener("change",()=>{boxes.forEach(b=>b.checked=all.checked);sync();});boxes.forEach(b=>b.addEventListener("change",sync));sync();}};

/* ---------- AI document recommendations ---------- */
const PAST_TENDERS=[
 {code:"WKR-C11",title:"Elevated walkway",ctype:"Design and build",route:"Open tender",scope:"elevated pedestrian walkway steel structure lifts foundations",docs:["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10","k11","k15","k16"]},
 {code:"ELX-C04",title:"Bridge widening",ctype:"Construct only",route:"Open tender",scope:"bridge widening piling deck traffic management utilities",docs:["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10","k12","k13","k15","k16"]},
 {code:"SKY-C02",title:"Viaduct section 2",ctype:"Design and build",route:"Open tender",scope:"viaduct bored piles precast segments drainage utilities",docs:["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10","k11","k12","k13","k14","k15","k16"]},
 {code:"DPT-C01",title:"Bus depot",ctype:"Construct only",route:"Selective tender",scope:"depot earthworks drainage ground improvement building",docs:["k2","k4","k5","k6","k7","k8","k10","k13","k15","k16"]},
 {code:"STN-F03",title:"Station finishes",ctype:"Supply and install",route:"Open tender",scope:"station finishes signage glazing panels installation",docs:["k1","k2","k3","k4","k5","k7","k8","k10","k14","k15","k16"]},
 {code:"NBR-S01",title:"Noise barrier retrofit",ctype:"Supply and install",route:"Open tender",scope:"transparent noise barriers viaduct parapet panels installation",docs:["k1","k2","k3","k4","k5","k7","k8","k9","k10","k11","k14","k15","k16"]}];
const SUGG_DOCS={},REJECTED={};
const words=x=>new Set(String(x||"").toLowerCase().split(/[^a-z]+/).filter(w=>w.length>3));
function similarTenders(t){const w=words(t.title+" "+t.scope);return PAST_TENDERS.map(p=>{let sc=(p.ctype===t.ctype?3:0)+(p.route===t.route?1:0);words(p.title+" "+p.scope).forEach(x=>{if(w.has(x))sc+=2;});return {p,sc};}).sort((a,b)=>b.sc-a.sc).slice(0,3).filter(x=>x.sc>0).map(x=>x.p);}
function recAvail(t){const have=docsOf(t).map(d=>d.catId),rej=REJECTED[t.id]||[];return S.catalogue.filter(k=>!have.includes(k.id)&&!rej.includes(k.id));}
function localRecs(t){const sim=similarTenders(t),av=recAvail(t);
  const items=av.map(k=>{const used=sim.filter(p=>p.docs.includes(k.id));return {k,used};}).filter(x=>x.k.required||x.used.length*2>=sim.length&&x.used.length>0)
   .map(x=>({catId:x.k.id,reason:x.used.length?"Used in "+x.used.length+" of "+sim.length+" similar past tenders ("+x.used.map(p=>p.code).join(", ")+")"+(x.k.required?". Required by default.":"."):"Required by default for every tender."}));
  return {source:"Rule-based",summary:(t.ctype||"Tender")+(t.route?", "+t.route.toLowerCase():"")+". Compared with "+sim.length+" similar past "+(sim.length===1?"tender":"tenders")+".",similar:sim.map(p=>p.code),items};}
/* Sparkle mark for AI-assisted features */
const AI_SPARK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path></svg>';
const AI_MARK='<span class="ai-mark" title="AI assisted">'+AI_SPARK+'</span>';
function recPanel(t){const sg=SUGG_DOCS[t.id];
  if(!sg)return '<div class="panel" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><div><h3 class="ai-head" style="margin:0">'+AI_MARK+'Recommended documents</h3><p class="small muted" style="margin:4px 0 0">AI reads this tender\'s type and scope, compares it with similar past tenders and suggests the documents it needs.</p></div><button class="btn sec" data-act="recDocs" data-id="'+t.id+'"'+dA(has("chooseDocs:"+t.id))+'><span class="ai-btn-ico">'+AI_SPARK+'</span>Recommend documents</button></div></div>';
  if(sg.loading)return '<div class="panel" style="margin-bottom:16px"><h3 class="ai-head" style="margin:0 0 6px">'+AI_MARK+'Recommended documents</h3><p>Understanding '+esc(t.code)+' and reviewing similar past tenders...</p><button class="btn ghost sm" data-act="stopRec" data-id="'+t.id+'">Stop</button></div>';
  if(sg.error)return '<div class="panel" style="margin-bottom:16px"><h3 class="ai-head" style="margin:0 0 6px">'+AI_MARK+'Recommended documents</h3><p class="small muted" style="margin:0 0 10px">'+esc(sg.error)+'</p><button class="btn sec sm" data-act="recDocs" data-id="'+t.id+'">Try again</button></div>';
  const items=sg.items.map(x=>({x,k:byId(S.catalogue,x.catId)})).filter(o=>o.k&&recAvail(t).includes(o.k));
  return '<div class="panel" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h3 class="ai-head" style="margin:0">'+AI_MARK+'Recommended documents <span class="tag">'+esc(sg.source)+'</span></h3><div class="row">'+(items.length>1?'<button class="btn sec sm" data-act="recAll" data-id="'+t.id+'">Accept all '+items.length+'</button>':"")+'<button class="btn ghost sm" data-act="recClose" data-id="'+t.id+'">Close</button></div></div>'+
   '<p class="small" style="margin:8px 0 4px"><b>This tender:</b> '+esc(sg.summary)+'</p>'+(sg.similar&&sg.similar.length?'<p class="small muted" style="margin:0 0 6px">Similar past tenders: '+sg.similar.map(c=>{const p=PAST_TENDERS.find(x=>x.code===c);return esc(c+(p?" "+p.title:""));}).join(", ")+'</p>':"")+
   (items.length?items.map(({x,k})=>'<div class="metric"><span><b>'+esc(k.name)+'</b> <span class="tag">'+esc(k.spec)+'</span>'+(k.audience==="Internal"?' <span class="tag">Internal</span>':"")+'<span class="why" style="display:block">'+esc(x.reason)+'</span></span><span class="row"><button class="btn sm" data-act="recAccept" data-id="'+t.id+'" data-k="'+k.id+'">Accept</button><button class="btn ghost sm" data-act="recReject" data-id="'+t.id+'" data-k="'+k.id+'">Reject</button></span></div>').join(""):'<p class="muted small" style="margin:10px 0 0">All suggestions handled. Accepted documents are in the list below, ready for SME assignment.</p>')+'</div>';}
function acceptRec(t,kid){const k=byId(S.catalogue,kid),html=k.spec==="General"?sampleHtml(k.name,t):"<h3>1. Scope</h3><p></p><h3>2. Requirements</h3><p></p><h3>3. Interfaces</h3><p></p>";
  S.docs.push({id:uid("d"),tenderId:t.id,catId:k.id,name:k.name,spec:k.spec,audience:k.audience,ownerId:null,due:plannedDates(t)[STAGES.indexOf("Drafting")],status:DS.NS,html,versions:[],comments:[],approvals:[],remarks:null,contractsFlag:null,createdAt:Date.now(),updatedAt:Date.now(),updatedBy:S.me});}
ACT.recAccept=el=>{const t=T(el.dataset.id),k=byId(S.catalogue,el.dataset.k);acceptRec(t,k.id);log(t,"accepted the AI recommendation for "+k.name);rerender();toast(k.name+" added. Assign an SME below");};
ACT.recReject=el=>{const t=T(el.dataset.id);(REJECTED[t.id]=REJECTED[t.id]||[]).push(el.dataset.k);rerender();};
ACT.recAll=el=>{const t=T(el.dataset.id),items=SUGG_DOCS[t.id].items.filter(x=>recAvail(t).some(k=>k.id===x.catId));items.forEach(x=>acceptRec(t,x.catId));log(t,"accepted "+items.length+" AI document recommendations");rerender();toast(items.length+" documents added. Assign SMEs below");};
ACT.recClose=el=>{delete SUGG_DOCS[el.dataset.id];rerender();};
const RABORT={};
ACT.stopRec=el=>{const c=RABORT[el.dataset.id];if(c)c.abort();};
ACT.recDocs=async el=>{const t=T(el.dataset.id),av=recAvail(t),sim=similarTenders(t);
  if(!av.length){toast("Every catalogue document is already on this tender");return;}
  SUGG_DOCS[t.id]={loading:true};rerender();
  const sample=await cap("sample");if(!sample){SUGG_DOCS[t.id]=localRecs(t);rerender();toast("AI isn't available in this view, so these come from matching past tenders");return;}
  const ctl=new AbortController();RABORT[t.id]=ctl;
  const prompt="You help a contract project IC decide which documents a construction tender needs.\n\nCurrent tender: "+t.code+" "+t.title+"\nContract type: "+(t.ctype||"unknown")+"\nProcurement route: "+(t.route||"not set")+"\nScope: "+(t.scope||"not given")+
   "\nDocuments already on the tender: "+(docsOf(t).map(d=>d.name).join("; ")||"none")+
   "\n\nSimilar past tenders and the documents they used:\n"+sim.map(p=>"- "+p.code+" "+p.title+" ("+p.ctype+", "+p.route+"): "+p.docs.map(id=>(byId(S.catalogue,id)||{}).name).filter(Boolean).join("; ")).join("\n")+
   "\n\nDocument catalogue you may choose from (id: name, spec type, audience, required by default):\n"+av.map(k=>k.id+": "+k.name+", "+k.spec+", "+k.audience+(k.required?", required":"")).join("\n")+
   "\n\nUnderstand the nature of the current tender, use the past tenders as evidence, and recommend the catalogue documents it needs. Respond with only JSON: {\"summary\":\"one sentence describing the nature of this tender\",\"documents\":[{\"id\":\"catalogue id\",\"reason\":\"one sentence under 25 words citing the past tenders or scope\"}]}";
  try{const r=await sample.json(prompt,{signal:ctl.signal,modelTier:"quick"});const ids=new Set(av.map(k=>k.id));
    const items=(r&&Array.isArray(r.documents)?r.documents:[]).filter(x=>x&&ids.has(x.id)).map(x=>({catId:x.id,reason:String(x.reason||"")}));
    if(!items.length)throw {code:"invalid_json"};SUGG_DOCS[t.id]={source:"AI suggested",summary:String(r.summary||""),similar:sim.map(p=>p.code),items};rerender();}
  catch(e){if(e&&e.code==="cancelled"){delete SUGG_DOCS[t.id];rerender();return;}
    if(e&&e.code==="not_granted"){SUGG_DOCS[t.id]=localRecs(t);rerender();toast("AI wasn't allowed, so these come from matching past tenders");return;}
    SUGG_DOCS[t.id]={error:e&&e.code==="rate_limited"?"Too many requests right now. Wait a minute and try again.":"Couldn't get recommendations this time. Try again, or add documents yourself."};rerender();}
  finally{delete RABORT[t.id];}};
const TDOC_TABS=[
  ["all","All",null],
  ["approved","Approved",[DS.AP,DS.FI]],
  ["pending","Pending approval",[DS.PA]],
  ["published","Published",[DS.IR]],
  ["drafting","Drafting",[DS.DR]],
  ["returned","Returned",[DS.RT]],
  ["changes","Changes requested",[DS.CR]],
  ["notstarted","Not started",[DS.NS]]
];
const tdocMatch=(k,d)=>{const tb=TDOC_TABS.find(x=>x[0]===k);if(!tb||k==="all"||!tb[2])return true;return tb[2].includes(d.status);};
function tDocs(t,subtab){const u=me(),ic=isIC(u,t)&&!t.manual,allDocs=docsOf(t).sort((a,b)=>S.catalogue.findIndex(k=>k.id===a.catId)-S.catalogue.findIndex(k=>k.id===b.catId)),req=reqDocs(t),ok=req.filter(isApproved).length,p=pkgOf(t);
  const smes=t.smes.map(s=>U(s.userId));
  const curTab=TDOC_TABS.some(x=>x[0]===subtab)?subtab:"all";
  const curTabItem=TDOC_TABS.find(x=>x[0]===curTab)||TDOC_TABS[0];
  const ds=allDocs.filter(d=>tdocMatch(curTab,d));
  const tabsNav=allDocs.length?'<nav class="tabs subtabs" aria-label="Filter documents by status">'+
    TDOC_TABS.map(([k,l])=>{
      const count=allDocs.filter(d=>tdocMatch(k,d)).length;
      if(!count&&k!=="all"&&k!==curTab)return "";
      const inGs = (location.hash || "").startsWith("#/search");
      const href = k==="all"?'#/tender/'+t.id+'/documents':'#/tender/'+t.id+'/documents/'+k;
      const gsAct = inGs ? ' data-act="gsTenderDocSubtab" data-subtab="'+k+'"' : '';
      return '<a href="'+href+'"'+gsAct+(k===curTab?' aria-current="page"':'')+'>'+esc(l)+' <span class="muted small">'+count+'</span></a>';
    }).join("")+'</nav>':'';
  return '<div class="head"><div><h2 class="sec" style="margin-top:0">Tender readiness</h2></div><div class="acts">'+(ic?(!p?'<button class="btn ghost" data-act="collate" data-id="'+t.id+'"'+dA(has("collate:"+t.id))+'>Collate package'+dSR(has("collate:"+t.id))+'</button>':"")+'<button class="btn" data-act="newDoc" data-id="'+t.id+'"'+dA(has("chooseDocs:"+t.id))+'>Add documents'+dSR(has("chooseDocs:"+t.id))+'</button>':"")+'<button class="btn sec" data-act="uploadDoc" data-tender="'+t.id+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Upload document</button></div></div>'+(ic?recPanel(t):"")+tabsNav+
  (allDocs.length?(ds.length?'<div class="scroll"><table class="t"><thead><tr><th>Document</th><th>Type</th><th>Owner</th><th>Due</th><th>Status</th><th>Last updated</th></tr></thead><tbody>'+ds.map(d=>{const lock=[DS.AP,DS.FI,DS.NR,DS.PA].includes(d.status);
   return '<tr><td>'+(canSeeDoc(me(),d)?'<a href="#/doc/'+d.id+'">'+esc(d.name)+'</a>':esc(d.name)+' <span class="small muted">Not published yet</span>')+adot(docNeeds(d))+'</td><td><span class="tag">'+esc(d.spec)+'</span> '+(d.audience==="Internal"?'<span class="tag">Internal</span>':"")+'</td>'+
   '<td class="nowrap">'+(ic&&!lock?'<span class="sel-dot"'+dA(!d.ownerId&&has("assignOwner:"+t.id))+'><select data-chg="setOwner" data-id="'+d.id+'" aria-label="Owner of '+esc(d.name)+'">'+userOpts(smes,d.ownerId,"Unassigned",true)+'</select></span>':d.ownerId?uname(d.ownerId):'<span class="muted">Unassigned</span>')+'</td>'+
   '<td class="nowrap">'+(ic&&!lock?'<input type="date" style="width:auto" data-chg="setDue" data-id="'+d.id+'" value="'+(d.due?toISO(d.due):"")+'" aria-label="Due date">':'')+' '+ragDot(docRag(d))+(lock?fmtD(d.due):"")+'</td><td>'+badge(d.status)+'</td><td class="nowrap small">'+updTxt(d)+'</td>'+
   '</tr>';}).join("")+'</tbody></table></div>':'<div class="empty">No documents with status “'+esc(curTabItem[1])+'”.</div>'):'<div class="empty">No documents chosen yet.'+(ic?' Use <b>Add documents</b> to pick them and assign owners.':"")+'</div>');}
ACT.setOwner=el=>{const d=D(el.dataset.id),t=T(d.tenderId),prev=d.ownerId;d.ownerId=el.value||null;touchDoc(d);if(d.ownerId){notify([d.ownerId],"You now own "+d.name+" on "+t.code,"#/doc/"+d.id,"own:"+d.id);log(t,"assigned "+d.name+" to "+U(d.ownerId).name,d.id);}if(prev&&prev!==d.ownerId)notify([prev],d.name+" on "+t.code+" was reassigned","#/home");save();rerender();toast("Owner updated");};
ACT.setDue=el=>{const d=D(el.dataset.id);d.due=fromISO(el.value);touchDoc(d);save();rerender();toast("Due date updated");};
ACT.collate=el=>{const t=T(el.dataset.id),ds=reqDocs(t),miss=ds.filter(d=>d.status!==DS.AP);
  if(!ds.length){toast("Add documents before collating");return;}
  if(miss.length){openModal({title:"Package can't be collated yet",submit:null,body:'<p>'+miss.length+' required '+(miss.length===1?"document isn't":"documents aren't")+' approved:</p><div class="scroll"><table class="t"><tbody>'+miss.map(d=>'<tr><td><a href="#/doc/'+d.id+'">'+esc(d.name)+'</a></td><td>'+(d.ownerId?uname(d.ownerId):"Unassigned")+'</td><td>'+badge(d.status)+'</td></tr>').join("")+'</tbody></table></div>'});M.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>M.close()));return;}
  const prev=pkgOf(t),order=ds.sort((a,b)=>S.catalogue.findIndex(k=>k.id===a.catId)-S.catalogue.findIndex(k=>k.id===b.catId));
  const p={id:uid("pk"),tenderId:t.id,version:prev?prev.version+1:1,items:order.map(d=>({docId:d.id,versionNo:d.versions.length})),status:PS.COL,createdAt:Date.now(),reviews:[],checklist:{},tecViews:{},actions:[],submittedAt:null};
  S.packages.push(p);log(t,"collated package v"+p.version+" with "+p.items.length+" documents");rerender();toast("Package v"+p.version+" collated");go("#/package/"+p.id);};

function pkgPanel(t){const u=me(),p=pkgOf(t),ic=isIC(u,t)&&!t.manual,cr=isCR(u);
  if(!p)return '<div class="empty">No package yet. '+(ic?'Collate once every required document is approved. <br><br><button class="btn" data-act="collate" data-id="'+t.id+'"'+dA(has("collate:"+t.id))+'>Collate package</button>':'The contract project IC collates it once every document is approved.')+'</div>';
  const items=p.items.map((it,i)=>{const d=D(it.docId);return '<div class="pkg-item"><span class="ix">'+(i+1)+'</span><span><a href="#/doc/'+d.id+'">'+esc(d.name)+'</a>'+adot(docNeeds(d))+' <span class="small muted">version '+it.versionNo+', '+(d.ownerId?uname(d.ownerId):"")+'</span>'+(d.audience==="Internal"?' <span class="tag">Internal</span>':"")+(d.contractsFlag?'<br><span class="small" style="color:var(--b-fg)">Contracts: '+esc(d.contractsFlag)+'</span>':"")+'</span><span class="row">'+badge(d.status)+

   (cr&&p.status===PS.ICR?'<label class="check small" style="margin:0"><input type="checkbox" name="flag" data-chg="flag" data-id="'+p.id+'" value="'+d.id+'"'+((p.flags||[]).includes(d.id)?" checked":"")+'> Flag</label>':"")+'</span></div>';}).join("");
  const flagged=p.items.map(i=>D(i.docId)).filter(d=>d.status===DS.CR||d.contractsFlag);
  let acts="";
  if(ic){
    if(p.status===PS.COL){
      acts+='<button class="btn '+(p.tecApproved?'ghost':'')+'" data-act="tecApprove" data-id="'+p.id+'"'+dA(!p.tecApproved)+'>'+(p.tecApproved?'✓ TEC Approved':'TEC Approve')+dSR(!p.tecApproved)+'</button>';
      acts+='<button class="btn" data-act="sendCR" data-id="'+p.id+'"'+dA(has("sendCR:"+p.id))+'>Send for contracts review'+dSR(has("sendCR:"+p.id))+'</button>';
    }
    if(p.status===PS.CHG){
      acts+='<button class="btn" data-act="resendCR" data-id="'+p.id+'"'+dA(true)+'>Resubmit to contracts reviewer'+dSR(true)+'</button>';
      if(flagged.some(d=>d.status===DS.CR))acts+='<button class="btn ghost" data-act="reopenAll" data-id="'+p.id+'">Reopen flagged documents</button>';
    }
    if(p.status===PS.CLR){
      acts+='<button class="btn sec" data-act="resendCR" data-id="'+p.id+'">Resubmit to contracts reviewer</button>';
    }
  }
  const canExport=ic||cr||isPL(u,projOf(t));
  const tdSent=p.status===PS.TD,tdDue=has("sendTD:"+p.id);
  const tdConfirm=(ic&&(TD_READY.includes(p.status)||tdSent))?
    '<div class="td-confirm'+(tdDue?' due':'')+'"'+dA(tdDue)+'><label class="check" style="margin:0"><input type="checkbox" data-chg="sendTD" data-id="'+p.id+'"'+(tdSent?" checked":"")+'> <span>I have sent this package to Tender Division <span class="req">*</span>'+dSR(tdDue)+'</span></label>'+
    (tdSent?'<div class="small muted">Confirmed '+fmtDT(p.sentTdAt)+' by '+uname(p.sentTdBy)+'</div>':'<div class="small muted">Required to complete the tender.</div>')+'</div>':
    (tdSent?'<p class="small muted" style="margin:12px 0 0">Sent to Tender Division '+fmtDT(p.sentTdAt)+' by '+uname(p.sentTdBy)+'</p>':'');
  const exp=canExport?'<div class="panel"><h3>Download</h3><div class="row"><button class="btn sec sm" data-act="exportPkg" data-id="'+p.id+'" data-f="docx">Word</button><button class="btn sec sm" data-act="exportPkg" data-id="'+p.id+'" data-f="pdf">PDF</button><button class="btn sec sm" data-act="exportPkg" data-id="'+p.id+'" data-f="zip">ZIP</button></div>'+tdConfirm+'</div>':"";
  const crPanel=cr&&p.status===PS.ICR?
   '<div class="panel"><h3>Outcome'+adot(has("crReview:"+p.id))+'</h3><div class="row"><button class="btn warn" data-act="requestChanges" data-id="'+p.id+'">Return back</button><button class="btn" data-act="clearPkg" data-id="'+p.id+'">Approve</button></div></div>':"";
  return '<div class="grid2"><div><div class="head" style="margin-bottom:10px"><div><h2 class="sec" style="margin:0">Package version '+p.version+'</h2><div class="row" style="margin-top:6px">'+badge(p.status)+'<span class="small muted">Collated '+fmtD(p.createdAt)+(p.submittedAt?", submitted to TEC "+fmtD(p.submittedAt):"")+'</span></div></div><div class="acts">'+acts+'</div></div>'+
   '<div class="list" id="pkgItems">'+items+'</div></div><div>'+crPanel+exp+'</div></div>';}
route("package",id=>{const p=PK(id),u=me();if(!p)return denied("This package doesn't exist.");const t=T(p.tenderId);if(!canSeeTender(u,t))return denied("You don't have access to this package.");
  return packageBreadcrumbs(p, t)+'<h1>'+esc(t.code+" "+t.title)+'</h1>'+pkgPanel(t);});
const crTeam=()=>S.users.filter(x=>isCR(x)&&x.status==="Active").map(x=>x.id);
ACT.tecApprove=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);
  openModal({title:"TEC Approve "+t.code+"?",body:'<p>Record TEC approval for package v'+p.version+' ('+p.items.length+' documents) before sending to the contracts reviewer.</p>'+
   fld("Approval remarks (optional)",'<textarea name="n" id="ta1" placeholder="Add remarks or notes from the TEC panel..."></textarea>',"ta1"),submit:"TEC Approve",onSubmit:fd=>{
   const notes=fd.get("n").trim();p.tecApproved=true;p.reviews.push({by:S.me,stage:"TEC",outcome:"TEC Approved",at:Date.now(),notes});
   log(t,"TEC approved package v"+p.version+(notes?": "+notes:""));notify([t.icId],"TEC approved package v"+p.version+" on "+t.code+". Ready to send for contracts review.","#/package/"+p.id,"sendCR:"+p.id);
   save();rerender();toast("Package v"+p.version+" TEC approved");}});};
ACT.sendCR=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);p.status=PS.ICR;p.createdAt=Date.now();log(t,"sent package v"+p.version+" for contracts review");notify(crTeam(),U(t.icId).name+" sent "+t.code+" "+t.title+" for contracts review","#/package/"+p.id,"crReview:"+p.id);rerender();toast("Sent to the contracts team");};
ACT.flag=el=>{const p=PK(el.dataset.id);p.flags=(p.flags||[]).filter(x=>x!==el.value);if(el.checked)p.flags.push(el.value);save();};
ACT.requestChanges=el=>{const p=PK(el.dataset.id),t=T(p.tenderId),ids=(p.flags||[]).slice();
  if(!ids.length){toast("Tick Flag on at least one document first");return;}
  openModal({title:"Return back "+t.code,body:ids.map(id=>fld(D(id).name,'<textarea name="c_'+id+'" id="rc'+id+'" placeholder="What needs to change"></textarea>',"rc"+id)).join(""),submit:"Return back",danger:true,onSubmit:fd=>{
   if(ids.some(id=>!fd.get("c_"+id).trim()))return "Add a comment for every flagged document.";
   ids.forEach(id=>{const d=D(id),c=fd.get("c_"+id).trim();d.status=DS.CR;d.contractsFlag=c;touchDoc(d);d.comments.push({id:uid("cm"),by:S.me,at:Date.now(),text:c,resolved:false,replies:[],contracts:true});notify([d.ownerId],"Contracts reviewer flagged "+d.name+": "+c,"#/doc/"+d.id);});
   p.flags=[];p.status=PS.CHG;p.reviews.push({by:S.me,stage:"Contracts review",outcome:"Returned",at:Date.now(),notes:ids.length+" documents flagged"});log(t,"returned package v"+p.version+" in contracts review ("+ids.length+" documents flagged)");
   notify([t.icId],"Contracts reviewer returned "+t.code+" ("+t.title+") for changes. You can revise and resubmit.","#/package/"+p.id,"resendCR:"+p.id);save();rerender();toast("Returned back. "+U(t.icId).name+" has been notified");}});};
ACT.clearPkg=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);if((p.flags||[]).length){toast("Untick flagged documents, or click Return back instead");return;}

  openModal({title:"Approve "+t.code+"?",body:fld("Notes for the record",'<textarea name="n" id="cl1" placeholder="Optional notes..."></textarea>',"cl1"),submit:"Approve",onSubmit:fd=>{
   p.status=PS.CLR;p.reviews.push({by:S.me,stage:"Contracts review",outcome:"Approved",at:Date.now(),notes:fd.get("n").trim()});log(t,"approved package v"+p.version);notify([t.icId],"Contracts reviewer approved "+t.code+" ("+t.title+"). Download the package and send it to Tender Division.","#/package/"+p.id,"sendTD:"+p.id);save();rerender();toast("Approved");}});};
ACT.reopenAll=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);p.items.map(i=>D(i.docId)).filter(d=>d.status===DS.CR).forEach(d=>{d.status=DS.DR;touchDoc(d);notify([d.ownerId],"Revise "+d.name+" for the contracts team. Re-approval is needed.","#/doc/"+d.id,"own:"+d.id);log(t,"reopened "+d.name+" for changes",d.id);});save();rerender();toast("Flagged documents reopened");};
ACT.resendCR=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);p.flags=[];p.items.forEach(i=>{const d=D(i.docId);i.versionNo=d.versions.length;d.contractsFlag=null;});p.status=PS.ICR;log(t,"resubmitted package v"+p.version+" for contracts review");notify(crTeam(),U(t.icId).name+" resubmitted "+t.code+" ("+t.title+") for contracts review","#/package/"+p.id,"crReview:"+p.id);save();rerender();toast("Resubmitted to contracts reviewer");};
ACT.sendTD=el=>{const p=PK(el.dataset.id),t=T(p.tenderId);
  if(el.checked){p.prevStatus=p.status;p.status=PS.TD;p.sentTdAt=Date.now();p.sentTdBy=S.me;log(t,"confirmed package v"+p.version+" was sent to Tender Division");notify(["u-td",projOf(t).leadId].filter(Boolean),t.code+" "+t.title+" was sent to Tender Division","#/package/"+p.id);toast(t.code+" marked as sent to Tender Division");}
  else{p.status=p.prevStatus||PS.CLR;p.sentTdAt=null;p.sentTdBy=null;log(t,"undid the Tender Division confirmation for package v"+p.version);toast("Confirmation removed");}
  save();rerender();};

function tMetrics(t){const u=me(),ic=isIC(u,t)&&!t.manual,ms=S.metrics.filter(m=>m.tenderId===t.id),sg=SUGG[t.id],hist=S.history.filter(h=>h.route===t.route);
  return '<div class="grid2"><div><div class="head"><div><h2 class="sec" style="margin-top:0">Success metrics</h2></div><div class="acts">'+(ic?'<button class="btn sec" data-act="addMetric" data-id="'+t.id+'">Add metric</button><button class="btn" data-act="suggest" data-id="'+t.id+'" id="sugBtn"'+dA(has("metrics:"+t.id))+'>Suggest metrics'+dSR(has("metrics:"+t.id))+'</button>':"")+'</div></div>'+
  (ms.length?'<div class="list" style="padding:0 16px">'+ms.map(m=>'<div class="metric"><span><b>'+esc(m.metric)+'</b><span class="why">Target: '+esc(m.target)+'</span></span><span class="row">'+(ic?'<button class="link small" data-act="delMetric" data-id="'+m.id+'">Remove</button>':"")+'</span></div>').join("")+'</div>':'<div class="empty">No metrics accepted yet.</div>')+
  '<div id="sugOut">'+(sg?sugHtml(t,sg):"")+'</div></div>'+
  '<div class="panel"><h3>Past metrics</h3>'+(hist.length?hist.map((h,i)=>'<div class="metric"><span><b>'+esc(h.metric)+'</b><span class="why">'+esc(h.tender)+'. Target '+esc(h.target)+', actual '+esc(h.actual)+'</span></span>'+(ic?'<button class="btn ghost sm" data-act="useHist" data-id="'+t.id+'" data-i="'+S.history.indexOf(h)+'">Use</button>':"")+'</div>').join(""):'<p class="muted">No similar tenders yet.</p>')+'</div></div>';}
function sugHtml(t,sg){if(sg.loading)return '<div class="panel" style="margin-top:14px"><p>Thinking about metrics for '+esc(t.code)+'...</p><button class="btn ghost sm" data-act="stopSuggest" data-id="'+t.id+'">Stop</button></div>';
  if(sg.error)return '<p class="small muted" style="margin-top:14px">'+esc(sg.error)+'</p>';
  return '<div class="panel" style="margin-top:14px"><h3>Suggestions <span class="tag">'+esc(sg.source)+'</span></h3><p class="small muted">Nothing is saved until you accept it. Edit the target first if needed.</p>'+sg.items.map((s,i)=>'<div class="metric"><span><b>'+esc(s.metric)+'</b><span class="why">'+esc(s.rationale||"")+'</span><input type="text" value="'+esc(s.target)+'" id="sgT'+i+'" aria-label="Target for '+esc(s.metric)+'" style="margin-top:6px"></span><span class="row"><button class="btn sm" data-act="acceptSug" data-id="'+t.id+'" data-i="'+i+'">Accept</button><button class="btn ghost sm" data-act="rejectSug" data-id="'+t.id+'" data-i="'+i+'">Reject</button></span></div>').join("")+'</div>';}
ACT.addMetric=el=>openModal({title:"Add success metric",body:fld("Metric",'<input type="text" name="m" id="am1">',"am1")+fld("Target",'<input type="text" name="t" id="am2">',"am2"),onSubmit:fd=>{const m=fd.get("m").trim(),tg=fd.get("t").trim();if(!m||!tg)return "Enter a metric and target.";S.metrics.push({id:uid("m"),tenderId:el.dataset.id,metric:m,target:tg,source:"Manual"});const t=T(el.dataset.id);log(t,"added success metric "+m);rerender();}});
ACT.delMetric=el=>{S.metrics=S.metrics.filter(m=>m.id!==el.dataset.id);rerender();};
ACT.useHist=el=>{const h=S.history[+el.dataset.i];openModal({title:"Use past metric",body:'<p><b>'+esc(h.metric)+'</b><br><span class="small muted">'+esc(h.tender)+' achieved '+esc(h.actual)+'</span></p>'+fld("Target for this tender",'<input type="text" name="t" id="uh1" value="'+esc(h.target)+'">',"uh1"),submit:"Accept metric",onSubmit:fd=>{
  S.metrics.push({id:uid("m"),tenderId:el.dataset.id,metric:h.metric,target:fd.get("t").trim()||h.target,source:"Historical"});const t=T(el.dataset.id);log(t,"accepted historical metric "+h.metric);rerender();toast("Metric accepted");}});};
ACT.acceptSug=el=>{const t=T(el.dataset.id),sg=SUGG[t.id],i=+el.dataset.i,s=sg.items[i],tg=(document.getElementById("sgT"+i)||{}).value||s.target;
  S.metrics.push({id:uid("m"),tenderId:t.id,metric:s.metric,target:tg,source:sg.source==="AI suggested"?"AI":"Template"});sg.items.splice(i,1);if(!sg.items.length)delete SUGG[t.id];log(t,"accepted success metric "+s.metric);rerender();toast("Metric accepted");};
ACT.rejectSug=el=>{const sg=SUGG[el.dataset.id];sg.items.splice(+el.dataset.i,1);if(!sg.items.length)delete SUGG[el.dataset.id];rerender();};

function actLink(a){
  if(a.link) return a.link;
  const tid = a.tenderId;
  const t = tid ? T(tid) : null;
  const txt = (a.text || "").toLowerCase();

  // 1. Direct document match by a.docId
  if(a.docId && D(a.docId)) {
    return "#/doc/" + a.docId;
  }

  // 2. Document name match within tender documents
  if(t) {
    const ds = docsOf(t);
    const matchedDoc = ds.filter(d => txt.includes(d.name.toLowerCase()))
                         .sort((x, y) => y.name.length - x.name.length)[0];
    if(matchedDoc) return "#/doc/" + matchedDoc.id;
  }

  // 3. Document general actions / catalogue / drafting
  if(txt.includes("document") || txt.includes("catalogue") || txt.includes("recommendation") || txt.includes("drafting") || txt.includes("revising") || txt.includes("reopened") || txt.includes("flagged") || txt.includes("collate")) {
    if(t) return "#/tender/" + t.id + "/documents";
  }

  // 4. Package actions
  if(txt.includes("package") || txt.includes("contracts review") || txt.includes("tec approved") || txt.includes("submitted to tec") || txt.includes("post-tec") || txt.includes("finalised")) {
    if(t) {
      const p = pkgOf(t);
      if(p) return "#/package/" + p.id;
      return "#/tender/" + t.id + "/documents";
    }
  }

  // 5. Team / IC / SME / members / lead
  if(txt.includes("sme") || txt.includes(" ic") || txt.includes("project ic") || txt.includes("team") || txt.includes("assigned owners") || txt.includes("lead")) {
    if(t) return "#/tender/" + t.id + "/team";
  }

  // 6. Success metrics
  if(txt.includes("metric")) {
    if(t) return "#/tender/" + t.id + "/metrics";
  }

  // 7. Tender overview fallback
  if(t) {
    return "#/tender/" + t.id + "/overview";
  }

  // 8. Project link
  if(a.projectId) {
    return "#/search/" + a.projectId;
  }

  return null;
}

function formatActText(a, link){
  if(!link) return esc(a.text);
  const txt = a.text || "";

  // 1. Direct doc match by a.docId
  if(a.docId && D(a.docId)) {
    const d = D(a.docId);
    const idx = txt.toLowerCase().indexOf(d.name.toLowerCase());
    if(idx >= 0) {
      return esc(txt.slice(0, idx)) +
        '<a href="' + link + '" class="feed-target-link" title="Open ' + esc(d.name) + '">' + esc(txt.slice(idx, idx + d.name.length)) + '</a>' +
        esc(txt.slice(idx + d.name.length));
    }
  }

  // 2. Doc match by tender documents
  if(a.tenderId && T(a.tenderId)) {
    const ds = docsOf(T(a.tenderId))
      .filter(d => txt.toLowerCase().includes(d.name.toLowerCase()))
      .sort((x, y) => y.name.length - x.name.length);
    if(ds.length) {
      const d = ds[0];
      const idx = txt.toLowerCase().indexOf(d.name.toLowerCase());
      return esc(txt.slice(0, idx)) +
        '<a href="' + link + '" class="feed-target-link" title="Open ' + esc(d.name) + '">' + esc(txt.slice(idx, idx + d.name.length)) + '</a>' +
        esc(txt.slice(idx + d.name.length));
    }
  }

  // 3. Role / IC / SME assignments
  const mRole = txt.match(/^assigned (.+) as (.+)$/i);
  if(mRole) {
    return 'assigned ' + esc(mRole[1]) + ' as <a href="' + link + '" class="feed-target-link" title="View team">' + esc(mRole[2]) + '</a>';
  }
  const mRemove = txt.match(/^removed (.+) from the team$/i);
  if(mRemove) {
    return 'removed ' + esc(mRemove[1]) + ' from <a href="' + link + '" class="feed-target-link" title="View team">the team</a>';
  }

  // 3b. Project creation & details
  const mProj = txt.match(/^created (?:master )?project (.+)$/i);
  if(mProj) {
    return 'created project <a href="' + link + '" class="feed-target-link" title="View project">' + esc(mProj[1]) + '</a>';
  }
  if(/(?:master )?project details/.test(txt)) {
    return 'updated <a href="' + link + '" class="feed-target-link" title="View project">project details</a>';
  }

  // 4. Tender creation & details
  if(txt === "created the tender") {
    return 'created <a href="' + link + '" class="feed-target-link" title="View tender overview">the tender</a>';
  }
  if(txt === "edited the tender details") {
    return 'edited <a href="' + link + '" class="feed-target-link" title="View tender overview">the tender details</a>';
  }
  const mTecNom = txt.match(/^nominated (\d+) TEC members$/i);
  if(mTecNom) {
    return 'nominated <a href="' + link + '" class="feed-target-link" title="View TEC committee">' + esc(mTecNom[1]) + ' TEC members</a>';
  }

  // 5. Documents / Catalogue
  if(txt.includes("assigned owners")) {
    const idx = txt.indexOf("assigned owners");
    return esc(txt.slice(0, idx)) + '<a href="' + link + '" class="feed-target-link" title="View documents">assigned owners</a>' + esc(txt.slice(idx + 15));
  }
  if(txt.includes("from the catalogue")) {
    const idx = txt.indexOf("from the catalogue");
    return esc(txt.slice(0, idx)) + 'from <a href="' + link + '" class="feed-target-link" title="View catalogue">the catalogue</a>' + esc(txt.slice(idx + 18));
  }

  // 6. Packages
  const mPkg = txt.match(/(package v\d+)/i);
  if(mPkg) {
    const idx = txt.indexOf(mPkg[1]);
    return esc(txt.slice(0, idx)) +
      '<a href="' + link + '" class="feed-target-link" title="Open package">' + esc(mPkg[1]) + '</a>' +
      esc(txt.slice(idx + mPkg[1].length));
  }

  // 7. Success metrics
  const mMet = txt.match(/(success metric|historical metric) (.+)$/i);
  if(mMet) {
    const idx = txt.indexOf(mMet[2]);
    return esc(txt.slice(0, idx)) +
      '<a href="' + link + '" class="feed-target-link" title="View success metrics">' + esc(mMet[2]) + '</a>';
  }

  // Fallback: wrap in target link
  return '<a href="' + link + '" class="feed-target-link">' + esc(txt) + '</a>';
}

function feed(list){
  return list.length ?
    '<ul class="feed">' + list.sort((a,b)=>b.at-a.at).map(a => {
      const link = actLink(a);
      const textHtml = formatActText(a, link);
      return '<li>'+
        '<time>' + fmtDT(a.at) + '</time>'+
        '<div class="feed-content"><b>' + uname(a.by) + '</b> ' + textHtml + '</div>'+
      '</li>';
    }).join("") + '</ul>' :
    '<div class="empty">No activity yet.</div>';
}
function tActivity(t){return '<div class="panel">'+feed(S.activity.filter(a=>a.tenderId===t.id))+'</div>';}

function openActivityLogModal(type, entity){
  const u = me();
  let acts = [], title = '';

  if (type === 'project') {
    const p = entity;
    const tIds = new Set(tendersOf(p).map(t => t.id));

    acts = S.activity.filter(a => {
      if (a.projectId === p.id) return true;
      if (a.tenderId && tIds.has(a.tenderId)) return true;
      return false;
    });

    if (!isProjectLeadUser(u) && !isAdmin(u)) {
      acts = acts.filter(a => {
        if (a.tenderId && T(a.tenderId)) return userRelatesToTender(u, T(a.tenderId));
        if (a.projectId) return userRelatesToProject(u, PR(a.projectId));
        return true;
      });
    }

    title = p.code + ' ' + p.name;
  } else if (type === 'tender') {
    const t = entity;
    acts = S.activity.filter(a => a.tenderId === t.id);
    title = t.code + ' ' + t.title;
  }

  const body = '<div class="scroll" style="max-height:60vh">' +
    feed(acts) +
  '</div>';

  openModal({
    title,
    body,
    wide: true,
    submit: null
  });

  M.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => M.close());
  });
}

ACT.viewProjChanges = el => {
  const p = PR(el.dataset.id);
  if (p) openActivityLogModal('project', p);
};
ACT.viewTenderChanges = el => {
  const t = T(el.dataset.id);
  if (t) openActivityLogModal('tender', t);
};
