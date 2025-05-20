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

    let proteinQuery: string
    let queryParams: any[]

    // Check if ID is in source_id format (e.g., "1914_A")
    if (id.includes('_')) {
      const [pdbId, chainId] = id.split('_')

      if (!pdbId || !chainId) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 1914_A)' },
          { status: 400 }
        )
      }

      // Query by pdb_id and chain_id with comprehensive protein information
      proteinQuery = `
        SELECT
          p.id,
          p.pdb_id,
          p.chain_id,
          p.source_id,
          p.unp_acc,
          p.name,
          p.type,
          p.tax_id,
          p.length as sequence_length,
          p.created_at,
          p.updated_at,
          -- Domain statistics
          COUNT(d.id) as domain_count,
          COUNT(CASE WHEN d.t_group IS NOT NULL THEN 1 END) as fully_classified_domains,
          COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as domains_with_evidence,
          -- Calculate coverage (sum of domain lengths / sequence length)
          CASE
            WHEN p.length > 0 AND COUNT(d.id) > 0 THEN
              COALESCE(SUM(d.end_pos - d.start_pos + 1)::float / p.length, 0)
            ELSE 0
          END as coverage,
          COALESCE(SUM(d.end_pos - d.start_pos + 1), 0) as residues_assigned,
          -- Classification status
          CASE WHEN COUNT(d.id) > 0 THEN true ELSE false END as is_classified,
          -- Batch and reference information
          MAX(pp.batch_id) as batch_id,
          MAX(pp.reference_version) as reference_version
        FROM pdb_analysis.protein p
        LEFT JOIN pdb_analysis.domain d ON p.id = d.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
        LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
        WHERE p.pdb_id = $1 AND p.chain_id = $2
        GROUP BY
          p.id, p.pdb_id, p.chain_id, p.source_id, p.unp_acc,
          p.name, p.type, p.tax_id, p.length, p.created_at, p.updated_at
      `
      queryParams = [pdbId, chainId]

    } else if (/^\d+$/.test(id)) {
      // Fallback: handle numeric database ID for backward compatibility
      const proteinId = parseInt(id)

      proteinQuery = `
        SELECT
          p.id,
          p.pdb_id,
          p.chain_id,
          p.source_id,
          p.unp_acc,
          p.name,
          p.type,
          p.tax_id,
          p.length as sequence_length,
          p.created_at,
          p.updated_at,
          -- Domain statistics
          COUNT(d.id) as domain_count,
          COUNT(CASE WHEN d.t_group IS NOT NULL THEN 1 END) as fully_classified_domains,
          COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as domains_with_evidence,
          -- Calculate coverage (sum of domain lengths / sequence length)
          CASE
            WHEN p.length > 0 AND COUNT(d.id) > 0 THEN
              COALESCE(SUM(d.end_pos - d.start_pos + 1)::float / p.length, 0)
            ELSE 0
          END as coverage,
          COALESCE(SUM(d.end_pos - d.start_pos + 1), 0) as residues_assigned,
          -- Classification status
          CASE WHEN COUNT(d.id) > 0 THEN true ELSE false END as is_classified,
          -- Batch and reference information
          MAX(pp.batch_id) as batch_id,
          MAX(pp.reference_version) as reference_version
        FROM pdb_analysis.protein p
        LEFT JOIN pdb_analysis.domain d ON p.id = d.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
        LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
        WHERE p.id = $1
        GROUP BY
          p.id, p.pdb_id, p.chain_id, p.source_id, p.unp_acc,
          p.name, p.type, p.tax_id, p.length, p.created_at, p.updated_at
      `
      queryParams = [proteinId]

    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use either source_id (1914_A) or numeric ID.' },
        { status: 400 }
      )
    }

    const result = await prisma.$queryRawUnsafe(proteinQuery, ...queryParams)

    if (!result || (result as any[]).length === 0) {
      return NextResponse.json(
        { error: `Protein not found: ${id}` },
        { status: 404 }
      )
    }

    // Get the protein data and ensure source_id is set
    const protein = (result as any[])[0]

    // Ensure source_id is always available for consistency
    if (!protein.source_id) {
      protein.source_id = `${protein.pdb_id}_${protein.chain_id}`
    }

    // Serialize the result to handle BigInt values
    const serializedProtein = serializeBigInt(protein)

    return NextResponse.json(serializedProtein)

  } catch (error) {
    console.error('Error fetching protein:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
