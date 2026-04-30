import type { Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import { getPool, ReportRepo, MetricRepo } from '@context-layer/database'
import type { ReportAnalyzeJobData } from '@context-layer/shared'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function reportAnalyzeProcessor(job: Job<ReportAnalyzeJobData>) {
  const { orgId, reportId } = job.data
  const pool = getPool()
  const reportRepo = new ReportRepo(pool)

  const report = await reportRepo.getById(reportId, orgId)
  if (!report) {
    console.warn(`[report-analyze] report not found: ${reportId}`)
    return
  }

  await reportRepo.setAnalysisStatus(reportId, 'analyzing')

  try {
    const result = await analyzeReport(report.name, report.rawDefinition)
    await reportRepo.setAnalysisResult(reportId, result)
    console.log(`[report-analyze] complete: report=${reportId} metric="${result.metricName}" confidence=${result.confidence}`)
  } catch (err) {
    await reportRepo.setAnalysisStatus(reportId, 'failed')
    throw err
  }
}

async function analyzeReport(
  reportName: string,
  rawDefinition: Record<string, unknown>
): Promise<import('@context-layer/shared').ReportAnalysisResult> {
  const systemPrompt = `You are analyzing a report definition from a CRM or BI tool to extract metric definitions for a data dictionary.
Given the report configuration, identify:
1. What business metric this report measures (ARR, Bookings, Pipeline, NRR, MQL, etc.)
2. The exact filter conditions that define the metric
3. The primary numeric field being aggregated (use the API field name)
4. What should be EXCLUDED from this metric
5. Any important nuances a data analyst should know

Respond ONLY with valid JSON matching this exact structure:
{
  "metricName": "string",
  "metricAliases": ["string"],
  "category": "revenue|pipeline|activity|product|finance|marketing|customer_success",
  "primaryField": "string (API field name)",
  "aggregation": "SUM|COUNT|COUNT_DISTINCT|AVG",
  "filters": [{"field": "string", "op": "string", "value": "any"}],
  "exclusions": ["string"],
  "notes": "string",
  "confidence": 0.0
}`

  const userPrompt = `Report Name: ${reportName}

Report Definition:
${JSON.stringify(rawDefinition, null, 2)}

Extract the metric definition as JSON.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? [null, text]
  const parsed = JSON.parse(jsonMatch[1] ?? text)

  return {
    metricName: parsed.metricName ?? reportName,
    metricAliases: parsed.metricAliases ?? [],
    category: parsed.category ?? 'revenue',
    primaryField: parsed.primaryField ?? '',
    aggregation: parsed.aggregation ?? 'SUM',
    filters: parsed.filters ?? [],
    exclusions: parsed.exclusions ?? [],
    notes: parsed.notes ?? '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
  }
}
