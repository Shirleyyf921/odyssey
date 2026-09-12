/**
 * Direction B (2026-09-12, the design canvas): the ground is near-black, the
 * ink is warm off-white, and the only colour on a screen is the man's own
 * accent, which comes with him from the server. Art is full-bleed and words
 * sit on a gradient, never in a box. The older keys stay for screens not yet
 * moved over.
 */
export const colors = {
  ground: '#050507',
  ink: '#f4f1ec',
  muted: 'rgba(244,241,236,0.62)',
  faint: 'rgba(244,241,236,0.38)',
  hairline: 'rgba(244,241,236,0.1)',
  glass: 'rgba(12,10,12,0.62)',
  glassSoft: 'rgba(12,10,12,0.45)',
  bg: '#0d0d12',
  surface: '#16161f',
  surfaceRaised: '#1f1f2b',
  border: '#2a2a38',
  text: '#f5f5f7',
  textMuted: '#9a9aa8',
  textFaint: '#5a5a68',
  accent: '#e0748a',
  accentSoft: '#3a2430',
  bubbleUser: '#e0748a',
  bubbleCharacter: '#22222e',
  danger: '#ff6b6b',
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const
