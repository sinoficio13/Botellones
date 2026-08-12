import { NextResponse } from 'next/server';
import { getAlertas } from '@/lib/db/analytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getAlertas();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { premiosPendientes: [], clientesInactivos30: [], clientesInactivos60: [], botellonesDanados: [] },
      { status: 500 }
    );
  }
}