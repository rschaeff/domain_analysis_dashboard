// Parse range string that may include chain prefixes like "A:1-100,A:150-200" or "B:539-716"
function parseRangeCoverage(range: string): number {
  if (!range) return 0

  // Handle multiple ranges like "A:1-129,A:157-514" or simple ranges like "A:25-111"
  const segments = range.split(',')
  let totalCoverage = 0

  for (const segment of segments) {
    const trimmed = segment.trim()

    // Remove chain prefix if present (e.g., "A:1-100" -> "1-100")
    const withoutChain = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed

    const parts = withoutChain.split('-')
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

// Parse range string to get start and end positions (for display purposes)
function parseRange(range: string): { start: number; end: number; segments: Array<{start: number; end: number}> } | null {
  if (!range) return null

  const segments: Array<{start: number; end: number}> = []
  let minStart = Infinity
  let maxEnd = -Infinity

  // Handle multiple ranges like "A:1-129,A:157-514"
  const rangeParts = range.split(',')

  for (const segment of rangeParts) {
    const trimmed = segment.trim()

    // Remove chain prefix if present (e.g., "A:1-100" -> "1-100")
    const withoutChain = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed

    const parts = withoutChain.split('-')
    if (parts.length === 2) {
      const start = parseInt(parts[0])
      const end = parseInt(parts[1])
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        segments.push({ start, end })
        minStart = Math.min(minStart, start)
        maxEnd = Math.max(maxEnd, end)
      }
    }
  }

  if (segments.length === 0) return null

  return {
    start: minStart,
    end: maxEnd,
    segments
  }
}

// Updated protein API with proper range parsing
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

// Custom JSON serializer to handle BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // Ensure source_id is always available
    if (!protein.source_id) {
      protein.source_id = `${protein.pdb_id}_${protein.chain_id}`
    }

    // Fetch putative domains from partition_domain_summary
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
        pds.evidence_types,
        'putative' as domain_type
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
    // These come from the pdb_analysis.domain table (ECOD reference domains)
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
        d.is_manual_rep,
        d.is_f70,
        d.is_f40,
        d.is_f99,
        d.length,
        de.evidence_type,
        de.confidence as evidence_confidence,
        de.evalue,
        de.probability,
        de.query_range,
        de.hit_range,
        'reference' as domain_type
      FROM pdb_analysis.domain_evidence de
      JOIN pdb_analysis.partition_domain_summary pds ON de.domain_id = pds.id
      JOIN pdb_analysis.domain d ON (
        de.source_id = d.ecod_domain_id OR
        de.hit_id = d.ecod_domain_id OR
        de.domain_ref_id = d.ecod_domain_id
      )
      WHERE pds.pdb_id = $1 AND pds.chain_id = $2
      ORDER BY de.confidence DESC, d.ecod_domain_id
    `

    const referenceDomains = await prisma.$queryRawUnsafe(
      referenceDomainsQuery,
      protein.pdb_id,
      protein.chain_id
    )

    // Calculate domain statistics by parsing ranges (handling chain prefixes)
    const putativeDomainsArray = putativeDomains as any[]
    let totalCoverage = 0
    let classifiedDomains = 0
    let domainsWithEvidence = 0

    for (const domain of putativeDomainsArray) {
      // Parse range to calculate coverage (handles chain prefixes)
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

    // Process domains to add parsed range information
    const processedPutativeDomains = putativeDomainsArray.map(domain => {
      const parsedRange = parseRange(domain.range)
      return {
        ...domain,
        start_pos: parsedRange?.start || null,
        end_pos: parsedRange?.end || null,
        segments: parsedRange?.segments || []
      }
    })

    const processedReferenceDomains = (referenceDomains as any[]).map(domain => {
      const parsedRange = parseRange(domain.range)
      return {
        ...domain,
        start_pos: parsedRange?.start || null,
        end_pos: parsedRange?.end || null,
        segments: parsedRange?.segments || []
      }
    })

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
      // Include both putative and reference domains
      putative_domains: processedPutativeDomains,
      reference_domains: processedReferenceDomains,
      // Combined domains for easier frontend processing
      all_domains: [
        ...processedPutativeDomains,
        ...processedReferenceDomains
      ]
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
