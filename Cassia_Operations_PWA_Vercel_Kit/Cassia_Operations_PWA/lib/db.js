import {MongoClient} from 'mongodb';
let connectPromise;
export async function database(){
  if(!process.env.MONGODB_URI)throw Error('MONGODB_URI is not configured');
  if(!connectPromise){const client=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:10,serverSelectionTimeoutMS:6500});connectPromise=client.connect().then(()=>client).catch(e=>{connectPromise=null;throw e})}
  const client=await connectPromise;
  return client.db(process.env.MONGODB_DB||'cassia_operations');
}
export async function ensureIndexes(db){
  const specs=[
    ['users',[{key:{email:1},unique:true}]],['sessions',[{key:{hash:1},unique:true},{key:{expires:1},expireAfterSeconds:0}]],
    ['otps',[{key:{id:1},unique:true},{key:{expires:1},expireAfterSeconds:0}]],
    ['orders',[{key:{idempotencyKey:1},unique:true},{key:{orderId:1},unique:true},{key:{trackHash:1},unique:true}]],
    ['banquet_bookings',[{key:{date:1,slot:1},unique:true,partialFilterExpression:{status:{$in:['pending','confirmed']}}},{key:{date:1,status:1}}]],['tables',[{key:{number:1},unique:true}]],['menu',[{key:{name:1},unique:true}]],['closing',[{key:{shift:1,assignedTo:1},unique:true}]],['calls',[{key:{table:1,status:1}}]],['stock',[{key:{name:1},unique:true}]],
    ['attendance_manual',[{key:{email:1,date:1},unique:true}]],['attendance_imported',[{key:{email:1,date:1},unique:true}]],['petpooja_imported',[{key:{billNumber:1,date:1},unique:true}]],['demo_recipes',[{key:{name:1},unique:true}]],['demo_stock',[{key:{name:1},unique:true}]],['import_records',[{key:{source:1,status:1}},{key:{createdAt:-1}}]],['import_batches',[{key:{batchId:1},unique:true}]],['recognition',[{key:{month:1,email:1}}]],['customers',[{key:{phone:1},unique:true},{key:{updatedAt:-1}}]],['coupons',[{key:{code:1},unique:true},{key:{customerId:1,status:1}}]],['notifications',[{key:{createdAt:-1}},{key:{roles:1,createdAt:-1}},{key:{targetEmail:1,createdAt:-1}}]],['tasks',[{key:{status:1,assignedTo:1}}]],['rate_limits',[{key:{expires:1},expireAfterSeconds:0}]],['audit',[{key:{createdAt:-1}}]]
  ];
  await Promise.all(specs.flatMap(([name,indexes])=>indexes.map(idx=>db.collection(name).createIndex(idx.key,idx).catch(()=>{}))));
}
