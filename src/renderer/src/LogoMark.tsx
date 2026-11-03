const PATH_A = 'M3 12c2.5-6 5.5-6 8 0s5.5 6 8 0'
const PATH_B = 'M5 16c2-4 4-4 6 0s4 4 6 0'

export function LogoMark({
  size = 28,
  fill = 0,
  active = false,
  checking = false
}: {
  size?: number
  fill?: number
  active?: boolean
  checking?: boolean
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, fill))
  return (
    <span
      className={`logo-mark${active ? ' active' : ''}${checking ? ' checking' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg className="logo-layer logo-base" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={PATH_A} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d={PATH_B} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg
        className="logo-layer logo-fill"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ clipPath: checking ? undefined : `inset(${100 - pct}% 0 0 0)` }}
      >
        <path d={PATH_A} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d={PATH_B} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}
