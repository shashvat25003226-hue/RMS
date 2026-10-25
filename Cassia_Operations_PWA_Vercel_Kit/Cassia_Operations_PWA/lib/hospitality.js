import {safeText} from './core.js';
const err=(message,status=400)=>{const e=new Error(message);e.status=status;throw e};
const trim=s=>safeText(s,160);
const asDate=v=>{const s=safeText(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)err('Select a valid date');return s};
const asPhone=v=>{let s=String(v||'').replace(/\D/g,'');if(s.startsWith('91')&&s.length===12)s=s.slice(2);if(!/^[6-9]\d{9}$/.test(s))err('Enter a valid 10-digit phone number');return s};
const allowedSlots=['10:00–14:00','14:00–18:00','18:00–23:00'];
const reasons=['birthday','anniversary','party','corporate','other'];
function safeBooking(b){
 return {id:String(b._id),date:b.date,slot:b.slot,status:b.status,name:b.name,phone:b.phone,reason:b.reason,otherReason:b.otherReason||'',decoration:b.decoration===true,decorationFee:b.decoration?1000:0,createdAt:b.createdAt,updatedAt:b.updatedAt,handledBy:b.handledBy||null,note:b.note||''};
}
export async function hospitalityAction(action,{db,user,body,audit,publish}){
 const c=name=>db.collection(name);
 const elevated=['owner','manager'].includes(user.role);
 const books=['owner','manager','reception'].includes(user.role);
 if(action==='banquet.slots'){
  if(!books)err('Only reception or management can view bookings.',403);
  const date=asDate(body.date||new Date().toISOString().slice(0,10));
  const booked=await c('banquet_bookings').find({date,status:{$in:['pending','confirmed']}},{projection:{slot:1,status:1}}).toArray();
  return {status:200,data:{date,slots:allowedSlots.map(slot=>({slot,available:!booked.some(x=>x.slot===slot),state:booked.find(x=>x.slot===slot)?.status||'available'})),fee:1000}};
 }
 if(action==='banquet.list'){
  if(!books)err('Only reception or management can view bookings.',403);
  const date=body.date?asDate(body.date):null;
  const filters=date?{date}:{date:{$gte:new Date(Date.now()-86400000).toISOString().slice(0,10)}};
  const data=await c('banquet_bookings').find(filters).sort({date:1,slot:1}).limit(180).toArray();
  return {status:200,data:{bookings:data.map(safeBooking)}};
 }
 if(action==='banquet.create'){
  if(!books)err('Reception or management must create a banquet booking.',403);
  const date=asDate(body.date),slot=safeText(body.slot,30),name=trim(body.name),phone=asPhone(body.phone),
     reason=safeText(body.reason,30),otherReason=trim(body.otherReason),decoration=body.decoration===true;
  if(date<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}))err('Choose today or a future date.');
  if(!allowedSlots.includes(slot))err('Choose a displayed available time slot.');
  if(name.length<2||name.length>100)err('Enter customer name.');
  if(!reasons.includes(reason)||(reason==='other'&&otherReason.length<3))err('Choose a valid event occasion.');
  if(body.agreedToContact!==true)err('Confirm the customer agreed to be contacted about this booking.');
  const booking={date,slot,name,phone,reason,otherReason:reason==='other'?otherReason:'',decoration,status:'pending',note:safeText(body.note,400),handledBy:user.email,createdAt:new Date(),updatedAt:new Date()};
  try{
   const added=await c('banquet_bookings').insertOne(booking);
   await audit(db,user,action,{bookingId:String(added.insertedId),date,slot,decoration});
   await publish(db,['owner','manager','reception'],'banquet','Banquet enquiry received',date+' '+slot+' • '+name);
   return {status:201,data:{booking:safeBooking({...booking,_id:added.insertedId}),message:'Slot held for confirmation. Decoration option +₹1,000; final package price confirmed by staff.'}};
  }catch(e){if(e.code===11000)err('Someone already reserved that slot. Refresh availability and choose another.',409);throw e}
 }
 if(action==='banquet.update'){
  if(!books)err('Only reception or management can update bookings.',403);
  const {ObjectId}=await import('mongodb');
  let id;try{id=new ObjectId(String(body.id))}catch{err('Invalid booking ID')}
  const status=safeText(body.status,24);
  if(!['confirmed','cancelled'].includes(status))err('Choose confirm or cancel.');
  const match={_id:id,status:status==='confirmed'?'pending':{$in:['pending','confirmed']}};
  const current=await c('banquet_bookings').findOne(match);
  if(!current)err('Booking is no longer open for this action.',409);
  const response=await c('banquet_bookings').updateOne(match,{$set:{status,updatedAt:new Date(),handledBy:user.email}});
  if(!response.modifiedCount)err('This slot changed on another device. Refresh.',409);
  await audit(db,user,action,{bookingId:String(id),status});
  await publish(db,['owner','manager','reception'],'banquet','Banquet booking '+status,current.date+' '+current.slot+' • '+current.name);
  return {status:200,data:{ok:true,message:status==='confirmed'?'Booking confirmed internally; contact the customer with the details.':'Booking cancelled and slot released.'}};
 }
 if(action==='customers.insights'){
  if(!['owner','manager','reception','waiter'].includes(user.role))err('Not permitted',403);
  const phone=asPhone(body.phone);
  const customer=await c('customers').findOne({phone},{projection:{name:1,tier:1}});
  if(!customer)return {status:200,data:{customer:null,repeatOrders:[],coupons:[],totalOrders:0}};
  const [orders,offers]=await Promise.all([
    c('orders').find({customerPhone:phone,status:{$ne:'cancelled'}},{projection:{items:1,status:1,createdAt:1}}).sort({createdAt:-1}).limit(80).toArray(),
    c('coupons').find({customerId:String(customer._id),status:'active',expiresAt:{$gt:new Date()}},{projection:{code:1,description:1,expiresAt:1}}).limit(15).toArray()
  ]);
  const counts=new Map();
  for(const order of orders)for(const line of order.items||[]){const n=String(line.name||'').slice(0,120);if(n)counts.set(n,(counts.get(n)||0)+Number(line.qty||1))}
  const repeatOrders=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,quantity])=>({name,quantity}));
  return {status:200,data:{customer:{name:customer.name,tier:customer.tier||'regular'},coupons:offers.map(o=>({code:o.code,description:o.description,expiresAt:o.expiresAt})),repeatOrders,totalOrders:orders.length,note:'Recommendations reflect recorded Cassia orders only, not Petpooja history. Coupons must be verified before redemption.'}};
 }
 return undefined;
}
