import crypto from 'node:crypto';
import {ObjectId} from 'mongodb';
import {hex,sha,safeText,validEmail,passwordHash,passwordVerify,validShiftDate,indiaDay,otpDigest,secureEqual} from './core.js';
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e};
const emailOf=v=>{const x=safeText(v,240).toLowerCase();if(!validEmail(x))fail('Valid email required');return x};
const phoneOf=v=>{let p=String(v||'').replace(/\D/g,'');if(p.length===12&&p.startsWith('91'))p=p.slice(2);if(!/^[6-9]\d{9}$/.test(p))fail('Enter a valid 10-digit mobile number');return p};
const dateOf=v=>{const d=safeText(v,10);if(!validShiftDate(d)||d<indiaDay())fail('Choose a valid future date');return d};
const nameOf=v=>{const n=safeText(v,90);if(n.length<2)fail('Enter your name');return n};
const types=['dine','banquet'],banquetSlots=['10:00–14:00','14:00–18:00','18:00–23:00'],dineSlots=['11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];
const wa=()=>String(process.env.PUBLIC_WHATSAPP_NUMBER||'8881113210').replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');
const coll=t=>t==='dine'?'dine_bookings':'banquet_bookings';
const allowedStaff=u=>!!u&&['owner','manager','reception'].includes(u.role);
const sessionCookie=(req)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cassia_customer_sid='))?.slice(20)||'';
const setCookie=(res,token)=>res.setHeader('Set-Cookie','cassia_customer_sid='+(token||'')+'; HttpOnly; Path=/; SameSite=Lax; Max-Age='+(token?2592000:0)+(process.env.SESSION_COOKIE_SECURE==='false'?'':'; Secure'));
const profile=c=>c?{id:String(c._id),name:c.name,email:c.email,phone:c.phone,telegramLinked:!!c.telegramChatId}:null;
const booking=b=>({id:String(b._id),type:b.type||'banquet',name:b.name,phone:b.phone,date:b.date,slot:b.slot,status:b.status,guests:b.guests||null,reason:b.reason||'',decoration:!!b.decoration,decorationFee:b.decoration?1000:0,notes:b.notes||b.note||'',createdAt:b.createdAt,source:b.source||'staff'});
async function account(db,req){const token=sessionCookie(req);if(!/^[a-f0-9]{64}$/.test(token))return null;const s=await db.collection('customer_sessions').findOne({hash:sha(token),expires:{$gt:new Date()}});return s?db.collection('customer_accounts').findOne({_id:s.customerId,active:true}):null}
async function loginCustomer(db,res,c){const token=hex();await db.collection('customer_sessions').insertOne({customerId:c._id,hash:sha(token),expires:new Date(Date.now()+2592000000)});setCookie(res,token);return profile(c)}
export async function telegramMessage(chatId,msg){
 if(!chatId||!process.env.TELEGRAM_BOT_TOKEN)return false;
 try{const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:String(msg).slice(0,3500)}),signal:AbortSignal.timeout(7000)});return r.ok}catch{console.error('Telegram notification delivery failed');return false}
}
export async function customerPortal(action,{db,req,res,body,staff,rateLimit,publish,audit}){
 if(!action.startsWith('public.')&&!action.startsWith('reservations.')&&action!=='telegram.update')return null;
 const C=n=>db.collection(n),send=(status,data)=>({status,data}),limit=(key,n=6)=>rateLimit(db,'public:'+key,n,900000);
 if(action==='telegram.update'){
  const secret=String(process.env.TELEGRAM_WEBHOOK_SECRET||''),given=String(req.headers['x-telegram-bot-api-secret-token']||'');
  if(secret.length<20||given.length!==secret.length||!crypto.timingSafeEqual(Buffer.from(given),Buffer.from(secret)))fail('Forbidden',403);
  const id=Number(body.update_id);if(!Number.isSafeInteger(id))return send(200,{ok:true});
  try{await C('telegram_updates').insertOne({_id:id,expires:new Date(Date.now()+432000000)})}catch(e){if(e.code===11000)return send(200,{ok:true});throw e}
  const chat=body.message?.chat?.id,text=String(body.message?.text||'').slice(0,150);if(!chat)return send(200,{ok:true});
  if(text.startsWith('/start link_')){
   const token=text.slice(12);
   const link=/^[a-f0-9]{40}$/.test(token)?await C('telegram_links').findOneAndDelete({hash:sha(token),expires:{$gt:new Date()}}):null;
   if(link)await C('customer_accounts').updateOne({_id:link.customerId,active:true},{$set:{telegramChatId:String(chat)}});
   await telegramMessage(chat,link?'Cassia connected. Booking updates and optional sign-in codes can arrive here. Send /stop to disconnect.':'Link expired. Generate a new one in your Cassia account.');
  }else if(text==='/stop'){
   await C('customer_accounts').updateMany({telegramChatId:String(chat)},{$unset:{telegramChatId:''}});
   await telegramMessage(chat,'Cassia notifications disconnected.');
  }else await telegramMessage(chat,'Welcome to Cassia. Link Telegram securely from your restaurant account, or send /stop to disconnect.');
  return send(200,{ok:true});
 }
 if(action==='public.slots'){
  const date=dateOf(body.date),booked=await C('banquet_bookings').find({date,status:{$in:['pending','confirmed']}},{projection:{slot:1}}).toArray();
  return send(200,{slots:banquetSlots.map(slot=>({slot,available:!booked.some(x=>x.slot===slot)})),decorationFee:1000});
 }
 if(action==='public.me')return send(200,{customer:profile(await account(db,req)),telegramEnabled:!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_BOT_USERNAME)});
 if(action==='public.register'){
  await limit('reg:'+String(req.headers['x-forwarded-for']||'unknown').slice(0,90),4);
  const name=nameOf(body.name),email=emailOf(body.email),phone=phoneOf(body.phone),pass=String(body.password||'');
  if(pass.length<12||pass.length>256)fail('Use a password of at least 12 characters');
  if(body.consent!==true)fail('Accept the privacy notice to continue');
  const row={name,email,phone,passwordHash:await passwordHash(pass),active:true,createdAt:new Date()};
  try{row._id=(await C('customer_accounts').insertOne(row)).insertedId}catch(e){if(e.code===11000)fail('Account already exists. Sign in.',409);throw e}
  return send(201,{customer:await loginCustomer(db,res,row),message:'Account created. Email has not been independently verified.'});
 }
 if(action==='public.login'){
  const email=emailOf(body.email);await limit('login:'+email,7);
  const c=await C('customer_accounts').findOne({email,active:true});
  if(!c||!await passwordVerify(String(body.password||''),c.passwordHash))fail('Incorrect email or password',401);
  return send(200,{customer:await loginCustomer(db,res,c)});
 }
 if(action==='public.telegram_otp_start'){
  const email=emailOf(body.email);await limit('telegram:'+email,4);
  const c=await C('customer_accounts').findOne({email,active:true,telegramChatId:{$exists:true}});
  if(!c||!process.env.TELEGRAM_BOT_TOKEN)fail('Telegram sign-in unavailable. Use your password or connect Telegram first.',409);
  const id=hex(20),code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
  await C('customer_otps').insertOne({id,customerId:c._id,hash:otpDigest(id,code),attempts:0,expires:new Date(Date.now()+600000)});
  if(!await telegramMessage(c.telegramChatId,'Cassia sign-in code: '+code+' (10 minutes). Never share this code.')){await C('customer_otps').deleteOne({id});fail('Could not send Telegram code',503)}
  return send(200,{challenge:id});
 }
 if(action==='public.telegram_otp_verify'){
  await limit('verify:'+String(req.headers['x-forwarded-for']||'unknown').slice(0,90),12);
  const id=safeText(body.challenge,80),code=String(body.code||'');
  if(!/^[a-f0-9]{40}$/.test(id)||!/^\d{6}$/.test(code))fail('Enter a six-digit code');
  const otp=await C('customer_otps').findOne({id,expires:{$gt:new Date()},attempts:{$lt:5}});
  if(!otp||!secureEqual(otpDigest(id,code),otp.hash)){await C('customer_otps').updateOne({id},{$inc:{attempts:1}});fail('Code invalid or expired',401)}
  if(!await C('customer_otps').findOneAndDelete({id,hash:otp.hash,expires:{$gt:new Date()},attempts:{$lt:5}}))fail('Code already used',409);
  const c=await C('customer_accounts').findOne({_id:otp.customerId,active:true});if(!c)fail('Account unavailable',401);
  return send(200,{customer:await loginCustomer(db,res,c)});
 }
 if(action.startsWith('reservations.')){
  if(!allowedStaff(staff))fail('Only reception and management can access reservations',403);
  if(action==='reservations.list'){
   const [dine,banquet]=await Promise.all(['dine_bookings','banquet_bookings'].map(n=>C(n).find({date:{$gte:indiaDay()}}).sort({date:1}).limit(140).toArray()));
   return send(200,{bookings:[...dine.map(x=>booking({...x,type:'dine'})),...banquet.map(x=>booking({...x,type:'banquet'}))].sort((a,b)=>(a.date+a.slot).localeCompare(b.date+b.slot))});
  }
  if(action==='reservations.update'){
   const type=safeText(body.type,20),id=safeText(body.id,30),status=safeText(body.status,20);
   if(!types.includes(type)||!ObjectId.isValid(id)||!['confirmed','cancelled'].includes(status))fail('Invalid reservation change');
   const col=C(coll(type)),old=await col.findOne({_id:new ObjectId(id),status:'pending'});
   if(!old)fail('Booking is no longer pending',409);
   if(!(await col.updateOne({_id:old._id,status:'pending'},{$set:{status,handledBy:staff.email,updatedAt:new Date()}})).modifiedCount)fail('Booking already handled',409);
   await audit(db,staff,action,{id,type,status});
   await publish(db,['owner','manager','reception'],'booking','Booking '+status,type+' · '+old.date+' · '+old.slot);
   if(old.customerId){const c=await C('customer_accounts').findOne({_id:old.customerId});if(c?.telegramChatId)await telegramMessage(c.telegramChatId,'Cassia '+type+' booking '+status+': '+old.date+' '+old.slot+'. Contact +91 '+wa()+' for help.')}
   return send(200,{ok:true,status});
  }
  if(action==='reservations.remind'){
   const type=safeText(body.type,20),id=safeText(body.id,30);if(!types.includes(type)||!ObjectId.isValid(id))fail('Invalid reservation');
   const b=await C(coll(type)).findOne({_id:new ObjectId(id)});
   const c=b?.customerId?await C('customer_accounts').findOne({_id:b.customerId}):null;
   if(!c?.telegramChatId)fail('Guest has not connected Telegram. Use WhatsApp instead.',409);
   if(!await telegramMessage(c.telegramChatId,'Cassia reminder: your '+type+' booking is '+b.status+' for '+b.date+' '+b.slot+'. Contact +91 '+wa()+'.'))fail('Could not deliver reminder',503);
   return send(200,{ok:true});
  }
  fail('Unknown staff reservation operation',404);
 }
 if(action==='public.track'){
  const type=safeText(body.type,20),token=safeText(body.token,80);if(!types.includes(type)||!/^[a-f0-9]{40}$/.test(token))fail('Invalid booking reference',404);
  const b=await C(coll(type)).findOne({trackHash:sha(token)});if(!b)fail('Booking not found',404);
  return send(200,{booking:{id:String(b._id),date:b.date,slot:b.slot,status:b.status,type,decorationFee:b.decoration?1000:0}});
 }
 if(action==='public.book'){
  await limit('booking:'+String(req.headers['x-forwarded-for']||'unknown').slice(0,90),8);
  const type=safeText(body.type,20),name=nameOf(body.name),phone=phoneOf(body.phone),date=dateOf(body.date),slot=safeText(body.slot,40);
  if(!types.includes(type))fail('Select dine-in or banquet');
  if(!((type==='dine'?dineSlots:banquetSlots).includes(slot)))fail('Choose a valid time slot');
  if(body.consent!==true)fail('Accept contact consent');
  const guests=type==='dine'?Number(body.guests):null;
  if(type==='dine'&&(!Number.isInteger(guests)||guests<1||guests>20))fail('Choose 1–20 guests');
  const reason=type==='banquet'?safeText(body.reason,35):'';
  if(type==='banquet'&&!['birthday','anniversary','party','corporate','other'].includes(reason))fail('Choose an occasion');
  const c=await account(db,req),token=hex(20),decoration=type==='banquet'&&body.decoration===true;
  const row={date,slot,type,name,phone,guests,reason,otherReason:reason==='other'?safeText(body.otherReason,90):'',decoration,decorationFee:decoration?1000:0,
  notes:safeText(body.notes,350),source:'website',status:'pending',trackHash:sha(token),customerId:c?c._id:null,createdAt:new Date(),updatedAt:new Date()};
  try{row._id=(await C(coll(type)).insertOne(row)).insertedId}catch(e){if(e.code===11000&&type==='banquet')fail('Banquet slot was just reserved. Choose another.',409);throw e}
  await publish(db,['owner','manager','reception'],'booking','New '+type+' request',date+' '+slot+' · '+name);
  if(c?.telegramChatId)await telegramMessage(c.telegramChatId,'Cassia received your '+(type==='dine'?'FREE dine-in':'banquet hall')+' request for '+date+' at '+slot+'. '+(decoration?'Optional decoration +₹1,000. ':'')+'Status: PENDING reception confirmation. Booking reference: '+String(row._id)+'.');
  await telegramMessage(process.env.TELEGRAM_STAFF_CHAT_ID,'Cassia '+type+' request\n'+name+'\n'+phone+'\n'+date+' '+slot+(decoration?'\nDecoration +₹1,000':''));
  const msg='Hello Cassia, I have requested '+(type==='dine'?'a FREE dine-in table for '+guests+' guest(s)':'the banquet hall')+' on '+date+' at '+slot+' in the name of '+name+'. '+(decoration?'Please include optional ₹1,000 event decoration. ':'')+'Please confirm the availability and booking.';
  return send(201,{booking:{id:String(row._id),date,slot,status:'pending',type,decorationFee:row.decorationFee},trackingToken:token,whatsappUrl:'https://wa.me/91'+wa()+'?text='+encodeURIComponent(msg),message:'Request received. Our team will confirm it.'});
 }
 if(action==='public.logout'){const token=sessionCookie(req);if(token)await C('customer_sessions').deleteOne({hash:sha(token)});setCookie(res,null);return send(200,{ok:true})}
 const c=await account(db,req);
 if(action==='public.cancel'){
  const type=safeText(body.type,20),id=safeText(body.id,30);if(!types.includes(type)||!ObjectId.isValid(id))fail('Invalid booking');
  const filter={_id:new ObjectId(id),status:'pending'};
  if(c)filter.customerId=c._id;else{const token=safeText(body.token,80);if(!/^[a-f0-9]{40}$/.test(token))fail('Booking reference required',403);filter.trackHash=sha(token)}
  if(!(await C(coll(type)).updateOne(filter,{$set:{status:'cancelled',updatedAt:new Date()}})).modifiedCount)fail('Booking not pending or not yours',409);
  await publish(db,['owner','manager','reception'],'booking','Guest cancelled booking',type+' '+id);
  return send(200,{ok:true});
 }
 if(!c)fail('Sign in to manage your account',401);
 if(action==='public.my_bookings'){
  const [d,b]=await Promise.all(['dine_bookings','banquet_bookings'].map(n=>C(n).find({customerId:c._id}).sort({date:-1}).limit(75).toArray()));
  return send(200,{bookings:[...d.map(x=>booking({...x,type:'dine'})),...b.map(x=>booking({...x,type:'banquet'}))].sort((a,b)=>b.date.localeCompare(a.date))});
 }
 if(action==='public.profile'){
  const changes={updatedAt:new Date()};
  if(body.name!==undefined)changes.name=nameOf(body.name);
  if(body.phone!==undefined)changes.phone=phoneOf(body.phone);
  if(body.newPassword){if(String(body.newPassword).length<12||String(body.newPassword).length>256)fail('New password must contain at least 12 characters');if(!await passwordVerify(String(body.currentPassword||''),c.passwordHash))fail('Current password incorrect',403);changes.passwordHash=await passwordHash(String(body.newPassword))}
  if(Object.keys(changes).length<2)fail('Nothing to update');
  await C('customer_accounts').updateOne({_id:c._id},{$set:changes});return send(200,{customer:profile({...c,...changes})});
 }
 if(action==='public.telegram_link'){
  const bot=safeText(process.env.TELEGRAM_BOT_USERNAME,80).replace(/^@/,'');if(!process.env.TELEGRAM_BOT_TOKEN||!/^[a-zA-Z0-9_]{5,40}$/.test(bot))fail('Telegram bot not configured',503);
  const token=hex(20);await C('telegram_links').deleteMany({customerId:c._id});
  await C('telegram_links').insertOne({customerId:c._id,hash:sha(token),expires:new Date(Date.now()+600000)});
  return send(200,{url:'https://t.me/'+bot+'?start=link_'+token});
 }
 if(action==='public.delete'){
  if(!await passwordVerify(String(body.password||''),c.passwordHash))fail('Password incorrect',403);
  for(const n of ['dine_bookings','banquet_bookings']){
   await C(n).updateMany({customerId:c._id,status:'pending'},{$set:{status:'cancelled',updatedAt:new Date()}});
   await C(n).updateMany({customerId:c._id},{$unset:{customerId:''}});
  }
  await C('customer_sessions').deleteMany({customerId:c._id});await C('telegram_links').deleteMany({customerId:c._id});await C('customer_otps').deleteMany({customerId:c._id});
  await C('customer_accounts').deleteOne({_id:c._id});setCookie(res,null);
  return send(200,{ok:true,message:'Account deleted. Pending bookings were cancelled. Confirmed bookings remain with the restaurant for fulfilment.'});
 }
 fail('Unknown customer action',404);
}
