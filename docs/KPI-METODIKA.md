# KPI metodikasi — ko'rsatkichlar pasporti

Bu hujjat KPI ning "qonuni". Nizo chiqsa, shu jadval hal qiladi. Tizim ichida ham
`/taqsimot` sahifasida ko'rinadi.

## Umumiy qoidalar

| Parametr                     | Qiymat | Izoh                                                    |
| ---------------------------- | ------ | ------------------------------------------------------- |
| Og'irliklar yig'indisi       | 100    | Har bir xodim uchun alohida                             |
| Kirish chegarasi             | 70     | Shundan past ball — bonus to'lanmaydi                   |
| Yuqori chegara               | 1.2    | Bir ko'rsatkich ham, umumiy bonus ham 120% dan oshmaydi |
| Bonusning maoshdagi ulushi   | 0.5    | Maksimal o'zgaruvchan qism                              |

Formulalar:

```
Bajarilish = yo'nalish "Yuqori yaxshi" ? fakt / maqsad : maqsad / fakt
Ball       = og'irlik × 100 × min(bajarilish, 1.2)
Jami ball  = Σ ball
Bonus      = jami < 70 ? 0 : maosh × 0.5 × min(jami / 100, 1.2)
```

Baho: `≥110` A'lo · `≥95` Yaxshi · `≥85` Qoniqarli · `≥70` Past · aks holda Qoniqarsiz.

## Ko'rsatkichlar

### Ulug'bek M. — Zona A (Ombor va yuk)

| № | Ko'rsatkich                            | Og'irlik | Yo'nalish    | Maqsad     | Manba              |
| - | -------------------------------------- | -------- | ------------ | ---------- | ------------------ |
| 1 | Muammoli yuklarni hal qilish darajasi  | 25       | Yuqori yaxshi | ≥ 95%     | Reyestr (avtomatik) |
| 2 | O'rtacha yopish muddati                | 20       | Past yaxshi   | ≤ 24 soat | Reyestr (avtomatik) |
| 3 | Inventarizatsiya va ombor audit qamrovi | 20      | Yuqori yaxshi | 14 ta/oy  | Auditlar (avtomatik) |
| 4 | Adashgan + vozvrat yuk ulushi          | 20       | Past yaxshi   | ≤ 1,5%    | CRM — **qo'lda**   |
| 5 | Reyestr va hisobot intizomi            | 15       | Yuqori yaxshi | 100%      | Reyestr (avtomatik) |

### Jasur B. — Zona B (Yuk oqimi va status)

| № | Ko'rsatkich                              | Og'irlik | Yo'nalish     | Maqsad  | Manba                   |
| - | ---------------------------------------- | -------- | ------------- | ------- | ----------------------- |
| 6 | Qotib qolgan treklar ulushi              | 25       | Past yaxshi   | ≤ 1%    | Ichki tizim — **qo'lda** |
| 7 | Kunlik yuk nazorati bajarilishi          | 20       | Yuqori yaxshi | 100%    | Reyestr (avtomatik)     |
| 8 | Kechikishni 2 soat ichida eskalatsiya    | 20       | Yuqori yaxshi | ≥ 95%   | Reyestr (avtomatik)     |
| 9 | Ichki manba muammolarining yopilishi     | 20       | Yuqori yaxshi | ≥ 90%   | Reyestr (avtomatik)     |
| 10 | Takroriy muammolar ulushi               | 15       | Past yaxshi   | ≤ 15%   | Reyestr (avtomatik)     |

### Saidali Sh. — Zona C (Tashqi murojaat)

| №  | Ko'rsatkich                                | Og'irlik | Yo'nalish     | Maqsad     | Manba               |
| -- | ------------------------------------------ | -------- | ------------- | ---------- | ------------------- |
| 11 | Rasmiy murojaatlarga muddatida javob (102) | 30       | Yuqori yaxshi | 100%       | Reyestr (avtomatik) |
| 12 | Birinchi murojaatda hal qilish (FCR)       | 20       | Yuqori yaxshi | ≥ 85%      | Reyestr (avtomatik) |
| 13 | O'rtacha javob vaqti                       | 20       | Past yaxshi   | ≤ 2 soat   | Reyestr (avtomatik) |
| 14 | Baholangan qo'ng'iroq va chatlar soni      | 15       | Yuqori yaxshi | 200 ta/oy  | Auditlar (avtomatik) |
| 15 | Reyestr va hisobot intizomi                | 15       | Yuqori yaxshi | 100%       | Reyestr (avtomatik) |

### Bo'lim boshlig'i

| №  | Ko'rsatkich                            | Og'irlik | Yo'nalish     | Maqsad      | Manba                  |
| -- | -------------------------------------- | -------- | ------------- | ----------- | ---------------------- |
| 16 | Bo'lim umumiy SLA bajarilishi          | 25       | Yuqori yaxshi | ≥ 90%       | Reyestr (avtomatik)    |
| 17 | Proaktiv (asosiy) ishlar ulushi        | 25       | Yuqori yaxshi | ≥ 10% (3-oy) | Reyestr (avtomatik)   |
| 18 | Tizimli yechim soni                    | 20       | Yuqori yaxshi | ≥ 2 ta/oy   | Yechimlar (avtomatik)  |
| 19 | Yuklama muvozanati                     | 15       | Past yaxshi   | ≤ 1,3       | Reyestr (avtomatik)    |
| 20 | Kalibrovka va hisobot o'z vaqtida      | 15       | Yuqori yaxshi | 100%        | Boshqaruv — **qo'lda** |

## Avtomatik hisoblash ta'riflari

| Metrika                     | Hisoblash                                                                  |
| --------------------------- | -------------------------------------------------------------------------- |
| `zoneA_resolution_rate`     | Zona A da yopilgan / bekor qilinmagan jami                                 |
| `zoneA_avg_close_hours`     | Σ(yopilgan − qabul) / yopilganlar soni                                     |
| `warehouse_audit_count`     | Davr ichidagi WAREHOUSE checklist auditlari soni                           |
| `registry_discipline`       | Reyestr yuritilgan kunlar / **o'tgan** ish kunlari (maks 100%)              |
| `daily_control_completion`  | Kunlik nazorat qayd etilgan kunlar / o'tgan ish kunlari                     |
| `escalation_within_2h`      | 2 soat ichida eskalatsiya / (eskalatsiya qilingan yoki SLA buzilgan) soni  |
| `zoneB_internal_close_rate` | Zona B da yopilgan / jami                                                  |
| `repeat_share`              | Xodimning takroriy murojaatlari / jami                                     |
| `official_ontime_rate`      | Zona C kritik: SLA bajarilgan / natijasi aniqlangan                        |
| `fcr_rate`                  | Zona C: takrorsiz yopilgan / yopilgan                                      |
| `avg_first_response_hours`  | Σ(birinchi javob − qabul) / javob berilganlar soni                         |
| `graded_calls_count`        | CALL checklist auditlari soni                                              |
| `dept_sla_rate`             | SLA bajarilgan / natijasi aniqlangan barcha murojaatlar                    |
| `proactive_share`           | Proaktiv / (proaktiv + reaktiv)                                            |
| `systemic_solutions_count`  | Holati "Natija tasdiqlandi" bo'lgan yechimlar soni                         |
| `load_balance_ratio`        | Eng ko'p yuklangan xodim soati / eng kam yuklangan soati                   |

**Maxraj nolga teng bo'lsa** metrika `null` bo'ladi va "kiritilmagan" deb ko'rsatiladi. Bu 0 emas —
xodim ma'lumot yo'qligi uchun jazolanmaydi. Bo'lim boshlig'i qiymatni izoh bilan kiritadi.

## Tasdiqlash oqimi

```
DRAFT (to'ldirilmoqda)
  → TRIAL (sinov rejimi: ball hisoblanadi, bonus to'lanmaydi)
  → SUBMITTED (bo'lim boshlig'i rahbariyatga yubordi)
  → APPROVED (CEO tasdiqladi — faktlar muzlatiladi, to'lovga asos)
  yoki REJECTED (CEO sabab bilan qaytardi)
```

Tasdiqlangan davrda hech qanday fakt, sozlama yoki ball o'zgarmaydi.

## Ta'qiqlar

- **"Aniqlangan kamchiliklar soni" KPI qilib qo'yilmaydi** — aks holda xodim kamchilik yasashga
  urinadi. O'lchanadigan narsa — kamchilikning bartaraf etilishi va takrorlanmasligi.
- **Bitta xodimda vazifalarning 40% dan ortig'i to'planmaydi** (`/taqsimot` da nazorat qilinadi).
- **Birinchi ikki oy — sinov rejimi.** Bazaviy qiymatlar to'planmaguncha bonus KPI'ga bog'lanmaydi.

## Joriy etish tartibi (90 kun)

1. **1–7 kun** — ish taqsimotini imzolash, reyestrni ishga tushirish.
2. **1–14 kun** — xronometraj: har bir murojaatga sarflangan real vaqtni yozish.
   Bu eng muhim qadam: usiz na shtat so'rashga, na KPI maqsadlarini asoslashga dalil bo'lmaydi.
3. **8–21 kun** — real normani `/quvvat` ga kiritish, taqchillikni hisoblash.
4. **15–30 kun** — KPI ni xodimlarga tanishtirish va imzolash; birinchi sinov auditlari.
5. **30–60 kun** — sinov rejimi, rejali audit grafigi, birinchi kalibrovka sessiyasi.
6. **45–60 kun** — takroriy muammolar TOP-10 va kamida 2 ta tizimli yechim.
7. **60–90 kun** — OTK ga tegishli bo'lmagan ishlarni qaytarish, avtomatlashtirish so'rovi.
8. **90 kun** — KPI ni bonusga to'liq bog'lash, rahbariyatga natijalarni taqdim etish.
