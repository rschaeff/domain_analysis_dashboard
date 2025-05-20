// Enhanced API route with proper statistics
// app/api/domains/route.ts

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
    // ... (existing filter parsing code)

    // Build base query
    let baseQuery = `
      SELECT
        id, protein_id, pdb_id, chain_id, batch_id, reference_version, timestamp,
        domain_number, domain_id, start_pos, end_pos, range, source, source_id,
        confidence, t_group, h_group, x_group, a_group, evidence_count, evidence_types
      FROM pdb_analysis.partition_domain_summary
    `

    // Build WHERE clause
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    // ... (existing WHERE clause building code)

    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ')
    }

    // Calculate statistics for filtered dataset
    const statsQuery = `
      SELECT
        COUNT(*) as total_domains,
        COUNT(CASE WHEN t_group IS NOT NULL THEN 1 END) as classified_domains,
        COUNT(CASE WHEN confidence >= 0.8 THEN 1 END) as high_confidence_domains,
        AVG(CASE WHEN confidence IS NOT NULL THEN confidence END) as avg_confidence,
        COUNT(CASE WHEN evidence_count > 0 THEN 1 END) as domains_with_evidence
      FROM pdb_analysis.partition_domain_summary
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `

    // Add ORDER BY to main query
    baseQuery += ' ORDER BY pdb_id, chain_id, domain_number'

    // Execute queries in parallel
    const [results, statsResult] = await Promise.all([
      prisma.$queryRawUnsafe(`${baseQuery} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(statsQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    // Serialize results
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
    return NextResponse.json(
      { error: 'Failed to fetch domains', details: error.message },
      { status: 500 }
    )
  }
}
