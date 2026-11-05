# iPOST — Sifat nazorati (OTK): 12 bo‘limni tekshirish tizimi

1-bosqich. Tekshiruvchi bir daqiqada bitta bo‘lim tekshiruvini kiritadi; rahbar panelda qaysi bo‘lim qizil
ekanini bir qarashda ko‘radi. Ko‘ruvchi faqat o‘z bo‘limini ko‘radi.

Texnologiya: Next.js 15 (App Router), Prisma + PostgreSQL, vitest. Tashqi CDN, shrift va rasm yo‘q —
ofis tarmog‘ida internetsiz ishlaydi (brauzer faqat serverning o‘z manziliga murojaat qiladi).

> Taftish (murojaatlar) alohida loyiha. Eski Excel-KPI modeli (KPI, checklist, ish taqsimoti, reyestr)
> bu loyihadan olib tashlangan; u git tarixida va `pre-qc-rewrite` tegida saqlanadi.

## Ekranlar va rollar

| Ekran | Manzil | Rahbar | Tekshiruvchi | Ko‘ruvchi |
|---|---|:-:|:-:|:-:|
| Tekshiruv (bugungi) | `/tekshiruv` | ha | ha (boshlang‘ich) | — |
| Topshiriqlar | `/topshiriqlar` | ha | ha | — |
| Tarix (+ CSV) | `/tarix`, `/tarix/[id]` | ha | ha | — |
| Panel (svetofor) | `/panel` | ha (boshlang‘ich) | — | — |
| Sozlamalar, Foydalanuvchilar | `/sozlamalar` | ha | — | — |
| Bo‘limim | `/bolimim` | — | — | ha (boshlang‘ich) |

Rollar bazada: `HEAD` = Rahbar, `INSPECTOR` = Tekshiruvchi, `VIEWER` = Ko‘ruvchi (unga `deptId` — bo‘lim —
biriktiriladi: Sozlamalar → Foydalanuvchilar).

Ruxsat **faqat serverda** tekshiriladi (`src/qc/policy.ts` qoidalari, `src/server/qc.ts` har amalda
chaqiradi). Sahifa manzilini qo‘lda o‘zgartirib ham ruxsatsiz ekranga yoki boshqa bo‘lim ma’lumotiga
kirib bo‘lmaydi. Xato javoblari o‘zbekcha: 400 tekshiruv, 403 ruxsat, 404 topilmadi; kirishsiz `/api/*` — 401.

## Ishga tushirish

```bash
pnpm install
cp .env.example .env      # DATABASE_URL, DIRECT_URL, AUTH_SECRET ni to‘ldiring
pnpm db:migrate           # yoki produksiyada: pnpm exec prisma migrate deploy
pnpm db:seed              # xodimlar + 12 bo‘lim (har birida 8 nuqta); qayta ishga tushirish xavfsiz
pnpm dev                  # http://localhost:3100
```

Docker/Postgres yo‘q mashinada: `pnpm db:local` (alohida terminalda; port 5433), so‘ng `.env` yoki
`.env.local` ga `postgresql://otk:otk@localhost:5433/otk_crm` ni qo‘ying.

**Boshlang‘ich ma’lumot.** `prisma/qc-departments.json` — eski sozlamadan tanlangan 12 bo‘lim, har birida
4 guruhdan navbatma-navbat olingan 8 tagacha nuqta (`scripts/extract-qc-seed.ts`). `pnpm db:seed` mavjud
bo‘lim va nuqtalarga **tegmaydi** (rahbar tahrir qilgan bo‘lishi mumkin), faqat yo‘q bo‘limlarni qo‘shadi.
Hamma me’yor 90% va «taxminiy»: rahbar Sozlamalarda nuqtalarni ko‘rib chiqib, «jiddiy» belgisini qo‘yib,
me’yorni tasdiqlaydi.

Seed xodimlar (boshlang‘ich parol — `SEED_DEFAULT_PASSWORD`, birinchi kirishdan keyin almashtiring):
`jaloldin`, `ceo` (Rahbar); `ulugbek`, `jasur`, `saidali` (Tekshiruvchi). `SEED_DEMO=1 pnpm db:seed`
sinash uchun Call center ko‘ruvchisini (`callcenter`) ham yaratadi.

## Hisob qoidalari

Hammasi bitta sof modulda — `src/qc/calc.ts` (DB, DOM va tarmoqsiz; bir xil kirish — bir xil natija).
Ball, foiz va xulosa **saqlanmaydi**, har safar hisoblanadi.

- Ball = Σ og‘irlik(Ha) / Σ og‘irlik(Ha + Yo‘q) × 100; «Tegishli emas» hisobga olinmaydi; hammasi
  «Tegishli emas» bo‘lsa — «ma’lumot yo‘q».
- 5 ko‘rsatkich: umumiy ball (me’yor = bo‘lim me’yori), jiddiy holatlar (0), topshiriqlar muddatida
  bajarilishi (80%, taxminiy), muddati o‘tgan ochiq topshiriqlar (0), tekshiruvlar soni (faqat ma’lumot).
- Svetofor: foizda me’yorda — yashil, 10 punktgacha past — sariq, undan past — qizil; sonlida 0/1/2+.
  Bo‘lim rangi — 1–4 ning eng yomoni; jiddiy holat bo‘lsa — qizil. Ma’lumotsiz — kulrang.
- Xulosa (3 qator): Yomonlashdi / Yaxshilandi / Birinchi navbatda; davrda 5 tadan kam tekshiruv bo‘lsa —
  «Namuna kichik…», tekshiruv bo‘lmasa — «Bu davrda tekshiruv yo‘q».
- Sana/vaqt — Toshkent (UTC+5). Davrlar: Bugun, 7 kun, 30 kun (chegaralar kiritilgan).

## Testlar

```bash
pnpm test        # sof modullar: hisob, ruxsat, tekshirish, CSV, seed tanlash
pnpm typecheck
pnpm test:db     # server testlari haqiqiy PostgreSQL'da (alohida «otk_test» bazasi; pnpm db:local ishlab turishi kerak)
```

`pnpm test:db` `.env` dagi bazaga tegmaydi: lokal klasterda `otk_test` bazasini yaratib, migratsiyani
qo‘llaydi va `src/server/qc.integration.test.ts` ni ishga tushiradi (ruxsatlar, 400/403, `by` ni server
qo‘yishi, tekshiruv + topshiriqlarning bitta tranzaksiyada saqlanishi).

## Ochiq qarorlar (kelishilgan)

- Me’yorlar (ball 90%, muddatida bajarilish 80%) — taxminiy, rahbar tasdiqlaydi.
- Topshiriq mas’uli — erkin matn.
- Tekshiruv faqat bugungi sana bilan kiritiladi (kechikib kiritish yo‘q; faqat rahbar tuzatganda sanani
  o‘zgartira oladi).

## Eslatma

Loyihada git remote yo‘q — ishni GitLab’ga push qiling.
