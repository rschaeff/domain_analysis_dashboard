// Create: app/api/pdb/[id]/validate/route.ts
// Server-side PDB validation to avoid CORS issues

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const pdbId = id.toLowerCase();

    console.log(`[PDB Validation] Checking: ${pdbId}`);

    // Validate ID format
    if (!pdbId.match(/^[a-zA-Z0-9]{4}$/)) {
      return NextResponse.json({
        pdbId,
        exists: false,
        accessible: false,
        error: 'Invalid PDB ID format',
        timestamp: new Date().toISOString()
      });
    }

    // STEP 1: Check if our local API can serve this structure
    try {
      const localResponse = await fetch(`${request.nextUrl.origin}/api/pdb/${pdbId}`, {
        method: 'HEAD'
      });

      if (localResponse.ok) {
        return NextResponse.json({
          pdbId,
          exists: true,
          accessible: true,
          source: 'local_api',
          timestamp: new Date().toISOString()
        });
      }
    } catch (localError) {
      console.log(`[PDB Validation] Local API check failed: ${localError}`);
    }

    // STEP 2: Check RCSB API server-side (no CORS issues)
    try {
      const apiUrl = `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`;
      const apiResponse = await fetch(apiUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'ECOD-Domain-Analysis/1.0'
        }
      });

      const exists = apiResponse.ok;
      
      // If it exists at RCSB, check if the file is accessible
      let accessible = false;
      if (exists) {
        try {
          const fileUrl = `https://files.rcsb.org/download/${pdbId}.cif`;
          const fileResponse = await fetch(fileUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'ECOD-Domain-Analysis/1.0'
            }
          });
          accessible = fileResponse.ok;
        } catch (fileError) {
          console.log(`[PDB Validation] File check failed: ${fileError}`);
        }
      }

      return NextResponse.json({
        pdbId,
        exists,
        accessible,
        source: 'rcsb_api',
        local_available: false,
        note: accessible ? 'Available at RCSB but not in local repository' : 'Structure exists but file not accessible',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // If external validation fails, return local-only result
      return NextResponse.json({
        pdbId,
        exists: false,
        accessible: false,
        source: 'validation_failed',
        error: `External validation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`[PDB Validation] Error:`, error);
    return NextResponse.json({
      error: 'Validation service error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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
