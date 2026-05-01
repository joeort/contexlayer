import { RulesClient } from './RulesClient'

async function fetchRules(apiUrl: string) {
  try {
    const res = await fetch(`${apiUrl}/api/v1/rules`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function RulesPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const rules = await fetchRules(apiUrl)

  return (
    <div>
      <RulesClient initialRules={rules} apiUrl={apiUrl} />
    </div>
  )
}
