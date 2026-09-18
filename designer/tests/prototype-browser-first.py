import os,shutil
from pathlib import Path
import json,subprocess,time
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['python','-m','http.server','8781','--bind','127.0.0.1','--directory',str(R)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or p.chromium.executable_path),headless=True,args=['--no-sandbox'] if os.environ.get('DDN_TEST_NO_SANDBOX')=='1' else [])
  page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto('http://127.0.0.1:8781/prototype/index.html',wait_until='load',timeout=12000)
   page.wait_for_function('!!window.DesignerPrototype',timeout=5000)
   mode='http'
  except Exception as e:
   reason=str(e);page.close();page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content((R/'prototype/index.html').read_text(),wait_until='load',timeout=45000)
   page.wait_for_function('!!window.DesignerPrototype',timeout=15000);mode='injected after blocked/unavailable navigation: '+reason
  page.screenshot(path=str(R/'design/01-main.png'),full_page=True)
  print(mode);print(errors)
  print(page.locator('#status').text_content())
  (R/'tests/browser-first.json').write_text(json.dumps({'version':browser.version,'navigation':mode,'errors':errors},indent=2))
  browser.close()
finally:server.terminate()
