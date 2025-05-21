// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to convert BigInts to Numbers
function serializable(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj); // Convert BigInt to Number
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
    // Query the domain_dashboard_stats view
    const stats = await prisma.$queryRaw`
      SELECT * FROM pdb_analysis.domain_dashboard_stats LIMIT 1
    `;

    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      // If no stats are available, return zeros
      return NextResponse.json({
        total_proteins: 0,
        total_domains: 0,
        classified_chains: 0,
        unclassified_chains: 0,
        avg_domain_coverage: 0
      });
    }

    // Convert BigInt values before returning
    const serializableStats = serializable(stats[0]);

    return NextResponse.json(serializableStats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({
      message: 'Error fetching dashboard stats',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
