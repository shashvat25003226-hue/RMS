(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phone=x=>String(x||'').replace(/\D/g,'').slice(-10);
const href=b=>'https://wa.me/91'+phone(b.phone)+'?text='+encodeURIComponent('Hello '+b.name+', this is Cassia Restaurant regarding your '+(b.type==='dine'?'dine-in table':'banquet hall')+' request on '+b.date+' at '+b.slot+'. Your current booking status is '+b.status+'.');
let filter='pending';
function render({bookings=[],user}){
 const active=bookings.filter(b=>filter==='all'||b.status===filter),p=bookings.filter(b=>b.status==='pending').length,c=bookings.filter(b=>b.status==='confirmed').length;
 const rows=active.map(b=>
  '<article class="res-card"><div class="res-card-top"><div><span class="res-label">'+(b.type==='dine'?'DINING · FREE':'BANQUET · EVENT')+'</span><h3>'+esc(b.name)+'</h3><p>'+esc(b.date)+' · '+esc(b.slot)+'</p></div><span class="pill '+(b.status==='confirmed'?'green':b.status==='pending'?'gold':'red')+'">'+esc(b.status)+'</span></div>'+
  '<div class="res-details"><span>☎ '+esc(b.phone)+'</span>'+(b.type==='dine'?'<span>♧ '+Number(b.guests||2)+' guests</span>':'<span>✧ '+esc(b.reason||'celebration')+'</span>')+(b.decoration?'<span>✦ Decoration +₹1,000</span>':'')+'</div>'+
  (b.notes?'<p class="res-notes">'+esc(b.notes)+'</p>':'')+
  '<div class="res-actions">'+(b.status==='pending'?'<button class="res-confirm" type="button" data-res-state="confirmed" data-res-id="'+esc(b.id)+'" data-res-type="'+esc(b.type)+'">✓ Confirm booking</button><button class="res-cancel" type="button" data-res-state="cancelled" data-res-id="'+esc(b.id)+'" data-res-type="'+esc(b.type)+'">Decline</button>':'')+'<a class="res-whatsapp" href="'+href(b)+'" target="_blank" rel="noopener noreferrer">WhatsApp guest ↗</a>'+(b.status==='confirmed'?'<button class="res-remind" type="button" data-res-remind="'+esc(b.id)+'" data-res-type="'+esc(b.type)+'">Telegram reminder ↗</button>':'')+'</div></article>'
 ).join('');
 return '<section class="page-head"><div><span class="eyebrow ink">CASSIA / GUEST RESERVATIONS</span><h1>Reservations</h1><p>One calm place for dining and banquet enquiries. Contact guests before confirming.</p></div><div class="head-actions"><button class="secondary" type="button" data-res-refresh>↻ Refresh</button></div></section>'+
 '<div class="res-summary"><div><small>AWAITING RESPONSE</small><strong>'+p+'</strong></div><div><small>CONFIRMED</small><strong>'+c+'</strong></div><div><small>UPCOMING REQUESTS</small><strong>'+bookings.length+'</strong></div></div>'+
 '<div class="res-filters" role="group" aria-label="Reservation status"><button type="button" data-res-filter="pending" class="'+(filter==='pending'?'active':'')+'">To review</button><button type="button" data-res-filter="confirmed" class="'+(filter==='confirmed'?'active':'')+'">Confirmed</button><button type="button" data-res-filter="all" class="'+(filter==='all'?'active':'')+'">All bookings</button></div>'+
 '<div class="res-grid">'+(rows||'<section class="res-empty"><span>✓</span><h3>Nothing awaiting your attention</h3><p>New booking requests will arrive here automatically.</p></section>')+'</div>'+
 '<div class="res-caption">Dine-in reservation requests are free. Banquet decoration costs ₹1,000 only when selected. All reservations start pending and require staff confirmation. Official POS billing remains in Petpooja.</div>';
}
function bind({request,load,toast}){
 document.querySelector('[data-res-refresh]')?.addEventListener('click',()=>load());
 document.querySelectorAll('[data-res-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.resFilter;load()});
 document.querySelectorAll('[data-res-state]').forEach(b=>b.onclick=async()=>{
  if(b.dataset.resState==='cancelled'&&!confirm('Decline this booking? The guest may need to be informed.'))return;
  b.disabled=true;try{await request('reservations.update',{type:b.dataset.resType,id:b.dataset.resId,status:b.dataset.resState});toast('Reservation '+b.dataset.resState+'. Contact the guest on WhatsApp if needed.');load()}catch(e){toast(e.message);b.disabled=false}
 });
 document.querySelectorAll('[data-res-remind]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request('reservations.remind',{type:b.dataset.resType,id:b.dataset.resRemind});toast('Telegram reminder delivered.')}catch(e){toast(e.message);b.disabled=false}});
}
window.CassiaReservationsUI={render,bind};
})();