import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {can} from '../lib/core.js';
import {hospitalityAction} from '../lib/hospitality.js';
const ui=readFileSync(new URL('../public/hospitality-ui.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('reception cannot physically claim or complete a waiter call',()=>{
 for(const action of ['calls.claim','calls.done']) {
   assert.equal(can('reception',action),false);
   assert.equal(can('waiter',action),true);
   assert.equal(can('manager',action),false);
 }
 assert.equal(can('manager','calls.assign'),true);
 assert.equal(can('reception','calls.assign'),false);
});
test('banquet booking role boundaries',()=>{
 for(const role of ['owner','manager','reception']) {
  assert.equal(can(role,'banquet.list'),true);
  assert.equal(can(role,'banquet.create'),true);
 }
 for(const role of ['chef','waiter']) {
  assert.equal(can(role,'banquet.create'),false);
  assert.equal(can(role,'banquet.update'),false);
 }
});
test('banquet slot availability is computed from reservations',async()=>{
 const db={collection(name){assert.equal(name,'banquet_bookings');return{find(){return{toArray:async()=>[{slot:'18:00–23:00',status:'pending'}]}}}}};
 const r=await hospitalityAction('banquet.slots',{db,user:{role:'reception'},body:{date:'2026-11-09'}});
 assert.equal(r.data.slots.length,3);
 assert.equal(r.data.slots.find(s=>s.slot==='18:00–23:00').available,false);
 assert.equal(r.data.slots.find(s=>s.slot==='10:00–14:00').available,true);
 assert.equal(r.data.fee,1000);
});
test('conflicting banquet slot is rejected rather than double-booked',async()=>{
 const db={collection(){return{insertOne:async()=>{const e=new Error('duplicate');e.code=11000;throw e}}}};
 await assert.rejects(hospitalityAction('banquet.create',{db,user:{email:'reception@example.com',role:'reception'},body:{name:'Test Guest',phone:'9795699430',date:'2099-12-12',slot:'10:00–14:00',reason:'anniversary',decoration:true,agreedToContact:true}}),/already reserved/);
});
test('unverified guest returns no private coupon data',async()=>{
 const db={collection(name){assert.equal(name,'customers');return{findOne:async()=>null}}};
 const r=await hospitalityAction('customers.insights',{db,user:{role:'waiter'},body:{phone:'9795699430'}});
 assert.deepEqual(r.data.repeatOrders,[]);assert.deepEqual(r.data.coupons,[]);
});
test('mobile and guest navigation are integrated',()=>{
 assert.match(app,/nav-more/);
 assert.match(app,/mobileMore/);
 assert.match(app,/tables\.status/);
 assert.match(app,/customers\.insights/);
 assert.match(html,/hospitality-ui\.js/);
 assert.match(html,/guestCheckStatus/);
 assert.match(ui,/Hold available slot/);
});
