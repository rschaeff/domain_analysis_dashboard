// app/api/proteins/[id]/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

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

const putativeDomainsQuery = `
  SELECT
    pd.id,
    pd.protein_id,
    pp.pdb_id,
    pp.chain_id,
    pp.batch_id,
    pp.reference_version,
    pp.timestamp,
    pd.domain_number,
    pd.domain_id,
    pd.start_pos,
    pd.end_pos,
    pd.range,
    pd.pdb_range,
    pd.pdb_start,
    pd.pdb_end,
    pd.source,
    pd.source_id,
    pd.confidence,
    pd.t_group,
    tc.name as t_group_name,
    pd.h_group,
    hc.name as h_group_name,
    pd.x_group,
    xc.name as x_group_name,
    pd.a_group,
    -- Calculate evidence stats
    COUNT(de.id) as evidence_count,
    COUNT(DISTINCT de.evidence_type) as evidence_types,
    'putative' as domain_type
  FROM pdb_analysis.partition_proteins pp
  LEFT JOIN pdb_analysis.partition_domains pd ON pp.id = pd.protein_id
  LEFT JOIN pdb_analysis.domain_evidence de ON pd.id = de.domain_id
  LEFT JOIN pdb_analysis.t_classification tc ON pd.t_group = tc.t_id
  LEFT JOIN pdb_analysis.h_classification hc ON pd.h_group = hc.h_id
  LEFT JOIN pdb_analysis.x_classification xc ON pd.x_group = xc.x_id
  WHERE pp.pdb_id = $1 AND pp.chain_id = $2
    AND pp.process_version IN ('mini_pyecod_1.0', 'mini_pyecod_propagated_1.0')  -- ADD THIS
  GROUP BY pd.id, pd.protein_id, pp.pdb_id, pp.chain_id, pp.batch_id,
           pp.reference_version, pp.timestamp, pd.domain_number, pd.domain_id,
           pd.start_pos, pd.end_pos, pd.range, pd.pdb_range, pd.pdb_start,
           pd.pdb_end, pd.source, pd.source_id, pd.confidence, pd.t_group,
           tc.name, pd.h_group, hc.name, pd.x_group, xc.name, pd.a_group
  ORDER BY pd.domain_number`

const putativeDomains = await prisma.$queryRawUnsafe(
  putativeDomainsQuery,
  protein.pdb_id,
  protein.chain_id
)

console.log(`[PROTEIN API] Found ${(putativeDomains as any[]).length} putative domains for ${protein.pdb_id}_${protein.chain_id}`)

// Log PDB range data
if ((putativeDomains as any[]).length > 0) {
  const firstDomain = (putativeDomains as any[])[0]
  console.log(`[PROTEIN API] First domain PDB ranges:`, {
    id: firstDomain.id,
    domain_id: firstDomain.domain_id,
    sequence_range: firstDomain.range,
    pdb_range: firstDomain.pdb_range,
    start_pos: firstDomain.start_pos,
    end_pos: firstDomain.end_pos
  })
}
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
        'reference' as domain_type
      FROM pdb_analysis.domain d
      JOIN pdb_analysis.protein p2 ON d.protein_id = p2.id
      WHERE p2.pdb_id = $1 AND p2.chain_id = $2
      ORDER BY d.ecod_domain_id
      LIMIT 10
    `

    const referenceDomains = await prisma.$queryRawUnsafe(
      referenceDomainsQuery,
      protein.pdb_id,
      protein.chain_id
    )

    console.log(`[PROTEIN API] Found ${(referenceDomains as any[]).length} reference domains for ${protein.pdb_id}_${protein.chain_id}`)

    // Calculate domain statistics by parsing ranges (handling chain prefixes)
    const putativeDomainsArray = putativeDomains as any[]
    let totalCoverage = 0
    let classifiedDomains = 0
    let domainsWithEvidence = 0

    console.log(`[PROTEIN API] putativeDomainsArray length: ${putativeDomainsArray.length}`)

    for (const domain of putativeDomainsArray) {
      // Parse range to calculate coverage (handles chain prefixes)
      totalCoverage += parseRangeCoverage(domain.range)

      // Count classified domains
      if (domain.t_group) {
        classifiedDomains++
      }

      // Count domains with evidence (domains from partition_domains always have evidence)
      domainsWithEvidence++
    }

    // Calculate coverage percentage
    const coverage = protein.sequence_length > 0 ? totalCoverage / protein.sequence_length : 0

    // Get batch and reference information from partition_proteins table
    const partitionInfoQuery = `
      SELECT batch_id, reference_version
      FROM pdb_analysis.partition_proteins
      WHERE pdb_id = $1 AND chain_id = $2
      LIMIT 1
    `

    const partitionInfo = await prisma.$queryRawUnsafe(
      partitionInfoQuery,
      protein.pdb_id,
      protein.chain_id
    )

    const batchId = (partitionInfo as any[])[0]?.batch_id || null
    const referenceVersion = (partitionInfo as any[])[0]?.reference_version || null

    // Process domains to add parsed range information
    const processedPutativeDomains = putativeDomainsArray.map(domain => {
      const parsedRange = parseRange(domain.range)
      return {
        ...domain,
        // Keep both the original fields and add parsed ones for compatibility
        start: domain.start_pos,
        end: domain.end_pos,
        start_pos: parsedRange?.start || domain.start_pos,
        end_pos: parsedRange?.end || domain.end_pos,
        segments: parsedRange?.segments || []
      }
    })

    console.log(`[PROTEIN API] processedPutativeDomains length: ${processedPutativeDomains.length}`)

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

    console.log(`[PROTEIN API] Final enrichedProtein.domain_count: ${enrichedProtein.domain_count}`)
    console.log(`[PROTEIN API] Final enrichedProtein.putative_domains.length: ${enrichedProtein.putative_domains?.length}`)
    console.log(`[PROTEIN API] Final enrichedProtein.all_domains.length: ${enrichedProtein.all_domains?.length}`)

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
