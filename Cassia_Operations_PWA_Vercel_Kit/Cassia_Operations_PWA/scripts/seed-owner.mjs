import {database,ensureIndexes} from '../lib/db.js';
import {passwordHash,validEmail} from '../lib/core.js';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const envFile=path.join(dir,'..','.env.local');
if(fs.existsSync(envFile)){for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2]}}
const email=process.env.OWNER_BOOTSTRAP_EMAIL?.trim().toLowerCase(),password=process.env.OWNER_BOOTSTRAP_PASSWORD;
if(!validEmail(email)||!password||password.length<8){console.error('Set OWNER_BOOTSTRAP_EMAIL and OWNER_BOOTSTRAP_PASSWORD in a private environment, at least 8 characters.');process.exit(1)}
const db=await database();await ensureIndexes(db);
const existing=await db.collection('users').findOne({role:'owner'});
if(existing){console.error('Owner already exists. Bootstrap refused to overwrite an existing owner.');process.exit(2)}
const hashed=await passwordHash(password);
await db.collection('users').insertOne({name:'Cassia Owner',email,role:'owner',passwordHash:hashed,active:true,mustRotatePassword:true,createdAt:new Date()});
const sections={
 'Tandoori':['Paneer Tikka','Hara Bhara Kabab','Angari Soya Chaap','Malai Paneer Tikka'],
 'North Indian':['Dal Makhani','Kadai Paneer','Handi Paneer Cassia Special','Paneer Butter Masala','Malai Kofta','Shahi Paneer','Jeera Rice'],
 'South Indian':['Masala Dosa','Cassia Family Dosa','Medu Vada','Rawa Masala Dosa','Steamed Idly'],
 'Chinese':['Veg Hakka Noodles','Chilly Paneer','Momos Platter','Manchurian','Veg Fried Rice'],
 'Cafe':['Margherita Pizza','Grilled Veg Sandwich','Paneer Kathi Roll','Cold Coffee'],
 'Beverages':['Virgin Mojito','Fruit Punch','Mango Shake','Cappuccino'],
 'Desserts':['Hot Gulab Jamun','Sizzling Brownie','Shahi Tukda']
};
for(const [category,names] of Object.entries(sections))for(const name of names)await db.collection('menu').updateOne({name},{$setOnInsert:{name,category,available:true,active:true,createdAt:new Date()}},{upsert:true});
console.log('Owner account created:',email,'with role owner. No password printed or saved.');
console.log('Menu item names seeded from the provided Cassia menu PDF.');
console.log('IMPORTANT: remove OWNER_BOOTSTRAP_PASSWORD and OWNER_BOOTSTRAP_EMAIL from environment now, and change owner password before inviting staff.');
process.exit(0);
