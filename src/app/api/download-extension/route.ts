import { NextResponse } from 'next/server'
import AdmZip from 'adm-zip'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const extensionPath = join(process.cwd(), 'browser-extension')
    
    // Create a new zip file
    const zip = new AdmZip()

    // Helper function to recursively add files to zip
    async function addDirectoryToZip(dirPath: string, zipPath: string = '') {
      const entries = await readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        const zipEntryPath = zipPath ? `${zipPath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          // Recursively add subdirectories
          await addDirectoryToZip(fullPath, zipEntryPath)
        } else {
          // Add file to zip
          const fileContent = await readFile(fullPath)
          zip.addFile(zipEntryPath, fileContent)
        }
      }
    }

    // Add all files from the browser-extension directory
    await addDirectoryToZip(extensionPath)

    // Generate the zip file buffer
    const zipBuffer = zip.toBuffer()

    // Return the zip file as a download
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="trackd-extension.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error creating extension zip:', error)
    return NextResponse.json(
      { error: 'Failed to create extension zip file' },
      { status: 500 }
    )
  }
}
