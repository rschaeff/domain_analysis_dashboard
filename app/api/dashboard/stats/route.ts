// app/api/dashboard/stats/route.ts - FIXED VERSION
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get comprehensive pipeline performance statistics
    const pipelineStats = await prisma.$queryRawUnsafe(`
      SELECT
        -- Pipeline throughput
        COUNT(*) as total_proteins,
        COUNT(CASE WHEN domains_found > 0 THEN 1 END) as classified_chains,
        COUNT(CASE WHEN domains_found = 0 THEN 1 END) as unclassified_chains,

        -- Domain discovery and classification
        SUM(domains_found) as total_domains,
        SUM(domains_classified) as classified_domains,
        SUM(domains_found) - SUM(domains_classified) as unclassified_domains,

        -- Quality metrics
        AVG(coverage) as avg_domain_coverage,
        AVG(best_domain_confidence) as avg_confidence,

        -- Evidence generation
        COUNT(CASE WHEN total_evidence_generated > 0 THEN 1 END) as domains_with_evidence,
        SUM(total_evidence_generated) as total_evidence_items,

        -- Pipeline performance indicators
        COUNT(CASE WHEN classification_status = 'FULLY_CLASSIFIED' THEN 1 END) as fully_classified_proteins,
        COUNT(CASE WHEN evidence_quality = 'RICH_EVIDENCE' THEN 1 END) as proteins_with_rich_evidence,
        COUNT(CASE WHEN days_since_processing <= 7 THEN 1 END) as recent_processing

      FROM pdb_analysis.pipeline_performance_summary
    `);

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
        data_source: 'pipeline_performance_summary'
      });
    }

    const stats = pipelineStats[0] as any;

    // Convert BigInt values and ensure all fields exist
    const safeStats = {
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

      // Additional pipeline performance metrics
      fully_classified_proteins: Number(stats.fully_classified_proteins || 0),
      proteins_with_rich_evidence: Number(stats.proteins_with_rich_evidence || 0),
      recent_processing: Number(stats.recent_processing || 0),

      // Success rates
      classification_success_rate: stats.total_proteins > 0 ?
        Math.round((Number(stats.classified_chains) / Number(stats.total_proteins)) * 100) : 0,
      domain_classification_rate: stats.total_domains > 0 ?
        Math.round((Number(stats.classified_domains) / Number(stats.total_domains)) * 100) : 0,

      // Data source indicator
      data_source: 'pipeline_performance_summary',
      architecture: 'partition_native'
    };

    return NextResponse.json(safeStats);
  } catch (error) {
    console.error('Error fetching pipeline performance stats:', error);

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
      error: 'Failed to fetch pipeline performance statistics',
      data_source: 'pipeline_performance_summary'
    }, { status: 200 });
  }
}
