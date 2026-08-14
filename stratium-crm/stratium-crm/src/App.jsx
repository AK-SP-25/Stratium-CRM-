import { useState, useEffect, useRef } from "react";
import { storage } from "./storage";
import { supabase } from "./supabaseClient";
import { jsPDF } from "jspdf";
import logo from "./assets/stratium-monogram.png";

const K={co:'bd_crm_v2',cl:'st_clients_v1',ca:'st_candidates_v1',fl:'st_floats_v1',ac:'st_activity_v1',tg:'st_bd_targets_v1',dt:'st_date_override_v1'};
const P={bg:'#111318',wh:'#1C1C24',bo:'rgba(196,133,122,0.15)',ac:'#C4857A',tx:'#F5F0EB',ts:'#C8C0B8',tm:'#A09888',gn:'#10B981',bl:'#3B82F6',am:'#F59E0B',rd:'#EF4444',pu:'#8B5CF6',or:'#F97316',gy:'#94A3B8',vi:'#6366F1'};
const PANEL='#15171C';const INBG='#0F0F0F';const FAINT='#5A5248';const TRACK='rgba(255,255,255,0.08)';
const SERIF="'Cormorant Garamond',Georgia,serif";
const STGS=['Cold','Contacted','Warm','Proposal Sent','Negotiating','Closed Won','Closed Lost','On Hold'];
const SC={Cold:P.gy,Contacted:P.bl,Warm:P.am,'Proposal Sent':P.pu,Negotiating:P.or,'Closed Won':P.gn,'Closed Lost':P.rd,'On Hold':P.tm};
const INDS=['Banking & Finance','Technology','Healthcare','Real Estate','FMCG & Retail','Government & Public Sector','Hospitality & Leisure','Logistics & Transport','Energy & Utilities','Insurance','Media & PR','Education','Manufacturing','Recruitment & HR','Other'];
const FSS=['No Response','Interested','Not Relevant','Interview Scheduled','Declined'];
const FC={'No Response':P.gy,'Interested':P.gn,'Not Relevant':P.rd,'Interview Scheduled':P.pu,'Declined':P.or};
const CSS2=['Active','Placed','On Hold','Closed'];
const CC={'Active':P.gn,'Placed':P.vi,'On Hold':P.am,'Closed':P.gy};
const ATS=['Call','Meeting','Float Email','New Lead','Client Signed'];
const ACL={'Call':P.bl,'Meeting':P.pu,'Float Email':P.or,'New Lead':P.gn,'Client Signed':P.ac};
// Consultant list kept as-is for when a second consultant joins again — currently solo-operated by AK.
const CONS=['AK','Tehniyat'];
const CURR=['AED','USD','GBP','EUR','SAR'];
const RS=['Briefed','Shortlisting','CVs Submitted','Interviewing','Offer Stage','Placed','On Hold','Lost','Cancelled'];
const RC={'Briefed':P.gy,'Shortlisting':P.bl,'CVs Submitted':P.pu,'Interviewing':P.am,'Offer Stage':P.or,'Placed':P.gn,'On Hold':P.tm,'Lost':P.rd,'Cancelled':P.tm};
const INS=['Draft','Sent','Paid','Overdue','Pending Clearance','Cleared','Written Off','Waived'];
const IC={'Draft':P.tm,'Sent':P.bl,'Paid':P.gn,'Overdue':P.rd,'Pending Clearance':P.or,'Cleared':P.gn,'Written Off':P.rd,'Waived':P.gy};
const NAV=[{id:'dash',l:'Dashboard',e:'⊞'},{id:'contacts',l:'Pipeline',e:'⊕'},{id:'cands',l:'Candidates',e:'◎'},{id:'floats',l:'Floats',e:'◉'},{id:'activity',l:'BD Activity',e:'◈'},{id:'meets',l:'Meetings',e:'◆'},{id:'clients',l:'Clients',e:'⊗'}];
const STAGE_ORDER={Cold:0,Contacted:1,Warm:2,'Proposal Sent':3,Negotiating:4,'Closed Won':5,'Closed Lost':6,'On Hold':7};
const FLOAT_TO_STAGE={'Interested':'Warm','Interview Scheduled':'Proposal Sent'};

const fmtDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const realTod=()=>fmtDate(new Date());
const parseD=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return fmtDate(d);};
function wkStart(s){const dt=parseD(s||realTod());const dy=dt.getDay();return addDays(fmtDate(dt),dy===0?-6:1-dy);}
const wkDays=ws=>Array.from({length:7},(_,i)=>addDays(ws,i));
// Zero-pads any YYYY-M-D style date to YYYY-MM-DD, AND converts DD/MM/YYYY
// (or D/M/YYYY) style dates — e.g. "31/03/2026" — to ISO. Dates are compared
// as plain strings everywhere in this app, so any date not in strict
// YYYY-MM-DD sorts unpredictably: "31/03/2026" starts with "3", which sorts
// AFTER "2026-08-01" alphabetically, so it silently leaks into "this month"
// even though it's March. Every date entering the app — on load, on
// restore, on manual entry — runs through this first.
const normD=s=>{
  if(!s||typeof s!=='string')return s;
  const t=s.trim();
  const iso=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(iso)return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
  // DD/MM/YYYY or D/M/YYYY — your data's source format.
  const slash=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(slash){
    const day=slash[1],mon=slash[2],yr=slash[3];
    return `${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return t;
};
const moStartOf=s=>{const[y,m]=s.split('-');return`${y}-${m}-01`;};
const gid=()=>Math.random().toString(36).slice(2,9);
const migC=c=>{
  const base={phone2:'',stage:'Cold',callLog:[],...c};
  return{
    ...base,
    lastContact:normD(base.lastContact),
    nextFollowUp:normD(base.nextFollowUp),
    callLog:(base.callLog||[]).map(e=>({...e,date:normD(e.date)}))
  };
};
const newCo=()=>({id:gid(),name:'',title:'',company:'',industry:'',phone:'',phone2:'',email:'',stage:'Cold',lastContact:'',nextFollowUp:'',notes:'',nextSteps:'',callLog:[],createdAt:new Date().toISOString()});
const newCa=()=>({id:gid(),name:'',currentRole:'',currentCompany:'',availability:'Immediate',salaryExpectation:'',currency:'AED',nationality:'',status:'Active',notes:'',consultant:'AK',createdAt:new Date().toISOString()});
const newFl=()=>({id:gid(),candidateId:'',candidateName:'',companyName:'',contactName:'',dateSent:realTod(),responseStatus:'No Response',notes:'',consultant:'AK'});
const newCl=()=>({id:gid(),company:'',address:'',contactName:'',contactTitle:'',feeFirst:'',feeSubsequent:'',paymentTerms:'30 Days',contractDate:'',contractLink:'',roles:[],invoices:[],notes:'',createdAt:new Date().toISOString()});
const newRo=()=>({id:gid(),title:'',status:'Briefed',cvsSubmitted:0,notes:'',consultant:'',contactPerson:'',candidateName:'',salary:'',currency:'AED',placementFee:''});
const newIn=()=>({id:gid(),invoiceNumber:'',roleTitle:'',candidateName:'',amount:'',currency:'AED',dateIssued:'',dateDue:'',datePaid:'',status:'Draft',link:'',items:[]});
const newInvItem=()=>({id:gid(),desc:'',amount:''});

// Fixed letterhead details — same on every invoice. Edit here if any of
// these change (bank details, address, etc.)
const COMPANY={
  name:'Abdulla Khan',firm:'Stratium Partners',
  addr1:'Shams Business Center, Sharjah',addr2:'Media City, Sharjah, UAE',
  phone:'+971 56 219 9957',email:'abdulla.khan@stratiumpartners.co',trl:'253529201',
  website:'Stratiumpartners.co',infoEmail:'info@stratiumpartners.co',
  bankAccountName:'Stratium Partners LLC',bankName:'WIO Bank',
  bankAddress:'Etihad Airways Centre 5th Floor, Abu Dhabi, UAE',
  bic:'WIOBAEADXXX',iban:'AE520860000009358677862',
};

function ordinalDate(iso){
  if(!iso)return '';
  const d=parseD(iso);
  const day=d.getDate();
  const suf=(day%10===1&&day!==11)?'st':(day%10===2&&day!==12)?'nd':(day%10===3&&day!==13)?'rd':'th';
  const month=d.toLocaleDateString('en-GB',{month:'long'});
  return `${day}${suf} ${month} ${d.getFullYear()}`;
}

function loadImg(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    img.src=src;
  });
}

// Builds and downloads an invoice PDF matching Stratium Partners' actual
// letterhead template: logo top-right, sender/bill-to blocks, an itemized
// fee table (supports a concession line + total, same as the real invoices),
// payment terms, bank details, and the branded footer band.
async function downloadInvoicePDF(client, inv){
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const ac=[196,133,122];
  const dark=[30,30,34];
  const gray=[110,110,116];
  const W=595;
  let y=42;

  try{
    const img=await loadImg(logo);
    doc.addImage(img,'PNG',497,y,50,48);
  }catch{/* logo optional — invoice still generates without it */}
  doc.setFont('times','bold');doc.setFontSize(13);doc.setTextColor(...dark);
  doc.text('STRATIUM PARTNERS',547,y+62,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(...ac);
  doc.text('YOUR STRATEGIC EDGE',547,y+72,{align:'right',charSpace:1});

  y=96;
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...dark);
  doc.text(`INVOICE: ${inv.invoiceNumber||'—'}`,48,y);
  doc.setFont('helvetica','normal');
  doc.text(`TRL: ${COMPANY.trl}`,547,y,{align:'right'});

  y+=34;
  doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text(COMPANY.name,48,y);y+=13;
  doc.text(COMPANY.firm,48,y);y+=13;
  doc.setFont('helvetica','normal');
  doc.text(COMPANY.addr1,48,y);y+=13;
  doc.text(COMPANY.addr2,48,y);y+=13;
  doc.text(COMPANY.phone,48,y);y+=13;
  doc.text(COMPANY.email,48,y);y+=26;

  doc.text(ordinalDate(inv.dateIssued)||'—',48,y);y+=26;

  doc.setFont('helvetica','bold');
  doc.text(client.company||'—',48,y);y+=13;
  doc.setFont('helvetica','normal');
  const addrLines=(client.address||'').split('\n').filter(Boolean);
  addrLines.forEach(line=>{doc.text(line,48,y);y+=13;});
  y+=13;
  doc.text(`Invoice: ${inv.invoiceNumber||'—'}`,48,y);
  y+=24;

  // Itemized fee table
  const items=(inv.items&&inv.items.length)?inv.items:[{desc:inv.roleTitle||'Placement fee',amount:inv.amount}];
  const total=items.reduce((a,it)=>a+(parseFloat(it.amount)||0),0);
  const tblX=48,tblW=499,col2X=tblX+tblW*0.62;
  doc.setDrawColor(60,60,64);
  doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.rect(tblX,y,tblW,24);
  doc.line(col2X,y,col2X,y+24);
  doc.text('Assignment',tblX+tblW*0.31,y+16,{align:'center'});
  doc.text('Fee (AED)',col2X+(tblX+tblW-col2X)/2,y+16,{align:'center'});
  y+=24;
  doc.setFont('helvetica','normal');
  items.forEach(it=>{
    doc.rect(tblX,y,tblW,22);
    doc.line(col2X,y,col2X,y+22);
    doc.text(it.desc||'—',tblX+tblW*0.31,y+15,{align:'center'});
    doc.text(Number(it.amount||0).toLocaleString(),col2X+(tblX+tblW-col2X)/2,y+15,{align:'center'});
    y+=22;
  });
  doc.setFont('helvetica','bold');
  doc.rect(tblX,y,tblW,22);
  doc.line(col2X,y,col2X,y+22);
  doc.text('Total Payable',tblX+tblW*0.31,y+15,{align:'center'});
  doc.text(Number(total).toLocaleString(),col2X+(tblX+tblW-col2X)/2,y+15,{align:'center'});
  y+=50;

  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...dark);
  doc.text('PAYMENT TERMS',W/2,y,{align:'center'});y+=14;
  doc.text(`Pay within ${client.paymentTerms||'30 Days'} from the invoice date`,W/2,y,{align:'center'});y+=26;
  doc.setFont('helvetica','italic');doc.setFontSize(10);
  doc.text('Kindly pay us electronically!',W/2,y,{align:'center'});y+=26;

  doc.setFont('helvetica','bold');
  doc.text('BANK DETAILS',W/2,y,{align:'center'});y+=15;
  doc.setFont('helvetica','normal');
  doc.text(`Account Name: ${COMPANY.bankAccountName}`,W/2,y,{align:'center'});y+=13;
  doc.text(`Bank Name: ${COMPANY.bankName}`,W/2,y,{align:'center'});y+=13;
  doc.text(`Bank Address: ${COMPANY.bankAddress}`,W/2,y,{align:'center'});y+=13;
  doc.setFont('helvetica','italic');
  doc.text(`BIC: ${COMPANY.bic}`,W/2,y,{align:'center'});y+=13;
  doc.text(`IBAN: ${COMPANY.iban}`,W/2,y,{align:'center'});

  // Footer contact line
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...gray);
  doc.text(COMPANY.website,547,772,{align:'right'});
  doc.text(COMPANY.infoEmail,547,784,{align:'right'});

  // Branded bottom band: black block + mauve block with a diagonal seam
  const bandY=800,bandH=42;
  doc.setFillColor(15,15,15);doc.rect(0,bandY,W,bandH,'F');
  doc.setFillColor(...ac);
  doc.triangle(180,bandY,240,bandY,180,bandY+bandH,'F');
  doc.rect(240,bandY,W-240,bandH,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont('helvetica','bold');
  doc.text(COMPANY.addr1,547,bandY+17,{align:'right'});
  doc.text(COMPANY.addr2,547,bandY+31,{align:'right'});

  doc.save(`Invoice_${(inv.invoiceNumber||'draft').replace(/[^\w-]/g,'_')}.pdf`);
}

const newAc=()=>({id:gid(),date:realTod(),type:'Call',contact:'',company:'',outcome:'',nextSteps:'',consultant:'AK'});

const CARD={background:P.wh,border:`1px solid ${P.bo}`,borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'};
const INP={width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${P.bo}`,background:INBG,color:P.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'};
const INP_TA={width:'100%',padding:'9px 12px',borderRadius:8,border:`1px solid ${P.bo}`,background:INBG,color:P.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box',resize:'vertical'};
const TH_S={padding:'10px 14px',textAlign:'left',color:P.ts,fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap',background:PANEL};
const LB_S={fontSize:11,color:P.ts,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.6px',fontWeight:500};
const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:12};
const btp=col=>({padding:'9px 18px',borderRadius:8,border:'none',background:col||P.ac,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit'});
const bts=()=>({padding:'9px 18px',borderRadius:8,border:`1px solid ${P.bo}`,background:'transparent',color:P.ts,cursor:'pointer',fontSize:13,fontFamily:'inherit'});
const btsm=col=>({padding:'4px 10px',borderRadius:6,border:`1px solid ${(col||P.ts)}35`,background:`${(col||P.ts)}08`,color:col||P.ts,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:600});

const Bge=({l,c})=><span style={{display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:600,background:`${c||P.gy}18`,color:c||P.gy,border:`1px solid ${c||P.gy}35`,whiteSpace:'nowrap'}}>{l}</span>;

function ISel({value,opts,cm,onSave}){
  const[ed,setEd]=useState(false);
  const color=(cm||{})[value]||P.ts;
  if(!ed)return <span onClick={()=>setEd(true)} style={{cursor:'pointer'}}><Bge l={value||'—'} c={color}/></span>;
  return <select autoFocus value={value||''} onChange={e=>{onSave(e.target.value);setEd(false);}} onBlur={()=>setEd(false)} style={{border:`1px solid ${P.ac}`,borderRadius:6,padding:'4px 8px',fontSize:12,outline:'none',background:INBG,color:P.tx}}>{(opts||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>;
}
function IDt({value,onSave,today}){
  const[ed,setEd]=useState(false);
  const t=today;const od=value&&value<t;const isT=value===t;
  if(!ed)return <span onClick={()=>setEd(true)} style={{cursor:'pointer',fontSize:12,color:od?P.rd:isT?P.or:value?P.tx:P.tm,fontWeight:(od||isT)?600:400,borderBottom:'1px dashed FAINT'}}>{value||'—'}{od?' ⚠':isT?' 🔔':''}</span>;
  return <input type="date" autoFocus value={value||''} onChange={e=>{onSave(e.target.value);setEd(false);}} onBlur={()=>setEd(false)} style={{border:`1px solid ${P.ac}`,borderRadius:6,padding:'3px 7px',fontSize:12,outline:'none'}}/>;
}
function ITx({value,onSave,ph,ml}){
  const[ed,setEd]=useState(false);const[v,sv]=useState(value||'');
  useEffect(()=>{if(!ed)sv(value||'');},[value,ed]);
  const save=()=>{onSave(v);setEd(false);};
  const st={border:`1px solid ${P.ac}`,borderRadius:6,padding:'4px 8px',fontSize:12,fontFamily:'inherit',outline:'none',background:INBG,color:P.tx,width:'100%'};
  if(!ed)return <span onClick={()=>setEd(true)} title="Click to edit" style={{cursor:'pointer',color:value?'inherit':P.tm,borderBottom:'1px dashed FAINT',fontSize:12}}>{value||ph||'—'}</span>;
  if(ml)return <textarea autoFocus value={v} onChange={e=>sv(e.target.value)} onBlur={save} rows={2} style={st}/>;
  return <input autoFocus value={v} onChange={e=>sv(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')setEd(false);}} style={st}/>;
}
function Stat({lbl,val,sub,col}){return <div style={{...CARD,padding:'18px 20px'}}><div style={{fontSize:28,fontWeight:700,color:col||P.ac,lineHeight:1}}>{val}</div><div style={{fontSize:12,color:P.ts,marginTop:6,fontWeight:500}}>{lbl}</div>{sub&&<div style={{fontSize:11,color:P.tm,marginTop:2}}>{sub}</div>}</div>;}
function Mod({title,onX,wide,children}){return(
  <div onClick={e=>{if(e.target===e.currentTarget)onX();}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,backdropFilter:'blur(4px)'}}>
    <div style={{background:P.wh,border:`1px solid ${P.bo}`,borderRadius:16,padding:28,width:'100%',maxWidth:wide?720:560,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.5)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
        <div style={{fontSize:18,fontWeight:700,color:P.tx}}>{title}</div>
        <button onClick={onX} style={{background:'none',border:'none',cursor:'pointer',color:P.ts,fontSize:22,lineHeight:1,padding:'0 4px'}}>×</button>
      </div>
      {children}
    </div>
  </div>
);}

/* ── Contact History Modal (module level so it always reads fresh contacts state) ── */
function HistoryModal({cid,contacts,onX}){
  const c=contacts.find(x=>x.id===cid);
  if(!c)return null;
  const log=c.callLog||[];
  return(
    <Mod title={`History · ${c.name}`} onX={onX}>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <span style={{fontSize:13,color:P.ts}}>{c.company}{c.title?` · ${c.title}`:''}</span>
        <Bge l={c.stage} c={SC[c.stage]||P.ts}/>
      </div>
      {!log.length
        ?<div style={{color:P.tm,fontStyle:'italic',textAlign:'center',padding:32}}>No conversations yet. Use 📞 on the Pipeline row to log a call.</div>
        :<div style={{maxHeight:440,overflowY:'auto'}}>
          {log.map((e,i,arr)=>(
            <div key={e.id||i} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:i<arr.length-1?`1px solid ${P.bo}`:'none',alignItems:'flex-start'}}>
              <div style={{flexShrink:0,width:85}}>
                <div style={{fontSize:12,fontWeight:600,color:P.tx}}>{e.date}</div>
                <div style={{fontSize:10,color:P.tm,marginTop:2}}>{e.consultant||'AK'}</div>
              </div>
              <div style={{flex:1}}>
                {e.stage&&<div style={{marginBottom:4}}><Bge l={e.stage} c={SC[e.stage]||P.ts}/></div>}
                {e.notes&&<div style={{fontSize:12,color:P.ts,marginBottom:3}}>{e.notes}</div>}
                {e.nextSteps&&<div style={{fontSize:12,color:P.ac}}>→ {e.nextSteps}</div>}
              </div>
            </div>
          ))}
        </div>
      }
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
        <button style={bts()} onClick={onX}>Close</button>
      </div>
    </Mod>
  );
}

export default function App(){
  const[contacts,setContacts]=useState([]);
  const[clients,setClients]=useState([]);
  const[cands,setCands]=useState([]);
  const[floats,setFloats]=useState([]);
  const[activity,setActivity]=useState([]);
  const[targets,setTargets]=useState({calls:20,floats:10,meetings:5,leads:5,revenue:50000});
  const[dateOverride,setDateOverride]=useState('');
  const[loaded,setLoaded]=useState(false);
  const[tab,setTab]=useState('dash');
  const[toast,setToast]=useState(null);
  const[mobile,setMobile]=useState(window.innerWidth<768);
  const[coM,setCoM]=useState(null);const[coF,setCoF]=useState(newCo());
  const[caM,setCaM]=useState(null);const[caF,setCaF]=useState(newCa());
  const[flM,setFlM]=useState(null);const[flF,setFlF]=useState(newFl());
  const[clM,setClM]=useState(null);const[clF,setClF]=useState(newCl());
  const[acM,setAcM]=useState(false);const[acF,setAcF]=useState(newAc());
  const[lgM,setLgM]=useState(null);
  const[lgF,setLgF]=useState({date:realTod(),stage:'Cold',nextSteps:'',notes:'',consultant:'AK',nextFollowUp:''});
  const[histModal,setHistModal]=useState(null);
  const[repM,setRepM]=useState(false);
  const[expD,setExpD]=useState(null);
  const[conf,setConf]=useState(null);
  const[csrch,setCsrch]=useState('');const[cstg,setCstg]=useState('All');const[cind,setCind]=useState('All');
  const[gq,setGq]=useState('');const[gOpen,setGOpen]=useState(false);
  const[pView,setPView]=useState('board');
  const[dragId,setDragId]=useState(null);
  const[asrch,setAsrch]=useState('');const[ast,setAst]=useState('All');
  const[fsrch,setFsrch]=useState('');const[fst,setFst]=useState('All');
  const[actW,setActW]=useState(()=>wkStart(realTod()));
  const[actT,setActT]=useState('All');const[actC,setActC]=useState('All');
  const[mtT,setMtT]=useState('All');
  const[meetRange,setMeetRange]=useState('month');
  const[meetFrom,setMeetFrom]=useState(()=>addDays(realTod(),-30));
  const[meetTo,setMeetTo]=useState(realTod);
  const[tgEdit,setTgEdit]=useState({calls:20,floats:10,meetings:5,leads:5,revenue:50000});
  const jsonRef=useRef();

  useEffect(()=>{const h=()=>setMobile(window.innerWidth<768);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[]);

  // Real-time clock tick — forces the app to re-derive "today" every minute so the
  // calendar, week view and month filters roll over live without a page refresh.
  const[,setTick]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setTick(t=>t+1),60000);return()=>clearInterval(iv);},[]);

  useEffect(()=>{(async()=>{
    const load=async(key,def)=>{try{const r=await storage.get(key);return(r&&r.value)?JSON.parse(r.value):(def||[]);}catch{return def||[];}};
    const loadedContacts=(await load(K.co)).map(migC);
    const loadedFloats=(await load(K.fl)).map(f=>({...f,dateSent:normD(f.dateSent)}));
    const loadedActivity=(await load(K.ac)).map(a=>({...a,date:normD(a.date)}));
    setContacts(loadedContacts);
    setClients((await load(K.cl)).map(c=>({invoices:[],roles:[],...c})));
    setCands(await load(K.ca));setFloats(loadedFloats);setActivity(loadedActivity);
    // Self-heal: if anything needed re-padding, write the corrected version straight back
    // so the fix persists and "This Month" etc. are correct from the very next load too.
    persist(K.co,loadedContacts);persist(K.fl,loadedFloats);persist(K.ac,loadedActivity);
    const tg=await load(K.tg,{calls:20,floats:10,meetings:5,leads:5,revenue:50000});setTargets({revenue:50000,...tg});setTgEdit({revenue:50000,...tg});
    const dt=await load(K.dt,'');setDateOverride(typeof dt==='string'?dt:'');
    setLoaded(true);
  })();},[]);

  const persist=(key,data)=>storage.set(key,JSON.stringify(data)).catch(err=>{
    console.error('Save failed for',key,err);
    setToast({msg:'⚠ Save failed — check your connection, then retry that change',t:'err'});
  });
  const saveCo=d=>{setContacts(d);persist(K.co,d);};const saveCl=d=>{setClients(d);persist(K.cl,d);};
  const saveCa=d=>{setCands(d);persist(K.ca,d);};const saveFl=d=>{setFloats(d);persist(K.fl,d);};
  const saveAc=d=>{setActivity(d);persist(K.ac,d);};const saveTg=d=>{setTargets(d);persist(K.tg,d);};
  const saveDt=d=>{setDateOverride(d);persist(K.dt,d);};
  const toast$=(msg,t)=>{setToast({msg,t:t||'ok'});setTimeout(()=>setToast(null),3200);};

  // T is the single source of truth for "today" everywhere in the app. It's the real
  // system date unless a manual override is set in Reports & Data (for when a device
  // clock is wrong). Re-derived on every render + the 60s tick above, so it's live.
  const sysT=realTod();
  const T=(dateOverride&&/^\d{4}-\d{2}-\d{2}$/.test(dateOverride))?dateOverride:sysT;
  const WS=wkStart(T);const WD=wkDays(WS);const MS=moStartOf(T);const AWD=wkDays(actW);

  const activeC=contacts.filter(c=>!['Closed Won','Closed Lost'].includes(c.stage));
  const overdue=contacts.filter(c=>c.nextFollowUp&&c.nextFollowUp<=T).sort((a,b)=>a.nextFollowUp.localeCompare(b.nextFollowUp));
  const activeCa=cands.filter(c=>c.status==='Active');
  const floatsWk=floats.filter(f=>f.dateSent>=WD[0]&&f.dateSent<=WD[6]);
  const callsWk=activity.filter(a=>a.type==='Call'&&a.date>=WD[0]&&a.date<=WD[6]);
  const mtgsMo=activity.filter(a=>a.type==='Meeting'&&a.date>=MS);
  const callsMo=activity.filter(a=>a.type==='Call'&&a.date>=MS);
  const floatsMo=floats.filter(f=>f.dateSent>=MS);
  const allInvoices=clients.flatMap(cl=>(cl.invoices||[]).map(i=>({...i,company:cl.company})));
  const invoicedMo=allInvoices.filter(i=>i.dateIssued&&i.dateIssued>=MS).reduce((a,i)=>a+(+i.amount||0),0);
  const collectedMo=allInvoices.filter(i=>['Paid','Cleared'].includes(i.status)&&i.datePaid&&i.datePaid>=MS).reduce((a,i)=>a+(+i.amount||0),0);
  const gqL=gq.trim().toLowerCase();
  const gRes=gqL.length<2?{co:[],ca:[],fl:[],cl:[]}:{
    co:contacts.filter(c=>[c.name,c.company,c.title].some(f=>f&&f.toLowerCase().includes(gqL))).slice(0,5),
    ca:cands.filter(c=>[c.name,c.currentCompany,c.currentRole].some(f=>f&&f.toLowerCase().includes(gqL))).slice(0,5),
    fl:floats.filter(f=>[f.candidateName,f.companyName,f.contactName].some(x=>x&&x.toLowerCase().includes(gqL))).slice(0,5),
    cl:clients.filter(c=>[c.company,c.contactName].some(f=>f&&f.toLowerCase().includes(gqL))).slice(0,5),
  };
  const gHasResults=gRes.co.length||gRes.ca.length||gRes.fl.length||gRes.cl.length;

  const filtCo=contacts.filter(c=>{const q=csrch.toLowerCase();const m=!q||[c.name,c.company,c.title,c.email,c.notes,c.nextSteps].some(f=>f&&f.toLowerCase().includes(q));return m&&(cstg==='All'||c.stage===cstg)&&(cind==='All'||c.industry===cind);});
  const filtCa=cands.filter(c=>{const q=asrch.toLowerCase();const m=!q||[c.name,c.currentRole,c.currentCompany,c.nationality].some(f=>f&&f.toLowerCase().includes(q));return m&&(ast==='All'||c.status===ast);});
  const filtFl=floats.filter(f=>{const q=fsrch.toLowerCase();const m=!q||[f.candidateName,f.companyName,f.contactName].some(x=>x&&x.toLowerCase().includes(q));return m&&(fst==='All'||f.responseStatus===fst);}).sort((a,b)=>b.dateSent.localeCompare(a.dateSent));
  const filtAc=activity.filter(a=>(actT==='All'||a.type===actT)&&(actC==='All'||a.consultant===actC)&&a.date>=AWD[0]&&a.date<=AWD[6]).sort((a,b)=>b.date.localeCompare(a.date));
  const meetLog=activity.filter(a=>['Call','Meeting'].includes(a.type)&&(mtT==='All'||a.type===mtT)).sort((a,b)=>b.date.localeCompare(a.date));
  const filtMeet=meetLog.filter(a=>{
    if(meetRange==='today')return a.date===T;
    if(meetRange==='week')return a.date>=WD[0]&&a.date<=WD[6];
    if(meetRange==='month')return a.date>=MS;
    if(meetRange==='custom')return a.date>=meetFrom&&a.date<=meetTo;
    return true;
  });
  const actCnt=type=>activity.filter(a=>a.type===type&&a.date>=AWD[0]&&a.date<=AWD[6]&&(actC==='All'||a.consultant===actC)).length;

  const updCo=(id,f,v)=>saveCo(contacts.map(c=>c.id===id?{...c,[f]:v}:c));
  const updCa=(id,f,v)=>saveCa(cands.map(c=>c.id===id?{...c,[f]:v}:c));
  const delOk=(name,fn)=>setConf({name,fn});

  /* ── Float → Pipeline link helper ── */
  const matchContact=fl=>{
    const coKey=(fl.companyName||'').toLowerCase().trim();
    const ctKey=(fl.contactName||'').toLowerCase().trim();
    let m=null;
    if(ctKey)m=contacts.find(c=>(c.company||'').toLowerCase().trim()===coKey&&(c.name||'').toLowerCase().trim()===ctKey);
    if(!m&&coKey){const hits=contacts.filter(c=>(c.company||'').toLowerCase().trim()===coKey);if(hits.length===1)m=hits[0];}
    return m;
  };

  const updFl=(id,field,val)=>{
    saveFl(floats.map(fl=>fl.id===id?{...fl,[field]:val}:fl));
    if(field!=='responseStatus')return;
    const fl=floats.find(f=>f.id===id);if(!fl)return;
    const isPos=['Interested','Interview Scheduled'].includes(val);
    saveAc([{id:gid(),date:T,type:'Float Email',contact:fl.contactName||fl.companyName||'',company:fl.companyName||'',outcome:`Float response: ${val} — ${fl.candidateName}`,nextSteps:isPos?`Follow up — ${fl.companyName} is ${val.toLowerCase()}`:'',consultant:fl.consultant||'AK'},...activity]);

    let matched=matchContact(fl);

    // If there's now a real response/conversation happening and no Pipeline record
    // exists yet, create one automatically so it can be tracked going forward.
    if(!matched&&isPos&&fl.companyName){
      const stage=FLOAT_TO_STAGE[val]||'Warm';
      const nextSteps=`Follow up — ${fl.companyName} is ${val.toLowerCase()}`;
      const logEntry={id:gid(),date:T,stage,nextSteps,notes:`Float response — ${val}: ${fl.candidateName} floated to ${fl.companyName}`,consultant:fl.consultant||'AK'};
      const created={...newCo(),name:fl.contactName||'(Contact TBC)',company:fl.companyName,stage,nextSteps,lastContact:T,callLog:[logEntry]};
      saveCo([created,...contacts]);
      toast$(`✓ New Pipeline contact created — ${created.name} · ${stage}`);
      return;
    }
    if(!matched){toast$(`Float logged · add "${fl.companyName||'this company'}" to Pipeline to enable auto-stage updates`);return;}
    const targetStage=FLOAT_TO_STAGE[val];
    const upgrade=targetStage&&(STAGE_ORDER[targetStage]||0)>(STAGE_ORDER[matched.stage]||0);
    const newStage=upgrade?targetStage:matched.stage;
    const logEntry={id:gid(),date:T,stage:newStage,nextSteps:isPos?`Follow up — ${fl.companyName} is ${val.toLowerCase()}`:'',notes:`Float response — ${val}: ${fl.candidateName} floated to ${fl.companyName}`,consultant:fl.consultant||'AK'};
    const updatedLog=[logEntry,...(matched.callLog||[])].sort((a,b)=>b.date.localeCompare(a.date));
    saveCo(contacts.map(c=>c.id!==matched.id?c:{...c,stage:newStage,lastContact:T,nextSteps:isPos?(c.nextSteps||`Follow up — ${fl.companyName} is ${val.toLowerCase()}`):c.nextSteps,callLog:updatedLog}));
    toast$(`✓ ${matched.name}${upgrade?` → ${newStage}`:''}  · logged in Pipeline & Meetings`);
  };

  const saveCoF=()=>{if(!coF.name.trim()){toast$('Name required','err');return;}const u=coM==='add'?[{...coF,id:gid(),createdAt:new Date().toISOString()},...contacts]:contacts.map(c=>c.id===coF.id?coF:c);saveCo(u);setCoM(null);toast$(coM==='add'?'Contact added':'Contact updated');};
  const saveCaF=()=>{if(!caF.name.trim()){toast$('Name required','err');return;}const u=caM==='add'?[{...caF,id:gid(),createdAt:new Date().toISOString()},...cands]:cands.map(c=>c.id===caF.id?caF:c);saveCa(u);setCaM(null);toast$(caM==='add'?'Candidate added':'Candidate updated');};

  const saveFlF=()=>{
    if(!flF.candidateName||!flF.companyName){toast$('Candidate and company required','err');return;}
    const u=flM==='add'?[{...flF,id:gid()},...floats]:floats.map(f=>f.id===flF.id?flF:f);
    saveFl(u);setFlM(null);
    if(flM==='add'){
      // Every float logs to BD Activity, regardless of whether the company is in Pipeline yet.
      saveAc([{id:gid(),date:flF.dateSent||T,type:'Float Email',contact:flF.contactName||flF.companyName||'',company:flF.companyName||'',outcome:`Float sent: ${flF.candidateName} to ${flF.companyName}`,nextSteps:'Await float response',consultant:flF.consultant||'AK'},...activity]);
      const matched=matchContact(flF);
      if(matched){
        const logEntry={id:gid(),date:flF.dateSent||T,stage:matched.stage,nextSteps:'Await float response',notes:`Float sent: ${flF.candidateName} to ${flF.companyName}`,consultant:flF.consultant||'AK'};
        const updatedLog=[logEntry,...(matched.callLog||[])].sort((a,b)=>b.date.localeCompare(a.date));
        saveCo(contacts.map(c=>c.id!==matched.id?c:{...c,lastContact:flF.dateSent||T,callLog:updatedLog}));
        toast$(`✓ Float sent · logged on ${matched.name} in Pipeline`);
      }else{toast$('✓ Float sent · logged in BD Activity');}
    }else{toast$('Float updated');}
  };

  const saveAcF=()=>{saveAc([{...acF,id:gid()},...activity]);setAcF(newAc());setAcM(false);toast$('Activity logged');};

  const saveLog=()=>{
    if(!lgM)return;
    const entry={id:gid(),date:lgF.date,stage:lgF.stage,nextSteps:lgF.nextSteps,notes:lgF.notes,consultant:lgF.consultant};
    const updated=contacts.map(c=>{if(c.id!==lgM.id)return c;const nl=[entry,...(c.callLog||[])].sort((a,b)=>b.date.localeCompare(a.date));return{...c,stage:lgF.stage,nextSteps:lgF.nextSteps,nextFollowUp:lgF.nextFollowUp,lastContact:nl[0].date,callLog:nl};});
    saveCo(updated);
    saveAc([{id:gid(),date:lgF.date,type:'Call',contact:lgM.name,company:lgM.company||'',outcome:lgF.notes||'',nextSteps:lgF.nextSteps||'',consultant:lgF.consultant},...activity]);
    setLgM(null);toast$('Call logged');
  };

  const saveClF=()=>{if(!clF.company.trim()){toast$('Company required','err');return;}const u=clM==='add'?[{...clF,id:gid(),createdAt:new Date().toISOString()},...clients]:clients.map(c=>c.id===clF.id?clF:c);saveCl(u);setClM(null);toast$(clM==='add'?'Client added':'Client updated');};
  const addRole=()=>setClF(f=>({...f,roles:[...f.roles,newRo()]}));
  const updRole=(rid,fld,val)=>setClF(f=>({...f,roles:f.roles.map(r=>{if(r.id!==rid)return r;const u={...r,[fld]:val};if(fld==='salary'&&val){const pct=parseFloat(f.feeFirst)||0;if(pct)u.placementFee=Math.round(parseFloat(val)*12*pct/100);}return u;})}));
  const delRole=rid=>setClF(f=>({...f,roles:f.roles.filter(r=>r.id!==rid)}));
  const addInv=()=>setClF(f=>({...f,invoices:[...(f.invoices||[]),newIn()]}));

  // Generates an invoice straight from a Placed role — pulls candidate, fee
  // and currency off the role itself, seeds it as the first line item (so
  // you can add a concession row after), and immediately downloads the PDF.
  // Invoice number is left blank — your numbering sequence (0106, 0107...)
  // isn't tracked in the app, so it's yours to set to avoid a collision.
  const genInvoiceForRole=(cl,role)=>{
    const inv={...newIn(),roleTitle:role.title,candidateName:role.candidateName,amount:role.placementFee||'',currency:role.currency||'AED',dateIssued:T,status:'Draft',items:[{...newInvItem(),desc:role.title||'Placement fee',amount:role.placementFee||''}]};
    const updatedClient={...cl,invoices:[...(cl.invoices||[]),inv]};
    saveCl(clients.map(c=>c.id===cl.id?updatedClient:c));
    setClF({...updatedClient,roles:(updatedClient.roles||[]).map(r=>({...r})),invoices:(updatedClient.invoices||[]).map(i=>({...i,items:(i.items||[]).map(it=>({...it}))}))});
    setClM('edit');
    toast$(`✓ Invoice draft added — set the invoice number below, then click PDF`);
  };
  const updInv=(iid,fld,val)=>setClF(f=>({...f,invoices:(f.invoices||[]).map(i=>i.id===iid?{...i,[fld]:val}:i)}));
  const delInv=iid=>setClF(f=>({...f,invoices:(f.invoices||[]).filter(i=>i.id!==iid)}));
  const addInvItem=invId=>setClF(f=>({...f,invoices:f.invoices.map(inv=>inv.id!==invId?inv:{...inv,items:[...(inv.items||[]),newInvItem()]})}));
  const updInvItem=(invId,itemId,field,val)=>setClF(f=>({...f,invoices:f.invoices.map(inv=>{
    if(inv.id!==invId)return inv;
    const items=(inv.items||[]).map(it=>it.id===itemId?{...it,[field]:val}:it);
    const total=items.reduce((a,it)=>a+(parseFloat(it.amount)||0),0);
    return {...inv,items,amount:items.length?total:inv.amount};
  })}));
  const delInvItem=(invId,itemId)=>setClF(f=>({...f,invoices:f.invoices.map(inv=>{
    if(inv.id!==invId)return inv;
    const items=(inv.items||[]).filter(it=>it.id!==itemId);
    const total=items.reduce((a,it)=>a+(parseFloat(it.amount)||0),0);
    return {...inv,items,amount:items.length?total:inv.amount};
  })}));

  /* ── Consultant reassignment ── everything historical is folded onto AK,
     since Stratium is currently a solo BD desk. The Consultant field/selector
     stays in every form for when a second consultant is back on board. ── */
  const reassignAllToAK=()=>{
    const co2=contacts.map(c=>({...c,callLog:(c.callLog||[]).map(e=>({...e,consultant:'AK'}))}));
    const ca2=cands.map(c=>({...c,consultant:'AK'}));
    const fl2=floats.map(f=>({...f,consultant:'AK'}));
    const ac2=activity.map(a=>({...a,consultant:'AK'}));
    const cl2=clients.map(cl=>({...cl,roles:(cl.roles||[]).map(r=>({...r,consultant:r.consultant?'AK':r.consultant}))}));
    saveCo(co2);saveCa(ca2);saveFl(fl2);saveAc(ac2);saveCl(cl2);
    toast$('✓ All existing data reassigned to AK');
  };

  const dedupeActivity=()=>{
    const seen=new Set();
    const deduped=activity.filter(a=>{
      const key=`${a.date}|${(a.contact||'').toLowerCase().trim()}|${a.type}|${(a.outcome||'').slice(0,40).toLowerCase().trim()}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
    const removed=activity.length-deduped.length;
    saveAc(deduped);
    toast$(`✓ Removed ${removed} duplicate${removed!==1?'s':''} from Meetings Log`);
  };

  const dedupeCallLogs=()=>{
    let total=0;
    const updated=contacts.map(c=>{
      if(!(c.callLog||[]).length)return c;
      const seen=new Set();
      const deduped=(c.callLog||[]).filter(e=>{
        const key=`${e.date}|${(e.notes||'').slice(0,40).toLowerCase().trim()}|${e.consultant||''}`;
        if(seen.has(key))return false;seen.add(key);return true;
      });
      total+=c.callLog.length-deduped.length;
      return{...c,callLog:deduped};
    });
    saveCo(updated);
    toast$(`✓ Removed ${total} duplicate${total!==1?'s':''} from contact histories`);
  };

  // Re-runs normD across every date field currently loaded — for data that was
  // already sitting in the CRM (e.g. pasted in manually) before the DD/MM/YYYY
  // parsing fix, so it doesn't require re-restoring a backup to get corrected.
  const fixAllDatesNow=()=>{
    let fixed=0;
    const track=v=>{const n=normD(v);if(n!==v&&v)fixed++;return n;};
    const co2=contacts.map(c=>({...c,lastContact:track(c.lastContact),nextFollowUp:track(c.nextFollowUp),callLog:(c.callLog||[]).map(e=>({...e,date:track(e.date)}))}));
    const fl2=floats.map(f=>({...f,dateSent:track(f.dateSent)}));
    const ac2=activity.map(a=>({...a,date:track(a.date)}));
    const cl2=clients.map(cl=>({...cl,contractDate:track(cl.contractDate),invoices:(cl.invoices||[]).map(i=>({...i,dateIssued:track(i.dateIssued),dateDue:track(i.dateDue),datePaid:track(i.datePaid)}))}));
    saveCo(co2);saveFl(fl2);saveAc(ac2);saveCl(cl2);
    toast$(fixed?`✓ Fixed ${fixed} date${fixed!==1?'s':''} — This Month / This Week views should be accurate now`:'✓ All dates already in the correct format');
  };

  const handleRestore=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        // Every restored record — regardless of who it says logged it (e.g. "T") —
        // is force-attributed to AK, since Stratium is solo-operated now.
        const rc=d.contacts?d.contacts.map(c=>({...migC(c),callLog:(migC(c).callLog||[]).map(en=>({...en,consultant:'AK'}))})):null;
        if(rc)saveCo(rc);
        if(d.clients)saveCl(d.clients.map(c=>({invoices:[],...c,roles:(c.roles||[]).map(r=>({...r,consultant:r.consultant?'AK':r.consultant}))})));
        if(d.candidates)saveCa(d.candidates.map(c=>({...c,consultant:'AK'})));
        if(d.floats)saveFl(d.floats.map(f=>({...f,dateSent:normD(f.dateSent),consultant:'AK'})));
        if(d.targets){saveTg(d.targets);setTgEdit({...d.targets});}
        const callsFromLogs=(rc||[]).flatMap(c=>(c.callLog||[]).filter(en=>en&&en.date).map(en=>({id:en.id||gid(),date:normD(en.date),type:'Call',contact:c.name||'',company:c.company||'',outcome:en.notes||'',nextSteps:en.nextSteps||'',consultant:'AK'})));
        const otherAc=(Array.isArray(d.activity)?d.activity:[]).filter(a=>a.type!=='Call').map(a=>({...a,date:normD(a.date),consultant:'AK'}));
        saveAc([...callsFromLogs,...otherAc].sort((a,b)=>b.date.localeCompare(a.date)));
        setRepM(false);setTab('meets');
        toast$(`✓ Restored — ${(rc||[]).length} contacts · ${callsFromLogs.length} calls · all attributed to AK`);
      }catch(err){console.error(err);toast$('Invalid backup file','err');}
    };
    r.readAsText(file);e.target.value='';
  };

  const navItem=n=>{const active=tab===n.id;return(
    <div key={n.id} onClick={()=>setTab(n.id)} style={{display:'flex',alignItems:'center',gap:10,padding:mobile?'6px 0':'10px 14px',borderRadius:8,cursor:'pointer',background:active?`${P.ac}18`:'transparent',color:active?P.ac:P.ts,fontWeight:active?600:400,fontSize:mobile?9:13,flexDirection:mobile?'column':'row',flex:mobile?1:undefined,justifyContent:mobile?'center':undefined,userSelect:'none'}}>
      <span style={{fontSize:mobile?17:14}}>{n.e}</span><span style={{whiteSpace:'nowrap'}}>{n.l}</span>
    </div>
  );};

  if(!loaded)return <div style={{background:P.bg,height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}><img src={logo} alt="Stratium" style={{width:52,height:52}}/><div style={{fontSize:22,fontWeight:700,color:P.ac,letterSpacing:'3px',fontFamily:SERIF}}>STRATIUM</div><div style={{color:P.tm,fontSize:12}}>LOADING...</div></div>;

  const companyOptions=[...new Set(contacts.map(c=>c.company).filter(Boolean))].sort();
  const contactOptionsForCompany=flF.companyName?contacts.filter(c=>c.name&&c.company&&c.company.toLowerCase().trim()===flF.companyName.toLowerCase().trim()):[];
  const floatLinked=flF.companyName&&contacts.some(c=>(c.company||'').toLowerCase().trim()===(flF.companyName||'').toLowerCase().trim());

  return(
    <div style={{display:'flex',flexDirection:mobile?'column':'row',height:'100vh',background:P.bg,fontFamily:"'DM Sans',-apple-system,sans-serif",color:P.tx,fontSize:13}}>

      {!mobile&&<aside style={{width:195,background:P.wh,borderRight:`1px solid ${P.bo}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
        <div style={{padding:'22px 18px 16px',borderBottom:`1px solid ${P.bo}`,display:'flex',alignItems:'center',gap:10}}><img src={logo} alt="Stratium" style={{width:30,height:30,flexShrink:0}}/><div><div style={{fontWeight:700,fontSize:19,letterSpacing:'2.5px',color:P.ac,fontFamily:SERIF}}>STRATIUM</div><div style={{fontSize:10,color:P.tm,letterSpacing:'2px',marginTop:1}}>BD CRM</div></div></div>
        <div style={{padding:'10px 8px',flex:1}}>{NAV.map(navItem)}</div>
        <div style={{padding:'8px',borderTop:`1px solid ${P.bo}`}}><div onClick={()=>setRepM(true)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:8,cursor:'pointer',color:P.ts,fontSize:13}}>⊙ Reports & Data</div></div>
      </aside>}

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {mobile&&<div style={{background:P.wh,borderBottom:`1px solid ${P.bo}`,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><img src={logo} alt="Stratium" style={{width:24,height:24,flexShrink:0}}/><div><div style={{fontWeight:700,fontSize:16,letterSpacing:'2px',color:P.ac,fontFamily:SERIF}}>STRATIUM</div><div style={{fontSize:9,color:P.tm,letterSpacing:'2px'}}>BD CRM</div></div></div>
          <button onClick={()=>setRepM(true)} style={{background:'none',border:'none',cursor:'pointer',color:P.ts,fontSize:12}}>⊙ Reports</button>
        </div>}

        <div style={{background:P.wh,borderBottom:`1px solid ${P.bo}`,padding:mobile?'10px 16px':'12px 24px',position:'relative',flexShrink:0}}>
          <input
            value={gq}
            onChange={e=>{setGq(e.target.value);setGOpen(true);}}
            onFocus={()=>setGOpen(true)}
            onBlur={()=>setTimeout(()=>setGOpen(false),150)}
            placeholder="Search contacts, candidates, floats, clients…"
            style={{...INP,maxWidth:420}}
          />
          {gOpen&&gq.trim().length>=2&&<div style={{position:'absolute',top:'100%',left:mobile?16:24,right:mobile?16:'auto',width:mobile?'auto':420,marginTop:4,background:P.wh,border:`1px solid ${P.bo}`,borderRadius:10,boxShadow:'0 12px 32px rgba(0,0,0,0.12)',zIndex:200,maxHeight:360,overflowY:'auto'}}>
            {!gHasResults&&<div style={{padding:16,fontSize:12,color:P.tm,textAlign:'center'}}>No matches.</div>}
            {gRes.co.length>0&&<div><div style={{padding:'8px 12px 4px',fontSize:10,color:P.tm,textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600}}>Pipeline</div>{gRes.co.map(c=><div key={c.id} onMouseDown={()=>{setTab('contacts');setHistModal(c.id);setGq('');setGOpen(false);}} style={{padding:'8px 12px',cursor:'pointer',borderTop:`1px solid ${P.bo}`}}><div style={{fontSize:12,fontWeight:600}}>{c.name}</div><div style={{fontSize:11,color:P.ts}}>{c.company}</div></div>)}</div>}
            {gRes.ca.length>0&&<div><div style={{padding:'8px 12px 4px',fontSize:10,color:P.tm,textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600}}>Candidates</div>{gRes.ca.map(c=><div key={c.id} onMouseDown={()=>{setTab('cands');setCaF({...c});setCaM('edit');setGq('');setGOpen(false);}} style={{padding:'8px 12px',cursor:'pointer',borderTop:`1px solid ${P.bo}`}}><div style={{fontSize:12,fontWeight:600}}>{c.name}</div><div style={{fontSize:11,color:P.ts}}>{c.currentRole}{c.currentCompany?` · ${c.currentCompany}`:''}</div></div>)}</div>}
            {gRes.fl.length>0&&<div><div style={{padding:'8px 12px 4px',fontSize:10,color:P.tm,textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600}}>Floats</div>{gRes.fl.map(f=><div key={f.id} onMouseDown={()=>{setTab('floats');setFlF({...f});setFlM('edit');setGq('');setGOpen(false);}} style={{padding:'8px 12px',cursor:'pointer',borderTop:`1px solid ${P.bo}`}}><div style={{fontSize:12,fontWeight:600}}>{f.candidateName}</div><div style={{fontSize:11,color:P.ts}}>{f.companyName}</div></div>)}</div>}
            {gRes.cl.length>0&&<div><div style={{padding:'8px 12px 4px',fontSize:10,color:P.tm,textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600}}>Clients</div>{gRes.cl.map(c=><div key={c.id} onMouseDown={()=>{setTab('clients');setClF({...c,roles:(c.roles||[]).map(r=>({...r})),invoices:(c.invoices||[]).map(i=>({...i}))});setClM('edit');setGq('');setGOpen(false);}} style={{padding:'8px 12px',cursor:'pointer',borderTop:`1px solid ${P.bo}`}}><div style={{fontSize:12,fontWeight:600}}>{c.company}</div><div style={{fontSize:11,color:P.ts}}>{c.contactName}</div></div>)}</div>}
          </div>}
        </div>

        <div style={{flex:1,overflowY:'auto'}}>

          {/* DASHBOARD */}
          {tab==='dash'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div><div style={{fontSize:22,fontWeight:700,fontFamily:SERIF}}>Dashboard</div><div style={{fontSize:13,color:P.ts,marginTop:2}}>{parseD(T).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</div></div>
              <button style={btp()} onClick={()=>setAcM(true)}>+ Log Activity</button>
            </div>
            <div style={{...CARD,padding:'18px 20px',marginBottom:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:10,flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontSize:11,color:P.ts,textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600,marginBottom:4}}>Revenue This Month</div>
                  <div style={{fontSize:26,fontWeight:700,color:P.ac,fontFamily:SERIF}}>AED {collectedMo.toLocaleString()}<span style={{fontSize:14,color:P.tm,fontWeight:500}}> collected</span></div>
                </div>
                <div style={{fontSize:12,color:P.ts,textAlign:'right'}}>AED {invoicedMo.toLocaleString()} invoiced<br/>Target: AED {(targets.revenue||0).toLocaleString()}</div>
              </div>
              <div style={{height:6,background:TRACK,borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${targets.revenue?Math.min(100,Math.round(collectedMo/targets.revenue*100)):0}%`,background:P.gn,borderRadius:99}}/></div>
              <div style={{fontSize:11,color:P.tm,marginTop:4}}>{targets.revenue?Math.min(100,Math.round(collectedMo/targets.revenue*100)):0}% of monthly target collected</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12,marginBottom:20}}>
              <Stat lbl="Active Pipeline" val={activeC.length} col={P.ac}/>
              <Stat lbl="Candidates in Market" val={activeCa.length} col={P.gn}/>
              <Stat lbl="Calls This Month" val={callsMo.length} sub={`This week: ${callsWk.length}`} col={P.bl}/>
              <Stat lbl="Meetings This Month" val={mtgsMo.length} col={P.pu}/>
              <Stat lbl="Floats This Month" val={floatsMo.length} sub={`This week: ${floatsWk.length}`} col={P.or}/>
              <Stat lbl="Overdue Follow-ups" val={overdue.length} col={overdue.length>0?P.rd:P.gy}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:16}}>
              <div style={{...CARD,padding:20}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Action Required</div>
                {!overdue.length&&<div style={{color:P.tm,fontSize:12,fontStyle:'italic'}}>All clear.</div>}
                {overdue.slice(0,7).map(c=><div key={c.id} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:`1px solid ${P.bo}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:12}}>{c.name}</div>
                    <div style={{fontSize:11,color:P.ts}}>{c.company}{c.title?` · ${c.title}`:''}</div>
                    {(c.phone||c.phone2)&&<a href={`tel:${c.phone||c.phone2}`} style={{fontSize:11,color:P.bl,textDecoration:'none'}}>📞 {c.phone||c.phone2}</a>}
                    {c.nextSteps&&<div style={{fontSize:11,color:P.ac,marginTop:2}}>→ {c.nextSteps}</div>}
                  </div>
                  <div style={{flexShrink:0,textAlign:'right'}}>
                    <div style={{fontSize:11,color:c.nextFollowUp<T?P.rd:P.or,fontWeight:600}}>{c.nextFollowUp}{c.nextFollowUp<T?' ⚠':' 🔔'}</div>
                    <button onClick={()=>{setLgF({date:T,stage:c.stage,nextSteps:c.nextSteps||'',notes:'',consultant:'AK',nextFollowUp:''});setLgM(c);}} style={{...btsm(P.gn),marginTop:4}}>📞 Log</button>
                  </div>
                </div>)}
              </div>
              <div style={{...CARD,padding:20}}>
                <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Recent Activity</div>
                {!activity.length&&<div style={{color:P.tm,fontSize:12,fontStyle:'italic'}}>No activity logged yet.</div>}
                {activity.slice(0,8).map(a=><div key={a.id} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:`1px solid ${P.bo}`,alignItems:'flex-start'}}>
                  <Bge l={a.type} c={ACL[a.type]||P.ts}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600}}>{a.contact||'—'} <span style={{color:P.ts,fontWeight:400}}>{a.company?`· ${a.company}`:''}</span></div>
                    {a.outcome&&<div style={{fontSize:11,color:P.ts,marginTop:1}}>{a.outcome}</div>}
                    {a.nextSteps&&<div style={{fontSize:11,color:P.ac}}>→ {a.nextSteps}</div>}
                  </div>
                  <div style={{fontSize:10,color:P.tm,flexShrink:0}}>{a.date}</div>
                </div>)}
              </div>
            </div>
          </div>}

          {/* PIPELINE */}
          {tab==='contacts'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>BD Pipeline</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{display:'flex',gap:4,background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:4}}>
                  <button onClick={()=>setPView('board')} style={{padding:'5px 12px',borderRadius:6,border:'none',background:pView==='board'?P.ac:'transparent',color:pView==='board'?'#fff':P.ts,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Board</button>
                  <button onClick={()=>setPView('table')} style={{padding:'5px 12px',borderRadius:6,border:'none',background:pView==='table'?P.ac:'transparent',color:pView==='table'?'#fff':P.ts,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Table</button>
                </div>
                <button style={btp()} onClick={()=>{setCoF(newCo());setCoM('add');}}>+ Add Contact</button>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <input value={csrch} onChange={e=>setCsrch(e.target.value)} placeholder="Search name, company, notes..." style={{...INP,flex:1,minWidth:160}}/>
              <select value={cstg} onChange={e=>setCstg(e.target.value)} style={{...INP,width:'auto'}}><option value="All">All Stages</option>{STGS.map(s=><option key={s} value={s}>{s}</option>)}</select>
              <select value={cind} onChange={e=>setCind(e.target.value)} style={{...INP,width:'auto'}}><option value="All">All Industries</option>{INDS.map(i=><option key={i} value={i}>{i}</option>)}</select>
            </div>
            <div style={{fontSize:11,color:P.ts,marginBottom:8}}>{filtCo.length} of {contacts.length} contacts{pView==='board'?' · drag a card to change stage':' · 📋 to view full conversation history'}</div>

            {pView==='board'?
              <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:8}}>
                {STGS.map(stage=>{
                  const inStage=filtCo.filter(c=>c.stage===stage);
                  return <div key={stage}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();if(dragId)updCo(dragId,'stage',stage);setDragId(null);}}
                    style={{flexShrink:0,width:250,background:PANEL,borderRadius:10,border:`1px solid ${P.bo}`,display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 260px)'}}>
                    <div style={{padding:'10px 12px',borderBottom:`2px solid ${SC[stage]||P.bo}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:P.tx}}>{stage}</div>
                      <div style={{fontSize:11,color:P.ts,background:P.wh,borderRadius:99,padding:'1px 8px',border:`1px solid ${P.bo}`}}>{inStage.length}</div>
                    </div>
                    <div style={{padding:8,overflowY:'auto',flex:1}}>
                      {!inStage.length&&<div style={{fontSize:11,color:P.tm,textAlign:'center',padding:'16px 4px',fontStyle:'italic'}}>Empty</div>}
                      {inStage.map(c=><div key={c.id}
                        draggable
                        onDragStart={()=>setDragId(c.id)}
                        onClick={()=>setHistModal(c.id)}
                        style={{background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:'10px 11px',marginBottom:8,cursor:'grab',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
                        <div style={{fontSize:12,fontWeight:700,color:P.tx}}>{c.name}</div>
                        <div style={{fontSize:11,color:P.ts,marginTop:1}}>{c.company}</div>
                        {c.nextSteps&&<div style={{fontSize:11,color:P.ac,marginTop:5}}>→ {c.nextSteps}</div>}
                        {c.nextFollowUp&&<div style={{fontSize:10,marginTop:5,fontWeight:600,color:c.nextFollowUp<T?P.rd:c.nextFollowUp===T?P.or:P.tm}}>{c.nextFollowUp}{c.nextFollowUp<T?' ⚠':c.nextFollowUp===T?' 🔔':''}</div>}
                        <div style={{display:'flex',gap:4,marginTop:8}}>
                          <button onClick={e=>{e.stopPropagation();setLgF({date:T,stage:c.stage,nextSteps:c.nextSteps||'',notes:'',consultant:'AK',nextFollowUp:c.nextFollowUp||''});setLgM(c);}} style={{...btsm(P.gn),padding:'2px 7px'}}>📞</button>
                          <button onClick={e=>{e.stopPropagation();setCoF({...c});setCoM('edit');}} style={{...btsm(),padding:'2px 7px'}}>Edit</button>
                        </div>
                      </div>)}
                    </div>
                  </div>;
                })}
              </div>
            :
              <div style={{...CARD,overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{borderBottom:`1px solid ${P.bo}`}}><th style={TH_S}>Contact</th><th style={TH_S}>Stage</th><th style={TH_S}>Follow-up</th><th style={TH_S}>Next Steps</th><th style={TH_S}></th></tr></thead>
                  <tbody>
                    {!filtCo.length&&<tr><td colSpan={5} style={{padding:40,textAlign:'center',color:P.ts}}>{contacts.length?'No contacts match your filters.':'No contacts yet — add one above.'}</td></tr>}
                    {filtCo.map((c,i)=><tr key={c.id} style={{borderBottom:`1px solid ${P.bo}`,background:i%2===0?P.wh:PANEL}}>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        <div style={{fontSize:11,color:P.ts}}>{c.title}{c.company?` · ${c.company}`:''}</div>
                        {c.email&&<div style={{fontSize:11,color:P.ac}}>{c.email}</div>}
                        {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:11,color:P.bl,textDecoration:'none',display:'block'}}>{c.phone}</a>}
                      </td>
                      <td style={{padding:'10px 14px'}}><ISel value={c.stage} opts={STGS} cm={SC} onSave={v=>updCo(c.id,'stage',v)}/></td>
                      <td style={{padding:'10px 14px'}}><IDt value={c.nextFollowUp} today={T} onSave={v=>updCo(c.id,'nextFollowUp',v)}/></td>
                      <td style={{padding:'10px 14px',maxWidth:180}}><ITx value={c.nextSteps} onSave={v=>updCo(c.id,'nextSteps',v)} ph="Add next step..."/></td>
                      <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button style={btsm(P.bl)} onClick={()=>setHistModal(c.id)} title="View conversation history">📋</button>
                          <button style={btsm(P.gn)} onClick={()=>{setLgF({date:T,stage:c.stage,nextSteps:c.nextSteps||'',notes:'',consultant:'AK',nextFollowUp:c.nextFollowUp||''});setLgM(c);}}>📞</button>
                          <button style={btsm()} onClick={()=>{setCoF({...c});setCoM('edit');}}>Edit</button>
                          <button style={btsm(P.rd)} onClick={()=>delOk(c.name,()=>{saveCo(contacts.filter(x=>x.id!==c.id));setConf(null);toast$('Deleted');})}>Del</button>
                        </div>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            }
          </div>}

          {/* CANDIDATES */}
          {tab==='cands'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>Candidates</div>
              <button style={btp()} onClick={()=>{setCaF(newCa());setCaM('add');}}>+ Add Candidate</button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <input value={asrch} onChange={e=>setAsrch(e.target.value)} placeholder="Search name, role, nationality..." style={{...INP,flex:1,minWidth:160}}/>
              <div style={{display:'flex',gap:4,background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:4}}>
                {['All',...CSS2].map(s=><button key={s} onClick={()=>setAst(s)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:ast===s?CC[s]||P.ac:'transparent',color:ast===s?'#fff':P.ts,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>{s}</button>)}
              </div>
            </div>
            {!filtCa.length&&<div style={{...CARD,padding:40,textAlign:'center',color:P.ts}}>{cands.length?'No candidates match your filters.':'No candidates yet.'}</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:14}}>
              {filtCa.map(c=>{const cf=floats.filter(f=>f.candidateId===c.id||f.candidateName===c.name);return(
                <div key={c.id} style={{...CARD,padding:18}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:15}}>{c.name}</div><div style={{fontSize:12,color:P.ts,marginTop:2}}>{c.currentRole}{c.currentCompany?` · ${c.currentCompany}`:''}</div></div>
                    <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0,marginLeft:8}}>
                      <ISel value={c.status} opts={CSS2} cm={CC} onSave={v=>updCa(c.id,'status',v)}/>
                      <button style={btsm()} onClick={()=>{setCaF({...c});setCaM('edit');}}>Edit</button>
                      <button style={btsm(P.rd)} onClick={()=>delOk(c.name,()=>{saveCa(cands.filter(x=>x.id!==c.id));setConf(null);toast$('Deleted');})}>×</button>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12,marginBottom:10}}>
                    <div><div style={{fontSize:10,color:P.tm,marginBottom:1}}>Availability</div><div style={{fontWeight:500}}>{c.availability||'—'}</div></div>
                    <div><div style={{fontSize:10,color:P.tm,marginBottom:1}}>Nationality</div><div style={{fontWeight:500}}>{c.nationality||'—'}</div></div>
                    <div><div style={{fontSize:10,color:P.tm,marginBottom:1}}>Salary Exp.</div><div style={{fontWeight:500}}>{c.salaryExpectation?`${c.currency} ${Number(c.salaryExpectation).toLocaleString()}/mo`:'—'}</div></div>
                    <div><div style={{fontSize:10,color:P.tm,marginBottom:1}}>Consultant</div><div style={{fontWeight:500}}>{c.consultant||'—'}</div></div>
                  </div>
                  {c.notes&&<div style={{fontSize:12,color:P.ts,padding:'8px 10px',background:PANEL,borderRadius:7,marginBottom:10,borderLeft:`3px solid ${P.bo}`}}>{c.notes}</div>}
                  {cf.length>0&&<div style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:P.tm,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.5px'}}>Floated to ({cf.length})</div>
                    {cf.map(fl=><div key={fl.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${P.bo}`,fontSize:11}}>
                      <div><span style={{fontWeight:600}}>{fl.companyName}</span>{fl.contactName?<span style={{color:P.ts}}> · {fl.contactName}</span>:''}</div>
                      <Bge l={fl.responseStatus} c={FC[fl.responseStatus]||P.gy}/>
                    </div>)}
                  </div>}
                  <button onClick={()=>{setFlF({...newFl(),candidateId:c.id,candidateName:c.name,dateSent:T});setFlM('add');}} style={{width:'100%',padding:'7px',borderRadius:7,border:`1px dashed ${P.bo}`,background:'transparent',color:P.ts,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>+ Float to Company</button>
                </div>
              );})}
            </div>
          </div>}

          {/* FLOATS */}
          {tab==='floats'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>Float Tracker</div>
              <button style={btp()} onClick={()=>{setFlF({...newFl(),dateSent:T});setFlM('add');}}>+ Add Float</button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <input value={fsrch} onChange={e=>setFsrch(e.target.value)} placeholder="Search candidate, company..." style={{...INP,flex:1,minWidth:160}}/>
              <div style={{display:'flex',gap:4,background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:4,flexWrap:'wrap'}}>
                {['All',...FSS].map(s=><button key={s} onClick={()=>setFst(s)} style={{padding:'4px 10px',borderRadius:6,border:'none',background:fst===s?FC[s]||P.ac:'transparent',color:fst===s?'#fff':P.ts,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:600,whiteSpace:'nowrap'}}>{s}</button>)}
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              {FSS.map(s=>{const n=floats.filter(f=>f.responseStatus===s).length;return n>0?<div key={s} style={{padding:'4px 12px',borderRadius:99,background:`${FC[s]||P.gy}12`,border:`1px solid ${FC[s]||P.gy}30`,fontSize:11,fontWeight:600,color:FC[s]||P.gy}}>{s}: {n}</div>:null;})}
            </div>
            <div style={{...CARD,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{borderBottom:`1px solid ${P.bo}`}}><th style={TH_S}>Candidate</th><th style={TH_S}>Company</th><th style={TH_S}>Contact</th><th style={TH_S}>Date Sent</th><th style={TH_S}>Response</th><th style={TH_S}>Notes</th><th style={TH_S}></th></tr></thead>
                <tbody>
                  {!filtFl.length&&<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:P.ts}}>{floats.length?'No floats match your filters.':'No floats yet.'}</td></tr>}
                  {filtFl.map((f,i)=><tr key={f.id} style={{borderBottom:`1px solid ${P.bo}`,background:i%2===0?P.wh:PANEL}}>
                    <td style={{padding:'10px 14px',fontWeight:600}}>{f.candidateName}</td>
                    <td style={{padding:'10px 14px',fontWeight:500}}>{f.companyName}</td>
                    <td style={{padding:'10px 14px',color:P.ts}}>{f.contactName||'—'}</td>
                    <td style={{padding:'10px 14px',color:P.ts}}>{f.dateSent}</td>
                    <td style={{padding:'10px 14px'}}><ISel value={f.responseStatus} opts={FSS} cm={FC} onSave={v=>updFl(f.id,'responseStatus',v)}/></td>
                    <td style={{padding:'10px 14px',maxWidth:180}}><ITx value={f.notes} onSave={v=>saveFl(floats.map(fl=>fl.id===f.id?{...fl,notes:v}:fl))} ph="Add note..."/></td>
                    <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}><div style={{display:'flex',gap:4}}><button style={btsm()} onClick={()=>{setFlF({...f});setFlM('edit');}}>Edit</button><button style={btsm(P.rd)} onClick={()=>delOk('this float',()=>{saveFl(floats.filter(x=>x.id!==f.id));setConf(null);toast$('Deleted');})}>Del</button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>}

          {/* BD ACTIVITY */}
          {tab==='activity'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>BD Activity</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{fontSize:11,color:P.tm,background:PANEL,border:`1px solid ${P.bo}`,borderRadius:6,padding:'4px 10px'}}>Today: <strong style={{color:P.tx}}>{T}</strong></div>
                <button style={btp()} onClick={()=>setAcM(true)}>+ Log Entry</button>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
              <button style={{...bts(),padding:'6px 12px',fontSize:12}} onClick={()=>setActW(w=>addDays(w,-7))}>← Prev</button>
              <button style={{...bts(),padding:'6px 12px',fontSize:12,...(actW===WS?{background:`${P.ac}10`,borderColor:P.ac,color:P.ac}:{})}} onClick={()=>setActW(WS)}>This Week</button>
              <button style={{...bts(),padding:'6px 12px',fontSize:12}} onClick={()=>setActW(w=>addDays(w,7))}>Next →</button>
              <div style={{fontSize:13,color:P.ts,fontWeight:500}}>{AWD[0]} — {AWD[6]}</div>
              <select value={actC} onChange={e=>setActC(e.target.value)} style={{...INP,width:'auto',marginLeft:'auto'}}><option value="All">All Consultants</option>{CONS.map(c=><option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
              {[{type:'Call',label:'Calls',target:targets.calls,col:P.bl},{type:'Meeting',label:'Meetings',target:targets.meetings,col:P.pu},{type:'Float Email',label:'Floats',target:targets.floats,col:P.or},{type:'New Lead',label:'New Leads',target:targets.leads,col:P.gn},{type:'Client Signed',label:'Clients Signed',target:0,col:P.ac}].map(item=>{
                const actual=actCnt(item.type);const pct=item.target?Math.min(100,Math.round(actual/item.target*100)):0;
                return <div key={item.type} style={{...CARD,padding:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:4}}><div style={{fontSize:26,fontWeight:700,color:item.col,lineHeight:1}}>{actual}</div>{item.target>0&&<div style={{fontSize:11,color:P.tm}}>/{item.target}</div>}</div>
                  <div style={{fontSize:11,color:P.ts,marginBottom:item.target>0?8:0,fontWeight:500}}>{item.label}</div>
                  {item.target>0&&<div><div style={{height:4,background:TRACK,borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:item.col,borderRadius:99}}/></div><div style={{fontSize:10,color:P.tm,marginTop:3}}>{pct}% of target</div></div>}
                </div>;
              })}
            </div>
            <div style={{...CARD,overflow:'hidden',marginBottom:16}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:480}}>
                  <thead><tr style={{borderBottom:`1px solid ${P.bo}`,background:PANEL}}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=><th key={day} style={{padding:'10px 8px',textAlign:'center',color:AWD[i]===T?P.ac:P.ts,fontWeight:AWD[i]===T?700:500,borderRight:i<6?`1px solid ${P.bo}`:'none'}}><div>{day}</div><div style={{fontSize:10,color:AWD[i]===T?P.ac:P.tm,marginTop:1}}>{AWD[i].slice(5)}</div></th>)}</tr></thead>
                  <tbody><tr>{AWD.map((day,i)=>{const de=activity.filter(a=>a.date===day&&(actC==='All'||a.consultant===actC));return <td key={day} style={{padding:'8px 6px',verticalAlign:'top',borderRight:i<6?`1px solid ${P.bo}`:'none',background:day===T?`${P.ac}06`:'transparent',minWidth:60}}>
                    {ATS.map(type=>{const n=de.filter(a=>a.type===type).length;if(!n)return null;const lb=type==='Float Email'?'Float':type==='Client Signed'?'Signed':type;return <div key={type} style={{marginBottom:3,textAlign:'center'}}><span style={{padding:'2px 6px',borderRadius:99,fontSize:10,background:`${ACL[type]}15`,color:ACL[type],fontWeight:600}}>{n} {lb}</span></div>;})}
                    {!de.length&&<div style={{color:P.bo,textAlign:'center',paddingTop:6,fontSize:14}}>·</div>}
                  </td>;})}
                  </tr></tbody>
                </table>
              </div>
            </div>
            <div style={{...CARD,overflow:'hidden'}}>
              <div style={{padding:'12px 16px',borderBottom:`1px solid ${P.bo}`,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{fontSize:13,fontWeight:600,flex:1}}>Entries this week</div>
                {['All',...ATS].map(type=><button key={type} onClick={()=>setActT(type)} style={{padding:'4px 10px',borderRadius:6,border:'none',background:actT===type?ACL[type]||P.ac:'transparent',color:actT===type?'#fff':P.ts,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:600,whiteSpace:'nowrap'}}>{type}</button>)}
              </div>
              {!filtAc.length?<div style={{padding:32,textAlign:'center',color:P.ts,fontSize:12}}>No entries this week.</div>:filtAc.map(a=><div key={a.id} style={{display:'flex',gap:12,padding:'10px 16px',borderBottom:`1px solid ${P.bo}`,alignItems:'flex-start'}}>
                <div style={{flexShrink:0,fontSize:11,color:P.ts,minWidth:75,marginTop:1}}>{a.date}</div>
                <div style={{flexShrink:0,marginTop:1}}><Bge l={a.type} c={ACL[a.type]||P.ts}/></div>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{a.contact||'—'} <span style={{color:P.ts,fontWeight:400}}>{a.company?`· ${a.company}`:''}</span></div>{a.outcome&&<div style={{fontSize:11,color:P.ts,marginTop:1}}>{a.outcome}</div>}{a.nextSteps&&<div style={{fontSize:11,color:P.ac}}>→ {a.nextSteps}</div>}</div>
                <div style={{fontSize:10,color:P.tm,flexShrink:0}}>{a.consultant}</div>
                <button style={btsm(P.rd)} onClick={()=>saveAc(activity.filter(x=>x.id!==a.id))}>×</button>
              </div>)}
            </div>
          </div>}

          {/* MEETINGS LOG */}
          {tab==='meets'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>Meetings & Calls Log</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{fontSize:11,color:P.tm,background:PANEL,border:`1px solid ${P.bo}`,borderRadius:6,padding:'4px 10px'}}>Today: <strong style={{color:P.tx}}>{T}</strong>{dateOverride&&<span style={{color:P.or}}> (override)</span>}</div>
                <button style={btp()} onClick={()=>setAcM(true)}>+ Log Entry</button>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{display:'flex',gap:4,background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:4}}>
                {['All','Call','Meeting'].map(type=><button key={type} onClick={()=>setMtT(type)} style={{padding:'5px 14px',borderRadius:6,border:'none',background:mtT===type?ACL[type]||P.ac:'transparent',color:mtT===type?'#fff':P.ts,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>{type}</button>)}
              </div>
              <div style={{display:'flex',gap:4,background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:4,flexWrap:'wrap'}}>
                {[['today','Today'],['week','This Week'],['month','This Month'],['custom','Custom Date'],['all','All Time']].map(([v,l])=><button key={v} onClick={()=>setMeetRange(v)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:meetRange===v?P.ac:'transparent',color:meetRange===v?'#fff':P.ts,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600,whiteSpace:'nowrap'}}>{l}</button>)}
              </div>
              {meetRange==='custom'&&(
                <div style={{display:'flex',gap:6,alignItems:'center',background:P.wh,borderRadius:8,border:`1px solid ${P.bo}`,padding:'6px 10px',flexWrap:'wrap'}}>
                  <span style={{fontSize:11,color:P.ts,fontWeight:500}}>From</span>
                  <input type="date" value={meetFrom} onChange={e=>setMeetFrom(e.target.value)} style={{border:`1px solid ${P.bo}`,borderRadius:6,padding:'4px 8px',fontSize:12,outline:'none',background:INBG,color:P.tx,fontFamily:'inherit'}}/>
                  <span style={{fontSize:11,color:P.ts,fontWeight:500}}>To</span>
                  <input type="date" value={meetTo} onChange={e=>setMeetTo(e.target.value)} style={{border:`1px solid ${P.bo}`,borderRadius:6,padding:'4px 8px',fontSize:12,outline:'none',background:INBG,color:P.tx,fontFamily:'inherit'}}/>
                </div>
              )}
              <div style={{fontSize:12,color:P.ts}}>{filtMeet.length}{meetRange!=='all'?` of ${meetLog.length} total`:' entries'}</div>
            </div>
            <div style={{...CARD,overflow:'hidden'}}>
              {!filtMeet.length&&<div style={{padding:40,textAlign:'center',color:P.ts}}>{meetLog.length?`No entries for this period — try "All Time" to see everything.`:'No meetings or calls logged yet.'}</div>}
              {filtMeet.map((a,i)=><div key={a.id} style={{display:'flex',gap:14,padding:'14px 18px',borderBottom:i<filtMeet.length-1?`1px solid ${P.bo}`:'none',alignItems:'flex-start'}}>
                <div style={{flexShrink:0,width:100}}><div style={{fontSize:12,fontWeight:600}}>{a.date}</div><div style={{marginTop:4}}><Bge l={a.type} c={ACL[a.type]||P.ts}/></div></div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{a.contact||'(No contact)'} <span style={{color:P.ts,fontWeight:400,fontSize:12}}>{a.company?`· ${a.company}`:''}</span></div>{a.outcome&&<div style={{fontSize:12,color:P.ts,marginTop:3}}>Outcome: {a.outcome}</div>}{a.nextSteps&&<div style={{fontSize:12,color:P.ac,marginTop:2}}>→ Next: {a.nextSteps}</div>}</div>
                <div style={{flexShrink:0,textAlign:'right'}}><div style={{fontSize:11,color:P.tm}}>{a.consultant}</div><button style={{...btsm(P.rd),marginTop:4}} onClick={()=>saveAc(activity.filter(x=>x.id!==a.id))}>Delete</button></div>
              </div>)}
            </div>
          </div>}

          {/* CLIENTS */}
          {tab==='clients'&&<div style={{padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700,fontFamily:SERIF}}>Clients</div>
              <button style={btp()} onClick={()=>{setClF(newCl());setClM('add');}}>+ Add Client</button>
            </div>
            {!clients.length&&<div style={{...CARD,padding:60,textAlign:'center',color:P.ts}}><div style={{fontSize:17,color:P.tm,marginBottom:8}}>No clients yet</div>Add your first signed client.</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(440px,1fr))',gap:16}}>
              {clients.map(cl=>{
                const fees=(cl.roles||[]).reduce((a,r)=>a+(r.status==='Placed'&&r.placementFee?+r.placementFee:0),0);
                const invT=(cl.invoices||[]).reduce((a,i)=>a+(+i.amount||0),0);
                const invP=(cl.invoices||[]).filter(i=>['Paid','Cleared'].includes(i.status)).reduce((a,i)=>a+(+i.amount||0),0);
                const invOD=(cl.invoices||[]).filter(i=>['Overdue','Written Off'].includes(i.status));
                return <div key={cl.id} style={{...CARD,padding:22}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
                    <div><div style={{fontSize:18,fontWeight:700}}>{cl.company}</div><div style={{fontSize:12,color:P.ts,marginTop:2}}>{cl.contactName}{cl.contactTitle?` · ${cl.contactTitle}`:''}</div></div>
                    <div style={{display:'flex',gap:4,flexShrink:0}}><button style={btsm()} onClick={()=>{setClF({...cl,roles:(cl.roles||[]).map(r=>({...r})),invoices:(cl.invoices||[]).map(i=>({...i}))});setClM('edit');}}>Edit</button><button style={btsm(P.rd)} onClick={()=>delOk(cl.company,()=>{saveCl(clients.filter(c=>c.id!==cl.id));setConf(null);toast$('Deleted');})}>Del</button></div>
                  </div>
                  <div style={{display:'flex',marginBottom:cl.contractLink?10:14,borderRadius:8,border:`1px solid ${P.bo}`,overflow:'hidden'}}>
                    {[{l:'1st Role',v:`${cl.feeFirst||'—'}%`,c:P.gn},{l:'Subsequent',v:`${cl.feeSubsequent||'—'}%`,c:P.ac},{l:'Terms',v:cl.paymentTerms||'—',c:P.ts},{l:'Fees',v:fees?`AED ${(fees/1000).toFixed(0)}k`:'—',c:P.ac}].map((item,idx)=><div key={item.l} style={{flex:1,padding:'10px 6px',textAlign:'center',background:PANEL,borderRight:idx<3?`1px solid ${P.bo}`:'none'}}><div style={{fontWeight:700,fontSize:14,color:item.c}}>{item.v}</div><div style={{fontSize:10,color:P.tm,marginTop:2}}>{item.l}</div></div>)}
                  </div>
                  {cl.contractLink&&<div style={{marginBottom:12,padding:'7px 10px',background:PANEL,borderRadius:7,border:`1px solid ${P.bo}`,display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:11,color:P.ts}}>📄</span><a href={cl.contractLink} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:P.bl}}>View Contract</a></div>}
                  {invOD.length>0&&<div style={{marginBottom:10,padding:'7px 10px',background:`${P.rd}08`,borderRadius:7,border:`1px solid ${P.rd}30`,fontSize:11,color:P.rd,fontWeight:600}}>⚠ {invOD.length} invoice{invOD.length>1?'s':''} overdue or written off</div>}
                  <div style={{fontSize:11,fontWeight:600,color:P.ts,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Roles ({(cl.roles||[]).length})</div>
                  {!(cl.roles||[]).length&&<div style={{fontSize:12,color:P.tm,marginBottom:8,fontStyle:'italic'}}>No roles added.</div>}
                  {(cl.roles||[]).map(r=><div key={r.id} style={{padding:'9px 12px',background:PANEL,borderRadius:8,marginBottom:6,border:`1px solid ${r.status==='Placed'?`${P.gn}40`:P.bo}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}><div style={{fontWeight:600,fontSize:12}}>{r.title||'(Untitled)'}</div><div style={{display:'flex',gap:4,alignItems:'center'}}>{r.consultant&&<span style={{fontSize:10,color:P.ts}}>{r.consultant}</span>}<Bge l={r.status} c={RC[r.status]||P.ts}/></div></div>
                    <div style={{display:'flex',gap:10,fontSize:11,color:P.ts,flexWrap:'wrap'}}>{r.contactPerson&&<span>👤 {r.contactPerson}</span>}{r.cvsSubmitted>0&&<span>{r.cvsSubmitted} CVs</span>}{r.candidateName&&<span style={{color:P.tx,fontWeight:600}}>✓ {r.candidateName}</span>}{r.placementFee&&<span style={{color:P.gn,fontWeight:600}}>Fee: AED {Number(r.placementFee).toLocaleString()}</span>}</div>
                    {r.status==='Placed'&&r.placementFee&&<button onClick={()=>genInvoiceForRole(cl,r)} style={{...btsm(P.ac),marginTop:6}}>Generate Invoice</button>}
                  </div>)}
                  {(cl.invoices||[]).length>0&&<div style={{marginTop:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:P.ts,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6,display:'flex',justifyContent:'space-between'}}><span>Invoices ({(cl.invoices||[]).length})</span>{invT>0&&<span style={{color:P.ac}}>AED {(invP/1000).toFixed(0)}k / {(invT/1000).toFixed(0)}k cleared</span>}</div>
                    {(cl.invoices||[]).map(inv=><div key={inv.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:PANEL,borderRadius:7,marginBottom:4,border:`1px solid ${['Written Off','Waived'].includes(inv.status)?`${P.rd}30`:P.bo}`}}>
                      <div><div style={{fontSize:11,fontWeight:600}}>{inv.invoiceNumber||'(No #)'}{inv.roleTitle?` · ${inv.roleTitle}`:''}</div><div style={{fontSize:10,color:P.ts}}>{inv.candidateName||'—'}{inv.dateDue?` · Due: ${inv.dateDue}`:''}</div></div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>{inv.amount&&<span style={{fontSize:12,fontWeight:700,color:P.ac}}>AED {Number(inv.amount).toLocaleString()}</span>}<Bge l={inv.status} c={IC[inv.status]||P.ts}/><button onClick={()=>downloadInvoicePDF(cl,inv)} title="Download PDF" style={{...btsm(P.bl),padding:'2px 7px'}}>PDF</button>{inv.link&&<a href={inv.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:P.bl}}>🔗</a>}</div>
                    </div>)}
                  </div>}
                  {cl.notes&&<div style={{fontSize:12,color:P.ts,marginTop:10,padding:'8px 10px',background:PANEL,borderRadius:7,borderLeft:`3px solid ${P.bo}`}}>{cl.notes}</div>}
                </div>;
              })}
            </div>
          </div>}

        </div>
        {mobile&&<div style={{background:P.wh,borderTop:`1px solid ${P.bo}`,display:'flex',position:'sticky',bottom:0,zIndex:10,flexShrink:0}}>{NAV.map(navItem)}</div>}
      </div>

      {/* MODALS */}

      {histModal&&<HistoryModal cid={histModal} contacts={contacts} onX={()=>setHistModal(null)}/>}

      {lgM&&<Mod title={`Log Call · ${lgM.name}`} onX={()=>setLgM(null)}>
        <div style={G2}>
          <div><div style={LB_S}>Date</div><input value={lgF.date} onChange={e=>setLgF(f=>({...f,date:e.target.value}))} type="date" style={INP}/></div>
          <div><div style={LB_S}>Logged By</div><div style={{display:'flex',gap:6}}>{CONS.map(c=><button key={c} onClick={()=>setLgF(f=>({...f,consultant:c}))} style={{flex:1,padding:'9px',borderRadius:8,border:`2px solid ${lgF.consultant===c?P.ac:P.bo}`,background:lgF.consultant===c?`${P.ac}12`:'transparent',color:lgF.consultant===c?P.ac:P.ts,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'inherit'}}>{c}</button>)}</div></div>
          <div><div style={LB_S}>Move Stage To</div><select value={lgF.stage} onChange={e=>setLgF(f=>({...f,stage:e.target.value}))} style={INP}>{STGS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><div style={LB_S}>Next Steps</div><input value={lgF.nextSteps} onChange={e=>setLgF(f=>({...f,nextSteps:e.target.value}))} placeholder="e.g. Send company profile" style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Next Follow-up <span style={{textTransform:'none',letterSpacing:0,color:P.tm,fontWeight:400}}>(leave blank to clear)</span></div><input value={lgF.nextFollowUp} onChange={e=>setLgF(f=>({...f,nextFollowUp:e.target.value}))} type="date" style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Notes</div><textarea value={lgF.notes} onChange={e=>setLgF(f=>({...f,notes:e.target.value}))} rows={3} style={INP_TA}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setLgM(null)}>Cancel</button><button style={btp(P.gn)} onClick={saveLog}>✓ Save Call</button></div>
      </Mod>}

      {coM&&<Mod title={coM==='add'?'Add Contact':'Edit Contact'} onX={()=>setCoM(null)}>
        <div style={G2}>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Name *</div><input value={coF.name} onChange={e=>setCoF(f=>({...f,name:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Job Title</div><input value={coF.title||''} onChange={e=>setCoF(f=>({...f,title:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Company</div><input value={coF.company||''} onChange={e=>setCoF(f=>({...f,company:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Phone</div><input value={coF.phone||''} onChange={e=>setCoF(f=>({...f,phone:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Phone 2</div><input value={coF.phone2||''} onChange={e=>setCoF(f=>({...f,phone2:e.target.value}))} style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Email</div><input value={coF.email||''} onChange={e=>setCoF(f=>({...f,email:e.target.value}))} type="email" style={INP}/></div>
          <div><div style={LB_S}>Industry</div><select value={coF.industry||''} onChange={e=>setCoF(f=>({...f,industry:e.target.value}))} style={INP}><option value="">Select...</option>{INDS.map(i=><option key={i} value={i}>{i}</option>)}</select></div>
          <div><div style={LB_S}>Stage</div><select value={coF.stage||'Cold'} onChange={e=>setCoF(f=>({...f,stage:e.target.value}))} style={INP}>{STGS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><div style={LB_S}>Last Contact</div><input value={coF.lastContact||''} onChange={e=>setCoF(f=>({...f,lastContact:e.target.value}))} type="date" style={INP}/></div>
          <div><div style={LB_S}>Next Follow-up</div><input value={coF.nextFollowUp||''} onChange={e=>setCoF(f=>({...f,nextFollowUp:e.target.value}))} type="date" style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Next Steps</div><input value={coF.nextSteps||''} onChange={e=>setCoF(f=>({...f,nextSteps:e.target.value}))} style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Notes</div><textarea value={coF.notes||''} onChange={e=>setCoF(f=>({...f,notes:e.target.value}))} rows={3} style={INP_TA}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setCoM(null)}>Cancel</button><button style={btp()} onClick={saveCoF}>Save Contact</button></div>
      </Mod>}

      {caM&&<Mod title={caM==='add'?'Add Candidate':'Edit Candidate'} onX={()=>setCaM(null)}>
        <div style={G2}>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Name *</div><input value={caF.name||''} onChange={e=>setCaF(f=>({...f,name:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Current Role</div><input value={caF.currentRole||''} onChange={e=>setCaF(f=>({...f,currentRole:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Current Company</div><input value={caF.currentCompany||''} onChange={e=>setCaF(f=>({...f,currentCompany:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Nationality</div><input value={caF.nationality||''} onChange={e=>setCaF(f=>({...f,nationality:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Availability</div><input value={caF.availability||''} onChange={e=>setCaF(f=>({...f,availability:e.target.value}))} placeholder="e.g. Immediate, 1 month" style={INP}/></div>
          <div><div style={LB_S}>Currency</div><select value={caF.currency||'AED'} onChange={e=>setCaF(f=>({...f,currency:e.target.value}))} style={INP}>{CURR.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><div style={LB_S}>Salary Exp. (monthly)</div><input value={caF.salaryExpectation||''} onChange={e=>setCaF(f=>({...f,salaryExpectation:e.target.value}))} type="number" min="0" style={INP}/></div>
          <div><div style={LB_S}>Status</div><select value={caF.status||'Active'} onChange={e=>setCaF(f=>({...f,status:e.target.value}))} style={INP}>{CSS2.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><div style={LB_S}>Consultant</div><select value={caF.consultant||'AK'} onChange={e=>setCaF(f=>({...f,consultant:e.target.value}))} style={INP}>{CONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Notes</div><textarea value={caF.notes||''} onChange={e=>setCaF(f=>({...f,notes:e.target.value}))} rows={3} style={INP_TA}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setCaM(null)}>Cancel</button><button style={btp()} onClick={saveCaF}>Save Candidate</button></div>
      </Mod>}

      {flM&&<Mod title={flM==='add'?'Add Float':'Edit Float'} onX={()=>setFlM(null)}>
        <div style={G2}>
          <div><div style={LB_S}>Candidate Name *</div><input value={flF.candidateName||''} onChange={e=>setFlF(f=>({...f,candidateName:e.target.value}))} style={INP}/></div>
          <div>
            <div style={LB_S}>Company *</div>
            <input value={flF.companyName||''} onChange={e=>setFlF(f=>({...f,companyName:e.target.value}))} list="stratium-company-list" placeholder="Type or pick from Pipeline" style={INP}/>
            <datalist id="stratium-company-list">{companyOptions.map(co=><option key={co} value={co}/>)}</datalist>
            <div style={{fontSize:11,color:floatLinked?P.gn:P.tm,marginTop:3,fontWeight:floatLinked?600:400}}>{floatLinked?'✓ Matches an existing Pipeline company':'New company — not in Pipeline yet. A contact will be created automatically if there\'s a response.'}</div>
          </div>
          <div>
            <div style={LB_S}>Contact Name</div>
            <input value={flF.contactName||''} onChange={e=>setFlF(f=>({...f,contactName:e.target.value}))} list="stratium-contact-list" placeholder="Type or pick from Pipeline" style={INP}/>
            <datalist id="stratium-contact-list">{contactOptionsForCompany.map(c=><option key={c.id} value={c.name}/>)}</datalist>
          </div>
          <div><div style={LB_S}>Date Sent</div><input value={flF.dateSent||T} onChange={e=>setFlF(f=>({...f,dateSent:e.target.value}))} type="date" style={INP}/></div>
          <div><div style={LB_S}>Response Status</div><select value={flF.responseStatus||'No Response'} onChange={e=>setFlF(f=>({...f,responseStatus:e.target.value}))} style={INP}>{FSS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><div style={LB_S}>Consultant</div><select value={flF.consultant||'AK'} onChange={e=>setFlF(f=>({...f,consultant:e.target.value}))} style={INP}>{CONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Notes</div><textarea value={flF.notes||''} onChange={e=>setFlF(f=>({...f,notes:e.target.value}))} rows={3} style={INP_TA}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setFlM(null)}>Cancel</button><button style={btp()} onClick={saveFlF}>Save Float</button></div>
      </Mod>}

      {acM&&<Mod title="Log Activity" onX={()=>setAcM(false)}>
        <div style={G2}>
          <div><div style={LB_S}>Date</div><input value={acF.date||T} onChange={e=>setAcF(f=>({...f,date:e.target.value}))} type="date" style={INP}/></div>
          <div><div style={LB_S}>Type</div><select value={acF.type||'Call'} onChange={e=>setAcF(f=>({...f,type:e.target.value}))} style={INP}>{ATS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div><div style={LB_S}>Contact Name</div><input value={acF.contact||''} onChange={e=>setAcF(f=>({...f,contact:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Company</div><input value={acF.company||''} onChange={e=>setAcF(f=>({...f,company:e.target.value}))} style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Outcome / Summary</div><input value={acF.outcome||''} onChange={e=>setAcF(f=>({...f,outcome:e.target.value}))} style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Next Steps</div><input value={acF.nextSteps||''} onChange={e=>setAcF(f=>({...f,nextSteps:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Consultant</div><select value={acF.consultant||'AK'} onChange={e=>setAcF(f=>({...f,consultant:e.target.value}))} style={INP}>{CONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setAcM(false)}>Cancel</button><button style={btp()} onClick={saveAcF}>Save Entry</button></div>
      </Mod>}

      {clM&&<Mod title={clM==='add'?'Add Client':'Edit Client'} onX={()=>setClM(null)} wide={true}>
        <div style={{...G2,marginBottom:12}}>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Company *</div><input value={clF.company||''} onChange={e=>setClF(f=>({...f,company:e.target.value}))} style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Billing Address <span style={{textTransform:'none',letterSpacing:0,color:P.tm,fontWeight:400}}>(one line per address line — used on invoices)</span></div><textarea value={clF.address||''} onChange={e=>setClF(f=>({...f,address:e.target.value}))} rows={3} placeholder={"302, 3rd Floor, Galleries 2\nDowntown Jebal Ali\nDubai, UAE"} style={INP_TA}/></div>
          <div><div style={LB_S}>Primary Contact</div><input value={clF.contactName||''} onChange={e=>setClF(f=>({...f,contactName:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Contact Title</div><input value={clF.contactTitle||''} onChange={e=>setClF(f=>({...f,contactTitle:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Fee % — First Role</div><input value={clF.feeFirst||''} onChange={e=>setClF(f=>({...f,feeFirst:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Fee % — Subsequent</div><input value={clF.feeSubsequent||''} onChange={e=>setClF(f=>({...f,feeSubsequent:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Payment Terms</div><input value={clF.paymentTerms||''} onChange={e=>setClF(f=>({...f,paymentTerms:e.target.value}))} style={INP}/></div>
          <div><div style={LB_S}>Contract Date</div><input value={clF.contractDate||''} onChange={e=>setClF(f=>({...f,contractDate:e.target.value}))} type="date" style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Contract Link</div><input value={clF.contractLink||''} onChange={e=>setClF(f=>({...f,contractLink:e.target.value}))} placeholder="https://..." style={INP}/></div>
          <div style={{gridColumn:'span 2'}}><div style={LB_S}>Notes</div><textarea value={clF.notes||''} onChange={e=>setClF(f=>({...f,notes:e.target.value}))} rows={2} style={INP_TA}/></div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontSize:12,fontWeight:600,color:P.ts,textTransform:'uppercase',letterSpacing:'0.5px'}}>Roles ({clF.roles.length})</div><button style={{...bts(),padding:'4px 12px',fontSize:11}} onClick={addRole}>+ Add Role</button></div>
        {clF.roles.map(r=><div key={r.id} style={{padding:12,background:PANEL,borderRadius:8,marginBottom:8,border:`1px solid ${P.bo}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:8,marginBottom:8,alignItems:'end'}}>
            <div><div style={LB_S}>Title</div><input value={r.title||''} onChange={e=>updRole(r.id,'title',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Status</div><select value={r.status||'Briefed'} onChange={e=>updRole(r.id,'status',e.target.value)} style={{...INP,width:'auto'}}>{RS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><div style={LB_S}>CVs</div><input type="number" min="0" value={r.cvsSubmitted||0} onChange={e=>updRole(r.id,'cvsSubmitted',e.target.value)} style={{...INP,width:60}}/></div>
            <button onClick={()=>delRole(r.id)} style={{marginBottom:1,padding:'9px 10px',borderRadius:6,border:`1px solid ${P.rd}30`,background:`${P.rd}08`,color:P.rd,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
            <div><div style={LB_S}>Contact at Client</div><input value={r.contactPerson||''} onChange={e=>updRole(r.id,'contactPerson',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Managed By</div><select value={r.consultant||''} onChange={e=>updRole(r.id,'consultant',e.target.value)} style={INP}><option value="">—</option>{CONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><div style={LB_S}>Candidate Placed</div><input value={r.candidateName||''} onChange={e=>updRole(r.id,'candidateName',e.target.value)} style={INP}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr',gap:8}}>
            <div><div style={LB_S}>Currency</div><select value={r.currency||'AED'} onChange={e=>updRole(r.id,'currency',e.target.value)} style={INP}>{CURR.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><div style={LB_S}>Monthly Salary</div><input type="number" min="0" value={r.salary||''} onChange={e=>updRole(r.id,'salary',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Fee Generated</div><input type="number" min="0" value={r.placementFee||''} onChange={e=>updRole(r.id,'placementFee',e.target.value)} style={{...INP,color:r.placementFee?P.gn:P.tx,fontWeight:r.placementFee?700:400}}/></div>
          </div>
        </div>)}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,marginTop:16}}><div style={{fontSize:12,fontWeight:600,color:P.ts,textTransform:'uppercase',letterSpacing:'0.5px'}}>Invoices ({(clF.invoices||[]).length})</div><button style={{...bts(),padding:'4px 12px',fontSize:11}} onClick={addInv}>+ Add Invoice</button></div>
        {(clF.invoices||[]).map(inv=><div key={inv.id} style={{padding:12,background:PANEL,borderRadius:8,marginBottom:8,border:`1px solid ${P.bo}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto',gap:8,marginBottom:8,alignItems:'end'}}>
            <div><div style={LB_S}>Invoice #</div><input value={inv.invoiceNumber||''} onChange={e=>updInv(inv.id,'invoiceNumber',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Status</div><select value={inv.status||'Draft'} onChange={e=>updInv(inv.id,'status',e.target.value)} style={INP}>{INS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <button onClick={()=>downloadInvoicePDF(clF,inv)} style={{marginBottom:1,padding:'9px 12px',borderRadius:6,border:`1px solid ${P.bl}30`,background:`${P.bl}08`,color:P.bl,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>PDF</button>
            <button onClick={()=>delInv(inv.id)} style={{marginBottom:1,padding:'9px 10px',borderRadius:6,border:`1px solid ${P.rd}30`,background:`${P.rd}08`,color:P.rd,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div><div style={LB_S}>Role / Mandate</div><input value={inv.roleTitle||''} onChange={e=>updInv(inv.id,'roleTitle',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Candidate</div><input value={inv.candidateName||''} onChange={e=>updInv(inv.id,'candidateName',e.target.value)} style={INP}/></div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <div style={LB_S}>Fee Lines <span style={{textTransform:'none',letterSpacing:0,color:P.tm,fontWeight:400}}>(add a concession/deduction as its own line — total below updates automatically)</span></div>
              <button onClick={()=>addInvItem(inv.id)} style={{padding:'3px 10px',borderRadius:6,border:`1px solid ${P.bo}`,background:'transparent',color:P.ts,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>+ Line</button>
            </div>
            {(inv.items||[]).map(it=><div key={it.id} style={{display:'flex',gap:6,marginBottom:5}}>
              <input value={it.desc||''} onChange={e=>updInvItem(inv.id,it.id,'desc',e.target.value)} placeholder="e.g. Associate (UAE National)" style={{...INP,flex:1}}/>
              <input type="number" value={it.amount||''} onChange={e=>updInvItem(inv.id,it.id,'amount',e.target.value)} placeholder="Amount" style={{...INP,width:110}}/>
              <button onClick={()=>delInvItem(inv.id,it.id)} style={{padding:'0 10px',borderRadius:6,border:`1px solid ${P.rd}30`,background:`${P.rd}08`,color:P.rd,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>✕</button>
            </div>)}
            {!(inv.items||[]).length&&<div style={{fontSize:11,color:P.tm,fontStyle:'italic'}}>No line items — the Amount field below is used as a single flat fee.</div>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr 1fr',gap:8,alignItems:'end'}}>
            <div><div style={LB_S}>Ccy</div><select value={inv.currency||'AED'} onChange={e=>updInv(inv.id,'currency',e.target.value)} style={{...INP,width:'auto'}}>{CURR.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><div style={LB_S}>Total Payable{(inv.items||[]).length?' (auto)':''}</div><input type="number" min="0" value={inv.amount||''} onChange={e=>updInv(inv.id,'amount',e.target.value)} readOnly={!!(inv.items||[]).length} style={{...INP,...((inv.items||[]).length?{color:P.tm,background:P.wh}:{})}}/></div>
            <div><div style={LB_S}>Issued</div><input type="date" value={inv.dateIssued||''} onChange={e=>updInv(inv.id,'dateIssued',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Due</div><input type="date" value={inv.dateDue||''} onChange={e=>updInv(inv.id,'dateDue',e.target.value)} style={INP}/></div>
            <div><div style={LB_S}>Paid</div><input type="date" value={inv.datePaid||''} onChange={e=>updInv(inv.id,'datePaid',e.target.value)} style={INP}/></div>
          </div>
          <div style={{marginTop:8}}><div style={LB_S}>Invoice Link</div><input value={inv.link||''} onChange={e=>updInv(inv.id,'link',e.target.value)} placeholder="https://..." style={INP}/></div>
        </div>)}
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setClM(null)}>Cancel</button><button style={btp()} onClick={saveClF}>Save Client</button></div>
      </Mod>}

      {repM&&<Mod title="Reports & Data" onX={()=>setRepM(false)}>
        <div style={{display:'grid',gap:10}}>
          <div style={{padding:'10px 12px',background:PANEL,borderRadius:8,border:`1px solid ${P.bo}`}}>
            <div style={{fontSize:12,fontWeight:600,color:P.ts,marginBottom:4}}>System date detected</div>
            <div style={{fontSize:16,fontWeight:700,color:P.tx,marginBottom:8}}>{sysT} <span style={{fontSize:11,color:P.tm,fontWeight:400}}>(updates live, no refresh needed)</span></div>
            <div style={{fontSize:11,color:P.ts,marginBottom:4}}>Only set an override below if the date above looks wrong — this forces every tab, week and month view to use it instead.</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="date" value={dateOverride} onChange={e=>saveDt(e.target.value)} style={{...INP,width:'auto'}}/>
              {dateOverride&&<button style={{...bts(),padding:'6px 12px',fontSize:12}} onClick={()=>saveDt('')}>Clear override</button>}
            </div>
          </div>
          <button style={{...btp(P.gn),width:'100%'}} onClick={()=>setExpD(JSON.stringify({contacts,clients,candidates:cands,floats,activity,targets,exportedAt:new Date().toISOString()},null,2))}>⬇ Export All Data (JSON)</button>
          <button onClick={()=>jsonRef.current.click()} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${P.bo}`,background:'transparent',color:P.ts,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>⬆ Restore from Backup</button>
          <input ref={jsonRef} type="file" accept=".json" style={{display:'none'}} onChange={handleRestore}/>
          <div style={{fontSize:11,color:P.tm,marginTop:-4}}>Every restored record — even ones logged under a different name — is automatically reassigned to AK.</div>
          <div style={{borderTop:`1px solid ${P.bo}`,paddingTop:12,marginTop:4}}>
            <div style={{fontSize:12,fontWeight:600,color:P.ts,marginBottom:8}}>👤 Consultant Cleanup</div>
            <button onClick={reassignAllToAK} style={{width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${P.ac}30`,background:`${P.ac}08`,color:P.ac,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Reassign all existing data to AK</button>
          </div>
          <div style={{borderTop:`1px solid ${P.bo}`,paddingTop:12,marginTop:4}}>
            <div style={{fontSize:12,fontWeight:600,color:P.ts,marginBottom:8}}>🔁 Deduplication Tools</div>
            <div style={{fontSize:11,color:P.tm,marginBottom:8}}>Remove duplicate entries created by merging backups or double-logging.</div>
            <div style={{display:'grid',gap:6}}>
              <button onClick={dedupeActivity} style={{width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${P.pu}30`,background:`${P.pu}08`,color:P.pu,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Remove duplicates from Meetings Log</button>
              <button onClick={dedupeCallLogs} style={{width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${P.bl}30`,background:`${P.bl}08`,color:P.bl,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Remove duplicates from Contact Histories</button>
              <button onClick={fixAllDatesNow} style={{width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${P.gn}30`,background:`${P.gn}08`,color:P.gn,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Fix any DD/MM/YYYY or unpadded dates now</button>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${P.bo}`,paddingTop:14,marginTop:4}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Weekly Targets</div>
            <div style={G2}>
              <div><div style={LB_S}>Calls</div><input type="number" min="0" value={tgEdit.calls} onChange={e=>setTgEdit(f=>({...f,calls:+e.target.value}))} style={INP}/></div>
              <div><div style={LB_S}>Meetings</div><input type="number" min="0" value={tgEdit.meetings} onChange={e=>setTgEdit(f=>({...f,meetings:+e.target.value}))} style={INP}/></div>
              <div><div style={LB_S}>Floats</div><input type="number" min="0" value={tgEdit.floats} onChange={e=>setTgEdit(f=>({...f,floats:+e.target.value}))} style={INP}/></div>
              <div><div style={LB_S}>New Leads</div><input type="number" min="0" value={tgEdit.leads} onChange={e=>setTgEdit(f=>({...f,leads:+e.target.value}))} style={INP}/></div>
              <div><div style={LB_S}>Monthly Revenue (AED)</div><input type="number" min="0" value={tgEdit.revenue||0} onChange={e=>setTgEdit(f=>({...f,revenue:+e.target.value}))} style={INP}/></div>
            </div>
            <button style={{...btp(),marginTop:10,width:'100%'}} onClick={()=>{saveTg(tgEdit);toast$('Targets saved');}}>Save Targets</button>
          </div>
          <div style={{borderTop:`1px solid ${P.bo}`,paddingTop:12,marginTop:4}}>
            <button onClick={()=>supabase.auth.signOut()} style={{width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${P.rd}30`,background:`${P.rd}08`,color:P.rd,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>Sign out</button>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><button style={bts()} onClick={()=>setRepM(false)}>Close</button></div>
      </Mod>}

      {expD&&<Mod title="Export Data" onX={()=>setExpD(null)}>
        <div style={{fontSize:12,color:P.ts,marginBottom:8}}>Copy all → save as <code style={{background:PANEL,padding:'2px 6px',borderRadius:4,fontSize:11}}>.json</code></div>
        <textarea readOnly value={expD} style={{width:'100%',height:200,fontSize:10,fontFamily:'monospace',padding:10,borderRadius:8,border:`1px solid ${P.bo}`,background:PANEL,resize:'none',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
          <button style={btp()} onClick={()=>{const ta=document.querySelector('textarea[readonly]');if(ta){ta.select();document.execCommand('copy');toast$('✓ Copied');}}} >Copy All</button>
          <button style={bts()} onClick={()=>setExpD(null)}>Close</button>
        </div>
      </Mod>}

      {conf&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:16}}>
        <div style={{background:P.wh,border:`1px solid ${P.bo}`,borderRadius:14,padding:24,maxWidth:400,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,0.5)'}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:6,color:P.tx}}>Delete {conf.name}?</div>
          <div style={{fontSize:13,color:P.ts,marginBottom:20}}>This cannot be undone.</div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button style={bts()} onClick={()=>setConf(null)}>Cancel</button><button style={btp(P.rd)} onClick={conf.fn}>Delete</button></div>
        </div>
      </div>}

      {toast&&<div style={{position:'fixed',bottom:24,right:24,background:toast.t==='err'?P.rd:INBG,border:toast.t==='err'?'none':`1px solid ${P.bo}`,color:'#fff',padding:'11px 20px',borderRadius:10,fontWeight:600,fontSize:12,zIndex:3000,boxShadow:'0 8px 24px rgba(0,0,0,0.2)',fontFamily:'inherit'}}>{toast.msg}</div>}
    </div>
  );
}
