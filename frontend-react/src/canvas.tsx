import { useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
} from 'reactflow'
import { AgentNode, DecisionNode, ProfilerNode } from './nodes'
import type { AgentId, AgentState, ResearchItem } from './types'

const nodeTypes = {
  agentNode: AgentNode,
  decisionNode: DecisionNode,
  profilerNode: ProfilerNode,
}

const AGENT_LABELS: Record<AgentId, { label: string; sublabel?: string }> = {
  contract:       { label: 'Contract Risk',   sublabel: 'WARRANTY · PAYMENT' },
  infrastructure: { label: 'Infrastructure',  sublabel: 'SITE · ELECTRICAL' },
  workforce:      { label: 'Workforce',        sublabel: 'STAFFING · TRAINING' },
  historical:     { label: 'Historical',       sublabel: 'PAST PROCUREMENTS' },
  financial:      { label: 'Financial Risk',   sublabel: 'EXPOSURE · DELAY' },
  decision:       { label: 'Decision Board',   sublabel: undefined },
}

/*
  Layout — profiler on far left feeds the 4 agent columns.

  col-0 (x=60):  profiler  (centered vertically ~y=195)
  col-A (x=290): contract, infrastructure, workforce, historical
  col-B (x=510): financial
  col-C (x=740): decision board
*/
type AllId = AgentId | 'profiler'
const POSITIONS: Record<AllId, { x: number; y: number }> = {
  profiler:       { x: 60,  y: 195 },
  contract:       { x: 290, y: 20  },
  infrastructure: { x: 290, y: 135 },
  workforce:      { x: 290, y: 250 },
  historical:     { x: 290, y: 365 },
  financial:      { x: 510, y: 135 },
  decision:       { x: 740, y: 195 },
}

const EDGE_STYLE  = { stroke: '#252525', strokeWidth: 1 }
const PFLO_STYLE  = { stroke: '#1e1e1e', strokeWidth: 1, strokeDasharray: '4 4' }
const MARKER      = { type: MarkerType.ArrowClosed, color: '#333',   width: 8, height: 8 }
const PFLO_MARKER = { type: MarkerType.ArrowClosed, color: '#2a2a2a', width: 7, height: 7 }

const STATIC_EDGES: Edge[] = [
  // Profiler → left-column agents (dashed — pre-run context)
  { id: 'e-pf-contract',   source: 'profiler', target: 'contract',       style: PFLO_STYLE, markerEnd: PFLO_MARKER },
  { id: 'e-pf-infra',      source: 'profiler', target: 'infrastructure', style: PFLO_STYLE, markerEnd: PFLO_MARKER },
  { id: 'e-pf-workforce',  source: 'profiler', target: 'workforce',       style: PFLO_STYLE, markerEnd: PFLO_MARKER },
  { id: 'e-pf-historical', source: 'profiler', target: 'historical',      style: PFLO_STYLE, markerEnd: PFLO_MARKER },
  // Agent → downstream
  { id: 'e-contract-decision',   source: 'contract',       target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-infra-financial',     source: 'infrastructure', target: 'financial', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-financial-decision',  source: 'financial',      target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-workforce-decision',  source: 'workforce',      target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-historical-decision', source: 'historical',     target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
]

/* Merge label metadata + full AgentState into node.data in one shot */
const agentData = (id: AgentId, states: Record<AgentId, AgentState>, extras: object = {}) => ({
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
  onNodeClick?: (nodeId: string) => void
}

export function GraphCanvas({ agentStates, intakeResearch, intakeCategory, onNodeClick }: Props) {
  const hasStarted = Object.values(agentStates).some(s => s.status !== 'idle')

  const nodes: Node[] = useMemo(
    () => [
      /* Profiler — green once any agent has started */
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
      /* 4 left-column agents — hasTarget from profiler, hasSource to next col */
      {
        id: 'contract',
        type: 'agentNode',
        position: POSITIONS.contract,
        data: agentData('contract', agentStates, { hasTarget: true, hasSource: true }),
      },
      {
        id: 'infrastructure',
        type: 'agentNode',
        position: POSITIONS.infrastructure,
        data: agentData('infrastructure', agentStates, { hasTarget: true, hasSource: true }),
      },
      {
        id: 'workforce',
        type: 'agentNode',
        position: POSITIONS.workforce,
        data: agentData('workforce', agentStates, { hasTarget: true, hasSource: true }),
      },
      {
        id: 'historical',
        type: 'agentNode',
        position: POSITIONS.historical,
        data: agentData('historical', agentStates, { hasTarget: true, hasSource: true }),
      },
      /* Financial — target from infra, source to decision */
      {
        id: 'financial',
        type: 'agentNode',
        position: POSITIONS.financial,
        data: agentData('financial', agentStates, { hasTarget: true, hasSource: true }),
      },
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentStates, hasStarted, intakeResearch, intakeCategory],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={STATIC_EDGES}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3, minZoom: 0.45, maxZoom: 1.4 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      onNodeClick={(_, node) => onNodeClick?.(node.id)}
      style={{ background: '#080808' }}
    >
      <Background color="#161616" variant={BackgroundVariant.Dots} gap={28} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
