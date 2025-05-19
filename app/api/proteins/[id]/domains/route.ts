import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

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

    // Fetch domains for this protein
    const domainsQuery = `
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
      WHERE pp.id = $1
      GROUP BY 
        pd.id, pd.protein_id, pp.pdb_id, pp.chain_id, pp.batch_id,
        pp.reference_version, pp.timestamp, pd.domain_number, pd.domain_id,
        pd.start_pos, pd.end_pos, pd.range, pd.source, pd.source_id,
        pd.confidence, pd.t_group, pd.h_group, pd.x_group, pd.a_group
      ORDER BY pd.domain_number
    `

    const domains = await prisma.$queryRawUnsafe(domainsQuery, proteinId)

    return NextResponse.json(domains)

  } catch (error) {
    console.error('Error fetching protein domains:', error)
    return NextResponse.json(
      { error: 'Failed to fetch protein domains' },
      { status: 500 }
    )
  }
}
