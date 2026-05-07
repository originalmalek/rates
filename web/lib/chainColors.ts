// Chain accent colors used for badges in the table and lines in the chart.
// Picked to be distinct on a dark background.
const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627eea",
  arbitrum: "#28a0f0",
  optimism: "#ff0420",
  base: "#0052ff",
  polygon: "#8247e5",
  avalanche: "#e84142",
  bnb: "#f3ba2f",
  gnosis: "#3e6957",
  linea: "#61dfff",
  mantle: "#9bc4cb",
  celo: "#fcff52",
  sonic: "#fe9a4c",
  aptos: "#06d6a0",
  megaeth: "#a78bfa",
  plasma: "#22d3ee",
};

export function chainColor(chain: string): string {
  return CHAIN_COLORS[chain] ?? "#71717a"; // zinc-500 fallback
}
