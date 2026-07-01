import { CSSProperties, Suspense, lazy, useCallback, useState } from 'react'
import { GraphCanvas } from './canvas'
import { IntakeView } from './intake'
import { useAnalysisStream } from './stream'
import type { AgentId, AgentState, NodeStatus, ResearchItem } from './types'
import type { FocusId } from './analysis'

// Lazy-load the analysis page (+ plotly.js) — only fetched when user opens the view
const AnalysisPage = lazy(() =>
  import('./analysis').then(m => ({ default: m.AnalysisPage }))
)

/* ── Sample shortcut (AIIMS MRI) ─────────────────────────────────────── */
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

/* ── Theme ──────────────────────────────────────────────────────────── */
const C = {
  bg: '#080808',
  surface: '#0d0d0d',
  border: '#1a1a1a',
  text: '#d8d8d8',
  muted: '#555',
  faint: '#2e2e2e',
  accent: '#ff2222',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
} as const

const FONT = "'JetBrains Mono', monospace"

const STATUS_DOT: Record<NodeStatus, string> = {
  idle: C.faint, running: '#e8e8e8',
  green: C.green, amber: C.amber, red: C.red,
}

const AGENT_DISPLAY: Record<AgentId, string> = {
  contract: 'Contract', infrastructure: 'Infrastructure',
  workforce: 'Workforce', historical: 'Historical',
  financial: 'Financial', decision: 'Decision Board',
}

/* ── Shared UI atoms ────────────────────────────────────────────────── */
function Lbl({ children, style }: { children: string; style?: CSSProperties }) {
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT, ...style,
    }}>
      {children}
    </span>
  )
}

function decisionColor(d: string) {
  if (d.toUpperCase().includes('NO')) return C.red
  if (d.toUpperCase().includes('CONDITION')) return C.amber
  return C.green
}

function Btn({
  onClick, disabled, children, variant = 'ghost', active = false,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'ghost' | 'accent' | 'tab'
  active?: boolean
}) {
  const isAccent = variant === 'accent'
  const isTab    = variant === 'tab'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: isAccent ? C.accent
        : isTab && active ? '#161616'
        : 'transparent',
      color: disabled ? '#5a2a2a'
        : isAccent ? '#080808'
        : isTab && active ? C.text
        : C.muted,
      border: `1px solid ${
        disabled ? '#3a1010'
        : isAccent ? C.accent
        : isTab && active ? C.border
        : 'transparent'
      }`,
      borderRadius: 2, padding: isTab ? '4px 12px' : '5px 14px', fontSize: 9,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontFamily: FONT, fontWeight: isAccent ? 700 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'color 0.15s, border-color 0.15s, background 0.15s',
    }}>
      {children}
    </button>
  )
}

/* ── Agent row in side panel ────────────────────────────────────────── */
function AgentRow({ id, state }: { id: AgentId; state: AgentState }) {
  const active = state.status !== 'idle'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: STATUS_DOT[state.status], transition: 'background 0.3s',
      }} />
      <span style={{ flex: 1, fontSize: 10, letterSpacing: '0.04em', color: active ? C.text : C.muted, transition: 'color 0.3s' }}>
        {AGENT_DISPLAY[id]}
      </span>
      {active && state.status !== 'running' && state.time_ms != null && (
        <span style={{ fontSize: 9, color: '#3a3a3a' }}>{(state.time_ms / 1000).toFixed(1)}s</span>
      )}
      {state.status === 'running' && (
        <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>···</span>
      )}
    </div>
  )
}

/* ── Root ───────────────────────────────────────────────────────────── */
type View = 'intake' | 'graph' | 'analysis'

export default function App() {
  const { agentStates, runResult, isRunning, error, startAnalysis, reset } = useAnalysisStream()
  const [view, setView]         = useState<View>('intake')
  const [confirmedInput, setConfirmedInput] = useState<Record<string, unknown> | null>(null)
  const [intakeResearch,  setIntakeResearch]  = useState<ResearchItem[]>([])
  const [intakeCategory,  setIntakeCategory]  = useState('')
  const [intakeMissingFields, setIntakeMissingFields] = useState<string[]>([])
  const [focusId, setFocusId]   = useState<FocusId>(null)

  const goToGraph = (
    fields: object,
    meta?: { category?: string; research?: ResearchItem[]; missingFields?: string[] },
  ) => {
    setConfirmedInput(fields as Record<string, unknown>)
    setIntakeResearch(meta?.research ?? [])
    setIntakeCategory(meta?.category ?? '')
    setIntakeMissingFields(meta?.missingFields ?? [])
    reset()
    startAnalysis(fields)
    setView('graph')
  }

  const goToIntake = () => { reset(); setView('intake') }

  const handleLoadSample = () => goToGraph(SAMPLE_INPUT)

  const handleNodeClick = useCallback((nodeId: string) => {
    const agentId = nodeId as AgentId
    const isAgent = agentId in agentStates
    const done = isAgent && !['idle', 'running'].includes(agentStates[agentId].status)
    if (done || nodeId === 'profiler' || nodeId === 'decision') {
      setFocusId(nodeId as FocusId)
      setView('analysis')
    }
  }, [agentStates])

  const anyFinished  = Object.values(agentStates).some(s => s.status !== 'idle')
  const inPostRun    = view !== 'intake'

  const ctxName  = confirmedInput?.procurement_name as string | undefined
  const ctxType  = confirmedInput?.equipment_type   as string | undefined
  const ctxValue = confirmedInput?.contract_value_cr as number | undefined

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: C.bg, fontFamily: FONT, color: C.text, overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 44, gap: 16,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {/* Brand + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.22em', color: C.accent, fontWeight: 700 }}>
            PREMORTEM
          </span>
          <span style={{ fontSize: 9, color: '#2e2e2e', letterSpacing: '0.1em' }}>
            / {view === 'intake' ? 'INTAKE' : (ctxName ?? 'ANALYSIS')}
          </span>
        </div>

        {/* Graph ↔ Analysis tabs (only in post-run views) */}
        {inPostRun && (
          <div style={{ display: 'flex', gap: 4, borderLeft: `1px solid ${C.border}`, paddingLeft: 14 }}>
            <Btn variant="tab" active={view === 'graph'} onClick={() => setView('graph')}>GRAPH</Btn>
            <Btn variant="tab" active={view === 'analysis'} onClick={() => setView('analysis')}>ANALYSIS</Btn>
          </div>
        )}

        {/* Right-side actions */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {inPostRun && (
            <Btn onClick={goToIntake}>NEW ANALYSIS</Btn>
          )}
          {view === 'graph' && anyFinished && !isRunning && confirmedInput && (
            <Btn onClick={() => { reset(); startAnalysis(confirmedInput) }}>RERUN</Btn>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      {view === 'intake' && (
        <IntakeView onConfirm={goToGraph} onLoadSample={handleLoadSample} />
      )}

      {view === 'graph' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Graph canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <GraphCanvas
              agentStates={agentStates}
              intakeResearch={intakeResearch}
              intakeCategory={intakeCategory}
              onNodeClick={handleNodeClick}
            />
            {isRunning && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                fontSize: 8, color: '#333', letterSpacing: '0.18em', pointerEvents: 'none',
              }}>
                AGENTS RUNNING
              </div>
            )}
            {/* Click hint */}
            {anyFinished && !isRunning && (
              <div style={{
                position: 'absolute', bottom: 16, right: 56,
                fontSize: 8, color: '#2a2a2a', letterSpacing: '0.1em', pointerEvents: 'none',
                fontFamily: FONT,
              }}>
                CLICK NODE FOR ANALYSIS
              </div>
            )}
          </div>

          {/* Side panel */}
          <aside style={{
            width: 260, borderLeft: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column',
            background: C.surface, overflow: 'hidden',
          }}>
            {/* Procurement context */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <Lbl style={{ display: 'block', marginBottom: 8 }}>PROCUREMENT</Lbl>
              <div style={{ fontSize: 11, color: '#c0c0c0', lineHeight: 1.5 }}>{ctxName ?? '—'}</div>
              {(ctxValue != null || ctxType) && (
                <div style={{ marginTop: 4, fontSize: 9, color: '#3e3e3e', lineHeight: 1.6 }}>
                  {ctxValue != null ? `₹${ctxValue} Cr` : ''}
                  {ctxValue != null && ctxType ? ' · ' : ''}
                  {ctxType ?? ''}
                </div>
              )}
            </div>

            {/* Agent list */}
            <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto', borderBottom: `1px solid ${C.border}` }}>
              <Lbl style={{ display: 'block', marginBottom: 12 }}>AGENTS</Lbl>
              {(Object.entries(agentStates) as [AgentId, AgentState][]).map(([id, state]) => (
                <AgentRow key={id} id={id} state={state} />
              ))}
            </div>

            {/* Decision */}
            <div style={{ padding: '14px 16px', flexShrink: 0, overflowY: 'auto' }}>
              <Lbl style={{ display: 'block', marginBottom: 12 }}>DECISION</Lbl>

              {!runResult && !error && (
                <div style={{ fontSize: 10, color: '#2e2e2e' }}>—</div>
              )}
              {error && (
                <div style={{
                  fontSize: 9, color: C.red, background: '#1a0808',
                  border: '1px solid #3a1010', borderRadius: 2, padding: '8px 10px', lineHeight: 1.5,
                }}>
                  ERROR: {error}
                </div>
              )}
              {runResult && (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                    color: decisionColor(runResult.decision), marginBottom: 14, lineHeight: 1.4,
                  }}>
                    {runResult.decision}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { l: 'RISK SCORE', v: `${Math.round(runResult.score)}/100`, big: true },
                      { l: 'EXPOSURE',   v: runResult.exposure_range,             big: false },
                    ].map(({ l, v, big }) => (
                      <div key={l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: '8px 10px' }}>
                        <Lbl>{l}</Lbl>
                        <div style={{ fontSize: big ? 16 : 12, fontWeight: big ? 700 : 600, color: C.text, marginTop: 4, letterSpacing: '-0.02em' }}>
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {runResult.conditions.length > 0 && (
                    <>
                      <Lbl style={{ display: 'block', marginBottom: 8 }}>CONDITIONS</Lbl>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {runResult.conditions.slice(0, 4).map((c, i) => (
                          <div key={i} style={{
                            fontSize: 9, color: '#888', paddingLeft: 8,
                            borderLeft: `1px solid ${C.faint}`, lineHeight: 1.55,
                          }}>
                            {c}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {/* Quick-link to analysis */}
                  <button
                    onClick={() => setView('analysis')}
                    style={{
                      marginTop: 14, background: 'none', border: `1px solid ${C.border}`,
                      borderRadius: 2, padding: '5px 0', width: '100%',
                      fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: C.muted, fontFamily: FONT, cursor: 'pointer',
                    }}
                  >
                    FULL ANALYSIS →
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {view === 'analysis' && (
        <Suspense fallback={
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#2a2a2a', letterSpacing: '0.18em', fontFamily: FONT,
          }}>
            LOADING
          </div>
        }>
          <AnalysisPage
            agentStates={agentStates}
            runResult={runResult}
            intakeResearch={intakeResearch}
            intakeCategory={intakeCategory}
            intakeMissingFields={intakeMissingFields}
            confirmedInput={confirmedInput}
            focusId={focusId}
            onClearFocus={() => setFocusId(null)}
            isRunning={isRunning}
          />
        </Suspense>
      )}
    </div>
  )
}
