import { useState, useCallback } from 'react'
import type { AgentId, AgentState, FullReport, RunResult } from './types'

const INITIAL_STATES: Record<AgentId, AgentState> = {
  contract: { status: 'idle' },
  infrastructure: { status: 'idle' },
  workforce: { status: 'idle' },
  historical: { status: 'idle' },
  financial: { status: 'idle' },
  decision: { status: 'idle' },
}

const AGENT_NAME_MAP: Record<string, AgentId> = {
  contract: 'contract',
  infrastructure: 'infrastructure',
  workforce: 'workforce',
  historical: 'historical',
  financial: 'financial',
}

function agentNameToId(name: string): AgentId | null {
  const lower = name.toLowerCase()
  for (const [key, id] of Object.entries(AGENT_NAME_MAP)) {
    if (lower.includes(key)) return id
  }
  return null
}

function riskLevelToStatus(level: string): 'green' | 'amber' | 'red' {
  if (level === 'HIGH' || level === 'CRITICAL') return 'red'
  if (level === 'MODERATE') return 'amber'
  return 'green'
}

export function useAnalysisStream() {
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(INITIAL_STATES)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [fullReport, setFullReport] = useState<FullReport | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setAgentStates(INITIAL_STATES)
    setRunResult(null)
    setFullReport(null)
    setError(null)
  }, [])

  const startAnalysis = useCallback(async (input: object) => {
    setIsRunning(true)
    setError(null)
    setRunResult(null)
    setFullReport(null)

    // Show all agents as running while request is in flight
    setAgentStates(prev => {
      const next = { ...prev }
      for (const id of Object.keys(next) as AgentId[]) {
        next[id] = { ...next[id], status: 'running' }
      }
      return next
    })

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      const report = await response.json()

      // Map agent_results → agentStates
      const nextStates: Record<AgentId, AgentState> = { ...INITIAL_STATES }
      for (const ar of (report.agent_results ?? [])) {
        const id = agentNameToId(ar.agent ?? '')
        if (!id) continue
        nextStates[id] = {
          status: riskLevelToStatus(ar.risk_level ?? ''),
          risk_score: ar.risk_score,
          verdict: ar.recommendation,
          summary: ar.reasoning,
          research: (ar.evidence ?? []).slice(0, 4).map((e: string) => ({
            title: e, url: '', snippet: e,
          })),
          tokens: undefined,
          time_ms: undefined,
          model: undefined,
        }
      }

      // Decision board: derive status from recommended_decision
      const decision = report.recommended_decision ?? ''
      const decStr = typeof decision === 'string' ? decision : (decision.value ?? '')
      const decStatus: 'green' | 'amber' | 'red' =
        decStr.toUpperCase().includes('NO') ? 'red'
        : decStr.toUpperCase().includes('CONDITION') ? 'amber'
        : 'green'
      nextStates.decision = {
        status: decStatus,
        verdict: decStr,
        summary: report.predicted_failure_mode ?? '',
      }

      setAgentStates(nextStates)

      const lossCr = report.projected_financial_loss_cr ?? 0
      setRunResult({
        decision: decStr,
        score: report.overall_risk_score ?? 0,
        conditions: report.conditions ?? [],
        exposure_range: `₹${Number(lossCr).toFixed(1)} Cr`,
      })

      setFullReport({
        procurement_name: report.procurement_name ?? '',
        equipment_type: report.equipment_type ?? '',
        contract_value_cr: report.contract_value_cr ?? 0,
        overall_risk_score: report.overall_risk_score ?? 0,
        failure_probability_pct: report.failure_probability_pct ?? 0,
        confidence_pct: report.confidence_pct ?? 0,
        predicted_delay_months: report.predicted_delay_months ?? 0,
        projected_financial_loss_cr: lossCr,
        predicted_failure_mode: report.predicted_failure_mode ?? '',
        supporting_evidence: report.supporting_evidence ?? [],
        predicted_outcomes: report.predicted_outcomes ?? [],
        recommended_decision: decStr,
        conditions: report.conditions ?? [],
        debate: report.debate ?? [],
        scenarios: report.scenarios ?? [],
        generated_at: report.generated_at ?? new Date().toISOString(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setAgentStates(INITIAL_STATES)
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { agentStates, runResult, fullReport, isRunning, error, startAnalysis, reset }
}
