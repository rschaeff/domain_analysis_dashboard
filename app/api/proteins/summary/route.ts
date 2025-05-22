// app/api/proteins/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '50')))
    const skip = (page - 1) * size

    // Build filters
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (searchParams.get('pdb_id')) {
      whereConditions.push(`pp.pdb_id ILIKE $${paramIndex}`)
      queryParams.push(`%${searchParams.get('pdb_id')}%`)
      paramIndex++
    }

    if (searchParams.get('batch_id')) {
      whereConditions.push(`pp.batch_id = $${paramIndex}`)
      queryParams.push(parseInt(searchParams.get('batch_id')!))
      paramIndex++
    }

    if (searchParams.get('is_classified')) {
      whereConditions.push(`pp.is_classified = $${paramIndex}`)
      queryParams.push(searchParams.get('is_classified') === 'true')
      paramIndex++
    }

    // Add classification filter support
    if (searchParams.get('t_groups')) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM pdb_analysis.partition_domains pd 
        WHERE pd.protein_id = pp.id AND pd.t_group = ANY($${paramIndex})
      )`)
      queryParams.push(searchParams.get('t_groups')!.split(','))
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

    const proteinSummaryQuery = `
      WITH protein_summary AS (
        SELECT 
          pp.id,
          pp.pdb_id,
          pp.chain_id,
          pp.pdb_id || '_' || pp.chain_id as source_id,
          pp.sequence_length,
          pp.batch_id,
          pp.reference_version,
          pp.is_classified,
          pp.coverage,
          pp.timestamp as processing_date,
          
          -- Domain summary
          COUNT(pd.id) as domain_count,
          COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) as classified_domains,
          AVG(pd.confidence) as avg_confidence,
          MAX(pd.confidence) as best_confidence,
          
          -- Evidence summary  
          COUNT(de.id) as total_evidence_count,
          string_agg(DISTINCT de.evidence_type, ', ') as evidence_types,
          bool_or(de.evidence_type = 'chain_blast') as has_chain_blast,
          bool_or(de.evidence_type = 'domain_blast') as has_domain_blast,
          bool_or(de.evidence_type = 'hhsearch') as has_hhsearch
          
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        ${whereClause}
        GROUP BY pp.id, pp.pdb_id, pp.chain_id, pp.sequence_length, 
                 pp.batch_id, pp.reference_version, pp.is_classified, 
                 pp.coverage, pp.timestamp
      )
      SELECT * FROM protein_summary
      ORDER BY pdb_id, chain_id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const countQuery = `
      SELECT COUNT(DISTINCT pp.id) as total
      FROM pdb_analysis.partition_proteins pp
      LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      ${whereClause}
    `

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(proteinSummaryQuery, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(countQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    const total = Number((countResult as any[])[0]?.total || 0)

    // Convert BigInt to Number for serialization
    const serializedResults = (results as any[]).map(row => ({
      ...row,
      domain_count: Number(row.domain_count),
      classified_domains: Number(row.classified_domains),
      total_evidence_count: Number(row.total_evidence_count)
    }))

    return NextResponse.json({
      data: serializedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      statistics: {
        total_proteins: total,
        // Add other stats as needed
      }
    })

  } catch (error) {
    console.error('Error fetching protein summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch protein summary', details: error.message },
      { status: 500 }
    )
  }
}
