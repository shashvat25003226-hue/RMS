(()=>{'use strict';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
function renderBanquet(ctx){
 const items=ctx.bookings||[];
 let rows=items.map(x=>'<article class="banquet-event"><div class="banquet-date"><strong>'+h(x.date.slice(8))+'</strong><small>'+h(x.date.slice(0,7))+'</small></div><div class="banquet-event-copy"><strong>'+h(x.name)+'</strong><span>'+h(x.slot)+' · '+h(x.reason==='other'?x.otherReason:x.reason)+'</span><small>'+h(x.phone)+(x.decoration?' · Decoration +₹1,000':' · No decoration')+'</small><small>'+h(x.note)+'</small></div><div class="banquet-event-actions"><span class="pill '+(x.status==='confirmed'?'green':x.status==='pending'?'gold':'red')+'">'+h(x.status)+'</span>'+(x.status==='pending'?'<button class="mini-btn" data-banquet-update="'+h(x.id)+'" data-state="confirmed">Confirm</button>':'')+(x.status!=='cancelled'?'<button class="mini-btn" data-banquet-update="'+h(x.id)+'" data-state="cancelled">Cancel</button>':'')+'</div></article>').join('');
 return '<section class="page-head"><div><span class="eyebrow ink">CASSIA / CELEBRATIONS</span><h1>Banquet reservations</h1><p>Every event, time slot and guest follow-up in one place.</p></div><div class="head-actions"><button class="primary" data-banquet-new>＋ New booking</button></div></section>'+
 '<div class="stat-grid"><div class="stat-card"><div class="num">'+items.filter(x=>x.status==='confirmed').length+'</div><small>CONFIRMED</small></div><div class="stat-card"><div class="num">'+items.filter(x=>x.status==='pending').length+'</div><small>AWAITING CONFIRMATION</small></div></div>'+
 '<section class="panel"><div class="panel-head"><h3>Event diary</h3><span class="pill gold">Slot-based reservations</span></div><p class="muted small">Confirm venue capacity and final food package with the guest before confirming an event.</p><div class="banquet-bookings">'+(rows||'<div class="empty">No upcoming celebrations yet.</div>')+'</div></section>'+
 '<section class="panel"><strong>How handover works</strong><p>Reception records the enquiry and contacts the guest. The owner can oversee bookings. The kitchen receives details during event planning—not as an automatic food order.</p></section>';
}
function slotMarkup(slots){if(!slots.length)return '<p>No slots returned; try another date.</p>';
let first=true;return slots.map(x=>{const checked=x.available&&first;if(checked)first=false;return '<label class="slot-chip '+(x.available?'':'disabled')+'"><input type="radio" name="slot" value="'+h(x.slot)+'" '+(x.available?'':'disabled')+' '+(checked?'checked':'')+'><span>'+h(x.slot)+'</span><small>'+(x.available?'Available':x.state==='pending'?'On hold':'Booked')+'</small></label>'}).join('')}
function showForm(ctx){
 const {request,load,toast,openDialog,closeDialog}=ctx;
 openDialog('Reserve banquet hall','<form id="banquetBookingForm" class="form-stack">'+
 '<p class="muted small">A booking begins on hold. Call the guest and confirm the event before marking it confirmed.</p>'+
 '<div class="form-grid"><label>Guest name<input name="name" required maxlength="100" placeholder="Full name"></label><label>Mobile number<input name="phone" type="tel" inputmode="numeric" pattern="[6-9][0-9]{9}" required placeholder="10-digit number"></label></div>'+
 '<label>Event date<input name="date" type="date" required min="'+today()+'" value="'+today()+'"></label>'+
 '<fieldset class="banquet-slot-field"><legend>Available time slots</legend><div id="banquetSlotChoices" class="banquet-slot-grid"><p>Checking availability…</p></div></fieldset>'+
 '<label>Occasion<select name="reason"><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="party">Party</option><option value="corporate">Corporate gathering</option><option value="other">Other</option></select></label>'+
 '<label id="otherEventLabel" hidden>Describe the occasion<input name="otherReason" maxlength="150"></label>'+
 '<label class="decoration-choice"><input type="checkbox" name="decoration"><span><strong>Add event decoration</strong><small>Optional · ₹1,000</small></span></label>'+
 '<label>Notes<textarea name="note" rows="2" maxlength="400" placeholder="Guest requirements, number of people, cake arrangement…"></textarea></label>'+
 '<label class="consent-line"><input name="agreedToContact" type="checkbox" required><span>Guest agreed to be contacted for booking confirmation.</span></label>'+
 '<div class="booking-total"><span>Decoration add-on</span><strong id="bookingDecorationFee">₹0</strong></div>'+
 '<button class="primary" type="submit">Hold available slot</button><p class="muted small">The final banquet package, taxes and service terms are quoted separately by staff.</p></form>');
 const form=document.getElementById('banquetBookingForm');if(!form)return;
 const slots=document.getElementById('banquetSlotChoices');
 async function refresh(){let day=form.elements.date.value;slots.textContent='Checking availability…';try{const r=await request('banquet.slots',{date:day});if(form.elements.date.value===day)slots.innerHTML=slotMarkup(r.slots||[])}catch(e){slots.textContent=e.message}}
 form.elements.date.onchange=refresh;
 form.elements.reason.onchange=()=>{const other=form.elements.reason.value==='other';form.querySelector('#otherEventLabel').hidden=!other;form.elements.otherReason.required=other};
 form.elements.decoration.onchange=()=>form.querySelector('#bookingDecorationFee').textContent=form.elements.decoration.checked?'₹1,000':'₹0';
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button[type=submit]');b.disabled=true;try{const payload=Object.fromEntries(new FormData(form));if(!payload.slot)throw Error('Select an available time slot.');payload.decoration=form.elements.decoration.checked;payload.agreedToContact=form.elements.agreedToContact.checked;await request('banquet.create',payload);closeDialog();toast('Slot held; confirm details with guest before marking confirmed.');await load()}catch(error){toast(error.message);b.disabled=false;await refresh()}};
 refresh();
}
function bind(ctx){
 document.querySelector('[data-banquet-new]')?.addEventListener('click',()=>showForm(ctx));
 document.querySelectorAll('[data-banquet-update]').forEach(b=>b.onclick=async()=>{const state=b.dataset.state;if(!confirm(state==='confirmed'?'Has reception contacted the guest and verified the details?':'Cancel this event and free the time slot?'))return;b.disabled=true;try{await ctx.request('banquet.update',{id:b.dataset.banquetUpdate,status:state});ctx.toast('Reservation '+state+'.');await ctx.load()}catch(err){ctx.toast(err.message);b.disabled=false}});
}
function revealGuest(data,form,menu,toast){
 let node=form.querySelector('#guestRecognised');if(!node){node=document.createElement('section');node.id='guestRecognised';node.className='guest-recognition';form.querySelector('[name=customerPhone]').closest('label').after(node)}
 if(!data.customer){node.innerHTML='<p class="muted small">New or unrecorded guest. Enter their name to continue.</p>';return}
 const c=data.customer;form.elements.customerName.value=c.name;
 const couponHtml=(data.coupons||[]).map(x=>'<div><strong>'+h(x.code)+'</strong> · '+h(x.description)+' <small>Ends '+h(String(x.expiresAt).slice(0,10))+'</small></div>').join('');
 const favorites=(data.repeatOrders||[]).filter(x=>menu.some(m=>m.available&&m.name===x.name)).slice(0,4);
 node.innerHTML='<div class="guest-recognition-title"><strong>Welcome back, '+h(c.name)+'</strong><span>'+h(c.tier==='vip'?'★ VIP guest':'Returning guest')+'</span></div><p class="muted small">'+Number(data.totalOrders||0)+' recorded Cassia orders</p>'+
 '<p class="muted small">Valid offers · verify at reception before applying</p><div class="guest-coupon-list">'+(couponHtml||'No active coupons')+'</div>'+
 '<p class="muted small">Often ordered · Suggest to guest</p><div class="guest-favourites">'+(favorites.map(x=>'<button class="mini-btn" type="button" data-favourite="'+h(x.name)+'">'+h(x.name)+' · '+Number(x.quantity||0)+' ordered</button>').join('')||'No previous orders in Cassia yet')+'</div>'+
 '<p class="muted tiny">Preferences are based on recorded Cassia orders only, not Petpooja history. Confirm with customer.</p>';
 node.querySelectorAll('[data-favourite]').forEach(btn=>btn.onclick=()=>{const section=form.querySelector('#orderLines');let row=[...section.children].find(x=>x.querySelector('[name=item]')?.value===btn.dataset.favourite);if(row){const qty=row.querySelector('[name=qty]');qty.value=Math.min(50,Number(qty.value||1)+1)}else{row=section.firstElementChild.cloneNode(true);row.querySelector('[name=item]').value=btn.dataset.favourite;if(row.querySelector('[name=item]').value!==btn.dataset.favourite){toast('Dish is unavailable.');return}row.querySelector('[name=qty]').value=1;section.append(row)}toast('Dish added. Confirm with guest before sending.')});
}
window.CassiaHospitalityUI={renderBanquet,bind,revealGuest};
})();