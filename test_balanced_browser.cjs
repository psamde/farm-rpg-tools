// Optional integration check against the locally served web directory.
const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
 try{
  const p=JSON.parse(fs.readFileSync('test_shared_pool_plan.json','utf8'));
  p.secondary[0].allow_exploration=true;
  p.inventory=JSON.stringify(p.inventory);p.craftworks_slots=22;p.inventory_size=10000;
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(data=>localStorage.setItem('farm-workshop-v1',JSON.stringify(data)),p);
  await page.goto(process.env.PLANNER_URL || 'http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof result!=='undefined'&&result?.plans?.length&&document.getElementById('error').hidden,{},{timeout:60000});
  const snapshot=await page.evaluate(()=>({version:document.querySelector('.appversion').textContent,
    targets:result.plans[selected].secondary.targets.map(r=>({id:r.item_id,n:r.crafts})),
    scope:result.plans[selected].model,performance:result.performance,
    rows:document.querySelectorAll('.secondaryrow').length}));
  assert.equal(snapshot.version,'v0.1.3');
  assert(snapshot.scope.includes('balanced'));
  for(const id of ['500','118','83','82','896','125'])assert(snapshot.targets.find(t=>t.id===id).n>1000,id);
  assert.equal(snapshot.rows,p.secondary.length);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#secondarySection').scrollIntoViewIfNeeded();
  await page.screenshot({path:'../../work/balanced-mobile.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(snapshot));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
