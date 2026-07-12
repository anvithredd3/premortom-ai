import { useState } from 'react'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

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

function ComingSoon({ label, description }: { label: string; description: string }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 2, padding: '18px 20px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1e2a2a', flexShrink: 0 }} />
        <Lbl>{label}</Lbl>
        <span style={{
          marginLeft: 'auto', fontSize: 10, letterSpacing: '0.14em',
          color: '#2a2a2a', fontFamily: FONT, border: `1px solid #1a1a1a`,
          borderRadius: 2, padding: '1px 6px',
        }}>
          BACKEND PENDING
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#2e2e2e', fontFamily: FONT, lineHeight: 1.6, paddingLeft: 15 }}>
        {description}
      </div>
    </div>
  )
}

/* ── Simulated invoice rows ─────────────────────────────────────────────── */
const MOCK_SCHEDULE = [
  { milestone: 'Advance Payment',      expected: '60%',   timing: 'On Order',         status: 'pending', amount: '10.8 Cr' },
  { milestone: 'Delivery',             expected: '20%',   timing: 'On Delivery',      status: 'pending', amount: '3.6 Cr'  },
  { milestone: 'Commissioning',        expected: '10%',   timing: 'Post-Install',     status: 'pending', amount: '1.8 Cr'  },
  { milestone: 'Acceptance Sign-off',  expected: '10%',   timing: 'After Acceptance', status: 'pending', amount: '1.8 Cr'  },
  { milestone: 'Annual AMC (Yr 1)',    expected: 'Yearly', timing: 'Month 13',        status: 'pending', amount: '0.9 Cr'  },
  { milestone: 'Consumables Est.',     expected: 'Monthly', timing: 'Ongoing',        status: 'pending', amount: '~0.08 Cr/mo' },
]

/* ── Main ───────────────────────────────────────────────────────────────── */
export function InvoiceMonitor() {
  const { theme: C } = useTheme()
  const STATUS_COLORS: Record<string, string> = {
    paid: C.cyan, overdue: C.accent, disputed: C.orange, pending: C.muted,
  }
  const [activeRunId, setActiveRunId] = useState('')
  const [showSchedule, setShowSchedule] = useState(true)

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Lbl>Invoice Monitoring / Post-Award</Lbl>
            <span style={{
              fontSize: 10, letterSpacing: '0.14em', fontFamily: FONT,
              color: '#1e3a3a', border: `1px solid #1a2a2a`,
              borderRadius: 2, padding: '2px 8px',
            }}>
              AGENT BACKEND PENDING
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#2a2a2a', fontFamily: FONT, marginTop: 6, lineHeight: 1.65, letterSpacing: '0.04em' }}>
            Monitor vendor invoices, recurring charges, warranty coverage, and service commitments after award.
            Detect anomalies, contract non-compliance, and lifecycle cost drift.
          </div>
        </div>

        {/* Contract ID input */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 2, padding: '16px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Lbl>Awarded Bid / Run ID</Lbl>
          <input
            value={activeRunId}
            onChange={e => setActiveRunId(e.target.value)}
            placeholder="e.g. RUN-BID-001-001"
            style={{
              flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '6px 10px', fontSize: 13,
              color: C.text, fontFamily: FONT, outline: 'none',
            }}
          />
          <button
            disabled
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
              padding: '6px 18px', fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: '#2a2a2a', fontFamily: FONT, cursor: 'not-allowed',
            }}
          >
            LOAD CONTRACT
          </button>
        </div>

        {/* Expected invoice schedule (static preview) */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowSchedule(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}
          >
            <Lbl>Expected Invoice Schedule</Lbl>
            <span style={{ fontSize: 10, color: '#1e3a3a', fontFamily: FONT, border: `1px solid #1a2a2a`, borderRadius: 2, padding: '1px 6px' }}>
              PREVIEW — REQUIRES AWARDED CONTRACT
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#2a2a2a', fontFamily: FONT }}>
              {showSchedule ? '▲' : '▼'}
            </span>
          </button>

          {showSchedule && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 80px',
                padding: '8px 16px', borderBottom: `1px solid ${C.border}`,
                fontSize: 10, letterSpacing: '0.14em', color: C.muted, fontFamily: FONT,
                textTransform: 'uppercase', gap: 8,
              }}>
                {['Milestone', 'Share', 'Timing', 'Amount', 'Status'].map(h => <div key={h}>{h}</div>)}
              </div>
              {MOCK_SCHEDULE.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 80px',
                    padding: '9px 16px', borderBottom: `1px solid ${C.border}`,
                    fontSize: 13, color: '#666', fontFamily: FONT, gap: 8,
                    background: i % 2 === 0 ? 'transparent' : '#060606',
                  }}
                >
                  <div style={{ color: '#888' }}>{row.milestone}</div>
                  <div style={{ color: '#555' }}>{row.expected}</div>
                  <div style={{ color: '#444' }}>{row.timing}</div>
                  <div style={{ color: '#666', fontWeight: 600 }}>{row.amount}</div>
                  <div>
                    <span style={{
                      fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: STATUS_COLORS[row.status] ?? '#2a2a2a',
                      border: `1px solid ${STATUS_COLORS[row.status] ?? '#1a1a1a'}33`,
                      borderRadius: 2, padding: '1px 6px', fontFamily: FONT,
                    }}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ padding: '8px 16px', fontSize: 10, color: '#1e1e1e', fontFamily: FONT, letterSpacing: '0.08em' }}>
                Illustrative only — actual schedule loads from awarded contract terms
              </div>
            </div>
          )}
        </div>

        {/* Feature panels — all backend pending */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <ComingSoon
              label="Invoice Compliance"
              description="Compare submitted invoices against contract milestones, warranty coverage, and SLA commitments. Flag discrepancies and duplicates."
            />
            <ComingSoon
              label="Lifecycle Cost Tracker"
              description="Actual vs expected variance for purchase price, AMC, consumables, spare parts, calibration, and service costs over contract life."
            />
          </div>
          <div>
            <ComingSoon
              label="Anomaly & Risk Signals"
              description="Detect duplicate invoices, price drift, suspicious bundling, missing service evidence, and charges outside contract scope."
            />
            <ComingSoon
              label="Supply Continuity Risks"
              description="Track consumable availability, spare parts commitments, software subscription renewals, and vendor service continuity indicators."
            />
          </div>
        </div>

        <ComingSoon
          label="Vendor Performance Scorecard"
          description="Track delivery compliance, SLA adherence, warranty response, training completion, and service quality against contracted commitments. Feeds into future vendor evaluation and procurement memory."
        />

        {/* What this screen will do when backend is ready */}
        <div style={{
          background: '#000e0e', border: `1px solid #001e1e`,
          borderRadius: 2, padding: '18px 20px', marginTop: 24,
        }}>
          <Lbl color="#1e4a4a">When Invoice Monitoring Agent is Ready</Lbl>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Load awarded contract and payment milestones from bid run',
              'Upload vendor invoices and transaction records for compliance check',
              'Auto-generate expected invoice trail from contract terms',
              'Detect anomalies, duplicates, and non-compliance with evidence',
              'Export compliance report for audit and vendor negotiation',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#1e3a3a', fontFamily: FONT, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: '#2a4a4a', fontFamily: FONT, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
