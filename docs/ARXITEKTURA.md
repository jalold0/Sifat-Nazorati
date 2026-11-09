# Arxitektura

Qaror va sabablar: [ADR 0001 — Modulli monolit](adr/0001-modulli-monolit.md). Bu hujjat — **xarita**:
qayerda nima turishi, ma‘lumot qanday oqishi, ruxsat va xatolar qanday ishlashi. Joylashtirish: [JOYLASHTIRISH.md](JOYLASHTIRISH.md).

## 1. Papkalar

```
src/
  app/                    Next.js marshrutlari (yupqa): ma‘lumot olish + ui komponentini chizish
    api/health/           holat tekshiruvi (kompozitsiya ildizi — infratuzilmaga to‘g‘ridan-to‘g‘ri ulanadigan yagona marshrut)
  modules/
    foydalanuvchilar/     login, sessiya, parol, rollar va ruxsat (policy), foydalanuvchi boshqaruvi
    bolimlar/             bo‘lim, nuqta, hodim ro‘yxati, cheklist turlari, me‘yor
    auditlar/             tekshiruv, ball hisobi, topshiriqlar
    hisobot/              panel (svetofor), bo‘lim hisoboti, haftalik hisobot
    oquv/                 o‘quv dasturi, test, urinishlar, natijalar
    jurnal/               o‘zgarishlar jurnalini o‘qish (yozish — shared/journal port'i orqali)
      <modul>/
        domain/           sof TypeScript: qoidalar va hisob           (+ domain/index.ts — ochiq barrel)
        application/      use-case'lar + port'lar (ports.ts)
        infrastructure/   Prisma repozitoriylari + container.ts (bog‘lash)
        ui/               React komponentlar, server action'lar        (+ ui/index.ts)
        index.ts          OCHIQ API: use-case'lar (ctx bilan bog‘langan)
  shared/                 biznes-mantiqsiz yadro: result/xato, Toshkent vaqti, CSV, matn, env, logger,
                          Actor/rollar, ro‘yxat turlari, UnitOfWork va JournalWriter port'lari
    infrastructure/       Prisma mijozi, UnitOfWork va jurnal adapteri, enum moslashtirish, health
    ui/                   umumiy UI primitivlari (Card, Badge, …), AutoRefresh
  integration/            modullar kesimidagi stsenariy testlari (haqiqiy PostgreSQL, `pnpm test:db`)
  middleware.ts           kirish va rol bo‘yicha yo‘naltirish (Edge: faqat JWT, bazasiz)
  instrumentation.ts      ishga tushganda .env tekshiruvi, ushlanmagan xatolarni jurnalga yozish
  architecture.test.ts    arxitektura qoidalari testi
prisma/                   sxema, migratsiyalar, seed
scripts/                  yordamchi skriptlar, zaxira (backup-db.ps1), test-db
docs/                     ADR, arxitektura, joylashtirish
```

### Ochiq kirish nuqtalari (boshqa modul faqat shularni import qiladi)

| Nuqta | Nima | Kim import qila oladi |
|---|---|---|
| `@/modules/<m>` | use-case'lar (server) | sahifalar, boshqa modulning `infrastructure` va `ui` qatlami |
| `@/modules/<m>/domain` | sof qoidalar va turlar | hamma (jumladan boshqa modulning `domain`/`application`) |
| `@/modules/<m>/ui` | komponentlar, himoya (guard) | sahifalar, boshqa modulning `ui` |
| `@/modules/foydalanuvchilar/edge` | tokenni tekshirish (Edge, bazasiz) | faqat `middleware.ts` |

`application` boshqa modulga **faqat `domain` orqali** tayanadi; undan boshqa ma‘lumot kerak bo‘lsa — port e‘lon qilinadi,
uni `infrastructure/container.ts` boshqa modulning ochiq API‘si bilan ulaydi (masalan, `auditlar` bo‘limlarni
`bolimlar.findDepartment` orqali oladi).

### Bog‘liqlik grafi (kod bilan qulflangan: `src/architecture.test.ts → ALLOWED_MODULE_DEPS`)

```
foydalanuvchilar ◄── jurnal
        ▲
        ├── bolimlar ◄── auditlar ◄── hisobot
        │       ▲
        │       └────────────────────── oquv   (oquv → foydalanuvchilar, bolimlar)
        └─ shared ◄── (hamma modul)
```

Qatlam ichida: `ui → application → domain`; `infrastructure → application (port) + domain`; `index.ts` hammasini ulaydi.

## 2. Modul xaritasi

| Modul | domain (sof) | application (use-case) | infrastructure |
|---|---|---|---|
| `foydalanuvchilar` | rollar, ruxsat qoidalari (`policy`), navigatsiya, parol qoidalari, kirish cheklovi, mijoz IP, sessiya da‘volari | `login`, `changePassword`, `saveUser`, `listUsers`, `listReviewers`, `resolveActor`, `currentClaims`, `revokeSessions` | foydalanuvchi repozitoriysi, parol xeshi (bcrypt), sessiya tokeni (JWT) |
| `bolimlar` | nuqta turlari, bo‘lim/hodim modeli (`DeptDto`), kirish tekshiruvi (`validateDepartmentInput`), bo‘lim farqi (`diffDept`), boshlang‘ich nuqta tanlash | `listDepartments`, `findDepartment`, `saveDepartment`, `moveDepartment` | bo‘lim/nuqta/hodim repozitoriysi |
| `auditlar` | ball (`scoreAnswers`, `scoreAudits`), jiddiylik, hodim kesimi, tekshirish (`validateAudit`), topshiriq qoidalari, o‘qish modellari (`AuditDto`, `TaskDto`) | `createAudit`, `updateAudit`, `deleteAudit`, `listAudits`, `getAudit`, `listTasks`, `listTaskTab`, `closeTask`, `updateTask`, `getSummaryData` | tekshiruv va topshiriq repozitoriylari |
| `hisobot` | davr/hafta, svetofor, bo‘lim holati (`evaluateDept`), muloqot kesimi, 3 qatorli xulosa | `loadReport`, `getWeeklyReport`, `saveReportNote` | hisobot izohi repozitoriysi |
| `oquv` | test baholash (`gradeTest`), dastur o‘tilishi, urinishlar holati, aralashtirish, o‘quv mazmuni (seed) | `listTraining`, `getTest`, `submitTest`, `setTask`, `listProgress` | o‘quv repozitoriysi |
| `jurnal` | — | `listLog` (faqat rahbar) | jurnal o‘quvchisi |

Jurnalga **yozish** hamma modulda bir xil: `shared/journal.ts` dagi `JournalWriter` port'i, adapteri
`shared/infrastructure/journal.ts`. Shu tufayli yozuv asosiy amal bilan bir tranzaksiyada bo‘ladi va
modullar `jurnal` modulga bog‘lanib qolmaydi.

## 3. Ma‘lumot oqimi (misol: tekshiruv saqlash)

```
Brauzer ── formani yuboradi ──► saveAuditAction  (server action, auditlar/ui)
   requireActor()  ──►  createAudit(actor, body)  [auditlar/index.ts → application/audits.ts]
        1. ruxsat:      canCreateAudit(actor)                          [foydalanuvchilar/domain/policy]
        2. bo‘lim:      departments.find(deptId)                       [port → bolimlar.findDepartment]
        3. qoidalar:    validateAudit(body, nuqtalar, bugun)           [auditlar/domain]
        4. saqlash:     uow.run(tx => audits(tx).create + tasks(tx).createMany)   ← bitta tranzaksiya
   ◄── Res<{id}>  yoki  {ok:false, code, status, error (o‘zbekcha)}
Server action: revalidatePath(...) va natijani brauzerga qaytaradi.
```

Hisob (ball, svetofor, xulosa) **saqlanmaydi** — har so‘rovda `domain` funksiyalari hisoblaydi. Tekshiruvga faqat
kiritilgan paytdagi og‘irliklar (`weights`) va hodim ismlari nusxalanadi: sozlama keyin o‘zgarsa ham tarix buzilmaydi.

**Bog‘lash (composition).** Har modulning `infrastructure/container.ts` i `xxxDeps(ctx)` yasaydi (repozitoriylar +
`UnitOfWork` + `JournalWriter` + boshqa modul adapterlari), `index.ts` esa use-case'ni shu bog‘liqliklar bilan
chaqiradi: `createAudit(actor, body, ctx?)`. `ctx` — `{ db?, now? }`: testlarda boshqa baza mijozi va vaqt beriladi.

## 4. Ruxsatlar

- Rollar: `HEAD` (Rahbar), `INSPECTOR` (Tekshiruvchi), `SUPERVISOR` (Supervayzer — o‘z bo‘limi), `VIEWER` (Ko‘ruvchi — o‘z bo‘limi).
- **Bitta joy:** `foydalanuvchilar/domain/policy.ts` (`canCreateAudit`, `canEditAudit`, `deptScope`, …).
- **Qatlamlar:** (1) `middleware.ts` — kirmaganni `/login`ga, rolga mos bo‘lmagan sahifadan `/ruxsat-yoq`ga yo‘naltiradi
  (faqat qulaylik, bazasiz); (2) **use-case har amalda `policy`ni chaqiradi** — haqiqiy to‘siq shu; (3) so‘rov
  har safar foydalanuvchini bazadan o‘qiydi (`resolveActor`): rol, bo‘lim, faollik, sessiya versiyasi, majburiy parol almashtirish.
- Ko‘ruvchi/Supervayzer so‘rovlari bo‘lim doirasi (`deptScope`) bilan repozitoriy filtrida ham cheklanadi.

## 5. Xatolar

- `shared/result.ts`: `Res<T> = {ok:true,data} | {ok:false, error, status, code}`; yordamchilar `ok`, `bad`, `forbidden`, `notFound`, `conflict`, `fail`.
- Kodlar: `VALIDATION` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409).
- Use-case kutilgan xatoni `Res` sifatida qaytaradi; kutilmagan nosozlik (baza o‘chdi) istisno sifatida
  ko‘tariladi va Next `onRequestError` (`instrumentation.ts`) orqali jurnalga yoziladi.
- `ui` xabarni foydalanuvchiga o‘zgartirmasdan ko‘rsatadi (tuzatish yo‘li xabarning o‘zida yozilgan).

## 6. Tranzaksiya, jurnal, vaqt

- Tranzaksiya chegarasi — `application`: `UnitOfWork.run(tx => …)`; repozitoriylar `tx` bilan olinadi (`deps.audits(tx)`).
- Muhim o‘zgarish (tekshiruv tuzatish/o‘chirish, bo‘lim, foydalanuvchi, izoh) **jurnalga shu tranzaksiyada** yoziladi.
- Vaqt UTC saqlanadi; «kun» (YYYY-MM-DD) Toshkent (UTC+5) bo‘yicha `shared/time` da hisoblanadi. Use-case'lar
  `Date.now()` ni bevosita chaqirmaydi — `deps.now()` (← `ctx.now`) orqali.

## 7. Sozlama va kuzatuv

- `shared/env.ts` — `.env` ni zod bilan tekshiradi; `instrumentation.ts` server ishga tushganda chaqiradi (xato bo‘lsa to‘xtaydi).
  Boshqa joyda `process.env` o‘qilmaydi (istisno: `logger` — `LOG_LEVEL`, Prisma — `DATABASE_URL`).
- `shared/logger.ts` — bir qatorli JSON jurnal (`time`, `level`, `msg`, maydonlar); xatolar `stderr`ga.
- `GET /api/health` — jarayon va baza holati (200/503), kirishsiz (monitoring uchun).

## 8. Qoidalarni tekshirish

- ESLint `no-restricted-imports`: chuqur import, Prisma/freymvork va `shared → modul` buzilishi muharrirda ko‘rinadi.
- `src/architecture.test.ts`: barcha importlarni o‘qib qoidalarni tekshiradi (Prisma faqat infrastructure; domain/application sof;
  modullar faqat ochiq nuqtalar orqali; bog‘liqlik grafi e‘lon qilinganiga mos va sikl yo‘q); buzilsa `pnpm test` yiqiladi.

## 9. Yangi funksiya qo‘shish tartibi

1. Qoida/hisob bo‘lsa — `domain` ga sof funksiya + test.
2. `application` ga use-case (ruxsat → domain → port → jurnal), kerak bo‘lsa port metodi.
3. `infrastructure` da port metodini Prisma bilan yozing (yangi migratsiya bo‘lsa — `prisma/migrations`).
4. `index.ts` ga qo‘shing; `ui` da komponent/action; `src/app` da marshrut.
5. Server testi (`src/integration`, `pnpm test:db`) va, kerak bo‘lsa, domain testi.
