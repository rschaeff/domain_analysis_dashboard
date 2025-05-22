// app/api/audit/chain-blast-diagnostic/route.ts
export async function GET(request: NextRequest) {
  try {
    const chainBlastDiagnostic = await prisma.$queryRawUnsafe(`
      WITH chain_blast_analysis AS (
        SELECT 
          pp.batch_id,
          pp.pdb_id,
          pp.chain_id,
          pp.sequence_length,
          
          -- Chain BLAST evidence
          COUNT(CASE WHEN de.evidence_type = 'chain_blast' THEN 1 END) as chain_blast_hits,
          MAX(CASE WHEN de.evidence_type = 'chain_blast' THEN de.confidence END) as max_chain_blast_conf,
          string_agg(
            CASE WHEN de.evidence_type = 'chain_blast' 
            THEN de.hit_id || '(' || de.confidence || ',' || de.t_group || ')'
            END, '; '
          ) as chain_blast_details,
          
          -- Domain BLAST comparison
          COUNT(CASE WHEN de.evidence_type = 'domain_blast' THEN 1 END) as domain_blast_hits,
          MAX(CASE WHEN de.evidence_type = 'domain_blast' THEN de.confidence END) as max_domain_blast_conf,
          
          -- Final results
          COUNT(pd.id) as final_domains,
          bool_and(pd.t_group IS NOT NULL) as all_domains_classified,
          string_agg(pd.source, ', ') as sources_used,
          
          -- Issue identification
          CASE 
            WHEN COUNT(CASE WHEN de.evidence_type = 'chain_blast' THEN 1 END) = 0 
            THEN 'NO_CHAIN_BLAST_EVIDENCE'
            
            WHEN COUNT(CASE WHEN de.evidence_type = 'chain_blast' THEN 1 END) > 0
                 AND NOT bool_or(pd.source = 'chain_blast')
            THEN 'CHAIN_BLAST_NOT_USED'
            
            WHEN COUNT(CASE WHEN de.evidence_type = 'chain_blast' THEN 1 END) > 1
                 AND COUNT(DISTINCT CASE WHEN de.evidence_type = 'chain_blast' THEN de.t_group END) > 1
            THEN 'CONFLICTING_CHAIN_BLAST'
            
            WHEN MAX(CASE WHEN de.evidence_type = 'chain_blast' THEN de.confidence END) > 0.9
                 AND NOT bool_or(pd.source = 'chain_blast')
            THEN 'HIGH_CONF_CHAIN_BLAST_IGNORED'
            
            ELSE 'CHAIN_BLAST_OK'
          END as chain_blast_issue
          
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        GROUP BY pp.batch_id, pp.pdb_id, pp.chain_id, pp.sequence_length, pp.id
      )
      SELECT 
        chain_blast_issue,
        COUNT(*) as protein_count,
        AVG(sequence_length) as avg_sequence_length,
        AVG(chain_blast_hits) as avg_chain_blast_hits,
        AVG(domain_blast_hits) as avg_domain_blast_hits,
        AVG(max_chain_blast_conf) as avg_max_chain_conf,
        AVG(max_domain_blast_conf) as avg_max_domain_conf,
        
        -- Sample problematic proteins for investigation
        array_agg(
          pdb_id || '_' || chain_id || ' (cb:' || chain_blast_hits || 
          ',conf:' || COALESCE(max_chain_blast_conf::text, 'null') || ')'
          ORDER BY max_chain_blast_conf DESC NULLS LAST
          LIMIT 10
        ) as sample_proteins
        
      FROM chain_blast_analysis
      WHERE chain_blast_issue != 'CHAIN_BLAST_OK'
      GROUP BY chain_blast_issue
      ORDER BY protein_count DESC
    `)

    return NextResponse.json({ chain_blast_diagnostic: chainBlastDiagnostic })
  } catch (error) {
    console.error('Chain BLAST diagnostic error:', error)
    return NextResponse.json({ error: 'Failed to run chain BLAST diagnostic' }, { status: 500 })
  }
}
