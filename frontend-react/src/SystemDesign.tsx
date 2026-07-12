import { memo, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  Position,
} from 'reactflow'
import type { AgentId, AgentState } from './types'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

/* ── Status palette ──────────────────────────────────────────────────── */
type St = 'idle' | 'running' | 'green' | 'amber' | 'red'
const S: Record<St, { border: string; glow: string; dot: string }> = {
  idle:    { border: '#1e1e1e', glow: 'none',                              dot: '#2a2a2a' },
  running: { border: '#c8c8c8', glow: 'none',                              dot: '#c8c8c8' },
  green:   { border: '#22c55e', glow: '0 0 12px 3px rgba(34,197,94,.20)', dot: '#22c55e' },
  amber:   { border: '#f59e0b', glow: '0 0 12px 3px rgba(245,158,11,.20)',dot: '#f59e0b' },
  red:     { border: '#ef4444', glow: '0 0 12px 3px rgba(239,68,68,.20)', dot: '#ef4444' },
}
const stOf = (as?: AgentState): St =>
  !as ? 'idle' : (as.status as St)

/* ═══════════════════════════════════════════════════════════════════════
   NODE TYPES
═══════════════════════════════════════════════════════════════════════ */

/* ── Section label ───────────────────────────────────────────────────── */
const LabelNode = memo(({ data }: { data: { text: string; sub?: string } }) => {
  const { theme: C } = useTheme()
  return (
    <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.24em', color: C.muted, fontFamily: FONT, textTransform: 'uppercase', fontWeight: 700 }}>
        {data.text}
      </div>
      {data.sub && (
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: C.textDim, fontFamily: FONT, marginTop: 3 }}>
          {data.sub}
        </div>
      )}
    </div>
  )
})
LabelNode.displayName = 'LabelNode'

/* ── Input node ──────────────────────────────────────────────────────── */
interface InputData { title: string; desc: string; sub: string; hasRun: boolean }
const InputNode = memo(({ data }: { data: InputData }) => {
  const { theme: C } = useTheme()
  const active = data.hasRun
  const H = { width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
  return (
    <div style={{
      background: C.surface, border: `1px solid ${active ? '#22d3ee55' : C.border}`,
      borderLeft: `3px solid ${active ? '#22d3ee' : C.borderMid}`,
      borderRadius: 3, padding: '14px 16px', width: 180, fontFamily: FONT,
      boxShadow: active ? '0 0 14px 2px rgba(34,211,238,.12)' : 'none',
      transition: 'border-color .3s, box-shadow .3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#22d3ee' : C.border, flexShrink: 0 }} />
        <span style={{ fontSize: 13, letterSpacing: '0.14em', color: active ? '#22d3ee' : C.textDim, textTransform: 'uppercase', fontWeight: 700 }}>
          INPUT
        </span>
      </div>
      <div style={{ fontSize: 15, color: active ? C.text : C.muted, fontWeight: 600, lineHeight: 1.4, marginBottom: 7 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.65, marginBottom: 9 }}>{data.desc}</div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{data.sub}</div>
      <Handle type="source" position={Position.Right} style={H} />
    </div>
  )
})
InputNode.displayName = 'InputNode'

/* ── Agent node ──────────────────────────────────────────────────────── */
interface AgentData {
  title: string
  desc: string
  sub: string
  accentColor: string
  status: St
  score?: number
  hasTarget?: boolean
  hasSource?: boolean
}
const AgentFlowNode = memo(({ data }: { data: AgentData }) => {
  const { theme: C } = useTheme()
  const H = { width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
  const st = S[data.status]
  const isRun  = data.status === 'running'
  const isDone = ['green', 'amber', 'red'].includes(data.status)
  const active = isDone || isRun

  return (
    <div style={{
      background: C.surface, border: `1px solid ${st.border}`,
      borderLeft: `3px solid ${active ? data.accentColor : C.border}`,
      borderRadius: 3, padding: '12px 14px', width: 190, fontFamily: FONT,
      boxShadow: st.glow,
      animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
      transition: 'border-color .25s, box-shadow .25s',
    }}>
      {data.hasTarget && <Handle type="target" position={Position.Left} style={H} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: active ? data.accentColor : C.border,
          transition: 'background .25s',
        }} />
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: active ? data.accentColor : C.muted, textTransform: 'uppercase', fontWeight: 700, transition: 'color .25s' }}>
          {isRun ? 'RUNNING' : isDone ? 'COMPLETE' : 'WAITING'}
        </span>
        {isDone && data.score != null && (
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: st.dot }}>{data.score}</span>
        )}
      </div>

      <div style={{ fontSize: 15, color: active ? C.text : C.muted, fontWeight: 600, lineHeight: 1.4, marginBottom: 6, transition: 'color .25s' }}>
        {data.title}
      </div>

      <div style={{ fontSize: 11, color: active ? C.textDim : C.muted, lineHeight: 1.65, marginBottom: 8, transition: 'color .25s' }}>
        {data.desc}
      </div>

      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        {data.sub}
      </div>

      {data.hasSource && <Handle type="source" position={Position.Right} style={H} />}
    </div>
  )
})
AgentFlowNode.displayName = 'AgentFlowNode'

/* ── Memory / DB node ────────────────────────────────────────────────── */
interface MemoryData { title: string; desc: string; sub: string; rowCount?: number }
const MemoryNode = memo(({ data }: { data: MemoryData }) => {
  const { theme: C, mode } = useTheme()
  const H = { width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
  const purple = '#7c3aed'
  return (
    <div style={{
      background: mode === 'dark' ? '#0c0814' : '#f5f0ff',
      border: `1px solid ${mode === 'dark' ? '#1e1430' : '#d8c8ff'}`,
      borderLeft: `3px solid ${purple}`,
      borderRadius: 3, padding: '10px 14px', width: 190, fontFamily: FONT,
    }}>
      <Handle type="source" position={Position.Top} style={H} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: purple, flexShrink: 0 }} />
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: purple, textTransform: 'uppercase', fontWeight: 700 }}>
          KNOWLEDGE BASE
        </span>
        {data.rowCount != null && data.rowCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted }}>{data.rowCount} records</span>
        )}
      </div>
      <div style={{ fontSize: 14, color: mode === 'dark' ? '#9a70d0' : '#5a30a0', fontWeight: 600, lineHeight: 1.4, marginBottom: 5 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, marginBottom: 6 }}>{data.desc}</div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>{data.sub}</div>
    </div>
  )
})
MemoryNode.displayName = 'MemoryNode'

/* ── Decision node ───────────────────────────────────────────────────── */
interface DecisionData { status: St; verdict?: string; score?: number }
const DecisionFlowNode = memo(({ data }: { data: DecisionData }) => {
  const { theme: C } = useTheme()
  const H = { width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
  const st = S[data.status]
  const isRun  = data.status === 'running'
  const isDone = ['green', 'amber', 'red'].includes(data.status)
  const active = isDone || isRun

  return (
    <div style={{
      background: C.surface, border: `1px solid ${st.border}`,
      borderLeft: `3px solid ${active ? st.dot : C.border}`,
      borderRadius: 3, padding: '16px 18px', width: 200, fontFamily: FONT,
      boxShadow: st.glow,
      animation: isRun ? 'pulse-glow 1.3s ease-in-out infinite' : 'none',
      transition: 'all .25s',
    }}>
      <Handle type="target" position={Position.Left} style={H} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? st.dot : C.border, flexShrink: 0 }} />
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: active ? st.dot : C.muted, textTransform: 'uppercase', fontWeight: 700 }}>
          DECISION ENGINE
        </span>
      </div>

      <div style={{ fontSize: 17, color: active ? C.text : C.muted, fontWeight: 700, lineHeight: 1.3, marginBottom: 7 }}>
        AI Decision Board
      </div>

      <div style={{ fontSize: 11, color: active ? C.textDim : C.muted, lineHeight: 1.65, marginBottom: 10 }}>
        Weighs all agent findings and issues a GO / GO WITH CONDITIONS / NO-GO recommendation
      </div>

      {isDone && data.verdict && (
        <div style={{
          fontSize: 13, fontWeight: 700, color: st.dot,
          border: `1px solid ${st.dot}33`, borderRadius: 2,
          padding: '4px 10px', display: 'inline-block', letterSpacing: '0.1em',
        }}>
          {data.verdict}
        </div>
      )}

      {isRun && (
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.08em' }}>DELIBERATING...</div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: C.muted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        decision_board.py · Rule-based weighted avg
      </div>

      <Handle type="source" position={Position.Right} style={H} />
    </div>
  )
})
DecisionFlowNode.displayName = 'DecisionFlowNode'

/* ── Output node ─────────────────────────────────────────────────────── */
interface OutputData { title: string; desc: string; sub: string; ready: boolean; accentColor: string }
const OutputNode = memo(({ data }: { data: OutputData }) => {
  const { theme: C } = useTheme()
  const H = { width: 6, height: 6, background: C.border, border: `1px solid ${C.borderMid}`, borderRadius: '50%' }
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${data.ready ? '#22c55e44' : C.border}`,
      borderLeft: `3px solid ${data.ready ? data.accentColor : C.borderMid}`,
      borderRadius: 3, padding: '11px 14px', width: 175, fontFamily: FONT,
      boxShadow: data.ready ? '0 0 12px 2px rgba(34,197,94,.10)' : 'none',
      transition: 'all .3s',
    }}>
      <Handle type="target" position={Position.Left} style={H} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: data.ready ? data.accentColor : C.border, flexShrink: 0 }} />
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: data.ready ? data.accentColor : C.muted, textTransform: 'uppercase', fontWeight: 700 }}>
          OUTPUT
        </span>
      </div>
      <div style={{ fontSize: 14, color: data.ready ? C.text : C.muted, fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>
        {data.title}
      </div>
      <div style={{ fontSize: 11, color: data.ready ? C.textDim : C.muted, lineHeight: 1.65, marginBottom: 6 }}>{data.desc}</div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.09em', textTransform: 'uppercase' }}>{data.sub}</div>
    </div>
  )
})
OutputNode.displayName = 'OutputNode'

/* ── Node types registry ─────────────────────────────────────────────── */
const NODE_TYPES = {
  sdLabel:    LabelNode,
  sdInput:    InputNode,
  sdAgent:    AgentFlowNode,
  sdMemory:   MemoryNode,
  sdDecision: DecisionFlowNode,
  sdOutput:   OutputNode,
}

/* ═══════════════════════════════════════════════════════════════════════
   EDGE HELPERS
═══════════════════════════════════════════════════════════════════════ */
const MK = (color: string) => ({ type: MarkerType.ArrowClosed, color, width: 8, height: 8 })

function edge(
  id: string, source: string, target: string,
  color: string, opts: Partial<Edge> = {},
): Edge {
  return {
    id, source, target,
    style: { stroke: color, strokeWidth: 1.2 },
    markerEnd: MK(color),
    animated: false,
    ...opts,
  }
}

function memEdge(id: string, source: string, target: string): Edge {
  return {
    id, source, target,
    style: { stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 4' },
    markerEnd: MK('#7c3aed'),
    animated: false,
    sourceHandle: null,
    targetHandle: null,
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export interface SystemDesignProps {
  agentStates?: Record<AgentId, AgentState>
  hasRun?: boolean
  dbRowCount?: number
}

export function SystemDesign({ agentStates, hasRun = false, dbRowCount = 0 }: SystemDesignProps) {
  const { theme: C, mode } = useTheme()

  const st = (id: AgentId): St => stOf(agentStates?.[id])
  const score = (id: AgentId) => {
    const s = agentStates?.[id]
    return s && s.status !== 'idle' && s.status !== 'running' ? Math.round(s.risk_score ?? 0) : undefined
  }
  const decSt = st('decision')
  const allDone = agentStates ? Object.values(agentStates).every(s => !['idle', 'running'].includes(s.status)) : false

  const dimEdge = mode === 'dark' ? '#252525' : '#cccccc'

  /* ── Nodes ─────────────────────────────────────────────────────────── */
  const nodes: Node[] = useMemo(() => [

    { id: 'lbl-input',    type: 'sdLabel', position: { x: 20,   y: 8   }, data: { text: 'YOUR INPUT' },            selectable: false },
    { id: 'lbl-analysis', type: 'sdLabel', position: { x: 270,  y: 8   }, data: { text: 'AI ANALYSIS LAYER', sub: 'Runs in parallel · Claude Haiku / GPT-4o' }, selectable: false },
    { id: 'lbl-memory',   type: 'sdLabel', position: { x: 510,  y: 520 }, data: { text: 'KNOWLEDGE BASE', sub: 'pgvector · PostgreSQL' }, selectable: false },
    { id: 'lbl-decision', type: 'sdLabel', position: { x: 770,  y: 8   }, data: { text: 'DECISION ENGINE' },       selectable: false },
    { id: 'lbl-output',   type: 'sdLabel', position: { x: 1040, y: 8   }, data: { text: 'YOUR REPORT' },           selectable: false },

    {
      id: 'input', type: 'sdInput', position: { x: 20, y: 160 },
      data: {
        title: 'Procurement Request',
        desc: 'You describe what you want to buy — item name, contract value, delivery date, vendor terms',
        sub: 'intake.tsx · ProcurementInput schema',
        hasRun,
      },
    },

    {
      id: 'contract', type: 'sdAgent', position: { x: 270, y: 30 },
      data: {
        title: 'Contract Risk Review',
        desc: 'Reads warranty clauses, advance payment exposure, and payment terms for hidden risks',
        sub: 'contract_agent.py · LLM',
        accentColor: '#22d3ee',
        status: st('contract'), score: score('contract'),
        hasTarget: true, hasSource: true,
      },
    },
    {
      id: 'infrastructure', type: 'sdAgent', position: { x: 270, y: 160 },
      data: {
        title: 'Site & Infrastructure',
        desc: 'Checks facility readiness, civil construction progress, electrical and regulatory approvals',
        sub: 'infrastructure_agent.py · LLM → predicts delay months',
        accentColor: '#f97316',
        status: st('infrastructure'), score: score('infrastructure'),
        hasTarget: true, hasSource: true,
      },
    },
    {
      id: 'workforce', type: 'sdAgent', position: { x: 270, y: 290 },
      data: {
        title: 'Team & Workforce',
        desc: 'Checks if trained staff are available for the equipment — operators, technicians, engineers',
        sub: 'workforce_agent.py · LLM',
        accentColor: '#a78bfa',
        status: st('workforce'), score: score('workforce'),
        hasTarget: true, hasSource: true,
      },
    },
    {
      id: 'historical', type: 'sdAgent', position: { x: 270, y: 420 },
      data: {
        title: 'Historical Benchmarking',
        desc: 'Compares this procurement against similar past purchases — delays, failures, success patterns',
        sub: 'historical_agent.py · LLM + pgvector memory',
        accentColor: '#fb923c',
        status: st('historical'), score: score('historical'),
        hasTarget: true, hasSource: true,
      },
    },

    {
      id: 'financial', type: 'sdAgent', position: { x: 520, y: 160 },
      data: {
        title: 'Financial Risk',
        desc: 'Calculates cost of delays — idle assets sitting unused, warranty losses, total exposure in Crores',
        sub: 'financial_agent.py · LLM · depends on site delay estimate',
        accentColor: '#f59e0b',
        status: st('financial'), score: score('financial'),
        hasTarget: true, hasSource: true,
      },
    },

    {
      id: 'mem-policy', type: 'sdMemory', position: { x: 510, y: 540 },
      data: {
        title: 'Procurement Policy Library',
        desc: 'Internal rules, risk patterns, clause benchmarks, and past contract learnings',
        sub: 'agent_memory_chunks · pgvector embeddings',
        rowCount: dbRowCount,
      },
    },
    {
      id: 'mem-history', type: 'sdMemory', position: { x: 770, y: 540 },
      data: {
        title: 'Decision History',
        desc: 'Every GO / NO-GO decision the system has made — used to benchmark new procurements',
        sub: 'decision_history · decision_history_chunks',
        rowCount: 0,
      },
    },

    {
      id: 'decision', type: 'sdDecision', position: { x: 790, y: 195 },
      data: {
        status: decSt,
        verdict: agentStates?.decision?.verdict,
        score: score('decision'),
      },
    },

    {
      id: 'out-scenarios', type: 'sdOutput', position: { x: 1065, y: 80 },
      data: {
        title: 'Scenario Planner',
        desc: 'Best case, expected, and worst case timelines and costs',
        sub: 'scenario_agent.py · deterministic',
        ready: allDone, accentColor: '#22c55e',
      },
    },
    {
      id: 'out-debate', type: 'sdOutput', position: { x: 1065, y: 220 },
      data: {
        title: 'Expert Debate',
        desc: 'Agents challenge each others findings before the final verdict is issued',
        sub: 'debate.py · multi-agent',
        ready: allDone, accentColor: '#22c55e',
      },
    },
    {
      id: 'out-report', type: 'sdOutput', position: { x: 1065, y: 360 },
      data: {
        title: 'Risk Report',
        desc: 'Full PreMortem — GO / NO-GO, evidence, conditions, and executive summary',
        sub: 'PreMortemReport schema · PDF / DOCX export',
        ready: allDone, accentColor: '#22c55e',
      },
    },

  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [agentStates, hasRun, allDone, decSt, dbRowCount, dimEdge])

  /* ── Edges ─────────────────────────────────────────────────────────── */
  const edges: Edge[] = useMemo(() => {
    const cyan   = '#22d3ee'
    const orange = '#f97316'
    const amber  = '#f59e0b'
    const white  = mode === 'dark' ? '#3a3a3a' : '#888888'
    const green  = '#22c55e'

    const inputActive  = hasRun
    const agentActive  = (id: AgentId) => !['idle'].includes(st(id))
    const finActive    = agentActive('financial')
    const decActive    = !['idle'].includes(decSt)

    return [
      edge('e-in-contract',   'input', 'contract',       inputActive ? cyan       : dimEdge),
      edge('e-in-infra',      'input', 'infrastructure', inputActive ? orange     : dimEdge),
      edge('e-in-workforce',  'input', 'workforce',      inputActive ? '#a78bfa'  : dimEdge),
      edge('e-in-historical', 'input', 'historical',     inputActive ? '#fb923c'  : dimEdge),

      edge('e-infra-fin', 'infrastructure', 'financial',
        agentActive('infrastructure') ? amber : dimEdge,
        { label: 'delay est.', labelStyle: { fontSize: 10, fill: C.muted, fontFamily: FONT } }),

      edge('e-contract-dec',   'contract',       'decision', agentActive('contract')       ? white : dimEdge),
      edge('e-infra-dec',      'infrastructure', 'decision', agentActive('infrastructure') ? white : dimEdge),
      edge('e-workforce-dec',  'workforce',      'decision', agentActive('workforce')      ? white : dimEdge),
      edge('e-historical-dec', 'historical',     'decision', agentActive('historical')     ? white : dimEdge),
      edge('e-fin-dec',        'financial',      'decision', finActive                     ? amber : dimEdge),

      memEdge('e-mem-contract',   'mem-policy',  'contract'),
      memEdge('e-mem-infra',      'mem-policy',  'infrastructure'),
      memEdge('e-mem-historical', 'mem-history', 'historical'),

      edge('e-dec-scenarios', 'decision', 'out-scenarios', decActive ? green : dimEdge),
      edge('e-dec-debate',    'decision', 'out-debate',    decActive ? green : dimEdge),
      edge('e-dec-report',    'decision', 'out-report',    decActive ? green : dimEdge),
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStates, hasRun, decSt, dimEdge])

  /* ── Legend ─────────────────────────────────────────────────────────── */
  const legend = [
    { color: '#22d3ee', label: 'Data Input' },
    { color: '#f59e0b', label: 'Sequential Dependency' },
    { color: '#7c3aed', label: 'Knowledge Base Feed' },
    { color: mode === 'dark' ? '#3a3a3a' : '#888888', label: 'Risk Signals → Decision' },
    { color: '#22c55e', label: 'Results Ready' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: FONT }}>

      {/* Header */}
      <div style={{
        padding: '16px 24px 14px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>
            SYSTEM DESIGN
          </div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>
            How PreMortem AI Works
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, maxWidth: 500, borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
          Your procurement request flows through specialised AI agents that review contracts, site readiness,
          team availability, and financial risk — then a decision board weighs everything up and gives you a verdict.
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasRun ? '#22c55e' : C.border, flexShrink: 0 }} />
          <span style={{ fontSize: 10, letterSpacing: '0.16em', color: hasRun ? '#22c55e' : C.muted, textTransform: 'uppercase' }}>
            {hasRun ? 'LIVE RUN' : 'AWAITING RUN'}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.45, maxZoom: 1.5 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          style={{ background: C.bg }}
        >
          <Background color={mode === 'dark' ? '#111' : '#d8d8d8'} variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            nodeColor={(n) => {
              if (n.type === 'sdMemory')   return '#7c3aed'
              if (n.type === 'sdDecision') return C.border
              if (n.type === 'sdOutput')   return mode === 'dark' ? '#1a3a1a' : '#c8eec8'
              if (n.type === 'sdInput')    return mode === 'dark' ? '#1a2a3a' : '#c8dff0'
              return C.surface2
            }}
            maskColor={mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(240,240,240,0.7)'}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div style={{
        padding: '10px 24px', borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase' }}>LEGEND</span>
        {legend.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 1, background: l.color }} />
            <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
          {(['idle', 'running', 'green', 'amber', 'red'] as St[]).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: S[s].dot }} />
              <span style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
