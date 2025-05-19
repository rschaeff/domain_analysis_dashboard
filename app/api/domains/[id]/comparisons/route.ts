import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const domainId = parseInt(params.id)
    
    if (isNaN(domainId)) {
      return NextResponse.json(
        { error: 'Invalid domain ID' },
        { status: 400 }
      )
    }

    // Fetch comparisons for this domain
    const comparisonsQuery = `
      SELECT 
        dc.id,
        dc.partition_domain_id,
        dc.reference_type,
        dc.reference_domain_id,
        dc.reference_domain_range,
        dc.jaccard_similarity,
        dc.overlap_residues,
        dc.union_residues,
        dc.precision,
        dc.recall,
        dc.f1_score,
        dc.t_group_match,
        dc.h_group_match,
        dc.x_group_match,
        dc.a_group_match,
        dc.created_at
      FROM pdb_analysis.domain_comparisons dc
      WHERE dc.partition_domain_id = $1
      ORDER BY dc.jaccard_similarity DESC
    `

    const comparisons = await prisma.$queryRawUnsafe(comparisonsQuery, domainId)

    return NextResponse.json(comparisons)

  } catch (error) {
    console.error('Error fetching domain comparisons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domain comparisons' },
      { status: 500 }
    )
  }
}
