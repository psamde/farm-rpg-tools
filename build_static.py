"""Build the deployable web directory from the canonical Python sources/data."""
import json
from pathlib import Path
from webapp import Application
ROOT=Path(__file__).parent

def build():
    c=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf8'))
    app=Application(c)
    try: metadata=app.metadata()
    finally: app.pool.shutdown()
    (ROOT/'web/catalog.json').write_text(json.dumps({'metadata':metadata,'catalog':c},separators=(',',':')),encoding='utf8')
    for name in ('planner.py','secondary.py','browser_engine.py','wasm_solver.py'):
        (ROOT/'web'/name).write_bytes((ROOT/name).read_bytes())
if __name__=='__main__':build()
