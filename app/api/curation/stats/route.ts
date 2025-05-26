// app/api/curation/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get curation statistics (cast BIGINT to INTEGER to avoid serialization issues)
    const statsQuery = `
      SELECT
        -- Session statistics
        COUNT(DISTINCT cs.id)::INTEGER as total_sessions,
        COUNT(DISTINCT CASE WHEN cs.status = 'committed' THEN cs.id END)::INTEGER as committed_sessions,
        COUNT(DISTINCT cs.curator_name)::INTEGER as active_curators,

        -- Decision statistics
        COUNT(cd.id)::INTEGER as total_decisions,
        COUNT(CASE WHEN cd.has_domain = true THEN 1 END)::INTEGER as proteins_with_domains,
        COUNT(CASE WHEN cd.is_fragment = true THEN 1 END)::INTEGER as fragments_identified,
        COUNT(CASE WHEN cd.is_repeat_protein = true THEN 1 END)::INTEGER as repeat_proteins,
        COUNT(CASE WHEN cd.flagged_for_review = true THEN 1 END)::INTEGER as flagged_for_review,

        -- Quality metrics
        COALESCE(AVG(cd.confidence_level), 0)::NUMERIC(5,2) as avg_confidence_level,
        COALESCE(AVG(cd.review_time_seconds), 0)::NUMERIC(8,1) as avg_review_time_seconds,

        -- Curation status
        COUNT(DISTINCT cst.protein_id)::INTEGER as proteins_curated,
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.protein p
         JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
         JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
         JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
         WHERE de.source_id IS NOT NULL
           AND de.hit_range IS NOT NULL
           AND de.confidence > 0.8
           AND p.length BETWEEN 30 AND 1000) as total_curable_proteins

      FROM pdb_analysis.curation_session cs
      LEFT JOIN pdb_analysis.curation_decision cd ON cs.id = cd.session_id
      LEFT JOIN pdb_analysis.curation_status cst ON cst.is_curated = true
      WHERE cs.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `

    const statsResult = await prisma.$queryRawUnsafe(statsQuery)
    const stats = (statsResult as any[])[0]

    // Get recent activity
    const recentActivity = await prisma.$queryRawUnsafe(`
      SELECT
        cs.id,
        cs.curator_name,
        cs.status,
        cs.proteins_reviewed,
        cs.target_batch_size,
        cs.created_at,
        cs.session_end
      FROM pdb_analysis.curation_session cs
      ORDER BY cs.created_at DESC
      LIMIT 10
    `)

    // Calculate completion percentage
    const totalCurable = Number(stats.total_curable_proteins || 0)
    const totalCurated = Number(stats.proteins_curated || 0)
    const completionPercentage = totalCurable > 0 ? (totalCurated / totalCurable) * 100 : 0

    return NextResponse.json({
      statistics: {
        ...stats,
        completion_percentage: completionPercentage,
        remaining_proteins: Math.max(0, totalCurable - totalCurated)
      },
      recent_activity: recentActivity
    })

  } catch (error) {
    console.error('Error fetching curation stats:', error)
    return NextResponse.json({
      error: 'Failed to fetch curation statistics',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
