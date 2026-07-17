# ─────────────────────────────────────────────────────────────────────────────
# PowerShell Script: Optimize & Organize Waschen Images
# Usage: .\scripts\optimize-images.ps1
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Waschen Image Optimizer" -ForegroundColor Cyan
Write-Host "=================================================="

$AssetsDir = "src\assets"
$IconDir = "$AssetsDir\Icon and Asset Laundry"
$DecorDir = "$AssetsDir\Decorative icon"
$AvatarDir = "$AssetsDir\Avatar set"
$CharDir = "$AssetsDir\karakter Perempuan"

# Target icon sizes
$IconSizes = @(16, 18, 20, 22, 24, 32)

# Function to format file size
function Format-FileSize {
    param([long]$Bytes)
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    elseif ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    else { return "$Bytes B" }
}

# Analyze directory
function Get-DirStats {
    param([string]$Path, [string]$Name)

    if (-not (Test-Path $Path)) {
        Write-Host "  Directory not found: $Path" -ForegroundColor Yellow
        return
    }

    $files = Get-ChildItem -Path $Path -Filter "*.webp" -File
    $totalSize = ($files | Measure-Object -Property Length -Sum).Sum

    Write-Host ""
    Write-Host "  Directory: $Name" -ForegroundColor White
    Write-Host ("     Files: {0}" -f $files.Count)
    Write-Host ("     Total Size: {0}" -f (Format-FileSize $totalSize))

    if ($files.Count -gt 0) {
        $avgSize = $totalSize / $files.Count
        Write-Host ("     Average: {0} per file" -f (Format-FileSize $avgSize))

        # Find largest files
        $largest = $files | Sort-Object Length -Descending | Select-Object -First 3
        Write-Host "     Largest files:"
        foreach ($f in $largest) {
            Write-Host ("       - {0}: {1}" -f $f.Name, (Format-FileSize $f.Length))
        }
    }
}

# Analyze each directory
Write-Host ""
Write-Host "Current Asset Analysis" -ForegroundColor Cyan

Get-DirStats -Path $IconDir -Name "Icon and Asset Laundry"
Get-DirStats -Path $DecorDir -Name "Decorative Icons"
Get-DirStats -Path $AvatarDir -Name "Avatar Set"
Get-DirStats -Path $CharDir -Name "Character Illustrations"

# Calculate total
$allWebp = Get-ChildItem -Path $AssetsDir -Filter "*.webp" -Recurse -File
$totalSize = ($allWebp | Measure-Object -Property Length -Sum).Sum

Write-Host ""
Write-Host "--------------------------------------------------"
Write-Host ("Total: {0} files, {1}" -f $allWebp.Count, (Format-FileSize $totalSize)) -ForegroundColor Green
Write-Host ""

# Optimization info
Write-Host ""
Write-Host "Compression Suggestions" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Write-Host "1. Sharp (Node.js) - RECOMMENDED"
Write-Host "   Install: npm install sharp"
Write-Host "   Run: node scripts/compress-images.cjs"
Write-Host ""
Write-Host "2. Squoosh CLI (Google)"
Write-Host '   Usage: npx squoosh-cli --webp "{\"quality\":80}" src/assets/Icon/*.webp'
Write-Host ""
Write-Host "3. TinyPNG (Online)"
Write-Host "   Visit: https://tinypng.com/"
Write-Host ""

# Target optimization
Write-Host ""
Write-Host "Optimization Targets" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Write-Host "  Icon and Asset Laundry (38 icons):"
Write-Host "    Current: ~1.5 MB"
Write-Host "    Target: ~300-500 KB (dengan resize ke 32px max)"
Write-Host "    Savings: ~70% smaller"
Write-Host ""
Write-Host "  Overall Potential Savings:"
Write-Host ("    Current Total: {0}" -f (Format-FileSize $totalSize))
Write-Host "    After Optimization: ~1-1.5 MB"
Write-Host "    Potential Savings: ~50-70%"
Write-Host ""

Write-Host "Script selesai!" -ForegroundColor Green
Write-Host ""
