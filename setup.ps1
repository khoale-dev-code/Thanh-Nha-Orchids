#requires -Version 5.1
<#
.SYNOPSIS
  Khoi tao WebApp Vuon Lan Thanh Nha. Windows PowerShell 5.1+.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DryRun
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Check
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Production
#>
[CmdletBinding(DefaultParameterSetName='Run')]
param(
 [Parameter(ParameterSetName='Dry')][switch]$DryRun,
 [Parameter(ParameterSetName='Check')][switch]$Check,
 [Parameter(ParameterSetName='Prod')][switch]$Production
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$required = @('package.json','next.config.ts','src\app\page.tsx','supabase\migrations\001_initial.sql','public\manifest.webmanifest','public\brand\logo-doc-sang.png')
function Say([string]$Message) { Write-Host ('[THANH NHA] ' + $Message) -ForegroundColor Green }
function Warn([string]$Message) { Write-Host ('[CANH BAO] ' + $Message) -ForegroundColor Yellow }
function AssertProject {
 foreach($name in $required) {
  if(-not (Test-Path -LiteralPath (Join-Path $project $name))) { throw "Khong tim thay $name. Hay giai nen day du ZIP va chay setup.ps1 tai thu muc goc." }
 }
}
function TestNode {
 $nodeCmd = Get-Command 'node' -ErrorAction SilentlyContinue
 $npmCmd = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
 if(-not $nodeCmd -or -not $npmCmd) { throw 'Khong tim thay Node.js hoac npm. Hay cai Node.js LTS (>= 20.9), mo lai PowerShell.' }
 $ver = (& node --version).Trim().TrimStart('v')
 $parts = $ver.Split('.')
 if([int]$parts[0] -lt 20 -or ([int]$parts[0] -eq 20 -and [int]$parts[1] -lt 9)) { throw "Node.js $ver khong dat yeu cau. Can >= 20.9." }
 Say "Node.js $ver; npm $((& npm.cmd --version).Trim())"
}
function HasCloud {
 $envPath = Join-Path $project '.env.local'
 if(-not (Test-Path -LiteralPath $envPath)) { return $false }
 $raw = Get-Content -LiteralPath $envPath -Raw
 return ($raw -match '(?m)^NEXT_PUBLIC_SUPABASE_URL=\S+' -and $raw -match '(?m)^NEXT_PUBLIC_SUPABASE_ANON_KEY=\S+')
}
Say "Project: $project"
AssertProject
if($DryRun) {
 Say 'DRY RUN: Khong tao/sua/xoa file. Khong cai package. Khong khoi dong server.'
 Write-Host 'Plan:'
 Write-Host '  1. Check Node.js + npm.'
 Write-Host '  2. Neu chua co .env.local, tao bang mau .env.example (chi trong che do Run).'
 Write-Host '  3. npm install (neu node_modules chua co).'
 Write-Host '  4. npm run dev (hoac typecheck + build voi -Production).'
 Write-Host '  5. Demo local neu chua co Supabase; KHONG tu tao schema Supabase.'
 exit 0
}
TestNode
if($Check) {
 Say 'CHECK: chi doc thong tin, khong thay doi file.'
 if(Test-Path (Join-Path $project '.env.local')) { Say '.env.local: da ton tai' } else { Warn '.env.local: chua ton tai' }
 if(HasCloud) { Say 'Supabase: co URL va anon key (chua kiem tra ket noi)' } else { Warn 'Supabase: chua ket noi. Ung dung se la DEMO.' }
 if(Test-Path (Join-Path $project 'node_modules')) { Say 'node_modules: da ton tai' } else { Warn 'Chua cai dependencies' }
 exit 0
}
Push-Location $project
try {
 $envPath = Join-Path $project '.env.local'
 if(-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath (Join-Path $project '.env.example') -Destination $envPath
  Say 'Da tao .env.local tu mau. Chi file moi duoc tao, khong ghi de file cu.'
 }
 if($Production -and -not (HasCloud)) { throw 'Can cau hinh NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local truoc khi -Production. Mau DEMO khong duoc xem la production.' }
 if(-not (Test-Path (Join-Path $project 'node_modules'))) {
  Say 'Dang cai dependencies tu npm. Can ket noi Internet.'
  & npm.cmd install --no-audit --no-fund
  if($LASTEXITCODE -ne 0) { throw "npm install that bai (exit $LASTEXITCODE)." }
 } else { Say 'Da co node_modules; khong cai lai.' }
 if($Production) {
  Say 'Kiem tra logic tinh tien...'
  & npm.cmd run check:logic
  if($LASTEXITCODE -ne 0) { throw "Check logic that bai (exit $LASTEXITCODE)." }
  Say 'Kiem tra TypeScript...'
  & npm.cmd run typecheck
  if($LASTEXITCODE -ne 0) { throw "TypeScript check that bai (exit $LASTEXITCODE)." }
  Say 'Kiem tra build production...'
  & npm.cmd run build
  if($LASTEXITCODE -ne 0) { throw "Production build that bai (exit $LASTEXITCODE)." }
  Say 'Build thanh cong. Chay npm run start de chay ban production sau khi deploy/kiem tra.'
 } else {
  if(-not (HasCloud)) { Warn 'DANG CHAY DEMO: du lieu chi trong localStorage cua trinh duyet. Khong nhap du lieu khach that.' }
  Say 'Mo http://localhost:3000. Nhan Ctrl+C de dung dev server.'
  & npm.cmd run dev
  if($LASTEXITCODE -ne 0) { throw "Dev server ket thuc voi exit $LASTEXITCODE." }
 }
} finally { Pop-Location }
