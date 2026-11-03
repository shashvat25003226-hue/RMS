(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const dineSlots=['11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];
const banquetSlots=['10:00–14:00','14:00–18:00','18:00–23:00'];
let type='dine',customer=null,bookings=[],authTab='login',otpChallenge='',lastBooking=null,noticeTimer=0;
async function api(action,data={}){
 let response;try{response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...data})})}catch{throw Error('Cannot connect to Cassia. Check internet connection and try again.')}
 const json=await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
 if(!response.ok)throw Error(json.error||'We could not complete your request. Try again.');
 return json;
}
const flash=msg=>{const node=$('#toast');node.textContent=msg;node.className='site-toast';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{node.textContent='';node.className=''},5200)};
const busy=(button,val=true)=>{if(button)button.disabled=val};
function showModal(id){const node=$('#'+id);if(!node.open)node.showModal()}
function closeModal(){for(const d of $$('dialog[open]'))d.close()}
$$('[data-close]').forEach(b=>b.onclick=closeModal);
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
$('#navToggle').onclick=()=>{const next=$('#nav').classList.toggle('open');$('#navToggle').setAttribute('aria-expanded',String(next))};
$$('#nav a').forEach(a=>a.addEventListener('click',()=>{$('#nav').classList.remove('open');$('#navToggle').setAttribute('aria-expanded','false')}));
function setType(next){
 type=next;$$('[data-kind]').forEach(b=>b.classList.toggle('selected',b.dataset.kind===next));
 $('#bookingLabel').textContent=next==='dine'?'RESERVE A TABLE · FREE':'PLAN A CELEBRATION';
 $('#bookingTitle').textContent=next==='dine'?'A table for you.':'Your celebration begins.';
 $('#dineFields').hidden=next!=='dine';$('#banquetFields').hidden=next!=='banquet';
 $('#bookingForm').hidden=false;$('#bookingSuccess').hidden=true;
 updateSlots();
}
async function updateSlots(){
 const select=$('#slotSelect'),selected=$('#bookingForm [name=date]').value||today();
 if(type==='dine'){select.innerHTML=dineSlots.map(v=>'<option value="'+v+'">'+v+'</option>').join('');select.disabled=false;return}
 select.innerHTML='<option value="">Checking availability…</option>';select.disabled=true;
 try{
  const result=await api('public.slots',{date:selected});
  select.innerHTML=result.slots.map(s=>'<option value="'+esc(s.slot)+'" '+(s.available?'':'disabled')+'>'+esc(s.slot)+(s.available?' · Available':' · Reserved')+'</option>').join('');
  const available=result.slots.find(s=>s.available);if(available)select.value=available.slot;
  else select.innerHTML='<option value="">No slots available on this date</option>';
  select.disabled=!available;
 }catch(err){select.innerHTML='<option value="">Could not check slots — retry date</option>';select.disabled=true;flash(err.message)}
}
function openBooking(kind){
 showModal('bookingDialog');if(kind==='banquet'||kind==='dine')setType(kind);
 const form=$('#bookingForm');form.elements.date.min=today();if(!form.elements.date.value||form.elements.date.value<today())form.elements.date.value=today();
 if(customer){form.elements.name.value=customer.name||'';form.elements.phone.value=customer.phone||''}
 setType(kind||type);
}
$$('[data-book]').forEach(b=>b.onclick=()=>openBooking(b.dataset.book));
$$('[data-kind]').forEach(b=>b.onclick=()=>setType(b.dataset.kind));
$('#bookingForm [name=date]').addEventListener('change',updateSlots);
$('#bookingForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');busy(button);
 const fields=new FormData(form);
 const data={type,name:fields.get('name')?.trim(),phone:fields.get('phone')?.trim(),date:fields.get('date'),slot:fields.get('slot'),guests:Number(fields.get('guests')||2),reason:fields.get('reason'),otherReason:fields.get('otherReason'),notes:fields.get('notes'),decoration:fields.has('decoration')&&type==='banquet',consent:fields.has('consent')};
 try{
  const response=await api('public.book',data);
  lastBooking={...response,type};
  $('#bookingForm').hidden=true;$('#bookingSuccess').hidden=false;
  $('#bookingResult').textContent=(type==='dine'?'Free dine-in table request':'Banquet hall enquiry')+' for '+data.date+' at '+data.slot+' has been received. '+(data.decoration?'Optional decoration fee: ₹1,000. ':'')+'This is pending staff confirmation.';
  $('#bookingWa').href=response.whatsappUrl;
  flash('Booking request sent to reception.');
  if(customer)loadBookings().catch(()=>{});
 }catch(err){flash(err.message);if(type==='banquet'&&/slot/i.test(err.message))updateSlots()}
 finally{busy(button,false)}
});
$('#copyBookingRef').onclick=async()=>{
 if(!lastBooking)return;
 const link=new URL(location.href);link.searchParams.set('booking',lastBooking.type+'.'+lastBooking.trackingToken);link.hash='';
 try{await navigator.clipboard.writeText(link.href);flash('Booking tracking link copied')}catch{flash('Could not copy automatically. Use WhatsApp to contact Cassia.')}
};
function accountModal(){showModal('accountDialog');renderAccount()}
$('#openAccount').onclick=accountModal;
async function loadAccount(){try{const d=await api('public.me');customer=d.customer;updateAccountButton()}catch{customer=null}}
function updateAccountButton(){const b=$('#openAccount span');b.textContent=customer?'My bookings':'My account'}
async function loadBookings(){if(!customer)return;const r=await api('public.my_bookings');bookings=r.bookings||[];if($('#accountDialog').open)renderAccount()}
function secretField(name,autocomplete,required=true){
 const label=name==='newPassword'?'new password':name==='currentPassword'?'current password':'password';
 return '<span class="password-field"><input name="'+name+'" type="password" autocomplete="'+autocomplete+'" '+(required?'required':'')+' aria-label="'+label+'"><button class="password-toggle" type="button" data-password-toggle aria-label="Show '+label+'" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>Show</span></button></span>';
}
function wirePasswordToggles(root){
 root.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
  const input=button.parentElement.querySelector('input'),revealing=input.type==='password';
  input.type=revealing?'text':'password';
  button.querySelector('span').textContent=revealing?'Hide':'Show';
  button.setAttribute('aria-pressed',String(revealing));
  button.setAttribute('aria-label',(revealing?'Hide ':'Show ')+(input.getAttribute('aria-label')||'password'));
  input.focus({preventScroll:true});
 }));
}
function loginMarkup(){
 const form=authTab==='register'?
 '<form class="account-form" id="registerForm"><label>Full name<input name="name" required minlength="2" maxlength="90" autocomplete="name"></label><label>Email address<input name="email" type="email" required autocomplete="email"></label><label>Mobile number<input name="phone" type="tel" maxlength="10" inputmode="numeric" pattern="[6-9][0-9]{9}" autocomplete="tel" required></label><label>Create a 6-digit PIN or strong password'+secretField('password','new-password')+'</label><label class="consent"><input type="checkbox" name="consent" required><span>I agree to store my profile and receive booking-related communications. I can delete my account later.</span></label><button class="submit-book" type="submit">Create account <span>→</span></button></form>':
 authTab==='telegram'?
 '<form class="account-form" id="telegramLoginForm"><p>A Telegram account must already be connected to your Cassia profile.</p><label>Account email<input type="email" name="email" required autocomplete="email"></label><button class="submit-book" type="submit">Send code via Telegram →</button></form>':
 authTab==='otp'?
 '<form class="account-form" id="otpLoginForm"><p>Enter the six-digit code sent to your linked Telegram bot. Valid for 10 minutes.</p><label>Telegram code<input type="text" name="code" pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required></label><button class="submit-book" type="submit">Verify and sign in →</button></form>':
 '<form class="account-form" id="customerLoginForm"><label>Email address<input name="email" type="email" autocomplete="username" required placeholder="you@example.com"></label><label>Password or 6-digit PIN'+secretField('password','current-password')+'</label><button class="submit-book" type="submit">Sign in securely <span>→</span></button></form>';
 return '<div class="account-tabs"><button data-auth="login" class="'+(authTab==='login'?'active':'')+'" type="button">Sign in</button><button data-auth="register" class="'+(authTab==='register'?'active':'')+'" type="button">Create account</button></div>'+form+
 '<div class="account-links"><button data-auth="telegram" type="button">Login with Telegram OTP</button><span>Or <button type="button" id="bookGuest">book as a guest</button></span></div><p class="account-notice">Customer accounts are separate from Cassia staff logins. <a href="/staff">Restaurant staff? Open Control Room ↗</a></p>';
}
function bookingCard(b){
 const state=esc(b.status),type=b.type==='dine'?'Dine-in table':'Banquet hall';
 return '<li class="account-booking '+state+'"><span class="status">'+state+'</span><strong>'+type+' · '+esc(b.date)+' · '+esc(b.slot)+'</strong><small>'+ (b.type==='dine'?'Free booking · '+Number(b.guests||2)+' guests':'Decoration '+(b.decoration?'₹1,000 optional':'not requested'))+'</small>'+(b.status==='pending'?'<button type="button" data-cancel="'+esc(b.id)+'" data-type="'+esc(b.type)+'">Cancel request</button>':'')+'</li>';
}
function dashboardMarkup(){
 return '<div class="account-box"><h3 style="font:400 26px var(--serif);margin:0">Hello, '+esc(customer.name)+'.</h3><p>Manage your visits, reservations and account details here. Cassia staff confirm pending bookings.</p><div class="account-actions"><button type="button" id="accountRefresh">↻ Refresh bookings</button><button type="button" id="accountProfile">Edit profile</button><button type="button" id="accountTelegram">'+(customer.telegramLinked?'Telegram connected ✓':'Connect Telegram')+'</button><button type="button" id="accountLogout">Sign out</button></div><h3 style="font:400 23px var(--serif);margin:20px 0 5px">Your reservations</h3><ul class="account-bookings">'+(bookings.length?bookings.map(bookingCard).join(''):'<li class="account-booking">No reservations yet. Try booking a table or a celebration.</li>')+'</ul><button class="btn-gold" type="button" id="accountBook">Make another reservation ↗</button><p style="margin-top:20px"><button class="link-danger" id="accountDelete" type="button">Delete my account</button></p></div>';
}
function profileMarkup(){
 return '<div class="account-box"><h3 style="font:400 25px var(--serif)">Your details</h3></div><form class="account-form" id="profileForm"><label>Name<input name="name" required minlength="2" value="'+esc(customer.name)+'"></label><label>Phone<input name="phone" type="tel" maxlength="10" pattern="[6-9][0-9]{9}" value="'+esc(customer.phone)+'" required></label><p class="tiny-note">Email: '+esc(customer.email)+' (cannot change here)</p><label>New PIN (6 digits) or strong password (optional)'+secretField('newPassword','new-password',false)+'</label><label>Current password or PIN (needed to change it)'+secretField('currentPassword','current-password',false)+'</label><button class="submit-book" type="submit">Save changes →</button><button type="button" class="btn-cream" id="profileBack">Back to bookings</button></form>';
}
function deleteMarkup(){
 return '<div class="account-box"><h3 style="font:400 25px var(--serif)">Delete your account?</h3><p>This action is permanent. Pending reservations are cancelled. Confirmed booking details remain with Cassia as needed to fulfil them.</p></div><form id="deleteForm" class="account-form"><label>Confirm your password or PIN'+secretField('password','current-password')+'</label><button class="submit-book" type="submit">Permanently delete account →</button><button type="button" class="btn-cream" id="deleteBack">Keep my account</button></form>';
}
let accountPage='dashboard';
function renderAccount(){
 $('#accountTitle').textContent=customer?'Your Cassia account.':'Good to see you.';
 const root=$('#accountContent');
 if(!customer){root.innerHTML=loginMarkup();wirePasswordToggles(root);$('[data-auth]',root).forEach(b=>b.onclick=()=>{authTab=b.dataset.auth;renderAccount()});$('#bookGuest')?.addEventListener('click',()=>{closeModal();openBooking('dine')});
  $('#customerLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');busy(btn);try{const d=Object.fromEntries(new FormData(e.target));customer=(await api('public.login',d)).customer;updateAccountButton();accountPage='dashboard';await loadBookings();renderAccount();flash('Welcome back!')}catch(err){flash(err.message)}finally{busy(btn,false)}});
  $('#registerForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');busy(btn);try{const d=Object.fromEntries(new FormData(e.target));d.consent=new FormData(e.target).has('consent');customer=(await api('public.register',d)).customer;updateAccountButton();accountPage='dashboard';bookings=[];renderAccount();flash('Your account is ready.')}catch(err){flash(err.message)}finally{busy(btn,false)}});
  $('#telegramLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button');busy(btn);try{otpChallenge=(await api('public.telegram_otp_start',Object.fromEntries(new FormData(e.target)))).challenge;authTab='otp';renderAccount();flash('Check your Telegram for the sign-in code.')}catch(err){flash(err.message)}finally{busy(btn,false)}});
  $('#otpLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button');busy(btn);try{customer=(await api('public.telegram_otp_verify',{challenge:otpChallenge,code:e.target.elements.code.value})).customer;otpChallenge='';updateAccountButton();await loadBookings();renderAccount()}catch(err){flash(err.message)}finally{busy(btn,false)}});
  return;
 }
 if(accountPage==='profile'){
  root.innerHTML=profileMarkup();wirePasswordToggles(root);
  $('#profileBack').onclick=()=>{accountPage='dashboard';renderAccount()};
  $('#profileForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('[type=submit]');busy(btn);try{const d=Object.fromEntries(new FormData(e.target));if(!d.newPassword)delete d.newPassword;customer=(await api('public.profile',d)).customer;accountPage='dashboard';updateAccountButton();renderAccount();flash('Profile updated.')}catch(err){flash(err.message)}finally{busy(btn,false)}};
  return;
 }
 if(accountPage==='delete'){
  root.innerHTML=deleteMarkup();wirePasswordToggles(root);
  $('#deleteBack').onclick=()=>{accountPage='dashboard';renderAccount()};
  $('#deleteForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('[type=submit]');busy(btn);try{const r=await api('public.delete',{password:e.target.elements.password.value});customer=null;bookings=[];authTab='login';accountPage='dashboard';updateAccountButton();renderAccount();flash(r.message)}catch(err){flash(err.message)}finally{busy(btn,false)}};
  return;
 }
 root.innerHTML=dashboardMarkup();
 $('#accountRefresh').onclick=()=>loadBookings().catch(e=>flash(e.message));
 $('#accountProfile').onclick=()=>{accountPage='profile';renderAccount()};
 $('#accountDelete').onclick=()=>{accountPage='delete';renderAccount()};
 $('#accountLogout').onclick=async()=>{try{await api('public.logout');customer=null;bookings=[];authTab='login';updateAccountButton();renderAccount();flash('Signed out.')}catch(e){flash(e.message)}};
 $('#accountBook').onclick=()=>{closeModal();openBooking('dine')};
 $('#accountTelegram').onclick=async()=>{try{const r=await api('public.telegram_link');const link=document.createElement('a');link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open Telegram and press Start ↗';link.className='btn-gold';const box=document.createElement('div');box.className='account-notice';box.append('Link expires in 10 minutes. ',link);root.prepend(box);flash('Follow the link to connect Telegram.')}catch(e){flash(e.message)}};
 $$('[data-cancel]',root).forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this pending booking request?'))return;busy(b);try{await api('public.cancel',{id:b.dataset.cancel,type:b.dataset.type});await loadBookings();flash('Booking request cancelled')}catch(e){flash(e.message);busy(b,false)}});
}
async function checkBookingLink(){
 const reference=new URL(location.href).searchParams.get('booking');if(!reference)return;
 const parts=reference.split('.');if(parts.length!==2||!['dine','banquet'].includes(parts[0]))return;
 try{const data=await api('public.track',{type:parts[0],token:parts[1]});const b=data.booking;flash('Cassia booking '+b.date+' '+b.slot+': '+b.status+(b.status==='pending'?' (awaiting confirmation)':''));}catch{flash('The tracking link was not recognised.')}
}
const galleryButton=$('#toggleGallery');
if(galleryButton)galleryButton.addEventListener('click',()=>{const grid=$('#gallery .gallery-grid');const expanded=grid.classList.toggle('expanded');galleryButton.setAttribute('aria-expanded',String(expanded));galleryButton.textContent=expanded?'Show fewer photos ↑':'See all 10 photos ↓';if(!expanded)$('#gallery').scrollIntoView({block:'start',behavior:'smooth'});});
$('#year').textContent=new Date().getFullYear();
$('#bookingForm [name=date]').min=today();$('#bookingForm [name=date]').value=today();
Promise.resolve().then(async()=>{await loadAccount();checkBookingLink()});
const observe=('IntersectionObserver'in window)?new IntersectionObserver(entries=>{entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('revealed');observe.unobserve(x.target)}})},{rootMargin:'0px 0px -30px 0px',threshold:.09}):null;
if(observe)$$('.intro-copy,.show-copy,.banquet-text,.section-heading,.vibe-heading,.faq-heading,.booking-promo>div,.visit-section>div:first-child').forEach(x=>{x.classList.add('will-reveal');observe.observe(x)});
})();