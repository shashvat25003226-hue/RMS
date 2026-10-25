import test from 'node:test';
import assert from 'node:assert/strict';
import {can,roles,passwordHash,passwordVerify} from '../lib/core.js';
const ownerOps=['users.create','users.update','users.reset_password'];
test('owner can manage team accounts',()=>{for(const action of ownerOps)assert.equal(can('owner',action),true,action)});
test('non-owner roles cannot manage staff accounts',()=>{for(const role of roles.filter(x=>x!=='owner'))for(const action of ownerOps)assert.equal(can(role,action),false,role+' '+action)});
test('manager may see staff directory without changing staff roles',()=>{assert.equal(can('manager','users.list'),true);assert.equal(can('manager','users.update'),false)});
test('different passwords produce distinct strong hashes',async()=>{const a=await passwordHash('OneLongTemporaryPassword#2026');const b=await passwordHash('AnotherLongTemporaryPassword#2026');assert.notEqual(a,b);assert.equal(await passwordVerify('OneLongTemporaryPassword#2026',a),true);assert.equal(await passwordVerify('not-the-password',a),false)});

test('customer profiles are accessible to service and reception, never chef',()=>{
 for(const role of ['owner','manager','waiter','reception'])assert.equal(can(role,'customers.list'),true);
 assert.equal(can('chef','customers.list'),false);
});
test('VIP labels and coupon issuance require owner or manager',()=>{
 for(const action of ['customers.vip','coupons.issue']){
   assert.equal(can('owner',action),true);assert.equal(can('manager',action),true);
   for(const role of ['chef','waiter','reception'])assert.equal(can(role,action),false);
 }
});
test('coupon redemption requires reception or management, not waiter or chef',()=>{
 for(const role of ['owner','manager','reception'])assert.equal(can(role,'coupons.redeem'),true);
 for(const role of ['waiter','chef'])assert.equal(can(role,'coupons.redeem'),false);
});
test('notifications are role checked and all staff may read own alerts',()=>{
 for(const role of roles)for(const action of ['notifications.list','notifications.read'])assert.equal(can(role,action),true);
});
test('only owner can explicitly set employee password',()=>{
 assert.equal(can('owner','users.set_password'),true);
 for(const role of roles.filter(x=>x!=='owner'))assert.equal(can(role,'users.set_password'),false);
});
