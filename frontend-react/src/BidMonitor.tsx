import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bid, BidGraphEdge, BidGraphNode, RunQuote, RunState } from './types'
import { useTheme } from './theme'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"

function Lbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT, ...style,
    }}>
      {children}
    </span>
  )
}

/* ── Status helpers ─────────────────────────────────────────────────────── */
function nodeColor(status: string, C: { green: string; red: string; faint: string; textDim: string }) {
  if (status === 'completed' || status === 'ok') return C.green
  if (status === 'running') return C.textDim
  if (status === 'failed') return C.red
  return C.faint
}

function quoteStatusColor(status: string, C: { green: string; red: string; muted: string; textDim: string }) {
  if (status === 'completed') return C.green
  if (status === 'running') return C.textDim
  if (status === 'failed') return C.red
  return C.muted
}

function riskColor(score: number, C: { red: string; amber: string; green: string }) {
  if (score >= 75) return C.red
  if (score >= 50) return C.amber
  return C.green
}

function fmtScore(score?: number) {
  if (score == null) return '—'
  return score.toFixed(0)
}

/* ── Agent graph (SVG-based) ─────────────────────────────────────────── */
const NODE_DEFS: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  vendor_proposal:  { x: 20,  y: 60,  w: 120, h: 34, label: 'VENDOR PROPOSAL' },
  contract_review:  { x: 175, y: 60,  w: 120, h: 34, label: 'CONTRACT REVIEW' },
  market_research:  { x: 175, y: 115, w: 120, h: 34, label: 'MARKET RESEARCH' },
  bid_recommender:  { x: 340, y: 85,  w: 130, h: 34, label: 'BID RECOMMENDER' },
  decision_logic:   { x: 510, y: 85,  w: 120, h: 34, label: 'DECISION LOGIC' },
  document_store:   { x: 340, y: 155, w: 110, h: 28, label: 'PDF STORE' },
  llm_provider:     { x: 510, y: 155, w: 110, h: 28, label: 'LLM PROVIDER' },
}

const SVG_W = 660, SVG_H = 210

function cx(id: string) {
  const n = NODE_DEFS[id]; return n ? n.x + n.w / 2 : 0
}
function cy(id: string) {
  const n = NODE_DEFS[id]; return n ? n.y + n.h / 2 : 0
}

function AgentGraph({ nodes, edges }: { nodes: BidGraphNode[]; edges: BidGraphEdge[] }) {
  const { theme: C } = useTheme()
  const statusMap = Object.fromEntries(nodes.map(n => [n.id, n.status]))

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: '100%', maxWidth: SVG_W, display: 'block' }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3"
          markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={C.borderMid} />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const sx = cx(e.source), sy = cy(e.source)
        const tx = cx(e.target), ty = cy(e.target)
        if (!sx && !tx) return null
        const active = statusMap[e.source] === 'running' || statusMap[e.source] === 'completed'
        return (
          <line
            key={i} x1={sx} y1={sy} x2={tx} y2={ty}
            stroke={active ? C.borderMid : C.border}
            strokeWidth={1}
            strokeDasharray="4 3"
            markerEnd="url(#arrow)"
          />
        )
      })}

      {/* Nodes */}
      {Object.entries(NODE_DEFS).map(([id, def]) => {
        const status = statusMap[id] ?? 'waiting'
        const color = nodeColor(status, C)
        const isRunning = status === 'running'
        const isData = def.h < 32
        return (
          <g key={id}>
            <rect
              x={def.x} y={def.y} width={def.w} height={def.h} rx={2}
              fill={C.surface}
              stroke={isRunning ? C.borderMid : color === C.faint ? C.border : `${color}44`}
              strokeWidth={1}
            />
            {/* Status dot */}
            <circle
              cx={def.x + 10} cy={def.y + def.h / 2} r={3}
              fill={color}
              opacity={color === C.faint ? 0.4 : 1}
            />
            {/* Label */}
            <text
              x={def.x + 20} y={def.y + def.h / 2 + 1}
              fill={status === 'waiting' || status === 'pending' ? C.muted : C.textDim}
              fontSize={isData ? 7 : 7.5}
              fontFamily={FONT}
              letterSpacing="0.1em"
              dominantBaseline="middle"
            >
              {def.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Quote progress table ─────────────────────────────────────────────── */
function QuoteTable({ quotes }: { quotes: RunQuote[] }) {
  const { theme: C } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {quotes.map(q => (
        <div key={q.quote_id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 2, padding: '8px 12px',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: quoteStatusColor(q.status, C),
            boxShadow: q.status === 'running' ? `0 0 4px ${C.text}` : undefined,
          }} />
          <div style={{ flex: 1, fontSize: 10, color: q.status === 'pending' ? C.muted : C.text }}>
            {q.vendor_name || q.quote_id}
          </div>
          {q.vendor_name && (
            <div style={{ fontSize: 8, color: C.muted }}>{q.quote_id}</div>
          )}
          {q.status === 'running' && (
            <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.12em' }}>ANALYZING···</div>
          )}
          {q.status === 'completed' && q.risk_score != null && (
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: riskColor(q.risk_score, C),
            }}>
              {fmtScore(q.risk_score)}/100
            </div>
          )}
          <div style={{
            fontSize: 7, letterSpacing: '0.12em',
            color: quoteStatusColor(q.status, C), opacity: 0.6,
          }}>
            {q.status.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
export interface BidMonitorProps {
  bid: Bid
  runId: string
  onBack: () => void
  onComplete: (runId: string) => void
}

export function BidMonitor({ bid, runId, onBack, onComplete }: BidMonitorProps) {
  const { theme: C } = useTheme()
  const [state, setState] = useState<RunState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/bid-runs/${runId}/state`)
      if (!r.ok) throw new Error(await r.text())
      const data: RunState = await r.json()
      setState(data)
      if (data.status === 'completed' || data.status === 'failed') {
        doneRef.current = true
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (data.status === 'completed') {
          setTimeout(() => onComplete(runId), 1200)
        }
      }
    } catch (e) {
      setError(String(e))
    }
  }, [runId, onComplete])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [poll])

  const graphNodes = state?.graph?.nodes ?? []
  const graphEdges = state?.graph?.edges ?? []
  const quotes = state?.quotes ?? []
  const agents = state?.agents ?? {}
  const telemetry = state?.telemetry

  const isDone = state?.status === 'completed' || state?.status === 'failed'
  const isFailed = state?.status === 'failed'

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: C.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: C.textDim,
          fontFamily: FONT, fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', cursor: 'pointer', padding: 0,
        }}>
          ← BACK
        </button>
        <div style={{ width: 1, height: 12, background: C.border }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '0.05em' }}>
            {bid.procurement_name || bid.bid_id}
          </div>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: '0.1em', marginTop: 2 }}>
            {runId}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', background: C.textDim,
                animation: 'pulse 1.2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 8, color: C.muted, letterSpacing: '0.14em' }}>RUNNING</span>
            </div>
          )}
          {isDone && !isFailed && (
            <span style={{ fontSize: 8, color: C.green, letterSpacing: '0.14em' }}>COMPLETED</span>
          )}
          {isFailed && (
            <span style={{ fontSize: 8, color: C.red, letterSpacing: '0.14em' }}>FAILED</span>
          )}
          {telemetry && (
            <span style={{ fontSize: 8, color: C.muted, letterSpacing: '0.1em' }}>
              {telemetry.llm_calls} LLM · {telemetry.errors} ERR
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          fontSize: 9, color: C.accent, background: C.accent + '12',
          border: `1px solid ${C.accent}44`, borderRadius: 2,
          padding: '8px 12px', marginBottom: 16,
        }}>
          {error}
        </div>
      )}
      {isFailed && state?.error && (
        <div style={{
          fontSize: 9, color: C.red, background: C.red + '12',
          border: `1px solid ${C.red}44`, borderRadius: 2,
          padding: '10px 14px', marginBottom: 16,
        }}>
          RUN FAILED: {state.error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20 }}>
        {/* Left: graph + quotes */}
        <div>
          {/* Agent graph */}
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '16px 14px', marginBottom: 16,
          }}>
            <Lbl style={{ display: 'block', marginBottom: 14 }}>AGENT GRAPH</Lbl>
            <AgentGraph nodes={graphNodes} edges={graphEdges} />
          </div>

          {/* Quote progress */}
          <div>
            <Lbl style={{ display: 'block', marginBottom: 10 }}>
              QUOTES ({quotes.length})
            </Lbl>
            {quotes.length === 0 ? (
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.14em' }}>
                WAITING FOR QUOTE REVIEW TO BEGIN···
              </div>
            ) : (
              <QuoteTable quotes={quotes} />
            )}
          </div>
        </div>

        {/* Right: agent status panel */}
        <div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '14px 16px',
          }}>
            <Lbl style={{ display: 'block', marginBottom: 12 }}>AGENT STATUS</Lbl>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(agents).map(([id, ag]) => (
                <div key={id} style={{
                  paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: nodeColor(ag.status, C),
                    }} />
                    <span style={{
                      fontSize: 9, color: ag.status === 'waiting' ? '#333' : C.text,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {id.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {ag.message && (
                    <div style={{
                      fontSize: 8, color: C.textDim, paddingLeft: 13, lineHeight: 1.4,
                    }}>
                      {ag.message}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {state && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 8, color: C.muted, lineHeight: 1.8 }}>
                  <div>STEP: <span style={{ color: C.textDim }}>{state.current_step}</span></div>
                  <div>STATUS: <span style={{ color: nodeColor(state.status, C) }}>{state.status.toUpperCase()}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* External connections */}
          {state?.external_connections && state.external_connections.length > 0 && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '14px 16px', marginTop: 10,
            }}>
              <Lbl style={{ display: 'block', marginBottom: 10 }}>CONNECTIONS</Lbl>
              {state.external_connections.map(conn => (
                <div key={conn.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 6, fontSize: 9, color: C.textDim,
                }}>
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: conn.status === 'ok' ? C.green : conn.status === 'pending' ? C.amber : C.muted,
                  }} />
                  {conn.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3 }
          50% { opacity: 1 }
        }
      `}</style>
    </div>
  )
}
