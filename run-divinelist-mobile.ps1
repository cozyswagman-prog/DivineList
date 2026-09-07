[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8787,

    [ValidatePattern('^(?:(?:25[0-5]|2[0-4][0-9]|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4][0-9]|1?\d{1,2})$')]
    [string]$Ip = '0.0.0.0'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw 'Node.js 22.13 eller senare saknas. Installera Node.js och kör skriptet igen.'
}

$nodeVersionText = (& node --version).Trim().TrimStart('v')
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]'22.13.0') {
    throw "Node.js $nodeVersionText är för gammalt. DivineList kräver minst 22.13.0."
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
    throw 'Beroenden saknas. Kör npm ci i DivineList-katalogen innan första starten.'
}

Write-Host "Startar DivineList mobilläge på ${Ip}:$Port/" -ForegroundColor Green
if ($Ip -eq '0.0.0.0') {
    Write-Host 'Servern lyssnar på alla nätverksgränssnitt. Hitta din lokala LAN-adress och testa t.ex. http://192.168.x.x:8787/.' -ForegroundColor Yellow
    Write-Host 'Håll brandväggen aktiv och endast ditt interna nätverk öppet.' -ForegroundColor Yellow
}

& node .\scripts\verify-release-report.mjs --silent
if ($LASTEXITCODE -ne 0) {
    throw 'Den aktuella källkoden och produktionsbyggnaden saknar en verifierad PASS-releaseattest. Kör npm run check och starta sedan igen.'
}

& node .\scripts\start-local-mobile.mjs --ip $Ip --port $Port
if ($LASTEXITCODE -ne 0) {
    throw "DivineList-servern stoppades med exitkod $LASTEXITCODE."
}
