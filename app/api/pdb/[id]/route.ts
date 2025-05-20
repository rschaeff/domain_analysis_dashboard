import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy PDB/mmCIF file requests to avoid CORS issues
 * Usage:
 * - GET /api/pdb/cif/1cbs - Fetches mmCIF format for 1cbs
 * - GET /api/pdb/pdb/1cbs - Fetches PDB format for 1cbs
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { format: string; id: string } }
) {
  const { format, id } = params;

  // Validate ID format - basic check
  if (!id.match(/^[a-zA-Z0-9]{4}$/)) {
    return NextResponse.json(
      { error: 'Invalid PDB ID format. Must be 4 characters.' },
      { status: 400 }
    );
  }

  // Validate format
  if (format !== 'cif' && format !== 'pdb') {
    return NextResponse.json(
      { error: 'Invalid format. Must be "cif" or "pdb".' },
      { status: 400 }
    );
  }

  // Construct the URL to fetch from RCSB PDB
  const fileExtension = format === 'cif' ? 'cif' : 'pdb';
  const url = `https://files.rcsb.org/download/${id.toLowerCase()}.${fileExtension}`;

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
          pdbId: id,
          format: format
        },
        { status: response.status }
      );
    }

    // Get the response as array buffer
    const data = await response.arrayBuffer();

    // Return the file with appropriate headers
    return new NextResponse(data, {
      headers: {
        'Content-Type': format === 'cif' ? 'chemical/x-cif' : 'chemical/x-pdb',
        'Content-Disposition': `inline; filename="${id}.${fileExtension}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error(`Error fetching PDB file ${id}:`, error);
    return NextResponse.json(
      {
        error: 'Error fetching PDB file',
        details: error instanceof Error ? error.message : String(error),
        pdbId: id,
        format: format
      },
      { status: 500 }
    );
  }
}
