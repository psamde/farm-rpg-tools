"""Isolated continuous net-surplus experiment; never imported by the app.

All supplies and crafts share one physical ledger. Lexicographically minimize
remaining anchor equivalents, then exploration, then allocate finished outputs.
Intermediates retain their embedded anchor value, so making unused bottles
cannot pretend to consume a raw ingredient. Quantities are expectations, NOT
an executable whole-craft route. See README.md for deliberately unsupported
semantics and benchmark conclusions.
"""
from collections import Counter
from functools import lru_cache
import math
import time


def optimize(catalog, primary, goals, areas=None, *, explore_budget=None, integer=False, objective_mode='net_surplus'):
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp
    from secondary import validate_secondary
    goals = validate_secondary(catalog, goals)
    if objective_mode not in ('net_surplus','budgeted_crafts'):
        raise ValueError('Unknown experimental objective')
    if explore_budget is not None and (not math.isfinite(explore_budget) or explore_budget < 0):
        raise ValueError('Explore budget must be finite and nonnegative')
    if objective_mode=='budgeted_crafts' and explore_budget is None:
        raise ValueError('Maximizing crafts requires an explicit finite exploration budget')
    items = catalog['items']
    factor = 1 / (1 + primary['assumptions']['resource_saver'] / 100)
    free = {x['id'] for x in primary['assumptions']['unlimited_free_items']}
    stock = Counter({b['item_id']: b['starting_inventory'] + b.get('required_external_supply', 0)
                     for b in primary['item_balances']})
    reserve = Counter({b['item_id']: b['reserved_target_output'] for b in primary['item_balances']})
    roots = set(reserve) | {g['item_id'] for g in goals}
    refs = set()
    active = set()
    def visit(ref):
        if ref in active:
            raise ValueError('Recipe cycle')
        if ref in refs: return
        active.add(ref)
        for child in items[ref]['direct_ingredients']: visit(child)
        active.remove(ref)
        refs.add(ref)
    for ref in roots: visit(ref)
    allowed = set(areas) if areas is not None else {k for k,v in catalog['locations'].items() if v['kind']=='explore'}
    rates = {a: Counter() for a in sorted(allowed)}
    for s in catalog['sources'].values():
        if s['kind'] != 'explore' or s['location_id'] not in rates: continue
        cond = s['conditions']
        if cond.get('frozen') or any(cond.get(k) is not None and cond[k] != v for k,v in
            [('ironDepot',primary['assumptions'].get('iron_depot',False)),
             ('runecube',primary['assumptions'].get('runecube',False)),('manualFishing',False)]): continue
        if s['item_id'] in rates[s['location_id']]: raise ValueError('Ambiguous drops')
        rates[s['location_id']][s['item_id']] = s['expected_drops_per_explore']
    # Keep every byproduct in the ledger, including craftable exploration drops.
    for drops in rates.values():
        for ref in drops: visit(ref)
    refs.update(stock)
    refs = sorted(refs - free)
    craft_refs = sorted(r for r in refs if items[r]['craftable'])
    keys = ([('explore',a) for a in rates] + [('craft',r) for r in craft_refs]
            + [('output',g['item_id']) for g in goals] + [('unused',r) for r in refs])
    indices = {key:i for i,key in enumerate(keys)}
    n = len(keys)
    integral = np.array([int(integer and kind in ('craft','explore')) for kind,ref in keys])
    def vector(): return np.zeros(n)
    lo, hi = np.zeros(n), np.full(n, np.inf)
    for g in goals:
        if g['cap'] is not None: hi[indices['craft',g['item_id']]] = g['cap']
    matrix, rhs = [], []
    for ref in refs:
        row = vector()
        for a,drops in rates.items(): row[indices['explore',a]] = drops[ref]
        for c in craft_refs:
            row[indices['craft',c]] = ((items[c]['output_quantity'] if c==ref else 0)
                - items[c]['direct_ingredients'].get(ref,0)*factor)
        if ('output',ref) in indices: row[indices['output',ref]] = -1
        row[indices['unused',ref]] = -1
        matrix.append(row); rhs.append(reserve[ref]-stock[ref])
    matrix, rhs = np.array(matrix), np.array(rhs)
    locks = [LinearConstraint(matrix,rhs,rhs)]
    cost = vector()
    for a in rates: cost[indices['explore',a]] = 1
    if explore_budget is not None: locks.append(LinearConstraint(cost,0,explore_budget))
    stages = []
    started = time.perf_counter()
    def solve(objective, label, lock=True):
        then = time.perf_counter()
        result = milp(objective, integrality=integral, bounds=Bounds(lo,hi), constraints=locks,
                      options={'time_limit':20,'presolve':True})
        if not result.success: raise ValueError(label+': '+result.message)
        value = float(objective @ result.x)
        stages.append({'stage':label,'seconds':time.perf_counter()-then,'objective':value})
        if lock:
            tolerance = max(1e-5, abs(value)*1e-9)
            locks.append(LinearConstraint(objective,-np.inf,value+tolerance))
        return result.x
    @lru_cache(None)
    def raw_cost(ref):
        if ref in free: return {}
        if not items[ref]['craftable']: return {ref:1.0}
        result = Counter()
        for child,q in items[ref]['direct_ingredients'].items():
            for raw,need in raw_cost(child).items(): result[raw] += need*q*factor/items[ref]['output_quantity']
        return dict(result)
    anchors = []
    rewarded = set()
    for g in goals:
        if not g['allow_exploration']: continue
        if objective_mode=='budgeted_crafts':
            objective = vector(); objective[indices['craft',g['item_id']]] = -1
            solve(objective,'budget priority '+items[g['item_id']]['name'])
            continue
        anchor = g.get('exploration_item_id')
        if anchor is None: raise ValueError('Prototype requires an explicit ingredient for extra exploration')
        leaves = raw_cost(anchor)
        if len(leaves) != 1:
            raise ValueError('Prototype only supports raw or single-raw-ingredient anchors: '+items[anchor]['name'])
        raw, conversion = next(iter(leaves.items()))
        rewarded.add(g['item_id'])
        objective = vector()
        for r in refs: objective[indices['unused',r]] = raw_cost(r).get(raw,0)/conversion
        for other in goals:
            if other['item_id'] not in rewarded:
                objective[indices['output',other['item_id']]] = raw_cost(other['item_id']).get(raw,0)/conversion
        solve(objective,'remaining '+items[anchor]['name'])
        anchors.append((anchor,objective.copy()))
    x = solve(cost,'minimum explores')
    # Total exploring fixed (within numerical tolerance) before leftovers-only
    # allocation. Equal-cost area substitutions remain possible.
    for g in goals:
        objective = vector(); objective[indices['craft',g['item_id']]] = -1
        x = solve(objective,'priority '+items[g['item_id']]['name'])
    cleanup = vector()
    for r in craft_refs: cleanup[indices['craft',r]] = 1
    x = solve(cleanup,'remove unnecessary crafts',lock=False)
    error = float(np.max(np.abs(matrix@x-rhs)))
    violation = 0.0
    for con in locks:
        ax = con.A@x
        violation = max(violation,float(np.max(np.maximum(con.lb-ax,0))),float(np.max(np.maximum(ax-con.ub,0))))
    if error > 1e-5 or violation > 1e-5 or np.min(x)<-1e-5: raise ValueError('Verification failed')
    return {'seconds':time.perf_counter()-started,'integer':integer,'objective_mode':objective_mode,
        'explore_budget':explore_budget,'variables':n,'rows':len(matrix),
        'balance_error':error,'constraint_violation':violation,'explores':float(cost@x),
        'areas':{a:float(x[indices['explore',a]]) for a in rates if x[indices['explore',a]]>1e-5},
        'crafts':{r:float(x[indices['craft',r]]) for r in craft_refs},
        'outputs':{g['item_id']:float(x[indices['output',g['item_id']]]) for g in goals},
        'unused':{r:max(0,float(x[indices['unused',r]])) for r in refs},
        'anchor_residuals':{a:float(obj@x) for a,obj in anchors},'stages':stages}
