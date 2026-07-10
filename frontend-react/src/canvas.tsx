import { useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
} from 'reactflow'
import { AgentNode, DbNode, DecisionNode, ProfilerNode } from './nodes'
import type { AgentId, AgentState, ResearchItem } from './types'

const nodeTypes = {
  agentNode:    AgentNode,
  decisionNode: DecisionNode,
  profilerNode: ProfilerNode,
  dbNode:       DbNode,
}

const AGENT_LABELS: Record<AgentId, { label: string; sublabel?: string }> = {
  contract:       { label: 'Contract Risk',     sublabel: 'WARRANTY · PAYMENT'    },
  infrastructure: { label: 'Infrastructure',    sublabel: 'SITE · ELECTRICAL'     },
  workforce:      { label: 'Workforce',          sublabel: 'STAFFING · TRAINING'   },
  historical:     { label: 'Historical',         sublabel: 'PAST PROCUREMENTS'     },
  financial:      { label: 'Financial Risk',     sublabel: 'EXPOSURE · DELAY COST' },
  decision:       { label: 'Decision Board',     sublabel: undefined               },
}

/*
  Layout (wider spacing, room for DB layer below)

  col-0  x=60   : profiler
  col-A  x=310  : contract, infrastructure, workforce, historical
  col-B  x=560  : financial
  col-C  x=810  : decision board

  DB row y=490  : pgvector (x=310), decision_history (x=560)
*/
type AllId = AgentId | 'profiler' | 'db_pgvector' | 'db_history'

const POSITIONS: Record<AllId, { x: number; y: number }> = {
  profiler:        { x: 60,  y: 210 },
  contract:        { x: 310, y: 30  },
  infrastructure:  { x: 310, y: 155 },
  workforce:       { x: 310, y: 280 },
  historical:      { x: 310, y: 405 },
  financial:       { x: 560, y: 155 },
  decision:        { x: 810, y: 210 },
  db_pgvector:     { x: 310, y: 510 },
  db_history:      { x: 560, y: 510 },
}

const MK_EDGE  = { type: MarkerType.ArrowClosed, color: '#2a2a2a',  width: 8, height: 8 }
const MK_PFLO  = { type: MarkerType.ArrowClosed, color: '#222222',  width: 7, height: 7 }
const MK_DB    = { type: MarkerType.ArrowClosed, color: '#3a1a6a',  width: 7, height: 7 }
const MK_DB_ON = { type: MarkerType.ArrowClosed, color: '#7c3aed88', width: 7, height: 7 }

const EDGE_STYLE  = { stroke: '#252525', strokeWidth: 1 }
const PFLO_STYLE  = { stroke: '#1e1e1e', strokeWidth: 1, strokeDasharray: '4 4' }
const DB_STYLE    = { stroke: '#2a1a4a', strokeWidth: 1, strokeDasharray: '4 3' }
const DB_ON_STYLE = { stroke: '#7c3aed66', strokeWidth: 1, strokeDasharray: '4 3' }

/* Agent → final status colour for edges when done */
function edgeColor(state: AgentState): string {
  if (state.status === 'green') return '#22c55e44'
  if (state.status === 'amber') return '#f59e0b44'
  if (state.status === 'red')   return '#ef444444'
  if (state.status === 'running') return '#e8e8e844'
  return '#252525'
}

/* Agent data helper */
const agentData = (
  id: AgentId,
  states: Record<AgentId, AgentState>,
  extras: object = {},
) => ({
  ...AGENT_LABELS[id],
  status:   states[id].status,
  verdict:  states[id].verdict,
  summary:  states[id].summary,
  tokens:   states[id].tokens,
  time_ms:  states[id].time_ms,
  model:    states[id].model,
  research: states[id].research,
  ...extras,
})

interface Props {
  agentStates: Record<AgentId, AgentState>
  intakeResearch?: ResearchItem[]
  intakeCategory?: string
  dbRowCount?: number
}

export function GraphCanvas({
  agentStates,
  intakeResearch,
  intakeCategory,
  dbRowCount = 0,
}: Props) {
  const hasStarted = Object.values(agentStates).some(s => s.status !== 'idle')

  /* Which agents actively query which DB — used for live edge highlight */
  const contractRunning   = agentStates.contract.status       === 'running'
  const infraRunning      = agentStates.infrastructure.status === 'running'
  const historicalRunning = agentStates.historical.status     === 'running'
  const financialRunning  = agentStates.financial.status      === 'running'
  const decisionRunning   = agentStates.decision.status       === 'running'

  // pgvector is queried by: contract, infrastructure, historical, financial
  const pgvectorActive = contractRunning || infraRunning || historicalRunning || financialRunning
  // decision_history is queried by: historical, decision board
  const historyActive  = historicalRunning || decisionRunning

  const nodes: Node[] = useMemo(
    () => [
      /* Profiler */
      {
        id: 'profiler',
        type: 'profilerNode',
        position: POSITIONS.profiler,
        data: {
          status: hasStarted ? 'green' : 'idle',
          researchCount: intakeResearch?.length ?? 0,
          category: intakeCategory ?? '',
        },
      },

      /* 4 parallel agents */
      { id: 'contract',       type: 'agentNode', position: POSITIONS.contract,       data: agentData('contract',       agentStates, { hasTarget: true, hasSource: true }) },
      { id: 'infrastructure', type: 'agentNode', position: POSITIONS.infrastructure, data: agentData('infrastructure', agentStates, { hasTarget: true, hasSource: true }) },
      { id: 'workforce',      type: 'agentNode', position: POSITIONS.workforce,      data: agentData('workforce',      agentStates, { hasTarget: true, hasSource: true }) },
      { id: 'historical',     type: 'agentNode', position: POSITIONS.historical,     data: agentData('historical',     agentStates, { hasTarget: true, hasSource: true }) },

      /* Financial (sequential) */
      { id: 'financial', type: 'agentNode', position: POSITIONS.financial, data: agentData('financial', agentStates, { hasTarget: true, hasSource: true }) },

      /* Decision board */
      {
        id: 'decision',
        type: 'decisionNode',
        position: POSITIONS.decision,
        data: {
          status:  agentStates.decision.status,
          verdict: agentStates.decision.verdict,
          summary: agentStates.decision.summary,
          tokens:  agentStates.decision.tokens,
          time_ms: agentStates.decision.time_ms,
          model:   agentStates.decision.model,
        },
      },

      /* DB nodes */
      {
        id: 'db_pgvector',
        type: 'dbNode',
        position: POSITIONS.db_pgvector,
        data: {
          label:    'Agent Memory (pgvector)',
          sublabel: 'okf_memory · agent_memory_chunks',
          active:   pgvectorActive,
          rowCount: dbRowCount,
        },
      },
      {
        id: 'db_history',
        type: 'dbNode',
        position: POSITIONS.db_history,
        data: {
          label:    'Decision History',
          sublabel: 'decision_history · decision_history_chunks',
          active:   historyActive,
          rowCount: 0,
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentStates, hasStarted, intakeResearch, intakeCategory, pgvectorActive, historyActive, dbRowCount],
  )

  const edges: Edge[] = useMemo(() => {
    const st = agentStates

    return [
      /* Profiler → agents (dashed context lines) */
      { id: 'e-pf-contract',   source: 'profiler', target: 'contract',       style: PFLO_STYLE,  markerEnd: MK_PFLO, animated: false },
      { id: 'e-pf-infra',      source: 'profiler', target: 'infrastructure', style: PFLO_STYLE,  markerEnd: MK_PFLO, animated: false },
      { id: 'e-pf-workforce',  source: 'profiler', target: 'workforce',      style: PFLO_STYLE,  markerEnd: MK_PFLO, animated: false },
      { id: 'e-pf-historical', source: 'profiler', target: 'historical',     style: PFLO_STYLE,  markerEnd: MK_PFLO, animated: false },

      /* Infra → Financial */
      {
        id: 'e-infra-fin', source: 'infrastructure', target: 'financial',
        style: { ...EDGE_STYLE, stroke: edgeColor(st.infrastructure) },
        markerEnd: { ...MK_EDGE, color: edgeColor(st.infrastructure) },
        label: 'delay est.', labelStyle: { fontSize: 6, fill: '#252525', fontFamily: "'JetBrains Mono', monospace" },
        animated: false,
      },

      /* Agents → Decision Board */
      { id: 'e-con-dec', source: 'contract',       target: 'decision', style: { ...EDGE_STYLE, stroke: edgeColor(st.contract)       }, markerEnd: { ...MK_EDGE, color: edgeColor(st.contract)       }, animated: false },
      { id: 'e-inf-dec', source: 'infrastructure', target: 'decision', style: { ...EDGE_STYLE, stroke: edgeColor(st.infrastructure)  }, markerEnd: { ...MK_EDGE, color: edgeColor(st.infrastructure)  }, animated: false },
      { id: 'e-wor-dec', source: 'workforce',      target: 'decision', style: { ...EDGE_STYLE, stroke: edgeColor(st.workforce)       }, markerEnd: { ...MK_EDGE, color: edgeColor(st.workforce)       }, animated: false },
      { id: 'e-his-dec', source: 'historical',     target: 'decision', style: { ...EDGE_STYLE, stroke: edgeColor(st.historical)      }, markerEnd: { ...MK_EDGE, color: edgeColor(st.historical)      }, animated: false },
      { id: 'e-fin-dec', source: 'financial',      target: 'decision', style: { ...EDGE_STYLE, stroke: edgeColor(st.financial)       }, markerEnd: { ...MK_EDGE, color: edgeColor(st.financial)       }, animated: false },

      /* DB → agents (dashed, purple, pulse when active) */
      { id: 'e-db-pg-con', source: 'db_pgvector', target: 'contract',       style: pgvectorActive ? DB_ON_STYLE : DB_STYLE, markerEnd: pgvectorActive ? MK_DB_ON : MK_DB, animated: pgvectorActive },
      { id: 'e-db-pg-inf', source: 'db_pgvector', target: 'infrastructure', style: pgvectorActive ? DB_ON_STYLE : DB_STYLE, markerEnd: pgvectorActive ? MK_DB_ON : MK_DB, animated: pgvectorActive },
      { id: 'e-db-pg-his', source: 'db_pgvector', target: 'historical',     style: pgvectorActive ? DB_ON_STYLE : DB_STYLE, markerEnd: pgvectorActive ? MK_DB_ON : MK_DB, animated: pgvectorActive },
      { id: 'e-db-his-hi', source: 'db_history',  target: 'historical',     style: historyActive  ? DB_ON_STYLE : DB_STYLE, markerEnd: historyActive  ? MK_DB_ON : MK_DB, animated: historyActive  },
      { id: 'e-db-his-dc', source: 'db_history',  target: 'decision',       style: historyActive  ? DB_ON_STYLE : DB_STYLE, markerEnd: historyActive  ? MK_DB_ON : MK_DB, animated: historyActive  },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStates, pgvectorActive, historyActive])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12, minZoom: 0.38, maxZoom: 1.4 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      onNodeClick={(_, node) => void node}
      style={{ background: '#080808' }}
    >
      <Background color="#141414" variant={BackgroundVariant.Dots} gap={28} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
