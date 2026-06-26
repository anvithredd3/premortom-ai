import { useState, useCallback } from 'react'
import type { AgentId, AgentState, RunResult, SSEEvent } from './types'

const INITIAL_STATES: Record<AgentId, AgentState> = {
  contract: { status: 'idle' },
  infrastructure: { status: 'idle' },
  workforce: { status: 'idle' },
  historical: { status: 'idle' },
  financial: { status: 'idle' },
  decision: { status: 'idle' },
}

export function useAnalysisStream() {
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(INITIAL_STATES)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setAgentStates(INITIAL_STATES)
    setRunResult(null)
    setError(null)
  }, [])

  const startAnalysis = useCallback(async (input: object) => {
    setIsRunning(true)
    setError(null)
    setRunResult(null)
    setAgentStates(INITIAL_STATES)

    try {
      const response = await fetch('/api/analyze_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE lines end with \n; messages separated by \n\n
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event: SSEEvent
          try {
            event = JSON.parse(raw) as SSEEvent
          } catch {
            continue
          }

          if (event.type === 'agent_started') {
            const id = event.id
            setAgentStates(prev => ({
              ...prev,
              [id]: { ...prev[id], status: 'running' },
            }))
          } else if (event.type === 'agent_finished') {
            const { id, status, verdict, summary, tokens, time_ms, model, research } = event
            setAgentStates(prev => ({
              ...prev,
              [id]: { status, verdict, summary, tokens, time_ms, model, research },
            }))
          } else if (event.type === 'run_finished') {
            setRunResult({
              decision: event.decision,
              score: event.score,
              conditions: event.conditions,
              exposure_range: event.exposure_range,
            })
          } else if (event.type === 'error') {
            setError(event.message)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { agentStates, runResult, isRunning, error, startAnalysis, reset }
}
