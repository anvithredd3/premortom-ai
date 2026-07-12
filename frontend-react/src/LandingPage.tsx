import { useEffect, useRef, useState } from 'react'

const MONO  = "'JetBrains Mono', monospace"
const SERIF = "'Playfair Display', Georgia, serif"
const TAGLINE = 'PreMortem AI catches procurement risks before you sign — not after they cost you.'

// Landing page accent — red fits the risk/threat theme
const ACCENT = '#e11d48'

const NODE_DATA: Array<{ label: string; color: string }> = [
  { label: 'VENDOR RISK',    color: '#ef4444' },
  { label: 'CONTRACT RISK',  color: '#f59e0b' },
  { label: 'COMPLIANCE',     color: '#f59e0b' },
  { label: 'FINANCIAL',      color: '#ef4444' },
  { label: 'HISTORICAL',     color: '#22c55e' },
  { label: 'MARKET BENCH',   color: '#22c55e' },
  { label: 'WORKFORCE',      color: '#f59e0b' },
  { label: 'INFRASTRUCTURE', color: '#22c55e' },
  { label: 'SCENARIO SIM',   color: '#06b6d4' },
  { label: 'BID REVIEW',     color: '#06b6d4' },
  { label: 'RISK AUDIT',     color: '#ef4444' },
  { label: 'DECISION',       color: '#06b6d4' },
  { label: 'PROCUREMENT',    color: '#22c55e' },
  { label: 'ANALYSIS',       color: '#22c55e' },
]

interface FloatNode {
  x: number; y: number; vx: number; vy: number
  label: string; color: string; phase: number; phaseSpeed: number
}

export function LandingPage({
  onProcurement,
  onBidEvaluation,
}: {
  onProcurement: () => void
  onBidEvaluation: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<FloatNode[]>([])
  const frameRef = useRef<number>(0)
  const [visible, setVisible] = useState(false)
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [showButtons, setShowButtons] = useState(false)

  // Initialise floating nodes
  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    nodesRef.current = NODE_DATA.map(nd => ({
      x: 80 + Math.random() * (w - 160),
      y: 80 + Math.random() * (h - 160),
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      label: nd.label,
      color: nd.color,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.008 + Math.random() * 0.012,
    }))
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Canvas draw loop — Obsidian-style solid connections
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const { width: w, height: h } = canvas
      const nodes = nodesRef.current

      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.phase += n.phaseSpeed
        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx) }
        if (n.x > w)  { n.x = w;  n.vx = -Math.abs(n.vx) }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy) }
        if (n.y > h)  { n.y = h;  n.vy = -Math.abs(n.vy) }
      }

      // Obsidian-style solid edges — solid lines, fade by distance
      const MAX_DIST = 240
      ctx.setLineDash([])
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < MAX_DIST) {
            const t = 1 - d / MAX_DIST // 1 at closest, 0 at MAX_DIST
            // Blend the two node colors slightly for the edge
            const alpha = t * t * 0.28  // quadratic fade, max ~0.28
            ctx.strokeStyle = `rgba(160, 165, 180, ${alpha})`
            ctx.lineWidth = 0.8 + t * 0.6
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Nodes with glow
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(n.phase)
        const r = 2.5 + pulse * 1.5

        // Soft outer glow
        const glowR = r * 7
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR)
        const glowAlpha = Math.round(pulse * 0x22).toString(16).padStart(2, '0')
        glow.addColorStop(0, n.color + glowAlpha)
        glow.addColorStop(1, n.color + '00')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2)
        ctx.fill()

        // Core dot
        const coreA = Math.round((0.55 + 0.45 * pulse) * 0xff).toString(16).padStart(2, '0')
        ctx.fillStyle = n.color + coreA
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()

        // Label — faint, pulses slightly
        const lblA = Math.round((0.16 + 0.16 * pulse) * 0xff).toString(16).padStart(2, '0')
        ctx.fillStyle = n.color + lblA
        ctx.font = `7px ${MONO}`
        ctx.fillText(n.label, n.x + r + 5, n.y + 2.5)
      }

      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Typewriter after fade-in
  useEffect(() => {
    if (!visible) return
    if (taglineIdx >= TAGLINE.length) {
      const t = setTimeout(() => setShowButtons(true), 500)
      return () => clearTimeout(t)
    }
    const delay = taglineIdx === 0 ? 1200 : 26 + Math.random() * 18
    const t = setTimeout(() => setTaglineIdx(i => i + 1), delay)
    return () => clearTimeout(t)
  }, [visible, taglineIdx])

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#050505' }}>
      {/* Animated canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Center overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.9s ease',
      }}>
        {/* Platform badge */}
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.32em', color: '#2a2a2a',
          textTransform: 'uppercase', marginBottom: 44,
          border: '1px solid #1a1a1a', padding: '5px 14px', borderRadius: 2,
        }}>
          AGENTIC · PROCUREMENT · RISK ANALYSIS
        </div>

        {/* Serif title */}
        <div style={{ textAlign: 'center', marginBottom: 52, userSelect: 'none' }}>
          <div style={{
            fontFamily: SERIF, fontSize: 116, fontWeight: 400,
            letterSpacing: '0.01em', color: '#e8e8e8', lineHeight: 1,
            textShadow: `0 0 120px ${ACCENT}18`,
          }}>
            PreMortem
          </div>
          <div style={{
            fontFamily: SERIF, fontSize: 116, fontWeight: 400,
            fontStyle: 'italic', letterSpacing: '0.02em',
            color: ACCENT, lineHeight: 1.05,
            textShadow: `0 0 80px ${ACCENT}66, 0 0 28px ${ACCENT}88`,
          }}>
            AI
          </div>
        </div>

        {/* Typewriter tagline */}
        <div style={{
          fontFamily: MONO, fontSize: 13, color: '#4a4a4a', maxWidth: 500,
          textAlign: 'center', lineHeight: 1.8, minHeight: 64,
          marginBottom: 68, letterSpacing: '0.03em',
        }}>
          {TAGLINE.slice(0, taglineIdx)}
          {taglineIdx < TAGLINE.length && (
            <span style={{ color: ACCENT, animation: 'blink 0.9s step-end infinite' }}>|</span>
          )}
        </div>

        {/* Two matched outline buttons */}
        <div style={{
          display: 'flex', gap: 12,
          opacity: showButtons ? 1 : 0,
          transform: showButtons ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.55s ease, transform 0.55s ease',
        }}>
          <LandingBtn accent={ACCENT} dim onClick={onProcurement}>
            PROCUREMENT ANALYSIS
          </LandingBtn>
          <LandingBtn accent={ACCENT} onClick={onBidEvaluation}>
            BID EVALUATION
          </LandingBtn>
        </div>

        {/* Version tag */}
        <div style={{
          position: 'absolute', bottom: 24, fontFamily: MONO,
          fontSize: 9, letterSpacing: '0.22em', color: '#1e1e1e',
          opacity: showButtons ? 1 : 0, transition: 'opacity 1s ease 0.3s',
        }}>
          PREMORTEM AI · v1.0 · AGENTIC DECISION REVIEW
        </div>
      </div>
    </div>
  )
}

function LandingBtn({
  accent, dim = false, onClick, children,
}: {
  accent: string
  dim?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  const base: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
    padding: '13px 30px', borderRadius: 2, cursor: 'pointer',
    transition: 'all 0.18s ease', background: 'none',
    border: `1px solid ${hovered ? accent : dim ? '#2a2a2a' : '#3a3a3a'}`,
    color: hovered ? accent : dim ? '#555' : '#888',
  }

  return (
    <button
      style={base}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}
