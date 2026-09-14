/* Named snapshots are separate from the current-plan autosave. */
(() => {
 const key='farm-workshop-saved-plans-v1',list=document.getElementById('savedPlanList'),name=document.getElementById('savedPlanName'),status=document.getElementById('savedPlanStatus');
 function read(){const raw=localStorage.getItem(key);if(!raw)return [];const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.plans)||data.plans.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.code!=='string'||!Number.isFinite(p.updated)))throw Error('Could not read saved plans. Existing saves have been left untouched.');return data.plans;}
 function write(plans){try{localStorage.setItem(key,JSON.stringify({version:1,plans}));}catch{throw Error('Browser storage is unavailable or full. Export a code to keep this plan.');}}
 function refresh(id=list.value){const plans=read().sort((a,b)=>b.updated-a.updated);list.replaceChildren(new Option(plans.length?'Choose a saved plan':'No saved plans yet',''));for(const p of plans)list.add(new Option(`${p.name} · ${new Date(p.updated).toLocaleString()}`,p.id));list.value=id;for(const action of ['update','load','rename','delete'])document.getElementById(action+'NamedPlan').disabled=!list.value;return plans;}
 function selected(plans){const p=plans.find(p=>p.id===list.value);if(!p)throw Error('Choose a saved plan first.');return p;}
 function title(){return name.value.trim()||'Untitled plan';}
 function snapshot(label){return {id:crypto.randomUUID(),name:label,updated:Date.now(),code:encodePlanCode(validatePlanSettings(state))};}
 function act(fn){try{fn();}catch(e){status.textContent=e.message;}}
 list.onchange=()=>act(()=>{const plans=refresh();name.value=list.value?selected(plans).name:'';status.textContent='';});
 document.getElementById('saveNamedPlan').onclick=()=>act(()=>{const plans=read(),p=snapshot(title());plans.push(p);write(plans);refresh(p.id);name.value=p.name;status.textContent='Saved in this browser.';});
 document.getElementById('updateNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans);p.code=encodePlanCode(validatePlanSettings(state));p.updated=Date.now();write(plans);refresh(p.id);status.textContent='Saved the current plan over the selected save.';});
 document.getElementById('renameNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans);p.name=title();p.updated=Date.now();write(plans);refresh(p.id);status.textContent='Save renamed.';});
 document.getElementById('deleteNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans);if(!confirm(`Delete “${p.name}”? Your current plan will stay open.`))return;write(plans.filter(row=>row.id!==p.id));refresh('');name.value='';status.textContent='Saved copy deleted. Your current plan is unchanged.';});
 document.getElementById('loadNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans),restored=decodePlanCode(p.code);
  // Keep the current work recoverable without an extra confirmation dialog.
  const backup=snapshot('Before loading '+p.name);if(backup.code!==p.code)plans.push(backup);
  p.updated=Date.now();write(plans);localStorage.setItem('farm-workshop-v1',JSON.stringify(restored));location.reload();
 });
 window.addEventListener('storage',e=>{if(e.key===key)act(()=>refresh());});
 act(()=>refresh());
})();
