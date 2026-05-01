'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface RuleFormData {
  ruleType: string
  title: string
  description: string
  effectiveFrom: string
  effectiveTo: string
  priority: number
}

const RULE_TYPES = [
  { value: 'filter', label: 'Filter', hint: 'Always apply this WHERE clause to a metric or object' },
  { value: 'exclusion', label: 'Exclusion', hint: 'Exclude specific records from calculations' },
  { value: 'nuance', label: 'Nuance', hint: 'Org context included with every AI response' },
  { value: 'temporal_change', label: 'Definition Change', hint: 'A metric definition that changed on a date' },
  { value: 'alias', label: 'Alias', hint: 'Alternative name for a metric or field' },
  { value: 'join', label: 'Join', hint: 'How to join this object to another' },
]

interface Props {
  apiUrl: string
  onCreated: (rule: unknown) => void
  onCancel: () => void
}

export function RuleEditor({ apiUrl, onCreated, onCancel }: Props) {
  const [form, setForm] = useState<RuleFormData>({
    ruleType: 'exclusion',
    title: '',
    description: '',
    effectiveFrom: '',
    effectiveTo: '',
    priority: 50,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedType = RULE_TYPES.find((t) => t.value === form.ruleType)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/v1/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ruleType: form.ruleType,
          title: form.title.trim(),
          description: form.description.trim(),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
          priority: form.priority,
          appliesTo: {},
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const rule = await res.json()
      onCreated(rule)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Business Rule</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Rule type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rule type</label>
            <div className="grid grid-cols-2 gap-2">
              {RULE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, ruleType: type.value }))}
                  className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                    form.ruleType === type.value
                      ? 'border-teal-500 bg-teal-50 text-teal-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="font-medium">{type.label}</span>
                </button>
              ))}
            </div>
            {selectedType && (
              <p className="text-xs text-gray-500 mt-2">{selectedType.hint}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Exclude internal accounts"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
              <span className="ml-1 text-xs text-gray-400 font-normal">
                — used by AI to understand this rule
              </span>
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={
                form.ruleType === 'exclusion'
                  ? "Always exclude records where Account.Type = 'Internal' from all revenue calculations"
                  : form.ruleType === 'nuance'
                    ? 'We changed our MQL definition in May 2025 to require 3 or more intent signals instead of 1'
                    : 'Describe when and how this rule applies...'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Effective dates — shown for temporal_change and filter */}
          {(form.ruleType === 'temporal_change' || form.ruleType === 'filter') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective from</label>
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective to
                  <span className="ml-1 text-xs text-gray-400">optional</span>
                </label>
                <input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.description.trim()}
              className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Rule'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
