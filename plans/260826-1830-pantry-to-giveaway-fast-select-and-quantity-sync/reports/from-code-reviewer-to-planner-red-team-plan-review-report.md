# Adversarial Red Team Review Report

**Target Plan:** `plans/260826-1830-pantry-to-giveaway-fast-select-and-quantity-sync/plan.md`  
**Review Lenses:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic  
**Evidence-Based Findings:** 5 findings identified with codebase citations.

---

### Red Team Findings & Proposed Adjudications

#### Finding 1: Household Record Authorization Guard Bypass
- **Severity:** High
- **Location:** Phase 2, section "Creation Guard & Scope (`create.ts`)"
- **Flaw:** Using raw `record.userId !== req.user.id` prevents household members from giving away shared household pantry items and allows subtle IDOR edge cases.
- **Evidence:** `api/src/services/households/permissions.ts:58-72` defines `assertCanWriteRecord(record, callerId)` which handles both personal ownership and verified household membership (`assertMember(record.householdId, callerId)`).
- **Suggested Fix:** Replace custom check in `create.ts` with `await assertCanWriteRecord(record, req.user.id)`.
- **Proposed Disposition:** **Accept**

---

#### Finding 2: Decimal Quantity Incompatibility Between Pantry Records and Giveaways
- **Severity:** Critical
- **Location:** Phase 1, section "giveawayCreateSchema & giveawayPatchSchema"
- **Flaw:** In `packages/shared/src/schemas/record.ts:15` and `apps/mobile/src/features/records/QuickEditModal.tsx:112`, pantry record quantities support decimals (e.g. `1.5 kg`, `0.5 l`). The plan used `z.number().int().min(1)`, which will reject valid decimal pantry items when users attempt to give away `0.5 kg` of an item.
- **Evidence:** `packages/shared/src/schemas/record.ts:15` (`quantity: z.number().nonnegative().max(100_000)`).
- **Suggested Fix:** Use `z.coerce.number().positive().max(100_000)` in `giveawayCreateSchema` and `giveawayPatchSchema` to support both integer units (`pcs`, `can`) and decimal units (`kg`, `l`).
- **Proposed Disposition:** **Accept**

---

#### Finding 3: Pre-Claim Consumption/Deletion Edge Case
- **Severity:** High
- **Location:** Phase 2, section "Claim-Time Atomic Deduction (`select.ts`)"
- **Flaw:** Between giveaway posting and neighbor claim selection, the giver may consume or delete the linked pantry record locally in their Pantry tab (`RecordDetail` -> `mark('consumed')`). If `select.ts` unconditionally expects an active record with sufficient quantity, it could fail with an unexpected error or abort the claim selection.
- **Evidence:** `apps/mobile/app/(app)/record/[id].tsx:68-71` and `api/src/routes/giveaways/select.ts:22-73`.
- **Suggested Fix:** In `select.ts`, if `giveaway.recordId` is present but the linked record is already `consumed` or deleted, allow the claim selection to proceed gracefully without throwing an unhandled error.
- **Proposed Disposition:** **Accept**

---

#### Finding 4: Cancellation Quantity Restoration on Deleted Record
- **Severity:** Medium
- **Location:** Phase 2, section "Cancellation Quantity Restoration (`cancel.ts`)"
- **Flaw:** If a claimed giveaway is cancelled, attempting to restore quantity to `recordId` could fail if the record was hard-deleted or if the user left the household.
- **Evidence:** `api/src/routes/giveaways/cancel.ts:15-30`.
- **Suggested Fix:** In `cancel.ts`, check if `record` exists; if null, skip quantity restoration safely without rolling back the giveaway cancellation.
- **Proposed Disposition:** **Accept**

---

#### Finding 5: Atomic Quantity Decrement & Concurrency Guard
- **Severity:** High
- **Location:** Phase 2, section "Transactional Claim Deduction (`select.ts`)"
- **Flaw:** Concurrent claim operations on the same record could lead to negative quantities if not guarded by row-level locking or atomic decrement constraints.
- **Evidence:** `api/src/routes/giveaways/select.ts:37-60`.
- **Suggested Fix:** Execute the deduction inside `prisma.$transaction` with a check `if (remaining > 0)` and ensure non-negative quantity constraints.
- **Proposed Disposition:** **Accept**
