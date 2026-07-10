import { useEffect, useState, useCallback } from 'react'
import { useTheme } from './theme'

const FONT = "'JetBrains Mono', monospace"

interface RunEntry {
  run_id: string
  files: string[]
}

interface FileContent {
  run_id: string
  filename: string
  content: unknown
  type: 'json' | 'jsonl'
}

/* ── JSON syntax highlighter ─────────────────────────────────────────── */
function highlight(value: unknown, depth = 0, isDark: boolean): string {
  const COLORS = isDark ? {
    key:    '#60a5fa', // blue
    str:    '#86efac', // green
    num:    '#fde68a', // yellow
    bool:   '#c084fc', // purple
    null_:  '#fb7185', // pink
    brace:  '#9ca3af', // gray
  } : {
    key:    '#1d4ed8',
    str:    '#166534',
    num:    '#92400e',
    bool:   '#6d28d9',
    null_:  '#be123c',
    brace:  '#6b7280',
  }

  const indent = '  '.repeat(depth)
  const nextIndent = '  '.repeat(depth + 1)

  if (value === null) return `<span style="color:${COLORS.null_}">null</span>`
  if (typeof value === 'boolean') return `<span style="color:${COLORS.bool}">${value}</span>`
  if (typeof value === 'number') return `<span style="color:${COLORS.num}">${value}</span>`
  if (typeof value === 'string') {
    const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<span style="color:${COLORS.str}">"${escaped}"</span>`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `<span style="color:${COLORS.brace}">[]</span>`
    const items = value.map(v => `${nextIndent}${highlight(v, depth + 1, isDark)}`).join(',\n')
    return `<span style="color:${COLORS.brace}">[</span>\n${items}\n${indent}<span style="color:${COLORS.brace}">]</span>`
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return `<span style="color:${COLORS.brace}">{}</span>`
    const lines = entries.map(([k, v]) => {
      const key = `<span style="color:${COLORS.key}">"${k}"</span>`
      return `${nextIndent}${key}: ${highlight(v, depth + 1, isDark)}`
    }).join(',\n')
    return `<span style="color:${COLORS.brace}">{</span>\n${lines}\n${indent}<span style="color:${COLORS.brace}">}</span>`
  }
  return String(value)
}

/* ── File icon ───────────────────────────────────────────────────────── */
function fileIcon(name: string): string {
  if (name.includes('contract')) return '📋'
  if (name.includes('vendor') || name.includes('proposal')) return '🏢'
  if (name.includes('market') || name.includes('research')) return '📊'
  if (name.includes('recommender') || name.includes('decision')) return '⚖️'
  if (name.includes('state')) return '📌'
  if (name.includes('events')) return '📡'
  return '📄'
}

function friendlyName(name: string): string {
  return name
    .replace('.json', '').replace('.jsonl', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Main component ──────────────────────────────────────────────────── */
export function RunLogs() {
  const { theme, mode } = useTheme()
  const isDark = mode === 'dark'

  const [runs, setRuns] = useState<RunEntry[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileLoading, setFileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/output-files')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRuns(data.runs ?? [])
      if (data.runs?.length > 0 && !selectedRun) {
        setSelectedRun(data.runs[0].run_id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [selectedRun])

  useEffect(() => { loadRuns() }, [])

  const loadFile = useCallback(async (runId: string, filename: string) => {
    setFileLoading(true)
    setFileContent(null)
    try {
      const res = await fetch(`/api/output-files/${runId}/${filename}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as FileContent
      setFileContent(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFileLoading(false)
    }
  }, [])

  const handleFileClick = (runId: string, filename: string) => {
    setSelectedFile(filename)
    setSelectedRun(runId)
    loadFile(runId, filename)
  }

  const S = {
    left: {
      width: 240, flexShrink: 0, background: theme.surface,
      borderRight: `1px solid ${theme.border}`, overflowY: 'auto' as const,
      display: 'flex', flexDirection: 'column' as const,
    },
    runRow: (active: boolean): React.CSSProperties => ({
      padding: '8px 14px', cursor: 'pointer',
      background: active ? theme.bg : 'transparent',
      borderLeft: `2px solid ${active ? theme.accent : 'transparent'}`,
      borderBottom: `1px solid ${theme.border}`,
    }),
    fileRow: (active: boolean): React.CSSProperties => ({
      padding: '7px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      background: active ? theme.faint : 'transparent',
      borderBottom: `1px solid ${theme.border}`,
    }),
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: theme.bg }}>

      {/* ── Left: run list ── */}
      <div style={S.left}>
        <div style={{
          padding: '12px 14px 8px', borderBottom: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 8, letterSpacing: '0.18em', color: theme.muted, fontFamily: FONT, fontWeight: 600 }}>
            RUN HISTORY
          </span>
          <button
            onClick={loadRuns}
            style={{
              background: 'none', border: `1px solid ${theme.border}`, borderRadius: 2,
              padding: '2px 8px', fontSize: 7, color: theme.muted, fontFamily: FONT,
              cursor: 'pointer', letterSpacing: '0.1em',
            }}
          >
            REFRESH
          </button>
        </div>

        {loading && (
          <div style={{ padding: 16, fontSize: 9, color: theme.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div style={{ padding: 16, fontSize: 9, color: theme.muted, fontFamily: FONT, lineHeight: 1.6 }}>
            No run outputs found. Run a bid evaluation to generate output files.
          </div>
        )}

        {runs.map(run => (
          <div key={run.run_id}>
            {/* Run header */}
            <div
              onClick={() => setSelectedRun(r => r === run.run_id ? null : run.run_id)}
              style={S.runRow(selectedRun === run.run_id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: theme.accent, fontFamily: FONT, fontWeight: 700 }}>
                  {run.run_id}
                </span>
                <span style={{ fontSize: 7, color: theme.muted, fontFamily: FONT }}>
                  {run.files.length} file{run.files.length !== 1 ? 's' : ''}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 8, color: theme.muted, fontFamily: FONT }}>
                  {selectedRun === run.run_id ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* File list (expanded when run is selected) */}
            {selectedRun === run.run_id && run.files.map(file => (
              <div
                key={file}
                onClick={() => handleFileClick(run.run_id, file)}
                style={S.fileRow(selectedFile === file && selectedRun === run.run_id)}
              >
                <span style={{ fontSize: 12, lineHeight: 1 }}>{fileIcon(file)}</span>
                <div>
                  <div style={{ fontSize: 8, color: theme.text, fontFamily: FONT, letterSpacing: '0.04em' }}>
                    {friendlyName(file)}
                  </div>
                  <div style={{ fontSize: 7, color: theme.muted, fontFamily: FONT, marginTop: 1 }}>
                    {file.endsWith('.jsonl') ? 'EVENTS LOG' : 'JSON'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Right: content panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${theme.border}`,
          background: theme.surface, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          {fileContent ? (
            <>
              <span style={{ fontSize: 14 }}>{fileIcon(fileContent.filename)}</span>
              <div>
                <span style={{ fontSize: 10, color: theme.text, fontFamily: FONT, fontWeight: 600 }}>
                  {friendlyName(fileContent.filename)}
                </span>
                <span style={{ fontSize: 8, color: theme.muted, fontFamily: FONT, marginLeft: 10 }}>
                  {fileContent.run_id}
                </span>
                <span style={{ fontSize: 7, color: theme.muted, fontFamily: FONT, marginLeft: 8,
                  padding: '2px 6px', border: `1px solid ${theme.border}`, borderRadius: 2 }}>
                  {fileContent.type.toUpperCase()}
                </span>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 9, color: theme.muted, fontFamily: FONT, letterSpacing: '0.12em' }}>
              {selectedRun
                ? `SELECT A FILE FROM ${selectedRun}`
                : 'SELECT A RUN FROM THE LEFT PANEL'}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {error && (
              <span style={{ fontSize: 8, color: theme.accent, fontFamily: FONT }}>{error}</span>
            )}
            {fileContent && (
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(fileContent.content, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = fileContent.filename; a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{
                  background: 'none', border: `1px solid ${theme.border}`, borderRadius: 2,
                  padding: '4px 12px', fontSize: 8, color: theme.muted, fontFamily: FONT,
                  cursor: 'pointer', letterSpacing: '0.1em',
                }}
              >
                DOWNLOAD
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {fileLoading && (
            <div style={{ fontSize: 9, color: theme.muted, fontFamily: FONT, letterSpacing: '0.12em' }}>
              LOADING FILE...
            </div>
          )}

          {!fileLoading && !fileContent && !selectedRun && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
              <div style={{ fontSize: 8, color: theme.muted, fontFamily: FONT, letterSpacing: '0.18em', fontWeight: 600 }}>
                OUTPUT FILE VIEWER
              </div>
              <div style={{ fontSize: 10, color: theme.textDim, fontFamily: FONT, lineHeight: 1.7 }}>
                Select a run from the left panel to view agent output JSON files.
                Each run produces one file per agent stage.
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  ['📋', 'contract_review_agent_quote_reviews.json', 'Risk scores, findings, recommendations per vendor quote'],
                  ['🏢', 'vendor_proposal_agent_quote_intelligence.json', 'Extracted vendor proposal intelligence'],
                  ['📊', 'internet_market_research_agent_benchmarks.json', 'Market price benchmarks and competitive data'],
                  ['⚖️', 'bid_recommender_agent_decision_result.json', 'Final bid recommendation with rationale'],
                  ['📌', 'run_state.json', 'Full run state: agent status, quotes, telemetry'],
                  ['📡', 'events.jsonl', 'Live event stream log (one event per line)'],
                ] as [string, string, string][]).map(([icon, name, desc]) => (
                  <div key={name as string} style={{
                    display: 'flex', gap: 12, padding: '8px 12px',
                    background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 2,
                  }}>
                    <span style={{ fontSize: 14, lineHeight: 1.4 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 8, color: theme.text, fontFamily: FONT }}>{name as string}</div>
                      <div style={{ fontSize: 8, color: theme.muted, fontFamily: FONT, marginTop: 2, lineHeight: 1.4 }}>{desc as string}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!fileLoading && fileContent && (
            <div style={{
              background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 2,
              padding: '16px 20px', overflow: 'auto',
            }}>
              {/* JSONL: show as paginated event list */}
              {fileContent.type === 'jsonl' && Array.isArray(fileContent.content) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 7, color: theme.muted, fontFamily: FONT, letterSpacing: '0.14em', marginBottom: 8 }}>
                    {(fileContent.content as unknown[]).length} EVENTS
                  </div>
                  {(fileContent.content as Record<string, unknown>[]).map((event, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 2,
                      background: theme.bg, border: `1px solid ${theme.border}`,
                    }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 7, color: theme.muted, fontFamily: FONT }}>#{i + 1}</span>
                        {event.event_type != null && (
                          <span style={{
                            fontSize: 7, color: theme.accent, fontFamily: FONT, letterSpacing: '0.1em',
                            padding: '1px 6px', border: `1px solid ${theme.accent}44`, borderRadius: 2,
                          }}>
                            {String(event.event_type)}
                          </span>
                        )}
                        {event.agent != null && (
                          <span style={{ fontSize: 7, color: theme.cyan, fontFamily: FONT }}>
                            {String(event.agent)}
                          </span>
                        )}
                      </div>
                      <pre style={{
                        margin: 0, fontSize: 9, lineHeight: 1.55, fontFamily: FONT,
                        color: theme.textDim, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}
                        dangerouslySetInnerHTML={{ __html: highlight(event, 0, isDark) }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <pre style={{
                  margin: 0, fontSize: 10, lineHeight: 1.6, fontFamily: FONT,
                  color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}
                  dangerouslySetInnerHTML={{ __html: highlight(fileContent.content, 0, isDark) }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
