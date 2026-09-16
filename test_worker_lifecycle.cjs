const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const workers=[];
class Worker {constructor(){this.terminated=false;workers.push(this);}postMessage(p){this.payload=p;}terminate(){this.terminated=true;}}
const c={Worker,URL,document:{baseURI:'http://localhost/',querySelector:()=>({textContent:'vtest'})}};
vm.createContext(c);vm.runInContext(fs.readFileSync('web/browser-api.js','utf8')+';globalThis.api=browserPlanner;',c);
(async()=>{await c.api.api('/api/plan',{});workers[0].onmessage({data:{status:'complete',result:{}}});c.api.cancel();assert.equal(workers[0].terminated,false);await c.api.api('/api/plan',{action:'guided'});assert.equal(workers.length,1);c.api.cancel();assert.equal(workers[0].terminated,true);await c.api.api('/api/plan',{});assert.equal(workers.length,2);console.log('Idle cancellation keeps runtime; active cancellation still interrupts and restarts.');})().catch(e=>{console.error(e);process.exitCode=1});
