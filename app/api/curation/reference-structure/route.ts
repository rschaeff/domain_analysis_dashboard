// app/api/curation/reference-structure/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

interface ReferenceStructureRequest {
  evidence_id?: number
  pdb_id?: string
  chain_id?: string
  domain_range?: string
  format?: 'pdb' | 'mmcif'
}

export async function POST(request: NextRequest) {
  try {
    const { evidence_id, pdb_id, chain_id, domain_range, format = 'pdb' }: ReferenceStructureRequest = await request.json()

    let referencePdbId: string
    let referenceChainId: string
    let referenceRange: string

    // Get reference info from evidence if evidence_id provided
    if (evidence_id) {
      const evidenceQuery = `
        SELECT de.pdb_id, de.chain_id, de.hit_range, de.source_id
        FROM pdb_analysis.domain_evidence de
        WHERE de.id = $1
      `
      const evidenceResult = await prisma.$queryRawUnsafe(evidenceQuery, evidence_id)
      
      if (!evidenceResult || (evidenceResult as any[]).length === 0) {
        return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
      }

      const evidence = (evidenceResult as any[])[0]
      referencePdbId = evidence.pdb_id
      referenceChainId = evidence.chain_id
      referenceRange = evidence.hit_range
    } else if (pdb_id && chain_id && domain_range) {
      referencePdbId = pdb_id
      referenceChainId = chain_id
      referenceRange = domain_range
    } else {
      return NextResponse.json({ 
        error: 'Must provide either evidence_id or (pdb_id, chain_id, domain_range)' 
      }, { status: 400 })
    }

    // Parse range (e.g., "25-150" or "A:25-150")
    const cleanRange = referenceRange.includes(':') 
      ? referenceRange.split(':')[1] 
      : referenceRange
    
    const [startStr, endStr] = cleanRange.split('-')
    const startRes = parseInt(startStr)
    const endRes = parseInt(endStr)

    if (isNaN(startRes) || isNaN(endRes)) {
      return NextResponse.json({ 
        error: `Invalid range format: ${referenceRange}` 
      }, { status: 400 })
    }

    // Fetch full structure
    const structureUrl = `/api/pdb/${referencePdbId.toLowerCase()}`
    const response = await fetch(`${request.nextUrl.origin}${structureUrl}`)
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch structure ${referencePdbId}` 
      }, { status: 404 })
    }

    const fullStructure = await response.text()

    // Extract domain from mmCIF
    const domainStructure = extractDomainFromMmcif(
      fullStructure, 
      referenceChainId, 
      startRes, 
      endRes,
      format
    )

    if (!domainStructure) {
      return NextResponse.json({ 
        error: `Failed to extract domain ${referenceRange} from chain ${referenceChainId}` 
      }, { status: 400 })
    }

    const filename = `${referencePdbId}_${referenceChainId}_${startRes}-${endRes}.${format}`
    const contentType = format === 'pdb' ? 'chemical/x-pdb' : 'chemical/x-mmcif'

    return new NextResponse(domainStructure, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Domain-Info': JSON.stringify({
          pdb_id: referencePdbId,
          chain_id: referenceChainId,
          start_residue: startRes,
          end_residue: endRes,
          total_residues: endRes - startRes + 1
        })
      }
    })

  } catch (error) {
    console.error('Reference structure extraction error:', error)
    return NextResponse.json({ 
      error: 'Failed to extract reference structure',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Extract domain from mmCIF structure
function extractDomainFromMmcif(
  mmcifData: string, 
  chainId: string, 
  startRes: number, 
  endRes: number,
  outputFormat: 'pdb' | 'mmcif'
): string | null {
  try {
    const lines = mmcifData.split('\n')
    const atomLines: string[] = []
    const headerLines: string[] = []
    
    let inAtomSite = false
    let atomSiteHeaders: string[] = []
    let atomSiteIndices: { [key: string]: number } = {}

    for (const line of lines) {
      // Capture header information
      if (line.startsWith('data_') || line.startsWith('_entry.id') || 
          line.startsWith('_struct.title') || line.startsWith('_exptl.method')) {
        headerLines.push(line)
      }

      // Handle atom_site block
      if (line.startsWith('_atom_site.')) {
        inAtomSite = true
        const field = line.substring('_atom_site.'.length).trim()
        atomSiteHeaders.push(field)
        atomSiteIndices[field] = atomSiteHeaders.length - 1
        continue
      }

      // End of atom_site headers, start of data
      if (inAtomSite && !line.startsWith('_') && !line.startsWith('#') && line.trim()) {
        const parts = line.trim().split(/\s+/)
        
        if (parts.length >= atomSiteHeaders.length) {
          const chainIndex = atomSiteIndices['auth_asym_id'] || atomSiteIndices['label_asym_id']
          const residueIndex = atomSiteIndices['auth_seq_id'] || atomSiteIndices['label_seq_id']
          
          if (chainIndex !== undefined && residueIndex !== undefined) {
            const atomChain = parts[chainIndex]
            const atomResidue = parseInt(parts[residueIndex])
            
            // Filter by chain and residue range
            if (atomChain === chainId && atomResidue >= startRes && atomResidue <= endRes) {
              atomLines.push(line)
            }
          }
        }
      }

      // End of atom_site block
      if (inAtomSite && (line.startsWith('_') && !line.startsWith('_atom_site.')) || line.startsWith('#')) {
        inAtomSite = false
      }
    }

    if (atomLines.length === 0) {
      return null
    }

    if (outputFormat === 'pdb') {
      // Convert to PDB format (simplified)
      return convertMmcifToPdb(atomLines, atomSiteIndices)
    } else {
      // Return filtered mmCIF
      const mmcifHeader = [
        `data_${chainId}_${startRes}_${endRes}`,
        '',
        '_entry.id', `${chainId}_${startRes}_${endRes}`,
        '',
        'loop_',
        ...atomSiteHeaders.map(h => `_atom_site.${h}`),
        ...atomLines
      ]
      return mmcifHeader.join('\n')
    }

  } catch (error) {
    console.error('Error extracting domain:', error)
    return null
  }
}

// Simple mmCIF to PDB converter for atoms
function convertMmcifToPdb(atomLines: string[], indices: { [key: string]: number }): string {
  const pdbLines: string[] = []
  
  for (const line of atomLines) {
    const parts = line.trim().split(/\s+/)
    
    // Extract key fields (simplified mapping)
    const atomType = parts[indices['group_PDB'] || 0] || 'ATOM'
    const atomId = parts[indices['id'] || 1] || '1'
    const atomName = parts[indices['label_atom_id'] || 2] || 'CA'
    const resName = parts[indices['label_comp_id'] || 3] || 'ALA'
    const chainId = parts[indices['auth_asym_id'] || 4] || 'A'
    const resNum = parts[indices['auth_seq_id'] || 5] || '1'
    const x = parts[indices['Cartn_x'] || 6] || '0.000'
    const y = parts[indices['Cartn_y'] || 7] || '0.000'
    const z = parts[indices['Cartn_z'] || 8] || '0.000'
    const occupancy = parts[indices['occupancy'] || 9] || '1.00'
    const bFactor = parts[indices['B_iso_or_equiv'] || 10] || '20.00'
    const element = parts[indices['type_symbol'] || 11] || 'C'

    // Format PDB ATOM line
    const pdbLine = `${atomType.padEnd(6)}${atomId.padStart(5)} ${atomName.padStart(4)} ${resName.padEnd(3)} ${chainId}${resNum.padStart(4)}    ${parseFloat(x).toFixed(3).padStart(8)}${parseFloat(y).toFixed(3).padStart(8)}${parseFloat(z).toFixed(3).padStart(8)}${parseFloat(occupancy).toFixed(2).padStart(6)}${parseFloat(bFactor).toFixed(2).padStart(6)}          ${element.padStart(2)}`
    
    pdbLines.push(pdbLine)
  }
  
  pdbLines.push('END')
  return pdbLines.join('\n')
}
