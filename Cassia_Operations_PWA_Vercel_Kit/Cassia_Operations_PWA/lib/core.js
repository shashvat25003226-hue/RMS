import crypto from 'node:crypto';
export const roles=['owner','manager','chef','waiter','reception'];
export const orderStatuses=['sent','received','preparing','ready','served','cancelled'];
export const allowedActions={
  'users.create':['owner'],'users.list':['owner','manager'],
  'tables.list':['owner','manager','chef','waiter','reception'],'tables.provision':['owner','manager'],
  'orders.list':['owner','manager','chef','waiter','reception'],'orders.create':['owner','manager','waiter'],
  'orders.ack':['owner','manager','chef'],'orders.prepare':['owner','manager','chef'],'orders.ready':['owner','manager','chef'],
  'orders.serve':['owner','manager','waiter'],'orders.reconcile':['owner','manager','reception'],
  'calls.list':['owner','manager','waiter','reception'],'calls.claim':['owner','manager','waiter','reception'],'calls.done':['owner','manager','waiter','reception'],
  'stock.list':['owner','manager','chef'],'stock.adjust':['owner','manager','chef'],
  'tasks.list':['owner','manager','chef','waiter','reception'],'tasks.create':['owner','manager','chef'],'tasks.update':['owner','manager','chef','waiter','reception'],
  'leave.request':['owner','manager','chef','waiter','reception'],'leave.list':['owner','manager','chef','waiter','reception'],'leave.review':['owner','manager'],
  'closing.confirm':['owner','manager','chef','waiter','reception'],'reports.summary':['owner','manager'],'menu.list':['owner','manager','chef','waiter','reception'],
  'menu.update':['owner','manager'],
  'audit.list':['owner']
};
export const can=(role,action)=>(allowedActions[action]||[]).includes(role);
export const hex=(n=32)=>crypto.randomBytes(n).toString('hex');
export const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
export const safeText=(s,max=200)=>String(s||'').trim().slice(0,max);
export const validEmail=(s)=>typeof s==='string'&&s.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export async function passwordHash(value){if(typeof value!=='string'||value.length<8||value.length>256)throw Error('Password must be 8-256 characters');const salt=hex(16);const derived=await new Promise((resolve,reject)=>crypto.scrypt(value,salt,64,{N:16384,r:8,p:1},(e,v)=>e?reject(e):resolve(v)));return `scrypt$${salt}$${derived.toString('hex')}`}
export async function passwordVerify(value,stored){if(!stored||typeof value!=='string'||value.length>256)return false;const [alg,salt,hash]=String(stored).split('$');if(alg!=='scrypt'||!salt||!/^[a-f0-9]{128}$/.test(hash||''))return false;const expected=Buffer.from(hash,'hex');const actual=await new Promise((resolve,reject)=>crypto.scrypt(value,salt,64,{N:16384,r:8,p:1},(e,v)=>e?reject(e):resolve(v)));return crypto.timingSafeEqual(actual,expected)}
export function otpDigest(challenge,code){if(!process.env.OTP_PEPPER||process.env.OTP_PEPPER.length<32)throw Error('Missing OTP_PEPPER');return crypto.createHmac('sha256',process.env.OTP_PEPPER).update(challenge+':'+code).digest('hex')}
export function secureEqual(a,b){if(!a||!b||a.length!==b.length)return false;return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b))}
export function advance(current,next){const map={sent:'received',received:'preparing',preparing:'ready',ready:'served'};return map[current]===next}
export const restrictedUser=u=>({id:String(u._id),name:u.name,email:u.email,role:u.role});
export function publicOrder(o){return {id:o.orderId,table:o.table,status:o.status,items:o.items.map(i=>({name:i.name,qty:i.qty})),updatedAt:o.updatedAt};}
