# GitHub에 gakong-pro 저장소 생성 및 푸시
# 사전 조건: gh auth login 완료

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "GitHub 로그인 확인..."
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "먼저 로그인하세요: gh auth login"
    exit 1
}

Write-Host ""
Write-Host "저장소 생성 및 푸시..."
gh repo create gakong-pro --public --source=. --remote=origin --push --description "가공관리 Pro - 금속가공업체 미니 ERP"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "완료! 저장소 URL:"
    gh repo view --web 2>$null
    git remote get-url origin
}
