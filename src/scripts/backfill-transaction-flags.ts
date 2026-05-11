// Run with: npx tsx src/scripts/backfill-transaction-flags.ts
// Purpose: stamp is_excluded='false', is_one_time='false' on every existing
// transaction row so downstream `toBool` calls behave consistently across
// browsers/clients.

import { adapter } from '@/api/client'

async function main() {
  const rows = await adapter.getAll('transactions')
  let updated = 0
  for (const r of rows) {
    const needsExcluded = r.is_excluded === undefined || r.is_excluded === ''
    const needsOneTime = r.is_one_time === undefined || r.is_one_time === ''
    if (!needsExcluded && !needsOneTime) continue
    const patch: Record<string, unknown> = {}
    if (needsExcluded) patch.is_excluded = 'false'
    if (needsOneTime) patch.is_one_time = 'false'
    await adapter.update('transactions', String(r.id), patch)
    updated++
    console.log(`Backfilled ${r.id}`)
  }
  console.log(`Done. ${updated}/${rows.length} rows updated.`)
}

main().catch(err => { console.error(err); process.exit(1) })
