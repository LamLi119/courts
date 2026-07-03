$ErrorActionPreference = 'Stop'
$root = '\\wsl.localhost\Ubuntu\home\lily119\doc\the-grind\Courts_Finder\court'
$outFile = Join-Path $root '.cursor-sitemap-results.txt'
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$s) { $lines.Add($s) }

Add-Line '=== NODE COMMAND OUTPUT (PowerShell fallback; WSL node unavailable) ==='
try {
  $node = & wsl -d Ubuntu -- which node 2>$null
  if (-not $node) { throw 'node not found in WSL' }
  $nodeOut = & wsl -d Ubuntu -- bash -lc "cd /home/lily119/doc/the-grind/Courts_Finder/court && node scripts/generate-sitemap.js --cache-only" 2>&1
  Add-Line ($nodeOut | Out-String).TrimEnd()
} catch {
  Add-Line $_.Exception.Message
  Add-Line 'Generating sitemap via PowerShell equivalent...'
  $sports = Get-Content (Join-Path $root 'scripts\.sitemap-cache\sports.json') -Raw | ConvertFrom-Json
  $venues = Get-Content (Join-Path $root 'scripts\.sitemap-cache\venues.json') -Raw | ConvertFrom-Json
  $baseUrl = 'https://courts.theground.io'
  $lastmod = (Get-Date).ToString('yyyy-MM-dd')
  $urls = New-Object System.Collections.Generic.List[string]
  $seen = @{}
  function Slugify([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return '' }
    $s = $text.ToLower().Trim()
    $s = [regex]::Replace($s, '\s+', '-')
    $s = [regex]::Replace($s, '[^\p{L}\p{N}-]', '')
    $s = [regex]::Replace($s, '-+', '-')
    $s = $s.Trim('-')
    return $s
  }
  function Add-Url([string]$loc, [string]$changefreq, [string]$priority) {
    if ($seen.ContainsKey($loc)) { return }
    $seen[$loc] = $true
    $urls.Add(@"
  <url>
    <loc>$loc</loc>
    <lastmod>$lastmod</lastmod>
    <changefreq>$changefreq</changefreq>
    <priority>$priority</priority>
  </url>
"@)
  }
  Add-Url "$baseUrl/" 'weekly' '1.0'
  foreach ($sport in $sports) {
    if ($sport.slug) { Add-Url "$baseUrl/search/$($sport.slug)" 'weekly' '0.8' }
  }
  foreach ($venue in $venues) {
    $slug = Slugify $venue.name
    if ($slug) { Add-Url "$baseUrl/venues/$slug" 'monthly' '0.7' }
  }
  $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
$($urls -join "`n")
</urlset>

"@
  $sitemapPath = Join-Path $root 'public\sitemap.xml'
  New-Item -ItemType Directory -Force -Path (Split-Path $sitemapPath) | Out-Null
  [IO.File]::WriteAllText($sitemapPath, $xml)
  $urlCount = ([regex]::Matches($xml, '<loc>')).Count
  Add-Line "Sitemap base URL: $baseUrl"
  Add-Line "API URL: https://courts.api.theground.io"
  Add-Line 'Using cached API data from scripts/.sitemap-cache/'
  Add-Line "Wrote $urlCount URLs to public/sitemap.xml"
}

Add-Line '=== FILE SIZES ==='
Get-ChildItem (Join-Path $root 'scripts\.sitemap-cache\venues.json'), (Join-Path $root 'scripts\.sitemap-cache\sports.json'), (Join-Path $root 'public\sitemap.xml') | ForEach-Object {
  Add-Line ("{0} {1} {2}" -f $_.Mode, $_.Length, $_.FullName.Replace($root + '\', ''))
}
Add-Line '=== URL COUNT ==='
$locCount = (Select-String -Path (Join-Path $root 'public\sitemap.xml') -Pattern '<loc>' -AllMatches).Matches.Count
Add-Line $locCount
Add-Line '=== FIRST 20 LINES ==='
Get-Content (Join-Path $root 'public\sitemap.xml') -TotalCount 20 | ForEach-Object { Add-Line $_ }
$lines -join "`n" | Set-Content -Path $outFile -Encoding utf8
