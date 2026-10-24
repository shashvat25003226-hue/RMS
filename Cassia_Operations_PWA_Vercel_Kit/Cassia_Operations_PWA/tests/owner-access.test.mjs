import test from 'node:test';
import assert from 'node:assert/strict';
import {can,roles,passwordHash,passwordVerify} from '../lib/core.js';
const ownerOps=['users.create','users.update','users.reset_password'];
test('owner can manage team accounts',()=>{for(const action of ownerOps)assert.equal(can('owner',action),true,action)});
test('non-owner roles cannot manage staff accounts',()=>{for(const role of roles.filter(x=>x!=='owner'))for(const action of ownerOps)assert.equal(can(role,action),false,role+' '+action)});
test('manager may see staff directory without changing staff roles',()=>{assert.equal(can('manager','users.list'),true);assert.equal(can('manager','users.update'),false)});
test('different passwords produce distinct strong hashes',async()=>{const a=await passwordHash('OneLongTemporaryPassword#2026');const b=await passwordHash('AnotherLongTemporaryPassword#2026');assert.notEqual(a,b);assert.equal(await passwordVerify('OneLongTemporaryPassword#2026',a),true);assert.equal(await passwordVerify('not-the-password',a),false)});
