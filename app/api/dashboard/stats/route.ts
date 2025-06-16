// app/api/dashboard/stats/route.ts - UPDATED for representative-only approach
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get comprehensive representative-only statistics
    // Uses the same filtering approach as other APIs
    const rawStats = await prisma.$queryRawUnsafe(`
      WITH representative_stats AS (
        SELECT
          pp.id,
          pp.pdb_id,
          pp.chain_id,
          pp.process_version,
          pp.sequence_md5,
          pp.batch_id,
          pp.timestamp,
          p.length as sequence_length,
          -- Domain counts and quality from partition_domains
          COALESCE(ds.domains_found, 0) as domains_found,
          COALESCE(ds.domains_classified, 0) as domains_classified,
          COALESCE(ds.avg_confidence, 0) as avg_confidence,
          COALESCE(ds.best_confidence, 0) as best_confidence,
          COALESCE(ds.coverage, 0) as coverage,
          -- Evidence counts
          COALESCE(es.evidence_count, 0) as evidence_count,
          COALESCE(es.evidence_types, 0) as evidence_types,
          -- Propagated sequence count for this representative
          (SELECT COUNT(*)
           FROM pdb_analysis.partition_proteins pp2
           WHERE pp2.sequence_md5 = pp.sequence_md5
             AND pp2.process_version = 'mini_pyecod_propagated_1.0'
          ) as propagated_count,
          -- Processing age
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - pp.timestamp)) / 86400.0 as days_since_processing
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN pdb_analysis.protein p ON pp.pdb_id = p.pdb_id AND pp.chain_id = p.chain_id
        -- Domain statistics
        LEFT JOIN (
          SELECT
            pd.protein_id,
            COUNT(pd.id) as domains_found,
            COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) as domains_classified,
            AVG(pd.confidence) as avg_confidence,
            MAX(pd.confidence) as best_confidence,
            CASE
              WHEN p2.length > 0 AND SUM(pd.length) > 0
              THEN LEAST(1.0, SUM(pd.length)::float / p2.length::float)
              ELSE 0.0
            END as coverage
          FROM pdb_analysis.partition_domains pd
          JOIN pdb_analysis.partition_proteins pp2 ON pd.protein_id = pp2.id
          JOIN pdb_analysis.protein p2 ON pp2.pdb_id = p2.pdb_id AND pp2.chain_id = p2.chain_id
          GROUP BY pd.protein_id, p2.length
        ) ds ON pp.id = ds.protein_id
        -- Evidence statistics
        LEFT JOIN (
          SELECT
            pd.protein_id,
            COUNT(de.id) as evidence_count,
            COUNT(DISTINCT de.evidence_type) as evidence_types
          FROM pdb_analysis.partition_domains pd
          LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
          GROUP BY pd.protein_id
        ) es ON pp.id = es.protein_id
        WHERE pp.process_version = 'mini_pyecod_1.0'  -- Representatives only
      )
      SELECT
        -- Core protein statistics
        COUNT(*) as total_proteins,
        COUNT(CASE WHEN domains_found > 0 THEN 1 END) as classified_chains,
        COUNT(CASE WHEN domains_found = 0 THEN 1 END) as unclassified_chains,

        -- Domain discovery and classification
        SUM(domains_found) as total_domains,
        SUM(domains_classified) as classified_domains,
        SUM(domains_found) - SUM(domains_classified) as unclassified_domains,

        -- Quality metrics (representative-focused)
        AVG(coverage) as avg_domain_coverage,
        AVG(best_confidence) as avg_confidence,

        -- Evidence generation
        COUNT(CASE WHEN evidence_count > 0 THEN 1 END) as domains_with_evidence,
        SUM(evidence_count) as total_evidence_items,

        -- Representative-specific metrics
        SUM(propagated_count) as total_propagated_sequences,
        COUNT(CASE WHEN propagated_count > 0 THEN 1 END) as representatives_with_propagated,
        AVG(propagated_count) as avg_propagated_per_representative,
        MAX(propagated_count) as max_propagated_sequences,

        -- Classification success rates
        COUNT(CASE WHEN domains_found > 0 AND domains_classified = domains_found THEN 1 END) as fully_classified_proteins,
        COUNT(CASE WHEN evidence_types >= 2 THEN 1 END) as proteins_with_multiple_evidence_types,
        COUNT(CASE WHEN best_confidence >= 0.8 THEN 1 END) as high_confidence_proteins,

        -- Processing recency
        COUNT(CASE WHEN days_since_processing <= 7 THEN 1 END) as recent_processing,
        COUNT(CASE WHEN days_since_processing <= 30 THEN 1 END) as processing_last_month,

        -- Coverage quality distribution
        COUNT(CASE WHEN coverage >= 0.8 THEN 1 END) as high_coverage_proteins,
        COUNT(CASE WHEN coverage >= 0.5 AND coverage < 0.8 THEN 1 END) as medium_coverage_proteins,
        COUNT(CASE WHEN coverage > 0 AND coverage < 0.5 THEN 1 END) as low_coverage_proteins,

        -- Algorithm performance indicator
        'mini_pyecod_1.0' as algorithm_version,
        COUNT(DISTINCT batch_id) as unique_batches,
        MIN(timestamp) as earliest_processing,
        MAX(timestamp) as latest_processing

      FROM representative_stats
    `);

    // Convert BigInt values to Numbers and handle the result
    const pipelineStats = JSON.parse(JSON.stringify(rawStats, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ))

    if (!pipelineStats || !Array.isArray(pipelineStats) || pipelineStats.length === 0) {
      return NextResponse.json({
        total_proteins: 0,
        total_domains: 0,
        classified_chains: 0,
        unclassified_chains: 0,
        classified_domains: 0,
        unclassified_domains: 0,
        avg_domain_coverage: 0,
        avg_confidence: 0,
        domains_with_evidence: 0,
        total_evidence_items: 0,
        total_propagated_sequences: 0,
        representatives_with_propagated: 0,
        data_source: 'representative_partition_analysis',
        algorithm_version: 'mini_pyecod_1.0',
        error: 'No representative data found'
      });
    }

    const stats = pipelineStats[0] as any;

    // Build comprehensive representative-focused statistics
    const safeStats = {
      // Core metrics (same as before but representative-only)
      total_proteins: Number(stats.total_proteins || 0),
      total_domains: Number(stats.total_domains || 0),
      classified_chains: Number(stats.classified_chains || 0),
      unclassified_chains: Number(stats.unclassified_chains || 0),
      classified_domains: Number(stats.classified_domains || 0),
      unclassified_domains: Number(stats.unclassified_domains || 0),
      avg_domain_coverage: Number(stats.avg_domain_coverage || 0),
      avg_confidence: Number(stats.avg_confidence || 0),
      domains_with_evidence: Number(stats.domains_with_evidence || 0),
      total_evidence_items: Number(stats.total_evidence_items || 0),

      // NEW: Representative/propagation metrics
      total_propagated_sequences: Number(stats.total_propagated_sequences || 0),
      representatives_with_propagated: Number(stats.representatives_with_propagated || 0),
      avg_propagated_per_representative: Number(stats.avg_propagated_per_representative || 0),
      max_propagated_sequences: Number(stats.max_propagated_sequences || 0),

      // Enhanced quality metrics
      fully_classified_proteins: Number(stats.fully_classified_proteins || 0),
      proteins_with_multiple_evidence_types: Number(stats.proteins_with_multiple_evidence_types || 0),
      high_confidence_proteins: Number(stats.high_confidence_proteins || 0),
      high_coverage_proteins: Number(stats.high_coverage_proteins || 0),
      medium_coverage_proteins: Number(stats.medium_coverage_proteins || 0),
      low_coverage_proteins: Number(stats.low_coverage_proteins || 0),

      // Processing metrics
      recent_processing: Number(stats.recent_processing || 0),
      processing_last_month: Number(stats.processing_last_month || 0),
      unique_batches: Number(stats.unique_batches || 0),
      earliest_processing: stats.earliest_processing,
      latest_processing: stats.latest_processing,

      // Success rates and derived metrics
      classification_success_rate: stats.total_proteins > 0 ?
        Math.round((Number(stats.classified_chains) / Number(stats.total_proteins)) * 100) : 0,
      domain_classification_rate: stats.total_domains > 0 ?
        Math.round((Number(stats.classified_domains) / Number(stats.total_domains)) * 100) : 0,
      propagation_rate: stats.total_proteins > 0 ?
        Math.round((Number(stats.representatives_with_propagated) / Number(stats.total_proteins)) * 100) : 0,
      high_confidence_rate: stats.total_proteins > 0 ?
        Math.round((Number(stats.high_confidence_proteins) / Number(stats.total_proteins)) * 100) : 0,

      // Propagation coverage metrics
      propagation_coverage_ratio: stats.total_proteins > 0 ?
        Number(stats.total_propagated_sequences) / Number(stats.total_proteins) : 0,

      // Data source and version tracking
      algorithm_version: stats.algorithm_version || 'mini_pyecod_1.0',
      data_source: 'representative_partition_analysis',
      architecture: 'representative_focused_with_propagation_tracking',
      excluded_versions: ['1.0'], // Always exclude old algorithm
      query_complexity: 'representative_only_with_propagation_stats'
    };

    return NextResponse.json(safeStats);

  } catch (error) {
    console.error('Error fetching representative pipeline stats:', error);

    // Return safe defaults with error indication
    return NextResponse.json({
      total_proteins: 0,
      total_domains: 0,
      classified_chains: 0,
      unclassified_chains: 0,
      classified_domains: 0,
      unclassified_domains: 0,
      avg_domain_coverage: 0,
      avg_confidence: 0,
      domains_with_evidence: 0,
      total_evidence_items: 0,
      total_propagated_sequences: 0,
      representatives_with_propagated: 0,
      error: 'Failed to fetch representative pipeline statistics',
      details: error instanceof Error ? error.message : String(error),
      data_source: 'representative_partition_analysis',
      algorithm_version: 'mini_pyecod_1.0'
    }, { status: 200 });
  }
}
