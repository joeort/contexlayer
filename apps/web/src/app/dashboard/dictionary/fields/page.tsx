import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { PreferredToggle } from './PreferredToggle'

interface SchemaObject {
  id: string
  objectName: string
  objectLabel: string
  objectType: 'standard' | 'custom'
}

interface SchemaField {
  id: string
  fieldName: string
  fieldLabel: string
  fieldType: string
  isCustom: boolean
  formula: string | null
  annotation?: {
    description: string | null
    usageNotes: string | null
    isPreferred: boolean
  } | null
}

async function apiGet<T>(path: string, token: string): Promise<T | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  currency: 'bg-green-50 text-green-700',
  number: 'bg-blue-50 text-blue-700',
  text: 'bg-gray-100 text-gray-600',
  boolean: 'bg-purple-50 text-purple-700',
  date: 'bg-yellow-50 text-yellow-700',
  datetime: 'bg-yellow-50 text-yellow-700',
  lookup: 'bg-pink-50 text-pink-700',
  formula: 'bg-indigo-50 text-indigo-700',
  rollup: 'bg-orange-50 text-orange-700',
  picklist: 'bg-teal-50 text-teal-700',
  multipicklist: 'bg-teal-50 text-teal-700',
}

export default async function FieldsPage({
  searchParams,
}: {
  searchParams: { objectId?: string }
}) {
  const { getToken } = await auth()
  const token = await getToken()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  const objects = token
    ? await apiGet<SchemaObject[]>('/api/v1/fields/objects', token)
    : null

  const selectedObjectId = searchParams.objectId ?? objects?.[0]?.id
  const selectedObject = objects?.find((o) => o.id === selectedObjectId)

  const fields =
    token && selectedObjectId
      ? await apiGet<SchemaField[]>(
          `/api/v1/fields/objects/${selectedObjectId}/fields`,
          token
        )
      : null

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/dictionary"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Data Dictionary
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Fields</h1>
        <p className="text-gray-500 mt-1">
          Browse fields discovered from your connected systems. Star a field to mark it as the canonical one for a business concept.
        </p>
      </div>

      {!objects || objects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500 font-medium">No fields discovered yet</p>
          <p className="text-sm text-gray-400 mt-1">Connect a system and run a sync first.</p>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-220px)]">
          {/* Object sidebar */}
          <div className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Objects</p>
            </div>
            <div className="py-1">
              {objects.map((obj) => (
                <Link
                  key={obj.id}
                  href={`/dashboard/dictionary/fields?objectId=${obj.id}`}
                  className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    obj.id === selectedObjectId
                      ? 'bg-teal-50 text-teal-DEFAULT font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">{obj.objectLabel}</span>
                  {obj.objectType === 'custom' && (
                    <span className="text-xs text-gray-400 ml-1 shrink-0">custom</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Field list */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selectedObject?.objectLabel}</p>
                <p className="text-xs text-gray-400">{selectedObject?.objectName}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                = preferred canonical field
              </div>
            </div>

            {!fields || fields.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No fields found</div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Field
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                        Type
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Formula / Notes
                      </th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fields.map((field) => {
                      const typeColor = FIELD_TYPE_COLORS[field.fieldType] ?? 'bg-gray-100 text-gray-600'
                      return (
                        <tr
                          key={field.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            field.annotation?.isPreferred ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{field.fieldLabel}</p>
                            <p className="text-xs text-gray-400 font-mono">{field.fieldName}</p>
                            {field.annotation?.usageNotes && (
                              <p className="text-xs text-gray-500 mt-0.5">{field.annotation.usageNotes}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${typeColor}`}>
                              {field.fieldType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400 font-mono truncate max-w-xs">
                            {field.formula ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <PreferredToggle
                              fieldId={field.id}
                              isPreferred={field.annotation?.isPreferred ?? false}
                              apiUrl={apiUrl}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
