import { useCallback, useEffect, useState } from 'react'
import type { DbStatusResult } from './types'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

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

function StatusDot({ ok }: { ok: boolean }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: ok ? C.green : C.red,
    }} />
  )
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 2, marginBottom: 16,
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
        fontSize: 11, letterSpacing: '0.18em', color: C.muted, fontWeight: 600, fontFamily: FONT,
      }}>
        {title}
      </div>
      <div style={{ overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function TableRow({ cols, header }: { cols: string[]; header?: boolean }) {
  const { theme: C } = useTheme()
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
      borderBottom: `1px solid ${C.border}`,
      padding: '7px 16px',
      gap: 8,
    }}>
      {cols.map((c, i) => (
        <div key={i} style={{
          fontSize: header ? 7 : 9,
          color: header ? C.muted : C.textDim,
          fontFamily: FONT,
          letterSpacing: header ? '0.14em' : '0.02em',
          textTransform: header ? 'uppercase' : undefined,
          fontWeight: header ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {c}
        </div>
      ))}
    </div>
  )
}

export function DbStatus() {
  const { theme: C } = useTheme()
  const [data, setData] = useState<DbStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/db/status')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const TABLE_LABELS: Record<string, string> = {
    agent_memory_chunks: 'Agent Memory Chunks',
    decision_history: 'Decision History',
    decision_history_chunks: 'Decision History Chunks',
    agent_history: 'Agent History',
    agent_history_chunks: 'Agent History Chunks',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, fontFamily: FONT }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Lbl>DATABASE / MEMORY</Lbl>
          <button
            onClick={fetchStatus}
            style={{
              marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 2, padding: '4px 12px', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: C.muted, fontFamily: FONT, cursor: 'pointer',
            }}
          >
            REFRESH
          </button>
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: '0.18em', fontFamily: FONT }}>
            LOADING···
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px', background: C.accent + '12', border: `1px solid ${C.accent}44`,
            borderRadius: 2, fontSize: 13, color: C.red, fontFamily: FONT, marginBottom: 16,
          }}>
            ERROR: {error}
          </div>
        )}

        {data && (
          <>
            {/* Connection status */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24,
            }}>
              {[
                { label: 'DATABASE CONFIGURED', ok: data.database_configured },
                { label: 'DATABASE CONNECTED',  ok: data.database_connected  },
                { label: 'PGVECTOR AVAILABLE',  ok: data.pgvector_available  },
              ].map(item => (
                <div key={item.label} style={{
                  background: C.surface, border: `1px solid ${item.ok ? `${C.green}33` : `${C.red}33`}`,
                  borderRadius: 2, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <StatusDot ok={item.ok} />
                  <div>
                    <Lbl>{item.label}</Lbl>
                    <div style={{
                      fontSize: 15, fontWeight: 700, fontFamily: FONT,
                      color: item.ok ? C.green : C.red, marginTop: 4,
                    }}>
                      {item.ok ? 'YES' : 'NO'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.error && (
              <div style={{
                padding: '10px 14px', background: C.amber + '12', border: `1px solid ${C.amber}44`,
                borderRadius: 2, fontSize: 13, color: C.amber, fontFamily: FONT, marginBottom: 16,
              }}>
                {data.error}
              </div>
            )}

            {/* Table row counts */}
            <TableCard title="TABLES">
              <TableRow cols={['TABLE', 'EXISTS', 'ROWS']} header />
              {Object.entries(data.tables).map(([name, info]) => (
                <TableRow
                  key={name}
                  cols={[
                    TABLE_LABELS[name] ?? name,
                    info.exists ? '✓' : '—',
                    info.exists ? info.row_count.toLocaleString() : '—',
                  ]}
                />
              ))}
            </TableCard>

            {/* Decision history */}
            {data.recent_decision_rows.length > 0 && (
              <TableCard title="RECENT DECISION HISTORY">
                <TableRow cols={['RUN ID', 'PROCUREMENT', 'RISK LEVEL', 'SCORE', 'DATE']} header />
                {data.recent_decision_rows.map((row, i) => (
                  <TableRow
                    key={i}
                    cols={[
                      row.run_id,
                      (row.procurement_title ?? '').slice(0, 30),
                      row.risk_level,
                      row.risk_score != null ? row.risk_score.toFixed(0) : '—',
                      row.created_at ? row.created_at.slice(0, 10) : '—',
                    ]}
                  />
                ))}
              </TableCard>
            )}

            {/* Agent memory */}
            {data.recent_memory_rows.length > 0 && (
              <TableCard title="AGENT MEMORY CHUNKS (RECENT)">
                <TableRow cols={['AGENT', 'SOURCE', 'TYPE', 'UPDATED']} header />
                {data.recent_memory_rows.map((row, i) => (
                  <TableRow
                    key={i}
                    cols={[
                      row.agent_id,
                      (row.source_path ?? '').split('/').pop() ?? row.source_path,
                      row.memory_type,
                      row.updated_at ? row.updated_at.slice(0, 10) : '—',
                    ]}
                  />
                ))}
              </TableCard>
            )}

            {/* Agent history counts */}
            {data.agent_history_counts.length > 0 && (
              <TableCard title="AGENT HISTORY CHUNK COUNTS">
                <TableRow cols={['AGENT ID', 'CHUNKS']} header />
                {data.agent_history_counts.map((row, i) => (
                  <TableRow key={i} cols={[row.agent_id, row.chunks.toLocaleString()]} />
                ))}
              </TableCard>
            )}

            {/* Empty state */}
            {data.recent_decision_rows.length === 0 &&
             data.recent_memory_rows.length === 0 &&
             data.agent_history_counts.length === 0 && (
              <div style={{
                padding: '24px', textAlign: 'center',
                fontSize: 13, color: C.muted, letterSpacing: '0.14em', fontFamily: FONT,
              }}>
                {data.database_connected
                  ? 'DATABASE CONNECTED — NO DATA YET. RUN AN ANALYSIS TO POPULATE MEMORY.'
                  : 'DATABASE NOT CONNECTED. START DOCKER SERVICES TO ENABLE PGVECTOR MEMORY.'}
              </div>
            )}

            {/* Docker hint */}
            {!data.database_connected && (
              <div style={{
                marginTop: 16, padding: '14px 18px',
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 2,
              }}>
                <Lbl>HOW TO START THE DATABASE</Lbl>
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: C.surface, borderRadius: 2, border: `1px solid ${C.border}`,
                  fontSize: 13, color: C.cyan, fontFamily: FONT, lineHeight: 1.8,
                }}>
                  <div>docker compose up -d</div>
                  <div style={{ color: C.textDim, marginTop: 4, fontSize: 11 }}>
                    Starts PostgreSQL + pgvector on port 5432. See docker-compose.yml.
                  </div>
                </div>
                <div style={{
                  marginTop: 10, fontSize: 11, color: C.muted, fontFamily: FONT, lineHeight: 1.7,
                }}>
                  Set DATABASE_URL in .env to enable decision history storage and OKF vector memory.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
