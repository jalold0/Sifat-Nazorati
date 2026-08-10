# iPOST — Sifat nazorati (OTK) bo'limi KPI tizimi

Kichik CRM: kunlik reyestr, avtomatik KPI hisobi, checklist auditlari, quvvat (shtat) hisobi va
oylik hisobot. Rahbariyat (CEO) bevosita nazoratida — har bir raqamning manbasi va har bir qo'lda
tuzatishning izi ko'rinadi.

Manba: `iPOST_OTK_Ish_tartibi_va_KPI.xlsx`, `iPOST_Telegram_tahlili_2.xlsx`,
`iPOST_Tekshirish_royxati.xlsx` — barcha formulalar Excel'dan aynan ko'chirilgan va testlar bilan
qulflangan.

## Nima uchun bu tizim

Excel modelida uchta muammo bor edi:

1. **Faktlar qo'lda kiritilardi** — ya'ni KPI o'z-o'zini tekshirmaydi. Endi 17 ko'rsatkichdan
   15 tasi kunlik reyestr, auditlar va tizimli yechimlardan avtomatik hisoblanadi.
2. **Bir necha fayl bir-biriga bog'lanmagan** — Telegram tahlili, 102 statistikasi va KPI alohida
   yotardi. Endi bitta baza.
3. **Nazorat izi yo'q edi** — kim qanday raqamni o'zgartirganini bilib bo'lmaydi. Endi har bir
   tuzatish izohi va muallifi bilan saqlanadi (`/izlar`).

## Ishga tushirish

```bash
pnpm install
cp .env.example .env      # DATABASE_URL va AUTH_SECRET ni to'ldiring
pnpm db:migrate           # jadvallarni yaratadi
pnpm db:seed              # zonalar, 43 vazifa, 20 KPI, 3 checklist, 1029 tekshirish yozuvi
pnpm dev                  # http://localhost:3100
```

**Docker o'rnatilmagan mashinada** lokal PostgreSQL kerak bo'lsa:

```bash
pnpm db:local             # alohida terminalda qoldiring (port 5433, UTF-8)
```

Chiqqan `DATABASE_URL` ni `.env` ga qo'ying, so'ng migratsiya va seed'ni bajaring.

### Namunaviy ma'lumot (ixtiyoriy)

Tizimni ko'rsatish uchun ikki oylik realistik reyestr, audit va yechimlar:

```bash
pnpm demo:seed     # yaratadi (har bir yozuv "[demo]" belgisi bilan)
pnpm demo:clear    # to'liq o'chiradi
```

### Boshlang'ich loginlar

| Login      | Rol                    | Nimani ko'radi                                        |
| ---------- | ---------------------- | ----------------------------------------------------- |
| `ceo`      | Rahbariyat             | Hammasini; KPI davrini tasdiqlaydi. Ma'lumot kiritmaydi |
| `jaloldin` | Bo'lim boshlig'i       | Hammasini; faktlarni tuzatadi, davrni yuboradi        |
| `ulugbek`  | Mutaxassis — Zona A    | Reyestr, audit, o'z KPI kartasi                       |
| `jasur`    | Mutaxassis — Zona B    | —                                                     |
| `saidali`  | Mutaxassis — Zona C    | —                                                     |

Parol `.env` dagi `SEED_DEFAULT_PASSWORD` (standart `Otk2026!`). **Birinchi kirishdan keyin
albatta almashtiring** — `/sozlamalar` sahifasida.

## Sahifalar

| Sahifa        | Vazifasi                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| `/dashboard`  | Bo'lim holati bir sahifada: KPI ballari, SLA, kechikkan murojaatlar, audit qamrovi |
| `/reyestr`    | Kunlik reyestr — tizimning poydevori. SLA holati rang bilan ko'rinadi        |
| `/kpi`        | Oylik ball va bonus; faktni izoh bilan tuzatish; CEO tasdiqlash oqimi        |
| `/audit`      | 3 checklist (14 band × 2 ball); 0/1 baholarga dalil majburiy                 |
| `/yechimlar`  | Root-cause → tizimli yechim → natija. Faqat tasdiqlangani KPI'ga kiradi      |
| `/tekshiruv`  | Telegramda javob izi qolmagan 1 029 ishni tekshirish                         |
| `/quvvat`     | Shtat ehtiyoji: yuklama %, FTE taqchilligi. Norma reyestrdan o'lchanadi      |
| `/hisobot`    | Oylik hisobot — avtomatik yig'iladi, chop etishga tayyor                     |
| `/taqsimot`   | 43 vazifa va 20 KPI pasporti — tizimning "qonuni"                            |
| `/izlar`      | O'zgarishlar tarixi (CEO va bo'lim boshlig'i uchun)                          |
| `/sozlamalar` | Xodimlar, maosh, parol                                                       |

## KPI qanday hisoblanadi

Excel formulalari aynan saqlangan (`src/domain/kpi.ts`):

```
Bajarilish = "Yuqori yaxshi" ? fakt / maqsad : maqsad / fakt      (xato bo'lsa 0)
Ball       = og'irlik × 100 × min(bajarilish, yuqori chegara 1.2)
Bonus      = jami < 70 ? 0 : maosh × 0.5 × min(jami / 100, 1.2)
Baho       = 110+ A'lo · 95+ Yaxshi · 85+ Qoniqarli · 70+ Past · aks holda Qoniqarsiz
```

Ikki muhim qoida qo'shildi:

- **Ma'lumot yo'q ≠ nol.** Maxraj bo'sh bo'lsa metrika `null` qaytaradi va "kiritilmagan" deb
  ko'rsatiladi — xodim ma'lumot yo'qligi uchun jazolanmaydi, bo'lim boshlig'i izoh bilan qiymat
  kiritadi.
- **Tugamagan oy adolatli sanaladi.** Reyestr intizomi butun oyga emas, o'tgan ish kunlariga
  bo'linadi.

Qo'lda tuzatish har doim avtomatik qiymatdan ustun turadi, lekin izohsiz qabul qilinmaydi va
`/izlar` da qoladi. Tasdiqlangan davr muzlatiladi.

## Arxitektura

```
src/domain/     sof biznes-logika (kpi, sla, capacity, checklist, metrics) — freymvorksiz, 91 test
src/lib/        db, session (Edge), auth, format, period
src/server/     ma'lumotlar qatlami (registry, kpi-core, audits, capacity)
src/app/        Next.js App Router sahifalari va server action'lari
prisma/         schema va seed
scripts/        manba eksporti (python), lokal DB, namunaviy ma'lumot, qayta hisoblash
data/           Excel'dan chiqarilgan JSON (seed shu fayllardan o'qiydi)
```

`src/server/kpi.ts` — `server-only` fasad; mantiq `kpi-core.ts` da, shuning uchun skriptlar ham
xuddi shu kodni ishlatadi (ikki xil hisob bo'lishi mumkin emas).

## Testlar

```bash
pnpm test        # 91 test: KPI, SLA, quvvat, checklist, metrikalar
pnpm typecheck
pnpm lint
```

KPI testlari Excel'ning haqiqiy raqamlari bilan taqqoslanadi (Ulug'bek 83.22 ball → 2 496 597.74
so'm bonus va h.k.), shuning uchun formula tasodifan o'zgarib ketmaydi.

## Ma'lumot manbalarini qayta chiqarish

Manba Excel fayllar yangilansa:

```bash
python scripts/extract_sources.py "C:/Users/user/Desktop/OTK KPI tizimi"
pnpm db:seed
```

## Deploy (Vercel + Neon)

1. Neon'da yangi database yaratib, `DATABASE_URL` va `DIRECT_URL` ni Vercel env'ga qo'shing.
2. `AUTH_SECRET` — kamida 32 belgi tasodifiy qiymat.
3. Birinchi deploy'dan keyin: `pnpm db:migrate deploy` va `pnpm db:seed`.
4. Barcha xodimlar parolini almashtirishini talab qiling.
