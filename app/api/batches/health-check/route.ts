// app/api/batches/health-check/route.ts
export async function GET(request: NextRequest) {
  try {
    const healthCheck = await prisma.$queryRawUnsafe(`
      WITH batch_analysis AS (
        SELECT 
          b.id,
          b.batch_name,
          b.type,
          b.status as batch_status,
          b.total_items as expected_items,
          b.completed_items as reported_completed,
          b.created_at,
          b.completed_at,
          
          -- Actual counts from partition tables
          COUNT(DISTINCT pp.id) as actual_proteins_in_partition,
          COUNT(DISTINCT pd.id) as actual_domains_in_partition,
          
          -- Classification status
          COUNT(CASE WHEN pp.is_classified THEN 1 END) as classified_count,
          COUNT(CASE WHEN pp.is_classified = false THEN 1 END) as unclassified_count,
          
          -- Domain evidence status  
          COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as proteins_with_evidence,
          
          -- Processing timestamps
          MIN(pp.timestamp) as first_partition_timestamp,
          MAX(pp.timestamp) as last_partition_timestamp,
          
          -- Identify sync issues
          CASE 
            WHEN b.status = 'completed' AND COUNT(pp.id) = 0 THEN 'NO_PARTITION_DATA'
            WHEN b.status = 'completed' AND COUNT(pp.id) < b.total_items * 0.9 THEN 'MISSING_PARTITIONS'
            WHEN b.status IN ('processing', 'indexed') AND COUNT(pp.id) >= b.total_items THEN 'STATUS_LAG'
            WHEN b.completed_items > b.total_items THEN 'COUNT_OVERFLOW'
            WHEN b.completed_at IS NULL AND b.status = 'completed' THEN 'MISSING_COMPLETION_TIME'
            ELSE 'OK'
          END as sync_issue
          
        FROM ecod_schema.batch b
        LEFT JOIN pdb_analysis.partition_proteins pp ON b.id = pp.batch_id
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id  
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        GROUP BY b.id, b.batch_name, b.type, b.status, b.total_items, 
                 b.completed_items, b.created_at, b.completed_at
      )
      SELECT 
        *,
        -- Calculate discrepancies
        (actual_proteins_in_partition - expected_items) as protein_count_diff,
        (reported_completed - actual_proteins_in_partition) as completion_count_diff,
        
        -- Processing rate analysis
        CASE 
          WHEN first_partition_timestamp IS NOT NULL AND last_partition_timestamp IS NOT NULL
          THEN EXTRACT(EPOCH FROM (last_partition_timestamp - first_partition_timestamp)) / 3600.0
          ELSE NULL
        END as processing_duration_hours
        
      FROM batch_analysis
      ORDER BY 
        CASE sync_issue 
          WHEN 'OK' THEN 3
          ELSE 1 
        END,
        created_at DESC
    `)

    return NextResponse.json({ batches: healthCheck })
  } catch (error) {
    console.error('Batch health check error:', error)
    return NextResponse.json({ error: 'Failed to perform health check' }, { status: 500 })
  }
}
