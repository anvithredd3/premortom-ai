import { memo, CSSProperties, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position } from 'reactflow'
import type { NodeStatus, ResearchItem } from './types'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

/* ── Status tokens (border/glow — theme-neutral semantic colours) ──── */
const S: Record<NodeStatus, { border: string; glow: string }> = {
  idle:    { border: '#1e1e1e', glow: 'none',                                },
  running: { border: '#e8e8e8', glow: '0 0 14px 4px rgba(232,232,232,0.20)' },
  green:   { border: '#22c55e', glow: '0 0 14px 3px rgba(34,197,94,0.28)'   },
  amber:   { border: '#f59e0b', glow: '0 0 14px 3px rgba(245,158,11,0.28)'  },
  red:     { border: '#ef4444', glow: '0 0 14px 3px rgba(239,68,68,0.28)'   },
}

const statusColor = (s: NodeStatus) =>
  s === 'green' ? '#22c55e' : s === 'amber' ? '#f59e0b' : s === 'red' ? '#ef4444' : '#555'

/* ── Telemetry helpers ──────────────────────────────────────────────── */
function shortModel(m: string | null | undefined): string {
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
  return n > 0 ? `${n.toLocaleString()} tok` : '—'
}

function fmtSec(ms?: number): string {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '—'
}

/* ── Popover (rendered into document.body via portal) ───────────────── */
interface PopoverProps {
  anchorEl: HTMLElement
  status: NodeStatus
  label: string
  verdict?: string
  summary?: string
  research?: ResearchItem[]
  popRef: React.RefObject<HTMLDivElement>
}

function Popover({ anchorEl, status, label, verdict, summary, research = [], popRef }: PopoverProps) {
  const { theme: C, mode } = useTheme()
  const rect = anchorEl.getBoundingClientRect()
  const left = Math.min(rect.left, window.innerWidth - 316)
  const top  = rect.bottom + 10
  const vCol = statusColor(status)

  return createPortal(
    <div
      ref={popRef}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top, left, zIndex: 9999,
        width: 300, maxHeight: 360, overflowY: 'auto',
        background: C.surface, border: `1px solid ${C.border}`,
        borderTop: `2px solid ${vCol}`, borderRadius: 2,
        padding: '12px 14px', fontFamily: FONT,
        boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.7)' : '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.18em', color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>

      {verdict && (
        <div style={{ fontSize: 14, color: vCol, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
          {verdict}
        </div>
      )}

      {summary && (
        <>
          <div style={{ fontSize: 11, letterSpacing: '0.15em', color: C.muted, textTransform: 'uppercase', marginBottom: 5 }}>REASONING</div>
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.65, marginBottom: 12 }}>{summary}</div>
        </>
      )}

      <div style={{ fontSize: 11, letterSpacing: '0.15em', color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>RESEARCH</div>
      {research.length === 0
        ? <div style={{ fontSize: 13, color: C.muted }}>no external sources</div>
        : research.map((r, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {r.url
              ? <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#4a7eaa', textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                  ↗ {r.title || r.url}
                </a>
              : <div style={{ fontSize: 13, color: C.textDim, marginBottom: 2 }}>{r.title}</div>
            }
            {r.snippet && (
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.55 }}>
                {r.snippet.slice(0, 130)}{r.snippet.length > 130 ? '…' : ''}
              </div>
            )}
          </div>
        ))
      }
    </div>,
    document.body,
  )
}

/* ── AgentNode ──────────────────────────────────────────────────────── */
export interface AgentNodeData {
  label: string
  sublabel?: string
  status: NodeStatus
  hasTarget?: boolean
  hasSource?: boolean
  verdict?: string
  summary?: string
  tokens?: { in: number | null; out: number | null }
  time_ms?: number
  model?: string | null
  research?: ResearchItem[]
}

export const AgentNode = memo(({ data }: { data: AgentNodeData }) => {
  const { theme: C } = useTheme()
  const st      = S[data.status]
  const isRun   = data.status === 'running'
  const isDone  = data.status === 'green' || data.status === 'amber' || data.status === 'red'
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef  = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const HANDLE: CSSProperties = {
    width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%',
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) &&
          !popRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => { if (!isDone) setOpen(false) }, [isDone])

  const hasTelemetry = isDone && (data.model || data.time_ms != null)
  const labelColor = data.status === 'idle' ? C.muted : C.text
  const dotColor   = data.status === 'idle' ? C.border : st.border

  return (
    <div
      ref={wrapRef}
      onClick={() => isDone && setOpen(o => !o)}
      style={{
        background: C.surface, border: `1px solid ${st.border}`, borderRadius: 2,
        padding: '10px 14px', minWidth: 168, fontFamily: FONT,
        boxShadow: open ? `${st.glow}, 0 0 0 1px ${st.border}40` : st.glow,
        animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        userSelect: 'none', cursor: isDone ? 'pointer' : 'default',
      }}
    >
      {data.hasTarget && <Handle type="target" position={Position.Left} style={HANDLE} />}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0, transition: 'background 0.25s' }} />
        <div>
          <div style={{ fontSize: 13, letterSpacing: '0.13em', textTransform: 'uppercase', color: labelColor, fontWeight: 500, lineHeight: 1, transition: 'color 0.25s' }}>
            {data.label}
          </div>
          {data.sublabel && (
            <div style={{ fontSize: 11, letterSpacing: '0.07em', color: C.textDim, marginTop: 3, textTransform: 'uppercase' }}>
              {data.sublabel}
            </div>
          )}
        </div>
        {isDone && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, letterSpacing: '0.06em' }}>▾</div>
        )}
      </div>

      {/* Telemetry footer */}
      {hasTelemetry && (
        <div style={{
          marginTop: 8, paddingTop: 7, borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: C.textDim, letterSpacing: '0.05em',
          display: 'flex', gap: 5, alignItems: 'center',
        }}>
          <span>{shortModel(data.model)}</span>
          <span style={{ color: C.border }}>·</span>
          <span>{fmtTok(data.tokens)}</span>
          <span style={{ color: C.border }}>·</span>
          <span>{fmtSec(data.time_ms)}</span>
        </div>
      )}

      {data.hasSource && <Handle type="source" position={Position.Right} style={HANDLE} />}

      {open && wrapRef.current && (
        <Popover
          anchorEl={wrapRef.current}
          status={data.status}
          label={data.label}
          verdict={data.verdict}
          summary={data.summary}
          research={data.research}
          popRef={popRef}
        />
      )}
    </div>
  )
})
AgentNode.displayName = 'AgentNode'

/* ── DecisionNode ───────────────────────────────────────────────────── */
export interface DecisionNodeData {
  status: NodeStatus
  verdict?: string
  summary?: string
  tokens?: { in: number | null; out: number | null }
  time_ms?: number
  model?: string | null
}

export const DecisionNode = memo(({ data }: { data: DecisionNodeData }) => {
  const { theme: C } = useTheme()
  const st      = S[data.status]
  const isRun   = data.status === 'running'
  const isDone  = data.status === 'green' || data.status === 'amber' || data.status === 'red'
  const vCol    = statusColor(data.status)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef  = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const HANDLE: CSSProperties = {
    width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%',
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) &&
          !popRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => { if (!isDone) setOpen(false) }, [isDone])

  return (
    <div
      ref={wrapRef}
      onClick={() => isDone && setOpen(o => !o)}
      style={{
        background: C.surface, border: `1px solid ${st.border}`, borderRadius: 2,
        padding: '14px 18px', minWidth: 190, fontFamily: FONT,
        boxShadow: st.glow,
        animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        userSelect: 'none', cursor: isDone ? 'pointer' : 'default',
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE} />

      <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted, fontWeight: 700, marginBottom: 6 }}>
        DECISION BOARD
      </div>
      <div style={{ fontSize: 14, letterSpacing: '0.06em', fontWeight: 600, color: isDone ? vCol : C.textDim, transition: 'color 0.3s', minHeight: 14 }}>
        {data.status === 'idle' ? '—' : data.status === 'running' ? 'ANALYZING...' : (data.verdict ?? 'COMPLETE')}
      </div>

      {isDone && (data.model || data.time_ms != null) && (
        <div style={{
          marginTop: 8, paddingTop: 7, borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: C.textDim, letterSpacing: '0.05em',
          display: 'flex', gap: 5, alignItems: 'center',
        }}>
          <span>{shortModel(data.model)}</span>
          <span style={{ color: C.border }}>·</span>
          <span>{fmtTok(data.tokens)}</span>
          <span style={{ color: C.border }}>·</span>
          <span>{fmtSec(data.time_ms)}</span>
          {isDone && <span style={{ marginLeft: 'auto', color: C.muted }}>▾</span>}
        </div>
      )}

      {open && wrapRef.current && (
        <Popover
          anchorEl={wrapRef.current}
          status={data.status}
          label="Decision Board"
          verdict={data.verdict}
          summary={data.summary}
          research={[]}
          popRef={popRef}
        />
      )}
    </div>
  )
})
DecisionNode.displayName = 'DecisionNode'

/* ── ProfilerNode ───────────────────────────────────────────────────── */
export interface ProfilerNodeData {
  status: 'idle' | 'green'
  researchCount?: number
  category?: string
}

export const ProfilerNode = memo(({ data }: { data: ProfilerNodeData }) => {
  const { theme: C } = useTheme()
  const st = data.status === 'green' ? S.green : S.idle

  const HANDLE: CSSProperties = {
    width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%',
  }

  const dotColor   = data.status === 'green' ? st.border : C.border
  const labelColor = data.status === 'green' ? C.text    : C.muted

  return (
    <div style={{
      background: C.surface, border: `1px solid ${st.border}`, borderRadius: 2,
      padding: '10px 14px', minWidth: 148, fontFamily: FONT,
      boxShadow: data.status === 'green' ? st.glow : 'none',
      transition: 'border-color 0.25s, box-shadow 0.25s',
      userSelect: 'none',
    }}>
      <Handle type="source" position={Position.Right} style={HANDLE} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0, transition: 'background 0.25s' }} />
        <div>
          <div style={{ fontSize: 13, letterSpacing: '0.13em', textTransform: 'uppercase', color: labelColor, fontWeight: 500, lineHeight: 1 }}>
            PROFILER
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.07em', color: C.textDim, marginTop: 3, textTransform: 'uppercase' }}>
            INTAKE · RESEARCH
          </div>
        </div>
      </div>

      {data.status === 'green' && (
        <div style={{
          marginTop: 8, paddingTop: 7, borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: C.textDim, letterSpacing: '0.05em',
        }}>
          {data.category ? `${data.category}` : 'complete'}
          {data.researchCount ? ` · ${data.researchCount} src` : ''}
        </div>
      )}
    </div>
  )
})
ProfilerNode.displayName = 'ProfilerNode'

/* ── DbNode ─────────────────────────────────────────────────────────── */
export interface DbNodeData {
  label: string
  sublabel: string
  active: boolean
  rowCount?: number
}

export const DbNode = memo(({ data }: { data: DbNodeData }) => {
  const { theme: C, mode } = useTheme()
  const purple    = '#7c3aed'
  const dimPurple = mode === 'dark' ? '#2a1a4a' : C.muted

  const HANDLE: CSSProperties = {
    width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%',
  }

  return (
    <div style={{
      background: mode === 'dark' ? '#0a0814' : '#f5f0ff',
      border: `1px solid ${data.active ? purple + '66' : C.border}`,
      borderRadius: 2, padding: '9px 13px', minWidth: 160, fontFamily: FONT,
      boxShadow: data.active ? `0 0 12px 3px rgba(124,58,237,0.22)` : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      userSelect: 'none',
    }}>
      <Handle type="target" position={Position.Top}    style={HANDLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: data.active ? purple : dimPurple,
          animation: data.active ? 'pulse 1.2s ease-in-out infinite' : 'none',
          transition: 'background 0.3s',
        }} />
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: data.active ? purple : dimPurple, textTransform: 'uppercase', fontWeight: 700 }}>
          DATABASE
        </div>
        {data.rowCount != null && data.rowCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: data.active ? purple : C.muted, letterSpacing: '0.06em' }}>
            {data.rowCount} rows
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: data.active ? '#9a70d0' : C.textDim, fontWeight: 600, lineHeight: 1.3, marginBottom: 3, transition: 'color 0.3s' }}>
        {data.label}
      </div>
      <div style={{ fontSize: 10, color: data.active ? purple + 'aa' : C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
        {data.sublabel}
      </div>
    </div>
  )
})
DbNode.displayName = 'DbNode'
