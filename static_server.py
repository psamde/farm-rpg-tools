"""Serve files only. All planning runs in each visitor's browser."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path

def serve(port=8765, host='127.0.0.1'):
    handler=partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).parent/'web'))
    server=ThreadingHTTPServer((host,port),handler)
    print(f'Farm Workshop (browser calculations): http://{host}:{port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
