// app/api/batches/route.ts
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const batches = await prisma.$queryRawUnsafe(`
      SELECT 
        b.id,
        b.batch_name,
        b.type as batch_type,
        b.total_items,
        b.completed_items,
        b.status,
        b.ref_version,
        b.created_at,
        b.completed_at,
        
        -- Get actual protein count from process_status
        COUNT(ps.id) as actual_protein_count,
        
        -- Get partition results count
        COUNT(pp.id) as partition_count
        
      FROM ecod_schema.batch b
      LEFT JOIN ecod_schema.process_status ps ON b.id = ps.batch_id
      LEFT JOIN ecod_schema.protein ep ON ps.protein_id = ep.id
      LEFT JOIN pdb_analysis.partition_proteins pp ON ep.source_id = pp.pdb_id || '_' || pp.chain_id
      WHERE b.type IN ('pdb_hhsearch', 'domain_analysis')
      GROUP BY b.id, b.batch_name, b.type, b.total_items, b.completed_items, 
               b.status, b.ref_version, b.created_at, b.completed_at
      ORDER BY b.id DESC
    `)

    return NextResponse.json({ batches })
  } catch (error) {
    console.error('Batches API error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch batches',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
