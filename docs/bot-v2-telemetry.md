# Bot v2 — Telemetry & Cost Measurement

Sprint 6, Step 4. This turns the months of token/cost **estimates** into **measured**
numbers and records the field-promotion recommendations that guide post-launch tuning.

All numbers below are real, captured from live Anthropic API calls on
`2026-06-09` via:

- `npm run cache:verify` — two same-prefix live calls per phase, both tiers (cache write→read proof + prefix sizes)
- `npm run alex:live` — full Alex arc through the real engine (nurture → qualify → book)
- `npm run jordan:live` — full Jordan recovery arcs (revival, finance)

Models & rates used (verify against Anthropic's pricing page before relying on the dollar figures):

| Model | Input $/MTok | Output $/MTok | Cache **read** $/MTok (~0.1×) | Cache **write** $/MTok (~1.25×, 5-min) |
|---|---|---|---|---|
| Haiku 4.5 (`claude-haiku-4-5-20251001`) | $1.00 | $5.00 | $0.10 | $1.25 |
| Sonnet 4.6 (`claude-sonnet-4-6`) | $3.00 | $15.00 | $0.30 | $3.75 |

Tiering (ARCHITECTURE §3): **Haiku** = cold nurture, book. **Sonnet** = warm nurture, qualify, revival, reschedule, finance.

---

## 1. Per-phase stable-prefix token count (the cached block)

The cached prefix is `kernel + methodology + persona + mission` — byte-identical across
every turn within a phase (verified: `cache:verify` asserts the prefix matches across two
different-runtime turns in all six phases). We had estimated ~5–6K; the **real** numbers are
~7.8–8.2K tokens:

| Phase | Tier | Prefix chars | **Cached prefix tokens** | Min cacheable (model) | Caches? |
|---|---|---:|---:|---:|:--:|
| nurture | haiku | 31,162 | **8,141** | 4,096 | ✅ |
| qualify | sonnet | 31,248 | **8,158** | 2,048 | ✅ |
| book | haiku | 30,444 | **7,978** | 4,096 | ✅ |
| revival | sonnet | 30,555 | **7,952** | 2,048 | ✅ |
| reschedule | sonnet | 29,915 | **7,839** | 2,048 | ✅ |
| finance | sonnet | 30,499 | **7,952** | 2,048 | ✅ |

> **Why "min cacheable" matters:** the API silently won't cache a prefix below the model's
> minimum (Haiku 4.5 = 4,096 tokens, Sonnet 4.6 = 2,048). Every phase clears its minimum with
> ~2× headroom, so caching engages on **both** tiers. If the prompt content is ever trimmed
> substantially (e.g. a leaner methodology), re-check the Haiku phases against the 4,096 floor.

The cached prefix is ~93–94% of total input on a typical turn (≈8,000 cached vs ≈500–600 fresh
runtime), which is what makes the cache so effective (§4).

## 2. Real output token counts per phase

maxTokens is 1,500 (raised in Sprint 5). Measured outputs across the live arcs — **nothing is
pathologically verbose; the largest single turn was 530, ~35% of the ceiling:**

| Phase | Tier | Typical output | Largest output (turn type) |
|---|---|---:|---:|
| nurture | haiku | ~155–240 | 241 |
| qualify | sonnet | ~210–280 | **476** (QUALIFIED handoff) |
| book | haiku | ~290–350 | **530** (BOOKED handoff) |
| revival | sonnet | ~225–300 | **483** (REBOOKED handoff) |
| reschedule | sonnet | ~185–190 | 191 |
| finance | sonnet | ~240–315 | **459** (SOFT_CLOSE handoff) |

The largest turns are the **handoff/terminal-signal turns** that carry the structured 5-slot
`summary` + `objectionsSurfaced` alongside the reply — exactly as predicted. The 1,500 ceiling
is comfortable headroom; no turn approached it. (The 1,500 is a ceiling, not a charge — you pay
only for tokens generated, so the headroom costs nothing on short turns.)

## 3. Cache hit/write rates + repair-ladder firing rates

**Cache (live, logged via `[bot-v2][telemetry]`):** every same-phase repeat turn read the cache
(`cache_read_input_tokens` ≈ 7,800–8,200). `cache_creation` is paid once per
(phase, model, 5-minute window) cold start; thereafter reads. Across the alex/jordan arcs (turns
seconds apart) **every turn after the first per phase was a cache read.**

**Repair ladder (Sprint 3 telemetry):** across **~29 live turns** (12 in `cache:verify`, 7 in
the Alex arc, 10 in the Jordan arcs), **0 repairs fired** — every turn parsed cleanly on
**attempt 1**, on both Haiku and Sonnet. No attempt-2 (repair) or attempt-3 (safe fallback) was
triggered. So in pre-production sampling both tiers emit a valid contract first-try at 100%.
Real firing rates await production volume; the telemetry line
(`attempts=N … tier=…`) is in place to measure it.

## 4. Cost summary (dollars)

> **The cache-warm caveat — read this before quoting a number.** The **cached** column applies
> only on a cache **hit**. SMS turns are bursty and often spaced minutes-to-days apart, so
> *within a single conversation* the 5-minute cache frequently expires between turns and you pay
> the **uncached** (or one-time write) price. The cache's real payoff is **at volume**: many
> concurrent leads in the same phase keep that phase's prefix continuously warm, so most turns
> read it. **Treat the two columns as a range:** uncached = worst case (cold / low volume),
> cached = at-volume / concurrent-leads case. Reality sits between, trending toward "cached" as
> volume rises.

### 4a. Per-exchange cost, per phase (uncached vs cached)

Representative turn = measured cached prefix + ~520–600-token fresh runtime tail + typical output.

| Phase | Tier | **Uncached** | **Cached (hit)** | Saved | First-turn (cache **write**) |
|---|---|---:|---:|---:|---:|
| nurture | haiku | $0.00986 | **$0.00253** | 74% | $0.01190 |
| qualify | sonnet | $0.03029 | **$0.00827** | 73% | $0.03641 |
| book | haiku | $0.01024 | **$0.00306** | 70% | $0.01223 |
| revival | sonnet | $0.03001 | **$0.00854** | 72% | $0.03597 |
| reschedule | sonnet | $0.02805 | **$0.00688** | 76% | $0.03393 |
| finance | sonnet | $0.03010 | **$0.00863** | 71% | $0.03606 |

Per cached exchange: **~0.3¢ on Haiku, ~0.8–0.9¢ on Sonnet.** Uncached: **~1¢ Haiku, ~3¢ Sonnet.**
The cache write (first cold turn of a phase) costs ~1.2× the uncached turn — paid once, then every
subsequent same-prefix turn within the window is the cheap "cached" figure.

### 4b. Per-conversation cost (measured arcs)

| Arc | Turns | **Uncached** | **Cached** |
|---|---|---:|---:|
| A. Cold nurture, stalls | 3 × Haiku | $0.0284 | **$0.0064** |
| B. Nurture → warm → qualify → book (full Alex) | 2 nurture + 3 qualify + 3 book | $0.1650 | **$0.0481** |
| C. Jordan revival recovery | 6 × Sonnet | $0.1899 | **$0.0611** |

So a full Alex conversion conversation runs **~5–17¢** in API cost (cached → uncached range); a
Jordan recovery **~6–19¢**; a dead-end cold nurture **<1–3¢**. The all-Sonnet Jordan arcs and the
qualify/book stretch of Alex dominate cost, as expected from the tiering.

### 4c. SMS carrier cost (separate line item — operator supplies)

API cost is **not** the only per-message cost. Each outbound SMS also incurs a GHL/carrier send
fee, billed separately from Anthropic. **Placeholder: `$____ per SMS segment`** — fill in from the
GHL/Twilio plan. At, say, $0.01/segment, a 6-turn conversation adds ~$0.06 in carrier cost, which
is comparable to or larger than the *cached* API cost — so the SMS line item is material to the
true per-conversation total and should not be omitted from operator economics.

## 5. Contract field-fill reliability → optional→required promotion (flagged, NOT applied)

Per ARCHITECTURE §5, model-authored fields graduate optional → required as telemetry proves them
stable. **Always-required today:** `reply`, `signal.type` (both filled 100% in all ~29 live turns;
0 repairs).

**Observed reliably filled in the live arcs** (the engine acted on them: gates advanced qualify,
the `summary.problem` slot carried forward into book, terminal signals fired with correct state):

| Field | §5 class | Observed | Recommendation |
|---|---|---|---|
| `consequenceSurfaced` | promote-early | filled + load-bearing for qualify gate | **Recommend promote to required** |
| `gateProblem` | promote-early | filled; drove QUALIFIED | **Recommend promote to required** |
| `gateDecisionMaker` | promote-early | filled; drove QUALIFIED | **Recommend promote to required** |
| `signal.confidence` (when REBOOKED) | promote-early | present on the REBOOKED turn | **Recommend promote to required *for REBOOKED only*** |
| `summary` (5 slots) | interim-optional, required at handoff | filled on QUALIFIED/BOOKED/REBOOKED/SOFT_CLOSE turns | Keep handoff-only requirement; revisit after volume |
| `nepqPhase`, `objectionsSurfaced`, `motivation`, `urgency`, `decisionMakers`, `timePrefs`, `primaryObjection` | interim-optional | not separately fill-rate-audited here | Keep optional pending a larger production sample |

> **Do NOT auto-apply.** These are **recommendations for review** (Sprint 6 explicitly forbids
> tightening required-field validation without sign-off). The sample is ~29 pre-production turns,
> not production volume — a wrongly-promoted field would start tripping the repair ladder. The
> promote-early three (`consequenceSurfaced`, `gateProblem`, `gateDecisionMaker`) are the
> safest first candidates per §5 and showed clean fill here; promote them first, watch the
> `attempts=` telemetry for a repair-rate uptick, then consider the rest.

## 6. How to reproduce / keep measuring

- `npm run cache:verify` — re-measures prefix sizes + proves cache write→read (24 asserts).
- `npm run alex:live` / `npm run jordan:live` — full live arcs; each turn logs a
  `[bot-v2][telemetry]` line with `phase / tier / model / attempts / prefixChars /
  input_tokens / cache_creation_input_tokens / cache_read_input_tokens / output_tokens / signal`.
- In production, scrape those `[bot-v2][telemetry]` lines to track cache hit rate, repair-ladder
  firing rate by tier, and per-field fill rate over real volume — that data is what should drive
  the §5 promotions above.
