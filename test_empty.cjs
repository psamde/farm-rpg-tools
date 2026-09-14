const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('web/app.js','utf8'),nodes={};const c={result:{old:true},selected:5,lastSuccess:{old:true},secondaryRows:()=>{},$:id=>nodes[id]??={hidden:false,disabled:true,classList:{remove(){}}}};vm.createContext(c);
vm.runInContext(s.slice(s.indexOf('function resetEmptyPlan('),s.indexOf('function plannerModeUI(')),c);c.resetEmptyPlan();
assert.equal(c.result,null);assert.equal(nodes.resultContent.hidden,true);assert.equal(nodes.routePanel.hidden,true);assert.equal(nodes.compute.disabled,false);assert.match(nodes.status.textContent,/Add a crafting or collection target/);
console.log('Empty targets clear stale results and leave the planner ready');
