// app/api/curation/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Clean up expired locks
    const cleanupResult = await prisma.$queryRawUnsafe(`
      SELECT pdb_analysis.cleanup_expired_locks() as deleted_count
    `)
    
    const deletedCount = (cleanupResult as any[])[0]?.deleted_count || 0
    
    // Also clean up any stale sessions
    const staleSessionsResult = await prisma.$queryRawUnsafe(`
      UPDATE pdb_analysis.curation_session 
      SET status = 'abandoned'
      WHERE status = 'in_progress' 
        AND updated_at < CURRENT_TIMESTAMP - INTERVAL '4 hours'
      RETURNING id
    `)
    
    const abandonedSessions = (staleSessionsResult as any[]).length
    
    return NextResponse.json({ 
      success: true, 
      deleted_locks: deletedCount,
      abandoned_sessions: abandonedSessions,
      cleaned_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

