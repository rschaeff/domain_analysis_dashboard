// app/api/curation/session/[sessionId]/complete/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params
    const { action, final_notes } = await request.json()

    console.log(`🎯 Completing session ${sessionId} with action: ${action}`)

    if (!['commit', 'discard', 'revisit'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get session info
    const sessionInfo = await prisma.$queryRawUnsafe(`
      SELECT id, curator_name, status, locked_proteins
      FROM pdb_analysis.curation_session
      WHERE id = $1
    `, parseInt(sessionId))

    if ((sessionInfo as any[]).length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = (sessionInfo as any[])[0]

    // Get all decisions for this session (needed for statistics regardless of action)
    const decisionsQuery = `
      SELECT cd.protein_id, cd.source_id
      FROM pdb_analysis.curation_decision cd
      WHERE cd.session_id = $1
    `
    const decisions = await prisma.$queryRawUnsafe(decisionsQuery, parseInt(sessionId))

    // Update session status - FIX: Handle potential JSONB concatenation
    const finalStatus = action === 'commit' ? 'committed' :
                       action === 'discard' ? 'discarded' : 'completed'

    await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.curation_session
      SET
        status = $1,
        session_end = CURRENT_TIMESTAMP,
        notes = COALESCE(notes, '') || $2
      WHERE id = $3
    `, finalStatus, ` | ${final_notes || ''}`, parseInt(sessionId))

    // Release protein locks
    await prisma.$queryRawUnsafe(`
      DELETE FROM pdb_analysis.protein_locks
      WHERE session_id = $1
    `, parseInt(sessionId))

    // If committing, mark proteins as curated
    if (action === 'commit') {
      // Get all decisions for this session
      const decisionsQuery = `
        SELECT cd.protein_id, cd.source_id
        FROM pdb_analysis.curation_decision cd
        WHERE cd.session_id = $1
      `
      const decisions = await prisma.$queryRawUnsafe(decisionsQuery, parseInt(sessionId))

      // Mark proteins as curated - batch insert for better performance
      if ((decisions as any[]).length > 0) {
        const values = (decisions as any[]).map((_, index) => {
          const baseIndex = index * 3
          return `($${baseIndex + 1}, $${baseIndex + 2}, true, CURRENT_TIMESTAMP, $${baseIndex + 3}, 1)`
        }).join(', ')

        const insertParams = (decisions as any[]).flatMap(decision => [
          decision.protein_id,
          decision.source_id,
          session.curator_name
        ])

        await prisma.$queryRawUnsafe(`
          INSERT INTO pdb_analysis.curation_status (
            protein_id, source_id, is_curated, last_curated_at,
            last_curator, curation_count
          ) VALUES ${values}
          ON CONFLICT (protein_id) DO UPDATE SET
            is_curated = true,
            last_curated_at = CURRENT_TIMESTAMP,
            last_curator = EXCLUDED.last_curator,
            curation_count = curation_status.curation_count + 1
        `, ...insertParams)
      }
    }

    // Get final statistics
    const statsQuery = `
      SELECT
        COUNT(*)::INTEGER as total_decisions,
        COUNT(CASE WHEN has_domain = true THEN 1 END)::INTEGER as has_domain_count,
        COUNT(CASE WHEN is_fragment = true THEN 1 END)::INTEGER as fragment_count,
        COUNT(CASE WHEN flagged_for_review = true THEN 1 END)::INTEGER as flagged_count,
        ROUND(AVG(confidence_level)::NUMERIC, 2)::FLOAT as avg_confidence,
        ROUND(AVG(review_time_seconds)::NUMERIC, 1)::FLOAT as avg_review_time
      FROM pdb_analysis.curation_decision
      WHERE session_id = $1
    `

    const stats = await prisma.$queryRawUnsafe(statsQuery, parseInt(sessionId))
    const finalStats = (stats as any[])[0] || {}

    console.log(`📊 Session ${sessionId} completed:`, {
      action,
      finalStatus,
      decisions_count: finalStats.total_decisions || 0,
      proteins_committed: action === 'commit' ? (decisions as any[]).length : 0
    })

    return NextResponse.json({
      success: true,
      action,
      session_status: finalStatus,
      session_id: parseInt(sessionId),
      statistics: {
        total_decisions: finalStats.total_decisions || 0,
        has_domain_count: finalStats.has_domain_count || 0,
        fragment_count: finalStats.fragment_count || 0,
        flagged_count: finalStats.flagged_count || 0,
        avg_confidence: finalStats.avg_confidence || 0,
        avg_review_time: finalStats.avg_review_time || 0
      },
      committed_proteins: action === 'commit' ? (decisions as any[]).length : 0,
      message: action === 'commit'
        ? `Successfully committed ${(decisions as any[]).length} protein decisions`
        : `Session ${action}ed successfully`
    })

  } catch (error) {
    console.error('Error completing session:', error)
    return NextResponse.json({ 
      error: 'Failed to complete session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
