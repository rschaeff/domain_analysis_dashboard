// app/api/pdb/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createReadStream, statSync, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

// Path to your local PDB repository - can be configured via environment variables
const PDB_REPOSITORY_PATH = process.env.PDB_REPOSITORY_PATH || '/usr2/pdb/data/structures'

// Debugging helper
function debugLog(message: string, ...args: any[]) {
  console.log(`[PDB API] ${message}`, ...args)
}

// Function to check if a directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    debugLog(`Checking if directory exists: ${dirPath}`)
    const stats = await fs.stat(dirPath)
    const isDir = stats.isDirectory()
    debugLog(`Directory ${dirPath} exists: ${isDir}`)
    return isDir
  } catch (error) {
    debugLog(`Directory ${dirPath} does not exist or is not accessible:`, error)
    return false
  }
}

// Function to check if a file exists (sync version for debugging)
function fileExistsSync(filePath: string): boolean {
  try {
    return existsSync(filePath)
  } catch (error) {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  debugLog(`GET request for PDB ID: ${params.id}`)

  try {
    // Check if PDB repository exists
    const repositoryExists = await directoryExists(PDB_REPOSITORY_PATH)
    debugLog(`Repository path exists: ${repositoryExists}`)

    if (!repositoryExists) {
      debugLog(`PDB repository not found at ${PDB_REPOSITORY_PATH}`)
      return NextResponse.json({
        error: 'PDB repository not configured',
        message: `The PDB repository path (${PDB_REPOSITORY_PATH}) is not accessible.`
      }, { status: 500 })
    }

    // Get and validate PDB ID
    const id = params.id
    const pdbId = id.toLowerCase()
    debugLog(`Processing PDB ID: ${pdbId}`)

    if (!pdbId || pdbId.length !== 4) {
      debugLog(`Invalid PDB ID: ${pdbId}`)
      return NextResponse.json({ error: 'Invalid PDB ID' }, { status: 400 })
    }

    const middleChars = pdbId.substring(1, 3)
    debugLog(`Middle characters: ${middleChars}`)

    // Check for the specific file we know exists
    const specificPath = path.join(PDB_REPOSITORY_PATH, 'divided', 'mmCIF', middleChars, `${pdbId}.cif.gz`)
    const specificPathExists = fileExistsSync(specificPath)
    debugLog(`Specific path ${specificPath} exists: ${specificPathExists}`)

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
      path.join(PDB_REPOSITORY_PATH, 'all', 'mmCIF', `${pdbId}.cif.gz`),
      path.join(PDB_REPOSITORY_PATH, 'all', 'pdb', `pdb${pdbId}.ent.gz`),

      // Simple flat directory structure (for development)
      path.join(PDB_REPOSITORY_PATH, `${pdbId}.cif.gz`),
      path.join(PDB_REPOSITORY_PATH, `${pdbId}.cif`),
      path.join(PDB_REPOSITORY_PATH, `pdb${pdbId}.ent.gz`),
      path.join(PDB_REPOSITORY_PATH, `pdb${pdbId}.ent`)
    ]

    // Try each path until we find a file
    let filePath = null
    let fileFormat = null
    let isCompressed = false

    debugLog(`Checking ${potentialPaths.length} potential paths...`)

    for (const potentialPath of potentialPaths) {
      try {
        debugLog(`Checking path: ${potentialPath}`)
        await fs.access(potentialPath)
        filePath = potentialPath
        debugLog(`Found file at: ${filePath}`)

        // Determine format from file extension
        if (potentialPath.endsWith('.cif.gz') || potentialPath.endsWith('.cif')) {
          fileFormat = 'mmcif'
        } else if (potentialPath.endsWith('.ent.gz') || potentialPath.endsWith('.ent') || potentialPath.endsWith('.pdb')) {
          fileFormat = 'pdb'
        } else if (potentialPath.endsWith('.mmtf')) {
          fileFormat = 'mmtf'
        }

        isCompressed = potentialPath.endsWith('.gz')
        debugLog(`File format: ${fileFormat}, compressed: ${isCompressed}`)
        break
      } catch (e) {
        debugLog(`File not found at: ${potentialPath}`)
        // File doesn't exist, try next one
        continue
      }
    }

    if (!filePath || !fileFormat) {
      debugLog(`No PDB file found for ${pdbId} in ${PDB_REPOSITORY_PATH}`)
      return NextResponse.json({
        error: 'PDB file not found',
        message: `No structure with ID ${pdbId} found in the local repository. Try the remote repository.`
      }, { status: 404 })
    }

    debugLog(`Found PDB file: ${filePath}, format: ${fileFormat}, compressed: ${isCompressed}`)

    // Check if the file is readable and has content
    try {
      const fileStats = statSync(filePath)
      debugLog(`File size: ${fileStats.size} bytes`)

      if (fileStats.size === 0) {
        debugLog(`Empty file: ${filePath}`)
        return NextResponse.json({
          error: 'Empty PDB file',
          message: `The file for ${pdbId} exists but is empty.`
        }, { status: 500 })
      }
    } catch (error) {
      debugLog(`Error checking file ${filePath}:`, error)
      return NextResponse.json({
        error: 'File access error',
        message: `Could not access ${pdbId} file. Try the remote repository.`
      }, { status: 500 })
    }

    let contentType
    switch (fileFormat) {
      case 'mmcif': contentType = 'chemical/x-mmcif'; break
      case 'pdb': contentType = 'chemical/x-pdb'; break
      case 'mmtf': contentType = 'application/octet-stream'; break
      default: contentType = 'text/plain'
    }

    debugLog(`Content type: ${contentType}`)

    // Handle compressed files
    if (isCompressed) {
      // Stream and decompress
      debugLog(`Streaming compressed file: ${filePath}`)
      const { readable, writable } = new TransformStream()
      const gzip = createGunzip()
      const fileStream = createReadStream(filePath)

      pipeline(fileStream, gzip, writable)
        .catch(error => debugLog(`Streaming error: ${error}`))

      return new NextResponse(readable, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'X-PDB-Format': fileFormat
        }
      })
    } else {
      // For non-compressed files, read and return
      debugLog(`Reading non-compressed file: ${filePath}`)
      const fileContent = await fs.readFile(filePath)
      debugLog(`File content length: ${fileContent.length} bytes`)

      return new NextResponse(fileContent, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'X-PDB-Format': fileFormat
        }
      })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    debugLog('Error serving PDB file:', errorMsg, error)

    return NextResponse.json(
      {
        error: 'Failed to serve PDB file',
        message: 'An error occurred when trying to access the local repository. Try the remote repository.',
        details: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// HEAD method for checking format without downloading the full file
export async function HEAD(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  debugLog(`HEAD request for PDB ID: ${params.id}`)

  try {
    const id = params.id;
    const pdbId = id.toLowerCase()

    // Check if PDB repository exists
    const repositoryExists = await directoryExists(PDB_REPOSITORY_PATH)
    debugLog(`Repository path exists: ${repositoryExists}`)

    if (!repositoryExists) {
      debugLog(`PDB repository not found at ${PDB_REPOSITORY_PATH}`)
      return new NextResponse(null, {
        status: 500,
        headers: { 'X-Error': 'PDB repository not configured' }
      })
    }

    if (!pdbId || pdbId.length !== 4) {
      debugLog(`Invalid PDB ID: ${pdbId}`)
      return new NextResponse(null, { status: 400 })
    }

    const middleChars = pdbId.substring(1, 3)
    debugLog(`Middle characters: ${middleChars}`)

    // Try to find the most common formats
    const potentialPaths = [
      path.join(PDB_REPOSITORY_PATH, 'divided', 'mmCIF', middleChars, `${pdbId}.cif.gz`),
      path.join(PDB_REPOSITORY_PATH, 'divided', 'pdb', middleChars, `pdb${pdbId}.ent.gz`),
      path.join(PDB_REPOSITORY_PATH, `${pdbId}.cif`),
      path.join(PDB_REPOSITORY_PATH, `pdb${pdbId}.ent`)
    ]

    let fileFormat = null
    let filePath = null

    for (const potentialPath of potentialPaths) {
      try {
        debugLog(`Checking path: ${potentialPath}`)
        await fs.access(potentialPath)
        filePath = potentialPath
        debugLog(`Found file at: ${filePath}`)

        if (potentialPath.endsWith('.cif.gz') || potentialPath.endsWith('.cif')) {
          fileFormat = 'mmcif'
        } else if (potentialPath.endsWith('.ent.gz') || potentialPath.endsWith('.ent') || potentialPath.endsWith('.pdb')) {
          fileFormat = 'pdb'
        } else if (potentialPath.endsWith('.mmtf')) {
          fileFormat = 'mmtf'
        }

        break
      } catch (e) {
        debugLog(`File not found at: ${potentialPath}`)
        continue
      }
    }

    if (!fileFormat) {
      debugLog(`No PDB file found for ${pdbId}`)
      return new NextResponse(null, { status: 404 })
    }

    debugLog(`Found PDB file format: ${fileFormat}`)

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-PDB-Format': fileFormat,
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    debugLog('Error in HEAD request:', errorMsg, error)
    return new NextResponse(null, {
      status: 500,
      headers: { 'X-Error': errorMsg }
    })
  }
}
