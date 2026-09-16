"""Fetch and validate a fresh catalog before replacing the published snapshot."""
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory
from farmdata import fetch, process, read_json, write_json

ROOT = Path(__file__).parent


def content(catalog):
    # Retrieval timestamps and snapshot hashes change even when game data does not.
    return {k: v for k, v in catalog.items() if k not in ('upstream', 'snapshot_sha256')}


def validate(candidate, previous):
    items, sources, locations = (candidate[k] for k in ('items', 'sources', 'locations'))
    if not items or not sources or not locations:
        raise ValueError('Empty catalog section; keeping the existing snapshot.')
    for section in ('items', 'locations'):
        removed = set(previous[section]) - set(candidate[section])
        if removed:
            raise ValueError(f'{section} removed: {sorted(removed)}. Review upstream changes manually.')
    for ref, item in items.items():
        for field in ('direct_ingredients', 'raw_materials'):
            for ingredient, amount in item[field].items():
                if ingredient not in items or not math.isfinite(amount) or amount <= 0:
                    raise ValueError(f'Invalid {field} for {ref}')
        if item['craftable'] and not item['direct_ingredients']:
            raise ValueError(f'Empty recipe for {ref}')
        if any(s not in sources for s in item['source_ids']):
            raise ValueError(f'Missing source for {ref}')
    for source in sources.values():
        if source['item_id'] not in items:
            raise ValueError('Source references an unknown item')
        if source['kind'] == 'explore':
            rate = source['expected_drops_per_explore']
            if source['location_id'] not in locations or not math.isfinite(rate) or rate <= 0:
                raise ValueError('Invalid exploration yield or location')
    old_explore = {s['item_id'] for s in previous['sources'].values() if s['kind'] == 'explore'}
    new_explore = {s['item_id'] for s in sources.values() if s['kind'] == 'explore'}
    if old_explore - new_explore:
        raise ValueError('Exploration items lost all sources; review manually.')
    for section in ('sources',):
        if len(candidate[section]) < len(previous[section]) * .95:
            raise ValueError('More than 5% of sources disappeared; review manually.')
    old_recipes = {k for k,v in previous['items'].items() if v['craftable']}
    if any(not items[k]['craftable'] for k in old_recipes):
        raise ValueError('Existing recipes disappeared; review manually.')


def refresh():
    path = ROOT / 'data/catalog.json'
    previous = read_json(path)
    with TemporaryDirectory() as cache:
        candidate = process(fetch(cache, refresh=True))
    validate(candidate, previous)
    if content(candidate) == content(previous):
        print('No game-data changes. Keeping the existing snapshot and version.')
        return False
    # Validation has completed. CI also runs regression tests before committing.
    staged = path.with_suffix('.new.json')
    write_json(staged, candidate)
    staged.replace(path)
    version = ROOT / 'VERSION'
    parts = [int(n) for n in version.read_text().strip().split('.')]
    if len(parts) == 2: parts.append(0)
    parts[2] += 1
    version.write_text('.'.join(map(str, parts)) + '\n', encoding='utf8')
    print(f'Updated catalog: {len(candidate["items"])} items, {candidate["coverage"]["craftable_count"]} recipes.')
    return True


if __name__ == '__main__':
    refresh()
