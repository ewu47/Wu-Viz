import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const ATLAS_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'rhythm', label: 'Rhythm' },
  { id: 'covid', label: 'COVID' },
  { id: 'weather', label: 'Weather' },
  { id: 'map', label: 'Map' },
  { id: 'riders', label: 'Riders' },
  { id: 'method', label: 'Method' },
  { id: 'findings', label: 'Findings' },
] as const

export function AtlasNav() {
  const [active, setActive] = useState<string>(ATLAS_SECTIONS[0].id)

  useEffect(() => {
    const nodes = ATLAS_SECTIONS
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node != null)

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActive(visible[0].target.id)
      },
      {
        rootMargin: '-30% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      className="atlas-toc"
      aria-label="Atlas sections"
    >
      <div className="atlas-shell">
        <p className="sr-only">On this page</p>
        <ul className="flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ATLAS_SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className={cn(
                  'inline-flex min-h-8 items-center rounded-full px-3 text-[0.72rem] font-medium tracking-[0.04em]',
                  'uppercase transition-[color,background-color,transform] duration-200 hover:scale-[1.04]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
