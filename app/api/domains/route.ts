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

    if (searchParams.get('min_confidence')) {
      filters.min_confidence = parseFloat(searchParams.get('min_confidence')!)
    }

    if (searchParams.get('max_confidence')) {
      filters.max_confidence = parseFloat(searchParams.get('max_confidence')!)
    }

    // Build the query using the updated view
    let baseQuery = `
      SELECT
        id,
        protein_id,
        pdb_id,
        chain_id,
        batch_id,
        reference_version,
        timestamp,
        domain_number,
        domain_id,
        start_pos,
        end_pos,
        range,
        source,
        source_id,
        confidence,
        t_group,
        h_group,
        x_group,
        a_group,
        evidence_count,
        evidence_types
      FROM pdb_analysis.partition_domain_summary
    `

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (filters.pdb_id) {
      whereConditions.push(`pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      whereConditions.push(`chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.t_group && filters.t_group.length > 0) {
      whereConditions.push(`t_group = ANY($${paramIndex})`)
      queryParams.push(filters.t_group)
      paramIndex++
    }

    if (filters.h_group && filters.h_group.length > 0) {
      whereConditions.push(`h_group = ANY($${paramIndex})`)
      queryParams.push(filters.h_group)
      paramIndex++
    }

    if (filters.min_confidence !== undefined) {
      whereConditions.push(`confidence >= $${paramIndex}`)
      queryParams.push(filters.min_confidence)
      paramIndex++
    }

    if (filters.max_confidence !== undefined) {
      whereConditions.push(`confidence <= $${paramIndex}`)
      queryParams.push(filters.max_confidence)
      paramIndex++
    }

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add ORDER BY
    baseQuery += ' ORDER BY pdb_id, chain_id, domain_number'

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM pdb_analysis.partition_domain_summary
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `

    // Execute queries
    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(countQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    // Serialize results to handle BigInt
    const serializedResults = serializeBigInt(results)
    const total = Number((countResult as any)[0]?.total || 0)

    return NextResponse.json({
      data: serializedResults,
      pagination: {
        page,
        size,
        total: total,
        totalPages: Math.ceil(total / size)
      }
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
