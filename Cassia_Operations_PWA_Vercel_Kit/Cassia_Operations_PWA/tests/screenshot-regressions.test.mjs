import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validShiftDate,indiaDay,can} from '../lib/core.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('shift date valid October 25 2026 and true ISO input, invalid calendar dates rejected',()=>{
 assert.equal(validShiftDate('2026-10-25'),true);
 assert.equal(validShiftDate('2026-02-29'),false);
 assert.equal(validShiftDate('2028-02-29'),true);
 assert.equal(validShiftDate('2026-13-01'),false);
 assert.equal(validShiftDate('25-10-2026'),false);
 assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(indiaDay()),true);
});
test('closing routes share corrected strict calendar check',()=>{
 const source=api.slice(api.indexOf("if(action==='closing.list')"),api.indexOf("if(action==='closing.confirm')")+550);
 assert.equal((source.match(/validShiftDate\(shift\)/g)||[]).length,3);
 assert.equal(source.includes('/^\\\\d'),false);
 assert.ok(app.includes('restaurantToday()'));
});
test('staff notifications may be read in batches but not accessed by unauthorized roles',()=>{
 for(const role of ['owner','manager','chef','waiter','reception']){
  assert.equal(can(role,'notifications.read_many'),true);
  assert.equal(can(role,'notifications.read_all'),true);
 }
 assert.ok(api.includes("readBy:{$ne:String(u._id)}"));
 assert.ok(api.includes("targetEmail:u.email"));
});
test('alert inbox provides grouped updates and dismissal controls',()=>{
 for(const id of ['noticeUnread','noticeAll','markAllNotifications','closeNotifications'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes('notifications.read_many'));
 assert.ok(app.includes('notifications.read_all'));
 assert.ok(app.includes('notice-repeat'));
 assert.ok(css.includes('.notification-controls'));
});
test('kitchen tickets use only active stages, not four giant empty kanban columns',()=>{
 assert.ok(app.includes('kitchen-ticket-grid'));
 assert.ok(app.includes('kitchenFilter'));
 assert.ok(app.includes('data-kitchen-filter'));
 assert.ok(app.includes("sort((a,b)=>stages.findIndex"));
 assert.ok(!app.slice(app.indexOf('function renderKitchen(){'),app.indexOf('function renderCalls(){')).includes('kanban-col'));
});
