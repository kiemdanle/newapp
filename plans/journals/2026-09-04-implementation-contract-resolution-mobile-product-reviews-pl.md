---
title: "Implementation Contract Resolution: Mobile Product Reviews Plan"
date: 2026-09-04
summary: "Resolved all implementation-level contract details: split lock helpers into lockProductForReviewMutation and recomputeAndSyncProductTallies, cleanly deleted uncalled BullMQ recalc queue/worker, migrated legacy not_helpful votes, serialized viewerId across all endpoints, and strictly pruned broken in-memory rating sort."
---

# Implementation Contract Resolution: Mobile Product Reviews Plan

Resolved all implementation-level contract details: split lock helpers into lockProductForReviewMutation and recomputeAndSyncProductTallies, cleanly deleted uncalled BullMQ recalc queue/worker, migrated legacy not_helpful votes, serialized viewerId across all endpoints, and strictly pruned broken in-memory rating sort.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
