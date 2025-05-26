// app/api/curation/session/[sessionId]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params
    const { action, final_notes } = await request.json()

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

    // Update session status
    const finalStatus = action === 'commit' ? 'committed' : 
                       action === 'discard' ? 'discarded' : 'completed'

    await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.curation_session 
      SET 
        status = $1, 
        session_end = CURRENT_TIMESTAMP, 
        notes = COALESCE(notes || ' | ', '') || $2
      WHERE id = $3
    `, finalStatus, final_notes || '', parseInt(sessionId))

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

      // Mark proteins as curated
      for (const decision of decisions as any[]) {
        await prisma.$queryRawUnsafe(`
          INSERT INTO pdb_analysis.curation_status (
            protein_id, source_id, is_curated, last_curated_at, 
            last_curator, curation_count
          ) VALUES ($1, $2, true, CURRENT_TIMESTAMP, $3, 1)
          ON CONFLICT (protein_id) DO UPDATE SET
            is_curated = true,
            last_curated_at = CURRENT_TIMESTAMP,
            last_curator = EXCLUDED.last_curator,
            curation_count = curation_status.curation_count + 1
        `, decision.protein_id, decision.source_id, session.curator_name)
      }
    }

    // Get final statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_decisions,
        COUNT(CASE WHEN has_domain = true THEN 1 END) as has_domain_count,
        COUNT(CASE WHEN is_fragment = true THEN 1 END) as fragment_count,
        COUNT(CASE WHEN flagged_for_review = true THEN 1 END) as flagged_count,
        AVG(confidence_level) as avg_confidence,
        AVG(review_time_seconds) as avg_review_time
      FROM pdb_analysis.curation_decision 
      WHERE session_id = $1
    `

    const stats = await prisma.$queryRawUnsafe(statsQuery, parseInt(sessionId))

    return NextResponse.json({ 
      success: true,
      action,
      session_status: finalStatus,
      statistics: (stats as any[])[0]
    })

  } catch (error) {
    console.error('Error completing session:', error)
    return NextResponse.json({ 
      error: 'Failed to complete session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
