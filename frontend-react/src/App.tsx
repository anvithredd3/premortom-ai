import { CSSProperties } from 'react'
import { GraphCanvas } from './canvas'
import { useAnalysisStream } from './stream'
import type { AgentId, AgentState, NodeStatus } from './types'

/* ── Sample procurement (AIIMS MRI default) ────────────────────────── */
const SAMPLE_INPUT = {
  procurement_name: 'AIIMS MRI Scanner',
  equipment_type: 'MRI Machine',
  contract_value_cr: 18.0,
  advance_payment_pct: 60.0,
  delivery_timeline_months: 4.0,
  warranty_start: 'On Delivery',
  installation_responsibility: 'Buyer',
  training_included: false,
  construction_completion_pct: 60.0,
  electrical_readiness: 'Pending',
  regulatory_approval_status: 'Pending',
  technicians_available: 0,
  technicians_required: 6,
  historical_delays_months: [8.0, 11.0, 7.0],
}

/* ── Colours ────────────────────────────────────────────────────────── */
const C = {
  bg: '#080808',
  surface: '#0d0d0d',
  border: '#1a1a1a',
  borderMid: '#222',
  text: '#d8d8d8',
  muted: '#555',
  faint: '#2e2e2e',
  accent: '#ff2222',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
} as const

const STATUS_DOT: Record<NodeStatus, string> = {
  idle:    C.faint,
  running: '#e8e8e8',
  green:   C.green,
  amber:   C.amber,
  red:     C.red,
}

const AGENT_DISPLAY: Record<AgentId, string> = {
  contract:       'Contract',
  infrastructure: 'Infrastructure',
  workforce:      'Workforce',
  historical:     'Historical',
  financial:      'Financial',
  decision:       'Decision Board',
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function label(text: string, style?: CSSProperties) {
  return (
    <span
      style={{
        fontSize: 8,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: C.muted,
        fontWeight: 600,
        ...style,
      }}
    >
      {text}
    </span>
  )
}

function decisionColor(decision: string) {
  if (decision.toUpperCase().includes('NO')) return C.red
  if (decision.toUpperCase().includes('CONDITION')) return C.amber
  return C.green
}

/* ── Side panel ─────────────────────────────────────────────────────── */
function AgentRow({ id, state }: { id: AgentId; state: AgentState }) {
  const dotColor = STATUS_DOT[state.status]
  const isActive = state.status !== 'idle'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          transition: 'background 0.3s',
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 10,
          color: isActive ? C.text : C.muted,
          letterSpacing: '0.04em',
          transition: 'color 0.3s',
        }}
      >
        {AGENT_DISPLAY[id]}
      </span>
      {isActive && state.status !== 'running' && state.time_ms !== undefined && (
        <span style={{ fontSize: 9, color: '#3a3a3a' }}>
          {(state.time_ms / 1000).toFixed(1)}s
        </span>
      )}
      {state.status === 'running' && (
        <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>···</span>
      )}
    </div>
  )
}

/* ── Root component ─────────────────────────────────────────────────── */
export default function App() {
  const { agentStates, runResult, isRunning, error, startAnalysis, reset } =
    useAnalysisStream()

  const handleRun = () => startAnalysis(SAMPLE_INPUT)
  const handleReset = () => reset()

  const anyFinished = Object.values(agentStates).some(s => s.status !== 'idle')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: C.bg,
        fontFamily: "'JetBrains Mono', monospace",
        color: C.text,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: 44,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: C.accent,
              fontWeight: 700,
            }}
          >
            PREMORTEM
          </span>
          <span style={{ fontSize: 9, color: '#2e2e2e', letterSpacing: '0.1em' }}>
            / PROCUREMENT RISK
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {anyFinished && !isRunning && (
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                color: C.muted,
                border: `1px solid ${C.border}`,
                borderRadius: 2,
                padding: '5px 12px',
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
              }}
            >
              RESET
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              background: isRunning ? '#1a0808' : C.accent,
              color: isRunning ? '#5a2a2a' : '#080808',
              border: `1px solid ${isRunning ? '#3a1010' : C.accent}`,
              borderRadius: 2,
              padding: '5px 16px',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isRunning ? 'RUNNING...' : 'RUN ANALYSIS'}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Graph canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <GraphCanvas agentStates={agentStates} />

          {/* Idle state overlay */}
          {!anyFinished && !isRunning && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: '#222',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  AWAITING INPUT
                </div>
                <div style={{ fontSize: 8, color: '#1e1e1e', letterSpacing: '0.1em' }}>
                  PRESS RUN ANALYSIS TO BEGIN
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <aside
          style={{
            width: 260,
            borderLeft: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            background: C.surface,
            overflow: 'hidden',
          }}
        >
          {/* Procurement context */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            {label('PROCUREMENT')}
            <div style={{ marginTop: 8, fontSize: 11, color: '#c0c0c0', lineHeight: 1.5 }}>
              {SAMPLE_INPUT.procurement_name}
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: '#3e3e3e', lineHeight: 1.6 }}>
              ₹{SAMPLE_INPUT.contract_value_cr} Cr · {SAMPLE_INPUT.equipment_type}
            </div>
          </div>

          {/* Agent list */}
          <div
            style={{
              padding: '14px 16px',
              flex: 1,
              overflowY: 'auto',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {label('AGENTS', { display: 'block', marginBottom: 12 })}
            {(Object.entries(agentStates) as [AgentId, AgentState][]).map(([id, state]) => (
              <AgentRow key={id} id={id} state={state} />
            ))}
          </div>

          {/* Decision result */}
          <div style={{ padding: '14px 16px', flexShrink: 0 }}>
            {label('DECISION', { display: 'block', marginBottom: 12 })}

            {!runResult && !error && (
              <div style={{ fontSize: 10, color: '#2e2e2e' }}>—</div>
            )}

            {error && (
              <div
                style={{
                  fontSize: 9,
                  color: C.red,
                  background: '#1a0808',
                  border: `1px solid #3a1010`,
                  borderRadius: 2,
                  padding: '8px 10px',
                  lineHeight: 1.5,
                }}
              >
                ERROR: {error}
              </div>
            )}

            {runResult && (
              <div>
                {/* Verdict */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: decisionColor(runResult.decision),
                    letterSpacing: '0.05em',
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {runResult.decision}
                </div>

                {/* Score + Exposure */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                      padding: '8px 10px',
                    }}
                  >
                    {label('RISK SCORE')}
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: C.text,
                        marginTop: 4,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {Math.round(runResult.score)}
                      <span style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>/100</span>
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                      padding: '8px 10px',
                    }}
                  >
                    {label('EXPOSURE')}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                        marginTop: 4,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {runResult.exposure_range}
                    </div>
                  </div>
                </div>

                {/* Conditions */}
                {runResult.conditions.length > 0 && (
                  <div>
                    {label('CONDITIONS', { display: 'block', marginBottom: 8 })}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {runResult.conditions.slice(0, 4).map((c, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 9,
                            color: '#888',
                            paddingLeft: 8,
                            borderLeft: `1px solid ${C.faint}`,
                            lineHeight: 1.55,
                          }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
