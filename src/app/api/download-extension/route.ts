import { NextResponse } from 'next/server'
import AdmZip from 'adm-zip'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const zip = new AdmZip()
    const extensionPath = join(process.cwd(), 'browser-extension')

    // Helper function to add files recursively
    const addFilesToZip = (dir: string, zipPath: string = '') => {
      const files = readdirSync(dir)

      for (const file of files) {
        const fullPath = join(dir, file)
        const stat = statSync(fullPath)
        const zipFilePath = zipPath ? `${zipPath}/${file}` : file

        if (stat.isDirectory()) {
          addFilesToZip(fullPath, zipFilePath)
        } else {
          const fileContent = readFileSync(fullPath)
          zip.addFile(zipFilePath, fileContent)
        }
      }
    }

    // Add all files from the extension directory
    addFilesToZip(extensionPath)

    // Generate the zip buffer
    const zipBuffer = zip.toBuffer()

    // Return the zip file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="trackd-extension.zip"',
      },
    })
  } catch (error) {
    console.error('Error creating extension zip:', error)
    return NextResponse.json(
      { error: 'Failed to create extension zip' },
      { status: 500 }
    )
  }
}

