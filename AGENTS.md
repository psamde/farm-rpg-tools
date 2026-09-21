# Release versions

- Push completed changes at the end of the task unless the user asks otherwise.

- `VERSION` is the single source of truth for the displayed app version.
- Bump it for every subsequent deployed change: use patch releases after 0.1
  (0.1.1, 0.1.2, etc.), unless the user requests a different release number.
- Run `python build_static.py` before committing. It updates the page title,
  visible version badge, and stylesheet/script cache versions. Commit those
  generated changes alongside `VERSION` and the implementation.
- A version identifies the loaded release, not confirmation that a pending
  Cloudflare deployment has succeeded.
