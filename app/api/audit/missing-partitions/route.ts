// app/api/audit/missing-partitions/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    
    const missingPartitions = await prisma.$queryRawUnsafe(`
      WITH batch_expectations AS (
        -- Get what SHOULD be processed based on batch definitions
        SELECT 
          b.id as batch_id,
          b.batch_name,
          b.total_items as expected_count,
          b.completed_items as reported_completed,
          b.status as batch_status
        FROM ecod_schema.batch b
        WHERE ($1 IS NULL OR b.id = $1)
          AND b.type = 'pdb_hhsearch'
      ),
      actual_partitions AS (
        -- Get what WAS actually processed  
        SELECT 
          pp.batch_id,
          COUNT(*) as actual_processed,
          COUNT(CASE WHEN pp.is_classified THEN 1 END) as actually_classified,
          COUNT(CASE WHEN pd.id IS NOT NULL THEN 1 END) as with_domains,
          COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as with_evidence
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE ($1 IS NULL OR pp.batch_id = $1)
        GROUP BY pp.batch_id
      ),
      processing_gaps AS (
        -- Identify specific types of gaps
        SELECT 
          pp.batch_id,
          pp.pdb_id,
          pp.chain_id,
          pp.is_classified,
          COUNT(pd.id) as domain_count,
          COUNT(de.id) as evidence_count,
          CASE 
            WHEN COUNT(pd.id) = 0 THEN 'NO_DOMAINS'
            WHEN COUNT(de.id) = 0 THEN 'NO_EVIDENCE' 
            WHEN pp.is_classified = false AND COUNT(pd.id) > 0 THEN 'UNCLASSIFIED_WITH_DOMAINS'
            WHEN pp.is_classified = true AND COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) = 0 THEN 'CLASSIFIED_WITHOUT_GROUPS'
            ELSE 'OK'
          END as gap_type
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE ($1 IS NULL OR pp.batch_id = $1)
        GROUP BY pp.batch_id, pp.pdb_id, pp.chain_id, pp.is_classified, pp.id
      )
      SELECT 
        be.batch_id,
        be.batch_name,
        be.expected_count,
        be.reported_completed,
        COALESCE(ap.actual_processed, 0) as actual_processed,
        COALESCE(ap.actually_classified, 0) as actually_classified,
        COALESCE(ap.with_domains, 0) as with_domains,
        COALESCE(ap.with_evidence, 0) as with_evidence,
        
        -- Calculate gaps
        (be.expected_count - COALESCE(ap.actual_processed, 0)) as missing_proteins,
        (be.reported_completed - COALESCE(ap.actual_processed, 0)) as reporting_gap,
        
        -- Gap breakdown
        COUNT(CASE WHEN pg.gap_type = 'NO_DOMAINS' THEN 1 END) as proteins_without_domains,
        COUNT(CASE WHEN pg.gap_type = 'NO_EVIDENCE' THEN 1 END) as domains_without_evidence,
        COUNT(CASE WHEN pg.gap_type = 'UNCLASSIFIED_WITH_DOMAINS' THEN 1 END) as classification_failures,
        COUNT(CASE WHEN pg.gap_type = 'CLASSIFIED_WITHOUT_GROUPS' THEN 1 END) as assignment_failures,
        
        -- Sample problematic cases
        array_agg(
          CASE WHEN pg.gap_type != 'OK' 
          THEN pg.pdb_id || '_' || pg.chain_id || ' (' || pg.gap_type || ')'
          END
        ) FILTER (WHERE pg.gap_type != 'OK') as sample_issues
        
      FROM batch_expectations be
      LEFT JOIN actual_partitions ap ON be.batch_id = ap.batch_id
      LEFT JOIN processing_gaps pg ON be.batch_id = pg.batch_id
      GROUP BY be.batch_id, be.batch_name, be.expected_count, be.reported_completed,
               ap.actual_processed, ap.actually_classified, ap.with_domains, ap.with_evidence
      ORDER BY missing_proteins DESC, reporting_gap DESC
    `, [batchId ? parseInt(batchId) : null])

    return NextResponse.json({ missing_partitions: missingPartitions })
  } catch (error) {
    console.error('Missing partitions audit error:', error)
    return NextResponse.json({ error: 'Failed to audit missing partitions' }, { status: 500 })
  }
}
