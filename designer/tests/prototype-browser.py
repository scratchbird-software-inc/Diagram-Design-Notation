import os,shutil
from pathlib import Path
import json,subprocess,time,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];checks=[];errors=[];mode='';version=''
def ck(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details})
 if not ok:raise AssertionError(name+': '+str(details))
server=subprocess.Popen(['python','-m','http.server','8781','--bind','127.0.0.1','--directory',str(R)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium') or p.chromium.executable_path),headless=True,args=['--no-sandbox'] if os.environ.get('DDN_TEST_NO_SANDBOX')=='1' else []);version=browser.version
  page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=1,accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto('http://127.0.0.1:8781/prototype/index.html',wait_until='load',timeout=12000);page.wait_for_function('!!window.DesignerPrototype',timeout=5000);mode='http'
  except Exception as e:
   reason=str(e);page.close();page=browser.new_page(viewport={'width':1500,'height':1000},device_scale_factor=1,accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content((R/'prototype/index.html').read_text(),wait_until='load',timeout=45000);page.wait_for_function('!!window.DesignerPrototype',timeout=15000);mode='injected after blocked normal HTTP: '+reason
  def shot(name):
   page.evaluate('document.querySelector("#toast").classList.remove("show")')
   page.screenshot(path=str(R/'design'/name),full_page=True)
  original=page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')
  ck('Unchanged patched runtime loaded',page.evaluate('DDNLive.VERSION')=='0.5.0-draft.2')
  ck('Four source-driven objects render',page.locator('#paper .ddn-node').count()==4)
  shot('01-main.png')
  page.fill('#paletteSearch','table');ck('Palette search hides nonmatching starters',page.locator('[data-add]:visible').count()==1);page.fill('#paletteSearch','')
  page.fill('#nameEdit','Customer registry');page.click('#applyName')
  ck('Label button mutates actual source', '"Customer registry"' in page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]'))
  page.click('[data-view="names"]');ck('Second view reuses changed definition','Customer registry' in page.locator('#paper').inner_text())
  page.click('#undo');ck('Undo restores exact source',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.click('[data-view="overview"]');page.fill('#newField','external_ref');page.click('#addField')
  ck('Adds untyped field',page.evaluate('DesignerPrototype.workspace.resolve("model.ddn","overview").elements.find(n=>n.local==="customer").fields.length')==4)
  page.click('#undo');ck('Field undo exact',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.click('[data-add="record"]');ck('Palette click creates actual object',page.locator('#paper .ddn-node').count()==5)
  ck('Automatic palette creation does not pin', 'place @editor_data' not in page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]'))
  page.click('#undo');ck('Creation undo is one exact transaction',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  # Explicit HTML drag-drop to vacant space at reduced zoom.
  page.click('#zoomOut');page.click('#zoomOut')
  page.locator('[data-add="note"]').drag_to(page.locator('#viewport'),target_position={'x':780,'y':500})
  ck('Palette drag adds and pins in source', 'place @editor_data' in page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]'),page.locator('#status').inner_text())
  page.click('#undo');ck('Create-and-pin is one undo',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.click('#fitBtn')
  # Actual pointer motion of the existing node header.
  title=page.locator('#paper .ddn-node').filter(has_text='Customer').locator('text').filter(has_text='Customer').first
  b=title.bounding_box();page.mouse.move(b['x']+20,b['y']+8);page.mouse.down();page.mouse.move(b['x']+55,b['y']+35,steps=6);page.mouse.up()
  ck('Pointer drag writes selected view pin','place @model.customer' in page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]'))
  page.click('#undo');ck('Move undo exact',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.evaluate('DesignerPrototype.select("designer.sample::model.orders.customer_id")')
  shot('02-field.png')
  page.click('#connectSelected');shot('03-connection.png')
  page.select_option('#connectFrom','designer.sample::model.invoice.id');page.select_option('#connectTo','designer.sample::model.customer.id');page.fill('#relationLabel','Review link')
  page.get_by_role('button',name='Create relationship',exact=True).click()
  ck('Connection sheet commits semantic endpoints',page.evaluate('DesignerPrototype.workspace.resolve("model.ddn","overview").relations.some(r=>r.name==="Review link"&&r.from.member==="designer.sample::model.invoice.id"&&r.to.member==="designer.sample::model.customer.id")'),page.locator('#status').inner_text())
  page.click('#undo');ck('Relation undo exact',page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.evaluate('DesignerPrototype.select("designer.sample::model.customer")');page.click('[data-tab="view"]');page.select_option('#lookSetting','handDrawn');page.select_option('#themeSetting','night');page.select_option('#routeSetting','curved')
  ck('Appearance changes real rendering, not source',page.evaluate('DesignerPrototype.getState().result.profiles.style.look')=='handDrawn' and page.evaluate('DesignerPrototype.workspace.getFiles()["model.ddn"]')==original)
  page.click('#fitBtn');shot('04-night-view.png')
  page.click('#resetStyle');page.click('#arrangeBtn');page.select_option('#layoutPick','circular');shot('05-layout.png');page.get_by_role('button',name='Apply to this preview').click()
  ck('Layout dialog calls live renderer',page.evaluate('DesignerPrototype.getState().overrides.placement')=='circular' and 'LIVE' not in page.locator('#status').inner_text())
  # Avoid preview overlay when next returning structural view.
  page.click('[data-tab="view"]');page.click('#resetStyle')
  page.click('[data-view="raci"]');page.click('[data-tab="meaning"]')
  ck('Matrix projection renders with graph gestures disabled',page.evaluate('DesignerPrototype.getState().result.scene.projection.kind')=='matrix' and page.locator('#connectTool').is_disabled())
  shot('06-matrix.png')
  page.click('[data-view="chart_bar"]');shot('07-chart.png');page.click('[data-tab="view"]');page.select_option('#markSetting','donut')
  ck('Chart control changes real quantitative projection',page.evaluate('DesignerPrototype.getState().overrides.mark')=='donut' and page.locator('#connectTool').is_disabled())
  page.click('[data-view="overview"]');page.click('[data-tab="meaning"]');page.click('#convertBtn');before=page.evaluate('DesignerPrototype.workspace.revision');shot('08-conversion.png');ck('Future workflow explicitly labeled', 'NOT EXECUTED' in page.locator('#dialogTag').inner_text());page.click('#dialogClose');ck('Review modal changes no source',page.evaluate('DesignerPrototype.workspace.revision')==before)
  page.select_option('#reviewScreen','draft');shot('09-draft.png');page.click('#dialogClose')
  page.click('#sourceBtn');ck('Source drawer shows authoritative source',page.locator('#sourceText').inner_text()==original);shot('10-source.png');page.click('#closeSource')
  page.click('#exportBtn');shot('11-download.png')
  with page.expect_download() as info: page.get_by_role('button',name='Current DDN',exact=True).click()
  d=info.value;path=R/'tests/downloaded-model.ddn';d.save_as(path);ck('DDN download matches source exactly',path.read_text()==original)
  with page.expect_download() as info: page.get_by_role('button',name='Workspace ZIP',exact=True).click()
  path=R/'tests/downloaded-workspace.zip';info.value.save_as(path);import zipfile
  with zipfile.ZipFile(path) as z:ck('Workspace ZIP download is intact',z.testzip() is None and any(n.endswith('.ddn') for n in z.namelist()),z.namelist())
  with page.expect_download() as info: page.get_by_role('button',name='Current SVG',exact=True).click()
  path=R/'tests/downloaded-diagram.svg';info.value.save_as(path);ck('SVG download is generated vector',__import__('xml.etree.ElementTree',fromlist=['fromstring']).fromstring(path.read_text()).tag == '{http://www.w3.org/2000/svg}svg')
  page.click('#dialogClose');page.click('[data-left="model"]');page.locator('[data-select="designer.sample::model.invoice"]').focus();page.keyboard.press('Enter');ck('Model list keyboard selection',page.evaluate('DesignerPrototype.getState().selected')=='designer.sample::model.invoice')
  # Deliberately test invalid field identifiers without corrupting existing source.
  page.fill('#newField','not valid');before=page.evaluate('DesignerPrototype.workspace.revision');page.click('#addField');ck('Invalid edit rejected without mutation',page.evaluate('DesignerPrototype.workspace.revision')==before and 'DDN-E001' in page.locator('#status').inner_text())
  ck('No uncaught browser errors',not errors,errors)
  page.set_viewport_size({'width':1180,'height':900});shot('12-compact-width.png')
  ck('1180px page has no horizontal document overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
  browser.close()
except Exception as e:
 checks.append({'name':'Harness execution','pass':False,'details':str(e),'trace':traceback.format_exc()});print(traceback.format_exc())
finally:
 server.terminate();out={'status':'Bounded prototype checks; production acceptance plan is separate','browser':version,'navigation':mode,'passed':sum(c['pass'] for c in checks),'total':len(checks),'checks':checks,'uncaughtErrors':errors};(R/'tests/prototype-browser-report.json').write_text(json.dumps(out,indent=2));print(out['passed'],out['total'])
