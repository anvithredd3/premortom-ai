import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bid, Quote } from './types'
import { useTheme } from './theme'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"

function Lbl({ children, style }: { children: string; style?: React.CSSProperties }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT, ...style,
    }}>
      {children}
    </span>
  )
}

function Btn({
  onClick, disabled, children, variant = 'ghost',
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'ghost' | 'accent'
}) {
  const { theme: C } = useTheme()
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: variant === 'accent' ? C.accent : 'transparent',
      color: disabled ? C.red : variant === 'accent' ? C.bg : C.muted,
      border: `1px solid ${disabled ? C.red : variant === 'accent' ? C.accent : C.border}`,
      borderRadius: 2, padding: '5px 14px', fontSize: 9,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontFamily: FONT, fontWeight: variant === 'accent' ? 700 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  )
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  catch { return '—' }
}

export interface QuoteUploadProps {
  bid: Bid
  onBack: () => void
  onStartRun: (quoteIds: string[]) => void
}

export function QuoteUpload({ bid, onBack, onStartRun }: QuoteUploadProps) {
  const { theme: C } = useTheme()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchQuotes() {
    try {
      const r = await fetch(`/api/bids/${bid.bid_id}/quotes`)
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      const qs: Quote[] = data.quotes ?? []
      setQuotes(qs)
      setSelected(new Set(qs.map((q: Quote) => q.quote_id)))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQuotes() }, [bid.bid_id])

  async function upload(file: File) {
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('vendor_name', vendorName.trim())
    try {
      const r = await fetch(`/api/bids/${bid.bid_id}/quotes`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(await r.text())
      const q: Quote = await r.json()
      setQuotes(prev => [...prev, q])
      setSelected(prev => new Set([...prev, q.quote_id]))
      setVendorName('')
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [vendorName])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  function toggleQuote(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const canRun = selected.size > 0 && !loading

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: C.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#3a3a3a',
          fontFamily: FONT, fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', cursor: 'pointer', padding: 0,
        }}>
          ← BACK
        </button>
        <div style={{ width: 1, height: 12, background: C.border }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '0.05em' }}>
            {bid.procurement_name || bid.bid_id}
          </div>
          <div style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '0.12em', marginTop: 2 }}>
            {bid.bid_id}{bid.equipment_type ? ` · ${bid.equipment_type}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Btn
            variant="accent"
            disabled={!canRun}
            onClick={() => onStartRun([...selected])}
          >
            RUN EVALUATION ({selected.size})
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Quote list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Lbl>QUOTES</Lbl>
            {quotes.length > 0 && (
              <button
                onClick={() =>
                  setSelected(
                    selected.size === quotes.length
                      ? new Set()
                      : new Set(quotes.map(q => q.quote_id))
                  )
                }
                style={{
                  background: 'none', border: 'none', fontFamily: FONT, fontSize: 8,
                  color: '#3a3a3a', letterSpacing: '0.12em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {selected.size === quotes.length ? 'DESELECT ALL' : 'SELECT ALL'}
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ fontSize: 9, color: '#2e2e2e', letterSpacing: '0.18em' }}>LOADING···</div>
          ) : quotes.length === 0 ? (
            <div style={{
              fontSize: 10, color: '#2a2a2a', textAlign: 'center',
              padding: '40px 0', letterSpacing: '0.1em',
            }}>
              NO QUOTES YET — UPLOAD PDFs
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {quotes.map(q => {
                const checked = selected.has(q.quote_id)
                return (
                  <div
                    key={q.quote_id}
                    onClick={() => toggleQuote(q.quote_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: checked ? '#0e0e0e' : C.surface,
                      border: `1px solid ${checked ? '#2a2a2a' : C.border}`,
                      borderRadius: 2, padding: '12px 14px', cursor: 'pointer',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 12, height: 12, borderRadius: 1, flexShrink: 0,
                      border: `1px solid ${checked ? C.accent : '#2e2e2e'}`,
                      background: checked ? C.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checked && (
                        <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                          <path d="M1 3l2 2 3-4" stroke="#080808" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: C.text, fontWeight: 500 }}>
                        {q.vendor_name || q.original_filename || q.quote_id}
                      </div>
                      {q.vendor_name && q.original_filename && (
                        <div style={{ fontSize: 8, color: '#3a3a3a', marginTop: 2 }}>
                          {q.original_filename}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: '#2e2e2e', flexShrink: 0 }}>
                      {fmtDate(q.created_at)}
                    </div>
                    <div style={{ fontSize: 7, color: '#2a2a2a', flexShrink: 0, letterSpacing: '0.1em' }}>
                      {q.quote_id}
                    </div>
                    <div style={{
                      fontSize: 7, letterSpacing: '0.12em',
                      color: q.source === 'upload' ? C.green : '#3a3a3a',
                    }}>
                      {q.source?.toUpperCase()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upload panel */}
        <div>
          <Lbl style={{ display: 'block', marginBottom: 12 }}>UPLOAD QUOTE</Lbl>

          {/* Vendor name */}
          <div style={{ marginBottom: 8 }}>
            <input
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="Vendor name (optional)..."
              style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2,
                padding: '6px 10px', fontSize: 10, color: C.text, fontFamily: FONT,
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1px dashed ${dragOver ? C.accent : '#2a2a2a'}`,
              borderRadius: 2, padding: '32px 16px',
              textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
              transition: 'border-color 0.15s',
              background: dragOver ? '#120a0a' : 'transparent',
            }}
          >
            <input
              ref={fileRef} type="file" accept=".pdf"
              style={{ display: 'none' }} onChange={handleFile}
            />
            <div style={{ fontSize: 18, marginBottom: 10, color: '#2a2a2a' }}>↑</div>
            <div style={{ fontSize: 9, color: '#3a3a3a', letterSpacing: '0.12em' }}>
              {uploading ? 'UPLOADING···' : 'DROP PDF OR CLICK'}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 10, fontSize: 8, color: C.accent,
              background: '#1a0808', border: '1px solid #3a1010',
              borderRadius: 2, padding: '6px 10px', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Run summary */}
          {quotes.length > 0 && (
            <div style={{
              marginTop: 20, background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '12px 14px',
            }}>
              <Lbl style={{ display: 'block', marginBottom: 10 }}>EVALUATION SCOPE</Lbl>
              <div style={{ fontSize: 10, color: C.text, marginBottom: 4 }}>
                {selected.size} / {quotes.length} quotes selected
              </div>
              <div style={{ fontSize: 9, color: '#3a3a3a', lineHeight: 1.6 }}>
                Each quote will be reviewed by the Contract Risk Agent and ranked by Bid Recommender.
              </div>
              <div style={{ marginTop: 12 }}>
                <Btn variant="accent" disabled={!canRun} onClick={() => onStartRun([...selected])}>
                  START RUN →
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
