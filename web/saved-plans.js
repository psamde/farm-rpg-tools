/* Named snapshots are separate from the current-plan autosave. */
function suggestedPlanName(settings,catalogItems){
 if(settings?.planner_mode==='passive')return `Passive production · ${settings.production_interval===10?'10 minutes':'1 hour'}`;
 const targets=Object.entries(settings?.targets||{}).filter(([id,q])=>catalogItems[id]&&q>0);
 if(!targets.length)return 'Exploration plan';
 const label=targets.slice(0,2).map(([id,q])=>`${Number(q).toLocaleString()} ${catalogItems[id].name}`).join(' + ')+(targets.length>2?` + ${targets.length-2} more`:'');
 return label.length>100?label.slice(0,99)+'…':label;
}
(() => {
 const key='farm-workshop-saved-plans-v1',list=document.getElementById('savedPlanList'),name=document.getElementById('savedPlanName'),status=document.getElementById('savedPlanStatus');
 let customName=false;
 function suggest(){if(typeof state==='undefined'||!state)return;const label=suggestedPlanName(state,items);name.placeholder=label;if(!customName)name.value=label;}
 name.oninput=()=>{customName=!!name.value.trim();};name.onblur=suggest;
 window.addEventListener('planner-settings-saved',suggest);
 const deleteDialog=document.getElementById('deleteSaveDialog');let pendingDelete=null;
 function read(){const raw=localStorage.getItem(key);if(!raw)return [];const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.plans)||data.plans.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.code!=='string'||!Number.isFinite(p.updated)))throw Error('Could not read saved plans. Existing saves have been left untouched.');return data.plans;}
 function write(plans){try{localStorage.setItem(key,JSON.stringify({version:1,plans}));}catch{throw Error('Browser storage is unavailable or full. Export a code to keep this plan.');}}
 function refresh(id=list.value){const plans=read().sort((a,b)=>b.updated-a.updated);list.replaceChildren(new Option(plans.length?'Choose a saved plan':'No saved plans yet',''));for(const p of plans)list.add(new Option(`${p.name} · ${new Date(p.updated).toLocaleString()}`,p.id));list.value=id;for(const action of ['update','load','rename','delete'])document.getElementById(action+'NamedPlan').disabled=!list.value;return plans;}
 function selected(plans){const p=plans.find(p=>p.id===list.value);if(!p)throw Error('Choose a saved plan first.');return p;}
 function title(){return name.value.trim()||suggestedPlanName(state,items);}
 function snapshot(label){return {id:crypto.randomUUID(),name:label,updated:Date.now(),code:encodePlanCode(validatePlanSettings(state))};}
 function act(fn){try{fn();}catch(e){status.textContent=e.message;if(deleteDialog.open)document.getElementById('deleteSaveError').textContent=e.message;}}
 list.onchange=()=>act(()=>{const plans=refresh();customName=!!list.value;name.value=list.value?selected(plans).name:'';suggest();status.textContent='';});
 document.getElementById('saveNamedPlan').onclick=()=>act(()=>{const plans=read(),p=snapshot(title());plans.push(p);write(plans);refresh(p.id);name.value=p.name;customName=true;status.textContent='Saved in this browser.';});
 document.getElementById('updateNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans);p.code=encodePlanCode(validatePlanSettings(state));p.updated=Date.now();write(plans);refresh(p.id);status.textContent='Saved the current plan over the selected save.';});
 document.getElementById('renameNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans);p.name=title();p.updated=Date.now();write(plans);refresh(p.id);status.textContent='Save renamed.';});
 document.getElementById('deleteNamedPlan').onclick=()=>act(()=>{
  const p=selected(read());pendingDelete=p.id;
  document.getElementById('deleteSaveMessage').textContent=`Delete “${p.name}”? Your current plan will stay open.`;
  document.getElementById('deleteSaveError').textContent='';deleteDialog.showModal();
 });
 document.getElementById('cancelDeleteSave').onclick=()=>{pendingDelete=null;deleteDialog.close();};
 deleteDialog.addEventListener('cancel',()=>{pendingDelete=null;});
 document.getElementById('confirmDeleteSave').onclick=()=>act(()=>{
  if(!pendingDelete)return;
  const plans=read(),id=pendingDelete;
  write(plans.filter(p=>p.id!==id));
  pendingDelete=null;deleteDialog.close();refresh('');name.value='';customName=false;suggest();
  status.textContent='Saved copy deleted. Your current plan is unchanged.';
 });
 document.getElementById('loadNamedPlan').onclick=()=>act(()=>{const plans=read(),p=selected(plans),restored=decodePlanCode(p.code);
  // Keep the current work recoverable without an extra confirmation dialog.
  const backup=snapshot('Before loading '+p.name);if(backup.code!==p.code)plans.push(backup);
  p.updated=Date.now();write(plans);localStorage.setItem('farm-workshop-v1',JSON.stringify(restored));location.reload();
 });
 window.addEventListener('storage',e=>{if(e.key===key)act(()=>refresh());});
 act(()=>refresh());suggest();
})();
