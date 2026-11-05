import { NextRequest, NextResponse } from 'next/server';

const QUERY_SERVICE_URL =
  process.env.QUERY_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const response = await fetch(`${QUERY_SERVICE_URL}/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Não foi possível conectar ao Query Service.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

