"""DeFi Llama Yields parser.

Fetches supply data from /pools and borrow data from /lendBorrow,
then emits RateSnapshot objects. Filters:

- protocol must be whitelisted in app/config/protocols.py
- chain (after canonicalisation) must be enabled for that protocol
- pool must be flagged `stablecoin: true` by DeFi Llama
"""

from datetime import datetime

import httpx

from app.config import canonical_chain, is_liquidity_supported, is_supported
from app.models import PoolSnapshot, RateSnapshot, SnapshotMeta

_POOLS_URL = "https://yields.llama.fi/pools"
_LEND_BORROW_URL = "https://yields.llama.fi/lendBorrow"


def _is_whitelisted(pool: dict) -> bool:  # type: ignore[type-arg]
    if pool.get("stablecoin") is not True:
        return False
    project = pool.get("project", "")
    chain = canonical_chain(pool.get("chain", ""))
    return is_supported(project, chain)


def _is_liquidity_pool(pool: dict) -> bool:  # type: ignore[type-arg]
    if pool.get("stablecoin") is not True:
        return False
    if pool.get("exposure") != "multi":
        return False
    project = pool.get("project", "")
    chain = canonical_chain(pool.get("chain", ""))
    return is_liquidity_supported(project, chain)


async def fetch_snapshots(client: httpx.AsyncClient) -> list[RateSnapshot]:
    pools_resp, lb_resp = await _fetch_both(client)

    # Build borrow APY lookup: pool_id -> borrow_apy
    borrow_by_pool: dict[str, float | None] = {}
    for entry in lb_resp:
        pool_id = entry.get("pool")
        if pool_id is None:
            continue
        borrow_apy = entry.get("apyBaseBorrow")
        borrow_by_pool[pool_id] = float(borrow_apy) if borrow_apy is not None else None

    ts = datetime.utcnow()
    snapshots: list[RateSnapshot] = []

    for pool in pools_resp:
        if not _is_whitelisted(pool):
            continue

        pool_id = pool.get("pool", "")
        symbol = pool.get("symbol", "")

        # supply_apy: prefer apy, fall back to apyBase
        raw_apy = pool.get("apy") if pool.get("apy") is not None else pool.get("apyBase")
        supply_apy = float(raw_apy) if raw_apy is not None else None

        borrow_apy = borrow_by_pool.get(pool_id)

        tvl_raw = pool.get("tvlUsd")
        tvl_usd = float(tvl_raw) if tvl_raw is not None else None

        snapshot = RateSnapshot(
            ts=ts,
            meta=SnapshotMeta(
                protocol=pool["project"],
                chain=canonical_chain(pool["chain"]),
                asset=symbol,
            ),
            supply_apy=supply_apy,
            borrow_apy=borrow_apy,
            utilization=None,
            tvl_usd=tvl_usd,
        )
        snapshots.append(snapshot)

    return snapshots


async def _fetch_both(
    client: httpx.AsyncClient,
) -> tuple[list[dict], list[dict]]:  # type: ignore[type-arg]
    pools_resp = await client.get(_POOLS_URL)
    pools_resp.raise_for_status()
    pools_data = pools_resp.json()
    pools: list[dict] = pools_data.get("data", pools_data)  # type: ignore[type-arg]

    lb_resp = await client.get(_LEND_BORROW_URL)
    lb_resp.raise_for_status()
    lb_data = lb_resp.json()
    lb: list[dict] = lb_data if isinstance(lb_data, list) else lb_data.get("data", [])  # type: ignore[type-arg]

    return pools, lb


async def fetch_pool_snapshots(client: httpx.AsyncClient) -> list[PoolSnapshot]:
    """Fetch stablecoin LP pools (multi-token, AMM/DEX) from DeFi Llama."""
    pools_resp = await client.get(_POOLS_URL)
    pools_resp.raise_for_status()
    pools_data = pools_resp.json()
    pools: list[dict] = pools_data.get("data", pools_data)  # type: ignore[type-arg]

    ts = datetime.utcnow()
    snapshots: list[PoolSnapshot] = []

    for pool in pools:
        if not _is_liquidity_pool(pool):
            continue

        symbol = pool.get("symbol", "")
        raw_apy = pool.get("apy") if pool.get("apy") is not None else pool.get("apyBase")
        supply_apy = float(raw_apy) if raw_apy is not None else None

        tvl_raw = pool.get("tvlUsd")
        tvl_usd = float(tvl_raw) if tvl_raw is not None else None

        snapshots.append(
            PoolSnapshot(
                ts=ts,
                meta=SnapshotMeta(
                    protocol=pool["project"],
                    chain=canonical_chain(pool["chain"]),
                    asset=symbol,
                ),
                supply_apy=supply_apy,
                tvl_usd=tvl_usd,
            )
        )

    return snapshots
