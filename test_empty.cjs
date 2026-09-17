const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('web/app.js','utf8'),nodes={};let cancelled=false,supplyReport='old',saved=false;const c={result:{old:true},selected:5,lastSuccess:{old:true},state:{selected_plan:5,selected_plan_key:'old'},save:()=>{saved=true;},browserPlanner:{cancel:()=>{cancelled=true;}},startingSupplyReport:value=>{supplyReport=value;},secondaryRows:()=>{},$:id=>nodes[id]??={hidden:false,disabled:true,classList:{remove(){}}}};vm.createContext(c);
vm.runInContext(s.slice(s.indexOf('function resetEmptyPlan('),s.indexOf('function plannerModeUI(')),c);c.resetEmptyPlan();
assert.equal(c.result,null);assert.equal(nodes.resultContent.hidden,true);assert.equal(nodes.routePanel.hidden,true);assert.equal(nodes.compute.disabled,false);assert.match(nodes.status.textContent,/Add a crafting or collection target/);
assert.equal(cancelled,true);assert.equal(supplyReport,null);assert.equal(saved,true);assert.equal(c.state.selected_plan,0);assert.equal(c.state.selected_plan_key,'');
console.log('Empty targets clear stale results and leave the planner ready');
