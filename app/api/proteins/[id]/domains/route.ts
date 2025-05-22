// app/api/proteins/[id]/domains/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params

    let pdbId: string
    let chainId: string

    // Parse source_id format (e.g., "1914_A")
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
    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use source_id format (1914_A).' },
        { status: 400 }
      )
    }

    // Get protein processing record from partition system
    const proteinQuery = `
      SELECT
        processing_id,
        pdb_id,
        chain_id,
        source_id,
        batch_id,
        reference_version,
        processing_date,
        sequence_length,
        domains_found,
        domains_classified,
        classification_status
      FROM pdb_analysis.pipeline_performance_summary
      WHERE pdb_id = $1 AND chain_id = $2
    `

    const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, pdbId, chainId)

    if (!proteinResult || (proteinResult as any[]).length === 0) {
      return NextResponse.json(
        { error: `Protein not found in pipeline: ${id}` },
        { status: 404 }
      )
    }

    const protein = (proteinResult as any[])[0]

    // Get domains directly from partition_domains
    const domainsQuery = `
      SELECT
        pd.id,
        pd.protein_id,
        pd.domain_number,
        pd.domain_id,
        pd.start_pos,
        pd.end_pos,
        pd.range,
        pd.pdb_range,
        pd.pdb_start,
        pd.pdb_end,
        pd.source,
        pd.source_id,
        pd.confidence,
        pd.t_group,
        pd.h_group,
        pd.x_group,
        pd.a_group,
        pd.is_manual_rep,
        pd.is_f70,
        pd.is_f40,
        pd.is_f99,
        pd.length,
        'putative' as domain_type
      FROM pdb_analysis.partition_domains pd
      JOIN pdb_analysis.partition_proteins pp ON pd.protein_id = pp.id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ORDER BY pd.domain_number
    `

    const domains = await prisma.$queryRawUnsafe(domainsQuery, pdbId, chainId)

    // Get evidence for these domains
    const evidenceQuery = `
      SELECT
        de.domain_id,
        de.evidence_type,
        de.source_id,
        de.confidence,
        de.evalue,
        de.probability,
        de.query_range,
        de.hit_range
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domains pd ON de.domain_id = pd.id
      JOIN pdb_analysis.partition_proteins pp ON pd.protein_id = pp.id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ORDER BY de.domain_id, de.confidence DESC
    `

    const evidence = await prisma.$queryRawUnsafe(evidenceQuery, pdbId, chainId)

    // Group evidence by domain
    const evidenceByDomain = (evidence as any[]).reduce((acc, ev) => {
      if (!acc[ev.domain_id]) acc[ev.domain_id] = []
      acc[ev.domain_id].push(ev)
      return acc
    }, {})

    // Process domains with evidence
    const processedDomains = (domains as any[]).map(domain => ({
      ...domain,
      evidence: evidenceByDomain[domain.id] || [],
      evidence_count: (evidenceByDomain[domain.id] || []).length
    }))

    // Consistency check
    const actualDomainCount = processedDomains.length
    const expectedDomainCount = Number(protein.domains_found)

    return NextResponse.json({
      protein: {
        ...protein,
        consistency_check: {
          expected_domains: expectedDomainCount,
          actual_domains: actualDomainCount,
          is_consistent: actualDomainCount === expectedDomainCount
        }
      },
      domains: processedDomains,
      metadata: {
        source: 'partition_domains_direct',
        data_architecture: 'pipeline_native',
        total_domains: actualDomainCount,
        total_evidence_items: Object.values(evidenceByDomain).flat().length
      }
    })

  } catch (error) {
    console.error('Error fetching partition domains:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch partition domains',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
