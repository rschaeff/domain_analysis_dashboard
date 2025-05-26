// app/api/curation/diagnostic/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Multiple diagnostic queries to identify the counting issue
    const diagnostics = await Promise.all([
      // 1. Total protein count
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::INTEGER as total_proteins FROM pdb_analysis.protein`),
      
      // 2. Representative protein count
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::INTEGER as representative_proteins FROM pdb_analysis.protein WHERE is_nonident_rep = true`),
      
      // 3. Partition proteins count
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::INTEGER as partition_proteins FROM pdb_analysis.partition_proteins`),
      
      // 4. Current "curable" count (without representative filter)
      prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT p.id)::INTEGER as curable_without_rep_filter
        FROM pdb_analysis.protein p
        JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
        JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id  
        JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE de.source_id IS NOT NULL 
          AND de.hit_range IS NOT NULL
          AND de.confidence > 0.8
          AND p.length BETWEEN 30 AND 1000
      `),
      
      // 5. "Curable" count WITH representative filter
      prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT p.id)::INTEGER as curable_with_rep_filter
        FROM pdb_analysis.protein p
        JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
        JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id  
        JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE de.source_id IS NOT NULL 
          AND de.hit_range IS NOT NULL
          AND de.confidence > 0.8
          AND p.length BETWEEN 30 AND 1000
          AND p.is_nonident_rep = true
      `),
      
      // 6. Check for duplication in JOINs
      prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*)::INTEGER as total_rows, 
          COUNT(DISTINCT p.id)::INTEGER as unique_proteins,
          COUNT(*) - COUNT(DISTINCT p.id) as duplicate_rows
        FROM pdb_analysis.protein p
        JOIN pdb_analysis.partition_proteins pp ON p.pdb_id = pp.pdb_id AND p.chain_id = pp.chain_id
        JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id  
        JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
        WHERE de.source_id IS NOT NULL 
          AND de.hit_range IS NOT NULL
          AND de.confidence > 0.8
          AND p.length BETWEEN 30 AND 1000
      `),
      
      // 7. Representative status distribution
      prisma.$queryRawUnsafe(`
        SELECT 
          is_nonident_rep,
          COUNT(*)::INTEGER as count
        FROM pdb_analysis.protein
        GROUP BY is_nonident_rep
        ORDER BY is_nonident_rep
      `)
    ])

    return NextResponse.json({
      total_proteins: (diagnostics[0] as any[])[0],
      representative_proteins: (diagnostics[1] as any[])[0],
      partition_proteins: (diagnostics[2] as any[])[0], 
      curable_without_rep_filter: (diagnostics[3] as any[])[0],
      curable_with_rep_filter: (diagnostics[4] as any[])[0],
      join_duplication_check: (diagnostics[5] as any[])[0],
      rep_status_distribution: diagnostics[6]
    })

  } catch (error) {
    console.error('Diagnostic error:', error)
    return NextResponse.json({ 
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
