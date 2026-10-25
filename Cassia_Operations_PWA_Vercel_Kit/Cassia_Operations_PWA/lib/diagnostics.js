// Private, read-only operational telemetry. Never store request bodies or credentials.
const safeAction=(action)=>/^[a-z][a-z0-9_.-]{0,55}$/i.test(String(action||''))?String(action):'unknown';
export async function recordIncident(db,action,status,reason='request'){
 try{
  const http=Number(status)||500;
  await db.collection('api_incidents').insertOne({
   at:new Date(),action:safeAction(action),status:http,
   category:http>=500?'server_failure':http===429?'rate_limited':http===401?'authentication':http===403?'permission':http===409?'conflict':'validation',
   reason:['auth.start','auth.verify','auth.recovery_start','auth.recovery_finish'].includes(action)?'sign_in':String(reason).slice(0,30)
  });
 }catch{ /* Logging must never prevent restaurant operations */ }
}
export async function diagnosticsSnapshot(db){
 const now=new Date(),from=new Date(Date.now()-24*3600000),start=Date.now();
 await db.command({ping:1});
 const latency=Date.now()-start;
 const [incidents,groups,staffCount,logs]=await Promise.all([
  db.collection('api_incidents').find({at:{$gte:from}},{projection:{_id:0,at:1,action:1,status:1,category:1}}).sort({at:-1}).limit(50).toArray(),
  db.collection('api_incidents').aggregate([{$match:{at:{$gte:from}}},{$group:{_id:'$category',count:{$sum:1}}}]).toArray(),
  db.collection('users').countDocuments({active:true}),
  db.collection('audit').find({},{projection:{_id:0,action:1,createdAt:1}}).sort({createdAt:-1}).limit(15).toArray()
 ]);
 const counts=Object.fromEntries(groups.map(x=>[x._id,x.count]));
 return {generatedAt:now.toISOString(),
  services:{
   api:{status:'online',service:'Cassia Node API',uptimeSeconds:Math.round(process.uptime())},
   mongo:{status:'connected',latencyMs:latency},
   email:{status:process.env.RESEND_API_KEY&&process.env.EMAIL_FROM?'configured_not_delivery_verified':'not_configured'},
   render:{status:'not_directly_monitored',description:'Open Render dashboard to confirm deployment and logs'},
   vercel:{status:'not_directly_monitored',description:'Open Vercel dashboard to confirm production build and logs'}
  },
  version:String(process.env.RENDER_GIT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||'not_reported').slice(0,12),
  activeAccounts:staffCount,errors24h:incidents.length,failuresByCategory:counts,incidents,activity:logs,
  scope:'API incidents recorded after diagnostics deployment; this is not an exhaustive history of platform logs. No raw credentials or customer data is stored.'
 };
}
