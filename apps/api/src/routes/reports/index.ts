import type { FastifyInstance } from 'fastify'
import { ReportRepo } from '@context-layer/database'
import { requireAuth } from '../../plugins/auth.js'

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get('/reports', { preHandler: requireAuth }, async (request) => {
    const { status } = request.query as { status?: string }
    const repo = new ReportRepo(fastify.db)
    return repo.listByOrg(request.auth!.orgId, status as any)
  })

  fastify.get<{ Params: { id: string } }>(
    '/reports/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new ReportRepo(fastify.db)
      const report = await repo.getById(request.params.id, request.auth!.orgId)
      if (!report) return reply.status(404).send({ message: 'Report not found' })
      return report
    }
  )

  // Re-trigger LLM analysis for a report
  fastify.post<{ Params: { id: string } }>(
    '/reports/:id/analyze',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new ReportRepo(fastify.db)
      const report = await repo.getById(request.params.id, request.auth!.orgId)
      if (!report) return reply.status(404).send({ message: 'Report not found' })

      const { ReportAnalyzeQueue } = await import('../../queues/index.js')
      await repo.setAnalysisStatus(report.id, 'pending')
      await ReportAnalyzeQueue.add(
        `analyze:${report.id}`,
        { orgId: report.orgId, connectorId: report.connectorId, reportId: report.id },
        { jobId: `analyze:${report.id}`, removeOnComplete: 50, removeOnFail: 50 }
      )

      return reply.status(202).send({ message: 'Analysis queued', reportId: report.id })
    }
  )

  // Reject analysis result (marks report as rejected — no metric created)
  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/reports/:id/reject',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new ReportRepo(fastify.db)
      const report = await repo.getById(request.params.id, request.auth!.orgId)
      if (!report) return reply.status(404).send({ message: 'Report not found' })

      await repo.setAnalysisStatus(report.id, 'failed')
      return reply.status(200).send({ message: 'Report rejected' })
    }
  )

  // Accept analysis result → create draft metric + version
  fastify.post<{ Params: { id: string } }>(
    '/reports/:id/accept',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = new ReportRepo(fastify.db)
      const report = await repo.getById(request.params.id, request.auth!.orgId)
      if (!report) return reply.status(404).send({ message: 'Report not found' })
      if (!report.analysisResult) return reply.status(422).send({ message: 'No analysis result to accept' })

      const { MetricRepo } = await import('@context-layer/database')
      const metricRepo = new MetricRepo(fastify.db)

      const metric = await metricRepo.create(request.auth!.orgId, {
        name: report.analysisResult.metricName,
        aliases: report.analysisResult.metricAliases,
        description: report.analysisResult.notes,
        category: report.analysisResult.category as any,
      })

      await metricRepo.addVersion(metric.id, request.auth!.orgId, {
        effectiveFrom: new Date(),
        definition: {
          primaryField: { connector: '', object: '', field: report.analysisResult.primaryField },
          aggregation: report.analysisResult.aggregation,
          filters: report.analysisResult.filters,
          joins: [],
          exclusions: report.analysisResult.exclusions,
          segmentBy: [],
        },
        notes: `Auto-generated from report: ${report.name}`,
        source: 'report_analysis',
        sourceRef: report.id,
      })

      return reply.status(201).send({ message: 'Metric created', metricId: metric.id })
    }
  )
}
