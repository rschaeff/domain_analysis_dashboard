// app/api/proteins/summary/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '50')))
    const skip = (page - 1) * size

    // Use the working pipeline performance view
    const pipelineQuery = `
      SELECT
        processing_id as id,
        pdb_id,
        chain_id,
        source_id,
        batch_id,
        reference_version,
        processing_date,
        sequence_length,
        is_classified,
        coverage,

        -- Domain statistics (directly from partition system)
        domains_found as domain_count,
        domains_classified,
        domains_unclassified,
        avg_domain_confidence,
        best_domain_confidence,

        -- Evidence statistics
        total_evidence_generated as total_evidence_count,
        chain_blast_evidence > 0 as has_chain_blast,
        domain_blast_evidence > 0 as has_domain_blast,
        hhsearch_evidence > 0 as has_hhsearch,

        -- Pipeline quality
        classification_status,
        evidence_quality,
        days_since_processing

      FROM pdb_analysis.pipeline_performance_summary

      ORDER BY
        processing_date DESC NULLS LAST,
        batch_id DESC NULLS LAST,
        pdb_id, chain_id

      LIMIT $1 OFFSET $2
    `

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pdb_analysis.pipeline_performance_summary
    `

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(pipelineQuery, size, skip),
      prisma.$queryRawUnsafe(countQuery)
    ])

    const total = Number((countResult as any[])[0]?.total || 0)

    // Process results for frontend
    const processedResults = (results as any[]).map(protein => ({
      ...protein,
      // Convert to numbers for consistency
      domain_count: Number(protein.domain_count),
      domains_classified: Number(protein.domains_classified),
      total_evidence_count: Number(protein.total_evidence_count),

      // Add computed fields for UI compatibility
      days_old: Math.floor(Number(protein.days_since_processing || 0)),
      is_recent: Number(protein.days_since_processing || 999) < 7,

      // Confidence level categorization
      confidence_level: protein.best_domain_confidence >= 0.8 ? 'high' :
                       protein.best_domain_confidence >= 0.5 ? 'medium' : 'low',

      // Coverage metrics (from partition system)
      residues_assigned: Math.round((protein.coverage || 0) * (protein.sequence_length || 0)),

      // Data source indicator
      data_source: 'partition_native',
      architecture: 'pipeline_performance_focused'
    }))

    return NextResponse.json({
      data: processedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      metadata: {
        source: 'pipeline_performance_summary',
        robust_against_reclassification: true,
        unified_protein_id_independent: true,
        focus: 'pipeline_performance_and_domain_classification'
      }
    })

  } catch (error) {
    console.error('Error fetching pipeline performance summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline performance summary', details: error.message },
      { status: 500 }
    )
  }
}
