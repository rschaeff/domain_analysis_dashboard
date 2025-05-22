// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to convert BigInts to Numbers and handle null/undefined
function serializable(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(serializable);
  }

  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializable(value)])
    );
  }

  return obj;
}

export async function GET() {
  try {
    // Get comprehensive dashboard statistics
    const dashboardStats = await prisma.$queryRawUnsafe(`
      WITH protein_stats AS (
        SELECT
          COUNT(DISTINCT p.id) as total_proteins,
          COUNT(DISTINCT CASE WHEN pp.is_classified = true THEN p.id END) as classified_chains,
          COUNT(DISTINCT CASE WHEN pp.is_classified = false THEN p.id END) as unclassified_chains,
          AVG(CASE WHEN pp.coverage IS NOT NULL THEN pp.coverage ELSE 0 END) as avg_domain_coverage
        FROM pdb_analysis.protein p
        LEFT JOIN pdb_analysis.partition_proteins pp ON p.id = pp.id
      ),
      domain_stats AS (
        SELECT
          COUNT(*) as total_domains,
          COUNT(CASE WHEN pd.t_group IS NOT NULL THEN 1 END) as classified_domains,
          COUNT(CASE WHEN pd.t_group IS NULL THEN 1 END) as unclassified_domains,
          AVG(CASE WHEN pd.confidence IS NOT NULL THEN pd.confidence ELSE 0 END) as avg_confidence
        FROM pdb_analysis.partition_domains pd
      ),
      evidence_stats AS (
        SELECT
          COUNT(DISTINCT de.domain_id) as domains_with_evidence,
          COUNT(*) as total_evidence_items
        FROM pdb_analysis.domain_evidence de
      )
      SELECT
        ps.total_proteins,
        ps.classified_chains,
        ps.unclassified_chains,
        ps.avg_domain_coverage,
        ds.total_domains,
        ds.classified_domains,
        ds.unclassified_domains,
        ds.avg_confidence,
        es.domains_with_evidence,
        es.total_evidence_items
      FROM protein_stats ps
      CROSS JOIN domain_stats ds
      CROSS JOIN evidence_stats es
    `);

    if (!dashboardStats || !Array.isArray(dashboardStats) || dashboardStats.length === 0) {
      // Return safe defaults if no data
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
        total_evidence_items: 0
      });
    }

    // Convert BigInt values and ensure all fields exist
    const stats = serializable(dashboardStats[0]);

    // Ensure all expected fields exist with safe defaults
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
      total_evidence_items: Number(stats.total_evidence_items || 0)
    };

    return NextResponse.json(safeStats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);

    // Return safe defaults on error
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
      error: 'Failed to fetch dashboard statistics'
    }, { status: 200 }); // Return 200 with defaults rather than 500
  }
}
