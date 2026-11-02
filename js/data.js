"use strict";
/* Constants, sample data (seed), storage, migrations, lookups, roles and permissions, tender stages */
const DAY=864e5, NOW=Date.now();
const ago=d=>NOW-d*DAY, ahead=d=>NOW+d*DAY;
const STORE="tender-workspace-proto-havedata-v1";
const STAGES=["Project & lead","Tender & IC","SME team","Assign documents","Drafting","Approval","Collate package","TEC approval","Contracts review","Send to Tender Division"];
const DEFAULT_DUR=[3,3,3,5,15,5,3,5,5,2];
const DS={NS:"Not started",DR:"Drafting",IR:"Published",PA:"Pending approval",RT:"Returned",AP:"Approved",CR:"Changes requested",FI:"Final",NR:"Not required"};
const isApproved=d=>[DS.AP,DS.FI].includes(d.status);
/* Files uploaded straight to the Document library are reference copies, not WIP: no edit, comments or activity.
   Tender documents keep all of that, even once approved. */
const isLibUpload=d=>!d.tenderId||(!!d.uploaded&&(d.approvals||[]).some(a=>/Recorded directly in library/.test(a.remarks||"")));
const PS={COL:"Collating",ICR:"In contracts review",CHG:"Changes requested",CLR:"Cleared for TEC",TEC:"Submitted to TEC",POST:"Post-TEC review",FIN:"Finalised",TD:"Sent to Tender Division"};
/* Package states after contracts approval, waiting to be sent to Tender Division */
const TD_READY=[PS.CLR,PS.TEC,PS.POST,PS.FIN];
const PLATFORM_ROLES=["System admin","Project lead","Contract project IC","SME","SME superior","Contracts team reviewer","TEC member"];
const ROLE_OF={"u-admin":"System admin","u-pl":"Project lead","u-spl":"Project lead","u-spl2":"Project lead","u-ic":"Contract project IC","u-sup":"SME superior",
 "u-sme1":"SME","u-sme2":"SME","u-sme3":"SME","u-sme4":"SME","u-rev":"SME","u-ctr":"Contracts team reviewer","u-tec":"TEC member","u-tec2":"TEC member","u-tec3":"TEC member","u-ext":"SME"};
const ROLES=[
 {label:"System admin",u:"u-admin"},{label:"Project lead",u:"u-pl"},
 {label:"Contract project IC",u:"u-ic"},{label:"SME",u:"u-sme1"},{label:"SME superior",u:"u-sup"},
 {label:"Contracts team reviewer",u:"u-ctr"}];

const SECTIONS={
 "Instructions to tenderers":[["Introduction","The Employer invites tenders for the works described in this tender package. Tenderers shall read these instructions together with the conditions of contract and specifications."],["Tender submission","Tenders shall be submitted through the Employer's e-tendering portal before the closing date. Late tenders will not be considered."],["Clarifications","Requests for clarification shall be made in writing no later than 10 working days before the tender closing date."]],
 "Tender instructions":[["Introduction","The Employer invites tenders for the works described in this tender package. Tenderers shall read these instructions together with the conditions of contract and specifications."],["Tender submission","Tenders shall be submitted through the Employer's e-tendering portal before the closing date. Late tenders will not be considered."],["Clarifications","Requests for clarification shall be made in writing no later than 10 working days before the tender closing date."]],
 "General conditions of contract":[["Definitions","Words and expressions shall have the meanings assigned to them in this clause unless the context requires otherwise."],["Contractor's general obligations","The Contractor shall design, where specified, execute and complete the Works in accordance with the Contract."],["Time for completion","The Contractor shall complete the whole of the Works within the time stated in the Appendix to Tender."]],
 "Special conditions of contract":[["Amendments to the general conditions","The general conditions are amended as set out in this document. Where there is conflict, these special conditions prevail."],["Liquidated damages","Liquidated damages for delay apply per day for each section as stated in the Appendix to Tender."],["Possession of site","Possession of each work area will be given in stages in line with the programme of key dates."]],
 "General specification":[["Scope","This general specification sets out workmanship and material standards applying to all civil engineering works under the Contract."],["Materials","All materials shall be new, of the kinds specified, and supplied with test certificates where required."],["Testing","Testing shall be carried out by an accredited laboratory approved by the Engineer."]],
 "Particular specification":[["Description of the works","The works comprise a 1.8 km elevated viaduct on bored piles, with associated drainage, utilities diversion and temporary traffic management."],["Particular requirements","Pile cap concrete shall be grade 45/20 with a minimum cover of 75 mm. Bearings shall be elastomeric with a design life of 50 years."],["Interfaces","The Contractor shall coordinate with the systems contractor for cable containment cast into the deck."]],
 "Bills of quantities":[["Preamble","Quantities are measured net in accordance with the standard method of measurement stated in the tender documents."],["Bill 1: Preliminaries","Site establishment, supervision, insurances and temporary works."],["Bill 2: Piling","Bored piles, permanent casings and pile testing."]],
 "Tender evaluation plan":[["Evaluation approach","Tenders will be assessed on a combined technical and price basis with a 40:60 weighting."],["Technical criteria","Methodology, programme, key personnel, safety performance and past experience on similar works."],["Price assessment","The lowest conforming tender price scores 100; other prices are scored pro rata."]],
 "Pre-tender estimate":[["Basis of estimate","The estimate is based on current market rates for elevated structures and includes a 7.5% contingency."],["Summary","Construction cost, preliminaries, contingency and price fluctuation allowance."]]
};
function sampleHtml(name,t){
  const s=SECTIONS[name]||[["Purpose","This document sets out the "+name.toLowerCase()+" for "+t.code+" "+t.title+"."],["Requirements","Requirements will be developed by the document owner and reviewed by the sub-project team."]];
  return s.map((x,i)=>"<h3>"+(i+1)+". "+x[0]+"</h3><p>"+x[1]+"</p>").join("")+"<ol><li>Read with the other documents in this package.</li><li>Report any discrepancy to the contract project IC.</li></ol>";
}

function seed(){
 const S={seq:500,me:"u-ic"};
 S.companies=[{id:"c1",name:"Harbourline Engineering",code:"HLE"},{id:"c2",name:"Meridian Consultants",code:"MER"}];
 S.teams=[
  {id:"t-pm",companyId:"c1",name:"Project management"},{id:"t-des",companyId:"c1",name:"Design"},{id:"t-con",companyId:"c1",name:"Contracts"},
  {id:"t-pro",companyId:"c1",name:"Procurement"},{id:"t-qs",companyId:"c1",name:"Quantity surveying"},{id:"t-cr",companyId:"c1",name:"Contracts review",cr:true},
  {id:"t-tec",companyId:"c1",name:"Tender evaluation"},{id:"t-td",companyId:"c1",name:"Tender division"},{id:"t-mdes",companyId:"c2",name:"Design"}];
 const u=(id,name,team,title,sup,sys,extra)=>Object.assign({id,name,email:name.toLowerCase().replace(/[^a-z]+/g,".")+"@harbourline.example",companyId:"c1",teamId:team,title,superiorId:sup||null,sys:sys||"user",creator:false,status:"Active"},extra||{});
 S.users=[
  u("u-admin","Aisha Rahman","t-pm","Platform administrator",null,"admin"),
  u("u-pl","Daniel Wong","t-pm","Project director",null,"user",{creator:true}),
  u("u-spl","Priya Nair","t-pm","Sub-project lead, civil works"),
  u("u-spl2","Leo Tan","t-pm","Sub-project lead, stations"),
  u("u-ic","Marcus Lee","t-pm","Contract project IC"),
  u("u-sup","Helen Ho","t-des","Technical director"),
  u("u-sme1","Sofia Chan","t-des","Senior design engineer","u-sup"),
  u("u-sme2","Kenji Ito","t-con","Contracts manager","u-sup"),
  u("u-sme3","Nadia Karim","t-pro","Procurement lead","u-sup"),
  u("u-sme4","Ben Okafor","t-qs","Quantity surveyor","u-sup"),
  u("u-rev","Ravi Patel","t-des","Geotechnical adviser","u-sup"),
  u("u-ctr","Omar Haddad","t-cr","Contracts review manager"),
  u("u-tec","Grace Lim","t-tec","TEC chair"),
  u("u-tec2","Wei Zhang","t-tec","TEC member"),
  u("u-tec3","Fatima Ali","t-tec","TEC member"),
  u("u-td","Oliver Smith","t-td","Tender division",null,"user"),
  Object.assign(u("u-ext","James Porter","t-mdes","Design consultant"),{companyId:"c2",email:"james.porter@meridian.example"})];
 const cat=(id,name,spec,aud,disc,req)=>({id,name,spec,audience:aud,discipline:disc,required:req});
 S.catalogue=[
  cat("k1","Invitation to tender","General","Tenderers","Contracts",true),cat("k2","Tender instructions","General","Tenderers","Contracts",true),
  cat("k3","Form of tender","General","Tenderers","Contracts",true),cat("k4","General conditions of contract","General","Tenderers","Contracts",true),
  cat("k5","Special conditions of contract","Particular","Tenderers","Contracts",true),cat("k6","General specification","General","Tenderers","Design",true),
  cat("k7","Particular specification","Particular","Tenderers","Design",true),cat("k8","Bills of quantities","Particular","Tenderers","Quantity surveying",true),
  cat("k9","Drawings register","Particular","Tenderers","Design",true),cat("k10","Tender returnables schedule","Particular","Tenderers","Procurement",true),
  cat("k11","Health, safety and environmental requirements","General","Tenderers","HSE",false),cat("k12","Programme and key dates","Particular","Tenderers","Project controls",false),
  cat("k13","Site information","Particular","Tenderers","Design",false),cat("k14","Contract forms and schedules","General","Tenderers","Contracts",false),
  cat("k15","Tender evaluation plan","Particular","Internal","Procurement",true),cat("k16","Pre-tender estimate","Particular","Internal","Quantity surveying",true),
  cat("k17","Procurement strategy note","Particular","Internal","Project management",false)];
  S.projects=[
    {id:"p1",name:"Northshore Rail Extension",code:"NRE",client:"Northshore Transit Authority",desc:"A 6 km elevated rail extension with three new stations and a depot.",funding:"FP-2025-031",leadId:"u-pl",start:ago(120),end:ahead(900),status:"Active",createdAt:ago(120),updatedAt:ago(15),updatedBy:"u-pl",dur:DEFAULT_DUR.slice()},
    {id:"p2",name:"Coastal Highway Upgrade",code:"CHU",client:"Department of Transportation",desc:"A 14 km coastal dual-carriageway with 4 grade-separated interchanges, seawall protections, and intelligent lighting systems.",funding:"FP-2025-088",leadId:"u-pl",start:ago(90),end:ahead(720),status:"Active",createdAt:ago(90),updatedAt:ago(10),updatedBy:"u-pl",dur:DEFAULT_DUR.slice()},
    {id:"p3",name:"Metro Airport Express Depot Expansion",code:"MAX",client:"Airport Rail Transit Authority",desc:"Expansion of rolling stock stabling yards, automated maintenance facility, and depot traction power substation.",funding:"FP-2024-102",leadId:"u-pl",start:ago(150),end:ahead(500),status:"Active",createdAt:ago(150),updatedAt:ago(5),updatedBy:"u-pl",dur:DEFAULT_DUR.slice()}
  ];
  S.subprojects=[
    {id:"sp1",projectId:"p1",name:"Civil works",desc:"Viaducts, depot and earthworks",leadId:"u-spl",members:["u-rev"],createdAt:ago(120),updatedAt:ago(20),updatedBy:"u-spl"},
    {id:"sp2",projectId:"p1",name:"Stations and systems",desc:"Station fit-out, signalling and power",leadId:"u-spl2",members:[],createdAt:ago(120),updatedAt:ago(30),updatedBy:"u-spl2"},
    {id:"sp3",projectId:"p2",name:"Interchange & Overpass Structures",desc:"Elevated bridge structures and highway flyovers",leadId:"u-spl",members:["u-rev"],createdAt:ago(90),updatedAt:ago(12),updatedBy:"u-spl"},
    {id:"sp4",projectId:"p2",name:"Marine Seawall & Reclamation",desc:"Rock revetment, shoreline stabilization and drainage",leadId:"u-spl2",members:[],createdAt:ago(90),updatedAt:ago(14),updatedBy:"u-spl2"},
    {id:"sp5",projectId:"p3",name:"Stabling Yards & Trackwork",desc:"Ballasted track, stabling sidings and turnouts",leadId:"u-spl2",members:["u-rev"],createdAt:ago(150),updatedAt:ago(8),updatedBy:"u-spl2"},
    {id:"sp6",projectId:"p3",name:"Depot Power & Traction Substation",desc:"25kV traction substation and switchgear installation",leadId:"u-spl2",members:[],createdAt:ago(150),updatedAt:ago(6),updatedBy:"u-spl2"}
  ];
  const tec=[{userId:"u-tec",chair:true},{userId:"u-tec2"},{userId:"u-tec3"}];
  S.tenders=[
    {id:"tn1",spId:"sp1",code:"NRE-C01",title:"Viaduct and civil works",route:"Open tender",scope:"Design and construction of a 1.8 km elevated viaduct on bored piles between Harbour Road and Northshore station, including drainage, utilities diversions, temporary traffic management and interface works with the systems contractor.",createdAt:ago(34),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"},{userId:"u-sme3",disc:"Procurement"},{userId:"u-sme4",disc:"Quantity surveying"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn2",spId:"sp1",code:"NRE-C02",title:"Depot earthworks",route:"Selective tender",scope:"Bulk earthworks, ground improvement and drainage for the 14 hectare depot site.",createdAt:ago(60),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"},{userId:"u-sme4",disc:"Quantity surveying"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn3",spId:"sp2",code:"NRE-S01",title:"Station fit-out",route:"Open tender",scope:"Architectural fit-out of three stations including finishes, signage and passenger facilities.",createdAt:ago(85),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn4",spId:"sp1",code:"NRE-C03",title:"Noise barriers",route:"Open tender",scope:"Supply and installation of transparent noise barriers along the viaduct.",createdAt:ago(2),icId:null,smes:[],tec:[],manual:null},
    {id:"tn5",spId:"sp3",code:"CHU-C01",title:"Flyover bridge structural works",route:"Open tender",scope:"Design and build of 4-lane prestressed concrete box girder flyover structure with cast-in-place piers.",createdAt:ago(45),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn6",spId:"sp3",code:"CHU-C02",title:"Traffic signalling & smart lighting",route:"Selective tender",scope:"Supply and installation of adaptive traffic controller signals, LED gantry luminaires and fiber network.",createdAt:ago(25),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme3",disc:"Procurement"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn7",spId:"sp4",code:"CHU-M01",title:"Seawall rock revetment and drainage",route:"Open tender",scope:"Armor rock placement, geotextile filtration layer and marine outfall culverts along 3.2 km coastline.",createdAt:ago(20),icId:"u-ic",smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme4",disc:"Quantity surveying"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn8",spId:"sp5",code:"MAX-D01",title:"Stabling yard trackwork and turnouts",route:"Open tender",scope:"Track laying, continuously welded rail, turnouts, buffer stops and ballasting for 12 stabling sidings.",createdAt:ago(75),icId:null,smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"},{userId:"u-sme4",disc:"Quantity surveying"}],tec:tec.map(x=>({...x})),manual:null},
    {id:"tn9",spId:"sp6",code:"MAX-P01",title:"25kV traction power substation",route:"Selective tender",scope:"Design, manufacture, delivery and commissioning of indoor 25kV gas-insulated switchgear and auxiliary transformers.",createdAt:ago(55),icId:null,smes:[{userId:"u-sme1",disc:"Design"},{userId:"u-sme2",disc:"Contracts"}],tec:tec.map(x=>({...x})),manual:null}
  ];
  S.docs=[];
  const mk=(id,tid,kid,owner,status,due,opts)=>{const t=S.tenders.find(x=>x.id===tid),k=S.catalogue.find(x=>x.id===kid);const html=sampleHtml(k.name,t);
   const d=Object.assign({id,tenderId:tid,catId:kid,name:k.name,spec:k.spec,audience:k.audience,ownerId:owner,due,status,html,versions:[],comments:[],approvals:[],remarks:null,contractsFlag:null,createdAt:ago(30),updatedAt:ago(4),updatedBy:owner||"u-ic"},opts||{});
   if(status!==DS.NS&&status!==DS.DR)d.versions.push({no:1,html,at:ago(8),by:owner,note:"Shared for review"});
   if([DS.AP,DS.FI].includes(status))d.approvals.push({versionNo:1,approverId:"u-sup",decision:"Approved",remarks:"",at:ago(6)});
   S.docs.push(d);return d;};
  mk("d1","tn1","k2","u-sme2",DS.AP,ago(4));mk("d2","tn1","k4","u-sme2",DS.AP,ago(4));
  mk("d3","tn1","k5","u-sme2",DS.PA,ago(1));
  mk("d4","tn1","k6","u-sme1",DS.AP,ago(5));
  const d5=mk("d5","tn1","k7","u-sme1",DS.IR,ahead(3));
  d5.comments.push({id:"cm1",by:"u-rev",at:ago(2),text:"Pile cap cover of 75 mm conflicts with the marine exposure class in the ground investigation report. Please confirm with the durability assessment.",resolved:false,replies:[]});
  d5.comments.push({id:"cm2",by:"u-sme3",at:ago(1),text:"Can we reference the systems interface matrix here so tenderers price the cast-in containment?",resolved:false,replies:[{by:"u-sme1",at:ago(.5),text:"Good idea, adding it in the next revision."}]});
  mk("d6","tn1","k8","u-sme4",DS.DR,ahead(6));
  const d7=mk("d7","tn1","k15","u-sme3",DS.RT,ahead(2));
  d7.approvals.push({versionNo:1,approverId:"u-sup",decision:"Returned",remarks:"Weighting needs sign-off from the procurement board. Add the safety performance sub-criteria and scoring guidance.",at:ago(1)});d7.remarks=d7.approvals[0].remarks;
  mk("d8","tn1","k16","u-sme4",DS.NS,ahead(8));
  ["k2","k4","k7","k8"].forEach((k,i)=>mk("d2"+i,"tn2",k,i===2?"u-sme1":i===3?"u-sme4":"u-sme2",DS.AP,ago(12)));
  ["k2","k4","k7","k15"].forEach((k,i)=>mk("d3"+i,"tn3",k,i===2?"u-sme1":"u-sme2",DS.FI,ago(30)));
  ["k2","k5","k7","k8"].forEach((k,i)=>mk("d5"+i,"tn5",k,i===2?"u-sme1":i===3?"u-sme4":"u-sme2",i===0?DS.AP:i===1?DS.PA:i===2?DS.IR:DS.DR,ahead(5)));
  ["k6","k15"].forEach((k,i)=>mk("d6"+i,"tn6",k,i===0?"u-sme1":"u-sme3",i===0?DS.DR:DS.PA,ahead(10)));
  ["k13","k8"].forEach((k,i)=>mk("d7"+i,"tn7",k,i===0?"u-sme1":"u-sme4",i===0?DS.IR:DS.NS,ahead(12)));
  ["k2","k4","k7","k8"].forEach((k,i)=>mk("d8"+i,"tn8",k,i===2?"u-sme1":i===3?"u-sme4":"u-sme2",DS.FI,ago(15)));
  ["k5","k7"].forEach((k,i)=>mk("d9"+i,"tn9",k,i===1?"u-sme1":"u-sme2",i===0?DS.AP:DS.IR,ahead(8)));
 S.metrics=[
  {id:"m1",tenderId:"tn2",metric:"Earthworks volume variance",target:"Within 5% of the bill quantity",source:"Historical"},
  {id:"m2",tenderId:"tn2",metric:"Lost-time injury frequency rate",target:"Below 0.2 per 100,000 hours",source:"Manual"},
  {id:"m3",tenderId:"tn3",metric:"Snagging items at handover",target:"Fewer than 25 per station",source:"Historical"},
  {id:"m4",tenderId:"tn3",metric:"Programme adherence",target:"No milestone later than 10 working days",source:"Manual"}];
 S.history=[
  {tender:"WKR-C11 Elevated walkway",route:"Open tender",metric:"Cost growth from award to final account",target:"Under 8%",actual:"6.4%"},
  {tender:"WKR-C11 Elevated walkway",route:"Open tender",metric:"Lost-time injury frequency rate",target:"Below 0.25",actual:"0.18"},
  {tender:"ELX-C04 Bridge widening",route:"Open tender",metric:"Programme adherence on key dates",target:"95% on time",actual:"91%"},
  {tender:"ELX-C04 Bridge widening",route:"Open tender",metric:"Non-conformance reports closed within 14 days",target:"90%",actual:"94%"},
  {tender:"SKY-C02 Viaduct section 2",route:"Open tender",metric:"Concrete cube test pass rate",target:"98%",actual:"99.1%"},
  {tender:"SKY-C02 Viaduct section 2",route:"Open tender",metric:"Community complaints per month",target:"Fewer than 5",actual:"3.2"},
  {tender:"DPT-C01 Bus depot",route:"Selective tender",metric:"Earthworks volume variance",target:"Within 5%",actual:"3.8%"}];
 S.packages=[
  {id:"pk2",tenderId:"tn2",version:1,items:["d20","d21","d22","d23"].map(id=>({docId:id,versionNo:1})),status:PS.ICR,createdAt:ago(4),reviews:[],checklist:{},tecViews:{},actions:[],submittedAt:null},
  {id:"pk3",tenderId:"tn3",version:1,items:["d30","d31","d32","d33"].map(id=>({docId:id,versionNo:1})),status:PS.TEC,createdAt:ago(14),reviews:[{by:"u-ctr",stage:"Before TEC",outcome:"Cleared for TEC",at:ago(8),notes:"All checks complete."}],checklist:{},tecViews:{"u-tec2":ago(1)},actions:[],submittedAt:ago(6)}];
 S.notes=[];S.activity=[];
 const a=(at,by,tid,text,docId,link,pid,spId)=>{
  const t=tid?S.tenders.find(x=>x.id===tid):null;
  const s=spId?S.subprojects.find(x=>x.id===spId):(t&&t.spId?S.subprojects.find(x=>x.id===t.spId):null);
  const p=pid?S.projects.find(x=>x.id===pid):(s?S.projects.find(x=>x.id===s.projectId):null);
  S.activity.push({id:"a"+(S.activity.length+1),at,by,tenderId:tid||null,docId:docId||null,link:link||null,text,spId:s?s.id:(spId||null),projectId:p?p.id:(pid||null)});
 };
 a(ago(120),"u-pl",null,"created project NRE Northshore Rail Extension",null,"#/search/p1","p1");
 a(ago(120),"u-pl",null,"added sub-project Civil works",null,"#/search/p1/sp1","p1","sp1");
 a(ago(120),"u-pl",null,"appointed Priya Nair as sub-project lead for Civil works",null,"#/search/p1/sp1","p1","sp1");
 a(ago(120),"u-pl",null,"added sub-project Stations and systems",null,"#/search/p1/sp2","p1","sp2");
 a(ago(120),"u-pl",null,"appointed Liam Vance as sub-project lead for Stations and systems",null,"#/search/p1/sp2","p1","sp2");
 a(ago(34),"u-spl","tn1","created the tender");a(ago(30),"u-spl","tn1","assigned Marcus Lee as contract project IC");a(ago(26),"u-ic","tn1","selected 8 documents from the catalogue");
 a(ago(20),"u-spl",null,"updated sub-project details for Civil works",null,"#/search/p1/sp1","p1","sp1");
 a(ago(15),"u-pl",null,"updated project details for NRE",null,"#/search/p1","p1");
 a(ago(8),"u-sme1","tn1","shared Particular specification for review","d5");a(ago(2),"u-rev","tn1","commented on Particular specification","d5");
 a(ago(1),"u-sup","tn1","returned Tender evaluation plan with remarks","d7");a(ago(1),"u-sme2","tn1","sent Special conditions of contract for approval","d3");
 a(ago(4),"u-ic","tn2","sent package v1 for contracts review");a(ago(6),"u-ic","tn3","submitted package v1 to TEC");a(ago(1),"u-tec2","tn3","viewed package v1");
 a(ago(2),"u-spl","tn4","created the tender");
 const n=(uid,text,link,at,key)=>S.notes.push({id:"n"+(S.notes.length+1),userId:uid,text,link,at,read:false,key:key||null,fyi:!key,done:false});
 n("u-sup","Kenji Ito sent Special conditions of contract for approval","#/doc/d3",ago(1),"approve:d3");
 n("u-sme3","Helen Ho returned Tender evaluation plan with remarks","#/doc/d7",ago(1),"own:d7");
 n("u-sme1","Ravi Patel commented on Particular specification","#/doc/d5",ago(2),"comments:d5");
 n("u-ctr","Marcus Lee sent NRE-C02 Depot earthworks for contracts review","#/package/pk2",ago(4),"crReview:pk2");
 n("u-tec","NRE-S01 Station fit-out was submitted to TEC","#/tec/pk3",ago(6),"tecRead:pk3");
 n("u-spl","NRE-C03 Noise barriers needs a contract project IC","#/tender/tn4/overview",ago(2),"assignIC:tn4");
 n("u-ic","Helen Ho returned Tender evaluation plan on NRE-C01","#/doc/d7",ago(1));
 seedProgramme(S);
 return S;
}

/* Have-data edition: 120 more projects spread across every stage of tender preparation,
   so each role under "Viewing as" has a long task list. The random numbers are seeded,
   so Reset demo always rebuilds the same programme. */
function seedProgramme(S){
 let rs=20261009;
 const rnd=()=>{rs=rs+0x6D2B79F5|0;let x=Math.imul(rs^rs>>>15,1|rs);x=x+Math.imul(x^x>>>7,61|x)^x;return ((x^x>>>14)>>>0)/4294967296;};
 const pick=a=>a[Math.floor(rnd()*a.length)],num=(a,b)=>a+Math.floor(rnd()*(b-a+1)),chance=p=>rnd()<p;
 const wpick=ws=>{let x=rnd()*ws.reduce((s,w)=>s+w[1],0);for(const w of ws){x-=w[1];if(x<0)return w[0];}return ws[ws.length-1][0];};
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const uname=id=>(S.users.find(x=>x.id===id)||{}).name;

 /* More people, so the programme isn't staffed by one person per role */
 const nu=(id,name,teamId,title,role,sup,extra)=>Object.assign({id,name,email:name.toLowerCase().replace(/[^a-z]+/g,".")+"@harbourline.example",companyId:"c1",teamId,title,role,superiorId:sup||null,sys:"user",creator:false,status:"Active"},extra||{});
 S.users.push(
  nu("u-pl2","Rachel Kim","t-pm","Programme director","Project lead",null,{creator:true}),
  nu("u-pl3","Thomas Grant","t-pm","Project director, water","Project lead",null,{creator:true}),
  nu("u-spl3","Anna Kowalski","t-pm","Sub-project lead, utilities","Sub-project lead"),
  nu("u-spl4","Marco Rossi","t-pm","Sub-project lead, buildings","Sub-project lead"),
  nu("u-ic2","Hannah Becker","t-pm","Contract project IC","Contract project IC"),
  nu("u-ic3","Samuel Osei","t-pm","Contract project IC","Contract project IC"),
  nu("u-sup2","Arjun Mehta","t-qs","Commercial director","SME superior"),
  nu("u-sme5","Lucas Moreau","t-des","Design engineer","SME","u-sup"),
  nu("u-sme6","Mei Ling Tan","t-con","Contracts engineer","SME","u-sup"),
  nu("u-sme7","Ahmed Siddiqui","t-qs","Senior quantity surveyor","SME","u-sup2"),
  nu("u-sme8","Elena Petrova","t-pro","Procurement specialist","SME","u-sup2"));
 /* Invitations waiting for the system admin */
 [["Chloe Martin","t-des","Structural engineer","SME"],["Diego Alvarez","t-con","Contracts administrator","SME"],["Priyanka Das","t-qs","Cost manager","SME"],
  ["Tom Fletcher","t-pro","Buyer","SME"],["Yuki Sato","t-des","Building services engineer","SME"],["Isabel Cruz","t-pm","Sub-project lead, marine works","Sub-project lead"],
  ["Noah Williams","t-pm","Contract project IC","Contract project IC"],["Jonas Berg","t-tec","TEC member","TEC member"],["Laura Bianchi","t-des","Landscape architect","SME"],
  ["Kwame Mensah","t-qs","Quantity surveyor","SME"],["Sara Lindqvist","t-pro","Category manager","SME"],["Felix Wagner","t-des","Tunnel engineer","SME"],
  ["Grace Oduya","t-con","Contracts manager","SME"],["Ethan Brooks","t-pm","Project director, aviation","Project lead"],["Sofia Rinaldi","t-des","Electrical engineer","SME"],
  ["Mateo Silva","t-qs","Estimator","SME"],["Aiko Tanaka","t-pro","Procurement officer","SME"],["Liam O'Connor","t-cr","Contracts reviewer","Contracts team reviewer"]]
  .forEach(([name,tm,title,role],i)=>S.users.push(nu("u-inv"+(i+1),name,tm,title,role,null,{status:"Invited"})));

 /* Sector templates: sub-projects as [name, description, tender code letter, tender titles] */
 const SECTORS=[
  {k:"Metro Line",c:["Metropolitan Transit Authority","City Rail Corporation"],d:p=>"A "+num(8,22)+" km metro line through "+p+" with "+num(5,12)+" stations and a depot.",sp:[
   ["Civil works","Tunnels, viaducts and earthworks","C",["Bored tunnel section","Viaduct and civil works","Station box excavation","Cut-and-cover structures","Utilities diversions"]],
   ["Stations and architecture","Station fit-out and passenger facilities","S",["Station fit-out","Platform screen doors","Lifts and escalators","Wayfinding and signage"]],
   ["Systems and signalling","Signalling, power and communications","E",["CBTC signalling system","Traction power supply","Communications and CCTV","Overhead line equipment"]],
   ["Depot and stabling","Depot buildings, stabling and maintenance facilities","D",["Depot workshop building","Stabling yard trackwork","Train wash plant"]]]},
  {k:"Light Rail Extension",c:["Regional Light Rail Authority"],d:p=>"A "+num(4,12)+" km light rail extension serving "+p+", with "+num(4,9)+" stops and a park-and-ride.",sp:[
   ["Trackwork and civils","Embedded track, earthworks and retaining walls","C",["Embedded trackwork","Retaining walls and earthworks","Road reconfiguration"]],
   ["Stops and urban realm","Stops, shelters and streetscape","S",["Tram stop construction","Streetscape and paving","Park-and-ride facility"]],
   ["Power and systems","Traction power, signalling and ticketing","E",["Traction substations","Tram signalling and priority","Ticketing machines"]]]},
  {k:"Highway Upgrade",c:["Department of Transportation","State Roads Agency"],d:p=>"Widening of "+num(6,24)+" km of the "+p+" corridor to a dual carriageway with "+num(2,6)+" grade-separated junctions.",sp:[
   ["Mainline carriageway","Pavement, earthworks and safety barriers","C",["Mainline widening","Pavement reconstruction","Safety barriers and fencing"]],
   ["Interchanges and structures","Flyovers, underpasses and bridges","B",["Interchange flyover","Underpass structures","Pedestrian footbridges"]],
   ["Drainage and utilities","Stormwater drainage and utility relocation","W",["Stormwater drainage","Utility relocation","Attenuation ponds"]],
   ["ITS and lighting","Intelligent transport systems and street lighting","E",["Smart motorway signage","Street lighting","Traffic control centre upgrade"]]]},
  {k:"Bridge Replacement",c:["Department of Transportation","Harbour Bridges Authority"],d:p=>"Replacement of the "+p+" river crossing with a "+num(180,640)+" m cable-stayed bridge and new approach roads.",sp:[
   ["Main span","Pylons, deck and stay cables","B",["Main span superstructure","Pylon foundations","Stay cable supply"]],
   ["Approaches and demolition","Approach viaducts and removal of the old bridge","C",["Approach viaducts","Demolition of the existing bridge","Temporary traffic diversion"]]]},
  {k:"Water Treatment Works",c:["Regional Water Utility"],d:p=>"A new "+num(60,240)+" ML/day water treatment works for "+p+", with intake, treatment and treated-water storage.",sp:[
   ["Process plant","Filtration, clarification and disinfection","M",["Membrane filtration plant","Clarifiers and chemical dosing","UV disinfection"]],
   ["Intake and pipelines","Raw-water intake and transfer mains","W",["Raw water intake","Transfer pipeline","Treated water reservoir"]],
   ["Civil and buildings","Site works, process buildings and roads","C",["Process building","Site roads and drainage"]],
   ["Electrical and SCADA","Power supply, controls and telemetry","E",["HV substation","SCADA and telemetry"]]]},
  {k:"Flood Defence Scheme",c:["Environment Agency","Coastal Protection Board"],d:p=>"Flood protection for "+p+" against a 1-in-200-year event, with "+num(3,11)+" km of defences and new pumping stations.",sp:[
   ["Seawalls and embankments","Rock revetment, walls and embankments","M",["Seawall reconstruction","Rock revetment","Embankment raising"]],
   ["Pumping stations","Storm pumping stations and outfalls","E",["Storm pumping station","Outfall culverts"]],
   ["Drainage channels","Channels, culverts and flood gates","W",["Drainage channel works","Tidal flood gates"]]]},
  {k:"Hospital Redevelopment",c:["Regional Health Authority"],d:p=>"Redevelopment of "+p+" General Hospital with a "+num(200,650)+"-bed clinical block and a new emergency department.",sp:[
   ["Main clinical block","Structure, envelope and fit-out","B",["Clinical block superstructure","Facade and envelope","Ward fit-out"]],
   ["Building services","Mechanical, electrical and medical gases","E",["Mechanical and electrical services","Medical gas systems","Energy centre"]],
   ["Medical equipment","Imaging and operating theatre equipment","S",["Imaging equipment","Operating theatre equipment"]],
   ["External works","Car parks, roads and landscaping","C",["Multi-storey car park","Site access roads"]]]},
  {k:"Airport Terminal Expansion",c:["Airport Authority"],d:p=>"Expansion of "+p+" Airport terminal by "+num(20,90)+",000 m² to handle "+num(10,40)+" million passengers a year.",sp:[
   ["Terminal building","Structure, roof and fit-out","B",["Terminal steel and roof","Terminal fit-out","Passenger boarding bridges"]],
   ["Airside works","Aprons, taxiways and airfield lighting","C",["Apron extension","Taxiway rehabilitation","Airfield ground lighting"]],
   ["Baggage and systems","Baggage handling and IT systems","E",["Baggage handling system","Airport operational systems"]]]},
  {k:"Port Expansion",c:["Port Authority"],d:p=>"Expansion of "+p+" container port with "+num(600,1800)+" m of new quay and "+num(20,60)+" hectares of reclaimed yard.",sp:[
   ["Quay and marine works","Quay walls, dredging and reclamation","M",["Quay wall construction","Dredging and reclamation","Breakwater extension"]],
   ["Container yard","Yard paving, buildings and utilities","C",["Container yard paving","Gate complex and buildings"]],
   ["Cranes and equipment","Ship-to-shore and yard cranes","S",["Ship-to-shore cranes","Automated stacking cranes"]]]},
  {k:"Wastewater Tunnel",c:["Regional Water Utility"],d:p=>"A "+num(3,14)+" km deep wastewater tunnel under "+p+" to stop overflows into the river.",sp:[
   ["Main tunnel","Tunnel boring and shafts","C",["Main tunnel drive","Access shafts","Connection tunnels"]],
   ["Treatment upgrade","Inlet works and treatment capacity","M",["Inlet works upgrade","Sludge treatment"]]]},
  {k:"Solar Farm and Grid Connection",c:["National Power Company","Renewable Energy Agency"],d:p=>"A "+num(50,400)+" MW solar farm near "+p+" with battery storage and a grid connection.",sp:[
   ["Solar array","Modules, mounting and inverters","S",["PV modules and mounting","Inverters and transformers"]],
   ["Grid connection","Substation, transmission line and storage","E",["Grid substation","Overhead transmission line","Battery energy storage"]]]},
  {k:"Civic Centre",c:["City Council"],d:p=>"A new civic centre for "+p+" with council offices, a library and a public square.",sp:[
   ["Buildings","Offices, library and community hall","B",["Council office building","Library and community hall"]],
   ["Public realm","Public square, landscaping and parking","C",["Public square and landscaping","Underground car park"]]]}];
 const PLACES=["Northgate","Riverside","Eastport","Westbrook","Kingsbay","Silverlake","Ashford","Bayview","Cedar Point","Clearwater","Fairhaven","Greenfield","Harbourfront","Highland","Ironbridge",
  "Lakeside","Maplewood","Marina Bay","Oakridge","Pinecrest","Redcliff","Rosedale","Sandhurst","Southbank","Stonehaven","Sunset Coast","Thornbury","Valley Park","Westfield","Woodlands"];
 const REMARKS=["Align the liquidated damages with the programme of key dates.","Weighting needs sign-off from the procurement board.","Cross-reference the latest ground investigation report.",
  "Quantities don't match the drawings register. Please reconcile.","Add the interface requirements with the adjacent contract.","Update the insurance clauses to the current company standard."];
 const COMMENTS=["Can we reference the interface matrix here so tenderers price the shared works?","This clause conflicts with the special conditions. Which one prevails?",
  "Please confirm the design life with the asset owner.","The testing regime looks light for this scale of work.","Should this be a provisional sum rather than a measured item?",
  "Add the hold points for the Engineer's inspection.","The programme assumes possession in stages. Is that agreed with operations?","Check the units in the schedule; some rates are per metre, some per tonne."];
 const FLAGS=["Indemnity wording doesn't match the approved template.","Payment terms exceed the 30-day policy.","Retention percentage differs from the general conditions.","Missing the anti-bribery clause."];
 const METRICS=[["Cost growth from award to final account","Under 8%"],["Lost-time injury frequency rate","Below 0.2 per 100,000 hours"],["Programme adherence on key dates","95% on time"],
  ["Non-conformance reports closed within 14 days","90%"],["Defects at handover","Fewer than 30"],["Community complaints per month","Fewer than 5"]];
 /* Where each tender sits; later stages are older */
 const STAGE=[["planned",13],["noSme",5],["noDocs",5],["assign",9],["drafting",32],["collate",6],["tecApprove",6],["crReview",9],["changes",4],["sendTD",7],["sent",6]];
 const ORDER=STAGE.map(s=>s[0]);
 const used=new Set(S.projects.map(p=>p.code)),ctr={};
 const codeFor=name=>{const w=name.split(" "),tries=[w.map(x=>x[0]).join("").slice(0,3),w[0].slice(0,2)+w[1][0],w[0][0]+w[1].slice(0,2),w[0].slice(0,3)].map(x=>x.toUpperCase());
  for(const c of tries)if(!used.has(c)){used.add(c);return c;}
  for(let i=2;;i++){const c=tries[0].slice(0,2)+i;if(!used.has(c)){used.add(c);return c;}}};
 const act=(at,by,text,o)=>S.activity.push(Object.assign({id:"a"+(S.activity.length+1),at:Math.min(at,NOW),by,tenderId:null,docId:null,link:null,text,spId:null,projectId:null},o));
 let nP=0,nSp=0,nT=0,nD=0,nPk=0,nCm=0,nM=0;

 function makeTender(p,sp,letter,title,spAge){
  const st=wpick(STAGE),si=ORDER.indexOf(st),tAge=Math.max(0,Math.min(spAge-1,3+si*7+num(0,14))),tAt=ago(tAge);
  const key=p.code+"-"+letter;ctr[key]=(ctr[key]||0)+1;
  const ic=st==="planned"?null:wpick([["u-ic",45],["u-ic2",30],["u-ic3",25]]);
  const smes=[{userId:wpick([["u-sme1",50],["u-sme5",38],["u-rev",12]]),disc:"Design"},{userId:wpick([["u-sme2",55],["u-sme6",45]]),disc:"Contracts"},{userId:wpick([["u-sme4",55],["u-sme7",45]]),disc:"Quantity surveying"}];
  if(chance(.7))smes.push({userId:wpick([["u-sme3",50],["u-sme8",50]]),disc:"Procurement"});
  const t={id:"gtn"+(++nT),spId:sp.id,code:key+String(ctr[key]).padStart(2,"0"),title,route:wpick([["Open tender",65],["Selective tender",30],["Negotiated",5]]),
   ctype:wpick([["Construct only",45],["Design and build",25],["Supply and install",20],["Term contract",5],["Consultancy",5]]),
   scope:"Delivery of the "+title.toLowerCase()+" for "+p.name+" ("+sp.name.toLowerCase()+"), including design coordination, interfaces with adjacent contracts, testing and commissioning.",
   createdAt:tAt,icId:ic,smes:si<2?[]:smes,tec:si===0||(si<5&&chance(.15))?[]:[{userId:"u-tec",chair:true},{userId:"u-tec2"},{userId:"u-tec3"}],manual:null};
  S.tenders.push(t);
  const lg=(days,by,text,docId)=>act(tAt+days*DAY,by,text,{tenderId:t.id,docId:docId||null,spId:sp.id,projectId:p.id});
  lg(0,sp.leadId,"created the tender");
  if(ic)lg(1,sp.leadId,"assigned "+uname(ic)+" as contract project IC");
  if(si>=2)lg(2,ic,"assigned "+t.smes.length+" SMEs");
  if(si>=3&&chance(.45))shuffle(METRICS).slice(0,num(1,2)).forEach(m=>S.metrics.push({id:"gm"+(++nM),tenderId:t.id,metric:m[0],target:m[1],source:pick(["Historical","Manual"])}));
  if(si<3)return;

  /* Documents: the core four plus a few others, owned by the SME for that discipline */
  const kids=["k2","k4","k7","k8"].concat(shuffle(["k1","k3","k5","k6","k9","k10","k11","k12","k13","k15","k16"]).slice(0,num(0,2)))
   .sort((a,b)=>S.catalogue.findIndex(k=>k.id===a)-S.catalogue.findIndex(k=>k.id===b));
  const smeFor=disc=>(t.smes.find(x=>x.disc===disc)||{}).userId;
  lg(3,ic,"selected "+kids.length+" documents from the catalogue");
  const docs=kids.map((kid,i)=>{
   const k=S.catalogue.find(x=>x.id===kid),html=sampleHtml(k.name,t);
   let owner=smeFor(k.discipline)||smeFor(k.discipline==="Procurement"?"Contracts":"Design"),status=DS.AP,due=ago(num(2,30));
   if(st==="assign"){if(i===0||chance(.4))owner=null;status=owner&&chance(.4)?DS.DR:DS.NS;}
   else if(st==="drafting")status=wpick([[DS.NS,14],[DS.DR,26],[DS.IR,14],[DS.PA,12],[DS.RT,8],[DS.AP,i?22:0]]);
   if(!isApproved({status}))due=ahead(wpick([[num(-14,-1),20],[num(0,3),20],[num(4,35),60]]));
   const sup=owner&&(S.users.find(x=>x.id===owner)||{}).superiorId||"u-sup",upd=ago(num(0,Math.min(10,tAge)));
   const d={id:"gd"+(++nD),tenderId:t.id,catId:kid,name:k.name,spec:k.spec,audience:k.audience,ownerId:owner,due,status,html,versions:[],comments:[],approvals:[],remarks:null,contractsFlag:null,
    createdAt:tAt+3*DAY,updatedAt:upd,updatedBy:owner||ic};
   if(status!==DS.NS&&status!==DS.DR)d.versions.push({no:1,html,at:upd,by:owner,note:"Shared for review"});
   if(isApproved(d)){d.approvals.push({versionNo:1,approverId:sup,decision:"Approved",remarks:"",at:upd});if(st==="drafting")act(upd,sup,"approved "+k.name,{tenderId:t.id,docId:d.id,spId:sp.id,projectId:p.id});}
   if(status===DS.RT){d.remarks=pick(REMARKS);d.approvals.push({versionNo:1,approverId:sup,decision:"Returned",remarks:d.remarks,at:upd});act(upd,sup,"returned "+k.name+" with remarks",{tenderId:t.id,docId:d.id,spId:sp.id,projectId:p.id});}
   if(status===DS.PA)act(upd,owner,"sent "+k.name+" for approval",{tenderId:t.id,docId:d.id,spId:sp.id,projectId:p.id});
   if(status===DS.IR)act(upd,owner,"shared "+k.name+" for review",{tenderId:t.id,docId:d.id,spId:sp.id,projectId:p.id});
   if((status===DS.DR||status===DS.IR)&&owner&&chance(.3)){
    const others=t.smes.map(x=>x.userId).filter(x=>x!==owner).concat(sp.members);
    for(let n=num(1,2);n>0;n--)d.comments.push({id:"gcm"+(++nCm),by:pick(others),at:ago(num(0,5)),text:pick(COMMENTS),resolved:chance(.3),replies:[]});}
   S.docs.push(d);return d;});
  if(si<6)return;

  /* Package: collated, then TEC, contracts review and Tender Division */
  const pkAt=ago(num(1,Math.max(1,Math.min(14,tAge-4))));
  const pk={id:"gpk"+(++nPk),tenderId:t.id,version:1,items:docs.map(d=>({docId:d.id,versionNo:1})),status:PS.COL,createdAt:pkAt,reviews:[],checklist:{},tecViews:{},actions:[],submittedAt:null};
  act(pkAt,ic,"collated package v1 with "+docs.length+" documents",{tenderId:t.id,spId:sp.id,projectId:p.id});
  if(st!=="tecApprove"||chance(.4)){pk.tecApproved=true;pk.reviews.push({by:ic,stage:"TEC",outcome:"TEC Approved",at:Math.min(NOW,pkAt+DAY),notes:""});}
  if(si>=7){pk.status=PS.ICR;act(pkAt+2*DAY,ic,"sent package v1 for contracts review",{tenderId:t.id,spId:sp.id,projectId:p.id});}
  if(st==="changes"){
   const flagged=shuffle(docs).slice(0,num(1,2));
   flagged.forEach(d=>{const c=pick(FLAGS);d.status=DS.CR;d.contractsFlag=c;d.comments.push({id:"gcm"+(++nCm),by:"u-ctr",at:ago(num(0,3)),text:c,resolved:false,replies:[],contracts:true});});
   pk.status=PS.CHG;pk.reviews.push({by:"u-ctr",stage:"Contracts review",outcome:"Returned",at:ago(num(0,3)),notes:flagged.length+" documents flagged"});
   act(ago(1),"u-ctr","returned package v1 in contracts review ("+flagged.length+" documents flagged)",{tenderId:t.id,spId:sp.id,projectId:p.id});}
  if(st==="sendTD"||st==="sent"){pk.status=PS.CLR;pk.reviews.push({by:"u-ctr",stage:"Contracts review",outcome:"Approved",at:ago(num(1,4)),notes:""});
   act(ago(2),"u-ctr","approved package v1",{tenderId:t.id,spId:sp.id,projectId:p.id});}
  if(st==="sent"){pk.prevStatus=PS.CLR;pk.status=PS.TD;pk.sentTdAt=ago(num(0,1));pk.sentTdBy=ic;
   act(pk.sentTdAt,ic,"confirmed package v1 was sent to Tender Division",{tenderId:t.id,spId:sp.id,projectId:p.id});}
  S.packages.push(pk);
 }

 shuffle(PLACES.flatMap(pl=>SECTORS.map(se=>[pl,se]))).slice(0,120).forEach(([place,se])=>{
  const name=place+" "+se.k,code=codeFor(name),age=num(30,420),lead=wpick([["u-pl",65],["u-pl2",20],["u-pl3",15]]);
  const p={id:"gp"+(++nP),name,code,client:pick(se.c),desc:se.d(place),funding:"FP-"+(age>280?2025:2026)+"-"+String(num(1,199)).padStart(3,"0"),leadId:lead,
   start:ago(age),end:ahead(num(300,1400)),status:"Active",createdAt:ago(age),updatedAt:ago(num(0,Math.min(age,30))),updatedBy:lead,dur:DEFAULT_DUR.slice()};
  S.projects.push(p);
  act(p.createdAt,lead,"created project "+code+" "+name,{link:"#/search/"+p.id,projectId:p.id});
  shuffle(se.sp).slice(0,wpick([[0,14],[1,20],[2,35],[3,22],[4,9]])).forEach(tpl=>{
   const spAge=age-num(0,Math.min(60,age-1)),spl=wpick([["u-spl",55],["u-spl2",22],["u-spl3",12],["u-spl4",12],[null,16]]);
   const sp={id:"gsp"+(++nSp),projectId:p.id,name:tpl[0],desc:tpl[1],leadId:spl,members:chance(.3)?["u-rev"]:[],createdAt:ago(spAge),updatedAt:ago(num(0,Math.min(30,spAge))),updatedBy:spl||lead};
   S.subprojects.push(sp);
   const o={link:"#/search/"+p.id+"/"+sp.id,projectId:p.id,spId:sp.id};
   act(sp.createdAt,lead,"added sub-project "+sp.name,o);
   if(!spl)return;
   act(sp.createdAt,lead,"appointed "+uname(spl)+" as sub-project lead for "+sp.name,o);
   shuffle(tpl[3]).slice(0,wpick([[0,15],[1,30],[2,35],[3,18],[4,5]])).forEach(title=>makeTender(p,sp,tpl[2],title,spAge));
  });
 });
}

let S;
function load(){try{const raw=localStorage.getItem(STORE);if(raw)S=JSON.parse(raw);}catch(e){}if(!S)S=seed();migrate();}
function migrate(){S.notes.forEach(n=>{if(n.fyi===undefined){n.fyi=false;n.done=true;}});S.tenders.forEach(t=>{t.manual=null;if(!t.ctype)t.ctype=({tn1:"Design and build",tn4:"Supply and install"})[t.id]||"Construct only";});S.projects.forEach(p=>{if(!p.createdAt)p.createdAt=p.start||Date.now();if(!p.updatedAt)p.updatedAt=ago(15);if(!p.updatedBy)p.updatedBy=p.leadId||"u-pl";});(S.subprojects||[]).forEach(sp=>{if(!sp.createdAt)sp.createdAt=Date.now();if(!sp.updatedAt)sp.updatedAt=ago(20);if(!sp.updatedBy)sp.updatedBy=sp.leadId||"u-spl";});S.docs.forEach(d=>{if(d.name==="Instructions to tenderers")d.name="Tender instructions";if(d.status==="In review")d.status="Published";if(d.status==="Not required")d.status=d.prevStatus||"Not started";d.comments.forEach(c=>{c.mustFix=false;});if(!d.createdAt)d.createdAt=ago(30);if(!d.updatedAt)d.updatedAt=ago(4);if(!d.updatedBy)d.updatedBy=d.ownerId||"u-ic";});if(S.catalogue){S.catalogue.forEach(k=>{if(k.name==="Instructions to tenderers")k.name="Tender instructions";});}S.users.forEach(u=>{if(!u.role||u.role==="Sub-project reviewer")u.role=ROLE_OF[u.id]||"SME";});if(S.me==="u-rev"||S.me==="u-tec"||S.me==="u-tec2"||S.me==="u-tec3"||!ROLES.some(r=>r.u===S.me)){S.me="u-ic";}const tn8=S.tenders.find(t=>t.id==="tn8");if(tn8&&tn8.icId==="u-ic")tn8.icId=null;const tn9=S.tenders.find(t=>t.id==="tn9");if(tn9&&tn9.icId==="u-ic")tn9.icId=null;const sp6=(S.subprojects||[]).find(sp=>sp.id==="sp6");if(sp6&&sp6.leadId==="u-spl")sp6.leadId="u-spl2";
  if(!S.users.some(u=>u.id==="u-td")){S.users.push({id:"u-td",name:"Oliver Smith",email:"oliver.smith@harbourline.example",companyId:"c1",teamId:"t-td",title:"Tender division",role:"Tender division",superiorId:null,sys:"user",creator:false,status:"Active"});}
  if(!S.teams.some(t=>t.id==="t-td")){S.teams.push({id:"t-td",companyId:"c1",name:"Tender division"});}
  dropSubprojects();
}
/* Sub-projects were removed: tenders belong straight to a project, led by its project lead */
function dropSubprojects(){
  const sps=S.subprojects||[];
  const spProj=id=>{const sp=sps.find(x=>x.id===id);return sp?sp.projectId:null;};
  S.tenders.forEach(t=>{if(!t.projectId)t.projectId=spProj(t.spId);delete t.spId;});
  S.tenders=S.tenders.filter(t=>t.projectId&&S.projects.some(p=>p.id===t.projectId));
  S.projects.forEach(p=>{const m=new Set(p.members||[]);sps.filter(sp=>sp.projectId===p.id).forEach(sp=>(sp.members||[]).forEach(x=>m.add(x)));p.members=[...m];});
  const fixLink=l=>l&&l.replace(/^#\/search\/([^/]+)\/g?sp[^/]*/,"#/search/$1").replace(/^#\/subproject\/.*/,"#/home");
  S.activity=(S.activity||[]).filter(a=>!(a.spId&&!a.tenderId)&&!/sub-project/i.test(a.text||""));
  S.activity.forEach(a=>{if(a.tenderId&&!a.projectId){const t=S.tenders.find(x=>x.id===a.tenderId);if(t)a.projectId=t.projectId;}delete a.spId;a.link=fixLink(a.link);});
  S.notes=(S.notes||[]).filter(n=>!/sub-project/i.test(n.text||"")&&!/^(appointLead|addSp):|^createTenders:g?sp/.test(n.key||""));
  S.notes.forEach(n=>{n.link=fixLink(n.link);});
  S.users.forEach(u=>{if(u.role==="Sub-project lead"){u.role="Project lead";if(/sub-project lead/i.test(u.title||""))u.title=u.title.replace(/sub-project lead/i,"Project lead");}});
  delete S.subprojects;
}
/* The sample programme is large; say once if this browser can't keep it */
let SAVE_WARNED=false;
function save(){try{localStorage.setItem(STORE,JSON.stringify(S));}catch(e){if(!SAVE_WARNED){SAVE_WARNED=true;toast("Changes can't be saved in this browser, so they'll be lost when you reload.");}}}
load();

const uid=p=>p+"-"+(++S.seq);
const byId=(arr,id)=>arr.find(x=>x.id===id);
const urlUser=new URLSearchParams(location.search).get("user");
if(urlUser&&byId(S.users,urlUser)){S.me=urlUser;}
const U=id=>byId(S.users,id)||{id,name:"Unknown",teamId:null};
const T=id=>byId(S.tenders,id), D=id=>byId(S.docs,id), PR=id=>byId(S.projects,id), PK=id=>byId(S.packages,id);
const team=u=>byId(S.teams,u&&u.teamId)||{};
const me=()=>U(S.me);
function getTenderDivisionUser(){return S.users.find(x=>x.id==="u-td"||(x.title&&x.title.toLowerCase().includes("tender division"))||x.teamId==="t-td")||{id:"u-td",name:"Oliver Smith",email:"oliver.smith@harbourline.example",title:"Tender division"};}
function tenderDivisionEmail(){const td=getTenderDivisionUser();return (td&&td.email)?td.email:"oliver.smith@harbourline.example";}
const docsOf=t=>S.docs.filter(d=>d.tenderId===t.id);
const reqDocs=t=>docsOf(t).filter(d=>d.status!==DS.NR);
const pkgOf=t=>S.packages.filter(p=>p.tenderId===t.id).sort((a,b)=>b.version-a.version)[0]||null;
const tendersOf=p=>S.tenders.filter(t=>t.projectId===p.id);
const projOf=t=>PR(t.projectId);

const isAdmin=u=>u.sys==="admin";
/* Every project lead can create projects (no separate permission), as can system admins */
const canCreateProject=u=>isProjectLeadUser(u)||isAdmin(u);
const isPL=(u,p)=>p&&p.leadId===u.id;
const isIC=(u,t)=>t&&t.icId===u.id;
const isSME=(u,t)=>t&&t.smes.some(s=>s.userId===u.id);
const isCR=u=>!!team(u).cr||(!!u&&u.role==="Contracts team reviewer");
const isTEC=(u,t)=>t&&t.tec.some(m=>m.userId===u.id);
function projMembers(p){const s=new Set([p.leadId,...(p.members||[])]);tendersOf(p).forEach(t=>{if(t.icId)s.add(t.icId);t.smes.forEach(x=>s.add(x.userId));});s.delete(null);return [...s];}
const isMember=(u,p)=>!!p&&(projMembers(p).includes(u.id)||isPL(u,p));
const isSuperiorOf=(u,ownerId)=>U(ownerId).superiorId===u.id;
function canSeeTender(u,t){const p=pkgOf(t);return isMember(u,projOf(t))||(isCR(u)&&p&&p.status!==PS.COL)||(u.role==="t-td"&&p&&p.status===PS.TD);}
const DRAFTY=[DS.NS,DS.DR,DS.RT];
function canSeeDoc(u,d){if(isApproved(d))return true;const t=T(d.tenderId);if(DRAFTY.includes(d.status)&&!d.versions.length)return d.ownerId===u.id||isIC(u,t)||isSuperiorOf(u,d.ownerId);return canSeeTender(u,t)||isSuperiorOf(u,d.ownerId);}

function isProjectLeadUser(u){
  if(!u) return false;
  if(u.role) return u.role === "Project lead";
  return (typeof ROLE_OF !== "undefined" && ROLE_OF[u.id] === "Project lead");
}

function userRelatesToTender(u, t){
  if(!u || !t) return false;
  if(isProjectLeadUser(u)) return true;
  const p = projOf(t);
  if(p && isPL(u, p)) return true;
  if(p && (p.members || []).includes(u.id)) return true;
  if(isIC(u, t)) return true;
  if(isSME(u, t)) return true;
  if(isTEC(u, t)) return true;
  if(S.docs.some(d => d.tenderId === t.id && (d.ownerId === u.id || isSuperiorOf(u, d.ownerId) || (d.comments || []).some(c => c.by === u.id)))) return true;
  if(isCR(u) && S.packages.some(pk => pk.tenderId === t.id)) return true;
  return false;
}

function userRelatesToProject(u, p){
  if(!u || !p) return false;
  if(isProjectLeadUser(u)) return true;
  if(isPL(u, p)) return true;
  if((p.members || []).includes(u.id)) return true;
  if(tendersOf(p).some(t => userRelatesToTender(u, t))) return true;
  return false;
}

const EDITABLE=[DS.NS,DS.DR,DS.IR,DS.RT];
function canEditDoc(u,d){const t=T(d.tenderId);if(!t||t.manual)return false;if(d.ownerId===u.id&&EDITABLE.includes(d.status))return true;return isIC(u,t)&&d.status===DS.NS;}
function canComment(u,d){const t=T(d.tenderId);if(!t||t.manual)return false;const p=pkgOf(t);if([DS.NS,DS.DR,DS.IR,DS.RT].includes(d.status)&&isMember(u,projOf(t)))return true;
  return isCR(u)&&p&&p.status===PS.ICR&&p.items.some(i=>i.docId===d.id);}

function tStatus(t){
  if(t.manual)return t.manual;
  if(!t.icId)return "Planned";
  const p=pkgOf(t);
  if(p){if(p.status===PS.FIN)return "Finalised";if([PS.TEC,PS.POST].includes(p.status))return "With TEC";if([PS.ICR,PS.CHG,PS.CLR].includes(p.status))return "In contracts review";}
  return docsOf(t).length?"In preparation":"Set up";
}
function badgeCls(s){
  if(["Approved","Final","Cleared for TEC","Finalised","Active","Viewed","Accepted","Done Preparation"].includes(s))return "g";
  if(["Drafting","Published","Collating","Set up","In preparation","Tender Preparing"].includes(s))return "a";
  if(["Pending approval","In contracts review","Submitted to TEC","Post-TEC review","With TEC","Invited","On hold"].includes(s))return "w";
  if(["Returned","Changes requested","Cancelled","Inactive","Overdue"].includes(s))return "b";
  return "";
}
function addWorkdays(ts,n){const d=new Date(ts);let k=0;while(k<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)k++;}return d.getTime();}
function plannedDates(t){const p=projOf(t),dur=(p&&p.dur&&p.dur.length===STAGES.length)?p.dur:DEFAULT_DUR;let c=t.createdAt;return dur.map(n=>(c=addWorkdays(c,n)));}
function stageChecks(t){
  const ds=reqDocs(t),p=pkgOf(t),pr=projOf(t);
  const all=list=>ds.length>0&&ds.every(d=>list.includes(d.status));
  const pIn=list=>!!p&&list.includes(p.status);
  return [!!(pr&&pr.leadId),
   !!t.icId,
   t.smes.length>0,
   ds.length>0&&ds.every(d=>d.ownerId),
   all([DS.PA,DS.AP,DS.FI,DS.CR]),
   all([DS.AP,DS.FI,DS.CR]),
   !!p,
   !!p&&(p.tecApproved||pIn([PS.ICR,PS.CHG,PS.CLR,PS.TEC,PS.POST,PS.FIN,PS.TD])),
   pIn([PS.CLR,PS.TEC,PS.POST,PS.FIN,PS.TD]),
   pIn([PS.TD])];
}
function currentStage(t){const c=stageChecks(t);const i=c.findIndex((ok,ix)=>!ok);return i<0?STAGES.length:i;}
/* Stage shown as current (the last one once everything is done) */
function stageIdx(t){return Math.min(currentStage(t),STAGES.length-1);}
function stageLabel(t){return currentStage(t)>=STAGES.length?"Sent to Tender Division":STAGES[stageIdx(t)];}
function stagePct(t){return Math.round(currentStage(t)/STAGES.length*100);}
/* Project progress: average stage progress across its tenders */
/* Card status for an active project, from its progress */
function projectPrepStatus(p){if(p.status!=="Active")return p.status;const pct=projectPct(p);return pct>=100?"Done Preparation":pct<=0?"Start Preparation":"Tender Preparing";}
/* Short hover summary of where a project's tenders are */
function projectInsight(p){
  const ts=tendersOf(p).filter(t=>!t.manual);
  const by={};ts.forEach(t=>{const l=stageLabel(t);by[l]=(by[l]||0)+1;});
  const order=STAGES.concat(["Sent to Tender Division"]);
  const rows=Object.keys(by).sort((a,b)=>order.indexOf(b)-order.indexOf(a)).map(l=>'<li><span>'+esc(l===STAGES[STAGES.length-1]?"Ready to send to Tender Division":l)+'</span><b>'+by[l]+'</b></li>').join("");
  const head=ts.length?ts.length+' '+(ts.length===1?'tender':'tenders'):'No tenders yet';
  const lagging=ts.length?ts.reduce((a,t)=>currentStage(t)<currentStage(a)?t:a):null;
  const note=(lagging&&currentStage(lagging)<STAGES.length?'Furthest behind: '+lagging.code+' at '+stageLabel(lagging).replace(/^Send to/,"Ready to send to"):'');
  return '<div class="gs-proj-tip" role="tooltip"><div class="gs-proj-tip-h">'+esc(head)+'</div>'+(rows?'<ul>'+rows+'</ul>':'')+(note?'<div class="gs-proj-tip-n">'+esc(note)+'</div>':'')+'</div>';}
function projectPct(p){const units=tendersOf(p).filter(t=>!t.manual).map(stagePct);
  return units.length?Math.round(units.reduce((a,b)=>a+b,0)/units.length):0;}
function rag(due,done){if(done||!due)return "g";const left=(due-Date.now())/DAY;if(left<0)return "b";if(left<=2.8)return "w";return "g";}
function docRag(d){return [DS.AP,DS.FI,DS.NR].includes(d.status)?"g":rag(d.due,false);}

function log(t,text,docId,link){
  const tid = t ? t.id : null;
  const p = t ? projOf(t) : null;
  S.activity.push({id:uid("a"),at:Date.now(),by:S.me,tenderId:tid,projectId:p?p.id:null,docId:docId||null,link:link||null,text});
}
function logProj(p,text,link){
  if(!p) return;
  S.activity.push({id:uid("a"),at:Date.now(),by:S.me,tenderId:null,projectId:p.id,docId:null,link:link||("#/search/"+p.id),text});
}
function notify(ids,text,link,key){[...new Set(ids)].filter(id=>id&&id!==S.me).forEach(id=>{const live=!!key&&reqTasks(U(id)).some(t=>t.key===key);
  S.notes.push({id:uid("n"),userId:id,text,link,at:Date.now(),read:false,key:live?key:null,fyi:!live,done:false});});}
