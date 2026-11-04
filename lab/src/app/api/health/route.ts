import { NextResponse } from 'next/server';

import { labStatus } from '~/lib/status';

// Capture checks this to show "Lab connected" and which model is active (capture-lab.md › API).
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(labStatus());
}
