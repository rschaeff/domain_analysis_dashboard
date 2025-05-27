// app/api/curation/decision/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const {
      session_id,
      protein_source_id,
      decisions,
      evidence_used,
      review_time_seconds
    } = await request.json()

    // Validate required fields
    if (!session_id || !protein_source_id || !decisions) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get protein_id from source_id
    const proteinResult = await prisma.$queryRawUnsafe(`
      SELECT id FROM pdb_analysis.protein
      WHERE source_id = $1
    `, protein_source_id)

    if ((proteinResult as any[]).length === 0) {
      return NextResponse.json({ error: 'Protein not found' }, { status: 404 })
    }

    const protein_id = (proteinResult as any[])[0].id

    // Validate session is active
    const sessionCheck = await prisma.$queryRawUnsafe(`
      SELECT id FROM pdb_analysis.curation_session
      WHERE id = $1 AND status = 'in_progress'
    `, session_id)

    if ((sessionCheck as any[]).length === 0) {
      return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })
    }

    // Insert or update curation decision - FIX: Pass parameters individually
    await prisma.$queryRawUnsafe(`
      INSERT INTO pdb_analysis.curation_decision (
        session_id, protein_id, source_id,
        has_domain, domain_assigned_correctly, boundaries_correct,
        is_fragment, is_repeat_protein, confidence_level,
        review_time_seconds, notes, flagged_for_review,
        primary_evidence_type, primary_evidence_source_id,
        reference_domain_id, evidence_confidence, evidence_evalue
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (session_id, protein_id) DO UPDATE SET
        has_domain = EXCLUDED.has_domain,
        domain_assigned_correctly = EXCLUDED.domain_assigned_correctly,
        boundaries_correct = EXCLUDED.boundaries_correct,
        is_fragment = EXCLUDED.is_fragment,
        is_repeat_protein = EXCLUDED.is_repeat_protein,
        confidence_level = EXCLUDED.confidence_level,
        review_time_seconds = EXCLUDED.review_time_seconds,
        notes = EXCLUDED.notes,
        flagged_for_review = EXCLUDED.flagged_for_review,
        primary_evidence_type = EXCLUDED.primary_evidence_type,
        primary_evidence_source_id = EXCLUDED.primary_evidence_source_id,
        reference_domain_id = EXCLUDED.reference_domain_id,
        evidence_confidence = EXCLUDED.evidence_confidence,
        evidence_evalue = EXCLUDED.evidence_evalue,
        updated_at = CURRENT_TIMESTAMP
    `,
      // FIXED: Parameters passed individually, not as array
      session_id,
      protein_id,
      protein_source_id,
      decisions.has_domain,
      decisions.domain_assigned_correctly,
      decisions.boundaries_correct,
      decisions.is_fragment,
      decisions.is_repeat_protein,
      decisions.confidence_level,
      review_time_seconds || 0,
      decisions.notes || '',
      decisions.flagged_for_review || false,
      evidence_used?.primary_evidence_type || null,
      evidence_used?.primary_evidence_source_id || null,
      evidence_used?.reference_domain_id || null,
      evidence_used?.evidence_confidence || null,
      evidence_used?.evidence_evalue || null
    )

    return NextResponse.json({
      success: true,
      protein_id,
      protein_source_id,
      saved_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error saving curation decision:', error)
    return NextResponse.json({
      error: 'Failed to save curation decision',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
