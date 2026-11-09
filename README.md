# iPOST — Sifat nazorati (OTK): 12 bo‘limni tekshirish tizimi

1-bosqich. Tekshiruvchi bir daqiqada bitta bo‘lim tekshiruvini kiritadi; rahbar panelda qaysi bo‘lim qizil
ekanini bir qarashda ko‘radi. Ko‘ruvchi faqat o‘z bo‘limini ko‘radi.

Texnologiya: Next.js 15 (App Router), Prisma + PostgreSQL, zod, vitest. Ofis serverida ishlaydi (Windows, o‘z PostgreSQL). Tashqi CDN, shrift va rasm yo‘q —
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
| O‘quv dasturi, Yakuniy test | `/oquv`, `/oquv/test/[bo‘lim]` | ha | ha | — |
| O‘quv natijalari (+ CSV) | `/natijalar` | ha | — | — |
| Haftalik hisobot (A4 chop etish) | `/hisobot` | ha (izoh yozadi) | ha (o‘qiydi) | — |
| Sozlamalar, Foydalanuvchilar, O‘zgarishlar jurnali | `/sozlamalar`, `/sozlamalar/jurnal` | ha | — | — |
| Parolni almashtirish | `/profil` | ha | ha | ha |
| Bo‘limim | `/bolimim` | — | — | ha (boshlang‘ich) |

Rollar bazada: `HEAD` = Rahbar, `INSPECTOR` = Tekshiruvchi, `VIEWER` = Ko‘ruvchi (unga `deptId` — bo‘lim —
biriktiriladi: Sozlamalar → Foydalanuvchilar).

Ruxsat **faqat serverda** tekshiriladi (qoidalar — `src/modules/foydalanuvchilar/domain/policy.ts`, use-case har amalda
chaqiradi). Sahifa manzilini qo‘lda o‘zgartirib ham ruxsatsiz ekranga yoki boshqa bo‘lim ma’lumotiga
kirib bo‘lmaydi. Xato javoblari o‘zbekcha: 400 tekshiruv, 403 ruxsat, 404 topilmadi; kirishsiz `/api/*` — 401.

## Arxitektura

Modulli monolit: `src/modules/{foydalanuvchilar, bolimlar, auditlar, hisobot, oquv, jurnal}`, har birida
`domain → application → infrastructure → ui` qatlamlari; umumiy yadro — `src/shared`. Prisma'ni faqat `infrastructure` biladi,
modullar faqat ochiq API orqali gaplashadi; qoidalar `src/architecture.test.ts` va ESLint bilan qulflangan.

- [`docs/ARXITEKTURA.md`](docs/ARXITEKTURA.md) — xarita: papkalar, modullar, oqim, ruxsat, xato, yangi funksiya qo‘shish tartibi.
- [`docs/adr/0001-modulli-monolit.md`](docs/adr/0001-modulli-monolit.md) — qaror va sabablar.
- [`docs/JOYLASHTIRISH.md`](docs/JOYLASHTIRISH.md) — ofis serveriga o‘rnatish (Windows servis, zaxira, yangilash).
- `GET /api/health` — ilova va baza holati (monitoring uchun).

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

Hammasi sof `domain` fayllarida — `src/modules/auditlar/domain` (ball) va `src/modules/hisobot/domain` (svetofor, xulosa);
DB, DOM va tarmoqsiz: bir xil kirish — bir xil natija.
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

## O‘quv moduli va haftalik hisobot (2-bosqich)

- **O‘quv dasturi** — 12 bo‘lim, har birida 5 kunlik reja (nazariya + topshiriqlar). Xodim topshiriqni belgilaydi
  (qayta bossa olib tashlanadi). Hamma topshiriq belgilangach «Testni boshlash» yonadi; sababi yozilgan.
- **Yakuniy test** — Call centerda 10 keysli, qolgan 11 bo‘limda 7 savolli (eski quiz). Savollar va variantlar har
  ochilganda aralashadi. **To‘g‘ri javob (`answer`, `why`) test topshirilgunga qadar brauzerga yuborilmaydi**:
  baholashni faqat server bajaradi (`gradeTest` — `src/modules/oquv/domain/training.ts`; har to‘g‘ri javob 1 ball, o‘tish ≥ 70%).
  Topshiriqlar to‘liq bo‘lmasa server 409, javobsiz topshirish 400 qaytaradi. Urinish cheklanmagan.
- **Natijalar** (rahbar) — xodim × bo‘lim, bajarilgan topshiriq, oxirgi/eng yaxshi foiz, holat, urinishlar va xato
  qilingan savollar; CSV. Sahifa o‘zi yangilanadi.
- **Haftalik hisobot** — dushanba–yakshanba, boshlang‘ich: o‘tgan hafta. 12 bo‘lim jadvali, qizil bo‘limlar xulosasi,
  rahbar izohi; «Chop etish» — A4, ranglar yonida matn («yashil/sariq/qizil/ma’lumot yo‘q»).
- O‘quv mazmuni ilovadan tahrirlanmaydi: `prisma/training/base.json` (eski sozlamadan ko‘chirilgan) va
  `prisma/training/oquv_<bo‘lim>_keys.json` fayllaridan `pnpm db:seed` yuklaydi. Yangi keys-fayl qo‘yilsa (masalan
  `oquv_kuryerka_keys.json`: `{pass, questions:[{id,case,options[4],answer,why}]}`), faqat shu bo‘limda dastur hali
  yuklanmagan bo‘lsa olinadi — mavjud bo‘limga seed tegmaydi.

## Ishonchlilik va xavfsizlik

- **O‘zgarishlar jurnali** (`/sozlamalar/jurnal`, faqat rahbar): bo‘lim/nuqta/me‘yor o‘zgarishi (oldin → keyin),
  tekshiruvni tuzatish va **o‘chirish** (o‘chirilgan tekshiruvning to‘liq nusxasi jurnalda qoladi), topshiriq tahriri,
  foydalanuvchi o‘zgarishi, hisobot izohi. Jurnal asosiy amal bilan **bitta tranzaksiyada** yoziladi: izsiz o‘zgarish
  bo‘lmaydi. Yozuvlar o‘zgartirilmaydi va o‘chirilmaydi.
- **Og‘irlik muzlatiladi.** Tekshiruv kiritilganda nuqta og‘irliklari tekshiruvning o‘ziga nusxalanadi (`QcAudit.weights`):
  keyin rahbar og‘irlikni o‘zgartirsa, **o‘tgan tekshiruvlar bali o‘zgarmaydi**. (Me‘yor esa joriy qiymat bo‘yicha
  qo‘llanadi; uning o‘zgarishi jurnalda ko‘rinadi.)
- **Parol:** foydalanuvchi o‘zi almashtiradi (`/profil`: joriy parol, kamida 8 belgi, harf+raqam, boshlang‘ich/oddiy
  parollar rad etiladi). Yangi hisob yoki rahbar parolni qayta o‘rnatganda keyingi kirishda almashtirish **majburiy**
  (server shuni har amalda tekshiradi). Ishlab chiqarishga o‘tishda hammaga majburlash: `pnpm users:force-password-change`.
- **Kirishni cheklash:** bir login uchun 5 ta, bir manzil uchun 30 ta noto‘g‘ri urinishdan keyin 15 daqiqa qulf
  (jarayon xotirasida; server qayta ishga tushsa tozalanadi). Manzil bo‘yicha cheklov faqat ishonchli proxy ortida
  ishlaydi (`TRUSTED_PROXY_HOPS=1`): proxysiz `X-Forwarded-For` ni mijoz soxtalashtira oladi, shuning uchun u holda
  faqat login bo‘yicha cheklanadi. Mavjud bo‘lmagan login ham haqiqiy bcrypt solishtiruvidan o‘tadi — javob vaqtidan
  login borligini bilib bo‘lmaydi.
- **Sessiyani bekor qilish:** `User.sessionVersion` har so‘rovda tekshiriladi. Parolni almashtirish, rahbar parolni
  qayta o‘rnatishi, hisobni o‘chirish va «Chiqish» shu foydalanuvchining **hamma qurilmalardagi** sessiyalarini
  darhol bekor qiladi (nusxalangan token ham ishlamaydi).
- **Nuqtalar sifati:** `docs/nuqtalar-tavsiya.md` — rahbar uchun «jiddiy» va og‘irlik bo‘yicha tavsiya. Bazadagi
  bo‘limlar matnini yangilash: `pnpm exec tsx scripts/update-checkpoint-texts.ts [--apply]`.

## Hodimlar kesimida tekshirish (4-bosqich)

To‘liq spetsifikatsiya: [`docs/spec-hodimlar-kesimida.md`](docs/spec-hodimlar-kesimida.md).

- **Sozlamalar → bo‘lim:** «Hodimlar» ro‘yxati (bir nechtasini vergul bilan qo‘shish, yashirish) va har nuqtada
  «Turi»: *Butun bo‘lim: Ha / Yo‘q* (eski), *Har hodim: Ha / Yo‘q* (masalan «Topshirdi / Topshirmadi»),
  *Har hodim: son* (masalan «Sifatli yopdi / Yopa olmadi», «Vaqtida / Kechikdi»). Yorliqlarni rahbar yozadi.
- **Tekshiruv:** «Smenada kim bor» (kelmaganlar olib tashlanadi), har hodim qatori, «yomon» natijada sabab
  majburiy, kartada jonli xulosa («3 / 4 hodim · 75%», «Jami 159: … · 95% · 2 hodimda»).
- **Ball:** hodimli nuqta 0..1 ulush beradi (yaxshi / jami) — «3 / 4» va «0 / 4» endi bir xil «Yo‘q» emas.
  Oddiy nuqtalar va eski tekshiruvlar bali o‘zgarmaydi. Umumiy javob natijalardan hosil qilinadi.
- **Hisobot:** tekshiruv tafsilotida hodimlar jadvali; Panel / Bo‘limim da «Hodimlar kesimida» — eng zaifi tepada.

## Testlar

```bash
pnpm test        # sof modullar (hisob, ruxsat, tekshirish, CSV, test baholash, hafta, env) + arxitektura testi
pnpm typecheck
pnpm lint        # ESLint, jumladan arxitektura qoidalari (no-restricted-imports)
pnpm test:db     # server testlari haqiqiy PostgreSQL'da (alohida «otk_test» bazasi; pnpm db:local ishlab turishi kerak)
```

`pnpm test:db` `.env` dagi bazaga tegmaydi: lokal klasterda `otk_test` bazasini yaratib, migratsiyani
qo‘llaydi va `src/integration/*.integration.test.ts` ni ishga tushiradi (ruxsatlar, 400/403, `by` ni server
qo‘yishi, tekshiruv + topshiriqlarning bitta tranzaksiyada saqlanishi, o‘quv va hisobot).

## Ochiq qarorlar (kelishilgan)

- Me’yorlar (ball 90%, muddatida bajarilish 80%) — taxminiy, rahbar tasdiqlaydi.
- Topshiriq mas’uli — erkin matn.
- Tekshiruv faqat bugungi sana bilan kiritiladi (kechikib kiritish yo‘q; faqat rahbar tuzatganda sanani
  o‘zgartira oladi).

## Eslatma

Loyihada git remote yo‘q — ishni GitLab’ga push qiling.
