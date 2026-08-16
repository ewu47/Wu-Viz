import {
  academicCalendar,
  academicKindFill,
  academicKindLabel,
  type AcademicTerm,
} from '@/lib/academic-calendar'
import type { AnalyticsPeriod } from '@/services/api'

function formatRange(start: string, end: string) {
  const from = new Date(`${start}T12:00:00`)
  const to = new Date(`${end}T12:00:00`)
  if (start === end) {
    return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const fromLabel = from.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: from.getFullYear() === to.getFullYear() ? undefined : 'numeric',
  })
  const toLabel = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fromLabel} – ${toLabel}`
}

function periodForTerm(term: AcademicTerm): AnalyticsPeriod {
  const year = Number(term.start.slice(0, 4))
  const month = term.start.slice(0, 7)
  if (term.start === term.end) {
    return { mode: 'day', year, month, date: term.start }
  }
  return { mode: 'month', year, month }
}

export function AcademicCalendar({
  onSelectPeriod,
}: {
  onSelectPeriod: (period: AnalyticsPeriod) => void
}) {
  const terms = [...academicCalendar.terms].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div>
      <ol className="divide-y divide-border border-y border-border">
        {terms.map((term) => (
          <li key={term.id}>
            <button
              type="button"
              onClick={() => {
                onSelectPeriod(periodForTerm(term))
                document.getElementById('pulse')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="flex w-full flex-col gap-1 px-1 py-3.5 text-left transition-[background-color,transform] duration-200 hover:translate-x-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-border"
                  style={{ backgroundColor: academicKindFill[term.kind] }}
                  aria-hidden="true"
                />
                <span className="font-medium text-foreground">{term.label}</span>
              </span>
              <span className="flex flex-wrap items-baseline gap-3 pl-5 sm:pl-0">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {formatRange(term.start, term.end)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                  {academicKindLabel[term.kind]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        Official College dates for {academicCalendar.version.replace('uchicago-college-', '')}.{' '}
        <a
          href={academicCalendar.source}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          UChicago academic calendar
        </a>
        . Click a row to open that span on Campus pulse.
      </p>
    </div>
  )
}
