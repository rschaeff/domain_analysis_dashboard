import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'x_group', 'h_group', 't_group', 'a_group'
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    if (!type || !['x_group', 'h_group', 't_group', 'a_group'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }

    // Build the search query based on the group type
    let searchQuery: string
    let params: any[]

    if (search) {
      // Use more efficient search with ILIKE and proper indexing
      searchQuery = `
        SELECT
          ${type},
          COUNT(*) as domain_count
        FROM pdb_analysis.partition_domain_summary
        WHERE ${type} IS NOT NULL
          AND ${type} ILIKE $1
        GROUP BY ${type}
        ORDER BY
          -- Prioritize exact matches and prefix matches
          CASE
            WHEN ${type} = $2 THEN 1
            WHEN ${type} ILIKE $3 THEN 2
            ELSE 3
          END,
          domain_count DESC,
          ${type}
        LIMIT $4
      `
      params = [`%${search}%`, search, `${search}%`, limit]
    } else {
      // Get top groups by frequency when no search term
      searchQuery = `
        SELECT
          ${type},
          COUNT(*) as domain_count
        FROM pdb_analysis.partition_domain_summary
        WHERE ${type} IS NOT NULL
        GROUP BY ${type}
        ORDER BY domain_count DESC, ${type}
        LIMIT $1
      `
      params = [limit]
    }

    console.log('Executing query:', searchQuery, 'with params:', params)

    // Execute the query using raw SQL for better performance
    const results = await prisma.$queryRawUnsafe(searchQuery, ...params)

    // Format the results
    const options = (results as any[]).map(row => ({
      value: row[type],
      label: `${row[type]} (${Number(row.domain_count).toLocaleString()} domains)`,
      count: Number(row.domain_count)
    }))

    // Check if there might be more results
    const hasMore = options.length === limit

    // If searching, also get total count for that search term
    let totalCount = 0
    if (search && options.length > 0) {
      const countQuery = `
        SELECT COUNT(DISTINCT ${type}) as total
        FROM pdb_analysis.partition_domain_summary
        WHERE ${type} IS NOT NULL
          AND ${type} ILIKE $1
      `
      const countResult = await prisma.$queryRawUnsafe(countQuery, `%${search}%`)
      totalCount = Number((countResult as any[])[0]?.total || 0)
    }

    return NextResponse.json({
      options,
      total: totalCount || options.length,
      hasMore,
      query: {
        type,
        search,
        limit
      }
    })

  } catch (error) {
    console.error('Error searching filter options:', error)
    return NextResponse.json(
      {
        error: 'Failed to search filter options',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Add POST method for batch requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { types, search, limit = 20 } = body

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: 'Invalid types parameter' }, { status: 400 })
    }

    // Validate all types
    const validTypes = ['x_group', 'h_group', 't_group', 'a_group']
    for (const type of types) {
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })
      }
    }

    const results: Record<string, any[]> = {}

    // Fetch data for each type in parallel
    await Promise.all(
      types.map(async (type) => {
        let searchQuery: string
        let params: any[]

        if (search) {
          searchQuery = `
            SELECT
              ${type} as group_value,
              COUNT(*) as domain_count
            FROM pdb_analysis.partition_domain_summary
            WHERE ${type} IS NOT NULL
              AND ${type} ILIKE $1
            GROUP BY ${type}
            ORDER BY
              CASE
                WHEN ${type} = $2 THEN 1
                WHEN ${type} ILIKE $3 THEN 2
                ELSE 3
              END,
              domain_count DESC,
              ${type}
            LIMIT $4
          `
          params = [`%${search}%`, search, `${search}%`, limit]
        } else {
          searchQuery = `
            SELECT
              ${type} as group_value,
              COUNT(*) as domain_count
            FROM pdb_analysis.partition_domain_summary
            WHERE ${type} IS NOT NULL
            GROUP BY ${type}
            ORDER BY domain_count DESC, ${type}
            LIMIT $1
          `
          params = [limit]
        }

        const typeResults = await prisma.$queryRawUnsafe(searchQuery, ...params)
        results[type] = (typeResults as any[]).map(row => ({
          value: row.group_value,
          label: `${row.group_value} (${Number(row.domain_count).toLocaleString()})`,
          count: Number(row.domain_count)
        }))
      })
    )

    return NextResponse.json({
      results,
      query: { types, search, limit }
    })

  } catch (error) {
    console.error('Error in batch filter options request:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch batch filter options',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
