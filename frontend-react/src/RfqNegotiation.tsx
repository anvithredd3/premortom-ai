import { useState } from 'react'
import type { UiGuidanceResult } from './types'
import { useTheme } from './theme'

interface PubReq {
  id: string
  role: string
  entered_by_role: string
  requirement: string
  priority_rank: number
  perspective_value_pct: number
  estimated_cost_cr: string
  cost_confidence: string
  notes: string
  status: string
}

interface PublishResult {
  stored: boolean
  rfq_id: string
  requirements_stored: number
  status: string
}

const FONT = "'JetBrains Mono', monospace"

/* ── Shared primitives ─────────────────────────────────────────────────── */
function Lbl({ children, color }: { children: string; color?: string }) {
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

function GhostBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { theme: C } = useTheme()
  const { active, children, style, ...rest } = props
  return (
    <button
      {...rest}
      style={{
        background: active ? C.surface2 : 'none',
        border: `1px solid ${active ? C.borderMid : C.border}`,
        borderRadius: 2, padding: '5px 14px', fontSize: 13,
        letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT,
        color: active ? C.text : C.muted, cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function InfoCard({ title, children, accent }: {
  title: string; children: React.ReactNode; accent?: string
}) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${accent ? `${accent}33` : C.border}`,
      borderLeft: accent ? `2px solid ${accent}` : undefined,
      borderRadius: 2, padding: '14px 18px', marginBottom: 12,
    }}>
      <Lbl color={accent}>{title}</Lbl>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

/* ── Role selector ─────────────────────────────────────────────────────── */
const ROLES = [
  { key: 'management',           label: 'Management',           desc: 'Strategic decisions, budget approval, final sign-off' },
  { key: 'doctor',               label: 'Doctor / Clinician',   desc: 'Clinical fit, workflow, patient care requirements' },
  { key: 'technician',           label: 'Technician',           desc: 'Technical specs, calibration, maintenance needs' },
  { key: 'biomedical_engineer',  label: 'Biomedical Engineer',  desc: 'Infrastructure, power, site, safety compliance' },
  { key: 'procurement_officer',  label: 'Procurement Officer',  desc: 'Vendor terms, contract, compliance, lifecycle cost' },
] as const

type Role = typeof ROLES[number]['key']

/* ── Expectation profiles ──────────────────────────────────────────────── */
const PROFILES = [
  { key: 'premium_clinical',    label: 'Premium Clinical',       desc: 'Best-in-class clinical capability, cost secondary' },
  { key: 'balanced',            label: 'Balanced Cost & Service',desc: 'Optimal balance of capability, cost, and service' },
  { key: 'lowest_lifecycle',    label: 'Lowest Lifecycle Cost',  desc: 'Minimize total cost over equipment lifetime' },
  { key: 'fastest_deployment',  label: 'Fastest Deployment',     desc: 'Speed of delivery and commissioning is priority' },
  { key: 'strict_compliance',   label: 'Strict Compliance',      desc: 'Regulatory, audit, and policy requirements first' },
] as const

type Profile = typeof PROFILES[number]['key']

/* ── Decision criteria ─────────────────────────────────────────────────── */
interface CriterionDef {
  key: string; label: string; description: string; defaultWeight: number
}

export const DEFAULT_CRITERIA: CriterionDef[] = [
  { key: 'clinical_fit',      label: 'Clinical Fit',            defaultWeight: 30, description: 'Specification match, clinical need, features, workflow' },
  { key: 'total_cost',        label: 'Total Cost of Ownership', defaultWeight: 25, description: 'Purchase price, AMC, consumables, energy, downtime cost' },
  { key: 'service_readiness', label: 'Service & Maintenance',   defaultWeight: 20, description: 'Local service, response time, spares, uptime commitment' },
  { key: 'infra_workforce',   label: 'Infra & Workforce',       defaultWeight: 15, description: 'Site readiness, power, HVAC, trained staff availability' },
  { key: 'strategic_value',   label: 'Strategic Value',         defaultWeight: 10, description: 'Revenue, patient demand, competitive positioning, growth' },
]

function CriteriaSection({
  weights, onChange,
}: {
  weights: Record<string, number>
  onChange: (w: Record<string, number>) => void
}) {
  const { theme: C } = useTheme()
  const total = Object.values(weights).reduce((s, v) => s + (v || 0), 0)
  const ok = Math.abs(total - 100) < 0.01
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Lbl>Decision Criteria Weights</Lbl>
        <span style={{
          fontSize: 11, fontFamily: FONT, letterSpacing: '0.1em',
          color: ok ? C.cyan : C.orange,
          background: ok ? '#001a1a' : '#1a0c00',
          border: `1px solid ${ok ? '#003333' : '#3a1800'}`,
          borderRadius: 2, padding: '1px 8px',
        }}>
          {total}% {ok ? '✓' : `— need ${100 - total > 0 ? `+${(100 - total).toFixed(0)}` : (100 - total).toFixed(0)}`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {DEFAULT_CRITERIA.map(c => {
          const w = weights[c.key] ?? c.defaultWeight
          return (
            <div key={c.key} style={{
              background: '#050505', border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 13, color: C.text, fontFamily: FONT, flex: 1 }}>{c.label}</span>
                <input
                  type="number" min={0} max={100} value={w}
                  onChange={e => onChange({ ...weights, [c.key]: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: 52, textAlign: 'right',
                    background: '#0a0a0a', border: `1px solid ${C.border}`,
                    borderRadius: 2, padding: '3px 6px', fontSize: 14, fontWeight: 700,
                    color: C.text, fontFamily: FONT, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>%</span>
              </div>
              <div style={{ height: 2, background: C.border, borderRadius: 1, overflow: 'hidden', marginBottom: 5 }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  width: `${Math.min(w, 100)}%`,
                  background: w > 40 ? C.accent : w > 20 ? C.orange : C.cyan,
                  transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#2e2e2e', fontFamily: FONT }}>{c.description}</div>
            </div>
          )
        })}
      </div>
      <GhostBtn
        onClick={() => onChange(Object.fromEntries(DEFAULT_CRITERIA.map(c => [c.key, c.defaultWeight])))}
      >
        Reset to Defaults
      </GhostBtn>
    </div>
  )
}

/* ── Criteria list input (mandatory / negotiable) ──────────────────────── */
function CriteriaList({
  label, items, onChange, accent,
}: {
  label: string; items: string[]; onChange: (v: string[]) => void; accent?: string
}) {
  const { theme: C } = useTheme()
  const [draft, setDraft] = useState('')
  function add() {
    const t = draft.trim()
    if (t) { onChange([...items, t]); setDraft('') }
  }
  return (
    <div>
      <Lbl color={accent}>{label}</Lbl>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '6px 10px',
          }}>
            <span style={{ flex: 1, fontSize: 13, color: '#888', fontFamily: FONT, lineHeight: 1.4 }}>{item}</span>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: '#2a2a2a', fontFamily: FONT, fontStyle: 'italic' }}>
            No {label.toLowerCase()} added yet
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={`Add ${label.toLowerCase()}…`}
          style={{
            flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '6px 10px', fontSize: 13,
            color: C.text, fontFamily: FONT, outline: 'none',
          }}
        />
        <GhostBtn onClick={add} style={{ padding: '5px 12px' }}>ADD</GhostBtn>
      </div>
    </div>
  )
}

/* ── Output panel ──────────────────────────────────────────────────────── */
function GuidanceOutput({ result, mode }: { result: UiGuidanceResult; mode: 'rfq_intake' | 'negotiation' }) {
  const { theme: C } = useTheme()
  const rfq = result.rfq_intake ?? {}
  const neg = result.negotiation_guidance ?? {}
  const fw  = result.feature_weight_feedback ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Feature weight feedback */}
      {fw.length > 0 && (
        <InfoCard title="Weight Feedback" accent={C.orange}>
          {fw.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.55 }}>· {f}</div>
          ))}
        </InfoCard>
      )}

      {mode === 'rfq_intake' && (
        <>
          {rfq.requirement_summary && (
            <InfoCard title="Requirement Summary" accent={C.cyan}>
              <div style={{ fontSize: 14, color: '#aaa', fontFamily: FONT, lineHeight: 1.7 }}>
                {rfq.requirement_summary}
              </div>
            </InfoCard>
          )}

          {(rfq.missing_inputs?.length ?? 0) > 0 && (
            <InfoCard title="Missing Inputs" accent={C.orange}>
              {rfq.missing_inputs!.map((m, i) => (
                <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.5 }}>· {m}</div>
              ))}
            </InfoCard>
          )}

          {(rfq.suggested_requirements?.length ?? 0) > 0 && (
            <InfoCard title="Suggested Requirements" accent={C.cyan}>
              {rfq.suggested_requirements!.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.5 }}>· {r}</div>
              ))}
            </InfoCard>
          )}

          {(rfq.minimum_criteria?.length ?? 0) > 0 && (
            <InfoCard title="Recommended Minimum Criteria">
              {rfq.minimum_criteria!.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.5 }}>· {c}</div>
              ))}
            </InfoCard>
          )}
        </>
      )}

      {(neg.negotiation_questions?.length ?? 0) > 0 && (
        <InfoCard title="Negotiation Questions" accent={C.cyan}>
          {neg.negotiation_questions!.map((q, i) => (
            <div key={i} style={{
              fontSize: 13, color: '#aaa', fontFamily: FONT, lineHeight: 1.55,
              paddingLeft: 10, borderLeft: `1px solid ${C.border}`, marginBottom: 5,
            }}>
              {q}
            </div>
          ))}
        </InfoCard>
      )}

      {(neg.contract_conditions?.length ?? 0) > 0 && (
        <InfoCard title="Contract Conditions to Include">
          {neg.contract_conditions!.map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.5 }}>· {c}</div>
          ))}
        </InfoCard>
      )}

      {(neg.cost_or_lifecycle_items?.length ?? 0) > 0 && (
        <InfoCard title="Lifecycle & Cost Items to Negotiate">
          {neg.cost_or_lifecycle_items!.map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: '#999', fontFamily: FONT, lineHeight: 1.5 }}>· {c}</div>
          ))}
        </InfoCard>
      )}

      {neg.vendor_message_draft && (
        <InfoCard title="Draft Vendor Message" accent={C.cyan}>
          <div style={{
            fontSize: 13, color: '#aaa', fontFamily: FONT, lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
            background: '#050505', border: `1px solid ${C.border}`,
            borderRadius: 2, padding: '12px 14px',
          }}>
            {neg.vendor_message_draft}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#2a2a2a', fontFamily: FONT, letterSpacing: '0.08em' }}>
            FOR REVIEW ONLY — NOT SENT AUTOMATICALLY
          </div>
        </InfoCard>
      )}

      {(result.evidence?.length ?? 0) > 0 && (
        <InfoCard title="Evidence">
          {result.evidence!.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: '#555', fontFamily: FONT, lineHeight: 1.5 }}>· {e}</div>
          ))}
        </InfoCard>
      )}

      {(result.guardrails?.length ?? 0) > 0 && (
        <InfoCard title="Guardrails Applied">
          {result.guardrails!.map((g, i) => (
            <div key={i} style={{ fontSize: 11, color: '#333', fontFamily: FONT, lineHeight: 1.5 }}>· {g}</div>
          ))}
        </InfoCard>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ════════════════════════════════════════════════════════════════════════ */
export function RfqNegotiation() {
  const { theme: C } = useTheme()
  const [tab, setTab] = useState<'rfq' | 'publish' | 'negotiation'>('rfq')

  /* RFQ intake state */
  const [role, setRole]                 = useState<Role>('management')
  const [profile, setProfile]           = useState<Profile>('balanced')
  const [budgetCr, setBudgetCr]         = useState('')
  const [budgetTol, setBudgetTol]       = useState('10')
  const [freeText, setFreeText]         = useState('')
  const [mandatory, setMandatory]       = useState<string[]>([])
  const [negotiable, setNegotiable]     = useState<string[]>([])
  const [weights, setWeights]           = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_CRITERIA.map(c => [c.key, c.defaultWeight]))
  )

  /* Negotiation state */
  const [negBidId, setNegBidId]         = useState('')
  const [negQuoteId, setNegQuoteId]     = useState('')
  const [negFreeText, setNegFreeText]   = useState('')

  /* Shared async state */
  const [busy, setBusy]                 = useState(false)
  const [result, setResult]             = useState<UiGuidanceResult | null>(null)
  const [error, setError]               = useState<string | null>(null)

  /* ── Section visibility (accordion for long form) */
  const [showCriteria, setShowCriteria] = useState(false)
  const [showWeights, setShowWeights]   = useState(false)

  /* ── Publish RFQ state */
  const [pubName, setPubName]       = useState('')
  const [pubEquip, setPubEquip]     = useState('')
  const [pubBudget, setPubBudget]   = useState('')
  const [pubReqs, setPubReqs]       = useState<PubReq[]>([])
  const [pubResult, setPubResult]   = useState<PublishResult | null>(null)
  const [pubError, setPubError]     = useState<string | null>(null)
  const [pubBusy, setPubBusy]       = useState(false)

  async function runRfq() {
    setBusy(true); setError(null); setResult(null)
    try {
      const body = {
        mode: 'rfq_intake',
        role,
        expectation_profile: profile,
        free_text: freeText,
        static_inputs: {
          budget_cr: parseFloat(budgetCr) || 0,
          budget_tolerance_pct: parseFloat(budgetTol) || 10,
        },
        feature_weights: weights,
        minimum_criteria: mandatory,
        negotiable_criteria: negotiable,
        store_history: false,
      }
      const r = await fetch('/api/ui-guidance/rfq-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setResult(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function runNegotiation() {
    if (!negFreeText.trim()) return
    setBusy(true); setError(null); setResult(null)
    try {
      const body = {
        mode: 'negotiation',
        free_text: negFreeText,
        bid_id: negBidId,
        quote_id: negQuoteId,
        feature_weights: weights,
        minimum_criteria: mandatory,
        negotiable_criteria: negotiable,
        store_history: true,
      }
      const r = await fetch('/api/ui-guidance/rfq-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setResult(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function makePubReq(rank: number): PubReq {
    return {
      id: `REQ-${String(rank).padStart(3, '0')}`,
      role: 'management', entered_by_role: 'management',
      requirement: '', priority_rank: rank,
      perspective_value_pct: 0, estimated_cost_cr: '',
      cost_confidence: 'unknown', notes: '', status: 'accepted',
    }
  }

  function addPubReq() {
    setPubReqs(rs => [...rs, makePubReq(rs.length + 1)])
  }

  function removePubReq(idx: number) {
    setPubReqs(rs => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, priority_rank: i + 1, id: `REQ-${String(i + 1).padStart(3, '0')}` })))
  }

  function updatePubReq(idx: number, patch: Partial<PubReq>) {
    setPubReqs(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function importFromIntake() {
    const all: PubReq[] = [
      ...mandatory.map((req, i) => ({
        ...makePubReq(i + 1),
        role: 'management', entered_by_role: 'management',
        requirement: req, perspective_value_pct: 20,
      })),
      ...negotiable.map((req, i) => ({
        ...makePubReq(mandatory.length + i + 1),
        role: 'procurement_officer', entered_by_role: 'procurement_officer',
        requirement: req, perspective_value_pct: 10,
      })),
    ]
    if (all.length) setPubReqs(all)
  }

  async function runPublish() {
    if (!pubName.trim()) { setPubError('Procurement name is required.'); return }
    if (!pubReqs.length) { setPubError('Add at least one requirement before publishing.'); return }
    if (pubReqs.some(r => !r.requirement.trim())) { setPubError('All requirements must have text.'); return }
    setPubBusy(true); setPubError(null); setPubResult(null)
    try {
      const body = {
        procurement_name: pubName.trim(),
        equipment_type: pubEquip.trim(),
        budget_cr: parseFloat(pubBudget) || 0,
        minimum_criteria: mandatory,
        negotiable_criteria: negotiable,
        requirements: pubReqs.map(r => ({
          id: r.id,
          role: r.role,
          entered_by_role: r.entered_by_role,
          perspective_role: r.role,
          requirement: r.requirement.trim(),
          priority_rank: r.priority_rank,
          perspective_value_pct: r.perspective_value_pct,
          estimated_cost_cr: r.estimated_cost_cr ? parseFloat(r.estimated_cost_cr) : null,
          cost_confidence: r.cost_confidence,
          notes: r.notes.trim(),
          status: r.status,
        })),
      }
      const resp = await fetch('/api/rfq/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const msg = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${msg}`)
      }
      setPubResult(await resp.json())
    } catch (e) {
      setPubError(e instanceof Error ? e.message : String(e))
    } finally {
      setPubBusy(false)
    }
  }

  const fieldStyle: React.CSSProperties = {
    background: '#0a0a0a', border: `1px solid ${C.border}`,
    borderRadius: 2, padding: '7px 10px', fontSize: 14,
    color: C.text, fontFamily: FONT, outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 28px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <Lbl>RFQ / Negotiation Guidance</Lbl>
          <div style={{ fontSize: 11, color: '#2a2a2a', fontFamily: FONT, marginTop: 4, letterSpacing: '0.08em', lineHeight: 1.6 }}>
            Capture organisation requirements before vendor quotes arrive, or prepare negotiation questions after bid evaluation.
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
          {([['rfq', 'RFQ INTAKE'], ['publish', 'PUBLISH RFQ'], ['negotiation', 'NEGOTIATION GUIDANCE']] as const).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setResult(null); setError(null) }}
              style={{
                background: tab === key ? '#141414' : 'none',
                border: `1px solid ${tab === key ? '#252525' : 'transparent'}`,
                borderRadius: 2, padding: '5px 16px', fontSize: 13,
                letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT,
                color: tab === key ? C.text : C.muted, cursor: 'pointer',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* ── RFQ INTAKE tab ─────────────────────────────────────────── */}
        {tab === 'rfq' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Role */}
            <div>
              <Lbl>Your Role</Lbl>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {ROLES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setRole(r.key)}
                    title={r.desc}
                    style={{
                      background: role === r.key ? '#001a1a' : '#0a0a0a',
                      border: `1px solid ${role === r.key ? C.cyan + '55' : C.border}`,
                      borderRadius: 2, padding: '6px 14px', fontSize: 13,
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT,
                      color: role === r.key ? C.cyan : '#444', cursor: 'pointer',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#2e2e2e', fontFamily: FONT }}>
                {ROLES.find(r => r.key === role)?.desc}
              </div>
            </div>

            {/* Expectation profile */}
            <div>
              <Lbl>Expectation Profile</Lbl>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                {PROFILES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setProfile(p.key)}
                    style={{
                      background: profile === p.key ? '#001a1a' : '#0a0a0a',
                      border: `1px solid ${profile === p.key ? C.cyan + '55' : C.border}`,
                      borderRadius: 2, padding: '8px 12px', fontSize: 11, textAlign: 'left',
                      fontFamily: FONT, cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 13, color: profile === p.key ? C.cyan : '#666', fontWeight: 600, marginBottom: 3 }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#2a2a2a', lineHeight: 1.4 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
              <div>
                <Lbl>Budget (₹ Cr)</Lbl>
                <input
                  type="number" min="0" value={budgetCr} placeholder="e.g. 18"
                  onChange={e => setBudgetCr(e.target.value)}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
              <div>
                <Lbl>Tolerance %</Lbl>
                <input
                  type="number" min="0" max="50" value={budgetTol} placeholder="10"
                  onChange={e => setBudgetTol(e.target.value)}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
            </div>

            {/* Requirements free text */}
            <div>
              <Lbl>Requirements, Concerns, or Context</Lbl>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Describe what the organisation needs, any clinical constraints, existing infrastructure gaps, compliance requirements, or known vendor concerns…"
                rows={4}
                style={{
                  ...fieldStyle, marginTop: 6, resize: 'vertical', lineHeight: 1.6,
                }}
              />
            </div>

            {/* Mandatory criteria (collapsible) */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 16px' }}>
              <button
                onClick={() => setShowCriteria(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
              >
                <Lbl>Mandatory & Negotiable Criteria</Lbl>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#2e2e2e', fontFamily: FONT }}>
                  {mandatory.length + negotiable.length > 0 ? `${mandatory.length + negotiable.length} added ` : ''}{showCriteria ? '▲' : '▼'}
                </span>
              </button>
              {showCriteria && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <CriteriaList
                    label="Hard cutoffs — must meet"
                    items={mandatory}
                    onChange={setMandatory}
                    accent={C.accent}
                  />
                  <CriteriaList
                    label="Negotiable gaps — preferred but flexible"
                    items={negotiable}
                    onChange={setNegotiable}
                    accent={C.orange}
                  />
                </div>
              )}
            </div>

            {/* Feature weights (collapsible) */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 16px' }}>
              <button
                onClick={() => setShowWeights(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
              >
                <Lbl>Decision Criteria & Weights</Lbl>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#2e2e2e', fontFamily: FONT }}>
                  {showWeights ? '▲' : '▼'}
                </span>
              </button>
              {showWeights && (
                <div style={{ marginTop: 16 }}>
                  <CriteriaSection weights={weights} onChange={setWeights} />
                </div>
              )}
            </div>

            {/* Action */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={runRfq}
                disabled={busy}
                style={{
                  background: busy ? '#1a0808' : C.cyan,
                  color: busy ? '#5a2a2a' : '#080808',
                  border: `1px solid ${busy ? '#3a1010' : C.cyan}`,
                  borderRadius: 2, padding: '8px 24px', fontSize: 13,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  fontFamily: FONT, fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'ANALYZING···' : 'GENERATE RFQ GUIDANCE'}
              </button>
              {result && (
                <GhostBtn onClick={() => { setResult(null); setError(null) }} style={{ padding: '7px 14px' }}>
                  CLEAR
                </GhostBtn>
              )}
            </div>
          </div>
        )}

        {/* ── PUBLISH RFQ tab ─────────────────────────────────────────── */}
        {tab === 'publish' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Procurement details */}
            <div>
              <Lbl>Procurement Name</Lbl>
              <input
                value={pubName} onChange={e => setPubName(e.target.value)}
                placeholder="e.g. AIIMS New Delhi — 3T MRI Scanner"
                style={{ ...fieldStyle, marginTop: 6 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
              <div>
                <Lbl>Equipment / Category</Lbl>
                <input
                  value={pubEquip} onChange={e => setPubEquip(e.target.value)}
                  placeholder="e.g. Medical Equipment — MRI"
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
              <div>
                <Lbl>Budget (₹ Cr)</Lbl>
                <input
                  type="number" min="0" value={pubBudget}
                  onChange={e => setPubBudget(e.target.value)}
                  placeholder="e.g. 18"
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
            </div>

            {/* Requirements builder */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Lbl>Requirements</Lbl>
                <span style={{
                  fontSize: 10, fontFamily: FONT, letterSpacing: '0.08em',
                  color: pubReqs.length ? C.cyan : '#333',
                  background: pubReqs.length ? '#001a1a' : '#0a0a0a',
                  border: `1px solid ${pubReqs.length ? '#003333' : C.border}`,
                  borderRadius: 2, padding: '1px 8px',
                }}>
                  {pubReqs.length} added
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {(mandatory.length + negotiable.length) > 0 && (
                    <GhostBtn onClick={importFromIntake} style={{ fontSize: 10, padding: '3px 10px' }}>
                      IMPORT FROM INTAKE
                    </GhostBtn>
                  )}
                  <GhostBtn onClick={addPubReq} style={{ fontSize: 10, padding: '3px 10px' }}>
                    + ADD
                  </GhostBtn>
                </div>
              </div>

              {pubReqs.length === 0 && (
                <div style={{
                  padding: '20px 18px', background: '#050505',
                  border: `1px dashed ${C.border}`, borderRadius: 2,
                  fontSize: 12, color: '#2a2a2a', fontFamily: FONT, textAlign: 'center', lineHeight: 1.8,
                }}>
                  No requirements yet.<br />
                  Click + ADD to create one, or IMPORT FROM INTAKE to pull from the RFQ Intake tab.
                </div>
              )}

              {pubReqs.map((req, idx) => (
                <div key={req.id} style={{
                  background: '#050505', border: `1px solid ${C.border}`,
                  borderLeft: `2px solid ${C.cyan}22`,
                  borderRadius: 2, padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: '#333', fontFamily: FONT }}>{req.id}</span>
                    <span style={{
                      fontSize: 10, fontFamily: FONT, letterSpacing: '0.1em',
                      background: '#001a1a', color: C.cyan, border: `1px solid #003333`,
                      borderRadius: 2, padding: '1px 7px',
                    }}>
                      RANK {req.priority_rank}
                    </span>
                    <button
                      onClick={() => removePubReq(idx)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Requirement text */}
                  <textarea
                    value={req.requirement}
                    onChange={e => updatePubReq(idx, { requirement: e.target.value })}
                    placeholder="Describe the requirement clearly and measurably…"
                    rows={2}
                    style={{
                      ...fieldStyle, marginBottom: 10, resize: 'vertical', lineHeight: 1.5,
                      borderColor: !req.requirement.trim() ? '#3a1010' : C.border,
                    }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px', gap: 8, marginBottom: 8 }}>
                    {/* Perspective role */}
                    <div>
                      <div style={{ fontSize: 9, color: '#333', fontFamily: FONT, letterSpacing: '0.1em', marginBottom: 4 }}>STAKEHOLDER ROLE</div>
                      <select
                        value={req.role}
                        onChange={e => updatePubReq(idx, { role: e.target.value, entered_by_role: e.target.value })}
                        style={{ ...fieldStyle, fontSize: 12 }}
                      >
                        {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </div>
                    {/* Cost confidence */}
                    <div>
                      <div style={{ fontSize: 9, color: '#333', fontFamily: FONT, letterSpacing: '0.1em', marginBottom: 4 }}>COST CONFIDENCE</div>
                      <select
                        value={req.cost_confidence}
                        onChange={e => updatePubReq(idx, { cost_confidence: e.target.value })}
                        style={{ ...fieldStyle, fontSize: 12 }}
                      >
                        {['unknown', 'low', 'medium', 'high'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {/* Value % */}
                    <div>
                      <div style={{ fontSize: 9, color: '#333', fontFamily: FONT, letterSpacing: '0.1em', marginBottom: 4 }}>VALUE %</div>
                      <input
                        type="number" min={0} max={100}
                        value={req.perspective_value_pct}
                        onChange={e => updatePubReq(idx, { perspective_value_pct: parseFloat(e.target.value) || 0 })}
                        style={{ ...fieldStyle, fontSize: 13 }}
                      />
                    </div>
                    {/* Est. cost */}
                    <div>
                      <div style={{ fontSize: 9, color: '#333', fontFamily: FONT, letterSpacing: '0.1em', marginBottom: 4 }}>EST. COST ₹ Cr</div>
                      <input
                        type="number" min={0} step="0.1"
                        value={req.estimated_cost_cr}
                        onChange={e => updatePubReq(idx, { estimated_cost_cr: e.target.value })}
                        placeholder="optional"
                        style={{ ...fieldStyle, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <input
                    value={req.notes}
                    onChange={e => updatePubReq(idx, { notes: e.target.value })}
                    placeholder="Notes (optional)…"
                    style={{ ...fieldStyle, fontSize: 12 }}
                  />
                </div>
              ))}
            </div>

            {/* Publish action */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={runPublish}
                disabled={pubBusy}
                style={{
                  background: pubBusy ? '#1a0808' : C.cyan,
                  color: pubBusy ? '#5a2a2a' : '#080808',
                  border: `1px solid ${pubBusy ? '#3a1010' : C.cyan}`,
                  borderRadius: 2, padding: '8px 24px', fontSize: 13,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  fontFamily: FONT, fontWeight: 700,
                  cursor: pubBusy ? 'not-allowed' : 'pointer',
                }}
              >
                {pubBusy ? 'PUBLISHING···' : 'PUBLISH RFQ TO STORE'}
              </button>
              {pubResult && (
                <GhostBtn onClick={() => { setPubResult(null); setPubError(null) }} style={{ padding: '7px 14px' }}>
                  CLEAR
                </GhostBtn>
              )}
            </div>

            {/* Publish error */}
            {pubError && (
              <div style={{
                padding: '12px 16px', background: '#1a0808',
                border: `1px solid #3a1010`, borderRadius: 2,
                fontSize: 13, color: '#cc7777', fontFamily: FONT,
              }}>
                ERROR: {pubError}
              </div>
            )}

            {/* Publish success */}
            {pubResult && (
              <div style={{
                padding: '16px 18px', background: '#001a00',
                border: `1px solid #003a00`, borderRadius: 2, fontFamily: FONT,
              }}>
                <div style={{ fontSize: 11, color: C.cyan, letterSpacing: '0.16em', marginBottom: 10 }}>
                  RFQ PUBLISHED
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 13, color: '#aaa' }}>
                    <span style={{ color: '#555' }}>RFQ ID: </span>
                    <span style={{ fontWeight: 700, color: C.cyan }}>{pubResult.rfq_id}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>
                    <span style={{ color: '#555' }}>Requirements stored: </span>
                    {pubResult.requirements_stored}
                  </div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>
                    <span style={{ color: '#555' }}>Status: </span>
                    {pubResult.status}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── NEGOTIATION tab ────────────────────────────────────────── */}
        {tab === 'negotiation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{
              padding: '12px 16px', background: '#001a0a', border: `1px solid #003322`,
              borderRadius: 2, fontSize: 13, color: '#336655', fontFamily: FONT, lineHeight: 1.65,
            }}>
              Run this after Bid Evaluation completes. Load a bid and quote ID to get vendor-specific negotiation questions and a draft message.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Lbl>Bid ID (optional)</Lbl>
                <input
                  value={negBidId} onChange={e => setNegBidId(e.target.value)}
                  placeholder="e.g. BID-001"
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
              <div>
                <Lbl>Quote ID (optional)</Lbl>
                <input
                  value={negQuoteId} onChange={e => setNegQuoteId(e.target.value)}
                  placeholder="e.g. BID-001-Q01"
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>
            </div>

            <div>
              <Lbl>Negotiation Question or Context</Lbl>
              <textarea
                value={negFreeText}
                onChange={e => setNegFreeText(e.target.value)}
                placeholder="e.g. 'The winning vendor has a high advance payment and unclear warranty trigger. What should we negotiate?'"
                rows={4}
                style={{ ...fieldStyle, marginTop: 6, resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            {/* Shared criteria for negotiation context */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 16px' }}>
              <button
                onClick={() => setShowCriteria(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
              >
                <Lbl>Management Criteria (for context)</Lbl>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#2e2e2e', fontFamily: FONT }}>
                  {showCriteria ? '▲' : '▼'}
                </span>
              </button>
              {showCriteria && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <CriteriaList label="Hard cutoffs" items={mandatory} onChange={setMandatory} accent={C.accent} />
                  <CriteriaList label="Negotiable gaps" items={negotiable} onChange={setNegotiable} accent={C.orange} />
                  <CriteriaSection weights={weights} onChange={setWeights} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={runNegotiation}
                disabled={busy || !negFreeText.trim()}
                style={{
                  background: busy || !negFreeText.trim() ? '#0a0a0a' : C.cyan,
                  color: busy || !negFreeText.trim() ? '#3a3a3a' : '#080808',
                  border: `1px solid ${busy || !negFreeText.trim() ? C.border : C.cyan}`,
                  borderRadius: 2, padding: '8px 24px', fontSize: 13,
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  fontFamily: FONT, fontWeight: 700,
                  cursor: busy || !negFreeText.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'ANALYZING···' : 'GET NEGOTIATION GUIDANCE'}
              </button>
              {result && (
                <GhostBtn onClick={() => { setResult(null); setError(null) }} style={{ padding: '7px 14px' }}>
                  CLEAR
                </GhostBtn>
              )}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {tab !== 'publish' && error && (
          <div style={{
            marginTop: 20, padding: '12px 16px', background: '#1a0808',
            border: `1px solid #3a1010`, borderRadius: 2, fontSize: 13, color: '#cc7777', fontFamily: FONT,
          }}>
            ERROR: {error}
          </div>
        )}

        {/* ── Output ── */}
        {tab !== 'publish' && result && (
          <div style={{ marginTop: 28 }}>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 16 }}>
              <Lbl color={C.cyan}>Guidance Output</Lbl>
              {result.history?.stored && (
                <span style={{ marginLeft: 10, fontSize: 10, color: '#2a3a2a', fontFamily: FONT, letterSpacing: '0.1em' }}>
                  STORED · {result.history.run_id}
                </span>
              )}
            </div>
            <GuidanceOutput result={result} mode={tab === 'rfq' ? 'rfq_intake' : 'negotiation'} />
          </div>
        )}

      </div>
    </div>
  )
}
