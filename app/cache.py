"""Redis cache helpers for API responses."""

import json
from collections.abc import Awaitable, Callable
from typing import TypeVar

from pydantic import BaseModel
from redis.asyncio import Redis

T = TypeVar("T", bound=BaseModel)


def make_key(*parts: str) -> str:
    """Build a cache key from parts, normalising each CSV param to sorted order."""
    normalised = []
    for part in parts:
        if "," in part:
            part = ",".join(sorted(part.split(",")))
        normalised.append(part)
    return ":".join(normalised)


async def get_or_set(
    redis: Redis,
    key: str,
    ttl: int,
    loader: Callable[[], Awaitable[list[T]]],
    model_type: type[T],
) -> list[T]:
    cached = await redis.get(key)
    if cached is not None:
        return [model_type.model_validate(item) for item in json.loads(cached)]

    items = await loader()

    payload = "[" + ",".join(s.model_dump_json() for s in items) + "]"
    await redis.set(key, payload, ex=ttl)

    return items
