// File: app/api/pdb/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Unified API route that serves mmCIF format for all structures
 * mmCIF works for both small and large structures, eliminating format issues
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    console.log(`[Structure API] Fetching mmCIF for: ${id}`);

    // Validate ID format
    if (!id || !id.match(/^[a-zA-Z0-9]{4}$/)) {
      console.error(`[Structure API] Invalid PDB ID format: ${id}`);
      return NextResponse.json(
        { error: 'Invalid PDB ID format. Must be 4 characters.' },
        { status: 400 }
      );
    }

    // Always use mmCIF - it works for all structures
    const sources = [
      {
        name: 'RCSB mmCIF',
        url: `https://files.rcsb.org/download/${id.toLowerCase()}.cif`
      },
      {
        name: 'PDBe mmCIF',
        url: `https://www.ebi.ac.uk/pdbe/static/entry/${id.toLowerCase()}_updated.cif`
      }
    ];

    let lastError: any = null;

    for (const source of sources) {
      try {
        console.log(`[Structure API] Trying ${source.name}: ${source.url}`);

        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 NextJS Proxy',
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout for large files
        });

        if (response.ok) {
          const data = await response.text();

          // Validate mmCIF data
          if (data.includes('data_') || data.includes('_entry.id')) {
            console.log(`[Structure API] Successfully fetched from ${source.name} (${data.length} bytes)`);

            return new NextResponse(data, {
              headers: {
                'Content-Type': 'chemical/x-mmcif',
                'Content-Disposition': `inline; filename="${id}.cif"`,
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'X-Structure-Format': 'mmcif', // Indicate format to client
              },
            });
          } else {
            console.warn(`[Structure API] Invalid mmCIF data from ${source.name}`);
          }
        } else {
          console.warn(`[Structure API] ${source.name} returned ${response.status}: ${response.statusText}`);
        }
      } catch (sourceError) {
        console.error(`[Structure API] Error with ${source.name}:`, sourceError);
        lastError = sourceError;
        continue;
      }
    }

    // If we get here, all sources failed
    return NextResponse.json(
      {
        error: `Failed to fetch structure ${id} from all sources`,
        details: lastError instanceof Error ? lastError.message : String(lastError),
        pdbId: id,
        format: 'mmcif'
      },
      { status: 404 }
    );

  } catch (error) {
    console.error(`[Structure API] Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
