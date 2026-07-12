import { useEffect, useState } from 'react'
import type { BidResult, MarketResearchSummary, QuoteReview } from './types'
import { useTheme } from './theme'

/* ── Theme ─────────────────────────────────────────────────────────────── */
const FONT = "'JetBrains Mono', monospace"

function Lbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: C.muted, fontWeight: 600, fontFamily: FONT, ...style,
    }}>
      {children}
    </span>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  const { theme: C } = useTheme()
  const col = color ?? C.muted
  return (
    <span style={{
      fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: col, border: `1px solid ${col}33`, borderRadius: 2,
      padding: '2px 7px', fontFamily: FONT,
    }}>
      {children}
    </span>
  )
}

function riskColor(level: string, score: number, C: { red: string; amber: string; green: string }) {
  if (level === 'HIGH' || level === 'CRITICAL' || score >= 75) return C.red
  if (level === 'MODERATE' || score >= 50) return C.amber
  return C.green
}

/* ── Individual quote detail panel ─────────────────────────────────────── */
function QuoteDetail({ review, onClose }: { review: QuoteReview; onClose: () => void }) {
  const { theme: C } = useTheme()
  const rc = riskColor(review.risk_level, review.risk_score, C)
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, fontFamily: FONT,
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
        width: 680, maxHeight: '80vh', overflow: 'auto', padding: '24px 28px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '0.04em' }}>
              {review.vendor_name || review.quote_id}
            </div>
            {review.vendor_name && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3, letterSpacing: '0.1em' }}>
                {review.quote_id}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: rc, letterSpacing: '-0.02em' }}>
                {review.risk_score.toFixed(0)}
              </div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.12em' }}>/100 RISK</div>
            </div>
            <Chip color={rc}>{review.risk_level}</Chip>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: C.textDim,
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
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65 }}>
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
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, paddingTop: 2, minWidth: 14 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{f}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Vendor comparison table ────────────────────────────────────────────── */
function VendorComparison({ quotes, winnerId }: { quotes: QuoteReview[]; winnerId: string }) {
  const { theme: C } = useTheme()
  const [open, setOpen] = useState(false)
  if (quotes.length < 2) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
          padding: '10px 14px', cursor: 'pointer', fontFamily: FONT,
        }}
      >
        <Lbl>VENDOR COMPARISON — SIDE BY SIDE ({quotes.length})</Lbl>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.muted, fontFamily: FONT }}>
          {open ? '▲ COLLAPSE' : '▼ EXPAND'}
        </span>
      </button>

      {open && (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontFamily: FONT,
            background: C.surface,
          }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: 'left', padding: '8px 14px', fontSize: 10,
                  letterSpacing: '0.16em', color: C.muted, fontWeight: 600,
                  borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase',
                  background: C.surface2, whiteSpace: 'nowrap',
                }}>
                  CRITERION
                </th>
                {quotes.map(q => {
                  const rc = riskColor(q.risk_level, q.risk_score, C)
                  const isWinner = q.quote_id === winnerId
                  return (
                    <th key={q.quote_id} style={{
                      textAlign: 'center', padding: '8px 14px',
                      borderBottom: `1px solid ${C.border}`,
                      background: isWinner ? C.green + '12' : C.surface2,
                      borderTop: isWinner ? `1px solid ${C.green}44` : 'none',
                      minWidth: 140,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                        {q.vendor_name || q.quote_id}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <span style={{ fontSize: 19, fontWeight: 700, color: rc }}>{q.risk_score.toFixed(0)}</span>
                        <span style={{ fontSize: 10, color: C.muted, alignSelf: 'flex-end', paddingBottom: 2 }}>/100</span>
                        {isWinner && (
                          <span style={{
                            fontSize: 10, color: C.green, border: `1px solid ${C.green}44`,
                            borderRadius: 2, padding: '1px 5px', alignSelf: 'center',
                          }}>
                            WINNER
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {/* Risk level row */}
              <tr>
                <td style={{ padding: '8px 14px', fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                  RISK LEVEL
                </td>
                {quotes.map(q => {
                  const rc = riskColor(q.risk_level, q.risk_score, C)
                  return (
                    <td key={q.quote_id} style={{ textAlign: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 11, color: rc, fontFamily: FONT, fontWeight: 600 }}>{q.risk_level}</span>
                    </td>
                  )
                })}
              </tr>
              {/* Findings count */}
              <tr style={{ background: C.surface2 }}>
                <td style={{ padding: '8px 14px', fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                  FINDINGS COUNT
                </td>
                {quotes.map(q => {
                  const best = q.findings.length === Math.min(...quotes.map(x => x.findings.length))
                  return (
                    <td key={q.quote_id} style={{ textAlign: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, color: best ? C.green : '#888', fontFamily: FONT, fontWeight: best ? 700 : 400 }}>
                        {q.findings.length}
                      </span>
                    </td>
                  )
                })}
              </tr>
              {/* Top finding per vendor */}
              <tr>
                <td style={{ padding: '8px 14px', fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  TOP FINDING
                </td>
                {quotes.map(q => (
                  <td key={q.quote_id} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top', maxWidth: 200 }}>
                    <div style={{ fontSize: 11, color: '#666', fontFamily: FONT, lineHeight: 1.55 }}>
                      {q.findings[0]?.slice(0, 100)}{(q.findings[0]?.length ?? 0) > 100 ? '…' : ''}
                    </div>
                  </td>
                ))}
              </tr>
              {/* Recommendation summary */}
              <tr style={{ background: C.surface2 }}>
                <td style={{ padding: '8px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                  RECOMMENDATION
                </td>
                {quotes.map(q => (
                  <td key={q.quote_id} style={{ padding: '8px 14px', verticalAlign: 'top', maxWidth: 200 }}>
                    <div style={{ fontSize: 11, color: '#555', fontFamily: FONT, lineHeight: 1.55 }}>
                      {q.recommendation.slice(0, 120)}{q.recommendation.length > 120 ? '…' : ''}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Ranked quote card ──────────────────────────────────────────────────── */
function RankedCard({
  review, rank, isWinner, onClick,
}: {
  review: QuoteReview; rank: number; isWinner: boolean; onClick: () => void
}) {
  const { theme: C } = useTheme()
  const rc = riskColor(review.risk_level, review.risk_score, C)
  return (
    <div
      onClick={onClick}
      style={{
        background: isWinner ? C.surface2 : C.surface,
        border: `1px solid ${isWinner ? C.borderMid : C.border}`,
        borderRadius: 2, padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.12s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderMid)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = isWinner ? C.borderMid : C.border)}
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
          fontSize: 13, color: isWinner ? C.green : C.textDim, fontWeight: 700,
        }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
              {review.vendor_name || review.quote_id}
            </span>
            {isWinner && <Chip color={C.green}>WINNER</Chip>}
            <Chip color={rc}>{review.risk_level}</Chip>
          </div>
          {review.vendor_name && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{review.quote_id}</div>
          )}
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>
            {review.findings.slice(0, 2).map((f, i) => (
              <div key={i} style={{ paddingLeft: 8, borderLeft: `1px solid ${C.faint}`, marginBottom: 4 }}>
                {f.length > 120 ? f.slice(0, 120) + '…' : f}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
            {review.findings.length} FINDINGS · CLICK FOR FULL REVIEW →
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: rc, letterSpacing: '-0.02em' }}>
            {review.risk_score.toFixed(0)}
          </div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.1em' }}>/100</div>
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
  onGoNegotiation?: () => void
}

export function BidResults({ runId, bidId, bidName, onBack, onNewBid, onGoNegotiation }: BidResultsProps) {
  const { theme: C } = useTheme()
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
        fontFamily: FONT, fontSize: 13, color: C.muted, letterSpacing: '0.18em',
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
          background: 'none', border: 'none', color: C.textDim,
          fontFamily: FONT, fontSize: 13, letterSpacing: '0.14em',
          textTransform: 'uppercase', cursor: 'pointer', padding: 0,
        }}>
          ← MONITOR
        </button>
        <div style={{ width: 1, height: 12, background: C.border }} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '0.05em' }}>
            BID RESULTS
          </div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginTop: 2 }}>
            {bidName || bidId} · {runId}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {onGoNegotiation && (
            <button onClick={onGoNegotiation} style={{
              background: 'none', border: `1px solid #22d3ee44`, borderRadius: 2,
              color: C.cyan, fontFamily: FONT, fontSize: 13, letterSpacing: '0.14em',
              textTransform: 'uppercase', cursor: 'pointer', padding: '5px 14px',
            }}>
              NEGOTIATE →
            </button>
          )}
          <button onClick={onNewBid} style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 2,
            color: C.muted, fontFamily: FONT, fontSize: 13, letterSpacing: '0.14em',
            textTransform: 'uppercase', cursor: 'pointer', padding: '5px 14px',
          }}>
            NEW BID
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          fontSize: 13, color: C.accent, background: C.accent + '12',
          border: `1px solid ${C.accent}44`, borderRadius: 2,
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
              background: C.green + '10', border: `1px solid ${C.green}33`,
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
                    <div style={{ fontSize: 13, color: C.textDim, marginBottom: 12 }}>
                      {result.winner.quote_id}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Chip color={riskColor(result.winner.risk_level, result.winner.risk_score, C)}>
                      {result.winner.risk_level} RISK
                    </Chip>
                    <Chip color={C.muted}>{result.winner.findings.length} FINDINGS</Chip>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em',
                    color: riskColor(result.winner.risk_level, result.winner.risk_score, C),
                  }}>
                    {result.winner.risk_score.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.12em' }}>RISK SCORE / 100</div>
                </div>
              </div>

              {/* Rationale */}
              {result.rationale && (
                <div style={{
                  marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`,
                  fontSize: 14, color: '#888', lineHeight: 1.7,
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
                        fontSize: 13, color: C.amber, paddingLeft: 10,
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
                        fontSize: 13, color: '#555', paddingLeft: 10,
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

          {/* Market research summary */}
          {result.market_research_summary && (() => {
            const mr: MarketResearchSummary = result.market_research_summary!
            if (mr.status === 'skipped' || !mr.market_price_range) return null
            return (
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 2, padding: '16px 20px', marginBottom: 24,
              }}>
                <Lbl style={{ display: 'block', marginBottom: 10 }}>MARKET RESEARCH</Lbl>
                {mr.market_price_range?.summary && (
                  <div style={{ fontSize: 14, color: '#888', lineHeight: 1.65, marginBottom: 10 }}>
                    {mr.market_price_range.summary}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Chip color={C.muted}>{mr.equipment_type ?? 'Equipment'}</Chip>
                  {mr.market_price_range?.confidence && (
                    <Chip color={mr.market_price_range.confidence === 'high' ? C.green : C.amber}>
                      {mr.market_price_range.confidence.toUpperCase()} CONFIDENCE
                    </Chip>
                  )}
                </div>
                {mr.key_risk_signals && mr.key_risk_signals.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <Lbl style={{ display: 'block', marginBottom: 6 }}>MARKET RISK SIGNALS</Lbl>
                    {mr.key_risk_signals.slice(0, 3).map((s, i) => (
                      <div key={i} style={{
                        fontSize: 13, color: C.amber, paddingLeft: 8,
                        borderLeft: `1px solid ${C.amber}44`, lineHeight: 1.5, marginBottom: 4,
                      }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Vendor comparison table */}
          {result.ranked_quotes && result.ranked_quotes.length >= 2 && (
            <VendorComparison
              quotes={result.ranked_quotes}
              winnerId={result.winner?.quote_id ?? ''}
            />
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
