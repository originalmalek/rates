export interface SnapshotMeta {
  protocol: string;
  chain: string;
  asset: string;
}

export interface BaseSnapshot {
  ts: string;
  meta: SnapshotMeta;
  supply_apy: number | null;
  tvl_usd: number | null;
}

export interface RateSnapshot extends BaseSnapshot {
  borrow_apy: number | null;
  utilization: number | null;
}

export type PoolSnapshot = BaseSnapshot;
