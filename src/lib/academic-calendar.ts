import calendar from '../../config/uchicago-academic-calendar.json' with { type: 'json' }

export type AcademicKind = 'instruction' | 'break' | 'exams' | 'event'

export interface AcademicTerm {
  id: string
  label: string
  start: string
  end: string
  kind: AcademicKind
}

export const academicCalendar = {
  version: calendar.version,
  source: calendar.source,
  note: calendar.note,
  terms: calendar.terms as AcademicTerm[],
}

export const academicKindLabel: Record<AcademicKind, string> = {
  instruction: 'Instruction',
  break: 'Break',
  exams: 'Exams',
  event: 'Campus event',
}

export const academicKindFill: Record<AcademicKind, string> = {
  instruction: 'rgba(128, 0, 0, 0.11)',
  break: 'rgba(54, 109, 117, 0.18)',
  exams: 'rgba(196, 154, 74, 0.32)',
  event: 'rgba(180, 74, 70, 0.20)',
}

const KIND_ORDER: AcademicKind[] = ['instruction', 'break', 'exams', 'event']

export function termsInKindOrder(terms: AcademicTerm[] = academicCalendar.terms) {
  return [...terms].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.start.localeCompare(b.start),
  )
}

export function monthKey(date: string) {
  return date.slice(0, 7)
}

export function termsOverlappingMonths(months: string[]) {
  if (months.length === 0) return []
  const start = months[0]
  const end = months[months.length - 1]
  return termsInKindOrder().filter((term) => monthKey(term.start) <= end && monthKey(term.end) >= start)
}

export function termsOverlappingDates(dates: string[]) {
  if (dates.length === 0) return []
  const start = dates[0]
  const end = dates[dates.length - 1]
  return termsInKindOrder().filter((term) => term.start <= end && term.end >= start)
}

export function clampTermToMonths(term: AcademicTerm, months: string[]) {
  const start = months.find((month) => month >= monthKey(term.start)) ?? months[0]
  const end = [...months].reverse().find((month) => month <= monthKey(term.end)) ?? months[months.length - 1]
  return { x1: start, x2: end }
}

export function clampTermToDates(term: AcademicTerm, dates: string[]) {
  const start = dates.find((date) => date >= term.start) ?? dates[0]
  const end = [...dates].reverse().find((date) => date <= term.end) ?? dates[dates.length - 1]
  return { x1: start, x2: end }
}
