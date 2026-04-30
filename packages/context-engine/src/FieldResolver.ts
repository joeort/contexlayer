import type { DbClient } from '@context-layer/database/client'
import { FieldRepo } from '@context-layer/database'
import type { EmbeddingService } from './EmbeddingService.js'

export interface ResolvedField {
  fieldName: string
  fieldLabel: string | null
  object: string
  connector: string
  usageNote: string | null
  isPreferred: boolean
  alternatives: Array<{ fieldName: string; object: string; context: string }>
  disambiguationNote: string | null
}

export class FieldResolver {
  private repo: FieldRepo

  constructor(db: DbClient, private embedding: EmbeddingService) {
    this.repo = new FieldRepo(db)
  }

  async resolve(
    concept: string,
    orgId: string,
    opts: { objectHint?: string; connectorHint?: string } = {}
  ): Promise<ResolvedField | null> {
    const vec = await this.embedding.embed(concept)

    // If no embeddings available, return null gracefully
    if (vec.length === 0) return null

    // 1. Look for a human-marked preferred field
    const preferred = await this.repo.findPreferred(orgId, vec)
    if (preferred) {
      return {
        fieldName: preferred.fieldName,
        fieldLabel: preferred.fieldLabel,
        object: preferred.objectId, // objectId is UUID; callers use fieldName + objectId
        connector: preferred.connectorId,
        usageNote: preferred.annotation.usageNotes,
        isPreferred: true,
        alternatives: [],
        disambiguationNote: null,
      }
    }

    // 2. Find top-5 similar fields by embedding
    const similar = await this.repo.findSimilar(orgId, vec, 5)
    if (similar.length === 0) return null

    const [best, ...rest] = similar
    const disambiguation =
      rest.length > 0
        ? `Your org has ${rest.length + 1} similar fields for "${concept}". ` +
          `Using ${best.fieldName} (closest match). ` +
          `Also found: ${rest.map((f) => f.fieldName).join(', ')}. ` +
          `Mark one as preferred in the Dictionary to remove this ambiguity.`
        : null

    return {
      fieldName: best.fieldName,
      fieldLabel: best.fieldLabel,
      object: best.objectId,
      connector: best.connectorId,
      usageNote: null,
      isPreferred: false,
      alternatives: rest.map((f) => ({
        fieldName: f.fieldName,
        object: f.objectId,
        context: 'similar embedding',
      })),
      disambiguationNote: disambiguation,
    }
  }
}
