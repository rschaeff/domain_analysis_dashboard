// app/api/proteins/[id]/propagated/route.ts - Get propagated sequences for a representative
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
    const { id } = await params
    const { searchParams } = new URL(request.url)

    // Pagination for large propagated sets
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20')))
    const skip = (page - 1) * size

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

    // First, get the representative protein and its sequence MD5
    const representativeQuery = `
      SELECT
        p.id,
        p.pdb_id,
        p.chain_id,
        p.source_id,
        pp.sequence_md5,
        pp.process_version,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp
      FROM pdb_analysis.protein p
      JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
      WHERE p.pdb_id = $1 AND p.chain_id = $2
        AND pp.process_version = 'mini_pyecod_1.0'
      LIMIT 1
    `

    const representativeResult = await prisma.$queryRawUnsafe(representativeQuery, pdbId, chainId)
    const serializedRepResult = serializeBigInt(representativeResult)

    if (!serializedRepResult || serializedRepResult.length === 0) {
      return NextResponse.json(
        { error: `Representative not found: ${id}` },
        { status: 404 }
      )
    }

    const representative = serializedRepResult[0]

    if (!representative.sequence_md5) {
      return NextResponse.json(
        { error: `Representative ${id} has no sequence MD5 for propagation lookup` },
        { status: 400 }
      )
    }

    // Get propagated sequences with the same MD5 - MUCH SIMPLER NOW!
    const propagatedQuery = `
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
        pp.sequence_md5,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp as processing_date,
        pp.process_version,
        -- Domain statistics for this propagated sequence
        pd_stats.domain_count,
        pd_stats.domains_classified,
        pd_stats.avg_confidence,
        pd_stats.best_confidence,
        pd_stats.coverage,
        pd_stats.residues_assigned,
        -- Evidence count
        ev_stats.evidence_count,
        -- Batch information
        b.batch_name,
        b.type as batch_type,
        b.status as batch_status,
        -- Processing age
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - pp.timestamp)) / 86400.0 as days_since_processing
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      LEFT JOIN ecod_schema.batch b ON pp.batch_id = b.id
      -- Domain statistics subquery (simpler with direct partition_proteins)
      LEFT JOIN (
        SELECT
          pp2.id as partition_protein_id,
          COUNT(pd.id) as domain_count,
          COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) as domains_classified,
          AVG(pd.confidence) as avg_confidence,
          MAX(pd.confidence) as best_confidence,
          CASE
            WHEN p2.length > 0 AND SUM(pd.length) > 0
            THEN LEAST(1.0, SUM(pd.length)::float / p2.length::float)
            ELSE 0.0
          END as coverage,
          COALESCE(SUM(pd.length), 0) as residues_assigned
        FROM pdb_analysis.partition_proteins pp2
        JOIN pdb_analysis.protein p2 ON pp2.pdb_id = p2.pdb_id AND pp2.chain_id = p2.chain_id
        LEFT JOIN pdb_analysis.partition_domains pd ON pp2.id = pd.protein_id
        GROUP BY pp2.id, p2.length
      ) pd_stats ON pp.id = pd_stats.partition_protein_id
      -- Evidence statistics subquery (simpler)
      LEFT JOIN (
        SELECT
          pp2.id as partition_protein_id,
          COUNT(de.id) as evidence_count
        FROM pdb_analysis.partition_proteins pp2
        LEFT JOIN pdb_analysis.partition_domains pd ON pp2.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        GROUP BY pp2.id
      ) ev_stats ON pp.id = ev_stats.partition_protein_id
      WHERE pp.sequence_md5 = $1
        AND pp.process_version = 'mini_pyecod_propagated_1.0'
        AND p.id != $2  -- Exclude the representative itself
      ORDER BY pp.timestamp DESC, p.pdb_id, p.chain_id
      LIMIT $3 OFFSET $4
    `

    // Count total propagated sequences - MUCH SIMPLER!
    const countQuery = `
      SELECT COUNT(*) as total
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      WHERE pp.sequence_md5 = $1
        AND pp.process_version = 'mini_pyecod_propagated_1.0'
        AND p.id != $2
    `

    // Execute queries in parallel
    const [propagatedResult, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(propagatedQuery, representative.sequence_md5, representative.id, size, skip),
      prisma.$queryRawUnsafe(countQuery, representative.sequence_md5, representative.id)
    ])

    const propagatedSequences = serializeBigInt(propagatedResult).map((seq: any) => ({
      ...seq,
      // Add computed fields
      days_old: Math.floor(Number(seq.days_since_processing || 0)),
      is_recent: Number(seq.days_since_processing || 999) < 7,
      is_classified: seq.domain_count > 0,
      confidence_level: seq.best_confidence >= 0.8 ? 'high' :
                       seq.best_confidence >= 0.5 ? 'medium' : 'low',
      classification_completeness: seq.domain_count > 0 ?
        seq.domains_classified / seq.domain_count : 0
    }))

    const total = Number((countResult as any[])[0]?.total || 0)

    // Calculate summary statistics for all propagated sequences - CLEANER!
    const summaryQuery = `
      SELECT
        COUNT(*) as total_propagated,
        COUNT(CASE WHEN pd_stats.domain_count > 0 THEN 1 END) as classified_propagated,
        AVG(pd_stats.best_confidence) as avg_best_confidence,
        AVG(pd_stats.coverage) as avg_coverage,
        COUNT(DISTINCT pp.batch_id) as unique_batches,
        MIN(pp.timestamp) as earliest_processing,
        MAX(pp.timestamp) as latest_processing
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      LEFT JOIN (
        SELECT
          pp2.id as partition_protein_id,
          COUNT(pd.id) as domain_count,
          MAX(pd.confidence) as best_confidence,
          CASE
            WHEN p2.length > 0 AND SUM(pd.length) > 0
            THEN LEAST(1.0, SUM(pd.length)::float / p2.length::float)
            ELSE 0.0
          END as coverage
        FROM pdb_analysis.partition_proteins pp2
        JOIN pdb_analysis.protein p2 ON pp2.pdb_id = p2.pdb_id AND pp2.chain_id = p2.chain_id
        LEFT JOIN pdb_analysis.partition_domains pd ON pp2.id = pd.protein_id
        GROUP BY pp2.id, p2.length
      ) pd_stats ON pp.id = pd_stats.partition_protein_id
      WHERE pp.sequence_md5 = $1
        AND pp.process_version = 'mini_pyecod_propagated_1.0'
        AND p.id != $2
    `

    const summaryResult = await prisma.$queryRawUnsafe(summaryQuery, representative.sequence_md5, representative.id)
    const summary = serializeBigInt(summaryResult)[0] || {}

    return NextResponse.json({
      representative: {
        id: representative.id,
        pdb_id: representative.pdb_id,
        chain_id: representative.chain_id,
        source_id: representative.source_id,
        sequence_md5: representative.sequence_md5,
        process_version: representative.process_version,
        batch_id: representative.batch_id,
        reference_version: representative.reference_version,
        processing_date: representative.timestamp
      },
      propagated_sequences: propagatedSequences,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      summary: {
        total_propagated: Number(summary.total_propagated || 0),
        classified_propagated: Number(summary.classified_propagated || 0),
        classification_rate: summary.total_propagated > 0 ?
          (Number(summary.classified_propagated || 0) / Number(summary.total_propagated)) * 100 : 0,
        avg_best_confidence: Number(summary.avg_best_confidence || 0),
        avg_coverage: Number(summary.avg_coverage || 0),
        unique_batches: Number(summary.unique_batches || 0),
        earliest_processing: summary.earliest_processing,
        latest_processing: summary.latest_processing,
        processing_span_days: summary.earliest_processing && summary.latest_processing ?
          Math.ceil((new Date(summary.latest_processing).getTime() - new Date(summary.earliest_processing).getTime()) / (1000 * 60 * 60 * 24)) : 0
      },
      metadata: {
        source: 'propagated_sequences_by_md5',
        sequence_md5: representative.sequence_md5,
        representative_source_id: representative.source_id,
        representative_batch: representative.batch_id,
        query_time: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching propagated sequences:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch propagated sequences',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
