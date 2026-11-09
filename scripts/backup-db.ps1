<#
  Kunlik zaxira: PostgreSQL bazasini `pg_dump` (custom format) bilan saqlaydi, arxiv o'qilishini tekshiradi,
  eski nusxalarni o'chiradi. Windows Task Scheduler bilan ishga tushiriladi (docs/JOYLASHTIRISH.md, §6).

  Parol: skriptga YOZILMAYDI. `%APPDATA%\postgresql\pgpass.conf` faylida saqlang (format:
  host:port:baza:foydalanuvchi:parol) yoki PGPASSWORD muhit o'zgaruvchisini o'rnating.

  Chiqish kodi: 0 — muvaffaqiyatli, 1 — xato (Task Scheduler "so'nggi natija" ustunida ko'rinadi).
#>
param(
  [string]$PgBin     = 'C:\Program Files\PostgreSQL\16\bin',
  [string]$HostName  = 'localhost',
  [int]   $Port      = 5432,
  [string]$Database  = 'otk_crm',
  [string]$User      = 'otk',
  [string]$BackupDir = 'D:\otk-backup',
  [int]   $KeepDays  = 30
)

$ErrorActionPreference = 'Stop'
$log = Join-Path $BackupDir 'backup.log'

function Write-Log([string]$msg) {
  $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $msg
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding UTF8
}

try {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $file = Join-Path $BackupDir ('{0}_{1:yyyyMMdd_HHmm}.dump' -f $Database, (Get-Date))

  & "$PgBin\pg_dump.exe" -h $HostName -p $Port -U $User -d $Database -Fc -f $file
  if ($LASTEXITCODE -ne 0) { throw "pg_dump xato bilan tugadi (kod $LASTEXITCODE)" }

  $size = (Get-Item $file).Length
  if ($size -lt 1024) { throw "zaxira fayli juda kichik ($size bayt): $file" }

  # Arxiv o'qiladimi? (tiklash mumkinligining tezkor tekshiruvi; to'liq tiklash sinovi — JOYLASHTIRISH.md §6)
  & "$PgBin\pg_restore.exe" --list $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "pg_restore --list arxivni o'qiy olmadi: $file" }

  Write-Log ("OK  {0}  ({1:N1} MB)" -f $file, ($size / 1MB))

  Get-ChildItem -Path $BackupDir -Filter "$Database*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    ForEach-Object { Remove-Item $_.FullName -Force; Write-Log "o'chirildi (eski): $($_.Name)" }

  exit 0
}
catch {
  Write-Log "XATO  $($_.Exception.Message)"
  exit 1
}
