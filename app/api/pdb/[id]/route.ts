// File: app/api/pdb/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Simplified API route to proxy PDB file requests to avoid CORS issues
 * Usage:
 * - GET /api/pdb/1cbs - Fetches PDB format for 1cbs
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;

  // Validate ID format - basic check
  if (!id.match(/^[a-zA-Z0-9]{4}$/)) {
    return NextResponse.json(
      { error: 'Invalid PDB ID format. Must be 4 characters.' },
      { status: 400 }
    );
  }

  // Always use PDB format for 3DMol compatibility
  const url = `https://files.rcsb.org/download/${id.toLowerCase()}.pdb`;

  try {
    // Fetch the file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 NextJS Proxy',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch PDB file: ${response.status} ${response.statusText}`,
          pdbId: id
        },
        { status: response.status }
      );
    }

    // Get the response as text
    const data = await response.text();

    // Return the file with appropriate headers
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'chemical/x-pdb',
        'Content-Disposition': `inline; filename="${id}.pdb"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error(`Error fetching PDB file ${id}:`, error);
    return NextResponse.json(
      {
        error: 'Error fetching PDB file',
        details: error instanceof Error ? error.message : String(error),
        pdbId: id
      },
      { status: 500 }
    );
  }
}
