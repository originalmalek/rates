# Phase 1 whitelist — Ethereum only

PROTOCOLS: frozenset[str] = frozenset(
    {
        "aave-v3",
        "fluid-lending",
        "compound-v3",
        "morpho-blue",
        "spark",
        "sky-lending",
    }
)

ASSETS: frozenset[str] = frozenset(
    {
        "USDC",
        "USDT",
        "DAI",
        "USDS",
        "sDAI",
    }
)

CHAINS: frozenset[str] = frozenset({"ethereum"})
