import { useEffect, useRef, useState } from 'react'
import type { Bid } from './types'
import { useTheme } from './theme'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"

/* Folder scanned by the backend — matches SAMPLES_DIR / "bids" */
const SCAN_FOLDER = 'files/input/samples/bids/'

function Lbl({ children }: { children: string }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT,
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
      borderRadius: 2, padding: '5px 14px', fontSize: 13,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontFamily: FONT, fontWeight: variant === 'accent' ? 700 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  )
}

function statusColor(status: string, C: { muted: string; green: string; textDim: string }) {
  if (status === 'discovered') return C.muted
  if (status === 'active') return C.green
  return C.textDim
}

export interface BidDashboardProps {
  onSelectBid: (bid: Bid) => void
  onUpload: (bid: Bid) => void
}

export function BidDashboard({ onSelectBid, onUpload }: BidDashboardProps) {
  const { theme: C } = useTheme()
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [scanResult, setScanResult] = useState<{ indexed: number; quotes: number; newBids: number; newQuotes: number } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [procName, setProcName] = useState('')
  const [eqType, setEqType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  async function fetchBids() {
    try {
      const r = await fetch('/api/bids')
      if (!r.ok) {
        const body = await r.text()
        throw new Error(r.status === 404
          ? 'Backend not reachable — is the server running on :8000?'
          : body
        )
      }
      const data = await r.json()
      setBids(data.bids ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBids() }, [])
  useEffect(() => { if (showCreate) nameRef.current?.focus() }, [showCreate])

  async function handleScan() {
    setScanning(true); setScanResult(null); setError(null)
    try {
      const r = await fetch('/api/input/scan', { method: 'POST' })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setScanResult({
        indexed: data.bids_indexed ?? 0,
        quotes: data.quotes_indexed ?? 0,
        newBids: data.new_bids ?? 0,
        newQuotes: data.new_quotes ?? 0,
      })
      await fetchBids()
    } catch (e) {
      setError(String(e))
    } finally {
      setScanning(false)
    }
  }

  async function handleCreate() {
    if (!procName.trim()) return
    setCreating(true)
    try {
      const r = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procurement_name: procName.trim(), equipment_type: eqType.trim() }),
      })
      if (!r.ok) throw new Error(await r.text())
      const newBid: Bid & { bid_id: string } = await r.json()
      setShowCreate(false); setProcName(''); setEqType('')
      await fetchBids()
      // Jump straight to quote upload for the newly created bid
      if (newBid.bid_id) {
        onUpload({ bid_id: newBid.bid_id, procurement_name: procName.trim(), equipment_type: eqType.trim(), quote_count: 0, status: 'created' })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const inp = (value: string, onChange: (v: string) => void, placeholder: string, ref?: React.RefObject<HTMLInputElement | null>) => (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e => e.key === 'Enter' && handleCreate()}
      style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2,
        padding: '6px 10px', fontSize: 14, color: C.text, fontFamily: FONT,
        outline: 'none', width: '100%', boxSizing: 'border-box',
      }}
    />
  )

  return (
    <div style={{
      flex: 1, overflow: 'auto', padding: '32px 40px',
      background: C.bg, fontFamily: FONT,
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.06em', color: C.text }}>
            BID EVALUATION
          </div>
          <div style={{ fontSize: 13, color: C.textDim, letterSpacing: '0.12em', marginTop: 2 }}>
            SELECT A BID TO UPLOAD QUOTES AND RUN EVALUATION
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleScan} disabled={scanning}>
              {scanning ? 'SCANNING···' : 'SCAN FOLDER'}
            </Btn>
            <Btn variant="accent" onClick={() => setShowCreate(v => !v)}>
              + NEW BID
            </Btn>
          </div>
          {/* Folder path hint */}
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em', textAlign: 'right' }}>
            scans: <span style={{ color: C.textDim }}>{SCAN_FOLDER}</span>
          </div>
        </div>
      </div>

      {/* Scan result banner */}
      {scanResult !== null && (
        <div style={{
          fontSize: 13, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 2, padding: '10px 14px', marginBottom: 16,
          display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '0 20px',
          justifyContent: 'start', alignItems: 'center',
        }}>
          {[
            { l: 'BIDS INDEXED',  v: scanResult.indexed  },
            { l: 'QUOTES INDEXED', v: scanResult.quotes   },
            { l: 'NEW BIDS',      v: `+${scanResult.newBids}`   },
            { l: 'NEW QUOTES',    v: `+${scanResult.newQuotes}` },
          ].map(({ l, v }) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.14em', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{v}</div>
            </div>
          ))}
          <div style={{ gridColumn: '1/-1', marginTop: 8, fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
            folder: {SCAN_FOLDER}
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Lbl>NEW BID</Lbl>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '0.08em' }}>
              you'll be taken straight to quote upload
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp(procName, setProcName, 'Procurement name...', nameRef)}
            {inp(eqType, setEqType, 'Equipment type (optional)...')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn variant="accent" onClick={handleCreate} disabled={creating || !procName.trim()}>
              {creating ? 'CREATING···' : 'CREATE + UPLOAD QUOTES →'}
            </Btn>
            <Btn onClick={() => { setShowCreate(false); setProcName(''); setEqType('') }}>
              CANCEL
            </Btn>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 13, color: C.accent, background: C.accent + '12',
          border: `1px solid ${C.accent}44`, borderRadius: 2,
          padding: '8px 12px', marginBottom: 16, lineHeight: 1.6,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: '0.18em' }}>LOADING···</div>
      ) : bids.length === 0 ? (
        <div style={{
          fontSize: 14, color: C.muted, textAlign: 'center',
          padding: '60px 0', letterSpacing: '0.1em',
        }}>
          NO BIDS — SCAN FOLDER OR CREATE ONE
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {bids.map(bid => (
            <div
              key={bid.bid_id}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
                transition: 'border-color 0.15s', overflow: 'hidden',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              {/* Card body — click to select (goes to quote list) */}
              <div
                onClick={() => onSelectBid(bid)}
                style={{ padding: '16px 18px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 600, lineHeight: 1.4 }}>
                      {bid.procurement_name || bid.bid_id}
                    </div>
                    {bid.equipment_type && (
                      <div style={{ fontSize: 13, color: C.textDim, marginTop: 3 }}>{bid.equipment_type}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, letterSpacing: '0.15em', color: statusColor(bid.status, C),
                    border: `1px solid ${statusColor(bid.status, C)}22`, borderRadius: 2,
                    padding: '2px 6px', flexShrink: 0, marginTop: 1,
                  }}>
                    {bid.status.toUpperCase()}
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 14,
                }}>
                  <div style={{ fontSize: 13, color: C.muted }}>
                    <span style={{ color: C.textDim }}>{bid.quote_count}</span>
                    {' '}QUOTE{bid.quote_count !== 1 ? 'S' : ''}
                  </div>
                  <span style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
                    {bid.bid_id}
                  </span>
                </div>
              </div>

              {/* Action footer */}
              <div style={{
                borderTop: `1px solid ${C.border}`,
                display: 'grid', gridTemplateColumns: '1fr 1fr',
              }}>
                <button
                  onClick={() => onSelectBid(bid)}
                  style={{
                    background: 'none', border: 'none', borderRight: `1px solid ${C.border}`,
                    padding: '8px 0', fontSize: 11, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: C.muted, fontFamily: FONT,
                    cursor: 'pointer',
                  }}
                >
                  VIEW QUOTES
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onUpload(bid) }}
                  style={{
                    background: 'none', border: 'none',
                    padding: '8px 0', fontSize: 11, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: C.accent, fontFamily: FONT,
                    cursor: 'pointer',
                  }}
                >
                  UPLOAD PDF ↑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
