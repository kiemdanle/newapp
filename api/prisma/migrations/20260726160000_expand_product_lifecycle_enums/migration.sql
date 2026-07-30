-- Expand product lifecycle enums only (no consumers, no data changes) so this
-- migration can commit even on PostgreSQL versions that refuse to use a
-- newly-added enum value inside the transaction that added it. Every existing
-- row and every existing enum value is left unchanged.
--
-- `pending` on "ProductStatus" predates creator submissions and today always
-- means a report-hidden catalog row. `report_hidden` gives compatibility
-- readers an explicit target once they deploy; `draft` and `changes_required`
-- are reserved for the creator-private draft/revision lifecycle that ships in
-- a later phase. None of these new values are written until their owning
-- phase deploys.
ALTER TYPE "ProductStatus" ADD VALUE 'report_hidden';
ALTER TYPE "ProductStatus" ADD VALUE 'draft';
ALTER TYPE "ProductStatus" ADD VALUE 'changes_required';

-- `rejected` on product_edit_status stays a terminal historical state. The new
-- values back the private-draft/active-revision moderation lifecycle.
ALTER TYPE "product_edit_status" ADD VALUE 'draft';
ALTER TYPE "product_edit_status" ADD VALUE 'changes_required';
