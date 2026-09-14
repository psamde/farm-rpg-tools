// Optional solver experiments. The original one-shot solver remains the default.
function solverExperiments(highs){
 let flags={},models=new Map(),stats={};
 function configure(next){flags=next||{};stats={calls:0,reused:0,seeded:0};if(!flags.reuse_models){for(const e of models.values())e.model.dispose();models.clear();}}
 function solve(lp,options){
  stats.calls++;
  if(!flags.reuse_models&&!flags.fractional_start)return highs.solve(lp,options);
  const objective=lp.split('\n')[1],body=lp.slice(lp.indexOf('Subject To'));
  let entry=flags.reuse_models?models.get(body):null;
  const names=[...lp.matchAll(/^.* <= (x\d+) <= /gm)].map(m=>m[1]);
  if(entry){stats.reused++;for(const name of names)entry.model.changeColCost(entry.index[name],0);for(const m of objective.matchAll(/([+-]) ([\d.eE+-]+) (x\d+)/g))entry.model.changeColCost(entry.index[m[3]],Number(m[2])*(m[1]==='-'?-1:1));}
  else{const model=highs.createModel({format:'lp',data:lp});entry={model,index:Object.fromEntries(names.map(n=>[n,model.getColByName(n)]))};if(flags.reuse_models){models.set(body,entry);if(models.size>8){const key=models.keys().next().value;models.get(key).model.dispose();models.delete(key);}}}
  const model=entry.model;
  try{
   model.options.set({output_flag:false,presolve:'on',mip_rel_gap:0,mip_abs_gap:1e-6,...options});model.zeroAllClocks();
   if(flags.fractional_start&&lp.includes('\nGenerals\n')){
    const relaxed=highs.createModel({format:'lp',data:lp.replace(/\nGenerals\n[^]*?\nEnd/,'\nEnd')});
    try{relaxed.options.set({output_flag:false,time_limit:2});relaxed.run();if(relaxed.getModelStatus()===highs.constants.modelStatus.optimal){const values=relaxed.getSolution().colValue,seed=new Float64Array(names.length);for(const n of names)seed[entry.index[n]]=values[relaxed.getColByName(n)];model.setSolution({colValue:seed});stats.seeded++;}}finally{relaxed.dispose();}
   }
   model.run();const status=model.getModelStatus(),ms=highs.constants.modelStatus;
   const Status=status===ms.optimal?'Optimal':status===ms.infeasible?'Infeasible':status===ms.unbounded?'Unbounded':status===ms.timeLimit?'Time limit reached':'Solver status '+status;
   const values=model.getSolution().colValue;
   return {Status,Columns:Object.fromEntries(names.map(n=>[n,{Primal:values[entry.index[n]]}]))};
  }finally{if(!flags.reuse_models)model.dispose();}
 }
 return {configure,solve,stats:()=>({...stats})};
}
if(typeof module!=='undefined')module.exports={solverExperiments};
