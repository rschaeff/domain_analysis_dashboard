// app/api/proteins/by-architecture/route.ts
export async function GET(request: NextRequest) {
  try {
    // Use the actual database structure
    const architectureQuery = `
      WITH architecture_patterns AS (
        SELECT
          pp.id as protein_id,
          pp.pdb_id,
          pp.chain_id,
          pp.sequence_length,
          pp.timestamp as processing_date,
          -- Create architecture ID from ordered T-groups
          array_to_string(
            array_agg(
              COALESCE(pd.t_group, 'UNCLASSIFIED')
              ORDER BY pd.domain_number
            ),
            '|'
          ) as architecture_id,
          -- Get domain count
          COUNT(pd.id) as domain_count,
          -- Get unique T-groups
          array_agg(DISTINCT pd.t_group ORDER BY pd.t_group) as t_groups,
          -- Calculate metrics
          AVG(pd.confidence) as avg_confidence,
          COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END)::float / COUNT(pd.id) as classification_completeness,
          MAX(pd.confidence) as best_confidence
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
        WHERE pp.is_classified = true
          AND pp.process_version = 'mini_pyecod_1.0'
        GROUP BY pp.id, pp.pdb_id, pp.chain_id, pp.sequence_length, pp.timestamp
        HAVING COUNT(pd.id) > 0
      ),
      architecture_groups AS (
        SELECT
          architecture_id,
          domain_count,
          t_groups,
          COUNT(*) as frequency,
          AVG(avg_confidence) as group_avg_confidence,
          AVG(classification_completeness) as group_classification_completeness,
          -- Sample proteins for this architecture (limit 20)
          array_agg(
            json_build_object(
              'protein_id', protein_id,
              'pdb_id', pdb_id,
              'chain_id', chain_id,
              'sequence_length', sequence_length,
              'processing_date', processing_date,
              'avg_confidence', avg_confidence,
              'best_confidence', best_confidence,
              'classification_completeness', classification_completeness
            )
            ORDER BY best_confidence DESC
            LIMIT 20
          ) as sample_proteins
        FROM architecture_patterns
        GROUP BY architecture_id, domain_count, t_groups
      )
      SELECT
        architecture_id,
        domain_count,
        t_groups,
        frequency,
        group_avg_confidence,
        group_classification_completeness,
        sample_proteins
      FROM architecture_groups
      ORDER BY frequency DESC, domain_count ASC
      LIMIT 50
    `

    const results = await prisma.$queryRawUnsafe(architectureQuery)

    // Transform results for frontend
    const architectures = (results as any[]).map(row => ({
      architecture_id: row.architecture_id,
      pattern_name: generatePatternName(row.domain_count, row.t_groups),
      domain_count: row.domain_count,
      t_groups: row.t_groups,
      frequency: row.frequency,
      avg_confidence: row.group_avg_confidence,
      classification_completeness: row.group_classification_completeness,
      proteins: row.sample_proteins.map(p => ({
        ...p,
        domains: [] // Fetch separately if needed
      }))
    }))

    return NextResponse.json({ architectures })
  } catch (error) {
    // ... error handling
  }
}

function generatePatternName(domainCount: number, tGroups: string[]): string {
  if (domainCount === 1) {
    return tGroups[0] === 'UNCLASSIFIED' ? 'Unclassified domain' : 'Single domain'
  } else if (domainCount === 2) {
    return 'Two-domain protein'
  } else if (domainCount === 3) {
    return 'Three-domain protein'
  } else {
    return 'Complex multi-domain'
  }
}
