const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('./web/craft-map-model.js');
const item=(id,name,ingredients={})=>({id,name,craftable:Object.keys(ingredients).length>0,direct_ingredients:ingredients,output_quantity:1});
const items={bolt:item('bolt','Small Bolt'),plate:item('plate','Steel Plate',{bolt:2}),control:item('control','Control Box',{plate:1}),switch:item('switch','Kill Switch',{control:1}),idle:item('idle','Idle craft',{bolt:1})};
const settings={targets:{switch:6},secondary:[],resource_saver:0,map_voided:['control'],map_use_void:[],map_node_usage:{control:{mode:'void'}},map_hidden:[],map_sources:{}};
const plan={areas:[{location_id:'desert',name:'Jundland Desert',explores:100,items:[{item_id:'bolt',expected_drops:100}]}],crafts_in_dependency_order:[{item_id:'switch',crafts:6},{item_id:'control',crafts:6},{item_id:'plate',crafts:6}],item_balances:[
 {item_id:'bolt',expected_exploration_drops:100,expected_unused:76},
 {item_id:'plate',crafted:12,expected_unused:2},
 {item_id:'control',crafted:10,expected_unused:4},
 {item_id:'switch',crafted:6,reserved_target_output:6,expected_unused:0}
]};
const graph=model.buildCraftMap(items,plan,settings);
const control=graph.nodes.find(n=>n.id==='control');
assert.equal(control.requiredUse,6);
assert.equal(model.craftMapNodeLabels(control,graph.nodes,graph.links).mode,'Use required + Void/Sell');
assert.equal(model.craftMapNodeLabels({...control,requiredUse:0},graph.nodes,graph.links).mode,'Void/Sell');
const bonus=model.buildCraftMap(items,plan,{...settings,resource_saver:50});
assert.equal(bonus.nodes.find(n=>n.id==='control').requiredUse,4,'protected use accounts for Resource Saver');
const connections=model.craftMapConnections('plate',graph.nodes,graph.links);
assert.deepEqual(connections.inputs.map(r=>[r.node.id,r.quantity]),[['bolt',24]]);
assert.deepEqual(connections.outputs.map(r=>[r.node.id,r.quantity]),[['control',10]]);
const extraLinks=[...graph.links,{from:'bolt',to:'idle',quantity:0,phantom:true},{from:'bolt',to:'plate',quantity:24},{from:'bolt',to:'hidden',quantity:1}];
const withIdle=model.craftMapConnections('bolt',[...graph.nodes,{id:'idle',name:'Idle craft',kind:'item'}],extraLinks);
assert.deepEqual(withIdle.outputs.map(r=>r.node.id),['idle','plate'],'include idle recipes, omit absent nodes, deduplicate shared edges');
assert.equal(withIdle.inputs[0].node.id,'area:desert');

// Exercise the real inspector/picker handlers without a browser or solver.
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',classList:{contains:()=>false},addEventListener(){},before(){},after(){},setAttribute(){},querySelectorAll:()=>[],scrollTop:0});return elements.get(id);}
const ctx=vm.createContext({...model,items,result:null,state:structuredClone(settings),document:{createElement:()=>el('section')},$:el,window:{addEventListener(){}},itemName:(_id,name)=>name,esc:String,fmt:String,inventoryData:()=>({}),setTimeout:()=>1,clearTimeout(){},towerOpportunity:()=>null,api:async()=>[{id:'plate',name:'Steel Plate',direct:true},{id:'idle',name:'Idle craft',direct:true},{id:'switch',name:'Kill Switch',direct:false}]});
vm.runInContext(fs.readFileSync('web/craft-map.js','utf8'),ctx);
ctx.fixture=graph;
vm.runInContext(`mapGraph=fixture;mapRender=()=>{};mapCraftAddOptions=()=>({all:10,available:10});mapCraftGaps=()=>[];mapPotential={goals:[]};mapQueuePreview=()=>{};mapChanged=()=>{};`,ctx);
(async()=>{
 vm.runInContext("mapSelect('control')",ctx);
 assert.match(el('mapInspector').innerHTML,/6 reserved for your goals/);
 assert.match(el('mapInspector').innerHTML,/Void\/Sell surplus/);
 assert.match(el('mapInspector').innerHTML,/data-map-jump="plate"/);
 assert.match(el('mapInspector').innerHTML,/data-map-jump="switch"/);
 await vm.runInContext("mapConsumers('bolt')",ctx);
 const listing=el('mapCraftList').innerHTML;
 assert.match(listing,/Already in map · 12 crafts/);
 assert.match(listing,/Go to Steel Plate/);
 assert.match(listing,/Make extra with leftovers/);
 assert.ok(!listing.includes('Kill Switch'),'direct crafts only');
 const before=JSON.stringify(ctx.state);
 vm.runInContext("mapFocus=id=>{focused=id;}",ctx);
 await el('mapInspector').onclick({target:{closest:selector=>selector==='[data-map-jump]'?{dataset:{mapJump:'plate'}}:null}});
 assert.equal(vm.runInContext('mapSelected',ctx),'plate');
 assert.equal(vm.runInContext('focused',ctx),'plate');
 assert.equal(JSON.stringify(ctx.state),before,'following a connection does not change the plan');
 ctx.state.secondary=[{item_id:'plate',consumer_mode:'available'}];
 await vm.runInContext("mapConsumers('bolt')",ctx);
 assert.match(el('mapCraftList').innerHTML,/Go to Steel Plate/);
 assert.ok(!el('mapCraftList').innerHTML.includes('data-map-add="plate"'),'an explicit craft cannot be added twice');
 console.log('Required surplus labels, protected quantities, connected-node navigation and existing-recipe choices passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
