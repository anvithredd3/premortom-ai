import { Suspense, useEffect, useRef, useState } from 'react'
import { lazy } from 'react'
import type { AgentId, AgentState, NodeStatus, ResearchItem, RunResult } from './types'

// Plotly is lazily loaded — this file is itself lazy-loaded from App.tsx so
// both analysis.tsx and plotly.js land in a separate chunk (~4.8 MB gzip ~1.5 MB)
// and are only fetched when the user navigates to the ANALYSIS view.
const Plot = lazy(() => import('react-plotly.js'))

/* ── Theme ──────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"
const C = {
  bg: '#080808',
  surface: '#0d0d0d',
  surface2: '#0f0f0f',
  border: '#1a1a1a',
  border2: '#222',
  text: '#d8d8d8',
  muted: '#555',
  faint: '#2e2e2e',
  accent: '#ff2222',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
} as const

/* ── Constants ──────────────────────────────────────────────────────── */
const AGENT_IDS: AgentId[] = ['contract', 'infrastructure', 'workforce', 'historical', 'financial']

const AGENT_NAMES: Record<AgentId, string> = {
  contract: 'Contract Risk', infrastructure: 'Infrastructure',
  workforce: 'Workforce', historical: 'Historical',
  financial: 'Financial Risk', decision: 'Decision Board',
}

const FIELD_LABELS: Record<string, string> = {
  procurement_name: 'Procurement Name',
  equipment_type: 'Equipment Type',
  contract_value_cr: 'Contract Value (₹ Cr)',
  advance_payment_pct: 'Advance Payment %',
  delivery_timeline_months: 'Delivery Timeline (months)',
  warranty_start: 'Warranty Start',
  installation_responsibility: 'Installation By',
  training_included: 'Training Included',
  construction_completion_pct: 'Construction Completion %',
  electrical_readiness: 'Electrical Readiness',
  regulatory_approval_status: 'Regulatory Approval',
  technicians_available: 'Technicians Available',
  technicians_required: 'Technicians Required',
  historical_delays_months: 'Historical Delays (months)',
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function statusColor(s: NodeStatus | undefined): string {
  if (s === 'green') return C.green
  if (s === 'amber') return C.amber
  if (s === 'red') return C.red
  return '#3a3a3a'
}

function statusBarColor(s: NodeStatus | undefined): string {
  if (s === 'green') return 'rgba(34,197,94,0.7)'
  if (s === 'amber') return 'rgba(245,158,11,0.7)'
  if (s === 'red') return 'rgba(239,68,68,0.7)'
  return 'rgba(42,42,42,0.7)'
}

function shortModel(m?: string | null): string {
  if (!m) return '—'
  if (m.includes('haiku'))  return 'haiku'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('opus'))   return 'opus'
  if (m.includes('gpt-4o')) return 'gpt-4o'
  if (m.includes('gpt-4'))  return 'gpt-4'
  if (m.includes('gpt-3'))  return 'gpt-3.5'
  return (m.split('/').pop() ?? m).slice(0, 10)
}

function fmtTok(t?: { in: number | null; out: number | null }): string {
  if (!t) return '—'
  const n = (t.in ?? 0) + (t.out ?? 0)
  return n > 0 ? n.toLocaleString() : '—'
}

function riskScore(state: AgentState): number {
  if (state.risk_score != null) return state.risk_score
  if (state.status === 'red')   return 78
  if (state.status === 'amber') return 52
  if (state.status === 'green') return 22
  return 0
}

/* ── Dark Plotly base layout ─────────────────────────────────────────── */
const DARK_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: FONT, color: '#888', size: 9 },
  showlegend: false,
  margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
}

const DARK_AXIS = {
  showgrid: false,
  zeroline: false,
  showline: false,
  tickcolor: '#2a2a2a',
  tickfont: { family: FONT, color: '#444', size: 8 },
}

/* ── Shared primitives ───────────────────────────────────────────────── */
function Label({ children, color }: { children: string; color?: string }) {
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: color ?? C.muted, fontWeight: 600, fontFamily: FONT,
    }}>
      {children}
    </span>
  )
}

function SectionCard({ children, id, sectionRef }: {
  children: React.ReactNode
  id?: string
  sectionRef?: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      id={id}
      ref={sectionRef}
      style={{
        borderTop: `1px solid ${C.border}`, paddingTop: 24,
        marginBottom: 32, scrollMarginTop: 24,
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ label, badge, badgeColor }: {
  label: string; badge?: string; badgeColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <Label>{label}</Label>
      {badge && (
        <span style={{
          fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
          background: `${badgeColor ?? C.accent}18`, border: `1px solid ${badgeColor ?? C.accent}44`,
          color: badgeColor ?? C.accent, borderRadius: 2, padding: '2px 7px', fontFamily: FONT,
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Chip({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px',
    }}>
      <Label>{label}</Label>
      <div style={{
        fontSize: 13, fontWeight: 700, color: valueColor ?? C.text,
        marginTop: 5, letterSpacing: '-0.02em', fontFamily: FONT,
      }}>
        {value}
      </div>
    </div>
  )
}

function SourceLink({ item, isEvidence }: { item: ResearchItem; isEvidence?: boolean }) {
  return (
    <div style={{
      padding: '8px 10px', background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 2, marginBottom: 6,
    }}>
      {isEvidence || !item.url ? (
        <div style={{ fontSize: 9, color: '#666', fontFamily: FONT, lineHeight: 1.55 }}>
          {item.title}
        </div>
      ) : (
        <>
          <a href={item.url} target="_blank" rel="noreferrer" style={{
            fontSize: 9, color: '#4a7faa', textDecoration: 'none', display: 'block', marginBottom: 2,
            fontFamily: FONT,
          }}>
            ↗ {item.title || item.url}
          </a>
          {item.snippet && item.snippet !== item.title && (
            <div style={{ fontSize: 8, color: '#3a3a3a', lineHeight: 1.55, fontFamily: FONT }}>
              {item.snippet.slice(0, 140)}{item.snippet.length > 140 ? '…' : ''}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TelemetryRow({ state }: { state: AgentState }) {
  const toks = fmtTok(state.tokens)
  const secs = state.time_ms != null ? `${(state.time_ms / 1000).toFixed(1)}s` : '—'
  const model = shortModel(state.model)
  return (
    <div style={{
      display: 'flex', gap: 16, paddingTop: 10, borderTop: `1px solid ${C.border}`,
      fontSize: 8, color: '#3a3a3a', letterSpacing: '0.08em', fontFamily: FONT,
    }}>
      <span><Label>MODEL</Label>&nbsp;&nbsp;{model}</span>
      <span><Label>TOKENS</Label>&nbsp;&nbsp;{toks}</span>
      {state.tokens && (
        <span style={{ color: '#2a2a2a' }}>
          {(state.tokens.in ?? 0).toLocaleString()} in · {(state.tokens.out ?? 0).toLocaleString()} out
        </span>
      )}
      <span><Label>TIME</Label>&nbsp;&nbsp;{secs}</span>
    </div>
  )
}

/* ── Plotly Charts ───────────────────────────────────────────────────── */
function ChartsSection({ agentStates }: { agentStates: Record<AgentId, AgentState> }) {
  const hasData = AGENT_IDS.some(id => agentStates[id].status !== 'idle')
  if (!hasData) return null

  const ids = AGENT_IDS
  const labels = ids.map(id => AGENT_NAMES[id])
  const scores = ids.map(id => riskScore(agentStates[id]))
  const colors = ids.map(id => statusBarColor(agentStates[id].status))
  const tokens = ids.map(id => {
    const t = agentStates[id].tokens
    return t ? (t.in ?? 0) + (t.out ?? 0) : 0
  })
  const times = ids.map(id => {
    const ms = agentStates[id].time_ms
    return ms != null ? parseFloat((ms / 1000).toFixed(2)) : 0
  })

  const chartConfig = { displayModeBar: false, responsive: true }
  const chartStyle = { width: '100%' }

  return (
    <SectionCard>
      <SectionTitle label="RISK ANALYSIS" />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Risk score bar */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>RISK SCORE BY AGENT</Label>
          <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>
            {scores.every(s => s === 0) ? 'awaiting results' : '0 – 100'}
          </div>
          <Suspense fallback={<ChartSkeleton h={180} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar',
                orientation: 'h' as const,
                x: scores,
                y: labels,
                marker: { color: colors },
                text: scores.map(s => s > 0 ? `${s}` : ''),
                textposition: 'outside' as const,
                cliponaxis: false,
                hovertemplate: '%{y}: %{x}/100<extra></extra>',
              }]}
              layout={{
                ...DARK_LAYOUT,
                height: 185,
                margin: { l: 100, r: 40, t: 8, b: 24 },
                xaxis: { ...DARK_AXIS, range: [0, 110], tickvals: [0, 25, 50, 75, 100] },
                yaxis: { ...DARK_AXIS, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>

        {/* Radar */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>RISK PROFILE RADAR</Label>
          <div style={{ height: 8, marginBottom: 8 }} />
          <Suspense fallback={<ChartSkeleton h={180} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'scatterpolar' as const,
                r: [...scores, scores[0]],
                theta: [...labels.map(l => l.split(' ')[0]), labels[0].split(' ')[0]],
                fill: 'toself' as const,
                fillcolor: 'rgba(255,34,34,0.07)',
                line: { color: '#ff2222', width: 1 },
                hovertemplate: '%{theta}: %{r}/100<extra></extra>',
              }]}
              layout={{
                ...DARK_LAYOUT,
                height: 185,
                margin: { l: 16, r: 16, t: 20, b: 20 },
                polar: {
                  bgcolor: 'rgba(0,0,0,0)',
                  radialaxis: {
                    visible: true, range: [0, 100],
                    color: '#1e1e1e', gridcolor: '#181818',
                    tickfont: { family: FONT, color: '#333', size: 7 },
                    tickvals: [25, 50, 75, 100],
                  },
                  angularaxis: {
                    color: '#444',
                    tickfont: { family: FONT, color: '#555', size: 8 },
                  },
                },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>
      </div>

      {/* Observability row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Tokens */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>TOKENS BY AGENT</Label>
          <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>
            in + out
          </div>
          <Suspense fallback={<ChartSkeleton h={150} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar',
                orientation: 'h' as const,
                x: tokens,
                y: labels,
                marker: { color: 'rgba(255,34,34,0.35)' },
                text: tokens.map(t => t > 0 ? t.toLocaleString() : ''),
                textposition: 'outside' as const,
                cliponaxis: false,
                hovertemplate: '%{y}: %{x} tok<extra></extra>',
              }]}
              layout={{
                ...DARK_LAYOUT,
                height: 155,
                margin: { l: 100, r: 60, t: 8, b: 24 },
                xaxis: { ...DARK_AXIS },
                yaxis: { ...DARK_AXIS, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>

        {/* Latency */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>LATENCY BY AGENT</Label>
          <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>
            seconds
          </div>
          <Suspense fallback={<ChartSkeleton h={150} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar',
                orientation: 'h' as const,
                x: times,
                y: labels,
                marker: { color: 'rgba(100,130,170,0.35)' },
                text: times.map(t => t > 0 ? `${t}s` : ''),
                textposition: 'outside' as const,
                cliponaxis: false,
                hovertemplate: '%{y}: %{x}s<extra></extra>',
              }]}
              layout={{
                ...DARK_LAYOUT,
                height: 155,
                margin: { l: 100, r: 50, t: 8, b: 24 },
                xaxis: { ...DARK_AXIS },
                yaxis: { ...DARK_AXIS, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>
      </div>
    </SectionCard>
  )
}

function ChartSkeleton({ h }: { h: number }) {
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, color: '#222', letterSpacing: '0.14em', fontFamily: FONT,
    }}>
      LOADING
    </div>
  )
}

/* ── PROFILER section ────────────────────────────────────────────────── */
function ProfilerSection({ category, research, missingFields, confirmedInput }: {
  category: string
  research: ResearchItem[]
  missingFields: string[]
  confirmedInput: Record<string, unknown> | null
}) {
  const allKeys = Object.keys(FIELD_LABELS)
  const inferred = allKeys.filter(k => !missingFields.includes(k))
  const userProvided = allKeys.filter(k => missingFields.includes(k))

  return (
    <SectionCard>
      <SectionTitle label="PROFILER" badge={category || undefined} badgeColor={C.green} />

      {/* Category + field breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px' }}>
          <Label>INFERRED FROM RESEARCH</Label>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginTop: 5, fontFamily: FONT }}>
            {inferred.length}
            <span style={{ fontSize: 9, color: '#3a3a3a', fontWeight: 400, marginLeft: 6 }}>fields</span>
          </div>
          {inferred.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {inferred.slice(0, 8).map(k => (
                <span key={k} style={{
                  fontSize: 7, letterSpacing: '0.08em', color: '#3a3a3a',
                  background: '#0f140f', border: '1px solid #1a2a1a',
                  borderRadius: 2, padding: '1px 5px', fontFamily: FONT,
                }}>
                  {FIELD_LABELS[k] ?? k}
                </span>
              ))}
              {inferred.length > 8 && (
                <span style={{ fontSize: 7, color: '#2a2a2a', fontFamily: FONT, padding: '1px 4px' }}>
                  +{inferred.length - 8}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px' }}>
          <Label>PROVIDED BY USER</Label>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginTop: 5, fontFamily: FONT }}>
            {userProvided.length}
            <span style={{ fontSize: 9, color: '#3a3a3a', fontWeight: 400, marginLeft: 6 }}>fields</span>
          </div>
          {userProvided.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {userProvided.map(k => (
                <span key={k} style={{
                  fontSize: 7, letterSpacing: '0.08em', color: '#5a4a2a',
                  background: '#14100a', border: '1px solid #2a1e08',
                  borderRadius: 2, padding: '1px 5px', fontFamily: FONT,
                }}>
                  {FIELD_LABELS[k] ?? k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmed field values */}
      {confirmedInput && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{
            cursor: 'pointer', fontSize: 8, letterSpacing: '0.14em', color: C.muted,
            textTransform: 'uppercase', fontFamily: FONT, fontWeight: 600, userSelect: 'none',
            listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            <span>INPUT VALUES</span>
            <span style={{ color: '#2e2e2e' }}>▾</span>
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {Object.entries(FIELD_LABELS).map(([k, label]) => {
              const val = confirmedInput[k]
              if (val == null) return null
              const isMissing = missingFields.includes(k)
              return (
                <div key={k} style={{
                  background: C.surface2, border: `1px solid ${isMissing ? '#2a1e08' : C.border}`,
                  borderRadius: 2, padding: '6px 8px',
                }}>
                  <div style={{ fontSize: 7, letterSpacing: '0.1em', textTransform: 'uppercase', color: isMissing ? '#4a3a1a' : '#2e2e2e', marginBottom: 3, fontFamily: FONT }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 9, color: isMissing ? C.amber : '#888', fontFamily: FONT }}>
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {/* Web sources */}
      {research.length > 0 && (
        <>
          <Label>WEB SOURCES CONSULTED</Label>
          <div style={{ marginTop: 10 }}>
            {research.map((r, i) => <SourceLink key={i} item={r} />)}
          </div>
        </>
      )}
      {research.length === 0 && (
        <div style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT }}>no web research (sample data or offline)</div>
      )}
    </SectionCard>
  )
}

/* ── Per-agent section (collapsible) ─────────────────────────────────── */
function AgentSection({ id, state, sectionRef }: {
  id: AgentId
  state: AgentState
  sectionRef: (el: HTMLDivElement | null) => void
}) {
  const [open, setOpen] = useState(true)
  const isDone = state.status === 'green' || state.status === 'amber' || state.status === 'red'
  const isRunning = state.status === 'running'
  const vCol = statusColor(state.status)
  const score = riskScore(state)
  const evidence = state.research ?? []

  return (
    <SectionCard sectionRef={sectionRef}>
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 16 : 0,
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isDone ? vCol : '#2a2a2a', flexShrink: 0 }} />
        <span style={{
          fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: isDone ? C.muted : '#2a2a2a', fontWeight: 600, fontFamily: FONT,
        }}>
          {AGENT_NAMES[id]}
        </span>
        {isDone && score > 0 && (
          <span style={{
            fontSize: 8, letterSpacing: '0.1em', color: vCol, fontFamily: FONT,
            background: `${vCol}14`, border: `1px solid ${vCol}44`,
            borderRadius: 2, padding: '1px 6px',
          }}>
            {score}/100
          </span>
        )}
        {isRunning && (
          <span style={{ fontSize: 8, color: '#555', letterSpacing: '0.14em', fontFamily: FONT }}>RUNNING···</span>
        )}
        {isDone && (
          <span style={{ fontSize: 9, color: '#2a2a2a', marginLeft: 'auto', fontFamily: FONT }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {!open && !isDone && !isRunning && (
        <div style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT, paddingLeft: 13 }}>—</div>
      )}

      {open && isDone && (
        <div style={{ paddingLeft: 13 }}>
          {/* Verdict */}
          {state.verdict && (
            <div style={{
              fontSize: 11, color: vCol, fontWeight: 600, lineHeight: 1.5,
              marginBottom: 14, fontFamily: FONT,
            }}>
              {state.verdict}
            </div>
          )}

          {/* Summary / reasoning */}
          {state.summary && (
            <div style={{ marginBottom: 16 }}>
              <Label>REASONING</Label>
              <div style={{
                marginTop: 8, fontSize: 10, color: '#888', lineHeight: 1.7,
                fontFamily: FONT,
              }}>
                {state.summary}
              </div>
            </div>
          )}

          {/* Evidence (text strings from backend, not URLs) */}
          {evidence.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Label>EVIDENCE</Label>
              <div style={{ marginTop: 8 }}>
                {evidence.map((e, i) => <SourceLink key={i} item={e} isEvidence />)}
              </div>
            </div>
          )}

          {/* Telemetry */}
          <TelemetryRow state={state} />
        </div>
      )}
    </SectionCard>
  )
}

/* ── DECISION section ────────────────────────────────────────────────── */
function DecisionSection({
  runResult, decisionState, sectionRef,
}: {
  runResult: RunResult | null
  decisionState: AgentState
  sectionRef: (el: HTMLDivElement | null) => void
}) {
  if (!runResult && decisionState.status === 'idle') return null

  const isRunning = decisionState.status === 'running'
  const decision = runResult?.decision ?? decisionState.verdict ?? ''
  const dCol = decision.toUpperCase().includes('NO') ? C.red
    : decision.toUpperCase().includes('CONDITION') ? C.amber : C.green

  return (
    <SectionCard sectionRef={sectionRef}>
      <SectionTitle label="DECISION" />

      {isRunning && (
        <div style={{ fontSize: 10, color: '#555', fontFamily: FONT, letterSpacing: '0.1em' }}>
          ANALYZING···
        </div>
      )}

      {runResult && (
        <>
          <div style={{
            fontSize: 14, fontWeight: 700, color: dCol, lineHeight: 1.5,
            marginBottom: 20, fontFamily: FONT, letterSpacing: '0.02em',
          }}>
            {decision}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <Chip label="RISK SCORE" value={`${Math.round(runResult.score)}/100`} valueColor={C.text} />
            <Chip label="EXPOSURE" value={runResult.exposure_range} />
            <Chip label="CONDITIONS" value={`${runResult.conditions.length}`} />
          </div>

          {decisionState.summary && (
            <div style={{ marginBottom: 16 }}>
              <Label>PREDICTED FAILURE MODE</Label>
              <div style={{ marginTop: 8, fontSize: 10, color: '#888', lineHeight: 1.7, fontFamily: FONT }}>
                {decisionState.summary}
              </div>
            </div>
          )}

          {runResult.conditions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Label>CONDITIONS</Label>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runResult.conditions.map((c, i) => (
                  <div key={i} style={{
                    fontSize: 9, color: '#888', lineHeight: 1.65,
                    paddingLeft: 10, borderLeft: `1px solid ${C.faint}`, fontFamily: FONT,
                  }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}

          {decisionState.status !== 'idle' && <TelemetryRow state={decisionState} />}
        </>
      )}
    </SectionCard>
  )
}

/* ── Main export ─────────────────────────────────────────────────────── */
export type FocusId = AgentId | 'decision' | 'profiler' | null

export interface AnalysisPageProps {
  agentStates: Record<AgentId, AgentState>
  runResult: RunResult | null
  intakeResearch: ResearchItem[]
  intakeCategory: string
  intakeMissingFields: string[]
  confirmedInput: Record<string, unknown> | null
  focusId: FocusId
  onClearFocus: () => void
  isRunning: boolean
}

export function AnalysisPage({
  agentStates, runResult, intakeResearch, intakeCategory,
  intakeMissingFields, confirmedInput, focusId, onClearFocus,
}: AnalysisPageProps) {
  const sectionRefs = useRef<Partial<Record<string, HTMLDivElement>>>({})

  const setRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) sectionRefs.current[key] = el
  }

  useEffect(() => {
    if (!focusId) return
    const el = sectionRefs.current[focusId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onClearFocus()
  }, [focusId, onClearFocus])

  const hasAnyData = Object.values(agentStates).some(s => s.status !== 'idle')
  const procName = confirmedInput?.procurement_name as string | undefined

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em', fontFamily: FONT, marginBottom: 4 }}>
            {procName ?? 'ANALYSIS'}
          </div>
          {!hasAnyData && (
            <div style={{ fontSize: 10, color: '#333', fontFamily: FONT }}>
              Run an analysis to see results here.
            </div>
          )}
        </div>

        {/* Decision (first — most important) */}
        <DecisionSection
          runResult={runResult}
          decisionState={agentStates.decision}
          sectionRef={setRef('decision')}
        />

        {/* Charts */}
        <ChartsSection agentStates={agentStates} />

        {/* Profiler */}
        <div ref={el => { if (el) sectionRefs.current['profiler'] = el }}>
          <ProfilerSection
            category={intakeCategory}
            research={intakeResearch}
            missingFields={intakeMissingFields}
            confirmedInput={confirmedInput}
          />
        </div>

        {/* Per-agent sections */}
        {AGENT_IDS.map(id => (
          <AgentSection
            key={id}
            id={id}
            state={agentStates[id]}
            sectionRef={setRef(id)}
          />
        ))}
      </div>
    </div>
  )
}
