---
title: Fix pantry-admin mount namespacing failure on rebuild
date: 2026-09-16
summary: "Resolved systemd 226/NAMESPACE failure by adding - prefix to ReadWritePaths, adding ExecStartPre cache directory creation with root permissions, and updating apps/admin package.json build script to create and chmod .next/standalone/.../cache."
---

# Fix pantry-admin mount namespacing failure on rebuild

Resolved systemd 226/NAMESPACE failure by adding - prefix to ReadWritePaths, adding ExecStartPre cache directory creation with root permissions, and updating apps/admin package.json build script to create and chmod .next/standalone/.../cache.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
