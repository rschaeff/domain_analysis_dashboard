// app/api/curation/filter-options/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'decision_type', 'status', 'curator'
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    if (!type || !['decision_type', 'status', 'curator'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter. Must be one of: decision_type, status, curator' }, { status: 400 })
    }

    let searchQuery: string
    let params: any[]

    switch (type) {
      case 'decision_type':
        if (search) {
          searchQuery = `
            SELECT
              decision_type as value,
              decision_type as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE decision_type IS NOT NULL
              AND decision_type ILIKE $1
            GROUP BY decision_type
            ORDER BY
              CASE
                WHEN decision_type = $2 THEN 1
                WHEN decision_type ILIKE $3 THEN 2
                ELSE 3
              END,
              count DESC,
              decision_type
            LIMIT $4
          `
          params = [`%${search}%`, search, `${search}%`, limit]
        } else {
          searchQuery = `
            SELECT
              decision_type as value,
              decision_type as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE decision_type IS NOT NULL
            GROUP BY decision_type
            ORDER BY count DESC, decision_type
            LIMIT $1
          `
          params = [limit]
        }
        break

      case 'status':
        if (search) {
          searchQuery = `
            SELECT
              status as value,
              status as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE status IS NOT NULL
              AND status ILIKE $1
            GROUP BY status
            ORDER BY
              CASE
                WHEN status = $2 THEN 1
                WHEN status ILIKE $3 THEN 2
                ELSE 3
              END,
              count DESC,
              status
            LIMIT $4
          `
          params = [`%${search}%`, search, `${search}%`, limit]
        } else {
          searchQuery = `
            SELECT
              status as value,
              status as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE status IS NOT NULL
            GROUP BY status
            ORDER BY count DESC, status
            LIMIT $1
          `
          params = [limit]
        }
        break

      case 'curator':
        if (search) {
          searchQuery = `
            SELECT
              curator_name as value,
              curator_name as label,
              COUNT(*) as count,
              MAX(decision_date) as last_decision_date
            FROM pdb_analysis.curation_decision
            WHERE curator_name IS NOT NULL
              AND curator_name ILIKE $1
            GROUP BY curator_name
            ORDER BY
              CASE
                WHEN curator_name = $2 THEN 1
                WHEN curator_name ILIKE $3 THEN 2
                ELSE 3
              END,
              count DESC,
              curator_name
            LIMIT $4
          `
          params = [`%${search}%`, search, `${search}%`, limit]
        } else {
          searchQuery = `
            SELECT
              curator_name as value,
              curator_name as label,
              COUNT(*) as count,
              MAX(decision_date) as last_decision_date
            FROM pdb_analysis.curation_decision
            WHERE curator_name IS NOT NULL
            GROUP BY curator_name
            ORDER BY count DESC, curator_name
            LIMIT $1
          `
          params = [limit]
        }
        break

      default:
        return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })
    }

    console.log('Executing curation filter query:', searchQuery, 'with params:', params)

    // Execute the query using raw SQL for better performance
    const results = await prisma.$queryRawUnsafe(searchQuery, ...params)

    // Format the results
    const options = (results as any[]).map(row => {
      const baseOption = {
        value: row.value,
        label: `${row.label} (${Number(row.count).toLocaleString()})`,
        count: Number(row.count)
      }

      // Add extra info for curators
      if (type === 'curator' && row.last_decision_date) {
        const lastDate = new Date(row.last_decision_date).toLocaleDateString()
        baseOption.label = `${row.label} (${Number(row.count).toLocaleString()}, last: ${lastDate})`
      }

      return baseOption
    })

    // Check if there might be more results
    const hasMore = options.length === limit

    // If searching, also get total count for that search term
    let totalCount = 0
    if (search && options.length > 0) {
      let countQuery: string
      let countParams: any[]

      switch (type) {
        case 'decision_type':
          countQuery = `
            SELECT COUNT(DISTINCT decision_type) as total
            FROM pdb_analysis.curation_decision
            WHERE decision_type IS NOT NULL
              AND decision_type ILIKE $1
          `
          countParams = [`%${search}%`]
          break
        case 'status':
          countQuery = `
            SELECT COUNT(DISTINCT status) as total
            FROM pdb_analysis.curation_decision
            WHERE status IS NOT NULL
              AND status ILIKE $1
          `
          countParams = [`%${search}%`]
          break
        case 'curator':
          countQuery = `
            SELECT COUNT(DISTINCT curator_name) as total
            FROM pdb_analysis.curation_decision
            WHERE curator_name IS NOT NULL
              AND curator_name ILIKE $1
          `
          countParams = [`%${search}%`]
          break
        default:
          countQuery = 'SELECT 0 as total'
          countParams = []
      }

      const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams)
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
    console.error('Error searching curation filter options:', error)
    return NextResponse.json(
      {
        error: 'Failed to search curation filter options',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Add POST method for batch curation filter requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { types, search, limit = 20 } = body

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: 'Invalid types parameter' }, { status: 400 })
    }

    // Validate all types
    const validTypes = ['decision_type', 'status', 'curator']
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

        const column = type === 'curator' ? 'curator_name' : type

        if (search) {
          searchQuery = `
            SELECT
              ${column} as value,
              ${column} as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE ${column} IS NOT NULL
              AND ${column} ILIKE $1
            GROUP BY ${column}
            ORDER BY
              CASE
                WHEN ${column} = $2 THEN 1
                WHEN ${column} ILIKE $3 THEN 2
                ELSE 3
              END,
              count DESC,
              ${column}
            LIMIT $4
          `
          params = [`%${search}%`, search, `${search}%`, limit]
        } else {
          searchQuery = `
            SELECT
              ${column} as value,
              ${column} as label,
              COUNT(*) as count
            FROM pdb_analysis.curation_decision
            WHERE ${column} IS NOT NULL
            GROUP BY ${column}
            ORDER BY count DESC, ${column}
            LIMIT $1
          `
          params = [limit]
        }

        const typeResults = await prisma.$queryRawUnsafe(searchQuery, ...params)
        results[type] = (typeResults as any[]).map(row => ({
          value: row.value,
          label: `${row.label} (${Number(row.count).toLocaleString()})`,
          count: Number(row.count)
        }))
      })
    )

    return NextResponse.json({
      results,
      query: { types, search, limit }
    })

  } catch (error) {
    console.error('Error in batch curation filter options request:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch batch curation filter options',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
