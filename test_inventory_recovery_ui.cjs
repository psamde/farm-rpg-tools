const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/app.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
class Element{
 constructor(){this.children=[];this.classList={add(){},remove(){}};this.button={};}
 set textContent(value){this.text=value;this.children=[];}
 get textContent(){return this.text;}
 append(el){this.children.push(el);}
 querySelector(){return this.button;}
}
const nodes={},state={planner_mode:'goals',targets:{'target':100},secondary:[],areas:['forest'],inventory:'{"lily":500}'};
let changed=0,rows=0;
const context={state,revision:8,items:{lily:{name:'Water Lily'}},$:(id)=>nodes[id]??=new Element(),
 document:{createElement:()=>new Element()},itemName:(id,name)=>name,esc:String,fmt:String,
 inventoryData:()=>JSON.parse(state.inventory),setInventory:s=>state.inventory=JSON.stringify(s),
 inventoryRows:()=>rows++,changed:()=>{changed++;context.revision++;},clearTimeout,
 api:async(url)=>url==='/api/plan'?{job_id:'job'}:{status:'error',error:'Need Water Lily',
     inventory_shortfalls:[{item_id:'lily',quantity:27001}]}};
vm.createContext(context);
vm.runInContext(extract('error')+extract('provideMissingInventory'),context);
// Use the real calculation error handler, including worker-data propagation.
vm.runInContext('async '+extract('calculate'),context);
(async()=>{
 await context.calculate();
 assert.equal(nodes.error.textContent,'Need Water Lily');
 assert.equal(nodes.error.children.length,2);
 const entry=nodes.error.children[1],click=entry.button.onclick;
 assert.match(entry.innerHTML,/27001 needed/);
 assert.match(entry.innerHTML,/Provide Water Lily from inventory/);
 click();
 assert.equal(JSON.parse(state.inventory).lily,27501);
 assert.deepEqual(state.areas,['forest']);
 assert.deepEqual(state.targets,{target:100});
 assert.equal(changed,1);assert.equal(rows,1);assert.equal(nodes.error.hidden,true);
 click(); // A stale or double click cannot add the amount twice.
 assert.equal(JSON.parse(state.inventory).lily,27501);
 context.error('Multiple missing items',[{item_id:'lily',quantity:10},{item_id:'unknown',quantity:2},{item_id:'lily',quantity:NaN}]);
 assert.equal(nodes.error.children.length,2);
 context.revision++;
 nodes.error.children[1].button.onclick();
 assert.equal(changed,1);
 state.inventory='{"lily":1000000000000}';
 context.error('Too many',[{item_id:'lily',quantity:1}]);
 nodes.error.children[1].button.onclick();
 assert.match(nodes.error.textContent,/exceeds the inventory limit/);
 assert.equal(changed,1);
 context.error('Plain error');assert.equal(nodes.error.children.length,0);
 context.error('');assert.equal(nodes.error.hidden,true);
 console.log('Inventory recovery: structured worker errors, quantity, unchanged goals/areas, stale clicks and limits passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
