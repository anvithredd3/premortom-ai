import { CSSProperties, Suspense, lazy, useCallback, useState } from 'react'
import { IntakeView } from './intake'
import { useAnalysisStream } from './stream'
import type { Bid, FullReport } from './types'
import { BidDashboard } from './BidDashboard'
import { QuoteUpload } from './QuoteUpload'
import { BidMonitor } from './BidMonitor'
import { BidResults } from './BidResults'
import { DbStatus } from './DbStatus'
import { MarketResearch } from './MarketResearch'
import { RfqNegotiation } from './RfqNegotiation'
import { InvoiceMonitor } from './InvoiceMonitor'
import { SystemDesign } from './SystemDesign'
import { RunLogs } from './RunLogs'
import { LandingPage } from './LandingPage'
import { useTheme, DARK } from './theme'

// Lazy-load analysis views (contain Plotly which is ~4.8 MB)
const LazyInvestigationBoard = lazy(() =>
  import('./analysis').then(m => ({ default: m.InvestigationBoard }))
)
const LazyDebateRoom = lazy(() =>
  import('./analysis').then(m => ({ default: m.DebateRoom }))
)
const LazyExecutiveDashboard = lazy(() =>
  import('./analysis').then(m => ({ default: m.ExecutiveDashboard }))
)
const LazyReportView = lazy(() =>
  import('./analysis').then(m => ({ default: m.ReportView }))
)

/* ── Sample shortcut ─────────────────────────────────────────────────── */
const SAMPLE_INPUT = {
  procurement_name: 'AIIMS MRI Scanner',
  equipment_type: 'MRI Machine',
  contract_value_cr: 18.0,
  advance_payment_pct: 60.0,
  delivery_timeline_months: 4.0,
  warranty_start: 'On Delivery',
  installation_responsibility: 'Buyer',
  training_included: false,
  construction_completion_pct: 60.0,
  electrical_readiness: 'Pending',
  regulatory_approval_status: 'Pending',
  technicians_available: 0,
  technicians_required: 6,
  historical_delays_months: [8.0, 11.0, 7.0],
}

/* ── Theme — use DARK as module-level fallback for non-component constants ── */
const C = DARK
const FONT = "'JetBrains Mono', monospace"

/* ── Feature availability indicator dots ─────────────────────────────
   🔵 cyan  = built & functional
   🟠 orange = UI shell / requires config
   ⚫ #1e1e1e = not built / coming soon
   ─────────────────────────────────────────────────────────────────── */
type Avail = 'live' | 'partial' | 'soon'

const AVAIL_COLOR: Record<Avail, string> = {
  live:    C.cyan,
  partial: C.orange,
  soon:    '#1e2a2a',
}

/* ── Screen type ────────────────────────────────────────────────────── */
type Screen =
  | 'home'      // 00 — Landing page
  | 'rfq'       // 01 — RFQ / Negotiation Guidance
  | 'intake'    // 02 — Procurement Input
  | 'board'     // 02 — Investigation Board
  | 'debate'    // 03 — Debate Room
  | 'dashboard' // 04 — Executive Dashboard
  | 'report'    // 05 — PreMortem Report
  | 'bid'       // 06 — Bid Evaluation
  | 'market'    // 07 — Market Research
  | 'db'        // 08 — Database / Memory
  | 'invoice'   // 09 — Invoice Monitoring
  | 'system'    // 10 — System Design
  | 'logs'      // 11 — Run Output Logs

type BidView = 'bid-dashboard' | 'quote-upload' | 'bid-monitor' | 'bid-results'

/* ── Navigation config ──────────────────────────────────────────────── */
interface NavItem {
  screen: Screen
  label: string
  num: string
  avail: Avail
}

interface NavGroup {
  section: string
  items: NavItem[]
}

interface LockedItem {
  label: string
  desc: string
}

const NAV: NavGroup[] = [
  {
    section: 'PREMORTEM ANALYSIS',
    items: [
      { screen: 'rfq',       label: 'RFQ / NEGOTIATION',    num: '00', avail: 'partial' },
      { screen: 'intake',    label: 'PROCUREMENT INPUT',    num: '01', avail: 'live'    },
      { screen: 'board',     label: 'INVESTIGATION BOARD',  num: '02', avail: 'live'    },
      { screen: 'debate',    label: 'DEBATE ROOM',          num: '03', avail: 'live'    },
      { screen: 'dashboard', label: 'EXECUTIVE DASHBOARD',  num: '04', avail: 'live'    },
      { screen: 'report',    label: 'PREMORTEM REPORT',     num: '05', avail: 'live'    },
    ],
  },
  {
    section: 'BID EVALUATION',
    items: [
      { screen: 'bid', label: 'BID EVALUATION', num: '06', avail: 'live' },
    ],
  },
  {
    section: 'INTELLIGENCE',
    items: [
      { screen: 'market',  label: 'MARKET RESEARCH',   num: '07', avail: 'partial' },
      { screen: 'db',      label: 'DATABASE / MEMORY', num: '08', avail: 'live'    },
    ],
  },
  {
    section: 'POST-AWARD',
    items: [
      { screen: 'invoice', label: 'INVOICE MONITORING', num: '09', avail: 'soon' },
    ],
  },
  {
    section: 'PLATFORM',
    items: [
      { screen: 'system', label: 'SYSTEM DESIGN', num: '10', avail: 'live' },
      { screen: 'logs',   label: 'RUN LOGS',       num: '11', avail: 'live' },
    ],
  },
]

/* Future workflow placeholders — not navigable, just shown for platform vision */
const FUTURE_WORKFLOWS: LockedItem[] = [
  { label: 'VENDOR EVALUATION',     desc: 'Multi-vendor onboarding risk review' },
  { label: 'COMPLIANCE AUDIT',      desc: 'Policy, regulatory, and governance check' },
  { label: 'COST OPTIMISATION',     desc: 'Benchmark and lifecycle cost reduction' },
  { label: 'CONTRACT RISK REVIEW',  desc: 'Standalone contract risk assessment' },
]

/* ── Lazy fallback ──────────────────────────────────────────────────── */
function LoadingFallback() {
  const { theme: C } = useTheme()
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: C.muted, letterSpacing: '0.18em', fontFamily: FONT, background: C.bg,
    }}>
      LOADING
    </div>
  )
}

/* ── Sidebar ────────────────────────────────────────────────────────── */
function Sidebar({
  screen, hasRun, onChange,
}: {
  screen: Screen
  hasRun: boolean
  onChange: (s: Screen) => void
}) {
  const { theme: SB, mode, toggle } = useTheme()

  return (
    <nav style={{
      width: 210, flexShrink: 0, background: SB.navBg, borderRight: `1px solid ${SB.border}`,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Brand — click to go home */}
      <button
        onClick={() => onChange('home')}
        style={{
          padding: '18px 16px 14px',
          background: 'none', border: 'none', borderBottom: `1px solid ${SB.border}`,
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: '0.22em', color: SB.brand, fontWeight: 700, fontFamily: FONT }}>
          PREMORTEM
        </div>
        <div style={{ fontSize: 10, color: SB.navFuture, letterSpacing: '0.14em', fontFamily: FONT, marginTop: 2 }}>
          AGENTIC DECISION REVIEW PLATFORM
        </div>
      </button>

      {/* Nav groups */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section}>
            <div style={{
              padding: '12px 16px 4px',
              fontSize: 10, letterSpacing: '0.18em', color: SB.navSection,
              fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase',
            }}>
              {group.section}
            </div>

            {group.items.map(item => {
              const active = screen === item.screen
              const needsRun = ['board', 'debate', 'dashboard', 'report'].includes(item.screen)
              const dimmed = needsRun && !hasRun && !active
              const dotColor = dimmed ? SB.border : AVAIL_COLOR[item.avail]

              return (
                <button
                  key={item.screen}
                  onClick={() => onChange(item.screen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '7px 16px',
                    background: active ? SB.faint : 'none',
                    border: 'none',
                    borderLeft: `2px solid ${active ? SB.brand : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    background: dotColor,
                    boxShadow: item.avail === 'live' && !dimmed ? `0 0 4px ${dotColor}66` : 'none',
                  }} />
                  <span style={{
                    fontSize: 10, color: active ? SB.brand : dimmed ? SB.border : SB.navSection,
                    fontFamily: FONT, letterSpacing: '0.08em', flexShrink: 0, width: 14,
                  }}>
                    {item.num}
                  </span>
                  <span style={{
                    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: active ? SB.navItemActive : dimmed ? SB.border : SB.navItem,
                    fontFamily: FONT, fontWeight: active ? 600 : 400,
                  }}>
                    {item.label}
                  </span>
                  {active && (
                    <div style={{ marginLeft: 'auto', width: 3, height: 3, borderRadius: '50%', background: SB.brand, flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* Future workflows — locked */}
        <div>
          <div style={{
            padding: '12px 16px 4px',
            fontSize: 10, letterSpacing: '0.18em', color: SB.navFuture,
            fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase',
          }}>
            FUTURE WORKFLOWS
          </div>
          {FUTURE_WORKFLOWS.map(fw => (
            <div key={fw.label} title={fw.desc} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 16px', cursor: 'default' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: SB.border, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: SB.navFuture, fontFamily: FONT, letterSpacing: '0.08em', width: 14 }}>—</span>
              <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: SB.navFuture, fontFamily: FONT }}>
                {fw.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: legend + theme toggle */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${SB.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {([
          [C.cyan,    'Live'],
          [C.orange,  'Partial'],
          ['#1e2a2a', 'Pending'],
        ] as const).map(([col, lbl]) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: col }} />
            <span style={{ fontSize: 9, color: SB.navLegend, fontFamily: FONT, letterSpacing: '0.1em' }}>{lbl}</span>
          </div>
        ))}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
            background: SB.faint, border: `1px solid ${SB.border}`, borderRadius: 2,
            padding: '5px 10px', cursor: 'pointer', width: '100%',
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1 }}>{mode === 'dark' ? '☀' : '🌙'}</span>
          <span style={{ fontSize: 10, color: SB.navLegend, fontFamily: FONT, letterSpacing: '0.12em' }}>
            {mode === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
          </span>
        </button>

        <div style={{ marginTop: 4, fontSize: 9, color: SB.navFuture, fontFamily: FONT, letterSpacing: '0.08em' }}>
          PREMORTEM AI v1.0
        </div>
      </div>
    </nav>
  )
}

/* ── Header bar ─────────────────────────────────────────────────────── */
function Header({
  screen, bidView, procName, runId, isRunning, hasRun,
  onNewAnalysis, onAllBids, onRerun,
}: {
  screen: Screen
  bidView: BidView
  procName?: string
  runId?: string | null
  isRunning: boolean
  hasRun: boolean
  onNewAnalysis: () => void
  onAllBids: () => void
  onRerun: () => void
}) {
  const { theme: C } = useTheme()
  const titles: Record<Screen, string> = {
    home:      'PREMORTEM AI',
    rfq:       'RFQ / NEGOTIATION GUIDANCE',
    intake:    'PROCUREMENT INPUT',
    board:     'INVESTIGATION BOARD',
    debate:    'DEBATE ROOM',
    dashboard: 'EXECUTIVE DASHBOARD',
    report:    'PREMORTEM REPORT',
    bid:       'BID EVALUATION',
    market:    'MARKET RESEARCH',
    db:        'DATABASE / MEMORY',
    invoice:   'INVOICE MONITORING',
    system:    'SYSTEM DESIGN',
    logs:      'RUN OUTPUT LOGS',
  }

  const bidBreadcrumb: Record<BidView, string> = {
    'bid-dashboard': 'BID DASHBOARD',
    'quote-upload':  'QUOTE UPLOAD',
    'bid-monitor':   'MONITOR',
    'bid-results':   'RESULTS',
  }

  const crumb = screen === 'bid' ? bidBreadcrumb[bidView] : titles[screen]

  const btnStyle = (active = false): CSSProperties => ({
    background: 'none', border: `1px solid ${active ? C.muted : C.border}`,
    borderRadius: 2, padding: '4px 12px', fontSize: 11,
    letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: FONT,
    color: active ? C.text : C.muted, cursor: 'pointer',
  })

  return (
    <header style={{
      display: 'flex', alignItems: 'center', padding: '0 20px', height: 44, gap: 12,
      borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: C.surface,
    }}>
      <div style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.1em', fontFamily: FONT }}>
        {crumb}
        {procName && !['intake', 'bid', 'rfq', 'invoice'].includes(screen) && (
          <span style={{ color: C.muted }}> · {procName}</span>
        )}
      </div>

      {isRunning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: C.textDim,
            animation: 'pulse 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.14em', fontFamily: FONT }}>
            ANALYZING
          </span>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {['board', 'debate', 'dashboard', 'report'].includes(screen) && hasRun && (
          <button onClick={onNewAnalysis} style={btnStyle()}>NEW ANALYSIS</button>
        )}
        {screen === 'intake' && hasRun && (
          <>
            <button onClick={onNewAnalysis} style={btnStyle()}>CLEAR</button>
            <button onClick={onRerun} disabled={isRunning} style={btnStyle()}>RERUN</button>
          </>
        )}
        {screen === 'bid' && bidView !== 'bid-dashboard' && (
          <button onClick={onAllBids} style={btnStyle()}>ALL BIDS</button>
        )}
        {screen === 'bid' && runId && (
          <span style={{ fontSize: 10, color: C.muted, fontFamily: FONT, letterSpacing: '0.1em' }}>
            {runId}
          </span>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </header>
  )
}

/* ── Root ───────────────────────────────────────────────────────────── */
export default function App() {
  const { agentStates, runResult, fullReport, isRunning, error, startAnalysis, reset } = useAnalysisStream()
  const { theme: C } = useTheme()

  const [screen, setScreen] = useState<Screen>('home')

  // PreMortem shared state
  const [confirmedInput, setConfirmedInput] = useState<Record<string, unknown> | null>(null)

  // Bid workflow state
  const [bidView,     setBidView]     = useState<BidView>('bid-dashboard')
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

  const hasRun = runResult !== null

  /* ── PreMortem handlers ─────────────────────────────────────────── */
  const goToAnalysis = useCallback((
    fields: object,
    _meta?: { category?: string; research?: unknown[]; missingFields?: string[] },
  ) => {
    setConfirmedInput(fields as Record<string, unknown>)
    reset()
    startAnalysis(fields)
    setScreen('board')
  }, [reset, startAnalysis])

  const handleNewAnalysis = useCallback(() => {
    reset()
    setConfirmedInput(null)
    setScreen('intake')
  }, [reset])

  const handleRerun = useCallback(() => {
    if (confirmedInput) {
      reset()
      startAnalysis(confirmedInput)
    }
  }, [confirmedInput, reset, startAnalysis])

  const handleLoadSample = useCallback(() => goToAnalysis(SAMPLE_INPUT), [goToAnalysis])

  /* ── Bid handlers ───────────────────────────────────────────────── */
  function handleSelectBid(bid: Bid) {
    setSelectedBid(bid)
    setBidView('quote-upload')
  }

  async function handleStartRun(quoteIds: string[]) {
    if (!selectedBid) return
    try {
      const r = await fetch('/api/bid-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: selectedBid.bid_id, quote_ids: quoteIds }),
      })
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setActiveRunId(data.run_id)
      setBidView('bid-monitor')
    } catch (e) {
      alert(String(e))
    }
  }

  function handleRunComplete(runId: string) {
    setActiveRunId(runId)
    setBidView('bid-results')
  }

  /* ── Export handler ─────────────────────────────────────────────── */
  const handleExport = useCallback(async (fmt: string) => {
    if (!runResult || !confirmedInput) return
    try {
      const body = {
        ...confirmedInput,
        overall_risk_score: runResult.score,
        conditions: runResult.conditions,
        recommended_decision: runResult.decision,
        projected_financial_loss_cr: parseFloat(
          runResult.exposure_range.replace(/[^0-9.]/g, '')
        ) || 0,
        predicted_failure_mode: agentStates.decision.summary ?? '',
        agent_results: [],
        debate: fullReport?.debate ?? [],
        scenarios: fullReport?.scenarios ?? [],
        failure_probability_pct: fullReport?.failure_probability_pct ?? 0,
        confidence_pct: fullReport?.confidence_pct ?? 85,
        predicted_delay_months: fullReport?.predicted_delay_months ?? 0,
        supporting_evidence: fullReport?.supporting_evidence ?? [],
        predicted_outcomes: fullReport?.predicted_outcomes ?? [],
        generated_at: fullReport?.generated_at ?? new Date().toISOString(),
      }
      const r = await fetch(`/api/report/${fmt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await r.text())
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = (confirmedInput.procurement_name as string ?? 'premortem').replace(/\s+/g, '_')
      a.download = `${name}_premortem.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Export failed: ${e}`)
    }
  }, [runResult, confirmedInput, agentStates, fullReport])

  const procName = confirmedInput?.procurement_name as string | undefined

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', height: '100vh', background: C.bg,
      fontFamily: FONT, color: C.text, overflow: 'hidden',
    }}>
      <Sidebar screen={screen} hasRun={hasRun} onChange={setScreen} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          screen={screen}
          bidView={bidView}
          procName={procName}
          runId={activeRunId}
          isRunning={isRunning}
          hasRun={hasRun}
          onNewAnalysis={handleNewAnalysis}
          onAllBids={() => setBidView('bid-dashboard')}
          onRerun={handleRerun}
        />

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '8px 20px', background: C.accent + '12', borderBottom: `1px solid ${C.accent}44`,
            fontSize: 13, color: C.accent, letterSpacing: '0.06em', fontFamily: FONT, flexShrink: 0,
          }}>
            ERROR: {error}
          </div>
        )}

        {/* ── Screen router ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* 00 — Landing page */}
          {screen === 'home' && (
            <LandingPage
              onProcurement={() => setScreen('intake')}
              onBidEvaluation={() => { setScreen('bid'); setBidView('bid-dashboard') }}
            />
          )}

          {/* 01 — RFQ / Negotiation Guidance */}
          {screen === 'rfq' && <RfqNegotiation />}

          {/* 01 — Procurement Input */}
          {screen === 'intake' && (
            <IntakeView onConfirm={goToAnalysis} onLoadSample={handleLoadSample} />
          )}

          {/* 02 — Investigation Board */}
          {screen === 'board' && (
            <Suspense fallback={<LoadingFallback />}>
              <LazyInvestigationBoard
                agentStates={agentStates}
                confirmedInput={confirmedInput}
              />
            </Suspense>
          )}

          {/* 03 — Debate Room */}
          {screen === 'debate' && (
            <Suspense fallback={<LoadingFallback />}>
              <LazyDebateRoom
                debate={fullReport?.debate ?? []}
                runResult={runResult}
              />
            </Suspense>
          )}

          {/* 04 — Executive Dashboard */}
          {screen === 'dashboard' && (
            <Suspense fallback={<LoadingFallback />}>
              <LazyExecutiveDashboard
                agentStates={agentStates}
                runResult={runResult}
                fullReport={fullReport as FullReport | null}
                confirmedInput={confirmedInput}
              />
            </Suspense>
          )}

          {/* 05 — PreMortem Report */}
          {screen === 'report' && (
            <Suspense fallback={<LoadingFallback />}>
              <LazyReportView
                runResult={runResult}
                fullReport={fullReport as FullReport | null}
                confirmedInput={confirmedInput}
                onExport={handleExport}
              />
            </Suspense>
          )}

          {/* 06 — Bid Evaluation */}
          {screen === 'bid' && (
            <>
              {bidView === 'bid-dashboard' && (
                <BidDashboard
                  onSelectBid={handleSelectBid}
                  onUpload={bid => { setSelectedBid(bid); setBidView('quote-upload') }}
                />
              )}
              {bidView === 'quote-upload' && selectedBid && (
                <QuoteUpload
                  bid={selectedBid}
                  onBack={() => setBidView('bid-dashboard')}
                  onStartRun={handleStartRun}
                />
              )}
              {bidView === 'bid-monitor' && selectedBid && activeRunId && (
                <BidMonitor
                  bid={selectedBid}
                  runId={activeRunId}
                  onBack={() => setBidView('quote-upload')}
                  onComplete={handleRunComplete}
                />
              )}
              {bidView === 'bid-results' && selectedBid && activeRunId && (
                <BidResults
                  runId={activeRunId}
                  bidId={selectedBid.bid_id}
                  bidName={selectedBid.procurement_name}
                  onBack={() => setBidView('bid-monitor')}
                  onNewBid={() => {
                    setBidView('bid-dashboard')
                    setSelectedBid(null)
                    setActiveRunId(null)
                  }}
                  onGoNegotiation={() => setScreen('rfq')}
                />
              )}
            </>
          )}

          {/* 07 — Market Research */}
          {screen === 'market' && <MarketResearch runId={activeRunId} />}

          {/* 08 — Database / Memory */}
          {screen === 'db' && <DbStatus />}

          {/* 09 — Invoice Monitoring */}
          {screen === 'invoice' && <InvoiceMonitor />}

          {/* 10 — System Design */}
          {screen === 'system' && (
            <SystemDesign
              agentStates={agentStates}
              hasRun={hasRun}
            />
          )}

          {/* 11 — Run Output Logs */}
          {screen === 'logs' && <RunLogs />}
        </div>
      </div>
    </div>
  )
}
