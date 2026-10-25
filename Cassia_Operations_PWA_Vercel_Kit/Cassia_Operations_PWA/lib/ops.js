import crypto from 'node:crypto';
import {safeText,validEmail} from './core.js';

const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e};
const isoDate=v=>{const d=safeText(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)fail('Choose a valid date.');return d};
const monthOf=v=>{const s=safeText(v,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))fail('Choose a valid calendar month.');return s};
const emailOf=v=>{const s=safeText(v,240).toLowerCase();if(!validEmail(s))fail('Choose an employee email.');return s};
const yearWindow=year=>({$gte:`${year}-01-01`,$lte:`${year}-12-31`});
const now=()=>new Date();
const digest=obj=>crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const result=(data,status=200)=>({status,data});
const roleAccess=(user,employee)=>['owner','manager'].includes(user.role)||user.email===employee;
const daySpan=month=>({$gte:month+'-01',$lte:month+'-31'});
function normalizeRow(source,record){
  if(!record||typeof record!=='object'||Array.isArray(record))fail('Import row must be an object.');
  if(source==='attendo'){
    const email=emailOf(record.email||record.employee_email||record.staff_email);
    const date=isoDate(record.date||record.day);
    const value=safeText(record.status||record.attendance,22).toLowerCase().replace(/ /g,'_');
    if(!['present','absent','leave','half_day','late'].includes(value))fail('Attendance status must be present, absent, leave, half_day or late.');
    return {email,date,status:value};
  }
  const billNumber=safeText(record.bill_number||record.bill_no||record.invoice||record.bill,80);
  const date=isoDate(record.date||record.bill_date);
  const amount=Number(record.amount||record.total||record.net_amount);
  if(!billNumber||!Number.isFinite(amount)||amount<0||amount>10000000)fail('Bill number and nonnegative total required.');
  return {billNumber,date,amount:Number(amount.toFixed(2))};
}
export async function operationalAction(action,{db,user,body,audit,publish}){
 const C=name=>db.collection(name);
 const actors=['owner','manager'];
 if(action==='imports.preview'||action==='imports.commit'){
   const source=safeText(body.source,20).toLowerCase();
   if(!['petpooja','attendo'].includes(source))fail('Choose Petpooja or Attendo.');
   if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>40)fail('Import 1 to 40 CSV rows at a time. Larger files can be split into batches.');
   const parsed=[],errors=[];
   body.rows.forEach((row,index)=>{try{parsed.push(normalizeRow(source,row))}catch(e){errors.push({line:index+2,error:e.message})}});
   if(action==='imports.preview')return result({source,valid:parsed.length,invalid:errors.length,errors:errors.slice(0,12),sample:parsed.slice(0,3),notice:'Preview only. No live bills or attendance are changed.'});
   if(errors.length)fail('Fix invalid rows before import. '+errors[0].error);
   const batchId=crypto.randomUUID(),createdAt=now();let fresh=0;
   for(const record of parsed){
     const hash=digest({source,record});
     const change=await C('import_records').updateOne({_id:hash},{$setOnInsert:{source,record,status:'pending_review',uploadedBy:user.email,batchId,createdAt}},{upsert:true});
     if(change.upsertedCount)fresh++;
   }
   await C('import_batches').insertOne({batchId,source,total:parsed.length,created:fresh,duplicates:parsed.length-fresh,uploadedBy:user.email,createdAt});
   await audit(db,user,action,{source,rows:parsed.length,newRecords:fresh,batchId});
   await publish(db,['owner','manager'],'import','New import awaiting review',source+' • '+fresh+' record(s) awaiting verification.');
   return result({ok:true,batchId,created:fresh,duplicates:parsed.length-fresh,message:'Stored as pending review. Official systems have not been modified.'},201);
 }
 if(action==='imports.list'){
   const query=user.role==='reception'?{source:'petpooja'}:{};
   const batches=await C('import_batches').find(query,{projection:{_id:0}}).sort({createdAt:-1}).limit(20).toArray();
   const records=await C('import_records').find(query).sort({createdAt:-1}).limit(80).toArray();
   return result({batches,records:records.map(r=>({id:r._id,source:r.source,record:r.record,status:r.status,createdAt:r.createdAt}))});
 }
 if(action==='imports.verify'){
   const id=safeText(body.id,64),decision=safeText(body.decision,10);
   if(!/^[a-f0-9]{64}$/.test(id)||!['approved','rejected'].includes(decision))fail('Select a valid record and review decision.');
   const rec=await C('import_records').findOne({_id:id,status:'pending_review'});if(!rec)fail('Import already reviewed or not found.',409);
   // An attendance import requires mapping to a real current staff account.
   if(decision==='approved'&&rec.source==='attendo'){
     const staff=await C('users').findOne({email:rec.record.email,active:true});if(!staff)fail('Unknown staff email. Create or match the employee before approval.',409);
   }
   const updated=await C('import_records').updateOne({_id:id,status:'pending_review'},{$set:{status:decision,reviewedBy:user.email,reviewedAt:now()}});
   if(!updated.modifiedCount)fail('Already reviewed by another manager.',409);
   if(decision==='approved'){
     const collection=rec.source==='attendo'?'attendance_imported':'petpooja_imported';
     await C(collection).updateOne({_id:id},{$setOnInsert:{...rec.record,source:'verified_'+rec.source,sourceRef:id,verifiedBy:user.email,verifiedAt:now()}},{upsert:true});
   }
   await audit(db,user,action,{recordId:id,source:rec.source,decision});
   return result({ok:true});
 }
 if(action==='attendance.list'||action==='attendance.summary'){
   const month=monthOf(body.month||new Date().toISOString().slice(0,7));
   const email=user.role==='owner'||user.role==='manager'?safeText(body.email,240).toLowerCase():user.email;
   const filter=email?{email,date:daySpan(month)}:{date:daySpan(month)};
   if(email&&!validEmail(email))fail('Invalid employee');
   const [manual,imported,users,requests]=await Promise.all([
     C('attendance_manual').find(filter).limit(600).toArray(),
     C('attendance_imported').find(filter).limit(600).toArray(),
     user.role==='owner'||user.role==='manager'?C('users').find({active:true},{projection:{email:1,name:1,role:1,highPerformer:1}}).limit(150).toArray():Promise.resolve([{email:user.email,name:user.name,role:user.role,highPerformer:user.highPerformer}]),
     C('leave').find(email?{userEmail:email,date:daySpan(month)}:{date:daySpan(month)}).limit(300).toArray()
   ]);
   const byKey=new Map();
   for(const r of imported)byKey.set(r.email+':'+r.date,{email:r.email,date:r.date,status:r.status,source:'Verified Attendo import'});
   for(const r of manual)byKey.set(r.email+':'+r.date,{email:r.email,date:r.date,status:r.status,source:'Owner correction',note:r.reason});
   return result({month,entries:[...byKey.values()],leave:requests.map(x=>({id:String(x._id),email:x.userEmail,date:x.date,status:x.status,type:x.type||'cl'})),staff:users.map(x=>({email:x.email,name:x.name,role:x.role,highPerformer:x.highPerformer===true}))});
 }
 if(action==='attendance.mark'){
   const email=emailOf(body.email),date=isoDate(body.date),status=safeText(body.status,24),reason=safeText(body.reason,180);
   if(!['present','absent','half_day','leave'].includes(status)||reason.length<4)fail('Select attendance and enter a reason.');
   const account=await C('users').findOne({email,active:true});if(!account)fail('Staff account not found.',404);
   await C('attendance_manual').updateOne({email,date},{$set:{email,date,status,reason,updatedBy:user.email,updatedAt:now()}},{upsert:true});
   await audit(db,user,action,{email,date,status});
   await publish(db,[account.role],'attendance','Attendance corrected','Attendance for '+date+' has been updated by the owner.',email);
   return result({ok:true,message:'Owner correction recorded; Attendo original data is unchanged.'});
 }
 if(action==='performance.flag'){
   const email=emailOf(body.email),highPerformer=body.highPerformer===true;
   if(!(await C('users').updateOne({email,role:{$ne:'owner'}},{$set:{highPerformer}})).matchedCount)fail('Employee not found.',404);
   await audit(db,user,action,{email,highPerformer});return result({ok:true});
 }
 if(action==='performance.reward'){
   const email=emailOf(body.email),month=monthOf(body.month),title=safeText(body.title,100),points=Number(body.points);
   if(title.length<4||!Number.isInteger(points)||points<1||points>20)fail('Enter a recognition title and 1–20 points.');
   const worker=await C('users').findOne({email,active:true});if(!worker||worker.role==='owner')fail('Choose an active staff member.');
   await C('recognition').insertOne({email,month,title,points,awardedBy:user.email,createdAt:now()});
   await audit(db,user,action,{email,month,points,title});
   await publish(db,[worker.role],'recognition','Well done!','Your manager has recognised your work: '+title,email);
   return result({ok:true});
 }
 if(action==='performance.list'){
   const month=monthOf(body.month||new Date().toISOString().slice(0,7));
   const [staff,tasks,rewards]=await Promise.all([C('users').find({role:{$ne:'owner'},active:true},{projection:{email:1,name:1,role:1,highPerformer:1}}).limit(160).toArray(),C('tasks').find({status:'done',updatedAt:{$gte:new Date(month+'-01'),$lt:new Date(new Date(month+'-01').setMonth(Number(month.slice(5,7))))}},{projection:{assignedTo:1}}).limit(2000).toArray(),C('recognition').find({month}).limit(1000).toArray()]);
   const scores=staff.map(x=>{const completed=tasks.filter(t=>t.assignedTo===x.email).length,awards=rewards.filter(r=>r.email===x.email),points=awards.reduce((sum,r)=>sum+r.points,0);return {email:x.email,name:x.name,role:x.role,completed,recognitionPoints:points,score:completed+points,highPerformer:x.highPerformer===true,awards:awards.map(x=>({title:x.title,points:x.points}))}}).sort((a,b)=>b.score-a.score);
   return result({month,leaderboard:scores.map((x,i)=>user.role==='owner'||user.role==='manager'||x.email===user.email?{...x,rank:i+1}:{name:x.name,role:x.role,rank:i+1,score:x.score,completed:x.completed,recognitionPoints:x.recognitionPoints}) ,note:'Recognition is owner-awarded; rankings are indicative and must not be used for automatic discipline or pay decisions.'});
 }
 if(action==='inventory.readiness'){
   const [recipes,ingredients,menu]=await Promise.all([C('demo_recipes').find({}).limit(150).toArray(),C('demo_stock').find({}).limit(150).toArray(),C('menu').find({active:{$ne:false}},{projection:{name:1,available:1}}).limit(150).toArray()]);
   const stock=new Map(ingredients.map(x=>[x.name,x]));
   const map=new Map(recipes.map(x=>[x.name,x]));
   const items=menu.map(d=>{const r=map.get(d.name);const known=Boolean(r?.ingredients?.length);const capacity=known?Math.max(0,Math.floor(Math.min(...r.ingredients.map(g=>(stock.get(g.name)?.quantity||0)/g.qty)))):null;return{name:d.name,available:d.available!==false,capacity,canPrepare:d.available!==false&&known&&capacity>0,missing:known?r.ingredients.filter(g=>(stock.get(g.name)?.quantity||0)<g.qty).map(g=>g.name):[],source:'illustrative_recipe_demo'}});
   return result({demo:true,items,ingredientCount:ingredients.length,notice:'Illustrative 5-servings recipe stock. Not a physical stock count or guarantee. Head chef confirms actual availability.'});
 }
 if(action==='menu.price'){
   const name=safeText(body.name,120),price=Number(body.price);
   if(!name||!Number.isFinite(price)||price<0||price>50000)fail('Enter an actual menu item and valid price.');
   const changed=await C('menu').updateOne({name,active:{$ne:false}},{$set:{price:Number(price.toFixed(2)),priceVerified:true,priceUpdatedBy:user.email,priceUpdatedAt:now()}});
   if(!changed.matchedCount)fail('Item not found.',404);
   await audit(db,user,action,{name,price});return result({ok:true});
 }
 return undefined;
}
