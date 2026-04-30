import Link from 'next/link'
import { BookOpen, Database, TrendingUp, Shield } from 'lucide-react'

export default function DictionaryPage() {
  const sections = [
    {
      href: '/dashboard/dictionary/fields',
      icon: Database,
      title: 'Fields',
      description: 'Browse discovered fields across all connected systems. Mark canonical fields for each business concept.',
      color: 'text-teal-DEFAULT',
      bg: 'bg-teal-50',
    },
    {
      href: '/dashboard/dictionary/metrics',
      icon: TrendingUp,
      title: 'Metrics',
      description: 'Named business metrics with versioned definitions. Temporal changes are tracked with effective dates.',
      color: 'text-navy-500',
      bg: 'bg-blue-50',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Data Dictionary</h1>
        <p className="text-gray-500 mt-1">
          The organizational context that powers your AI tools. Auto-generated from connected systems and refined by your team.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, title, description, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-DEFAULT hover:shadow-sm transition-all group"
          >
            <div className={`inline-flex p-3 ${bg} rounded-lg mb-4`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-teal-DEFAULT transition-colors mb-2">
              {title}
            </h2>
            <p className="text-sm text-gray-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
