# Image Optimization Script for Waschen POS
# Converts PNG to WebP for ~60-80% file size reduction
#
# Option 1: Use Python with Pillow (recommended)
#   pip install pillow
#   python scripts/batch-convert.py
#
# Option 2: Use cwebp from WebP binaries
#   Download from: https://developers.google.com/speed/webp/download
#   Place cwebp.exe in scripts/tools/
#   python scripts/batch-convert.py --tool cwebp
#
# Option 3: Manual online conversion
#   Go to: https://cloudconvert.com/png-to-webp
#   Upload folder: src/assets/
#   Download and replace

param(
    [string]$Tool = "online",  # "online", "pillow", "cwebp"
    [string]$Quality = "85"
)

$ErrorActionPreference = "Continue"

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $ProjectRoot "src\assets"
$LogFile = Join-Path $ScriptDir "conversion-log.txt"

# Initialize log
$log = @"
Image Conversion Log - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
==================================================

"@

Write-Host "🖼️  Image Optimization Tool" -ForegroundColor Cyan
Write-Host "=" * 50

# Find all PNG files
$pngFiles = Get-ChildItem -Path $AssetsDir -Filter "*.png" -Recurse -File | Select-Object FullName, Length
$totalCount = $pngFiles.Count

if ($totalCount -eq 0) {
    Write-Host "No PNG files found!" -ForegroundColor Yellow
    exit
}

Write-Host "`nFound $totalCount PNG files" -ForegroundColor Green
Write-Host "Total size: $([math]::Round((($pngFiles | Measure-Object -Property Length -Sum).Sum / 1MB), 2)) MB`n" -ForegroundColor Cyan

# For online conversion, generate a file list
if ($Tool -eq "online") {
    Write-Host "📋 Generating file list for online conversion..." -ForegroundColor Yellow
    Write-Host ""

    $fileList = @()
    $totalSize = 0

    foreach ($file in $pngFiles) {
        $relativePath = $file.FullName.Replace($ProjectRoot, "").Replace("\", "/")
        $fileList += [PSCustomObject]@{
            Path = $relativePath
            Size = $file.Length
            SizeFormatted = if ($file.Length -gt 1MB) { "{0:N2} MB" -f ($file.Length / 1MB) } else { "{0:N0} KB" -f ($file.Length / 1KB) }
        }
        $totalSize += $file.Length
    }

    # Sort by size descending
    $fileList = $fileList | Sort-Object Size -Descending

    # Display largest files first
    Write-Host "Top 20 largest files:" -ForegroundColor Cyan
    Write-Host "-" * 60
    $fileList | Select-Object -First 20 | ForEach-Object {
        Write-Host ("  {0,-60} {1}" -f $_.Path, $_.SizeFormatted)
    }

    # Save file list
    $listPath = Join-Path $ProjectRoot "assets-to-convert.txt"
    $fileList | Out-File -FilePath $listPath -Encoding UTF8
    $log += "File list saved to: $listPath`n"
    $log += "Total files: $totalCount`n"
    $log += "Total size: $([math]::Round($totalSize / 1MB, 2)) MB`n"

    Write-Host "`n📄 File list saved to: $listPath" -ForegroundColor Green
    Write-Host "`n📌 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Go to https://cloudconvert.com/png-to-webp"
    Write-Host "   2. Upload all files from: $AssetsDir"
    Write-Host "   3. Set quality to: $Quality"
    Write-Host "   4. Download WebP files"
    Write-Host "   5. Replace PNG files with WebP versions"
    Write-Host ""
    Write-Host "💡 Tip: Use quality 85 for best balance of size and quality" -ForegroundColor Yellow
}

# For Pillow conversion
if ($Tool -eq "pillow") {
    Write-Host "🔄 Converting with Pillow..." -ForegroundColor Yellow

    # Check if Pillow is installed
    $pillowCheck = python -c "from PIL import Image; print('ok')" 2>$null
    if ($pillowCheck -ne "ok") {
        Write-Host "❌ Pillow not installed. Install with: pip install pillow" -ForegroundColor Red
        Write-Host "   Or use: $Tool -Tool online" -ForegroundColor Yellow
        exit
    }

    $converted = 0
    $savedBytes = 0

    foreach ($file in $pngFiles) {
        $webpPath = $file.FullName -replace '\.png$', '.webp'
        $relativePath = $file.FullName.Replace($ProjectRoot, "")

        Write-Host "Converting: $relativePath" -ForegroundColor Gray

        try {
            # Convert using Pillow
            $script = @"
from PIL import Image
import os
input_path = r'$($file.FullName.Replace("'", "''"))'
output_path = r'$webpPath.Replace("'", "''")'
img = Image.open(input_path)
# Optimize size for web display
if img.width > 1200 or img.height > 1200:
    img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
img.save(output_path, 'WEBP', quality=$Quality, method=6)
print('ok')
"@
            $result = python -c $script 2>$null

            if ($result -eq "ok" -and (Test-Path $webpPath)) {
                $newSize = (Get-Item $webpPath).Length
                $saved = $file.Length - $newSize
                $savedBytes += $saved
                $converted++

                $savedPercent = [math]::Round(($saved / $file.Length) * 100, 1)
                Write-Host "  ✅ Done! Saved $savedPercent%" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  ❌ Error: $_" -ForegroundColor Red
        }
    }

    Write-Host "`n✅ Conversion complete!" -ForegroundColor Green
    Write-Host "   Converted: $converted files"
    Write-Host "   Saved: $([math]::Round($savedBytes / 1MB, 2)) MB"

    $log += "`nConversion Results:`n"
    $log += "  Converted: $converted files`n"
    $log += "  Saved: $([math]::Round($savedBytes / 1MB, 2)) MB`n"
}

# Save log
$log | Out-File -FilePath $LogFile -Encoding UTF8
Write-Host "`n📝 Log saved to: $LogFile" -ForegroundColor Gray
