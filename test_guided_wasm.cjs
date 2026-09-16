const fs=require('fs'),path=require('path');
(async()=>{
 const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
 for(const name of ['planner.py','secondary.py','balanced.py','browser_engine.py','wasm_solver.py','automatic.py','test_automatic.py','test_guided.py','sync_quests.py','test_planner.py','farmdata.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
 const highs=await require('./web/vendor/highs/highs.js')();py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
 py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
 console.log(py.runPython(`
from wasm_solver import install
install(highs_solve)
import unittest,json
from test_guided import GuidedTests
assert unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(GuidedTests)).wasSuccessful()
from browser_engine import guided_compute,compute
c=json.loads(catalog_json)
payload=dict(targets={'126':1000},secondary=[],areas=['explore:'+str(i) for i in range(1,10)],iron_depot=True,runecube=False,resource_saver=0,material='13',candidates=[])
wood=next(i for i,v in c['items'].items() if v['name']=='Wood')
board=next(i for i,v in c['items'].items() if v['name']=='Board')
payload.update(material=wood,candidates=[dict(item_id=board,cap=100,allow_exploration=False)])
r=guided_compute(c,payload)
assert r['options']
o=r['options'][0]
p=compute(c,dict(payload,secondary=[o['goal']]))['plans'][0]
assert p['optimal_total_explores']==o['total_explores']
assert p['secondary']['targets'][0]['crafts']==o['crafts']
json.dumps(o)
`));
})().catch(e=>{console.error(e);process.exitCode=1});
