const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('./web/target-costs.js'),source=fs.readFileSync('web/app.js','utf8');
const fields={
 'goal-a':{value:'20000',dataset:{totalQuantity:'a'}},
 'target-a':{value:'15000',dataset:{quantity:'a'}},
 'provided-a':{value:'5000',dataset:{inventoryQuantity:'a'}}
};
const handlers={},messages=[],ctx=vm.createContext({state:{targets:{a:20000},inventory:'{"a":0}',provided_targets:{a:{quantity:5000,taken:0}}},TargetCosts:T,$:id=>id==='targets'?{addEventListener:(event,fn)=>handlers[event]=fn}:fields[id],error:m=>messages.push(m),inventoryRows(){},changed(){}});
vm.runInContext(source.slice(source.indexOf('function syncTargetInputs('),source.indexOf('function provideTarget(')),ctx);
vm.runInContext(source.slice(source.indexOf('function clampTargetInput('),source.indexOf('\nfunction modeHelp(')),ctx);
function edit(id,value,commit=true){fields[id].value=value;handlers.input({target:fields[id]});if(commit)handlers.change({target:fields[id]});}
edit('target-a','25000',false);
assert.equal(Number(fields['target-a'].value),20000,'typing or pasting over the goal is clamped immediately');
assert.equal(Number(fields['provided-a'].value),0);
handlers.change({target:fields['target-a']});
assert.deepEqual(T.remaining(ctx.state),{a:20000});
edit('provided-a','90000');
assert.equal(Number(fields['provided-a'].value),20000);
assert.equal(Number(fields['target-a'].value),0);
assert.deepEqual(T.remaining(ctx.state),{});
edit('provided-a','-1');
assert.equal(Number(fields['provided-a'].value),0);
assert.equal(Number(fields['target-a'].value),20000);
edit('target-a','10000.8');
assert.equal(Number(fields['target-a'].value),10000);
assert.equal(Number(fields['provided-a'].value),10000);
edit('provided-a','');
assert.equal(Number(fields['provided-a'].value),10000,'leaving an empty field restores the saved split');
fields['provided-a'].value='99999';handlers.change({target:fields['provided-a']});
assert.equal(Number(fields['provided-a'].value),20000,'change events enforce the limit even without a preceding input event');
fields['goal-a'].value='100';handlers.change({target:fields['goal-a']});
assert.equal(fields['provided-a'].max,100);
edit('target-a','500');
assert.equal(Number(fields['target-a'].value),100,'limits follow edits to the total goal');
assert.equal(Number(fields['target-a'].value)+Number(fields['provided-a'].value),100);
console.log('Immediate craft/inventory bounds, paired quantities, invalid edits and changed totals passed.');
