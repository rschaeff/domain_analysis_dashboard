// app/api/curation/cleanup/route.ts - IMPROVED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting curation cleanup process...')

    let deletedLocks = 0
    let abandonedSessions = 0
    let cleanupErrors: string[] = []

    // 1. Try to use the stored procedure for lock cleanup
    try {
      const cleanupResult = await prisma.$queryRawUnsafe(`
        SELECT pdb_analysis.cleanup_expired_locks() as deleted_count
      `)
      deletedLocks = (cleanupResult as any[])[0]?.deleted_count || 0
      console.log(`✅ Stored procedure cleaned ${deletedLocks} expired locks`)
    } catch (storedProcError) {
      console.log('⚠️ Stored procedure not available, using manual cleanup...')

      // Fallback: Manual cleanup of expired locks
      try {
        const manualCleanup = await prisma.$queryRawUnsafe(`
          DELETE FROM pdb_analysis.protein_locks
          WHERE expires_at < CURRENT_TIMESTAMP
          RETURNING source_id
        `)
        deletedLocks = (manualCleanup as any[]).length
        console.log(`✅ Manual cleanup removed ${deletedLocks} expired locks`)
      } catch (manualError) {
        cleanupErrors.push(`Lock cleanup failed: ${manualError instanceof Error ? manualError.message : String(manualError)}`)
        console.error('❌ Manual lock cleanup failed:', manualError)
      }
    }

    // 2. Clean up stale sessions (older than 4 hours)
    try {
      const staleSessionsResult = await prisma.$queryRawUnsafe(`
        UPDATE pdb_analysis.curation_session
        SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'in_progress'
          AND updated_at < CURRENT_TIMESTAMP - INTERVAL '4 hours'
        RETURNING id, curator_name, created_at
      `)

      abandonedSessions = (staleSessionsResult as any[]).length

      if (abandonedSessions > 0) {
        console.log(`📋 Abandoned ${abandonedSessions} stale sessions:`,
          (staleSessionsResult as any[]).map(s => ({ id: s.id, curator: s.curator_name }))
        )
      }
    } catch (sessionError) {
      cleanupErrors.push(`Session cleanup failed: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`)
      console.error('❌ Session cleanup failed:', sessionError)
    }

    // 3. Additional cleanup: Remove orphaned locks (locks without valid sessions)
    let orphanedLocks = 0
    try {
      const orphanCleanup = await prisma.$queryRawUnsafe(`
        DELETE FROM pdb_analysis.protein_locks pl
        WHERE pl.session_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM pdb_analysis.curation_session cs
            WHERE cs.id = pl.session_id AND cs.status = 'in_progress'
          )
        RETURNING source_id
      `)
      orphanedLocks = (orphanCleanup as any[]).length

      if (orphanedLocks > 0) {
        console.log(`🔗 Cleaned ${orphanedLocks} orphaned locks`)
      }
    } catch (orphanError) {
      cleanupErrors.push(`Orphaned lock cleanup failed: ${orphanError instanceof Error ? orphanError.message : String(orphanError)}`)
      console.error('❌ Orphaned lock cleanup failed:', orphanError)
    }

    // 4. Optional: Clean up very old auto-save data (older than 30 days)
    let cleanedAutoSave = 0
    try {
      const autoSaveCleanup = await prisma.$queryRawUnsafe(`
        UPDATE pdb_analysis.curation_session
        SET auto_save_data = NULL
        WHERE auto_save_data IS NOT NULL
          AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
          AND status IN ('committed', 'discarded', 'abandoned')
        RETURNING id
      `)
      cleanedAutoSave = (autoSaveCleanup as any[]).length

      if (cleanedAutoSave > 0) {
        console.log(`💾 Cleaned auto-save data from ${cleanedAutoSave} old sessions`)
      }
    } catch (autoSaveError) {
      // This is non-critical, so we just log it
      console.warn('⚠️ Auto-save cleanup warning:', autoSaveError)
    }

    // 5. Get cleanup statistics
    const stats = await getCleanupStats()

    const result = {
      success: true,
      cleanup_summary: {
        deleted_locks: deletedLocks,
        abandoned_sessions: abandonedSessions,
        orphaned_locks_removed: orphanedLocks,
        auto_save_cleaned: cleanedAutoSave,
        errors: cleanupErrors.length,
        error_details: cleanupErrors
      },
      current_stats: stats,
      cleaned_at: new Date().toISOString(),
      next_recommended_cleanup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }

    console.log('🧹 Cleanup completed:', result.cleanup_summary)

    return NextResponse.json(result)

  } catch (error) {
    console.error('🚨 Cleanup process failed:', error)
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : String(error),
      cleaned_at: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper function to get current cleanup statistics
async function getCleanupStats() {
  try {
    const stats = await prisma.$queryRawUnsafe(`
      SELECT
        -- Lock statistics
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.protein_locks) as active_locks,
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.protein_locks WHERE expires_at < CURRENT_TIMESTAMP) as expired_locks,

        -- Session statistics
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session WHERE status = 'in_progress') as active_sessions,
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session WHERE status = 'abandoned') as abandoned_sessions,
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session WHERE status = 'committed') as committed_sessions,

        -- Age statistics
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session
         WHERE status = 'in_progress' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 hour') as stale_sessions_1h,
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session
         WHERE status = 'in_progress' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '4 hours') as stale_sessions_4h,

        -- Auto-save statistics
        (SELECT COUNT(*)::INTEGER FROM pdb_analysis.curation_session WHERE auto_save_data IS NOT NULL) as sessions_with_autosave
    `)

    return (stats as any[])[0]
  } catch (error) {
    console.error('Failed to get cleanup stats:', error)
    return {
      active_locks: 0,
      expired_locks: 0,
      active_sessions: 0,
      abandoned_sessions: 0,
      committed_sessions: 0,
      stale_sessions_1h: 0,
      stale_sessions_4h: 0,
      sessions_with_autosave: 0,
      stats_error: error instanceof Error ? error.message : String(error)
    }
  }
}

// GET endpoint to check cleanup status without actually cleaning
export async function GET(request: NextRequest) {
  try {
    const stats = await getCleanupStats()

    const recommendations = []

    if (stats.expired_locks > 0) {
      recommendations.push(`${stats.expired_locks} expired locks should be cleaned`)
    }

    if (stats.stale_sessions_4h > 0) {
      recommendations.push(`${stats.stale_sessions_4h} sessions are stale (>4h) and should be abandoned`)
    }

    if (stats.stale_sessions_1h > 5) {
      recommendations.push(`${stats.stale_sessions_1h} sessions are getting stale (>1h)`)
    }

    return NextResponse.json({
      current_stats: stats,
      recommendations,
      cleanup_needed: stats.expired_locks > 0 || stats.stale_sessions_4h > 0,
      last_check: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cleanup status check failed:', error)
    return NextResponse.json({
      error: 'Failed to check cleanup status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
