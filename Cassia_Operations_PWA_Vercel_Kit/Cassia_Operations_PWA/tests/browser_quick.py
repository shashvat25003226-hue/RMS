import base64, time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'public/index.html').read_text().replace('<link rel="stylesheet" href="/style.css">','<style>'+(root/'public/style.css').read_text()+'</style>').replace('<script defer src="/app.js"></script>','').replace('<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">','')
for name in ('official-cassia-crest.webp','dining.webp','banquet.webp'):
 blob=base64.b64encode((root/'public/assets'/name).read_bytes()).decode();uri='data:image/webp;base64,'+blob
 html=html.replace('/assets/'+name,uri)
js=(root/'public/app.js').read_text().replace("const preview=new URLSearchParams(location.search).get('preview')==='1'","const preview=true")
html=html.replace('</body>','<script>'+js+'</script></body>')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 print('start',flush=True)
 page.set_content(html,wait_until='domcontentloaded',timeout=15000)
 print('content inserted',flush=True)
 page.wait_for_selector('#main .page-head',timeout=10000)
 print('heading',page.locator('.page-head h1').inner_text(),flush=True)
 page.locator('#previewRole').select_option('waiter')
 print('role changed',flush=True)
 page.locator('#mobileTabs [data-page="orders"]').click()
 print('page switched',flush=True)
 page.locator('button[data-new="order"]').click()
 print('dialog opened',flush=True)
 page.locator('#createOrder button.primary').click()
 print('order sent',page.locator('#dialogTitle').inner_text(),flush=True)
 page.locator('#doneDialog').click()
 page.locator('#previewRole').select_option('chef')
 page.locator('#mobileTabs [data-page="kitchen"]').click()
 print('chef',page.locator('.page-head h1').inner_text(),flush=True)
 print('overflow',page.evaluate('document.documentElement.scrollWidth>innerWidth'),'errors',errors,flush=True)
 page.screenshot(path=str(root/'mobile_kitchen.png'),full_page=False,animations='disabled',timeout=12000)
 print('screenshot saved',flush=True)
 b.close()
