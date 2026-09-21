// Exercise the shipped Python + SciPy + HiGHS WASM stack without a web server.
// Uses the exact module files copied by build_static.py into web/.
const fs=require('fs'),path=require('path');
const {performance}=require('node:perf_hooks');

(async()=>{
 const root=__dirname,start=performance.now(),sourceModules=process.argv.includes('--source');
 const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.join(root,'web/vendor/pyodide')});
 await py.loadPackage('scipy');
 for(const name of ['planner.py','secondary.py','balanced.py','browser_engine.py','wasm_solver.py','automatic.py']){
  py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(path.join(root,sourceModules?'':'web',name),'utf8'));
 }
 py.FS.writeFile('/home/pyodide/test_map_acceptance.py',fs.readFileSync(path.join(root,'test_map_acceptance.py'),'utf8'));
 py.FS.mkdirTree('/home/pyodide/data');
 py.FS.writeFile('/home/pyodide/data/catalog.json',fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
 const highs=await require('./web/vendor/highs/highs.js')();
 const experiments=require('./web/solver-experiments.js').solverExperiments(highs);
 experiments.configure({});
 py.globals.set('highs_solve',(lp,options)=>JSON.stringify(experiments.solve(lp,JSON.parse(options))));
 console.log('Python modules:',sourceModules?'working source':'built web assets');
 console.log('WASM initialization seconds:',((performance.now()-start)/1000).toFixed(3));
 const result=JSON.parse(py.runPython(`
import os,sys,json,time,unittest
os.chdir('/home/pyodide')
sys.path.insert(0,'/home/pyodide')
from wasm_solver import install
install(highs_solve)
from test_map_acceptance import MapAcceptanceTests

class TimedResult(unittest.TextTestResult):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        self.timings={}
    def startTest(self,test):
        self.started=time.perf_counter()
        super().startTest(test)
    def stopTest(self,test):
        self.timings[test._testMethodName]=round(time.perf_counter()-self.started,3)
        super().stopTest(test)

suite=unittest.defaultTestLoader.loadTestsFromTestCase(MapAcceptanceTests)
started=time.perf_counter()
outcome=unittest.TextTestRunner(verbosity=2,resultclass=TimedResult).run(suite)
assert outcome.wasSuccessful(), 'Browser WASM acceptance failed'
tests_seconds=time.perf_counter()-started
case=MapAcceptanceTests()
started=time.perf_counter()
final=case.run_map([*case.goals(),case.goal('Wooden Bow')])
example_seconds=time.perf_counter()-started
json.dumps(dict(tests=outcome.testsRun,tests_seconds=round(tests_seconds,3),
    per_test_seconds=outcome.timings,example_seconds=round(example_seconds,3),
    explores=final['optimal_total_explores'],
    areas=[dict(name=a['name'],explores=a['explores']) for a in final['areas']],
    crafts=case.counts(final)))
`));
 // Exercise the actual worker boundary: a recoverable Python error must retain
 // its structured data and leave this same runtime usable for the next plan.
 const worker=fs.readFileSync(path.join(root,'web/python-worker.js'),'utf8'),messages=[];
 const scope={self:{postMessage:message=>messages.push(message)}};
 require('node:vm').createContext(scope);
 require('node:vm').runInContext(worker.slice(worker.indexOf('function runCalculation('),worker.indexOf('self.onmessage=')),scope);
 const assert=require('node:assert/strict');
 assert.equal(scope.runCalculation(py,"from planner import plan, calculation_error\nplan(MapAcceptanceTests.catalog, {'378':100}, areas=['explore:3'])"),false);
 assert.deepEqual(JSON.parse(JSON.stringify(messages[0].inventory_shortfalls)),[{item_id:'378',name:'Water Lily',quantity:100,starting_inventory:0}]);
 assert.equal(scope.runCalculation(py,"inventory_retry = plan(MapAcceptanceTests.catalog, {'378':100}, areas=['explore:3'], inventory={'378':100})"),true);
 assert.equal(py.runPython("inventory_retry['optimal_total_explores']"),0);
 console.log('Worker inventory recovery and warm-runtime retry passed.');
 console.log(JSON.stringify({...result,solver:experiments.stats(),wall_seconds:Number(((performance.now()-start)/1000).toFixed(3))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
