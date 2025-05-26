// app/api/curation/debug/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Test the individual components of the stats query to diagnose the issue
    console.log('🔍 Starting curation debug diagnostics...')

    // 1. Check if there are any curation sessions
    const sessionCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as session_count FROM pdb_analysis.curation_session
    `)
    console.log('📊 Session count:', sessionCount)

    // 2. Check if there are any curation decisions
    const decisionCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as decision_count FROM pdb_analysis.curation_decision
    `)
    console.log('📋 Decision count:', decisionCount)

    // 3. Test the confidence level calculation specifically
    const confidenceTest = await prisma.$queryRawUnsafe(`
      SELECT 
        AVG(cd.confidence_level) as raw_avg,
        COALESCE(AVG(cd.confidence_level), 0) as coalesced_avg,
        COALESCE(AVG(cd.confidence_level), 0)::NUMERIC as numeric_avg,
        COALESCE(AVG(cd.confidence_level), 0)::NUMERIC(5,2) as formatted_numeric,
        COALESCE(ROUND(AVG(cd.confidence_level)::NUMERIC, 2), 0)::FLOAT as final_format
      FROM pdb_analysis.curation_decision cd
      WHERE cd.confidence_level IS NOT NULL
    `)
    console.log('🎯 Confidence level calculation test:', confidenceTest)

    // 4. Test the full stats query structure
    const statsQueryTest = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(DISTINCT cs.id) as total_sessions,
        COUNT(cd.id) as total_decisions,
        AVG(cd.confidence_level) as raw_confidence,
        COALESCE(AVG(cd.confidence_level), 0) as safe_confidence,
        pg_typeof(COALESCE(AVG(cd.confidence_level), 0)) as confidence_type,
        pg_typeof(COALESCE(ROUND(AVG(cd.confidence_level)::NUMERIC, 2), 0)::FLOAT) as final_type
      FROM pdb_analysis.curation_session cs
      LEFT JOIN pdb_analysis.curation_decision cd ON cs.id = cd.session_id
      WHERE cs.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `)
    console.log('🧪 Full stats test:', statsQueryTest)

    // 5. Check table structure
    const tableStructure = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'pdb_analysis' 
        AND table_name = 'curation_decision'
        AND column_name = 'confidence_level'
    `)
    console.log('🏗️ Table structure for confidence_level:', tableStructure)

    // 6. Sample data check
    const sampleData = await prisma.$queryRawUnsafe(`
      SELECT 
        confidence_level,
        pg_typeof(confidence_level) as type
      FROM pdb_analysis.curation_decision 
      WHERE confidence_level IS NOT NULL 
      LIMIT 5
    `)
    console.log('📝 Sample confidence_level data:', sampleData)

    return NextResponse.json({
      debug_info: {
        session_count: sessionCount,
        decision_count: decisionCount,
        confidence_test: confidenceTest,
        stats_query_test: statsQueryTest,
        table_structure: tableStructure,
        sample_data: sampleData
      },
      recommendations: [
        'Check if there are any curation decisions in the database',
        'Verify that confidence_level column has appropriate data type',
        'Ensure PostgreSQL numeric types are being properly serialized',
        'Check for any NULL values in confidence_level column',
        'Verify that the COALESCE and type casting is working correctly'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🚨 Debug API error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}
