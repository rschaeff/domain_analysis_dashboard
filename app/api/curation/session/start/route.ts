// app/api/curation/session/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { curator_name, batch_size = 10 } = await request.json()

    if (!curator_name) {
      return NextResponse.json({ error: 'Curator name required' }, { status: 400 })
    }

    // Clean up any expired locks
    await prisma.$queryRawUnsafe(`
      DELETE FROM pdb_analysis.protein_locks 
      WHERE expires_at < CURRENT_TIMESTAMP
    `)

    // Get next uncurated proteins (excluding locked ones)
    const nextProteinsQuery = `
      WITH available_proteins AS (
        SELECT 
          p.id,
          p.source_id,
          p.pdb_id,
          p.chain_id
        FROM pdb_analysis.protein p
        LEFT JOIN pdb_analysis.curation_status cs ON p.id = cs.protein_id
        LEFT JOIN pdb_analysis.protein_locks pl ON p.source_id = pl.source_id
        WHERE (cs.is_curated IS NULL OR cs.is_curated = false)
          AND pl.source_id IS NULL  -- Not currently locked
          AND EXISTS (
            -- Must have domains to curate
            SELECT 1 FROM pdb_analysis.partition_domains pd 
            WHERE pd.protein_id = (
              SELECT pp.id FROM pdb_analysis.partition_proteins pp 
              WHERE pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
            )
          )
          AND EXISTS (
            -- Must have evidence with reference structures
            SELECT 1 FROM pdb_analysis.partition_domains pd
            JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
            WHERE pd.protein_id = (
              SELECT pp.id FROM pdb_analysis.partition_proteins pp 
              WHERE pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
            )
            AND de.pdb_id IS NOT NULL 
            AND de.chain_id IS NOT NULL
            AND de.hit_range IS NOT NULL
          )
        ORDER BY RANDOM()  -- Random selection for variety
        LIMIT $1
      )
      SELECT * FROM available_proteins
    `

    const availableProteins = await prisma.$queryRawUnsafe(nextProteinsQuery, batch_size)
    const proteins = availableProteins as any[]

    if (proteins.length === 0) {
      return NextResponse.json({ 
        error: 'No proteins available for curation',
        message: 'All proteins may be curated, locked, or lack reference structures'
      }, { status: 404 })
    }

    // Create new session
    const sessionQuery = `
      INSERT INTO pdb_analysis.curation_session (
        curator_name, target_batch_size, locked_proteins, status
      ) VALUES ($1, $2, $3, 'in_progress')
      RETURNING id, curator_name, target_batch_size, locked_proteins, created_at
    `

    const proteinSourceIds = proteins.map(p => p.source_id)
    const sessionResult = await prisma.$queryRawUnsafe(
      sessionQuery, 
      curator_name, 
      batch_size, 
      JSON.stringify(proteinSourceIds)
    )

    const session = (sessionResult as any[])[0]

    // Lock the proteins
    const lockQueries = proteinSourceIds.map(sourceId => 
      prisma.$queryRawUnsafe(`
        INSERT INTO pdb_analysis.protein_locks (source_id, curator_name, session_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (source_id) DO NOTHING
      `, sourceId, curator_name, session.id)
    )

    await Promise.all(lockQueries)

    return NextResponse.json({
      session,
      proteins,
      message: `Created session with ${proteins.length} proteins for curation`
    })

  } catch (error) {
    console.error('Error starting curation session:', error)
    return NextResponse.json({ 
      error: 'Failed to start curation session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// app/api/curation/session/[sessionId]/auto-save/route.ts
export async function PUT(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = await params
    const { current_protein_index, decisions, notes } = await request.json()

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
      RETURNING id, current_protein_index, proteins_reviewed
    `

    const autoSaveData = {
      decisions,
      saved_at: new Date().toISOString(),
      notes
    }

    const result = await prisma.$queryRawUnsafe(
      updateQuery,
      current_protein_index,
      decisions.length,
      JSON.stringify(autoSaveData),
      notes,
      parseInt(sessionId)
    )

    if ((result as any[]).length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

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
