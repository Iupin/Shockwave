import type { ReactNode, SVGProps } from 'react'
import { LogoMark } from './LogoMark'

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      {children}
    </svg>
  )
}

export const Icons = {
  Logo: () => <LogoMark size={28} fill={100} active />,
  Home: () => (
    <Svg>
      <path d="M12 3 3 10v10h6v-6h6v6h6V10z" />
    </Svg>
  ),
  Search: () => (
    <Svg>
      <path d="M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
      <path d="m16 16 5 5-1.5 1.5-5-5z" />
    </Svg>
  ),
  Library: () => (
    <Svg>
      <path d="M3 4h2v16H3zm4 0h2v16H7zm4 1.5 10-2.5v16l-10 2.5z" />
    </Svg>
  ),
  Plus: () => (
    <Svg>
      <path d="M11 5h2v14h-2zm-6 6h14v2H5z" />
    </Svg>
  ),
  Heart: ({ filled = false }: { filled?: boolean }) => (
    <Svg>
      {filled ? (
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.4 3.2 5 6.6 5c2 0 3.3 1 4.4 2.4C12.1 6 13.4 5 15.4 5c3.4 0 5.4 3.4 4.1 6.8C19.5 16.4 12 21 12 21z" />
      ) : (
        <path d="M12.5 7.4C11.4 6 10.1 5 8.1 5 5 5 3 8 4.2 11.2 5.9 15.2 12 19.2 12 19.2s6.1-4 7.8-8C21 8 19 5 15.9 5c-2 0-3.3 1-4.4 2.4z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      )}
    </Svg>
  ),
  Playlist: () => (
    <Svg>
      <path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h10v2H4zm12-1.5v6l5-3z" />
    </Svg>
  ),
  Note: () => (
    <Svg>
      <path d="M9 4v11.3A3.5 3.5 0 1 0 11 18V8h8V4z" />
    </Svg>
  ),
  Play: () => (
    <Svg>
      <path d="M8 5v14l11-7z" />
    </Svg>
  ),
  Pause: () => (
    <Svg>
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </Svg>
  ),
  Next: () => (
    <Svg>
      <path d="M6 6v12l8.5-6zm10 0h2v12h-2z" />
    </Svg>
  ),
  Prev: () => (
    <Svg>
      <path d="M18 6v12L9.5 12zm-12 0h2v12H6z" />
    </Svg>
  ),
  Shuffle: () => (
    <Svg>
      <path d="M4 7h4.5l7 10H20v-2h-3.5L10 7H4zm0 10h3l2-2.8-1.4-2L6.2 15H4zm12.5-10H20V9h-2.8l-2 2.8 1.4 2z" />
    </Svg>
  ),
  Repeat: () => (
    <Svg>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z" />
    </Svg>
  ),
  Volume: () => (
    <Svg>
      <path d="M3 9v6h4l5 4V5L7 9zm13 3a4 4 0 0 0-2-3.5v7A4 4 0 0 0 16 12zm2 0a6 6 0 0 0-3-5.2v2.1A4 4 0 0 1 18 12a4 4 0 0 1-3 3.1v2.1A6 6 0 0 0 18 12z" />
    </Svg>
  ),
  ChevronLeft: () => (
    <Svg>
      <path d="M15 6 9 12l6 6-1.5 1.5L6 12l7.5-7.5z" />
    </Svg>
  ),
  ChevronRight: () => (
    <Svg>
      <path d="m9 6 6 6-6 6 1.5 1.5L18 12 10.5 4.5z" />
    </Svg>
  ),
  Trash: () => (
    <Svg>
      <path d="M9 3h6l1 2h5v2H3V5h5zm1 6h2v8h-2zm4 0h2v8h-2zM6 8h12l-1 13H7z" />
    </Svg>
  ),
  Edit: () => (
    <Svg>
      <path d="M3 17.3V21h3.7L18.8 8.9l-3.7-3.7zM21.7 6.04c.4-.4.4-1 0-1.4l-2.34-2.34a1 1 0 0 0-1.4 0l-1.83 1.83 3.7 3.7z" />
    </Svg>
  ),
  Sync: () => (
    <Svg>
      <path
        fillRule="evenodd"
        d="M4.2 3.2A1.7 1.7 0 0 1 5.9 1.5h5.4a1.7 1.7 0 0 1 1.7 1.7v17.6a1.7 1.7 0 0 1-1.7 1.7H5.9a1.7 1.7 0 0 1-1.7-1.7V3.2zm1.9 1.5v12.2h3.4V4.7H6.1zm.5 14h2.4v1.2H6.6v-1.2z"
      />
      <path d="M15.6 8.4a3.8 3.8 0 0 1 0 7.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18.4 5.8a7.2 7.2 0 0 1 0 12.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  ),
  Gear: () => (
    <Svg>
      <path d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 2h-4l-.3 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1L4.5 14.6l2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1L11 22h4l.3-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5A3.5 3.5 0 1 1 13 8.5a3.5 3.5 0 0 1 0 7z" />
    </Svg>
  )
}
