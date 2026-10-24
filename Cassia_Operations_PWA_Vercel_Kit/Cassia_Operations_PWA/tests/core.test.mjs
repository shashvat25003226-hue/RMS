import test from 'node:test';import assert from 'node:assert/strict';
import {can,advance,passwordHash,passwordVerify,sha,publicOrder} from '../lib/core.js';
test('role gates prevent waiter owner access',()=>{assert.equal(can('waiter','users.create'),false);assert.equal(can('waiter','orders.create'),true);assert.equal(can('chef','orders.ack'),true);assert.equal(can('reception','orders.ack'),false)});
test('kitchen only advances in order',()=>{assert.equal(advance('sent','received'),true);assert.equal(advance('sent','ready'),false);assert.equal(advance('ready','served'),true)});
test('password scrypt verification',async()=>{const hash=await passwordHash('a very private pass');assert.equal(await passwordVerify('a very private pass',hash),true);assert.equal(await passwordVerify('wrong',hash),false);assert.equal(hash.includes('a very private pass'),false)});
test('private tracking data excluded',()=>{const v=publicOrder({orderId:'C-1',table:5,status:'received',items:[{name:'Dosa',qty:1,note:'special'}],updatedAt:new Date(),guestPhone:'9999999999'});assert.equal(v.guestPhone,undefined);assert.equal(v.items[0].note,undefined)})
