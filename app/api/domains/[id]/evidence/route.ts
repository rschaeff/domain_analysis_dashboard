import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

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

    // Fetch evidence for this domain
    const evidenceQuery = `
      SELECT
        de.id,
        de.domain_id,
        de.evidence_type,
        de.source_id,
        de.domain_ref_id,
        de.hit_id,
        de.pdb_id,
        de.chain_id,
        de.confidence,
        de.probability,
        de.evalue,
        de.score,
        de.hsp_count,
        de.is_discontinuous,
        de.t_group,
        de.h_group,
        de.x_group,
        de.a_group,
        de.query_range,
        de.hit_range,
        de.created_at
      FROM pdb_analysis.domain_evidence de
      WHERE de.domain_id = $1
      ORDER BY de.evidence_type, de.confidence DESC
    `

    const evidence = await prisma.$queryRawUnsafe(evidenceQuery, domainId)

    return NextResponse.json(evidence)

  } catch (error) {
    console.error('Error fetching domain evidence:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domain evidence' },
      { status: 500 }
    )
  }
}
