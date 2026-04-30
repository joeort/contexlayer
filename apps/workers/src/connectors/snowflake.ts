import { createRequire } from 'module'
import { promisify } from 'util'
import type { IConnector, ConnectorCrawlContext } from './registry.js'
import type { FieldRepo } from '@context-layer/database'

// snowflake-sdk is CommonJS; createRequire bridges it into ESM
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const snowflake = require('snowflake-sdk') as SnowflakeSdk

snowflake.configure({ ocspFailOpen: false, logLevel: 'WARN' })

interface SnowflakeSdk {
  configure: (opts: { ocspFailOpen: boolean; logLevel: string }) => void
  createConnection: (opts: SnowflakeConnectionOpts) => SnowflakeConnection
}

interface SnowflakeConnectionOpts {
  account: string
  username: string
  password: string
  warehouse: string
  database: string
  schema: string
}

interface SnowflakeConnection {
  connect: (cb: (err: Error | null, conn: SnowflakeConnection) => void) => void
  destroy: (cb: (err: Error | null) => void) => void
  execute: (opts: { sqlText: string; complete: (err: Error | null, stmt: unknown, rows: Record<string, unknown>[]) => void }) => void
}

interface ColumnRow {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
  COLUMN_NAME: string
  DATA_TYPE: string
  IS_NULLABLE: string
  COMMENT: string | null
}

export class SnowflakeConnector implements IConnector {
  async crawlSchema(ctx: ConnectorCrawlContext): Promise<void> {
    const { orgId, connectorId, credentials, fieldRepo } = ctx
    const creds = getCredentials(credentials)

    const connection = snowflake.createConnection({
      account: creds.account,
      username: creds.username,
      password: creds.password,
      warehouse: creds.warehouse,
      database: creds.database,
      schema: 'INFORMATION_SCHEMA',
    })

    await promisify<void>((cb) => connection.connect((err) => cb(err, undefined as unknown as void)))()

    try {
      const rows = await executeQuery(connection, `
        SELECT
          c.TABLE_SCHEMA,
          c.TABLE_NAME,
          t.TABLE_TYPE,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
        WHERE c.TABLE_CATALOG = CURRENT_DATABASE()
          AND c.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA')
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
      `)

      await upsertFields(rows as ColumnRow[], orgId, connectorId, creds.database, fieldRepo)
      console.log(`[snowflake] crawled ${rows.length} columns for org ${orgId}`)
    } finally {
      await promisify<void>((cb) => connection.destroy((err) => cb(err, undefined as unknown as void)))()
    }
  }
}

async function upsertFields(
  rows: ColumnRow[],
  orgId: string,
  connectorId: string,
  database: string,
  fieldRepo: FieldRepo
): Promise<void> {
  // Group columns by schema.table
  const tables = new Map<string, ColumnRow[]>()
  for (const row of rows) {
    const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`
    if (!tables.has(key)) tables.set(key, [])
    tables.get(key)!.push(row)
  }

  for (const [key, columns] of tables) {
    const [schema, tableName] = key.split('.')
    const sample = columns[0]

    const schemaObj = await fieldRepo.upsertObject(orgId, connectorId, {
      objectName: `${database}.${key}`,
      objectLabel: `${schema}.${tableName}`,
      objectType: sample.TABLE_TYPE === 'VIEW' ? 'custom' : 'standard',
      recordCount: null,
      metadata: { schema, database, tableType: sample.TABLE_TYPE },
    })

    for (const col of columns) {
      await fieldRepo.upsertField(orgId, connectorId, schemaObj.id, {
        fieldName: col.COLUMN_NAME,
        fieldLabel: col.COLUMN_NAME,
        fieldType: mapSnowflakeType(col.DATA_TYPE),
        isCustom: false,
        formula: null,
        metadata: {
          dataType: col.DATA_TYPE,
          isNullable: col.IS_NULLABLE === 'YES',
          comment: col.COMMENT,
        },
        sampleValues: null,
        nullRate: null,
      })
    }
  }
}

function executeQuery(connection: SnowflakeConnection, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, _stmt, rows) => {
        if (err) reject(err)
        else resolve(rows ?? [])
      },
    })
  })
}

function getCredentials(credentials: Record<string, unknown>) {
  const account = credentials.account as string
  const username = credentials.username as string
  const password = credentials.password as string
  const warehouse = credentials.warehouse as string
  const database = credentials.database as string
  const schema = (credentials.schema as string) ?? 'PUBLIC'

  if (!account || !username || !password || !warehouse || !database) {
    throw new Error('Snowflake credentials missing required fields')
  }
  return { account, username, password, warehouse, database, schema }
}

function mapSnowflakeType(dataType: string): import('@context-layer/shared').FieldType {
  const t = dataType.toUpperCase()
  if (t.startsWith('NUMBER') || t.startsWith('NUMERIC') || t.startsWith('DECIMAL') ||
      t.startsWith('INT') || t === 'FLOAT' || t === 'REAL' || t.startsWith('DOUBLE')) return 'number'
  if (t === 'BOOLEAN') return 'boolean'
  if (t === 'DATE') return 'date'
  if (t.startsWith('TIMESTAMP') || t === 'DATETIME') return 'datetime'
  if (t.startsWith('VARCHAR') || t === 'STRING' || t === 'TEXT' || t === 'CHAR' || t.startsWith('NCHAR')) return 'text'
  if (t === 'VARIANT' || t === 'OBJECT' || t === 'ARRAY') return 'text'
  return 'unknown'
}
