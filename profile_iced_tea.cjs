const fs=require('fs'),path=require('path');
(async()=>{
const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
for(const name of ['planner.py','secondary.py','browser_engine.py','wasm_solver.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
const highs=await require('./web/vendor/highs/highs.js')();
let stage='',quantityNow=0;py.globals.set('report_stage',s=>stage=s);let timings=[];py.globals.set('highs_solve',(lp,opts)=>{const start=performance.now();const result=highs.solve(lp,JSON.parse(opts));if(performance.now()-start>1000){fs.writeFileSync('../../work/slow-'+quantityNow+'-'+timings.length+'.lp',lp);console.log('SLOW',quantityNow,timings.length,stage,performance.now()-start);}timings.push({stage,ms:performance.now()-start,status:result.Status,bytes:lp.length,objective:lp.split('\n')[1].slice(0,100)});return JSON.stringify(result);});
py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
const payload={targets:{'837':Number(process.argv[2]||90001)},inventory:{},secondary:['118','83','82','896','74','81','73','895','248','165','500','252','1442','125','146','787','217'].map(item_id=>({item_id,allow_exploration:['118','83','896'].includes(item_id),cap:null})),areas:[4,8,7,1,3,2,5,9,10,14,6,22,13].map(x=>'explore:'+x),max_areas:15,iron_depot:true,runecube:true,resource_saver:45};
py.globals.set('payload_json',JSON.stringify(payload));
py.runPython('import json\nfrom wasm_solver import install\ninstall(highs_solve)\nfrom browser_engine import compute\ncatalog=json.loads(catalog_json)');
py.runPython(`import scipy.optimize, inspect
_original_milp=scipy.optimize.milp
def traced_milp(*args,**kwargs):
    frames=inspect.stack()
    goal=next((f.frame.f_locals.get('ref') for f in frames if f.function=='consume_leftovers'), None)
    report_stage(str(goal)+' '+','.join(f.function+':'+str(f.lineno) for f in frames[:5]))
    return _original_milp(*args,**kwargs)
scipy.optimize.milp=traced_milp
`);const runs=[];for(const quantity of [90000,90000]){quantityNow=quantity;payload.targets['837']=quantity;if(runs.length)payload.secondary.push({item_id:'185',allow_exploration:false,cap:null});py.globals.set('payload_json',JSON.stringify(payload));timings=[];const started=performance.now();const result=py.runPython('deferred=[]\nresult=compute(catalog,json.loads(payload_json),deferred=deferred)\njson.dumps(result)');const parsed=JSON.parse(result);const expected={90000:38775741,90001:38776399}[payload.targets['837']];for(const plan of parsed.plans){if(plan.targets[0].craft_quantity!==payload.targets['837'])throw Error('Target changed');for(const row of plan.item_balances){if(row.expected_final_inventory < -1e-6)throw Error('Negative inventory: '+row.name);}}const row={quantity,icedTea:payload.secondary.some(s=>s.item_id==='185'),explores:parsed.plans[0].optimal_total_explores,seconds:(performance.now()-started)/1000,solverSeconds:timings.reduce((sum,t)=>sum+t.ms,0)/1000,calls:timings.length,slowest:[...timings].sort((a,b)=>b.ms-a.ms).slice(0,3)};runs.push(row);console.log(JSON.stringify(row));fs.writeFileSync('../../work/iced-tea-profile.json',JSON.stringify(runs,null,2));}
})().catch(e=>{console.error(String(e));process.exit(1)});
