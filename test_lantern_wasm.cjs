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
const started=Date.now();const result=py.runPython('json.dumps(compute(catalog,json.loads(payload_json)))');const parsed=JSON.parse(result);const expected={90000:38775741,90001:38776399}[payload.targets['837']];if(expected!==undefined && parsed.plans[0].optimal_total_explores!==expected)throw Error('Unexpected explore total');for(const plan of parsed.plans){if(plan.targets[0].craft_quantity!==payload.targets['837'])throw Error('Target changed');for(const row of plan.item_balances){if(row.expected_final_inventory < -1e-6)throw Error('Negative inventory: '+row.name);}}console.log('PASS',payload.targets,parsed.plans.map(p=>p.optimal_total_explores),'seconds',(Date.now()-started)/1000);
})().catch(e=>{console.error(String(e));process.exit(1)});
