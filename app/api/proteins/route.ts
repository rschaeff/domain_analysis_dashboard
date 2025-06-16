// app/api/proteins/route.ts - UPDATED with representative/propagation support
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/config'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('size') || DEFAULT_PAGE_SIZE.toString())))
    const skip = (page - 1) * size

    // Parse sorting parameters
    const sort = searchParams.get('sort') || 'recent'
    const sortDirection = searchParams.get('sort_dir') || 'desc'

    // Parse view mode: 'representatives' (default), 'propagated', or 'all'
    const viewMode = searchParams.get('view_mode') || 'representatives'

    // Parse filters
    const filters: any = {}

    if (searchParams.get('pdb_id')) {
      filters.pdb_id = searchParams.get('pdb_id')!
    }

    if (searchParams.get('chain_id')) {
      filters.chain_id = searchParams.get('chain_id')!
    }

    if (searchParams.get('unp_acc')) {
      filters.unp_acc = searchParams.get('unp_acc')!
    }

    if (searchParams.get('min_length')) {
      filters.min_length = parseInt(searchParams.get('min_length')!)
    }

    if (searchParams.get('max_length')) {
      filters.max_length = parseInt(searchParams.get('max_length')!)
    }

    if (searchParams.get('is_classified')) {
      filters.is_classified = searchParams.get('is_classified') === 'true'
    }

    if (searchParams.get('batch_id')) {
      filters.batch_id = parseInt(searchParams.get('batch_id')!)
    }

    // Curation filters (will be validated later)
    if (searchParams.get('has_curation_decision')) {
      filters.has_curation_decision = searchParams.get('has_curation_decision') === 'true'
    }

    if (searchParams.get('curation_status')) {
      filters.curation_status = searchParams.get('curation_status')!.split(',').map(s => s.trim()).filter(Boolean)
    }

    if (searchParams.get('curation_decision_type')) {
      filters.curation_decision_type = searchParams.get('curation_decision_type')!.split(',').map(s => s.trim()).filter(Boolean)
    }

    if (searchParams.get('curator_name')) {
      filters.curator_name = searchParams.get('curator_name')!
    }

    if (searchParams.get('curation_date_from')) {
      filters.curation_date_from = searchParams.get('curation_date_from')!
    }

    if (searchParams.get('curation_date_to')) {
      filters.curation_date_to = searchParams.get('curation_date_to')!
    }

    if (searchParams.get('flagged_for_review')) {
      filters.flagged_for_review = searchParams.get('flagged_for_review') === 'true'
    }

    if (searchParams.get('needs_review')) {
      filters.needs_review = searchParams.get('needs_review') === 'true'
    }

    // Check if curation table exists and get its schema
    let curationTableExists = false
    let curationColumns: string[] = []

    try {
      const schemaCheck = await prisma.$queryRawUnsafe(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'pdb_analysis'
        AND table_name = 'curation_decision'
      `)

      if (Array.isArray(schemaCheck) && schemaCheck.length > 0) {
        curationTableExists = true
        curationColumns = (schemaCheck as any[]).map(row => row.column_name)
        console.log('Curation table columns found:', curationColumns)
      }
    } catch (schemaError) {
      console.log('Curation table not available:', schemaError.message)
      curationTableExists = false
    }

    // Build curation fields and join
    let curationFields = ''
    let curationJoin = ''

    if (curationTableExists) {
      const availableFields = []

      if (curationColumns.includes('id')) availableFields.push('cd.id as curation_decision_id')
      if (curationColumns.includes('decision_type')) availableFields.push('cd.decision_type')
      if (curationColumns.includes('status')) availableFields.push('cd.status as curation_status')
      if (curationColumns.includes('curator_name')) availableFields.push('cd.curator_name')
      if (curationColumns.includes('decision_date')) availableFields.push('cd.decision_date')
      if (curationColumns.includes('flagged_for_review')) availableFields.push('cd.flagged_for_review')
      if (curationColumns.includes('needs_review')) availableFields.push('cd.needs_review')
      if (curationColumns.includes('confidence_level')) availableFields.push('cd.confidence_level as curation_confidence')
      if (curationColumns.includes('notes')) availableFields.push('cd.notes as curation_notes')

      if (availableFields.length > 0) {
        curationFields = `,
        -- Curation information
        ${availableFields.join(',\n        ')},
        CASE WHEN cd.id IS NOT NULL THEN true ELSE false END as has_curation_decision`

        // Determine the join column
        const joinColumn = curationColumns.includes('protein_id') ? 'protein_id' : 'id'
        curationJoin = `LEFT JOIN pdb_analysis.curation_decision cd ON p.id = cd.${joinColumn}`
      }
    }

    // If no curation fields, add default false values
    if (!curationFields) {
      curationFields = `,
        -- Curation information (table not available)
        NULL as curation_decision_id,
        NULL as decision_type,
        NULL as curation_status,
        NULL as curator_name,
        NULL as decision_date,
        false as flagged_for_review,
        false as needs_review,
        NULL as curation_confidence,
        NULL as curation_notes,
        false as has_curation_decision`
    }

    // Build the base query with process_version filtering and sequence MD5 support
    let baseQuery = `
      SELECT
        p.id,
        p.pdb_id,
        p.chain_id,
        COALESCE(p.source_id, p.pdb_id || '_' || p.chain_id) as source_id,
        p.unp_acc,
        p.name,
        p.type,
        p.tax_id,
        p.length as sequence_length,
        p.created_at,
        p.updated_at,
        -- Process version and sequence identity info
        pp.process_version,
        p.sequence_md5,
        -- Count propagated sequences with same MD5
        COALESCE(prop_count.propagated_count, 0) as propagated_count,
        -- Domain statistics
        COUNT(d.id) as domain_count,
        COUNT(CASE WHEN d.t_group IS NOT NULL THEN 1 END) as fully_classified_domains,
        COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as domains_with_evidence,
        -- Calculate coverage (sum of domain lengths / sequence length)
        CASE
          WHEN p.length > 0 AND COUNT(d.id) > 0 THEN
            COALESCE(SUM(d.end_pos - d.start_pos + 1)::float / p.length, 0)
          ELSE 0
        END as coverage,
        COALESCE(SUM(d.end_pos - d.start_pos + 1), 0) as residues_assigned,
        -- Classification status
        CASE WHEN COUNT(d.id) > 0 THEN true ELSE false END as is_classified,
        -- Batch and reference information
        MAX(pp.batch_id) as batch_id,
        MAX(pp.reference_version) as reference_version,
        MAX(pp.timestamp) as processing_date,
        -- Quality metrics
        AVG(d.confidence) as avg_confidence,
        MAX(d.confidence) as best_confidence,
        -- Recency information
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(pp.timestamp))) / 86400.0 as days_since_processing

        ${curationFields}

      FROM pdb_analysis.protein p
      LEFT JOIN pdb_analysis.domain d ON p.id = d.protein_id
      LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
      LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
      -- Count propagated sequences for each representative
      LEFT JOIN (
        SELECT
          p2.sequence_md5,
          COUNT(*) as propagated_count
        FROM pdb_analysis.protein p2
        JOIN pdb_analysis.partition_proteins pp2 ON p2.id = pp2.id
        WHERE pp2.process_version = 'mini_pyecod_propagated_1.0'
        GROUP BY p2.sequence_md5
      ) prop_count ON p.sequence_md5 = prop_count.sequence_md5
      ${curationJoin}
    `

    // Build WHERE clause with process version filtering
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    // CORE FILTER: Exclude old algorithm by default
    if (viewMode === 'representatives') {
      whereConditions.push(`pp.process_version = 'mini_pyecod_1.0'`)
    } else if (viewMode === 'propagated') {
      whereConditions.push(`pp.process_version = 'mini_pyecod_propagated_1.0'`)
    } else if (viewMode === 'all') {
      whereConditions.push(`pp.process_version IN ('mini_pyecod_1.0', 'mini_pyecod_propagated_1.0')`)
    }
    // Note: '1.0' and null are always excluded unless explicitly requested

    if (filters.pdb_id) {
      whereConditions.push(`p.pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      whereConditions.push(`p.chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.unp_acc) {
      whereConditions.push(`p.unp_acc = $${paramIndex}`)
      queryParams.push(filters.unp_acc)
      paramIndex++
    }

    if (filters.min_length !== undefined) {
      whereConditions.push(`p.length >= $${paramIndex}`)
      queryParams.push(filters.min_length)
      paramIndex++
    }

    if (filters.max_length !== undefined) {
      whereConditions.push(`p.length <= $${paramIndex}`)
      queryParams.push(filters.max_length)
      paramIndex++
    }

    if (filters.batch_id !== undefined) {
      whereConditions.push(`pp.batch_id = $${paramIndex}`)
      queryParams.push(filters.batch_id)
      paramIndex++
    }

    // Add curation filters only if table exists
    if (curationTableExists) {
      if (filters.has_curation_decision !== undefined) {
        if (filters.has_curation_decision) {
          whereConditions.push(`cd.id IS NOT NULL`)
        } else {
          whereConditions.push(`cd.id IS NULL`)
        }
      }

      if (filters.curation_status && filters.curation_status.length > 0 && curationColumns.includes('status')) {
        const statusPlaceholders = filters.curation_status.map(() => `$${paramIndex++}`).join(',')
        whereConditions.push(`cd.status IN (${statusPlaceholders})`)
        queryParams.push(...filters.curation_status)
      }

      if (filters.curation_decision_type && filters.curation_decision_type.length > 0 && curationColumns.includes('decision_type')) {
        const typePlaceholders = filters.curation_decision_type.map(() => `$${paramIndex++}`).join(',')
        whereConditions.push(`cd.decision_type IN (${typePlaceholders})`)
        queryParams.push(...filters.curation_decision_type)
      }

      if (filters.curator_name && curationColumns.includes('curator_name')) {
        whereConditions.push(`cd.curator_name ILIKE $${paramIndex}`)
        queryParams.push(`%${filters.curator_name}%`)
        paramIndex++
      }

      if (filters.curation_date_from && curationColumns.includes('decision_date')) {
        whereConditions.push(`cd.decision_date >= $${paramIndex}`)
        queryParams.push(filters.curation_date_from)
        paramIndex++
      }

      if (filters.curation_date_to && curationColumns.includes('decision_date')) {
        whereConditions.push(`cd.decision_date <= $${paramIndex}`)
        queryParams.push(filters.curation_date_to)
        paramIndex++
      }

      if (filters.flagged_for_review !== undefined && curationColumns.includes('flagged_for_review')) {
        whereConditions.push(`cd.flagged_for_review = $${paramIndex}`)
        queryParams.push(filters.flagged_for_review)
        paramIndex++
      }

      if (filters.needs_review !== undefined && curationColumns.includes('needs_review')) {
        whereConditions.push(`cd.needs_review = $${paramIndex}`)
        queryParams.push(filters.needs_review)
        paramIndex++
      }
    }

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add GROUP BY clause - need to include curation fields if they exist
    let groupByFields = `
      p.id, p.pdb_id, p.chain_id, p.source_id, p.unp_acc,
      p.name, p.type, p.tax_id, p.length, p.created_at, p.updated_at,
      pp.process_version, p.sequence_md5, prop_count.propagated_count`

    if (curationTableExists) {
      groupByFields += `,
      cd.id, cd.decision_type, cd.status, cd.curator_name, cd.decision_date,
      cd.flagged_for_review, cd.needs_review, cd.confidence_level, cd.notes`
    }

    baseQuery += `
      GROUP BY
        ${groupByFields}
    `

    // Apply classification filter after grouping
    if (filters.is_classified !== undefined) {
      if (filters.is_classified) {
        baseQuery += ' HAVING COUNT(d.id) > 0'
      } else {
        baseQuery += ' HAVING COUNT(d.id) = 0'
      }
    }

    // Build ORDER BY clause based on sort parameter
    let orderByClause = ''
    switch (sort) {
      case 'recent':
        orderByClause = 'ORDER BY processing_date DESC NULLS LAST, batch_id DESC NULLS LAST, p.pdb_id, p.chain_id'
        break
      case 'batch':
        orderByClause = 'ORDER BY batch_id DESC NULLS LAST, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id'
        break
      case 'confidence':
        orderByClause = `ORDER BY best_confidence ${sortDirection.toUpperCase()} NULLS LAST, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        break
      case 'coverage':
        orderByClause = `ORDER BY coverage ${sortDirection.toUpperCase()}, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        break
      case 'domains':
        orderByClause = `ORDER BY domain_count ${sortDirection.toUpperCase()}, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        break
      case 'length':
        orderByClause = `ORDER BY p.length ${sortDirection.toUpperCase()}, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        break
      case 'propagated':
        orderByClause = `ORDER BY propagated_count ${sortDirection.toUpperCase()}, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        break
      case 'alphabetic':
        orderByClause = 'ORDER BY p.pdb_id, p.chain_id'
        break
      case 'curation_date':
        if (curationTableExists && curationColumns.includes('decision_date')) {
          orderByClause = `ORDER BY cd.decision_date ${sortDirection.toUpperCase()} NULLS LAST, processing_date DESC NULLS LAST, p.pdb_id, p.chain_id`
        } else {
          orderByClause = 'ORDER BY processing_date DESC NULLS LAST, batch_id DESC NULLS LAST, p.pdb_id, p.chain_id'
        }
        break
      default:
        // Default to recent first
        orderByClause = 'ORDER BY processing_date DESC NULLS LAST, batch_id DESC NULLS LAST, p.pdb_id, p.chain_id'
    }

    // Add ORDER BY to the query
    baseQuery += ' ' + orderByClause

    // Calculate statistics for filtered dataset (representatives only for consistency)
    const statsQuery = `
      SELECT
        COUNT(*) as total_proteins,
        COUNT(CASE WHEN domain_count > 0 THEN 1 END) as classified_proteins,
        COUNT(CASE WHEN domain_count = 0 THEN 1 END) as unclassified_proteins,
        AVG(CASE WHEN domain_count > 0 THEN domain_count END) as avg_domains_per_protein,
        AVG(sequence_length) as avg_sequence_length,
        COUNT(CASE WHEN days_since_processing <= 7 THEN 1 END) as recent_proteins,
        COUNT(CASE WHEN has_curation_decision = true THEN 1 END) as curated_proteins,
        COUNT(CASE WHEN flagged_for_review = true THEN 1 END) as flagged_proteins,
        SUM(propagated_count) as total_propagated_sequences
      FROM (
        ${baseQuery}
      ) AS protein_stats
    `

    // Execute queries in parallel
    const [results, statsResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(statsQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    // Serialize results to handle BigInt and add computed fields
    const serializedResults = serializeBigInt(results).map((protein: any) => ({
      ...protein,
      // Add helpful computed fields
      days_old: Math.floor(Number(protein.days_since_processing || 0)),
      is_recent: Number(protein.days_since_processing || 999) < 7,
      confidence_level: protein.best_confidence >= 0.8 ? 'high' :
                       protein.best_confidence >= 0.5 ? 'medium' : 'low',
      classification_completeness: protein.domain_count > 0 ?
        protein.fully_classified_domains / protein.domain_count : 0,

      // Representative/propagation specific fields
      is_representative: protein.process_version === 'mini_pyecod_1.0',
      is_propagated: protein.process_version === 'mini_pyecod_propagated_1.0',
      has_propagated_sequences: protein.propagated_count > 0,

      // Curation-related computed fields (safely handle missing data)
      has_curation_decision: Boolean(protein.has_curation_decision),
      flagged_for_review: Boolean(protein.flagged_for_review),
      needs_review: Boolean(protein.needs_review),
      curation_confidence: Number(protein.curation_confidence || 0)
    }))

    const stats = statsResult as any[]

    const statistics = {
      totalProteins: Number(stats[0]?.total_proteins || 0),
      classifiedProteins: Number(stats[0]?.classified_proteins || 0),
      unclassifiedProteins: Number(stats[0]?.unclassified_proteins || 0),
      avgDomainsPerProtein: Number(stats[0]?.avg_domains_per_protein || 0),
      avgSequenceLength: Number(stats[0]?.avg_sequence_length || 0),
      recentProteins: Number(stats[0]?.recent_proteins || 0),
      curatedProteins: Number(stats[0]?.curated_proteins || 0),
      flaggedProteins: Number(stats[0]?.flagged_proteins || 0),
      totalPropagatedSequences: Number(stats[0]?.total_propagated_sequences || 0)
    }

    const total = statistics.totalProteins

    // Add sorting metadata with propagation-aware options
    const availableSorts = [
      { key: 'recent', label: 'Most Recent', description: 'Recently processed proteins first' },
      { key: 'batch', label: 'Latest Batch', description: 'Newest batches first' },
      { key: 'confidence', label: 'Best Confidence', description: 'Highest confidence first' },
      { key: 'coverage', label: 'Coverage', description: 'Best domain coverage first' },
      { key: 'domains', label: 'Domain Count', description: 'Most domains first' },
      { key: 'length', label: 'Sequence Length', description: 'Longest sequences first' },
      { key: 'propagated', label: 'Propagated Count', description: 'Most propagated sequences first' },
      { key: 'alphabetic', label: 'Alphabetic', description: 'PDB ID alphabetically' }
    ]

    // Add curation date sort only if curation table exists
    if (curationTableExists && curationColumns.includes('decision_date')) {
      availableSorts.push({ key: 'curation_date', label: 'Curation Date', description: 'Most recently curated first' })
    }

    const sortingInfo = {
      current_sort: sort,
      sort_direction: sortDirection,
      available_sorts: availableSorts
    }

    return NextResponse.json({
      data: serializedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      statistics,
      sorting: sortingInfo,
      metadata: {
        source: 'proteins_with_representative_support',
        view_mode: viewMode,
        process_version_filter: viewMode === 'representatives' ? 'mini_pyecod_1.0' :
                               viewMode === 'propagated' ? 'mini_pyecod_propagated_1.0' : 'all_current',
        curation_available: curationTableExists,
        curation_columns: curationTableExists ? curationColumns : [],
        excluded_versions: ['1.0'] // Always exclude the old algorithm
      }
    })

  } catch (error) {
    console.error('Error fetching proteins with representative support:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch proteins',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
