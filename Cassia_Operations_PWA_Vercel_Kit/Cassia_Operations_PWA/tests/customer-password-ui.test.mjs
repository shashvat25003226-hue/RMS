import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const site = readFileSync(new URL('../public/site.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/site.css', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../lib/customer-portal.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('customer login has an accessible working password visibility control',()=>{
 assert.match(site,/function secretField\(/);
 assert.match(site,/data-password-toggle/);
 assert.match(site,/aria-pressed/);
 assert.match(site,/input\.type=revealing\?'text':'password'/);
 assert.match(site,/wirePasswordToggles\(root\)/);
 assert.match(site,/autocomplete="\'+autocomplete/);
});
test('customer PIN enrollment and updates use matching server-side policy',()=>{
 assert.match(portal,/validCustomerSecret=p=>/);
 assert.match(portal,/\^\\d\{6\}\$/);
 assert.match(portal,/validCustomerSecret\(pass\)/);
 assert.match(portal,/validCustomerSecret\(String\(body\.newPassword\)\)/);
 assert.match(portal,/await limit\('login:'\+email,5\)/);
 assert.match(site,/Create a 6-digit PIN or strong password/);
});
test('autofill text is legible and password button does not cover typed text',()=>{
 assert.match(css,/-webkit-text-fill-color:#182921!important/);
 assert.match(css,/padding-right:82px/);
 assert.match(css,/\.password-toggle:focus-visible/);
});
test('venue photographs and separate staff route stay available',()=>{
 assert.match(html,/venue-candlelit\.jpg/);
 assert.match(html,/venue-anniversary-hall\.jpg/);
 assert.match(html,/href="\/staff"/);
 assert.match(html,/id="bookingForm"/);
});
