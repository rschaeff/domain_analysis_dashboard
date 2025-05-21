// app/api/proteins/by-architecture/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use your existing Prisma instance or create one
// Adjust this import based on your Prisma setup:
// import { prisma } from '@/lib/prisma'
// import { db } from '@/lib/db'

const prisma = new PrismaClient()

interface DomainData {
  id: string
  domain_number: number
  range: string
  start_position?: number
  end_position?: number
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

    // Build Prisma where clause
    const proteinWhere: any = {}
    const domainWhere: any = {}

    if (pdbId) {
      proteinWhere.pdb_id = {
        contains: pdbId,
        mode: 'insensitive'
      }
    }

    if (chainId) {
      proteinWhere.chain_id = chainId
    }

    if (minConfidence || maxConfidence) {
      domainWhere.confidence = {}
      if (minConfidence) domainWhere.confidence.gte = parseFloat(minConfidence)
      if (maxConfidence) domainWhere.confidence.lte = parseFloat(maxConfidence)
    }

    if (tGroups && tGroups.length > 0) {
      domainWhere.t_group = { in: tGroups }
    }

    if (hGroups && hGroups.length > 0) {
      domainWhere.h_group = { in: hGroups }
    }

    if (xGroups && xGroups.length > 0) {
      domainWhere.x_group = { in: xGroups }
    }

    if (evidenceTypes) {
      domainWhere.evidence_types = {
        contains: evidenceTypes,
        mode: 'insensitive'
      }
    }

    // Combine filters
    const whereClause: any = {
      ...proteinWhere,
      domains: {
        some: domainWhere
      }
    }

    // Get proteins with their domains (adjust table names based on your Prisma schema)
    const proteins = await prisma.protein.findMany({
      where: whereClause,
      include: {
        domains: {
          where: domainWhere,
          orderBy: [
            { start_position: 'asc' },
            { domain_number: 'asc' }
          ]
        }
      },
      take: 1000, // Limit for performance
      orderBy: [
        { created_at: 'desc' },
        { pdb_id: 'asc' }
      ]
    })

    // Group proteins by architecture (T-group pattern)
    const architectureMap = new Map<string, {
      proteins: typeof proteins
      t_groups: string[]
      domain_count: number
    }>()

    proteins.forEach(protein => {
      if (protein.domains.length === 0) return

      // Create architecture ID from ordered T-groups
      const sortedDomains = protein.domains.sort((a, b) => {
        return (a.start_position || a.domain_number || 0) - (b.start_position || b.domain_number || 0)
      })

      const tGroupPattern = sortedDomains.map(d => d.t_group || 'UNCLASSIFIED').join('|')
      const tGroups = sortedDomains.map(d => d.t_group || 'UNCLASSIFIED')
      const domainCount = sortedDomains.length

      if (!architectureMap.has(tGroupPattern)) {
        architectureMap.set(tGroupPattern, {
          proteins: [],
          t_groups: tGroups,
          domain_count: domainCount
        })
      }

      architectureMap.get(tGroupPattern)!.proteins.push(protein)
    })

    // Convert to architecture groups and calculate metrics
    const architectures: ArchitectureGroup[] = Array.from(architectureMap.entries())
      .map(([architectureId, data]) => {
        const { proteins: groupProteins, t_groups, domain_count } = data

        // Calculate group metrics
        const allConfidences = groupProteins.flatMap(p =>
          p.domains.map(d => d.confidence).filter(c => c !== null)
        ) as number[]

        const avgConfidence = allConfidences.length > 0
          ? allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length
          : 0

        const classificationCompleteness = groupProteins.reduce((sum, protein) => {
          const classified = protein.domains.filter(d => d.t_group !== null).length
          const total = protein.domains.length
          return sum + (total > 0 ? classified / total : 0)
        }, 0) / groupProteins.length

        // Create pattern name
        let patternName = ''
        if (domain_count === 1) {
          patternName = t_groups[0] === 'UNCLASSIFIED' ? 'Unclassified domain' : 'Single domain'
        } else if (domain_count === 2) {
          patternName = 'Two-domain protein'
        } else if (domain_count === 3) {
          patternName = 'Three-domain protein'
        } else {
          patternName = 'Complex multi-domain'
        }

        // Transform proteins data
        const transformedProteins: ProteinWithDomains[] = groupProteins
          .slice(0, 20) // Limit proteins per group
          .map(protein => {
            const proteinConfidences = protein.domains
              .map(d => d.confidence)
              .filter(c => c !== null) as number[]

            return {
              protein_id: protein.id.toString(),
              pdb_id: protein.pdb_id,
              chain_id: protein.chain_id,
              sequence_length: protein.length || 0,
              processing_date: protein.created_at?.toISOString() || new Date().toISOString(),
              best_confidence: proteinConfidences.length > 0 ? Math.max(...proteinConfidences) : 0,
              avg_confidence: proteinConfidences.length > 0
                ? proteinConfidences.reduce((sum, conf) => sum + conf, 0) / proteinConfidences.length
                : 0,
              classification_completeness: protein.domains.length > 0
                ? protein.domains.filter(d => d.t_group !== null).length / protein.domains.length
                : 0,
              domains: protein.domains.map(domain => ({
                id: domain.id.toString(),
                domain_number: domain.domain_number || 1,
                range: domain.range || '',
                start_position: domain.start_position || undefined,
                end_position: domain.end_position || undefined,
                confidence: domain.confidence,
                t_group: domain.t_group,
                h_group: domain.h_group,
                x_group: domain.x_group,
                a_group: domain.a_group,
                evidence_count: domain.evidence_count || 0,
                evidence_types: domain.evidence_types || ''
              }))
            }
          })

        return {
          architecture_id: architectureId,
          pattern_name: patternName,
          domain_count,
          t_groups,
          frequency: groupProteins.length,
          avg_confidence,
          classification_completeness,
          proteins: transformedProteins,
          pagination: {
            page: 1,
            size: 20,
            total: groupProteins.length
          }
        }
      })
      .sort((a, b) => {
        // Sort by frequency (most common first), then by domain count
        if (b.frequency !== a.frequency) return b.frequency - a.frequency
        return a.domain_count - b.domain_count
      })
      .slice(0, 50) // Top 50 architectures

    // Get summary statistics
    const totalProteins = await prisma.protein.count({ where: proteinWhere })
    const totalDomains = await prisma.domain.count({ where: domainWhere })

    const classifiedProteins = await prisma.protein.count({
      where: {
        ...proteinWhere,
        domains: {
          some: {
            ...domainWhere,
            t_group: { not: null }
          }
        }
      }
    })

    const response: ArchitectureResponse = {
      architectures,
      statistics: {
        total_proteins: totalProteins,
        total_domains: totalDomains,
        classified_chains: classifiedProteins,
        unclassified_chains: totalProteins - classifiedProteins,
        avg_domain_coverage: 75.0 // Placeholder - calculate based on your needs
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Architecture API Error:', error)
    return NextResponse.json(
      { error: `Failed to fetch architecture data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
