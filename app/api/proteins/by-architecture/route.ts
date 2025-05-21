// app/api/proteins/by-architecture/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database connection - adjust based on your setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/database',
})

interface DomainData {
  id: string
  domain_number: number
  range: string
  start_position: number
  end_position: number
  confidence: number | null
  t_group: string | null
  h_group: string | null
  x_group: string | null
  a_group: string | null
  evidence_count: number
  evidence_types: string
}

interface ProteinWithDomains {
  protein_id: string
  pdb_id: string
  chain_id: string
  sequence_length: number
  processing_date: string
  best_confidence: number
  avg_confidence: number
  classification_completeness: number
  domains: DomainData[]
}

interface ArchitectureGroup {
  architecture_id: string
  pattern_name: string
  domain_count: number
  t_groups: string[]
  frequency: number
  avg_confidence: number
  classification_completeness: number
  proteins: ProteinWithDomains[]
  pagination?: {
    page: number
    size: number
    total: number
  }
}

interface ArchitectureResponse {
  architectures: ArchitectureGroup[]
  statistics: {
    total_proteins: number
    total_domains: number
    classified_chains: number
    unclassified_chains: number
    avg_domain_coverage: number
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<ArchitectureResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url)

    // Extract filters from query parameters
    const pdbId = searchParams.get('pdb_id')
    const chainId = searchParams.get('chain_id')
    const minConfidence = searchParams.get('min_confidence')
    const maxConfidence = searchParams.get('max_confidence')
    const tGroups = searchParams.get('t_groups')?.split(',').filter(Boolean)
    const hGroups = searchParams.get('h_groups')?.split(',').filter(Boolean)
    const xGroups = searchParams.get('x_groups')?.split(',').filter(Boolean)
    const evidenceTypes = searchParams.get('evidence_types')

    // Build WHERE clause for filters
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (pdbId) {
      whereConditions.push(`p.pdb_id ILIKE $${paramIndex}`)
      queryParams.push(`%${pdbId}%`)
      paramIndex++
    }

    if (chainId) {
      whereConditions.push(`p.chain_id = $${paramIndex}`)
      queryParams.push(chainId)
      paramIndex++
    }

    if (minConfidence) {
      whereConditions.push(`d.confidence >= $${paramIndex}`)
      queryParams.push(parseFloat(minConfidence))
      paramIndex++
    }

    if (maxConfidence) {
      whereConditions.push(`d.confidence <= $${paramIndex}`)
      queryParams.push(parseFloat(maxConfidence))
      paramIndex++
    }

    if (tGroups && tGroups.length > 0) {
      whereConditions.push(`d.t_group = ANY($${paramIndex})`)
      queryParams.push(tGroups)
      paramIndex++
    }

    if (hGroups && hGroups.length > 0) {
      whereConditions.push(`d.h_group = ANY($${paramIndex})`)
      queryParams.push(hGroups)
      paramIndex++
    }

    if (xGroups && xGroups.length > 0) {
      whereConditions.push(`d.x_group = ANY($${paramIndex})`)
      queryParams.push(xGroups)
      paramIndex++
    }

    if (evidenceTypes) {
      whereConditions.push(`d.evidence_types ILIKE $${paramIndex}`)
      queryParams.push(`%${evidenceTypes}%`)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Main query to get architecture-grouped data
    const architectureQuery = `
      WITH protein_architectures AS (
        -- Create architecture signatures for each protein
        SELECT
          p.id as protein_id,
          p.pdb_id,
          p.chain_id,
          p.length as sequence_length,
          p.created_at as processing_date,

          -- Create architecture ID from ordered T-groups
          STRING_AGG(
            COALESCE(d.t_group, 'UNCLASSIFIED'),
            '|'
            ORDER BY d.start_position
          ) as architecture_id,

          -- Count domains
          COUNT(d.id) as domain_count,

          -- Quality metrics
          AVG(COALESCE(d.confidence, 0)) as avg_confidence,
          MAX(COALESCE(d.confidence, 0)) as best_confidence,

          -- Classification completeness
          COUNT(CASE WHEN d.t_group IS NOT NULL THEN 1 END)::float /
          COUNT(d.id)::float as classification_completeness,

          -- Domain details for architecture pattern
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', d.id,
              'domain_number', d.domain_number,
              'range', d.range,
              'start_position', d.start_position,
              'end_position', d.end_position,
              'confidence', d.confidence,
              't_group', d.t_group,
              'h_group', d.h_group,
              'x_group', d.x_group,
              'a_group', d.a_group,
              'evidence_count', d.evidence_count,
              'evidence_types', d.evidence_types
            ) ORDER BY d.start_position
          ) as domains

        FROM pdb_analysis.protein p
        JOIN pdb_analysis.domain d ON p.id = d.protein_id
        ${whereClause}
        GROUP BY p.id, p.pdb_id, p.chain_id, p.length, p.created_at
      ),

      architecture_stats AS (
        -- Calculate architecture frequency and create pattern names
        SELECT
          architecture_id,
          domain_count,
          COUNT(*) as frequency,

          -- Create human-readable pattern names
          CASE
            WHEN domain_count = 1 THEN 'Single domain'
            WHEN domain_count = 2 THEN 'Two-domain protein'
            WHEN domain_count = 3 THEN 'Three-domain protein'
            WHEN domain_count >= 4 THEN 'Complex multi-domain'
            ELSE 'Unknown architecture'
          END as pattern_name,

          -- Get ordered T-groups
          STRING_TO_ARRAY(architecture_id, '|') as t_groups,

          -- Calculate group-level metrics
          AVG(avg_confidence) as group_avg_confidence,
          AVG(classification_completeness) as group_classification_completeness

        FROM protein_architectures
        GROUP BY architecture_id, domain_count
      )

      -- Final result combining architectures with their proteins
      SELECT
        -- Architecture info
        a.architecture_id,
        a.pattern_name,
        a.domain_count,
        a.t_groups,
        a.frequency,
        a.group_avg_confidence,
        a.group_classification_completeness,

        -- Proteins with this architecture (limit for performance)
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'protein_id', p.protein_id,
            'pdb_id', p.pdb_id,
            'chain_id', p.chain_id,
            'sequence_length', p.sequence_length,
            'processing_date', p.processing_date,
            'domains', p.domains,
            'best_confidence', p.best_confidence,
            'avg_confidence', p.avg_confidence,
            'classification_completeness', p.classification_completeness
          ) ORDER BY p.avg_confidence DESC, p.processing_date DESC
          LIMIT 20  -- Limit proteins per architecture group for performance
        ) as proteins

      FROM architecture_stats a
      JOIN protein_architectures p ON a.architecture_id = p.architecture_id
      GROUP BY
        a.architecture_id, a.pattern_name, a.domain_count,
        a.t_groups, a.frequency, a.group_avg_confidence, a.group_classification_completeness
      ORDER BY
        a.frequency DESC,  -- Most common architectures first
        a.domain_count ASC -- Within same frequency, simpler architectures first
      LIMIT 50;  -- Top 50 most common architectures
    `

    // Execute the main query
    const client = await pool.connect()
    const result = await client.query(architectureQuery, queryParams)

    // Transform the results
    const architectures: ArchitectureGroup[] = result.rows.map(row => ({
      architecture_id: row.architecture_id,
      pattern_name: row.pattern_name,
      domain_count: row.domain_count,
      t_groups: row.t_groups,
      frequency: row.frequency,
      avg_confidence: parseFloat(row.group_avg_confidence) || 0,
      classification_completeness: parseFloat(row.group_classification_completeness) || 0,
      proteins: row.proteins.map((protein: any) => ({
        protein_id: protein.protein_id,
        pdb_id: protein.pdb_id,
        chain_id: protein.chain_id,
        sequence_length: protein.sequence_length,
        processing_date: protein.processing_date,
        best_confidence: parseFloat(protein.best_confidence) || 0,
        avg_confidence: parseFloat(protein.avg_confidence) || 0,
        classification_completeness: parseFloat(protein.classification_completeness) || 0,
        domains: protein.domains
      })),
      pagination: {
        page: 1,
        size: 20,
        total: row.frequency
      }
    }))

    // Get summary statistics
    const statsQuery = `
      SELECT
        COUNT(DISTINCT p.id) as total_proteins,
        COUNT(d.id) as total_domains,
        COUNT(DISTINCT CASE WHEN d.t_group IS NOT NULL THEN p.id END) as classified_chains,
        COUNT(DISTINCT CASE WHEN d.t_group IS NULL THEN p.id END) as unclassified_chains,
        AVG(
          CASE
            WHEN p.length > 0
            THEN (d.end_position - d.start_position + 1)::float / p.length::float * 100
            ELSE 0
          END
        ) as avg_domain_coverage
      FROM pdb_analysis.protein p
      JOIN pdb_analysis.domain d ON p.id = d.protein_id
      ${whereClause}
    `

    const statsResult = await client.query(statsQuery, queryParams)
    const stats = statsResult.rows[0]

    client.release()

    const response: ArchitectureResponse = {
      architectures,
      statistics: {
        total_proteins: parseInt(stats.total_proteins) || 0,
        total_domains: parseInt(stats.total_domains) || 0,
        classified_chains: parseInt(stats.classified_chains) || 0,
        unclassified_chains: parseInt(stats.unclassified_chains) || 0,
        avg_domain_coverage: parseFloat(stats.avg_domain_coverage) || 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Architecture API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch architecture data' },
      { status: 500 }
    )
  }
}

// Optional: Add POST method for more complex queries
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    // Handle complex filter objects that might be too large for GET params
    // Implementation similar to GET but using request body filters

    return NextResponse.json({ message: 'POST method for complex filters not yet implemented' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
