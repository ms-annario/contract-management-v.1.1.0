/* Home: universal search, Project → Tender → Document filters, project/tender/document panels */
/* ---------- Home: search and project explorer ---------- */
let GS_STATE = {
  pId: "",
  tId: "",
  docId: "",
  query: "",
  phase: "Tender Preparation",
  searchDropdownOpen: false,
  searchDdTab: "all"
};

/* Map each required task of the user to where its NEXT action happens in the lineage */
function gsTaskTargets(u){
  const out = [];
  const DOC_K = ["publish","own","comments","approve","review"];
  const TENDER_K = ["assignIC","nominateTec","assignSme","metrics","chooseDocs","assignOwner","collate"];
  const PKG_K = ["tecApprove","sendCR","resendCR","sendTD","crReview","tecRead"];
  myTasks(u).filter(tk => !tk.opt).forEach(tk => {
    const parts = tk.key.split(":"), kind = parts[0], id = parts[1];
    let level = "", d = null, t = null, p = null;
    if(DOC_K.includes(kind)){ d = D(id); if(!d) return; t = T(d.tenderId); if(!t) return; level = "doc"; }
    else if(TENDER_K.includes(kind)){ t = T(id); if(!t) return; level = "tender"; }
    else if(PKG_K.includes(kind)){ const pk = PK(id); if(!pk) return; t = T(pk.tenderId); if(!t) return; level = "tender"; }
    else if(kind === "createTenders"){ p = PR(id); if(!p) return; level = "project"; }
    else if(kind === "firstProject"){ level = "project"; }
    else return;
    if(t) p = projOf(t) || p;
    out.push({ key: tk.key, what: tk.what, level, pId: p ? p.id : "", tId: t ? t.id : "", docId: d ? d.id : "" });
  });
  return out;
}

/* Send legacy tender / document / package links into the search template */
function gsRedirectHash(r){
  const u = me(), pl = isProjectLeadUser(u);
  const lineage = t => { const p = projOf(t); return p ? { p } : null; };
  const base = (L, t) => "#/search/" + L.p.id + "/" + t.id;
  if(r.name === "tender" && r.args[0]){
    const t = T(r.args[0]); if(!t || !(pl || userRelatesToTender(u, t))) return null;
    const L = lineage(t); if(!L) return null;
    GS_STATE.tId = t.id; GS_STATE.docId = "";
    GS_STATE.tenderTab = r.args[1] || "overview";
    GS_STATE.tenderDocSubtab = r.args[2] || "all";
    return base(L, t);
  }
  if(r.name === "doc" && r.args[0]){
    const d = D(r.args[0]); if(!d) return null;
    const t = T(d.tenderId); if(!t) return null;
    if(!canSeeDoc(u, d) || !(pl || userRelatesToTender(u, t))) return null;
    const L = lineage(t); if(!L) return null;
    GS_STATE.tId = t.id; GS_STATE.docId = d.id;
    return base(L, t) + "/" + d.id;
  }
  if(r.name === "package" && r.args[0]){
    const pk = PK(r.args[0]); if(!pk) return null;
    const t = T(pk.tenderId); if(!t || !canSeeTender(u, t) || !(pl || userRelatesToTender(u, t))) return null;
    const L = lineage(t); if(!L) return null;
    GS_STATE.tId = t.id; GS_STATE.docId = "";
    GS_STATE.tenderTab = "package";
    return base(L, t);
  }
  return null;
}

function highlightMatch(text, q){
  if(!text) return "";
  const safeText = esc(text);
  if(!q) return safeText;
  const escQ = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const rx = new RegExp('(' + escQ + ')', 'gi');
    return safeText.replace(rx, '<mark class="gs-hl">$1</mark>');
  } catch(e){
    return safeText;
  }
}


function executeUniversalSearch(q, curUser){
  const cleanQ = (q || "").trim().toLowerCase();
  if(!cleanQ) return {
    query: "",
    projects: [],
    tenders: [],
    docs: [],
    totalCount: 0,
    pIdsWithMatches: new Set(),
    tIdsWithMatches: new Set(),
    docIdsWithMatches: new Set()
  };

  const isProjLead = isProjectLeadUser(curUser);

  // 1. Projects
  const allowedProjects = isProjLead ? S.projects : S.projects.filter(p => userRelatesToProject(curUser, p));
  const matchedProjects = [];
  allowedProjects.forEach(p => {
    const searchFields = [p.name, p.code].filter(Boolean).join(" ");
    if(searchFields.toLowerCase().includes(cleanQ)){
      matchedProjects.push({
        type: "project",
        id: p.id,
        project: p,
        title: p.name,
        code: p.code,
        status: p.status,
        metaText: "",
        snippet: "",
        lineagePath: [p.code],
        pId: p.id,
        tId: "",
        docId: ""
      });
    }
  });

  // 3. Tenders
  const allowedTenders = isProjLead ? S.tenders : S.tenders.filter(t => userRelatesToTender(curUser, t));
  const matchedTenders = [];
  allowedTenders.forEach(t => {
    const p = projOf(t);
    if(!p) return;
    if(!isProjLead && !userRelatesToProject(curUser, p)) return;
    const searchFields = [t.title, t.code].filter(Boolean).join(" ");
    if(searchFields.toLowerCase().includes(cleanQ)){
      matchedTenders.push({
        type: "tender",
        id: t.id,
        tender: t,
        project: p,
        title: t.title,
        code: t.code,
        status: tStatus(t),
        metaText: "",
        snippet: "",
        lineagePath: [p.code, t.code],
        pId: p.id,
        tId: t.id,
        docId: ""
      });
    }
  });

  // 4. Documents (all files)
  const allowedDocs = isProjLead ? S.docs.filter(d => d.status !== DS.NR) : S.docs.filter(d => d.status !== DS.NR && canSeeDoc(curUser, d));
  const matchedDocs = [];
  allowedDocs.forEach(d => {
    const t = T(d.tenderId);
    if(!t) return;
    const p = projOf(t);
    if(!p) return;
    if(!isProjLead && (!userRelatesToTender(curUser, t) || !userRelatesToProject(curUser, p))) return;
    const searchFields = d.name || "";
    if(searchFields.toLowerCase().includes(cleanQ)){
      matchedDocs.push({
        type: "doc",
        id: d.id,
        doc: d,
        tender: t,
        project: p,
        title: d.name,
        code: t.code,
        spec: d.spec,
        status: d.status,
        audience: d.audience,
        owner: d.ownerId ? U(d.ownerId) : null,
        metaText: "",
        snippet: "",
        lineagePath: [p.code, t.code, d.name],
        pId: p.id,
        tId: t.id,
        docId: d.id
      });
    }
  });

  const pIdsWithMatches = new Set([
    ...matchedProjects.map(m => m.pId),
    ...matchedTenders.map(m => m.pId),
    ...matchedDocs.map(m => m.pId)
  ]);
  const tIdsWithMatches = new Set([
    ...matchedTenders.map(m => m.tId),
    ...matchedDocs.map(m => m.tId)
  ]);
  const docIdsWithMatches = new Set(matchedDocs.map(m => m.docId));

  const totalCount = matchedProjects.length + matchedTenders.length + matchedDocs.length;
  return {
    query: cleanQ,
    projects: matchedProjects,
    tenders: matchedTenders,
    docs: matchedDocs,
    totalCount: totalCount,
    pIdsWithMatches: pIdsWithMatches,
    tIdsWithMatches: tIdsWithMatches,
    docIdsWithMatches: docIdsWithMatches
  };
}

function renderGsSearchDropdown(q, searchRes){
  if(!q || !searchRes || searchRes.totalCount === 0) return "";
  const activeTab = GS_STATE.searchDdTab || "all";

  const tabs = [
    { id: "all", label: "All Results", count: searchRes.totalCount }
  ];
  if(searchRes.projects.length) tabs.push({ id: "project", label: "Projects", count: searchRes.projects.length });
  if(searchRes.tenders.length) tabs.push({ id: "tender", label: "Tenders", count: searchRes.tenders.length });
  if(searchRes.docs.length) tabs.push({ id: "doc", label: "Documents", count: searchRes.docs.length });

  let h = '<div class="gs-search-dropdown" id="gsSearchDropdown" role="listbox">';

  // Header with counts & tabs
  h += '  <div class="gs-search-dd-header">';
  h += '    <div class="gs-search-dd-head-top">';
  h += '      <span class="gs-search-dd-count-label"><b>'+searchRes.totalCount+'</b> results found</span>';
  h += '    </div>';
  h += '    <div class="gs-search-dd-tabs">';
  tabs.forEach(t => {
    const isAct = activeTab === t.id;
    h += '<button type="button" class="gs-search-dd-tab'+(isAct?' active':'')+'" data-act="gsSetSearchDdTab" data-tab="'+t.id+'">';
    h += esc(t.label) + ' <span class="gs-search-dd-badge">'+t.count+'</span>';
    h += '</button>';
  });
  h += '    </div>';
  h += '  </div>';

  // List of results
  h += '  <div class="gs-search-dd-list">';

  const renderDdItem = (item) => {
    let row = '<div class="gs-search-dd-item" data-act="gsGoLineage" data-pid="'+esc(item.pId)+'" data-tid="'+esc(item.tId)+'" data-docid="'+esc(item.docId)+'" role="option" tabindex="0">';
    row += '  <div class="gs-search-dd-row">';
    row += '    <div class="gs-search-dd-name-col">';
    if(item.code && item.type !== 'doc'){
      row += '      <span class="proj-badge" style="font-size:10.5px;padding:1.5px 5.5px">'+highlightMatch(item.code, q)+'</span>';
    }
    row += '      <span class="gs-search-dd-title">'+highlightMatch(item.title, q)+'</span>';
    row += '    </div>';
    row += '    <div class="gs-search-dd-status-col">';
    if(item.status){
      row += badge(item.status);
    }
    row += '    </div>';
    row += '  </div>';
    row += '</div>';
    return row;
  };

  if(activeTab === "all"){
    if(searchRes.projects.length){
      h += '<div class="gs-search-dd-section-title">Projects ('+searchRes.projects.length+')</div>';
      searchRes.projects.forEach(p => { h += renderDdItem(p); });
    }
    if(searchRes.tenders.length){
      h += '<div class="gs-search-dd-section-title">Tenders ('+searchRes.tenders.length+')</div>';
      searchRes.tenders.forEach(t => { h += renderDdItem(t); });
    }
    if(searchRes.docs.length){
      h += '<div class="gs-search-dd-section-title">Documents ('+searchRes.docs.length+')</div>';
      searchRes.docs.forEach(d => { h += renderDdItem(d); });
    }
  } else if(activeTab === "project"){
    searchRes.projects.forEach(p => { h += renderDdItem(p); });
  } else if(activeTab === "tender"){
    searchRes.tenders.forEach(t => { h += renderDdItem(t); });
  } else if(activeTab === "doc"){
    searchRes.docs.forEach(d => { h += renderDdItem(d); });
  }

  h += '  </div>';
  h += '</div>';
  return h;
}

function renderGsDropdownSearch(cfg){
  const fullTitle = cfg.selected && cfg.selectedTitle ? cfg.selectedTitle : ('Search or select ' + cfg.label);
  let h = '<div class="gs-dd-wrap'+(cfg.isLast?' is-last':'')+'" data-dd="'+cfg.dd+'">';
  h += '<div role="combobox" tabindex="0" class="gs-dd-trigger" data-act="gsToggleDropdown" aria-expanded="false" aria-haspopup="listbox" title="'+esc(fullTitle)+'">';
  h += '  <div class="gs-dd-content">';
  if(cfg.selected && cfg.selectedHtml){
    h += cfg.selectedHtml;
  } else {
    h += '  <span class="gs-dd-placeholder">'+esc(cfg.placeholder)+'</span>';
  }
  h += '  </div>';
  h += '  <div class="gs-dd-actions">';
  if(cfg.selected){
    h += '  <span class="gs-dd-clear-btn" role="button" tabindex="0" data-act="gsClearDdLevel" data-dd="'+cfg.dd+'" title="Clear selection" aria-label="Clear selection">&times;</span>';
  }
  h += '    <svg class="gs-dd-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  h += '  </div>';
  h += '</div>';

  h += '<div class="gs-dd-menu" role="listbox">';
  h += '  <div class="gs-dd-search-header">';
  h += '    <div class="gs-dd-search-wrap">';
  h += '      <svg class="gs-dd-search-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  h += '      <input type="text" class="gs-dd-search-input" placeholder="'+esc(cfg.searchPlaceholder)+'" data-inp="gsDdFilter" data-dd="'+cfg.dd+'" autocomplete="off" spellcheck="false">';
  h += '      <button type="button" class="gs-dd-search-clear" data-act="gsDdClearInput" style="display:none" title="Clear search">&times;</button>';
  h += '    </div>';
  h += '  </div>';

  h += '  <div class="gs-dd-list">';
  cfg.options.forEach(opt => {
    const isAct = !!opt.isSelected;
    h += '  <div class="gs-dd-item'+(opt.isAll?' is-all':'')+(isAct?' is-selected':'')+'" data-act="gsPickOption" data-dd="'+cfg.dd+'" data-val="'+esc(opt.val)+'" data-search="'+esc(opt.searchTxt || (opt.title + " " + (opt.code||"")))+'" role="option" aria-selected="'+isAct+'">';
    h += '    <div class="gs-dd-item-left">';
    if(opt.code){
      h += '    <span class="gs-dd-code-badge">'+esc(opt.code)+'</span>';
    } else if(opt.tagHtml){
      h += opt.tagHtml;
    }
    h += '      <div class="gs-dd-item-info">';
    h += '        <div class="gs-dd-item-title">'+esc(opt.title)+'</div>';
    h += '      </div>';
    h += '    </div>';
    if(opt.notif){
      h += '    <span class="gs-dd-notif" title="'+opt.notif+' action'+(opt.notif===1?'':'s')+' needed">'+opt.notif+'</span>';
    }
    if(isAct){
      h += '    <span class="gs-dd-item-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';
    }
    h += '  </div>';
  });
  h += '    <div class="gs-dd-empty" style="display:none">No matching results found</div>';
  h += '  </div>';

  h += '</div>';
  h += '</div>';
  return h;
}

route("search", (arg0, arg1, arg2) => {
  let pId = arg0 || "";
  let tId = arg1 || "";
  let docId = arg2 || "";

  if(docId){
    const d = D(docId);
    if(d){
      tId = d.tenderId;
      const t = T(tId);
      if(t) pId = t.projectId;
    }
  } else if(tId){
    const t = T(tId);
    if(t) pId = t.projectId;
  }

  const curUser = me();
  const isProjLead = isProjectLeadUser(curUser);

  // Lineage-restricted project list: all for Project Lead, only assigned for others
  const allProjects = isProjLead ? S.projects : S.projects.filter(p => userRelatesToProject(curUser, p));

  // If currently requested pId is not related to user, reset lineage
  if(pId && !allProjects.some(p => p.id === pId)){
    pId = "";
    tId = "";
    docId = "";
    if(location.hash.startsWith("#/search/")) history.replaceState(null, "", "#/search");
  }

  let availableTenders = [];
  if(pId){
    availableTenders = S.tenders.filter(t => t.projectId === pId);
  } else {
    const allowedPIds = new Set(allProjects.map(p => p.id));
    availableTenders = S.tenders.filter(t => allowedPIds.has(t.projectId));
  }
  if(!isProjLead){
    availableTenders = availableTenders.filter(t => userRelatesToTender(curUser, t));
  }
  if(tId && !availableTenders.some(t => t.id === tId)){
    tId = "";
    docId = "";
    if(pId && location.hash.startsWith("#/search/")) history.replaceState(null, "", "#/search/" + pId);
  }
  const finalTenders = availableTenders.slice();

  let availableDocs = [];
  if(tId){
    availableDocs = S.docs.filter(d => d.tenderId === tId && d.status !== DS.NR);
  } else if(pId){
    const allowedTIds = new Set(finalTenders.map(t => t.id));
    availableDocs = S.docs.filter(d => allowedTIds.has(d.tenderId) && d.status !== DS.NR);
  } else {
    const allowedTIds = new Set(finalTenders.map(t => t.id));
    availableDocs = S.docs.filter(d => allowedTIds.has(d.tenderId) && d.status !== DS.NR);
  }
  if(!isProjLead){
    availableDocs = availableDocs.filter(d => canSeeDoc(curUser, d));
  }
  if(docId && !availableDocs.some(d => d.id === docId)){
    docId = "";
    if(pId && tId && location.hash.startsWith("#/search/")) history.replaceState(null, "", "#/search/" + pId + "/" + tId);
  }

  if(tId !== GS_STATE.tId){
    GS_STATE.tenderTab = "overview";
    GS_STATE.tenderDocSubtab = "all";
  }

  GS_STATE.pId = pId;
  GS_STATE.tId = tId;
  GS_STATE.docId = docId;

  const curLevel = docId ? "doc" : (tId ? "tender" : (pId ? "project" : "none"));
  const q = (GS_STATE.query || "").toLowerCase().trim();
  const searchRes = executeUniversalSearch(q, curUser);

  const curP = pId ? PR(pId) : null;
  const curT = tId ? T(tId) : null;
  const curDoc = docId ? D(docId) : null;
  const curPkg = (curT && pkgOf(curT)) || null;

  let h = '<div class="gs-wrap">';

  // Next-action notifications (red dots) for the current user
  const gsTargets = gsTaskTargets(curUser);
  const notifDot = lvl => {
    let ls = [];
    if(lvl === "project"){
      ls = gsTargets.filter(x => x.level === "project" && (!pId || x.pId === pId));
    } else if(lvl === "tender"){
      ls = gsTargets.filter(x => x.level === "tender" && (!pId || x.pId === pId) && (!tId || x.tId === tId));
    } else if(lvl === "doc"){
      ls = gsTargets.filter(x => x.level === "doc" && (!pId || x.pId === pId) && (!tId || x.tId === tId) && (!docId || x.docId === docId));
    }
    if(!ls.length) return '';
    const tips = [...new Set(ls.map(x => x.what))];
    const tip = 'Pending: ' + tips.slice(0, 4).join(' · ') + (tips.length > 4 ? ' · +' + (tips.length - 4) + ' more' : '');
    return '<span class="gs-red-notif-dot" title="'+esc(tip)+'" aria-label="'+esc(ls.length+' pending '+(ls.length===1?'task':'tasks'))+'">'+ls.length+'</span>';
  };

  const sortDdOptions = list => {
    list.sort((a, b) => {
      const notifDiff = (b.notif || 0) - (a.notif || 0);
      if(notifDiff !== 0) return notifDiff;
      if(q){
        const matchDiff = (b.matchTag ? 1 : 0) - (a.matchTag ? 1 : 0);
        if(matchDiff !== 0) return matchDiff;
      }
      return 0;
    });
  };

  // 3 Modular Searchable Dropdowns connected by arrows
  const mpOptions = [];
  allProjects.forEach(p => {
    const hasMatch = q && searchRes.pIdsWithMatches.has(p.id);
    mpOptions.push({
      val: p.id,
      isSelected: p.id === pId,
      code: p.code,
      title: p.name,
      matchTag: hasMatch ? "Match" : null,
      notif: gsTargets.filter(x => x.pId === p.id).length,
      searchTxt: [p.code, p.name, uname(p.leadId)].join(" ")
    });
  });
  sortDdOptions(mpOptions);
  const mpSelectedHtml = curP ? (
    '<span class="gs-dd-selected-val">' +
      '<span class="gs-dd-code-badge">' + esc(curP.code) + '</span>' +
      '<span class="gs-dd-title-text" title="' + esc(curP.name) + '">' + esc(curP.name) + '</span>' +
    '</span>'
  ) : '';

  const tOptions = [];
  finalTenders.forEach(t => {
    const p = projOf(t);
    const hasMatch = q && searchRes.tIdsWithMatches.has(t.id);
    tOptions.push({
      val: t.id,
      isSelected: t.id === tId,
      code: t.code,
      title: t.title,
      matchTag: hasMatch ? "Match" : null,
      notif: gsTargets.filter(x => x.tId === t.id).length,
      searchTxt: [t.code, t.title, t.route, t.scope, (p?p.code:""), (p?p.name:""), (t.icId?uname(t.icId):"")].join(" ")
    });
  });
  sortDdOptions(tOptions);
  const tSelectedHtml = curT ? (
    '<span class="gs-dd-selected-val">' +
      '<span class="gs-dd-code-badge">' + esc(curT.code) + '</span>' +
      '<span class="gs-dd-title-text" title="' + esc(curT.title) + '">' + esc(curT.title) + '</span>' +
    '</span>'
  ) : '';

  const shortDocStatus = (st) => {
    if(st === DS.PA || st === "Pending approval") return "Pending";
    if(st === DS.CR || st === "Changes requested") return "Changes";
    if(st === DS.NS || st === "Not started") return "Not started";
    return st;
  };

  const docOptions = [];
  availableDocs.forEach(d => {
    const t = T(d.tenderId);
    const hasMatch = q && searchRes.docIdsWithMatches.has(d.id);
    docOptions.push({
      val: d.id,
      isSelected: d.id === docId,
      tagHtml: '<span class="gs-dd-status-badge '+(d.status===DS.AP?"g":d.status===DS.CR?"a":d.status===DS.RT?"b":d.status===DS.PA?"w":"")+'" title="'+esc(d.status)+'">'+esc(shortDocStatus(d.status))+'</span>',
      title: d.name,
      matchTag: hasMatch ? "Match" : null,
      notif: gsTargets.filter(x => x.docId === d.id).length,
      searchTxt: [d.name, d.status, (t?t.code:""), (t?t.title:""), d.spec].join(" ")
    });
  });
  sortDdOptions(docOptions);
  const docSelectedHtml = curDoc ? (
    '<span class="gs-dd-selected-val">' +
      '<span class="gs-dd-status-badge '+(curDoc.status===DS.AP?"g":curDoc.status===DS.CR?"a":curDoc.status===DS.RT?"b":curDoc.status===DS.PA?"w":"")+'">' + esc(shortDocStatus(curDoc.status)) + '</span>' +
      '<span class="gs-dd-title-text" title="' + esc(curDoc.name) + '">' + esc(curDoc.name) + '</span>' +
    '</span>'
  ) : '';

  const mpBadgeCount = q ? searchRes.pIdsWithMatches.size : allProjects.length;
  const tBadgeCount = q ? (pId ? finalTenders.filter(t => searchRes.tIdsWithMatches.has(t.id)).length : searchRes.tIdsWithMatches.size) : finalTenders.length;
  const docBadgeCount = q ? (tId ? availableDocs.filter(d => searchRes.docIdsWithMatches.has(d.id)).length : searchRes.docIdsWithMatches.size) : availableDocs.length;

  h += '<div class="gs-pipeline-panel">';
  h += '  <div class="gs-pipeline-header">';
  h += '    <div class="gs-pipeline-search-wrap'+(GS_STATE.query ? ' has-q' : '')+'">';
  h += '      <svg class="gs-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  h += '      <input type="text" id="gsMainQuery" class="gs-pipeline-search-inp" placeholder="Search" value="'+esc(GS_STATE.query)+'" data-inp="gsSearchInp" autocomplete="off" spellcheck="false">';
  if(GS_STATE.query){
    h += '      <button type="button" class="gs-clear-q" data-act="gsClearQuery" title="Clear search">&times;</button>';
  }
  if(q && GS_STATE.searchDropdownOpen !== false && searchRes && searchRes.totalCount > 0){
    h += renderGsSearchDropdown(q, searchRes);
  }
  h += '    </div>';
  h += '    <div class="gs-phase-sel-wrap">';
  h += '      <select class="gs-phase-select" data-chg="gsPhaseChange" aria-label="Workflow phase">';
  const phases = [
    { val: "Funding Paper", label: "Funding Paper" },
    { val: "Tender Preparation", label: "Tender Preparation (" + allProjects.length + ")" },
    { val: "Tender Evaluation", label: "Tender Evaluation" },
    { val: "Tender Award", label: "Tender Award" }
  ];
  phases.forEach(ph => {
    const isSel = (GS_STATE.phase || "Tender Preparation") === ph.val;
    h += '        <option value="'+esc(ph.val)+'"'+(isSel ? ' selected' : '')+'>'+esc(ph.label)+'</option>';
  });
  h += '      </select>';
  h += '      <svg class="gs-phase-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  h += '    </div>';
  h += '    <button type="button" class="gs-reset-btn" data-act="gsClearAll" title="Reset all selections and search">';
  h += '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  h += '        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>';
  h += '        <polyline points="3 3 3 8 8 8"></polyline>';
  h += '      </svg>';
  h += '      <span>reset</span>';
  h += '    </button>';
  h += '  </div>';
  h += '  <div class="gs-pipeline">';
  // Module 1: Project
  h += '  <div class="gs-mod-card'+(pId?' has-val':'')+(curLevel==="project"?' active-target':'')+'">';
  h += notifDot("project");
  h += '    <div class="gs-mod-top">';
  h += '      <span class="gs-mod-label">Project</span>';
  h += '      <span class="gs-mod-badge-num'+(pId?' is-selected':'')+'">'+(pId?'Selected':mpBadgeCount.toLocaleString()+' results')+'</span>';
  h += '    </div>';
  h += renderGsDropdownSearch({
    dd: "mp",
    label: "Project",
    placeholder: "Select Project",
    searchPlaceholder: "Search Projects...",
    selected: !!pId,
    selectedHtml: mpSelectedHtml,
    selectedTitle: curP ? (curP.code + " " + curP.name) : "",
    options: mpOptions
  });
  h += '  </div>';

  // Arrow 1
  h += '  <div class="gs-arrow-col"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>';

  // Module 2: Tender
  h += '  <div class="gs-mod-card'+(tId?' has-val':'')+(curLevel==="tender"?' active-target':'')+'">';
  h += notifDot("tender");
  h += '    <div class="gs-mod-top">';
  h += '      <span class="gs-mod-label">Tender</span>';
  h += '      <span class="gs-mod-badge-num'+(tId?' is-selected':'')+'">'+(tId?'Selected':tBadgeCount.toLocaleString()+' results')+'</span>';
  h += '    </div>';
  h += renderGsDropdownSearch({
    dd: "t",
    label: "Tender",
    placeholder: "Select Tender",
    searchPlaceholder: "Search Tenders...",
    selected: !!tId,
    selectedHtml: tSelectedHtml,
    selectedTitle: curT ? (curT.code + " " + curT.title) : "",
    options: tOptions
  });
  h += '  </div>';

  // Arrow 2
  h += '  <div class="gs-arrow-col"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></div>';

  // Module 3: Document
  h += '  <div class="gs-mod-card'+(docId?' has-val':'')+(curLevel==="doc"?' active-target':'')+'">';
  h += notifDot("doc");
  h += '    <div class="gs-mod-top">';
  h += '      <span class="gs-mod-label">Document</span>';
  h += '      <span class="gs-mod-badge-num'+(docId?' is-selected':'')+'">'+(docId?'Selected':docBadgeCount.toLocaleString()+' results')+'</span>';
  h += '    </div>';
  h += renderGsDropdownSearch({
    dd: "doc",
    label: "Document",
    placeholder: "Select Document",
    searchPlaceholder: "Search Documents...",
    isLast: true,
    selected: !!docId,
    selectedHtml: docSelectedHtml,
    selectedTitle: curDoc ? curDoc.name : "",
    options: docOptions
  });
  h += '  </div>';
  h += '  </div>';
  h += '</div>';

  // Breadcrumbs & Back bar
  let crumbInner = '<a href="#/search">Home</a>';
  if(curP){
    crumbInner += ' <span class="crumb-sep">/</span> '+(curT||curDoc?'<a href="#/search/'+curP.id+'">'+esc(curP.code+' '+curP.name)+'</a>':'<span class="crumb-curr">'+esc(curP.code+' '+curP.name)+'</span>');
  }
  if(curT){
    crumbInner += ' <span class="crumb-sep">/</span> '+(curDoc?'<a href="#/search/'+curP.id+'/'+curT.id+'">'+esc(curT.code)+'</a>':'<span class="crumb-curr">'+esc(curT.code+' '+curT.title)+'</span>');
  }
  if(curDoc){
    crumbInner += ' <span class="crumb-sep">/</span> <span class="crumb-curr">'+esc(curDoc.name)+'</span>';
  }

  h += '<div class="gs-nav-bar">';
  h += '  <div class="crumbs-bar" style="margin:0">';
  h += '    <button type="button" class="btn-back" data-act="gsBack" title="Step back in lineage">';
  h += '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
  h += '      Back';
  h += '    </button>';
  h += '    <p class="crumbs">'+crumbInner+'</p>';
  h += '  </div>';
  h += '</div>';

  // Dynamic Details View
  h += '<div class="gs-detail-section">';
  if(curLevel === "none"){
    const filteredProjects = q ? allProjects.filter(p => searchRes.pIdsWithMatches.has(p.id)) : allProjects;
    h += renderGsDirectoryHome(filteredProjects, allProjects);
  } else {
    if(curLevel === "project" && curP){
      h += renderGsProjectDetails(curP);
    } else if(curLevel === "tender" && curT){
      h += renderGsTenderDetails(curT, curP);
    } else if(curLevel === "doc" && curDoc){
      h += renderGsDocDetails(curDoc, curT, curP);
    }
  }
  h += '</div>';

  h += '</div>';
  return h;
});

function renderGsProjectDetails(p, q, searchRes){
  const u = me();
  const isProjLead = isProjectLeadUser(u);
  if(!isProjLead && !userRelatesToProject(u, p)){
    return '<div class="panel muted" style="padding:28px 20px;text-align:center"><h3 style="margin:0 0 6px">Access Restricted</h3><p style="margin:0;font-size:13.5px">You are not assigned to this project and cannot view its details.</p></div>';
  }
  const canManage = isPL(u, p) || isAdmin(u) || canCreateProject(u);
  let ts = tendersOf(p);
  if(!isProjLead){
    ts = ts.filter(t => userRelatesToTender(u, t));
  }
  if(q && searchRes){
    const matchingTs = ts.filter(t => searchRes.tIdsWithMatches.has(t.id));
    if(matchingTs.length > 0){
      ts = matchingTs;
    }
  }

  const rows = ts.map(t => {
    const childDocsCount = q && searchRes ? searchRes.docs.filter(x=>x.tId===t.id).length : 0;
    return '<tr>'+
      '<td><b><a href="#/search/'+p.id+'/'+t.id+'" data-act="gsQuickSelect" data-type="t" data-id="'+t.id+'" style="text-decoration:none;color:inherit">'+(q ? highlightMatch(t.code, q) : esc(t.code))+'</a></b><br><span class="small muted">'+(q ? highlightMatch(t.title, q) : esc(t.title))+'</span>'+(childDocsCount>0?'<br><span class="gs-dd-match-tag">'+childDocsCount+' doc match'+(childDocsCount===1?'':'es')+'</span>':'')+'</td>'+
      '<td>'+(t.icId?uname(t.icId):'<span class="muted">Not assigned</span>')+'</td>'+
      '<td class="nowrap">'+badge(tStatus(t))+'</td>'+
      '<td class="nowrap small">'+updTxtTender(t)+'</td>'+
      '<td class="c"><a class="circle-btn" href="#/search/'+p.id+'/'+t.id+'" data-act="gsQuickSelect" data-type="t" data-id="'+t.id+'" title="Open '+esc(t.code)+' '+esc(t.title)+'" aria-label="Open '+esc(t.code)+' '+esc(t.title)+'"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></a></td>'+
    '</tr>';
  }).join("");
  const emptyRow = '<tr><td colspan="5" class="muted">'+(q ? 'No tenders matching “'+esc(q)+'” in this project.' : (isPL(u, p) ? 'No tenders created yet in <b>'+esc(p.name)+'</b>. Use <b>+ New tender</b> to create one.' : 'The project lead hasn\'t created any tenders yet.'))+'</td></tr>';

  return '<div class="head"><div><h1>'+(q ? highlightMatch(p.code+" "+p.name, q) : esc(p.code+" "+p.name))+'</h1>'+
    '<div class="row">'+badge(projectPrepStatus(p))+'</div></div>'+
    (canManage ? '<div class="acts"><button type="button" class="btn ghost" data-act="delProject" data-id="'+p.id+'">Delete</button><button type="button" class="btn sec" data-act="editProject" data-id="'+p.id+'">Edit details</button></div>' : '')+
  '</div>'+
  '<div class="panel">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px">'+
      '<h3 style="margin:0">Project details</h3>'+
      '<button type="button" class="btn sec sm" data-act="viewProjChanges" data-id="'+p.id+'" style="display:inline-flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>View Changes</button>'+
    '</div>'+
    '<dl class="kv kv2">'+
    '<dt>Code</dt><dd>'+esc(p.code)+'</dd>'+
    '<dt>Project lead</dt><dd>'+uname(p.leadId)+'</dd>'+
    '<dt>Target completion</dt><dd>'+fmtD(p.end)+'</dd>'+
    '<dt>Tenders</dt><dd>'+ts.length+'</dd>'+
    '<dt>Funding paper</dt><dd>'+(p.funding?esc(p.funding):'<span class="muted">Not linked</span>')+'</dd>'+
    '<dt>Last updated</dt><dd>'+(p.updatedAt?fmtDT(p.updatedAt)+(p.updatedBy?' <span class="muted small">by '+uname(p.updatedBy)+'</span>':''):'<span class="muted">–</span>')+'</dd>'+
  '</dl>'+
  '<div class="kv-desc"><div class="kv-desc-label">Description</div><p>'+(p.desc?(q ? highlightMatch(p.desc, q) : esc(p.desc)):'<span class="muted">None</span>')+'</p></div>'+
  '</div>'+
  '<div class="head" style="margin:30px 0 12px"><h2 class="sec" style="margin:0">Tenders</h2>'+
    (isPL(u, p) ? '<div class="acts"><button type="button" class="btn" data-act="newTender" data-id="'+p.id+'"'+dA(has("createTenders:"+p.id))+'>+ New tender'+dSR(has("createTenders:"+p.id))+'</button></div>' : '')+
  '</div>'+
  '<div class="scroll"><table class="t"><thead><tr><th>Tender</th><th>IC</th><th>Status</th><th>Last updated</th><th></th></tr></thead><tbody>'+
    (rows || emptyRow)+
  '</tbody></table></div>';
}

function renderGsTenderDetails(t, p, q, searchRes){
  const u = me();
  const isProjLead = isProjectLeadUser(u);
  if(!isProjLead && !userRelatesToTender(u, t)){
    return '<div class="panel muted" style="padding:28px 20px;text-align:center"><h3 style="margin:0 0 6px">Access Restricted</h3><p style="margin:0;font-size:13.5px">You are not assigned to this tender and cannot view its details.</p></div>';
  }
  if(!p) p = projOf(t);
  let curTab = GS_STATE.tenderTab || "overview";
  if(curTab === "activity") curTab = "overview";
  const gsTabs = pkgOf(t) ? TABS.concat([["package", "Package"]]) : TABS;
  const tabsNav = '<nav class="tabs" aria-label="Tender sections">' +
    gsTabs.map(([k, l]) => {
      const n = tabNeeds(t, k);
      return '<a href="#/tender/'+t.id+'/'+k+'" data-act="gsTenderTab" data-tab="'+k+'"'+(k === curTab ? ' aria-current="page"' : '')+dA(n)+'>'+l+dSR(n)+'</a>';
    }).join("") +
    '</nav>';

  const acts = isPL(me(), p) ?
    '<div class="acts"><button type="button" class="btn ghost" data-act="delTender" data-id="'+t.id+'">Delete</button><button type="button" class="btn sec" data-act="editTender" data-id="'+t.id+'">Edit details</button></div>' : '';

  const head = '<div class="head"><div><h1>'+(q ? highlightMatch(t.code+" "+t.title, q) : esc(t.code+" "+t.title))+'</h1><div class="row">'+badge(tStatus(t))+'</div></div>'+acts+'</div>';

  const bodyMap = {
    overview: tOverview,
    team: tTeam,
    documents: tDocs,
    metrics: tMetrics,
    activity: tActivity,
    package: (tt) => pkgPanel(tt)
  };
  const bodyFn = bodyMap[curTab] || tOverview;

  let extraMatchesHtml = '';
  if(q && searchRes){
    const docsInTender = (searchRes.docs || []).filter(d => d.tId === t.id);
    if(docsInTender.length > 0 && curTab === "overview"){
      extraMatchesHtml += '<div class="head" style="margin:28px 0 10px"><h3 style="margin:0">Matching Documents in this Tender ('+docsInTender.length+')</h3></div>';
      extraMatchesHtml += '<div class="gs-res-list">';
      docsInTender.forEach(docItem => {
        extraMatchesHtml += '<div class="gs-res-card" data-act="gsGoLineage" data-pid="'+esc(docItem.pId)+'" data-tid="'+esc(docItem.tId)+'" data-docid="'+esc(docItem.docId)+'" role="button" tabindex="0">';
        extraMatchesHtml += '  <div class="gs-res-card-top">';
        extraMatchesHtml += '    <span class="gs-res-type-badge doc">Document</span>';
        extraMatchesHtml += '    <span class="small muted">'+(docItem.owner ? esc(docItem.owner.name) : 'Unassigned')+'</span>';
        extraMatchesHtml += '  </div>';
        extraMatchesHtml += '  <div class="gs-res-title-row">';
        extraMatchesHtml += '    <div class="gs-res-title">'+highlightMatch(docItem.title, q)+'</div>';
        extraMatchesHtml += badge(docItem.status);
        extraMatchesHtml += '  </div>';
        if(docItem.snippet){
          extraMatchesHtml += '  <div class="gs-res-snippet">'+docItem.snippet+'</div>';
        }
        extraMatchesHtml += '  <div class="gs-res-foot">';
        extraMatchesHtml += '    <span class="small muted">'+esc(docItem.metaText)+'</span>';
        extraMatchesHtml += '    <span class="gs-res-open-link">Open Document →</span>';
        extraMatchesHtml += '  </div>';
        extraMatchesHtml += '</div>';
      });
      extraMatchesHtml += '</div>';
    }
  }

  return head + tabsNav + bodyFn(t, GS_STATE.tenderDocSubtab || "all") + extraMatchesHtml;
}

/* Revision remarks, listed in the document details while the owner revises */
function docRemarkRows(d){const ap=d.approvals.slice().reverse().find(a=>a.decision==="Returned");
  return (d.remarks&&[DS.RT,DS.DR,DS.IR].includes(d.status)?'<dt>Returned by</dt><dd>'+(ap?uname(ap.approverId):"Approver")+'</dd><dt>Remarks</dt><dd>'+esc(d.remarks)+'</dd>':'')+
    (d.contractsFlag&&[DS.CR,DS.DR,DS.IR,DS.PA].includes(d.status)?'<dt>Contracts team</dt><dd>'+esc(d.contractsFlag)+'</dd>':'');}
function renderGsDocDetails(d, t, p){
  const u = me();
  const isProjLead = isProjectLeadUser(u);
  if(!isProjLead && !canSeeDoc(u, d)){
    return '<div class="panel muted" style="padding:28px 20px;text-align:center"><h3 style="margin:0 0 6px">Access Restricted</h3><p style="margin:0;font-size:13.5px">You do not have access to view this document.</p></div>';
  }
  if(!t) t = T(d.tenderId);
  if(!p && t) p = projOf(t);

  const owner = d.ownerId === u.id;
  // Library documents are reference files, not WIP: read-only, no comments or activity
  const isLib = isLibUpload(d);
  const edit = !isLib && canEditDoc(u, d);
  const cm = !isLib && canComment(u, d);
  if(!d.versions || !d.versions.length){
    d.versions = [{no:1, html:d.html, at:d.createdAt||Date.now(), by:d.ownerId||S.me, note:"Initial draft"}];
  }
  const last = d.versions[d.versions.length-1];

  const body = edit ? (
    '<div class="doc">' +
      '<div class="doc-tools" role="toolbar" aria-label="Formatting">' +
        '<button type="button" data-act="fmt" data-c="formatBlock" data-v="h3">Heading</button>' +
        '<button type="button" data-act="fmt" data-c="formatBlock" data-v="p">Paragraph</button>' +
        '<button type="button" data-act="fmt" data-c="bold"><b>B</b></button>' +
        '<button type="button" data-act="fmt" data-c="italic"><i>I</i></button>' +
        '<button type="button" data-act="fmt" data-c="insertOrderedList">Numbered</button>' +
        '<button type="button" data-act="fmt" data-c="insertUnorderedList">Bullets</button>' +
        '<span style="width:1px;height:16px;background:var(--rule);margin:0 4px;display:inline-block;vertical-align:middle"></span>' +
        '<button type="button" class="btn-ai-write" data-act="aiWriteAssist" data-id="'+d.id+'" title="AI to help with writing document">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:-1px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path></svg>Write with AI' +
        '</button>' +
        '<div style="margin-left:auto;display:inline-flex;align-items:center;gap:10px">' +
          '<span class="saved" id="savedState">All changes saved</span>' +
          '<button type="button" class="btn-save" id="btnSaveDoc" data-act="saveDocContent" data-id="'+d.id+'" title="Save document changes (Cmd+S / Ctrl+S)" disabled>' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="doc-body" id="editor" contenteditable="true" spellcheck="true" aria-label="Document content">' + d.html + '</div>' +
    '</div>'
  ) : (
    '<div class="doc">' +
      '<div class="doc-tools">' +
        '<span class="saved" style="margin-left:0">Read-only</span>' +
      '</div>' +
      '<div class="doc-body" id="reader">' + d.html + '</div>' +
    '</div>'
  );

  const cms = d.comments.slice().sort((a,b) => (a.resolved - b.resolved) || (b.at - a.at));
  const cmHtml = cms.map(c =>
    '<div class="cmt'+(c.resolved ? " resolved" : "")+'">' +
      '<div class="by">'+uname(c.by)+'<span class="at">'+rel(c.at)+'</span>'+(c.contracts ? ' <span class="tag">Contracts review</span>' : '')+(c.resolved ? ' <span class="tag">Resolved</span>' : '')+'</div>' +
      '<p>'+esc(c.text)+'</p>' +
      c.replies.map(r => '<div class="rep"><div class="by">'+uname(r.by)+'<span class="at">'+rel(r.at)+'</span></div><p>'+esc(r.text)+'</p></div>').join('') +
      (!c.resolved && (cm || owner) ?
        '<div class="row" style="margin-top:6px">' +
          '<button class="link small" data-act="reply" data-id="'+d.id+'" data-c="'+c.id+'">Reply</button>' +
          (owner ? '<button class="link small" data-act="resolve" data-id="'+d.id+'" data-c="'+c.id+'">Resolve</button>' : '') +
        '</div>' : '') +
    '</div>'
  ).join('');

  const curVerNo = last.no;
  const versHtml = d.versions.slice().reverse().map(v => {
    const isCur = v.no === curVerNo;
    const canRestore = edit && !isCur && !DOC_LOCKED.includes(d.status);
    return '<li style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--rule)">' +
      '<div><div style="font-weight:600;font-size:13px">Version '+v.no+(isCur ? ' <span class="badge g" style="font-size:11px;padding:0 5px;margin-left:4px">Current</span>' : '')+'</div>' +
      '<div class="small muted">'+fmtDT(v.at)+' by '+uname(v.by)+(v.note ? ' &middot; '+esc(v.note) : '')+'</div></div>' +
      (canRestore ? '<button type="button" class="btn sec sm" data-act="restoreDocVer" data-id="'+d.id+'" data-v="'+v.no+'" style="padding:2px 8px;font-size:12px" title="Restore this version">Restore</button>' : '') +
    '</li>';
  }).join('');

  afterRender.push(() => bindEditor(d));

  const head = '<div class="head"><div>' +
    '<h1>'+esc(d.name)+'</h1>' +
  '</div>' +
  '<div class="acts">' + docActs(d) + '</div>' +
  '</div>';

  return head +
    '<div class="grid2">' +
      '<div>' + body + '</div>' +
      '<div>' +
        '<div class="panel"><h3>Document details</h3>' +
          '<dl class="kv">' +
            '<dt>Tender</dt><dd>'+esc((t?t.code+" "+t.title:"–"))+'</dd>' +
            '<dt>Spec type</dt><dd>'+esc(d.spec)+'</dd>' + docRemarkRows(d) +
            (d.fileName ? '<dt>Attached file</dt><dd><b>'+esc(d.fileName)+'</b> <span class="muted small">('+(d.fileSize||'142 KB')+')</span></dd>' : '') +
            '<dt>Owner</dt><dd>'+(d.ownerId ? uname(d.ownerId) : "Unassigned")+'</dd>' +
            (isLib ? '' : '<dt>Due date</dt><dd>'+fmtD(d.due)+'</dd><dt>Status</dt><dd>'+badge(d.status)+'</dd>') +
            '<dt>Created</dt><dd>'+(d.createdAt ? fmtD(d.createdAt) : '–')+'</dd>' +
            '<dt>Last updated</dt><dd>'+(lastUpd(d).at ? fmtDT(lastUpd(d).at)+(lastUpd(d).by ? ' by '+uname(lastUpd(d).by) : '') : '–')+'</dd>' +
          '</dl>' +
        '</div>' +
        '<div class="panel">' +
          '<div class="row" style="justify-content:space-between"><h3 style="margin:0">Version history</h3><span class="muted small">'+d.versions.length+(d.versions.length===1?' version':' versions')+'</span></div>' +
          '<ul style="list-style:none;padding:0;margin:8px 0 0">' + (versHtml || '<li class="small muted">Version 1</li>') + '</ul>' +
        '</div>' +
        (isLib ? '' :
        '<div class="panel">' +
          '<div class="row" style="justify-content:space-between"><h3 style="margin:0">Comments'+adot(has("comments:"+d.id))+''+(d.comments.some(c=>!c.resolved)?' <span class="muted small">'+d.comments.filter(c=>!c.resolved).length+' open</span>':'')+'</h3>' +
            (cm ? '<button class="btn sec sm" data-act="addComment" data-id="'+d.id+'">Add comment</button>' : '') +
          '</div>' +
          (cmHtml || '<p class="muted small" style="margin-top:10px">No comments yet.</p>') +
        '</div>' +
        '<div class="panel"><h3>Activity</h3>' + feed(docActivity(d)) + '</div>') +
      '</div>' +
    '</div>';
}

function renderGsDirectoryHome(matchingProjects, allProjects){
  const u = me();
  const isProjLead = isProjectLeadUser(u);
  const firstDot = has("firstProject");
  const createBtn = isProjLead ? '<div class="acts"><button type="button" class="btn sm" data-act="newProject"'+dA(firstDot)+'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-1px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Create Project'+dSR(firstDot)+'</button></div>' : '';
  if(!allProjects || allProjects.length === 0){
    return '<div class="head" style="margin:4px 0 12px;align-items:center">'+
      '<div><h2 class="sec" style="margin:0">Projects</h2></div>'+
      createBtn+
    '</div>'+
    '<div class="panel muted" style="margin-top:14px;padding:32px 20px;text-align:center"><h3 style="margin:0">No Assigned Projects</h3></div>';
  }
  if(!matchingProjects || matchingProjects.length === 0){
    return '<div class="head" style="margin:4px 0 12px;align-items:center">'+
      '<div><h2 class="sec" style="margin:0">Projects</h2></div>'+
      createBtn+
    '</div>'+
    '<div class="panel muted" style="margin-top:14px;padding:32px 20px;text-align:center"><h3 style="margin:0">No results found</h3></div>';
  }
  return '<div class="head" style="margin:4px 0 12px;align-items:center">'+
    '<div><h2 class="sec" style="margin:0">Projects</h2></div>'+
    createBtn+
  '</div>'+
  '<div class="gs-proj-grid">'+
    matchingProjects.map(p=>{
      const pl = U(p.leadId);
      const pct = projectPct(p);
      return '<div class="gs-proj-card" data-act="gsQuickSelect" data-type="p" data-id="'+p.id+'" role="button" tabindex="0" aria-label="Select '+esc(p.name)+'">'+
        '<div>'+
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="proj-badge">'+esc(p.code)+'</span></div>'+
          '<h3 class="gs-proj-name" title="'+esc(p.name)+'">'+esc(p.name)+'</h3>'+
        '</div>'+
        '<div class="gs-proj-prog">'+
          '<div class="gs-proj-prog-bar" role="progressbar" aria-label="'+esc(p.name)+' progress" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+pct+'%"></i></div>'+
          '<span class="gs-proj-prog-pct">'+pct+'%</span>'+
          projectInsight(p)+
        '</div>'+
        '<div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2);margin-top:auto">'+
          '<div class="avatar-sm" style="width:20px;height:20px;font-size:9.5px">'+esc(pl.name.slice(0,2).toUpperCase())+'</div>'+
          '<span style="font-weight:600">'+esc(pl.name)+'</span>'+
        '</div>'+
      '</div>';
    }).join('')+
  '</div>';
}

function closeAllDd(){
  document.querySelectorAll(".gs-dd-wrap.open").forEach(w => {
    w.classList.remove("open");
    const card = w.closest(".gs-mod-card");
    if(card) card.classList.remove("has-open-dd");
    const tr = w.querySelector(".gs-dd-trigger");
    if(tr) tr.setAttribute("aria-expanded", "false");
  });
}

document.addEventListener("click", e => {
  if(!e.target.closest(".gs-dd-wrap")){
    closeAllDd();
  }
  if(!e.target.closest(".gs-pipeline-search-wrap")){
    if(GS_STATE.searchDropdownOpen){
      GS_STATE.searchDropdownOpen = false;
      const dd = document.getElementById("gsSearchDropdown");
      if(dd) dd.remove();
    }
  } else if(e.target && e.target.id === "gsMainQuery"){
    if(GS_STATE.query && !GS_STATE.searchDropdownOpen){
      GS_STATE.searchDropdownOpen = true;
      render(true);
      const inp = document.getElementById("gsMainQuery");
      if(inp){
        inp.focus();
        inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
    }
  }
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    closeAllDd();
    if(GS_STATE.searchDropdownOpen){
      GS_STATE.searchDropdownOpen = false;
      const dd = document.getElementById("gsSearchDropdown");
      if(dd) dd.remove();
      return;
    }
    return;
  }
  if(e.target && e.target.id === "gsMainQuery" && e.key === "Enter"){
    const dd = document.getElementById("gsSearchDropdown");
    if(dd){
      const firstItem = dd.querySelector(".gs-search-dd-item");
      if(firstItem){
        e.preventDefault();
        ACT.gsGoLineage(firstItem, e);
        return;
      }
    }
  }
  const trigger = e.target.closest(".gs-dd-trigger");
  if(trigger && (e.key === "Enter" || e.key === " ") && !e.target.closest(".gs-dd-clear-btn")){
    e.preventDefault();
    ACT.gsToggleDropdown(trigger, e);
    return;
  }
  const inp = e.target.closest(".gs-dd-search-input");
  if(inp && e.key === "Enter"){
    e.preventDefault();
    const menu = inp.closest(".gs-dd-menu");
    if(!menu) return;
    const items = Array.from(menu.querySelectorAll(".gs-dd-item")).filter(it => it.style.display !== "none");
    const nonAll = items.find(it => !it.classList.contains("is-all"));
    const target = nonAll || items[0];
    if(target && target.dataset.act && ACT[target.dataset.act]){
      ACT[target.dataset.act](target, e);
    }
  }
});

window.addEventListener("hashchange", closeAllDd);
window.addEventListener("resize", closeAllDd);

ACT.gsToggleDropdown = (el, e) => {
  if(e) e.stopPropagation();
  const wrap = el.closest(".gs-dd-wrap");
  if(!wrap) return;
  const isOpen = wrap.classList.contains("open");
  closeAllDd();
  if(!isOpen){
    wrap.classList.add("open");
    const card = wrap.closest(".gs-mod-card");
    if(card) card.classList.add("has-open-dd");
    el.setAttribute("aria-expanded", "true");
    const inp = wrap.querySelector(".gs-dd-search-input");
    if(inp){
      inp.value = "";
      const items = wrap.querySelectorAll(".gs-dd-item");
      items.forEach(it => it.style.display = "");
      const empty = wrap.querySelector(".gs-dd-empty");
      if(empty) empty.style.display = "none";
      const clearBtn = wrap.querySelector(".gs-dd-search-clear");
      if(clearBtn) clearBtn.style.display = "none";
      setTimeout(() => { inp.focus(); }, 35);
    }
  }
};

ACT.gsClearDdLevel = (el, e) => {
  if(e) e.stopPropagation();
  const dd = el.dataset.dd;
  closeAllDd();
  GS_STATE.tenderTab = "overview";
  GS_STATE.tenderDocSubtab = "all";
  if(dd === "mp"){
    GS_STATE.pId = "";
    GS_STATE.tId = "";
    GS_STATE.docId = "";
    go("#/search");
  } else if(dd === "t"){
    GS_STATE.tId = "";
    GS_STATE.docId = "";
    go(GS_STATE.pId ? "#/search/" + GS_STATE.pId : "#/search");
  } else if(dd === "doc"){
    GS_STATE.docId = "";
    go("#/search/" + GS_STATE.pId + "/" + GS_STATE.tId);
  }
};

ACT.gsPickOption = (el, e) => {
  if(e) e.stopPropagation();
  const dd = el.dataset.dd;
  const val = el.dataset.val || "";
  closeAllDd();
  GS_STATE.tenderTab = "overview";
  GS_STATE.tenderDocSubtab = "all";
  if(dd === "mp"){
    GS_STATE.pId = val;
    GS_STATE.tId = "";
    GS_STATE.docId = "";
    go(val ? "#/search/" + val : "#/search");
  } else if(dd === "t"){
    if(!val){
      GS_STATE.tId = "";
      GS_STATE.docId = "";
      go(GS_STATE.pId ? "#/search/" + GS_STATE.pId : "#/search");
    } else {
      const t = T(val);
      if(t){
        const p = projOf(t);
        GS_STATE.pId = p ? p.id : "";
        GS_STATE.tId = val;
        GS_STATE.docId = "";
        go("#/search/" + (p ? p.id : "") + "/" + val);
      }
    }
  } else if(dd === "doc"){
    if(!val){
      GS_STATE.docId = "";
      go("#/search/" + GS_STATE.pId + "/" + GS_STATE.tId);
    } else {
      const d = D(val);
      if(d){
        const t = T(d.tenderId), p = t ? projOf(t) : null;
        GS_STATE.pId = p ? p.id : "";
        GS_STATE.tId = t ? t.id : "";
        GS_STATE.docId = val;
        go("#/search/" + (p ? p.id : "") + "/" + (t ? t.id : "") + "/" + val);
      }
    }
  }
};

ACT.gsDdFilter = (el) => {
  const q = (el.value || "").toLowerCase().trim();
  const menu = el.closest(".gs-dd-menu");
  if(!menu) return;
  const items = menu.querySelectorAll(".gs-dd-item");
  let visibleCount = 0;
  items.forEach(it => {
    const txt = (it.dataset.search || it.textContent).toLowerCase();
    const match = !q || txt.includes(q);
    it.style.display = match ? "" : "none";
    if(match) visibleCount++;
  });
  const empty = menu.querySelector(".gs-dd-empty");
  if(empty){
    empty.style.display = (visibleCount === 0) ? "block" : "none";
  }
  const clearBtn = menu.querySelector(".gs-dd-search-clear");
  if(clearBtn){
    clearBtn.style.display = q ? "inline-flex" : "none";
  }
};

ACT.gsDdClearInput = (el, e) => {
  if(e) e.stopPropagation();
  const header = el.closest(".gs-dd-search-header");
  if(!header) return;
  const inp = header.querySelector(".gs-dd-search-input");
  if(inp){
    inp.value = "";
    inp.focus();
    ACT.gsDdFilter(inp);
  }
};

ACT.gsTenderTab = (el, e) => {
  if(e) e.preventDefault();
  GS_STATE.tenderTab = el.dataset.tab;
  rerender();
};

ACT.gsTenderDocSubtab = (el, e) => {
  if(e) e.preventDefault();
  GS_STATE.tenderDocSubtab = el.dataset.subtab;
  rerender();
};

ACT.gsBack = () => {
  closeAllDd();
  GS_STATE.tenderTab = "overview";
  GS_STATE.tenderDocSubtab = "all";
  if(GS_STATE.docId){
    GS_STATE.docId = "";
    go("#/search/" + GS_STATE.pId + "/" + GS_STATE.tId);
  } else if(GS_STATE.tId){
    GS_STATE.tId = "";
    go("#/search/" + GS_STATE.pId);
  } else if(GS_STATE.pId){
    GS_STATE.pId = "";
    go("#/search");
  } else {
    go(currentOrigin().hash || "#/dashboard");
  }
};

ACT.gsClearAll = () => {
  resetSearchState();
  if(location.hash === "#/search") render();
  else go("#/search");
  toast("Search reset");
};

ACT.gsPhaseChange = el => {
  GS_STATE.phase = el.value;
  toast("Switched phase: " + el.value);
};

ACT.gsSearchInp = el => {
  GS_STATE.query = el.value;
  GS_STATE.searchDropdownOpen = !!el.value.trim();
  render(true);
  const inp = document.getElementById("gsMainQuery");
  if(inp){
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
  }
};

ACT.gsClearQuery = () => {
  GS_STATE.query = "";
  GS_STATE.searchDropdownOpen = false;
  render(true);
};

ACT.gsSetSearchDdTab = (el, e) => {
  if(e){
    e.preventDefault();
    e.stopPropagation();
  }
  GS_STATE.searchDdTab = el.dataset.tab || "all";
  render(true);
  const inp = document.getElementById("gsMainQuery");
  if(inp){
    inp.focus();
    inp.selectionStart = inp.selectionEnd = inp.value.length;
  }
};

ACT.gsGoLineage = (el, e) => {
  if(e) e.preventDefault();
  const pid = el.dataset.pid || "";
  const tid = el.dataset.tid || "";
  const docid = el.dataset.docid || "";
  GS_STATE.pId = pid;
  GS_STATE.tId = tid;
  GS_STATE.docId = docid;
  GS_STATE.searchDropdownOpen = false;
  closeAllDd();
  if(docid){
    go("#/search/" + pid + "/" + tid + "/" + docid);
  } else if(tid){
    go("#/search/" + pid + "/" + tid);
  } else if(pid){
    go("#/search/" + pid);
  } else {
    go("#/search");
  }
};

ACT.gsQuickSelect = el => {
  const type = el.dataset.type, id = el.dataset.id;
  if(type === "p"){
    go("#/search/" + id);
  } else if(type === "t"){
    GS_STATE.tenderTab = "overview";
    GS_STATE.tenderDocSubtab = "all";
    const t = T(id), p = projOf(t);
    go("#/search/" + (p ? p.id : "") + "/" + id);
  } else if(type === "d"){
    const d = D(id), t = T(d.tenderId), p = t ? projOf(t) : null;
    go("#/search/" + (p ? p.id : "") + "/" + (t ? t.id : "") + "/" + id);
  }
};
