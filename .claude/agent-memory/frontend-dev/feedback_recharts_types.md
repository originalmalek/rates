---
name: Recharts 3 Tooltip type signatures
description: Recharts 3.x Tooltip labelFormatter and formatter have loose types — use unknown not specific number types
type: feedback
---

Recharts 3.x (tested on 3.8.1) Tooltip props have these signatures:
- `labelFormatter: (label: ReactNode, payload: ...) => ReactNode` — first arg is `ReactNode`, not `number`
- `formatter: (value, name) => ...` — value is inferred, not safe to annotate as `number | null`

**Why:** Build failed with TypeScript error "Type 'number' not assignable to ReactNode" when `labelFormatter` was typed as `(epochMs: number) => string`. Recharts passes the label as the generic React display type.

**How to apply:** When writing Tooltip callbacks in Recharts 3, accept `unknown` and cast inside the function body. Do not annotate the parameter types explicitly. Use `Number(label)` and check `isNaN` before using as epoch ms.
