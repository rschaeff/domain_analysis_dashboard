// app/api/audit/missing-partitions/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper function to convert BigInt values to numbers recursively
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return Number(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber)
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value)
    }
    return converted
  }

  return obj
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    const includeNonRep = searchParams.get('include_non_representative') === 'true'

    // Build the WHERE clause dynamically
    const batchFilter = batchId ? `AND b.id = ${parseInt(batchId)}` : ''
    const batchFilterPS = batchId ? `AND ps.batch_id = ${parseInt(batchId)}` : ''

    // Representative filter - add this unless explicitly including non-representative
    const representativeFilter = includeNonRep ? '' : 'AND ps.is_representative = true'

    const rawPartitionAudit = await prisma.$queryRawUnsafe(`
      WITH batch_overview AS (
        -- Get batch metadata and expectations
        SELECT
          b.id as batch_id,
          b.batch_name,
          b.type as batch_type,
          b.total_items as reported_total,
          b.completed_items as reported_completed,
          b.status as batch_status,
          b.ref_version
        FROM ecod_schema.batch b
        WHERE b.type IN ('pdb_hhsearch', 'domain_analysis')
          ${batchFilter}
      ),
      batch_proteins AS (
        -- Get representative proteins actually assigned to each batch via process_status
        SELECT
          ps.batch_id,
          COUNT(*) as proteins_in_batch,
          COUNT(CASE WHEN ps.current_stage IN ('completed', 'classified') THEN 1 END) as proteins_reported_done,
          COUNT(CASE WHEN ps.is_representative = true THEN 1 END) as representative_count,
          COUNT(CASE WHEN ps.is_representative = false THEN 1 END) as non_representative_count,
          array_agg(DISTINCT ps.current_stage) as stages_present
        FROM ecod_schema.process_status ps
        JOIN ecod_schema.protein ep ON ps.protein_id = ep.id
        WHERE 1=1 ${batchFilterPS} ${representativeFilter}
        GROUP BY ps.batch_id
      ),
        batch_protein_list AS (
          SELECT
            ps.batch_id,
            ep.source_id,
            ep.pdb_id,
            ep.chain_id,
            ps.is_representative
          FROM ecod_schema.process_status ps
          JOIN ecod_schema.protein ep ON ps.protein_id = ep.id
          WHERE 1=1 ${batchFilterPS} ${representativeFilter}
        ),
      -- IMPORTANT: The key fix is adding 'AND pp.batch_id = bpl.batch_id'
      -- to prevent cross-batch contamination where the same protein chain
      -- appears in multiple batches and we were counting ALL partition results
      partition_results AS (
        -- Get actual partition results CONSTRAINED to proteins actually in each batch
        SELECT
          bpl.batch_id,
          COUNT(pp.id) as partitions_attempted,
          COUNT(CASE WHEN pp.is_classified = true THEN 1 END) as partitions_classified,
          COUNT(CASE WHEN pp.is_classified = false THEN 1 END) as partitions_unclassified,
          COUNT(CASE WHEN pp.sequence_length < 30 THEN 1 END) as partitions_peptide,
          COUNT(pd.id) as total_domains_found,
          COUNT(de.id) as total_evidence_items,

          -- Sample unclassified proteins
          array_remove(array_agg(
            CASE WHEN pp.is_classified = false
            THEN pp.pdb_id || '_' || pp.chain_id
            ELSE NULL END
          ), NULL) as sample_unclassified,

          -- Sample classified proteins
          array_remove(array_agg(
            CASE WHEN pp.is_classified = true
            THEN pp.pdb_id || '_' || pp.chain_id
            ELSE NULL END
          ), NULL) as sample_classified

        FROM batch_protein_list bpl
        LEFT JOIN pdb_analysis.partition_proteins pp ON (
          bpl.source_id = (pp.pdb_id || '_' || pp.chain_id)
          AND pp.batch_id = bpl.batch_id  -- CRITICAL: constrain by batch_id
          AND pp.process_version in ('mini_pyecod_1.0', 'mini_pyecod_propagated_1.0')
        )
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        GROUP BY bpl.batch_id
      ),
      missing_analysis AS (
        -- Identify representative proteins that should have been processed but weren't
        SELECT
          bpl.batch_id,
          COUNT(*) as proteins_missing_partitions,
          array_agg(bpl.source_id ORDER BY bpl.source_id) as sample_missing_proteins
        FROM batch_protein_list bpl
        LEFT JOIN pdb_analysis.partition_proteins pp ON (
          bpl.source_id = (pp.pdb_id || '_' || pp.chain_id)
          AND pp.batch_id = bpl.batch_id  -- CRITICAL: constrain by batch_id
          AND  pp.process_version in ('mini_pyecod_1.0', 'mini_pyecod_propagated_1.0')
        )
        WHERE pp.id IS NULL
        GROUP BY bpl.batch_id
      ),
      file_analysis AS (
        -- Check what files exist for missing partitions (representative only)
        SELECT
          ps.batch_id,
          COUNT(CASE WHEN pf.file_type = 'fasta' AND pf.file_exists = true THEN 1 END) as fasta_files_exist,
          COUNT(CASE WHEN pf.file_type LIKE '%blast%' AND pf.file_exists = true THEN 1 END) as blast_files_exist,
          COUNT(CASE WHEN pf.file_type LIKE '%hhsearch%' AND pf.file_exists = true THEN 1 END) as hhsearch_files_exist,
          COUNT(CASE WHEN pf.file_type LIKE '%partition%' AND pf.file_exists = true THEN 1 END) as partition_files_exist
        FROM ecod_schema.process_status ps
        LEFT JOIN ecod_schema.process_file pf ON ps.id = pf.process_id
        WHERE 1=1 ${batchFilterPS} ${representativeFilter}
        GROUP BY ps.batch_id
      )
      SELECT
        bo.batch_id,
        bo.batch_name,
        bo.batch_type,
        bo.ref_version,
        bo.batch_status,

        -- Expectations vs Reality
        bo.reported_total as batch_reported_total,
        bo.reported_completed as batch_reported_completed,
        COALESCE(bp.proteins_in_batch, 0) as actual_proteins_in_batch,
        COALESCE(bp.proteins_reported_done, 0) as proteins_reported_done,
        COALESCE(bp.representative_count, 0) as representative_count,
        COALESCE(bp.non_representative_count, 0) as non_representative_count,

        -- Partition Results
        COALESCE(pr.partitions_attempted, 0) as partitions_attempted,
        COALESCE(pr.partitions_classified, 0) as partitions_classified,
        COALESCE(pr.partitions_unclassified, 0) as partitions_unclassified,
        COALESCE(pr.partitions_peptide, 0) as partitions_peptide,
        COALESCE(pr.total_domains_found, 0) as total_domains_found,
        COALESCE(pr.total_evidence_items, 0) as total_evidence_items,

        -- Gaps and Issues
        COALESCE(ma.proteins_missing_partitions, 0) as proteins_missing_partitions,
        (COALESCE(bp.proteins_in_batch, 0) - COALESCE(pr.partitions_attempted, 0)) as partition_gap,
        (bo.reported_total - COALESCE(bp.proteins_in_batch, 0)) as batch_definition_gap,

        -- File Status
        COALESCE(fa.fasta_files_exist, 0) as fasta_files_exist,
        COALESCE(fa.blast_files_exist, 0) as blast_files_exist,
        COALESCE(fa.hhsearch_files_exist, 0) as hhsearch_files_exist,
        COALESCE(fa.partition_files_exist, 0) as partition_files_exist,

        -- Samples and Details (slice arrays to first few elements)
        COALESCE(bp.stages_present, ARRAY[]::text[]) as stages_present,
        COALESCE((pr.sample_unclassified)[1:5], ARRAY[]::text[]) as sample_unclassified,
        COALESCE((pr.sample_classified)[1:3], ARRAY[]::text[]) as sample_classified,
        COALESCE((ma.sample_missing_proteins)[1:5], ARRAY[]::text[]) as sample_missing_proteins,

        -- Calculated Quality Metrics
        CASE
          WHEN COALESCE(bp.proteins_in_batch, 0) > 0
          THEN ROUND((COALESCE(pr.partitions_attempted, 0)::numeric / bp.proteins_in_batch::numeric) * 100, 1)
          ELSE 0.0
        END as partition_attempt_rate,

        CASE
          WHEN COALESCE(pr.partitions_attempted, 0) > 0
          THEN ROUND((COALESCE(pr.partitions_classified, 0)::numeric / pr.partitions_attempted::numeric) * 100, 1)
          ELSE 0.0
        END as classification_success_rate,

        CASE
          WHEN COALESCE(bp.proteins_in_batch, 0) > 0
          THEN ROUND((COALESCE(pr.partitions_classified, 0)::numeric / bp.proteins_in_batch::numeric) * 100, 1)
          ELSE 0.0
        END as overall_success_rate,

        -- Include filter mode in results
        ${includeNonRep ? 'true' : 'false'} as includes_non_representative

      FROM batch_overview bo
      LEFT JOIN batch_proteins bp ON bo.batch_id = bp.batch_id
      LEFT JOIN partition_results pr ON bo.batch_id = pr.batch_id
      LEFT JOIN missing_analysis ma ON bo.batch_id = ma.batch_id
      LEFT JOIN file_analysis fa ON bo.batch_id = fa.batch_id
      ORDER BY
        bo.batch_id DESC,
        proteins_missing_partitions DESC,
        partition_gap DESC
    `)

    // Convert BigInt values to numbers using helper function
    const partitionAudit = convertBigIntToNumber(rawPartitionAudit)

    return NextResponse.json({
      partition_audit: partitionAudit,
      filter_mode: includeNonRep ? 'all_proteins' : 'representative_only'
    })
  } catch (error) {
    console.error('Partition audit error:', error)
    return NextResponse.json({
      error: 'Failed to audit partitions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
