import { memo, CSSProperties } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeStatus } from './types'

export interface AgentNodeData {
  label: string
  sublabel?: string
  status: NodeStatus
  hasTarget?: boolean
  hasSource?: boolean
}

const HANDLE_STYLE: CSSProperties = {
  width: 6,
  height: 6,
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: '50%',
}

const STATUS: Record<NodeStatus, { border: string; glow: string; dot: string; text: string }> = {
  idle:    { border: '#1e1e1e', glow: 'none',                                              dot: '#2a2a2a', text: '#3a3a3a' },
  running: { border: '#e8e8e8', glow: 'none' /* handled by CSS animation */,              dot: '#e8e8e8', text: '#c0c0c0' },
  green:   { border: '#22c55e', glow: '0 0 14px 3px rgba(34,197,94,0.25)',                dot: '#22c55e', text: '#d0d0d0' },
  amber:   { border: '#f59e0b', glow: '0 0 14px 3px rgba(245,158,11,0.25)',               dot: '#f59e0b', text: '#d0d0d0' },
  red:     { border: '#ef4444', glow: '0 0 14px 3px rgba(239,68,68,0.25)',                dot: '#ef4444', text: '#d0d0d0' },
}

export const AgentNode = memo(({ data }: { data: AgentNodeData }) => {
  const s = STATUS[data.status]
  const isRunning = data.status === 'running'

  return (
    <div
      style={{
        background: '#0d0d0d',
        border: `1px solid ${s.border}`,
        borderRadius: 2,
        padding: '10px 14px',
        minWidth: 164,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: s.glow,
        animation: isRunning ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        userSelect: 'none',
      }}
    >
      {data.hasTarget && (
        <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Status dot */}
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: s.dot,
            flexShrink: 0,
            transition: 'background 0.25s ease',
          }}
        />
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              color: s.text,
              fontWeight: 500,
              transition: 'color 0.25s ease',
              lineHeight: 1,
            }}
          >
            {data.label}
          </div>
          {data.sublabel && (
            <div
              style={{
                fontSize: 8,
                letterSpacing: '0.08em',
                color: '#333',
                marginTop: 3,
                textTransform: 'uppercase',
              }}
            >
              {data.sublabel}
            </div>
          )}
        </div>
      </div>

      {data.hasSource && (
        <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      )}
    </div>
  )
})

AgentNode.displayName = 'AgentNode'

/* ------------------------------------------------------------------ */
/* Decision Board — larger, more prominent node                         */
/* ------------------------------------------------------------------ */

export interface DecisionNodeData {
  status: NodeStatus
  verdict?: string
}

export const DecisionNode = memo(({ data }: { data: DecisionNodeData }) => {
  const s = STATUS[data.status]
  const isRunning = data.status === 'running'

  const verdictColor =
    data.status === 'green' ? '#22c55e'
    : data.status === 'amber' ? '#f59e0b'
    : data.status === 'red' ? '#ef4444'
    : '#3a3a3a'

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: `1px solid ${s.border}`,
        borderRadius: 2,
        padding: '14px 18px',
        minWidth: 180,
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: s.glow,
        animation: isRunning ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />

      <div
        style={{
          fontSize: 8,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#444',
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        DECISION BOARD
      </div>

      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.06em',
          fontWeight: 600,
          color: verdictColor,
          transition: 'color 0.3s ease',
          minHeight: 14,
        }}
      >
        {data.status === 'idle'
          ? '—'
          : data.status === 'running'
          ? 'ANALYZING...'
          : (data.verdict ?? 'COMPLETE')}
      </div>
    </div>
  )
})

DecisionNode.displayName = 'DecisionNode'
