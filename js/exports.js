/* Downloads: DOCX/PDF/ZIP export of documents and tender packages, AI success metrics */
const LIBS={docx:"https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js",pdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"};
const loaded={};
function loadLib(k){if(!loaded[k])loaded[k]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=LIBS[k];s.onload=res;s.onerror=()=>{delete loaded[k];rej(new Error("The "+(k==="pdf"?"PDF":"Word")+" library couldn't load. Check your connection and try again."));};document.head.appendChild(s);});return loaded[k];}
const capP={};
function cap(n){if(!(n in capP))capP[n]=(window.claude&&typeof window.claude.use==="function")?Promise.resolve(window.claude.use(n)).catch(()=>null):Promise.resolve(null);return capP[n];}
cap("downloads");cap("sample");

function blocks(html){const div=document.createElement("div");div.innerHTML=html;const out=[];
  const runs=el=>{const r=[];(function w(n,b,i){n.childNodes.forEach(c=>{if(c.nodeType===3){if(c.textContent)r.push({text:c.textContent,bold:b,italics:i});}else if(c.nodeType===1){if(c.tagName==="BR")r.push({text:" "});else w(c,b||/^(B|STRONG)$/.test(c.tagName),i||/^(I|EM)$/.test(c.tagName));}});})(el,false,false);return r;};
  div.childNodes.forEach(n=>{if(n.nodeType===3){if(n.textContent.trim())out.push({type:"p",runs:[{text:n.textContent}]});return;}if(n.nodeType!==1)return;const tg=n.tagName;
    if(tg==="H3")out.push({type:"h",runs:runs(n)});else if(tg==="H4")out.push({type:"h4",runs:runs(n)});
    else if(tg==="OL"||tg==="UL"){let k=0;[...n.children].filter(c=>c.tagName==="LI").forEach(li=>out.push({type:"li",ordered:tg==="OL",n:++k,runs:runs(li)}));}
    else out.push({type:"p",runs:runs(n)});});
  return out.filter(b=>b.runs.some(r=>r.text&&r.text.trim()));}

async function buildDocx(title,meta,secs){await loadLib("docx");const X=window.docx,P=o=>new X.Paragraph(o),tr=r=>new X.TextRun({text:r.text,bold:!!r.bold,italics:!!r.italics});
  const kids=[P({spacing:{before:2400},children:[new X.TextRun({text:meta.client,size:22,color:"5A6878"})]}),P({heading:X.HeadingLevel.TITLE,children:[new X.TextRun(title)]})];
  meta.lines.forEach(l=>kids.push(P({children:[new X.TextRun({text:l,size:22})]})));
  if(secs.length>1){kids.push(P({heading:X.HeadingLevel.HEADING_1,pageBreakBefore:true,children:[new X.TextRun("Contents")]}));secs.forEach((s,i)=>kids.push(P({children:[new X.TextRun((i+1)+". "+s.name)]})));}
  secs.forEach((s,i)=>{kids.push(P({heading:X.HeadingLevel.HEADING_1,pageBreakBefore:true,children:[new X.TextRun((secs.length>1?(i+1)+". ":"")+s.name)]}));
    if(s.sub)kids.push(P({spacing:{after:200},children:[new X.TextRun({text:s.sub,italics:true,color:"5A6878",size:18})]}));
    blocks(s.html).forEach(b=>{if(b.type==="h")kids.push(P({heading:X.HeadingLevel.HEADING_2,children:b.runs.map(tr)}));else if(b.type==="h4")kids.push(P({heading:X.HeadingLevel.HEADING_3,children:b.runs.map(tr)}));
      else if(b.type==="li")kids.push(b.ordered?P({indent:{left:720,hanging:360},spacing:{after:80},children:[new X.TextRun(b.n+".  "),...b.runs.map(tr)]}):P({bullet:{level:0},children:b.runs.map(tr)}));
      else kids.push(P({spacing:{after:140},children:b.runs.map(tr)}));});});
  const header=new X.Header({children:[P({alignment:X.AlignmentType.RIGHT,children:[new X.TextRun({text:meta.header,size:16,color:"5A6878"})]})]});
  const footer=new X.Footer({children:[P({alignment:X.AlignmentType.CENTER,children:[new X.TextRun({children:["Page ",X.PageNumber.CURRENT," of ",X.PageNumber.TOTAL_PAGES],size:16,color:"5A6878"})]})]});
  return X.Packer.toBlob(new X.Document({creator:"Tender workspace",title,styles:{default:{document:{run:{font:"Calibri",size:22}}}},sections:[{headers:{default:header},footers:{default:footer},children:kids}]}));}

async function buildPdf(title,meta,secs){await loadLib("pdf");const {jsPDF}=window.jspdf,doc=new jsPDF({unit:"mm",format:"a4"}),W=210,H=297,Mg=20,CW=W-2*Mg;let y=Mg+8;const marks=[];
  const ensure=h=>{if(y+h>H-Mg){doc.addPage();y=Mg+8;}};
  const write=(text,size,style,gap,color)=>{doc.setFont("helvetica",style||"normal");doc.setFontSize(size);doc.setTextColor(...(color||[23,34,48]));const lh=size*0.43;doc.splitTextToSize(text,CW).forEach(l=>{ensure(lh);doc.text(l,Mg,y);y+=lh;});y+=gap||0;};
  y=80;write(meta.client,11,"normal",4,[90,104,120]);write(title,24,"bold",6);meta.lines.forEach(l=>write(l,11,"normal",1.5));
  if(secs.length>1){doc.addPage();y=Mg+8;write("Contents",16,"bold",4);secs.forEach((s,i)=>write((i+1)+". "+s.name,11,"normal",1.5));}
  secs.forEach((s,i)=>{doc.addPage();y=Mg+8;const h=(secs.length>1?(i+1)+". ":"")+s.name;marks.push({t:h,p:doc.internal.getNumberOfPages()});write(h,17,"bold",2);if(s.sub)write(s.sub,9,"italic",5,[90,104,120]);
    blocks(s.html).forEach(b=>{const tx=b.runs.map(r=>r.text).join("").replace(/\s+/g," ").trim();if(b.type==="h"){y+=2;write(tx,12.5,"bold",1.5);}else if(b.type==="h4")write(tx,11,"bold",1);else if(b.type==="li")write((b.ordered?b.n+".  ":"\u2022  ")+tx,10.5,"normal",1.5);else write(tx,10.5,"normal",2.6);});});
  const n=doc.internal.getNumberOfPages();
  for(let p=1;p<=n;p++){doc.setPage(p);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(90,104,120);doc.text(meta.header,W-Mg,12,{align:"right"});doc.text("Page "+p+" of "+n,W/2,H-10,{align:"center"});}
  try{marks.forEach(m=>doc.outline.add(null,m.t,{pageNumber:m.p}));}catch(e){}
  return doc.output("blob");}

async function saveFile(name,blob){const dl=await cap("downloads");
  if(dl){try{await dl.save({filename:name,data:blob});toast("Saved "+name);}catch(e){toast(e&&e.code==="declined"?"Download cancelled":"Downloads aren't available here ("+(e&&e.code||"error")+")");}return;}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);toast("Downloaded "+name);}
const verHtml=(d,no)=>(d.versions[(no||d.versions.length)-1]||{html:d.html}).html;
const slug=s=>s.replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"");

function utf8Encode(str){
  if(typeof TextEncoder!=="undefined")return new TextEncoder().encode(str);
  const utf8=[];
  for(let i=0;i<str.length;i++){
    let c=str.charCodeAt(i);
    if(c<0x80)utf8.push(c);
    else if(c<0x800)utf8.push(0xc0|(c>>6),0x80|(c&0x3f));
    else if(c<0xd800||c>=0xe000)utf8.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f));
    else{i++;c=0x10000+(((c&0x3ff)<<10)|(str.charCodeAt(i)&0x3ff));utf8.push(0xf0|(c>>18),0x80|((c>>12)&0x3f),0x80|((c>>6)&0x3f),0x80|(c&0x3f));}
  }
  return new Uint8Array(utf8);
}
const CRC32_TABLE=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);CRC32_TABLE[i]=c>>>0;}
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=CRC32_TABLE[(c^bytes[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}

function createZipBlob(files){
  const d=new Date();
  const dosTime=((d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)))&0xFFFF;
  const dosDate=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  const localChunks=[];
  const cdChunks=[];
  let offset=0;

  files.forEach(f=>{
    const nameBytes=utf8Encode(f.name);
    const dataBytes=typeof f.data==="string"?utf8Encode(f.data):(f.data instanceof Uint8Array?f.data:new Uint8Array(f.data));
    const crc=crc32(dataBytes);
    const size=dataBytes.length;

    const lh=new Uint8Array(30+nameBytes.length);
    const lv=new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true);
    lv.setUint16(4,20,true);
    lv.setUint16(6,0x0800,true);
    lv.setUint16(8,0,true);
    lv.setUint16(10,dosTime,true);
    lv.setUint16(12,dosDate,true);
    lv.setUint32(14,crc,true);
    lv.setUint32(18,size,true);
    lv.setUint32(22,size,true);
    lv.setUint16(26,nameBytes.length,true);
    lv.setUint16(28,0,true);
    lh.set(nameBytes,30);
    localChunks.push(lh,dataBytes);

    const cd=new Uint8Array(46+nameBytes.length);
    const cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014b50,true);
    cv.setUint16(4,20,true);
    cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true);
    cv.setUint16(10,0,true);
    cv.setUint16(12,dosTime,true);
    cv.setUint16(14,dosDate,true);
    cv.setUint32(16,crc,true);
    cv.setUint32(20,size,true);
    cv.setUint32(24,size,true);
    cv.setUint16(28,nameBytes.length,true);
    cv.setUint16(30,0,true);
    cv.setUint16(32,0,true);
    cv.setUint16(34,0,true);
    cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);
    cv.setUint32(42,offset,true);
    cd.set(nameBytes,46);
    cdChunks.push(cd);
    offset+=lh.length+dataBytes.length;
  });

  const cdStart=offset;
  let cdSize=0;
  cdChunks.forEach(c=>cdSize+=c.length);

  const eocd=new Uint8Array(22);
  const ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);
  ev.setUint16(4,0,true);
  ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true);
  ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);
  ev.setUint32(16,cdStart,true);
  ev.setUint16(20,0,true);

  const totalLength=offset+cdSize+22;
  const out=new Uint8Array(totalLength);
  let p=0;
  localChunks.forEach(c=>{out.set(c,p);p+=c.length;});
  cdChunks.forEach(c=>{out.set(c,p);p+=c.length;});
  out.set(eocd,p);

  return new Blob([out],{type:"application/zip"});
}

function buildPackageZip(p,t){
  const items=p.items.map(it=>({it,d:D(it.docId)})).filter(x=>x.d);

  const files=[];
  const ms=S.metrics.filter(m=>m.tenderId===t.id);
  const proj=projOf(t);
  const icUser=U(t.icId);

  let transmittal="================================================================================\n"+
    "TENDER PACKAGE TRANSMITTAL & CONTENTS SUMMARY\n"+
    "================================================================================\n\n"+
    "Project:            "+(proj?proj.code+" "+proj.name:"N/A")+"\n"+
    "Tender Code:        "+t.code+"\n"+
    "Tender Title:       "+t.title+"\n"+
    "Package Version:    Version "+p.version+"\n"+
    "Package Status:     "+p.status+(p.tecApproved?" (TEC Approved)":"")+"\n"+
    "Generated Date:     "+new Date().toLocaleString()+"\n"+
    "Contract IC:        "+(icUser?icUser.name+" ("+icUser.email+")":"Unassigned")+"\n"+
    "Procurement Route:  "+(t.route||"Traditional")+"\n"+
    "Total Documents:    "+items.length+"\n\n"+
    "--------------------------------------------------------------------------------\n"+
    "TABLE OF INCLUDED DOCUMENTS\n"+
    "--------------------------------------------------------------------------------\n";

  items.forEach((x,i)=>{
    const appr=x.d.approvals.filter(a=>a.decision==="Approved").slice(-1)[0];
    const apprStr=appr?"Approved by "+(U(appr.approverId)?U(appr.approverId).name:appr.approverId)+" on "+fmtD(appr.at):"Pending";
    transmittal+=(i+1)+". "+x.d.name+"\n"+
      "   - Type/Spec: "+(x.d.spec||"Standard")+"\n"+
      "   - Version: v"+x.it.versionNo+"\n"+
      "   - Audience: "+(x.d.audience||"Tenderers")+"\n"+
      "   - Owner: "+(U(x.d.ownerId)?U(x.d.ownerId).name:"Unknown")+"\n"+
      "   - Status: "+apprStr+"\n";
    if(x.d.fileName)transmittal+="   - Attachment File: "+x.d.fileName+"\n";
    transmittal+="\n";
  });

  if(ms.length){
    transmittal+="--------------------------------------------------------------------------------\n"+
      "SUCCESS METRICS\n"+
      "--------------------------------------------------------------------------------\n";
    ms.forEach((m,i)=>{
      transmittal+=(i+1)+". "+m.metric+"\n"+
        "   - Target: "+m.target+"\n"+
        "   - Rationale: "+(m.rationale||"N/A")+"\n";
    });
    transmittal+="\n";
  }

  transmittal+="================================================================================\n"+
    "End of Transmittal\n"+
    "================================================================================\n";

  files.push({name:"00_Transmittal_"+slug(t.code)+"_v"+p.version+".txt",data:transmittal});

  items.forEach((x,i)=>{
    const num=String(i+1).padStart(2,"0");
    const d=x.d;
    const bodyHtml=verHtml(d,x.it.versionNo);
    const appr=d.approvals.filter(a=>a.decision==="Approved").slice(-1)[0];
    const apprStr=appr?"Approved by "+(U(appr.approverId)?U(appr.approverId).name:appr.approverId)+" on "+fmtD(appr.at):"";

    const docPage='<!DOCTYPE html>\n<html lang="en">\n<head>\n'+
      '<meta charset="utf-8">\n'+
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n'+
      '<title>'+esc(d.name)+' — '+esc(t.code)+'</title>\n'+
      '<style>\n'+
      '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.6; }\n'+
      '  .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }\n'+
      '  .badge { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #e0f2fe; color: #0284c7; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }\n'+
      '  h1 { font-size: 26px; margin: 10px 0 8px 0; color: #0f172a; }\n'+
      '  .meta { color: #64748b; font-size: 13px; display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }\n'+
      '  .content { font-size: 15px; margin-top: 20px; }\n'+
      '  h2, h3, h4 { color: #0f172a; margin-top: 24px; margin-bottom: 8px; }\n'+
      '  ol, ul { padding-left: 24px; }\n'+
      '  li { margin-bottom: 6px; }\n'+
      '  table { border-collapse: collapse; width: 100%; margin: 16px 0; }\n'+
      '  th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 14px; }\n'+
      '  th { background: #f8fafc; font-weight: 600; }\n'+
      '  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }\n'+
      '</style>\n</head>\n<body>\n'+
      '<div class="header">\n'+
      '  <span class="badge">'+esc(d.spec||"Document")+' &bull; v'+x.it.versionNo+'</span>\n'+
      '  <h1>'+esc(d.name)+'</h1>\n'+
      '  <div class="meta">\n'+
      '    <span><b>Contract:</b> '+esc(t.code+" "+t.title)+'</span>\n'+
      '    <span><b>Audience:</b> '+esc(d.audience||"Tenderers")+'</span>\n'+
      '    <span><b>Owner:</b> '+(U(d.ownerId)?esc(U(d.ownerId).name):"")+'</span>\n'+
      '    '+(apprStr?'<span><b>Status:</b> '+esc(apprStr)+'</span>':'')+'\n'+
      '  </div>\n'+
      '</div>\n'+
      '<div class="content">\n'+bodyHtml+'\n</div>\n'+
      '<div class="footer">Tender package v'+p.version+' &bull; '+esc(t.code)+' &bull; Harbourline Tender Management</div>\n'+
      '</body>\n</html>';

    files.push({name:"documents/"+num+"_"+slug(d.name)+"_v"+x.it.versionNo+".html",data:docPage});

    if(d.fileName){
      files.push({
        name:"attachments/"+num+"_"+d.fileName,
        data:"Attachment record for "+d.name+" ("+d.fileName+")\nUploaded: "+fmtD(d.updatedAt||d.createdAt)+"\nDocument: "+d.name+"\nContent: "+(d.html?d.html.replace(/<[^>]+>/g," ").trim():"File attachment")
      });
    }
  });

  const combinedHtml='<!DOCTYPE html>\n<html lang="en">\n<head>\n'+
    '<meta charset="utf-8">\n'+
    '<title>'+esc(t.code+" "+t.title)+' — Package v'+p.version+'</title>\n'+
    '<style>\n'+
    '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.6; }\n'+
    '  h1 { font-size: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }\n'+
    '  .doc-sec { margin-top: 40px; padding-top: 24px; border-top: 1px dashed #cbd5e1; page-break-before: always; }\n'+
    '  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #0284c7; font-size: 11px; font-weight: 600; }\n'+
    '  .meta { color: #64748b; font-size: 13px; margin-bottom: 12px; }\n'+
    '</style>\n</head>\n<body>\n'+
    '<h1>'+esc(t.code+" "+t.title)+' — Tender Package v'+p.version+'</h1>\n'+
    '<div class="meta">Generated: '+new Date().toLocaleString()+' &bull; Status: '+p.status+'</div>\n'+
    items.map((x,i)=>
      '<div class="doc-sec">\n'+
      '  <span class="badge">Document '+(i+1)+' &bull; v'+x.it.versionNo+'</span>\n'+
      '  <h2>'+esc(x.d.name)+'</h2>\n'+
      '  <div class="content">'+verHtml(x.d,x.it.versionNo)+'</div>\n'+
      '</div>'
    ).join("\n")+
    '\n</body>\n</html>';

  files.push({name:"Complete_Package_v"+p.version+".html",data:combinedHtml});
  return createZipBlob(files);
}

function openPackageDeliveryModal(p,t,initialFormat){
  const tdEmail=tenderDivisionEmail();
  const initFmt=initialFormat||"zip";
  const defSubj="["+t.code+"] "+t.title+" — Tender Package v"+p.version;
  const defNotes="Please find attached tender package v"+p.version+" for "+t.code+" "+t.title+" prepared for tender division review and issuance.";

  openModal({
    title:"Download or Send Package v"+p.version,
    wide:true,
    submit:"Download directly",
    body:
      '<div class="delivery-modal-wrap" style="display:flex;flex-direction:column;gap:18px;">'+
        '<div class="field" style="margin:0">'+
          '<label style="font-size:13px;font-weight:650;margin-bottom:6px;display:block">File format</label>'+
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">'+
            '<label class="opt-format" id="optFmtDocx" style="border:1.5px solid '+(initFmt==='docx'?'var(--marker-ink,#3b82f6)':'var(--rule)')+';background:'+(initFmt==='docx'?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)')+';border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;transition:all .15s ease;">'+
              '<div style="display:flex;align-items:center;gap:6px;">'+
                '<input type="radio" name="format" value="docx" '+(initFmt==='docx'?'checked':'')+' style="margin:0">'+
                '<b style="font-size:13px">Word (.docx)</b>'+
              '</div>'+
            '</label>'+
            '<label class="opt-format" id="optFmtPdf" style="border:1.5px solid '+(initFmt==='pdf'?'var(--marker-ink,#3b82f6)':'var(--rule)')+';background:'+(initFmt==='pdf'?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)')+';border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;transition:all .15s ease;">'+
              '<div style="display:flex;align-items:center;gap:6px;">'+
                '<input type="radio" name="format" value="pdf" '+(initFmt==='pdf'?'checked':'')+' style="margin:0">'+
                '<b style="font-size:13px">PDF (.pdf)</b>'+
              '</div>'+
            '</label>'+
            '<label class="opt-format" id="optFmtZip" style="border:1.5px solid '+(initFmt==='zip'?'var(--marker-ink,#3b82f6)':'var(--rule)')+';background:'+(initFmt==='zip'?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)')+';border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;transition:all .15s ease;">'+
              '<div style="display:flex;align-items:center;gap:6px;">'+
                '<input type="radio" name="format" value="zip" '+(initFmt==='zip'?'checked':'')+' style="margin:0">'+
                '<b style="font-size:13px">ZIP Archive (.zip)</b>'+
              '</div>'+
            '</label>'+
          '</div>'+
        '</div>'+
        '<div class="field" style="margin:0">'+
          '<label style="font-size:13px;font-weight:650;margin-bottom:6px;display:block">How would you like to receive the documents?</label>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
            '<label id="lblDelDownload" style="border:2px solid var(--marker-ink,#3b82f6);background:var(--marker-soft,rgba(59,130,246,0.08));border-radius:8px;padding:12px 14px;cursor:pointer;display:block;transition:all .15s ease;">'+
              '<div style="display:flex;align-items:center;gap:8px;">'+
                '<input type="radio" name="deliveryMethod" value="download" checked style="margin:0">'+
                '<b style="font-size:14px">Download directly</b>'+
              '</div>'+
            '</label>'+
            '<label id="lblDelEmail" style="border:1.5px solid var(--rule);background:var(--surface);border-radius:8px;padding:12px 14px;cursor:pointer;display:block;transition:all .15s ease;">'+
              '<div style="display:flex;align-items:center;gap:8px;">'+
                '<input type="radio" name="deliveryMethod" value="email" style="margin:0">'+
                '<b style="font-size:14px">Send via email</b>'+
              '</div>'+
            '</label>'+
          '</div>'+
        '</div>'+
      '</div>',
    onSubmit: async fd => {
      const method=fd.get("deliveryMethod")||"download";
      const f=fd.get("format")||"zip";
      const fmtShort={docx:"Word",pdf:"PDF",zip:"ZIP"}[f]||f.toUpperCase();

      const items=p.items.map(it=>({it,d:D(it.docId)})).filter(x=>x.d);

      const secs=items.map(({it,d})=>{
        const a=d.approvals.filter(x=>x.decision==="Approved").slice(-1)[0];
        return {
          name:d.name,
          html:verHtml(d,it.versionNo),
          sub:"Version "+it.versionNo+", "+(d.audience==="Internal"?"internal, not for tenderers":"for tenderers")+(a?", approved by "+U(a.approverId).name+" on "+fmtD(a.at):"")
        };
      });
      const ms=S.metrics.filter(m=>m.tenderId===t.id);
      if(ms.length)secs.push({name:"Success metrics",html:"<ol>"+ms.map(m=>"<li><b>"+esc(m.metric)+"</b>: "+esc(m.target)+"</li>").join("")+"</ol>",sub:"Accepted by the contract project IC"});

      const meta={
        client:projOf(t).client,
        header:t.code+" "+t.title+", package v"+p.version,
        lines:["Contract "+t.code,"Package version "+p.version,"Contract project IC: "+(U(t.icId)?U(t.icId).name:"Unassigned"),"Generated "+fmtD(Date.now())]
      };
      let blob;
      if(f==="zip"){
        blob=buildPackageZip(p,t);
      }else if(f==="pdf"){
        blob=await buildPdf(t.code+" "+t.title,meta,secs);
      }else{
        blob=await buildDocx(t.code+" "+t.title,meta,secs);
      }

      const outName=slug(t.code+"-package-v"+p.version)+"."+f;
      await saveFile(outName,blob);
      if(method==="email"){
        // Open the user's own email app, addressed to Tender Division; they attach the downloaded file
        const subj=defSubj+" ("+fmtShort+")";
        const body=defNotes+"\n\nAttachment: "+outName;
        const a=document.createElement("a");a.href="mailto:"+encodeURIComponent(tdEmail)+"?subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(body);a.click();
        log(t,"downloaded package v"+p.version+" as "+fmtShort+" and opened an email to Tender Division");
        toast("Email opened. Attach "+outName+" before sending");
      }else{
        log(t,"downloaded package v"+p.version+" as "+fmtShort+" directly");
      }
      save();
    }
  });

  const f=M.querySelector("form");
  const syncPkgUI=()=>{
    const method=f.querySelector('input[name="deliveryMethod"]:checked')?.value||'download';
    const fmt=f.querySelector('input[name="format"]:checked')?.value||'zip';
    const fmtShort={docx:"Word",pdf:"PDF",zip:"ZIP"}[fmt]||fmt.toUpperCase();

    ['docx','pdf','zip'].forEach(k=>{
      const card=f.querySelector('#optFmt'+k.charAt(0).toUpperCase()+k.slice(1));
      if(card){
        const active=fmt===k;
        card.style.borderColor=active?'var(--marker-ink,#3b82f6)':'var(--rule)';
        card.style.background=active?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)';
      }
    });

    const lblDl=f.querySelector('#lblDelDownload');
    const lblEm=f.querySelector('#lblDelEmail');
    if(lblDl&&lblEm){
      lblDl.style.borderColor=method==='download'?'var(--marker-ink,#3b82f6)':'var(--rule)';
      lblDl.style.background=method==='download'?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)';
      lblEm.style.borderColor=method==='email'?'var(--marker-ink,#3b82f6)':'var(--rule)';
      lblEm.style.background=method==='email'?'var(--marker-soft,rgba(59,130,246,0.08))':'var(--surface)';
    }

    const sBtn=M.querySelector('.mf button[value="ok"]');
    if(sBtn){
      if(method==='download'){
        sBtn.textContent='Download '+fmtShort;
      }else{
        sBtn.textContent='Download '+fmtShort+' & open email';
      }
    }
  };

  f.querySelectorAll('input[name="format"], input[name="deliveryMethod"]').forEach(inp=>{
    inp.addEventListener('change',syncPkgUI);
  });
  syncPkgUI();
}

ACT.exportPkg=el=>{
  const p=PK(el.dataset.id);
  if(!p)return;
  const t=T(p.tenderId);
  openPackageDeliveryModal(p,t,el.dataset.f||"zip");
};
const TEMPLATE_METRICS=[
 {metric:"Programme adherence on key dates",target:"95% of key dates met",rationale:"Tracks whether the contractor keeps the critical path on schedule."},
 {metric:"Cost growth from award to final account",target:"Under 8% of the tender sum",rationale:"Shows how well scope and risk were priced at tender."},
 {metric:"Lost-time injury frequency rate",target:"Below 0.2 per 100,000 hours",rationale:"A standard lagging safety measure for heavy civil works."},
 {metric:"Non-conformance reports closed within 14 days",target:"90% of reports",rationale:"Indicates how quickly quality problems are fixed."},
 {metric:"Community complaints per month",target:"Fewer than 5",rationale:"Captures the impact of works on neighbours and traffic."},
 {metric:"Open defects at substantial completion",target:"Fewer than 50 items",rationale:"Measures build quality at handover."}];
const ABORT={};
ACT.stopSuggest=el=>{const c=ABORT[el.dataset.id];if(c)c.abort();};
ACT.suggest=async el=>{const t=T(el.dataset.id),have=S.metrics.filter(m=>m.tenderId===t.id).map(m=>m.metric.toLowerCase());
  const fallback=msg=>{SUGG[t.id]={source:"Template suggestions",items:TEMPLATE_METRICS.filter(m=>!have.includes(m.metric.toLowerCase())).map(m=>({...m}))};rerender();if(msg)toast(msg);};
  if(!t.scope||t.scope.split(/\s+/).length<8){toast("Add a scope description of at least a sentence to get useful suggestions");return;}
  SUGG[t.id]={loading:true};rerender();
  const sample=await cap("sample");if(!sample){fallback("AI isn't available in this view, so these are template suggestions");return;}
  const ctl=new AbortController();ABORT[t.id]=ctl;
  const prompt="You are helping a contract project IC prepare a construction tender. Suggest 6 measurable success metrics for judging this contract after award.\n\nTender: "+t.code+" "+t.title+"\nProcurement route: "+(t.route||"not set")+"\nScope: "+t.scope+"\nAlready accepted (do not repeat): "+(have.join("; ")||"none")+
   "\n\nRespond with only a JSON array of 6 objects with keys: metric (under 8 words), target (specific and measurable, under 12 words), rationale (one sentence under 25 words).";
  try{const r=await sample.json(prompt,{signal:ctl.signal,modelTier:"quick"});
    const items=(Array.isArray(r)?r:[]).filter(x=>x&&typeof x.metric==="string"&&typeof x.target==="string").slice(0,8).map(x=>({metric:x.metric,target:x.target,rationale:String(x.rationale||"")}));
    if(!items.length)throw {code:"invalid_json"};SUGG[t.id]={source:"AI suggested",items};rerender();}
  catch(e){if(e&&e.code==="cancelled"){delete SUGG[t.id];rerender();return;}
    if(e&&e.code==="not_granted"){fallback("AI suggestions weren't allowed, so these are template suggestions");return;}
    SUGG[t.id]={error:e&&e.code==="rate_limited"?"Too many requests right now. Wait a minute and try again.":"Couldn't get suggestions this time. Try again, or add metrics manually."};rerender();}
  finally{delete ABORT[t.id];}};
