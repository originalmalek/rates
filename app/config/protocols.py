"""Protocol/chain whitelist for DeFi Llama parser.

Each protocol declares which chains it should be fetched from. AAVE v3
runs on 15 chains; the others stay Ethereum-only for now.

Asset filtering uses DeFi Llama's `stablecoin: true` flag — no manual
asset whitelist. Symbols are kept verbatim, so bridged variants
(USDC.E, DAI.E, USD₮0) stay distinct from native tokens.
"""

from typing import TypedDict


class ProtocolConfig(TypedDict):
    chains: frozenset[str]


PROTOCOLS: dict[str, ProtocolConfig] = {
    "aave-v3": {
        "chains": frozenset(
            {
                "ethereum",
                "arbitrum",
                "optimism",
                "base",
                "polygon",
                "avalanche",
                "bnb",
                "gnosis",
                "linea",
                "mantle",
                "celo",
                "sonic",
                "aptos",
                "megaeth",
                "plasma",
            }
        ),
    },
    "compound-v3": {"chains": frozenset({"ethereum"})},
    "fluid-lending": {
        "chains": frozenset({"ethereum", "arbitrum", "base", "polygon"}),
    },
    "spark": {"chains": frozenset({"ethereum"})},
    "sky-lending": {"chains": frozenset({"ethereum"})},
    "jupiter-lend": {"chains": frozenset({"solana"})},
    "kamino-lend": {"chains": frozenset({"solana"})},
    "save": {"chains": frozenset({"solana"})},
}


# Stablecoin LP / AMM pools (separate from lending protocols above).
# Filter applied: stablecoin=true AND exposure=multi.
LIQUIDITY_PROTOCOLS: dict[str, ProtocolConfig] = {
    "curve-dex": {
        "chains": frozenset(
            {"ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche"}
        ),
    },
    "convex-finance": {"chains": frozenset({"ethereum", "arbitrum"})},
    "fluid-dex": {"chains": frozenset({"ethereum", "arbitrum", "base"})},
    "uniswap-v3": {
        "chains": frozenset(
            {"ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche"}
        ),
    },
    "uniswap-v4": {
        "chains": frozenset({"ethereum", "arbitrum", "base", "optimism", "polygon"}),
    },
    "kamino-liquidity": {"chains": frozenset({"solana"})},
}


# DeFi Llama uses some non-canonical chain names — map them to ours.
# Anything not in this map is just lower-cased.
_CHAIN_ALIASES: dict[str, str] = {
    "OP Mainnet": "optimism",
    "BSC": "bnb",
    "Solana": "solana",
}


def canonical_chain(name: str) -> str:
    """Convert a DeFi Llama chain name to our canonical lowercase form."""
    return _CHAIN_ALIASES.get(name, name.lower())


def is_supported(project: str, chain: str) -> bool:
    """Whether (project, canonical chain) is in the lending whitelist."""
    cfg = PROTOCOLS.get(project)
    if cfg is None:
        return False
    return chain in cfg["chains"]


def is_liquidity_supported(project: str, chain: str) -> bool:
    """Whether (project, canonical chain) is in the LP whitelist."""
    cfg = LIQUIDITY_PROTOCOLS.get(project)
    if cfg is None:
        return False
    return chain in cfg["chains"]
