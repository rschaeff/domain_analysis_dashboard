// app/api/proteins/[id]/filesystem/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { id } = await params

    let pdbId: string
    let chainId: string

    // Parse source_id format (e.g., "5ceb_A")
    if (id.includes('_')) {
      const parts = id.split('_')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 5ceb_A)' },
          { status: 400 }
        )
      }
      pdbId = parts[0]
      chainId = parts[1]
    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use source_id format (5ceb_A).' },
        { status: 400 }
      )
    }

    // Query filesystem evidence
    const filesystemQuery = `
      SELECT
        ep.id as ecod_protein_id,
        ep.source_id as ecod_source_id,
        ps.id as process_status_id,
        ps.batch_id,
        ps.current_stage,
        ps.status as process_status,
        ps.processing_path,
        ps.error_message,
        ps.updated_at as process_updated_at,
        b.batch_name,
        b.ref_version,
        b.base_path as batch_base_path,
        pf.id as file_id,
        pf.file_type,
        pf.file_path,
        pf.file_exists,
        CAST(pf.file_size AS BIGINT) as file_size,
        pf.last_checked
      FROM ecod_schema.protein ep
      JOIN ecod_schema.process_status ps ON ep.id = ps.protein_id
      LEFT JOIN ecod_schema.batch b ON ps.batch_id = b.id
      LEFT JOIN ecod_schema.process_file pf ON ps.id = pf.process_id
      WHERE ep.pdb_id = $1 AND ep.chain_id = $2
        AND (pf.file_type IS NULL OR pf.file_type IN (
          'chain_blast_result',
          'domain_blast_result', 
          'hhsearch_result',
          'domain_summary',
          'hhblits_profile'
        ))
      ORDER BY 
        CASE pf.file_type
          WHEN 'domain_summary' THEN 1
          WHEN 'chain_blast_result' THEN 2
          WHEN 'domain_blast_result' THEN 3
          WHEN 'hhsearch_result' THEN 4
          WHEN 'hhblits_profile' THEN 5
          ELSE 6
        END,
        pf.last_checked DESC
    `

    const filesystemResult = await prisma.$queryRawUnsafe(filesystemQuery, pdbId, chainId)
    const files = serializeBigInt(filesystemResult)

    // Get audit information if available
    const auditQuery = `
      SELECT
        da.id as audit_id,
        da.audit_date,
        da.visualization_path,
        da.json_report_path,
        da.text_report_path,
        da.total_blast_hits,
        da.total_domains,
        da.has_short_alignments,
        da.max_domain_coverage,
        da.min_domain_coverage,
        da.avg_domain_coverage,
        da.notes
      FROM ecod_schema.protein ep
      JOIN ecod_schema.domain_audit da ON ep.id = da.protein_id
      WHERE ep.pdb_id = $1 AND ep.chain_id = $2
      ORDER BY da.audit_date DESC
      LIMIT 1
    `

    const auditResult = await prisma.$queryRawUnsafe(auditQuery, pdbId, chainId)
    const audit = auditResult && (auditResult as any[]).length > 0 ? (auditResult as any[])[0] : null

    // Group files by type for better organization
    const filesByType = files.reduce((acc: any, file: any) => {
      if (file.file_type) {
        if (!acc[file.file_type]) acc[file.file_type] = []
        acc[file.file_type].push(file)
      }
      return acc
    }, {})

    // Get process info (first file will have process info)
    const processInfo = files.length > 0 ? {
      ecod_protein_id: files[0].ecod_protein_id,
      process_status_id: files[0].process_status_id,
      batch_id: files[0].batch_id,
      batch_name: files[0].batch_name,
      ref_version: files[0].ref_version,
      current_stage: files[0].current_stage,
      process_status: files[0].process_status,
      processing_path: files[0].processing_path,
      error_message: files[0].error_message,
      process_updated_at: files[0].process_updated_at,
      batch_base_path: files[0].batch_base_path
    } : null

    const response = {
      protein_id: `${pdbId}_${chainId}`,
      process_info: processInfo,
      audit_info: audit,
      files: files.filter(f => f.file_type), // Only files with file_type
      files_by_type: filesByType,
      file_counts: {
        total: files.filter(f => f.file_type).length,
        existing: files.filter(f => f.file_exists).length,
        missing: files.filter(f => f.file_type && !f.file_exists).length
      },
      metadata: {
        query_time: new Date().toISOString(),
        source: 'ecod_schema_filesystem_tracking'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching filesystem evidence:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filesystem evidence', details: error.message },
      { status: 500 }
    )
  }
}
