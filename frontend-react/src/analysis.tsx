import { Suspense, useEffect, useRef, useState } from 'react'
import { lazy } from 'react'
import type {
  AgentId, AgentState, DebateTurn, FullReport, NodeStatus, ResearchItem,
  RunResult, ScenarioOutcome,
} from './types'
import { GraphCanvas } from './canvas'
import { useTheme } from './theme'
import type { Theme } from './theme'

const Plot = lazy(() => import('react-plotly.js'))

/* ── Theme ──────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"

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
  contract_value_cr: 'Contract Value',
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
function statusColor(s: NodeStatus | undefined, C: Theme): string {
  if (s === 'green') return C.green
  if (s === 'amber') return C.amber
  if (s === 'red') return C.red
  return C.textDim
}

function statusBarColor(s: NodeStatus | undefined): string {
  if (s === 'green') return 'rgba(34,197,94,0.7)'
  if (s === 'amber') return 'rgba(245,158,11,0.7)'
  if (s === 'red') return 'rgba(239,68,68,0.7)'
  return 'rgba(42,42,42,0.7)'
}

function statusLabel(s: NodeStatus | undefined, score?: number): string {
  if (s === 'red')   return score != null && score >= 85 ? 'CRITICAL' : 'HIGH'
  if (s === 'amber') return 'MODERATE'
  if (s === 'green') return 'LOW'
  if (s === 'running') return 'RUNNING'
  return 'IDLE'
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

function decisionColor(d: string, C: Theme): string {
  if (d.toUpperCase().includes('NO')) return C.red
  if (d.toUpperCase().includes('CONDITION')) return C.amber
  return C.green
}

/* ── Plotly base layout (theme-adaptive, built inside ChartsSection) ──── */
const DARK_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  showlegend: false,
  margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
}

function chartAxis(C: { muted: string; border: string; textDim: string }) {
  return {
    showgrid: false, zeroline: false, showline: false,
    tickcolor: C.muted,
    tickfont: { family: FONT, color: C.textDim, size: 8 },
  }
}

/* ── Shared primitives ───────────────────────────────────────────────── */
function Label({ children, color }: { children: string; color?: string }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
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
  const { theme: C } = useTheme()
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
  const { theme: C } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <Label>{label}</Label>
      {badge && (
        <span style={{
          fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
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
  const { theme: C } = useTheme()
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px',
    }}>
      <Label>{label}</Label>
      <div style={{
        fontSize: 18, fontWeight: 700, color: valueColor ?? C.text,
        marginTop: 5, letterSpacing: '-0.02em', fontFamily: FONT,
      }}>
        {value}
      </div>
    </div>
  )
}

function SourceLink({ item, isEvidence }: { item: ResearchItem; isEvidence?: boolean }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      padding: '8px 10px', background: C.surface2, border: `1px solid ${C.border}`,
      borderRadius: 2, marginBottom: 6,
    }}>
      {isEvidence || !item.url ? (
        <div style={{ fontSize: 13, color: C.textDim, fontFamily: FONT, lineHeight: 1.55 }}>
          {item.title}
        </div>
      ) : (
        <>
          <a href={item.url} target="_blank" rel="noreferrer" style={{
            fontSize: 13, color: '#4a7faa', textDecoration: 'none', display: 'block', marginBottom: 2,
            fontFamily: FONT,
          }}>
            ↗ {item.title || item.url}
          </a>
          {item.snippet && item.snippet !== item.title && (
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.55, fontFamily: FONT }}>
              {item.snippet.slice(0, 140)}{item.snippet.length > 140 ? '…' : ''}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TelemetryRow({ state }: { state: AgentState }) {
  const { theme: C } = useTheme()
  const toks = fmtTok(state.tokens)
  const secs = state.time_ms != null ? `${(state.time_ms / 1000).toFixed(1)}s` : '—'
  const model = shortModel(state.model)
  return (
    <div style={{
      display: 'flex', gap: 16, paddingTop: 10, borderTop: `1px solid ${C.border}`,
      fontSize: 11, color: C.textDim, letterSpacing: '0.08em', fontFamily: FONT,
    }}>
      <span><Label>MODEL</Label>&nbsp;&nbsp;{model}</span>
      <span><Label>TOKENS</Label>&nbsp;&nbsp;{toks}</span>
      {state.tokens && (
        <span style={{ color: C.muted }}>
          {(state.tokens.in ?? 0).toLocaleString()} in · {(state.tokens.out ?? 0).toLocaleString()} out
        </span>
      )}
      <span><Label>TIME</Label>&nbsp;&nbsp;{secs}</span>
    </div>
  )
}

function ChartSkeleton({ h }: { h: number }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: C.muted, letterSpacing: '0.14em', fontFamily: FONT,
    }}>
      LOADING
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, padding: 40,
    }}>
      <div style={{ width: 40, height: 1, background: C.border }} />
      <div style={{ fontSize: 13, color: C.muted, letterSpacing: '0.18em', fontFamily: FONT }}>
        {message}
      </div>
      <div style={{ width: 40, height: 1, background: C.border }} />
    </div>
  )
}

/* ── Charts (shared between ExecutiveDashboard and AnalysisPage) ────── */
function ChartsSection({ agentStates }: { agentStates: Record<AgentId, AgentState> }) {
  const { theme: C } = useTheme()
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
  const CL = { ...DARK_LAYOUT, font: { family: FONT, color: C.muted, size: 9 } }
  const CA = chartAxis(C)

  return (
    <SectionCard>
      <SectionTitle label="RISK ANALYSIS" />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>RISK SCORE BY AGENT</Label>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>
            {scores.every(s => s === 0) ? 'awaiting results' : '0 – 100'}
          </div>
          <Suspense fallback={<ChartSkeleton h={180} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar', orientation: 'h' as const,
                x: scores, y: labels, marker: { color: colors },
                text: scores.map(s => s > 0 ? `${s}` : ''),
                textposition: 'outside' as const, cliponaxis: false,
                hovertemplate: '%{y}: %{x}/100<extra></extra>',
              }]}
              layout={{
                ...CL, height: 185,
                margin: { l: 100, r: 40, t: 8, b: 24 },
                xaxis: { ...CA, range: [0, 110], tickvals: [0, 25, 50, 75, 100] },
                yaxis: { ...CA, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>

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
                ...CL, height: 185,
                margin: { l: 16, r: 16, t: 20, b: 20 },
                polar: {
                  bgcolor: 'rgba(0,0,0,0)',
                  radialaxis: {
                    visible: true, range: [0, 100],
                    color: C.border, gridcolor: C.border,
                    tickfont: { family: FONT, color: C.textDim, size: 7 },
                    tickvals: [25, 50, 75, 100],
                  },
                  angularaxis: { color: C.border, tickfont: { family: FONT, color: C.textDim, size: 8 } },
                },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>TOKENS BY AGENT</Label>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>in + out</div>
          <Suspense fallback={<ChartSkeleton h={150} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar', orientation: 'h' as const,
                x: tokens, y: labels, marker: { color: 'rgba(255,34,34,0.35)' },
                text: tokens.map(t => t > 0 ? t.toLocaleString() : ''),
                textposition: 'outside' as const, cliponaxis: false,
                hovertemplate: '%{y}: %{x} tok<extra></extra>',
              }]}
              layout={{
                ...CL, height: 155,
                margin: { l: 100, r: 60, t: 8, b: 24 },
                xaxis: { ...CA },
                yaxis: { ...CA, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '14px 16px' }}>
          <Label>LATENCY BY AGENT</Label>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginBottom: 8, letterSpacing: '0.06em' }}>seconds</div>
          <Suspense fallback={<ChartSkeleton h={150} />}>
            <Plot
              style={chartStyle}
              data={[{
                type: 'bar', orientation: 'h' as const,
                x: times, y: labels, marker: { color: 'rgba(100,130,170,0.35)' },
                text: times.map(t => t > 0 ? `${t}s` : ''),
                textposition: 'outside' as const, cliponaxis: false,
                hovertemplate: '%{y}: %{x}s<extra></extra>',
              }]}
              layout={{
                ...CL, height: 155,
                margin: { l: 100, r: 50, t: 8, b: 24 },
                xaxis: { ...CA },
                yaxis: { ...CA, autorange: 'reversed' as const },
              }}
              config={chartConfig}
            />
          </Suspense>
        </div>
      </div>
    </SectionCard>
  )
}

/* ── Profiler section (used in AnalysisPage full view) ──────────────── */
function ProfilerSection({ category, research, missingFields, confirmedInput }: {
  category: string
  research: ResearchItem[]
  missingFields: string[]
  confirmedInput: Record<string, unknown> | null
}) {
  const { theme: C } = useTheme()
  const allKeys = Object.keys(FIELD_LABELS)
  const inferred = allKeys.filter(k => !missingFields.includes(k))
  const userProvided = allKeys.filter(k => missingFields.includes(k))

  return (
    <SectionCard>
      <SectionTitle label="PROFILER" badge={category || undefined} badgeColor={C.green} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px' }}>
          <Label>INFERRED FROM RESEARCH</Label>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginTop: 5, fontFamily: FONT }}>
            {inferred.length}<span style={{ fontSize: 13, color: C.textDim, fontWeight: 400, marginLeft: 6 }}>fields</span>
          </div>
          {inferred.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {inferred.slice(0, 8).map(k => (
                <span key={k} style={{
                  fontSize: 10, letterSpacing: '0.08em', color: C.textDim,
                  background: C.green + '10', border: `1px solid ${C.green}33`,
                  borderRadius: 2, padding: '1px 5px', fontFamily: FONT,
                }}>
                  {FIELD_LABELS[k] ?? k}
                </span>
              ))}
              {inferred.length > 8 && (
                <span style={{ fontSize: 10, color: C.muted, fontFamily: FONT, padding: '1px 4px' }}>
                  +{inferred.length - 8}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px' }}>
          <Label>PROVIDED BY USER</Label>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.amber, marginTop: 5, fontFamily: FONT }}>
            {userProvided.length}<span style={{ fontSize: 13, color: C.textDim, fontWeight: 400, marginLeft: 6 }}>fields</span>
          </div>
          {userProvided.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {userProvided.map(k => (
                <span key={k} style={{
                  fontSize: 10, letterSpacing: '0.08em', color: C.amber,
                  background: C.amber + '10', border: `1px solid ${C.amber}33`,
                  borderRadius: 2, padding: '1px 5px', fontFamily: FONT,
                }}>
                  {FIELD_LABELS[k] ?? k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmedInput && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{
            cursor: 'pointer', fontSize: 11, letterSpacing: '0.14em', color: C.muted,
            textTransform: 'uppercase', fontFamily: FONT, fontWeight: 600, userSelect: 'none',
            listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          }}>
            <span>INPUT VALUES</span>
            <span style={{ color: C.muted }}>▾</span>
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {Object.entries(FIELD_LABELS).map(([k, label]) => {
              const val = confirmedInput[k]
              if (val == null) return null
              const isMissing = missingFields.includes(k)
              return (
                <div key={k} style={{
                  background: C.surface2, border: `1px solid ${isMissing ? C.amber + '44' : C.border}`,
                  borderRadius: 2, padding: '6px 8px',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: isMissing ? C.amber : C.muted, marginBottom: 3, fontFamily: FONT }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, color: isMissing ? C.amber : C.textDim, fontFamily: FONT }}>
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {research.length > 0 && (
        <>
          <Label>WEB SOURCES CONSULTED</Label>
          <div style={{ marginTop: 10 }}>
            {research.map((r, i) => <SourceLink key={i} item={r} />)}
          </div>
        </>
      )}
      {research.length === 0 && (
        <div style={{ fontSize: 13, color: C.muted, fontFamily: FONT }}>no web research (sample data or offline)</div>
      )}
    </SectionCard>
  )
}

/* ── Per-agent section (collapsible, used in full AnalysisPage) ─────── */
function AgentSection({ id, state, sectionRef }: {
  id: AgentId; state: AgentState; sectionRef: (el: HTMLDivElement | null) => void
}) {
  const { theme: C } = useTheme()
  const [open, setOpen] = useState(true)
  const isDone = state.status === 'green' || state.status === 'amber' || state.status === 'red'
  const isRunning = state.status === 'running'
  const vCol = statusColor(state.status, C)
  const score = riskScore(state)
  const evidence = state.research ?? []

  return (
    <SectionCard sectionRef={sectionRef}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 16 : 0,
        }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isDone ? vCol : C.muted, flexShrink: 0 }} />
        <span style={{
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: isDone ? C.muted : C.muted, fontWeight: 600, fontFamily: FONT,
        }}>
          {AGENT_NAMES[id]}
        </span>
        {isDone && score > 0 && (
          <span style={{
            fontSize: 11, letterSpacing: '0.1em', color: vCol, fontFamily: FONT,
            background: `${vCol}14`, border: `1px solid ${vCol}44`,
            borderRadius: 2, padding: '1px 6px',
          }}>
            {score}/100
          </span>
        )}
        {isRunning && (
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: '0.14em', fontFamily: FONT }}>RUNNING···</span>
        )}
        {isDone && (
          <span style={{ fontSize: 13, color: C.muted, marginLeft: 'auto', fontFamily: FONT }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {open && isDone && (
        <div style={{ paddingLeft: 13 }}>
          {state.verdict && (
            <div style={{
              fontSize: 15, color: vCol, fontWeight: 600, lineHeight: 1.5,
              marginBottom: 14, fontFamily: FONT,
            }}>
              {state.verdict}
            </div>
          )}
          {state.summary && (
            <div style={{ marginBottom: 16 }}>
              <Label>REASONING</Label>
              <div style={{ marginTop: 8, fontSize: 14, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
                {state.summary}
              </div>
            </div>
          )}
          {evidence.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Label>EVIDENCE</Label>
              <div style={{ marginTop: 8 }}>
                {evidence.map((e, i) => <SourceLink key={i} item={e} isEvidence />)}
              </div>
            </div>
          )}
          <TelemetryRow state={state} />
        </div>
      )}
    </SectionCard>
  )
}

/* ── Decision section ────────────────────────────────────────────────── */
function DecisionSection({
  runResult, decisionState, sectionRef,
}: {
  runResult: RunResult | null
  decisionState: AgentState
  sectionRef: (el: HTMLDivElement | null) => void
}) {
  const { theme: C } = useTheme()
  if (!runResult && decisionState.status === 'idle') return null

  const isRunning = decisionState.status === 'running'
  const decision = runResult?.decision ?? decisionState.verdict ?? ''
  const dCol = decisionColor(decision, C)

  return (
    <SectionCard sectionRef={sectionRef}>
      <SectionTitle label="DECISION" />
      {isRunning && (
        <div style={{ fontSize: 14, color: C.textDim, fontFamily: FONT, letterSpacing: '0.1em' }}>ANALYZING···</div>
      )}
      {runResult && (
        <>
          <div style={{
            fontSize: 19, fontWeight: 700, color: dCol, lineHeight: 1.5,
            marginBottom: 20, fontFamily: FONT, letterSpacing: '0.02em',
          }}>
            {decision}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <Chip label="RISK SCORE" value={`${Math.round(runResult.score)}/100`} />
            <Chip label="EXPOSURE" value={runResult.exposure_range} />
            <Chip label="CONDITIONS" value={`${runResult.conditions.length}`} />
          </div>
          {decisionState.summary && (
            <div style={{ marginBottom: 16 }}>
              <Label>PREDICTED FAILURE MODE</Label>
              <div style={{ marginTop: 8, fontSize: 14, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
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
                    fontSize: 13, color: C.textDim, lineHeight: 1.65,
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

/* ════════════════════════════════════════════════════════════════════════
   SCREEN 2 — INVESTIGATION BOARD
   Agent cards in a 2-column grid with expandable details
   ════════════════════════════════════════════════════════════════════════ */
function AgentCard({ id, state }: { id: AgentId; state: AgentState }) {
  const { theme: C } = useTheme()
  const [open, setOpen] = useState(false)
  const isDone = state.status === 'green' || state.status === 'amber' || state.status === 'red'
  const isRunning = state.status === 'running'
  const col = statusColor(state.status, C)
  const score = riskScore(state)
  const label = statusLabel(state.status, score)
  const evidence = state.research ?? []

  return (
    <div style={{
      background: C.surface, border: `1px solid ${isDone ? `${col}33` : C.border}`,
      borderRadius: 2, padding: '16px 18px',
      transition: 'border-color 0.3s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isDone ? col : isRunning ? C.textDim : C.faint,
        }} />
        <span style={{
          fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: isDone ? C.text : C.muted, fontWeight: 700, fontFamily: FONT, flex: 1,
        }}>
          {AGENT_NAMES[id]}
        </span>
        <span style={{
          fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
          background: isDone ? `${col}18` : C.surface2,
          border: `1px solid ${isDone ? `${col}44` : C.border}`,
          color: isDone ? col : C.muted,
          borderRadius: 2, padding: '2px 7px', fontFamily: FONT,
        }}>
          {isRunning ? 'RUNNING' : label}
        </span>
      </div>

      {/* Risk score */}
      {isDone && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 44, fontWeight: 700, color: col, fontFamily: FONT, lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: 14, color: C.muted, fontFamily: FONT }}>/100</span>
        </div>
      )}

      {isRunning && (
        <div style={{ fontSize: 13, color: C.textDim, letterSpacing: '0.14em', marginBottom: 10, fontFamily: FONT }}>
          ANALYZING···
        </div>
      )}

      {!isDone && !isRunning && (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontFamily: FONT }}>—</div>
      )}

      {/* Verdict */}
      {state.verdict && (
        <div style={{
          fontSize: 13, color: col, lineHeight: 1.5, marginBottom: 10,
          fontFamily: FONT, fontWeight: 600,
        }}>
          {state.verdict.slice(0, 100)}{state.verdict.length > 100 ? '…' : ''}
        </div>
      )}

      {/* Top evidence items */}
      {evidence.length > 0 && !open && (
        <div style={{ marginBottom: 8 }}>
          {evidence.slice(0, 2).map((e, i) => (
            <div key={i} style={{
              fontSize: 11, color: C.textDim, lineHeight: 1.5,
              borderLeft: `1px solid ${C.border}`, paddingLeft: 8, marginBottom: 4,
              fontFamily: FONT,
            }}>
              {e.title.slice(0, 90)}{e.title.length > 90 ? '…' : ''}
            </div>
          ))}
        </div>
      )}

      {/* Expand button */}
      {isDone && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '3px 10px',
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: C.muted, fontFamily: FONT, cursor: 'pointer', marginBottom: open ? 12 : 0,
          }}
        >
          {open ? 'COLLAPSE' : 'FULL REPORT'}
        </button>
      )}

      {/* Expanded details */}
      {open && isDone && (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {state.summary && (
            <div style={{ marginBottom: 12 }}>
              <Label>REASONING</Label>
              <div style={{ marginTop: 6, fontSize: 13, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
                {state.summary}
              </div>
            </div>
          )}
          {evidence.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>EVIDENCE</Label>
              <div style={{ marginTop: 6 }}>
                {evidence.map((e, i) => <SourceLink key={i} item={e} isEvidence />)}
              </div>
            </div>
          )}
          <TelemetryRow state={state} />
        </div>
      )}
    </div>
  )
}

export interface InvestigationBoardProps {
  agentStates: Record<AgentId, AgentState>
  confirmedInput?: Record<string, unknown> | null
}

export function InvestigationBoard({ agentStates, confirmedInput }: InvestigationBoardProps) {
  const { theme: C } = useTheme()
  const hasAny = Object.values(agentStates).some(s => s.status !== 'idle')
  const procName = confirmedInput?.procurement_name as string | undefined

  const allDone = AGENT_IDS.every(id => agentStates[id].status !== 'idle' && agentStates[id].status !== 'running')
  const doneCount = AGENT_IDS.filter(id => agentStates[id].status !== 'idle' && agentStates[id].status !== 'running').length
  const runningCount = AGENT_IDS.filter(id => agentStates[id].status === 'running').length
  const highRiskCount = AGENT_IDS.filter(id => agentStates[id].status === 'red').length
  const avgScore = doneCount > 0
    ? Math.round(AGENT_IDS.filter(id => agentStates[id].status !== 'idle').reduce((s, id) => s + riskScore(agentStates[id]), 0) / Math.max(doneCount, 1))
    : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* ── Live investigation canvas ── */}
      <div style={{ height: 480, borderBottom: `1px solid ${C.border}`, flexShrink: 0, position: 'relative' }}>
        <GraphCanvas
          agentStates={agentStates}
          intakeResearch={confirmedInput?.research as ResearchItem[] | undefined}
          intakeCategory={confirmedInput?.equipment_type as string | undefined}
        />
        {!hasAny && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT, letterSpacing: '0.18em' }}>
              RUN AN ANALYSIS TO ACTIVATE
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* ── Orchestrator status panel ── */}
        <div style={{
          background: C.surface, border: `1px solid ${C.borderMid}`,
          borderRadius: 2, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: runningCount > 0 ? C.textDim : allDone ? C.green : C.faint,
              animation: runningCount > 0 ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <Label>ORCHESTRATOR</Label>
          </div>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT, letterSpacing: '0.1em' }}>
            {runningCount > 0
              ? `${runningCount} AGENT${runningCount > 1 ? 'S' : ''} RUNNING`
              : allDone
              ? `ALL ${AGENT_IDS.length} AGENTS COMPLETE`
              : hasAny
              ? `${doneCount} / ${AGENT_IDS.length} COMPLETE`
              : 'WAITING FOR RUN'}
          </span>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
              WORKFLOW <span style={{ color: C.green }}>PREMORTEM ANALYSIS</span>
            </span>
            {doneCount > 0 && (
              <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>
                AVG RISK <span style={{ color: avgScore >= 75 ? C.red : avgScore >= 50 ? C.amber : C.green }}>{avgScore}</span>
              </span>
            )}
            {highRiskCount > 0 && (
              <span style={{
                fontSize: 10, color: C.red, fontFamily: FONT, border: `1px solid ${C.red}44`,
                borderRadius: 2, padding: '1px 6px', letterSpacing: '0.1em',
              }}>
                {highRiskCount} HIGH RISK
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <Label>INVESTIGATION BOARD</Label>
          {procName && (
            <div style={{ fontSize: 13, color: C.muted, fontFamily: FONT, marginTop: 4 }}>
              {procName}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {AGENT_IDS.map(id => (
            <AgentCard key={id} id={id} state={agentStates[id]} />
          ))}
        </div>

        {/* Decision board agent */}
        {agentStates.decision.status !== 'idle' && (
          <div style={{
            background: C.surface, border: `1px solid ${C.borderMid}`,
            borderRadius: 2, padding: '16px 18px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: statusColor(agentStates.decision.status, C),
              }} />
              <Label>DECISION BOARD</Label>
            </div>
            {agentStates.decision.verdict && (
              <div style={{
                fontSize: 17, fontWeight: 700, color: decisionColor(agentStates.decision.verdict ?? '', C),
                fontFamily: FONT, lineHeight: 1.4, marginBottom: 8,
              }}>
                {agentStates.decision.verdict}
              </div>
            )}
            {agentStates.decision.summary && (
              <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
                {agentStates.decision.summary}
              </div>
            )}
          </div>
        )}

        {/* ── Evaluator feedback panel ── */}
        {allDone && (
          <div style={{
            background: C.green + '10', border: `1px solid ${C.green}33`,
            borderRadius: 2, padding: '14px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan }} />
              <Label color={C.cyan}>EVALUATOR QUALITY CHECK</Label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'All required agents completed', pass: doneCount >= AGENT_IDS.length },
                { label: 'No agents returned critical failures', pass: highRiskCount < AGENT_IDS.length },
                { label: 'Decision board produced a verdict', pass: !!agentStates.decision.verdict },
                { label: 'Risk scores available for all agents', pass: AGENT_IDS.every(id => riskScore(agentStates[id]) > 0) },
              ].map((check, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    background: check.pass ? C.cyan : C.amber,
                  }} />
                  <span style={{ fontSize: 11, color: check.pass ? C.textDim : C.amber, fontFamily: FONT, letterSpacing: '0.06em' }}>
                    {check.label}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: check.pass ? C.muted : C.amber, fontFamily: FONT, letterSpacing: '0.1em' }}>
                    {check.pass ? 'PASS' : 'REVIEW'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.muted, fontFamily: FONT, lineHeight: 1.6 }}>
              Full evaluator agent (quality scoring, consistency check, confidence estimation) requires backend implementation.
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SCREEN 3 — DEBATE ROOM
   ════════════════════════════════════════════════════════════════════════ */
const AGENT_COLORS_FIXED: Record<string, string> = {
  contract: '#4a90d9',
  infrastructure: '#7c3aed',
  workforce: '#0891b2',
  historical: '#059669',
  financial: '#d97706',
}

function agentColor(name: string, C: Theme): string {
  const lower = name.toLowerCase()
  for (const [key, col] of Object.entries(AGENT_COLORS_FIXED)) {
    if (lower.includes(key)) return col
  }
  if (lower.includes('decision')) return C.accent
  return C.muted
}

export interface DebateRoomProps {
  debate: DebateTurn[]
  runResult: RunResult | null
}

export function DebateRoom({ debate, runResult }: DebateRoomProps) {
  const { theme: C } = useTheme()
  const [reviewText, setReviewText]   = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!debate || debate.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
        <EmptyState message="RUN AN ANALYSIS TO SEE THE AGENT DEBATE TRANSCRIPT" />
      </div>
    )
  }

  const dColor = runResult ? decisionColor(runResult.decision, C) : C.muted

  async function handleSubmitReview() {
    if (!reviewText.trim()) return
    setSubmitting(true); setSubmitError(null)
    try {
      const res = await fetch('/api/ui-guidance/rfq-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'rfq_intake',
          free_text: reviewText,
          store_history: true,
          static_inputs: {
            procurement_name: runResult ? runResult.decision : '',
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const runId = data.history?.run_id ?? 'submitted'
      setSubmitted(runId)
      setReviewText('')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 28px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <Label>DEBATE ROOM</Label>
          {runResult && (
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: `${dColor}0a`, border: `1px solid ${dColor}33`,
              borderRadius: 2,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: dColor, fontFamily: FONT }}>
                {runResult.decision}
              </span>
            </div>
          )}
        </div>

        {/* Debate transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {debate.map((turn, i) => {
            const col = agentColor(turn.agent, C)
            return (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${col}`, borderRadius: 2,
                padding: '14px 18px',
              }}>
                <div style={{
                  fontSize: 11, letterSpacing: '0.18em', color: col,
                  fontWeight: 700, fontFamily: FONT, marginBottom: 10,
                }}>
                  {turn.agent.toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(turn.statements ?? []).map((stmt, j) => (
                    <div key={j} style={{
                      fontSize: 14, color: C.textDim, lineHeight: 1.65,
                      paddingLeft: 10, borderLeft: `1px solid ${C.border}`,
                      fontFamily: FONT,
                    }}>
                      {stmt}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Human-in-the-loop review */}
        <div style={{
          background: C.surface, border: `1px solid ${C.green}33`,
          borderRadius: 2, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan }} />
            <Label color={C.cyan}>HUMAN REVIEW</Label>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, fontFamily: FONT, letterSpacing: '0.08em', lineHeight: 1.6 }}>
            Add comments, objections, or approval conditions. Routed to UI Guidance Agent and stored in agent history.
          </div>

          {submitted ? (
            <div style={{
              padding: '12px 14px', background: C.green + '10', border: `1px solid ${C.green}33`,
              borderRadius: 2,
            }}>
              <div style={{ fontSize: 13, color: C.cyan, fontFamily: FONT, marginBottom: 4 }}>
                REVIEW SUBMITTED · {submitted}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                Your comments have been routed to the UI Guidance Agent.
              </div>
              <button
                onClick={() => setSubmitted(null)}
                style={{
                  marginTop: 10, background: 'none', border: `1px solid ${C.green}44`,
                  borderRadius: 2, padding: '3px 12px', fontSize: 10,
                  letterSpacing: '0.12em', color: C.muted, fontFamily: FONT, cursor: 'pointer',
                }}
              >
                ADD ANOTHER COMMENT
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="e.g. 'The site readiness should not be a blocker if contractor confirms completion by Q2. Request extension of delivery timeline to 6 months.'"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 2, padding: '8px 10px',
                  fontSize: 13, color: C.text, fontFamily: FONT,
                  outline: 'none', resize: 'vertical', lineHeight: 1.6,
                  marginBottom: 10,
                }}
              />
              {submitError && (
                <div style={{ fontSize: 11, color: C.accent, fontFamily: FONT, marginBottom: 8 }}>
                  ERROR: {submitError}
                </div>
              )}
              <button
                onClick={handleSubmitReview}
                disabled={!reviewText.trim() || submitting}
                style={{
                  background: reviewText.trim() && !submitting ? C.cyan : 'transparent',
                  color: reviewText.trim() && !submitting ? C.bg : C.muted,
                  border: `1px solid ${reviewText.trim() && !submitting ? C.cyan : C.green + '44'}`,
                  borderRadius: 2, padding: '5px 18px',
                  fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                  fontFamily: FONT, cursor: reviewText.trim() && !submitting ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                }}
              >
                {submitting ? 'SUBMITTING···' : 'SUBMIT REVIEW'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SCREEN 4 — EXECUTIVE DASHBOARD
   ════════════════════════════════════════════════════════════════════════ */
function ScenarioCard({ scenario }: { scenario: ScenarioOutcome }) {
  const { theme: C } = useTheme()
  const isWorst = scenario.name.toLowerCase().includes('worst')
  const isBest  = scenario.name.toLowerCase().includes('best')
  const col = isWorst ? C.red : isBest ? C.green : C.amber

  return (
    <div style={{
      background: C.surface, border: `1px solid ${col}33`,
      borderRadius: 2, padding: '14px 16px', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: col }} />
        <Label color={col}>{scenario.name}</Label>
        <span style={{
          marginLeft: 'auto', fontSize: 10, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em',
        }}>
          {Math.round(scenario.probability_pct)}% PROB
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.14em', fontFamily: FONT, marginBottom: 3 }}>DELAY</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: col, fontFamily: FONT }}>
            {scenario.timeline_months}mo
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.14em', fontFamily: FONT, marginBottom: 3 }}>LOSS</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: col, fontFamily: FONT }}>
            ₹{scenario.financial_impact_cr.toFixed(1)} Cr
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, fontFamily: FONT }}>
        {scenario.operational_impact}
      </div>
    </div>
  )
}

export interface ExecutiveDashboardProps {
  agentStates: Record<AgentId, AgentState>
  runResult: RunResult | null
  fullReport: FullReport | null
  confirmedInput?: Record<string, unknown> | null
}

export function ExecutiveDashboard({ agentStates, runResult, fullReport, confirmedInput }: ExecutiveDashboardProps) {
  const { theme: C } = useTheme()
  if (!runResult) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
        <EmptyState message="RUN AN ANALYSIS TO SEE THE EXECUTIVE DASHBOARD" />
      </div>
    )
  }

  const dCol = decisionColor(runResult.decision, C)
  const procName = confirmedInput?.procurement_name as string | undefined

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* Decision hero */}
        <div style={{
          background: `${dCol}0a`, border: `1px solid ${dCol}33`,
          borderRadius: 2, padding: '20px 24px', marginBottom: 24,
        }}>
          {procName && (
            <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, letterSpacing: '0.12em', marginBottom: 8 }}>
              {procName}
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 700, color: dCol, fontFamily: FONT, letterSpacing: '0.04em' }}>
            {runResult.decision}
          </div>
          {fullReport?.predicted_failure_mode && (
            <div style={{ marginTop: 10, fontSize: 14, color: C.textDim, fontFamily: FONT, lineHeight: 1.65 }}>
              {fullReport.predicted_failure_mode}
            </div>
          )}
        </div>

        {/* Evaluator badge */}
        {fullReport && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '8px 14px', background: C.cyan + '08', border: `1px solid ${C.cyan}22`,
            borderRadius: 2,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan }} />
            <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
              EVALUATOR
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT }}>
              {fullReport.confidence_pct > 0
                ? `${Math.round(fullReport.confidence_pct)}% CONFIDENCE`
                : 'CONFIDENCE NOT AVAILABLE'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
              FULL EVALUATOR AGENT REQUIRES BACKEND IMPLEMENTATION
            </span>
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'RISK SCORE',       value: `${Math.round(runResult.score)}/100`,                    color: runResult.score >= 75 ? C.red : runResult.score >= 50 ? C.amber : C.green },
            { label: 'EXPOSURE',         value: runResult.exposure_range,                                color: C.text },
            { label: 'FAILURE PROB',     value: fullReport ? `${Math.round(fullReport.failure_probability_pct)}%` : '—', color: C.text },
            { label: 'PREDICTED DELAY',  value: fullReport ? `${fullReport.predicted_delay_months}mo` : '—', color: C.text },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '12px 14px',
            }}>
              <Label>{kpi.label}</Label>
              <div style={{ fontSize: 18, fontWeight: 700, color: kpi.color, marginTop: 6, fontFamily: FONT, letterSpacing: '-0.02em' }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <ChartsSection agentStates={agentStates} />

        {/* Scenarios */}
        {fullReport && fullReport.scenarios.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, marginBottom: 24 }}>
            <SectionTitle label="SCENARIO OUTCOMES" />
            <div style={{ display: 'flex', gap: 12 }}>
              {fullReport.scenarios.map((s, i) => (
                <ScenarioCard key={i} scenario={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SCREEN 5 — PREMORTEM REPORT
   ════════════════════════════════════════════════════════════════════════ */
export interface ReportViewProps {
  runResult: RunResult | null
  fullReport: FullReport | null
  confirmedInput?: Record<string, unknown> | null
  onExport: (fmt: string) => void
}

export function ReportView({ runResult, fullReport, confirmedInput, onExport }: ReportViewProps) {
  const { theme: C } = useTheme()
  if (!runResult || !fullReport) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
        <EmptyState message="RUN AN ANALYSIS TO GENERATE THE PREMORTEM REPORT" />
      </div>
    )
  }

  const dCol = decisionColor(runResult.decision, C)
  const procName = confirmedInput?.procurement_name as string | undefined
  const generatedAt = fullReport.generated_at
    ? new Date(fullReport.generated_at).toLocaleString()
    : ''

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* Report header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', fontFamily: FONT, marginBottom: 4 }}>
            PREMORTEM REPORT  ·  {generatedAt}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, fontFamily: FONT, letterSpacing: '0.02em' }}>
            {procName ?? fullReport.procurement_name}
          </div>
          <div style={{ fontSize: 13, color: C.textDim, fontFamily: FONT, marginTop: 4 }}>
            {fullReport.equipment_type}  ·  ₹{fullReport.contract_value_cr} Cr
          </div>
        </div>

        {/* Decision */}
        <div style={{
          background: `${dCol}0a`, border: `1px solid ${dCol}33`,
          borderRadius: 2, padding: '18px 22px', marginBottom: 24,
        }}>
          <Label color={dCol}>RECOMMENDED DECISION</Label>
          <div style={{ fontSize: 16, fontWeight: 700, color: dCol, marginTop: 8, fontFamily: FONT }}>
            {runResult.decision}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
            <Chip label="RISK SCORE"  value={`${Math.round(runResult.score)}/100`} />
            <Chip label="EXPOSURE"    value={runResult.exposure_range} />
            <Chip label="CONDITIONS"  value={`${runResult.conditions.length}`} />
          </div>
        </div>

        {/* Conditions */}
        {runResult.conditions.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
            <SectionTitle label="APPROVAL CONDITIONS" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runResult.conditions.map((c, i) => (
                <div key={i} style={{
                  padding: '10px 14px', background: `${C.amber}0a`, border: `1px solid ${C.amber}33`,
                  borderRadius: 2, fontSize: 14, color: C.textDim, lineHeight: 1.65, fontFamily: FONT,
                }}>
                  <span style={{ color: C.amber, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
                    CONDITION {i + 1} &nbsp;
                  </span>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predicted outcomes */}
        {fullReport.predicted_outcomes.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
            <SectionTitle label="PREDICTED OUTCOMES" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fullReport.predicted_outcomes.map((o, i) => (
                <div key={i} style={{
                  fontSize: 13, color: C.textDim, lineHeight: 1.65,
                  paddingLeft: 10, borderLeft: `1px solid ${C.faint}`, fontFamily: FONT,
                }}>
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supporting evidence */}
        {fullReport.supporting_evidence.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
            <SectionTitle label="SUPPORTING EVIDENCE" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fullReport.supporting_evidence.map((e, i) => (
                <div key={i} style={{
                  padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 2, fontSize: 13, color: C.textDim, lineHeight: 1.6, fontFamily: FONT,
                }}>
                  {e}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failure mode */}
        {fullReport.predicted_failure_mode && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
            <SectionTitle label="PREDICTED FAILURE MODE" />
            <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.7, fontFamily: FONT }}>
              {fullReport.predicted_failure_mode}
            </div>
          </div>
        )}

        {/* Follow-up questions */}
        {fullReport.conditions.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
            <SectionTitle label="FOLLOW-UP QUESTIONS FOR VENDOR" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fullReport.conditions.map((c, i) => (
                <div key={i} style={{
                  padding: '9px 13px', background: C.green + '08', border: `1px solid ${C.green}22`,
                  borderRadius: 2, fontSize: 13, color: C.textDim, lineHeight: 1.6, fontFamily: FONT,
                  display: 'flex', gap: 10,
                }}>
                  <span style={{ color: C.green, fontSize: 11, flexShrink: 0, paddingTop: 1 }}>
                    Q{i + 1}
                  </span>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Human approval actions */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 24 }}>
          <SectionTitle label="HUMAN DECISION" />
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginBottom: 14, lineHeight: 1.6 }}>
            Record your decision on this procurement. Stored to decision history when backend is connected.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'APPROVE',          col: '#22d3ee', bg: '#001a1a', border: '#22d3ee44' },
              { label: 'APPROVE WITH CONDITIONS', col: '#f97316', bg: '#1a0c00', border: '#f9731644' },
              { label: 'REVISE & RESUBMIT', col: C.amber,    bg: '#100c00', border: `${C.amber}44`  },
              { label: 'REJECT',           col: C.accent,   bg: '#1a0808', border: `${C.accent}44` },
            ].map(action => (
              <button
                key={action.label}
                title="Human approval actions — requires backend decision history"
                style={{
                  background: 'none', border: `1px solid ${action.border}`,
                  borderRadius: 2, padding: '6px 16px',
                  fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: action.col, fontFamily: FONT, cursor: 'pointer',
                }}
                onClick={() => alert(`Human approval (${action.label}) — requires decision history backend integration`)}
              >
                {action.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: C.muted, fontFamily: FONT, letterSpacing: '0.08em' }}>
            Full approval workflow stores human decision and override to database — requires backend implementation
          </div>
        </div>

        {/* Export */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          <Label>EXPORT REPORT</Label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {(['pdf', 'docx', 'json'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => onExport(fmt)}
                style={{
                  background: 'none', border: `1px solid ${C.border}`,
                  borderRadius: 2, padding: '6px 18px',
                  fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: C.muted, fontFamily: FONT, cursor: 'pointer',
                }}
              >
                {fmt.toUpperCase()} ↓
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   FULL ANALYSIS PAGE (backward-compatible, used for the old all-in-one view)
   ════════════════════════════════════════════════════════════════════════ */
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
  const { theme: C } = useTheme()
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
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '0.1em', fontFamily: FONT, marginBottom: 4 }}>
            {procName ?? 'ANALYSIS'}
          </div>
          {!hasAnyData && (
            <div style={{ fontSize: 14, color: C.textDim, fontFamily: FONT }}>
              Run an analysis to see results here.
            </div>
          )}
        </div>

        <DecisionSection
          runResult={runResult}
          decisionState={agentStates.decision}
          sectionRef={setRef('decision')}
        />

        <ChartsSection agentStates={agentStates} />

        <div ref={el => { if (el) sectionRefs.current['profiler'] = el }}>
          <ProfilerSection
            category={intakeCategory}
            research={intakeResearch}
            missingFields={intakeMissingFields}
            confirmedInput={confirmedInput}
          />
        </div>

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
