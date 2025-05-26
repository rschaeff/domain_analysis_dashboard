// app/api/proteins/[id]/domains/route.ts - BATCH-AWARE VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Robust BigInt serializer (keeping your existing one)
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
    const { searchParams } = new URL(request.url)

    // Extract query parameters
    const batchId = searchParams.get('batch_id')
    const groupByBatch = searchParams.get('group_by_batch') === 'true'
    const includeAllBatches = searchParams.get('include_all_batches') === 'true'
    const latestOnly = searchParams.get('latest_only') !== 'false' // Default to true

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

    // First, check if protein exists in multiple batches
    const batchCheckQuery = `
      SELECT DISTINCT
        CAST(pp.batch_id AS INTEGER) as batch_id,
        pb.batch_name,
        pb.reference_version,
        pb.created_date as batch_created_date,
        pp.timestamp as processing_date,
        CAST(pp.id AS INTEGER) as processing_id
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN pdb_analysis.processing_batches pb ON pp.batch_id = pb.id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2
      ORDER BY pp.timestamp DESC
    `

    const batchCheckResult = await prisma.$queryRawUnsafe(batchCheckQuery, pdbId, chainId)
    const availableBatches = serializeBigInt(batchCheckResult)

    if (!availableBatches || availableBatches.length === 0) {
      return NextResponse.json(
        { error: `Protein not found in pipeline: ${id}` },
        { status: 404 }
      )
    }

    // If groupByBatch is true, return domains grouped by batch
    if (groupByBatch && !batchId) {
      const groupedDomainsQuery = `
        WITH batch_proteins AS (
          SELECT
            CAST(pp.id AS INTEGER) as processing_id,
            pp.pdb_id,
            pp.chain_id,
            CAST(pp.batch_id AS INTEGER) as batch_id,
            pp.reference_version,
            pp.timestamp as processing_date,
            CAST(pp.sequence_length AS INTEGER) as sequence_length,
            pp.is_classified,
            pp.coverage,
            pb.batch_name,
            pb.created_date as batch_created_date
          FROM pdb_analysis.partition_proteins pp
          LEFT JOIN pdb_analysis.processing_batches pb ON pp.batch_id = pb.id
          WHERE pp.pdb_id = $1 AND pp.chain_id = $2
        )
        SELECT
          bp.*,
          CAST(pd.id AS INTEGER) as domain_id,
          CAST(pd.domain_number AS INTEGER) as domain_number,
          pd.domain_id as domain_identifier,
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
          CAST(pd.length AS INTEGER) as length
        FROM batch_proteins bp
        JOIN pdb_analysis.partition_domains pd ON pd.protein_id = bp.processing_id
        LEFT JOIN pdb_analysis.t_classification tc ON pd.t_group = tc.t_id
        LEFT JOIN pdb_analysis.h_classification hc ON pd.h_group = hc.h_id
        LEFT JOIN pdb_analysis.x_classification xc ON pd.x_group = xc.x_id
        ORDER BY bp.batch_id DESC, pd.domain_number
      `

      const groupedResult = await prisma.$queryRawUnsafe(groupedDomainsQuery, pdbId, chainId)
      const groupedDomains = serializeBigInt(groupedResult)

      // Group by batch
      const domainsByBatch = groupedDomains.reduce((acc: any, row: any) => {
        const batchKey = `batch_${row.batch_id}`

        if (!acc[batchKey]) {
          acc[batchKey] = {
            batch_id: row.batch_id,
            batch_name: row.batch_name,
            reference_version: row.reference_version,
            processing_date: row.processing_date,
            batch_created_date: row.batch_created_date,
            protein: {
              processing_id: row.processing_id,
              pdb_id: row.pdb_id,
              chain_id: row.chain_id,
              source_id: `${row.pdb_id}_${row.chain_id}`,
              sequence_length: row.sequence_length,
              is_classified: row.is_classified,
              coverage: row.coverage
            },
            domains: []
          }
        }

        acc[batchKey].domains.push({
          id: row.domain_id,
          protein_id: row.processing_id,
          domain_number: row.domain_number,
          domain_id: row.domain_identifier,
          start_pos: row.start_pos,
          end_pos: row.end_pos,
          range: row.range,
          pdb_range: row.pdb_range,
          pdb_start: row.pdb_start,
          pdb_end: row.pdb_end,
          source: row.source,
          source_id: row.source_id,
          confidence: row.confidence,
          t_group: row.t_group,
          t_group_name: row.t_group_name,
          h_group: row.h_group,
          h_group_name: row.h_group_name,
          x_group: row.x_group,
          x_group_name: row.x_group_name,
          a_group: row.a_group,
          length: row.length
        })

        return acc
      }, {})

      return NextResponse.json({
        protein: {
          source_id: `${pdbId}_${chainId}`,
          pdb_id: pdbId,
          chain_id: chainId,
          available_batches: availableBatches
        },
        batches: Object.values(domainsByBatch),
        metadata: {
          grouped_by_batch: true,
          total_batches: Object.keys(domainsByBatch).length,
          total_domains: groupedDomains.length,
          bigint_serialized: true,
          includes_classification_names: true
        }
      })
    }

    // Standard mode: get domains for a specific batch or latest
    let targetBatchId = batchId ? parseInt(batchId) : null
    let targetProtein = null

    if (targetBatchId) {
      // Find the protein in the specified batch
      targetProtein = availableBatches.find((b: any) => b.batch_id === targetBatchId)
      if (!targetProtein) {
        return NextResponse.json(
          { error: `Protein ${id} not found in batch ${targetBatchId}` },
          { status: 404 }
        )
      }
    } else if (latestOnly || availableBatches.length === 1) {
      // Use the latest (first) batch
      targetProtein = availableBatches[0]
      targetBatchId = targetProtein.batch_id
    }

    // Get protein details for the selected batch
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
        pp.coverage,
        pb.batch_name,
        pb.created_date as batch_created_date
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN pdb_analysis.processing_batches pb ON pp.batch_id = pb.id
      WHERE pp.pdb_id = $1 AND pp.chain_id = $2 AND pp.batch_id = $3
    `

    const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, pdbId, chainId, targetBatchId)
    const serializedProteinResult = serializeBigInt(proteinResult)
    const protein = serializedProteinResult[0]

    // Get domains with classification names
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
    const domains = serializeBigInt(domainsResult)

    // Get evidence with classification names
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
        total_evidence_items: totalEvidenceItems,
        // Include information about other batches if requested
        ...(includeAllBatches && availableBatches.length > 1 ? {
          available_batches: availableBatches,
          is_multi_batch: true
        } : {})
      },
      domains: processedDomains,
      metadata: {
        source: 'partition_domains_direct',
        data_architecture: 'pipeline_native',
        batch_id: protein.batch_id,
        batch_name: protein.batch_name,
        reference_version: protein.reference_version,
        processing_date: protein.processing_date,
        total_domains: actualDomainCount,
        total_evidence_items: totalEvidenceItems,
        bigint_serialized: true,
        includes_classification_names: true,
        // Alert if multiple batches exist
        ...(availableBatches.length > 1 && !batchId ? {
          warning: `Protein exists in ${availableBatches.length} batches. Showing latest batch (${protein.batch_id}). Use batch_id parameter to specify.`,
          available_batch_ids: availableBatches.map((b: any) => b.batch_id)
        } : {})
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

// Add corresponding TypeScript types for better type safety
export interface DomainQueryParams {
  batch_id?: string
  group_by_batch?: string
  include_all_batches?: string
  latest_only?: string
}

export interface BatchInfo {
  batch_id: number
  batch_name: string
  reference_version: string
  processing_date: string
  batch_created_date: string
}

export interface DomainResponse {
  protein: {
    processing_id: number
    pdb_id: string
    chain_id: string
    source_id: string
    batch_id: number
    reference_version: string
    processing_date: string
    sequence_length: number
    is_classified: boolean
    coverage: number
    domain_count: number
    total_evidence_items: number
    batch_name?: string
    batch_created_date?: string
    available_batches?: BatchInfo[]
    is_multi_batch?: boolean
  }
  domains: Array<{
    id: number
    protein_id: number
    domain_number: number
    domain_id: string
    start_pos: number
    end_pos: number
    range: string
    pdb_range: string | null
    pdb_start: string | null
    pdb_end: string | null
    source: string
    source_id: string
    confidence: number
    t_group: string
    t_group_name: string | null
    h_group: string | null
    h_group_name: string | null
    x_group: string | null
    x_group_name: string | null
    a_group: string | null
    evidence: any[]
    evidence_count: number
  }>
  metadata: {
    source: string
    data_architecture: string
    batch_id: number
    batch_name: string
    reference_version: string
    processing_date: string
    total_domains: number
    total_evidence_items: number
    bigint_serialized: boolean
    includes_classification_names: boolean
    warning?: string
    available_batch_ids?: number[]
  }
}

// Also update MainCurationInterface.tsx to use the batch parameter:

// In loadProteinForCuration:
const loadProteinForCuration = async (protein: any) => {
  setIsLoadingProtein(true)
  setStructuresLoaded(false)
  setStructureError(null)
  setReviewStartTime(new Date())

  try {
    // Build query parameters
    const queryParams = new URLSearchParams()

    // If protein has batch_id, use it to ensure we get domains from the correct batch
    if (protein.batch_id) {
      queryParams.append('batch_id', protein.batch_id.toString())
    }

    // Optional: include information about all batches
    if (process.env.NODE_ENV === 'development') {
      queryParams.append('include_all_batches', 'true')
    }

    const domainsResponse = await fetch(
      `/api/proteins/${protein.source_id}/domains?${queryParams}`
    )

    if (!domainsResponse.ok) {
      throw new Error('Failed to load protein domains')
    }

    const domainsData = await domainsResponse.json()

    // Check for warnings about multiple batches
    if (domainsData.metadata?.warning) {
      console.warn('⚠️ Batch warning:', domainsData.metadata.warning)
    }

    console.log('📊 Batch-aware domain data:', {
      protein: {
        source_id: domainsData.protein.source_id,
        batch_id: domainsData.protein.batch_id,
        batch_name: domainsData.protein.batch_name,
        reference_version: domainsData.protein.reference_version
      },
      metadata: domainsData.metadata,
      domainCount: domainsData.domains?.length,
      availableBatches: domainsData.protein.available_batches?.length || 1
    })

    // Continue with domain processing...
    const processedDomains = processDomainDataCorrectly(domainsData.domains || [])

    // If evidence is not embedded, fetch it
    const domainsWithEvidence = await Promise.all(
      processedDomains.map(async (domain) => {
        if (domain.evidence && domain.evidence.length > 0) {
          // Evidence already included
          return domain
        }

        // Fetch evidence separately if needed
        try {
          const evidenceResponse = await fetch(`/api/domains/${domain.id}/evidence`)
          if (evidenceResponse.ok) {
            const evidence = await evidenceResponse.json()
            return {
              ...domain,
              evidence: evidence.filter((e: any) =>
                e.source_id && e.hit_range && e.confidence > 0.8
              )
            }
          }
        } catch (error) {
          console.error(`Failed to fetch evidence for domain ${domain.id}:`, error)
        }

        return domain
      })
    )

    // Flatten all evidence
    const allEvidence = domainsWithEvidence.flatMap(d => d.evidence || [])

    console.log('📋 Evidence summary:', {
      totalEvidence: allEvidence.length,
      evidenceTypes: [...new Set(allEvidence.map((e: any) => e.evidence_type))],
      batchInfo: {
        batch_id: domainsData.metadata.batch_id,
        batch_name: domainsData.metadata.batch_name,
        reference_version: domainsData.metadata.reference_version
      }
    })

    const proteinWithData = {
      ...protein,
      ...domainsData.protein, // Merge with API response protein data
      domains: domainsWithEvidence,
      evidence: allEvidence
    }

    setCurrentProtein(proteinWithData)

    // Continue with evidence selection...
  } catch (error) {
    console.error('❌ Error loading protein:', error)
    setStructureError(`Failed to load protein data: ${error.message}`)
  } finally {
    setIsLoadingProtein(false)
  }
}
