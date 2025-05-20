import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'x_group', 'h_group', 't_group'
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    if (!type || !['x_group', 'h_group', 't_group', 'a_group'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    // Get top groups by frequency, optionally filtered by search
    const searchQuery = `
      SELECT
        ${type},
        COUNT(*) as domain_count
      FROM pdb_analysis.partition_domain_summary
      WHERE ${type} IS NOT NULL
        ${search ? `AND ${type} ILIKE $1` : ''}
      GROUP BY ${type}
      ORDER BY domain_count DESC, ${type}
      LIMIT $${search ? '2' : '1'}
    `

    const params = search ? [`%${search}%`, limit] : [limit]
    const results = await prisma.$queryRawUnsafe(searchQuery, ...params)

    const options = (results as any[]).map(row => ({
      value: row[type],
      label: row[type],
      count: Number(row.domain_count)
    }))

    return NextResponse.json({
      options,
      total: options.length,
      hasMore: options.length === limit
    })

  } catch (error) {
    console.error('Error searching filter options:', error)
    return NextResponse.json(
      { error: 'Failed to search filter options', details: error.message },
      { status: 500 }
    )
  }
}
