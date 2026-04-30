import type { Job } from 'bullmq'
import { getPool } from '@context-layer/database'
import type { EmbeddingGenJobData } from '@context-layer/shared'

export async function embeddingGenProcessor(job: Job<EmbeddingGenJobData>) {
  const { orgId, entityType, entityId } = job.data
  const pool = getPool()

  let text = ''
  let table = ''

  if (entityType === 'field') {
    const { rows } = await pool.query(
      `SELECT sf.field_label, sf.field_name, so.object_label, so.object_name, sf.formula
       FROM schema_fields sf
       JOIN schema_objects so ON so.id = sf.object_id
       WHERE sf.id = $1 AND sf.org_id = $2`,
      [entityId, orgId]
    )
    if (!rows[0]) return
    const r = rows[0]
    text = [
      r.object_label ?? r.object_name,
      '>',
      r.field_label ?? r.field_name,
      r.formula ? `: ${r.formula}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    table = 'schema_fields'
  } else if (entityType === 'metric') {
    const { rows } = await pool.query(
      'SELECT name, aliases, description FROM metrics WHERE id = $1 AND org_id = $2',
      [entityId, orgId]
    )
    if (!rows[0]) return
    const r = rows[0]
    text = [r.name, ...(r.aliases ?? []), r.description].filter(Boolean).join(' ')
    table = 'metrics'
  } else if (entityType === 'business_rule') {
    const { rows } = await pool.query(
      'SELECT title, description FROM business_rules WHERE id = $1 AND org_id = $2',
      [entityId, orgId]
    )
    if (!rows[0]) return
    text = `${rows[0].title}: ${rows[0].description}`
    table = 'business_rules'
  }

  if (!text) return

  const embedding = await generateEmbedding(text)

  await pool.query(`UPDATE ${table} SET embedding = $1::vector WHERE id = $2`, [
    JSON.stringify(embedding),
    entityId,
  ])

  console.log(`[embedding-gen] ${entityType}=${entityId} dims=${embedding.length}`)
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>
  usage: { prompt_tokens: number; total_tokens: number }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[embedding-gen] OPENAI_API_KEY not set — skipping embedding')
    return []
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191), // model token limit
      dimensions: 1536,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embeddings API ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as OpenAIEmbeddingResponse
  return data.data[0].embedding
}
