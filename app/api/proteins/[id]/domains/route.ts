// app/api/proteins/[id]/domains/route.ts - DEBUG VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return Number(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber)
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value)
    }
    return converted
  }

  return obj
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)

    console.log('🔍 API Debug - Request details:', {
      id,
      searchParams: Object.fromEntries(searchParams.entries()),
      url: request.url
    })

    const batchId = searchParams.get('batch_id')
    const includeBatchInfo = searchParams.get('include_batch_info') !== 'false'

    let pdbId: string
    let chainId: string

    // Parse source_id format
    if (id.includes('_')) {
      const parts = id.split('_')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.error('❌ Invalid source ID format:', id)
        return NextResponse.json(
          { error: 'Invalid source ID format. Expected format: PDB_CHAIN (e.g., 5c3l_B)' },
          { status: 400 }
        )
      }
      pdbId = parts[0]
      chainId = parts[1]
    } else {
      console.error('❌ Invalid protein ID format:', id)
      return NextResponse.json(
        { error: 'Invalid protein ID format. Use source_id format (5c3l_B).' },
        { status: 400 }
      )
    }

    console.log('✅ Parsed IDs:', { pdbId, chainId, batchId })

    // Step 1: Test database connection
    try {
      console.log('🔗 Testing database connection...')
      await prisma.$queryRaw`SELECT 1 as test`
      console.log('✅ Database connection successful')
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError)
      return NextResponse.json(
        { error: 'Database connection failed', details: String(dbError) },
        { status: 500 }
      )
    }

    // Step 2: Check if tables exist
    try {
      console.log('🗃️ Checking table existence...')
      const tableCheck = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'pdb_analysis'
        AND table_name IN ('partition_proteins', 'partition_domains', 'domain_evidence')
      `
      console.log('📋 Available tables:', tableCheck)
    } catch (tableError) {
      console.error('❌ Table check failed:', tableError)
      return NextResponse.json(
        { error: 'Database schema check failed', details: String(tableError) },
        { status: 500 }
      )
    }

    // Step 3: Check for batch info (simplified first)
    let batchInfo: any = null
    if (includeBatchInfo) {
      try {
        console.log('🔍 Checking batch information...')
        const batchCheckQuery = `
          SELECT
            COUNT(DISTINCT pp.batch_id) as batch_count,
            array_agg(DISTINCT pp.batch_id ORDER BY pp.batch_id DESC) as batch_ids,
            array_agg(DISTINCT b.batch_name ORDER BY pp.batch_id DESC) as batch_names,
            array_agg(DISTINCT b.type ORDER BY pp.batch_id DESC) as batch_types
          FROM pdb_analysis.partition_proteins pp
          LEFT JOIN ecod_schema.batch b ON pp.batch_id = b.id
          WHERE pp.pdb_id = $1 AND pp.chain_id = $2
        `
        console.log('🗃️ Batch query SQL:', { query: batchCheckQuery, params: [pdbId, chainId] })

        const batchCheckResult = await prisma.$queryRawUnsafe(batchCheckQuery, pdbId, chainId)
        batchInfo = convertBigIntToNumber(batchCheckResult)[0]
        console.log('📊 Batch info result:', batchInfo)
      } catch (batchError) {
        console.error('❌ Batch check failed:', batchError)
        // Continue without batch info rather than failing completely
        console.log('⚠️ Continuing without batch info...')
      }
    }

    // Step 4: Get protein information
    let protein: any = null
    try {
      console.log('🧬 Fetching protein information...')
      const proteinQuery = `
        SELECT
          CAST(pp.id AS INTEGER) as processing_id,
          pp.pdb_id,
          pp.chain_id,
          pp.pdb_id || '_' || pp.chain_id as source_id,
          CAST(pp.batch_id AS INTEGER) as batch_id,
          pp.reference_version,
          pp.timestamp as processing_date,
          CAST(pp.sequence_length AS INTEGER) as sequence_length,
          pp.is_classified,
          pp.coverage,
          b.batch_name,
          b.type as batch_type,
          b.status as batch_status
        FROM pdb_analysis.partition_proteins pp
        LEFT JOIN ecod_schema.batch b ON pp.batch_id = b.id
        WHERE pp.pdb_id = $1 AND pp.chain_id = $2
        ${batchId ? 'AND pp.batch_id = $3' : ''}
        ORDER BY pp.timestamp DESC
        LIMIT 1
      `

      const queryParams = batchId ? [pdbId, chainId, parseInt(batchId)] : [pdbId, chainId]
      console.log('🗃️ Protein query SQL:', { query: proteinQuery, params: queryParams })

      const proteinResult = await prisma.$queryRawUnsafe(proteinQuery, ...queryParams)
      const serializedProteinResult = convertBigIntToNumber(proteinResult)
      console.log('📊 Protein query result:', serializedProteinResult)

      if (!serializedProteinResult || serializedProteinResult.length === 0) {
        console.log('❌ No protein found')
        return NextResponse.json(
          {
            error: batchId
              ? `Protein not found in batch ${batchId}: ${id}`
              : `Protein not found in pipeline: ${id}`
          },
          { status: 404 }
        )
      }

      protein = serializedProteinResult[0]
      console.log('✅ Protein found:', { processing_id: protein.processing_id, source_id: protein.source_id })
    } catch (proteinError) {
      console.error('❌ Protein query failed:', proteinError)
      return NextResponse.json(
        { error: 'Failed to fetch protein', details: String(proteinError) },
        { status: 500 }
      )
    }

    // Step 5: Get domains
    let domains: any[] = []
    try {
      console.log('🔬 Fetching domains...')
      const domainsQuery = `
        SELECT
          CAST(pd.id AS INTEGER) as id,
          CAST(pd.protein_id AS INTEGER) as protein_id,
          CAST(pd.domain_number AS INTEGER) as domain_number,
          pd.domain_id,
          CAST(pd.start_pos AS INTEGER) as start_pos,
          CAST(pd.end_pos AS INTEGER) as end_pos,
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
          pd.is_manual_rep,
          pd.is_f70,
          pd.is_f40,
          pd.is_f99,
          CAST(pd.length AS INTEGER) as length,
          'putative' as domain_type
        FROM pdb_analysis.partition_domains pd
        LEFT JOIN pdb_analysis.t_classification tc ON pd.t_group = tc.t_id
        LEFT JOIN pdb_analysis.h_classification hc ON pd.h_group = hc.h_id
        LEFT JOIN pdb_analysis.x_classification xc ON pd.x_group = xc.x_id
        WHERE pd.protein_id = $1
        ORDER BY pd.domain_number
      `

      console.log('🗃️ Domains query SQL:', { query: domainsQuery, params: [protein.processing_id] })

      const domainsResult = await prisma.$queryRawUnsafe(domainsQuery, protein.processing_id)
      domains = convertBigIntToNumber(domainsResult)
      console.log('📊 Domains found:', domains.length)
    } catch (domainsError) {
      console.error('❌ Domains query failed:', domainsError)
      return NextResponse.json(
        { error: 'Failed to fetch domains', details: String(domainsError) },
        { status: 500 }
      )
    }

    // Step 6: Get evidence
    let evidence: any[] = []
    try {
      console.log('🔍 Fetching evidence...')
      const evidenceQuery = `
        SELECT
          CAST(de.domain_id AS INTEGER) as domain_id,
          de.evidence_type,
          de.source_id,
          de.domain_ref_id,
          de.hit_id,
          de.pdb_id,
          de.chain_id,
          de.confidence,
          de.probability,
          de.evalue,
          de.score,
          CAST(de.hsp_count AS INTEGER) as hsp_count,
          de.is_discontinuous,
          de.t_group as ref_t_group,
          tc_ref.name as ref_t_group_name,
          de.h_group as ref_h_group,
          hc_ref.name as ref_h_group_name,
          de.x_group as ref_x_group,
          xc_ref.name as ref_x_group_name,
          de.a_group as ref_a_group,
          de.query_range,
          de.hit_range,
          CAST(COUNT(*) OVER (PARTITION BY de.domain_id) AS INTEGER) as domain_evidence_count
        FROM pdb_analysis.domain_evidence de
        JOIN pdb_analysis.partition_domains pd ON de.domain_id = pd.id
        LEFT JOIN pdb_analysis.t_classification tc_ref ON de.t_group = tc_ref.t_id
        LEFT JOIN pdb_analysis.h_classification hc_ref ON de.h_group = hc_ref.h_id
        LEFT JOIN pdb_analysis.x_classification xc_ref ON de.x_group = xc_ref.x_id
        WHERE pd.protein_id = $1
        ORDER BY de.domain_id, de.confidence DESC
      `

      console.log('🗃️ Evidence query SQL:', { query: evidenceQuery, params: [protein.processing_id] })

      const evidenceResult = await prisma.$queryRawUnsafe(evidenceQuery, protein.processing_id)
      evidence = convertBigIntToNumber(evidenceResult)
      console.log('📊 Evidence found:', evidence.length)
    } catch (evidenceError) {
      console.error('❌ Evidence query failed:', evidenceError)
      return NextResponse.json(
        { error: 'Failed to fetch evidence', details: String(evidenceError) },
        { status: 500 }
      )
    }

    // Group evidence by domain
    const evidenceByDomain = evidence.reduce((acc: any, ev: any) => {
      if (!acc[ev.domain_id]) acc[ev.domain_id] = []
      acc[ev.domain_id].push(ev)
      return acc
    }, {})

    // Process domains with evidence
    const processedDomains = domains.map((domain: any) => ({
      ...domain,
      evidence: evidenceByDomain[domain.id] || [],
      evidence_count: (evidenceByDomain[domain.id] || []).length
    }))

    console.log('✅ Processing complete:', {
      protein_id: protein.processing_id,
      domains_count: processedDomains.length,
      total_evidence: evidence.length
    })

    const response = {
      protein: {
        ...protein,
        domain_count: processedDomains.length,
        total_evidence_items: evidence.length
      },
      domains: processedDomains,
      metadata: {
        source: 'partition_domains_direct',
        data_architecture: 'pipeline_native',
        total_domains: processedDomains.length,
        total_evidence_items: evidence.length,
        bigint_serialized: true,
        includes_classification_names: true,
        batch_id: protein.batch_id,
        batch_name: protein.batch_name,
        batch_type: protein.batch_type,
        reference_version: protein.reference_version,
        processing_date: protein.processing_date,
        debug_info: {
          parsed_ids: { pdbId, chainId },
          batch_info: batchInfo,
          query_steps_completed: ['connection', 'tables', 'batch', 'protein', 'domains', 'evidence']
        }
      }
    }

    const finalResponse = convertBigIntToNumber(response)
    console.log('🎉 API Success - Response ready')

    return NextResponse.json(finalResponse)

  } catch (error) {
    console.error('❌ Unhandled API Error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch partition domains',
        details: error instanceof Error ? error.message : String(error),
        debug_info: {
          error_type: error?.constructor?.name || 'Unknown',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}
