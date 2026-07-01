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

export interface ProfileReady {
  status: 'READY'
  category: string
  proposed_fields: Record<string, unknown>
  missing_fields: string[]
  research: ResearchItem[]
}

export interface ProfileOutOfScope {
  status: 'OUT_OF_SCOPE'
  reason: string
}

export type ProfileResponse = ProfileReady | ProfileOutOfScope

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
}

/* ── SSE types ──────────────────────────────────────────────────────────── */

export type SSEEvent =
  | { type: 'run_started'; agents: AgentId[] }
  | { type: 'agent_started'; id: AgentId }
  | {
      type: 'agent_finished'
      id: AgentId
      status: 'green' | 'amber' | 'red'
      risk_score: number
      verdict: string
      summary: string
      tokens: { in: number | null; out: number | null }
      time_ms: number
      model: string | null
      research: Array<{ title: string; url: string; snippet: string }>
    }
  | { type: 'run_finished'; decision: string; score: number; conditions: string[]; exposure_range: string }
  | { type: 'error'; message: string }
