# Script automatizado para empaquetar Focus Goat para Chrome Web Store
# Garantiza manifest.json en la raiz, rutas con barras '/' estandar y exclusion de archivos de desarrollo.

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Join-Path $scriptDir "extension"
$zipPath = Join-Path $scriptDir "focus-goat.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$excludedFiles = @("README.md", ".DS_Store", "Thumbs.db")

Get-ChildItem -Path $sourceDir -Recurse | Where-Object { 
    -not $_.PSIsContainer -and ($excludedFiles -notcontains $_.Name)
} | ForEach-Object {
    $relativePath = $_.FullName.Substring($sourceDir.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
}

$archive.Dispose()
$zipStream.Dispose()

Write-Host "✅ ZIP empaquetado con exito para Chrome Web Store en: $zipPath" -ForegroundColor Green
