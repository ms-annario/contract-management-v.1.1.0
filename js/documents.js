/* Document page: versions, editor, comments, approvals, package and TEC viewer */
function snapshot(d,note){const last=d.versions.slice(-1)[0];if(!last||last.html!==d.html)d.versions.push({no:d.versions.length+1,html:d.html,at:Date.now(),by:S.me,note});else{last.note=note;last.at=Date.now();}return d.versions.length;}

function docActivity(d){const acts=S.activity.filter(a=>a.docId===d.id);
  const extra=d.approvals.filter(ap=>!acts.some(a=>a.by===ap.approverId&&Math.abs(a.at-ap.at)<60000&&/approved|returned/.test(a.text))).map(ap=>({at:ap.at,by:ap.approverId,text:(ap.decision==="Approved"?"approved ":"returned ")+d.name+(ap.remarks?": "+ap.remarks:""),docId:d.id,tenderId:d.tenderId}));
  return acts.map(a=>Object.assign({},a,{docId:d.id,tenderId:d.tenderId})).concat(extra);}
function docActs(d){const u=me(),owner=d.ownerId===u.id,sup=d.status===DS.PA&&isSuperiorOf(u,d.ownerId);
  const isLib=isLibUpload(d);
  let acts="";
  acts+='<button class="btn sec" data-act="downloadDocFile" data-id="'+d.id+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Download'+(d.fileName?' '+esc((d.fileName.split('.').pop()||'').toUpperCase()):'')+'</button>';
  if(owner){
    if([DS.NS,DS.DR,DS.RT,DS.IR].includes(d.status)){
      const sd=has("own:"+d.id)||has("publish:"+d.id);
      const wasReturned=d.status===DS.RT||!!d.remarks||d.approvals.some(a=>a.decision==="Returned");
      const btnLabel=wasReturned?"Resubmit for approval":"Send for approval";
      acts+='<button class="btn" data-act="sendApproval" data-id="'+d.id+'"'+dA(sd)+'>'+btnLabel+dSR(sd)+'</button>';
    }
    if(d.status===DS.PA){
      acts+='<button class="btn sec" data-act="withdrawApproval" data-id="'+d.id+'" title="Withdraw and go back to drafting"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>Withdraw to drafting</button>';
    }
  }
  if((owner||isLib)&&!DOC_LOCKED.includes(d.status))acts+='<button class="btn ghost" data-act="delDoc" data-id="'+d.id+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>Delete</button>';
  if(owner&&!isLib&&!DOC_LOCKED.includes(d.status))acts+='<button class="btn ghost" data-act="editDoc" data-id="'+d.id+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>Edit</button>';
  if(sup)acts+='<button class="btn warn" data-act="returnDoc" data-id="'+d.id+'">Return back</button><button class="btn" data-act="approve" data-id="'+d.id+'"'+dA(has("approve:"+d.id))+'>Approve'+dSR(has("approve:"+d.id))+'</button>';
  return acts;}
route("doc",id=>{const d=D(id),u=me();if(!d)return denied("This document doesn't exist.");
  const t=T(d.tenderId);if(!canSeeDoc(u,d)&&canSeeTender(u,t))return denied("This document hasn't been published yet. It becomes visible to the tender team when its owner publishes it.");if(!canSeeDoc(u,d)){if(isTEC(u,t)&&pkgOf(t)&&pkgOf(t).submittedAt)return ROUTES.tec(pkgOf(t).id);return denied("You don't have access to this document.");}
  // Library documents are reference files, not WIP: read-only, no comments or activity
  const isLib=isLibUpload(d);
  const owner=d.ownerId===u.id,edit=!isLib&&canEditDoc(u,d),cm=!isLib&&canComment(u,d);
  const body=edit?'<div class="doc"><div class="doc-tools" role="toolbar" aria-label="Formatting"><button type="button" data-act="fmt" data-c="formatBlock" data-v="h3">Heading</button><button type="button" data-act="fmt" data-c="formatBlock" data-v="p">Paragraph</button><button type="button" data-act="fmt" data-c="bold"><b>B</b></button><button type="button" data-act="fmt" data-c="italic"><i>I</i></button><button type="button" data-act="fmt" data-c="insertOrderedList">Numbered</button><button type="button" data-act="fmt" data-c="insertUnorderedList">Bullets</button><span style="width:1px;height:16px;background:var(--rule);margin:0 4px;display:inline-block;vertical-align:middle"></span><button type="button" class="btn-ai-write" data-act="aiWriteAssist" data-id="'+d.id+'" title="AI to help with writing document"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path></svg>Write with AI</button><div style="margin-left:auto;display:inline-flex;align-items:center;gap:10px"><span class="saved" id="savedState">All changes saved</span><button type="button" class="btn-save" id="btnSaveDoc" data-act="saveDocContent" data-id="'+d.id+'" title="Save document changes (Cmd+S / Ctrl+S)" disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save</button></div></div><div class="doc-body" id="editor" contenteditable="true" spellcheck="true" aria-label="Document content">'+d.html+'</div></div>'
    :'<div class="doc"><div class="doc-tools"><span class="saved" style="margin-left:0">Read-only</span></div><div class="doc-body" id="reader">'+d.html+'</div></div>';
  const cms=d.comments.slice().sort((a,b)=>(a.resolved-b.resolved)||(b.at-a.at));
  const cmHtml=cms.map(c=>'<div class="cmt'+(c.resolved?" resolved":"")+'"><div class="by">'+uname(c.by)+'<span class="at">'+rel(c.at)+'</span>'+(c.contracts?' <span class="tag">Contracts review</span>':"")+(c.resolved?' <span class="tag">Resolved</span>':"")+'</div><p>'+esc(c.text)+'</p>'+
    c.replies.map(r=>'<div class="rep"><div class="by">'+uname(r.by)+'<span class="at">'+rel(r.at)+'</span></div><p>'+esc(r.text)+'</p></div>').join("")+
    (!c.resolved&&(cm||owner)?'<div class="row" style="margin-top:6px"><button class="link small" data-act="reply" data-id="'+d.id+'" data-c="'+c.id+'">Reply</button>'+(owner?'<button class="link small" data-act="resolve" data-id="'+d.id+'" data-c="'+c.id+'">Resolve</button>':"")+'</div>':"")+'</div>').join("");
  if(!d.versions||!d.versions.length){
    d.versions=[{no:1,html:d.html,at:d.createdAt||Date.now(),by:d.ownerId||S.me,note:"Initial draft"}];
  }
  const curVerNo=d.versions[d.versions.length-1].no;
  const versHtml=d.versions.slice().reverse().map(v=>{
    const isCur=v.no===curVerNo;
    const canRestore=edit&&!isCur&&!DOC_LOCKED.includes(d.status);
    return '<li style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--rule)">'+
      '<div><div style="font-weight:600;font-size:13px">Version '+v.no+(isCur?' <span class="badge g" style="font-size:11px;padding:0 5px;margin-left:4px">Current</span>':'')+'</div>'+
      '<div class="small muted">'+fmtDT(v.at)+' by '+uname(v.by)+(v.note?' &middot; '+esc(v.note):'')+'</div></div>'+
      (canRestore?'<button type="button" class="btn sec sm" data-act="restoreDocVer" data-id="'+d.id+'" data-v="'+v.no+'" style="padding:2px 8px;font-size:12px" title="Restore this version">Restore</button>':'')+
    '</li>';
  }).join("");
  const appr=d.approvals.slice().reverse().map(a=>'<li><time>'+fmtDT(a.at)+'</time><span>'+badge(a.decision)+' version '+a.versionNo+' by '+uname(a.approverId)+(a.remarks?': '+esc(a.remarks):"")+'</span></li>').join("");
  afterRender.push(()=>bindEditor(d));
  return docBreadcrumbs(d, t)+
  '<div class="head"><div><h1>'+esc(d.name)+'</h1></div><div class="acts">'+docActs(d)+'</div></div>'+
  '<div class="grid2"><div>'+body+'</div>'+
  '<div><div class="panel"><h3>Document details</h3><dl class="kv"><dt>Tender</dt><dd>'+(t?esc(t.code+" "+t.title):'–')+'</dd><dt>Spec type</dt><dd>'+esc(d.spec)+'</dd>'+docRemarkRows(d)+(d.fileName?'<dt>Attached file</dt><dd><b>'+esc(d.fileName)+'</b> <span class="muted small">('+(d.fileSize||'142 KB')+')</span></dd>':"")+'<dt>Owner</dt><dd>'+(d.ownerId?uname(d.ownerId):"Unassigned")+'</dd>'+(isLib?'':'<dt>Due date</dt><dd>'+fmtD(d.due)+'</dd><dt>Status</dt><dd>'+badge(d.status)+'</dd>')+'<dt>Created</dt><dd>'+(d.createdAt?fmtD(d.createdAt):'–')+'</dd><dt>Last updated</dt><dd>'+(lastUpd(d).at?fmtDT(lastUpd(d).at)+(lastUpd(d).by?' by '+uname(lastUpd(d).by):''):'–')+'</dd></dl></div>'+
  '<div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Version history</h3><span class="muted small">'+d.versions.length+(d.versions.length===1?' version':' versions')+'</span></div><ul style="list-style:none;padding:0;margin:8px 0 0">'+(versHtml||'<li class="small muted">Version 1</li>')+'</ul></div>'+
  (isLib?'':'<div class="panel"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Comments'+adot(has("comments:"+d.id))+''+(d.comments.some(c=>!c.resolved)?' <span class="muted small">'+d.comments.filter(c=>!c.resolved).length+' open</span>':'')+'</h3>'+(cm?'<button class="btn sec sm" data-act="addComment" data-id="'+d.id+'">Add comment</button>':"")+'</div>'+(cmHtml||'<p class="muted small" style="margin-top:10px">No comments yet.</p>')+'</div>'+
  '<div class="panel"><h3>Activity</h3>'+feed(docActivity(d))+'</div>')+'</div></div>';});

function doSaveDoc(d){
  const ed=document.getElementById("editor");if(!ed)return;
  const st=document.getElementById("savedState");
  const btn=document.getElementById("btnSaveDoc");
  d.html=sanitize(ed.innerHTML);
  d.updatedAt=Date.now();
  d.updatedBy=S.me;
  if(!d.versions||!d.versions.length){
    d.versions=[{no:1,html:d.html,at:d.createdAt||Date.now(),by:d.ownerId||S.me,note:"Initial draft"}];
  }
  snapshot(d,"Draft revision");
  const t=T(d.tenderId);
  if(d.status===DS.NS||d.status===DS.RT){
    const from=d.status;
    d.status=DS.DR;
    log(t,(from===DS.RT?"started revising ":"started drafting ")+d.name,d.id);
    refreshActs();
    const ac=document.querySelector("main .head .acts");
    if(ac)ac.innerHTML=docActs(d);
    renderNav();
  }
  save();
  if(st){
    const timeStr=new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
    st.innerHTML='<span style="color:var(--g-fg);font-weight:600">✓ Saved '+timeStr+'</span>';
  }
  if(btn)btn.setAttribute("disabled","true");
  toast("Document saved");
}

function bindEditor(d){
  const ed=document.getElementById("editor");if(!ed)return;
  const st=document.getElementById("savedState");
  const btn=document.getElementById("btnSaveDoc");
  const onEdit=()=>{
    if(st)st.innerHTML='<span style="color:var(--w-fg);font-weight:600">● Unsaved changes</span>';
    if(btn)btn.removeAttribute("disabled");
  };
  ed.addEventListener("input",onEdit);
  ed.addEventListener("keydown",e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"){
      e.preventDefault();
      doSaveDoc(d);
    }
  });
}
ACT.saveDocContent=el=>{const d=D(el.dataset.id);if(d)doSaveDoc(d);};
ACT.fmt=el=>{const ed=document.getElementById("editor");ed.focus();document.execCommand(el.dataset.c,false,el.dataset.v||null);ed.dispatchEvent(new Event("input"));};

function getAiDocMock(d, t, task, prompt){
  const name = d ? d.name : "Document";
  const spec = d ? d.spec : "General";
  const tCode = t ? t.code : "NRE-C03";
  const tTitle = t ? t.title : "Tender";
  const scope = t && t.scope ? t.scope : "the works described in the tender drawings and specification schedule";

  if(task === "expand"){
    return '<h3>2. Technical Specifications & Requirements</h3>' +
      '<p>The Contractor shall execute the works for <b>' + esc(tCode + ' ' + tTitle) + '</b> in strict conformance with the following performance benchmarks:</p>' +
      '<ul>' +
        '<li><b>Material Standards:</b> All components shall be certified to current British/European Standards and supplied with mill test certificates prior to installation.</li>' +
        '<li><b>Durability & Performance:</b> Systems shall possess a design service life of not less than 30 years under designated environmental exposure conditions.</li>' +
        '<li><b>Site Coordination:</b> The Contractor shall liaise directly with the systems contractor and statutory undertakers for interface clearances.</li>' +
        '<li><b>Quality Assurance:</b> An Inspection and Test Plan (ITP) shall be submitted within 14 days of contract award.</li>' +
      '</ul>';
  }

  if(task === "compliance"){
    return '<h3>3. Testing, Verification & Compliance Criteria</h3>' +
      '<ol>' +
        '<li><b>Independent Testing:</b> Acoustic attenuation and structural load testing shall be performed by an accredited independent testing facility.</li>' +
        '<li><b>Sample Mock-ups:</b> A 1:1 scale mock-up of the barrier assembly shall be submitted to the Contract Project IC for aesthetic and technical clearance.</li>' +
        '<li><b>Non-Conformance Procedure:</b> Any component exhibiting manufacturing defects or damage during transit shall be quarantined immediately.</li>' +
        '<li><b>Handover Documentation:</b> Final acceptance is contingent on delivery of As-Built drawings, manufacturer warranties, and O&M manuals.</li>' +
      '</ol>';
  }

  if(task === "polish"){
    return '<h3>1. Purpose & Scope</h3>' +
      '<p>This document sets out the contractual and technical requirements for the procurement, fabrication, delivery, and installation of works associated with <b>' + esc(tCode + ' ' + tTitle) + '</b>.</p>' +
      '<p>The appointed Contractor shall carry out the works in rigorous compliance with the Particular Specification, statutory planning conditions, and the employer requirements.</p>';
  }

  return '<h3>1. Purpose & Scope</h3>' +
    '<p>This document defines the requirements and specifications for <b>' + esc(name) + '</b> under tender package <b>' + esc(tCode + ' ' + tTitle) + '</b>.</p>' +
    '<p><b>Scope of Works:</b> ' + esc(scope) + '</p>' +
    '<h3>2. Key Requirements & Deliverables</h3>' +
    '<ul>' +
      '<li>Supply, delivery, offloading, and on-site erection of all specified modular units and ancillary fixings.</li>' +
      '<li>Execution of pre-installation structural surveys, geotechnical verification, and alignment inspections.</li>' +
      '<li>Full interface coordination with ongoing civil engineering and permanent way infrastructure.</li>' +
      '<li>Adherence to Environmental Protection Guidelines, acoustic decibel mitigation criteria, and site safety rules.</li>' +
    '</ul>' +
    '<h3>3. Compliance & Quality Assurance</h3>' +
    '<ol>' +
      '<li>Submit a project-specific Quality Plan and Inspection & Test Plan (ITP) for IC review before off-site fabrication.</li>' +
      '<li>Provide manufacturer warranties guaranteeing minimum 30-year corrosion protection and acoustic integrity.</li>' +
      '<li>Conduct all field verification testing witnessed by the nominated contract supervisor.</li>' +
    '</ol>';
}

ACT.aiWriteAssist=el=>{
  const d=D(el.dataset.id);if(!d)return;
  const t=T(d.tenderId);
  const sample1=getAiDocMock(d, t, "draft", "");
  openModal({
    title:"AI Writing Assistant",
    wide:true,
    body:''+
      fld("Writing task",'<select name="task" id="aiTask"><option value="draft">Draft complete structure & clauses (Recommended)</option><option value="expand">Expand technical requirements & specifications</option><option value="compliance">Add testing, verification & compliance criteria</option><option value="polish">Refine & formalize contract wording</option></select>',"aiTask")+
      fld("Custom instructions (optional)",'<textarea name="prompt" id="aiPrompt" rows="2" placeholder="e.g. Include BS EN acoustic standards, durability warranty, modular assembly criteria..."></textarea>',"aiPrompt")+
      fld("How to apply",'<select name="mode" id="aiMode"><option value="replace">Replace current editor content</option><option value="append">Append to existing content</option></select>',"aiMode")+
      '<div style="background:var(--sunk);border:1px solid var(--rule);border-radius:6px;padding:12px;margin-top:12px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
          '<span style="font-weight:600;font-size:12px;color:var(--ink-2);text-transform:uppercase;letter-spacing:0.04em">AI Generated Preview</span>'+
          '<span class="badge a" style="font-size:11px">AI Suggestion</span>'+
        '</div>'+
        '<div id="aiPreviewBox" style="font-size:13.5px;line-height:1.5;max-height:160px;overflow-y:auto;color:var(--ink);background:var(--surface);padding:10px;border-radius:4px;border:1px solid var(--rule)">'+sample1+'</div>'+
      '</div>',
    submit:"Insert into document",
    onSubmit:fd=>{
      const task=fd.get("task")||"draft";
      const customPrompt=fd.get("prompt")||"";
      const mode=fd.get("mode")||"replace";
      const generated=getAiDocMock(d, t, task, customPrompt);
      const ed=document.getElementById("editor");
      if(ed){
        if(mode==="append"){
          ed.innerHTML = (ed.innerHTML.trim() ? ed.innerHTML + '<br>' : '') + generated;
        }else{
          ed.innerHTML = generated;
        }
        ed.dispatchEvent(new Event("input"));
      }else{
        d.html = mode==="append" ? (d.html + generated) : generated;
        d.updatedAt = Date.now();
        d.updatedBy = S.me;
        snapshot(d,"AI assisted draft");
        save();
        rerender();
      }
      toast("AI text inserted. Review and click Save.");
    }
  });

  const sel=document.getElementById("aiTask");
  const pBox=document.getElementById("aiPreviewBox");
  if(sel&&pBox){
    sel.addEventListener("change",()=>{
      pBox.innerHTML=getAiDocMock(d, t, sel.value, (document.getElementById("aiPrompt")||{}).value||"");
    });
  }
};
ACT.addComment=el=>{const d=D(el.dataset.id);openModal({title:"Comment on "+d.name,body:fld("Comment",'<textarea name="c" id="cmT"></textarea>',"cmT"),submit:"Post comment",onSubmit:fd=>{
  const text=fd.get("c").trim();if(!text)return "Write a comment first.";const t=T(d.tenderId),cr=isCR(me())&&!isMember(me(),projOf(t));
  d.comments.push({id:uid("cm"),by:S.me,at:Date.now(),text,resolved:false,replies:[],contracts:cr});touchDoc(d);
  notify([d.ownerId],me().name+" commented on "+d.name,"#/doc/"+d.id,"comments:"+d.id);log(t,"commented on "+d.name,d.id);rerender();toast("Comment posted");}});};
ACT.reply=el=>{const d=D(el.dataset.id),c=d.comments.find(x=>x.id===el.dataset.c);openModal({title:"Reply to "+U(c.by).name,body:'<div class="cmt" style="padding-top:0"><p>'+esc(c.text)+'</p></div>'+fld("Reply",'<textarea name="r" id="rpT"></textarea>',"rpT"),submit:"Post reply",onSubmit:fd=>{
  const r=fd.get("r").trim();if(!r)return "Write a reply first.";c.replies.push({by:S.me,at:Date.now(),text:r});touchDoc(d);notify([c.by,...c.replies.map(x=>x.by),d.ownerId],me().name+" replied on "+d.name,"#/doc/"+d.id);rerender();}});};
ACT.resolve=el=>{const d=D(el.dataset.id),c=d.comments.find(x=>x.id===el.dataset.c),t=T(d.tenderId);c.resolved=true;touchDoc(d);notify([c.by],me().name+" resolved your comment on "+d.name,"#/doc/"+d.id);log(t,"resolved a comment on "+d.name,d.id);rerender();toast("Comment resolved");};
ACT.sendApproval=el=>{const d=D(el.dataset.id),t=T(d.tenderId),meU=me(),pick=!meU.superiorId;let sup=U(meU.superiorId);
  const approvers=S.users.filter(x=>x.status==="Active"&&x.id!==meU.id&&x.role==="SME superior");
  const pickFld=pick?fld("Approver",'<select name="sup" id="apSup" required><option value="">Choose who approves your documents</option>'+approvers.map(x=>'<option value="'+x.id+'">'+esc(x.name+(x.title?", "+x.title:""))+'</option>').join("")+'</select>',"apSup")+'<p class="small muted">They will approve your documents from now on.</p>':"";
  const wasReturned=d.status===DS.RT||!!d.remarks||d.approvals.some(a=>a.decision==="Returned");
  const modalTitle=wasReturned?"Resubmit "+d.name+" for approval?":"Send "+d.name+" for approval?";
  const modalBody=wasReturned?
    (pick?'<p>Resubmit your revised version of <b>'+esc(d.name)+'</b> for review. The version will be locked until they decide.</p>':'<p>Resubmit your revised version of <b>'+esc(d.name)+'</b> to <b>'+esc(sup.name)+'</b> for review. The version will be locked until they decide.</p>')+pickFld:
    (pick?'<p>'+esc(d.name)+' goes for approval. The version is locked until they decide.</p>':'<p>'+esc(d.name)+' goes to <b>'+esc(sup.name)+'</b> for approval. The version is locked until they decide.</p>')+pickFld;
  const submitLabel=wasReturned?"Resubmit for approval":"Send for approval";
  openModal({title:modalTitle,body:modalBody,submit:submitLabel,onSubmit:fd=>{
   if(pick){const id=fd.get("sup");if(!id)return "Choose who should approve this document.";meU.superiorId=id;sup=U(id);}
   const ed=document.getElementById("editor");if(ed){d.html=sanitize(ed.innerHTML);d.updatedAt=Date.now();d.updatedBy=S.me;}
   const v=snapshot(d,wasReturned?"Resubmitted with revisions":"Sent for approval");d.status=DS.PA;d.remarks=null;touchDoc(d);
   log(t,(wasReturned?"resubmitted revised ":"sent ")+d.name+" for approval",d.id);
   notify([sup.id],me().name+(wasReturned?" resubmitted revised ":" sent ")+d.name+" for approval (review again)","#/doc/"+d.id,"approve:"+d.id);
   if(t.icId&&t.icId!==sup.id&&t.icId!==d.ownerId)notify([t.icId],me().name+(wasReturned?" resubmitted revised ":" sent ")+d.name+" on "+t.code+" for approval","#/doc/"+d.id);
   save();rerender();toast(d.name+(wasReturned?" resubmitted to ":" sent to ")+sup.name+" for review");}});};
ACT.withdrawApproval=el=>{
  const d=D(el.dataset.id),t=T(d.tenderId);
  openModal({
    title:"Withdraw "+d.name+" to drafting?",
    body:'<p>This withdraws the approval request from '+(U(d.ownerId).superiorId?'<b>'+uname(U(d.ownerId).superiorId)+'</b>':'your reviewer')+' and returns the document to <b>Drafting</b>.</p>',
    submit:"Withdraw to drafting",
    onSubmit:()=>{
      d.status=DS.DR;
      touchDoc(d);
      log(t,"withdrew "+d.name+" back to drafting",d.id);
      save();
      rerender();
      toast(d.name+" withdrawn to drafting");
    }
  });
};
ACT.restoreDocVer=el=>{
  const d=D(el.dataset.id);
  const vNo=parseInt(el.dataset.v,10);
  const target=(d.versions||[]).find(x=>x.no===vNo);
  if(!target)return;
  openModal({
    title:"Restore Version "+target.no+"?",
    body:'<p>Are you sure you want to restore <b>Version '+target.no+'</b> (saved '+fmtDT(target.at)+' by '+uname(target.by)+')?</p>'+
      ''+
      '<div style="max-height:160px;overflow-y:auto;border:1px solid var(--rule);padding:10px;border-radius:6px;background:var(--sunk);font-size:13px;margin-top:10px">'+target.html+'</div>',
    submit:"Restore version",
    onSubmit:()=>{
      d.html=target.html;
      d.updatedAt=Date.now();
      d.updatedBy=S.me;
      snapshot(d,"Restored to version "+target.no);
      touchDoc(d);
      save();
      rerender();
      toast("Restored to version "+target.no);
    }
  });
};
ACT.approve=el=>{const d=D(el.dataset.id),t=T(d.tenderId);openModal({title:"Approve "+d.name+"?",body:'<p>Version '+d.versions.length+' will be recorded as approved by you and can be collated into the tender package.</p>',submit:"Approve",onSubmit:()=>{
  d.status=DS.AP;d.approvals.push({versionNo:d.versions.length,approverId:S.me,decision:"Approved",remarks:"",at:Date.now()});d.remarks=null;touchDoc(d);log(t,"approved "+d.name,d.id);notify([d.ownerId,t.icId],me().name+" approved "+d.name+" on "+t.code,"#/doc/"+d.id);
  const ds=reqDocs(t),p=pkgOf(t);
  if(!p&&ds.length&&ds.every(isApproved)){
    const link=t.projectId?"#/search/"+t.projectId+"/"+t.id:"#/tender/"+t.id+"/documents";
    notify([t.icId],"All documents for "+t.code+" are approved and ready to collate",link,"collate:"+t.id);
    log(t,"all required documents approved — ready to collate package");
  }
  save();rerender();toast(d.name+" approved");}});};
ACT.returnDoc=el=>{const d=D(el.dataset.id),t=T(d.tenderId);openModal({title:"Return "+d.name+" back for revision",body:fld("Remarks for "+U(d.ownerId).name,'<textarea name="r" id="rt1" placeholder="What needs to change before you approve" required></textarea>',"rt1")+'',submit:"Return back",danger:true,onSubmit:fd=>{
  const r=fd.get("r").trim();if(!r)return "Add remarks so the SME knows what to change.";d.status=DS.RT;d.remarks=r;d.approvals.push({versionNo:d.versions.length,approverId:S.me,decision:"Returned",remarks:r,at:Date.now()});touchDoc(d);
  log(t,"returned "+d.name+" with remarks",d.id);notify([d.ownerId],me().name+' returned '+d.name+' for revision: "'+r+'". Please revise and send back for review.',"#/doc/"+d.id,"own:"+d.id);
  if(t.icId&&t.icId!==d.ownerId)notify([t.icId],me().name+' returned '+d.name+' on '+t.code+' for revision: "'+r+'"',"#/doc/"+d.id);
  save();rerender();toast(d.name+" returned to "+U(d.ownerId).name+" for revision");}});};

ACT.downloadDocFile=async el=>{
  const d=D(el.dataset.id);
  if(!d)return;
  const fileName=d.fileName?d.fileName:(slug(d.name)+".html");
  const blob=new Blob([d.html||"Approved document record"],{type:d.fileName?"application/octet-stream":"text/html"});
  await saveFile(fileName,blob);
};

ACT.uploadDoc=el=>{
  // Fields follow the library table columns: Project → Document name → Document category → Document type (Uploaded by, Status and Last updated are set automatically)
  const u=me();
  const projList=(isAdmin(u)||isProjectLeadUser(u)?S.projects:S.projects.filter(p=>userRelatesToProject(u,p))).slice().sort((a,b)=>a.name.localeCompare(b.name));
  if(!projList.length){toast("No projects available.");return;}
  const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
  const projOptions=opt("","Choose a project",true)+projList.map(p=>opt(p.id,p.code+" "+p.name)).join("");
  const catOptions=opt("","Choose a category",true)+LIB_CATS.map(c=>opt(c,c)).join("");
  const typeOptionsFor=cat=>cat&&LIB_DOC_TYPES[cat]?(LIB_DOC_TYPES[cat].length>1?opt("","Choose a type",true):"")+LIB_DOC_TYPES[cat].map(x=>opt(x,x,LIB_DOC_TYPES[cat].length===1)).join(""):opt("","Choose a category first",true);

  openModal({
    title:"Upload document to library",
    wide:true,
    submit:"Upload document",
    body:
      '<div class="field" style="margin-bottom:16px">'+
        '<label>File attachment <span class="req">*</span></label>'+
        '<div id="upDropBox" style="border:2px dashed var(--border);border-radius:8px;padding:22px;text-align:center;background:var(--bg-card);cursor:pointer;position:relative;transition:border-color .15s ease">'+
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px;color:var(--muted)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'+
          '<div id="upDropTitle" style="font-weight:600;margin-bottom:4px">Click to select a file or drag &amp; drop</div>'+
          '<div id="upDropSub" class="small muted">Supported formats: PDF, Word (DOCX), Excel (XLSX), CAD (DWG), ZIP (up to 50 MB)</div>'+
          '<input type="file" name="file" id="upFileInput" accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.txt,.zip" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">'+
        '</div>'+
      '</div>'+
      '<div class="row" style="gap:12px">'+
        '<div class="field" style="flex:1">'+
          '<label for="upProject">Project <span class="req">*</span></label>'+
          '<select name="projectId" id="upProject" required>'+projOptions+'</select>'+
        '</div>'+
        '<div class="field" style="flex:1">'+
          '<label for="upDocName">Document name <span class="req">*</span></label>'+
          '<input type="text" name="name" id="upDocName" placeholder="e.g. ITT Appendix A – Pricing schedule" required>'+
        '</div>'+
      '</div>'+
      '<div class="row" style="gap:12px">'+
        '<div class="field" style="flex:1">'+
          '<label for="upCat">Document category <span class="req">*</span></label>'+
          '<select name="libCat" id="upCat" required>'+catOptions+'</select>'+
        '</div>'+
        '<div class="field" style="flex:1">'+
          '<label for="upType">Document type <span class="req">*</span></label>'+
          '<select name="libType" id="upType" required disabled>'+typeOptionsFor("")+'</select>'+
        '</div>'+
      '</div>'+
      '</div>'+
      '',
    onSubmit:(fd,formEl)=>{
      const p=PR(fd.get("projectId"));
      if(!p)return "Choose a project.";
      const name=fd.get("name")?fd.get("name").trim():"";
      if(!name)return "Please enter a document name.";
      const libCat=fd.get("libCat"),libType=fd.get("libType");
      if(!LIB_DOC_TYPES[libCat])return "Choose a document category.";
      if(!LIB_DOC_TYPES[libCat].includes(libType))return "Choose a document type.";

      const fileInput=formEl.querySelector("#upFileInput");
      const file=fileInput&&fileInput.files&&fileInput.files[0];
      const fileName=file?file.name:(name.replace(/[^a-zA-Z0-9_.-]/g,"_")+".pdf");
      const fileSize=file?(file.size>1048576?(file.size/1048576).toFixed(1)+" MB":Math.max(1,Math.round(file.size/1024))+" KB"):"210 KB";
      const spec="General",audience="Tenderers";
      const ver=fd.get("version")?fd.get("version").trim():"v1.0";
      const now=Date.now();
      const ext=(fileName.split('.').pop()||'FILE').toUpperCase();

      const docId=uid("d");
      const docHtml='<div class="file-view" style="padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-bottom:20px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px">'+
          '<div style="display:flex;align-items:center;gap:14px">'+
            '<div style="width:46px;height:46px;border-radius:6px;background:var(--b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;letter-spacing:0.5px">'+
              esc(ext)+
            '</div>'+
            '<div>'+
              '<div style="font-weight:600;font-size:15px">'+esc(fileName)+'</div>'+
              '<div class="small muted">'+fileSize+' &middot; '+esc(ver)+' &middot; Uploaded '+fmtDT(now)+' by '+uname(S.me)+'</div>'+
            '</div>'+
          '</div>'+
          '<button class="btn sm sec" type="button" data-act="downloadDocFile" data-id="'+docId+'">Download file</button>'+
        '</div>'+
      '</div>'+
      '<h3>Document Overview</h3>'+
      '<p>This document was uploaded and recorded in the Document Library as an approved post-tender document by <b>'+uname(S.me)+'</b> ('+(ROLE_OF[S.me]||'User')+').</p>';

      const d={
        id:docId,
        tenderId:null,
        projectId:p.id,
        catId:null,
        libCat:libCat,
        libType:libType,
        name:name,
        spec:spec,
        audience:audience,
        ownerId:S.me,
        due:now,
        status:DS.AP,
        html:docHtml,
        versions:[{
          no:1,
          label:ver,
          html:docHtml,
          at:now,
          by:S.me,
          note:"Uploaded by "+uname(S.me),
          fileName:fileName,
          fileSize:fileSize
        }],
        comments:[],
        approvals:[{
          versionNo:1,
          approverId:S.me,
          decision:"Approved",
          remarks:"Recorded directly in library by "+uname(S.me),
          at:now
        }],
        remarks:null,
        contractsFlag:null,
        fileName:fileName,
        fileSize:fileSize,
        uploaded:true,
        libStatus:"Uploading",
        libFail:/fail/i.test(fileName),
        createdAt:now,
        updatedAt:now,
        updatedBy:S.me
      };

      S.docs.push(d);
      logProj(p,"uploaded '"+name+"' ("+fileName+") to the Document library","#/library");
      save();
      rerender();
      libAdvance(d.id);
      toast("Document '"+name+"' uploaded and recorded in Document library");
    }
  });

  const catSel=M.querySelector("#upCat"),typeSel=M.querySelector("#upType");
  if(catSel&&typeSel)catSel.onchange=()=>{typeSel.innerHTML=typeOptionsFor(catSel.value);typeSel.disabled=!catSel.value;};

  const fileInput=M.querySelector("#upFileInput");
  const dropBox=M.querySelector("#upDropBox");
  if(dropBox&&fileInput){
    dropBox.ondragover=e=>{e.preventDefault();dropBox.style.borderColor="var(--ink)";};
    dropBox.ondragleave=e=>{e.preventDefault();dropBox.style.borderColor="var(--border)";};
    dropBox.ondrop=e=>{
      e.preventDefault();
      dropBox.style.borderColor="var(--border)";
      if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){
        fileInput.files=e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    };
  }
  if(fileInput){
    fileInput.onchange=()=>{
      if(fileInput.files&&fileInput.files[0]){
        const file=fileInput.files[0];
        const titleEl=M.querySelector("#upDropTitle");
        const subEl=M.querySelector("#upDropSub");
        const nameInput=M.querySelector("#upDocName");
        const sizeStr=file.size>1048576?(file.size/1048576).toFixed(1)+' MB':Math.max(1,Math.round(file.size/1024))+' KB';
        if(titleEl)titleEl.innerHTML='<b>'+esc(file.name)+'</b> ('+sizeStr+')';
        if(subEl)subEl.textContent='File attached. Click or drag to replace.';
        if(nameInput&&!nameInput.value.trim()){
          nameInput.value=file.name.replace(/\.[^/.]+$/,"").replace(/[-_]+/g," ");
        }
      }
    };
  }
};

/* TEC viewer */
function tecInbox(){const u=me(),ps=S.packages.filter(p=>[PS.TEC,PS.POST,PS.FIN].includes(p.status)&&isTEC(u,T(p.tenderId)));
  return '<h1>TEC inbox</h1>'+(ps.length?'<div class="scroll"><table class="t"><thead><tr><th>Tender</th><th>Version</th><th>Submitted</th><th>Your view</th></tr></thead><tbody>'+ps.map(p=>{const t=T(p.tenderId);return '<tr><td><a href="#/tec/'+p.id+'">'+esc(t.code)+'</a>'+adot(has("tecRead:"+p.id))+'<br><span class="small muted">'+esc(t.title)+'</span></td><td>'+p.version+'</td><td>'+fmtD(p.submittedAt)+'</td><td>'+(p.tecViews[u.id]?badge("Viewed"):'<span class="badge w">Not viewed yet</span>')+'</td></tr>';}).join("")+'</tbody></table></div>':'<div class="empty">Nothing has been submitted to your panel.</div>');}
route("tec",(pid,ix)=>{const u=me();if(!pid)return tecInbox();const p=PK(pid);if(!p)return denied("This package doesn't exist.");const t=T(p.tenderId);
  if(!isTEC(u,t)||!p.submittedAt)return denied("Only TEC members of "+t.code+" can open this package after submission.");
  if(!p.tecViews[u.id]){p.tecViews[u.id]=Date.now();log(t,"viewed package v"+p.version);save();setTimeout(renderNav,0);}
  const i=ix===undefined?-1:+ix,items=p.items.map(it=>({it,d:D(it.docId)})),ms=S.metrics.filter(m=>m.tenderId===t.id);
  const sel=i>=0&&items[i]?items[i]:null,html=sel?(sel.d.versions[sel.it.versionNo-1]||{html:sel.d.html}).html:null;
  return tecBreadcrumbs()+'<div class="head"><div><h1>'+esc(t.code+" "+t.title)+'</h1><div class="row">'+badge(p.status)+'<span class="small muted">Package version '+p.version+', submitted '+fmtD(p.submittedAt)+' by '+uname(t.icId)+'. Read-only.</span></div></div></div>'+
  '<div class="grid2" style="grid-template-columns:260px minmax(0,1fr)"><div><div class="panel toc"><h3>Contents</h3><a href="#/tec/'+p.id+'"'+(i<0?' aria-current="true"':"")+'>Transmittal and success metrics</a>'+items.map((x,k)=>'<a href="#/tec/'+p.id+'/'+k+'"'+(k===i?' aria-current="true"':"")+'>'+(k+1)+'. '+esc(x.d.name)+'</a>').join("")+'</div>'+
  ''+'</div>'+
  '<div>'+(sel?'<div class="doc"><div class="doc-tools"><b class="small">'+esc(sel.d.name)+'</b><span class="saved">Version '+sel.it.versionNo+', '+(sel.d.audience==="Internal"?"internal":"for tenderers")+'</span></div><div class="doc-body">'+html+'</div></div>':
   '<div class="panel"><h3>Transmittal</h3><dl class="kv"><dt>Tender</dt><dd>'+esc(t.code+" "+t.title)+'</dd><dt>Package version</dt><dd>'+p.version+'</dd><dt>Documents</dt><dd>'+items.length+' ('+items.filter(x=>x.d.audience==="Internal").length+' internal)</dd><dt>Contracts review</dt><dd>'+esc((p.reviews.filter(r=>r.stage==="Before TEC").slice(-1)[0]||{outcome:"Not recorded"}).outcome)+'</dd></dl></div>'+
   '<div class="panel"><h3>Success metrics</h3>'+(ms.length?ms.map(m=>'<div class="metric"><span><b>'+esc(m.metric)+'</b><span class="why">Target: '+esc(m.target)+'</span></span><span class="tag">'+esc(m.source)+'</span></div>').join(""):'<p class="muted">No metrics recorded.</p>')+'</div>')+'</div></div>';});
