export type AgentId =
  | 'contract'
  | 'infrastructure'
  | 'workforce'
  | 'historical'
  | 'financial'
  | 'decision'

export type NodeStatus = 'idle' | 'running' | 'green' | 'amber' | 'red'

export interface AgentState {
  status: NodeStatus
  risk_score?: number
  verdict?: string
  summary?: string
  tokens?: { in: number | null; out: number | null }
  time_ms?: number
  model?: string | null
  research?: Array<{ title: string; url: string; snippet: string }>
}

export interface RunResult {
  decision: string
  score: number
  conditions: string[]
  exposure_range: string
}

export interface ResearchItem {
  title: string
  url: string
  snippet: string
}

/* ── Item Research Agent types ────────────────────────────────────────────── */

export interface ItemResearchExtraField {
  key: string
  label: string
  type: 'text' | 'number' | 'bool' | 'select'
  opts?: string[]
  placeholder?: string
}

export interface ItemResearchResult {
  category: string
  category_label: string
  procurement_context: string
  risk_factors: string[]
  suggested_fields: {
    advance_payment_pct?: number
    delivery_timeline_months?: number
    warranty_start?: string
    installation_responsibility?: string
    training_included?: boolean
    construction_completion_pct?: number
    technicians_required?: number
    historical_delays_months?: number[]
  }
  regulatory_label: string
  workforce_label: string
  site_label: string
  requires_site_readiness: boolean
  extra_fields: ItemResearchExtraField[]
}

/* ── UI Guidance Agent types ──────────────────────────────────────────────── */

export interface UiGuidanceRfqIntake {
  requirement_summary: string
  suggested_requirements: string[]
  minimum_criteria: string[]
  negotiable_criteria: string[]
  missing_inputs: string[]
}

export interface UiGuidanceNegotiationGuidance {
  negotiation_questions: string[]
  contract_conditions: string[]
  cost_or_lifecycle_items: string[]
  vendor_message_draft: string
}

export interface UiGuidanceResult {
  agent: string
  status: string
  source_name: string
  mode: string
  rfq_intake: UiGuidanceRfqIntake
  negotiation_guidance: UiGuidanceNegotiationGuidance
  evidence: string[]
  guardrails: string[]
  risk_or_negotiation_signals?: string[]
  vendor_proposal_context?: Record<string, unknown>
  feature_weight_feedback?: string[]
  history?: { stored: boolean; run_id: string; error: string }
}

/* ── Bid workflow types ─────────────────────────────────────────────────── */

export interface Bid {
  bid_id: string
  procurement_name: string
  equipment_type: string
  quote_count: number
  status: string
}

export interface Quote {
  bid_id: string
  quote_id: string
  vendor_name: string
  equipment_type: string
  procurement_name: string
  source: string
  status: string
  pdf_path: string
  original_filename: string
  created_at: string
  updated_at: string
}

export interface RunAgent {
  status: 'waiting' | 'running' | 'completed' | 'failed'
  message: string
}

export interface RunQuote {
  quote_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  vendor_name?: string
  risk_score?: number
}

export interface BidGraphNode {
  id: string
  type?: string
  label: string
  status: string
}

export interface BidGraphEdge {
  source: string
  target: string
  type?: string
  status: string
}

export interface RunState {
  run_id: string
  bid_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  current_step: string
  agents: Record<string, RunAgent>
  quotes: RunQuote[]
  graph: { nodes: BidGraphNode[]; edges: BidGraphEdge[] }
  external_connections: { id: string; label: string; status: string }[]
  telemetry: { elapsed_ms: number; llm_calls: number; errors: number }
  error?: string
}

export interface QuoteReview {
  quote_id: string
  vendor_name: string
  risk_score: number
  risk_level: string
  findings: string[]
  recommendation: string
}

export interface MarketPriceRange {
  summary: string
  confidence: string
  sources?: Array<{ url: string; note: string; retrieved_at?: string }>
}

export interface MarketResearchSummary {
  status?: string
  equipment_type?: string
  market_price_range?: MarketPriceRange
  typical_terms?: Record<string, { summary: string; confidence: string }>
  vendor_landscape?: { summary: string; confidence: string }
  key_risk_signals?: string[]
}

export interface BidResult {
  run_id: string
  bid_id: string
  status: string
  agent?: string
  winner: QuoteReview
  ranked_quotes: QuoteReview[]
  shortlist?: QuoteReview[]
  rationale?: string
  feedback?: string[]
  negotiation_points?: string[]
  artifact_refs?: string[]
  market_research_summary?: MarketResearchSummary
}

/* ── PreMortem full report types ────────────────────────────────────────── */

export interface DebateTurn {
  agent: string
  statements: string[]
}

export interface ScenarioOutcome {
  name: string
  timeline_months: number
  financial_impact_cr: number
  operational_impact: string
  probability_pct: number
}

export interface FullReport {
  procurement_name: string
  equipment_type: string
  contract_value_cr: number
  overall_risk_score: number
  failure_probability_pct: number
  confidence_pct: number
  predicted_delay_months: number
  projected_financial_loss_cr: number
  predicted_failure_mode: string
  supporting_evidence: string[]
  predicted_outcomes: string[]
  recommended_decision: string
  conditions: string[]
  debate: DebateTurn[]
  scenarios: ScenarioOutcome[]
  generated_at: string
}

/* ── Database status types ──────────────────────────────────────────────── */

export interface DbStatusTable {
  exists: boolean
  row_count: number
}

export interface DbMemoryRow {
  agent_id: string
  source_path: string
  memory_type: string
  updated_at: string
}

export interface DbDecisionRow {
  run_id: string
  procurement_title: string
  risk_level: string
  risk_score: number | null
  created_at: string
}

export interface DbAgentHistoryCount {
  agent_id: string
  chunks: number
}

export interface DbStatusResult {
  database_configured: boolean
  database_connected: boolean
  pgvector_available: boolean
  tables: Record<string, DbStatusTable>
  recent_memory_rows: DbMemoryRow[]
  recent_decision_rows: DbDecisionRow[]
  agent_history_counts: DbAgentHistoryCount[]
  error: string
}
