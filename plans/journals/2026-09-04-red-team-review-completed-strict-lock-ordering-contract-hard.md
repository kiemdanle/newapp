---
title: "Red Team Review Completed: Strict Lock Ordering & Contract Hardening"
date: 2026-09-04
summary: "Hardened implementation plan with synchronous product tally updates (Product row locked first via SELECT FOR UPDATE), vote recount row-locking on Review, type-safe anonymous visibility branching, privacy-hardened public review DTO (omits userId and author.id, projects isOwnReview), and in-flight helpful vote mutex."
---

# Red Team Review Completed: Strict Lock Ordering & Contract Hardening

Hardened implementation plan with synchronous product tally updates (Product row locked first via SELECT FOR UPDATE), vote recount row-locking on Review, type-safe anonymous visibility branching, privacy-hardened public review DTO (omits userId and author.id, projects isOwnReview), and in-flight helpful vote mutex.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
