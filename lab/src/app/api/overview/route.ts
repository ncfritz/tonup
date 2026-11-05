import { NextResponse } from 'next/server';

import { phoneOverview } from '~/lib/phone';

export const dynamic = 'force-dynamic';

// Capture's Overview tab: the active model against the bar, the dataset, coverage and pre-fill.
export function GET() {
  return NextResponse.json(phoneOverview());
}
