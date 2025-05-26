// app/api/curation/session/[sessionId]/auto-save/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params
    const { current_protein_index, decisions, notes } = await request.json()

    // Validate session exists and belongs to requesting curator
    const sessionCheck = await prisma.$queryRawUnsafe(`
      SELECT id, curator_name, status FROM pdb_analysis.curation_session
      WHERE id = $1 AND status = 'in_progress'
    `, parseInt(sessionId))

    if ((sessionCheck as any[]).length === 0) {
      return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })
    }

    // Update session with auto-save data
    const updateQuery = `
      UPDATE pdb_analysis.curation_session
      SET
        current_protein_index = $1,
        proteins_reviewed = $2,
        auto_save_data = $3,
        notes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, current_protein_index, proteins_reviewed, updated_at
    `

    const autoSaveData = {
      decisions,
      saved_at: new Date().toISOString(),
      notes,
      completed_count: decisions.filter((d: any) => d && d.completed).length
    }

    const result = await prisma.$queryRawUnsafe(
      updateQuery,
      current_protein_index,
      decisions.filter((d: any) => d && d.completed).length,
      JSON.stringify(autoSaveData),
      notes,
      parseInt(sessionId)
    )

    // Extend lock expiration for active session
    await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.protein_locks
      SET expires_at = CURRENT_TIMESTAMP + INTERVAL '2 hours'
      WHERE session_id = $1
    `, parseInt(sessionId))

    return NextResponse.json({
      success: true,
      session: (result as any[])[0],
      auto_saved_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Auto-save error:', error)
    return NextResponse.json({
      error: 'Failed to auto-save session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
