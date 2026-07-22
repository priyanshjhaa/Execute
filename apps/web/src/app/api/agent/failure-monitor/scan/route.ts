import { NextRequest, NextResponse } from 'next/server';
import { scanNewFailureFindings } from '@/lib/failure-monitor';
import { isAuthorizedSchedulerRequest } from '@/lib/scheduler-auth';

async function handleScan(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!isAuthorizedSchedulerRequest(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await scanNewFailureFindings());
  } catch (error) {
    console.error('Failure monitor scan failed:', error);
    return NextResponse.json({ error: 'Failure monitor scan failed' }, { status: 500 });
  }
}

export const GET = handleScan;
export const POST = handleScan;
