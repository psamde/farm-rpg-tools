const fs=require('fs');(async()=>{const h=await require('./web/vendor/highs/highs.js')();const r=h.solve(fs.readFileSync('../../work/slow-90001-689.lp','utf8'),{output_flag:true,log_to_console:true,mip_rel_gap:0,time_limit:60});console.log('RESULT',r.Status,r.ObjectiveValue);})()

