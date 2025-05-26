// app/api/curation/session/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { curator_name, batch_size = 10 } = await request.json()

    if (!curator_name) {
      return NextResponse.json({ error: 'Curator name required' }, { status: 400 })
    }

    // Clean up any expired locks first
    await prisma.$queryRawUnsafe(`
      DELETE FROM pdb_analysis.protein_locks
      WHERE expires_at < CURRENT_TIMESTAMP
    `)

    // Get next uncurated proteins with good evidence (filter to representatives)
    const nextProteinsQuery = `
      WITH available_proteins AS (
        SELECT DISTINCT
          p.id,
          p.source_id,
          p.pdb_id,
          p.chain_id,
          p.length as sequence_length,
          -- Get the best evidence confidence for prioritization
          MAX(de.confidence) as best_confidence,
          COUNT(DISTINCT de.id)::INTEGER as evidence_count
        FROM pdb_analysis.protein p
        JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
        JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        LEFT JOIN pdb_analysis.curation_status cs ON p.id = cs.protein_id
        LEFT JOIN pdb_analysis.protein_locks pl ON p.source_id = pl.source_id
        WHERE
          -- Not already curated
          (cs.is_curated IS NULL OR cs.is_curated = false)
          -- Not currently locked
          AND pl.source_id IS NULL
          -- Has ECOD evidence with structure references
          AND de.source_id IS NOT NULL
          AND de.hit_range IS NOT NULL
          AND de.confidence > 0.8
          -- Reasonable protein size (not too small/large for curation)
          AND p.length BETWEEN 30 AND 1000
          -- Filter to representatives only
          AND (p.is_nonident_rep = true OR p.is_nonident_rep IS NULL)
        GROUP BY p.id, p.source_id, p.pdb_id, p.chain_id, p.length
        HAVING COUNT(DISTINCT de.id) > 0
        ORDER BY best_confidence DESC, evidence_count DESC
        LIMIT $1
      )
      SELECT
        id, source_id, pdb_id, chain_id, sequence_length,
        best_confidence, evidence_count
      FROM available_proteins
    `

    const availableProteins = await prisma.$queryRawUnsafe(nextProteinsQuery, batch_size)
    const proteins = availableProteins as any[]

    if (proteins.length === 0) {
      return NextResponse.json({
        error: 'No proteins available for curation',
        message: 'All suitable proteins may be curated, locked, or lack good evidence'
      }, { status: 404 })
    }

    const proteinSourceIds = proteins.map(p => p.source_id)

    // Create new session (fix array casting issue)
    const sessionQuery = `
      INSERT INTO pdb_analysis.curation_session (
        curator_name, target_batch_size, locked_proteins, status
      ) VALUES ($1, $2, $3, 'in_progress')
      RETURNING id, curator_name, target_batch_size, locked_proteins, created_at
    `

    const sessionResult = await prisma.$queryRawUnsafe(
      sessionQuery,
      curator_name,
      batch_size,
      proteinSourceIds  // Pass array directly - PostgreSQL will handle the conversion
    )

    const session = (sessionResult as any[])[0]

    // Lock the proteins to this session
    const lockPromises = proteinSourceIds.map(sourceId =>
      prisma.$queryRawUnsafe(`
        INSERT INTO pdb_analysis.protein_locks (source_id, curator_name, session_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (source_id) DO NOTHING
      `, sourceId, curator_name, session.id)
    )

    await Promise.all(lockPromises)

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
