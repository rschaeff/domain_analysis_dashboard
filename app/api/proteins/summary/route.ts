// app/api/proteins/summary/route.ts - UPDATED VERSION with curation filters
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '50')))
    const skip = (page - 1) * size

    // Sorting
    const sort = searchParams.get('sort') || 'recent'
    const sortDir = searchParams.get('sort_dir') || 'desc'

    // Basic filters
    const pdbId = searchParams.get('pdb_id')
    const chainId = searchParams.get('chain_id')
    const batchId = searchParams.get('batch_id')
    const minConfidence = searchParams.get('min_confidence')
    const minLength = searchParams.get('sequence_length_min')
    const maxLength = searchParams.get('sequence_length_max')

    // NEW: Curation filters
    const hasCurationDecision = searchParams.get('has_curation_decision')
    const curationStatus = searchParams.get('curation_status')
    const curationDecisionType = searchParams.get('curation_decision_type')
    const curatorName = searchParams.get('curator_name')
    const curationDateFrom = searchParams.get('curation_date_from')
    const curationDateTo = searchParams.get('curation_date_to')
    const flaggedForReview = searchParams.get('flagged_for_review')
    const needsReview = searchParams.get('needs_review')

    // Build WHERE conditions
    const whereConditions: string[] = []
    const params: any[] = []

    const addParam = (value: any): string => {
      params.push(value)
      return `$${params.length}`
    }

    if (pdbId) {
      whereConditions.push(`pp.pdb_id ILIKE ${addParam(`%${pdbId}%`)}`)
    }
    if (chainId) {
      whereConditions.push(`pp.chain_id = ${addParam(chainId.toUpperCase())}`)
    }
    if (batchId) {
      whereConditions.push(`pp.batch_id = ${addParam(parseInt(batchId))}`)
    }

    // Use calculated sequence length for filters
    if (minLength) {
      whereConditions.push(`p.length >= ${addParam(parseInt(minLength))}`)
    }
    if (maxLength) {
      whereConditions.push(`p.length <= ${addParam(parseInt(maxLength))}`)
    }

    if (minConfidence) {
      whereConditions.push(`ds.best_domain_confidence >= ${addParam(parseFloat(minConfidence))}`)
    }

    // NEW: Curation decision filters
    if (hasCurationDecision !== null) {
      if (hasCurationDecision === 'true') {
        whereConditions.push(`cd.id IS NOT NULL`)
      } else if (hasCurationDecision === 'false') {
        whereConditions.push(`cd.id IS NULL`)
      }
    }

    if (curationStatus) {
      const statusList = curationStatus.split(',').map(s => s.trim()).filter(Boolean)
      if (statusList.length > 0) {
        const statusParams = statusList.map(status => addParam(status)).join(',')
        whereConditions.push(`cd.status IN (${statusParams})`)
      }
    }

    if (curationDecisionType) {
      const typeList = curationDecisionType.split(',').map(s => s.trim()).filter(Boolean)
      if (typeList.length > 0) {
        const typeParams = typeList.map(type => addParam(type)).join(',')
        whereConditions.push(`cd.decision_type IN (${typeParams})`)
      }
    }

    if (curatorName) {
      whereConditions.push(`cd.curator_name ILIKE ${addParam(`%${curatorName}%`)}`)
    }

    if (curationDateFrom) {
      whereConditions.push(`cd.decision_date >= ${addParam(curationDateFrom)}`)
    }

    if (curationDateTo) {
      whereConditions.push(`cd.decision_date <= ${addParam(curationDateTo)}`)
    }

    if (flaggedForReview === 'true') {
      whereConditions.push(`cd.flagged_for_review = true`)
    }

    if (needsReview === 'true') {
      whereConditions.push(`cd.needs_review = true`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Build ORDER BY clause
    const getSortClause = (): string => {
      const direction = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      switch (sort) {
        case 'recent':
          return `pp.timestamp ${direction} NULLS LAST`
        case 'batch':
          return `pp.batch_id ${direction} NULLS LAST, pp.timestamp DESC NULLS LAST`
        case 'confidence':
          return `ds.best_domain_confidence ${direction} NULLS LAST`
        case 'coverage':
          return `calculated_coverage ${direction} NULLS LAST`
        case 'domains':
          return `ds.domains_found ${direction} NULLS LAST`
        case 'sequence_length':
          return `p.length ${direction} NULLS LAST`
        case 'curation_date':
          return `cd.decision_date ${direction} NULLS LAST`
        default:
          return `pp.timestamp DESC NULLS LAST`
      }
    }

    // UPDATED QUERY: Include curation decision data
    const dataQuery = `
      WITH domain_stats AS (
        SELECT
          pp_1.id AS protein_id,
          count(pd.id) AS domains_found,
          count(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) AS domains_classified,
          count(CASE WHEN pd.t_group IS NULL THEN 1 END) AS domains_unclassified,
          avg(pd.confidence) AS avg_domain_confidence,
          max(pd.confidence) AS best_domain_confidence,
          min(pd.confidence) AS worst_domain_confidence
        FROM pdb_analysis.partition_proteins pp_1
        LEFT JOIN pdb_analysis.partition_domains pd ON pp_1.id = pd.protein_id
        GROUP BY pp_1.id
      ),
      evidence_stats AS (
        SELECT
          pp_1.id AS protein_id,
          count(de.id) AS total_evidence_generated,
          count(CASE WHEN de.evidence_type = 'chain_blast' THEN 1 END) AS chain_blast_evidence,
          count(CASE WHEN de.evidence_type = 'domain_blast' THEN 1 END) AS domain_blast_evidence,
          count(CASE WHEN de.evidence_type = 'hhsearch' THEN 1 END) AS hhsearch_evidence,
          count(DISTINCT de.evidence_type) AS evidence_types_count
        FROM pdb_analysis.partition_proteins pp_1
        LEFT JOIN pdb_analysis.partition_domains pd ON pp_1.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        GROUP BY pp_1.id
      ),
      coverage_stats AS (
        SELECT
          pp_1.id AS protein_id,
          -- Calculate actual coverage from partition domains and main protein length
          CASE
            WHEN p.length > 0 AND SUM(pd.length) > 0
            THEN LEAST(1.0, SUM(pd.length)::float / p.length::float)
            ELSE 0.0
          END as calculated_coverage,
          COALESCE(SUM(pd.length), 0) as residues_assigned
        FROM pdb_analysis.partition_proteins pp_1
        LEFT JOIN pdb_analysis.protein p ON pp_1.pdb_id = p.pdb_id AND pp_1.chain_id = p.chain_id
        LEFT JOIN pdb_analysis.partition_domains pd ON pp_1.id = pd.protein_id
        GROUP BY pp_1.id, p.length
      )
      SELECT
        pp.id AS processing_id,
        pp.pdb_id,
        pp.chain_id,
        (pp.pdb_id || '_' || pp.chain_id) AS source_id,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp AS processing_date,

        -- Use actual sequence length from main protein table
        COALESCE(p.length, 0) AS sequence_length,

        pp.is_classified,

        -- Use calculated coverage
        COALESCE(cs.calculated_coverage, 0) AS coverage,

        COALESCE(ds.domains_found, 0) AS domains_found,
        COALESCE(ds.domains_classified, 0) AS domains_classified,
        COALESCE(ds.domains_unclassified, 0) AS domains_unclassified,
        ds.avg_domain_confidence,
        ds.best_domain_confidence,
        ds.worst_domain_confidence,
        COALESCE(es.total_evidence_generated, 0) AS total_evidence_generated,
        COALESCE(es.chain_blast_evidence, 0) AS chain_blast_evidence,
        COALESCE(es.domain_blast_evidence, 0) AS domain_blast_evidence,
        COALESCE(es.hhsearch_evidence, 0) AS hhsearch_evidence,

        CASE
          WHEN COALESCE(ds.domains_found, 0) = 0 THEN 'NO_DOMAINS_FOUND'
          WHEN ds.domains_classified = ds.domains_found THEN 'FULLY_CLASSIFIED'
          WHEN ds.domains_classified > 0 THEN 'PARTIALLY_CLASSIFIED'
          ELSE 'UNCLASSIFIED'
        END AS classification_status,

        CASE
          WHEN COALESCE(es.total_evidence_generated, 0) = 0 THEN 'NO_EVIDENCE'
          WHEN es.evidence_types_count >= 3 THEN 'RICH_EVIDENCE'
          WHEN es.evidence_types_count >= 2 THEN 'MODERATE_EVIDENCE'
          ELSE 'LIMITED_EVIDENCE'
        END AS evidence_quality,

        -- Calculate residues assigned
        COALESCE(cs.residues_assigned, 0) AS residues_assigned,

        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - pp.timestamp)) / 86400.0 AS days_since_processing,

        -- NEW: Curation decision information
        cd.id AS curation_decision_id,
        cd.decision_type,
        cd.status AS curation_status,
        cd.curator_name,
        cd.decision_date,
        cd.flagged_for_review,
        cd.needs_review,
        cd.confidence_level AS curation_confidence,
        cd.notes AS curation_notes,
        CASE WHEN cd.id IS NOT NULL THEN true ELSE false END AS has_curation_decision

      FROM pdb_analysis.partition_proteins pp
      -- Join to main protein table for actual sequence length
      LEFT JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      LEFT JOIN domain_stats ds ON pp.id = ds.protein_id
      LEFT JOIN evidence_stats es ON pp.id = es.protein_id
      LEFT JOIN coverage_stats cs ON pp.id = cs.protein_id

      -- NEW: Join to curation decisions table
      LEFT JOIN pdb_analysis.curation_decision cd ON pp.id = cd.protein_id

      ${whereClause}
      ORDER BY ${getSortClause()}
      LIMIT ${addParam(size)} OFFSET ${addParam(skip)}
    `

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
      LEFT JOIN pdb_analysis.curation_decision cd ON pp.id = cd.protein_id
      LEFT JOIN (
        SELECT
          pp_1.id AS protein_id,
          max(pd.confidence) AS best_domain_confidence
        FROM pdb_analysis.partition_proteins pp_1
        LEFT JOIN pdb_analysis.partition_domains pd ON pp_1.id = pd.protein_id
        GROUP BY pp_1.id
      ) ds ON pp.id = ds.protein_id
      ${whereClause}
    `

    console.log('UPDATED: Using partition tables with curation decision filters')
    console.log('Query params:', params)

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(dataQuery, ...params),
      prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) // Remove LIMIT/OFFSET for count
    ])

    // Convert BigInt and process results
    const serializedResults = JSON.parse(JSON.stringify(results, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ))

    const serializedCount = JSON.parse(JSON.stringify(countResult, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ))

    const total = Number(serializedCount[0]?.total || 0)

    // Process results for frontend
    const processedResults = serializedResults.map(protein => ({
      ...protein,
      // Ensure all numbers are properly typed
      domain_count: Number(protein.domains_found || 0),
      domains_classified: Number(protein.domains_classified || 0),
      domains_unclassified: Number(protein.domains_unclassified || 0),
      sequence_length: Number(protein.sequence_length || 0),
      coverage: Number(protein.coverage || 0),
      total_evidence_count: Number(protein.total_evidence_generated || 0),

      // Add computed fields for UI compatibility
      days_old: Math.floor(Number(protein.days_since_processing || 0)),
      is_recent: Number(protein.days_since_processing || 999) < 7,

      avg_confidence: Number(protein.avg_domain_confidence || 0),
      best_confidence: Number(protein.best_domain_confidence || 0),

      // Confidence level categorization
      confidence_level: protein.best_domain_confidence >= 0.8 ? 'high' :
                       protein.best_domain_confidence >= 0.5 ? 'medium' : 'low',

      // Evidence indicators
      has_chain_blast: Number(protein.chain_blast_evidence || 0) > 0,
      has_domain_blast: Number(protein.domain_blast_evidence || 0) > 0,
      has_hhsearch: Number(protein.hhsearch_evidence || 0) > 0,

      // Evidence type string
      evidence_types: [
        protein.chain_blast_evidence > 0 && 'chain_blast',
        protein.domain_blast_evidence > 0 && 'domain_blast',
        protein.hhsearch_evidence > 0 && 'hhsearch'
      ].filter(Boolean).join(','),

      // NEW: Curation-related fields
      has_curation_decision: Boolean(protein.has_curation_decision),
      curation_decision_id: protein.curation_decision_id,
      decision_type: protein.decision_type,
      curation_status: protein.curation_status,
      curator_name: protein.curator_name,
      decision_date: protein.decision_date,
      flagged_for_review: Boolean(protein.flagged_for_review),
      needs_review: Boolean(protein.needs_review),
      curation_confidence: Number(protein.curation_confidence || 0),
      curation_notes: protein.curation_notes,

      // Data source indicator
      data_source: 'partition_tables_with_curation',
      architecture: 'curation_enabled'
    }))

    return NextResponse.json({
      data: processedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      filters: {
        applied: Object.fromEntries(
          Array.from(searchParams.entries()).filter(([_, value]) => value)
        ),
        count: whereConditions.length
      },
      sorting: {
        sort,
        direction: sortDir
      },
      metadata: {
        source: 'partition_tables_with_curation',
        query_complexity: 'curation_enhanced',
        result_count: processedResults.length,
        note: 'Includes curation decision data and filters'
      }
    })

  } catch (error) {
    console.error('Error in curation-enhanced partition API:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch partition data with curation filters',
        details: error.message,
        hint: 'Using partition tables with curation decision joins'
      },
      { status: 500 }
    )
  }
}
