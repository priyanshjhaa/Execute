export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly'
  day?: string
  time: string
  timezone?: string
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  const getValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''

  return {
    year: Number(getValue('year')),
    month: Number(getValue('month')),
    day: Number(getValue('day')),
    hour: Number(getValue('hour')),
    minute: Number(getValue('minute')),
    second: Number(getValue('second')),
    weekday: getValue('weekday').toLowerCase(),
  }
}

function parseTime(time: string) {
  const [hour = '0', minute = '0'] = time.split(':')
  return {
    hour: Number(hour),
    minute: Number(minute),
  }
}

function compareStamp(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] || 0
    const bv = b[i] || 0

    if (av > bv) return 1
    if (av < bv) return -1
  }

  return 0
}

function getScheduleRunStamp(date: Date, timeZone: string, config: ScheduleConfig): number[] | null {
  const now = getZonedParts(date, timeZone)
  const { hour, minute } = parseTime(config.time)
  const currentTimeStamp = [now.hour, now.minute]
  const scheduledTimeStamp = [hour, minute]

  if (compareStamp(currentTimeStamp, scheduledTimeStamp) < 0) {
    return null
  }

  switch (config.frequency) {
    case 'daily':
      return [now.year, now.month, now.day, hour, minute]
    case 'weekly': {
      const scheduledWeekday = WEEKDAY_TO_INDEX[(config.day || '').toLowerCase()]
      const currentWeekday = WEEKDAY_TO_INDEX[now.weekday]

      if (scheduledWeekday === undefined || scheduledWeekday !== currentWeekday) {
        return null
      }

      return [now.year, now.month, now.day, hour, minute]
    }
    case 'monthly': {
      const dayOfMonth = Number(config.day || '1')
      if (!Number.isFinite(dayOfMonth) || dayOfMonth <= 0) {
        return null
      }

      if (now.day !== dayOfMonth) {
        return null
      }

      return [now.year, now.month, now.day, hour, minute]
    }
    default:
      return null
  }
}

export function buildScheduleExpression(config?: ScheduleConfig | null): string | null {
  if (!config?.time) {
    return null
  }

  const timezoneSuffix = config.timezone ? ` (${config.timezone})` : ''

  switch (config.frequency) {
    case 'daily':
      return `Daily at ${config.time}${timezoneSuffix}`
    case 'weekly':
      return `Weekly on ${config.day || 'Monday'} at ${config.time}${timezoneSuffix}`
    case 'monthly':
      return `Monthly on day ${config.day || '1'} at ${config.time}${timezoneSuffix}`
    default:
      return null
  }
}

export function isScheduledWorkflowDue(
  config?: ScheduleConfig | null,
  lastExecutedAt?: Date | string | null,
  now: Date = new Date()
): boolean {
  if (!config?.time) {
    return false
  }

  const timeZone = config.timezone || 'UTC'
  const currentRunStamp = getScheduleRunStamp(now, timeZone, config)

  if (!currentRunStamp) {
    return false
  }

  if (!lastExecutedAt) {
    return true
  }

  const lastRunDate = typeof lastExecutedAt === 'string' ? new Date(lastExecutedAt) : lastExecutedAt
  const lastRunParts = getZonedParts(lastRunDate, timeZone)
  const lastRunStamp = [
    lastRunParts.year,
    lastRunParts.month,
    lastRunParts.day,
    lastRunParts.hour,
    lastRunParts.minute,
  ]

  return compareStamp(lastRunStamp, currentRunStamp) < 0
}
