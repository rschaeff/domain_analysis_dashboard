// app/api/proteins/summary/route.ts - FULLY FIXED VERSION
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
    const domainNumber = searchParams.get('domain_number')
    const batchId = searchParams.get('batch_id')

    // Quality filters
    const minConfidence = searchParams.get('min_confidence')
    const maxConfidence = searchParams.get('max_confidence')
    const minLength = searchParams.get('sequence_length_min')
    const maxLength = searchParams.get('sequence_length_max')
    const minEvidence = searchParams.get('min_evidence_count')
    const evidenceTypes = searchParams.get('evidence_types')

    // Classification filters (these require joins)
    const tGroups = searchParams.get('t_groups')?.split(',').filter(Boolean)
    const hGroups = searchParams.get('h_groups')?.split(',').filter(Boolean)
    const xGroups = searchParams.get('x_groups')?.split(',').filter(Boolean)
    const aGroups = searchParams.get('a_groups')?.split(',').filter(Boolean)

    // Build WHERE conditions
    const whereConditions: string[] = []
    const params: any[] = []

    // Helper function to add parameter
    const addParam = (value: any): string => {
      params.push(value)
      return `$${params.length}`
    }

    // Basic filters
    if (pdbId) {
      whereConditions.push(`pps.pdb_id ILIKE ${addParam(`%${pdbId}%`)}`)
    }
    if (chainId) {
      whereConditions.push(`pps.chain_id = ${addParam(chainId.toUpperCase())}`)
    }
    if (batchId) {
      whereConditions.push(`pps.batch_id = ${addParam(parseInt(batchId))}`)
    }

    // Quality filters
    if (minConfidence) {
      whereConditions.push(`pps.best_domain_confidence >= ${addParam(parseFloat(minConfidence))}`)
    }
    if (maxConfidence) {
      whereConditions.push(`pps.best_domain_confidence <= ${addParam(parseFloat(maxConfidence))}`)
    }
    if (minLength) {
      whereConditions.push(`pps.sequence_length >= ${addParam(parseInt(minLength))}`)
    }
    if (maxLength) {
      whereConditions.push(`pps.sequence_length <= ${addParam(parseInt(maxLength))}`)
    }
    if (minEvidence) {
      whereConditions.push(`pps.total_evidence_generated >= ${addParam(parseInt(minEvidence))}`)
    }

    // Evidence type filter
    if (evidenceTypes) {
      const types = evidenceTypes.split(',').map(t => t.trim().toLowerCase())
      const evidenceConditions: string[] = []

      if (types.includes('blast') || types.includes('chain_blast')) {
        evidenceConditions.push('pps.chain_blast_evidence > 0')
      }
      if (types.includes('domain_blast')) {
        evidenceConditions.push('pps.domain_blast_evidence > 0')
      }
      if (types.includes('hhsearch')) {
        evidenceConditions.push('pps.hhsearch_evidence > 0')
      }

      if (evidenceConditions.length > 0) {
        whereConditions.push(`(${evidenceConditions.join(' OR ')})`)
      }
    }

    // Determine if we need classification joins
    const needsClassificationJoin = tGroups?.length || hGroups?.length || xGroups?.length || aGroups?.length

    // Build classification filters (require domain joins)
    let classificationJoin = ''
    if (needsClassificationJoin) {
      classificationJoin = `
        INNER JOIN pdb_analysis.partition_domains pd ON pps.processing_id = pd.protein_id
      `

      if (tGroups?.length) {
        whereConditions.push(`pd.t_group = ANY(${addParam(tGroups)})`)
      }
      if (hGroups?.length) {
        whereConditions.push(`pd.h_group = ANY(${addParam(hGroups)})`)
      }
      if (xGroups?.length) {
        whereConditions.push(`pd.x_group = ANY(${addParam(xGroups)})`)
      }
      if (aGroups?.length) {
        whereConditions.push(`pd.a_group = ANY(${addParam(aGroups)})`)
      }
    }

    // Domain number filter (also requires join)
    if (domainNumber) {
      if (!needsClassificationJoin) {
        classificationJoin = `
          INNER JOIN pdb_analysis.partition_domains pd ON pps.processing_id = pd.protein_id
        `
      }
      whereConditions.push(`pd.domain_number = ${addParam(parseInt(domainNumber))}`)
    }

    // Build ORDER BY clause
    const getSortClause = (): string => {
      const direction = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      switch (sort) {
        case 'recent':
          return `pps.processing_date ${direction} NULLS LAST`
        case 'batch':
          return `pps.batch_id ${direction} NULLS LAST, pps.processing_date DESC NULLS LAST`
        case 'confidence':
          return `pps.best_domain_confidence ${direction} NULLS LAST`
        case 'coverage':
          return `pps.coverage ${direction} NULLS LAST`
        case 'domains':
          return `pps.domains_found ${direction} NULLS LAST`
        case 'pdb_id':
          return `pps.pdb_id ${direction}, pps.chain_id ${direction}`
        case 'sequence_length':
          return `pps.sequence_length ${direction} NULLS LAST`
        default:
          return `pps.processing_date DESC NULLS LAST`
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const orderClause = `ORDER BY ${getSortClause()}`

    // Main query
    const baseQuery = `
      FROM pdb_analysis.pipeline_performance_summary pps
      ${classificationJoin}
      ${whereClause}
    `

    // If we have classification joins, we need DISTINCT
    const selectPrefix = needsClassificationJoin || domainNumber ? 'SELECT DISTINCT' : 'SELECT'

    const dataQuery = `
      ${selectPrefix}
        pps.processing_id as id,
        pps.pdb_id,
        pps.chain_id,
        pps.source_id,
        pps.batch_id,
        pps.reference_version,
        pps.processing_date,
        pps.sequence_length,
        pps.is_classified,
        pps.coverage,
        pps.domains_found as domain_count,
        pps.domains_classified,
        pps.domains_unclassified,
        pps.avg_domain_confidence,
        pps.best_domain_confidence,
        pps.worst_domain_confidence,
        pps.total_evidence_generated as total_evidence_count,
        pps.chain_blast_evidence > 0 as has_chain_blast,
        pps.domain_blast_evidence > 0 as has_domain_blast,
        pps.hhsearch_evidence > 0 as has_hhsearch,
        pps.classification_status,
        pps.evidence_quality,
        pps.days_since_processing
      ${baseQuery}
      ${orderClause}
      LIMIT ${addParam(size)} OFFSET ${addParam(skip)}
    `

    const countQuery = `
      SELECT COUNT(${needsClassificationJoin || domainNumber ? 'DISTINCT pps.processing_id' : '*'}) as total
      ${baseQuery}
    `

    console.log('Executing query with params:', params)
    console.log('Data query:', dataQuery)

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(dataQuery, ...params),
      prisma.$queryRawUnsafe(countQuery, ...params.slice(0, -2)) // Remove LIMIT/OFFSET params for count
    ])

    // Convert BigInt values to Numbers
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
      // Convert to numbers for consistency
      domain_count: Number(protein.domain_count || 0),
      domains_classified: Number(protein.domains_classified || 0),
      domains_unclassified: Number(protein.domains_unclassified || 0),
      total_evidence_count: Number(protein.total_evidence_count || 0),

      // Add computed fields for UI compatibility
      days_old: Math.floor(Number(protein.days_since_processing || 0)),
      is_recent: Number(protein.days_since_processing || 999) < 7,

      avg_confidence: Number(protein.avg_domain_confidence || 0),
      best_confidence: Number(protein.best_domain_confidence || 0),

      // Confidence level categorization
      confidence_level: protein.best_domain_confidence >= 0.8 ? 'high' :
                       protein.best_domain_confidence >= 0.5 ? 'medium' : 'low',

      // Coverage metrics
      residues_assigned: Math.round((protein.coverage || 0) * (protein.sequence_length || 0)),

      // Evidence type string for display
      evidence_types: [
        protein.has_chain_blast && 'chain_blast',
        protein.has_domain_blast && 'domain_blast',
        protein.has_hhsearch && 'hhsearch'
      ].filter(Boolean).join(','),

      // Data source indicator
      data_source: 'pipeline_performance_filtered',
      architecture: 'full_filter_support'
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
        source: 'pipeline_performance_summary',
        classification_joins: needsClassificationJoin,
        query_complexity: whereConditions.length > 3 ? 'complex' : 'simple',
        result_count: processedResults.length,
        filter_support: 'complete'
      }
    })

  } catch (error) {
    console.error('Error fetching filtered pipeline summary:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pipeline performance summary',
        details: error.message,
        hint: 'Check filter parameters and database connection'
      },
      { status: 500 }
    )
  }
}
