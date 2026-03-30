import type { AnalyzeResult } from '../analyzer'

export enum ProductPriority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum ScoringLogType {
  Info = 'info',
  Success = 'success',
  Warn = 'warn',
  Error = 'error',
  Scored = 'scored',
  Done = 'done',
}

export interface RecommendedProduct {
  product: string
  why: string
  estimated_impact: string
  priority: ProductPriority
}

export interface ScoreResult {
  pain_score: number
  pain_points: string
  revenue_leaks: string
  recommended_products: RecommendedProduct[]
  suggested_angle: string
  message_draft: string
}

export interface ScoreInput {
  name: string
  niche: string | null
  city: string | null
  website: string | null
  rating: number | null
  review_count: number
  signals: AnalyzeResult
}
