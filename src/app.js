const CUR="₹", CATS=["Food","Transport","Bills","Shopping","Health","Fun","Other"],
EMO={Food:"🍜",Transport:"🚌",Bills:"🧾",Shopping:"🛍️",Health:"💊",Fun:"🎬",Other:"✨"},
COL={Food:"#F6C9A8",Transport:"#B9D8F0",Bills:"#D9CBF0",Shopping:"#F4BFD0",Health:"#BFE5D0",Fun:"#F7E3A1",Other:"#D5DEDB"};
const KEY="expenses-v1", BILL_KEY="utility-bills-v2", OLD_BILL_KEY="utility-bills-v1", CUSTOM_CATS_KEY="expense-categories-v1", BUDGETS_KEY="expense-budgets-v1";
const OVERALL_BUDGET="__overall__";
const INTERNAL_EMAIL_DOMAIN="accounts.expense-tracker.invalid", SUPPORT_EMAIL="lazychess08@gmail.com";
const SUPABASE_URL="https://btdkdlrflfcmnmmvwxxu.supabase.co", SUPABASE_ANON_KEY="sb_publishable_btfw7hpVeyc7KpOsqVnnvg_lOHde3Im";
let items=[], utilityBills=[], customCats=[], budgets=[], filt=null, shown=0, billShown=0, cat=CATS[0], view=new Date(); view.setDate(1);
const $=id=>document.getElementById(id);
let supaClient=null,cloudUser=null,cloudReady=false,authMode="signin";
let passwordRecoveryPending=new URLSearchParams(location.hash.slice(1)).get("type")==="recovery";
const internalAuthEmail=username=>`${username}@${INTERNAL_EMAIL_DOMAIN}`;
const storageKey=(key,userId=cloudUser?.id)=>userId?`${key}:${userId}`:key;
function loadUserCache(userId){
  try{items=JSON.parse(localStorage.getItem(storageKey(KEY,userId))||"[]")||[]}catch(e){items=[]}
  try{utilityBills=JSON.parse(localStorage.getItem(storageKey(BILL_KEY,userId))||"[]")||[]}catch(e){utilityBills=[]}
  try{customCats=JSON.parse(localStorage.getItem(storageKey(CUSTOM_CATS_KEY,userId))||"[]").filter(name=>typeof name==="string"&&name.trim()).map(name=>name.trim()).filter(name=>!CATS.some(builtin=>builtin.toLocaleLowerCase()===name.toLocaleLowerCase()))}catch(e){customCats=[]}
  try{budgets=JSON.parse(localStorage.getItem(storageKey(BUDGETS_KEY,userId))||"[]")||[]}catch(e){budgets=[]}
  try{$("noteText").value=localStorage.getItem(storageKey("notes-v1",userId))||""}catch(e){$("noteText").value=""}
}
try{items=JSON.parse(localStorage.getItem(KEY)||"[]")||[]}catch(e){items=[]}
try{budgets=JSON.parse(localStorage.getItem(BUDGETS_KEY)||"[]")||[]}catch(e){budgets=[]}
try{customCats=[...new Set(JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY)||"[]").filter(name=>typeof name==="string"&&name.trim()).map(name=>name.trim()))].filter(name=>!CATS.some(builtin=>builtin.toLocaleLowerCase()===name.toLocaleLowerCase()))}catch(e){customCats=[]}
try{
  const savedBills=localStorage.getItem(BILL_KEY);
  if(savedBills!==null)utilityBills=JSON.parse(savedBills)||[];
  else{
    utilityBills=(JSON.parse(localStorage.getItem(OLD_BILL_KEY)||"[]")||[]).map(b=>({id:b.id,name:b.name,startMonth:b.month,months:{[b.month]:{amount:b.amount,paid:false}}}));
    if(utilityBills.length)localStorage.setItem(BILL_KEY,JSON.stringify(utilityBills));
  }
}catch(e){utilityBills=[]}
function persist(){try{localStorage.setItem(storageKey(KEY),JSON.stringify(items))}catch(e){}}
function persistBills(){try{localStorage.setItem(storageKey(BILL_KEY),JSON.stringify(utilityBills))}catch(e){}}
function persistBudgets(){try{localStorage.setItem(storageKey(BUDGETS_KEY),JSON.stringify(budgets))}catch(e){}}
const money=n=>CUR+n.toLocaleString("en-IN",{maximumFractionDigits:2});
const categories=()=>[...CATS,...customCats];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const esc=s=>s.replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function countTo(t){const from=shown,st=performance.now();shown=t;
  (function f(n){const p=Math.min(1,(n-st)/450),e=1-Math.pow(1-p,3);$("total").textContent=money(Math.round((from+(t-from)*e)*100)/100);if(p<1)requestAnimationFrame(f)})(st)}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1600)}
function render(){
  const ym=iso(view).slice(0,7);
  $("month").textContent=view.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  $("billMonth").textContent=$("month").textContent;
    const all=items.filter(e=>e.date.startsWith(ym));
    const total=all.reduce((s,e)=>s+e.amount,0);
    countTo(total);
    const by={};all.forEach(e=>by[e.cat]=(by[e.cat]||0)+e.amount);
    const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]);
    if(filt&&!by[filt])filt=null;
    $("cats").style.display=rows.length?"block":"none";
    if(rows.length){
      let angle=-Math.PI/2;
      const slices=rows.map(([c,v])=>{
        const start=angle;angle+=v/total*Math.PI*2;
        const percent=Math.round(v/total*100);
        return `<path class="slice${filt===c?" selected":""}" d="${piePath(start,angle)}" fill="${COL[c]||COL.Other}" data-c="${esc(c)}" role="button" tabindex="0" aria-label="Filter ${esc(c)}, ${money(v)}, ${percent}%" aria-pressed="${filt===c}"><title>${esc(c)}: ${money(v)} (${percent}%)</title></path>`;
      }).join("");
      const legend=rows.map(([c,v])=>`<button class="legend-item${filt===c?" selected":""}" data-c="${esc(c)}" aria-pressed="${filt===c}"><span class="legend-dot" data-category="${esc(c)}"></span><span>${esc(c)}</span><span class="legend-value">${money(v)}</span></button>`).join("");
      $("cats").innerHTML=`<h2 class="chart-head">Spending by category</h2><div class="chart-layout"><svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Monthly spending by category">${slices}<circle class="donut-hole" cx="80" cy="80" r="43"></circle><text class="donut-total" x="80" y="78">${money(total)}</text><text class="donut-label" x="80" y="94">total spent</text></svg><div class="chart-legend">${legend}</div></div>`;
    }else $("cats").innerHTML="";
    renderBills();
    renderBudgets();
    renderInsights();
    const list=all.filter(e=>!filt||e.cat===filt).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    if(!list.length){$("list").innerHTML='<div class="empty">No expenses this month.<br>Tap “Add expense” to log one.</div>';return}
    let html=filt?`<div class="filt"><span>Showing ${EMO[filt]} ${filt}</span><button id="clr">Show all</button></div>`:"",last="";
    list.forEach(e=>{
      if(e.date!==last){
        if(last)html+="</div>";
        last=e.date;
        const label=new Date(e.date+"T00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
        html+=`<h2>${label}</h2><div class="card flush">`;
      }
      html+=`<div class="row"><div class="ico" data-category="${esc(e.cat)}">${EMO[e.cat]||"✨"}</div><div class="m"><div>${esc(e.note||e.cat)}</div><div>${esc(e.cat)}</div></div><div class="a">${money(e.amount)}</div><div class="row-actions"><button class="edit" data-edit-id="${e.id}" aria-label="Edit expense">✎</button><button class="x" data-id="${e.id}" aria-label="Delete expense">✕</button></div></div>`;
    });
    $("list").innerHTML=html+"</div>";
  }
function piePath(start,end){
  const cx=80,cy=80,r=70;
  const point=angle=>[cx+r*Math.cos(angle),cy+r*Math.sin(angle)];
  const [sx,sy]=point(start),[ex,ey]=point(end);
  if(end-start>=Math.PI*2-0.0001){
    const [mx,my]=point(start+Math.PI);
    return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${mx} ${my} A ${r} ${r} 0 1 1 ${sx} ${sy} Z`;
  }
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${end-start>Math.PI?1:0} 1 ${ex} ${ey} Z`;
}

function renderBills(){
  const ym=iso(view).slice(0,7);
  $("billMonth").textContent=view.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const monthBills=utilityBills.filter(b=>b.startMonth<=ym).map(b=>({bill:b,...billState(b,ym)})).sort((a,b)=>a.bill.name.localeCompare(b.bill.name));
  const total=monthBills.reduce((sum,b)=>sum+b.amount,0);
  const unpaid=monthBills.filter(b=>!b.paid);
  const unpaidTotal=unpaid.reduce((sum,b)=>sum+b.amount,0);
  const overdueTotal=unpaid.reduce((sum,b)=>sum+(billDueInfo(b.bill,ym).overdue?b.amount:0),0);
  $("billDueSummary").innerHTML=`<strong>${money(unpaidTotal)}</strong> unpaid across ${unpaid.length} ${unpaid.length===1?"bill":"bills"}${overdueTotal?` · <strong>${money(overdueTotal)}</strong> overdue`:""}`;
  const from=billShown,st=performance.now();billShown=total;
  (function f(now){const p=Math.min(1,(now-st)/450),e=1-Math.pow(1-p,3);$("billTotal").textContent=money(Math.round((from+(total-from)*e)*100)/100);if(p<1)requestAnimationFrame(f)})(st);
  if(!monthBills.length){$("billList").innerHTML='<div class="empty">No monthly bills yet.<br>Add a bill to start tracking it.</div>';return}
  $("billList").innerHTML='<div class="card flush">'+monthBills.map(b=>{const due=billDueInfo(b.bill,ym);return `<div class="row bill-row"><div class="bill-status" role="radiogroup" aria-label="${esc(b.bill.name)} status"><label><input type="radio" name="bill-status-${b.bill.id}" value="paid" data-bill-status="paid" data-bill-id="${b.bill.id}"${b.paid?' checked':''}>Paid</label><label><input type="radio" name="bill-status-${b.bill.id}" value="due" data-bill-status="due" data-bill-id="${b.bill.id}"${b.paid?'':' checked'}>Due</label></div><div class="m"><div>${esc(b.bill.name)}</div><div class="bill-meta${!b.paid&&due.overdue?' overdue':''}">${b.paid?'Paid':due.overdue?'Overdue':`Due ${due.label}`}</div></div><label class="bill-amount"><span>₹</span><input type="number" min="0" step="0.01" value="${b.amount}" aria-label="${esc(b.bill.name)} amount" data-bill-amount data-bill-id="${b.bill.id}"></label><button class="x" data-bill-delete="${b.bill.id}" aria-label="Delete ${esc(b.bill.name)}">✕</button></div>`}).join("")+'</div>';
}

function renderBudgets(){
  const month=iso(view).slice(0,7);
  const monthItems=items.filter(item=>item.date.startsWith(month));
  const spent=monthItems.reduce((sum,item)=>sum+item.amount,0);
  const monthBudgets=budgets.filter(budget=>budget.month===month);
  const overall=monthBudgets.find(budget=>budget.category===OVERALL_BUDGET);
  $("budgetMonth").textContent=view.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  $("budgetSpent").textContent=money(spent);
  if(overall){
    const remaining=overall.amount-spent,percent=spent/overall.amount*100,over=remaining<0;
      $("budgetSummary").innerHTML=`<div class="budget-summary"><div class="budget-summary-top"><div class="budget-summary-copy"><strong>${money(spent)} of ${money(overall.amount)} spent</strong><span>${over?`${money(-remaining)} over budget`:`${money(remaining)} remaining`}</span></div><div class="budget-actions"><button type="button" data-budget-edit="${OVERALL_BUDGET}" data-budget-month="${month}" aria-label="Edit overall budget">✎</button><button type="button" data-budget-delete="${OVERALL_BUDGET}" data-budget-month="${month}" aria-label="Delete overall budget">✕</button></div></div><div class="budget-track"><div class="budget-fill${over?" over":""}" style="width:${Math.min(100,percent)}%"></div></div></div>`;
  }else{
    $("budgetSummary").innerHTML='<div class="budget-summary"><strong>No overall limit set</strong><span>You can still set limits for individual categories.</span></div>';
  }
  const categoryBudgets=monthBudgets.filter(budget=>budget.category!==OVERALL_BUDGET).sort((a,b)=>a.category.localeCompare(b.category));
  if(!categoryBudgets.length){$("budgetList").innerHTML='<div class="empty">No category limits for this month yet.</div>';return}
  $("budgetList").innerHTML='<div class="card flush budget-list">'+categoryBudgets.map(budget=>{
    const categorySpent=monthItems.filter(item=>item.cat===budget.category).reduce((sum,item)=>sum+item.amount,0);
    const remaining=budget.amount-categorySpent,over=remaining<0,percent=categorySpent/budget.amount*100;
    return `<div class="budget-item"><div class="budget-head"><span class="budget-title">${EMO[budget.category]||"✨"} ${esc(budget.category)}</span><span>${money(budget.amount)}</span><div class="budget-actions"><button type="button" data-budget-edit="${esc(budget.category)}" data-budget-month="${budget.month}" aria-label="Edit ${esc(budget.category)} budget">✎</button><button type="button" data-budget-delete="${esc(budget.category)}" data-budget-month="${budget.month}" aria-label="Delete ${esc(budget.category)} budget">✕</button></div></div><div class="budget-track"><div class="budget-fill${over?" over":""}" style="width:${Math.min(100,percent)}%"></div></div><div class="budget-meta"><span>${money(categorySpent)} spent</span><span>${over?`${money(-remaining)} over`:`${money(remaining)} left`}</span></div></div>`;
  }).join("")+'</div>';
}

function renderInsights(){
  const currentMonth=iso(view).slice(0,7);
  const previousDate=new Date(view.getFullYear(),view.getMonth()-1,1);
  const previousMonth=iso(previousDate).slice(0,7);
  const currentName=view.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const previousName=previousDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const currentItems=items.filter(item=>item.date.startsWith(currentMonth));
  const previousItems=items.filter(item=>item.date.startsWith(previousMonth));
  const currentTotal=currentItems.reduce((sum,item)=>sum+item.amount,0);
  const previousTotal=previousItems.reduce((sum,item)=>sum+item.amount,0);
  const difference=currentTotal-previousTotal;
  const changeLabel=previousTotal===0
    ?currentTotal===0?"No spending in either month":"No spending last month"
    :`${difference>0?"↑":difference<0?"↓":""}${difference===0?"No change":`${money(Math.abs(difference))} (${(Math.abs(difference)/previousTotal*100).toFixed(0)}%)`}`;
  const changeClass=difference>0?"up":difference<0?"down":"";
  $("insightMonth").textContent=currentName;
  $("monthComparison").innerHTML=`<div class="card insight-summary"><h2>Compared with ${previousName}</h2><div class="insight-metrics"><div class="insight-metric"><strong>${money(currentTotal)}</strong><span>This month</span></div><div class="insight-metric"><strong>${money(previousTotal)}</strong><span>Previous month</span></div><div class="insight-metric"><strong class="insight-change ${changeClass}">${changeLabel}</strong><span>Change</span></div></div></div>`;

  const monthlyTotals=[];
  for(let offset=5;offset>=0;offset--){
    const monthDate=new Date(view.getFullYear(),view.getMonth()-offset,1);
    const month=iso(monthDate).slice(0,7);
    const total=items.filter(item=>item.date.startsWith(month)).reduce((sum,item)=>sum+item.amount,0);
    monthlyTotals.push({month,total,label:monthDate.toLocaleDateString("en-IN",{month:"short",year:"2-digit"})});
  }
  const maxMonthlyTotal=Math.max(0,...monthlyTotals.map(item=>item.total));
  $("sixMonthTrend").innerHTML=monthlyTotals.some(item=>item.total>0)
    ?'<div class="card flush trend-list">'+monthlyTotals.map(item=>`<div class="trend-item"><div class="trend-title"><span>${item.label}</span><span>${money(item.total)}</span></div><div class="trend-track" role="img" aria-label="${item.label}: ${money(item.total)}"><div class="trend-fill" style="width:${maxMonthlyTotal?item.total/maxMonthlyTotal*100:0}%"></div></div></div>`).join("")+'</div>'
    :'<div class="empty">No spending in this six-month period.</div>';

  const categoryTotals=new Map();
  for(const item of [...previousItems,...currentItems]){
    const totals=categoryTotals.get(item.cat)||{current:0,previous:0};
    totals[item.date.startsWith(currentMonth)?"current":"previous"]+=item.amount;
    categoryTotals.set(item.cat,totals);
  }
  const categoryRows=[...categoryTotals.entries()].sort((a,b)=>Math.max(b[1].current,b[1].previous)-Math.max(a[1].current,a[1].previous));
  const maxCategoryTotal=Math.max(0,...categoryRows.flatMap(([,totals])=>[totals.current,totals.previous]));
  $("categoryTrend").innerHTML=categoryRows.length
    ?'<div class="card flush trend-list">'+categoryRows.map(([category,totals])=>{
      const categoryDifference=totals.current-totals.previous;
      const label=totals.previous===0?(totals.current>0?"New":"No change"):`${categoryDifference>0?"↑":categoryDifference<0?"↓":""}${categoryDifference===0?"No change":money(Math.abs(categoryDifference))}`;
      const direction=categoryDifference>0?"up":categoryDifference<0?"down":"";
      return `<div class="trend-item"><div class="trend-title"><span>${EMO[category]||"✨"} ${esc(category)}</span><span class="insight-change ${direction}">${label}</span></div><div class="trend-line"><label>This month</label><div class="trend-track"><div class="trend-fill" style="width:${maxCategoryTotal?totals.current/maxCategoryTotal*100:0}%"></div></div><strong>${money(totals.current)}</strong></div><div class="trend-line"><label>Last month</label><div class="trend-track"><div class="trend-fill prior" style="width:${maxCategoryTotal?totals.previous/maxCategoryTotal*100:0}%"></div></div><strong>${money(totals.previous)}</strong></div></div>`;
    }).join("")+'</div>'
    :'<div class="empty">No category spending in these two months.</div>';
}

function billDueInfo(b,ym){
  const [year,month]=ym.split("-").map(Number);
  const lastDay=new Date(year,month,0).getDate();
  const dueDay=Math.min(Math.max(Number(b.dueDay)||1,1),lastDay);
  const dueDate=new Date(year,month-1,dueDay);
  const today=new Date();today.setHours(0,0,0,0);
  const currentMonth=iso(today).slice(0,7);
  return {label:dueDate.toLocaleDateString("en-IN",{day:"numeric",month:"short"}),overdue:ym<currentMonth||(ym===currentMonth&&dueDate<today)};
}

function billState(b,ym){
  const month=Object.keys(b.months).filter(key=>key<=ym).sort().pop();
  const record=month&&b.months[month];
  return {amount:record?.amount||0,paid:month===ym&&!!record?.paid};
}

function chips(){
  $("chips").innerHTML=categories().map(c=>`<button class="chip${c===cat?" on":""}" data-c="${esc(c)}">${EMO[c]||"✨"} ${esc(c)}</button>`).join("");
}
function openSheet(expense=null){
  $("entrySheet").dataset.kind="expense";
  if(expense)$("entrySheet").dataset.expenseId=expense.id;else delete $("entrySheet").dataset.expenseId;
  $("entrySheet").setAttribute("aria-label",expense?"Edit expense":"Add expense");
  $("categoryField").style.display="block";$("noteLabel").textContent="Note";$("note").placeholder="What was it for?";
  $("dateLabel").textContent="Date";$("date").type="date";$("save").textContent=expense?"Save changes":"Save expense";
  $("dueDayField").style.display="none";
  $("amt").value=expense?String(expense.amount):"";$("note").value=expense?expense.note||"":"";$("date").value=expense?expense.date:iso(new Date());cat=expense?expense.cat:CATS[0];chips();
  $("customCategory").value="";
  chk();$("bg").classList.add("on");setTimeout(() => $("amt").focus(), 50);
}
function openBillSheet(){
  $("entrySheet").dataset.kind="bill";
  delete $("entrySheet").dataset.expenseId;
  $("entrySheet").setAttribute("aria-label","Add monthly bill");
  $("categoryField").style.display="none";$("noteLabel").textContent="Utility";$("note").placeholder="Electricity, water, internet…";
  $("dateLabel").textContent="Starts in";$("date").type="month";$("date").value=iso(view).slice(0,7);
  $("dueDayField").style.display="block";$("dueDay").value="1";
  $("save").textContent="Add monthly bill";$("amt").value="";$("note").value="";
  chk();$("bg").classList.add("on");setTimeout(() => $("amt").focus(), 50);
}
function openBudgetSheet(budget=null){
  const month=budget?.month||iso(view).slice(0,7);
  $("budgetFormMonth").value=month;
  $("budgetCategory").innerHTML=`<option value="${OVERALL_BUDGET}">Overall</option>`+categories().map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");
  $("budgetCategory").value=budget?.category||OVERALL_BUDGET;
  $("budgetAmount").value=budget?String(budget.amount):"";
  $("budgetBg").classList.add("on");setTimeout(() => $("budgetAmount").focus(),50);
}
function chk(){$("save").classList.toggle("ready",parseFloat($("amt").value.replace(",","."))>0)}
$("amt").oninput=chk;
function closeSheet(){$("bg").classList.remove("on")}
function closeBudgetSheet(){$("budgetBg").classList.remove("on")}

$("add").onclick=()=>openSheet();
$("cancel").onclick=closeSheet;
$("bg").onclick=e=>{if(e.target===$("bg"))closeSheet()};
$("budgetCancel").onclick=closeBudgetSheet;
$("budgetBg").onclick=e=>{if(e.target===$("budgetBg"))closeBudgetSheet()};
$("chips").onclick=e=>{const c=e.target.dataset.c;if(c){cat=c;chips()}};
$("addCategory").onclick=()=>{
  const name=$("customCategory").value.trim();
  if(!name)return;
  const existing=categories().find(category=>category.toLocaleLowerCase()===name.toLocaleLowerCase());
  if(existing){cat=existing;$("customCategory").value="";chips();toast("Category already exists");return}
  customCats.push(name);
  try{localStorage.setItem(storageKey(CUSTOM_CATS_KEY),JSON.stringify(customCats))}catch(e){}
  syncCategory(name);cat=name;$("customCategory").value="";chips();toast("Category added");
};
$("budgetForm").onsubmit=e=>{
  e.preventDefault();
  const month=$("budgetFormMonth").value,category=$("budgetCategory").value,amount=Number($("budgetAmount").value);
  if(!month||!category||!Number.isFinite(amount)||amount<=0)return;
  const budget={month,category,amount};
  const index=budgets.findIndex(item=>item.month===month&&item.category===category);
  if(index<0)budgets.push(budget);else budgets[index]=budget;
  persistBudgets();syncBudget(budget);closeBudgetSheet();render();toast("Budget saved");
};
$("save").onclick=()=>{
  const amount=parseFloat($("amt").value.replace(",","."));
  if(!(amount>0)){$("amt").focus();return}
  if($("entrySheet").dataset.kind==="bill"){
    const month=$("date").value||iso(new Date()).slice(0,7);
    const name=$("note").value.trim();
    if(!name){$("note").focus();return}
    const dueDay=Math.min(31,Math.max(1,parseInt($("dueDay").value,10)||1));
    const bill={id:Date.now(),name,startMonth:month,dueDay,months:{[month]:{amount,paid:false}}};
    utilityBills.push(bill);
    persistBills();syncBill(bill);closeSheet();toast("Utility bill saved ✓");
    view=new Date(month+"-01T00:00");render();return;
  }
  const date=$("date").value||iso(new Date());
  const expenseId=$("entrySheet").dataset.expenseId;
  let expense;
  if(expenseId){
    const index=items.findIndex(item=>String(item.id)===expenseId);
    if(index<0)return;
    expense={...items[index],amount,cat,note:$("note").value.trim(),date};
    items[index]=expense;
  }else{
    expense={id:Date.now(),amount,cat,note:$("note").value.trim(),date};
    items.push(expense);
  }
  persist();syncExpense(expense);closeSheet();toast(expenseId?"Expense updated ✓":"Expense saved ✓");
  view=new Date(date+"T00:00");view.setDate(1);render();
};
$("list").onclick=e=>{
  if(e.target.id==="clr"){filt=null;render();return}
  const editButton=e.target.closest("[data-edit-id]");
  if(editButton){const expense=items.find(item=>String(item.id)===editButton.dataset.editId);if(expense)openSheet(expense);return}
  const id=e.target.dataset.id;
  if(id&&confirm("Delete this expense?")){e.target.closest(".row").classList.add("out");setTimeout(()=>{items=items.filter(x=>String(x.id)!==id);persist();syncDelete("expense_tracker_expenses",id);render();toast("Deleted")},250)}
};
$("cats").onclick=e=>{const target=e.target.closest("[data-c]");if(target){filt=filt===target.dataset.c?null:target.dataset.c;render()}};
$("cats").onkeydown=e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.matches(".slice")){e.preventDefault();filt=filt===e.target.dataset.c?null:e.target.dataset.c;render()}
};
$("prev").onclick=()=>{view.setMonth(view.getMonth()-1);render()};
$("next").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("billPrev").onclick=()=>{view.setMonth(view.getMonth()-1);render()};
$("billNext").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("budgetPrev").onclick=()=>{view.setMonth(view.getMonth()-1);render()};
$("budgetNext").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("insightPrev").onclick=()=>{view.setMonth(view.getMonth()-1);render()};
$("insightNext").onclick=()=>{view.setMonth(view.getMonth()+1);render()};
$("billList").onclick=e=>{
  const id=e.target.dataset.billDelete;
  if(id&&confirm("Delete this monthly bill?")){
    e.target.closest(".row").classList.add("out");
    setTimeout(()=>{utilityBills=utilityBills.filter(b=>String(b.id)!==id);persistBills();syncDelete("expense_tracker_utility_bills",id);renderBills();toast("Deleted")},250);
  }
};
$("billList").onchange=e=>{
  const id=e.target.dataset.billId;
  if(!id)return;
  const bill=utilityBills.find(b=>String(b.id)===id);
  if(!bill)return;
  const ym=iso(view).slice(0,7),state=billState(bill,ym);
  if(e.target.hasAttribute("data-bill-amount")){
    const amount=parseFloat(e.target.value);
    if(!Number.isFinite(amount)||amount<0){renderBills();return}
    bill.months[ym]={amount,paid:state.paid};
  }else if(e.target.hasAttribute("data-bill-status")){
    bill.months[ym]={amount:state.amount,paid:e.target.value==="paid"};
  }else return;
  persistBills();syncBill(bill);renderBills();
};
function handleBudgetActions(e){
  const edit=e.target.closest("[data-budget-edit]");
  if(edit){
    const budget=budgets.find(item=>item.month===edit.dataset.budgetMonth&&item.category===edit.dataset.budgetEdit);
    if(budget)openBudgetSheet(budget);
    return;
  }
  const remove=e.target.closest("[data-budget-delete]");
  if(remove&&confirm("Delete this monthly budget?")){
    const {budgetMonth:month,budgetDelete:category}=remove.dataset;
    budgets=budgets.filter(item=>item.month!==month||item.category!==category);
    persistBudgets();syncDeleteBudget(month,category);render();toast("Budget deleted");
  }
}
$("budgetList").onclick=handleBudgetActions;
$("budgetSummary").onclick=handleBudgetActions;
function tab(n){
  $("exp").style.display=n===0?"block":"none";
  $("bills").style.display=n===1?"block":"none";
  $("notes").style.display=n===2?"block":"none";
  $("budget").style.display=n===3?"block":"none";
  $("insights").style.display=n===4?"block":"none";
  $("add").style.display=n===2||n===4?"none":"block";
  $("add").textContent=n===1?"Add monthly bill":n===3?"Set budget":"Add expense";
  $("add").onclick=n===1?openBillSheet:n===3?()=>openBudgetSheet():()=>openSheet();
  $("title").textContent=n===1?"Utility Bills":n===2?"Notes":n===3?"Budget":n===4?"Insights":"Expenses";
  $("tabE").classList.toggle("on",n===0);$("tabInsights").classList.toggle("on",n===4);$("tabManage").classList.toggle("on",n===5);
  $("tabE").setAttribute("aria-selected",String(n===0));
  $("tabInsights").setAttribute("aria-selected",String(n===4));
  $("tabManage").setAttribute("aria-selected",String(n===5));
  $("prev").parentElement.style.display=n===0?"flex":"none";
  $("billPrev").parentElement.style.display=n===1?"flex":"none";
  $("budgetPrev").parentElement.style.display=n===3?"flex":"none";
  $("insightPrev").parentElement.style.display=n===4?"flex":"none";
}
function openManageSheet(){
  $("manageBg").classList.add("on");
  $("manageSheet").setAttribute("aria-hidden","false");
}
function closeManageSheet(){
  $("manageBg").classList.remove("on");
  $("manageSheet").setAttribute("aria-hidden","true");
}
$("tabE").onclick=()=>tab(0);
$("tabInsights").onclick=()=>tab(4);
$("tabManage").onclick=openManageSheet;
$("manageClose").onclick=closeManageSheet;
$("manageBg").onclick=e=>{if(e.target===$("manageBg"))closeManageSheet();};
$("manageUtility").onclick=()=>{closeManageSheet();tab(1);};
$("manageNotes").onclick=()=>{closeManageSheet();tab(2);};
$("manageBudget").onclick=()=>{closeManageSheet();tab(3);};
try{$("noteText").value=localStorage.getItem("notes-v1")||""}catch(e){}
let nt;
$("noteText").oninput=()=>{
  $("saved").textContent="Saving…";clearTimeout(nt);
  nt=setTimeout(()=>{try{localStorage.setItem(storageKey("notes-v1"),$("noteText").value);$("saved").textContent="Saved";syncNotes($("noteText").value)}catch(e){$("saved").textContent="Could not save"}},400);
};
initCloud();
render();
tab(0);

function expenseRow(expense,userId=cloudUser.id){
  return {user_id:userId,id:expense.id,amount:expense.amount,category:expense.cat,note:expense.note||"",date:expense.date};
}
function billRow(bill,userId=cloudUser.id){
  return {user_id:userId,id:bill.id,name:bill.name,start_month:bill.startMonth,due_day:bill.dueDay||1,months:bill.months||{}};
}
async function syncMutation(request){
  if(!cloudReady||!cloudUser)return;
  $("syncStatus").textContent="Saving…";
  try{
    const {error}=await request();
    $("syncStatus").textContent=error?"Sync failed":"Synced";
  }catch(error){$("syncStatus").textContent="Sync failed"}
}
function syncExpense(expense){
  return syncMutation(()=>supaClient.from("expense_tracker_expenses").upsert(expenseRow(expense),{onConflict:"user_id,id"}));
}
function syncCategory(name){
  return syncMutation(()=>supaClient.from("expense_tracker_categories").upsert({user_id:cloudUser.id,name},{onConflict:"user_id,name"}));
}
function budgetRow(budget,userId=cloudUser.id){
  return {user_id:userId,month:budget.month,category:budget.category,amount:budget.amount};
}
function syncBudget(budget){
  return syncMutation(()=>supaClient.from("expense_tracker_budgets").upsert(budgetRow(budget),{onConflict:"user_id,month,category"}));
}
function syncDeleteBudget(month,category){
  return syncMutation(()=>supaClient.from("expense_tracker_budgets").delete().eq("user_id",cloudUser.id).eq("month",month).eq("category",category));
}
function syncBill(bill){
  return syncMutation(()=>supaClient.from("expense_tracker_utility_bills").upsert(billRow(bill),{onConflict:"user_id,id"}));
}
function syncDelete(table,id){
  return syncMutation(()=>supaClient.from(table).delete().eq("user_id",cloudUser.id).eq("id",id));
}
function syncNotes(content){
  return syncMutation(()=>supaClient.from("expense_tracker_notes").upsert({user_id:cloudUser.id,content},{onConflict:"user_id"}));
}
async function fetchAllRows(table,columns,userId){
  const pageSize=1000,rows=[];
  for(let offset=0;;offset+=pageSize){
    const {data,error}=await supaClient.from(table).select(columns).eq("user_id",userId).order("id").range(offset,offset+pageSize-1);
    if(error)throw error;
    rows.push(...data);
    if(data.length<pageSize)return rows;
  }
}
async function fetchAllBudgets(userId){
  const pageSize=1000,rows=[];
  for(let offset=0;;offset+=pageSize){
    const {data,error}=await supaClient.from("expense_tracker_budgets").select("month,category,amount").eq("user_id",userId).order("month").order("category").range(offset,offset+pageSize-1);
    if(error)throw error;
    rows.push(...data.map(row=>({month:row.month,category:row.category,amount:Number(row.amount)})));
    if(data.length<pageSize)return rows;
  }
}
async function activateCloudSession(session){
  if(passwordRecoveryPending){showPasswordResetForm();return}
  if(!session){
    cloudUser=null;cloudReady=false;$("userName").style.display="none";$("signOut").style.display="none";
    $("resetForm").hidden=true;$("authForm").hidden=false;setAuthMode("signin");
    $("authPassword").value="";$("resetStatus").textContent="";$("authGate").style.display="grid";return;
  }
  if(cloudReady&&cloudUser?.id===session.user.id)return;
  cloudUser=session.user;cloudReady=false;loadUserCache(cloudUser.id);$("authGate").style.display="grid";$("authStatus").textContent="Loading your cloud data…";
  try{
    const [expenses,bills,cloudBudgets,categoryResult,noteResult]=await Promise.all([
      fetchAllRows("expense_tracker_expenses","id,amount,category,note,date",cloudUser.id),
      fetchAllRows("expense_tracker_utility_bills","id,name,start_month,due_day,months",cloudUser.id),
      fetchAllBudgets(cloudUser.id),
      supaClient.from("expense_tracker_categories").select("name").eq("user_id",cloudUser.id).order("name"),
      supaClient.from("expense_tracker_notes").select("content").eq("user_id",cloudUser.id).maybeSingle()
    ]);
    if(categoryResult.error)throw categoryResult.error;
    if(noteResult.error)throw noteResult.error;
    const cloudCategories=categoryResult.data.map(row=>row.name);
    const categoriesFromExpenses=expenses.map(row=>row.category).filter(name=>!CATS.some(builtin=>builtin.toLocaleLowerCase()===name.toLocaleLowerCase()));
    const cloudCustomCats=[...new Map([...cloudCategories,...categoriesFromExpenses].filter(name=>name&&!CATS.some(builtin=>builtin.toLocaleLowerCase()===name.toLocaleLowerCase())).map(name=>[name.toLocaleLowerCase(),name])).values()];
    const hasCloudData=expenses.length||bills.length||cloudBudgets.length||categoryResult.data.length||noteResult.data;
    if(hasCloudData){
      customCats=cloudCustomCats;
      budgets=cloudBudgets;
      items=expenses.map(row=>({id:Number(row.id),amount:Number(row.amount),cat:row.category,note:row.note||"",date:row.date}));
      utilityBills=bills.map(row=>({id:Number(row.id),name:row.name,startMonth:row.start_month,dueDay:row.due_day,months:row.months||{}}));
      $("noteText").value=noteResult.data?.content||"";
      localStorage.setItem(storageKey(KEY),JSON.stringify(items));localStorage.setItem(storageKey(BILL_KEY),JSON.stringify(utilityBills));localStorage.setItem(storageKey("notes-v1"),$("noteText").value);localStorage.setItem(storageKey(CUSTOM_CATS_KEY),JSON.stringify(customCats));localStorage.setItem(storageKey(BUDGETS_KEY),JSON.stringify(budgets));
    }else{
      try{localStorage.setItem(storageKey(CUSTOM_CATS_KEY),JSON.stringify(customCats))}catch(e){}
      try{localStorage.setItem(storageKey(BUDGETS_KEY),JSON.stringify(budgets))}catch(e){}
      const initialWrites=[];
      if(items.length)initialWrites.push(supaClient.from("expense_tracker_expenses").upsert(items.map(item=>expenseRow(item,cloudUser.id)),{onConflict:"user_id,id"}));
      if(utilityBills.length)initialWrites.push(supaClient.from("expense_tracker_utility_bills").upsert(utilityBills.map(bill=>billRow(bill,cloudUser.id)),{onConflict:"user_id,id"}));
      if(budgets.length)initialWrites.push(supaClient.from("expense_tracker_budgets").upsert(budgets.map(budget=>budgetRow(budget,cloudUser.id)),{onConflict:"user_id,month,category"}));
      if(customCats.length)initialWrites.push(supaClient.from("expense_tracker_categories").upsert(customCats.map(name=>({user_id:cloudUser.id,name})),{onConflict:"user_id,name"}));
      initialWrites.push(supaClient.from("expense_tracker_notes").upsert({user_id:cloudUser.id,content:$("noteText").value},{onConflict:"user_id"}));
      const writeResults=await Promise.all(initialWrites);
      const failedWrite=writeResults.find(result=>result.error);
      if(failedWrite)throw failedWrite.error;
    }
    cloudReady=true;showUserName(cloudUser);$("syncStatus").textContent="Synced";$("signOut").style.display="block";$("authGate").style.display="none";$("authStatus").textContent="";render();
  }catch(error){
    cloudUser=null;cloudReady=false;$("authStatus").textContent=`Could not load cloud data: ${error.message}`;
  }
}
function initCloud(){
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY){$("syncStatus").textContent="Cloud not configured";return}
  if(!window.supabase){$("syncStatus").textContent="Cloud library unavailable";return}
  $("authGate").style.display="grid";
  $("authStatus").textContent="Checking your account…";
  $("syncStatus").textContent="Connecting…";
  supaClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  supaClient.auth.onAuthStateChange((event,session)=>{
    if(event==="PASSWORD_RECOVERY"){passwordRecoveryPending=true;showPasswordResetForm();return}
    setTimeout(()=>activateCloudSession(session),0);
  });
  supaClient.auth.getSession().then(({data,error})=>{
    if(error){$("authStatus").textContent=error.message;$("authGate").style.display="grid";return}
    activateCloudSession(data.session);
  });
}
function showPasswordResetForm(){
  $("authForm").hidden=true;$("resetForm").hidden=false;$("authGate").style.display="grid";
}
function setAuthMode(mode){
  authMode=mode;
  $("authNameField").style.display=authMode==="signup"?"block":"none";
  $("authName").required=authMode==="signup";
  $("authHeading").textContent=authMode==="signup"?"Create account":"Sign in";
  $("authSubmit").textContent=authMode==="signup"?"Create account":"Sign in";
  $("authToggle").textContent=authMode==="signup"?"Back to sign in":"Create an account";
  $("forgotPassword").style.display=authMode==="signup"?"none":"block";
  $("authPassword").autocomplete=authMode==="signup"?"new-password":"current-password";
  $("authStatus").textContent="";
}
$("authToggle").onclick=()=>{
  setAuthMode(authMode==="signin"?"signup":"signin");
};
$("authForm").onsubmit=async e=>{
  e.preventDefault();$("authSubmit").disabled=true;$("authStatus").textContent="Connecting…";
  const username=$("authUsername").value.trim().toLowerCase(),password=$("authPassword").value;
  if(!/^[a-z0-9_]{3,24}$/.test(username)){$("authSubmit").disabled=false;$("authStatus").textContent="Use 3–24 letters, numbers, or underscores for the username.";return}
  try{
    if(authMode==="signup"){
      const {error}=await supaClient.functions.invoke("username-signup",{body:{username,password,fullName:$("authName").value.trim()}});
      if(error){
        let message="Could not create account.";
        if(error.context instanceof Response){try{message=(await error.context.clone().json()).error||message}catch(e){}}
        $("authStatus").textContent=message;return;
      }
    }
    const {error}=await supaClient.auth.signInWithPassword({email:internalAuthEmail(username),password});
    if(error){$("authStatus").textContent=authMode==="signup"?"Account created. Sign in with your username and password.":"Invalid username or password.";return}
  }catch(error){$("authStatus").textContent="Could not connect. Check your connection and try again."}
  finally{$("authSubmit").disabled=false}
};
$("forgotPassword").onclick=()=>{
  const username=$("authUsername").value.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,24}$/.test(username)){$("authStatus").textContent="Enter your username first, then request a reset.";$("authUsername").focus();return}
  const subject=encodeURIComponent("Expense Tracker password reset request");
  const body=encodeURIComponent(`Please help me reset my Expense Tracker password.\n\nUsername: ${username}`);
  location.href=`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
};
$("resetForm").onsubmit=async e=>{
  e.preventDefault();
  const password=$("resetPassword").value;
  if(password!==$("resetPasswordConfirm").value){$("resetStatus").textContent="Passwords do not match.";return}
  const button=$("resetForm").querySelector('button[type="submit"]');button.disabled=true;$("resetStatus").textContent="Updating password…";
  const {error}=await supaClient.auth.updateUser({password});
  button.disabled=false;
  if(error){$("resetStatus").textContent=error.message;return}
  passwordRecoveryPending=false;
  history.replaceState(null,"",location.pathname+location.search);
  $("resetStatus").textContent="Password updated. Signing in…";
  const {data}=await supaClient.auth.getSession();
  if(data.session)await activateCloudSession(data.session);
};
$("cancelReset").onclick=async()=>{
  passwordRecoveryPending=false;await supaClient.auth.signOut();
  $("resetForm").hidden=true;$("authForm").hidden=false;$("authGate").style.display="grid";
};
$("signOut").onclick=async()=>{await supaClient.auth.signOut();};
function showUserName(user){
  const metadata=user.user_metadata||{};
  const name=metadata.full_name||metadata.name||"";
  const fallback=name||metadata.username||"Account";
  const button=$("userName");button.textContent=fallback;button.title=name?"Edit display name":"Set your display name";button.style.display="inline-block";
}
$("userName").onclick=async()=>{
  if(!cloudUser)return;
  const current=cloudUser.user_metadata?.full_name||cloudUser.user_metadata?.name||"";
  const name=prompt("Display name",current)?.trim();
  if(!name||name===current)return;
  const {data,error}=await supaClient.auth.updateUser({data:{full_name:name}});
  if(error){toast("Could not update name");return}
  cloudUser=data.user;showUserName(cloudUser);
};
