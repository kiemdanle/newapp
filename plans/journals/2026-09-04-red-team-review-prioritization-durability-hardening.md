---
title: "Red Team Review Prioritization & Durability Hardening"
date: 2026-09-04
summary: "Re-prioritized Red Team review to 15 Critical and High findings with full user adjudication. Replaced lower-severity items with transactional tally updates using row locking (SELECT FOR UPDATE on Product), vote recount serialization with row locking (SELECT FOR UPDATE on Review), and client-side review ID deduplication for mutable-score infinite scroll."
---

# Red Team Review Prioritization & Durability Hardening

Re-prioritized Red Team review to 15 Critical and High findings with full user adjudication. Replaced lower-severity items with transactional tally updates using row locking (SELECT FOR UPDATE on Product), vote recount serialization with row locking (SELECT FOR UPDATE on Review), and client-side review ID deduplication for mutable-score infinite scroll.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
