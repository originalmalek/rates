export interface RateSnapshot {
  ts: string;
  meta: {
    protocol: string;
    chain: string;
    asset: string;
  };
  supply_apy: number | null;
  borrow_apy: number | null;
  utilization: number | null;
  tvl_usd: number | null;
}
