export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params
    const { action, final_notes } = await request.json()

    // Update session status
    await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.curation_session 
      SET status = $1, session_end = CURRENT_TIMESTAMP, notes = $2
      WHERE id = $3
    `, action, final_notes, parseInt(sessionId))

    // Release protein locks
    await prisma.$queryRawUnsafe(`
      DELETE FROM pdb_analysis.protein_locks 
      WHERE session_id = $1
    `, parseInt(sessionId))

    // If committing, mark proteins as curated
    if (action === 'commit') {
      await prisma.$queryRawUnsafe(`
        INSERT INTO pdb_analysis.curation_status (protein_id, source_id, is_curated, last_curated_at, last_curator)
        SELECT 
          cd.protein_id, 
          cd.source_id, 
          true, 
          CURRENT_TIMESTAMP,
          cs.curator_name
        FROM pdb_analysis.curation_decision cd
        JOIN pdb_analysis.curation_session cs ON cd.session_id = cs.id
        WHERE cs.id = $1
        ON CONFLICT (protein_id) DO UPDATE SET
          is_curated = true,
          last_curated_at = CURRENT_TIMESTAMP,
          last_curator = EXCLUDED.last_curator,
          curation_count = curation_status.curation_count + 1
      `, parseInt(sessionId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
  }
}
