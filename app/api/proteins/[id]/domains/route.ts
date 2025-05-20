import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { id } = await params

    let proteinId: number

    // Check if ID is in source_id format (e.g., "1914_A")
    if (id.includes('_')) {
      const [pdbId, chainId] = id.split('_')

      if (!pdbId || !chainId) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 1914_A)' },
          { status: 400 }
        )
      }

      // First, get the protein ID from pdb_id and chain_id
      const proteinQuery = `
        SELECT id
        FROM pdb_analysis.protein
        WHERE pdb_id = $1 AND chain_id = $2
      `

      const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, pdbId, chainId)

      if (!proteinResult || (proteinResult as any[]).length === 0) {
        return NextResponse.json(
          { error: `Protein not found: ${id}` },
          { status: 404 }
        )
      }

      proteinId = (proteinResult as any[])[0].id

    } else if (/^\d+$/.test(id)) {
      // Handle numeric database ID for backward compatibility
      proteinId = parseInt(id)

      // Verify the protein exists
      const proteinExistsQuery = `
        SELECT id
        FROM pdb_analysis.protein
        WHERE id = $1
      `

      const proteinExists = await prisma.$queryRawUnsafe(proteinExistsQuery, proteinId)

      if (!proteinExists || (proteinExists as any[]).length === 0) {
        return NextResponse.json(
          { error: `Protein not found: ${id}` },
          { status: 404 }
        )
      }

    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use either source_id (1914_A) or numeric ID.' },
        { status: 400 }
      )
    }

    // Fetch domains for this protein with comprehensive information
    const domainsQuery = `
      SELECT
        d.id,
        d.protein_id,
        p.pdb_id,
        p.chain_id,
        p.source_id,
        -- Domain details
        ROW_NUMBER() OVER (ORDER BY d.range) as domain_number,
        d.domain_id,
        -- Parse range to get start and end positions
        CASE
          WHEN d.range ~ '^[0-9]+-[0-9]+$' THEN
            CAST(split_part(d.range, '-', 1) AS INTEGER)
          ELSE NULL
        END as start_pos,
        CASE
          WHEN d.range ~ '^[0-9]+-[0-9]+$' THEN
            CAST(split_part(d.range, '-', 2) AS INTEGER)
          ELSE NULL
        END as end_pos,
        d.range,
        d.is_manual_rep,
        d.is_f70,
        d.is_f40,
        d.is_f99,
        d.length,
        -- Classification
        d.t_group,
        d.h_group,
        d.x_group,
        d.a_group,
        -- Evidence information
        COUNT(de.id) as evidence_count,
        COALESCE(STRING_AGG(DISTINCT de.evidence_type, ', ' ORDER BY de.evidence_type), 'none') as evidence_types,
        -- Confidence (if available from evidence)
        MAX(de.confidence) as confidence,
        -- Source information (using the best evidence)
        FIRST_VALUE(de.evidence_type) OVER (
          PARTITION BY d.id
          ORDER BY de.confidence DESC NULLS LAST, de.evalue ASC NULLS LAST
        ) as source,
        FIRST_VALUE(COALESCE(de.source_id, de.hit_id)) OVER (
          PARTITION BY d.id
          ORDER BY de.confidence DESC NULLS LAST, de.evalue ASC NULLS LAST
        ) as source_id,
        -- Additional metadata
        d.created_at,
        d.updated_at,
        -- Batch information (if available)
        pp.batch_id,
        pp.reference_version,
        pp.timestamp
      FROM pdb_analysis.domain d
      JOIN pdb_analysis.protein p ON d.protein_id = p.id
      LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
      LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
      WHERE d.protein_id = $1
      GROUP BY
        d.id, d.protein_id, p.pdb_id, p.chain_id, p.source_id,
        d.domain_id, d.range, d.is_manual_rep, d.is_f70, d.is_f40, d.is_f99,
        d.length, d.t_group, d.h_group, d.x_group, d.a_group,
        d.created_at, d.updated_at, pp.batch_id, pp.reference_version, pp.timestamp
      ORDER BY
        CASE
          WHEN d.range ~ '^[0-9]+-[0-9]+$' THEN
            CAST(split_part(d.range, '-', 1) AS INTEGER)
          ELSE 999999
        END
    `

    const domains = await prisma.$queryRawUnsafe(domainsQuery, proteinId)

    // Process and enrich domain data
    const processedDomains = (domains as any[]).map((domain, index) => {
      // Ensure source_id is set for the protein
      if (!domain.source_id) {
        domain.source_id = `${domain.pdb_id}_${domain.chain_id}`
      }

      // Set domain number if not already set
      if (!domain.domain_number) {
        domain.domain_number = index + 1
      }

      // Parse range if start_pos and end_pos are not set
      if (!domain.start_pos && !domain.end_pos && domain.range) {
        const rangeParts = domain.range.split('-')
        if (rangeParts.length === 2) {
          domain.start_pos = parseInt(rangeParts[0])
          domain.end_pos = parseInt(rangeParts[1])
        }
      }

      return domain
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
