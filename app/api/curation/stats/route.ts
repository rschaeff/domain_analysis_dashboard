// app/api/curation/stats/route.ts - FIXED VERSION without duplicates
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get curation statistics - FIXED: Removed problematic curation_status JOIN
    const statsQuery = `
      SELECT
        -- Session statistics (cast BIGINT to INTEGER to avoid serialization issues)
        COUNT(DISTINCT cs.id)::INTEGER as total_sessions,
        COUNT(DISTINCT CASE WHEN cs.status = 'committed' THEN cs.id END)::INTEGER as committed_sessions,
        COUNT(DISTINCT CASE WHEN cs.status = 'in_progress' THEN cs.id END)::INTEGER as active_sessions,
        COUNT(DISTINCT cs.curator_name)::INTEGER as total_curators,

        -- Decision statistics (cast BIGINT to INTEGER) - NO MORE DUPLICATES
        COUNT(cd.id)::INTEGER as total_decisions,
        COUNT(CASE WHEN cd.has_domain = true THEN 1 END)::INTEGER as proteins_with_domains,
        COUNT(CASE WHEN cd.is_fragment = true THEN 1 END)::INTEGER as fragments_identified,
        COUNT(CASE WHEN cd.is_repeat_protein = true THEN 1 END)::INTEGER as repeat_proteins,
        COUNT(CASE WHEN cd.flagged_for_review = true THEN 1 END)::INTEGER as flagged_for_review,

        -- Quality metrics (ensure these are always numbers, not null)
        COALESCE(ROUND(AVG(cd.confidence_level)::NUMERIC, 2), 0)::FLOAT as avg_confidence_level,
        COALESCE(ROUND(AVG(cd.review_time_seconds)::NUMERIC, 1), 0)::FLOAT as avg_review_time_seconds

      FROM pdb_analysis.curation_session cs
      LEFT JOIN pdb_analysis.curation_decision cd ON cs.id = cd.session_id
      WHERE cs.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `

    const statsResult = await prisma.$queryRawUnsafe(statsQuery)
    const rawStats = (statsResult as any[])[0]

    // Get proteins curated count separately to avoid JOIN issues
    const curatedCountQuery = `
      SELECT COUNT(DISTINCT protein_id)::INTEGER as proteins_curated
      FROM pdb_analysis.curation_status
      WHERE is_curated = true
    `
    const curatedResult = await prisma.$queryRawUnsafe(curatedCountQuery)
    const proteinsCurated = Number((curatedResult as any[])[0]?.proteins_curated || 0)

    // Get total curable proteins (separate query to avoid complexity)
    const totalCurableQuery = `
      SELECT COUNT(DISTINCT p.id)::INTEGER as total_curable_proteins
      FROM pdb_analysis.protein p
      JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
      JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
      JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
      WHERE de.source_id IS NOT NULL
        AND de.hit_range IS NOT NULL
        AND de.confidence > 0.8
        AND p.length BETWEEN 30 AND 1000
        AND (p.is_nonident_rep = true OR p.is_nonident_rep IS NULL)
    `
    const totalCurableResult = await prisma.$queryRawUnsafe(totalCurableQuery)
    const totalCurableProteins = Number((totalCurableResult as any[])[0]?.total_curable_proteins || 0)

    // Ensure all values are properly typed and never null/undefined
    const stats = {
      total_sessions: Number(rawStats?.total_sessions || 0),
      committed_sessions: Number(rawStats?.committed_sessions || 0),
      active_sessions: Number(rawStats?.active_sessions || 0),
      total_curators: Number(rawStats?.total_curators || 0),
      total_decisions: Number(rawStats?.total_decisions || 0),
      proteins_with_domains: Number(rawStats?.proteins_with_domains || 0),
      fragments_identified: Number(rawStats?.fragments_identified || 0),
      repeat_proteins: Number(rawStats?.repeat_proteins || 0),
      flagged_for_review: Number(rawStats?.flagged_for_review || 0),
      avg_confidence_level: Number(rawStats?.avg_confidence_level || 0),
      avg_review_time_seconds: Number(rawStats?.avg_review_time_seconds || 0),
      proteins_curated: proteinsCurated,
      total_curable_proteins: totalCurableProteins
    }

    // Calculate completion percentage safely
    const completionPercentage = totalCurableProteins > 0
      ? (proteinsCurated / totalCurableProteins) * 100
      : 0

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

    return NextResponse.json({
      statistics: {
        ...stats,
        completion_percentage: Number(completionPercentage.toFixed(1)),
        remaining_proteins: Math.max(0, totalCurableProteins - proteinsCurated)
      },
      recent_activity: recentActivity || []
    })

  } catch (error) {
    console.error('Error fetching curation stats:', error)
    return NextResponse.json({
      error: 'Failed to fetch curation statistics',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
