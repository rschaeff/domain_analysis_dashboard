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
    // Await params before accessing properties (Next.js 15 requirement)
    const { id } = await params
    const domainId = parseInt(id)

    if (isNaN(domainId)) {
      return NextResponse.json(
        { error: 'Invalid domain ID' },
        { status: 400 }
      )
    }

    // Query the updated view with all required fields
    const domainQuery = `
      SELECT
        id,
        protein_id,
        pdb_id,
        chain_id,
        batch_id,
        reference_version,
        timestamp,
        domain_number,
        domain_id,
        start_pos,
        end_pos,
        range,
        source,
        source_id,
        confidence,
        t_group,
        h_group,
        x_group,
        a_group,
        evidence_count,
        evidence_types
      FROM pdb_analysis.partition_domain_summary
      WHERE id = $1
    `

    const result = await prisma.$queryRawUnsafe(domainQuery, domainId)

    if (!result || (result as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      )
    }

    // Serialize the result to handle BigInt values
    const serializedResult = serializeBigInt((result as any[])[0])

    return NextResponse.json(serializedResult)

  } catch (error) {
    console.error('Error fetching domain details:', error)
    console.error('Error details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch domain details', details: error.message },
      { status: 500 }
    )
  }
}
