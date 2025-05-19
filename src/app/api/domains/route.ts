import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { DomainFilters, PaginationParams } from '@/lib/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/config'

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

    // Build the raw SQL query for partition_domain_summary view
    let baseQuery = `
      SELECT 
        pp.pdb_id,
        pp.chain_id,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp,
        pd.domain_number,
        pd.domain_id,
        pd.start_pos,
        pd.end_pos,
        pd.range,
        pd.source,
        pd.source_id,
        pd.confidence,
        pd.t_group,
        pd.h_group,
        pd.x_group,
        pd.a_group,
        COUNT(de.id) as evidence_count,
        COALESCE(STRING_AGG(DISTINCT de.evidence_type, ', '), 'none') as evidence_types
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
    `

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (filters.pdb_id) {
      whereConditions.push(`pp.pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      whereConditions.push(`pp.chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.t_group && filters.t_group.length > 0) {
      whereConditions.push(`pd.t_group = ANY($${paramIndex})`)
      queryParams.push(filters.t_group)
      paramIndex++
    }

    if (filters.h_group && filters.h_group.length > 0) {
      whereConditions.push(`pd.h_group = ANY($${paramIndex})`)
      queryParams.push(filters.h_group)
      paramIndex++
    }

    if (filters.min_confidence !== undefined) {
      whereConditions.push(`pd.confidence >= $${paramIndex}`)
      queryParams.push(filters.min_confidence)
      paramIndex++
    }

    if (filters.max_confidence !== undefined) {
      whereConditions.push(`pd.confidence <= $${paramIndex}`)
      queryParams.push(filters.max_confidence)
      paramIndex++
    }

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add GROUP BY and ORDER BY
    baseQuery += `
      GROUP BY 
        pp.pdb_id, pp.chain_id, pp.batch_id, pp.reference_version, pp.timestamp,
        pd.domain_number, pd.domain_id, pd.start_pos, pd.end_pos, pd.range,
        pd.source, pd.source_id, pd.confidence, pd.t_group, pd.h_group, pd.x_group, pd.a_group
      ORDER BY pp.pdb_id, pp.chain_id, pd.domain_number
    `

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT (pp.id, pd.id)) as total
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `

    // Execute queries
    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(countQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    const total = (countResult as any)[0]?.total || 0

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        size,
        total: parseInt(total),
        totalPages: Math.ceil(parseInt(total) / size)
      }
    })

  } catch (error) {
    console.error('Error fetching domains:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'
import { DomainFilters, PaginationParams } from '@/lib/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/config'

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

    // Build the raw SQL query for partition_domain_summary view
    let baseQuery = `
      SELECT 
        pp.pdb_id,
        pp.chain_id,
        pp.batch_id,
        pp.reference_version,
        pp.timestamp,
        pd.domain_number,
        pd.domain_id,
        pd.start_pos,
        pd.end_pos,
        pd.range,
        pd.source,
        pd.source_id,
        pd.confidence,
        pd.t_group,
        pd.h_group,
        pd.x_group,
        pd.a_group,
        COUNT(de.id) as evidence_count,
        COALESCE(STRING_AGG(DISTINCT de.evidence_type, ', '), 'none') as evidence_types
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
    `

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (filters.pdb_id) {
      whereConditions.push(`pp.pdb_id = $${paramIndex}`)
      queryParams.push(filters.pdb_id)
      paramIndex++
    }

    if (filters.chain_id) {
      whereConditions.push(`pp.chain_id = $${paramIndex}`)
      queryParams.push(filters.chain_id)
      paramIndex++
    }

    if (filters.t_group && filters.t_group.length > 0) {
      whereConditions.push(`pd.t_group = ANY($${paramIndex})`)
      queryParams.push(filters.t_group)
      paramIndex++
    }

    if (filters.h_group && filters.h_group.length > 0) {
      whereConditions.push(`pd.h_group = ANY($${paramIndex})`)
      queryParams.push(filters.h_group)
      paramIndex++
    }

    if (filters.min_confidence !== undefined) {
      whereConditions.push(`pd.confidence >= $${paramIndex}`)
      queryParams.push(filters.min_confidence)
      paramIndex++
    }

    if (filters.max_confidence !== undefined) {
      whereConditions.push(`pd.confidence <= $${paramIndex}`)
      queryParams.push(filters.max_confidence)
      paramIndex++
    }

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Add GROUP BY and ORDER BY
    baseQuery += `
      GROUP BY 
        pp.pdb_id, pp.chain_id, pp.batch_id, pp.reference_version, pp.timestamp,
        pd.domain_number, pd.domain_id, pd.start_pos, pd.end_pos, pd.range,
        pd.source, pd.source_id, pd.confidence, pd.t_group, pd.h_group, pd.x_group, pd.a_group
      ORDER BY pp.pdb_id, pp.chain_id, pd.domain_number
    `

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT (pp.id, pd.id)) as total
      FROM pdb_analysis.partition_proteins pp
      JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `

    // Execute queries
    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(countQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    const total = (countResult as any)[0]?.total || 0

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        size,
        total: parseInt(total),
        totalPages: Math.ceil(parseInt(total) / size)
      }
    })

  } catch (error) {
    console.error('Error fetching domains:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    )
  }
}
x
