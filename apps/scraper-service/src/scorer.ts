import OpenAI from 'openai'
import { z } from 'zod'
import type { ScoreInput, ScoreResult } from './types/scoring'
import { ProductPriority } from './types/scoring'
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './prompts/score-lead'

const ScoreResultSchema = z.object({
  pain_score: z.number().int().min(1).max(9),
  pain_points: z.string(),
  revenue_leaks: z.string(),
  recommended_products: z.array(z.object({
    product: z.string(),
    why: z.string(),
    estimated_impact: z.string(),
    priority: z.enum([ProductPriority.High, ProductPriority.Medium, ProductPriority.Low]),
  })),
  suggested_angle: z.string(),
  message_draft: z.string(),
})

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export async function scoreLead(input: ScoreInput): Promise<ScoreResult> {
  const client = getOpenAIClient()
  const userPrompt = buildScoringUserPrompt(input)

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SCORING_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI returned empty response')
  }

  const parsed = JSON.parse(content)
  const validated = ScoreResultSchema.parse(parsed)
  return validated
}
