import re

# Edit admin-api.ts - add imports and deals methods
with open('apps/admin/src/lib/admin-api.ts', 'r') as f:
    content = f.read()

# Add imports for deal schemas
content = content.replace(
    "  adminRowSchema,\n} from '@expyrico/shared';",
    "  adminRowSchema,\n  adminDealsListSchema,\n} from '@expyrico/shared';"
)

# Add deals section between reports and analytics
content = content.replace(
    '  reports: {\n',
    '  deals: {\n    list: (q: Q = {}) =>\n      apiServerFetch(`/v1/admin/deals${qs(q)}`).then((r) => adminDealsListSchema.parse(r)),\n    setStatus: (id: string, status: \'visible\' | \'hidden\' | \'deleted\') =>\n      apiServerFetch(`/v1/admin/deals/${id}/status`, { method: \'PATCH\', body: { status } }),\n  },\n  reports: {\n'
)

with open('apps/admin/src/lib/admin-api.ts', 'w') as f:
    f.write(content)
print("admin-api.ts updated")

# Edit actions.ts - add deals actions
with open('apps/admin/src/lib/actions.ts', 'r') as f:
    content = f.read()

content = content.replace(
    '// --- Reports ---',
    '// --- Deals ---\nexport async function setDealStatusAction(id: string, status: \'visible\' | \'hidden\' | \'deleted\') {\n  await serverAdminApi.deals.setStatus(id, status);\n  revalidatePath(\'/deals\');\n}\n\n// --- Reports ---'
)

with open('apps/admin/src/lib/actions.ts', 'w') as f:
    f.write(content)
print("actions.ts updated")
