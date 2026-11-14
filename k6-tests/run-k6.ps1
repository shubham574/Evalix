<#
.SYNOPSIS
  InterviewAce - Grafana k6 Module-by-Module Load Testing Suite

.DESCRIPTION
  Runs k6 tests for each module of the InterviewAce project one by one for 100 users for 15 seconds.

.PARAMETER BaseUrl
  The target backend URL (default: http://localhost:5000)

.PARAMETER Vus
  The number of concurrent virtual users (default: 100)

.PARAMETER Duration
  The duration of the test per module (default: 15s)

.PARAMETER AuthToken
  Clerk Bearer auth token (default: test-token)

.PARAMETER Module
  Specific module to run, e.g. "01_health", "02_dashboard" (optional, runs all if omitted)

.EXAMPLE
  .\run-k6.ps1
  .\run-k6.ps1 -Module 01_health
  .\run-k6.ps1 -BaseUrl "http://localhost:5000" -Vus 100 -Duration "15s"
#>

param (
    [string]$BaseUrl = "http://localhost:5000",
    [int]$Vus = 100,
    [string]$Duration = "15s",
    [string]$AuthToken = "test-token",
    [string]$Module = "",
    [string]$Sleep = "0.3"
)

# Ensure k6 is available in PATH
$k6Path = (Get-Command k6 -ErrorAction SilentlyContinue)
if (-not $k6Path) {
    # Check if newly installed in Machine/User PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $k6Path = (Get-Command k6 -ErrorAction SilentlyContinue)
}

if (-not $k6Path) {
    Write-Host "[ERROR] k6 is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Grafana k6 via: winget install GrafanaLabs.k6" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   InterviewAce - Grafana k6 Module Load Tester" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Target URL : $BaseUrl" -ForegroundColor White
Write-Host "Load       : $Vus Virtual Users" -ForegroundColor White
Write-Host "Duration   : $Duration per module" -ForegroundColor White
Write-Host "Auth Token : $AuthToken" -ForegroundColor White
Write-Host "k6 Binary  : $($k6Path.Source)" -ForegroundColor Gray
Write-Host "========================================================`n" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$modulesDir = Join-Path $scriptDir "modules"

# Get modules list
if ($Module -ne "") {
    $matched = Get-ChildItem -Path $modulesDir -Filter "*$Module*.js"
    if (-not $matched) {
        Write-Host "[ERROR] Module '$Module' not found in $modulesDir" -ForegroundColor Red
        exit 1
    }
    $moduleFiles = $matched
} else {
    $moduleFiles = Get-ChildItem -Path $modulesDir -Filter "*.js" | Sort-Object Name
}

$results = @()
$totalStart = Get-Date

foreach ($file in $moduleFiles) {
    $moduleName = $file.BaseName
    Write-Host "`n--------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "▶ Running Module: $moduleName ($Vus VUs for $Duration)..." -ForegroundColor Yellow
    Write-Host "--------------------------------------------------------" -ForegroundColor Yellow

    $moduleStart = Get-Date
    
    # Run k6 with environment variables and parameters
    & k6 run `
        --vus $Vus `
        --duration $Duration `
        -e BASE_URL="$BaseUrl" `
        -e AUTH_TOKEN="$AuthToken" `
        -e SLEEP="$Sleep" `
        "$($file.FullName)"
    
    $exitCode = $LASTEXITCODE
    $moduleElapsed = [math]::Round(((Get-Date) - $moduleStart).TotalSeconds, 1)

    $status = if ($exitCode -eq 0) { "PASSED" } else { "FAILED" }
    $results += [PSCustomObject]@{
        Module   = $moduleName
        Status   = $status
        Duration = "${moduleElapsed}s"
    }

    # Brief cooldown between modules
    Start-Sleep -Seconds 1
}

$totalElapsed = [math]::Round(((Get-Date) - $totalStart).TotalSeconds, 1)

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "              TEST EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
Write-Host "Total execution time: ${totalElapsed}s`n" -ForegroundColor Green
