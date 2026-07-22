import { NextRequest } from 'next/server';
import { handleAgentActionDecision } from '@/lib/agent-action-api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function POST(request: NextRequest, context: RouteContext) {
  return handleAgentActionDecision(request, context, 'reject');
}
