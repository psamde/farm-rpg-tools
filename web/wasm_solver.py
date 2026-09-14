"""SciPy-shaped adapter to the current HiGHS WASM solver; models stay Python."""
import json
import numpy as np
from scipy.optimize import OptimizeResult

def install(highs_solve):
    def milp(c, *, integrality=None, bounds=None, constraints=None, options=None):
        c=np.asarray(c,dtype=float); n=len(c)
        integral=np.broadcast_to(0 if integrality is None else integrality,(n,))
        lower=np.broadcast_to(0 if bounds is None else bounds.lb,(n,))
        upper=np.broadcast_to(np.inf if bounds is None else bounds.ub,(n,))
        def expression(coefficients):
            return ' '.join(('+' if q>=0 else '-')+' '+format(abs(float(q)),'.17g')+' x'+str(i) for i,q in enumerate(coefficients) if q) or '0 x0'
        lines=['Minimize','obj: '+expression(c),'Subject To']; rows=[]
        if constraints is not None:
            cs=constraints if isinstance(constraints,(tuple,list)) else [constraints]
            for con in cs:
                a=con.A.toarray() if hasattr(con.A,'toarray') else np.atleast_2d(con.A)
                lo=np.broadcast_to(con.lb,(len(a),));hi=np.broadcast_to(con.ub,(len(a),))
                for row,l,h in zip(a,lo,hi):
                    if np.isfinite(l):rows.append(expression(row)+' >= '+format(float(l),'.17g'))
                    if np.isfinite(h):rows.append(expression(row)+' <= '+format(float(h),'.17g'))
        lines += ['r'+str(i)+': '+r for i,r in enumerate(rows)]
        lines.append('Bounds')
        for i,(l,h) in enumerate(zip(lower,upper)):
            lines.append((format(float(l),'.17g') if np.isfinite(l) else '-inf')+' <= x'+str(i)+' <= '+(format(float(h),'.17g') if np.isfinite(h) else 'inf'))
        ints=['x'+str(i) for i,q in enumerate(integral) if q]
        if ints:lines+=['Generals',' '.join(ints)]
        lines.append('End')
        opts={'output_flag':False,'mip_rel_gap':0.0}
        for key in ('time_limit','mip_rel_gap','mip_abs_gap'):
            if options and key in options:opts[key]=options[key]
        if options and options.get('presolve') is False:opts['presolve']='off'
        result=json.loads(highs_solve('\n'.join(lines),json.dumps(opts)))
        status=result['Status']; success=status=='Optimal'
        code=0 if success else 2 if status=='Infeasible' else 3 if 'Unbounded' in status else 1
        values=np.array([result.get('Columns',{}).get('x'+str(i),{}).get('Primal',0) for i in range(n)])
        return OptimizeResult(success=success,status=code,message=status,x=values,fun=float(c@values))
    import scipy.optimize
    scipy.optimize.milp=milp
