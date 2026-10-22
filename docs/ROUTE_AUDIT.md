# Route Audit: read-only baseline

Status: exploratory branch in Defirion's fork. Source baseline: fitzforge/polestar
`next` at `049d5314a4c26cb119d08d358907b59fbab383c8` (2026-10-22).

## Goal

Find repeatable route inefficiencies in Polestar's 1-60 guides across
race/class combinations. The first iteration **only raises review leads**,
not verified route improvements and not estimated minutes saved.

Initial known cases:

1. **Call of Earth (1519), Mulgore, Tauren Shaman.** Current guide completes
   Brambleblade Ravine, returns to Camp Narache, accepts the level-4 Shaman
   quest, then returns to the ravine for Ritual Salves. Hypothesis: a short
   level-3 grind *before* the first ravine circuit could enable a combined trip.
   Must verify XP gating, quest acceptance and end-to-end time.
2. **Mazzranache (766), Mulgore.** Four items from different mobs are grouped
   under a later unlocated farming step; some are optional in an earlier
   Thunderhorn Water Well step. This warrants a spawn-cluster review, not a
   presumption that the four items drop in one location or a claim that the
   original route is wrong.

## Commands

Requires Node 24+ (uses built-in modules; no npm dependencies):

```sh
node tools/route-audit.js --guide guides/forever/horde/tauren/01-mulgore.guide
node tools/route-audit.js --all --json > route-audit-report.json
node --test tests/route-audit.test.js
```

The output has two rules:

- `possible-return-to-objective-area` (medium confidence): a later
  collection tip mentions a named site that appeared as an earlier work step,
  with the relevant quest accepted between visits. Heuristic text matching
  can yield false positives.
- `multi-item-farm-without-coordinates` (low confidence): a step contains
  at least three distinct mandatory collected items for the same quest, and
  none provides per-item coordinates. This identifies an evidence gap, **not**
  proof of a geographically inefficient route.

## What is deliberately NOT implemented

- Quest prerequisites, level/XP simulation or early-grind estimation
- Detailed mob spawn distribution, expected travel time, respawns or competition
- Cross-pack comparisons (Lodestar / MittenQuest / Ding! / Maxi)
- Rewriting .guide files or editing the simulator
- Changes to upstream guides before verifying specific fixes

## Next milestones

1. Run this baseline on a full local checkout; record counts and inspect
   false positives. Run the focused tests.
2. Reuse `tools/lib/sim` compiled guide sequences and class-specific runs;
   include quest accept/complete/turn-in state and XP at each step.
3. Add objective-source clusters and routed walking costs from Polestar's
   reference data and navigation graph. Where data are absent, flag missing
   evidence instead of fabricating coordinates.
4. Generate bounded *local* candidate edits (move an accept earlier, choose
   alternative farming clusters, insert a level checkpoint). Re-simulate
   baseline and candidate with identical parameters and score absolute and
   uncertainty-adjusted savings.
5. Validate best candidates using Polestar Recorder in-game, add regression
   tests under `tests/guides-reported.test.js`, and propose focused upstream
   PRs. Coordinate with maintainers before proposing the new audit tool.

Upstream contribution instructions: `CONTRIBUTING.md`; do not commit the
generated `addon/Polestar_Guides/Guides.lua`. Source-data fixes belong in
`tools/lib/data/corrections.json`.

The branch is a development baseline, not a PR. The original guides are
unchanged.
