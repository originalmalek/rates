---
name: Project scaffold state
description: Records what was set up during initial scaffold — uv, pyproject.toml layout, pytest config
type: project
---

FastAPI scaffold was created at /root/rates with uv 0.11.8.

- uv is installed at ~/.local/bin/uv (not on PATH by default — always use `export PATH="$HOME/.local/bin:$PATH"` before uv commands in shell, or invoke as `~/.local/bin/uv`)
- pyproject.toml has `[tool.pytest.ini_options]` with `asyncio_mode = "auto"` and `[tool.mypy]` with `strict = true`, `ignore_missing_imports = true`
- `pytest tests/ -v` exits with code 5 (no tests collected) when tests/ is empty — this is expected, not a failure
- Health check confirmed working: GET /health returns {"status": "ok"}

**Why:** Initial scaffold milestone, all future Python work builds on this.
**How to apply:** uv path fix is needed in every bash session; don't re-init the project.
