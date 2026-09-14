const fs=require('fs'),path=require('path');
(async()=>{
const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
for(const name of ['planner.py','secondary.py','browser_engine.py','wasm_solver.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
const highs=await require('./web/vendor/highs/highs.js')();
py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
const payload={targets:{'837':Number(process.argv[2]||90001)},inventory:{},secondary:['118','83','82','896','74','81','73','895','248','165','500','252','1442','125','146','217','787'].map(item_id=>({item_id,allow_exploration:['118','83','896'].includes(item_id),cap:null})),areas:[4,8,7,1,3,2,5,9,10,14,6,22,13].map(x=>'explore:'+x),max_areas:15,iron_depot:true,runecube:true,resource_saver:45};
py.globals.set('payload_json',JSON.stringify(payload));
py.runPython('import json\nfrom wasm_solver import install\ninstall(highs_solve)\nfrom browser_engine import compute\ncatalog=json.loads(catalog_json)');
const cases=[
 ['lantern-90000',90000,[]],['lantern-90001',90001,[]],['lantern-89999',89999,[]],
 ['tea-last',90000,[{item_id:'185',allow_exploration:false,cap:null}]],
 ['tea-capped',90000,[{item_id:'185',allow_exploration:false,cap:100}]],
 ['tea-assisted',1000,[{item_id:'185',allow_exploration:true,cap:50}]]
];const base=payload.secondary;const reports=[];const assert=require('assert/strict');
for(const [name,quantity,extra] of cases){payload.targets['837']=quantity;payload.secondary=[...base,...extra];py.globals.set('payload_json',JSON.stringify(payload));const start=performance.now();
py.runPython('deferred=[]\nplan_result=compute(catalog,json.loads(payload_json),deferred=deferred)');
const ready=(performance.now()-start)/1000;const before=JSON.parse(py.runPython('json.dumps(plan_result)'));py.runPython('for finish in deferred: finish()');const after=JSON.parse(py.runPython('json.dumps(plan_result)'));
assert.deepEqual(after.plans.map(p=>[p.areas,p.secondary.targets.map(t=>t.crafts)]),before.plans.map(p=>[p.areas,p.secondary.targets.map(t=>t.crafts)]));
for(const p of after.plans){assert.equal(p.targets[0].craft_quantity,quantity);for(const t of p.secondary.targets){assert(Number.isInteger(t.crafts));if(t.cap!==null)assert(t.crafts<=t.cap);}for(const r of p.item_balances){assert(r.expected_final_inventory>=-1e-6,r.name);const incoming=r.starting_inventory+r.expected_exploration_drops+r.crafted+r.free_perk_supply+(r.required_external_supply||0);assert(Math.abs(incoming-r.consumed_by_crafting-r.expected_final_inventory)<1e-5,'balance '+r.name);}assert([0,5].includes(p.solver.maximum_gap_explores));}
const report={name,ready,total:(performance.now()-start)/1000,explores:after.plans[0].optimal_total_explores,comparisonsUnavailable:after.plans.flatMap(p=>p.secondary.targets).filter(t=>t.comparison_status==='unavailable').length};reports.push(report);console.log(JSON.stringify(report));fs.writeFileSync('../../work/explore-gap-stress.json',JSON.stringify(reports,null,2));
}
})().catch(e=>{console.error(String(e));process.exit(1)});
