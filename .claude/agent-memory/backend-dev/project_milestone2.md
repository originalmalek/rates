---
name: Milestone 2 completion state
description: API endpoints added (GET /rates/latest, GET /rates/history), router wired into main.py, 17 tests passing
type: project
---

Milestone 2 is complete as of 2026-05-04.

**Why:** Added FastAPI router for rate data exposure.

**How to apply:** The router is at `app/routers/rates.py`. Tests are at `tests/routers/test_rates.py`. Tests mock at the repo level using `unittest.mock.AsyncMock` injected into `app.state.repo` before each request, per architecture rules.

Key decisions:
- `cast(RatesRepository, request.app.state.repo)` used in router to satisfy mypy strict mode (app.state is typed as Any by Starlette).
- `extra="ignore"` added to Settings to fix pre-existing bug where .env extra keys caused ValidationError at import time (bug noted in NOTES.md).
- 17 tests total: 5 parsers, 7 repositories, 5 routers.
