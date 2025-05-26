// app/api/curation/session/[sessionId]/resume/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params

    // Get session details
    const sessionQuery = `
      SELECT 
        cs.id,
        cs.curator_name,
        cs.status,
        cs.target_batch_size,
        cs.proteins_reviewed,
        cs.current_protein_index,
        cs.locked_proteins,
        cs.auto_save_data,
        cs.notes,
        cs.created_at,
        cs.updated_at
      FROM pdb_analysis.curation_session cs
      WHERE cs.id = $1
    `

    const sessionResult = await prisma.$queryRawUnsafe(sessionQuery, parseInt(sessionId))
    
    if ((sessionResult as any[]).length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = (sessionResult as any[])[0]

    // Check if session is resumable
    if (!['in_progress', 'paused'].includes(session.status)) {
      return NextResponse.json({ 
        error: 'Session cannot be resumed',
        status: session.status 
      }, { status: 400 })
    }

    // Get proteins for this session
    const lockedProteins = session.locked_proteins ? JSON.parse(session.locked_proteins) : []
    
    if (lockedProteins.length === 0) {
      return NextResponse.json({ error: 'No proteins locked to this session' }, { status: 400 })
    }

    // Get protein details
    const proteinsQuery = `
      SELECT 
        p.id,
        p.source_id,
        p.pdb_id,
        p.chain_id,
        p.length as sequence_length
      FROM pdb_analysis.protein p
      WHERE p.source_id = ANY($1)
      ORDER BY array_position($1, p.source_id)
    `

    const proteins = await prisma.$queryRawUnsafe(proteinsQuery, lockedProteins)

    // Get existing decisions
    const decisionsQuery = `
      SELECT 
        cd.protein_id,
        cd.source_id,
        cd.has_domain,
        cd.domain_assigned_correctly,
        cd.boundaries_correct,
        cd.is_fragment,
        cd.is_repeat_protein,
        cd.confidence_level,
        cd.notes,
        cd.flagged_for_review,
        cd.review_time_seconds,
        cd.created_at
      FROM pdb_analysis.curation_decision cd
      WHERE cd.session_id = $1
      ORDER BY cd.created_at
    `

    const decisions = await prisma.$queryRawUnsafe(decisionsQuery, parseInt(sessionId))

    // Extend lock expiration
    await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.protein_locks 
      SET expires_at = CURRENT_TIMESTAMP + INTERVAL '2 hours'
      WHERE session_id = $1
    `, parseInt(sessionId))

    return NextResponse.json({
      session,
      proteins,
      decisions,
      can_resume: true,
      message: 'Session ready for resumption'
    })

  } catch (error) {
    console.error('Error resuming session:', error)
    return NextResponse.json({ 
      error: 'Failed to resume session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
