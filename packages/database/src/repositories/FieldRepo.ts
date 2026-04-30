import type { DbClient } from '../client.js'
import type { SchemaField, SchemaObject, FieldAnnotation } from '@context-layer/shared'

function rowToField(row: Record<string, unknown>): SchemaField {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    connectorId: row.connector_id as string,
    objectId: row.object_id as string,
    fieldName: row.field_name as string,
    fieldLabel: (row.field_label as string) ?? null,
    fieldType: row.field_type as SchemaField['fieldType'],
    isCustom: row.is_custom as boolean,
    formula: (row.formula as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    sampleValues: (row.sample_values as unknown[]) ?? null,
    nullRate: (row.null_rate as number) ?? null,
    discoveredAt: new Date(row.discovered_at as string),
  }
}

function rowToObject(row: Record<string, unknown>): SchemaObject {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    connectorId: row.connector_id as string,
    objectName: row.object_name as string,
    objectLabel: (row.object_label as string) ?? null,
    objectType: row.object_type as SchemaObject['objectType'],
    recordCount: (row.record_count as number) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    discoveredAt: new Date(row.discovered_at as string),
  }
}

export class FieldRepo {
  constructor(private db: DbClient) {}

  async listObjects(orgId: string, connectorId?: string): Promise<SchemaObject[]> {
    const conditions = ['org_id = $1']
    const params: unknown[] = [orgId]
    if (connectorId) {
      conditions.push(`connector_id = $${params.length + 1}`)
      params.push(connectorId)
    }
    const { rows } = await this.db.query(
      `SELECT * FROM schema_objects WHERE ${conditions.join(' AND ')} ORDER BY object_label, object_name`,
      params
    )
    return rows.map(rowToObject)
  }

  async listFields(orgId: string, objectId: string): Promise<SchemaField[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM schema_fields WHERE org_id = $1 AND object_id = $2
       ORDER BY is_custom ASC, field_label, field_name`,
      [orgId, objectId]
    )
    return rows.map(rowToField)
  }

  async upsertObject(
    orgId: string,
    connectorId: string,
    data: Pick<SchemaObject, 'objectName' | 'objectLabel' | 'objectType' | 'recordCount' | 'metadata'>
  ): Promise<SchemaObject> {
    const { rows } = await this.db.query(
      `INSERT INTO schema_objects
         (org_id, connector_id, object_name, object_label, object_type, record_count, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (connector_id, object_name)
       DO UPDATE SET
         object_label = EXCLUDED.object_label,
         object_type = EXCLUDED.object_type,
         record_count = EXCLUDED.record_count,
         metadata = EXCLUDED.metadata,
         discovered_at = NOW()
       RETURNING *`,
      [
        orgId, connectorId, data.objectName, data.objectLabel,
        data.objectType, data.recordCount, JSON.stringify(data.metadata),
      ]
    )
    return rowToObject(rows[0])
  }

  async upsertField(
    orgId: string,
    connectorId: string,
    objectId: string,
    data: Pick<SchemaField, 'fieldName' | 'fieldLabel' | 'fieldType' | 'isCustom' | 'formula' | 'metadata' | 'sampleValues' | 'nullRate'>
  ): Promise<SchemaField> {
    const { rows } = await this.db.query(
      `INSERT INTO schema_fields
         (org_id, connector_id, object_id, field_name, field_label, field_type,
          is_custom, formula, metadata, sample_values, null_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (object_id, field_name)
       DO UPDATE SET
         field_label = EXCLUDED.field_label,
         field_type = EXCLUDED.field_type,
         is_custom = EXCLUDED.is_custom,
         formula = EXCLUDED.formula,
         metadata = EXCLUDED.metadata,
         sample_values = EXCLUDED.sample_values,
         null_rate = EXCLUDED.null_rate,
         discovered_at = NOW()
       RETURNING *`,
      [
        orgId, connectorId, objectId, data.fieldName, data.fieldLabel, data.fieldType,
        data.isCustom, data.formula, JSON.stringify(data.metadata),
        JSON.stringify(data.sampleValues), data.nullRate,
      ]
    )
    return rowToField(rows[0])
  }

  async setAnnotation(
    orgId: string,
    fieldId: string,
    data: Pick<FieldAnnotation, 'description' | 'usageNotes' | 'isPreferred' | 'replacesFieldId' | 'confidence'>,
    authoredBy: string
  ): Promise<FieldAnnotation> {
    const { rows } = await this.db.query(
      `INSERT INTO field_annotations
         (org_id, field_id, description, usage_notes, is_preferred, replaces_field_id, confidence, authored_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (field_id, is_preferred) WHERE is_preferred = TRUE
       DO UPDATE SET
         description = EXCLUDED.description,
         usage_notes = EXCLUDED.usage_notes,
         replaces_field_id = EXCLUDED.replaces_field_id,
         confidence = EXCLUDED.confidence,
         authored_by = EXCLUDED.authored_by,
         updated_at = NOW()
       RETURNING *`,
      [
        orgId, fieldId, data.description, data.usageNotes,
        data.isPreferred, data.replacesFieldId, data.confidence, authoredBy,
      ]
    )
    return {
      id: rows[0].id,
      orgId: rows[0].org_id,
      fieldId: rows[0].field_id,
      description: rows[0].description,
      usageNotes: rows[0].usage_notes,
      isPreferred: rows[0].is_preferred,
      replacesFieldId: rows[0].replaces_field_id,
      authoredBy: rows[0].authored_by,
      confidence: rows[0].confidence,
      createdAt: new Date(rows[0].created_at),
      updatedAt: new Date(rows[0].updated_at),
    }
  }

  async findSimilar(orgId: string, embedding: number[], limit = 10): Promise<SchemaField[]> {
    const { rows } = await this.db.query(
      `SELECT sf.* FROM schema_fields sf
       WHERE sf.org_id = $2 AND sf.embedding IS NOT NULL
       ORDER BY sf.embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(embedding), orgId, limit]
    )
    return rows.map(rowToField)
  }

  // Find preferred field for a semantic concept
  async findPreferred(orgId: string, embedding: number[]): Promise<(SchemaField & { annotation: FieldAnnotation }) | null> {
    const { rows } = await this.db.query(
      `SELECT sf.*, fa.id as ann_id, fa.description, fa.usage_notes, fa.is_preferred,
              fa.replaces_field_id, fa.authored_by, fa.confidence,
              fa.created_at as ann_created_at, fa.updated_at as ann_updated_at
       FROM schema_fields sf
       JOIN field_annotations fa ON fa.field_id = sf.id AND fa.is_preferred = TRUE
       WHERE sf.org_id = $2 AND sf.embedding IS NOT NULL
       ORDER BY sf.embedding <=> $1::vector
       LIMIT 1`,
      [JSON.stringify(embedding), orgId]
    )
    if (!rows[0]) return null
    return {
      ...rowToField(rows[0]),
      annotation: {
        id: rows[0].ann_id,
        orgId,
        fieldId: rows[0].id,
        description: rows[0].description,
        usageNotes: rows[0].usage_notes,
        isPreferred: rows[0].is_preferred,
        replacesFieldId: rows[0].replaces_field_id,
        authoredBy: rows[0].authored_by,
        confidence: rows[0].confidence,
        createdAt: new Date(rows[0].ann_created_at),
        updatedAt: new Date(rows[0].ann_updated_at),
      },
    }
  }
}
