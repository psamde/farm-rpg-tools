const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={};function element(id){return elements[id]??= {value:'',textContent:'',disabled:false,open:false,options:[],listeners:{},replaceChildren(...o){this.options=o;this.value=o[0]?.value||'';},add(o){this.options.push(o);},showModal(){this.open=true;},close(){this.open=false;},addEventListener(k,f){this.listeners[k]=f;}};}
const key='farm-workshop-saved-plans-v1',store=new Map([[key,JSON.stringify({version:1,plans:[{id:'a',name:'First',code:'one',updated:1},{id:'b',name:'Second',code:'two',updated:2}]})],['farm-workshop-v1','current']]);let fail=false;
const c={document:{getElementById:element},window:{addEventListener(){}},localStorage:{getItem:k=>store.get(k)||null,setItem(k,v){if(fail)throw Error('blocked');store.set(k,v);}},Option:function(text,value){this.text=text;this.value=value;},Date,confirm(){throw Error('Native confirmation must not be used');}};vm.createContext(c);vm.runInContext(fs.readFileSync('web/saved-plans.js','utf8'),c);
const plans=()=>JSON.parse(store.get(key)).plans;
element('savedPlanList').value='a';element('savedPlanList').onchange();element('deleteNamedPlan').onclick();
assert(element('deleteSaveDialog').open);assert.equal(plans().length,2);assert.match(element('deleteSaveMessage').textContent,/First/);
element('cancelDeleteSave').onclick();assert.equal(plans().length,2);assert(!element('deleteSaveDialog').open);
element('deleteNamedPlan').onclick();element('deleteSaveDialog').listeners.cancel();element('deleteSaveDialog').close();element('confirmDeleteSave').onclick();assert.equal(plans().length,2);
element('deleteNamedPlan').onclick();fail=true;element('confirmDeleteSave').onclick();assert.equal(plans().length,2);assert(element('deleteSaveDialog').open);assert.match(element('deleteSaveError').textContent,/storage/);
fail=false;element('savedPlanList').value='b';element('confirmDeleteSave').onclick();assert.deepEqual(plans().map(p=>p.id),['b']);assert.equal(store.get('farm-workshop-v1'),'current');assert(!element('deleteSaveDialog').open);assert(element('deleteNamedPlan').disabled);assert.match(element('savedPlanStatus').textContent,/deleted/);
console.log('Named save delete: visible confirmation, cancel/Escape, storage failure, captured selection, current-plan preservation passed');
