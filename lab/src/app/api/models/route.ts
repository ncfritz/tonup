import { NextResponse } from 'next/server';

import { phoneModels } from '~/lib/phone';

export const dynamic = 'force-dynamic';

// Capture's Models tab: every model's latest numbers and how much of its pre-fill was kept.
export function GET() {
  return NextResponse.json(phoneModels());
}
