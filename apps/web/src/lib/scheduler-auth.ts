import type { NextRequest } from 'next/server'

function normalizeSecret(secret?: string | null) {
  return secret?.trim() || null
}

function collectSecrets() {
  return [
    normalizeSecret(process.env.SCHEDULER_SECRET),
    normalizeSecret(process.env.RESUME_SECRET),
    normalizeSecret(process.env.CRON_SECRET),
  ].filter((value): value is string => Boolean(value))
}

export function isAuthorizedSchedulerRequest(request: NextRequest, querySecret: string | null): boolean {
  const secrets = collectSecrets()
  if (secrets.length === 0) {
    return false
  }

  const normalizedQuerySecret = normalizeSecret(querySecret)
  const authHeader = request.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ')
    ? normalizeSecret(authHeader.slice('Bearer '.length))
    : null

  if (normalizedQuerySecret && secrets.includes(normalizedQuerySecret)) {
    return true
  }

  if (bearerSecret && secrets.includes(bearerSecret)) {
    return true
  }

  return false
}
