import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import type { TooltipContentProps } from 'recharts'

import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label: React.ReactNode
    color?: string
  }
>

const ChartContext = React.createContext<ChartConfig>({})

function useChart() {
  return React.useContext(ChartContext)
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  }
>(({ config, className, children, style, ...props }, ref) => {
  const colorVariables = Object.fromEntries(
    Object.entries(config)
      .filter(([, item]) => item.color)
      .map(([key, item]) => [`--color-${key}`, item.color]),
  ) as React.CSSProperties

  return (
    <ChartContext.Provider value={config}>
      <div
        ref={ref}
        className={cn(
          'block w-full min-w-0 text-xs',
          '[&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:!w-full',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border/70',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-layer]:outline-none [&_.recharts-surface]:outline-none',
          className,
        )}
        style={{ ...colorVariables, ...style }}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  labelFormatter,
  formatter,
}: TooltipContentProps<number, string> & { className?: string }) {
  const config = useChart()

  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        'grid min-w-36 gap-2 rounded-xl border border-border bg-popover px-3 py-2.5',
        'text-xs text-popover-foreground shadow-lg',
        className,
      )}
    >
      {label !== undefined && (
        <div className="font-medium">
          {labelFormatter ? labelFormatter(label, payload) : String(label)}
        </div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index)
          const configured = config[key]
          const value = Number(item.value ?? 0)

          return (
            <div key={`${key}-${index}`} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color ?? configured?.color }}
              />
              <span className="text-muted-foreground">
                {configured?.label ?? item.name ?? key}
              </span>
              <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                {formatter
                  ? formatter(value, item.name ?? key, item, index, payload)
                  : value.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
