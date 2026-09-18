import os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1];checks=[]
def ck(name,x):
 checks.append({'name':name,'pass':bool(x)})
 if not x:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or p.chromium.executable_path),headless=True,args=['--no-sandbox'] if os.environ.get('DDN_TEST_NO_SANDBOX')=='1' else []);page=browser.new_page(viewport={'width':1450,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'index.html').read_text(),wait_until='load');page.screenshot(path=str(R/'design/review-site.png'),full_page=False)
 ck('20 complete chapters in site',page.locator('section[id^="chapter-"]').count()==20)
 ck('188 exact kind rows',page.locator('#kindTable tbody tr').count()==188)
 page.fill('#kindSearch','uml.');ck('Semantic kind search filters rows',page.locator('#kindTable tbody tr:visible').count()>0 and page.locator('#kindTable tbody tr:visible').count()<20)
 page.fill('#kindSearch','');page.select_option('#kindGroup','Data');ck('Group filter functional',page.locator('#kindTable tbody tr:visible').count()>20 and page.locator('#kindTable tbody tr:visible').count()<188)
 page.select_option('#kindGroup','');ck('Clear filters restores full index',page.locator('#kindTable tbody tr:visible').count()==188)
 page.locator('[data-zoom]').first.click();ck('Interface design enlarges',page.locator('#screenDialog').is_visible());page.locator('#screenDialog button').click()
 page.fill('#chapterSearch','validation');ck('Chapter search functional',page.locator('aside nav a:visible').count()>0 and page.locator('aside nav a:visible').count()<8)
 ck('No uncaught site errors',not errors)
 report={'status':'Read-only review website tests','browser':browser.version,'navigation':'Self-contained injected content; normal navigation limitation recorded by prototype suite','passed':sum(c['pass'] for c in checks),'total':len(checks),'checks':checks,'errors':errors};(R/'tests/review-site-browser-report.json').write_text(json.dumps(report,indent=2));browser.close();print(report['passed'],report['total'])
