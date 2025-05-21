import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { DomainFilters } from '@/lib/types'
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

    // Parse filters
    const filters: DomainFilters = {}

    if (searchParams.get('pdb_id')) {
      filters.pdb_id = searchParams.get('pdb_id')!
    }

    if (searchParams.get('chain_id')) {
      filters.chain_id = searchParams.get('chain_id')!
    }

    if (searchParams.get('t_groups')) {
      filters.t_group = searchParams.get('t_groups')!.split(',')
    }

    if (searchParams.get('h_groups')) {
      filters.h_group = searchParams.get('h_groups')!.split(',')
    }

    if (searchParams.get('x_groups')) {
      filters.x_group = searchParams.get('x_groups')!.split(',')
    }

    if (searchParams.get('min_confidence')) {
      filters.min_confidence = parseFloat(searchParams.get('min_confidence')!)
    }

    if (searchParams.get('max_confidence')) {
      filters.max_confidence = parseFloat(searchParams.get('max_confidence')!)
    }

    // Build the query using the updated view with properly qualified column names
    let baseQuery = `
      SELECT
        pds.id,
        pds.protein_id,
        pds.pdb_id,
        pds.chain_id,
        pds.batch_id,
        pds.reference_version,
        pds.timestamp,
        pds.domain_number,
        pds.domain_id,
        pds.start_pos,
        pds.end_pos,
        pds.range,
        pds.source,
        pds.source_id,
        pds.confidence,
        pds.t_group,
        pds.h_group,
        pds.x_group,
        pds.a_group,
        pds.evidence_count,
        pds.evidence_types,
        -- Add protein sequence length
        p.length as protein_sequence_length
      FROM pdb_analysis.partition_domain_summary pds
      LEFT JOIN pdb_analysis.protein p ON pds.pdb_id = p.pdb_id AND pds.chain_id = p.chain_id
    `

    // Build WHERE clause with qualified column names
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (filters.pdb_id) {
      whereConditions.push(`pds.pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      whereConditions.push(`pds.chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.t_group && filters.t_group.length > 0) {
      whereConditions.push(`pds.t_group = ANY($${paramIndex})`)
      queryParams.push(filters.t_group)
      paramIndex++
    }

    if (filters.h_group && filters.h_group.length > 0) {
      whereConditions.push(`pds.h_group = ANY($${paramIndex})`)
      queryParams.push(filters.h_group)
      paramIndex++
    }

    if (filters.x_group && filters.x_group.length > 0) {
      whereConditions.push(`pds.x_group = ANY($${paramIndex})`)
      queryParams.push(filters.x_group)
      paramIndex++
    }

    if (filters.min_confidence !== undefined) {
      whereConditions.push(`pds.confidence >= $${paramIndex}`)
      queryParams.push(filters.min_confidence)
      paramIndex++
    }

    if (filters.max_confidence !== undefined) {
      whereConditions.push(`pds.confidence <= $${paramIndex}`)
      queryParams.push(filters.max_confidence)
      paramIndex++
    }

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add ORDER BY with qualified column names
    baseQuery += ' ORDER BY pds.pdb_id, pds.chain_id, pds.domain_number'

    // Calculate statistics for filtered dataset with qualified column names
    const statsQuery = `
      SELECT
        COUNT(*) as total_domains,
        COUNT(CASE WHEN pds.t_group IS NOT NULL THEN 1 END) as classified_domains,
        COUNT(CASE WHEN pds.confidence >= 0.8 THEN 1 END) as high_confidence_domains,
        AVG(CASE WHEN pds.confidence IS NOT NULL THEN pds.confidence END) as avg_confidence,
        COUNT(CASE WHEN pds.evidence_count > 0 THEN 1 END) as domains_with_evidence
      FROM pdb_analysis.partition_domain_summary pds
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `

    // Execute queries in parallel
    const [results, statsResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(statsQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    // Serialize results to handle BigInt
    const serializedResults = serializeBigInt(results)
    const stats = statsResult as any[]

    const statistics = {
      totalDomains: Number(stats[0]?.total_domains || 0),
      classifiedDomains: Number(stats[0]?.classified_domains || 0),
      highConfidenceDomains: Number(stats[0]?.high_confidence_domains || 0),
      avgConfidence: Number(stats[0]?.avg_confidence || 0),
      domainsWithEvidence: Number(stats[0]?.domains_with_evidence || 0)
    }

    const total = statistics.totalDomains

    return NextResponse.json({
      data: serializedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      statistics
    })

  } catch (error) {
    console.error('Error fetching domains:', error)
    console.error('Error details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domains', details: error.message },
      { status: 500 }
    )
  }
}
