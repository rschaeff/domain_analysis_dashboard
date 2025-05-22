// app/api/pdb-metadata/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

interface PDBMetadata {
  pdb_id: string
  title?: string
  method?: string
  resolution?: number
  r_factor?: number
  deposition_date?: string
  release_date?: string
  revision_date?: string
  authors?: string
  primary_citation?: {
    pmid?: string
    doi?: string
    title?: string
    journal?: string
    year?: number
  }
  structure_keywords?: string[]
  organism?: string
  expression_system?: string
  space_group?: string
  unit_cell?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const pdbId = id.toLowerCase()

    // First check our local database for cached metadata
    const cachedMetadata = await getCachedPDBMetadata(pdbId)
    if (cachedMetadata) {
      return NextResponse.json(cachedMetadata)
    }

    // If not cached, fetch from RCSB PDB API
    const freshMetadata = await fetchPDBMetadataFromRCSB(pdbId)
    
    // Cache the metadata for future use
    await cachePDBMetadata(pdbId, freshMetadata)
    
    return NextResponse.json(freshMetadata)
  } catch (error) {
    console.error(`Error fetching PDB metadata for ${id}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch PDB metadata' },
      { status: 500 }
    )
  }
}

async function getCachedPDBMetadata(pdbId: string): Promise<PDBMetadata | null> {
  try {
    // Query existing tables for metadata
    const metadataQuery = `
      SELECT 
        pe.pdb_id,
        pe.title,
        pe.experimental_method as method,
        pe.resolution,
        pe.r_factor,
        pe.deposition_date,
        pe.release_date,
        pe.revision_date,
        -- Additional fields from other tables if available
        pi.resolution as info_resolution,
        pd.method as deposition_method,
        pd.release_date as deposition_release_date
      FROM pdb_analysis.pdb_entries pe
      LEFT JOIN pdb_analysis.pdb_info pi ON pe.pdb_id = pi.pdb
      LEFT JOIN pdb_analysis.pdb_deposition pd ON pe.pdb_id = pd.pdb_id
      WHERE pe.pdb_id = $1
    `
    
    const result = await prisma.$queryRawUnsafe(metadataQuery, pdbId)
    const rows = result as any[]
    
    if (rows.length === 0) {
      return null
    }
    
    const row = rows[0]
    return {
      pdb_id: row.pdb_id,
      title: row.title,
      method: row.method || row.deposition_method,
      resolution: row.resolution || row.info_resolution,
      r_factor: row.r_factor,
      deposition_date: row.deposition_date,
      release_date: row.release_date || row.deposition_release_date,
      revision_date: row.revision_date
    }
  } catch (error) {
    console.error('Error querying cached PDB metadata:', error)
    return null
  }
}

async function fetchPDBMetadataFromRCSB(pdbId: string): Promise<PDBMetadata> {
  try {
    // RCSB PDB API endpoint for structure data
    const apiUrl = `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pyECOD-Dashboard/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`RCSB API returned ${response.status}`)
    }
    
    const data = await response.json()
    
    // Parse the RCSB response
    const metadata: PDBMetadata = {
      pdb_id: pdbId.toUpperCase(),
      title: data.struct?.title,
      deposition_date: data.rcsb_accession_info?.deposit_date,
      release_date: data.rcsb_accession_info?.initial_release_date,
      revision_date: data.rcsb_accession_info?.revision_date,
      method: data.exptl?.[0]?.method,
      resolution: data.rcsb_entry_info?.resolution_combined?.[0],
      r_factor: data.refine?.[0]?.ls_r_factor_r_work,
      structure_keywords: data.struct_keywords?.pdbx_keywords?.split(', '),
      organism: data.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name
    }
    
    // Fetch citation data separately
    const citationMetadata = await fetchPDBCitation(pdbId)
    if (citationMetadata) {
      metadata.primary_citation = citationMetadata
    }
    
    return metadata
  } catch (error) {
    console.error(`Error fetching from RCSB PDB API for ${pdbId}:`, error)
    
    // Return minimal metadata if API fails
    return {
      pdb_id: pdbId.toUpperCase()
    }
  }
}

async function fetchPDBCitation(pdbId: string) {
  try {
    const apiUrl = `https://data.rcsb.org/rest/v1/core/pubmed/${pdbId}`
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pyECOD-Dashboard/1.0'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (data && data.length > 0) {
      const citation = data[0]
      return {
        pmid: citation.rcsb_pubmed_container_identifiers?.pubmed_id?.toString(),
        doi: citation.rcsb_pubmed_container_identifiers?.doi,
        title: citation.rcsb_pubmed_citation?.title,
        journal: citation.rcsb_pubmed_citation?.journal_abbrev,
        year: citation.rcsb_pubmed_citation?.year
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error fetching citation for ${pdbId}:`, error)
    return null
  }
}

async function cachePDBMetadata(pdbId: string, metadata: PDBMetadata) {
  try {
    // Update or insert into pdb_entries table
    await prisma.$queryRawUnsafe(`
      INSERT INTO pdb_analysis.pdb_entries (
        pdb_id, title, experimental_method, resolution, r_factor,
        deposition_date, release_date, revision_date, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
      )
      ON CONFLICT (pdb_id) DO UPDATE SET
        title = EXCLUDED.title,
        experimental_method = EXCLUDED.experimental_method,
        resolution = EXCLUDED.resolution,
        r_factor = EXCLUDED.r_factor,
        deposition_date = EXCLUDED.deposition_date,
        release_date = EXCLUDED.release_date,
        revision_date = EXCLUDED.revision_date,
        last_updated = CURRENT_TIMESTAMP
    `, [
      pdbId.toLowerCase(),
      metadata.title,
      metadata.method,
      metadata.resolution,
      metadata.r_factor,
      metadata.deposition_date,
      metadata.release_date,
      metadata.revision_date
    ])
    
    // Store citation data if available
    if (metadata.primary_citation?.pmid) {
      await prisma.$queryRawUnsafe(`
        INSERT INTO pdb_analysis.pdb_citations (
          pdb_id, pmid, doi, title, journal, year, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
        )
        ON CONFLICT (pdb_id, pmid) DO UPDATE SET
          doi = EXCLUDED.doi,
          title = EXCLUDED.title,
          journal = EXCLUDED.journal,
          year = EXCLUDED.year
      `, [
        pdbId.toLowerCase(),
        metadata.primary_citation.pmid,
        metadata.primary_citation.doi,
        metadata.primary_citation.title,
        metadata.primary_citation.journal,
        metadata.primary_citation.year
      ])
    }
  } catch (error) {
    console.error('Error caching PDB metadata:', error)
  }
}

// Enhanced batch metadata fetch
export async function POST(request: NextRequest) {
  try {
    const { pdb_ids } = await request.json()
    
    if (!Array.isArray(pdb_ids) || pdb_ids.length === 0) {
      return NextResponse.json({ error: 'Invalid PDB IDs' }, { status: 400 })
    }
    
    if (pdb_ids.length > 100) {
      return NextResponse.json({ error: 'Too many PDB IDs (max 100)' }, { status: 400 })
    }
    
    const metadataPromises = pdb_ids.map(async (pdbId: string) => {
      try {
        const metadata = await getCachedPDBMetadata(pdbId.toLowerCase())
        return metadata || { pdb_id: pdbId.toUpperCase(), error: 'Not found' }
      } catch (error) {
        return { pdb_id: pdbId.toUpperCase(), error: 'Failed to fetch' }
      }
    })
    
    const results = await Promise.all(metadataPromises)
    
    return NextResponse.json({ metadata: results })
  } catch (error) {
    console.error('Error in batch metadata fetch:', error)
    return NextResponse.json({ error: 'Batch fetch failed' }, { status: 500 })
  }
}
