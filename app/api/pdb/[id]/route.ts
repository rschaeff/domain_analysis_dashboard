// app/api/pdb/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

// Path to your local PDB repository
const PDB_REPOSITORY_PATH = '/usr2/pdb/data/structures'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const pdbId = id.toLowerCase()
    
    if (!pdbId || pdbId.length !== 4) {
      return NextResponse.json({ error: 'Invalid PDB ID' }, { status: 400 })
    }
    
    const middleChars = pdbId.substring(1, 3)
    
    // Potential file paths in order of preference
    const potentialPaths = [
      // mmCIF format (preferred)
      path.join(PDB_REPOSITORY_PATH, 'divided', 'mmCIF', middleChars, `${pdbId}.cif.gz`),
      path.join(PDB_REPOSITORY_PATH, 'divided', 'mmCIF', middleChars, `${pdbId}.cif`),
      
      // Legacy PDB format
      path.join(PDB_REPOSITORY_PATH, 'divided', 'pdb', middleChars, `pdb${pdbId}.ent.gz`),
      path.join(PDB_REPOSITORY_PATH, 'divided', 'pdb', middleChars, `pdb${pdbId}.ent`),
      
      // Binary formats
      path.join(PDB_REPOSITORY_PATH, 'divided', 'mmtf', middleChars, `${pdbId}.mmtf`),
      
      // Alternate locations
      path.join(PDB_REPOSITORY_PATH, 'data', 'structures', 'all', 'mmCIF', `${pdbId}.cif.gz`),
      path.join(PDB_REPOSITORY_PATH, 'data', 'structures', 'all', 'pdb', `pdb${pdbId}.ent.gz`)
    ]
    
    // Try each path until we find a file
    let filePath = null
    let fileFormat = null
    let isCompressed = false
    
    for (const path of potentialPaths) {
      try {
        await fs.access(path)
        filePath = path
        
        // Determine format from file extension
        if (path.endsWith('.cif.gz') || path.endsWith('.cif')) {
          fileFormat = 'mmcif'
        } else if (path.endsWith('.ent.gz') || path.endsWith('.ent') || path.endsWith('.pdb')) {
          fileFormat = 'pdb'
        } else if (path.endsWith('.mmtf')) {
          fileFormat = 'mmtf'
        }
        
        isCompressed = path.endsWith('.gz')
        break
      } catch (e) {
        // File doesn't exist, try next one
        continue
      }
    }
    
    if (!filePath || !fileFormat) {
      console.error(`No PDB file found for ${pdbId}`)
      return NextResponse.json({ error: 'PDB file not found' }, { status: 404 })
    }
    
    console.log(`Found PDB file: ${filePath}, format: ${fileFormat}, compressed: ${isCompressed}`)
    
    let contentType
    switch (fileFormat) {
      case 'mmcif': contentType = 'chemical/x-mmcif'; break
      case 'pdb': contentType = 'chemical/x-pdb'; break
      case 'mmtf': contentType = 'application/octet-stream'; break
      default: contentType = 'text/plain'
    }
    
    // Handle compressed files
    if (isCompressed) {
      // Stream and decompress
      const { readable, writable } = new TransformStream()
      const gzip = createGunzip()
      const fileStream = createReadStream(filePath)
      
      pipeline(fileStream, gzip, writable)
        .catch(error => console.error(`Streaming error: ${error}`))
      
      return new NextResponse(readable, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'X-PDB-Format': fileFormat
        }
      })
    } else {
      // For non-compressed files, read and return
      const fileContent = await fs.readFile(filePath)
      
      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'X-PDB-Format': fileFormat
        }
      })
    }
  } catch (error) {
    console.error('Error serving PDB file:', error)
    return NextResponse.json(
      { error: 'Failed to serve PDB file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
