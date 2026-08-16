import type { ReactNode } from 'react'

import { availableYears, MONTH_LABELS, monthCalendar, monthsForYear } from '@/lib/analytics-period'
import { cn } from '@/lib/utils'
import type { Analytics, AnalyticsPeriod } from '@/services/api'

interface PeriodControlsProps {
  analytics: Analytics
  period: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
  children?: ReactNode
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-8 rounded-full px-3 text-sm font-medium transition-[color,background-color,transform] duration-200',
        'hover:scale-[1.04] active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function PeriodControls({ analytics, period, onChange, children }: PeriodControlsProps) {
  const years = availableYears(analytics)
  const selectedYear = period.mode === 'all' ? null : period.year
  const selectedMonth = period.mode === 'month' || period.mode === 'day' ? period.month : null
  const selectedDate = period.mode === 'day' ? period.date : null
  const monthRows = selectedYear == null ? [] : monthsForYear(analytics, selectedYear)
  const hasDaily = (analytics.daily?.length ?? 0) > 0
  const calendar = selectedMonth && hasDaily ? monthCalendar(analytics, selectedMonth) : null

  return (
    <div className="space-y-5 border-y border-border py-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Year</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Select year">
          <Chip active={period.mode === 'all'} onClick={() => onChange({ mode: 'all' })}>
            All years
          </Chip>
          {years.map((year) => (
            <Chip
              key={year}
              active={selectedYear === year}
              onClick={() => onChange({ mode: 'year', year })}
            >
              {year}
            </Chip>
          ))}
        </div>
      </div>

      {selectedYear != null && monthRows.length > 0 ? (
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Month in {selectedYear}
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Select month">
            <Chip
              active={period.mode === 'year'}
              onClick={() => onChange({ mode: 'year', year: selectedYear })}
            >
              Full year
            </Chip>
            {monthRows.map((row) => {
              const monthNumber = Number(row.month.slice(5))
              return (
                <Chip
                  key={row.month}
                  active={selectedMonth === row.month}
                  onClick={() => onChange({ mode: 'month', year: selectedYear, month: row.month })}
                >
                  {MONTH_LABELS[monthNumber - 1]}
                </Chip>
              )
            })}
          </div>
        </div>
      ) : null}

      {children}

      {selectedYear != null && selectedMonth && calendar ? (
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Days in {MONTH_LABELS[Number(selectedMonth.slice(5)) - 1]} {selectedYear}
          </p>
          <div
            className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5"
            role="group"
            aria-label="Select day"
          >
            {calendar.weekdayLabels.map((label) => (
              <div
                key={label}
                className="px-1 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {calendar.cells.map((cell, index) => {
              if (cell == null) {
                return <div key={`empty-${index}`} />
              }
              const intensity = calendar.maxTrips > 0 ? cell.trips / calendar.maxTrips : 0
              const isSelected = selectedDate === cell.date
              const dayNumber = Number(cell.date.slice(8))
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onChange({ mode: 'month', year: selectedYear, month: selectedMonth })
                      return
                    }
                    onChange({
                      mode: 'day',
                      year: selectedYear,
                      month: selectedMonth,
                      date: cell.date,
                    })
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${cell.date}, ${cell.trips.toLocaleString()} trips`}
                  className={cn(
                    'flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1 text-xs transition-[color,background-color,transform,box-shadow] duration-200',
                    'hover:scale-[1.06] active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:ring-1 hover:ring-border',
                  )}
                  style={
                    isSelected
                      ? undefined
                      : {
                          backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(8 + intensity * 42)}%, var(--card))`,
                        }
                  }
                >
                  <span className="font-medium leading-none">{dayNumber}</span>
                  <span className={cn('mt-1 font-mono text-[9px] leading-none', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {cell.trips > 0 ? cell.trips : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {period.mode === 'day'
              ? `Volume KPIs use ${period.date}. Station, route, and hour patterns stay at the ${selectedYear} year level.`
              : 'Campus pulse above shows every day in the month. Click a day on the chart or calendar to focus it.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
