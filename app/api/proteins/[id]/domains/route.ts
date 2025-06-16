// app/api/proteins/[id]/domains/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return Number(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber)
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value)
    }
    return converted
  }

  return obj
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const batchId = searchParams.get('batch_id')
    const includeBatchInfo = searchParams.get('include_batch_info') !== 'false'

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

    // Check for multiple batches if needed - UPDATED for representative approach
    let batchInfo: any = null
    if (includeBatchInfo) {
      const batchCheckQuery = `
        WITH batch_data AS (
          SELECT DISTINCT
            pp.batch_id,
            b.batch_name,
            b.type as batch_type
          FROM pdb_analysis.partition_proteins pp
          LEFT JOIN ecod_schema.batch b ON pp.batch_id = b.id
          WHERE pp.pdb_id = $1 AND pp.chain_id = $2
            AND pp.process_version IN ('mini_pyecod_1.0', 'mini_pyecod_propagated_1.0')
          ORDER BY pp.batch_id DESC
        )
        SELECT
          COUNT(*) as batch_count,
          array_agg(batch_id) as batch_ids,
          array_agg(batch_name) as batch_names,
          array_agg(batch_type) as batch_types
        FROM batch_data
      `
      const batchCheckResult = await prisma.$queryRawUnsafe(batchCheckQuery, pdbId, chainId)
      batchInfo = convertBigIntToNumber(batchCheckResult)[0]
    }

    // Get protein with batch filtering
    const proteinQuery = `
      SELECT
        CAST(pp.id AS INTEGER) as processing_id,
        pp.pdb_id,
        pp.chain_id,
        pp.pdb_id || '_' || pp.chain_id as source_id,
        CAST(pp.batch_id AS INTEGER) as batch_id,
        pp.reference_version,
        pp.timestamp as processing_date,
        -- Use main protein table length if partition length is 0
        CAST(COALESCE(NULLIF(pp.sequence_length, 0), p.length) AS INTEGER) as sequence_length,
        pp.is_classified,
        pp.coverage,
        b.batch_name,
        b.type as batch_type,
        b.status as batch_status
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN ecod_schema.batch b ON pp.batch_id = b.id
      LEFT JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ${batchId ? 'AND pp.batch_id = $3' : ''}
      ORDER BY pp.timestamp DESC
      LIMIT 1
    `

    const queryParams = batchId ? [pdbId, chainId, parseInt(batchId)] : [pdbId, chainId]
    const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, ...queryParams)
    const serializedProteinResult = convertBigIntToNumber(proteinResult)

    if (!serializedProteinResult || serializedProteinResult.length === 0) {
      return NextResponse.json(
        {
          error: batchId
            ? `Protein not found in batch ${batchId}: ${id}`
            : `Protein not found in pipeline: ${id}`,
          debug_info: {
            searched_for: { pdbId, chainId, batchId },
            available_batches: batchInfo?.batch_ids || []
          }
        },
        { status: 404 }
      )
    }

    const protein = serializedProteinResult[0]

    // Get domains using the specific protein.id (ensures batch consistency)
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
      LEFT JOIN pdb_analysis.t_classification tc ON pd.t_group = tc.t_id
      LEFT JOIN pdb_analysis.h_classification hc ON pd.h_group = hc.h_id
      LEFT JOIN pdb_analysis.x_classification xc ON pd.x_group = xc.x_id
      WHERE pd.protein_id = $1
      ORDER BY pd.domain_number
    `

    const domainsResult = await prisma.$queryRawUnsafe(domainsQuery, protein.processing_id)
    const domains = convertBigIntToNumber(domainsResult)

    // Get evidence with all available scoring data and classification names
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
        tc_ref.name as ref_t_group_name,
        de.h_group as ref_h_group,
        hc_ref.name as ref_h_group_name,
        de.x_group as ref_x_group,
        xc_ref.name as ref_x_group_name,
        de.a_group as ref_a_group,
        de.query_range,
        de.hit_range,
        CAST(COUNT(*) OVER (PARTITION BY de.domain_id) AS INTEGER) as domain_evidence_count
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domains pd ON de.domain_id = pd.id
      LEFT JOIN pdb_analysis.t_classification tc_ref ON de.t_group = tc_ref.t_id
      LEFT JOIN pdb_analysis.h_classification hc_ref ON de.h_group = hc_ref.h_id
      LEFT JOIN pdb_analysis.x_classification xc_ref ON de.x_group = xc_ref.x_id
      WHERE pd.protein_id = $1
      ORDER BY de.domain_id, de.confidence DESC
    `

    const evidenceResult = await prisma.$queryRawUnsafe(evidenceQuery, protein.processing_id)
    const evidence = convertBigIntToNumber(evidenceResult)

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
        includes_classification_names: true,
        batch_id: protein.batch_id,
        batch_name: protein.batch_name,
        batch_type: protein.batch_type,
        reference_version: protein.reference_version,
        processing_date: protein.processing_date,
        // Add warning if protein exists in multiple batches and no batch specified
        ...(batchInfo && batchInfo.batch_count > 1 && !batchId ? {
          warning: `Protein exists in ${batchInfo.batch_count} batches. Showing latest batch (${protein.batch_id}). Use batch_id parameter to specify.`,
          available_batches: batchInfo.batch_ids.map((id: number, idx: number) => ({
            batch_id: id,
            batch_name: batchInfo.batch_names[idx],
            batch_type: batchInfo.batch_types[idx]
          }))
        } : {})
      }
    }

    // Final serialization check
    const finalResponse = convertBigIntToNumber(response)

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
