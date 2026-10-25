import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {can,roles} from '../lib/core.js';
import {operationalAction} from '../lib/ops.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const extra=readFileSync(new URL('../public/ops-ui.js',import.meta.url),'utf8');

test('imports require a role and verification is not granted to reception',()=>{
 for(const role of ['owner','manager','reception'])assert.equal(can(role,'imports.commit'),true);
 for(const role of ['chef','waiter'])assert.equal(can(role,'imports.commit'),false);
 assert.equal(can('reception','imports.verify'),false);
 assert.equal(can('owner','imports.verify'),true);
});

test('CSV import preview validates proper Petpooja and Attendo rows',async()=>{
 const ctx=(source,rows)=>({db:null,user:{role:'owner'},body:{source,rows}});
 const pet=await operationalAction('imports.preview',ctx('petpooja',[{bill_number:'P-18',date:'2026-10-25',amount:'150.00'}]));
 assert.equal(pet.data.valid,1);assert.equal(pet.data.invalid,0);
 const att=await operationalAction('imports.preview',ctx('attendo',[{email:'employee@example.com',date:'2026-10-25',status:'present'}]));
 assert.equal(att.data.valid,1);
 const invalid=await operationalAction('imports.preview',ctx('attendo',[{email:'invalid-email',date:'2026-10-25',status:'unknown'}]));
 assert.equal(invalid.data.invalid,1);
});

test('staff cannot mark attendance or issue monthly awards',()=>{
 for(const role of roles.filter(x=>x!=='owner')){
  assert.equal(can(role,'attendance.mark'),false);
  assert.equal(can(role,'performance.reward'),false);
 }
 for(const role of roles)assert.equal(can(role,'attendance.list'),true);
});
test('chef and waiter have recipe visibility but cannot change prices',()=>{
 for(const role of roles)assert.equal(can(role,'inventory.readiness'),true);
 for(const role of roles.filter(x=>x!=='owner'))assert.equal(can(role,'menu.price'),false);
});
test('new UI routes and print menu are available',()=>{
 for(const name of ['renderImports','renderAttendance','renderPerformance','renderMenu'])assert.ok(extra.includes('function '+name));
 assert.ok(extra.includes('window.print()'));
 assert.ok(app.includes("'attendance.summary'"));
 assert.ok(app.includes("'inventory.readiness'"));
});
