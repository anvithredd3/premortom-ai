import { createContext, useContext, useState, ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  bg: string
  surface: string
  surface2: string
  border: string
  borderMid: string
  text: string
  textDim: string
  muted: string
  faint: string
  accent: string
  amber: string
  green: string
  red: string
  cyan: string
  orange: string
  purple: string
  // Sidebar-specific
  navBg: string
  navItem: string
  navItemActive: string
  navSection: string
  navFuture: string
  navLegend: string
  brand: string
}

export const DARK: Theme = {
  bg:             '#080808',
  surface:        '#0d0d0d',
  surface2:       '#111111',
  border:         '#1c1c1c',
  borderMid:      '#252525',
  text:           '#d0d0d0',
  textDim:        '#888888',
  muted:          '#555555',
  faint:          '#2a2a2a',
  accent:         '#ff3333',
  amber:          '#f59e0b',
  green:          '#22c55e',
  red:            '#ef4444',
  cyan:           '#22d3ee',
  orange:         '#f97316',
  purple:         '#7c3aed',
  navBg:          '#0d0d0d',
  navItem:        '#5a5a5a',
  navItemActive:  '#d0d0d0',
  navSection:     '#3a3a3a',
  navFuture:      '#252525',
  navLegend:      '#3a3a3a',
  brand:          '#ff3333',
}

export const LIGHT: Theme = {
  bg:             '#f0f0f0',
  surface:        '#ffffff',
  surface2:       '#f8f8f8',
  border:         '#e0e0e0',
  borderMid:      '#d0d0d0',
  text:           '#111111',
  textDim:        '#444444',
  muted:          '#777777',
  faint:          '#e8e8e8',
  accent:         '#cc1111',
  amber:          '#b45309',
  green:          '#15803d',
  red:            '#dc2626',
  cyan:           '#0369a1',
  orange:         '#c2410c',
  purple:         '#6d28d9',
  navBg:          '#1a1a1a',
  navItem:        '#888888',
  navItemActive:  '#f5f5f5',
  navSection:     '#555555',
  navFuture:      '#333333',
  navLegend:      '#666666',
  brand:          '#ff4444',
}

interface ThemeCtx {
  theme: Theme
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: DARK, mode: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    (localStorage.getItem('pm-theme') as ThemeMode | null) ?? 'dark'
  )

  const toggle = () =>
    setMode(m => {
      const next: ThemeMode = m === 'dark' ? 'light' : 'dark'
      localStorage.setItem('pm-theme', next)
      return next
    })

  const theme = mode === 'dark' ? DARK : LIGHT
  return (
    <ThemeContext.Provider value={{ theme, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
