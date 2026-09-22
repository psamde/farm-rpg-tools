"""Loopback-only UI and JSON API for the local FarmData planner."""
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
from uuid import uuid4

from browser_engine import catalog_with_perks, target_inventory_savings, credit_external_targets
from farmdata import read_json
from planner import plan, ranked_plans, resolve, exploration_target_ids, passive_plans, calculation_error
from secondary import validate_secondary, consume_leftovers

ROOT = Path(__file__).parent


class Application:
    def __init__(self, catalog):
        self.catalog = catalog
        self.jobs = {}
        self.lock = Lock()
        self.pool = ThreadPoolExecutor(max_workers=1)

    def metadata(self):
        mail_path = ROOT / 'web/mailable-items.json'
        mail_levels = {i['id']: i.get('min_mailable_level', 0)
                       for i in read_json(mail_path)['items']} if mail_path.exists() else {}
        def effort_fields(item):
            sources = [self.catalog['sources'][s] for s in item.get('source_ids', [])]
            return dict(mailable=any(s['kind'] == 'trading' for s in sources),
                        min_mailable_level=item.get('min_mailable_level') or mail_levels.get(item['id'], 0),
                        sources=[{k: s[k] for k in ('kind', 'location_id', 'actions_per_drop', 'conditions') if k in s}
                                 for s in sources if s['kind'] in ('explore', 'fishing', 'farming', 'mining')])
        buildings = ['Sawmill', 'Orchard', 'Quarry', 'Hay Field',
                     'Chicken Coop', 'Cow Pasture', 'Raptor Pen', 'Vineyard', 'Worm Habitat', 'Trout/Bait Farm']
        workshop_ingredients = {ref for item in self.catalog['items'].values()
                                if item['craftable'] for ref in item['direct_ingredients']}
        guaranteed_intervals = {'hourly', 'daily', '10 minutes'}
        passive = {}
        for source in self.catalog['sources'].values():
            details = source.get('details', {})
            building = details.get('lineOne')
            if (source['kind'] == 'manual_production' and building in buildings
                    and str(details.get('value', '')).strip().lower() in guaranteed_intervals
                    and source['item_id'] in workshop_ingredients):
                ref = source['item_id']
                passive.setdefault(ref, {'item_id': ref, 'sources': []})['sources'].append(building)
        # Buddy's snapshot omits the bait-production source for Minnows.
        # Keep this explicit supplement recipe-filtered; never infer random outputs.
        for item in self.catalog['items'].values():
            if item['name'] == 'Minnows' and item['id'] in workshop_ingredients:
                passive.setdefault(item['id'], {'item_id': item['id'], 'sources': ['Trout/Bait Farm']})
        return {'planner_api_version': 2, 'effort_locations': self.catalog['locations'], 'items': [{'id': i, 'name': x['name'], 'image': x.get('image'), 'craftable': x['craftable'], 'explorable': i in exploration_target_ids(self.catalog), **effort_fields(x),
                           'farm_produced': x.get('type') == 'crop',
                           'output_quantity': x['output_quantity'], 'raw_materials': x['raw_materials'], 'direct_ingredients': x['direct_ingredients']}
                          for i, x in self.catalog['items'].items()],
                'locations': [{**x, 'image': read_json(ROOT / 'data/location-icons.json').get(x['id'])} for x in self.catalog['locations'].values() if x['kind'] == 'explore'],
                'snapshot': self.catalog['snapshot_sha256'],
                'passive_inputs': sorted(passive.values(), key=lambda x: (buildings.index(x['sources'][0]), self.catalog['items'][x['item_id']]['name']))}

    def consumers(self, ref):
        ref = resolve(self.catalog['items'], ref)
        seen, queue = set(), [ref]
        while queue:
            for parent in self.catalog['items'][queue.pop()]['used_in']:
                if parent not in seen:
                    seen.add(parent)
                    queue.append(parent)
        return [{'id': i, 'name': self.catalog['items'][i]['name'],
                 'direct': ref in self.catalog['items'][i]['direct_ingredients']}
                for i in sorted(seen, key=lambda i: self.catalog['items'][i]['name'])]

    def submit(self, payload):
        if not isinstance(payload, dict) or not isinstance(payload.get('targets'), dict) or (not payload['targets'] and payload.get('planner_mode') != 'passive' and not payload.get('provided_targets')):
            raise ValueError('Add at least one target with a positive craft quantity.')
        if payload.get('planner_mode','goals') not in ('goals','passive') or payload.get('production_interval',60) not in (10,60):
            raise ValueError('Invalid production mode or interval.')
        for key, count in payload['targets'].items():
            if type(count) is not int or not 1 <= count <= 100000000:
                raise ValueError('Craft quantities must be whole numbers from 1 to 100,000,000.')
            if not self.catalog['items'][resolve(self.catalog['items'], key)]['craftable'] and resolve(self.catalog['items'], key) not in exploration_target_ids(self.catalog):
                raise ValueError('Targets must be craftable or directly obtainable from exploration.')
        for name in ('iron_depot', 'runecube', 'cockatrice_ether_source', 'combinations_mode'):
            if type(payload.get(name, False)) is not bool:
                raise ValueError('Invalid option: ' + name)
        if not isinstance(payload.get('areas'), list) or not payload['areas']:
            raise ValueError('Select at least one available area.')
        if not isinstance(payload.get('inventory', {}), dict):
            raise ValueError('Inventory must be a JSON object of item names or IDs and quantities.')
        validate_secondary(self.catalog, payload.get('secondary', []))
        saver = payload.get('resource_saver', 0)
        if type(saver) not in (int, float) or not math.isfinite(saver) or not 0 <= saver <= 45:
            raise ValueError('Resource Saver must be a percentage from 0 to 45.')
        key = uuid4().hex
        with self.lock:
            # Local single-user UI: replace pending work when the user changes targets.
            for job in self.jobs.values():
                if job['status'] in ('queued', 'running', 'comparisons'):
                    job['cancelled'] = True
            for old in list(self.jobs)[:-8]:
                if self.jobs[old]['status'] not in ('queued', 'running', 'comparisons'):
                    del self.jobs[old]
            self.jobs[key] = {'status': 'queued', 'done': 0, 'total': None, 'cancelled': False}
        self.pool.submit(self.compute, key, payload)
        return {'job_id': key}

    def compute(self, key, payload):
        catalog = catalog_with_perks(self.catalog, payload)
        job = self.jobs[key]
        def progress(done, total):
            if job['cancelled']:
                raise ValueError('Superseded by a newer plan.')
            job.update(done=done, total=total)
        try:
            progress(0, None)
            job['status'] = 'running'
            common = dict(areas=payload['areas'], inventory=payload.get('inventory', {}),
                          iron_depot=payload.get('iron_depot', False), runecube=payload.get('runecube', False),
                          resource_saver=payload.get('resource_saver', 0))
            if payload.get('planner_mode') == 'passive' or not payload.get('targets'):
                result = passive_plans(catalog, max_areas=len(self.catalog['locations']), **common)
                result['production_interval'] = payload.get('production_interval',60)
            else:
                result = ranked_plans(catalog, payload['targets'], max_areas=len(self.catalog['locations']),
                                      combinations_mode=payload.get('combinations_mode', False), progress=progress, **common)
            progress(job['done'], job['total'])
            if payload.get('secondary'):
                for i, primary in enumerate(result['plans']):
                    progress(job['done'], job['total'])
                    result['plans'][i] = consume_leftovers(catalog, primary, payload['secondary'], areas=payload['areas'], max_areas=len(self.catalog['locations']), progress=lambda: progress(job['done'], job['total']), map_planning=payload.get('map_planning',False), map_sources=payload.get('map_sources'), map_source_explores=payload.get('map_source_explores'), map_node_usage=payload.get('map_node_usage'))
            result['plans'].sort(key=lambda p: (p['optimal_total_explores'], len(p['areas'])))
            unique = {}
            for p in result['plans']:
                signature = (tuple(sorted((a['location_id'], a['explores']) for a in p['areas'])),
                             tuple((t['item_id'], t['crafts']) for t in p.get('secondary', {}).get('targets', [])))
                unique.setdefault(signature, p)
            result['plans'] = list(unique.values())
            for p in result['plans']:
                credit_external_targets(p, payload.get('provided_targets'))
            result['enumeration']['feasible_options'] = len(result['plans'])
            if payload.get('estimate_inventory_savings'):
                deferred = []
                target_inventory_savings(catalog, payload, result, deferred)
                job.update(status='comparisons', result=result)
                for comparison in deferred:
                    progress(job['done'], job['total'])
                    comparison()
            job.update(status='complete', result=result)
        except Exception as error:
            job.update(calculation_error(error))


def serve(port=8765):
    app = Application(read_json(ROOT / 'data/catalog.json'))
    class Handler(BaseHTTPRequestHandler):
        def send(self, status, data, content_type='application/json'):
            body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode() if content_type == 'application/json' else data
            self.send_response(status)
            self.send_header('Content-Type', content_type + '; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlsplit(self.path).path
            try:
                if path == '/api/catalog':
                    return self.send(200, app.metadata())
                if path.startswith('/api/consumers/'):
                    return self.send(200, app.consumers(path.rsplit('/', 1)[1]))
                if path.startswith('/api/jobs/'):
                    with app.lock:
                        job = app.jobs.get(path.rsplit('/', 1)[1])
                        return self.send(200, dict(job)) if job else self.send(404, {'error': 'Plan not found.'})
                files = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'),
                         '/suggestions.js': ('suggestions.js', 'text/javascript'), '/style.css': ('style.css', 'text/css'), '/costs.js': ('costs.js', 'text/javascript'), '/route.js': ('route.js', 'text/javascript')}
                if path not in files:
                    return self.send(404, {'error': 'Not found'})
                filename, content_type = files[path]
                return self.send(200, (ROOT / 'web' / filename).read_bytes(), content_type)
            except (ValueError, KeyError) as error:
                self.send(400, {'error': str(error)})

        def do_POST(self):
            # Browser writes must originate from this local page (no CORS).
            origin = self.headers.get('Origin')
            if self.headers.get('X-FarmData') != '1' or (origin and origin != f'http://127.0.0.1:{port}'):
                return self.send(403, {'error': 'Open the app at its 127.0.0.1 address.'})
            try:
                size = int(self.headers.get('Content-Length', 0))
                if not 0 < size <= 131072:
                    raise ValueError('Invalid request size.')
                if self.path != '/api/plan':
                    return self.send(404, {'error': 'Not found'})
                return self.send(202, app.submit(json.loads(self.rfile.read(size))))
            except (ValueError, KeyError, TypeError) as error:
                self.send(400, {'error': str(error)})

        def log_message(self, *_):
            pass
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Farm Workshop is running at http://127.0.0.1:{port}', flush=True)
    print('Leave this terminal open. Press Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        app.pool.shutdown(wait=False, cancel_futures=True)


if __name__ == '__main__':
    serve()
