import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { protein_id, validation_criteria } = await request.json()
    
    // Fetch filesystem evidence for the protein
    const filesystemQuery = `
      SELECT
        ep.pdb_id,
        ep.chain_id,
        ps.sequence_length,
        pf.file_type,
        pf.file_path,
        pf.file_exists
      FROM ecod_schema.protein ep
      JOIN ecod_schema.process_status ps ON ep.id = ps.protein_id
      LEFT JOIN ecod_schema.process_file pf ON ps.id = pf.process_id
      WHERE ep.pdb_id = $1 AND ep.chain_id = $2
        AND pf.file_type IN ('domain_summary', 'chain_blast_result', 'domain_blast_result', 'hhsearch_result')
        AND pf.file_exists = true
    `
    
    const [pdbId, chainId] = protein_id.split('_')
    const filesystemEvidence = await prisma.$queryRawUnsafe(filesystemQuery, pdbId, chainId)
    
    return NextResponse.json({ 
      filesystem_evidence: filesystemEvidence,
      validation_ready: true
    })
  } catch (error) {
    console.error('Hit-level validation error:', error)
    return NextResponse.json({ error: 'Failed to prepare validation' }, { status: 500 })
  }
}
