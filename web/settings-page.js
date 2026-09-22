/* Draft editing and saved profiles for the shared account settings page. */
(() => {
 const fields={settingsTheme:'theme',mapTower:'tower_level',craftworksSlots:'craftworks_slots',inventorySize:'inventory_size',resourceSaver:'resource_saver',wanderer:'wanderer',sprintShoes:'sprint_shoes',ironDepot:'iron_depot',runecube:'runecube',cockatriceEtherSource:'cockatrice_ether_source',lemonSqueezer:'lemon_squeezer',cinnamon:'cinnamon'};
 const checkboxes=new Set(['ironDepot','runecube','cockatriceEtherSource','lemonSqueezer','cinnamon']);
 const form=$('globalSettingsFields'),status=$('globalSettingsStatus'),list=$('settingsProfileList'),name=$('settingsProfileName');
 let draft=null,pendingDelete=null;
 form.inert=true;for(const input of form.querySelectorAll('input[type=number]'))input.required=true;
 const snapshot=()=>JSON.stringify(GlobalSettings.pick(state));
 const dirty=()=>draft&&JSON.stringify(draft)!==snapshot();
 const valid=()=>[...form.querySelectorAll('input,select')].every(el=>el.checkValidity());
 function changedDraft(message){
  const changed=!!dirty()||!valid();
  $('applyGlobalSettings').disabled=!changed||!valid();$('discardGlobalSettings').disabled=!changed;
  status.textContent=message||(changed?'Unsaved changes. Save settings to use them in your plans.':'Settings saved in this browser.');
  document.querySelector('.settings-nav').classList.toggle('has-changes',changed);
 }
 function renderZones(){if(!draft)return;ciderSettings(draft);$('areaCount').textContent=`${draft.areas.length} enabled`;}
 function render(){
  if(!draft)return;
  for(const [id,key] of Object.entries(fields)){if(checkboxes.has(id))$(id).checked=draft[key];else $(id).value=draft[key];}
  renderZones();changedDraft();
 }
 function reset(){if(!state)return;draft=GlobalSettings.validate(state,catalog.locations);form.inert=false;render();}
 function current(){
  if(!draft)throw Error('Settings are still loading.');
  const invalid=[...form.querySelectorAll('input,select')].find(el=>!el.checkValidity());
  if(invalid){invalid.reportValidity();throw Error('Check the highlighted setting.');}
  return GlobalSettings.validate(draft,catalog.locations);
 }
 function act(fn,target=status){try{return fn();}catch(e){target.textContent=e.message||'Could not save. Export a code to keep your settings.';}}
 for(const [id,key] of Object.entries(fields)){
  $(id).oninput=$(id).onchange=()=>{
   if(!draft)return;
   draft[key]=checkboxes.has(id)?$(id).checked:id==='settingsTheme'?$(id).value:Number($(id).value);
   if(['cinnamon','sprint_shoes','wanderer'].includes(key)&&$(id).checkValidity())renderZones();
   changedDraft();
  };
 }
 function setEffectiveness(id,value){
  if(!Number.isInteger(value)||value<0||value>10000)return;
  draft.effectiveness_upgrades[id]=value;delete draft.cider_rolls[id];renderZones();changedDraft();
 }
 $('ciderSettings').onchange=e=>{
  if(!draft)return;
  const area=e.target.dataset.locationEnabled;
  if(area){draft.areas=e.target.checked?[...new Set([...draft.areas,area])]:draft.areas.filter(id=>id!==area);renderZones();changedDraft();return;}
  if(e.target.dataset.effect&&e.target.reportValidity())setEffectiveness(e.target.dataset.effect,Number(e.target.value));else changedDraft();
 };
 $('ciderSettings').oninput=e=>{const id=e.target.dataset.effect;if(!id||!draft)return;if(e.target.checkValidity()){draft.effectiveness_upgrades[id]=Number(e.target.value);delete draft.cider_rolls[id];}changedDraft();};
 $('ciderSettings').onclick=e=>{
  const b=e.target.closest('[data-step]');if(!b||!draft)return;
  const id=b.dataset.location,step=Number(b.dataset.step);
  setEffectiveness(id,Number(draft.effectiveness_upgrades[id]||0)+step);
  $('ciderSettings').querySelector(`[data-location="${id}"][data-step="${step}"]`)?.focus();
 };
 $('allAreas').onclick=()=>{if(draft){draft.areas=catalog.locations.map(a=>a.id);renderZones();changedDraft();}};
 $('noAreas').onclick=()=>{if(draft){draft.areas=[];renderZones();changedDraft();}};
 $('applyGlobalSettings').onclick=()=>act(()=>{
  const next=current();applyAccountSettings(next);draft=GlobalSettings.pick(state);render();
  status.textContent='Settings saved. Your plan updates when you return to the planner.';$('settingsProfileStatus').textContent='';$('settingsCodeStatus').textContent='';
 });
 $('discardGlobalSettings').onclick=()=>{reset();status.textContent='Unsaved changes discarded.';};
 function profiles(selected=list.value){
  const entries=GlobalSettings.readProfiles().sort((a,b)=>b.updated-a.updated);
  list.replaceChildren(new Option(entries.length?'Choose a settings profile':'No saved profiles yet',''));
  for(const p of entries)list.add(new Option(p.name,p.id));
  list.value=selected;
  for(const id of ['updateSettingsProfile','loadSettingsProfile','deleteSettingsProfile'])$(id).disabled=!list.value;
  return entries;
 }
 function selected(entries){const p=entries.find(p=>p.id===list.value);if(!p)throw Error('Choose a settings profile first.');return p;}
 const profileStatus=$('settingsProfileStatus');
 list.onchange=()=>act(()=>{const entries=profiles();name.value=list.value?selected(entries).name:'';profileStatus.textContent='';},profileStatus);
 $('saveSettingsProfile').onclick=()=>act(()=>{
  const code=GlobalSettings.encode(current()),entries=GlobalSettings.readProfiles();
  const p={id:crypto.randomUUID(),name:name.value.trim()||'My farm',updated:Date.now(),code};
  entries.push(p);GlobalSettings.writeProfiles(entries);profiles(p.id);name.value=p.name;
  profileStatus.textContent='Profile saved.'+(dirty()?' Click Save settings to apply these values.':'');
 },profileStatus);
 $('updateSettingsProfile').onclick=()=>act(()=>{
  const code=GlobalSettings.encode(current()),entries=GlobalSettings.readProfiles(),p=selected(entries);
  Object.assign(p,{code,name:name.value.trim()||p.name,updated:Date.now()});GlobalSettings.writeProfiles(entries);profiles(p.id);
  profileStatus.textContent='Profile updated.'+(dirty()?' Click Save settings to apply these values.':'');
 },profileStatus);
 $('loadSettingsProfile').onclick=()=>act(()=>{
  const p=selected(GlobalSettings.readProfiles());draft=GlobalSettings.decode(p.code,catalog.locations);render();
  profileStatus.textContent=`Loaded “${p.name}”. ${dirty()?'Click Save settings to apply it.':'These settings are already active.'}`;
 },profileStatus);
 $('deleteSettingsProfile').onclick=()=>act(()=>{
  const p=selected(GlobalSettings.readProfiles());pendingDelete=p.id;
  $('deleteSettingsMessage').textContent=`Delete “${p.name}”? Your active settings will stay.`;$('deleteSettingsError').textContent='';$('deleteSettingsDialog').showModal();
 },profileStatus);
 $('cancelDeleteSettings').onclick=()=>{pendingDelete=null;$('deleteSettingsDialog').close();};
 $('deleteSettingsDialog').addEventListener('cancel',()=>{pendingDelete=null;});
 $('confirmDeleteSettings').onclick=()=>act(()=>{
  if(!pendingDelete)return;
  GlobalSettings.writeProfiles(GlobalSettings.readProfiles().filter(p=>p.id!==pendingDelete));pendingDelete=null;
  $('deleteSettingsDialog').close();profiles('');name.value='';profileStatus.textContent='Profile deleted. Your active settings are unchanged.';
 },$('deleteSettingsError'));
 $('generateSettingsCode').onclick=()=>act(()=>{$('settingsCode').value=GlobalSettings.encode(current());$('settingsCodeStatus').textContent='Code generated. Keep it somewhere safe.';},$('settingsCodeStatus'));
 $('copySettingsCode').onclick=async()=>{
  if(!$('settingsCode').value)$('generateSettingsCode').click();if(!$('settingsCode').value)return;
  try{await navigator.clipboard.writeText($('settingsCode').value);$('settingsCodeStatus').textContent='Settings code copied.';}
  catch{$('settingsCode').select();$('settingsCodeStatus').textContent='Select and copy the code.';}
 };
 $('loadSettingsCode').onclick=()=>act(()=>{
  draft=GlobalSettings.decode($('settingsCode').value,catalog.locations);render();
  $('settingsCodeStatus').textContent=dirty()?'Code loaded. Click Save settings to apply it.':'These settings are already active.';
 },$('settingsCodeStatus'));
 window.addEventListener('global-settings-ready',reset);
 window.addEventListener('global-settings-applied',reset);
 $('themeToggle').onclick=()=>{
  if(!state)return;
  act(()=>{
   const pending=dirty(),previous=draft,next=state.theme==='dark'?'light':'dark';
   GlobalSettings.write({...state,theme:next},catalog.locations);state.theme=next;theme();save();
   if(pending){draft=previous;draft.theme=next;render();}else reset();
  });
 };
 window.addEventListener('app-page-changed',()=>{if(draft)changedDraft();});
 window.addEventListener('storage',e=>{
  if(e.key===GlobalSettings.profilesKey)act(()=>profiles(),profileStatus);
  if(e.key===GlobalSettings.key&&state)act(()=>{
   const pending=dirty(),previous=draft;
   // Applying an account update also invalidates the current plan, but preserves
   // any deliberate local edits until Save or Discard.
   applyAccountSettings(GlobalSettings.read(catalog.locations));
   if(pending){draft=previous;render();status.textContent='Settings changed in another tab. Save your edits to replace them, or discard to use the new settings.';}
  });
 });
 act(()=>profiles(),profileStatus);
 if(typeof state!=='undefined'&&state&&catalog)reset();
})();
