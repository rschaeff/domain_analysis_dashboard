// pages/api/dashboard/stats.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Query the domain_dashboard_stats view
    const stats = await prisma.$queryRaw`
      SELECT * FROM pdb_analysis.domain_dashboard_stats LIMIT 1
    `;
    
    if (!stats || !Array.isArray(stats) || stats.length === 0) {
      // If no stats are available, return zeros
      return res.status(200).json({
        total_proteins: 0,
        total_domains: 0,
        classified_chains: 0,
        unclassified_chains: 0,
        avg_domain_coverage: 0
      });
    }
    
    return res.status(200).json(stats[0]);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ 
      message: 'Error fetching dashboard stats',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
