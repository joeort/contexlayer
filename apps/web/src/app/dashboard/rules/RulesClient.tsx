'use client'

import { useState } from 'react'
import { Shield, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { RuleEditor } from './RuleEditor'

const RULE_TYPE_LABELS: Record<string, string> = {
  filter: 'Filter',
  join: 'Join',
  exclusion: 'Exclusion',
  alias: 'Alias',
  nuance: 'Nuance',
  temporal_change: 'Definition Change',
}

const RULE_TYPE_COLORS: Record<string, string> = {
  filter: 'bg-blue-50 text-blue-700',
  join: 'bg-purple-50 text-purple-700',
  exclusion: 'bg-red-50 text-red-700',
  alias: 'bg-gray-50 text-gray-700',
  nuance: 'bg-yellow-50 text-yellow-700',
  temporal_change: 'bg-orange-50 text-orange-700',
}

interface BusinessRule {
  id: string
  ruleType: string
  title: string
  description: string
  effectiveFrom: string | null
  effectiveTo: string | null
  isActive: boolean
  priority: number
  createdAt: string
}

interface Props {
  initialRules: BusinessRule[]
  apiUrl: string
}

export function RulesClient({ initialRules, apiUrl }: Props) {
  const [rules, setRules] = useState<BusinessRule[]>(initialRules)
  const [showEditor, setShowEditor] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  function handleCreated(rule: unknown) {
    setRules((prev) => [rule as BusinessRule, ...prev])
    setShowEditor(false)
  }

  async function handleRevoke(id: string) {
    setRevoking(id)
    try {
      await fetch(`${apiUrl}/api/v1/rules/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setRules((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      {showEditor && (
        <RuleEditor
          apiUrl={apiUrl}
          onCreated={handleCreated}
          onCancel={() => setShowEditor(false)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Rules</h1>
          <p className="text-gray-500 mt-1">
            Organizational nuances, filters, and definition changes applied to every AI query
          </p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Shield className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-700 mb-1">No business rules yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add rules like "always exclude Account.Type = Internal" or "MQL definition changed May 2025"
          </p>
          <button
            onClick={() => setShowEditor(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white border border-gray-200 rounded-xl p-5 ${!rule.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RULE_TYPE_COLORS[rule.ruleType] ?? 'bg-gray-50 text-gray-700'}`}>
                      {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                    </span>
                    {(rule.effectiveFrom || rule.effectiveTo) && (
                      <span className="text-xs text-gray-400">
                        {formatDate(rule.effectiveFrom)}
                        {rule.effectiveTo ? ` → ${formatDate(rule.effectiveTo)}` : ' → present'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{rule.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{rule.description}</p>
                </div>
                <button
                  onClick={() => handleRevoke(rule.id)}
                  disabled={revoking === rule.id}
                  className="shrink-0 p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Deactivate rule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
