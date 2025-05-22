// app/api/audit/discrepancies/route.ts
export async function GET() {
  try {
    const discrepancies = await prisma.$queryRawUnsafe(`
      WITH discrepancy_analysis AS (
        -- Find proteins that should have domains but don't
        SELECT 
          'missing_domains' as issue_type,
          pp.batch_id,
          pp.pdb_id,
          pp.chain_id,
          pp.is_classified,
          COUNT(pd.id) as domain_count,
          'Protein marked as classified but has no domains' as description
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        WHERE pp.is_classified = true
        GROUP BY pp.batch_id, pp.pdb_id, pp.chain_id, pp.is_classified, pp.id
        HAVING COUNT(pd.id) = 0
        
        UNION ALL
        
        -- Find domains without evidence
        SELECT 
          'domains_without_evidence' as issue_type,
          pp.batch_id,
          pp.pdb_id,
          pp.chain_id,
          NULL as is_classified,
          pd.id as domain_count,
          'Domain exists but has no supporting evidence' as description
        FROM pdb_analysis.partition_proteins pp
        JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE de.id IS NULL
        
        UNION ALL
        
        -- Find classification mismatches
        SELECT 
          'classification_mismatch' as issue_type,
          pp.batch_id,
          pp.pdb_id,
          pp.chain_id,
          pp.is_classified,
          COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) as domain_count,
          'Protein classification status disagrees with domain classifications' as description
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        GROUP BY pp.batch_id, pp.pdb_id, pp.chain_id, pp.is_classified, pp.id
        HAVING (pp.is_classified = true AND COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) = 0)
            OR (pp.is_classified = false AND COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) > 0)
      )
      SELECT 
        issue_type,
        batch_id,
        COUNT(*) as affected_proteins,
        array_agg(pdb_id || '_' || chain_id ORDER BY pdb_id, chain_id LIMIT 10) as sample_proteins,
        description
      FROM discrepancy_analysis
      GROUP BY issue_type, batch_id, description
      ORDER BY batch_id, issue_type
    `)

    return NextResponse.json({ discrepancies })
  } catch (error) {
    console.error('Discrepancy detection error:', error)
    return NextResponse.json({ error: 'Failed to detect discrepancies' }, { status: 500 })
  }
}
