# Ofis serveriga joylashtirish (Windows)

Maqsad: ilova ofis serverida (Windows, o‘z PostgreSQL, 10–50 xodim, ichki tarmoq) **servis** sifatida ishlasin,
kompyuter qayta yoqilganda o‘zi turib ketsin, har kuni zaxira olinsin, yangilash esa xavfsiz bo‘lsin.
Arxitektura qarori: [ADR 0001](adr/0001-modulli-monolit.md).

> **Tekshirilganlik.** §1–§5, §8 dagi buyruqlar shu loyihada ishga tushirilgan (build, `next start`, `/api/health`,
> ekranlar). Servis (NSSM), vazifalar rejalashtiruvchisi (zaxira) va internetsiz o‘rnatish (§7) — **ofis serverida
> bir marta sinab ko‘rilishi kerak**; ular qo‘llanma sifatida yozilgan.

## 1. Nimalar kerak

| Narsa | Versiya | Izoh |
|---|---|---|
| Windows | 10/11 yoki Server 2019+ | |
| Node.js | 20 yoki yangi (sinalgan: 24) | `node --version` |
| pnpm | 9.x | `corepack enable` (Node bilan keladi) |
| PostgreSQL | 15+ (sinalgan: 18 embedded) | shu serverda yoki ichki tarmoqda |
| NSSM | 2.24 | servis yaratish uchun (<https://nssm.cc>), yoki pm2 — §4 |

Internet **ishlash uchun shart emas**: ilova tashqi CDN, shrift, rasm va analitika ishlatmaydi (build natijasi
tekshirilgan: faqat Next.js xato-xabar havolalari va XML nom maydonlari — ular yuklanmaydi). Internet faqat
o‘rnatish/yangilashda (`pnpm install`) kerak — internetsiz variant §7.

## 2. Baza

PostgreSQL’da alohida baza va foydalanuvchi (psql yoki pgAdmin):

```sql
CREATE USER otk WITH PASSWORD 'KUCHLI_PAROL';
CREATE DATABASE otk_crm OWNER otk ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
```

`LC_COLLATE 'C'` — test bazasi ham shunday: tartiblash natijasi serverning mintaqaviy sozlamasiga bog‘liq bo‘lmaydi.
PostgreSQL faqat serverning o‘zidan ulanishga ruxsat bersin (`pg_hba.conf`: `127.0.0.1/32`), tashqi tarmoqqa ochmang.

## 3. Ilovani o‘rnatish

```powershell
# 1) kodni qo'ying (git clone yoki arxivni oching): masalan C:\apps\ipost-otk-crm
cd C:\apps\ipost-otk-crm

# 2) paketlar (internet kerak; internetsiz — §7)
pnpm install --frozen-lockfile

# 3) sozlama
copy .env.example .env
notepad .env       # DATABASE_URL, DIRECT_URL, AUTH_SECRET (kamida 32 belgi!), COOKIE_SECURE ni to'ldiring

# 4) jadvallar va boshlang'ich ma'lumot
pnpm exec prisma migrate deploy
pnpm db:seed       # xodimlar + 12 bo'lim; qayta ishga tushirish xavfsiz (mavjudga tegmaydi)

# 5) yig'ish va sinab ko'rish
pnpm build
pnpm start         # http://localhost:3100
```

Tekshiruv (boshqa oynada):

```powershell
curl http://localhost:3100/api/health
# {"status":"ok","db":"up","dbMs":12,"uptimeSec":5,"time":"…"}   ← 200 = ishlayapti, 503 = baza javob bermayapti
```

`.env` dagi muhim qiymatlar ([`.env.example`](../.env.example)): server ishga tushganda zod bilan tekshiriladi
(`src/shared/env.ts`) — noto‘g‘ri bo‘lsa jarayon **qaysi qiymat xato ekanini yozib** to‘xtaydi.

**HTTP va cookie.** Ofis tarmog‘ida HTTPS yo‘q bo‘lsa (`http://192.168.x.x:3100`), `.env` ga `COOKIE_SECURE="false"`
yozing. Aks holda brauzer `Secure` cookie’ni saqlamaydi va **hech kim kira olmaydi** (`localhost` bundan mustasno,
shuning uchun serverning o‘zida hammasi ishlab, boshqa kompyuterdan kirilmasligi mumkin). HTTPS (reverse proxy,
masalan Caddy/IIS ARR) qo‘ysangiz — qatorni o‘chiring va `TRUSTED_PROXY_HOPS="1"` qiling.

**Seed parol.** `SEED_DEFAULT_PASSWORD` boshlang‘ich parol; hammaga birinchi kirishda almashtirish majburiy
(`pnpm users:force-password-change` — mavjud hisoblarga ham majburlash).

## 4. Servis sifatida ishlatish

### Variant A — NSSM (tavsiya)

```powershell
# PowerShell (administrator). Yo'llarni o'zingiznikiga moslang.
nssm install OtkCrm "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -p 3100"
nssm set OtkCrm AppDirectory C:\apps\ipost-otk-crm
nssm set OtkCrm AppEnvironmentExtra TZ=Asia/Tashkent
nssm set OtkCrm Start SERVICE_AUTO_START
nssm set OtkCrm AppExit Default Restart            # qulasa — qayta ishga tushiradi
nssm set OtkCrm AppRestartDelay 5000
nssm set OtkCrm AppStdout C:\apps\ipost-otk-crm\logs\out.log
nssm set OtkCrm AppStderr C:\apps\ipost-otk-crm\logs\err.log
nssm set OtkCrm AppRotateFiles 1
nssm set OtkCrm AppRotateOnline 1
nssm set OtkCrm AppRotateBytes 10485760            # 10 MB da aylantirish
mkdir C:\apps\ipost-otk-crm\logs
nssm start OtkCrm
```

`.env` ni Next.js o‘zi `AppDirectory` dan o‘qiydi. Jurnal — bir qatorli JSON (`{"time":…,"level":"error","msg":…}`):
`err.log` ga xatolar va ogohlantirishlar, `out.log` ga ma‘lumot yozuvlari (kirishlar, ishga tushish) tushadi.

Boshqarish: `nssm restart OtkCrm`, `nssm stop OtkCrm`, `nssm status OtkCrm`; o‘chirish: `nssm remove OtkCrm confirm`.

### Variant B — pm2

```powershell
npm i -g pm2 pm2-windows-startup
pm2 start node_modules\next\dist\bin\next --name otk-crm -- start -p 3100
pm2 save
pm2-startup install        # Windows qayta yoqilganda tiklash
```

### Muhim: bitta jarayon

Kirishni cheklash (5 noto‘g‘ri urinish → 15 daqiqa qulf) **jarayon xotirasida** turadi. Ilovani **bitta nusxada**
ishlating (pm2 `-i max` / cluster rejimi ishlatmang): bir nechta nusxada cheklov har biriga alohida hisoblanadi.
10–50 xodim uchun bitta jarayon bemalol yetadi.

### Port va xavfsizlik devori

```powershell
New-NetFirewallRule -DisplayName "OTK CRM (3100)" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow -Profile Private,Domain
```

Faqat ichki tarmoq (Private/Domain) profilida oching. Internetga chiqarmang.

## 5. Yig‘ma haqida (`output: 'standalone'`)

Next.js’ning `output: 'standalone'` rejimi (node_modules’siz kichik yig‘ma) **yoqilmagan**: Windows’da pnpm bilan
build paytida `EPERM: symlink` xatosi bilan yiqiladi (symlink yaratish uchun administrator yoki «Developer Mode»
kerak) va `pnpm` ning symlink tuzilmasi bilan yaxshi ishlamaydi. Ofis serveri `next start` bilan to‘liq ishlaydi;
diskdagi farq (bir necha yuz MB `node_modules`) ofis serveri uchun muammo emas. Kerak bo‘lib qolsa — build
mashinasida Developer Mode’ni yoqib sinab ko‘rish mumkin.

## 6. Zaxira (pg_dump)

Skript: [`scripts/backup-db.ps1`](../scripts/backup-db.ps1) — `pg_dump -Fc`, arxivni `pg_restore --list` bilan
tekshiradi, 30 kundan eskisini o‘chiradi, natijani `backup.log` ga yozadi.

1. Parolni skriptga yozmang — `%APPDATA%\postgresql\pgpass.conf` (servis foydalanuvchisi ostida):
   `localhost:5432:otk_crm:otk:KUCHLI_PAROL`
2. Qo‘lda sinab ko‘ring:
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\apps\ipost-otk-crm\scripts\backup-db.ps1 -BackupDir D:\otk-backup
   ```
3. Har kuni kechasi (masalan 02:00) — Task Scheduler:
   ```powershell
   schtasks /Create /TN "OTK zaxira" /SC DAILY /ST 02:00 /RU SYSTEM `
     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\apps\ipost-otk-crm\scripts\backup-db.ps1 -BackupDir D:\otk-backup"
   ```
   (`SYSTEM` ostida `pgpass.conf` boshqa joyda bo‘ladi — `PGPASSFILE` ni vazifaga o‘rnating yoki maxsus foydalanuvchi bilan yuriting.)
4. Zaxirani **boshqa diskka/kompyuterga** ham nusxalang (bitta serverning ichidagi zaxira diskdan ayrilganda yo‘qoladi).
5. **Tiklashni sinab ko‘ring** (zaxira faqat tiklab ko‘rilgandagina zaxira hisoblanadi) — kamida oyda bir marta, alohida bazaga:
   ```powershell
   createdb -U postgres otk_restore_test
   pg_restore -U postgres -d otk_restore_test --no-owner --no-privileges D:\otk-backup\otk_crm_YYYYMMDD_HHMM.dump
   # ichini tekshiring (masalan: SELECT count(*) FROM "QcAudit";), so'ng:
   dropdb -U postgres otk_restore_test
   ```
   Haqiqiy tiklash (baza buzilganda): servisni to‘xtating → bazani qayta yarating → `pg_restore` → servisni yoqing.

## 7. Yangilash tartibi

Har yangilashda shu tartib (tartibni buzmang: avval zaxira):

```powershell
cd C:\apps\ipost-otk-crm
# 1) zaxira (har doim!)
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1 -BackupDir D:\otk-backup
# 2) yangi kod
git pull                      # yoki yangi arxivni ustiga oching (.env va logs ga tegmang)
pnpm install --frozen-lockfile
# 3) jadval o'zgarishlari — faqat YANGI migratsiyalarni qo'llaydi, mavjud ma'lumotga tegmaydi
pnpm exec prisma migrate deploy
# 4) yig'ish va qayta ishga tushirish
pnpm build
nssm restart OtkCrm
# 5) tekshiruv
curl http://localhost:3100/api/health
```

- **Hech qachon** serverda `prisma migrate dev`, `migrate reset`, `db push --force-reset` ishlatmang — ular ma‘lumotni o‘chirishi mumkin.
  Serverda faqat `migrate deploy`.
- Yangilash paytida ilova bir necha daqiqa mavjud bo‘lmaydi: ish soatlaridan tashqarida qiling.
- **Orqaga qaytarish:** kodni oldingi versiyaga qaytaring (`git checkout <teg>`), `pnpm install`, `pnpm build`, `nssm restart`.
  Agar yangi migratsiya qo‘llangan bo‘lsa — kod emas, **bazani** zaxiradan tiklash kerak bo‘lishi mumkin (§6).
- Seed (`pnpm db:seed`) yangilashda odatda kerak emas; yangi bo‘lim yoki o‘quv mazmuni qo‘shilgandagina.

### Internetsiz server

`pnpm install` paketlarni internetdan oladi, Prisma esa o‘z dvigatelini (`query engine`) o‘rnatish paytida yuklaydi.
Server internetsiz bo‘lsa, ikki yo‘l bor:

1. **Vaqtincha internet** (eng oddiy): o‘rnatish/yangilash vaqtida serverga internet bering, tugagach uzing. Ishlash uchun kerak emas.
2. **Boshqa kompyuterda tayyorlab ko‘chirish:** internetli, **bir xil OS/Node/pnpm** kompyuterda `pnpm install --frozen-lockfile`
   va `pnpm build` qiling, so‘ng butun papkani (`node_modules`, `.next` bilan) serverga nusxalang va `pnpm exec prisma migrate deploy`
   ni ishga tushiring. pnpm `node_modules` ichida junction/symlink ishlatadi: nusxalashni `robocopy <manba> <maqsad> /E /SJ /SL`
   bilan qiling. *Bu yo‘l ofis serverida bir marta sinab ko‘rilishi kerak.*

## 8. Kuzatuv va nosozliklar

| Belgi | Tekshiring |
|---|---|
| Sahifa ochilmaydi | `nssm status OtkCrm`; `curl http://localhost:3100/api/health`; `logs\err.log` |
| `/api/health` → 503 | PostgreSQL xizmati ishlayaptimi (`services.msc`); `DATABASE_URL`; `err.log` dagi `health.degraded` |
| Servis ishga tushmaydi, `err.log` da «Muhit sozlamalari noto‘g‘ri» | `.env` — xabarda qaysi qiymat xato ekani yozilgan |
| Boshqa kompyuterdan kirib bo‘lmaydi, serverning o‘zida bo‘ladi | `COOKIE_SECURE="false"` (§3); xavfsizlik devori (§4) |
| «Juda ko‘p urinish» (login qulfi) | 15 daqiqa kuting yoki `nssm restart OtkCrm` (qulf xotirada) |
| Hamma qayta kirishga majbur bo‘ldi | `AUTH_SECRET` o‘zgargan bo‘lishi mumkin |

Ish jurnali (`out.log`/`err.log`) — bir qatorli JSON: `Select-String '"level":"error"' logs\err.log`.
Biznes o‘zgarishlar tarixi (kim nimani o‘zgartirdi) — ilovada: **Sozlamalar → O‘zgarishlar jurnali**.

Vaqt: server `Asia/Tashkent` da bo‘lishi shart emas (ilova «kun» chegarasini o‘zi Toshkent bo‘yicha hisoblaydi,
bazada UTC), lekin `TZ=Asia/Tashkent` (§4) hisobotlarda chalkashlikni kamaytiradi.
