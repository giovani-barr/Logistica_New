# ========================================
# Script para configurar cliente Firebird 2.5 (64-bit)
# ========================================

Write-Host ""
Write-Host "=== Configuracao do Cliente Firebird 2.5 (64-bit) ===" -ForegroundColor Cyan
Write-Host "Seu Python e 64-bit, mas o fbclient.dll no sistema e 32-bit." -ForegroundColor Yellow
Write-Host "Este script baixara o cliente correto SEM afetar seu Firebird 2.5 existente." -ForegroundColor Yellow
Write-Host ""

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$clientDir = Join-Path $projectDir "firebird_client"
$zipFile = Join-Path $clientDir "fb25_x64.zip"
$dllFile = Join-Path $clientDir "fbclient.dll"

# Verifica se ja existe
if (Test-Path $dllFile) {
    Write-Host "[OK] fbclient.dll 64-bit ja existe em: $dllFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Testando conexao com Python..." -ForegroundColor Cyan
    
    & "$projectDir\venv\Scripts\python.exe" "$projectDir\test_firebird.py"
    
    exit 0
}

Write-Host "[DOWNLOAD] Baixando Firebird 2.5.9 64-bit..." -ForegroundColor Cyan
Write-Host "Fonte: GitHub oficial do Firebird" -ForegroundColor Gray

try {
    # Cria diretorio se nao existir
    if (-not (Test-Path $clientDir)) {
        New-Item -ItemType Directory -Path $clientDir -Force | Out-Null
    }
    
    # Baixa o arquivo
    $url = "https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/Firebird-2.5.9.27139-0_x64.zip"
    Write-Host "URL: $url" -ForegroundColor Gray
    Invoke-WebRequest -Uri $url -OutFile $zipFile -UserAgent "Mozilla/5.0"
    
    Write-Host "[OK] Download concluido!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[EXTRAIR] Extraindo fbclient.dll..." -ForegroundColor Cyan
    
    # Extrai apenas o fbclient.dll
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipFile)
    
    $entry = $zip.Entries | Where-Object { $_.Name -eq "fbclient.dll" -and $_.FullName -like "*/bin/*" } | Select-Object -First 1
    
    if ($entry) {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dllFile, $true)
        Write-Host "[OK] fbclient.dll extraido com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] fbclient.dll nao encontrado no arquivo ZIP" -ForegroundColor Red
        exit 1
    }
    
    $zip.Dispose()
    
    # Remove o ZIP
    Remove-Item $zipFile -Force
    
    Write-Host ""
    Write-Host "[OK] Configuracao concluida!" -ForegroundColor Green
    Write-Host "Local: $dllFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[TESTE] Testando conexao com Python..." -ForegroundColor Cyan
    
    # Testa a conexao
    & "$projectDir\venv\Scripts\python.exe" "$projectDir\test_firebird.py"

    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Cyan
    Write-Host "1. Acesse: http://localhost:8000/firebird/conexao/" -ForegroundColor White
    Write-Host "2. Preencha os dados da conexao" -ForegroundColor White
    Write-Host "3. Clique em Testar Conexao" -ForegroundColor White
    Write-Host ""
    Write-Host "IMPORTANTE: Seu Firebird 2.5 existente NAO foi modificado!" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[ERRO] Erro ao baixar/extrair: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Download manual:" -ForegroundColor Cyan
    Write-Host "1. Baixe: https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/Firebird-2.5.9.27139-0_x64.zip" -ForegroundColor White
    Write-Host "2. Extraia o arquivo fbclient.dll da pasta bin" -ForegroundColor White
    Write-Host "3. Copie para: $dllFile" -ForegroundColor White
    Write-Host ""
    exit 1
}
