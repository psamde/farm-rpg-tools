const {chromium}=require('C:/Users/psamo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await p.addInitScript(()=>localStorage.setItem('farm-workshop-v1',JSON.stringify({targets:{'837':90000},secondary:['118','83','82','896','74','81','73','895','248','165','500','252','1442','125','146','217','787'].map(item_id=>({item_id,allow_exploration:['118','83','896'].includes(item_id),cap:null})),resource_saver:45,iron_depot:true,runecube:true})));
const result=fs.readFileSync('../../work/lantern-90001-result.json','utf8');await p.route('**/python-worker.js',r=>r.fulfill({contentType:'text/javascript',body:'onmessage=()=>postMessage({status:"complete",result:'+result+'});'}));
await p.goto('http://127.0.0.1:8765/#explore');await p.locator('#resultContent').waitFor({state:'visible'});if(await p.title()!=="Exploration Planner · psam's FarmRPG Tools")throw Error('Incorrect page title');await p.screenshot({path:'../../work/brand-mobile.png'});await p.setViewportSize({width:1440,height:960});await p.screenshot({path:'../../work/brand-desktop.png'});await p.setViewportSize({width:390,height:844});await p.locator('.secondaryrow').first().evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:'../../work/mobile-after.png'});console.log(await p.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width>390).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().width]).slice(0,30)})));
await p.locator('#suggestAll').click();await p.screenshot({path:'../../work/mobile-dialog.png'});
console.log(await p.locator('dialog[open]').evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),width:innerWidth,client:document.documentElement.clientWidth})));
await p.locator('#closeSuggestions').click();
for(const width of [320,375,430,768,1280]){
 await p.setViewportSize({width,height:844});
 const size=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 if(size.scroll>size.client+1)throw Error('Page overflow at '+width+': '+JSON.stringify(size));
 await p.locator('#unusedRows .materialbutton').first().click();
 const box=await p.locator('#consumerDialog').boundingBox();if(box.x<0||box.x+box.width>width+1||box.y<0||box.y+box.height>845)throw Error('Dialog outside viewport '+width);
 await p.locator('#closeDialog').click();console.log('PASS viewport and material dialog',width);
}
await p.setViewportSize({width:375,height:812});await p.locator('[data-planner-mode="passive"]').click();await p.screenshot({path:'../../work/mobile-mode-dialog.png'});await p.locator('#cancelModeSwitch').click();
await p.locator('#target-837').evaluate(el=>el.scrollIntoView({block:'center'}));await p.screenshot({path:'../../work/mobile-target.png'});
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
