// app/api/proteins/[id]/domains/route.ts - UPDATED WITH CLASSIFICATION NAMES
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Robust BigInt serializer
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }

  return obj;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params

    let pdbId: string
    let chainId: string

    // Parse source_id format (e.g., "5c3l_B")
    if (id.includes('_')) {
      const parts = id.split('_')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 5c3l_B)' },
          { status: 400 }
        )
      }
      pdbId = parts[0]
      chainId = parts[1]
    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use source_id format (5c3l_B).' },
        { status: 400 }
      )
    }

    // Use explicit CAST to avoid BigInt issues and include classification names
    const proteinQuery = `
      SELECT
        CAST(pp.id AS INTEGER) as processing_id,
        pp.pdb_id,
        pp.chain_id,
        pp.pdb_id || '_' || pp.chain_id as source_id,
        CAST(pp.batch_id AS INTEGER) as batch_id,
        pp.reference_version,
        pp.timestamp as processing_date,
        CAST(pp.sequence_length AS INTEGER) as sequence_length,
        pp.is_classified,
        pp.coverage
      FROM pdb_analysis.partition_proteins pp
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
    `

    const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, pdbId, chainId)
    const serializedProteinResult = serializeBigInt(proteinResult)

    if (!serializedProteinResult || serializedProteinResult.length === 0) {
      return NextResponse.json(
        { error: `Protein not found in pipeline: ${id}` },
        { status: 404 }
      )
    }

    const protein = serializedProteinResult[0]

    // Get domains with explicit CAST and classification names
    const domainsQuery = `
      SELECT
        CAST(pd.id AS INTEGER) as id,
        CAST(pd.protein_id AS INTEGER) as protein_id,
        CAST(pd.domain_number AS INTEGER) as domain_number,
        pd.domain_id,
        CAST(pd.start_pos AS INTEGER) as start_pos,
        CAST(pd.end_pos AS INTEGER) as end_pos,
        pd.range,
        pd.pdb_range,
        pd.pdb_start,
        pd.pdb_end,
        pd.source,
        pd.source_id,
        pd.confidence,
        pd.t_group,
        tc.name as t_group_name,
        pd.h_group,
        hc.name as h_group_name,
        pd.x_group,
        xc.name as x_group_name,
        pd.a_group,
        pd.is_manual_rep,
        pd.is_f70,
        pd.is_f40,
        pd.is_f99,
        CAST(pd.length AS INTEGER) as length,
        'putative' as domain_type
      FROM pdb_analysis.partition_domains pd
      JOIN pdb_analysis.partition_proteins pp ON pd.protein_id = pp.id
      LEFT JOIN pdb_analysis.t_classification tc ON pd.t_group = tc.t_id
      LEFT JOIN pdb_analysis.h_classification hc ON pd.h_group = hc.h_id
      LEFT JOIN pdb_analysis.x_classification xc ON pd.x_group = xc.x_id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ORDER BY pd.domain_number
    `

    const domainsResult = await prisma.$queryRawUnsafe(domainsQuery, pdbId, chainId)
    const domains = serializeBigInt(domainsResult)

    // Get evidence with all available scoring data
    const evidenceQuery = `
      SELECT
        CAST(de.domain_id AS INTEGER) as domain_id,
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
        CAST(de.hsp_count AS INTEGER) as hsp_count,
        de.is_discontinuous,
        de.t_group as ref_t_group,
        de.h_group as ref_h_group,
        de.x_group as ref_x_group,
        de.a_group as ref_a_group,
        de.query_range,
        de.hit_range,
        CAST(COUNT(*) OVER (PARTITION BY de.domain_id) AS INTEGER) as domain_evidence_count
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domains pd ON de.domain_id = pd.id
      JOIN pdb_analysis.partition_proteins pp ON pd.protein_id = pp.id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ORDER BY de.domain_id, de.confidence DESC
    `

    const evidenceResult = await prisma.$queryRawUnsafe(evidenceQuery, pdbId, chainId)
    const evidence = serializeBigInt(evidenceResult)

    // Group evidence by domain
    const evidenceByDomain = evidence.reduce((acc: any, ev: any) => {
      if (!acc[ev.domain_id]) acc[ev.domain_id] = []
      acc[ev.domain_id].push(ev)
      return acc
    }, {})

    // Process domains with evidence
    const processedDomains = domains.map((domain: any) => ({
      ...domain,
      evidence: evidenceByDomain[domain.id] || [],
      evidence_count: (evidenceByDomain[domain.id] || []).length
    }))

    // Calculate summary stats
    const actualDomainCount = processedDomains.length
    const totalEvidenceItems = Object.values(evidenceByDomain).flat().length

    const response = {
      protein: {
        ...protein,
        domain_count: actualDomainCount,
        total_evidence_items: totalEvidenceItems
      },
      domains: processedDomains,
      metadata: {
        source: 'partition_domains_direct',
        data_architecture: 'pipeline_native',
        total_domains: actualDomainCount,
        total_evidence_items: totalEvidenceItems,
        bigint_serialized: true,
        includes_classification_names: true
      }
    }

    // Final serialization check
    const finalResponse = serializeBigInt(response)

    return NextResponse.json(finalResponse)

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
