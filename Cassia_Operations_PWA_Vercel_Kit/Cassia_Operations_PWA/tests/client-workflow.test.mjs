import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {can,roles} from '../lib/core.js';
const frontend=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
test('UI does not call array forEach on querySelector single element',()=>{
 const bad=/(?<!\$)\$\((['"][^'"]+['"])\)\.forEach/g;
 assert.deepEqual([...frontend.matchAll(bad)].map(x=>x[0]),[]);
});
test('owner can set staff password and staff never can',()=>{
 assert.equal(can('owner','users.set_password'),true);
 for(const role of roles.filter(r=>r!=='owner'))assert.equal(can(role,'users.set_password'),false);
 assert.ok(frontend.includes('data-user-password'));
});
test('chef can see available assignees and toggle stock-out status',()=>{
 assert.equal(can('chef','users.assignable'),true);
 assert.equal(can('chef','menu.update'),true);
 assert.equal(can('chef','users.list'),false);
 assert.ok(api.includes("if(u.role==='chef')"));
});
test('closing is assigned by managers, not self-appointed',()=>{
 for(const role of ['owner','manager'])assert.equal(can(role,'closing.assign'),true);
 for(const role of ['waiter','chef','reception'])assert.equal(can(role,'closing.assign'),false);
 assert.ok(api.includes("assignedTo:u.email,status:'assigned'"));
 assert.ok(frontend.includes('closingAssignForm'));
});
test('waiter order form can collect optional guest name and mobile',()=>{
 assert.ok(frontend.includes('customerName'));
 assert.ok(frontend.includes('customerPhone'));
 assert.ok(api.includes('customerPhone'));
});
test('reporting still declares separate source of truth for billing',()=>{
 assert.ok(frontend.includes('Petpooja'));
 assert.equal(can('waiter','reports.summary'),false);
});
