import test from 'node:test';
import assert from 'node:assert/strict';
import {ObjectId} from 'mongodb';
import {customerPortal} from '../lib/customer-portal.js';
import {sha,can} from '../lib/core.js';
const base={req:{headers:{cookie:'', 'x-forwarded-for':'127.0.0.1'}},res:{setHeader(){return this}},rateLimit:async()=>{},publish:async()=>{},audit:async()=>{},staff:null};
const future='2099-03-10';
test('new guest dine-in booking is free, pending and usable with tracking token',async()=>{
 const stored=[];const db={collection(name){
  if(name==='dine_bookings')return {insertOne:async row=>{stored.push({...row,_id:new ObjectId()});return {insertedId:stored[0]._id}},findOne:async filter=>stored.find(b=>b.trackHash===filter.trackHash)};
  throw Error('Unexpected collection: '+name);
 }};
 const payload={action:'public.book',type:'dine',name:'Test Booking',phone:'9795699430',date:future,slot:'19:30',guests:4,consent:true,decoration:true};
 const created=await customerPortal('public.book',{...base,db,body:payload});
 assert.equal(created.status,201);
 assert.equal(created.data.booking.status,'pending');
 assert.equal(created.data.booking.decorationFee,0);
 assert.match(created.data.whatsappUrl,/wa.me\/918881113210/);
 assert.ok(created.data.trackingToken);
 const checked=await customerPortal('public.track',{...base,db,body:{type:'dine',token:created.data.trackingToken}});
 assert.equal(checked.data.booking.status,'pending');
 assert.equal(checked.data.booking.date,future);
 assert.equal(checked.data.booking.name,undefined);
});
test('banquet decoration fee is exactly Rs 1,000, without collecting payment',async()=>{
 let saved;const db={collection(name){assert.equal(name,'banquet_bookings');return {insertOne:async row=>{saved=row;return {insertedId:new ObjectId()}}}}};
 const res=await customerPortal('public.book',{...base,db,body:{type:'banquet',name:'Test Event',phone:'9795699430',date:future,slot:'18:00–23:00',reason:'birthday',decoration:true,consent:true}});
 assert.equal(res.status,201);
 assert.equal(res.data.booking.decorationFee,1000);
 assert.equal(saved.status,'pending');
 assert.equal(saved.decorationFee,1000);
 assert.equal(saved.source,'website');
});
test('slot availability respects existing pending banquet booking',async()=>{
 const db={collection(name){assert.equal(name,'banquet_bookings');return {find(){return {toArray:async()=>[{slot:'14:00–18:00',status:'pending'}]}}}}};
 const res=await customerPortal('public.slots',{...base,db,body:{date:future}});
 assert.equal(res.data.slots.filter(x=>x.available===false).length,1);
 assert.equal(res.data.slots.find(x=>x.slot==='14:00–18:00').available,false);
});
test('only reception, manager or owner can approve guest reservations',async()=>{
 for(const role of ['waiter','chef','developer']){
  await assert.rejects(customerPortal('reservations.list',{...base,staff:{role,email:'x@example.com'},db:{},body:{}}),e=>e.status===403);
  assert.equal(can(role,'reservations.list'),false);
 }
 for(const role of ['owner','manager','reception'])assert.equal(can(role,'reservations.list'),true);
});
test('customer signup never grants staff access',()=>{
 for(const role of ['owner','manager','reception','chef','waiter','developer'])assert.notEqual(role,'customer');
 assert.equal(can('customer','users.create'),false);
 assert.equal(can('customer','reports.summary'),false);
});
test('invalid phone, consent, date and banquet slots are rejected',async()=>{
 const db={};
 for(const data of [
 {type:'dine',phone:'123',consent:true,date:future,slot:'19:00',guests:2},
 {type:'dine',phone:'9795699430',consent:false,date:future,slot:'19:00',guests:2},
 {type:'banquet',phone:'9795699430',consent:true,date:future,slot:'01:00'},
 {type:'dine',phone:'9795699430',consent:true,date:'2020-01-01',slot:'19:00',guests:2},
 ])await assert.rejects(customerPortal('public.book',{...base,db,body:{name:'Test Guest',...data}}),e=>e.status===400);
});
