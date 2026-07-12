import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import type { ItemResearchExtraField, ItemResearchResult, UiGuidanceResult } from './types'
import { useTheme } from './theme'
import type { Theme } from './theme'

const FONT = "'JetBrains Mono', monospace"

/* ── Currency config ────────────────────────────────────────────────── */
interface CurrencyCfg {
  code: string; symbol: string; unit: string; label: string; unitFull: string; toCr: number
}

const CURRENCIES: CurrencyCfg[] = [
  { code: 'USD_M',  symbol: '$', unit: 'M',  label: 'USD M',  unitFull: 'millions',  toCr: 8.5  },
  { code: 'USD_K',  symbol: '$', unit: 'K',  label: 'USD K',  unitFull: 'thousands', toCr: 0.0085 },
  { code: 'EUR_M',  symbol: '€', unit: 'M',  label: 'EUR M',  unitFull: 'millions',  toCr: 9.2  },
  { code: 'GBP_M',  symbol: '£', unit: 'M',  label: 'GBP M',  unitFull: 'millions',  toCr: 10.8 },
  { code: 'INR_CR', symbol: '₹', unit: 'Cr', label: 'INR Cr', unitFull: 'Crores',    toCr: 1.0  },
  { code: 'INR_L',  symbol: '₹', unit: 'L',  label: 'INR L',  unitFull: 'Lakhs',     toCr: 0.01 },
]

function getCurrency(code: string): CurrencyCfg {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]
}

/* ── Field schema ───────────────────────────────────────────────────── */
type FieldType = 'text' | 'number' | 'bool' | 'select' | 'array'
interface FieldDef { key: string; label: string; type: FieldType; opts?: readonly string[] }

// Base fields — labels adapted per category where applicable
const BASE_LABELS: Record<string, string> = {
  procurement_name:           'PROCUREMENT NAME',
  equipment_type:             'EQUIPMENT / ITEM TYPE',
  contract_value_cr:          'CONTRACT VALUE',
  advance_payment_pct:        'ADVANCE PAYMENT %',
  delivery_timeline_months:   'DELIVERY TIMELINE (months)',
  warranty_start:             'WARRANTY START',
  installation_responsibility:'INSTALLATION BY',
  training_included:          'TRAINING INCLUDED',
  construction_completion_pct:'SITE READINESS %',
  electrical_readiness:       'ELECTRICAL READINESS',
  regulatory_approval_status: 'REGULATORY APPROVAL',
  technicians_available:      'SPECIALISTS AVAILABLE',
  technicians_required:       'SPECIALISTS REQUIRED',
  historical_delays_months:   'PAST DELAYS (months, comma-sep)',
}

const FIELDS: FieldDef[] = [
  { key: 'procurement_name',           label: BASE_LABELS.procurement_name,           type: 'text' },
  { key: 'equipment_type',             label: BASE_LABELS.equipment_type,             type: 'text' },
  { key: 'contract_value_cr',          label: BASE_LABELS.contract_value_cr,          type: 'number' },
  { key: 'advance_payment_pct',        label: BASE_LABELS.advance_payment_pct,        type: 'number' },
  { key: 'delivery_timeline_months',   label: BASE_LABELS.delivery_timeline_months,   type: 'number' },
  { key: 'warranty_start',             label: BASE_LABELS.warranty_start,             type: 'select', opts: ['On Delivery', 'On Commissioning', 'On Installation'] },
  { key: 'installation_responsibility',label: BASE_LABELS.installation_responsibility, type: 'text' },
  { key: 'training_included',          label: BASE_LABELS.training_included,          type: 'bool' },
  { key: 'construction_completion_pct',label: BASE_LABELS.construction_completion_pct,type: 'number' },
  { key: 'electrical_readiness',       label: BASE_LABELS.electrical_readiness,       type: 'select', opts: ['Approved', 'Pending', 'Not Started'] },
  { key: 'regulatory_approval_status', label: BASE_LABELS.regulatory_approval_status, type: 'select', opts: ['Approved', 'Pending', 'Not Started'] },
  { key: 'technicians_available',      label: BASE_LABELS.technicians_available,      type: 'number' },
  { key: 'technicians_required',       label: BASE_LABELS.technicians_required,       type: 'number' },
  { key: 'historical_delays_months',   label: BASE_LABELS.historical_delays_months,   type: 'array' },
]

function getLabel(key: string, research: ItemResearchResult | null): string {
  if (!research) return BASE_LABELS[key] ?? key
  if (key === 'regulatory_approval_status') return (research.regulatory_label ?? 'REGULATORY APPROVAL').toUpperCase()
  if (key === 'technicians_available') return `${(research.workforce_label ?? 'SPECIALISTS').toUpperCase()} AVAILABLE`
  if (key === 'technicians_required')  return `${(research.workforce_label ?? 'SPECIALISTS').toUpperCase()} REQUIRED`
  if (key === 'construction_completion_pct') return (research.site_label ?? 'SITE READINESS %').toUpperCase()
  return BASE_LABELS[key] ?? key
}

/* ── Field groups for organized layout ─────────────────────────────── */
const GROUP_CONTRACT    = ['contract_value_cr', 'advance_payment_pct', 'delivery_timeline_months', 'warranty_start', 'installation_responsibility', 'training_included']
const GROUP_SITE        = ['construction_completion_pct', 'electrical_readiness', 'regulatory_approval_status']
const GROUP_WORKFORCE   = ['technicians_available', 'technicians_required']
const GROUP_HISTORY     = ['historical_delays_months']

/* ── Helpers ────────────────────────────────────────────────────────── */
function fieldsToForm(proposed: Record<string, unknown>, missing: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of FIELDS) {
    if (missing.includes(f.key)) { out[f.key] = ''; continue }
    const v = proposed[f.key]
    if (Array.isArray(v)) out[f.key] = v.join(', ')
    else if (typeof v === 'boolean') out[f.key] = v ? 'true' : 'false'
    else out[f.key] = v != null ? String(v) : ''
  }
  return out
}

function buildInput(
  form: Record<string, string>,
  extraForm: Record<string, string>,
  extraFieldDefs: ItemResearchExtraField[],
  research: ItemResearchResult | null,
): object {
  const coerce = (f: FieldDef): unknown => {
    const v = form[f.key] ?? ''
    if (f.type === 'number') return v !== '' ? parseFloat(v) : 0
    if (f.type === 'bool')   return v === 'true'
    if (f.type === 'array')  return v ? v.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : []
    return v
  }
  const base = Object.fromEntries(FIELDS.map(f => [f.key, coerce(f)]))

  const extra: Record<string, unknown> = {}
  for (const ef of extraFieldDefs) {
    const v = extraForm[ef.key] ?? ''
    if (ef.type === 'number' && v !== '') extra[ef.key] = parseFloat(v)
    else if (ef.type === 'bool') extra[ef.key] = v === 'true'
    else if (v !== '') extra[ef.key] = v
  }

  return {
    ...base,
    category: research?.category ?? 'general',
    item_research_context: research?.procurement_context ?? null,
    extra_fields: extra,
  }
}

const inputBase = (missing: boolean, theme: Theme): React.CSSProperties => ({
  width: '100%',
  background: missing ? `${theme.amber}18` : theme.surface,
  border: `1px solid ${missing ? theme.amber : theme.border}`,
  borderRadius: 2,
  padding: '7px 9px',
  fontSize: 14,
  color: missing ? theme.muted : theme.text,
  fontFamily: FONT,
  outline: 'none',
  boxSizing: 'border-box',
})

/* ── Currency field ─────────────────────────────────────────────────── */
function CurrencyField({
  value, missing, onChange, onDisplayChange,
}: {
  value: string
  missing: boolean
  onChange: (crVal: string) => void
  onDisplayChange: (display: string) => void
}) {
  const { theme: C } = useTheme()
  const defaultCurr = CURRENCIES[0]
  const initCrNum = parseFloat(value)

  const [currCode, setCurrCode] = useState(defaultCurr.code)
  const [raw, setRaw] = useState<string>(() => {
    if (!isNaN(initCrNum) && initCrNum > 0)
      return (initCrNum / defaultCurr.toCr).toFixed(2)
    return ''
  })

  const curr = getCurrency(currCode)

  function push(rawVal: string, c: CurrencyCfg) {
    const n = parseFloat(rawVal)
    if (!isNaN(n) && rawVal !== '') {
      onChange((n * c.toCr).toFixed(4))
      onDisplayChange(`${c.symbol}${n % 1 === 0 ? n : n.toFixed(1)}${c.unit}`)
    } else {
      onChange(''); onDisplayChange('')
    }
  }

  function handleAmount(v: string) { setRaw(v); push(v, curr) }
  function handleCurrency(code: string) { const c = getCurrency(code); setCurrCode(code); push(raw, c) }

  const crNum = parseFloat(value)
  const showConv = !isNaN(crNum) && crNum > 0 && currCode !== 'INR_CR'

  const selStyle: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
    padding: '7px 10px', fontSize: 13, color: C.muted, fontFamily: FONT,
    outline: 'none', cursor: 'pointer', flexShrink: 0,
    WebkitAppearance: 'none', appearance: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            fontSize: 17, color: C.textDim, fontFamily: FONT, pointerEvents: 'none', lineHeight: 1,
          }}>
            {curr.symbol}
          </span>
          <input
            type="number" min="0" value={raw}
            placeholder={missing ? '— NEEDS INPUT' : `0 ${curr.unitFull}`}
            onChange={e => handleAmount(e.target.value)}
            style={{ ...inputBase(missing, C), paddingLeft: 22 }}
          />
        </div>
        <select value={currCode} onChange={e => handleCurrency(e.target.value)} style={selStyle}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </div>
      {showConv && (
        <div style={{ marginTop: 4, fontSize: 11, color: C.textDim, letterSpacing: '0.1em' }}>
          = ₹ {crNum.toFixed(1)} Cr  ·  approx rate
        </div>
      )}
    </div>
  )
}

/* ── Field input renderer ───────────────────────────────────────────── */
function FieldInput({ def, value, missing, onChange }: {
  def: FieldDef; value: string; missing: boolean; onChange: (v: string) => void
}) {
  const { theme: C } = useTheme()
  const base = inputBase(missing, C)

  if (def.type === 'bool') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {(['true', 'false'] as const).map(v => {
          const active = value === v
          const isYes = v === 'true'
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, cursor: 'pointer', fontFamily: FONT, borderRadius: 2,
              padding: '6px 0', fontSize: 13, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: active ? (isYes ? C.green + '18' : C.accent + '18') : C.surface,
              border: `1px solid ${active ? (isYes ? C.green : C.accent) : C.border}`,
              color: active ? (isYes ? C.green : C.accent) : C.textDim,
            }}>
              {isYes ? 'YES' : 'NO'}
            </button>
          )
        })}
      </div>
    )
  }

  if (def.type === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        ...base, cursor: 'pointer',
        WebkitAppearance: 'none', appearance: 'none',
      } as React.CSSProperties}>
        {!value && <option value="">—</option>}
        {(def.opts ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      type={def.type === 'number' ? 'number' : 'text'}
      value={value}
      placeholder={missing ? '— NEEDS INPUT' : ''}
      onChange={e => onChange(e.target.value)}
      style={base}
    />
  )
}

/* ── Extra (category-specific) field renderer ───────────────────────── */
function ExtraFieldInput({ def, value, onChange }: {
  def: ItemResearchExtraField; value: string; onChange: (v: string) => void
}) {
  const { theme: C } = useTheme()
  const base = inputBase(false, C)

  if (def.type === 'bool') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {(['true', 'false'] as const).map(v => {
          const active = value === v
          const isYes = v === 'true'
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, cursor: 'pointer', fontFamily: FONT, borderRadius: 2,
              padding: '6px 0', fontSize: 13, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: active ? (isYes ? C.green + '18' : C.accent + '18') : C.surface,
              border: `1px solid ${active ? (isYes ? C.green : C.accent) : C.border}`,
              color: active ? (isYes ? C.green : C.accent) : C.textDim,
            }}>
              {isYes ? 'YES' : 'NO'}
            </button>
          )
        })}
      </div>
    )
  }

  if (def.type === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        ...base, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
      } as React.CSSProperties}>
        {!value && <option value="">—</option>}
        {(def.opts ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      type={def.type === 'number' ? 'number' : 'text'}
      value={value}
      placeholder={def.placeholder ?? ''}
      onChange={e => onChange(e.target.value)}
      style={base}
    />
  )
}

/* ── Research panel ─────────────────────────────────────────────────── */
const CATEGORY_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  aviation:          { bg: '#001a2e', border: '#0066aa', text: '#4da6ff' },
  medical_equipment: { bg: '#0d1a0d', border: '#1a5c1a', text: '#5ccc5c' },
  it_systems:        { bg: '#0d0d22', border: '#3333aa', text: '#6666ee' },
  heavy_machinery:   { bg: '#1a1200', border: '#6b5c00', text: '#d4b800' },
  vehicles:          { bg: '#1a0d00', border: '#7a4500', text: '#e08030' },
  infrastructure:    { bg: '#0d0a1a', border: '#55336b', text: '#aa77cc' },
  general:           { bg: '#0e0e0e', border: '#2a2a2a', text: '#888888' },
}
const CATEGORY_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  aviation:          { bg: '#e8f4ff', border: '#0055aa', text: '#003388' },
  medical_equipment: { bg: '#eaffe8', border: '#1a5c1a', text: '#0a3a0a' },
  it_systems:        { bg: '#ebebff', border: '#3333aa', text: '#222288' },
  heavy_machinery:   { bg: '#fffae6', border: '#6b5c00', text: '#433900' },
  vehicles:          { bg: '#fff4e6', border: '#7a4500', text: '#4a2a00' },
  infrastructure:    { bg: '#f5eeff', border: '#55336b', text: '#33144a' },
  general:           { bg: '#f0f0f0', border: '#777777', text: '#333333' },
}

function ResearchPanel({ result }: { result: ItemResearchResult }) {
  const { theme: C, mode } = useTheme()
  const palette = mode === 'dark' ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT
  const col = palette[result.category] ?? palette.general
  return (
    <div style={{
      border: `1px solid ${col.border}`,
      borderRadius: 2,
      background: col.bg,
      padding: '14px 16px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, letterSpacing: '0.2em', fontFamily: FONT, fontWeight: 700,
          padding: '3px 8px', borderRadius: 2,
          background: col.border + '33', border: `1px solid ${col.border}`,
          color: col.text,
        }}>
          {result.category_label.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: FONT, letterSpacing: '0.12em' }}>
          ITEM RESEARCHED
        </span>
      </div>
      <div style={{ fontSize: 14, color: C.muted, fontFamily: FONT, lineHeight: 1.65, marginBottom: 12 }}>
        {result.procurement_context}
      </div>
      {result.risk_factors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600, marginBottom: 6 }}>
            KEY RISK FACTORS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {result.risk_factors.map((r, i) => (
              <div key={i} style={{ fontSize: 13, color: C.textDim, fontFamily: FONT, lineHeight: 1.5 }}>
                · {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Section header ─────────────────────────────────────────────────── */
function SectionHeader({ label }: { label: string }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      fontSize: 10, letterSpacing: '0.2em', color: C.muted, fontFamily: FONT, fontWeight: 600,
      textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
      borderBottom: `1px solid ${C.border}`, paddingBottom: 6,
    }}>
      {label}
    </div>
  )
}

/* ── Field cell renderer ─────────────────────────────────────────────── */
function FieldCell({ def, form, missing, research, onChange }: {
  def: FieldDef
  form: Record<string, string>
  missing: Set<string>
  research: ItemResearchResult | null
  onChange: (key: string, val: string) => void
}) {
  const { theme: C } = useTheme()
  const isMissing = missing.has(def.key)
  const label = getLabel(def.key, research)
  const wide = def.type === 'array' || def.key === 'procurement_name'
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: isMissing ? C.amber : C.muted, fontFamily: FONT, fontWeight: 600,
        }}>
          {label}
        </span>
        {isMissing && (
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.amber, display: 'inline-block', flexShrink: 0 }} />
        )}
      </div>
      {def.key === 'contract_value_cr' ? (
        <CurrencyField
          value={form[def.key] ?? ''}
          missing={isMissing}
          onChange={v => onChange(def.key, v)}
          onDisplayChange={() => {}}
        />
      ) : (
        <FieldInput
          def={def}
          value={form[def.key] ?? ''}
          missing={isMissing}
          onChange={v => onChange(def.key, v)}
        />
      )}
    </div>
  )
}

/* ── RFQ Guidance panel ─────────────────────────────────────────────── */
function RfqGuidance({ guidance }: { guidance: UiGuidanceResult }) {
  const { theme: C } = useTheme()
  const [open, setOpen] = useState(true)
  const rfq = guidance.rfq_intake ?? {}
  const signals = guidance.risk_or_negotiation_signals ?? []
  const hasContent = (rfq.suggested_requirements?.length ?? 0) > 0 || (rfq.missing_inputs?.length ?? 0) > 0
  if (!hasContent) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 10 : 0,
      }}>
        <span style={{ fontSize: 11, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>RFQ GUIDANCE</span>
        <span style={{ fontSize: 13, color: C.faint, fontFamily: FONT }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rfq.missing_inputs && rfq.missing_inputs.length > 0 && (
            <div style={{ padding: '10px 12px', background: C.amber + '12', border: `1px solid ${C.amber}44`, borderRadius: 2 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', color: C.amber, fontWeight: 600, fontFamily: FONT, marginBottom: 6 }}>MISSING INPUTS</div>
              {rfq.missing_inputs.map((m, i) => (
                <div key={i} style={{ fontSize: 13, color: C.muted, fontFamily: FONT, lineHeight: 1.4 }}>· {m}</div>
              ))}
            </div>
          )}
          {rfq.suggested_requirements && rfq.suggested_requirements.length > 0 && (
            <div style={{ padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', color: C.muted, fontWeight: 600, fontFamily: FONT, marginBottom: 6 }}>SUGGESTED REQUIREMENTS</div>
              {rfq.suggested_requirements.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: C.textDim, fontFamily: FONT, lineHeight: 1.4 }}>· {r}</div>
              ))}
            </div>
          )}
          {signals.length > 0 && (
            <div style={{ padding: '8px 12px', background: C.accent + '12', border: `1px solid ${C.accent}44`, borderRadius: 2 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', color: C.accent, fontWeight: 600, fontFamily: FONT, marginBottom: 5 }}>RISK SIGNALS</div>
              {signals.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: C.textDim, fontFamily: FONT, lineHeight: 1.4 }}>· {s}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main intake view ───────────────────────────────────────────────── */
export interface IntakeViewProps {
  onConfirm: (fields: object, meta: { category: string; research: never[]; missingFields: string[]; contractDisplay?: string }) => void
  onLoadSample: () => void
}

export function IntakeView({ onConfirm, onLoadSample }: IntakeViewProps) {
  const { theme: C } = useTheme()

  // Research state
  const [itemName, setItemName] = useState('')
  const [researchResult, setResearchResult] = useState<ItemResearchResult | null>(null)
  const [researchBusy, setResearchBusy] = useState(false)
  const [extraForm, setExtraForm] = useState<Record<string, string>>({})

  // Document state
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('')
  const [docOpen, setDocOpen] = useState(false)

  // Form state
  const [stage, setStage] = useState<'input' | 'error' | 'ready'>('input')
  const [errMsg, setErrMsg] = useState('')
  const [guidance, setGuidance] = useState<UiGuidanceResult | null>(null)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<Record<string, string>>({})
  const [contractDisplay, setContractDisplay] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── Research handler ───────────────────────────────────────────── */
  const handleResearch = async () => {
    if (!itemName.trim()) return
    setResearchBusy(true)
    try {
      const res = await fetch('/api/research-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ItemResearchResult
      setResearchResult(data)

      // Pre-populate form from suggested_fields
      const s = data.suggested_fields ?? {}
      setForm(prev => {
        const next = { ...prev }
        if (!next.procurement_name && itemName) next.procurement_name = itemName
        if (s.advance_payment_pct != null) next.advance_payment_pct = String(s.advance_payment_pct)
        if (s.delivery_timeline_months != null) next.delivery_timeline_months = String(s.delivery_timeline_months)
        if (s.warranty_start) next.warranty_start = s.warranty_start
        if (s.installation_responsibility) next.installation_responsibility = s.installation_responsibility
        if (s.training_included != null) next.training_included = s.training_included ? 'true' : 'false'
        if (s.construction_completion_pct != null) next.construction_completion_pct = String(s.construction_completion_pct)
        if (s.technicians_required != null) next.technicians_required = String(s.technicians_required)
        if (s.historical_delays_months) next.historical_delays_months = s.historical_delays_months.join(', ')
        return next
      })
      setMissing(new Set())
      setStage('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStage('error')
    } finally {
      setResearchBusy(false)
    }
  }

  /* ── Document handlers ──────────────────────────────────────────── */
  const handleAnalyzeDoc = async () => {
    const payload = text.trim()
    if (!payload) return
    setBusy(true); setBusyMsg('ANALYZING...')
    try {
      const res = await fetch('/api/ui-guidance/rfq-negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_text: payload, mode: 'rfq_intake', store_history: false }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as UiGuidanceResult
      setGuidance(data)
      setMissing(new Set())
      setStage('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStage('error')
    } finally {
      setBusy(false); setBusyMsg('')
    }
  }

  const processFile = async (file: File) => {
    setBusy(true); setBusyMsg('EXTRACTING...')
    setFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const extracted = (data.extracted_fields ?? {}) as Record<string, unknown>
      const miss: string[] = data.missing_fields ?? []
      setMissing(new Set(miss))
      setGuidance(null)
      setForm(fieldsToForm(extracted, miss))
      setStage('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStage('error')
    } finally {
      setBusy(false); setBusyMsg('')
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }

  /* ── Form handlers ──────────────────────────────────────────────── */
  const handleRun = () => onConfirm(
    buildInput(form, extraForm, researchResult?.extra_fields ?? [], researchResult),
    { category: researchResult?.category ?? '', research: [], missingFields: Array.from(missing), contractDisplay },
  )
  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))
  const setExtraField = (key: string, val: string) => setExtraForm(p => ({ ...p, [key]: val }))

  /* ── Styles ─────────────────────────────────────────────────────── */
  const ghostBtn = (active = false): React.CSSProperties => ({
    background: 'none', border: `1px solid ${active ? C.muted : C.border}`,
    borderRadius: 2, padding: '5px 14px', fontSize: 13,
    letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT,
    color: active ? C.text : C.muted, cursor: 'pointer',
  })

  const extraFields = researchResult?.extra_fields ?? []
  const showSite = researchResult == null || researchResult.requires_site_readiness

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{
      flex: 1, overflowY: 'auto', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      padding: '36px 24px 60px', background: C.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 620 }}>

        {/* ── Step 1: Item Name + Research ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600, marginBottom: 6 }}>
            WHAT ARE YOU PROCURING?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleResearch()}
              placeholder="e.g.  Boeing 737 MAX  ·  MRI Machine  ·  SAP ERP System  ·  3 Ton Crane"
              style={{
                flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 2, padding: '9px 12px', fontSize: 14, color: C.text,
                fontFamily: FONT, outline: 'none',
              }}
            />
            <button
              onClick={handleResearch}
              disabled={researchBusy || !itemName.trim()}
              style={{
                background: researchBusy ? C.surface2 : C.purple + '20',
                color: researchBusy ? C.muted : C.purple,
                border: `1px solid ${researchBusy ? C.border : C.purple + '88'}`,
                borderRadius: 2, padding: '9px 18px',
                fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: FONT, fontWeight: 700, cursor: researchBusy ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {researchBusy ? 'RESEARCHING...' : 'RESEARCH →'}
            </button>
          </div>
        </div>

        {/* ── Research result panel ── */}
        {researchResult && <ResearchPanel result={researchResult} />}

        {/* ── Step 2: Document (collapsible) ── */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setDocOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: docOpen ? 12 : 0,
          }}>
            <span style={{ fontSize: 11, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>
              DOCUMENT / PASTE TEXT
            </span>
            <span style={{ fontSize: 13, color: C.faint, fontFamily: FONT }}>{docOpen ? '▲' : '▼'}</span>
          </button>
          {docOpen && (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste full tender / RFQ text here…"
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 2, padding: '10px 12px',
                  fontSize: 14, color: C.text, fontFamily: FONT,
                  outline: 'none', resize: 'vertical', lineHeight: 1.6, marginBottom: 8,
                }}
              />
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `1px dashed ${dragging ? C.muted : C.border}`,
                  borderRadius: 2, padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', marginBottom: 10,
                  background: dragging ? C.surface2 : 'transparent',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <span style={{ fontSize: 13, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
                  {fileName ? `↑ ${fileName}` : 'DROP FILE  /  BROWSE'}
                </span>
                {fileName && (
                  <button onClick={e => { e.stopPropagation(); setFileName(null); setStage('input') }}
                    style={{ ...ghostBtn(), marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>
                    ✕
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }} onChange={handleFileInput} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAnalyzeDoc}
                  disabled={busy || !text.trim()}
                  style={{
                    background: busy ? '#1a0808' : C.accent,
                    color: busy ? '#5a2a2a' : '#080808',
                    border: `1px solid ${busy ? '#3a1010' : C.accent}`,
                    borderRadius: 2, padding: '7px 20px',
                    fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase',
                    fontFamily: FONT, fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? busyMsg : 'ANALYZE DOCUMENT'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Action row ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={onLoadSample} style={ghostBtn()}>LOAD SAMPLE</button>
          <button
            onClick={() => { setStage('ready'); setMissing(new Set()) }}
            style={ghostBtn(stage === 'ready' && !researchResult)}
          >
            MANUAL ENTRY
          </button>
          {(stage !== 'input' || researchResult) && (
            <button onClick={() => {
              setStage('input'); setFileName(null); setText(''); setGuidance(null)
              setResearchResult(null); setForm({}); setExtraForm({})
            }} style={{ ...ghostBtn(), marginLeft: 'auto' }}>
              CLEAR
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {stage === 'error' && (
          <div style={{ border: `1px solid ${C.accent}44`, borderRadius: 2, background: C.accent + '12', padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: C.accent, marginBottom: 6, fontFamily: FONT, fontWeight: 700 }}>ERROR</div>
            <div style={{ fontSize: 14, color: C.accent, fontFamily: FONT, lineHeight: 1.6 }}>{errMsg}</div>
          </div>
        )}

        {/* ── Ready: form ── */}
        {stage === 'ready' && (
          <>
            {guidance && <RfqGuidance guidance={guidance} />}

            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 20 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>
                PROCUREMENT FIELDS
              </span>
              {researchResult && (
                <span style={{ fontSize: 11, letterSpacing: '0.14em', color: C.purple, fontFamily: FONT }}>
                  PRE-FILLED FROM RESEARCH
                </span>
              )}
              {missing.size > 0 && (
                <span style={{ fontSize: 11, color: C.amber, letterSpacing: '0.1em', fontFamily: FONT }}>
                  {missing.size} NEEDS INPUT
                </span>
              )}
            </div>

            {/* ── Identity ── */}
            <SectionHeader label="ITEM IDENTITY" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {FIELDS.filter(f => ['procurement_name', 'equipment_type'].includes(f.key)).map(f => (
                <FieldCell key={f.key} def={f} form={form} missing={missing} research={researchResult}
                  onChange={(key, val) => {
                    setField(key, val)
                    if (key === 'contract_value_cr') setContractDisplay(val)
                  }}
                />
              ))}
            </div>

            {/* ── Contract ── */}
            <SectionHeader label="CONTRACT TERMS" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {FIELDS.filter(f => GROUP_CONTRACT.includes(f.key)).map(f => (
                <FieldCell key={f.key} def={f} form={form} missing={missing} research={researchResult}
                  onChange={(key, val) => {
                    setField(key, val)
                    if (key === 'contract_value_cr') setContractDisplay(val)
                  }}
                />
              ))}
            </div>

            {/* ── Site Readiness (conditional) ── */}
            {showSite && (
              <>
                <SectionHeader label={researchResult?.site_label?.toUpperCase() ?? 'SITE READINESS'} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {FIELDS.filter(f => GROUP_SITE.includes(f.key)).map(f => (
                    <FieldCell key={f.key} def={f} form={form} missing={missing} research={researchResult}
                      onChange={setField}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Workforce ── */}
            <SectionHeader label={`${researchResult?.workforce_label?.toUpperCase() ?? 'WORKFORCE'} READINESS`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {FIELDS.filter(f => GROUP_WORKFORCE.includes(f.key)).map(f => (
                <FieldCell key={f.key} def={f} form={form} missing={missing} research={researchResult}
                  onChange={setField}
                />
              ))}
            </div>

            {/* ── History ── */}
            <SectionHeader label="HISTORICAL DATA" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {FIELDS.filter(f => GROUP_HISTORY.includes(f.key)).map(f => (
                <FieldCell key={f.key} def={f} form={form} missing={missing} research={researchResult}
                  onChange={setField}
                />
              ))}
            </div>

            {/* ── Category-specific extra fields ── */}
            {extraFields.length > 0 && (
              <>
                <SectionHeader label={`${researchResult?.category_label?.toUpperCase() ?? 'CATEGORY'} SPECIFIC`} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {extraFields.map(ef => (
                    <div key={ef.key}>
                      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, fontFamily: FONT, fontWeight: 600, marginBottom: 4 }}>
                        {ef.label}
                      </div>
                      <ExtraFieldInput
                        def={ef}
                        value={extraForm[ef.key] ?? ''}
                        onChange={v => setExtraField(ef.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Run button ── */}
            <button
              onClick={handleRun}
              style={{
                width: '100%', background: C.accent, color: C.bg,
                border: `1px solid ${C.accent}`, borderRadius: 2,
                padding: '10px 0', fontSize: 14, letterSpacing: '0.18em',
                textTransform: 'uppercase', fontFamily: FONT, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              RUN ANALYSIS →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
