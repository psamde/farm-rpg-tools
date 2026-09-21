from copy import deepcopy
import json
import time
from collections import OrderedDict
_PRIMARY_CACHE = OrderedDict()
_CACHE_CATALOG = None

from planner import plan, ranked_plans, passive_plans
from secondary import consume_leftovers

# Match bbybxx/farm src/utils/exploringUtils.js Cockatrice effect.
COCKATRICE_ITEMS = frozenset(('Fire Ant', 'Caterpillar', 'Spider', 'Horned Beetle',
    'Shiny Beetle', 'Snail', 'Giant Centipede', 'Ruby Scorpion', 'Onyx Scorpion'))
_PERK_CATALOG = (None, None)
_SAVINGS_CACHE = OrderedDict()


def target_inventory_savings(catalog, payload, result, deferred=None):
    """Marginal primary-route savings, with shared drops and reserved stock.

    Optional comparisons never fail an otherwise usable plan. They run after
    the route is published and reuse results when only leftover crafts change.
    """
    goals = payload.get('targets', {})
    if not goals or payload.get('planner_mode') == 'passive':
        return
    common = {k: payload[k] for k in ('areas', 'inventory', 'iron_depot', 'runecube', 'resource_saver') if k in payload}
    key = (id(catalog), json.dumps([goals, common], sort_keys=True))
    cached = _SAVINGS_CACHE.get(key)
    if cached is not None:
        result['inventory_savings'] = deepcopy(cached)
        return
    comparison = dict(baseline_explores=None, items={}, complete=False)
    result['inventory_savings'] = comparison
    def baseline():
        try:
            comparison['baseline_explores'] = plan(catalog, goals, suggest_inventory=False, **common)['optimal_total_explores']
        except ValueError:
            comparison['unavailable'] = True
    def batch(refs):
        if not comparison.get('unavailable'):
            for ref in refs:
                stock = dict(common.get('inventory', {}))
                # Same reservation as the UI: owned finished items cannot also
                # be consumed by another target in this comparison.
                if ref in stock:
                    stock[ref] = max(0, stock[ref] - goals[ref])
                remaining = {i: q for i, q in goals.items() if i != ref}
                try:
                    after = plan(catalog, remaining, suggest_inventory=False, **dict(common, inventory=stock))['optimal_total_explores'] if remaining else 0
                    comparison['items'][ref] = dict(explores_saved=comparison['baseline_explores']-after, explores_after=after)
                except ValueError:
                    comparison['items'][ref] = dict(unavailable=True)
    def finish():
        comparison['complete'] = True
        _SAVINGS_CACHE[key] = deepcopy(comparison)
        while len(_SAVINGS_CACHE) > 4:
            _SAVINGS_CACHE.popitem(last=False)
    jobs = [baseline]
    refs = list(goals)
    jobs.extend(lambda refs=refs[i:i+4]: batch(refs) for i in range(0, len(refs), 4))
    jobs.append(finish)
    if deferred is not None:
        deferred.extend(jobs)
    else:
        for job in jobs:
            job()

def catalog_with_perks(catalog, payload):
    """Boost yields, not probabilities; never mutate or repeatedly boost base data."""
    global _PERK_CATALOG
    if not payload.get('cockatrice_ether_source') or catalog.get('_cockatrice_applied'):
        return catalog
    if _PERK_CATALOG[0] is catalog:
        return _PERK_CATALOG[1]
    boosted = dict(catalog, sources={
        key: dict(source, expected_drops_per_explore=source['expected_drops_per_explore'] * 2)
        if source.get('kind') == 'explore' and source.get('expected_drops_per_explore') is not None
        and catalog['items'][source['item_id']]['name'] in COCKATRICE_ITEMS else source
        for key, source in catalog['sources'].items()}, _cockatrice_applied=True)
    _PERK_CATALOG = (catalog, boosted)
    return boosted


def compute(catalog, payload, progress=lambda done,total: None, deferred=None):
    global _CACHE_CATALOG
    catalog = catalog_with_perks(catalog, payload)
    started = time.perf_counter()
    # Old saved area limits no longer restrict either phase.
    payload = dict(payload, max_areas=len(catalog['locations']))
    for name, default in dict(planner_mode='goals', inventory={}, iron_depot=False, runecube=False, resource_saver=0, combinations_mode=False).items():
        payload.setdefault(name, default)
    if _CACHE_CATALOG is not catalog:
        _PRIMARY_CACHE.clear()
        _SAVINGS_CACHE.clear()
        _CACHE_CATALOG = catalog
    key = json.dumps({k: payload.get(k) for k in ('planner_mode','targets','areas','inventory','iron_depot','runecube','resource_saver','max_areas','combinations_mode')}, sort_keys=True)
    hit = key in _PRIMARY_CACHE
    common = dict(areas=payload['areas'], inventory=payload.get('inventory', {}),
                  iron_depot=payload.get('iron_depot', False), runecube=payload.get('runecube', False),
                  resource_saver=payload.get('resource_saver', 0))
    if hit:
        result = deepcopy(_PRIMARY_CACHE[key])
    else:
        if payload.get('planner_mode') == 'passive' or not payload.get('targets'):
            result = passive_plans(catalog, max_areas=payload.get('max_areas',3), **common)
            result['production_interval'] = payload.get('production_interval',60)
        else:
            result = ranked_plans(catalog, payload['targets'], max_areas=payload.get('max_areas', 3),
                                  combinations_mode=payload.get('combinations_mode', False), progress=progress, **common)
        _PRIMARY_CACHE[key] = deepcopy(result)
        while len(_PRIMARY_CACHE) > 4:
            _PRIMARY_CACHE.popitem(last=False)
    if payload.get('planner_mode') == 'passive':
        result['production_interval'] = payload.get('production_interval',60)
    progress(0, None)
    if payload.get('secondary'):
        for i, primary in enumerate(result['plans']):
            progress(0, None)
            result['plans'][i] = consume_leftovers(catalog, primary, payload['secondary'], areas=sorted((set(payload['automatic_areas']) & set(payload['areas']) if payload.get('automatic_areas') is not None else set(payload['areas'])) | {a['location_id'] for a in primary['areas']}), max_areas=payload.get('max_areas', 3), progress=lambda: progress(0, None), defer_comparison=deferred.append if deferred is not None else None, map_planning=payload.get("map_planning", False), map_sources=payload.get("map_sources"), map_source_explores=payload.get("map_source_explores"), map_node_usage=payload.get("map_node_usage"))
    result['plans'].sort(key=lambda p: (p['optimal_total_explores'], len(p['areas'])))
    unique = {}
    for p in result['plans']:
        signature = (tuple(sorted((a['location_id'], a['explores']) for a in p['areas'])),
                     tuple((t['item_id'], t['crafts']) for t in p.get('secondary', {}).get('targets', [])))
        unique.setdefault(signature, p)
    result['plans'] = list(unique.values())
    result['enumeration']['feasible_options'] = len(result['plans'])
    result['performance'] = dict(primary_cache_hit=hit, compute_seconds=time.perf_counter()-started)
    if payload.get('estimate_inventory_savings'):
        target_inventory_savings(catalog, payload, result, deferred)
    return result


def automatic_compute(catalog, payload, progress=lambda message: None):
    from automatic import maximize
    catalog = catalog_with_perks(catalog, payload)
    baseline = compute(catalog, dict(payload, secondary=[]), lambda done,total: progress(f'Preparing primary route: {done} of {total}…' if total else 'Preparing primary route…'))
    primary = next((p for p in baseline['plans'] if p['area_set_id']==payload.get('selected_plan_key')), baseline['plans'][0])
    return maximize(catalog, primary, payload['areas'], payload.get('max_extra_locations',1), progress)


def guided_compute(catalog, payload, progress=lambda message: None):
    """Evaluate alternatives independently against the same primary/shared pool."""
    catalog = catalog_with_perks(catalog, payload)
    progress('Preparing the primary route (reusing it when cached)…')
    baseline = compute(catalog, dict(payload, secondary=[]), lambda done,total: progress(f'Checking primary routes: {done}…') if done else None)
    primary = next((p for p in baseline['plans'] if p['area_set_id']==payload.get('selected_plan_key')), baseline['plans'][0])
    goals = payload.get('secondary', [])
    areas = sorted((set(payload.get('automatic_areas') or payload['areas']) & set(payload['areas'])) | {a['location_id'] for a in primary['areas']})
    def allocate(gs, source_choices=None, source_amounts=None, node_usage=None):
        return consume_leftovers(catalog, primary, gs, areas=areas, defer_comparison=lambda _:None,
            map_planning=payload.get("map_planning", False),
            map_sources=payload.get("map_sources") if source_choices is None else source_choices,
            map_source_explores=payload.get("map_source_explores") if source_amounts is None else source_amounts,
            map_node_usage=payload.get("map_node_usage") if node_usage is None else node_usage) if gs else deepcopy(primary)
    current = allocate(goals, payload.get('previous_map_sources'), payload.get('previous_map_source_explores'), payload.get('previous_map_node_usage'))
    before = {b['item_id']:b for b in current['item_balances']}
    old_outputs = {g['item_id']:g['crafts'] for g in current.get('secondary',{}).get('targets',[])}
    if payload.get('chosen_goals') or 'replacement_goals' in payload:
        replacement = 'replacement_goals' in payload
        chosen = payload['replacement_goals'] if replacement else payload['chosen_goals']
        refs = [g['item_id'] for g in chosen]
        if len(set(refs)) != len(refs) or set(refs) & ((set() if replacement else set(old_outputs)) | set(payload.get('targets',{}))):
            raise ValueError('Choose each new leftover craft only once.')
        progress('Checking your selected crafts together…')
        plan = allocate(chosen if replacement else [*goals, *chosen])
        outputs = {g['item_id']:g['crafts'] for g in plan.get('secondary',{}).get('targets',[])}
        balances={b['item_id']:b for b in plan['item_balances']}
        return dict(preview_plan=plan, replacement=replacement, goals=chosen, outputs=[dict(item_id=r,crafts=outputs.get(r,0),remaining=balances.get(r,{}).get('expected_final_inventory',0)) for r in refs],
            total_explores=plan['optimal_total_explores'],
            extra_explores=plan['optimal_total_explores']-current['optimal_total_explores'],
            new_locations=sorted({a['location_id'] for a in plan['areas']}-{a['location_id'] for a in current['areas']}),
            reduced=[dict(item_id=r,before=q,after=outputs.get(r,0)) for r,q in old_outputs.items() if outputs.get(r,0)<q-1e-6])
    options, failures = [], []
    for i, candidate in enumerate(payload.get('candidates', [])[:30]):
        progress(f'Checking crafting option {i+1} of {min(30,len(payload["candidates"]))}…')
        ref = str(candidate['item_id'])
        if ref in payload.get('targets',{}) or any(g['item_id']==ref for g in goals):continue
        goal = dict(item_id=ref,cap=int(candidate['cap']),allow_exploration=bool(candidate.get('allow_exploration')),automatic_batch=True)
        if goal['cap']<1:continue
        try:
            plan = allocate([*goals,goal])
            outputs={g['item_id']:g['crafts'] for g in plan.get('secondary',{}).get('targets',[])}
            if outputs.get(ref,0)<1:continue
            used={}
            for b in plan['item_balances']:
                old=before.get(b['item_id'],{})
                # Credit only net consumption of supplies already available, not
                # additional drops or newly made intermediary ingredients.
                net=(b['consumed_by_crafting']-old.get('consumed_by_crafting',0))-(b['crafted']-old.get('crafted',0))
                used[b['item_id']]=min(max(0,old.get('expected_unused',old.get('expected_final_inventory',0)-old.get('reserved_target_output',0))),max(0,net))
            focus=used.get(str(payload['material']),0)
            if focus<1e-6:continue
            options.append(dict(goal=goal,crafts=outputs[ref],material_used=focus,materials_used=sum(used.values()),
                extra_explores=plan['optimal_total_explores']-current['optimal_total_explores'],
                total_explores=plan['optimal_total_explores'],
                new_locations=sorted({a['location_id'] for a in plan['areas']}-{a['location_id'] for a in current['areas']}),
                reduced=[dict(item_id=r,before=q,after=outputs.get(r,0)) for r,q in old_outputs.items() if outputs.get(r,0)<q-1e-6],
                remaining_material=next((b.get('expected_unused',0) for b in plan['item_balances'] if b['item_id']==str(payload['material'])),0)))
        except ValueError as error:
            failures.append(dict(item_id=ref,message=str(error)))
    options.sort(key=lambda o:(-o['material_used'],-o['materials_used'],o['extra_explores'],len(o['new_locations'])))
    return dict(options=options,failures=failures,baseline_explores=current['optimal_total_explores'])
