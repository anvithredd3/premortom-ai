import { useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  Node,
} from 'reactflow'
import { AgentNode, DecisionNode } from './nodes'
import type { AgentId, AgentState } from './types'

const nodeTypes = {
  agentNode: AgentNode,
  decisionNode: DecisionNode,
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
  Layout (x, y = top-left corner of node, node width ~164px):

  col-A (x=60):  contract, infrastructure, workforce, historical
  col-B (x=340): financial  (depends on infra)
  col-C (x=620): decision board
*/
const POSITIONS: Record<AgentId, { x: number; y: number }> = {
  contract:       { x: 60,  y: 20  },
  infrastructure: { x: 60,  y: 130 },
  workforce:      { x: 60,  y: 240 },
  historical:     { x: 60,  y: 350 },
  financial:      { x: 340, y: 130 },
  decision:       { x: 620, y: 185 },
}

const EDGE_STYLE = { stroke: '#252525', strokeWidth: 1 }
const MARKER = { type: MarkerType.ArrowClosed, color: '#333', width: 8, height: 8 }

const STATIC_EDGES: Edge[] = [
  { id: 'e-contract-decision',  source: 'contract',       target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-infra-financial',    source: 'infrastructure', target: 'financial', style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-financial-decision', source: 'financial',      target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-workforce-decision', source: 'workforce',      target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
  { id: 'e-historical-decision',source: 'historical',     target: 'decision',  style: EDGE_STYLE, markerEnd: MARKER },
]

interface Props {
  agentStates: Record<AgentId, AgentState>
}

export function GraphCanvas({ agentStates }: Props) {
  const nodes: Node[] = useMemo(
    () => [
      {
        id: 'contract',
        type: 'agentNode',
        position: POSITIONS.contract,
        data: {
          ...AGENT_LABELS.contract,
          status: agentStates.contract.status,
          hasSource: true,
        },
      },
      {
        id: 'infrastructure',
        type: 'agentNode',
        position: POSITIONS.infrastructure,
        data: {
          ...AGENT_LABELS.infrastructure,
          status: agentStates.infrastructure.status,
          hasSource: true,
        },
      },
      {
        id: 'workforce',
        type: 'agentNode',
        position: POSITIONS.workforce,
        data: {
          ...AGENT_LABELS.workforce,
          status: agentStates.workforce.status,
          hasSource: true,
        },
      },
      {
        id: 'historical',
        type: 'agentNode',
        position: POSITIONS.historical,
        data: {
          ...AGENT_LABELS.historical,
          status: agentStates.historical.status,
          hasSource: true,
        },
      },
      {
        id: 'financial',
        type: 'agentNode',
        position: POSITIONS.financial,
        data: {
          ...AGENT_LABELS.financial,
          status: agentStates.financial.status,
          hasTarget: true,
          hasSource: true,
        },
      },
      {
        id: 'decision',
        type: 'decisionNode',
        position: POSITIONS.decision,
        data: {
          status: agentStates.decision.status,
          verdict: agentStates.decision.verdict,
        },
      },
    ],
    [agentStates],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={STATIC_EDGES}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.35, minZoom: 0.6, maxZoom: 1.4 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      style={{ background: '#080808' }}
    >
      <Background
        color="#161616"
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
