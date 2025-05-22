// app/api/proteins/[id]/files/[fileId]/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, fileId: string } }
) {
  try {
    const { id, fileId } = await params

    // Validate fileId
    if (!fileId || fileId === 'undefined') {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 })
    }

    // Query the file information
    const fileQuery = `
      SELECT pf.file_path, pf.file_type, pf.file_exists
      FROM ecod_schema.process_file pf
      WHERE pf.id = $1 AND pf.file_exists = true
    `

    const fileResult = await prisma.$queryRawUnsafe(fileQuery, parseInt(fileId))

    if (!fileResult || (fileResult as any[]).length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = (fileResult as any[])[0]

    // Read file content (you'll need to implement based on your filesystem setup)
    const fs = require('fs').promises
    try {
      const fileContent = await fs.readFile(file.file_path, 'utf8')

      return NextResponse.json({
        content: fileContent,
        file_type: file.file_type,
        file_path: file.file_path
      })
    } catch (fsError) {
      console.error('Filesystem error:', fsError)
      return NextResponse.json({
        error: 'File exists in database but not accessible on filesystem',
        file_path: file.file_path
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Error reading file:', error)
    return NextResponse.json({
      error: 'Failed to read file',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
