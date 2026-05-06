from datetime import datetime

from pydantic import BaseModel


class SnapshotMeta(BaseModel):
    protocol: str
    chain: str
    asset: str


class RateSnapshot(BaseModel):
    ts: datetime  # UTC naive
    meta: SnapshotMeta
    supply_apy: float | None
    borrow_apy: float | None
    utilization: float | None  # 0..1
    tvl_usd: float | None
