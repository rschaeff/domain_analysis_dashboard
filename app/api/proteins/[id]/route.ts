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
    const domainId = parseInt(id)

    if (isNaN(domainId)) {
      return NextResponse.json(
        { error: 'Invalid domain ID' },
        { status: 400 }
      )
    }

    // Fetch domain details using raw SQL query
    const domainQuery = `
      SELECT
        pd.id,
        pd.protein_id,
        pp.pdb_id,
        pp.chain_id,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp,
        pd.domain_number,
        pd.domain_id,
        pd.start_pos,
        pd.end_pos,
        pd.range,
        pd.source,
        pd.source_id,
        pd.confidence,
        pd.t_group,
        pd.h_group,
        pd.x_group,
        pd.a_group,
        COUNT(de.id) as evidence_count,
        COALESCE(STRING_AGG(DISTINCT de.evidence_type, ', '), 'none') as evidence_types
      FROM pdb_analysis.partition_domains pd
      JOIN pdb_analysis.partition_proteins pp ON pd.protein_id = pp.id
      LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
      WHERE pd.id = $1
      GROUP BY
        pd.id, pd.protein_id, pp.pdb_id, pp.chain_id, pp.batch_id,
        pp.reference_version, pp.timestamp, pd.domain_number, pd.domain_id,
        pd.start_pos, pd.end_pos, pd.range, pd.source, pd.source_id,
        pd.confidence, pd.t_group, pd.h_group, pd.x_group, pd.a_group
    `

    const result = await prisma.$queryRawUnsafe(domainQuery, domainId)

    if (!result || (result as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }

    // Serialize the result to handle BigInt values
    const serializedResult = serializeBigInt((result as any[])[0])

    return NextResponse.json(serializedResult)

  } catch (error) {
    console.error('Error fetching domain details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domain details' },
      { status: 500 }
    )
  }
}
