# ADR 0001 — Modulli monolit

- Holat: qabul qilingan
- Sana: 2026-11-09
- Qaror egalari: loyiha egasi (foydalanuvchi), Claude

## Kontekst

Ilova 1–4-bosqichlarda tez o‘sdi: 11 000 qator, uchta katta fayl butun mantiqni ushlab turibdi
(`src/server/qc.ts` — 800+ qator: ruxsat, tekshirish, Prisma so‘rovlari, DTO, tranzaksiya, jurnal hammasi aralash).
Muammolar:

- **Qayerda nima turishi noaniq.** Biznes-qoida (ball, svetofor), ruxsat va Prisma so‘rovi bir funksiyada.
  Yangi odam «tekshiruvni saqlash qayerda?» deb 4 ta faylni ochadi.
- **Prisma hamma joyda.** Har server funksiya `PrismaClient`ni biladi; testlar uchun `ctx.db` qistirib yuriladi.
- **Bog‘liqlik qoidasi yo‘q.** Sahifa to‘g‘ridan-to‘g‘ri `server/qc.ts` ichidagi 20 funksiyadan istalganini chaqiradi;
  hech narsa bir modul boshqasining ichki tafsilotiga tayanishini to‘xtatmaydi.
- **Muhit.** Ilova **ofis serverida** (Windows, o‘z PostgreSQL, internetsiz tarmoq, 10–50 xodim) ishlaydi.
  Vercel/serverless xususiyatlari (edge runtime, tashqi CDN, boshqariladigan baza) ishlatilmaydi.

## Qaror

**Modulli monolit**: bitta Next.js ilova, bitta jarayon, bitta baza — lekin ichida aniq modullar va qatlamlar,
bog‘liqlik yo‘nalishi kod bilan qulflangan.

### Modullar (`src/modules/<modul>`)

| Modul | Mas’uliyat |
|---|---|
| `foydalanuvchilar` | login, sessiya, parol, rollar va ruxsat qoidalari (policy), foydalanuvchi boshqaruvi |
| `bolimlar` | bo‘lim, nuqta (checkpoint), hodim ro‘yxati, cheklist turlari, me‘yor |
| `auditlar` | tekshiruv (kiritish, tuzatish, o‘chirish), ball hisobi, topshiriqlar |
| `hisobot` | panel (svetofor), bo‘lim hisoboti, haftalik hisobot va izoh, CSV |
| `oquv` | o‘quv dasturi, test baholash, urinishlar, natijalar |
| `jurnal` | o‘zgarishlar jurnali (kim, qachon, nima) |

`src/shared` — hamma modul ishlatadigan kichik «yadro»: natija turi va xatolar, Toshkent vaqti, format, CSV, `env`, logger.
Unda biznes-mantiq **yo‘q**.

### Qatlamlar (modul ichida)

```
ui  ──►  application  ──►  domain
              ▲
infrastructure┘   (application'dagi port'larni amalga oshiradi)
```

- `domain` — sof TypeScript: qiymatlar, hisob, qoidalar, tekshirish. Prisma, Next, React, `fs`, `Date.now()` yo‘q.
- `application` — use-case'lar: **bitta amal = bitta funksiya**. Ruxsatni tekshiradi, domain'ni chaqiradi, tranzaksiya
  chegarasini belgilaydi, jurnalga yozdiradi. Ma‘lumotga **port** (interfeys) orqali murojaat qiladi.
- `infrastructure` — port'larning Prisma amalga oshirishi. **Faqat shu qatlam (va `shared/infrastructure`) Prisma'ni biladi.**
- `ui` — React komponentlar va server action'lar: kirishni zod bilan tekshiradi, use-case'ni chaqiradi, natijani ko‘rsatadi.
  Biznes-mantiq yo‘q. `src/app` — Next marshrutlari, ular yupqa: ma‘lumot olish va `ui` komponentini chizish.

### Bog‘liqlik qoidalari (kod bilan qulflanadi)

1. `domain` faqat `domain` va `shared` (sof qismi) ga import qiladi.
2. `application` — `domain`, o‘z `ports`i va boshqa modullarning **ochiq API**siga. Prisma, Next, React — yo‘q.
3. `infrastructure` — `application` port'lari, `domain`, Prisma.
4. `ui` va `src/app` — modulning **ochiq API**si (`index.ts`, `ui/index.ts`); boshqa modul ichiga kirmaydi.
5. Modul boshqa modulga **faqat uning `index.ts`si** orqali murojaat qiladi (chuqur import taqiqlangan).
6. Tsikl yo‘q: `foydalanuvchilar` ← `bolimlar` ← `auditlar` ← `hisobot`; `oquv` va `jurnal` pastda.

Qoidalar ikki joyda tekshiriladi: ESLint `no-restricted-imports` (muharrirda darhol) va `vitest` arxitektura testi
(`src/architecture.test.ts` — qoida buzilsa `pnpm test` yiqiladi; qo‘shimcha kutubxona kerak emas).

### Xatolar, ruxsat, tranzaksiya, jurnal

- Use-case natijasi `Result<T>`; xatolar `AppError` (kod + o‘zbekcha xabar + HTTP holati). Istisno faqat kutilmagan nosozlik uchun.
- Ruxsat qoidalari bitta joyda — `foydalanuvchilar/domain/policy.ts`; use-case har amalda tekshiradi (brauzerga ishonilmaydi).
- Tranzaksiya chegarasi use-case'da (`UnitOfWork.run`); jurnal yozuvi asosiy amal bilan **bitta tranzaksiyada**.
- Kirish chegarada zod bilan tekshiriladi; vaqt UTC saqlanadi, kun chegarasi `Asia/Tashkent`.

## Nima uchun mikroservis emas

- 10–50 xodim, bitta jamoa, bitta baza: tarmoq chaqiruvlari, versiyalash, tarqatilgan tranzaksiya va ko‘p servisli
  joylashtirish **faqat xarajat** qo‘shadi, foyda bermaydi.
- Tekshiruv + topshiriq + jurnal yozuvi **bitta ACID tranzaksiya** bo‘lishi kerak; servislarga bo‘lsak saga/outbox kerak bo‘ladi.
- Ofis serverida operatsion yuk (har servis — alohida jarayon, monitoring, zaxira) ortiqcha va xatarli.
- Modul chegaralari kodda aniq bo‘lsa, kerak bo‘lib qolsa keyin bitta modulni ajratib olish mumkin (ochiq API tayyor).

## Ofis serveri talablari (muhit cheklovlari)

- Windows Server/10+, Node.js 20+, PostgreSQL 15+ (o‘sha serverda yoki ichki tarmoqda). Internet **shart emas**.
- Tashqi CDN, shrift, rasm, analitika yo‘q — hamma resurs ilovadan beriladi.
- `next build` `output: 'standalone'`; jarayon servis sifatida (NSSM yoki pm2) ishlaydi, avtomatik qayta ishga tushadi.
- Zaxira: `pg_dump` kunlik reja bilan; migratsiya `prisma migrate deploy`; sessiya cheklovi va kirish cheklovi bitta
  jarayon xotirasida ishlaydi (bitta nusxa) — shu sabab ilova **bitta jarayon** sifatida yuritiladi.
- Sozlama `.env` da, `src/shared/env.ts` zod bilan ishga tushishda tekshiradi (yo‘q/noto‘g‘ri bo‘lsa — aniq xabar bilan to‘xtaydi).
- Batafsil: `docs/JOYLASHTIRISH.md`.

## Oqibatlari

- (+) Har narsaning o‘rni aniq; yangi funksiya = use-case + (kerak bo‘lsa) port/repozitoriy + ui.
- (+) Domain va use-case'larni bazasiz testlash mumkin (port'ga soxta amalga oshirish).
- (+) Qoida buzilishi tezda ushlanadi (lint + test).
- (−) Ko‘proq fayl va biroz ko‘proq «yelim» kod; kichik o‘zgarish ba‘zan 3 faylni qamraydi.
- (−) Ko‘chirish vaqti. Xulq o‘zgarmasligi mavjud testlar bilan kafolatlanadi (115+ sof, 24+ server testi).

## Ko‘rib chiqilgan muqobillar

- **Hozirgi tuzilmani saqlash.** Katta fayllar o‘sishda davom etadi — rad etildi.
- **To‘liq DDD/CQRS/event bus.** Bu ko‘lam uchun ortiqcha, jamoa kichik — rad etildi. Faqat foydali qismi olindi
  (qatlamlar, port'lar, use-case'lar).
- **Mikroservislar.** Yuqoridagi sabablarga ko‘ra rad etildi.
