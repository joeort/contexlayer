interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

export class EmbeddingService {
  // Request-scoped cache to avoid duplicate API calls within a single MCP request
  private cache = new Map<string, number[]>()

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const key = text.slice(0, 200)
    if (this.cache.has(key)) return this.cache.get(key)!

    if (!this.apiKey) {
      // Return empty vector — semantic search won't work but nothing will crash
      return []
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8191),
        dimensions: 1536,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI embeddings ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = (await res.json()) as OpenAIEmbeddingResponse
    const embedding = data.data[0].embedding
    this.cache.set(key, embedding)
    return embedding
  }
}
