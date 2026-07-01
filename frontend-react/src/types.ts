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
