(()=>{'use strict';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dateMonth=()=>new Date().toLocaleDateString('en-CA').slice(0,7);
let attendanceMonth=dateMonth(),attendancePerson='',performanceMonth=dateMonth(),menuView='book',importRows=[],source='petpooja';
const rolesFull=['owner','manager'];
const dateSort=v=>String(v||'').slice(0,10);
function csv(text){
 const records=[],row=[];let field='',quoted=false;
 text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(field.trim());field=''}
  else if(c==='\n'&&!quoted){row.push(field.trim());records.push([...row]);row.length=0;field=''}
  else field+=c;
 }
 if(quoted)throw Error('Unclosed quoted field in CSV.');
 if(field||row.length){row.push(field.trim());records.push([...row])}
 const headers=(records.shift()||[]).map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
 if(!headers.length)throw Error('CSV requires column headings.');
 return records.filter(r=>r.some(Boolean)).map(row=>Object.fromEntries(headers.map((k,i)=>[k,row[i]||''])));
}
function headline(title,subtitle,tools=''){return '<div class="page-head"><div><span class="eyebrow ink">CASSIA / OPERATIONS</span><h1>'+h(title)+'</h1><p>'+h(subtitle)+'</p></div><div class="head-actions">'+tools+'</div></div>'}
function renderImports(ctx){
 const admin=rolesFull.includes(ctx.user.role);
 const batches=ctx.imports.batches||[],records=ctx.imports.records||[];
 return headline('Record imports','Bring Petpooja billing and Attendo attendance files into a review queue. Nothing changes the source software.')+
 '<div class="columns-2"><section class="panel"><div class="panel-head"><h3>Import a CSV file</h3><span class="pill blue">Review-first</span></div><p class="panel-sub">Choose the system, upload CSV, preview rows, then stage the import.</p><form id="opsImportForm" class="form-stack"><label>Source software<select id="opsImportSource" name="source"><option value="petpooja">Petpooja — billing export</option><option value="attendo">Attendo — staff attendance</option></select></label><label>CSV export<input id="opsImportFile" type="file" accept=".csv,text/csv" required></label><p class="tiny muted" id="opsImportColumns">Petpooja columns: bill_number, date (YYYY-MM-DD), amount. Up to 40 rows per batch.</p><div id="opsImportPreview" class="import-feedback" aria-live="polite">Choose a file to validate it locally.</div><div class="btn-row"><button class="secondary" type="button" id="opsPreviewCsv">Preview file</button><button class="primary" id="opsCommitCsv" type="submit" disabled>Stage validated records</button></div></form></section>'+
 '<section class="panel"><h3>Import history</h3><p class="panel-sub">Previously uploaded batches with duplicates removed.</p>'+ (batches.length?batches.map(b=>'<div class="metric-row"><span><strong>'+h(b.source)+'</strong><br><small>'+h(new Date(b.createdAt).toLocaleDateString('en-IN'))+' · '+h(b.uploadedBy)+'</small></span><strong>'+b.created+' new</strong></div>').join(''):'<div class="empty">No records imported yet.</div>')+'</section></div>'+
 '<section class="panel"><div class="panel-head"><h3>Records awaiting review</h3><span class="pill gold">Not automatically reconciled</span></div><div class="import-records">'+(records.length?records.map(r=>'<div class="record-row"><div><strong>'+h(r.source==='petpooja'?(r.record.billNumber||'Bill'):(r.record.email||'Employee'))+'</strong><div class="muted small">'+h(r.record.date)+' · '+h(r.source==='petpooja'?'₹'+Number(r.record.amount).toFixed(2):r.record.status)+'</div></div><div class="record-action">'+h(r.status==='pending_review'?'Needs verification':r.status)+ (admin&&r.status==='pending_review'?'<button type="button" class="mini-btn" data-import-review="'+h(r.id)+'" data-decision="approved">Verify</button><button type="button" class="mini-btn" data-import-review="'+h(r.id)+'" data-decision="rejected">Reject</button>':'')+'</div></div>').join(''):'<div class="empty">No records waiting. Upload a source-system export to begin.</div>')+'</div><p class="muted small">Reception can stage files; Owner or Manager verifies source records. An imported bill does not mark it paid, and an imported Attendo row does not overwrite a manual correction.</p></section>';
}
function renderAttendance(ctx){
 const admin=rolesFull.includes(ctx.user.role),owner=ctx.user.role==='owner';
 const staff=ctx.attendance.staff||[],entries=ctx.attendance.entries||[],leaves=ctx.attendance.leave||[];
 const person=admin?attendancePerson||'':ctx.user.email;
 const staffSelect=admin?'<label class="month-filter">Employee<select id="opsAttendancePerson"><option value="">All employees</option>'+staff.map(x=>'<option value="'+h(x.email)+'" '+(attendancePerson===x.email?'selected':'')+'>'+h(x.name)+' — '+h(x.role)+'</option>').join('')+'</select></label>':'';
 const year=Number(attendanceMonth.slice(0,4)),month=Number(attendanceMonth.slice(5,7)),offset=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
 const cells=[];for(let i=0;i<offset;i++)cells.push('<div class="calendar-day blank" aria-hidden="true"></div>');
 for(let day=1;day<=days;day++){
   const stamp=attendanceMonth+'-'+String(day).padStart(2,'0');
   const persons=entries.filter(x=>x.date===stamp&&(person?x.email===person:true));
   const requested=leaves.filter(x=>x.date===stamp&&(person?x.email===person:true));
   const present=persons.filter(x=>x.status==='present').length;
   const absent=persons.filter(x=>x.status==='absent').length;
   cells.push('<div class="calendar-day"><span class="calendar-day-num">'+day+'</span><div class="calendar-tags">'+(present?'<span class="calendar-tag present">'+present+' present</span>':'')+(absent?'<span class="calendar-tag absent">'+absent+' absent</span>':'')+requested.map(l=>'<span class="calendar-tag '+(l.status==='approved'?'leave-approved':'leave-pending')+'">'+h(l.type||'CL')+' · '+h(l.status)+'</span>').join('')+'</div></div>');
 }
 const cards=admin?'<div class="calendar-staff-list">'+staff.map(x=>'<div class="record-row"><strong>'+h(x.name)+'</strong><span class="muted small">'+h(x.role)+'</span></div>').join('')+'</div>':'';
 return headline('Attendance & calendar','Attendo is the source record; owner corrections are recorded separately. Leave is approved within Cassia.',owner?'<button class="primary" data-ops-attendance-mark>＋ Mark present / absent</button>':'')+
 '<section class="panel"><div class="calendar-toolbar"><label class="month-filter">Calendar month<input id="opsAttendanceMonth" type="month" value="'+h(attendanceMonth)+'"></label>'+staffSelect+'<span class="muted small">Present · Absent · Approved leave · Pending leave</span></div><div class="calendar-grid"><div class="week-label">Sun</div><div class="week-label">Mon</div><div class="week-label">Tue</div><div class="week-label">Wed</div><div class="week-label">Thu</div><div class="week-label">Fri</div><div class="week-label">Sat</div>'+cells.join('')+'</div><p class="muted small">If an Attendo export is not imported and verified, a date may be blank. Blank is not the same as absent.</p></section>'+ (admin?'<section class="panel"><h3>Staff directory</h3>'+cards+'</section>':'');
}
function renderPerformance(ctx){
 const admin=ctx.user.role==='owner',list=ctx.performance.leaderboard||[];
 return headline('Team recognition','Recognise helpful work fairly. Scores are guidance—not automatic payroll, discipline or leave decisions.',admin?'<button class="primary" data-ops-reward>＋ Give recognition</button>':'')+
 '<section class="panel"><div class="calendar-toolbar"><label class="month-filter">Month<input id="opsPerformanceMonth" type="month" value="'+h(performanceMonth)+'"></label><span class="pill gold">Owner-managed rewards</span></div><div class="leaderboard">'+(list.length?list.map(x=>'<div class="leader-row"><span class="leader-rank">'+x.rank+'</span><div class="leader-person"><strong>'+h(x.name)+'</strong><div class="muted small">'+h(x.role)+(x.highPerformer?' · Special approval flag':'')+'</div></div><div class="leader-score"><strong>'+Number(x.score||0)+'</strong><small>points</small></div>'+ (admin?'<button class="mini-btn" type="button" data-ops-flag="'+h(x.email)+'" data-is-flagged="'+(x.highPerformer?'1':'0')+'">'+(x.highPerformer?'Remove protected flag':'Protect leave approval')+'</button>':'')+'</div>').join(''):'<div class="empty">There are no recognition entries yet.</div>')+'</div><p class="muted small">Each verified completed task gives one indicative point. Additional recognition points are granted by the owner. Ranking disputes should be reviewed by a human.</p></section>';
}
function foodArtwork(category){
 const asset=category==='Indian Breads'?'bread':category==='Beverages'?'drink':category==='Desserts'?'sweet':category==='South Indian'?'south':category==='Chinese'?'chinese':'curry';
 return '<div class="food-artwork"><img loading="lazy" decoding="async" src="/assets/menu-'+asset+'.svg" alt="Illustrative '+h(category)+' food artwork"></div>';
}
function renderMenu(ctx){
 const owner=ctx.user.role==='owner',isStaff=rolesFull.includes(ctx.user.role)||ctx.user.role==='chef',recipes=new Map((ctx.readiness?.items||[]).map(x=>[x.name,x]));
 const cats=[...new Set(ctx.menu.map(x=>x.category))];
 const demoMessage='<p class="menu-explain">Food illustrations are decorative. Prices marked “Example” are not verified against Petpooja. The owner can confirm each price.</p>';
 const sections=cats.map(cat=>'<section class="menu-category"><h2>'+h(cat)+'</h2><div class="menu-dishes">'+ctx.menu.filter(x=>x.category===cat).map((dish,index)=>{const r=recipes.get(dish.name),rate=dish.priceVerified?'₹'+Number(dish.price).toFixed(0):dish.examplePrice!=null?'Example ₹'+Number(dish.examplePrice).toFixed(0):'Price to confirm';
 return '<article class="dish-entry">'+foodArtwork(cat)+'<div class="dish-details"><div class="dish-name"><strong>'+h(dish.name)+'</strong><span class="menu-price">'+h(rate)+'</span></div><p class="muted small">'+(dish.available?'Available in app':'Currently disabled')+(r?' · '+(r.canPrepare?'Demo ingredients for '+r.capacity+' portions':'Demo recipe needs review'):' · Recipe not entered')+'</p>'+(menuView==='book'?'<label class="dish-check"><input type="checkbox" data-menu-check="'+h(dish.name)+'"> Add to selection</label>':'')+'<div class="btn-row">'+(isStaff?'<button class="mini-btn" data-menu-toggle="'+h(dish.name)+'" data-menu-category="'+h(cat)+'" data-available="'+(dish.available?'false':'true')+'">'+(dish.available?'Mark sold out':'Make available')+'</button>':'')+(owner?'<button class="mini-btn" data-ops-price="'+h(dish.name)+'">Set verified price</button>':'')+'</div></div></article>';
 }).join('')+'</div></section>').join('');
 return headline('Cassia menu book','An elegant dish catalogue with a PDF-style printable view. Confirm the final selling prices in Petpooja.', '<button class="secondary" id="opsPrintMenu">Print / Save PDF</button>')+
 '<div class="menu-toolbar"><button class="secondary '+(menuView==='book'?'selected':'')+'" data-ops-menu-mode="book">Book view</button><button class="secondary '+(menuView==='grid'?'selected':'')+'" data-ops-menu-mode="grid">Operations view</button><span class="muted small">'+ctx.menu.length+' dishes</span></div>'+demoMessage+
 '<div class="menu-book '+(menuView==='grid'?'operations':'')+'"><div class="book-cover"><img src="/assets/dining.webp" loading="lazy" alt="Cassia restaurant interior"><div class="book-cover-copy"><small>RESTAURANT · CAFÉ · CELEBRATIONS</small><h2>CASSIA</h2><p>The menu</p><small>Gorakhpur · An invitation to savour</small></div></div>'+sections+'</div>';
}
function bind(ctx){
 const request=ctx.request,load=ctx.load,toast=ctx.toast,openDialog=ctx.openDialog,closeDialog=ctx.closeDialog,user=ctx.user;
 document.querySelector('#opsImportFile')?.addEventListener('change',()=>{importRows=[];const b=document.querySelector('#opsCommitCsv');if(b)b.disabled=true;const out=document.querySelector('#opsImportPreview');if(out)out.textContent='New file selected. Click Preview file.';});
 document.querySelector('#opsImportSource')?.addEventListener('change',e=>{
  source=e.target.value;importRows=[];document.querySelector('#opsCommitCsv').disabled=true;
  document.querySelector('#opsImportColumns').textContent=source==='petpooja'?'Petpooja columns: bill_number, date (YYYY-MM-DD), amount. Max 40 rows.':'Attendo columns: email, date (YYYY-MM-DD), status (present, absent, leave, half_day, late).';
  document.querySelector('#opsImportPreview').textContent='Choose the correct export file first.';
 });
 async function previewCsv(){
   const input=document.querySelector('#opsImportFile');if(!input?.files?.length)throw Error('Select a CSV file.');
   const file=input.files[0];if(file.size>120000)throw Error('File too large. Split into files under 120 KB and 40 rows.');
   const parsed=csv(await file.text());if(!parsed.length||parsed.length>40)throw Error('Each batch must contain 1–40 CSV data rows.');
   const status=await request('imports.preview',{source,rows:parsed});
   importRows=parsed;
   document.querySelector('#opsImportPreview').textContent=status.valid+' valid; '+status.invalid+' invalid. '+(status.errors?.map(x=>'Row '+x.line+': '+x.error).join('; ')||'');
   document.querySelector('#opsCommitCsv').disabled=Boolean(status.invalid);
   return status;
 }
 document.querySelector('#opsPreviewCsv')?.addEventListener('click',()=>previewCsv().catch(e=>toast(e.message)));
 document.querySelector('#opsImportForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const button=document.querySelector('#opsCommitCsv');button.disabled=true;
  try{if(!importRows.length)await previewCsv();const out=await request('imports.commit',{source,rows:importRows});toast(out.created+' new records staged; '+out.duplicates+' duplicates skipped.');await load()}catch(err){toast(err.message);button.disabled=false}
 });
 document.querySelectorAll('[data-import-review]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await request('imports.verify',{id:button.dataset.importReview,decision:button.dataset.decision});toast('Import reviewed.');await load()}catch(e){toast(e.message);button.disabled=false}}));
 document.querySelector('#opsAttendanceMonth')?.addEventListener('change',e=>{attendanceMonth=e.target.value;load()});
 document.querySelector('#opsAttendancePerson')?.addEventListener('change',e=>{attendancePerson=e.target.value;load()});
 document.querySelector('[data-ops-attendance-mark]')?.addEventListener('click',()=>{
  const workers=ctx.attendance.staff||[];
  openDialog('Mark attendance', '<form id="opsMarkAttendance" class="form-stack"><p class="muted small">An owner correction is logged and never deletes the original Attendo export.</p><label>Employee<select name="email" required>'+workers.map(x=>'<option value="'+h(x.email)+'">'+h(x.name)+'</option>').join('')+'</select></label><label>Day<input name="date" type="date" required value="'+new Date().toLocaleDateString('en-CA')+'"></label><label>Status<select name="status"><option value="present">Present</option><option value="absent">Absent</option><option value="half_day">Half day</option><option value="leave">On leave</option></select></label><label>Reason for entry<textarea name="reason" required minlength="4" placeholder="Checked roster / verified shift"></textarea></label><button class="primary">Save signed correction</button></form>');
  document.querySelector('#opsMarkAttendance').onsubmit=async e=>{e.preventDefault();try{const d=Object.fromEntries(new FormData(e.target));await request('attendance.mark',d);closeDialog();toast('Attendance correction recorded.');await load()}catch(err){toast(err.message)}};
 });
 document.querySelector('#opsPerformanceMonth')?.addEventListener('change',e=>{performanceMonth=e.target.value;load()});
 document.querySelector('[data-ops-reward]')?.addEventListener('click',()=>{
  const staff=ctx.performance.leaderboard||[];
  openDialog('Recognise a team member','<form id="opsRewardForm" class="form-stack"><label>Employee<select name="email" required>'+staff.map(x=>'<option value="'+h(x.email)+'">'+h(x.name)+'</option>').join('')+'</select></label><label>Recognition month<input name="month" type="month" required value="'+h(performanceMonth)+'"></label><label>Reason<input name="title" maxlength="100" required minlength="4" placeholder="Helped during an exceptionally busy service"></label><label>Recognition points<input name="points" type="number" min="1" max="20" value="5" required></label><button class="primary">Award recognition</button></form>');
  document.querySelector('#opsRewardForm').onsubmit=async e=>{e.preventDefault();try{await request('performance.reward',Object.fromEntries(new FormData(e.target)));closeDialog();toast('Staff member recognised.');await load()}catch(err){toast(err.message)}};
 });
 document.querySelectorAll('[data-ops-flag]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Change the special approval flag for this employee? This requires owner review of leave.'))return;b.disabled=true;try{await request('performance.flag',{email:b.dataset.opsFlag,highPerformer:b.dataset.isFlagged!=='1'});toast('Approval flag updated.');await load()}catch(err){toast(err.message);b.disabled=false}}));
 document.querySelectorAll('[data-ops-menu-mode]').forEach(b=>b.onclick=()=>{menuView=b.dataset.opsMenuMode;load()});
 document.querySelector('#opsPrintMenu')?.addEventListener('click',()=>window.print());
 document.querySelectorAll('[data-ops-price]').forEach(b=>b.addEventListener('click',()=>{
   const item=ctx.menu.find(x=>x.name===b.dataset.opsPrice);if(!item)return;
   openDialog('Confirm selling price','<form id="opsPriceForm" class="form-stack"><p>'+h(item.name)+'</p><label>Actual price in Petpooja (₹)<input name="price" type="number" min="0" max="50000" step="0.01" required value="'+h(item.price??'')+'"></label><div class="warning">Confirm against the current Petpooja menu. This does not change Petpooja itself.</div><button class="primary">Confirm price</button></form>');
   document.querySelector('#opsPriceForm').onsubmit=async e=>{e.preventDefault();try{await request('menu.price',{name:item.name,price:Number(e.target.elements.price.value)});closeDialog();toast('Verified price saved.');await load()}catch(err){toast(err.message)}};
 }));
}
window.CassiaExtra={renderImports,renderAttendance,renderPerformance,renderMenu,bind,get attendanceMonth(){return attendanceMonth},get attendancePerson(){return attendancePerson},get performanceMonth(){return performanceMonth}};
})();