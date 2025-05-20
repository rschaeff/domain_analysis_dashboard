import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// Parse range string to get total residues covered
function parseRangeCoverage(range: string): number {
  if (!range) return 0

  // Handle multiple ranges like "1-100,150-200"
  const segments = range.split(',')
  let totalCoverage = 0

  for (const segment of segments) {
    const trimmed = segment.trim()
    const parts = trimmed.split('-')
    if (parts.length === 2) {
      const start = parseInt(parts[0])
      const end = parseInt(parts[1])
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        totalCoverage += (end - start + 1)
      }
    }
  }

  return totalCoverage
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing properties (Next.js 15 requirement)
    const { id } = await params

    let proteinQuery: string
    let queryParams: any[]

    // Check if ID is in source_id format (e.g., "1914_A")
    if (id.includes('_')) {
      const [pdbId, chainId] = id.split('_')

      if (!pdbId || !chainId) {
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 1914_A)' },
          { status: 400 }
        )
      }

      // Query by pdb_id and chain_id
      proteinQuery = `
        SELECT
          p.id,
          p.pdb_id,
          p.chain_id,
          p.source_id,
          p.unp_acc,
          p.name,
          p.type,
          p.tax_id,
          p.length as sequence_length,
          p.created_at,
          p.updated_at
        FROM pdb_analysis.protein p
        WHERE p.pdb_id = $1 AND p.chain_id = $2
      `
      queryParams = [pdbId, chainId]

    } else if (/^\d+$/.test(id)) {
      // Fallback: handle numeric database ID for backward compatibility
      const proteinId = parseInt(id)

      proteinQuery = `
        SELECT
          p.id,
          p.pdb_id,
          p.chain_id,
          p.source_id,
          p.unp_acc,
          p.name,
          p.type,
          p.tax_id,
          p.length as sequence_length,
          p.created_at,
          p.updated_at
        FROM pdb_analysis.protein p
        WHERE p.id = $1
      `
      queryParams = [proteinId]

    } else {
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use either source_id (1914_A) or numeric ID.' },
        { status: 400 }
      )
    }

    const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, ...queryParams)

    if (!proteinResult || (proteinResult as any[]).length === 0) {
      return NextResponse.json(
        { error: `Protein not found: ${id}` },
        { status: 404 }
      )
    }

    const protein = (proteinResult as any[])[0]

    // Ensure source_id is always available for consistency
    if (!protein.source_id) {
      protein.source_id = `${protein.pdb_id}_${protein.chain_id}`
    }

    // Now fetch putative domains for this protein from partition_domain_summary
    // But only use the range field, not start_pos/end_pos
    const putativeDomainsQuery = `
      SELECT
        pds.id,
        pds.protein_id,
        pds.pdb_id,
        pds.chain_id,
        pds.batch_id,
        pds.reference_version,
        pds.timestamp,
        pds.domain_number,
        pds.domain_id,
        pds.range,
        pds.source,
        pds.source_id,
        pds.confidence,
        pds.t_group,
        pds.h_group,
        pds.x_group,
        pds.a_group,
        pds.evidence_count,
        pds.evidence_types
      FROM pdb_analysis.partition_domain_summary pds
      WHERE pds.pdb_id = $1 AND pds.chain_id = $2
      ORDER BY pds.domain_number
    `

    const putativeDomains = await prisma.$queryRawUnsafe(
      putativeDomainsQuery,
      protein.pdb_id,
      protein.chain_id
    )

    // Fetch reference domains used as evidence
    // These come from domain_evidence table pointing to pdb_analysis.domains
    const referenceDomainsQuery = `
      SELECT DISTINCT
        d.id,
        d.ecod_uid,
        d.domain_id,
        d.ecod_domain_id,
        d.range,
        d.t_group,
        d.h_group,
        d.x_group,
        d.a_group,
        de.evidence_type,
        de.confidence,
        de.evalue,
        de.probability
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domain_summary pds ON de.domain_id = pds.id
      JOIN pdb_analysis.domains d ON de.source_id = d.ecod_domain_id
        OR de.hit_id = d.ecod_domain_id
        OR de.domain_ref_id = d.ecod_domain_id
      WHERE pds.pdb_id = $1 AND pds.chain_id = $2
    `

    const referenceDomains = await prisma.$queryRawUnsafe(
      referenceDomainsQuery,
      protein.pdb_id,
      protein.chain_id
    )

    // Calculate domain statistics by parsing ranges
    const putativeDomainsArray = putativeDomains as any[]
    let totalCoverage = 0
    let classifiedDomains = 0
    let domainsWithEvidence = 0

    for (const domain of putativeDomainsArray) {
      // Parse range to calculate coverage
      totalCoverage += parseRangeCoverage(domain.range)

      // Count classified domains
      if (domain.t_group) {
        classifiedDomains++
      }

      // Count domains with evidence
      if (domain.evidence_count > 0) {
        domainsWithEvidence++
      }
    }

    // Calculate coverage percentage
    const coverage = protein.sequence_length > 0 ? totalCoverage / protein.sequence_length : 0

    // Get batch and reference information
    const batchId = putativeDomainsArray.length > 0 ? putativeDomainsArray[0].batch_id : null
    const referenceVersion = putativeDomainsArray.length > 0 ? putativeDomainsArray[0].reference_version : null

    // Construct the enriched protein response
    const enrichedProtein = {
      ...protein,
      // Domain statistics
      domain_count: putativeDomainsArray.length,
      fully_classified_domains: classifiedDomains,
      domains_with_evidence: domainsWithEvidence,
      coverage,
      residues_assigned: totalCoverage,
      is_classified: putativeDomainsArray.length > 0,
      // Batch and reference information
      batch_id: batchId,
      reference_version: referenceVersion,
      // Include both putative and reference domains for detailed analysis
      putative_domains: putativeDomainsArray,
      reference_domains: referenceDomains
    }

    // Serialize the result to handle BigInt values
    const serializedProtein = serializeBigInt(enrichedProtein)

    return NextResponse.json(serializedProtein)

  } catch (error) {
    console.error('Error fetching protein:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
