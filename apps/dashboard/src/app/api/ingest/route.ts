import { NextRequest, NextResponse } from 'next/server';

const INGESTION_SERVICE_URL =
  process.env.INGESTION_SERVICE_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${INGESTION_SERVICE_URL}/ingest`, {
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
        message: 'Não foi possível conectar ao Ingestion Service.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

