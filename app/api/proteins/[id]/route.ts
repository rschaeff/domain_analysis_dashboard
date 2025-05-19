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
    const proteinId = parseInt(id)

    if (isNaN(proteinId)) {
      return NextResponse.json(
        { error: 'Invalid protein ID' },
        { status: 400 }
      )
    }

    // Fetch protein overview
    const proteinQuery = `
      SELECT
        pp.id,
        pp.pdb_id,
        pp.chain_id,
        pp.batch_id,
        pp.reference_version,
        pp.is_classified,
        pp.sequence_length,
        pp.coverage,
        pp.residues_assigned,
        pp.domains_with_evidence,
        pp.fully_classified_domains,
        COUNT(pd.id) as domain_count
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      WHERE pp.id = $1
      GROUP BY
        pp.id, pp.pdb_id, pp.chain_id, pp.batch_id, pp.reference_version,
        pp.is_classified, pp.sequence_length, pp.coverage, pp.residues_assigned,
        pp.domains_with_evidence, pp.fully_classified_domains
    `

    const result = await prisma.$queryRawUnsafe(proteinQuery, proteinId)

    if (!result || (result as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Protein not found' },
        { status: 404 }
      )
    }

    // Serialize the result to handle BigInt values
    const serializedResult = serializeBigInt((result as any[])[0])

    return NextResponse.json(serializedResult)

  } catch (error) {
    console.error('Error fetching protein details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch protein details' },
      { status: 500 }
    )
  }
}
