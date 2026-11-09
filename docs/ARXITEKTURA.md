# Arxitektura

Qaror va sabablar: [ADR 0001 — Modulli monolit](adr/0001-modulli-monolit.md). Bu hujjat — **xarita**:
qayerda nima turishi, ma‘lumot qanday oqishi, ruxsat va xatolar qanday ishlashi.

## 1. Papkalar

```
src/
  app/                    Next.js marshrutlari (yupqa): ma‘lumot olish + ui komponentini chizish
  modules/
    foydalanuvchilar/     login, sessiya, parol, rollar va ruxsat (policy), foydalanuvchi boshqaruvi
    bolimlar/             bo‘lim, nuqta, hodim ro‘yxati, cheklist turlari, me‘yor
    auditlar/             tekshiruv, ball hisobi, topshiriqlar
    hisobot/              panel (svetofor), bo‘lim hisoboti, haftalik hisobot
    oquv/                 o‘quv dasturi, test, urinishlar, natijalar
    jurnal/               o‘zgarishlar jurnali
      <modul>/
        domain/           sof TypeScript: qoidalar va hisob
        application/      use-case'lar + port'lar (interfeyslar)
        infrastructure/   Prisma repozitoriylari (port'larning amalga oshirilishi)
        ui/               React komponentlar, server action'lar
        index.ts          OCHIQ API (boshqa modul faqat shuni import qiladi)
  shared/                 natija/xato turlari, Toshkent vaqti, format, CSV, env, logger, UI primitivlari
  middleware.ts           kirish va rol bo‘yicha yo‘naltirish (Edge: faqat JWT, bazasiz)
prisma/                   sxema, migratsiyalar, seed
docs/                     ADR, arxitektura, joylashtirish
```

Bog‘liqlik yo‘nalishi: `foydalanuvchilar ← bolimlar ← auditlar ← hisobot`; `oquv` va `jurnal` pastki darajada.
Qatlam ichida: `ui → application → domain`, `infrastructure → application (port) + domain`.

## 2. Modul xaritasi

| Modul | domain (sof) | application (use-case) | infrastructure |
|---|---|---|---|
| `foydalanuvchilar` | rollar, ruxsat qoidalari (`policy`), navigatsiya, parol qoidalari, kirish cheklovi, mijoz IP | `login`, `changePassword`, `saveUser`, `listUsers`, `resolveActor` | foydalanuvchi repozitoriysi, sessiya cookie (JWT), parol xeshi |
| `bolimlar` | nuqta turlari, cheklist turlari, hodim, bo‘lim farqi (`diffDept`), boshlang‘ich nuqta tanlash | `listDepartments`, `saveDepartment`, `moveDepartment` | bo‘lim/nuqta/hodim repozitoriysi |
| `auditlar` | ball (`scoreAnswers`, `scoreAudits`), jiddiylik, hodim kesimi, tekshirish (`validateAudit`), topshiriq qoidalari (kechikish, muddatida bajarilish) | `createAudit`, `updateAudit`, `deleteAudit`, `listAudits`, `getAudit`, `listTasks`, `closeTask`, `updateTask`, `getSummaryData` | tekshiruv/topshiriq repozitoriysi |
| `hisobot` | davr/hafta, svetofor, bo‘lim holati (`evaluateDept`), 3 qatorli xulosa | `loadReport`, `getWeeklyReport`, `saveReportNote` | hisobot izohi repozitoriysi |
| `oquv` | test baholash (`gradeTest`), dastur o‘tilishi, urinishlar holati, aralashtirish | `listTraining`, `getTest`, `submitTest`, `setTask`, `listProgress` | o‘quv repozitoriysi |
| `jurnal` | jurnal yozuvi turi, qisqa tavsif | `listLog` (+ boshqa modullar chaqiradigan `JournalWriter` port) | jurnal repozitoriysi |

## 3. Ma‘lumot oqimi (misol: tekshiruv saqlash)

```
Brauzer ── formani yuboradi ──► app/(panel)/tekshiruv  (server action, auditlar/ui)
   zod bilan shakl tekshiriladi  ──►  createAudit(actor, input)        [auditlar/application]
        1. ruxsat:      policy.canCreateAudit(actor)                   [foydalanuvchilar/domain]
        2. bo‘lim:      DepartmentRepository.get(deptId)               [bolimlar port]
        3. qoidalar:    validateAudit(input, nuqtalar, bugun)          [auditlar/domain]
        4. saqlash:     UnitOfWork.run(tx => audit + topshiriqlar + jurnal)   ← bitta tranzaksiya
   ◄── Result<{id}>  yoki  AppError(kod, o‘zbekcha xabar)
Server action: revalidatePath(...) va natijani brauzerga qaytaradi.
```

Hisob (ball, svetofor, xulosa) **saqlanmaydi** — har so‘rovda `domain` funksiyalari hisoblaydi. Tekshiruvga faqat
kiritilgan paytdagi og‘irliklar (`weights`) va hodim ismlari nusxalanadi: sozlama keyin o‘zgarsa ham tarix buzilmaydi.

## 4. Ruxsatlar

- Rollar: `HEAD` (Rahbar), `INSPECTOR` (Tekshiruvchi), `SUPERVISOR` (Supervayzer — o‘z bo‘limi), `VIEWER` (Ko‘ruvchi — o‘z bo‘limi).
- **Bitta joy:** `foydalanuvchilar/domain/policy.ts` (`canCreateAudit`, `canEditAudit`, `deptScope`, …).
- **Qatlamlar:** (1) `middleware.ts` — kirmaganni `/login`ga, rolga mos bo‘lmagan sahifadan `/ruxsat-yoq`ga yo‘naltiradi
  (faqat qulaylik, bazasiz); (2) **use-case har amalda `policy`ni chaqiradi** — haqiqiy to‘siq shu; (3) so‘rov
  har safar foydalanuvchini bazadan o‘qiydi (`resolveActor`): rol, bo‘lim, faollik, sessiya versiyasi, majburiy parol almashtirish.
- Ko‘ruvchi/Supervayzer so‘rovlari bo‘lim doirasi (`deptScope`) bilan repozitoriy darajasida ham cheklanadi.

## 5. Xatolar

- `shared`: `AppError { code, message (o‘zbekcha), status }` va `Result<T> = {ok:true,data} | {ok:false,error}`.
- Kodlar: `VALIDATION` (400), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `UNAUTHENTICATED` (401).
- Use-case kutilgan xatoni `Result` sifatida qaytaradi; kutilmagan nosozlik (baza o‘chdi) istisno sifatida
  ko‘tariladi, `logger` ga yoziladi va foydalanuvchiga umumiy xabar ko‘rsatiladi.
- `ui` xabarni foydalanuvchiga o‘zgartirmasdan ko‘rsatadi (tuzatish yo‘li xabarning o‘zida yozilgan).

## 6. Tranzaksiya, jurnal, vaqt

- Tranzaksiya chegarasi — `application`: `UnitOfWork.run(fn)`; ichida barcha repozitoriylar bitta tranzaksiyaga bog‘lanadi.
- Muhim o‘zgarish (tekshiruv tuzatish/o‘chirish, bo‘lim, foydalanuvchi, izoh) **jurnalga shu tranzaksiyada** yoziladi.
- Vaqt UTC saqlanadi; «kun» (YYYY-MM-DD) Toshkent (UTC+5) bo‘yicha `shared/time` da hisoblanadi. Use-case'lar
  `Date.now()` ni bevosita chaqirmaydi — `ctx.now` orqali (test uchun almashtiriladi).

## 7. Sozlama va kuzatuv

- `shared/env.ts` — `.env` ni ishga tushishda zod bilan tekshiradi (`DATABASE_URL`, `AUTH_SECRET`, …).
- `shared/logger.ts` — bir qatorli JSON log (`level`, `msg`, `time`, kontekst). `GET /api/health` — jarayon va baza holati.

## 8. Qoidalarni tekshirish

- ESLint `no-restricted-imports`: chuqur import va qatlam buzilishi muharrirda ko‘rinadi.
- `src/architecture.test.ts`: barcha importlarni o‘qib, bog‘liqlik qoidalarini tekshiradi; buzilsa `pnpm test` yiqiladi.

## 9. Yangi funksiya qo‘shish tartibi

1. Qoida/hisob bo‘lsa — `domain` ga sof funksiya + test.
2. `application` ga use-case (ruxsat → domain → port → jurnal), kerak bo‘lsa port metodi.
3. `infrastructure` da port metodini Prisma bilan yozing (yangi migratsiya bo‘lsa — `prisma/migrations`).
4. `index.ts` ga qo‘shing; `ui` da komponent/action; `src/app` da marshrut.
5. Server testi (`pnpm test:db`) va, kerak bo‘lsa, domain testi.
