/* Interaction regression: execute the real map handlers and graph renderer.
 * The API is a deterministic boundary fixture, not the optimizer. Its nonempty
 * outputs deliberately fall below optional aims, reproducing the condition
 * hidden by an outputs:[] mock in older click tests.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
catalog.locations=Object.values(catalog.locations);
const items=catalog.items;
const id=name=>Object.values(items).find(i=>i.name===name).id;
const ids=Object.fromEntries(['Ant Apple','Feathers','Fern Leaf','Purple Flower','Wood','Straw','Mushroom','Hide','Purple Diary','Green Diary','Leather Diary','Wooden Bow','White Parchment','Purple Parchment','Green Parchment','Mushroom Paste','Leather'].map(name=>[name,id(name)]));
const copy=value=>JSON.parse(JSON.stringify(value));
const hill='explore:3',forest='explore:7';
function area(location,name,explores,drops){return {location_id:location,name,explores,items:Object.entries(drops).map(([name,q])=>({item_id:ids[name],name,expected_drops:q}))};}
function plan(withForest=false){
 const areas=[area(hill,'Highland Hills',10000,{'Ant Apple':125,Feathers:900,'Fern Leaf':900,'Purple Flower':900,Wood:900})];
 if(withForest)areas.push(area(forest,'Forest',5000,{Mushroom:600,Hide:600,Wood:1200,Straw:2400}));
 const amounts={};for(const a of areas)for(const o of a.items)amounts[o.item_id]=(amounts[o.item_id]||0)+o.expected_drops;
 const crafted=withForest?{'Purple Diary':50,'Green Diary':50,'Leather Diary':50,'Wooden Bow':10,'White Parchment':150,'Purple Parchment':50,'Green Parchment':50,'Mushroom Paste':150,Leather:50}:{};
 return {area_set_id:areas.map(a=>a.location_id).join('|'),optimal_total_explores:withForest?15000:10000,areas,
  item_balances:[...Object.entries(amounts).map(([item_id,q])=>({item_id,expected_unused:q,expected_exploration_drops:q,starting_inventory:0,crafted:0})),...Object.entries(crafted).map(([name,q])=>({item_id:ids[name],expected_unused:name.endsWith('Diary')||name==='Wooden Bow'?q:0,crafted:q,starting_inventory:0}))],
  crafts_in_dependency_order:[],raw_requirements:{[ids['Ant Apple']]:125}};
}
function harness(){
 const elements=new Map(),requests=[],calculations=[];let nextJob=0,lastRequest;
 function el(key){
  if(!elements.has(key)){
   const e={id:key,style:{},dataset:{},hidden:false,disabled:false,value:'',textContent:'',open:false,
    classList:{contains:()=>false,toggle:()=>false,add(){},remove(){}},setAttribute(k,v){this[k]=v;},removeAttribute(){},
    addEventListener(){},before(){},after(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},scrollTo(){},
    querySelectorAll(){return[];},insertAdjacentHTML(where,value){this.innerHTML+=value;},replaceWith(other){elements.set(this.id,other);},click(){return this.onclick?.();}};
   let html='';Object.defineProperty(e,'innerHTML',{get:()=>html,set(value){html=value;for(const m of value.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){if(key==='mapInspector'&&m[1]==='mapOptions')elements.delete('mapOptions');const child=el(m[1]);child.disabled=/\sdisabled(?:\s|=|>)/.test(m[0]);}}});elements.set(key,e);
  }return elements.get(key);
 }
 const state={secondary:[],targets:{[ids['Ant Apple']]:125},areas:[hill,forest,'explore:1'],map_planning:false,map_sources:{},map_node_usage:{},map_use_void:[],map_voided:[],map_hidden:[],map_unused_mode:'all',map_expanded_areas:[],inventory:'{}',passive_inventory:'{}',planner_mode:'goals',resource_saver:0,iron_depot:true,automatic_areas:null,mode:'best'};
 const ctx=vm.createContext({document:{createElement:()=>el('section')},$:el,window:{addEventListener(){}},result:{plans:[plan()]},selected:0,state,revision:1,items,catalog,
  fmt:String,esc:String,itemIcon:()=>'',mmBadge:()=>'',itemName:(ref,name)=>name||items[ref]?.name||ref,TOWER_MM:{items:{},gm_items:{}},explorationMenuOrder:[forest,'explore:1',hill],explorationYieldMultiplier:()=>1,
  browserPlanner:{cancel(){}},setTimeout:()=>1,clearTimeout(){},timer:null,save(){},inventoryRows(){},inventoryData:()=>JSON.parse(state.inventory),guidedExploreIncrease:()=>'+50%',
  changed(){ctx.revision++;},async calculate(){calculations.push(copy(state));},
  api:async(path,payload)=>{
   if(path==='/api/plan'){lastRequest=copy(payload);requests.push(lastRequest);return{job_id:String(++nextJob)};}
   if(path.startsWith('/api/item/'))return {exploration_sources:[]};
   const goals=lastRequest.replacement_goals||lastRequest.chosen_goals||[];
   const withForest=(lastRequest.automatic_areas||[]).includes(forest);
   const preview_plan=plan(withForest);
   const outputs=goals.map(g=>({item_id:g.item_id,crafts:withForest?50:0,remaining:withForest?50:0}));
   return{status:'complete',result:{preview_plan,outputs,extra_explores:withForest?5000:0,total_explores:preview_plan.optimal_total_explores,new_locations:withForest?[forest]:[],reduced:[],goals:copy(goals),replacement:Boolean(lastRequest.replacement_goals)}};
  }});
 vm.runInContext(fs.readFileSync('web/craft-map-model.js','utf8'),ctx);
 // Use the actual application-to-planner adapter as well as the map handler.
 const guideSource=fs.readFileSync('web/guided.js','utf8').split('\n').find(line=>line.startsWith('function guidePayload()'));
 assert.ok(guideSource,'guided payload adapter must be available');vm.runInContext(guideSource,ctx);
 vm.runInContext(fs.readFileSync('web/craft-map.js','utf8'),ctx);
 const sourcesUI=vm.runInContext('mapSources',ctx);
 vm.runInContext('mapSources=async()=>{};',ctx); // Most cases need no catalog/source-fetch UI.
 const read=expr=>JSON.parse(vm.runInContext(`JSON.stringify(${expr})`,ctx));
 const set=code=>vm.runInContext(code,ctx);
 async function click(selector,dataset){const button={dataset,closest:()=>null};await el('mapInspector').onclick({target:{closest:s=>s===selector?button:null}});}
 async function add(name,focus,quantity=0,available=true){await click('[data-map-add]',{mapAdd:ids[name],mapFocus:ids[focus],mapQuantity:String(quantity),mapAvailable:String(available)});}
 async function source(name='Mushroom',location=forest){await click('[data-map-area]',{mapSourceItem:ids[name],mapArea:location});}
 const seed=goals=>{set(`mapDrafts=${JSON.stringify(goals)};mapRender();`);};
 return{el,read,set,click,add,source,seed,state,requests,calculations,context:ctx,sourcesUI};
}
const available=(name,cap=null)=>({item_id:ids[name],cap,consumer_mode:'available',available_only:true,automatic_batch:true,allow_exploration:false,void_source:ids[name==='Green Diary'?'Fern Leaf':'Purple Flower']});
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('Use + Void adds an uncapped soft consumer even when currently craftable quantity is zero',async()=>{
 const h=harness();await h.add('Purple Diary','Purple Flower');const g=h.read('mapDrafts[0]');
 assert.equal(g.cap,null,'zero availability is an estimate, not a permanent zero cap');assert.equal(g.consumer_mode,'available');assert.equal(g.available_only,true);
});
test('choosing a source preserves soft mode and forwards source choices to the planner',async()=>{
 const h=harness();h.seed([available('Purple Diary'),available('Green Diary')]);
 h.set(`mapPotential={goals:[{item_id:${JSON.stringify(ids['Purple Diary'])},cap:300},{item_id:${JSON.stringify(ids['Green Diary'])},cap:300}]};`);
 await h.source();for(const g of h.read('mapDrafts')){assert.equal(g.consumer_mode,'available');assert.equal(g.cap,null,'source selection must not turn a potential estimate into a fixed goal');assert.equal(g.available_only,true);}
 const req=h.requests.at(-1);assert.equal(req.map_planning,true);assert.deepEqual(req.map_sources,{[ids.Mushroom]:[forest]});
});
test('soft output below its displayed aim remains a valid visible preview with Apply enabled',async()=>{
 const h=harness();h.seed([{...available('Purple Diary',300),available_only:false},{...available('Green Diary',300),available_only:false}]);
 h.state.map_sources[ids.Mushroom]=[forest];await h.el('mapPreview').onclick();
 assert.equal(h.read('mapPreview.shortfalls.length'),0,'legacy soft aims must not become required minimum quantities');assert.equal(h.el('mapApply').disabled,false);
 assert.ok(h.read('mapGraph.nodes').some(n=>n.id==='area:'+forest&&!n.proposed),'calculated preview must remain displayed');
});
test('all Forest outputs connect, and Apply preserves soft goals plus source configuration',async()=>{
 const h=harness();h.seed([available('Purple Diary'),available('Green Diary'),available('Leather Diary')]);await h.source();
 const links=h.read('mapGraph.links');for(const name of ['Mushroom','Hide','Wood','Straw'])assert.ok(links.some(l=>l.from==='area:'+forest&&l.to===ids[name]),`${name} must connect to the calculated Forest source`);
 await h.el('mapApply').onclick();assert.deepEqual(copy(h.state.map_sources),{[ids.Mushroom]:[forest]});assert.equal(h.calculations.length,1);
 for(const g of h.state.secondary){assert.equal(g.consumer_mode,'available');assert.equal(g.cap,null);assert.equal(g.available_only,true,'Apply must not discard production mode metadata');}
});
test('discard restores sources and optional production modes',async()=>{
 const h=harness(),before=copy(h.state);await h.add('Purple Diary','Purple Flower');await h.source();await h.el('mapDiscard').onclick();
 assert.deepEqual(copy(h.state),before);assert.deepEqual(h.read('mapDrafts'),[]);assert.deepEqual(h.read('[...mapExtraAreas]'),[]);
});
test('repeated source selection and removal never introduce an unrequested area',async()=>{
 const h=harness();h.seed([available('Purple Diary')]);await h.source();await h.source();
 assert.deepEqual(copy(h.state.map_sources),{[ids.Mushroom]:[forest]});
 assert.equal(h.read(`mapGraph.links.filter(l=>l.from==='area:${forest}'&&l.to===${JSON.stringify(ids.Mushroom)}).length`),1,'same source click must not duplicate its graph edge');
 await h.click('[data-map-remove-source]',{mapRemoveSource:forest,mapSourceItem:ids.Mushroom});
 const req=h.requests.at(-1);assert.deepEqual(req.automatic_areas,[]);assert.ok(!Object.values(req.map_sources||{}).flat().includes(forest));
 assert.equal(h.read('mapDrafts[0].cap'),null);assert.equal(h.read('mapDrafts[0].consumer_mode'),'available');
});
test('an unmet explicit fixed quantity still blocks Apply',async()=>{
 const h=harness();h.seed([{...available('Purple Diary',300),consumer_mode:'fixed',available_only:false}]);h.state.map_sources[ids.Mushroom]=[forest];
 await h.el('mapPreview').onclick();assert.equal(h.read('mapPreview.shortfalls.length'),1);assert.equal(h.el('mapApply').disabled,true);
});
test('forcing one branch and sharing its common ingredient preserve neighboring consumer intent',async()=>{
 const h=harness();h.seed([available('Purple Diary'),available('Green Diary'),available('Leather Diary')]);
 h.state.map_node_usage[ids['Fern Leaf']]={mode:'use'};h.state.map_node_usage[ids.Feathers]={mode:'use'};
 h.set(`mapSelect(${JSON.stringify(ids['Purple Flower'])});`);h.el('mapRawForce').onclick();
 const forced=h.read(`mapGoals().find(g=>g.item_id===${JSON.stringify(ids['Purple Diary'])})`);
 assert.equal(forced.consumer_mode,'fixed');assert.ok(forced.cap>0);
 for(const name of ['Green Diary','Leather Diary'])assert.equal(h.read(`mapGoals().find(g=>g.item_id===${JSON.stringify(ids[name])}).consumer_mode`),'available');
 assert.deepEqual(copy(h.state.map_node_usage[ids['Fern Leaf']]),{mode:'use'});assert.deepEqual(copy(h.state.map_node_usage[ids.Feathers]),{mode:'use'});
 h.set(`mapSelect(${JSON.stringify(ids.Mushroom)});mapPotential={goals:${JSON.stringify([{item_id:ids['Purple Diary'],cap:forced.cap},{item_id:ids['Green Diary'],cap:200},{item_id:ids['Leather Diary'],cap:100}])}};`);
 h.el('mapDemandPercent').value='50';h.el('mapSetDemand').onclick();
 assert.deepEqual(h.read(`mapGoals().find(g=>g.item_id===${JSON.stringify(ids['Purple Diary'])})`),forced,'shared demand percentages must never rewrite the fixed branch');
 for(const [name,basis] of [['Green Diary',200],['Leather Diary',100]]){
  const goal=h.read(`mapGoals().find(g=>g.item_id===${JSON.stringify(ids[name])})`);
  assert.equal(goal.consumer_mode,'available');assert.equal(goal.demand_group,ids.Mushroom);assert.equal(goal.demand_basis,basis);assert.equal(goal.demand_percent,50);
 }
});
test('async preview preserves the live recipe chooser and its filter/expanded state',async()=>{
 const h=harness();h.seed([available('Leather Diary')]);const originalApi=h.context.api;
 h.context.api=async(path,payload)=>path.startsWith('/api/consumers/')?[{id:ids['Green Diary'],name:'Green Diary',direct:true}]:originalApi(path,payload);
 h.set(`mapSelect(${JSON.stringify(ids['Green Parchment'])});`);
 // Make the parchment visible exactly as it would be after its preceding add.
 h.set(`mapExpanded.add(${JSON.stringify(ids['Green Parchment'])});mapSelect(${JSON.stringify(ids['Green Parchment'])});`);
 await h.set(`mapConsumers(${JSON.stringify(ids['Green Parchment'])})`);
 const chooser=h.el('mapOptions'),filter=h.el('mapCraftFilter'),list=h.el('mapCraftList');filter.value='Green';list.expandedRecipe=ids['Green Diary'];
 await h.el('mapPreview').onclick();
 assert.strictEqual(h.el('mapOptions'),chooser,'preview must preserve the existing chooser DOM instead of replacing it');
 assert.equal(h.el('mapCraftFilter').value,'Green');assert.equal(h.el('mapCraftList').expandedRecipe,ids['Green Diary']);
 assert.match(h.el('mapCraftList').innerHTML,/Use \+ Void/);
 h.set(`mapSelect(${JSON.stringify(ids.Feathers)});`);assert.notStrictEqual(h.el('mapOptions'),chooser,'an explicit different node selection must reset the chooser');
});
test('preview completion does not invalidate an in-flight recipe search for the same node',async()=>{
 const h=harness();h.seed([available('Leather Diary')]);const originalApi=h.context.api;let completeSearch;
 h.context.api=async(path,payload)=>path.startsWith('/api/consumers/')?new Promise(resolve=>{completeSearch=resolve;}):originalApi(path,payload);
 h.set(`mapExpanded.add(${JSON.stringify(ids['Green Parchment'])});mapSelect(${JSON.stringify(ids['Green Parchment'])});`);
 const searching=h.set(`mapConsumers(${JSON.stringify(ids['Green Parchment'])})`),chooser=h.el('mapOptions');
 await h.el('mapPreview').onclick();assert.strictEqual(h.el('mapOptions'),chooser);
 completeSearch([{id:ids['Green Diary'],name:'Green Diary',direct:true}]);await searching;
 assert.match(h.el('mapCraftList').innerHTML,/Green Diary/,'the original request must populate the still-open chooser');
});
test('craft suggestions, quantity warnings and source labels use the current solved preview',async()=>{
 const h=harness();h.seed([available('Purple Diary'),available('Green Diary'),available('Leather Diary')]);
 const bow=JSON.stringify(ids['Wooden Bow']),leaf=JSON.stringify(ids['Fern Leaf']);
 assert.equal(h.read(`mapCraftAddOptions(${bow},${leaf}).available`),0,'the starting Hills-only route has no Straw');
 await h.source();
 const options=h.read(`mapCraftAddOptions(${bow},${leaf})`);assert.ok(options.available>=10,'the solved Forest preview supplies enough Straw for the next craft');
 assert.deepEqual(h.read(`mapCraftGaps(${bow},10)`),[]);
 assert.equal(h.read('mapEstimateInputs().drafts.length'),0,'solved drafts must not be added twice');
 assert.equal(h.read('mapEstimateInputs().settings.secondary.length'),3,'all selected goals remain available for shared-pool accounting');
 const gaps={innerHTML:''},input={value:'10'},button={dataset:{}},box={dataset:{mapCustomItem:ids['Wooden Bow']},querySelector:selector=>selector==='input'?input:selector==='[data-map-add]'?button:gaps};
 h.context.customBox=box;h.set('mapRefreshCustomOptions(customBox)');assert.match(gaps.innerHTML,/Ingredients already supplied/);
 const originalApi=h.context.api;
 h.context.api=async(path,payload)=>path.startsWith('/api/item/')?{sources:path.endsWith('/'+ids.Mushroom)?[{kind:'explore',location_id:forest,location_name:'Forest',expected_drops_per_explore:.06}]:[]}:originalApi(path,payload);
 h.set(`mapSelect(${JSON.stringify(ids.Mushroom)});`);await h.sourcesUI(ids.Mushroom);assert.match(h.el('mapOptions').innerHTML,/Already in route/,'selected Forest is already part of the draft route');
});
(async()=>{let failures=0;for(const [name,fn] of cases){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}if(failures)process.exitCode=1;else console.log('Map workflow interaction regressions passed.');})();
