import { useEffect, useRef, useState } from 'react'
import type { Bid } from './types'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const C = {
  bg: '#080808', surface: '#0d0d0d', border: '#1a1a1a',
  text: '#d8d8d8', muted: '#555', faint: '#2e2e2e',
  accent: '#ff2222', green: '#22c55e', amber: '#f59e0b',
} as const
const FONT = "'JetBrains Mono', monospace"

function Lbl({ children }: { children: string }) {
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
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
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: variant === 'accent' ? C.accent : 'transparent',
      color: disabled ? '#5a2a2a' : variant === 'accent' ? '#080808' : C.muted,
      border: `1px solid ${disabled ? '#3a1010' : variant === 'accent' ? C.accent : C.border}`,
      borderRadius: 2, padding: '5px 14px', fontSize: 9,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      fontFamily: FONT, fontWeight: variant === 'accent' ? 700 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {children}
    </button>
  )
}

function statusColor(status: string) {
  if (status === 'discovered') return C.muted
  if (status === 'active') return C.green
  return '#3a3a3a'
}

export interface BidDashboardProps {
  onSelectBid: (bid: Bid) => void
}

export function BidDashboard({ onSelectBid }: BidDashboardProps) {
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [procName, setProcName] = useState('')
  const [eqType, setEqType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  async function fetchBids() {
    try {
      const r = await fetch('/api/bids')
      if (!r.ok) throw new Error(await r.text())
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
    setScanning(true); setScanMsg(null)
    try {
      const r = await fetch('/api/input/scan', { method: 'POST' })
      const data = await r.json()
      setScanMsg(`+${data.new_bids} bids · +${data.new_quotes} quotes`)
      await fetchBids()
    } catch (e) {
      setScanMsg(String(e))
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
      setShowCreate(false); setProcName(''); setEqType('')
      await fetchBids()
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
        padding: '6px 10px', fontSize: 10, color: C.text, fontFamily: FONT,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: C.text }}>
            BID EVALUATION
          </div>
          <div style={{ fontSize: 9, color: '#3a3a3a', letterSpacing: '0.12em', marginTop: 2 }}>
            SELECT OR CREATE A BID TO BEGIN EVALUATION
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn onClick={handleScan} disabled={scanning}>
            {scanning ? 'SCANNING···' : 'SCAN FOLDER'}
          </Btn>
          <Btn variant="accent" onClick={() => setShowCreate(v => !v)}>
            + NEW BID
          </Btn>
        </div>
      </div>

      {scanMsg && (
        <div style={{
          fontSize: 9, color: C.muted, background: '#0a0a0a',
          border: `1px solid ${C.border}`, borderRadius: 2,
          padding: '7px 12px', marginBottom: 16, letterSpacing: '0.1em',
        }}>
          SCAN COMPLETE: {scanMsg}
        </div>
      )}

      {showCreate && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <Lbl>NEW BID</Lbl>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {inp(procName, setProcName, 'Procurement name...', nameRef)}
            {inp(eqType, setEqType, 'Equipment type (optional)...')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn variant="accent" onClick={handleCreate} disabled={creating || !procName.trim()}>
              {creating ? 'CREATING···' : 'CREATE'}
            </Btn>
            <Btn onClick={() => { setShowCreate(false); setProcName(''); setEqType('') }}>
              CANCEL
            </Btn>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 9, color: C.accent, background: '#1a0808',
          border: '1px solid #3a1010', borderRadius: 2,
          padding: '8px 12px', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 9, color: '#2e2e2e', letterSpacing: '0.18em' }}>LOADING···</div>
      ) : bids.length === 0 ? (
        <div style={{
          fontSize: 10, color: '#2a2a2a', textAlign: 'center',
          padding: '60px 0', letterSpacing: '0.1em',
        }}>
          NO BIDS — SCAN FOLDER OR CREATE ONE
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {bids.map(bid => (
            <div
              key={bid.bid_id}
              onClick={() => onSelectBid(bid)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
                padding: '16px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.text, fontWeight: 600, lineHeight: 1.4 }}>
                    {bid.procurement_name || bid.bid_id}
                  </div>
                  {bid.equipment_type && (
                    <div style={{ fontSize: 9, color: '#3a3a3a', marginTop: 3 }}>{bid.equipment_type}</div>
                  )}
                </div>
                <span style={{
                  fontSize: 7, letterSpacing: '0.15em', color: statusColor(bid.status),
                  border: `1px solid ${statusColor(bid.status)}22`, borderRadius: 2,
                  padding: '2px 6px', flexShrink: 0, marginTop: 1,
                }}>
                  {bid.status.toUpperCase()}
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 9, color: '#2e2e2e' }}>
                  <span style={{ color: '#4a4a4a' }}>{bid.quote_count}</span>
                  {' '}QUOTE{bid.quote_count !== 1 ? 'S' : ''}
                </div>
                <span style={{ fontSize: 8, color: C.accent, letterSpacing: '0.1em' }}>
                  {bid.bid_id}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
