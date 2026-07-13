/**
 * RFQ Intake Chat — role-based conversational requirement capture.
 *
 * Converts the Streamlit RFQ intake chat screen to React.
 * Users switch roles (management / doctor / biomedical_engineer / finance /
 * procurement_officer) and type natural-language messages to add, remove, or
 * adjust requirements. Template matching and regex parsing are done locally;
 * the heavy AI guidance is delegated to the existing RFQ guidance button.
 */
import { useEffect, useRef, useState } from 'react'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

/* ── Role definitions ───────────────────────────────────────────────────── */
export const RFQ_ROLES = {
  management:           { label: 'Management',          avatar: 'MGMT', color: '#334155' },
  doctor:               { label: 'Doctor / Clinician',  avatar: 'DR',   color: '#2563eb' },
  biomedical_engineer:  { label: 'Biomedical Engineer', avatar: 'BIO',  color: '#16a34a' },
  finance:              { label: 'Finance',              avatar: 'FIN',  color: '#d97706' },
  procurement_officer:  { label: 'Procurement Officer', avatar: 'PROC', color: '#7c3aed' },
} as const

export type RoleKey = keyof typeof RFQ_ROLES

/* ── Requirement type ───────────────────────────────────────────────────── */
export interface RfqReq {
  id: string
  role: RoleKey
  entered_by_role: RoleKey
  requirement: string
  priority_rank: number
  perspective_value_pct: number
  estimated_cost_cr: number | null
  cost_confidence: string
  cost_source: string
  notes: string
  status: string
}

/* ── Template requirements per role ─────────────────────────────────────── */
const TEMPLATES: Record<RoleKey, Array<[string, number, number, number | null]>> = {
  management: [
    ['Critical stakeholder needs represented in the RFQ',              1, 25, null],
    ['Core value requirements are costed or cost-source identified',   2, 25, null],
    ['High-priority risks have mitigation or negotiation conditions',  3, 20, null],
    ['RFQ criteria are auditable and comparable',                      4, 15, null],
    ['Optional features do not distract from core outcomes',           5, 15, null],
  ],
  doctor: [
    ['Core imaging capability',                    1, 30, 4.5],
    ['Scan calibration and focus control',         2, 25, 2.0],
    ['Patient throughput and workflow fit',        3, 15, 1.2],
    ['AI-based organ marking',                     4, 20, 1.8],
    ['AI-based disease artifact detection',        5, 10, 1.0],
  ],
  biomedical_engineer: [
    ['Vendor owns installation and commissioning',          1, 30, 1.5],
    ['Service response SLA must be contractually stated',  2, 25, 0.8],
    ['Spare-parts availability commitment',                3, 20, 1.0],
    ['Preventive maintenance schedule included',           4, 15, 0.7],
    ['Training and handover documentation included',       5, 10, 0.4],
  ],
  finance: [
    ['Total cost of ownership must be visible',                          1, 30, null],
    ['Payment milestones tied to commissioning and acceptance',          2, 25, null],
    ['Warranty, AMC, and CMC costs separated clearly',                   3, 20, null],
    ['Consumables and software subscriptions disclosed',                 4, 15, 0.6],
    ['Quoted price benchmarked against acceptable market range',         5, 10, null],
  ],
  procurement_officer: [
    ['Mandatory and negotiable criteria clearly separated',              1, 25, null],
    ['Warranty trigger tied to commissioning or acceptance',             2, 25, null],
    ['Delivery, installation, and acceptance obligations measurable',    3, 20, null],
    ['Vendor exceptions and exclusions must be disclosed',               4, 15, null],
    ['Comparable quote format required across vendors',                  5, 15, null],
  ],
}

/* ── Role greetings ──────────────────────────────────────────────────────── */
const GREETINGS: Record<RoleKey, string> = {
  management:          'Decision cockpit ready. I will consolidate each role\'s value priorities into a publishable RFQ map.',
  doctor:              'Scalpel-sharp RFQ mode on. I will capture clinical must-haves before shiny extras steal the spotlight.',
  biomedical_engineer: 'Commissioning lens on. I will pin down installation, uptime, spares, service, and handover requirements.',
  finance:             'Spreadsheet radar online. I will surface lifecycle cost, payment exposure, and unknown recurring spend.',
  procurement_officer: 'Clause compass ready. I will turn fuzzy wants into comparable, enforceable RFQ criteria.',
}

/* ── Chat message type ───────────────────────────────────────────────────── */
interface ChatMsg {
  kind: 'user' | 'assistant'
  role: RoleKey
  message: string
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function extractPercent(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%/)
  if (m) return parseFloat(m[1])
  const m2 = text.match(/value[^\d]{0,10}(\d+(?:\.\d+)?)/)
  if (m2) return parseFloat(m2[1])
  return null
}

function extractCostCr(text: string): number | null {
  const m = text.match(/(?:cost|budget|₹|rs\.?)[^\d]{0,16}(\d+(?:\.\d+)?)\s*(?:cr|crore)?/i)
  if (m) return parseFloat(m[1])
  const m2 = text.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/i)
  if (m2) return parseFloat(m2[1])
  return null
}

function extractPriorityNum(text: string): number | null {
  const m = text.match(/priority[^\d]{0,10}(\d+)/i)
  if (m) return parseInt(m[1], 10)
  const m2 = text.match(/rank[^\d]{0,10}(\d+)/i)
  if (m2) return parseInt(m2[1], 10)
  return null
}

function extractBudgetCr(text: string): number | null {
  const m = text.match(/(?:overall|rfq|total)\s+budget[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:cr|crore)?/i)
  if (m) return parseFloat(m[1])
  const m2 = text.match(/(?:set|change|update|increase|reduce)\s+(?:the\s+)?(?:overall\s+|rfq\s+|total\s+)?budget[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:cr|crore)?/i)
  if (m2) return parseFloat(m2[1])
  return null
}

function hasUnknownCost(text: string): boolean {
  return /unknown cost|cost unknown|cost is unknown|cost not known/i.test(text)
}

const ROLE_SWITCH_WORDS = ['switch', 'change', 'i am', "i'm", 'as ']
const ROLE_ALIASES: Record<string, RoleKey> = {
  management: 'management', manager: 'management', executive: 'management',
  doctor: 'doctor', clinical: 'doctor', radiologist: 'doctor',
  biomedical: 'biomedical_engineer', engineer: 'biomedical_engineer', service: 'biomedical_engineer',
  finance: 'finance', financial: 'finance', cost: 'finance',
  procurement: 'procurement_officer', buyer: 'procurement_officer', contract: 'procurement_officer',
}

function detectRoleSwitch(text: string): RoleKey | null {
  const lower = text.toLowerCase()
  if (!ROLE_SWITCH_WORDS.some(w => lower.includes(w))) return null
  for (const [alias, role] of Object.entries(ROLE_ALIASES)) {
    if (lower.includes(alias)) return role
  }
  return null
}

function isGreeting(text: string): boolean {
  const norm = text.toLowerCase().replace(/[^a-z\s]/g, '').trim()
  const gs = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening']
  return gs.some(g => norm === g || norm.startsWith(g + ' '))
}

function isRemoveCommand(text: string): boolean {
  return /^(remove|delete)\s/i.test(text.trim())
}

function nextPriorityForRole(reqs: RfqReq[], role: RoleKey): number {
  const ranks = reqs.filter(r => r.role === role).map(r => r.priority_rank)
  return ranks.length ? Math.max(...ranks) + 1 : 1
}

function normalizeReqText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => !['the','and','or','must','be','is','are','with','for','to'].includes(w))
    .join(' ')
}

function matchTemplate(text: string, role: RoleKey): { req: Omit<RfqReq, 'id'>; matched: boolean } | null {
  const lower = text.toLowerCase()
  let best: { role: RoleKey; label: string; priority: number; value: number; cost: number | null } | null = null
  let bestHits = 0
  for (const [tRole, templates] of Object.entries(TEMPLATES)) {
    for (const [label, priority, value, cost] of templates) {
      const hits = label.toLowerCase().split(/\s+/).filter(w => w.length > 3 && lower.includes(w)).length
      if (hits > bestHits) {
        bestHits = hits
        best = { role: tRole as RoleKey, label, priority, value, cost }
      }
    }
  }
  if (best && bestHits >= 2) {
    return {
      matched: true,
      req: {
        role: best.role,
        entered_by_role: role,
        requirement: best.label,
        priority_rank: extractPriorityNum(lower) ?? best.priority,
        perspective_value_pct: extractPercent(lower) ?? best.value,
        estimated_cost_cr: hasUnknownCost(lower) ? null : (extractCostCr(lower) ?? best.cost),
        cost_confidence: 'unknown',
        cost_source: `${best.role} template`,
        notes: 'Matched from template.',
        status: 'accepted',
      },
    }
  }
  return null
}

function buildCustomReq(text: string, role: RoleKey, reqs: RfqReq[]): Omit<RfqReq, 'id'> {
  const lower = text.toLowerCase()
  return {
    role,
    entered_by_role: role,
    requirement: text.trim().replace(/\.$/, ''),
    priority_rank: extractPriorityNum(lower) ?? nextPriorityForRole(reqs, role),
    perspective_value_pct: extractPercent(lower) ?? Math.max(5, 25 - ((nextPriorityForRole(reqs, role) - 1) * 4)),
    estimated_cost_cr: hasUnknownCost(lower) ? null : extractCostCr(lower),
    cost_confidence: 'unknown',
    cost_source: extractCostCr(lower) !== null ? 'free text' : 'unknown',
    notes: 'Added via chat.',
    status: 'accepted',
  }
}

function hasSufficientDetail(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    /priority|rank/i.test(lower) &&
    (/\d+\s*%|value/i.test(lower)) &&
    (/cost|cr|crore/i.test(lower) || hasUnknownCost(lower))
  )
}

function removeMatchingReq(text: string, reqs: RfqReq[]): { reqs: RfqReq[]; removed: string | null } {
  const target = text.replace(/^(remove|delete)\s+/i, '').trim()
  const targetNorm = normalizeReqText(target)
  if (!targetNorm) return { reqs, removed: null }
  const targetWords = new Set(targetNorm.split(/\s+/))
  let bestIdx = -1; let bestScore = 0
  reqs.forEach((req, i) => {
    const rNorm = normalizeReqText(req.requirement)
    const rWords = new Set(rNorm.split(/\s+/))
    let score = [...targetWords].filter(w => rWords.has(w)).length
    if (rNorm.includes(targetNorm) || targetNorm.includes(rNorm)) score += 3
    if (score > bestScore) { bestScore = score; bestIdx = i }
  })
  if (bestIdx === -1 || bestScore === 0) return { reqs, removed: null }
  const removed = reqs[bestIdx].requirement
  return { reqs: reqs.filter((_, i) => i !== bestIdx), removed }
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
function RolePill({ roleKey, active, onClick }: { roleKey: RoleKey; active: boolean; onClick: () => void }) {
  const { theme: C } = useTheme()
  const meta = RFQ_ROLES[roleKey]
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? meta.color + '22' : '#0a0a0a',
        border: `1px solid ${active ? meta.color + '66' : C.border}`,
        borderRadius: 2, padding: '4px 12px', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT,
        color: active ? meta.color : '#444', cursor: 'pointer',
      }}
    >
      {meta.avatar}
    </button>
  )
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const { theme: C } = useTheme()
  const meta = RFQ_ROLES[msg.role]
  const isUser = msg.kind === 'user'
  const color = isUser ? meta.color : '#0f172a'
  const avatar = isUser ? meta.avatar : 'AI'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '88%', border: `1px solid ${C.border}`,
        borderRadius: 2, padding: '7px 10px',
        background: isUser ? C.surface2 : C.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            background: color, color: '#fff', borderRadius: 999,
            padding: '2px 8px', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.1em', fontFamily: FONT,
          }}>
            {avatar}
          </span>
          {isUser && (
            <span style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.08em' }}>
              {meta.label.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, fontFamily: FONT }}>{msg.message}</div>
      </div>
    </div>
  )
}

export function ReqRow({
  req, onRemove, onUpdate,
}: {
  req: RfqReq
  onRemove: () => void
  onUpdate: (patch: Partial<RfqReq>) => void
}) {
  const { theme: C } = useTheme()
  const meta = RFQ_ROLES[req.role]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 22px',
      gap: 6, alignItems: 'center',
      borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 6,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 9, background: meta.color + '22', color: meta.color,
            border: `1px solid ${meta.color}44`, borderRadius: 2,
            padding: '1px 6px', fontFamily: FONT, letterSpacing: '0.1em',
          }}>
            {meta.avatar}
          </span>
          <span style={{ fontSize: 9, color: '#333', fontFamily: FONT }}>P{req.priority_rank}</span>
        </div>
        <input
          value={req.requirement}
          onChange={e => onUpdate({ requirement: e.target.value })}
          style={{
            width: '100%', background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '4px 6px', fontSize: 12,
            color: '#aaa', fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 2 }}>VALUE %</div>
        <input
          type="number" min={0} max={100}
          value={req.perspective_value_pct}
          onChange={e => onUpdate({ perspective_value_pct: parseFloat(e.target.value) || 0 })}
          style={{
            width: '100%', background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '4px 6px', fontSize: 12,
            color: '#aaa', fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 2 }}>RANK</div>
        <input
          type="number" min={1}
          value={req.priority_rank}
          onChange={e => onUpdate({ priority_rank: parseInt(e.target.value, 10) || 1 })}
          style={{
            width: '100%', background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '4px 6px', fontSize: 12,
            color: '#aaa', fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 8, color: '#2a2a2a', fontFamily: FONT, marginBottom: 2 }}>₹ CR</div>
        <input
          type="number" min={0} step="0.1"
          value={req.estimated_cost_cr ?? ''}
          onChange={e => onUpdate({ estimated_cost_cr: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="—"
          style={{
            width: '100%', background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '4px 6px', fontSize: 12,
            color: '#aaa', fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

/* ── Props ───────────────────────────────────────────────────────────────── */
export interface RfqChatProps {
  requirements: RfqReq[]
  budget: string
  onRequirementsChange: (reqs: RfqReq[]) => void
  onBudgetChange: (v: string) => void
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export function RfqChat({ requirements, budget, onRequirementsChange, onBudgetChange }: RfqChatProps) {
  const { theme: C } = useTheme()
  const [role, setRole] = useState<RoleKey>('management')
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { kind: 'assistant', role: 'management', message: GREETINGS.management },
  ])
  const [input, setInput] = useState('')
  const [pendingReq, setPendingReq] = useState<Omit<RfqReq, 'id'> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, pendingReq])

  function nextId() {
    return `REQ-${String(requirements.length + 1).padStart(3, '0')}`
  }

  function addMsg(kind: 'user' | 'assistant', msgRole: RoleKey, message: string) {
    setMsgs(ms => [...ms, { kind, role: msgRole, message }])
  }

  function switchRole(newRole: RoleKey) {
    setRole(newRole)
    setPendingReq(null)
    setMsgs(ms => [...ms, { kind: 'assistant', role: newRole, message: GREETINGS[newRole] }])
  }

  function loadTemplates() {
    const reqs: RfqReq[] = []
    for (const [r, templates] of Object.entries(TEMPLATES)) {
      for (const [label, priority, value, cost] of templates.slice(0, 3)) {
        reqs.push({
          id: `REQ-${String(reqs.length + 1).padStart(3, '0')}`,
          role: r as RoleKey, entered_by_role: r as RoleKey,
          requirement: label, priority_rank: priority,
          perspective_value_pct: value, estimated_cost_cr: cost,
          cost_confidence: 'unknown', cost_source: `${r} template`,
          notes: 'Seeded demo requirement.', status: 'accepted',
        })
      }
    }
    onRequirementsChange(reqs)
    addMsg('assistant', role, `Loaded ${reqs.length} template requirements across all roles. Edit or add more as needed.`)
  }

  function confirmPending() {
    if (!pendingReq) return
    // Validate role value total
    const roleTotal = requirements.filter(r => r.role === pendingReq.role)
      .reduce((s, r) => s + r.perspective_value_pct, 0)
    if (roleTotal + pendingReq.perspective_value_pct > 100) {
      addMsg('assistant', pendingReq.role as RoleKey,
        `Not added — ${RFQ_ROLES[pendingReq.role as RoleKey].label} value total would exceed 100% ` +
        `(${roleTotal.toFixed(0)}% + ${pendingReq.perspective_value_pct}%). Reduce the value % first.`)
      setPendingReq(null)
      return
    }
    onRequirementsChange([...requirements, { ...pendingReq, id: nextId() }])
    addMsg('assistant', pendingReq.role as RoleKey, 'Added to the requirement list.')
    setPendingReq(null)
  }

  function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    addMsg('user', role, text)

    // Greeting
    if (isGreeting(text)) {
      addMsg('assistant', role, 'Hello. Tell me a requirement for this role, or say "load templates" to start with examples.')
      return
    }

    // Load templates shortcut
    if (/load template/i.test(text)) { loadTemplates(); return }

    // Role switch
    const newRole = detectRoleSwitch(text)
    if (newRole) { switchRole(newRole); return }

    // Budget update
    const newBudget = extractBudgetCr(text)
    if (newBudget !== null) {
      if (newBudget < 0) {
        addMsg('assistant', role, 'Budget cannot be negative.')
      } else {
        onBudgetChange(String(newBudget))
        addMsg('assistant', role, `Budget updated to ₹${newBudget} Cr.`)
        setPendingReq(null)
      }
      return
    }

    // Remove requirement
    if (isRemoveCommand(text)) {
      const { reqs: updated, removed } = removeMatchingReq(text, requirements)
      if (removed) {
        onRequirementsChange(updated)
        addMsg('assistant', role, `Removed: ${removed}.`)
      } else {
        addMsg('assistant', role, 'Could not find a matching requirement to remove. Try the exact wording or remove it from the table.')
      }
      setPendingReq(null)
      return
    }

    // Template match
    const match = matchTemplate(text, role)
    if (match) {
      setPendingReq(match.req)
      const r = match.req
      const costStr = r.estimated_cost_cr !== null ? `₹${r.estimated_cost_cr} Cr` : 'cost unknown'
      addMsg('assistant', role,
        `Found a match. Add it? "${r.requirement}" — priority ${r.priority_rank} · value ${r.perspective_value_pct}% · ${costStr}`)
      return
    }

    // Custom requirement with enough detail
    if (hasSufficientDetail(text)) {
      const req = buildCustomReq(text, role, requirements)
      setPendingReq(req)
      const costStr = req.estimated_cost_cr !== null ? `₹${req.estimated_cost_cr} Cr` : 'cost unknown'
      addMsg('assistant', role,
        `Custom requirement ready. Add it? "${req.requirement}" — priority ${req.priority_rank} · value ${req.perspective_value_pct}% · ${costStr}`)
      return
    }

    // Ask for more detail
    addMsg('assistant', role,
      'To add a custom requirement, include: priority (e.g. "priority 2"), value % (e.g. "20%"), and cost or "unknown cost". ' +
      'Or say "load templates" to start with examples.')
  }

  const visibleReqs = role === 'management' ? requirements : requirements.filter(r => r.role === role)
  const knownCost = requirements.reduce((s, r) => s + (r.estimated_cost_cr ?? 0), 0)
  const budgetNum = parseFloat(budget) || 0
  const overBudget = budgetNum > 0 && knownCost > budgetNum

  const fieldSm: React.CSSProperties = {
    background: '#0a0a0a', border: `1px solid ${C.border}`,
    borderRadius: 2, padding: '4px 8px', fontSize: 12,
    color: C.text, fontFamily: FONT, outline: 'none',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, minHeight: 560 }}>

      {/* ── Left: requirement table ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['REQUIREMENTS', requirements.length],
            ['KNOWN COST', `₹${knownCost.toFixed(1)} Cr`],
            ['BUDGET', budgetNum ? `₹${budgetNum} Cr` : '—'],
          ].map(([label, val]) => (
            <div key={String(label)} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '6px 12px',
            }}>
              <div style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.12em' }}>{label}</div>
              <div style={{
                fontSize: 14, fontWeight: 700, fontFamily: FONT,
                color: label === 'KNOWN COST' && overBudget ? C.orange : C.text,
              }}>{val}</div>
            </div>
          ))}
          {/* Per-role value totals */}
          {Object.entries(RFQ_ROLES).map(([r, meta]) => {
            const total = requirements.filter(req => req.role === r)
              .reduce((s, req) => s + req.perspective_value_pct, 0)
            if (!total) return null
            const over = total > 100
            return (
              <div key={r} style={{
                background: over ? '#1a0808' : C.surface,
                border: `1px solid ${over ? '#3a1010' : C.border}`,
                borderRadius: 2, padding: '6px 10px',
              }}>
                <div style={{ fontSize: 9, color: over ? '#cc7777' : '#2a2a2a', fontFamily: FONT, letterSpacing: '0.1em' }}>
                  {meta.avatar}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT, color: over ? C.orange : '#666' }}>
                  {total.toFixed(0)}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Role filter label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.12em' }}>
            SHOWING: {role === 'management' ? 'ALL ROLES' : RFQ_ROLES[role].label.toUpperCase()}
          </span>
          <span style={{ fontSize: 10, color: '#2a2a2a', fontFamily: FONT }}>
            ({visibleReqs.length} of {requirements.length})
          </span>
          <button
            onClick={loadTemplates}
            style={{
              marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '3px 10px', fontSize: 10,
              letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT,
              color: C.muted, cursor: 'pointer',
            }}
          >
            LOAD TEMPLATES
          </button>
        </div>

        {/* Requirements */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420 }}>
          {visibleReqs.length === 0 ? (
            <div style={{
              padding: '24px 18px', background: '#050505',
              border: `1px dashed ${C.border}`, borderRadius: 2,
              fontSize: 12, color: '#2a2a2a', fontFamily: FONT,
              textAlign: 'center', lineHeight: 1.8,
            }}>
              No requirements yet for this role.<br />
              Chat to add one, or click LOAD TEMPLATES.
            </div>
          ) : visibleReqs.map(req => (
            <ReqRow
              key={req.id}
              req={req}
              onRemove={() => onRequirementsChange(requirements.filter(r => r.id !== req.id))}
              onUpdate={patch => onRequirementsChange(
                requirements.map(r => r.id === req.id ? { ...r, ...patch } : r)
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Right: chat panel ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Role selector */}
        <div>
          <div style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.12em', marginBottom: 6 }}>
            ACTIVE ROLE
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(Object.keys(RFQ_ROLES) as RoleKey[]).map(r => (
              <RolePill key={r} roleKey={r} active={r === role} onClick={() => switchRole(r)} />
            ))}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: '#2e2e2e', fontFamily: FONT, lineHeight: 1.4 }}>
            {RFQ_ROLES[role].label}
          </div>
        </div>

        {/* Budget input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.1em' }}>BUDGET ₹ CR</span>
          <input
            type="number" min={0} value={budget}
            onChange={e => onBudgetChange(e.target.value)}
            style={{ ...fieldSm, width: 80 }}
          />
          {overBudget && (
            <span style={{ fontSize: 9, color: C.orange, fontFamily: FONT }}>OVER BUDGET</span>
          )}
        </div>

        {/* Chat messages */}
        <div style={{
          flex: 1, overflowY: 'auto', maxHeight: 320,
          background: '#030303', border: `1px solid ${C.border}`,
          borderRadius: 2, padding: '10px 12px',
        }}>
          {msgs.slice(-10).map((m, i) => <ChatBubble key={i} msg={m} />)}

          {/* Pending requirement actions */}
          {pendingReq && (
            <div style={{
              marginTop: 6, padding: '10px 12px',
              background: '#001a1a', border: `1px solid #003333`, borderRadius: 2,
            }}>
              <div style={{ fontSize: 10, color: C.cyan, fontFamily: FONT, letterSpacing: '0.1em', marginBottom: 8 }}>
                PENDING REQUIREMENT
              </div>
              <div style={{ fontSize: 12, color: '#aaa', fontFamily: FONT, lineHeight: 1.5, marginBottom: 10 }}>
                "{pendingReq.requirement}"
                <span style={{ color: '#444' }}>
                  {' '}· P{pendingReq.priority_rank} · {pendingReq.perspective_value_pct}%
                  {pendingReq.estimated_cost_cr !== null ? ` · ₹${pendingReq.estimated_cost_cr} Cr` : ' · cost unknown'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: 'YES, ADD', action: confirmPending, active: true },
                  { label: 'NO', action: () => { addMsg('assistant', role, 'Okay, not added.'); setPendingReq(null) }, active: false },
                  { label: 'DISCUSS', action: () => addMsg('assistant', role, 'Tell me what to change: priority, value %, cost, or wording.'), active: false },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    style={{
                      background: btn.active ? C.cyan : 'none',
                      color: btn.active ? '#080808' : C.muted,
                      border: `1px solid ${btn.active ? C.cyan : C.border}`,
                      borderRadius: 2, padding: '4px 12px', fontSize: 11,
                      letterSpacing: '0.1em', fontFamily: FONT, fontWeight: btn.active ? 700 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Add a requirement, set budget, or 'switch to finance'…"
            style={{
              flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '7px 10px', fontSize: 13,
              color: C.text, fontFamily: FONT, outline: 'none',
            }}
          />
          <button
            onClick={send}
            style={{
              background: C.cyan, color: '#080808',
              border: `1px solid ${C.cyan}`, borderRadius: 2,
              padding: '7px 14px', fontSize: 12, letterSpacing: '0.12em',
              fontFamily: FONT, fontWeight: 700, cursor: 'pointer',
            }}
          >
            SEND
          </button>
        </div>

        <div style={{ fontSize: 9, color: '#1e1e1e', fontFamily: FONT, lineHeight: 1.7 }}>
          Tips: "Add core imaging capability, priority 1, 30%, ₹4.5 Cr" · "Remove spare-parts" ·
          "Set overall budget to 20 Cr" · "Switch to finance"
        </div>
      </div>
    </div>
  )
}
