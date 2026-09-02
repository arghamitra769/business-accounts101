import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const ACCOUNT_TYPES = {
  ASSET: "asset",
  LIABILITY: "liability",
  CAPITAL: "capital",
  DRAWING: "drawing",
  INCOME: "income",
  EXPENSE: "expense"
};

const DEFAULT_ACCOUNTS = [
  {id:1,name:"Cash in Hand",type:"asset",nature:"debit"},
  {id:2,name:"Bank Account",type:"asset",nature:"debit"},
  {id:3,name:"Accounts Receivable",type:"asset",nature:"debit"},
  {id:4,name:"Inventory",type:"asset",nature:"debit"},
  {id:5,name:"Fixed Assets",type:"asset",nature:"debit"},
  {id:6,name:"Accounts Payable",type:"liability",nature:"credit"},
  {id:7,name:"Loan Payable",type:"liability",nature:"credit"},
  {id:8,name:"Salary Payable",type:"liability",nature:"credit"},
  {id:9,name:"Capital Account",type:"capital",nature:"credit"},
  {id:10,name:"Drawings",type:"drawing",nature:"debit"},
  {id:11,name:"Sales",type:"income",nature:"credit"},
  {id:12,name:"Service Income",type:"income",nature:"credit"},
  {id:13,name:"Other Income",type:"income",nature:"credit"},
  {id:14,name:"Purchase",type:"expense",nature:"debit"},
  {id:15,name:"Rent Expense",type:"expense",nature:"debit"},
  {id:16,name:"Salary Expense",type:"expense",nature:"debit"},
  {id:17,name:"Electricity Expense",type:"expense",nature:"debit"},
  {id:18,name:"Transport Expense",type:"expense",nature:"debit"},
  {id:19,name:"Depreciation",type:"expense",nature:"debit"},
  {id:20,name:"Miscellaneous Expense",type:"expense",nature:"debit"}
];

const STORAGE_KEY = "business-accounts-data";

const TAB_META = {
  journal:{
    kicker:"Step 1", headline:"Journal Entry",
    icon:"✎",
    bullets:[
      "Records every transaction as it happens, in date order.",
      "Applies the DEALER rule to decide which account is debited and which is credited.",
      "Feeds every other tab — nothing else calculates until an entry exists here."
    ]
  },
  ledger:{
    kicker:"Step 2", headline:"General Ledger",
    icon:"▤",
    bullets:[
      "Regroups journal entries account by account, instead of date by date.",
      "Shows a running balance so you can see each account's position at a glance.",
      "Is the bridge between raw entries and the Trial Balance."
    ]
  },
  trial:{
    kicker:"Step 3", headline:"Trial Balance",
    icon:"╋",
    bullets:[
      "Lists every account with its closing debit or credit balance.",
      "Checks that total debits equal total credits — the core sanity check in double-entry bookkeeping.",
      "A mismatch here means an entry upstream needs fixing before you trust the P&L or Balance Sheet."
    ]
  },
  income:{
    kicker:"Step 4", headline:"Profit & Loss Account",
    icon:"⌁",
    bullets:[
      "Totals income accounts and expense accounts for the period.",
      "Subtracts expenses from revenue to arrive at net profit or net loss.",
      "That result flows straight into equity on the Balance Sheet."
    ]
  },
  balance:{
    kicker:"Step 5", headline:"Balance Sheet",
    icon:"▣",
    bullets:[
      "Snapshots what the business owns (assets) against what it owes (liabilities and equity).",
      "Includes current profit or loss so the two sides tie out.",
      "Assets should always equal Liabilities + Equity — that's the balance being checked."
    ]
  },
  accounts:{
    kicker:"Setup", headline:"Manage Accounts",
    icon:"◉",
    bullets:[
      "Defines the chart of accounts — every account this business is allowed to post to.",
      "Classifies each account as asset, liability, capital, drawing, income, or expense.",
      "Classification here drives how the Journal validates DEALER and how totals are grouped everywhere else."
    ]
  },
  info:{
    kicker:"Reference", headline:"Info & Legal",
    icon:"ⓘ",
    bullets:[
      "Copyright, ownership, and legal information for this application.",
      "No transaction data lives here — it's reference only."
    ]
  }
};

const NAV = [
  ["journal","Journal","▤"],["ledger","Ledger","▥"],["trial","Trial","⌁"],
  ["income","P&L","⌁"],["balance","Balance","▣"],["accounts","Accounts","◉"],["info","Info","ⓘ"]
];

const TYPES = ["asset","liability","capital","drawing","income","expense"];

function money(value){
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
}
function today(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function displayDate(value){
  if(!value) return "";
  return new Date(value+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function normalNature(type){
  return [ACCOUNT_TYPES.ASSET,ACCOUNT_TYPES.EXPENSE,ACCOUNT_TYPES.DRAWING].includes(type) ? "debit" : "credit";
}
function badge(type){ return <span className={`badge badge-${type}`}>{type}</span>; }

function loadStored(){
  try{
    const saved = localStorage.getItem(STORAGE_KEY);
    if(!saved) return {accounts:DEFAULT_ACCOUNTS.map(x=>({...x})),journals:[]};
    const parsed = JSON.parse(saved);
    return {
      accounts:Array.isArray(parsed.accounts)&&parsed.accounts.length ? parsed.accounts : DEFAULT_ACCOUNTS.map(x=>({...x})),
      journals:Array.isArray(parsed.journals) ? parsed.journals : []
    };
  }catch{
    return {accounts:DEFAULT_ACCOUNTS.map(x=>({...x})),journals:[]};
  }
}

function saveStored(accounts,journals){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({accounts,journals}));
    return true;
  }catch{
    return false;
  }
}

function accountingData(accounts,journals){
  const accountByName = name => accounts.find(a=>a.name===name);
  const getDebitCredit = name => {
    let debit=0, credit=0;
    journals.forEach(e=>{
      const amount=Number(e.amount)||0;
      if(e.debitAccount===name) debit+=amount;
      if(e.creditAccount===name) credit+=amount;
    });
    return {debit,credit,balance:debit-credit};
  };
  const getAccountBalance = name => accountByName(name) ? getDebitCredit(name).balance : 0;

  const trial = accounts.map(a=>{
    const dc=getDebitCredit(a.name);
    return {
      name:a.name,type:a.type,
      debit:dc.balance>0?dc.balance:0,
      credit:dc.balance<0?Math.abs(dc.balance):0
    };
  }).filter(x=>x.debit!==0||x.credit!==0);

  const income=[], expenses=[];
  accounts.forEach(a=>{
    const balance=getAccountBalance(a.name);
    if(a.type===ACCOUNT_TYPES.INCOME){
      const amount=Math.max(0,-balance);
      if(amount!==0) income.push({name:a.name,amount});
    }
    if(a.type===ACCOUNT_TYPES.EXPENSE){
      const amount=Math.max(0,balance);
      if(amount!==0) expenses.push({name:a.name,amount});
    }
  });
  const totalIncome=income.reduce((s,x)=>s+x.amount,0);
  const totalExpense=expenses.reduce((s,x)=>s+x.amount,0);
  const netProfit=totalIncome-totalExpense;

  const assets=[],liabilities=[],capital=[],drawings=[];
  accounts.forEach(a=>{
    const balance=getAccountBalance(a.name);
    if(a.type===ACCOUNT_TYPES.ASSET && balance!==0) assets.push({name:a.name,amount:balance});
    if(a.type===ACCOUNT_TYPES.LIABILITY && balance!==0) liabilities.push({name:a.name,amount:Math.abs(balance)});
    if(a.type===ACCOUNT_TYPES.CAPITAL && balance!==0) capital.push({name:a.name,amount:Math.abs(balance)});
    if(a.type===ACCOUNT_TYPES.DRAWING && balance!==0) drawings.push({name:a.name,amount:Math.max(0,balance)});
  });
  const totalAssets=assets.reduce((s,x)=>s+x.amount,0);
  const totalLiabilities=liabilities.reduce((s,x)=>s+x.amount,0);
  const totalCapital=capital.reduce((s,x)=>s+x.amount,0);
  const totalDrawings=drawings.reduce((s,x)=>s+x.amount,0);
  const proprietorsEquity=totalCapital+netProfit-totalDrawings;
  const totalLiabilitiesAndEquity=totalLiabilities+proprietorsEquity;

  return {
    accountByName,getDebitCredit,getAccountBalance,trial,
    income,expenses,totalIncome,totalExpense,netProfit,
    assets,liabilities,capital,drawings,totalAssets,totalLiabilities,totalCapital,totalDrawings,
    proprietorsEquity,totalLiabilitiesAndEquity
  };
}

function exportCSV(accounts,journals){
  const d=accountingData(accounts,journals);
  const rows=[
    ["BUSINESS ACCOUNTS"],[],
    ["TRIAL BALANCE"],["Account","Debit","Credit"],
    ...d.trial.map(x=>[x.name,x.debit.toFixed(2),x.credit.toFixed(2)]),
    [],["PROFIT & LOSS"],["Income","Amount"],
    ...d.income.map(x=>[x.name,x.amount.toFixed(2)]),
    ["Total Income",d.totalIncome.toFixed(2)],[],
    ["Expenses","Amount"],
    ...d.expenses.map(x=>[x.name,x.amount.toFixed(2)]),
    ["Total Expenses",d.totalExpense.toFixed(2)],
    ["Net Profit/(Loss)",d.netProfit.toFixed(2)],[],
    ["BALANCE SHEET"],
    ["Total Assets",d.totalAssets.toFixed(2)],
    ["Total Liabilities",d.totalLiabilities.toFixed(2)],
    ["Owner's Equity",d.proprietorsEquity.toFixed(2)],
    ["Total Liabilities & Equity",d.totalLiabilitiesAndEquity.toFixed(2)]
  ];
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="business-accounts.csv";a.click();
  URL.revokeObjectURL(url);
}

function printStatements(accounts,journals){
  const d=accountingData(accounts,journals);
  const rows=d.trial.map(x=>`<tr><td>${x.name}</td><td>${money(x.debit)}</td><td>${money(x.credit)}</td></tr>`).join("");
  const income=d.income.map(x=>`<tr><td>${x.name}</td><td>${money(x.amount)}</td></tr>`).join("");
  const expenses=d.expenses.map(x=>`<tr><td>${x.name}</td><td>${money(x.amount)}</td></tr>`).join("");
  const assets=d.assets.map(x=>`<tr><td>${x.name}</td><td>${money(x.amount)}</td></tr>`).join("");
  const liabilities=d.liabilities.map(x=>`<tr><td>${x.name}</td><td>${money(x.amount)}</td></tr>`).join("");
  const capital=d.capital.map(x=>`<tr><td>${x.name}</td><td>${money(x.amount)}</td></tr>`).join("");
  const w=window.open("","_blank","width=900,height=700");
  if(!w){alert("Please allow pop-ups to print the statements.");return;}
  w.document.write(`<!doctype html><html><head><title>Business Accounts</title><style>
  body{font-family:Arial,sans-serif;color:#111;padding:30px}h1{text-align:center}h2{margin-top:35px;border-bottom:2px solid #222;padding-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:8px;font-size:12px}th{background:#f2f2f2;text-align:left}
  .total{font-weight:bold;background:#f5f5f5}.result{font-size:16px;font-weight:bold;padding:12px;border:2px solid #222;margin-top:15px}.page-break{page-break-before:always}
  </style></head><body><h1>BUSINESS ACCOUNTS</h1><div style="text-align:center;color:#666;font-size:12px">${new Date().toLocaleDateString("en-IN")}</div>
  <h2>Trial Balance</h2><table><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${rows}<tr class="total"><td>TOTAL</td><td>${money(d.trial.reduce((s,x)=>s+x.debit,0))}</td><td>${money(d.trial.reduce((s,x)=>s+x.credit,0))}</td></tr></tbody></table>
  <div class="page-break"></div><h2>Profit & Loss Account</h2><h3>Revenue</h3><table>${income}<tr class="total"><td>Total Revenue</td><td>${money(d.totalIncome)}</td></tr></table>
  <h3>Expenses</h3><table>${expenses}<tr class="total"><td>Total Expenses</td><td>${money(d.totalExpense)}</td></tr></table>
  <div class="result">${d.netProfit>=0?"NET PROFIT: ":"NET LOSS: "}${money(Math.abs(d.netProfit))}</div>
  <div class="page-break"></div><h2>Balance Sheet</h2><h3>Assets</h3><table>${assets}<tr class="total"><td>TOTAL ASSETS</td><td>${money(d.totalAssets)}</td></tr></table>
  <h3>Liabilities</h3><table>${liabilities}<tr class="total"><td>Total Liabilities</td><td>${money(d.totalLiabilities)}</td></tr></table>
  <h3>Capital & Equity</h3><table>${capital}<tr><td>Current Profit/(Loss)</td><td>${money(d.netProfit)}</td></tr><tr class="total"><td>Total Liabilities & Equity</td><td>${money(d.totalLiabilitiesAndEquity)}</td></tr></table>
  </body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),300);
}

function App(){
  const stored=useMemo(()=>loadStored(),[]);
  const [accounts,setAccounts]=useState(stored.accounts);
  const [journals,setJournals]=useState(stored.journals);
  const [tab,setTab]=useState("journal");
  const [status,setStatus]=useState(null);
  const [orientation,setOrientation]=useState("portrait");

  const d=useMemo(()=>accountingData(accounts,journals),[accounts,journals]);

  useEffect(()=>{
    const update=()=>setOrientation(window.matchMedia("(orientation: landscape)").matches?"landscape":"portrait");
    update();window.addEventListener("resize",update);
    return()=>window.removeEventListener("resize",update);
  },[]);

  useEffect(()=>{
    const onKey=e=>{
      if(e.target.matches("input,textarea,select")) return;
      const keys={j:"journal",l:"ledger",t:"trial",p:"income",b:"balance",a:"accounts",i:"info"};
      if(keys[e.key.toLowerCase()]) setTab(keys[e.key.toLowerCase()]);
      if(e.key==="?"&&e.shiftKey) alert("Shortcuts: J Journal · L Ledger · T Trial Balance · P P&L · B Balance Sheet · A Accounts · I Info");
      const numeric={"1":"journal","2":"ledger","3":"trial","4":"income","5":"balance","6":"accounts","7":"info"};
      if(numeric[e.key]) setTab(numeric[e.key]);
    };
    document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
  },[]);

  const persist=(nextAccounts,nextJournals)=>{
    if(!saveStored(nextAccounts,nextJournals)){
      setStatus({type:"error",text:"Could not save. Browser storage may be full or disabled."});
      return false;
    }
    return true;
  };

  const flash=(text,type="success")=>{
    setStatus({text,type});
    setTimeout(()=>setStatus(null),4000);
  };

  const reset=()=>{
    if(!confirm("Reset all accounts and journal transactions?\n\nThis cannot be undone.")) return;
    const next=DEFAULT_ACCOUNTS.map(x=>({...x}));
    if(!persist(next,[])) return;
    setAccounts(next);setJournals([]);setTab("journal");flash("All accounting data has been reset.","success");
  };

  const addJournal=(entry)=>{
    const next=[...journals,{...entry,id:Date.now()}];
    if(!persist(accounts,next)) return false;
    setJournals(next);flash("Journal entry saved successfully.","success");return true;
  };

  const addAccount=(name,type)=>{
    if(!name.trim()){flash("Please enter an account name.","error");return;}
    if(accounts.some(a=>a.name.toLowerCase()===name.trim().toLowerCase())){
      flash("An account with this name already exists.","error");return;
    }
    const id=accounts.length?Math.max(...accounts.map(a=>Number(a.id)||0))+1:1;
    const next=[...accounts,{id,name:name.trim(),type,nature:normalNature(type)}];
    if(!persist(next,journals)) return;
    setAccounts(next);flash("Account created.","success");
  };

  const copySummary=async()=>{
    const text=`Business Accounts\nNet ${d.netProfit>=0?"Profit":"Loss"}: ${money(Math.abs(d.netProfit))}\nAssets: ${money(d.totalAssets)}\nLiabilities + Equity: ${money(d.totalLiabilitiesAndEquity)}`;
    try{await navigator.clipboard.writeText(text);alert("Summary copied to clipboard.");}
    catch{alert("Clipboard access is unavailable in this browser.");}
  };

  const shareSummary=async()=>{
    if(!navigator.share){alert("Web Share is not available in this browser.");return;}
    try{await navigator.share({title:"Business Accounts",text:`Net ${d.netProfit>=0?"Profit":"Loss"}: ${money(Math.abs(d.netProfit))}`});}catch{}
  };

  return <div className={`app-shell is-${orientation}`}>
    <div className="mesh-bg no-print"><span className="b1"/><span className="b2"/><span className="b3"/><span className="b4"/><div className="grain"/></div>

    <Sidebar tab={tab} setTab={setTab}/>

    <header className="app-header no-print">
      <div className="app-header-inner">
        <div className="app-brand">
          <div className="app-logo"><span>⌁</span></div>
          <div><div className="app-title">Business Accounts</div><div className="app-subtitle">Professional accounting workspace</div></div>
        </div>
        <div className="sidebar-caption">Workspace</div>
        <nav className="sidebar-nav" aria-label="Accounting sections">
          {NAV.map(([id,label,icon])=><button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>)}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status"><b>LOCAL MODE</b><br/>Data stays in this browser.</div>
          <div className="header-actions-desktop">
            <button className="btn btn-secondary btn-small" onClick={()=>exportCSV(accounts,journals)}>Export</button>
            <button className="btn btn-secondary btn-small" onClick={()=>printStatements(accounts,journals)}>Print</button>
            <button className="btn btn-danger btn-small" onClick={reset}>Reset</button>
          </div>
        </div>
      </div>
    </header>

    <main className="main-container">
      <TabInfo tab={tab} onExport={()=>exportCSV(accounts,journals)} onReset={reset}/>
      {status && <div className={`status ${status.type}`}>{status.text}</div>}
      {tab==="journal" && <Journal accounts={accounts} journals={journals} onSave={addJournal} flash={flash}/>}
      {tab==="ledger" && <Ledger accounts={accounts} journals={journals} data={d}/>}
      {tab==="trial" && <Trial data={d}/>}
      {tab==="income" && <ProfitLoss data={d}/>}
      {tab==="balance" && <BalanceSheet data={d}/>}
      {tab==="accounts" && <Accounts accounts={accounts} onAdd={addAccount} flash={flash}/>}
      {tab==="info" && <Info/>}
    </main>

    <div className="floating-tools no-print">
      <button className="btn btn-small" onClick={copySummary}>Copy Summary</button>
      <button className="btn btn-small" onClick={shareSummary}>Share</button>
    </div>
  </div>;
}

function Sidebar({tab,setTab}){
  return <aside className="sidebar no-print" aria-label="Primary navigation">
    <div className="brand"><div className="brand-mark">⌂</div><div><div className="brand-name">Business OS</div><div className="brand-sub">Finance workspace</div></div></div>
    <div className="nav-label">Workspace</div>
    <nav className="side-nav">
      {NAV.map(([id,label,icon])=><button key={id} className={`side-link ${tab===id?"active":""}`} onClick={()=>setTab(id)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}
    </nav>
    <div className="sidebar-footer"><div className="system-chip"><div className="system-row"><span>LOCAL DATA</span><span className="live-dot"/></div><div className="progress"><i/></div></div></div>
  </aside>;
}

function TabInfo({tab,onExport,onReset}){
  const m=TAB_META[tab];
  return <div className="tab-info-bar no-print">
    <div className="tab-info-head">
      <div className="tab-info-icon-wrap"><div className="tab-info-icon">{m.icon}</div><div><div className="tab-info-kicker">{m.kicker}</div><div className="tab-info-headline">{m.headline}</div></div></div>
      <div className="tab-info-actions"><button className="btn" onClick={onExport}>⇩ Export</button><button className="btn btn-danger" onClick={onReset}>Reset</button></div>
    </div>
    <ul className="tab-info-bullets">{m.bullets.map(x=><li key={x}>{x}</li>)}</ul>
  </div>;
}

function PageHeader({title,description}){return <div className="page-header"><div className="page-title">{title}</div><div className="page-description">{description}</div></div>;}

function Journal({accounts,journals,onSave,flash}){
  const [date,setDate]=useState(today()),[narration,setNarration]=useState(""),[debit,setDebit]=useState(""),[credit,setCredit]=useState(""),[amount,setAmount]=useState("");
  const submit=e=>{
    e.preventDefault();
    const n=narration.trim(), a=Number(amount);
    if(!date){flash("Please select the transaction date.","error");return}
    if(!n){flash("Please enter the transaction description.","error");return}
    if(!debit){flash("Please select the account to DEBIT.","error");return}
    if(!credit){flash("Please select the account to CREDIT.","error");return}
    if(debit===credit){flash("Debit and Credit accounts cannot be the same.","error");return}
    if(!Number.isFinite(a)||a<=0){flash("Amount must be greater than ₹0.","error");return}
    if(onSave({date,narration:n,debitAccount:debit,creditAccount:credit,amount:Number(a.toFixed(2))})){
      setNarration("");setDebit("");setCredit("");setAmount("");
    }
  };
  return <><PageHeader title="Journal Entry" description="Record every business transaction using double-entry bookkeeping."/>
    <div className="journal-layout">
      <form className="card card-padding" onSubmit={submit}>
        <div className="dealer-box"><div className="dealer-title">DEALER Rule — Decide Debit & Credit</div><div className="dealer-grid">
          {[["D","Debit — Expenses","Expenses increase → Debit"],["E","Debit — Assets","Assets increase → Debit"],["A","Debit — Losses","Losses increase → Debit"],["L","Credit — Liabilities","Liabilities increase → Credit"],["E","Credit — Equity","Capital increases → Credit"],["R","Credit — Revenue","Income increases → Credit"]].map(x=><div className="dealer-item" key={x[0]+x[1]}><div className="dealer-letter">{x[0]}</div><div className="dealer-main">{x[1]}</div><div className="dealer-side">{x[2]}</div></div>)}
        </div></div>
        <div className="form-stack">
          <Field label="Transaction Date"><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
          <Field label="Particulars / Description"><input className="input" value={narration} onChange={e=>setNarration(e.target.value)} maxLength={250} placeholder="Example: Rent paid by cash"/><div className="help">Write a short description of the transaction.</div></Field>
          <Field label="Debit Account"><select className="select" value={debit} onChange={e=>setDebit(e.target.value)}><option value="">Select account to DEBIT</option>{accounts.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}</select><div className="help">Under DEALER, debit normally increases an Expense, Asset or Loss.</div></Field>
          <Field label="Credit Account"><select className="select" value={credit} onChange={e=>setCredit(e.target.value)}><option value="">Select account to CREDIT</option>{accounts.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}</select><div className="help">Under DEALER, credit normally increases a Liability, Equity or Revenue.</div></Field>
          <Field label="Amount (₹)"><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00"/><div className="help">Debit amount and credit amount must always be equal.</div></Field>
          <button className="btn btn-primary" type="submit">Save Journal Entry</button>
        </div>
      </form>
      <div className="card card-padding"><div className="section-title">Quick Examples</div>
        {[
          ["1. Rent paid in cash","Rent Expense","Cash in Hand"],
          ["2. Cash sales","Cash in Hand","Sales"],
          ["3. Owner invests cash","Cash in Hand","Capital Account"],
          ["4. Purchase asset for cash","Fixed Assets","Cash in Hand"]
        ].map(([title,dr,cr])=><div className="account-guide" key={title}><div className="guide-title">{title}</div><div className="guide-row"><span>{dr}</span><span className="guide-dr">DEBIT</span></div><div className="guide-row"><span>{cr}</span><span className="guide-cr">CREDIT</span></div></div>)}
      </div>
    </div>
    <div className="card card-padding" style={{marginTop:14}}><div className="section-title">Recent Journal Entries</div>{journals.length===0?<div className="empty">No journal entries yet.</div>:<Table headers={["Date","Description","Debit","Credit","Amount"]} rows={journals.slice().sort((a,b)=>b.id-a.id).slice(0,8).map(e=>[displayDate(e.date),e.narration,e.debitAccount,e.creditAccount,money(e.amount)])}/>}</div>
  </>;
}

function Field({label,children}){return <div><label className="field-label">{label}</label>{children}</div>}

function Table({headers,rows,footer}){
  return <div className="table-container"><table className="table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className={j>=r.length-1?"amount":""}>{c}</td>)}</tr>)}</tbody>{footer&&<tfoot>{footer}</tfoot>}</table></div>;
}

function Ledger({accounts,journals,data}){
  if(!journals.length)return <><PageHeader title="General Ledger"/><div className="card"><div className="empty">No transactions recorded.</div></div></>;
  return <><PageHeader title="General Ledger" description="Account-wise transaction history and balances."/>
    {accounts.map(a=>{
      const entries=journals.filter(e=>e.debitAccount===a.name||e.creditAccount===a.name);
      if(!entries.length)return null;
      const dc=data.getDebitCredit(a.name);
      return <div className="card card-padding" style={{marginBottom:14}} key={a.id}>
        <div className="ledger-head"><div><div className="ledger-name">{a.name}</div>{badge(a.type)}</div><div className="ledger-balance"><small>Closing Balance</small><strong>{money(Math.abs(dc.balance))}</strong><small>{dc.balance>=0?"Debit":"Credit"}</small></div></div>
        <Table headers={["Date","Description","Debit","Credit"]} rows={entries.slice().sort((x,y)=>x.date.localeCompare(y.date)).map(e=>[displayDate(e.date),e.narration,e.debitAccount===a.name?money(e.amount):"-",e.creditAccount===a.name?money(e.amount):"-"])}/>
      </div>;
    })}
  </>;
}

function SummaryGrid({items}){
  return <div className="summary-grid">{items.map(([l,v,c])=><div className="summary-card" key={l}><div className="summary-label">{l}</div><div className="summary-value" style={c?{color:c}:undefined}>{v}</div></div>)}</div>;
}

function Trial({data}){
  const td=data.trial.reduce((s,x)=>s+x.debit,0),tc=data.trial.reduce((s,x)=>s+x.credit,0),diff=Math.abs(td-tc),balanced=diff<.01;
  if(!data.trial.length)return <><PageHeader title="Trial Balance"/><div className="card"><div className="empty">No transactions available for Trial Balance.</div></div></>;
  return <><PageHeader title="Trial Balance" description="Verification that total debit balances equal total credit balances."/><SummaryGrid items={[["Total Debit",money(td)],["Total Credit",money(tc)],["Difference",money(diff)],["Status",balanced?"BALANCED":"ERROR",balanced?"#55d6a5":"#ff7089"]]}/><div className="card card-padding"><Table headers={["Account","Type","Debit","Credit"]} rows={data.trial.map(x=>[x.name,badge(x.type),x.debit?money(x.debit):"-",x.credit?money(x.credit):"-"])} footer={<tr className="total-row"><td colSpan="2">TOTAL</td><td className="amount dr-text">{money(td)}</td><td className="amount cr-text">{money(tc)}</td></tr>}/></div></>;
}

function ProfitLoss({data}){
  const profit=data.netProfit>=0;
  return <><PageHeader title="Profit & Loss Account" description="Revenue less expenses for the recorded transactions."/><SummaryGrid items={[["Revenue",money(data.totalIncome)],["Expenses",money(data.totalExpense)],["Result",profit?"PROFIT":"LOSS",profit?"#55d6a5":"#ff7089"],["Net Result",money(Math.abs(data.netProfit))]]}/><div className="card card-padding"><div className="section-title">Revenue / Income</div>{data.income.length?data.income.map(x=><Line key={x.name} name={x.name} value={money(x.amount)}/>):<div className="empty">No revenue recorded.</div>}<div className="total-line"><span>Total Revenue</span><span>{money(data.totalIncome)}</span></div><div className="section-title" style={{marginTop:20}}>Expenses</div>{data.expenses.length?data.expenses.map(x=><Line key={x.name} name={x.name} value={money(x.amount)}/>):<div className="empty">No expenses recorded.</div>}<div className="total-line"><span>Total Expenses</span><span>{money(data.totalExpense)}</span></div><div className={profit?"net-profit":"net-loss"}><span>{profit?"NET PROFIT":"NET LOSS"}</span><span>{money(Math.abs(data.netProfit))}</span></div></div></>;
}

function Line({name,value}){return <div className="line-row"><span>{name}</span><span>{value}</span></div>}

function BalanceSheet({data}){
  const diff=Math.abs(data.totalAssets-data.totalLiabilitiesAndEquity),balanced=diff<.01;
  return <><PageHeader title="Balance Sheet" description="Assets compared with liabilities and owner's equity."/><SummaryGrid items={[["Total Assets",money(data.totalAssets)],["Liabilities",money(data.totalLiabilities)],["Owner's Equity",money(data.proprietorsEquity)],["Status",balanced?"BALANCED":"CHECK",balanced?"#55d6a5":"#ff7089"]]}/><div className="card card-padding">
    <SectionList title="Assets" items={data.assets} empty="No assets recorded."/>
    <SectionList title="Liabilities" items={data.liabilities} empty="No liabilities recorded."/>
    <SectionList title="Capital & Equity" items={data.capital} empty="No capital recorded."/>
    <Line name="Current Profit / (Loss)" value={money(data.netProfit)}/>
    {data.drawings.length>0&&<SectionList title="Drawings" items={data.drawings}/>}
    <div className="total-line strong"><span>TOTAL LIABILITIES & EQUITY</span><span>{money(data.totalLiabilitiesAndEquity)}</span></div>
    <div className={balanced?"net-profit":"net-loss"}>{balanced?"✓ Balance Sheet is balanced: Assets = Liabilities + Equity.":`⚠ Balance Sheet difference: ${money(diff)}`}</div>
  </div></>;
}
function SectionList({title,items,empty="No accounts."}){
  return <><div className="section-title" style={{marginTop:20}}>{title}</div>{items.length?items.map(x=><Line key={x.name} name={x.name} value={money(x.amount)}/>):<div className="empty">{empty}</div>}</>;
}

function Accounts({accounts,onAdd,flash}){
  const [name,setName]=useState(""),[type,setType]=useState("asset");
  const submit=e=>{e.preventDefault();onAdd(name,type);if(name.trim())setName("")};
  return <><PageHeader title="Manage Accounts" description="Create accounts according to their accounting classification."/><form className="card card-padding" onSubmit={submit}><div className="section-title">Create New Account</div><div className="form-stack"><Field label="Account Name"><input className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={100} placeholder="Example: Office Equipment"/></Field><Field label="Account Type"><select className="select" value={type} onChange={e=>setType(e.target.value)}><option value="asset">Asset</option><option value="liability">Liability</option><option value="capital">Capital / Equity</option><option value="drawing">Drawings</option><option value="income">Income / Revenue</option><option value="expense">Expense</option></select></Field><button className="btn btn-primary" type="submit">Create Account</button></div></form><div className="account-groups">{TYPES.map(t=><div className="card card-padding" key={t}><div className="group-head"><strong>{t.toUpperCase()}</strong>{badge(t)}</div>{accounts.filter(a=>a.type===t).map(a=><div className="account-list-row" key={a.id}><div><b>{a.name}</b><small>Normal balance: {a.nature.toUpperCase()}</small></div>{badge(a.type)}</div>)}</div>)}</div></>;
}

function Info(){
  const year=new Date().getFullYear();
  return <><PageHeader title="Info & Legal" description="Copyright, ownership, and legal information for this application."/>
    <div className="card card-padding"><div className="section-title">Copyright</div><p>© {year} Arghamitra. All rights reserved.</p><p>This application, including its design, source code, structure, and accounting logic, is the intellectual property of Arghamitra. No part of this software may be reproduced, distributed, or transmitted in any form or by any means without prior written permission from the copyright holder.</p></div>
    <div className="card card-padding" style={{marginTop:14}}><div className="section-title">Legal Notice</div><p>This tool is provided for general bookkeeping and record-keeping purposes only. It does not constitute professional accounting, tax, or legal advice. Users are responsible for verifying that entries and resulting statements comply with applicable accounting standards and local regulations.</p><p>All financial data entered into this application is stored locally within your browser session. Arghamitra is not responsible for data loss, inaccuracies, or decisions made based on the output of this application.</p></div>
    <div className="card card-padding" style={{marginTop:14}}><div className="section-title">Disclaimer of Warranty</div><p>This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.</p></div>
  </>;
}

createRoot(document.getElementById("root")).render(<App />);
