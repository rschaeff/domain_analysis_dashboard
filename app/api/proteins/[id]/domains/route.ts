import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// Parse range string to get start and end positions
function parseRange(range: string): { start: number; end: number } | null {
  if (!range) return null

  // Handle simple range like "A:1-100" or "1-100" (take first segment if multiple)
  const firstSegment = range.split(',')[0].trim()

  // Remove chain prefix if present (e.g., "A:1-100" -> "1-100")
  const withoutChain = firstSegment.includes(':') ? firstSegment.split(':')[1] : firstSegment
  const parts = withoutChain.split('-')

  if (parts.length === 2) {
    const start = parseInt(parts[0])
    const end = parseInt(parts[1])
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return { start, end }
    }
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { id } = await params

    let pdbId: string
    let chainId: string

    // Check if ID is in source_id format (e.g., "1914_A")
    if (id.includes('_')) {
      const parts = id.split('_')

      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 1914_A)' },
          { status: 400 }
        )
      }

      pdbId = parts[0]
      chainId = parts[1]

    } else if (/^\d+$/.test(id)) {
      // Handle numeric database ID for backward compatibility
      const proteinId = parseInt(id)

      // Get the pdb_id and chain_id for this protein
      const proteinQuery = `
        SELECT pdb_id, chain_id
        FROM pdb_analysis.protein
        WHERE id = $1
      `

      const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, proteinId)

      if (!proteinResult || (proteinResult as any[]).length === 0) {
        return NextResponse.json(
          { error: `Protein not found: ${id}` },
          { status: 404 }
        )
      }

      const protein = (proteinResult as any[])[0]
      pdbId = protein.pdb_id
      chainId = protein.chain_id

    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use either source_id (1914_A) or numeric ID.' },
        { status: 400 }
      )
    }

    // Fetch putative domains for this protein
    // Added pdb_range, pdb_start, and pdb_end fields
    const putativeDomainsQuery = `
      SELECT
        pds.id,
        pds.protein_id,
        pds.pdb_id,
        pds.chain_id,
        pds.batch_id,
        pds.reference_version,
        pds.timestamp,
        pds.domain_number,
        pds.domain_id,
        pds.range,
        pds.pdb_range,
        pds.pdb_start,
        pds.pdb_end,
        pds.source,
        pds.source_id,
        pds.confidence,
        pds.t_group,
        pds.h_group,
        pds.x_group,
        pds.a_group,
        pds.evidence_count,
        pds.evidence_types,
        'putative' as domain_type
      FROM pdb_analysis.partition_domain_summary pds
      WHERE pds.pdb_id = $1 AND pds.chain_id = $2
      ORDER BY pds.domain_number
    `

    const putativeDomains = await prisma.$queryRawUnsafe(putativeDomainsQuery, pdbId, chainId)

    // Fetch reference domains used as evidence
    // Added pdb_range, pdb_start, and pdb_end fields from domain table
    const referenceDomainsQuery = `
      SELECT DISTINCT
        d.id,
        NULL as protein_id,
        $1 as pdb_id,
        $2 as chain_id,
        NULL as batch_id,
        NULL as reference_version,
        NULL as timestamp,
        ROW_NUMBER() OVER (ORDER BY d.id) as domain_number,
        d.ecod_domain_id as domain_id,
        d.range,
        d.pdb_range,
        d.pdb_start,
        d.pdb_end,
        de.evidence_type as source,
        COALESCE(de.source_id, de.hit_id, de.domain_ref_id) as source_id,
        de.confidence,
        d.t_group,
        d.h_group,
        d.x_group,
        d.a_group,
        1 as evidence_count,
        de.evidence_type as evidence_types,
        'reference' as domain_type
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domain_summary pds ON de.domain_id = pds.id
      JOIN pdb_analysis.domain d ON (
        de.source_id = d.ecod_domain_id OR
        de.hit_id = d.ecod_domain_id OR
        de.domain_ref_id = d.ecod_domain_id
      )
      WHERE pds.pdb_id = $1 AND pds.chain_id = $2
      ORDER BY d.id
    `

    const referenceDomains = await prisma.$queryRawUnsafe(referenceDomainsQuery, pdbId, chainId)

    // Process both types of domains
    const allDomains = [
      ...(putativeDomains as any[]),
      ...(referenceDomains as any[])
    ]

    const processedDomains = allDomains.map((domain, index) => {
      // Parse range to get start_pos and end_pos (handles chain prefixes)
      const parsedRange = parseRange(domain.range)

      return {
        ...domain,
        // Add parsed positions for frontend compatibility
        start_pos: parsedRange?.start || null,
        end_pos: parsedRange?.end || null,
        // Ensure domain_number is set
        domain_number: domain.domain_number || (index + 1)
      }
    })

    // Serialize the results to handle BigInt values
    const serializedDomains = serializeBigInt(processedDomains)

    return NextResponse.json(serializedDomains)

  } catch (error) {
    console.error('Error fetching protein domains:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch protein domains',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
