const fs=require('fs'),path=require('path');
(async()=>{
const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
for(const name of ['planner.py','secondary.py','browser_engine.py','wasm_solver.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
const highs=await require('./web/vendor/highs/highs.js')();
const experiments=require('./web/solver-experiments.js').solverExperiments(highs);py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(experiments.solve(lp,JSON.parse(opts))));
py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
const payload={targets:{'837':Number(process.argv[2]||90001)},inventory:{},secondary:['118','83','82','896','74','81','73','895','248','165','500','252','1442','125','146','217','787'].map(item_id=>({item_id,allow_exploration:['118','83','896'].includes(item_id),cap:null})),areas:[4,8,7,1,3,2,5,9,10,14,6,22,13].map(x=>'explore:'+x),max_areas:15,iron_depot:true,runecube:true,resource_saver:45};
py.globals.set('payload_json',JSON.stringify(payload));
py.runPython('import json\nfrom wasm_solver import install\ninstall(highs_solve)\nfrom browser_engine import compute\ncatalog=json.loads(catalog_json)');
const flagsList=[{}, {cache_primary:true}, {cache_primary:true}, {cache_primary:true}, {reuse_models:true}, {fractional_start:true}, {cache_primary:true,reuse_models:true,fractional_start:true}];let index=0;const reports=[];
for(const flags of flagsList){if(index===3)payload.secondary.push({item_id:'185',allow_exploration:false,cap:100});payload.performance=flags;py.globals.set('payload_json',JSON.stringify(payload));experiments.configure(flags);const start=performance.now();
try{const result=JSON.parse(py.runPython('deferred=[]\nplan_result=compute(catalog,json.loads(payload_json),deferred=deferred)\njson.dumps(plan_result)'));for(const p of result.plans)for(const r of p.item_balances)if(r.expected_final_inventory < -1e-6)throw Error('Negative inventory');const row={index,flags,seconds:(performance.now()-start)/1000,cache:result.performance.primary_cache_hit,stats:experiments.stats(),explores:result.plans[0].optimal_total_explores};console.log(JSON.stringify(row));reports.push(row);}catch(e){console.log('FAIL',index,String(e));throw e;}index++;fs.writeFileSync('../../work/performance-options-benchmark.json',JSON.stringify(reports,null,2));
}
})().catch(e=>{console.error(String(e));process.exit(1)});
