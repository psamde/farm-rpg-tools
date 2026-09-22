const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/app.js','utf8');
const store=new Map();
const c={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},TextEncoder,TextDecoder,btoa,atob,items:{raw:{explorable:true,craftable:false},craft:{craftable:true},bad:{craftable:false}},catalog:{locations:[{id:'area'}]}};vm.createContext(c);
vm.runInContext(fs.readFileSync('web/global-settings.js','utf8'),c);
vm.runInContext(source.match(/const defaults=.*?;/)[0]+';globalThis.base=defaults;',c);
vm.runInContext(source.slice(source.indexOf('function eligibleTarget('),source.indexOf('function addTarget(')),c);
vm.runInContext(source.slice(source.indexOf('function encodePlanCode('),source.indexOf("$('generatePlanCode').onclick")),c);
vm.runInContext(source.slice(source.indexOf('function explorationIngredients('),source.indexOf('function addSecondary(')),c);
const input={...c.base,targets:{raw:200,craft:10},areas:['area'],secondary:[{item_id:'craft',cap:5,allow_exploration:true}],inventory:'{"raw":3}',route_foods:{neigh:true},resource_saver:45};
c.GlobalSettings.write(input,c.catalog.locations);
assert.deepEqual(JSON.parse(JSON.stringify(c.decodePlanCode(c.encodePlanCode(input)))),JSON.parse(JSON.stringify(input)));
assert.throws(()=>c.decodePlanCode('bad'));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,targets:{bad:1}})));
assert.equal(c.decodePlanCode(c.encodePlanCode({...input,resource_saver:99})).resource_saver,45,'new plan codes cannot change global settings');
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,secondary:[{item_id:'raw',cap:null,allow_exploration:true}]})));
console.log('Plan-code roundtrip, invalid data, and eligible target checks passed');

const passive={...input,planner_mode:'passive',targets:{},passive_inventory:'{"raw":40}',production_interval:10};
assert.equal(c.decodePlanCode(c.encodePlanCode(passive)).passive_inventory,passive.passive_inventory);
assert.equal(c.decodePlanCode(c.encodePlanCode(passive)).production_interval,10);
console.log('Passive save codes preserve production period and independent supplies');

const legacy=value=>'FW1.'+btoa(JSON.stringify({version:1,settings:value}));
const oldCode=legacy({targets:{raw:200},areas:['area'],performance:{cache_primary:true}});
// Add catalog entries after the save was made; existing references still load.
c.items.newItem={craftable:true};c.catalog.locations.push({id:'new-area'});
const restored=c.decodePlanCode(oldCode);
assert.equal(restored.targets.raw,200);assert.equal(Object.keys(restored.targets).length,1);
assert.equal(restored.inventory_size,10000);assert.equal(restored.performance,undefined);
// Simulate a future release adding settings and nested defaults.
c.base.newSetting=42;c.base.future_settings={enabled:true};
const future=c.decodePlanCode(oldCode);
assert.equal(future.newSetting,42);assert.equal(future.future_settings.enabled,true);
const local=c.withSettingDefaults({targets:{},secondary:[],performance:{cache_primary:false}});
assert.equal(Object.keys(local.targets).length,0);assert.equal(local.secondary.length,0);
assert.equal(local.performance,undefined);assert.equal(local.future_settings.enabled,true);
local.future_settings.enabled=false;assert.equal(c.base.future_settings.enabled,true);
assert.equal(c.decodePlanCode(c.encodePlanCode({targets:{raw:1},performance:{cache_primary:'yes'}})).performance,undefined);
console.log('Old saves tolerate catalog additions and receive independent top-level/nested defaults; explicit choices and empty targets are preserved');

const starter=c.starterPlan();assert.equal(starter.targets['126'],1000);assert.equal(starter.secondary.length,2);assert.equal(starter.secondary[0].allow_exploration,true);
assert.equal(c.withSettingDefaults({targets:{raw:7},secondary:[]}).secondary.length,0);
assert.equal(c.withSettingDefaults({targets:{raw:7},secondary:[]}).targets.raw,7);
console.log('First-run example is independent of saved plans and migration defaults');

c.items.craft.direct_ingredients={raw:1};
const anchored={...input,secondary:[{item_id:'craft',cap:5,allow_exploration:true,exploration_item_id:'raw'}]};
assert.equal(c.decodePlanCode(c.encodePlanCode(anchored)).secondary[0].exploration_item_id,'raw');
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...anchored,secondary:[{...anchored.secondary[0],exploration_item_id:'bad'}]})));
console.log('Chosen exploration ingredients survive saves; unrelated ingredients are rejected');
const preferred={...input,secondary:[{item_id:'craft',cap:5,allow_exploration:true,prioritize:true}]};
assert.equal(c.decodePlanCode(c.encodePlanCode(preferred)).secondary[0].prioritize,true);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...preferred,secondary:[{...preferred.secondary[0],prioritize:'yes'}]})));
console.log('Explicit priorities survive saves; invalid priority values are rejected');
const automaticSave={...input,automatic_areas:['area']};
assert.deepEqual(Array.from(c.decodePlanCode(c.encodePlanCode(automaticSave)).automatic_areas),['area']);
assert.equal(c.decodePlanCode(oldCode).automatic_areas,null);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,automatic_areas:['unknown']})));
console.log('Automatic exploration scope survives saves; old saves remain unrestricted');
const automaticBatch={...input,secondary:[{item_id:'craft',cap:50,allow_exploration:true,automatic_batch:true}]};
assert.equal(c.decodePlanCode(c.encodePlanCode(automaticBatch)).secondary[0].automatic_batch,true);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...automaticBatch,secondary:[{...automaticBatch.secondary[0],automatic_batch:'yes'}]})));
console.log('Automatic batches retain their selected exploration aim in saves');

// Map saves contain user intent, not the last computed amount. In particular a
// paused material must not permanently erase limits or fixed consumer goals.
c.items.fixedCraft={craftable:true,direct_ingredients:{raw:2},output_quantity:1};
c.items.uncappedCraft={craftable:true,direct_ingredients:{raw:3},output_quantity:1};
const mapSave={...input,map_planning:true,map_sources:{raw:['area']},map_source_explores:{raw:{area:1234}},map_node_usage:{raw:{mode:'void'}},map_voided:['raw'],
 secondary:[
  {item_id:'craft',consumer_mode:'available',cap:2500,user_cap:true,allow_exploration:false,available_only:true},
  {item_id:'fixedCraft',consumer_mode:'fixed',cap:400,user_cap:false,allow_exploration:false,automatic_batch:true},
  {item_id:'uncappedCraft',consumer_mode:'available',cap:null,user_cap:false,allow_exploration:false,available_only:true}
 ]};
const restoredMap=c.decodePlanCode(c.encodePlanCode(mapSave));
assert.equal(restoredMap.map_planning,true);assert.deepEqual(Array.from(restoredMap.map_sources.raw),['area']);
assert.equal(restoredMap.map_node_usage.raw.mode,'void');assert.deepEqual(Array.from(restoredMap.map_voided),['raw']);
assert.deepEqual(JSON.parse(JSON.stringify(restoredMap.secondary)),mapSave.secondary);
const oldMap=c.decodePlanCode(oldCode);
assert.equal(oldMap.map_planning,false);assert.equal(Object.keys(oldMap.map_sources).length,0);assert.equal(Object.keys(oldMap.map_node_usage).length,0);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...mapSave,secondary:[{...mapSave.secondary[0],user_cap:'yes'}]})));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...mapSave,secondary:[{...mapSave.secondary[0],consumer_mode:'unknown'}]})));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...mapSave,map_sources:{raw:['unknown']}})));
const mapSource=fs.readFileSync('web/craft-map.js','utf8');
const intentContext=vm.createContext({state:restoredMap,items:c.items,mapDrafts:[]});
vm.runInContext(fs.readFileSync('web/craft-map-model.js','utf8'),intentContext);
vm.runInContext(mapSource.slice(mapSource.indexOf('function mapGoals()'),mapSource.indexOf('function mapQueuePreview()')),intentContext);
assert.equal(vm.runInContext('mapRequestGoals().every(g=>g.cap===0)',intentContext),true,'saved pause applies without destroying saved goals');
vm.runInContext("state.map_node_usage.raw={mode:'use'};",intentContext);
const resumed=JSON.parse(vm.runInContext('JSON.stringify(mapRequestGoals())',intentContext));
assert.deepEqual(resumed.map(g=>[g.consumer_mode,g.cap,g.user_cap]),[['available',2500,true],['fixed',400,false],['available',null,false]]);
console.log('Map source selections, paused nodes, fixed goals, explicit soft limits, and uncapped consumers survive save/load and reversible resume');

assert.equal(restoredMap.map_source_explores.raw.area,1234);
assert.equal(oldMap.map_source_explores,null);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...mapSave,map_source_explores:{raw:{area:-1}}})));

const largeIds=Array.from({length:64},(_,i)=>'extra'+i);
for(const id of largeIds)c.items[id]={craftable:true,direct_ingredients:{raw:1},output_quantity:1};
const largeSave={...input,targets:Object.fromEntries(largeIds.map(id=>[id,10])),secondary:largeIds.map(item_id=>({item_id,cap:null,allow_exploration:false})),quest_selection:['quest'],quest_imported_items:{quest:['raw']}};
const loadedLarge=c.decodePlanCode(c.encodePlanCode(largeSave));
assert.equal(Object.keys(loadedLarge.targets).length,64);assert.equal(loadedLarge.secondary.length,64);
assert.deepEqual(Array.from(loadedLarge.quest_imported_items.quest),['raw']);
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...largeSave,quest_imported_items:{quest:'bad'}})));
console.log('64-item plans and partial quest imports survive save/load without count limits.');

const suppliedSave={...input,provided_targets:{raw:{quantity:200,taken:3}},inventory:'{"raw":0}'};
assert.deepEqual(JSON.parse(JSON.stringify(c.decodePlanCode(c.encodePlanCode(suppliedSave)).provided_targets)),suppliedSave.provided_targets);
assert.deepEqual(JSON.parse(JSON.stringify(c.decodePlanCode(oldCode).provided_targets)),{});
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,provided_targets:{raw:{quantity:201,taken:0}}})));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,provided_targets:{raw:{quantity:200,taken:201}}})));
console.log('Provided goals and reserved quantities survive save/load; old saves have none.');

const partialSupply={...input,provided_targets:{raw:{quantity:50,taken:3}},inventory:'{"raw":0}'};
assert.deepEqual(JSON.parse(JSON.stringify(c.decodePlanCode(c.encodePlanCode(partialSupply)).provided_targets)),partialSupply.provided_targets);

const newCode=c.encodePlanCode(input),encoded=JSON.parse(atob(newCode.slice(4)));
assert.equal(encoded.version,2);for(const k of c.GlobalSettings.keys)assert.equal(Object.hasOwn(encoded.settings,k),false,k+' omitted from plan');
c.GlobalSettings.write({...input,resource_saver:20,inventory_size:20000},c.catalog.locations);
assert.equal(c.decodePlanCode(newCode).resource_saver,20);assert.equal(c.decodePlanCode(newCode).inventory_size,20000);
c.restorePlanCode(newCode);assert.equal(c.GlobalSettings.read().resource_saver,20);
const oldFull=legacy({...input,resource_saver:30,inventory_size:12345});
assert.equal(c.decodePlanCode(oldFull).resource_saver,30);assert.equal(c.GlobalSettings.read().resource_saver,20,'decoding is read-only');
c.restorePlanCode(oldFull);assert.equal(c.GlobalSettings.read().resource_saver,30);assert.equal(c.GlobalSettings.read().inventory_size,12345);
const active=JSON.parse(store.get('farm-workshop-v1'));assert.equal(active.resource_saver,undefined);assert.equal(active.targets.raw,200);
c.restorePlanCode(legacy({targets:{raw:42}}));assert.equal(c.GlobalSettings.read().resource_saver,30,'missing legacy settings preserve current values');
assert.throws(()=>c.restorePlanCode(legacy({...input,resource_saver:99})));assert.equal(c.GlobalSettings.read().resource_saver,30);
assert.throws(()=>c.decodePlanCode(c.GlobalSettings.encode(input)),'settings code is not a plan');
console.log('FW2 excludes account settings; FW1 imports override only saved account fields after validation; new plan loads preserve current settings.');

c.GlobalSettings.defaults.future_perk=false;
c.GlobalSettings.write({...c.GlobalSettings.read(),future_perk:true},c.catalog.locations);
assert.equal(c.decodePlanCode(newCode).future_perk,true,'new account fields survive loading an older plan');
c.restorePlanCode(legacy({targets:{raw:8}}));assert.equal(c.GlobalSettings.read().future_perk,true,'legacy imports keep account fields absent from old saves');
