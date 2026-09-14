const {chromium}=require('C:/Users/psamo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await p.addInitScript(()=>localStorage.setItem('farm-workshop-v1',JSON.stringify({targets:{'837':90000},secondary:['118','83','82','896','74','81','73','895','248','165','500','252','1442','125','146','217','787'].map(item_id=>({item_id,allow_exploration:['118','83','896'].includes(item_id),cap:null})),resource_saver:45,iron_depot:true,runecube:true})));
const result=fs.readFileSync('../../work/lantern-90001-result.json','utf8');await p.route('**/python-worker.js',r=>r.fulfill({contentType:'text/javascript',body:'onmessage=()=>postMessage({status:"complete",result:'+result+'});'}));
await p.goto('http://127.0.0.1:8765/#explore');await p.locator('#resultContent').waitFor({state:'visible'});
const assert=require('node:assert/strict');
await p.locator('#craftworksDisclosure').evaluate(e=>e.open=true);
await p.locator('#craftworksSlots').fill('3');await p.locator('#craftworksSlots').dispatchEvent('change');
assert.ok(await p.locator('.routegroup').count()>0);
assert.equal(await p.locator('.routegroup .routecard').count(),await p.locator('.routecard').count());
const sequence=await p.locator('#craftworksSetup summary').allTextContents();assert.ok(sequence[0].startsWith('Keep active: Forest'));assert.ok(sequence[1].startsWith('After Forest'));assert.ok(sequence[2].startsWith('Keep active: Small Cave'));
await p.locator('#craftworksSlots').fill('20');await p.locator('#craftworksSlots').dispatchEvent('change');
assert.ok(await p.locator('.routegroup').evaluateAll(gs=>gs.some(g=>g.querySelectorAll('.routecard').length>1)));
for(const width of [390,1280]){
 await p.setViewportSize({width,height:900});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.locator('#routePanel').scrollIntoViewIfNeeded();
 await p.screenshot({path:'../../work/route-groups-'+width+'.png'});
}
await p.locator('#suggestAll').click();assert.equal(await p.locator('[data-suggestion="837"]').count(),0);
await p.locator('#closeSuggestions').click();
await p.locator('.routegroupbadge').first().click();assert.equal(await p.locator('#craft-stop-group-0').evaluate(e=>e.open),true);
console.log('PASS outlined groups, mobile overflow, primary exclusion and setup links');
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
