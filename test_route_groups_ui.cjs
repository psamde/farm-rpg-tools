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
for(const width of [320,390,768,1280]){
 await p.setViewportSize({width,height:900});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(width<=800){
 assert.ok(await p.locator('#routeCards').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 assert.equal(await p.locator('.draghandle').first().isVisible(),false);
 const cards=await p.locator('.routecard').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
 assert.ok(cards[1].y>=cards[0].bottom);
 }else assert.equal(await p.locator('#routeCards').evaluate(e=>getComputedStyle(e).flexDirection),'row');
 await p.locator('#routeCards').scrollIntoViewIfNeeded();
 await p.screenshot({path:'../../work/route-groups-'+width+'.png'});
}
await p.setViewportSize({width:390,height:900});
const secondId=await p.locator('.secondaryrow').nth(1).getAttribute('data-leftover-id');
await p.getByRole('button',{name:'Lower priority of Leather Diary',exact:true}).click();
assert.equal(await p.locator('.secondaryrow').first().getAttribute('data-leftover-id'),secondId);
await p.locator('#suggestAll').click();assert.equal(await p.locator('[data-suggestion="837"]').count(),0);
await p.locator('#closeSuggestions').click();
await p.locator('.routegroupbadge').first().click();assert.equal(await p.locator('#craft-stop-group-0').evaluate(e=>e.open),true);
console.log('PASS outlined groups, mobile overflow, primary exclusion and setup links');
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
