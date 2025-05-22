// app/api/proteins/route.ts (Updated sorting section)
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

    // Build the base query with better temporal information
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
      FROM pdb_analysis.protein p
      LEFT JOIN pdb_analysis.domain d ON p.id = d.protein_id
      LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
      LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
    `

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

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

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add GROUP BY clause
    baseQuery += `
      GROUP BY
        p.id, p.pdb_id, p.chain_id, p.source_id, p.unp_acc,
        p.name, p.type, p.tax_id, p.length, p.created_at, p.updated_at
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
      case 'alphabetic':
        orderByClause = 'ORDER BY p.pdb_id, p.chain_id'
        break
      default:
        // Default to recent first
        orderByClause = 'ORDER BY processing_date DESC NULLS LAST, batch_id DESC NULLS LAST, p.pdb_id, p.chain_id'
    }

    // Add ORDER BY to the query
    baseQuery += ' ' + orderByClause

    // Calculate statistics for filtered dataset
    const statsQuery = `
      SELECT
        COUNT(*) as total_proteins,
        COUNT(CASE WHEN domain_count > 0 THEN 1 END) as classified_proteins,
        COUNT(CASE WHEN domain_count = 0 THEN 1 END) as unclassified_proteins,
        AVG(CASE WHEN domain_count > 0 THEN domain_count END) as avg_domains_per_protein,
        AVG(sequence_length) as avg_sequence_length,
        COUNT(CASE WHEN days_since_processing <= 7 THEN 1 END) as recent_proteins
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
        protein.fully_classified_domains / protein.domain_count : 0
    }))

    const stats = statsResult as any[]

    const statistics = {
      totalProteins: Number(stats[0]?.total_proteins || 0),
      classifiedProteins: Number(stats[0]?.classified_proteins || 0),
      unclassifiedProteins: Number(stats[0]?.unclassified_proteins || 0),
      avgDomainsPerProtein: Number(stats[0]?.avg_domains_per_protein || 0),
      avgSequenceLength: Number(stats[0]?.avg_sequence_length || 0),
      recentProteins: Number(stats[0]?.recent_proteins || 0)
    }

    const total = statistics.totalProteins

    // Add sorting metadata
    const sortingInfo = {
      current_sort: sort,
      sort_direction: sortDirection,
      available_sorts: [
        { key: 'recent', label: 'Most Recent', description: 'Recently processed proteins first' },
        { key: 'batch', label: 'Latest Batch', description: 'Newest batches first' },
        { key: 'confidence', label: 'Best Confidence', description: 'Highest confidence first' },
        { key: 'coverage', label: 'Coverage', description: 'Best domain coverage first' },
        { key: 'domains', label: 'Domain Count', description: 'Most domains first' },
        { key: 'length', label: 'Sequence Length', description: 'Longest sequences first' },
        { key: 'alphabetic', label: 'Alphabetic', description: 'PDB ID alphabetically' }
      ]
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
      sorting: sortingInfo
    })

  } catch (error) {
    console.error('Error fetching proteins:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch proteins',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Add POST method for searching proteins
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      search_term, 
      search_fields = ['pdb_id', 'chain_id', 'unp_acc'],
      page = 1,
      size = DEFAULT_PAGE_SIZE,
      filters = {}
    } = body

    const limitedSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size))
    const skip = (Math.max(1, page) - 1) * limitedSize

    // Build search conditions
    const searchConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (search_term && search_fields.length > 0) {
      const searchClauses = search_fields.map(() => {
        const condition = `p.${search_fields.shift()} ILIKE $${paramIndex}`
        queryParams.push(`%${search_term}%`)
        paramIndex++
        return condition
      })
      searchConditions.push(`(${searchClauses.join(' OR ')})`)
    }

    // Build filter conditions
    if (filters.pdb_id) {
      searchConditions.push(`p.pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      searchConditions.push(`p.chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.unp_acc) {
      searchConditions.push(`p.unp_acc = $${paramIndex}`)
      queryParams.push(filters.unp_acc)
      paramIndex++
    }

    // Build the search query
    const searchQuery = `
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
        -- Domain statistics
        COUNT(d.id) as domain_count,
        COUNT(CASE WHEN d.t_group IS NOT NULL THEN 1 END) as fully_classified_domains,
        COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as domains_with_evidence,
        -- Calculate coverage
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
        MAX(pp.reference_version) as reference_version
      FROM pdb_analysis.protein p
      LEFT JOIN pdb_analysis.domain d ON p.id = d.protein_id
      LEFT JOIN pdb_analysis.domain_evidence de ON d.id = de.domain_id
      LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
      ${searchConditions.length > 0 ? 'WHERE ' + searchConditions.join(' AND ') : ''}
      GROUP BY 
        p.id, p.pdb_id, p.chain_id, p.source_id, p.unp_acc, 
        p.name, p.type, p.tax_id, p.length, p.created_at, p.updated_at
      ORDER BY 
        -- Prioritize exact matches
        CASE 
          WHEN p.pdb_id = $${paramIndex + 2} THEN 1 
          WHEN p.pdb_id || '_' || p.chain_id = $${paramIndex + 2} THEN 2
          ELSE 3 
        END,
        p.pdb_id, p.chain_id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    // Add search term again for sorting
    queryParams.push(limitedSize, skip, search_term || '')

    const results = await prisma.$queryRawUnsafe(searchQuery, ...queryParams)
    const serializedResults = serializeBigInt(results)

    return NextResponse.json({
      data: serializedResults,
      search: {
        term: search_term,
        fields: search_fields,
        total: serializedResults.length
      }
    })

  } catch (error) {
    console.error('Error searching proteins:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search proteins',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
