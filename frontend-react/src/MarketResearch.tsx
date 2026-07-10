import { useCallback, useEffect, useState } from 'react'
import type { MarketResearchSummary } from './types'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

function Lbl({ children, color }: { children: string; color?: string }) {
  const { theme: C } = useTheme()
  return (
    <span style={{
      fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: color ?? C.muted, fontWeight: 600, fontFamily: FONT,
    }}>
      {children}
    </span>
  )
}

function ConfidenceChip({ confidence }: { confidence?: string }) {
  const { theme: C } = useTheme()
  if (!confidence) return null
  const lower = confidence.toLowerCase()
  const col = lower.includes('high') ? C.green : lower.includes('medium') || lower.includes('mod') ? C.amber : C.red
  return (
    <span style={{
      fontSize: 7, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: col, background: `${col}14`, border: `1px solid ${col}44`,
      borderRadius: 2, padding: '2px 7px', fontFamily: FONT,
    }}>
      {confidence}
    </span>
  )
}

function InfoCard({ title, children, badge }: {
  title: string; children: React.ReactNode; badge?: React.ReactNode
}) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 2, padding: '14px 18px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Lbl>{title}</Lbl>
        {badge}
      </div>
      {children}
    </div>
  )
}

interface MarketResearchArtifact {
  run_id?: string
  market_research?: Record<string, unknown>
}

function parseMarketData(artifact: MarketResearchArtifact): Record<string, unknown> | null {
  return (artifact?.market_research as Record<string, unknown>) ?? null
}

export interface MarketResearchProps {
  runId?: string | null
}

export function MarketResearch({ runId }: MarketResearchProps) {
  const { theme: C } = useTheme()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setData(null)
    setStatus('')
    try {
      const r = await fetch(`/api/bid-runs/${id}/artifacts/artifact_market_research`)
      if (r.status === 404) {
        setStatus('No market research artifact for this run. Market research requires MARKET_RESEARCH_ENABLED=1.')
        return
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const artifact: MarketResearchArtifact = await r.json()
      const parsed = parseMarketData(artifact)
      if (!parsed) {
        setStatus('Market research artifact found but contained no data.')
        return
      }
      const mrStatus = (parsed.status as string) ?? ''
      if (mrStatus === 'skipped') {
        setStatus((parsed.reason as string) ?? 'Market research was skipped for this run.')
        return
      }
      setData(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (runId) fetchData(runId)
  }, [runId, fetchData])

  if (!runId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: FONT }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
        }}>
          <div style={{ width: 40, height: 1, background: C.border }} />
          <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.18em', fontFamily: FONT, textAlign: 'center' }}>
            COMPLETE A BID EVALUATION RUN TO SEE MARKET RESEARCH
          </div>
          <div style={{ fontSize: 8, color: '#1e1e1e', fontFamily: FONT, textAlign: 'center', lineHeight: 1.7 }}>
            Start a bid evaluation from BID EVALUATION, upload quotes,<br />
            and run the analysis. Market benchmarks will appear here.
          </div>
          <div style={{ width: 40, height: 1, background: C.border }} />
        </div>
      </div>
    )
  }

  const priceRange = data?.market_price_range as MarketResearchSummary['market_price_range'] | undefined
  const typicalTerms = data?.typical_terms as Record<string, { summary: string; confidence: string }> | undefined
  const vendorLandscape = data?.vendor_or_product_reputation_signals as Array<{ vendor?: string; signal?: string; source?: string }> | undefined
  const redFlags = data?.red_flags as string[] | undefined
  const keyRisks = data?.consumables_and_lifecycle_costs as { summary?: string; recurring_cost_risks?: string[] } | undefined
  const trends = data?.current_market_or_future_trends as { summary?: string; signals?: string[] } | undefined
  const limitations = data?.limitations as string[] | undefined
  const equipmentType = (data?.equipment_type as string) ?? ''
  const retrievedAt = (data?.retrieved_at as string) ?? ''

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div>
            <Lbl>MARKET RESEARCH</Lbl>
            {equipmentType && (
              <div style={{ fontSize: 9, color: '#3a3a3a', fontFamily: FONT, marginTop: 4 }}>
                {equipmentType}
              </div>
            )}
          </div>
          {retrievedAt && (
            <span style={{ marginLeft: 'auto', fontSize: 7, color: '#2a2a2a', fontFamily: FONT }}>
              RETRIEVED {retrievedAt.slice(0, 10)}
            </span>
          )}
          <button
            onClick={() => fetchData(runId)}
            style={{
              background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '4px 12px', fontSize: 8,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: C.muted, fontFamily: FONT, cursor: 'pointer',
            }}
          >
            REFRESH
          </button>
        </div>

        {loading && (
          <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.18em' }}>LOADING···</div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px', background: '#1a0808', border: `1px solid #3a1010`,
            borderRadius: 2, fontSize: 9, color: C.red, marginBottom: 16,
          }}>
            ERROR: {error}
          </div>
        )}

        {status && !data && !loading && (
          <div style={{
            padding: '20px 24px', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 2, fontSize: 9, color: '#555', lineHeight: 1.7,
          }}>
            {status}
            <div style={{ marginTop: 10, fontSize: 8, color: '#2a2a2a', lineHeight: 1.7 }}>
              To enable internet market research, set MARKET_RESEARCH_ENABLED=1 and OPENAI_API_KEY in .env,
              then re-run the bid evaluation.
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Market price range */}
            {priceRange && (
              <InfoCard title="MARKET PRICE RANGE" badge={<ConfidenceChip confidence={priceRange.confidence} />}>
                <div style={{ fontSize: 10, color: '#999', lineHeight: 1.7, fontFamily: FONT, marginBottom: priceRange.sources?.length ? 10 : 0 }}>
                  {priceRange.summary}
                </div>
                {priceRange.sources && priceRange.sources.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {priceRange.sources.map((s, i) => (
                      <div key={i} style={{ fontSize: 8, color: '#3a3a3a', fontFamily: FONT }}>
                        ↗ <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#4a7faa', textDecoration: 'none' }}>
                          {s.note || s.url}
                        </a>
                        {s.retrieved_at && <span style={{ color: '#2a2a2a' }}> · {s.retrieved_at.slice(0, 10)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            )}

            {/* Typical terms */}
            {typicalTerms && Object.keys(typicalTerms).length > 0 && (
              <InfoCard title="TYPICAL CONTRACT TERMS">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(typicalTerms).map(([key, term]) => (
                    <div key={key} style={{
                      background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 2, padding: '8px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 7, letterSpacing: '0.14em', color: C.muted,
                          textTransform: 'uppercase', fontFamily: FONT, fontWeight: 600,
                        }}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <ConfidenceChip confidence={term.confidence} />
                      </div>
                      <div style={{ fontSize: 9, color: '#888', lineHeight: 1.6, fontFamily: FONT }}>
                        {term.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </InfoCard>
            )}

            {/* Vendor / product reputation signals */}
            {vendorLandscape && vendorLandscape.length > 0 && (
              <InfoCard title="VENDOR & PRODUCT SIGNALS">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendorLandscape.map((sig, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}>
                      {sig.vendor && (
                        <div style={{ fontSize: 8, color: C.text, fontFamily: FONT, fontWeight: 600, marginBottom: 3 }}>
                          {sig.vendor}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: '#888', lineHeight: 1.6, fontFamily: FONT }}>
                        {sig.signal}
                      </div>
                      {sig.source && (
                        <div style={{ fontSize: 7, color: '#3a3a3a', fontFamily: FONT, marginTop: 4 }}>
                          Source: {sig.source}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </InfoCard>
            )}

            {/* Lifecycle costs */}
            {keyRisks?.summary && (
              <InfoCard title="LIFECYCLE & CONSUMABLE COSTS">
                <div style={{ fontSize: 10, color: '#999', lineHeight: 1.7, fontFamily: FONT, marginBottom: 8 }}>
                  {keyRisks.summary}
                </div>
                {keyRisks.recurring_cost_risks && keyRisks.recurring_cost_risks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {keyRisks.recurring_cost_risks.map((r, i) => (
                      <div key={i} style={{
                        fontSize: 9, color: C.amber, lineHeight: 1.5,
                        paddingLeft: 10, borderLeft: `1px solid ${C.amber}44`,
                        fontFamily: FONT,
                      }}>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            )}

            {/* Market trends */}
            {trends?.summary && (
              <InfoCard title="MARKET TRENDS">
                <div style={{ fontSize: 10, color: '#999', lineHeight: 1.7, fontFamily: FONT, marginBottom: 8 }}>
                  {trends.summary}
                </div>
                {trends.signals && trends.signals.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {trends.signals.map((s, i) => (
                      <div key={i} style={{ fontSize: 9, color: '#666', fontFamily: FONT, lineHeight: 1.5 }}>
                        · {s}
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            )}

            {/* Red flags */}
            {redFlags && redFlags.length > 0 && (
              <InfoCard title="RED FLAGS">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {redFlags.map((f, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', background: '#1a0808', border: `1px solid #3a1010`,
                      borderRadius: 2, fontSize: 9, color: '#cc7777', lineHeight: 1.6, fontFamily: FONT,
                    }}>
                      ⚑ {f}
                    </div>
                  ))}
                </div>
              </InfoCard>
            )}

            {/* Research limitations */}
            {limitations && limitations.length > 0 && (
              <div style={{
                padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 2,
              }}>
                <Lbl>RESEARCH LIMITATIONS</Lbl>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {limitations.map((l, i) => (
                    <div key={i} style={{ fontSize: 8, color: '#3a3a3a', fontFamily: FONT, lineHeight: 1.5 }}>
                      · {l}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
