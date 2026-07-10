import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node as FlowNode,
  Position,
} from 'reactflow'
import type { AgentId, AgentState, NodeStatus } from './types'
import { useTheme } from './theme'
import type { Theme } from './theme'

const FONT = "'JetBrains Mono', monospace"

/* ── Status palette — semantic colors fixed; idle/running use theme ─── */
function statusStyle(status: NodeStatus, C: Theme) {
  if (status === 'green') return { border: '#22c55e', glow: '0 0 14px 3px rgba(34,197,94,.2)',  dot: '#22c55e', accent: '#22c55e' }
  if (status === 'amber') return { border: '#f59e0b', glow: '0 0 14px 3px rgba(245,158,11,.2)', dot: '#f59e0b', accent: '#f59e0b' }
  if (status === 'red')   return { border: '#ef4444', glow: '0 0 14px 3px rgba(239,68,68,.2)',  dot: '#ef4444', accent: '#ef4444' }
  if (status === 'running') return { border: C.textDim, glow: 'none', dot: C.textDim, accent: C.textDim }
  return { border: C.border, glow: 'none', dot: C.muted, accent: C.muted }
}

const RISK_LABELS: Record<NodeStatus, string> = {
  idle: 'WAITING', running: 'PROCESSING', green: 'LOW / MOD', amber: 'HIGH', red: 'CRITICAL',
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function fmtTok(t?: { in: number | null; out: number | null }): string {
  if (!t) return '—'
  const n = (t.in ?? 0) + (t.out ?? 0)
  return n > 0 ? `${n.toLocaleString()}` : '—'
}
function fmtTokDetail(t?: { in: number | null; out: number | null }): string {
  if (!t) return '—'
  return `${(t.in ?? 0).toLocaleString()} in · ${(t.out ?? 0).toLocaleString()} out`
}
function fmtSec(ms?: number): string {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '—'
}
function shortModel(m?: string | null): string {
  if (!m) return '—'
  if (m.includes('haiku'))  return 'haiku-4.5'
  if (m.includes('sonnet')) return 'sonnet-4.6'
  if (m.includes('opus'))   return 'opus-4'
  if (m.includes('gpt-4o')) return 'gpt-4o'
  return (m.split('/').pop() ?? m).slice(0, 12)
}

/* ── Handle style (theme-aware) ──────────────────────────────────────── */
function handleStyle(C: Theme) {
  return { width: 6, height: 6, background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
}

const MK = (c: string) => ({ type: MarkerType.ArrowClosed, color: c, width: 8, height: 8 })

/* ═══════════════════════════════════════════════════════════════════════
   HOVER / PINNED CARD  (portal-rendered)
═══════════════════════════════════════════════════════════════════════ */
interface HoverCardProps {
  anchorEl: HTMLElement
  id: AgentId | 'profiler'
  title: string
  state: AgentState
  onClose: () => void
  cardRef: React.RefObject<HTMLDivElement>
}

function HoverCard({ anchorEl, id, title, state, onClose, cardRef }: HoverCardProps) {
  const { theme: C } = useTheme()
  const isDone = ['green', 'amber', 'red'].includes(state.status)
  const sc = statusStyle(state.status, C)

  const cardW = 320
  const rect = anchorEl.getBoundingClientRect()
  const spaceRight = window.innerWidth - rect.right
  const left = spaceRight > cardW + 16 ? rect.right + 10 : rect.left - cardW - 10
  const top  = Math.min(rect.top, window.innerHeight - 420)

  return createPortal(
    <div
      ref={cardRef}
      style={{
        position: 'fixed', top, left, zIndex: 9999,
        width: cardW, maxHeight: 480, overflowY: 'auto',
        background: C.surface, border: `1px solid ${sc.border}`,
        borderTop: `2px solid ${sc.accent}`,
        borderRadius: 3, fontFamily: FONT,
        boxShadow: `0 16px 40px rgba(0,0,0,.25), ${sc.glow}`,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 14px 10px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 8, letterSpacing: '0.2em', color: sc.accent, textTransform: 'uppercase', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontSize: 7, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
            {RISK_LABELS[state.status]}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
            color: C.textDim, cursor: 'pointer', fontFamily: FONT,
            fontSize: 9, padding: '2px 8px', letterSpacing: '0.1em', flexShrink: 0, marginLeft: 8,
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      {/* Agent ID badge */}
      <div style={{ padding: '6px 14px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 7, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {id === 'profiler' ? 'profiler_node' : `${id}_agent`} · {shortModel(state.model)}
        </span>
      </div>

      {/* Score */}
      {isDone && state.risk_score != null && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: sc.accent, lineHeight: 1 }}>
            {Math.round(state.risk_score)}
          </span>
          <span style={{ fontSize: 8, color: C.textDim }}>/ 100 RISK SCORE</span>
        </div>
      )}

      {/* Verdict */}
      {state.verdict && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 7, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', marginBottom: 5 }}>VERDICT</div>
          <div style={{ fontSize: 9, color: sc.accent, fontWeight: 600, lineHeight: 1.6 }}>{state.verdict}</div>
        </div>
      )}

      {/* Reasoning / Summary */}
      {state.summary && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 7, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', marginBottom: 5 }}>REASONING</div>
          <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.7 }}>{state.summary}</div>
        </div>
      )}

      {/* Performance metrics */}
      <div style={{ padding: '10px 14px', borderBottom: state.research?.length ? `1px solid ${C.border}` : 'none' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>PERFORMANCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'MODEL',  value: shortModel(state.model) },
            { label: 'TIME',   value: fmtSec(state.time_ms) },
            { label: 'TOKENS', value: fmtTokDetail(state.tokens) },
            { label: 'STATUS', value: RISK_LABELS[state.status] },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 7, color: C.muted, letterSpacing: '0.12em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 8, color: C.textDim }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Research sources */}
      {state.research && state.research.length > 0 && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 7, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>
            SOURCES ({state.research.length})
          </div>
          {state.research.map((r, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              {r.url
                ? <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 8, color: C.cyan, textDecoration: 'none', display: 'block', marginBottom: 2 }}>↗ {r.title || r.url}</a>
                : <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>{r.title}</div>
              }
              {r.snippet && <div style={{ fontSize: 7, color: C.muted, lineHeight: 1.5 }}>{r.snippet.slice(0, 120)}…</div>}
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   AGENT NODE
═══════════════════════════════════════════════════════════════════════ */
interface AgentNodeData {
  agentId: AgentId | 'profiler'
  title: string
  subtitle: string
  accentColor: string
  state: AgentState
  hasTarget?: boolean
  hasSource?: boolean
  onPin: (id: AgentId | 'profiler', el: HTMLElement) => void
  pinnedId: string | null
}

const LiveAgentNode = memo(({ data }: { data: AgentNodeData }) => {
  const { theme: C } = useTheme()
  const { agentId, title, subtitle, accentColor, state, onPin, pinnedId } = data
  const nodeRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const st = statusStyle(state.status, C)
  const H  = handleStyle(C)
  const isRun  = state.status === 'running'
  const isDone = ['green', 'amber', 'red'].includes(state.status)
  const isPinned = pinnedId === agentId
  const showCard = (hovered || isPinned)

  const handleMouseEnter = useCallback(() => setHovered(true),  [])
  const handleMouseLeave = useCallback(() => setHovered(false), [])
  const handleClick      = useCallback(() => {
    if (nodeRef.current) onPin(agentId, nodeRef.current)
  }, [agentId, onPin])

  const leftColor = isDone || isRun ? accentColor : C.border

  return (
    <div
      ref={nodeRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        background: isPinned ? C.surface2 : C.surface,
        border: `1px solid ${isPinned ? st.border : hovered ? C.borderMid : C.border}`,
        borderLeft: `3px solid ${leftColor}`,
        borderRadius: 3, padding: '11px 14px', width: 195, fontFamily: FONT,
        boxShadow: isPinned ? st.glow : isRun ? 'none' : isDone ? st.glow : 'none',
        animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'border-color .2s, box-shadow .2s, background .2s',
        cursor: isDone ? 'pointer' : isRun ? 'default' : 'default',
        userSelect: 'none',
      }}
    >
      {data.hasTarget && <Handle type="target" position={Position.Left} style={H} />}

      {/* Status + title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: isDone || isRun ? accentColor : C.muted,
          transition: 'background .2s',
        }} />
        <span style={{
          fontSize: 7, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
          color: isDone || isRun ? accentColor : C.muted,
          transition: 'color .2s', flex: 1,
        }}>
          {isRun ? 'PROCESSING...' : isDone ? RISK_LABELS[state.status] : 'WAITING'}
        </span>
        {isDone && state.risk_score != null && (
          <span style={{ fontSize: 10, fontWeight: 700, color: st.dot }}>{Math.round(state.risk_score)}</span>
        )}
      </div>

      {/* Plain-English label */}
      <div style={{
        fontSize: 11, fontWeight: 600, lineHeight: 1.35, marginBottom: 6,
        color: isDone || isRun ? C.text : C.muted, transition: 'color .2s',
      }}>
        {title}
      </div>

      {/* Technical subtitle */}
      <div style={{ fontSize: 7, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isDone ? 8 : 0 }}>
        {subtitle}
      </div>

      {/* Metrics footer — visible when done */}
      {isDone && (
        <div style={{
          paddingTop: 7, borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <MetricBadge label="TIME"   value={fmtSec(state.time_ms)} color={accentColor} />
          <MetricBadge label="TOKENS" value={fmtTok(state.tokens)}  color={accentColor} />
          {state.model && (
            <span style={{ fontSize: 6, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {shortModel(state.model)}
            </span>
          )}
        </div>
      )}

      {/* Running spinner row */}
      {isRun && (
        <div style={{ paddingTop: 7, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 4, height: 4, borderRadius: '50%', background: accentColor,
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 7, color: C.textDim, letterSpacing: '0.1em' }}>CALLING LLM</span>
        </div>
      )}

      {/* Hint */}
      {isDone && (
        <div style={{ marginTop: 4, fontSize: 6, color: isPinned ? C.textDim : C.muted, letterSpacing: '0.1em' }}>
          {isPinned ? 'CLICK TO DISMISS' : 'CLICK FOR DETAILS'}
        </div>
      )}

      {data.hasSource && <Handle type="source" position={Position.Right} style={H} />}

      {/* Hover card */}
      {showCard && nodeRef.current && (
        <HoverCardWrapper
          anchorEl={nodeRef.current}
          agentId={agentId}
          title={title}
          state={state}
          isPinned={isPinned}
          onClose={() => {
            setHovered(false)
            if (isPinned) onPin(agentId, nodeRef.current!)
          }}
        />
      )}
    </div>
  )
})
LiveAgentNode.displayName = 'LiveAgentNode'

/* Wrapper that handles the mouseenter/leave boundary between node and card */
function HoverCardWrapper({
  anchorEl, agentId, title, state, isPinned, onClose,
}: {
  anchorEl: HTMLElement
  agentId: AgentId | 'profiler'
  title: string
  state: AgentState
  isPinned: boolean
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPinned) return
    const close = (e: MouseEvent) => {
      if (
        !anchorEl.contains(e.target as globalThis.Node) &&
        !cardRef.current?.contains(e.target as globalThis.Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mouseover', close)
    return () => document.removeEventListener('mouseover', close)
  }, [anchorEl, isPinned, onClose])

  return (
    <HoverCard
      anchorEl={anchorEl}
      id={agentId}
      title={title}
      state={state}
      onClose={onClose}
      cardRef={cardRef}
    />
  )
}

/* Small metric pill */
function MetricBadge({ label, value, color }: { label: string; value: string; color: string }) {
  const { theme: C } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 6, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 7, color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

/* ── Decision node (special — larger, shows verdict) ─────────────────── */
interface DecisionNodeData {
  state: AgentState
  onPin: (id: 'decision', el: HTMLElement) => void
  pinnedId: string | null
}

const LiveDecisionNode = memo(({ data }: { data: DecisionNodeData }) => {
  const { theme: C } = useTheme()
  const { state, onPin, pinnedId } = data
  const nodeRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const st = statusStyle(state.status, C)
  const H  = handleStyle(C)
  const isRun  = state.status === 'running'
  const isDone = ['green', 'amber', 'red'].includes(state.status)
  const isPinned = pinnedId === 'decision'

  return (
    <div
      ref={nodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => nodeRef.current && onPin('decision', nodeRef.current)}
      style={{
        background: isPinned ? C.surface2 : C.surface,
        border: `1px solid ${isPinned ? st.border : hovered ? C.borderMid : C.border}`,
        borderLeft: `3px solid ${isDone || isRun ? st.dot : C.border}`,
        borderRadius: 3, padding: '14px 16px', width: 210, fontFamily: FONT,
        boxShadow: isDone ? st.glow : 'none',
        animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'all .2s', cursor: isDone ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={H} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isDone || isRun ? st.dot : C.muted, flexShrink: 0 }} />
        <span style={{ fontSize: 7, letterSpacing: '0.18em', color: isDone || isRun ? st.dot : C.muted, textTransform: 'uppercase', fontWeight: 700 }}>
          DECISION ENGINE
        </span>
        {isDone && state.risk_score != null && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: st.dot }}>{Math.round(state.risk_score)}</span>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: isDone || isRun ? C.text : C.muted, marginBottom: 6, lineHeight: 1.3 }}>
        AI Decision Board
      </div>

      {isDone && state.verdict && (
        <div style={{
          fontSize: 8, fontWeight: 700, color: st.dot, letterSpacing: '0.1em',
          border: `1px solid ${st.dot}33`, borderRadius: 2,
          padding: '4px 10px', display: 'inline-block', marginBottom: 8,
        }}>
          {state.verdict}
        </div>
      )}

      {isRun && (
        <div style={{ fontSize: 8, color: C.textDim, marginBottom: 8 }}>DELIBERATING ACROSS ALL AGENTS...</div>
      )}

      {!isDone && !isRun && (
        <div style={{ fontSize: 8, color: C.muted, marginBottom: 8 }}>Awaiting agent findings</div>
      )}

      {isDone && (
        <div style={{ paddingTop: 7, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <MetricBadge label="TIME" value={fmtSec(state.time_ms)} color={st.dot} />
          <MetricBadge label="TOKENS" value={fmtTok(state.tokens)} color={st.dot} />
          {state.model && <span style={{ fontSize: 6, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{shortModel(state.model)}</span>}
        </div>
      )}

      {isDone && (
        <div style={{ marginTop: 4, fontSize: 6, color: isPinned ? C.textDim : C.muted, letterSpacing: '0.1em' }}>
          {isPinned ? 'CLICK TO DISMISS' : 'CLICK FOR DETAILS'}
        </div>
      )}

      {(hovered || isPinned) && nodeRef.current && (
        <HoverCardWrapper
          anchorEl={nodeRef.current}
          agentId="decision"
          title="AI Decision Board"
          state={state}
          isPinned={isPinned}
          onClose={() => {
            setHovered(false)
            if (isPinned) onPin('decision', nodeRef.current!)
          }}
        />
      )}
    </div>
  )
})
LiveDecisionNode.displayName = 'LiveDecisionNode'

/* ── Profiler node ───────────────────────────────────────────────────── */
interface ProfilerData { hasStarted: boolean; category?: string }
const ProfilerLiveNode = memo(({ data }: { data: ProfilerData }) => {
  const { theme: C } = useTheme()
  const H = handleStyle(C)
  const cyan = '#22d3ee'
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${data.hasStarted ? cyan + '44' : C.border}`,
      borderLeft: `3px solid ${data.hasStarted ? cyan : C.border}`,
      borderRadius: 3, padding: '11px 14px', width: 165, fontFamily: FONT,
      transition: 'all .3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: data.hasStarted ? cyan : C.muted, flexShrink: 0, transition: 'background .3s' }} />
        <span style={{ fontSize: 7, letterSpacing: '0.16em', color: data.hasStarted ? cyan : C.muted, textTransform: 'uppercase', fontWeight: 700 }}>
          INPUT
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: data.hasStarted ? C.text : C.muted, marginBottom: 5, transition: 'color .3s' }}>
        Procurement Request
      </div>
      <div style={{ fontSize: 8, color: data.hasStarted ? C.textDim : C.muted, lineHeight: 1.6 }}>
        {data.hasStarted
          ? (data.category ? `Category: ${data.category}` : 'Analysis started')
          : 'Waiting for submission'}
      </div>
      <Handle type="source" position={Position.Right} style={H} />
    </div>
  )
})
ProfilerLiveNode.displayName = 'ProfilerLiveNode'

/* ── Label node ──────────────────────────────────────────────────────── */
const GroupLabelNode = memo(({ data }: { data: { text: string } }) => {
  const { theme: C } = useTheme()
  return (
    <div style={{ pointerEvents: 'none', userSelect: 'none', fontSize: 7, letterSpacing: '0.22em', color: C.muted, fontFamily: FONT, textTransform: 'uppercase', fontWeight: 700 }}>
      {data.text}
    </div>
  )
})
GroupLabelNode.displayName = 'GroupLabelNode'

/* ── Node types registry ─────────────────────────────────────────────── */
const NODE_TYPES = {
  liveAgent:    LiveAgentNode,
  liveDecision: LiveDecisionNode,
  liveProfiler: ProfilerLiveNode,
  groupLabel:   GroupLabelNode,
}

/* ═══════════════════════════════════════════════════════════════════════
   AGENT CONFIG
═══════════════════════════════════════════════════════════════════════ */
const AGENT_CFG: Record<AgentId, { title: string; subtitle: string; accent: string }> = {
  contract:       { title: 'Contract Risk Review',   subtitle: 'contract_agent.py · LLM',                              accent: '#22d3ee' },
  infrastructure: { title: 'Site & Infrastructure',  subtitle: 'infrastructure_agent.py · LLM → predicts delay',       accent: '#f97316' },
  workforce:      { title: 'Team & Workforce',        subtitle: 'workforce_agent.py · LLM',                             accent: '#a78bfa' },
  historical:     { title: 'Historical Benchmarking', subtitle: 'historical_agent.py · LLM + pgvector',                accent: '#fb923c' },
  financial:      { title: 'Financial Risk',          subtitle: 'financial_agent.py · LLM · awaits site delay',         accent: '#f59e0b' },
  decision:       { title: 'AI Decision Board',       subtitle: 'decision_board.py · weighted avg · rule-based',        accent: '#e8e8e8' },
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  lblInput:       { x: 18,  y: 8   },
  profiler:       { x: 18,  y: 162 },
  lblParallel:    { x: 273, y: 8   },
  contract:       { x: 273, y: 25  },
  infrastructure: { x: 273, y: 143 },
  workforce:      { x: 273, y: 261 },
  historical:     { x: 273, y: 379 },
  lblFinancial:   { x: 530, y: 8   },
  financial:      { x: 530, y: 143 },
  lblDecision:    { x: 796, y: 8   },
  decision:       { x: 796, y: 195 },
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export interface InvestigationCanvasProps {
  agentStates: Record<AgentId, AgentState>
  confirmedInput?: Record<string, unknown> | null
}

export function InvestigationCanvas({ agentStates, confirmedInput }: InvestigationCanvasProps) {
  const { theme: C } = useTheme()
  const hasStarted = Object.values(agentStates).some(s => s.status !== 'idle')

  const [pinned, setPinned] = useState<{ id: AgentId | 'profiler'; el: HTMLElement } | null>(null)
  const pinnedId = pinned?.id ?? null

  const handlePin = useCallback((id: AgentId | 'profiler', el: HTMLElement) => {
    setPinned(prev => prev?.id === id ? null : { id, el })
  }, [])

  useEffect(() => {
    if (!pinned) return
    const handler = (e: MouseEvent) => {
      const target = e.target as globalThis.Node
      const card = document.querySelector('[data-hovercard]')
      if (card?.contains(target)) return
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pinned])

  const st = (id: AgentId) => agentStates[id]

  /* ── Nodes ─────────────────────────────────────────────────────────── */
  const nodes: FlowNode[] = [
    { id: 'lbl-input',    type: 'groupLabel', position: POSITIONS.lblInput,    data: { text: 'YOUR INPUT' },          selectable: false },
    { id: 'lbl-parallel', type: 'groupLabel', position: POSITIONS.lblParallel, data: { text: 'PARALLEL ANALYSIS' },   selectable: false },
    { id: 'lbl-fin',      type: 'groupLabel', position: POSITIONS.lblFinancial, data: { text: 'SEQUENTIAL' },         selectable: false },
    { id: 'lbl-dec',      type: 'groupLabel', position: POSITIONS.lblDecision,  data: { text: 'DECISION ENGINE' },    selectable: false },

    {
      id: 'profiler', type: 'liveProfiler', position: POSITIONS.profiler,
      data: { hasStarted, category: confirmedInput?.equipment_type as string | undefined },
    },

    ...(['contract', 'infrastructure', 'workforce', 'historical'] as AgentId[]).map(id => ({
      id,
      type: 'liveAgent',
      position: POSITIONS[id as keyof typeof POSITIONS] as { x: number; y: number },
      data: {
        agentId: id,
        title:   AGENT_CFG[id].title,
        subtitle: AGENT_CFG[id].subtitle,
        accentColor: AGENT_CFG[id].accent,
        state: st(id),
        hasTarget: true,
        hasSource: true,
        onPin: handlePin,
        pinnedId,
      },
    })),

    {
      id: 'financial', type: 'liveAgent', position: POSITIONS.financial,
      data: {
        agentId: 'financial',
        title: AGENT_CFG.financial.title,
        subtitle: AGENT_CFG.financial.subtitle,
        accentColor: AGENT_CFG.financial.accent,
        state: st('financial'),
        hasTarget: true, hasSource: true,
        onPin: handlePin, pinnedId,
      },
    },

    {
      id: 'decision', type: 'liveDecision', position: POSITIONS.decision,
      data: { state: st('decision'), onPin: handlePin, pinnedId },
    },
  ]

  /* ── Edges ─────────────────────────────────────────────────────────── */
  function e(
    id: string, source: string, target: string,
    color: string, opts: Partial<Edge> = {},
  ): Edge {
    return {
      id, source, target,
      style: { stroke: color, strokeWidth: 1.2 },
      markerEnd: MK(color),
      ...opts,
    }
  }

  const active = (id: AgentId) => !['idle'].includes(agentStates[id].status)
  const dim = C.border

  const edges: Edge[] = [
    ...(['contract', 'infrastructure', 'workforce', 'historical'] as AgentId[]).map(id =>
      e(`pf-${id}`, 'profiler', id,
        hasStarted ? AGENT_CFG[id].accent : dim,
        { style: { stroke: hasStarted ? AGENT_CFG[id].accent + '88' : dim, strokeWidth: 1, strokeDasharray: '5 5' }, markerEnd: MK(hasStarted ? AGENT_CFG[id].accent + '88' : dim) }
      )
    ),

    e('infra-fin', 'infrastructure', 'financial',
      active('infrastructure') ? '#f59e0b' : dim,
      { label: 'delay estimate', labelStyle: { fontSize: 6, fill: C.muted, fontFamily: FONT } }
    ),

    e('con-dec', 'contract',       'decision', active('contract')       ? C.muted : dim),
    e('inf-dec', 'infrastructure', 'decision', active('infrastructure') ? C.muted : dim),
    e('wor-dec', 'workforce',      'decision', active('workforce')      ? C.muted : dim),
    e('his-dec', 'historical',     'decision', active('historical')     ? C.muted : dim),
    e('fin-dec', 'financial',      'decision', active('financial')      ? '#f59e0b' : dim),
  ]

  /* ── Summary bar ─────────────────────────────────────────────────────*/
  const done = Object.entries(agentStates).filter(([, s]) => !['idle', 'running'].includes(s.status))
  const running = Object.values(agentStates).filter(s => s.status === 'running').length
  const totalTokens = Object.values(agentStates).reduce((acc, s) => acc + (s.tokens?.in ?? 0) + (s.tokens?.out ?? 0), 0)
  const totalMs     = Object.values(agentStates).reduce((acc, s) => acc + (s.time_ms ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* Live summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '8px 18px',
        borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: running > 0 ? C.textDim : hasStarted ? '#22c55e' : C.muted,
            animation: running > 0 ? 'pulse 1s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 7, letterSpacing: '0.18em', color: running > 0 ? C.muted : hasStarted ? '#22c55e' : C.muted, fontFamily: FONT, textTransform: 'uppercase' }}>
            {running > 0 ? `${running} AGENT${running > 1 ? 'S' : ''} RUNNING` : hasStarted ? `${done.length} / 6 COMPLETE` : 'AWAITING RUN'}
          </span>
        </div>

        {totalTokens > 0 && (
          <span style={{ fontSize: 7, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
            TOTAL TOKENS <span style={{ color: C.textDim }}>{totalTokens.toLocaleString()}</span>
          </span>
        )}
        {totalMs > 0 && (
          <span style={{ fontSize: 7, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
            ELAPSED <span style={{ color: C.textDim }}>{(totalMs / 1000).toFixed(1)}s</span>
          </span>
        )}
        <span style={{ fontSize: 7, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em', marginLeft: 'auto' }}>
          HOVER OR CLICK A NODE FOR DETAILS
        </span>
      </div>

      {/* ReactFlow canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: 0.5, maxZoom: 1.4 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          style={{ background: C.bg }}
        >
          <Background color={C.border} variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
