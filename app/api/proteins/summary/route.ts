// app/api/proteins/summary/route.ts (Updated for deposition date sorting)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '50')))
    const skip = (page - 1) * size

    // Parse sort parameter (default to newest depositions first)
    const sort = searchParams.get('sort') || 'deposition'
    const sortDirection = searchParams.get('sort_dir') || 'desc'

    // Build filters
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (searchParams.get('pdb_id')) {
      whereConditions.push(`pse.pdb_id ILIKE $${paramIndex}`)
      queryParams.push(`%${searchParams.get('pdb_id')}%`)
      paramIndex++
    }

    if (searchParams.get('batch_id')) {
      whereConditions.push(`pse.batch_id = $${paramIndex}`)
      queryParams.push(parseInt(searchParams.get('batch_id')!))
      paramIndex++
    }

    if (searchParams.get('is_classified')) {
      whereConditions.push(`pse.is_classified = $${paramIndex}`)
      queryParams.push(searchParams.get('is_classified') === 'true')
      paramIndex++
    }

    if (searchParams.get('method')) {
      whereConditions.push(`pse.experimental_method ILIKE $${paramIndex}`)
      queryParams.push(`%${searchParams.get('method')}%`)
      paramIndex++
    }

    if (searchParams.get('min_resolution')) {
      whereConditions.push(`pse.resolution >= $${paramIndex}`)
      queryParams.push(parseFloat(searchParams.get('min_resolution')!))
      paramIndex++
    }

    if (searchParams.get('max_resolution')) {
      whereConditions.push(`pse.resolution <= $${paramIndex}`)
      queryParams.push(parseFloat(searchParams.get('max_resolution')!))
      paramIndex++
    }

    if (searchParams.get('structure_age')) {
      whereConditions.push(`pse.structure_age_category = $${paramIndex}`)
      queryParams.push(searchParams.get('structure_age'))
      paramIndex++
    }

    // Add classification filter support
    if (searchParams.get('t_groups')) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM pdb_analysis.partition_domains pd
        WHERE pd.protein_id = pse.id AND pd.t_group = ANY($${paramIndex})
      )`)
      queryParams.push(searchParams.get('t_groups')!.split(','))
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

    // Build ORDER BY clause optimized for deposition dates
    let orderByClause = ''
    switch (sort) {
      case 'deposition':
      case 'pdb_release':  // Keep this alias for compatibility
        orderByClause = 'ORDER BY pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id'
        break
      case 'publication_year':
        orderByClause = 'ORDER BY pse.publication_year DESC NULLS LAST, pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id'
        break
      case 'resolution':
        orderByClause = `ORDER BY pse.resolution ${sortDirection.toUpperCase()} NULLS LAST, pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id`
        break
      case 'analysis_recent':
        orderByClause = 'ORDER BY pse.analysis_timestamp DESC NULLS LAST, pse.batch_id DESC NULLS LAST, pse.pdb_id, pse.chain_id'
        break
      case 'batch':
        orderByClause = 'ORDER BY pse.batch_id DESC NULLS LAST, pse.analysis_timestamp DESC NULLS LAST, pse.pdb_id, pse.chain_id'
        break
      case 'confidence':
        orderByClause = `ORDER BY pse.best_confidence ${sortDirection.toUpperCase()} NULLS LAST, pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id`
        break
      case 'coverage':
        orderByClause = `ORDER BY pse.coverage ${sortDirection.toUpperCase()} NULLS LAST, pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id`
        break
      case 'domains':
        orderByClause = `ORDER BY pse.domain_count ${sortDirection.toUpperCase()}, pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id`
        break
      case 'alphabetic':
        orderByClause = 'ORDER BY pse.pdb_id, pse.chain_id'
        break
      default:
        // Default to newest depositions first
        orderByClause = 'ORDER BY pse.deposition_date DESC NULLS LAST, pse.pdb_id, pse.chain_id'
    }

    const proteinSummaryQuery = `
      SELECT
        pse.id,
        pse.pdb_id,
        pse.chain_id,
        pse.source_id,
        pse.sequence_length,
        pse.batch_id,
        pse.reference_version,
        pse.is_classified,
        pse.coverage,

        -- PDB Metadata
        pse.structure_title,
        pse.experimental_method,
        pse.resolution,
        pse.r_factor,
        pse.deposition_date,
        pse.release_date,
        pse.revision_date,
        pse.organism,
        pse.structure_age_category,
        pse.structure_quality_category,
        pse.is_very_recent_structure,
        pse.is_new_structure,

        -- Citation info
        pse.pmid,
        pse.doi,
        pse.paper_title,
        pse.journal,
        pse.publication_year,

        -- Analysis results
        pse.domain_count,
        pse.classified_domains,
        pse.avg_confidence,
        pse.best_confidence,
        pse.total_evidence_count,
        pse.evidence_types,
        pse.has_chain_blast,
        pse.has_domain_blast,
        pse.has_hhsearch,

        -- Temporal information
        pse.analysis_timestamp,
        pse.days_since_deposition,
        pse.days_since_release,

        -- Quality indicators
        CASE
          WHEN pse.domain_count = 0 THEN 'unprocessed'
          WHEN pse.classified_domains = pse.domain_count THEN 'fully_classified'
          WHEN pse.classified_domains > 0 THEN 'partially_classified'
          ELSE 'unclassified'
        END as classification_status

      FROM pdb_analysis.protein_summary_enhanced pse
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pdb_analysis.protein_summary_enhanced pse
      ${whereClause}
    `

    const [results, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(proteinSummaryQuery, ...queryParams, size, skip),
      prisma.$queryRawUnsafe(countQuery, ...queryParams.slice(0, whereConditions.length))
    ])

    const total = Number((countResult as any[])[0]?.total || 0)

    // Convert BigInt to Number for serialization and add helpful metadata
    const serializedResults = (results as any[]).map(row => ({
      ...row,
      domain_count: Number(row.domain_count),
      classified_domains: Number(row.classified_domains),
      total_evidence_count: Number(row.total_evidence_count),
      // Add computed fields for UI
      classification_completeness: row.domain_count > 0 ? Number(row.classified_domains) / Number(row.domain_count) : 0,
      days_since_deposition: Math.floor(Number(row.days_since_deposition || 0)),
      days_since_release: Math.floor(Number(row.days_since_release || 0)),
      confidence_level: row.best_confidence >= 0.8 ? 'high' : row.best_confidence >= 0.5 ? 'medium' : 'low',
      // PDB age display based on deposition
      pdb_age_display: formatPDBAge(row.deposition_date),
      publication_age_display: formatPublicationAge(row.publication_year),
      // Quality display
      method_display: formatExperimentalMethod(row.experimental_method),
      resolution_display: formatResolution(row.resolution, row.experimental_method)
    }))

    // Add sorting metadata to response
    const sortingInfo = {
      current_sort: sort,
      sort_direction: sortDirection,
      available_sorts: [
        { key: 'deposition', label: 'PDB Deposition', description: 'Newest deposited structures first', icon: '🆕' },
        { key: 'publication_year', label: 'Publication Year', description: 'Recently published papers first', icon: '📄' },
        { key: 'resolution', label: 'Resolution', description: 'Best resolution first', icon: '🔬' },
        { key: 'analysis_recent', label: 'Analysis Date', description: 'Recently analyzed proteins first', icon: '🕒' },
        { key: 'batch', label: 'Latest Batch', description: 'Newest analysis batches first', icon: '📦' },
        { key: 'confidence', label: 'Best Confidence', description: 'Highest confidence first', icon: '⭐' },
        { key: 'coverage', label: 'Coverage', description: 'Best domain coverage first', icon: '📊' },
        { key: 'domains', label: 'Domain Count', description: 'Most domains first', icon: '🧬' },
        { key: 'alphabetic', label: 'Alphabetic', description: 'PDB ID alphabetically', icon: '🔤' }
      ]
    }

    // Enhanced statistics
    const enhancedStats = calculateEnhancedStatistics(serializedResults)

    return NextResponse.json({
      data: serializedResults,
      pagination: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size)
      },
      sorting: sortingInfo,
      statistics: {
        total_proteins: total,
        new_structures: serializedResults.filter(p => p.is_new_structure).length,
        very_recent_structures: serializedResults.filter(p => p.is_very_recent_structure).length,
        recent_analysis: serializedResults.filter(p => p.is_very_recent_analysis).length,
        ...enhancedStats
      }
    })

  } catch (error) {
    console.error('Error fetching protein summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch protein summary', details: error.message },
      { status: 500 }
    )
  }
}

// Helper functions (same as before)
function formatPDBAge(depositionDate: string | null): string {
  if (!depositionDate) return 'Unknown'

  const date = new Date(depositionDate)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 30) return `${diffDays} days ago`
  if (diffDays <= 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatPublicationAge(year: number | null): string {
  if (!year) return 'No citation'

  const currentYear = new Date().getFullYear()
  const age = currentYear - year

  if (age === 0) return 'This year'
  if (age === 1) return 'Last year'
  return `${age} years ago`
}

function formatExperimentalMethod(method: string | null): string {
  if (!method) return 'Unknown'

  const cleanMethod = method.toLowerCase()
  if (cleanMethod.includes('x-ray')) return 'X-ray'
  if (cleanMethod.includes('nmr')) return 'NMR'
  if (cleanMethod.includes('cryo') || cleanMethod.includes('em') || cleanMethod.includes('electron')) return 'Cryo-EM'
  if (cleanMethod.includes('neutron')) return 'Neutron'

  return method
}

function formatResolution(resolution: number | null, method: string | null): string {
  if (!resolution) return 'N/A'

  const methodDisplay = formatExperimentalMethod(method)

  if (methodDisplay === 'X-ray' || methodDisplay === 'Neutron') {
    if (resolution <= 1.5) return `${resolution.toFixed(2)}Å (Ultra-high)`
    if (resolution <= 2.0) return `${resolution.toFixed(2)}Å (High)`
    if (resolution <= 3.0) return `${resolution.toFixed(2)}Å (Medium)`
    return `${resolution.toFixed(2)}Å (Low)`
  }

  if (methodDisplay === 'Cryo-EM') {
    if (resolution <= 2.0) return `${resolution.toFixed(2)}Å (Excellent)`
    if (resolution <= 3.0) return `${resolution.toFixed(2)}Å (Good)`
    if (resolution <= 4.0) return `${resolution.toFixed(2)}Å (Moderate)`
    return `${resolution.toFixed(2)}Å (Low)`
  }

  return `${resolution.toFixed(2)}Å`
}

function calculateEnhancedStatistics(proteins: any[]) {
  const methodCounts = {}
  const ageCategories = {}
  let totalResolution = 0
  let resolutionCount = 0
  let withCitations = 0

  proteins.forEach(protein => {
    // Method distribution
    const method = formatExperimentalMethod(protein.experimental_method)
    methodCounts[method] = (methodCounts[method] || 0) + 1

    // Age categories
    const age = protein.structure_age_category || 'unknown'
    ageCategories[age] = (ageCategories[age] || 0) + 1

    // Resolution statistics
    if (protein.resolution) {
      totalResolution += protein.resolution
      resolutionCount++
    }

    // Citation statistics
    if (protein.pmid) {
      withCitations++
    }
  })

  return {
    method_distribution: methodCounts,
    age_distribution: ageCategories,
    avg_resolution: resolutionCount > 0 ? (totalResolution / resolutionCount).toFixed(2) : null,
    with_citations: withCitations,
    citation_percentage: proteins.length > 0 ? Math.round((withCitations / proteins.length) * 100) : 0
  }
}
