"""DeFi Llama Yields parser.

Fetches supply data from /pools and borrow data from /lendBorrow,
then emits RateSnapshot objects for whitelisted protocols/assets/chains.
"""

from datetime import datetime

import httpx

from app.config import ASSETS, PROTOCOLS
from app.models import RateSnapshot, SnapshotMeta

_POOLS_URL = "https://yields.llama.fi/pools"
_LEND_BORROW_URL = "https://yields.llama.fi/lendBorrow"

# DeFi Llama uses title-case chain names
_CHAIN_FILTER = "Ethereum"


def _clean_symbol(symbol: str) -> str:
    """Strip LP suffixes so 'USDC-LP' → 'USDC', but keep plain 'USDC'."""
    # Only pure stable symbols — no dashes, no slash composites
    for sep in ("-", "/"):
        if sep in symbol:
            return symbol.split(sep)[0]
    return symbol


def _is_whitelisted(pool: dict) -> bool:  # type: ignore[type-arg]
    chain_ok = pool.get("chain", "").lower() == _CHAIN_FILTER.lower()
    project_ok = pool.get("project", "") in PROTOCOLS
    symbol = _clean_symbol(pool.get("symbol", ""))
    symbol_ok = symbol in ASSETS
    return chain_ok and project_ok and symbol_ok


async def fetch_snapshots(client: httpx.AsyncClient) -> list[RateSnapshot]:
    pools_resp, lb_resp = await _fetch_both(client)

    # Build borrow APY lookup: pool_id -> borrow_apy
    borrow_by_pool: dict[str, float | None] = {}
    for entry in lb_resp:
        pool_id = entry.get("pool")
        if pool_id is None:
            continue
        # totalBorrowUsd / totalSupplyUsd not needed; just grab apyBorrow
        borrow_apy = entry.get("apyBaseBorrow")
        borrow_by_pool[pool_id] = float(borrow_apy) if borrow_apy is not None else None

    ts = datetime.utcnow()
    snapshots: list[RateSnapshot] = []

    for pool in pools_resp:
        if not _is_whitelisted(pool):
            continue

        pool_id = pool.get("pool", "")
        symbol = _clean_symbol(pool.get("symbol", ""))

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
                chain=pool["chain"].lower(),
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
