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
    ['tables',[{key:{number:1},unique:true}]],['calls',[{key:{table:1,status:1}}]],['stock',[{key:{name:1},unique:true}]],
    ['tasks',[{key:{status:1,assignedTo:1}}]],['rate_limits',[{key:{expires:1},expireAfterSeconds:0}]],['audit',[{key:{createdAt:-1}}]
  ];
  await Promise.all(specs.flatMap(([name,indexes])=>indexes.map(idx=>db.collection(name).createIndex(idx.key,idx).catch(()=>{}))));
}
