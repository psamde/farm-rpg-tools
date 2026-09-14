# Browser-based Python planner

Deploy the contents of `web/` to a static host. There is no compute API or database server. The optimization models remain in Python, running in Pyodide inside a Web Worker. A small Python adapter calls HiGHS WebAssembly because Pyodide's older SciPy solver failed a large priority model. The UI and route simulation remain JavaScript.

## Local use
Run `./run.ps1 serve` as before, or serve `web/` with any static HTTP server. The local Python process only serves files. Opening index.html via file:// is unsupported.

## Hosting
No server start command or installed Python is needed on the host. Serve WASM files as application/wasm. Relative asset URLs support a subdirectory. Cache pinned vendor assets long-term; revalidate app scripts, Python sources and catalog.json after updates. Item icons may still load from their existing external URLs. Plans never go to a computation server.

The runtime and scientific packages are a sizeable first download (roughly 36.5 MB plus HiGHS, before HTTP compression). Browser caching helps repeat visits. Large optimizations use the visitor's CPU and memory, and may be slower on phones.

## Development
Edit planner.py, secondary.py, browser_engine.py and wasm_solver.py in the project root, then run `python build_static.py`. This copies canonical sources and rebuilds the bundled catalog. Run `node test_pyodide.cjs` for native/Pyodide parity checks. Existing Python CLI commands and tests remain available.

Saved plans stay in browser local storage. Use plan codes to transfer them between devices or hostnames. The worker is terminated when a newer calculation replaces it, so obsolete jobs do not hold up the new plan.

Pinned dependencies: Pyodide 0.27.7 (MPL-2.0), NumPy 2.0.2, SciPy 1.14.1, OpenBLAS 0.3.26, highs-js 1.15.3 (MIT). Scientific package licenses are included in their distribution archives. HiGHS license is in vendor/highs/LICENSE. No runtime CDN dependency.
