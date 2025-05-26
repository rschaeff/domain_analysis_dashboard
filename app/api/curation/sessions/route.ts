// app/api/curation/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const curator = searchParams.get('curator')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (curator) {
      conditions.push(`cs.curator_name = ${paramIndex}`)
      params.push(curator)
      paramIndex++
    }

    if (status) {
      conditions.push(`cs.status = ${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get sessions with statistics
    const sessionsQuery = `
      SELECT 
        cs.id,
        cs.curator_name,
        cs.status,
        cs.target_batch_size,
        cs.proteins_reviewed,
        cs.current_protein_index,
        cs.created_at,
        cs.session_end,
        cs.updated_at,
        
        -- Decision statistics
        COUNT(cd.id) as total_decisions,
        COUNT(CASE WHEN cd.has_domain = true THEN 1 END) as domains_found,
        COUNT(CASE WHEN cd.is_fragment = true THEN 1 END) as fragments_found,
        COUNT(CASE WHEN cd.flagged_for_review = true THEN 1 END) as flagged_count,
        AVG(cd.confidence_level) as avg_confidence,
        AVG(cd.review_time_seconds) as avg_review_time,
        
        -- Session progress
        CASE 
          WHEN cs.target_batch_size > 0 
          THEN ROUND((cs.proteins_reviewed::float / cs.target_batch_size::float) * 100, 1)
          ELSE 0 
        END as completion_percentage
        
      FROM pdb_analysis.curation_session cs
      LEFT JOIN pdb_analysis.curation_decision cd ON cs.id = cd.session_id
      ${whereClause}
      GROUP BY cs.id, cs.curator_name, cs.status, cs.target_batch_size, 
               cs.proteins_reviewed, cs.current_protein_index, cs.created_at, 
               cs.session_end, cs.updated_at
      ORDER BY cs.created_at DESC
      LIMIT ${paramIndex}
    `

    params.push(limit)

    const sessions = await prisma.$queryRawUnsafe(sessionsQuery, ...params)

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'committed' THEN 1 END) as committed_sessions,
        COUNT(DISTINCT curator_name) as unique_curators
      FROM pdb_analysis.curation_session cs
      ${whereClause}
    `

    const summaryParams = params.slice(0, paramIndex - 1) // Remove limit parameter

    const summary = await prisma.$queryRawUnsafe(summaryQuery, ...summaryParams)

    return NextResponse.json({
      sessions,
      summary: (summary as any[])[0],
      filters: {
        curator,
        status,
        limit
      }
    })

  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
