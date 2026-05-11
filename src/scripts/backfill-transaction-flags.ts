// Run with: npx tsx src/scripts/backfill-transaction-flags.ts [--dry-run]
//
// Purpose: stamp is_excluded='false', is_one_time='false' on every existing
// transaction row so downstream `toBool` calls behave consistently across
// browsers/clients.
//
// Talks to the GAS web app directly (does NOT use the in-app adapter, which
// depends on Vite/browser globals).

const DRY_RUN = process.argv.includes('--dry-run')
const GAS_URL = process.env.VITE_GAS_URL

if (!GAS_URL) {
  console.error('Missing VITE_GAS_URL env. Set it in your shell or .env before running.')
  process.exit(1)
}

interface Row {
  id: string
  is_excluded?: unknown
  is_one_time?: unknown
  [key: string]: unknown
}

async function getAll(): Promise<Row[]> {
  const url = `${GAS_URL}?resource=transactions&action=getAll`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`getAll failed: ${res.status}`)
  return res.json() as Promise<Row[]>
}

async function update(id: string, data: Record<string, unknown>): Promise<string> {
  const res = await fetch(GAS_URL!, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action: 'update', resource: 'transactions', id, data }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`update ${id} failed: ${res.status} body=${text.slice(0, 500)}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`update ${id} returned non-JSON (status=${res.status} url=${res.url}): ${text.slice(0, 500)}`)
  }
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(`update ${id} GAS error: ${(parsed as { error: string }).error}`)
  }
  return text.slice(0, 200)
}

async function main() {
  console.log(DRY_RUN ? '*** DRY RUN — no writes will be sent ***' : 'Live mode — writes will be sent')
  const rows = await getAll()
  let updated = 0
  let alreadyBackfilled = 0
  for (const r of rows) {
    const needsExcluded = r.is_excluded === undefined || r.is_excluded === '' || r.is_excluded === null
    const needsOneTime = r.is_one_time === undefined || r.is_one_time === '' || r.is_one_time === null
    if (!needsExcluded && !needsOneTime) {
      alreadyBackfilled++
      continue
    }
    const patch: Record<string, unknown> = {}
    if (needsExcluded) patch.is_excluded = 'false'
    if (needsOneTime) patch.is_one_time = 'false'
    if (DRY_RUN) {
      console.log(`Would backfill ${r.id}: ${JSON.stringify(patch)}`)
    } else {
      const responseText = await update(String(r.id), patch)
      console.log(`Backfilled ${r.id} — GAS returned: ${responseText}`)
    }
    updated++
  }
  console.log(`Done. ${updated} updated, ${alreadyBackfilled} already-backfilled, ${rows.length} total.`)
}

main().catch(err => { console.error(err); process.exit(1) })
