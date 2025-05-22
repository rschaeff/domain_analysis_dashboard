export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, fileId: string } }
) {
  try {
    const { id, fileId } = await params
    
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
    const fileContent = await fs.readFile(file.file_path, 'utf8')
    
    return NextResponse.json({
      content: fileContent,
      file_type: file.file_type,
      file_path: file.file_path
    })
    
  } catch (error) {
    console.error('Error reading file:', error)
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
}
