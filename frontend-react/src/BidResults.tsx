import { useEffect, useState } from 'react'
import type { BidResult, QuoteReview } from './types'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const C = {
  bg: '#080808', surface: '#0d0d0d', border: '#1a1a1a',
  text: '#d8d8d8', muted: '#555', faint: '#2e2e2e',
  accent: '#ff2222', green: '#22c55e', amber: '#f59e0b', red: '#ef4444',
} as const
const FONT = "'JetBrains Mono', monospace"

function Lbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT, ...style,
    }}>
      {children}
    </span>
  )
}

function Chip({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase',
      color, border: `1px solid ${color}33`, borderRadius: 2,
      padding: '2px 7px', fontFamily: FONT,
    }}>
      {children}
    </span>
  )
}

function riskColor(level: string, score: number) {
  if (level === 'HIGH' || level === 'CRITICAL' || score >= 75) return C.red
  if (level === 'MODERATE' || score >= 50) return C.amber
  return C.green
}

/* ── Individual quote detail panel ─────────────────────────────────────── */
function QuoteDetail({ review, onClose }: { review: QuoteReview; onClose: () => void }) {
  const rc = riskColor(review.risk_level, review.risk_score)
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, fontFamily: FONT,
    }}>
      <div style={{
        background: '#0b0b0b', border: `1px solid ${C.border}`, borderRadius: 2,
        width: 680, maxHeight: '80vh', overflow: 'auto', padding: '24px 28px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '0.04em' }}>
              {review.vendor_name || review.quote_id}
            </div>
            {review.vendor_name && (
              <div style={{ fontSize: 8, color: '#3a3a3a', marginTop: 3, letterSpacing: '0.1em' }}>
                {review.quote_id}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: rc, letterSpacing: '-0.02em' }}>
                {review.risk_score.toFixed(0)}
              </div>
              <div style={{ fontSize: 7, color: '#3a3a3a', letterSpacing: '0.12em' }}>/100 RISK</div>
            </div>
            <Chip color={rc}>{review.risk_level}</Chip>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#3a3a3a',
              fontSize: 16, cursor: 'pointer', fontFamily: FONT, lineHeight: 1,
            }}>✕</button>
          </div>
        </div>

        {/* Recommendation */}
        <div style={{
          background: `${rc}08`, border: `1px solid ${rc}22`,
          borderRadius: 2, padding: '12px 14px', marginBottom: 18,
        }}>
          <Lbl style={{ display: 'block', marginBottom: 8, color: rc }}>RECOMMENDATION</Lbl>
          <div style={{ fontSize: 10, color: C.text, lineHeight: 1.65 }}>
            {review.recommendation}
          </div>
        </div>

        {/* Findings */}
        <Lbl style={{ display: 'block', marginBottom: 10 }}>FINDINGS ({review.findings.length})</Lbl>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {review.findings.map((f, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, paddingBottom: 8,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 8, color: '#2a2a2a', flexShrink: 0, paddingTop: 2, minWidth: 14 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.65 }}>{f}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Ranked quote card ──────────────────────────────────────────────────── */
function RankedCard({
  review, rank, isWinner, onClick,
}: {
  review: QuoteReview; rank: number; isWinner: boolean; onClick: () => void
}) {
  const rc = riskColor(review.risk_level, review.risk_score)
  return (
    <div
      onClick={onClick}
      style={{
        background: isWinner ? '#0c0c0c' : C.surface,
        border: `1px solid ${isWinner ? '#2a2a2a' : C.border}`,
        borderRadius: 2, padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.12s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2e2e2e')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = isWinner ? '#2a2a2a' : C.border)}
    >
      {isWinner && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, #22c55e44, transparent)',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: isWinner ? `${C.green}18` : 'transparent',
          border: `1px solid ${isWinner ? `${C.green}44` : C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: isWinner ? C.green : '#3a3a3a', fontWeight: 700,
        }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
              {review.vendor_name || review.quote_id}
            </span>
            {isWinner && <Chip color={C.green}>WINNER</Chip>}
            <Chip color={rc}>{review.risk_level}</Chip>
          </div>
          {review.vendor_name && (
            <div style={{ fontSize: 8, color: '#2e2e2e', marginBottom: 6 }}>{review.quote_id}</div>
          )}
          <div style={{ fontSize: 9, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>
            {review.findings.slice(0, 2).map((f, i) => (
              <div key={i} style={{ paddingLeft: 8, borderLeft: `1px solid ${C.faint}`, marginBottom: 4 }}>
                {f.length > 120 ? f.slice(0, 120) + '…' : f}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8, color: '#2a2a2a', letterSpacing: '0.1em' }}>
            {review.findings.length} FINDINGS · CLICK FOR FULL REVIEW →
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: rc, letterSpacing: '-0.02em' }}>
            {review.risk_score.toFixed(0)}
          </div>
          <div style={{ fontSize: 7, color: '#2e2e2e', letterSpacing: '0.1em' }}>/100</div>
        </div>
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export interface BidResultsProps {
  runId: string
  bidId: string
  bidName: string
  onBack: () => void
  onNewBid: () => void
}

export function BidResults({ runId, bidId, bidName, onBack, onNewBid }: BidResultsProps) {
  const [result, setResult] = useState<BidResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<QuoteReview | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/bid-runs/${runId}/result`)
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        if (data.status !== 'completed' && !data.winner) {
          setError(data.message ?? 'Result not ready yet.')
        } else {
          setResult(data)
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [runId])

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT, fontSize: 9, color: '#2e2e2e', letterSpacing: '0.18em',
      }}>
        LOADING RESULTS···
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: C.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#3a3a3a',
          fontFamily: FONT, fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', cursor: 'pointer', padding: 0,
        }}>
          ← MONITOR
        </button>
        <div style={{ width: 1, height: 12, background: C.border }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '0.05em' }}>
            BID RESULTS
          </div>
          <div style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '0.1em', marginTop: 2 }}>
            {bidName || bidId} · {runId}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={onNewBid} style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
            color: C.muted, fontFamily: FONT, fontSize: 9, letterSpacing: '0.14em',
            textTransform: 'uppercase', cursor: 'pointer', padding: '5px 14px',
          }}>
            NEW BID
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          fontSize: 9, color: C.accent, background: '#1a0808',
          border: '1px solid #3a1010', borderRadius: 2,
          padding: '10px 14px', marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Winner card */}
          {result.winner && (
            <div style={{
              background: '#080f08', border: `1px solid ${C.green}22`,
              borderRadius: 2, padding: '20px 24px', marginBottom: 24, position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: 'linear-gradient(90deg, transparent, #22c55e66, transparent)',
              }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Lbl style={{ color: C.green }}>RECOMMENDED WINNER</Lbl>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '0.02em', marginBottom: 4 }}>
                    {result.winner.vendor_name || result.winner.quote_id}
                  </div>
                  {result.winner.vendor_name && (
                    <div style={{ fontSize: 9, color: '#3a3a3a', marginBottom: 12 }}>
                      {result.winner.quote_id}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Chip color={riskColor(result.winner.risk_level, result.winner.risk_score)}>
                      {result.winner.risk_level} RISK
                    </Chip>
                    <Chip color={C.muted}>{result.winner.findings.length} FINDINGS</Chip>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em',
                    color: riskColor(result.winner.risk_level, result.winner.risk_score),
                  }}>
                    {result.winner.risk_score.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '0.12em' }}>RISK SCORE / 100</div>
                </div>
              </div>

              {/* Rationale */}
              {result.rationale && (
                <div style={{
                  marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`,
                  fontSize: 10, color: '#888', lineHeight: 1.7,
                }}>
                  {result.rationale}
                </div>
              )}

              {/* Negotiation points */}
              {result.negotiation_points && result.negotiation_points.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <Lbl style={{ display: 'block', marginBottom: 8 }}>NEGOTIATION POINTS</Lbl>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {result.negotiation_points.map((pt, i) => (
                      <div key={i} style={{
                        fontSize: 9, color: C.amber, paddingLeft: 10,
                        borderLeft: `1px solid ${C.amber}44`, lineHeight: 1.5,
                      }}>
                        {pt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {result.feedback && result.feedback.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <Lbl style={{ display: 'block', marginBottom: 8 }}>EVALUATOR NOTES</Lbl>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {result.feedback.map((f, i) => (
                      <div key={i} style={{
                        fontSize: 9, color: '#555', paddingLeft: 10,
                        borderLeft: `1px solid ${C.faint}`, lineHeight: 1.5,
                      }}>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ranked list */}
          {result.ranked_quotes && result.ranked_quotes.length > 0 && (
            <div>
              <Lbl style={{ display: 'block', marginBottom: 12 }}>
                ALL QUOTES — RANKED BY RISK ({result.ranked_quotes.length})
              </Lbl>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.ranked_quotes.map((r, i) => (
                  <RankedCard
                    key={r.quote_id}
                    review={r}
                    rank={i + 1}
                    isWinner={r.quote_id === result.winner?.quote_id}
                    onClick={() => setDetail(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {detail && <QuoteDetail review={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
