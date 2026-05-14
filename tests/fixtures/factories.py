"""Shared test fixture factories for snapshot models."""

from datetime import datetime

from app.models import PoolSnapshot, RateSnapshot, SnapshotMeta


def make_rate_snapshot(
    protocol: str = "aave-v3",
    chain: str = "ethereum",
    asset: str = "USDC",
    supply_apy: float | None = 5.2,
    borrow_apy: float | None = 6.41,
    tvl_usd: float | None = 500_000_000.0,
    ts: datetime | None = None,
) -> RateSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    return RateSnapshot(
        ts=ts,
        meta=SnapshotMeta(protocol=protocol, chain=chain, asset=asset),
        supply_apy=supply_apy,
        borrow_apy=borrow_apy,
        utilization=None,
        tvl_usd=tvl_usd,
    )


def make_pool_snapshot(
    protocol: str = "curve-dex",
    chain: str = "ethereum",
    asset: str = "USDC-USDT-DAI",
    supply_apy: float | None = 4.5,
    tvl_usd: float | None = 200_000_000.0,
    ts: datetime | None = None,
) -> PoolSnapshot:
    if ts is None:
        ts = datetime.utcnow()
    return PoolSnapshot(
        ts=ts,
        meta=SnapshotMeta(protocol=protocol, chain=chain, asset=asset),
        supply_apy=supply_apy,
        tvl_usd=tvl_usd,
    )
