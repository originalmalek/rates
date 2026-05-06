# FastAPI Best Practices

Source: https://github.com/zhanymkanov/fastapi-best-practices

## Project Structure

Organize by domain, not by file type. Each domain package contains its own router, schemas, models, service, dependencies, constants, and exceptions. Import between packages explicitly: `from src.auth import constants as auth_constants`.

```
app/
├── auth/
│   ├── router.py
│   ├── schemas.py
│   ├── models.py
│   ├── service.py
│   ├── dependencies.py
│   └── constants.py
├── parsers/
└── repositories/
```

## Async Routes

- **I/O tasks** → `async def` with non-blocking awaits (Motor, httpx). Never call blocking I/O inside `async` routes — it freezes the event loop.
- **Sync routes** run in a threadpool automatically — safe for blocking calls, but costlier than coroutines.
- **CPU-heavy tasks** → offload to worker processes (`multiprocessing`) or task queues (Celery, Arq). Neither threads nor `async` help here due to the GIL.

## Pydantic

- Use Pydantic's full validation toolkit: regex, enums, constraints, `EmailStr`, `AnyUrl`.
- Create a **custom base model** to enforce project-wide serialization rules (e.g. datetime format).
- **Decouple `BaseSettings`** per domain rather than one monolithic config class.
- Raising `ValueError` inside a Pydantic validator causes FastAPI to return a structured 422 response — use this for schema-level business rules (e.g. password strength).

## Dependencies

- Use dependencies for **complex validation** that requires DB or external calls: entity existence, permissions, relationship checks.
- **Chain dependencies** — dependencies can depend on other dependencies. Build small, reusable pieces and compose them.
- FastAPI **caches dependency results per request** — declare the same dependency in multiple places and it only runs once.
- Prefer `async` dependencies over `sync` ones to avoid unnecessary threadpool overhead.

## REST Conventions

- Follow REST conventions and keep **path variable names consistent** across related endpoints so dependencies can be reused.
- Use `response_model`, `status_code`, and `responses` for accurate OpenAPI docs.
- Hide `/docs` and `/redoc` in production unless building a public API.

## Background Work

- `BackgroundTasks` — only for fast (<1 s), fire-and-forget operations where silent failure is acceptable.
- Everything else (retries, scheduling, CPU work, alertable failures) → Celery, Arq, or RQ.

## Sync Library Integration

Wrap blocking third-party library calls with Starlette's `run_in_threadpool()` instead of calling them directly in `async` routes.

## Testing

- Use `httpx` with `ASGITransport` for async test clients from day one.
- Swap dependencies in tests with `app.dependency_overrides` — do not monkeypatch internals.

## Code Quality

- Use **Ruff** for formatting and linting (replaces Black, isort, autoflake).
- Write **reversible Alembic migrations** with human-readable names: `%%(year)d-%%(month).2d-%%(day).2d_%%(slug)s`.

## Database

- Prefer SQL-level joins and aggregations over Python-side processing.
- Follow naming conventions: lowercase snake_case, singular table names, `_at` suffix for datetimes, `_date` for dates.
- For new projects use SQLAlchemy 2.0 async API (`AsyncSession`).
