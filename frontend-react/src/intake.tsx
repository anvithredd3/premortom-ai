import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import type { ProfileResponse, ResearchItem } from './types'

/* ── Theme ──────────────────────────────────────────────────────────── */
const C = {
  bg: '#080808',
  surface: '#0d0d0d',
  border: '#1a1a1a',
  borderMid: '#222',
  text: '#d8d8d8',
  muted: '#555',
  faint: '#2e2e2e',
  accent: '#ff2222',
  amber: '#f59e0b',
  green: '#22c55e',
} as const

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

const FIELDS: FieldDef[] = [
  { key: 'procurement_name',          label: 'PROCUREMENT NAME',              type: 'text' },
  { key: 'equipment_type',            label: 'EQUIPMENT TYPE',                type: 'text' },
  { key: 'contract_value_cr',         label: 'CONTRACT VALUE',                type: 'number' },
  { key: 'advance_payment_pct',       label: 'ADVANCE PAYMENT %',             type: 'number' },
  { key: 'delivery_timeline_months',  label: 'DELIVERY TIMELINE (months)',    type: 'number' },
  { key: 'warranty_start',            label: 'WARRANTY START',                type: 'select', opts: ['On Delivery', 'On Commissioning', 'On Installation'] },
  { key: 'installation_responsibility', label: 'INSTALLATION BY',             type: 'text' },
  { key: 'training_included',         label: 'TRAINING INCLUDED',             type: 'bool' },
  { key: 'construction_completion_pct', label: 'CONSTRUCTION COMPLETION %',   type: 'number' },
  { key: 'electrical_readiness',      label: 'ELECTRICAL READINESS',          type: 'select', opts: ['Approved', 'Pending', 'Not Started'] },
  { key: 'regulatory_approval_status', label: 'REGULATORY APPROVAL',          type: 'select', opts: ['Approved', 'Pending', 'Not Started'] },
  { key: 'technicians_available',     label: 'TECHNICIANS AVAILABLE',         type: 'number' },
  { key: 'technicians_required',      label: 'TECHNICIANS REQUIRED',          type: 'number' },
  { key: 'historical_delays_months',  label: 'PAST DELAYS (months, comma-sep)', type: 'array' },
]

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

function buildInput(form: Record<string, string>): object {
  const coerce = (f: FieldDef): unknown => {
    const v = form[f.key] ?? ''
    if (f.type === 'number') return v !== '' ? parseFloat(v) : 0
    if (f.type === 'bool')   return v === 'true'
    if (f.type === 'array')  return v ? v.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : []
    return v
  }
  return Object.fromEntries(FIELDS.map(f => [f.key, coerce(f)]))
}

const inputBase = (missing: boolean): React.CSSProperties => ({
  width: '100%',
  background: missing ? '#100c00' : '#0a0a0a',
  border: `1px solid ${missing ? C.amber : C.border}`,
  borderRadius: 2,
  padding: '7px 9px',
  fontSize: 10,
  color: missing ? C.muted : C.text,
  fontFamily: FONT,
  outline: 'none',
  boxSizing: 'border-box',
})

/* ── Currency field ─────────────────────────────────────────────────── */
function CurrencyField({
  value, missing, onChange, onDisplayChange,
}: {
  value: string               // INR Cr string (backend-facing)
  missing: boolean
  onChange: (crVal: string) => void
  onDisplayChange: (display: string) => void
}) {
  const defaultCurr = CURRENCIES[0]  // USD M
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

  function handleCurrency(code: string) {
    const c = getCurrency(code); setCurrCode(code); push(raw, c)
  }

  const crNum = parseFloat(value)
  const showConv = !isNaN(crNum) && crNum > 0 && currCode !== 'INR_CR'

  const selStyle: React.CSSProperties = {
    background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 2,
    padding: '7px 10px', fontSize: 9, color: C.muted, fontFamily: FONT,
    outline: 'none', cursor: 'pointer', flexShrink: 0,
    WebkitAppearance: 'none', appearance: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: '#4a4a4a', fontFamily: FONT, pointerEvents: 'none', lineHeight: 1,
          }}>
            {curr.symbol}
          </span>
          <input
            type="number" min="0" value={raw}
            placeholder={missing ? '— NEEDS INPUT' : `0 ${curr.unitFull}`}
            onChange={e => handleAmount(e.target.value)}
            style={{ ...inputBase(missing), paddingLeft: 22 }}
          />
        </div>
        <select value={currCode} onChange={e => handleCurrency(e.target.value)} style={selStyle}>
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>
      {showConv && (
        <div style={{ marginTop: 4, fontSize: 8, color: '#3a3a3a', letterSpacing: '0.1em' }}>
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
  const base = inputBase(missing)

  if (def.type === 'bool') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {(['true', 'false'] as const).map(v => {
          const active = value === v
          const isYes = v === 'true'
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, cursor: 'pointer', fontFamily: FONT, borderRadius: 2,
              padding: '6px 0', fontSize: 9, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: active ? (isYes ? '#0a1a0a' : '#1a0a0a') : '#0a0a0a',
              border: `1px solid ${active ? (isYes ? C.green : C.accent) : C.border}`,
              color: active ? (isYes ? C.green : C.accent) : '#3a3a3a',
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

/* ── Research accordion ─────────────────────────────────────────────── */
function Research({ items }: { items: ResearchItem[] }) {
  const [open, setOpen] = useState(true)
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, marginBottom: open ? 10 : 0,
      }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>
          RESEARCH FINDINGS
        </span>
        <span style={{ fontSize: 9, color: C.faint, fontFamily: FONT }}>
          ({items.length}) {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((r, i) => (
            <div key={i} style={{
              padding: '8px 10px', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 2,
            }}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" style={{
                  fontSize: 9, color: '#6a9fd8', textDecoration: 'none',
                  letterSpacing: '0.03em', fontFamily: FONT, display: 'block', marginBottom: 3,
                }}>
                  ↗ {r.title || r.url}
                </a>
              ) : (
                <div style={{ fontSize: 9, color: C.muted, fontFamily: FONT, marginBottom: 3 }}>
                  {r.title}
                </div>
              )}
              {r.snippet && (
                <div style={{ fontSize: 9, color: '#444', lineHeight: 1.5, fontFamily: FONT }}>
                  {r.snippet.slice(0, 140)}{r.snippet.length > 140 ? '…' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main intake view ───────────────────────────────────────────────── */
export interface IntakeViewProps {
  onConfirm: (fields: object, meta: { category: string; research: ResearchItem[]; missingFields: string[]; contractDisplay?: string }) => void
  onLoadSample: () => void
}

export function IntakeView({ onConfirm, onLoadSample }: IntakeViewProps) {
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('')
  const [stage, setStage] = useState<'input' | 'out_of_scope' | 'ready'>('input')
  const [outReason, setOutReason] = useState('')
  const [category, setCategory] = useState('')
  const [research, setResearch] = useState<ResearchItem[]>([])
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<Record<string, string>>({})
  const [contractDisplay, setContractDisplay] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── Handlers ────────────────────────────────────────────────────── */
  const handleAnalyze = async () => {
    const payload = text.trim()
    if (!payload) return
    setBusy(true); setBusyMsg('PROFILING...')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ProfileResponse
      if (data.status === 'OUT_OF_SCOPE') {
        setOutReason(data.reason ?? 'Not a procurement document.')
        setStage('out_of_scope')
      } else {
        setCategory(data.category ?? '')
        setResearch(data.research ?? [])
        const miss = new Set(data.missing_fields ?? [])
        setMissing(miss)
        setForm(fieldsToForm(data.proposed_fields ?? {}, data.missing_fields ?? []))
        setStage('ready')
      }
    } catch (e) {
      setOutReason(e instanceof Error ? e.message : String(e))
      setStage('out_of_scope')
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
      setCategory('')
      setResearch([])
      setForm(fieldsToForm(extracted, miss))
      setStage('ready')
    } catch (e) {
      setOutReason(e instanceof Error ? e.message : String(e))
      setStage('out_of_scope')
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

  const handleRun = () => onConfirm(buildInput(form), { category, research, missingFields: Array.from(missing), contractDisplay })

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  /* ── Shared input styles ─────────────────────────────────────────── */
  const ghostBtn = (active = false): React.CSSProperties => ({
    background: 'none', border: `1px solid ${active ? C.muted : C.border}`,
    borderRadius: 2, padding: '5px 14px', fontSize: 9,
    letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT,
    color: active ? C.text : C.muted, cursor: 'pointer',
  })

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div style={{
      flex: 1, overflowY: 'auto', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      padding: '36px 24px 60px',
      background: C.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 620 }}>

        {/* ── Input zone ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.muted, fontWeight: 600, marginBottom: 6,
          }}>
            PRODUCT NAME OR PASTE DOCUMENT TEXT
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g.  Bruel &amp; Kjaer HATS Type 4128   or paste full tender text…"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0a0a0a', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '10px 12px',
              fontSize: 10, color: C.text, fontFamily: FONT,
              outline: 'none', resize: 'vertical', lineHeight: 1.6,
            }}
          />
        </div>

        {/* ── File drop zone ── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? C.muted : C.border}`,
            borderRadius: 2, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 14,
            background: dragging ? '#0e0e0e' : 'transparent',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <span style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
            {fileName ? `↑ ${fileName}` : 'DROP FILE  /  BROWSE'}
          </span>
          {fileName && (
            <button onClick={e => { e.stopPropagation(); setFileName(null); setStage('input') }}
              style={{ ...ghostBtn(), marginLeft: 'auto', padding: '2px 8px', fontSize: 8 }}>
              ✕
            </button>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>

        {/* ── Action row ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <button
            onClick={handleAnalyze}
            disabled={busy || (!text.trim() && !fileName)}
            style={{
              background: busy ? '#1a0808' : C.accent,
              color: busy ? '#5a2a2a' : '#080808',
              border: `1px solid ${busy ? '#3a1010' : C.accent}`,
              borderRadius: 2, padding: '7px 22px',
              fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
              fontFamily: FONT, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? busyMsg : 'ANALYZE'}
          </button>
          <button onClick={onLoadSample} style={ghostBtn()}>LOAD SAMPLE</button>
          {stage !== 'input' && (
            <button onClick={() => { setStage('input'); setFileName(null); setText('') }}
              style={{ ...ghostBtn(), marginLeft: 'auto' }}>
              CLEAR
            </button>
          )}
        </div>

        {/* ── Out of scope ── */}
        {stage === 'out_of_scope' && (
          <div style={{
            border: `1px solid #3a1010`, borderRadius: 2,
            background: '#110808', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.18em', color: C.accent, marginBottom: 6, fontFamily: FONT, fontWeight: 700 }}>
              OUT OF SCOPE
            </div>
            <div style={{ fontSize: 10, color: '#c07070', fontFamily: FONT, lineHeight: 1.6 }}>
              {outReason}
            </div>
          </div>
        )}

        {/* ── Ready: research + form ── */}
        {stage === 'ready' && (
          <>
            {/* Category badge */}
            {category && (
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 8, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>
                  CATEGORY
                </span>
                <span style={{
                  fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
                  background: '#0a1a10', border: `1px solid #1a3a20`,
                  color: C.green, borderRadius: 2, padding: '3px 8px', fontFamily: FONT, fontWeight: 600,
                }}>
                  {category}
                </span>
              </div>
            )}

            {/* Research */}
            <Research items={research} />

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 20 }} />

            {/* Fields header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 8, letterSpacing: '0.18em', color: C.muted, fontFamily: FONT, fontWeight: 600 }}>
                PROPOSED FIELDS
              </span>
              {missing.size > 0 && (
                <span style={{ fontSize: 8, color: C.amber, letterSpacing: '0.1em', fontFamily: FONT }}>
                  {missing.size} NEEDS INPUT
                </span>
              )}
            </div>

            {/* Fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {FIELDS.map(f => {
                const isMissing = missing.has(f.key)
                // wide fields span both columns
                const wide = f.type === 'array' || f.key === 'procurement_name'
                return (
                  <div key={f.key} style={wide ? { gridColumn: '1 / -1' } : {}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: isMissing ? C.amber : C.muted, fontFamily: FONT, fontWeight: 600,
                      }}>
                        {f.label}
                      </span>
                      {isMissing && (
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.amber, display: 'inline-block', flexShrink: 0 }} />
                      )}
                    </div>
                    {f.key === 'contract_value_cr' ? (
                      <CurrencyField
                        value={form[f.key] ?? ''}
                        missing={isMissing}
                        onChange={v => setField(f.key, v)}
                        onDisplayChange={setContractDisplay}
                      />
                    ) : (
                      <FieldInput
                        def={f}
                        value={form[f.key] ?? ''}
                        missing={isMissing}
                        onChange={v => setField(f.key, v)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              style={{
                width: '100%', background: C.accent, color: '#080808',
                border: `1px solid ${C.accent}`, borderRadius: 2,
                padding: '10px 0', fontSize: 10, letterSpacing: '0.18em',
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
