import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {can,roles} from '../lib/core.js';
import {recordIncident} from '../lib/diagnostics.js';
const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('DeV_Swastik role is diagnostics-only and never gains waiter or owner actions',()=>{
 assert.ok(roles.includes('developer'));
 assert.equal(can('owner','diagnostics.snapshot'),true);
 assert.equal(can('developer','diagnostics.snapshot'),true);
 assert.equal(can('waiter','diagnostics.snapshot'),false);
 for(const action of ['users.list','users.create','users.set_password','users.reset_password','orders.create','orders.list','attendance.mark','customers.list','reports.summary','audit.list'])
  assert.equal(can('developer',action),false,action);
});
test('developer dashboard only loaded for authorized roles',()=>{
 assert.ok(app.includes("['dev','DeV_Swastik',['owner','developer']]"));
 assert.ok(app.includes("dev:['diagnostics.snapshot']"));
 assert.ok(html.includes('src="/dev-ui.js"'));
 assert.ok(app.includes("page=user.role==='developer'?'dev':'overview'"));
});
test('secure recovery never returns the code or automatically upgrades waiter role',()=>{
 assert.ok(api.includes("if(action==='auth.recovery_start')"));
 assert.ok(api.includes("if(action==='auth.recovery_finish')"));
 assert.ok(api.includes("if(action==='auth.recovery_token')"));
 assert.ok(api.includes("OWNER_RECOVERY_TOKEN"));
 assert.ok(api.includes('recovery_used_tokens'));
 const recovery=api.slice(api.indexOf("if(action==='auth.recovery_start')"),api.indexOf("if(action==='tables.request')"));
 assert.ok(!recovery.includes('demoCode'));
 assert.ok(recovery.includes("role:'owner'"));
});
test('logout restores email and password form after OTP sign-in',()=>{
 assert.ok(app.includes("function showSignIn()"));
 assert.ok(app.includes("$('#loginForm')?.classList.remove('hidden')"));
 assert.ok(app.includes("showSignIn()"));
 assert.ok(html.includes('id="forgotOwnerPassword"'));
});
test('incident logger records no secret or body',async()=>{
 const docs=[];
 const db={collection(name){assert.equal(name,'api_incidents');return {insertOne:async x=>{docs.push(x)}}}};
 await recordIncident(db,'auth.start',401);
 assert.equal(docs[0].category,'authentication');
 assert.equal(docs[0].reason,'sign_in');
 assert.ok(!('password' in docs[0]));
 assert.ok(!('email' in docs[0]));
});
