const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/app.js','utf8');
const c={TextEncoder,TextDecoder,btoa,atob,items:{raw:{explorable:true,craftable:false},craft:{craftable:true},bad:{craftable:false}},catalog:{locations:[{id:'area'}]}};vm.createContext(c);
vm.runInContext(source.match(/const defaults=.*?;/)[0]+';globalThis.base=defaults;',c);
vm.runInContext(source.slice(source.indexOf('function eligibleTarget('),source.indexOf('function addTarget(')),c);
vm.runInContext(source.slice(source.indexOf('function encodePlanCode('),source.indexOf("$('generatePlanCode').onclick")),c);
const input={...c.base,targets:{raw:200,craft:10},areas:['area'],secondary:[{item_id:'craft',cap:5,allow_exploration:true}],inventory:'{"raw":3}',route_foods:{neigh:true},resource_saver:45};
assert.deepEqual(JSON.parse(JSON.stringify(c.decodePlanCode(c.encodePlanCode(input)))),JSON.parse(JSON.stringify(input)));
assert.throws(()=>c.decodePlanCode('bad'));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,targets:{bad:1}})));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,resource_saver:99})));
assert.throws(()=>c.decodePlanCode(c.encodePlanCode({...input,secondary:[{item_id:'raw',cap:null,allow_exploration:true}]})));
console.log('Plan-code roundtrip, invalid data, and eligible target checks passed');

const passive={...input,planner_mode:'passive',targets:{},passive_inventory:'{"raw":40}',production_interval:10};
assert.equal(c.decodePlanCode(c.encodePlanCode(passive)).passive_inventory,passive.passive_inventory);
assert.equal(c.decodePlanCode(c.encodePlanCode(passive)).production_interval,10);
console.log('Passive save codes preserve production period and independent supplies');

const oldCode=c.encodePlanCode({targets:{raw:200},areas:['area'],performance:{cache_primary:true}});
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
