# Nuqtalar: rahbar uchun ko‘rib chiqish ro‘yxati

Boshlang‘ich 96 nuqta eski sozlamadan olingan va **«Ha — yaxshi» savoliga** qayta yozilgan
(`prisma/qc-departments.json`). Hammasi «taxminiy». Quyidagi jadval — tavsiya, qaror rahbarniki:
**Sozlamalar → bo‘lim** da «Jiddiy» belgisini qo‘yish, og‘irlikni (1–3) tanlash va me‘yorni tasdiqlash.

**Jiddiy** — «Yo‘q» bo‘lsa mijoz, pul yoki yuk xavfsizligiga bevosita zarar bo‘ladigan nuqta: bo‘lim darhol qizil bo‘ladi.
Ko‘p belgilamang: 8 nuqtadan 1–2 tasi yetarli, aks holda panel doim qizil bo‘lib, signal qadrsizlanadi.

| Bo‘lim | Tavsiya: jiddiy | Tavsiya: og‘irlik 2–3 | Sabab |
|---|---|---|---|
| Call center | cp6 (audio, jiddiy holatlar) | cp3, cp7 (og‘irlik 2) | mijozga bevosita ta‘sir |
| Kuryerka | cp8 (COD kunlik solishtirish) | cp1, cp5 (2) | pul yo‘qolishi |
| Taftish bo‘limi | cp8 (kompensatsiya hujjatlari) | cp1, cp5 (2) | moliyaviy majburiyat |
| Toshkent ombori | cp1 (manifest bilan solishtirish) | cp5, cp8 (2) | yuk yo‘qolishi |
| Xitoy avto sklad | cp1 (plomba butunligi) | cp5, cp8 (2) | bojxona va yuk xavfi |
| Avia sklad | cp1 (AWB va manifest) | cp5 (2) | yuk hisobi |
| Viloyat markazlari | cp1 (manifest solishtirish) | cp5, cp8 (2) | yuk yo‘qolishi |
| Filiallar | cp5 (tortish va o‘lchash) | cp4, cp8 (2) | pul va tarif nizosi |
| Sotuv | cp5 (shartlar yozma kelishilgan) | cp4 (2) | shartnoma nizosi |
| IT | cp1 (zaxira nusxa va tiklash) | cp5 (3 — kirish huquqlari) | xavfsizlik |
| Moliya | cp1 (kassa yopilishi), cp6 (farq nol) | cp4 (2) | pul nazorati |
| Marketing | cp1 (narx tizimga mos) | cp4 (2) | reklama nizosi |

Me‘yor (90%) va «topshiriqlar muddatida bajarilishi» (80%) — taxminiy. Birinchi 2–4 hafta ma‘lumot to‘plangach,
real o‘rtacha ko‘rsatkichga qarab me‘yorni tasdiqlang (juda yuqori me‘yor hamma bo‘limni qizil qilib qo‘yadi).

Bazada allaqachon bo‘lgan bo‘limlar matnini yangilash: `pnpm exec tsx scripts/update-checkpoint-texts.ts`
(quruq yurish) va `--apply`. Skript tekshiruvi bor yoki me‘yori tasdiqlangan bo‘limga tegmaydi.
