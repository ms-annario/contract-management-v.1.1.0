/* Table sorting and pagination */
/* Global Table Sorting Engine (Ascending / Descending) */
const TABLE_SORTS = new Map();
let isSortingTable = false;

function parseDateVal(str) {
  if (!str) return null;
  const ddmmyyyy = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const hours = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
    const minutes = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0;
    return new Date(year, month, day, hours, minutes).getTime();
  }
  const yyyymmdd = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyymmdd) {
    return new Date(parseInt(yyyymmdd[1], 10), parseInt(yyyymmdd[2], 10) - 1, parseInt(yyyymmdd[3], 10)).getTime();
  }
  return null;
}

function getCellSortValue(cell) {
  if (!cell) return "";
  const select = cell.querySelector("select");
  if (select) {
    return (select.options[select.selectedIndex]?.text || "").trim();
  }
  const dateInput = cell.querySelector('input[type="date"]');
  if (dateInput && dateInput.value) {
    return dateInput.value.trim();
  }
  const textInput = cell.querySelector('input[type="text"]');
  if (textInput && textInput.value) {
    return textInput.value.trim();
  }
  return (cell.innerText || cell.textContent || "").replace(/\s+/g, " ").trim();
}

function compareSortValues(valA, valB, dir) {
  const isAEmpty = !valA || valA === "–" || valA === "—" || valA === "-";
  const isBEmpty = !valB || valB === "–" || valB === "—" || valB === "-";
  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  // 1. Date comparison
  const dateA = parseDateVal(valA);
  const dateB = parseDateVal(valB);
  if (dateA !== null && dateB !== null) {
    return dir === "asc" ? dateA - dateB : dateB - dateA;
  }

  // 2. Fractions (e.g. "3/5 approved", "1/8: ...")
  const fracRegex = /^(\d+)\/(\d+)/;
  const fA = valA.match(fracRegex);
  const fB = valB.match(fracRegex);
  if (fA && fB) {
    const fracValA = parseFloat(fA[1]) / parseFloat(fA[2]);
    const fracValB = parseFloat(fB[1]) / parseFloat(fB[2]);
    if (fracValA !== fracValB) {
      return dir === "asc" ? fracValA - fracValB : fracValB - fracValA;
    }
  }

  // 3. Numbers / Currency / Percentages
  const cleanA = valA.replace(/[$€£,\s]/g, "");
  const cleanB = valB.replace(/[$€£,\s]/g, "");
  const numRegex = /^[-+]?\d+(?:\.\d+)?%?$/;
  if (numRegex.test(cleanA) && numRegex.test(cleanB)) {
    const numA = parseFloat(cleanA);
    const numB = parseFloat(cleanB);
    if (numA !== numB) {
      return dir === "asc" ? numA - numB : numB - numA;
    }
  }

  // 4. Natural alphanumeric string comparison
  const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

function getTableKey(table) {
  if (table.id) return table.id;
  const viewParent = table.closest("[id]");
  if (viewParent && viewParent.id) {
    const tables = Array.from(viewParent.querySelectorAll("table.t"));
    return viewParent.id + "_" + tables.indexOf(table);
  }
  const r = (typeof parse === "function") ? parse() : { name: "page" };
  const allTables = Array.from(document.querySelectorAll("table.t"));
  return (r.name || "page") + "_" + allTables.indexOf(table);
}

function sortTable(table, th, dir, saveState = true) {
  if (isSortingTable) return;
  const tbody = table.querySelector(":scope > tbody");
  if (!tbody) return;

  const trHead = th.parentElement;
  const ths = Array.from(trHead.children);
  const colIndex = ths.indexOf(th);
  if (colIndex === -1) return;

  isSortingTable = true;
  try {
    ths.forEach(otherTh => {
      otherTh.removeAttribute("data-sort-dir");
      otherTh.classList.remove("sort-asc", "sort-desc");
      otherTh.removeAttribute("aria-sort");
      if (otherTh.classList.contains("sortable")) {
        otherTh.setAttribute("title", "Click to sort");
      }
    });

    th.setAttribute("data-sort-dir", dir);
    th.classList.remove("sort-asc", "sort-desc");
    th.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");
    th.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
    th.setAttribute("title", dir === "asc" ? "Sorted ascending (click to sort descending)" : "Sorted descending (click to sort ascending)");

    const key = getTableKey(table);
    if (saveState && key) {
      TABLE_SORTS.set(key, { colText: th.textContent.trim(), dir });
    }
    table.dataset.sortedKey = key + ":" + th.textContent.trim() + ":" + dir;

    const rows = Array.from(tbody.children);
    if (rows.length <= 1) {
      if (rows.length === 0 || rows[0].querySelector("td[colspan]")) return;
    }

    const groups = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.classList.contains("mp-progress-row") && groups.length > 0) {
        groups[groups.length - 1].children.push(row);
      } else {
        groups.push({ primary: row, children: [], origIndex: i });
      }
    }

    groups.sort((gA, gB) => {
      const cellA = gA.primary.children[colIndex];
      const cellB = gB.primary.children[colIndex];
      const valA = getCellSortValue(cellA);
      const valB = getCellSortValue(cellB);
      const res = compareSortValues(valA, valB, dir);
      if (res === 0) return gA.origIndex - gB.origIndex;
      return res;
    });

    groups.forEach(g => {
      tbody.appendChild(g.primary);
      g.children.forEach(c => tbody.appendChild(c));
    });
  } finally {
    isSortingTable = false;
  }
}

function initSortableHeaders() {
  if (isSortingTable) return;
  document.querySelectorAll("table.t").forEach(table => {
    const theadThs = table.querySelectorAll(":scope > thead > tr > th");
    theadThs.forEach(th => {
      const text = th.textContent.trim();
      if (text && !th.classList.contains("no-sort") && !th.querySelector('input[type="checkbox"]')) {
        th.classList.add("sortable");
        if (!th.hasAttribute("title")) {
          th.setAttribute("title", "Click to sort");
        }
      } else {
        th.classList.remove("sortable");
      }
    });

    // Re-apply preserved sort state if present and not already applied
    const key = getTableKey(table);
    const saved = TABLE_SORTS.get(key);
    if (saved) {
      const expectedKey = key + ":" + saved.colText + ":" + saved.dir;
      if (table.dataset.sortedKey !== expectedKey) {
        const matchingTh = Array.from(theadThs).find(th => th.textContent.trim() === saved.colText);
        if (matchingTh) {
          sortTable(table, matchingTh, saved.dir, false);
        }
      }
    }
  });
}

document.addEventListener("click", function(e) {
  const th = e.target.closest("table.t thead th");
  if (!th) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
  const text = th.textContent.trim();
  if (!text || th.classList.contains("no-sort") || th.querySelector('input[type="checkbox"]')) return;
  const table = th.closest("table.t");
  if (!table) return;

  const currentDir = th.getAttribute("data-sort-dir");
  const newDir = currentDir === "asc" ? "desc" : "asc";
  sortTable(table, th, newDir, true);
});

const sortObserver = new MutationObserver(() => {
  if (!isSortingTable) initSortableHeaders();
});
sortObserver.observe(document.body, { childList: true, subtree: true });

/* ---------- Pagination ----------
   Card grids, tables, task lists and activity feeds longer than PAGE_SIZE get a pager.
   Runs after every render, sort and search, so it works for every page without changes
   to the list markup. The page is remembered per address, and starts again from page 1
   when the number of items changes or a column is sorted. */
const PAGE_SIZE=10;
const PG_SEL=".gs-proj-grid,.gs-res-list,table.t,.list,ul.feed";
const PG_STATE=new Map(),PG_MODAL=new WeakMap();
let PG_SEQ=0,PG_BUSY=false;
function pgKey(box){
  const view=document.getElementById("view");
  if(!view||!view.contains(box))return null;
  return (location.hash||"#/search").split("?")[0]+"|"+[...view.querySelectorAll(PG_SEL)].indexOf(box);
}
const pgGet=box=>{const k=pgKey(box);return k?PG_STATE.get(k):PG_MODAL.get(box);};
const pgSet=(box,st)=>{const k=pgKey(box);if(k)PG_STATE.set(k,st);else PG_MODAL.set(box,st);};
/* Items to page through; a table row keeps its detail rows with it. Rows hidden by a search don't count. */
function pgGroups(box){
  if(box.matches("table.t")){
    const tb=box.querySelector(":scope > tbody");if(!tb)return [];
    const gs=[];[...tb.children].forEach(tr=>{if(tr.classList.contains("mp-progress-row")&&gs.length)gs[gs.length-1].push(tr);else gs.push([tr]);});
    return gs.filter(g=>!g[0].hidden);
  }
  const item=box.matches(".gs-proj-grid")?".gs-proj-card":box.matches(".gs-res-list")?".gs-res-card":"*";
  return [...box.children].filter(el=>!el.hidden&&el.matches(item)).map(el=>[el]);
}
function pgHtml(page,pages,from,to,n){
  const nums=[];for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)nums.push(i);else if(nums[nums.length-1]!=="gap")nums.push("gap");}
  const chev=d=>'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="'+d+'"></polyline></svg>';
  const btn=(go,label,aria,dis,cur)=>'<button type="button" class="pager-btn" data-pg-go="'+go+'" aria-label="'+aria+'"'+(dis?' disabled':'')+(cur?' aria-current="page"':'')+'>'+label+'</button>';
  return '<span class="pager-info">Showing <b>'+(from+1)+'–'+to+'</b> of <b>'+n+'</b></span><div class="pager-btns">'+
    btn("prev",chev("15 18 9 12 15 6"),"Previous page",page===1)+
    nums.map(x=>x==="gap"?'<span class="pager-gap" aria-hidden="true">…</span>':btn(x,x,"Page "+x,false,x===page)).join("")+
    btn("next",chev("9 18 15 12 9 6"),"Next page",page===pages)+'</div>';
}
function pgApply(box){
  const groups=pgGroups(box),n=groups.length;
  const wrap=box.parentElement,anchor=wrap&&wrap.classList.contains("scroll")&&wrap.children.length===1?wrap:box;
  let pager=anchor.nextElementSibling;
  if(pager&&!(pager.classList.contains("pager")&&pager.dataset.for===box.dataset.pgId))pager=null;
  if(n<=PAGE_SIZE){groups.forEach(g=>g.forEach(el=>el.classList.remove("pg-hide")));if(pager)pager.remove();return;}
  let st=pgGet(box);if(!st||st.n!==n)st={page:1,n};
  const pages=Math.ceil(n/PAGE_SIZE);st.page=Math.min(Math.max(1,st.page),pages);pgSet(box,st);
  const from=(st.page-1)*PAGE_SIZE,to=Math.min(from+PAGE_SIZE,n);
  groups.forEach((g,i)=>{const off=i<from||i>=to;g.forEach(el=>el.classList.toggle("pg-hide",off));});
  if(!box.dataset.pgId)box.dataset.pgId=String(++PG_SEQ);
  if(!pager){pager=document.createElement("nav");pager.className="pager";pager.setAttribute("aria-label","Pagination");pager.dataset.for=box.dataset.pgId;anchor.after(pager);}
  const sig=st.page+"/"+n;
  if(pager.dataset.sig!==sig){pager.dataset.sig=sig;pager.innerHTML=pgHtml(st.page,pages,from,to,n);}
}
/* Pick lists inside dialogs scroll instead; dropdown menus have their own search */
function paginateAll(){
  if(PG_BUSY)return;PG_BUSY=true;
  try{document.querySelectorAll(PG_SEL).forEach(box=>{if(box.closest(".gs-dd-wrap")||(box.matches("table.t")&&box.closest("dialog")))return;pgApply(box);});}
  finally{PG_BUSY=false;}
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pg-go]");if(!b||b.disabled)return;
  const pager=b.closest(".pager"),box=pager&&document.querySelector('[data-pg-id="'+pager.dataset.for+'"]'),st=box&&pgGet(box);if(!st)return;
  e.preventDefault();
  const go=b.dataset.pgGo;st.page=go==="prev"?st.page-1:go==="next"?st.page+1:+go;
  pgApply(box);
  const again=pager.querySelector('[data-pg-go="'+go+'"]:not([disabled])')||pager.querySelector('[aria-current="page"]');if(again)again.focus();
  /* Bring the top of the list back into view */
  const sc=box.closest("dialog .scroll");
  if(sc)sc.scrollTop=0;
  else{const hdr=(document.querySelector(".top")||{offsetHeight:0}).offsetHeight,top=box.getBoundingClientRect().top;if(top<hdr+8)window.scrollBy(0,top-hdr-16);}
});
/* Sorting a column starts again from page 1 (capture, so it runs before the sort) */
document.addEventListener("click",e=>{const th=e.target.closest("table.t thead th.sortable");if(!th)return;const st=pgGet(th.closest("table.t"));if(st)st.page=1;},true);
new MutationObserver(()=>paginateAll()).observe(document.body,{childList:true,subtree:true});
