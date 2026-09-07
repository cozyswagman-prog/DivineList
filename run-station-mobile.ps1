[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8790,

    [ValidatePattern('^(?:(?:25[0-5]|2[0-4][0-9]|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4][0-9]|1?\d{1,2})$')]
    [string]$Ip = '0.0.0.0'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$stationOllama = Join-Path $env:LOCALAPPDATA 'DivineList\ollama-0.33.3\ollama.exe'
$stationModels = Join-Path $env:LOCALAPPDATA 'DivineList\models'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js krävs för att starta DivineList.'
}
try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
} catch {
    if (Test-Path -LiteralPath $stationOllama) {
        $env:OLLAMA_HOST = '127.0.0.1:11434'
        $env:OLLAMA_NO_CLOUD = '1'
        $env:OLLAMA_NUM_PARALLEL = '1'
        $env:OLLAMA_MAX_LOADED_MODELS = '1'
        $env:OLLAMA_CONTEXT_LENGTH = '4096'
        $env:OLLAMA_MODELS = $stationModels
        Start-Process -FilePath $stationOllama -ArgumentList 'serve' -WindowStyle Hidden
    }
}

Write-Host "DivineList Skeppet mobilläge: ${Ip}:$Port/" -ForegroundColor Cyan
if ($Ip -eq '0.0.0.0') {
    Write-Host 'Servern lyssnar på alla nätverksgränssnitt. Hitta din lokala LAN-adress och testa t.ex. http://192.168.x.x:8790/.' -ForegroundColor Yellow
    Write-Host 'Håll brandväggen aktiv och endast ditt interna nätverk öppet.' -ForegroundColor Yellow
}
Write-Host 'Öppna adressen i webbläsaren. Stationen kör medan detta fönster är öppet. Ctrl+C stoppar kön.'
& node .\scripts\start-station-mobile.mjs --ip $Ip --port $Port
if ($LASTEXITCODE -ne 0) {
    throw 'Stationen kunde inte startas. Se felmeddelandet ovan.'
}
