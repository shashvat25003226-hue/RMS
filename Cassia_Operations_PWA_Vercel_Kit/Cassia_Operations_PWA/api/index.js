import crypto from 'node:crypto';
import {ObjectId} from 'mongodb';
import {database,ensureIndexes} from '../lib/db.js';
import {sendOtp} from '../lib/mail.js';
import {roles,can,orderStatuses,sha,hex,safeText,validEmail,passwordHash,passwordVerify,otpDigest,secureEqual,advance,restrictedUser,publicOrder} from '../lib/core.js';
const DAY=86400000, SESSION_HOURS=12;
const demoOtpEnabled=()=>process.env.CLIENT_DEMO_MODE==='true'&&process.env.CLIENT_DEMO_OTP==='true';
const reply=(res,code,data)=>res.status(code).setHeader('Cache-Control','no-store').json(data);
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').slice(0,2)).filter(x=>x.length===2));}
function setSession(res,token){const secure=process.env.SESSION_COOKIE_SECURE!=='false';res.setHeader('Set-Cookie',`cassia_sid=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_HOURS*3600}${secure?'; Secure':''}`)}
function clearSession(res){const secure=process.env.SESSION_COOKIE_SECURE!=='false';res.setHeader('Set-Cookie',`cassia_sid=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`)}
function reject(message,status=400){const e=new Error(message);e.status=status;throw e}
function ipOf(req){return String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,90)}
async function rateLimit(db,key,max=6,windowMs=600000){const id=sha(key);const c=db.collection('rate_limits');const now=new Date();await c.updateOne({_id:id,expires:{$gt:now}},{$inc:{count:1}},{upsert:false});let doc=await c.findOne({_id:id});if(!doc||doc.expires<=now){try{await c.insertOne({_id:id,count:1,expires:new Date(Date.now()+windowMs)})}catch(_){doc=await c.findOne({_id:id})}}else if(doc.count>max)reject('Too many requests. Try again later.',429);}
function assertEmail(v){const s=safeText(v,250).toLowerCase();if(!validEmail(s))reject('Enter a valid email address.');return s}
function assertTable(v){const n=Number(v);if(!Number.isInteger(n)||n<1||n>150)reject('Choose a valid table number.');return n}
function assertItems(items){if(!Array.isArray(items)||!items.length||items.length>40)reject('Add at least one menu item.');return items.map(i=>{const name=safeText(i.name,120),qty=Number(i.qty);if(!name||!Number.isInteger(qty)||qty<1||qty>50)reject('Check order item and quantity.');return {name,qty,note:safeText(i.note,240)}})}
async function userFromCookie(db,req){const token=cookies(req).cassia_sid;if(!token||!(/^[a-f0-9]{64}$/.test(token)))return null;const s=await db.collection('sessions').findOne({hash:sha(token),expires:{$gt:new Date()}});if(!s)return null;const u=await db.collection('users').findOne({_id:s.userId,active:true});return u||null}
async function publish(db,roles,kind,title,body,targetEmail=null){
 try{await db.collection('notifications').insertOne({roles,kind,title,body,targetEmail,createdAt:new Date(),readBy:[]})}catch(e){console.error('Notification save:',e.message)}
}
function mobile(value){const raw=String(value||'').replace(/[^0-9]/g,'');const phone=raw.startsWith('91')&&raw.length===12?raw.slice(2):raw;if(!/^[6-9][0-9]{9}$/.test(phone))reject('Enter a valid 10-digit Indian mobile number.');return phone}
function customerPublic(c){return{id:String(c._id),name:c.name,phone:c.phone,tier:c.tier||'regular',note:c.note||'',updatedAt:c.updatedAt}}
async function audit(db,user,action,data){await db.collection('audit').insertOne({actor:user?String(user._id):'guest',action,details:data||{},createdAt:new Date()});}
async function relayToRender(req,res){
  const expected=process.env.APP_ORIGIN||'https://cassiams.vercel.app';
  const requestOrigin=String(req.headers.origin||'');
  if(requestOrigin&&requestOrigin!==expected)return reply(res,403,{error:'Cross-origin request denied'});
  let target;
  try{
    target=new URL(process.env.RENDER_API_ORIGIN);
    if(target.protocol!=='https:'||!target.hostname.endsWith('.onrender.com')||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('Invalid Render origin');
  }catch{return reply(res,503,{error:'Backend origin not configured correctly'})}
  if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'Method not allowed'});
  try{
    const data=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
    const healthQuery=req.method==='GET'&&String(req.url||'').includes('health=ready')?'?health=ready':'';
    const response=await fetch(target.origin+'/api'+healthQuery,{method:req.method,headers:{'Content-Type':'application/json',Origin:expected,Cookie:String(req.headers.cookie||'')},body:req.method==='POST'?data:undefined,signal:AbortSignal.timeout(13000)});
    if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('Upstream is not JSON');
    const cookie=response.headers.get('set-cookie');if(cookie)res.setHeader('Set-Cookie',cookie);
    return reply(res,response.status,await response.json());
  }catch(error){console.error('Cassia backend relay:',error.message);return reply(res,503,{error:'Backend unavailable. Please retry.'})}
}
export default async function handler(req,res){
 if(process.env.RENDER_API_ORIGIN)return relayToRender(req,res);
 if(req.method==='GET'){
   const health=new URL(req.url||'/api','http://localhost').searchParams.get('health');
   if(health==='ready'){
     try{
       const db=await database();
       await db.command({ping:1});
       const accounts=await db.collection('users').estimatedDocumentCount();
       return reply(res,200,{ok:true,database:'connected',accountsInitialized:accounts>0});
     }catch(error){
       console.error('Database readiness failed:',error.message);
       return reply(res,503,{ok:false,database:'unavailable'});
     }
   }
   return reply(res,200,{ok:true,name:'Cassia Operations API'});
 }
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
 if(req.headers['content-type']?.split(';')[0]!=='application/json')return reply(res,415,{error:'JSON body required'});
 const origin=req.headers.origin;const host=req.headers.host;
 if(origin){let parsed;try{parsed=new URL(origin)}catch(_){return reply(res,403,{error:'Invalid origin'})}if(parsed.host!==host&&parsed.origin!==process.env.APP_ORIGIN)return reply(res,403,{error:'Cross-origin requests are not allowed'})}
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();if(JSON.stringify(body).length>25000)reject('Request too large',413)}catch(e){return reply(res,e.status||400,{error:'Invalid JSON request'})}
 const action=String(body.action||'');
 try{
  const db=await database();
  if(!globalThis.__cassiaIndexes){globalThis.__cassiaIndexes=ensureIndexes(db)}await globalThis.__cassiaIndexes;
  if(action==='auth.bootstrap'){
   await rateLimit(db,'owner-setup-ip:'+ipOf(req),6,30*60000);
   const configured=String(process.env.OWNER_SETUP_TOKEN||'');
   const supplied=String(body.setupToken||'');
   if(configured.length<32)reject('First-owner setup is not enabled. Set OWNER_SETUP_TOKEN in the Render environment.',403);
   if(supplied.length<32||supplied.length>256||!secureEqual(sha(supplied),sha(configured)))return reply(res,403,{error:'Setup token is invalid.'});
   const name=safeText(body.name,80),email=assertEmail(body.email),password=String(body.password||'');
   if(name.length<2||password.length<12||password.length>256)reject('Enter a name and a password of at least 12 characters.');
   if(await db.collection('users').findOne({role:'owner'}))return reply(res,409,{error:'An owner already exists. Setup cannot be repeated.'});
   // Database uniqueness prevents two concurrent requests from creating multiple owners.
   await db.collection('users').createIndex({role:1},{unique:true,partialFilterExpression:{role:'owner'}});
   try{
     await db.collection('users').insertOne({name,email,role:'owner',passwordHash:await passwordHash(password),active:true,mustRotatePassword:false,createdAt:new Date()});
   }catch(error){if(error.code===11000)return reply(res,409,{error:'Owner setup was already completed or that email exists.'});throw error}
   await audit(db,null,'owner.bootstrap',{email});
   return reply(res,201,{created:true,message:'Owner account created. Remove OWNER_SETUP_TOKEN from Render now, and sign in with your new password.'});
  }
  if(action==='auth.start'){
   await rateLimit(db,'login-ip:'+ipOf(req),14,15*60000);
   const email=assertEmail(body.email),pass=String(body.password||'');
   await rateLimit(db,'login-email:'+email,6,15*60000);
   const user=await db.collection('users').findOne({email,active:true});
   if(!user||!await passwordVerify(pass,user.passwordHash))return reply(res,401,{error:'Email or password is incorrect.'});
   const id=hex(20),code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
   await db.collection('otps').deleteMany({userId:user._id});
   await db.collection('otps').insertOne({id,userId:user._id,hash:otpDigest(id,code),expires:new Date(Date.now()+10*60000),attempts:0});
   if(demoOtpEnabled())return reply(res,200,{step:'otp',challenge:id,demoOnly:true,demoCode:code,message:'CLIENT DEMO ONLY: This is not email verification.'});
   try{await sendOtp(email,code)}catch(e){await db.collection('otps').deleteOne({id});console.error('OTP send unavailable:',e.message);return reply(res,503,{error:'Email delivery is unavailable. Check Resend configuration or retry.'})}
   return reply(res,200,{step:'otp',challenge:id,message:'We emailed your one-time sign-in code. It expires in 10 minutes.'});
  }
  if(action==='auth.verify'){
   await rateLimit(db,'otp-ip:'+ipOf(req),25,15*60000);
   const id=safeText(body.challenge,60),code=String(body.code||'');
   if(!/^[a-f0-9]{40}$/.test(id)||!/^[0-9]{6}$/.test(code))reject('Enter your six-digit code.');
   const chall=await db.collection('otps').findOne({id,expires:{$gt:new Date()},attempts:{$lt:5}});
   if(!chall||!secureEqual(otpDigest(id,code),chall.hash)){await db.collection('otps').updateOne({id,attempts:{$lt:5}},{$inc:{attempts:1}});return reply(res,401,{error:'Code invalid or expired. You can request a new code.'});}
   const consumed=await db.collection('otps').findOneAndDelete({id,hash:chall.hash,expires:{$gt:new Date()},attempts:{$lt:5}});if(!consumed)return reply(res,401,{error:'Code already used or expired.'});
   const token=hex();await db.collection('sessions').insertOne({hash:sha(token),userId:chall.userId,expires:new Date(Date.now()+SESSION_HOURS*3600000)});setSession(res,token);
   const u=await db.collection('users').findOne({_id:chall.userId});await audit(db,u,'login',{source:'otp'});
   return reply(res,200,{user:restrictedUser(u)});
  }
  if(action==='tables.request'){
   await rateLimit(db,'call:'+ipOf(req),12,10*60000);
   const table=assertTable(body.table),key=safeText(body.key,90),type=safeText(body.type,24);
   if(!['order','help','bill','urgent'].includes(type)||!/^[a-f0-9]{64}$/.test(key))reject('Invalid table request.');
   const tableRec=await db.collection('tables').findOne({number:table,keyHash:sha(key),active:true});if(!tableRec)reject('This table QR link is invalid. Ask staff for help.',403);
   const existing=await db.collection('calls').findOne({table,status:{$in:['open','claimed']}});
   if(existing)return reply(res,200,{ok:true,message:'A team member has already been notified.',callId:String(existing._id)});
   const row={table,type,status:'open',createdAt:new Date(),updatedAt:new Date(),claimedBy:null};const add=await db.collection('calls').insertOne(row);await publish(db,['owner','manager','waiter','reception'],'table-call','Guest needs help','Table '+table+' • '+type+' request.');return reply(res,200,{ok:true,message:'Your request has been sent to the service team.',callId:String(add.insertedId)});
  }
  if(action==='orders.track'){
   await rateLimit(db,'track:'+ipOf(req),70,10*60000);
   const token=safeText(body.token,90);if(!/^[a-f0-9]{64}$/.test(token))reject('Invalid tracking link.',404);
   const order=await db.collection('orders').findOne({trackHash:sha(token)});if(!order)reject('Order not found.',404);
   return reply(res,200,{order:publicOrder(order),note:order.status==='sent'?'The order has been sent; the kitchen has not acknowledged it yet.':null});
  }
  const u=await userFromCookie(db,req);
  if(action==='auth.me')return reply(res,200,{user:u?restrictedUser(u):null});
  if(!u)reject('Sign in with email, password and OTP.',401);
  if(action==='auth.logout'){const token=cookies(req).cassia_sid;if(token)await db.collection('sessions').deleteOne({hash:sha(token)});clearSession(res);return reply(res,200,{ok:true})}
  if(action==='auth.change_password'){
   const current=String(body.currentPassword||''),newPassword=String(body.newPassword||'');
   if(newPassword.length<12||newPassword.length>256)reject('New password must be at least 12 characters.');
   if(!await passwordVerify(current,u.passwordHash))reject('Current password is incorrect.',403);
   const nextHash=await passwordHash(newPassword);
   await db.collection('users').updateOne({_id:u._id},{$set:{passwordHash:nextHash,mustRotatePassword:false,passwordChangedAt:new Date()}});
   await db.collection('sessions').deleteMany({userId:u._id});clearSession(res);
   await audit(db,u,'password.changed',{});
   return reply(res,200,{ok:true,message:'Password changed. Sign in again with OTP.'});
  }
  if(action==='users.create'&&u.role!=='owner')reject('Only owner can create staff accounts.',403);
  if(!can(u.role,action))reject('Your role does not have permission for this action.',403);
  const C=name=>db.collection(name);
  if(action==='users.list'){
   const data=await C('users').find({},{projection:{name:1,email:1,role:1,active:1,mustRotatePassword:1,createdAt:1}}).sort({active:-1,role:1,name:1}).toArray();
   return reply(res,200,{users:data.map(x=>({...restrictedUser(x),active:x.active!==false,mustRotatePassword:x.mustRotatePassword===true}))});
  }
  if(action==='users.assignable'){
   const roles=u.role==='chef'?['chef','waiter']:['owner','manager','chef','waiter','reception'];
   const users=await C('users').find({active:true,role:{$in:roles}},{projection:{name:1,email:1,role:1}}).sort({name:1}).toArray();
   return reply(res,200,{assignees:users.map(x=>({name:x.name,email:x.email,role:x.role}))});
  }
  if(action==='users.create'){
   const email=assertEmail(body.email),name=safeText(body.name,80),role=safeText(body.role,30);
   if(name.length<2||!['manager','chef','waiter','reception'].includes(role))reject('Enter a valid staff name and role.');
   const temporary=crypto.randomBytes(18).toString('base64url');
   const passwordHashValue=await passwordHash(temporary);
   try {
     const result=await C('users').insertOne({email,name,role,passwordHash:passwordHashValue,active:true,mustRotatePassword:true,createdAt:new Date()});
     await audit(db,u,action,{target:String(result.insertedId),email,role});
   }catch(error){if(error.code===11000)reject('This email already belongs to an account. Reactivate or reset the existing account.',409);throw error}
   return reply(res,201,{created:true,email,role,temporaryPassword:temporary,warning:'Temporary password shown once. Share it privately. Staff must sign in using OTP and change the password.'});
  }
  if(action==='users.update'){
   const id=safeText(body.id,40),mode=safeText(body.mode,30);
   if(!/^[a-f0-9]{24}$/i.test(id))reject('Choose a valid staff account.');
   const target=await C('users').findOne({_id:new ObjectId(id)});
   if(!target||target.role==='owner')reject('Owner account cannot be edited from staff management.',403);
   let changes={};
   if(mode==='role'){
     const newRole=safeText(body.role,30);
     if(!['manager','chef','waiter','reception'].includes(newRole))reject('Choose an allowed staff role.');
     changes={role:newRole};
   }else if(mode==='activate')changes={active:true};
   else if(mode==='deactivate')changes={active:false};
   else reject('Choose a valid team action.');
   await C('users').updateOne({_id:target._id},{$set:{...changes,updatedAt:new Date()}});
   if(mode==='deactivate'||mode==='role'){
     await C('sessions').deleteMany({userId:target._id});
     await C('otps').deleteMany({userId:target._id});
   }
   await audit(db,u,action,{target:id,email:target.email,mode,...changes});
   return reply(res,200,{ok:true,message:mode==='deactivate'?'Account disabled and existing sessions revoked.':mode==='activate'?'Staff account activated.':'Role updated; employee must sign in again.'});
  }
  if(action==='users.set_password'){
   const id=safeText(body.id,40),password=String(body.password||'');
   if(!/^[a-f0-9]{24}$/i.test(id)||password.length<12||password.length>256)reject('Choose a staff account and a password of at least 12 characters.');
   const target=await C('users').findOne({_id:new ObjectId(id)});
   if(!target||target.role==='owner')reject('Owner must change their own password in Account settings.',403);
   await C('users').updateOne({_id:target._id},{$set:{passwordHash:await passwordHash(password),mustRotatePassword:true,updatedAt:new Date()}});
   await C('sessions').deleteMany({userId:target._id});await C('otps').deleteMany({userId:target._id});
   await audit(db,u,action,{target:id,email:target.email});
   return reply(res,200,{ok:true,message:'Staff password changed, all existing sessions revoked. Employee must sign in again.'});
  }
  if(action==='users.reset_password'){
   const id=safeText(body.id,40);
   if(!/^[a-f0-9]{24}$/i.test(id))reject('Choose a valid staff account.');
   const target=await C('users').findOne({_id:new ObjectId(id)});
   if(!target||target.role==='owner')reject('Owner credentials cannot be reset here.',403);
   const temporary=crypto.randomBytes(18).toString('base64url');
   await C('users').updateOne({_id:target._id},{$set:{passwordHash:await passwordHash(temporary),mustRotatePassword:true,updatedAt:new Date()}});
   await C('sessions').deleteMany({userId:target._id});
   await C('otps').deleteMany({userId:target._id});
   await audit(db,u,action,{target:id,email:target.email});
   return reply(res,200,{ok:true,email:target.email,temporaryPassword:temporary,warning:'Copy once and send privately; the previous password no longer works.'});
  }
  if(action==='customers.list'){
   const q=safeText(body.query,60);
   const escaped=q.replace(/[^a-zA-Z0-9 ]/g,'');
   const digits=escaped.replace(/[^0-9]/g,'');const pieces=[{name:{$regex:escaped,$options:'i'}}];if(digits.length>=3)pieces.push({phone:{$regex:digits}});const filter=escaped?{$or:pieces}:{};
   const data=await C('customers').find(filter).sort({updatedAt:-1}).limit(80).toArray();
   const ids=data.map(c=>String(c._id));
   const coupons=ids.length?await C('coupons').find({customerId:{$in:ids}}).sort({createdAt:-1}).limit(150).toArray():[];
   return reply(res,200,{customers:data.map(c=>({...customerPublic(c),coupons:coupons.filter(x=>x.customerId===String(c._id)).map(x=>({id:String(x._id),code:x.code,description:x.description,status:x.status,expiresAt:x.expiresAt}))}))});
  }
  if(action==='customers.save'){
   const phone=mobile(body.phone),name=safeText(body.name,80);
   if(name.length<2)reject('Customer name is required.');
   const existing=await C('customers').findOne({phone}),now=new Date();
   await C('customers').updateOne({phone},{$set:{phone,name,updatedAt:now},$setOnInsert:{tier:'regular',createdAt:now}},{upsert:true});
   await audit(db,u,action,{lastFour:phone.slice(-4)});
   return reply(res,200,{ok:true,message:existing?'Customer details updated.':'Customer added.'});
  }
  if(action==='customers.vip'){
   const phone=mobile(body.phone),tier=safeText(body.tier,12);
   if(!['vip','regular'].includes(tier))reject('Choose VIP or regular.');
   const result=await C('customers').updateOne({phone},{$set:{tier,updatedAt:new Date(),tierChangedBy:u.email}});
   if(!result.matchedCount)reject('Customer not found.',404);
   await audit(db,u,action,{lastFour:phone.slice(-4),tier});
   await publish(db,['owner','manager','reception','waiter'],'vip','Loyalty profile updated','An existing guest profile was updated.');
   return reply(res,200,{ok:true});
  }
  if(action==='coupons.issue'){
   const phone=mobile(body.phone),code=safeText(body.code,28).toUpperCase(),description=safeText(body.description,140),expiresAt=new Date(String(body.expiresAt||''));
   if(!/^[A-Z0-9_-]{5,28}$/.test(code)||description.length<6)reject('Choose a coupon code and benefit description.');
   if(!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date())reject('Choose a future expiry date.');
   const customer=await C('customers').findOne({phone});if(!customer)reject('Customer not found.',404);
   try{await C('coupons').insertOne({customerId:String(customer._id),code,description,expiresAt,status:'active',createdAt:new Date(),createdBy:u.email})}
   catch(e){if(e.code===11000)reject('Coupon code already exists.',409);throw e}
   await audit(db,u,action,{customerId:String(customer._id),code});
   await publish(db,['owner','manager','reception'],'coupon','Loyalty coupon issued','A coupon is ready. Apply benefits only in Petpooja.');
   return reply(res,201,{ok:true,code});
  }
  if(action==='coupons.redeem'){
   const code=safeText(body.code,28).toUpperCase(),petpoojaRef=safeText(body.petpoojaRef,100);
   if(!/^[A-Z0-9_-]{5,28}$/.test(code)||petpoojaRef.length<3)reject('Enter a coupon code and official Petpooja bill reference.');
   const result=await C('coupons').findOneAndUpdate({code,status:'active',expiresAt:{$gt:new Date()}},{$set:{status:'redeemed',petpoojaRef,redeemedAt:new Date(),redeemedBy:u.email}},{returnDocument:'after'});
   if(!result)reject('Coupon is expired, missing or already used.',409);
   await audit(db,u,action,{code,petpoojaRef});
   await publish(db,['owner','manager','reception'],'coupon','Coupon recorded','Coupon '+code+' reconciled with a Petpooja bill.');
   return reply(res,200,{ok:true,message:'Coupon recorded. Any discount must be applied separately in Petpooja.'});
  }
  if(action==='notifications.list'){
   const data=await C('notifications').find({$or:[{roles:u.role},{targetEmail:u.email}]}).sort({createdAt:-1}).limit(60).toArray();
   return reply(res,200,{notifications:data.map(n=>({id:String(n._id),kind:n.kind,title:n.title,body:n.body,createdAt:n.createdAt,read:(n.readBy||[]).includes(String(u._id))}))});
  }
  if(action==='notifications.read'){
   const id=safeText(body.id,40);if(!/^[a-f0-9]{24}$/i.test(id))reject('Invalid notification ID.');
   const result=await C('notifications').updateOne({_id:new ObjectId(id),$or:[{roles:u.role},{targetEmail:u.email}]},{$addToSet:{readBy:String(u._id)}});
   if(!result.matchedCount)reject('Notification not available.',404);
   return reply(res,200,{ok:true});
  }
  if(action==='tables.list'){const data=await C('tables').find({active:true},{projection:{number:1}}).sort({number:1}).toArray();return reply(res,200,{tables:data.map(x=>x.number)})}
  if(action==='tables.provision'){const table=assertTable(body.number),key=hex();await C('tables').updateOne({number:table},{$set:{keyHash:sha(key),active:true,updatedAt:new Date()}},{upsert:true});await audit(db,u,action,{table});return reply(res,200,{table,link:`${process.env.APP_ORIGIN||'https://your-domain.vercel.app'}/?table=${table}&key=${key}`,warning:'Print/save this QR URL now. Generating a new one invalidates the previous link.'})}
  if(action==='menu.list'){const items=await C('menu').find({active:{$ne:false}},{projection:{name:1,category:1,available:1}}).sort({category:1,name:1}).toArray();return reply(res,200,{items:items.map(i=>({id:String(i._id),name:i.name,category:i.category,available:i.available!==false}))})}
  if(action==='menu.update'){
   const name=safeText(body.name,120),category=safeText(body.category,55);
   if(!name)reject('Choose a menu item.');
   if(u.role==='chef'){
     const result=await C('menu').updateOne({name,active:{$ne:false}},{$set:{available:body.available===true,updatedAt:new Date()}});
     if(!result.matchedCount)reject('Menu item not found. Ask a manager to add it.',404);
   }else{
     if(!category)reject('Enter menu category.');
     await C('menu').updateOne({name},{$set:{name,category,available:body.available!==false,active:true,updatedAt:new Date()}},{upsert:true});
   }
   await audit(db,u,action,{name,available:body.available===true});
   await publish(db,['owner','manager','chef','waiter'],'menu','Menu availability updated',name+' is '+(body.available===true?'available.':'sold out.'));
   return reply(res,200,{ok:true});
  }
  if(action==='orders.list'){const q=u.role==='waiter'?{createdBy:String(u._id)}:{};const data=await C('orders').find(q,{projection:{trackHash:0}}).sort({createdAt:-1}).limit(150).toArray();return reply(res,200,{orders:data.map(o=>({...o,id:String(o._id),_id:undefined,idempotencyKey:undefined,customerPhone:u.role==='chef'?undefined:o.customerPhone}))})}
  if(action==='orders.create'){
   const table=assertTable(body.table),items=assertItems(body.items),key=safeText(body.idempotencyKey,80);
   if(!/^[a-zA-Z0-9-]{12,80}$/.test(key))reject('Missing safe order request ID');
   const activeTable=await C('tables').findOne({number:table,active:true});if(!activeTable)reject('Table is not configured. Ask your manager.');
   const allowed=await C('menu').find({name:{$in:items.map(x=>x.name)},active:{$ne:false},available:{$ne:false}},{projection:{name:1}}).toArray();
   const allowedNames=new Set(allowed.map(x=>x.name));if(items.some(x=>!allowedNames.has(x.name)))reject('An item is unavailable or not in the approved menu. Refresh the menu.',409);
   const found=await C('orders').findOne({idempotencyKey:key});if(found)return reply(res,200,{created:false,orderId:found.orderId,status:found.status,message:'Order already sent. Duplicate prevented.'});
   const token=hex(),orderId='C-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomInt(100,999),now=new Date();
   const customerName=safeText(body.customerName,80);const customerPhone=String(body.customerPhone||'').trim()?mobile(body.customerPhone):'';
   if(Boolean(customerName)!==Boolean(customerPhone))reject('Enter both customer name and mobile, or leave both blank.');
   if(customerPhone)await C('customers').updateOne({phone:customerPhone},{$set:{name:customerName,phone:customerPhone,updatedAt:now},$setOnInsert:{tier:'regular',createdAt:now}},{upsert:true});
   const row={orderId,idempotencyKey:key,table,items,customerName,customerPhone,notes:safeText(body.notes,500),status:'sent',billingStatus:'unmatched',trackHash:sha(token),createdBy:String(u._id),createdAt:now,updatedAt:now,history:[{status:'sent',by:u.name,at:now}]};
   try{await C('orders').insertOne(row)}catch(e){if(e.code===11000){const old=await C('orders').findOne({idempotencyKey:key});return reply(res,200,{created:false,orderId:old?.orderId,status:old?.status,message:'Order already saved.'})}throw e}
   await audit(db,u,action,{orderId,table});await publish(db,['owner','manager','chef'],'order','New kitchen ticket','Table '+table+' • '+items.length+' dish line(s) awaiting acknowledgement.');return reply(res,200,{created:true,orderId,status:'sent',trackingToken:token,warning:'Sent to server only. Wait for kitchen acknowledgement.'});
  }
  if(action.startsWith('orders.')&&['orders.ack','orders.prepare','orders.ready','orders.serve'].includes(action)){
   const orderId=safeText(body.orderId,60),next={'orders.ack':'received','orders.prepare':'preparing','orders.ready':'ready','orders.serve':'served'}[action];
   const prev={received:'sent',preparing:'received',ready:'preparing',served:'ready'}[next],at=new Date();
   const result=await C('orders').findOneAndUpdate({orderId,status:prev},{$set:{status:next,updatedAt:at},$push:{history:{status:next,by:u.name,at}}},{returnDocument:'after'});
   if(!result)reject('Order state changed or action is not allowed at this stage.',409);
   await audit(db,u,action,{orderId,status:next});await publish(db,next==='ready'?['owner','manager','waiter','reception']:['owner','manager','chef','waiter'],'order','Order '+next,'Table '+result.table+' • '+orderId+' now '+next+'.');return reply(res,200,{ok:true,status:next});
  }
  if(action==='orders.reconcile'){
   const orderId=safeText(body.orderId,60),billingStatus=safeText(body.billingStatus,20),petpoojaRef=safeText(body.petpoojaRef,100);
   if(!['matched','needs_review','unmatched'].includes(billingStatus)||billingStatus==='matched'&&!petpoojaRef)reject('A Petpooja bill reference is required for matched orders.');
   const result=await C('orders').updateOne({orderId},{$set:{billingStatus,petpoojaRef,updatedAt:new Date()}});if(!result.matchedCount)reject('Order not found.',404);
   await audit(db,u,action,{orderId,billingStatus,petpoojaRef});await publish(db,['owner','manager','reception'],'billing','Petpooja reconciliation updated','Order '+orderId+' • '+billingStatus+'.');return reply(res,200,{ok:true});
  }
  if(action==='calls.list'){const calls=await C('calls').find({status:{$ne:'done'}}).sort({createdAt:-1}).limit(150).toArray();return reply(res,200,{calls:calls.map(c=>({...c,id:String(c._id),_id:undefined}))})}
  if(action==='calls.claim'||action==='calls.done'){
   let id;try{id=new ObjectId(String(body.id))}catch(_){reject('Invalid call ID')}
   const match=action==='calls.claim'?{_id:id,status:'open'}:{_id:id,status:'claimed',claimedBy:String(u._id)};
   if(action==='calls.done'&&['owner','manager'].includes(u.role))delete match.claimedBy;
   const update=action==='calls.claim'?{$set:{status:'claimed',claimedBy:String(u._id),updatedAt:new Date()}}:{$set:{status:'done',updatedAt:new Date(),completedBy:String(u._id)}};
   const result=await C('calls').updateOne(match,update);if(!result.modifiedCount)reject('Call already taken or cannot be updated.',409);
   await audit(db,u,action,{id:String(id)});return reply(res,200,{ok:true});
  }
  if(action==='stock.list'){const stock=await C('stock').find({}).sort({name:1}).toArray();return reply(res,200,{stock:stock.map(s=>({...s,id:String(s._id),_id:undefined}))})}
  if(action==='stock.adjust'){
   const name=safeText(body.name,120),unit=safeText(body.unit,16),reason=safeText(body.reason,240),delta=Number(body.delta);
   if(!name||!['kg','g','L','ml','pcs'].includes(unit)||!reason||!Number.isFinite(delta)||delta===0||Math.abs(delta)>10000)reject('Provide ingredient, unit, non-zero adjustment and reason.');
   const current=await C('stock').findOne({name});if(current&&current.unit!==unit)reject('Units cannot change for an existing stock item.',409);
   const next=(current?.quantity||0)+delta;if(next<0)reject('Adjustment would make stock negative.',409);
   if(current){
     const result=await C('stock').updateOne({_id:current._id,quantity:current.quantity},{$inc:{quantity:delta},$set:{updatedAt:new Date()}});
     if(!result.modifiedCount)reject('Stock changed on another device. Refresh and retry.',409);
   }else{
     try{await C('stock').insertOne({name,unit,quantity:next,min:0,updatedAt:new Date()})}
     catch(e){if(e.code===11000)reject('Stock was added on another device. Refresh and retry.',409);throw e}
   }
   await C('stock_movements').insertOne({name,unit,delta,reason,by:String(u._id),createdAt:new Date()});await audit(db,u,action,{name,delta,reason});await publish(db,['owner','manager','chef'],'stock','Inventory updated',name+' • quantity updated.');return reply(res,200,{ok:true,quantity:next});
  }
  if(action==='tasks.list'){const q=['owner','manager'].includes(u.role)?{}:{assignedTo:u.email};const tasks=await C('tasks').find(q).sort({createdAt:-1}).limit(200).toArray();return reply(res,200,{tasks:tasks.map(t=>({...t,id:String(t._id),_id:undefined}))})}
  if(action==='tasks.create'){
   const title=safeText(body.title,150),assignedTo=assertEmail(body.assignedTo),due=safeText(body.due,20);
   if(!title)reject('Enter a task name.');const assigned=await C('users').findOne({email:assignedTo,active:true});if(!assigned)reject('Assign to an existing employee.');
   if(u.role==='chef'&&!['chef','waiter'].includes(assigned.role))reject('Chef can assign kitchen and waiter work only.',403);
   await C('tasks').insertOne({title,assignedTo,due,status:'open',createdBy:String(u._id),createdAt:new Date(),updatedAt:new Date()});await audit(db,u,action,{title,assignedTo});await publish(db,['owner','manager'],'task','New task assigned',title,assignedTo);return reply(res,200,{ok:true});
  }
  if(action==='tasks.update'){
   let id;try{id=new ObjectId(String(body.id))}catch(_){reject('Invalid task')}
   const task=await C('tasks').findOne({_id:id});if(!task)reject('Task not found.',404);
   if(!['owner','manager'].includes(u.role)&&task.assignedTo!==u.email)reject('You may update only your own task.',403);
   if(!['open','doing','done'].includes(body.status))reject('Invalid status');await C('tasks').updateOne({_id:id},{$set:{status:body.status,updatedAt:new Date()}});await audit(db,u,action,{id:String(id),status:body.status});await publish(db,['owner','manager'],'task','Task status changed',task.title+' • '+body.status,task.assignedTo);return reply(res,200,{ok:true});
  }
  if(action==='leave.request'){const date=safeText(body.date,20),reason=safeText(body.reason,260);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!reason)reject('Enter date and reason.');await C('leave').insertOne({userId:String(u._id),userEmail:u.email,date,reason,status:'pending',createdAt:new Date()});await publish(db,['owner','manager'],'leave','Leave awaiting approval',u.name+' requested leave on '+date);return reply(res,200,{ok:true})}
  if(action==='leave.list'){const query=['owner','manager'].includes(u.role)?{}:{userId:String(u._id)};const rows=await C('leave').find(query).sort({createdAt:-1}).limit(100).toArray();return reply(res,200,{leave:rows.map(x=>({...x,id:String(x._id),_id:undefined}))})}
  if(action==='leave.review'){let id;try{id=new ObjectId(String(body.id))}catch(_){reject('Invalid leave ID')}if(!['approved','declined'].includes(body.status))reject('Invalid approval');const rec=await C('leave').findOne({_id:id});if(!rec||rec.status!=='pending'||rec.userId===String(u._id))reject('Cannot approve this request.',409);await C('leave').updateOne({_id:id},{$set:{status:body.status,reviewedBy:u.email,reviewedAt:new Date()}});await audit(db,u,action,{id:String(id),status:body.status});await publish(db,['owner','manager'],'leave','Leave reviewed','Leave '+body.status+' for '+rec.userEmail,rec.userEmail);return reply(res,200,{ok:true})}
  if(action==='closing.list'){
   const shift=safeText(body.shift,20)||new Date().toISOString().slice(0,10);
   if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(shift))reject('Choose a valid date.');
   const filter=['owner','manager'].includes(u.role)?{shift}:{shift,assignedTo:u.email};
   const list=await C('closing').find(filter,{projection:{shift:1,assignedTo:1,status:1,tabletCharging:1,notes:1,completedBy:1,updatedAt:1}}).sort({assignedTo:1}).limit(50).toArray();
   return reply(res,200,{handovers:list.map(x=>({id:String(x._id),shift:x.shift,assignedTo:x.assignedTo,status:x.status||'assigned',tabletCharging:x.tabletCharging===true,notes:x.notes||'',completedBy:x.completedBy,updatedAt:x.updatedAt}))});
  }
  if(action==='closing.assign'){
   const shift=safeText(body.shift,20)||new Date().toISOString().slice(0,10),assignedTo=assertEmail(body.assignedTo);
   if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(shift))reject('Choose a valid shift date.');
   const worker=await C('users').findOne({email:assignedTo,active:true});
   if(!worker||worker.role==='owner')reject('Assign an active manager, kitchen or service employee.',404);
   await C('closing').updateOne({shift,assignedTo},{$setOnInsert:{shift,assignedTo,status:'assigned',tabletCharging:false,createdAt:new Date()},$set:{assignedBy:u.email,updatedAt:new Date()}},{upsert:true});
   await audit(db,u,action,{shift,assignedTo});
   await publish(db,[worker.role],'handover','Closing handover assigned','A closing checklist was assigned for '+shift,worker.email);
   return reply(res,200,{ok:true});
  }
  if(action==='closing.confirm'){
   const shift=safeText(body.shift,20)||new Date().toISOString().slice(0,10);
   if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(shift))reject('Choose a valid shift date.');
   const result=await C('closing').updateOne({shift,assignedTo:u.email,status:'assigned'},{$set:{status:'completed',tabletCharging:body.tabletCharging===true,notes:safeText(body.notes,260),completedBy:u.email,updatedAt:new Date()}});
   if(!result.matchedCount)reject('No open closing assignment for your account on this date. Ask your manager.',409);
   await audit(db,u,action,{shift});
   await publish(db,['owner','manager'],'handover','Closing handover completed',u.name+' finished the '+shift+' handover.');
   return reply(res,200,{ok:true});
  }
  if(action==='reports.summary'){
   const [openOrders,unmatched,openCalls,openTasks,pendingLeave,stockLow]=await Promise.all([C('orders').countDocuments({status:{$nin:['served','cancelled']}}),C('orders').countDocuments({billingStatus:'unmatched'}),C('calls').countDocuments({status:{$ne:'done'}}),C('tasks').countDocuments({status:{$ne:'done'}}),C('leave').countDocuments({status:'pending'}),C('stock').countDocuments({quantity:{$lte:2}})]);
   return reply(res,200,{data:{openOrders,unmatched,openCalls,openTasks,pendingLeave,stockLow},updatedAt:new Date().toISOString(),note:'Petpooja sales and Attendo attendance are not synced.'});
  }
  if(action==='audit.list'){const rows=await C('audit').find({}).sort({createdAt:-1}).limit(100).toArray();return reply(res,200,{items:rows.map(x=>({...x,id:String(x._id),_id:undefined}))})}
  reject('Unknown action',404)
 } catch(error){const status=error.status|| (error.code===11000?409:500);if(status===500)console.error('Cassia API:',error.message);return reply(res,status,{error:status===500?'Service unavailable. Contact administrator.':error.message})}
}
