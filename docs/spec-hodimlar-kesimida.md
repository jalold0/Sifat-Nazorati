# Spetsifikatsiya: tekshiruvni hodimlar kesimida o‘lchash (4-bosqich)

> Ishchi prompt. Har qanday dasturchi (yoki AI-agent) shu hujjat bo‘yicha ishni boshlay oladi.

## Muammo

Hozir har bir nuqta butun bo‘lim uchun bitta «Ha / Yo‘q / Tegishli emas» javobi bilan baholanadi.
Smenada 9 nafar operator bo‘lsa va ulardan 2 tasi smenani topshirmagan bo‘lsa, tekshiruvchi faqat «Yo‘q»
deya oladi. Natijada:

- kim aybdor, nechta odam me’yorga javob beradi — ko‘rinmaydi;
- «7 tadan 9 tasi» va «0 tadan 9 tasi» bir xil «Yo‘q» bo‘lib, ball adolatsiz bo‘ladi;
- sifatli yopilgan / yopilmagan murojaatlar, SLA bo‘yicha kechikishlar kabi **sonli** ko‘rsatkichlarni yozib
  bo‘lmaydi;
- haftalar davomida aynan qaysi hodim muntazam muammo qilayotganini aniqlab bo‘lmaydi.

## Maqsad

Tekshiruvchi smenadagi hodimlarni tanlaydi va har bir hodim bo‘yicha natija kiritadi; tizim avtomatik
umumiy xulosa chiqaradi:

- «Smenani topshirdi: 7 / 9 hodim. Topshirmadi: Aziz (sabab), Vali (sabab)».
- «Murojaatlar: 120 tadan 110 tasi sifatli yopildi (92%). Yopilmadi: 10 — Aziz 6 (sabab), Vali 4 (sabab)».
- «SLA: 9 hodimdan 7 tasi kechiktirmadi; jami 3 ta kechikish».
- Davr hisobotida: hodim × nuqta jadvali — kim qayerda muntazam yiqilyapti.

## Tushunchalar

| Tushuncha | Ma’nosi |
|---|---|
| **Bo‘lim hodimi** (`QcStaff`) | Tekshiriladigan xodim (operator, kuryer, omborchi). Tizimga kirmaydi. Rahbar Sozlamalar → bo‘lim sahifasida ro‘yxatini yuritadi. O‘chirilmaydi — «yashiriladi». |
| **Nuqta turi** (`QcCheckpoint.kind`) | `CHECK` — butun bo‘lim uchun Ha/Yo‘q (hozirgi). `STAFF_CHECK` — har hodim uchun Ha/Yo‘q. `STAFF_COUNT` — har hodim uchun ikki son: «yaxshi» va «yomon» (yorliqlari sozlanadi, masalan «Sifatli yopdi / Yopa olmadi», «Vaqtida / Kechikdi»). |
| **Smenadagilar** | Shu tekshiruvda baholangan hodimlar. Boshlang‘ich holatda bo‘limning barcha faol hodimlari; tekshiruvchi kelmaganlarni olib tashlaydi. |

## Hisob qoidalari (`src/modules/auditlar/domain/scoring.ts`, sof funksiyalar)

1. Har bir nuqta 0..1 oralig‘ida **ulush** beradi yoki ma’lumot bermaydi:
   - `CHECK`: Ha = 1, Yo‘q = 0, Tegishli emas = hisobga olinmaydi (avvalgidek).
   - `STAFF_CHECK`: Ha deb belgilangan hodimlar / (Ha + Yo‘q). Hodim uchun «Tegishli emas» hisobga olinmaydi.
   - `STAFF_COUNT`: Σ yaxshi / (Σ yaxshi + Σ yomon), smenadagi barcha hodimlar bo‘yicha.
2. Tekshiruv bali = Σ og‘irlik × ulush / Σ og‘irlik × 100 (ma’lumotsiz nuqtalarsiz). `CHECK` uchun bu
   avvalgi formula bilan aynan bir xil — **eski tekshiruvlar bali o‘zgarmaydi**.
3. Hodimli nuqtaning umumiy javobi server tomonidan **hosil qilinadi**: hech kim yiqilmagan — «Ha»,
   kamida bitta yiqilish — «Yo‘q», ma’lumot yo‘q — «Tegishli emas». Shu orqali «jiddiy holat», «eng ko‘p
   Yo‘q olgan nuqtalar», «Yo‘q soni» kabi mavjud ko‘rsatkichlar o‘zgarishsiz ishlaydi.
4. Og‘irlik avvalgidek tekshiruvga muzlatiladi. Hodim ismlari ham tekshiruvga nusxalanadi (keyin
   o‘zgartirilsa ham tarix buzilmaydi).

## Kiritish qoidalari (`src/modules/auditlar/domain/validate.ts`, server va brauzerda bir xil)

- Hodim faqat shu bo‘lim ro‘yxatidan bo‘lishi mumkin (server tekshiradi; ism mijozdan olinmaydi).
- Yangi tekshiruvda smenadagi har bir hodim uchun natija majburiy (yoki butun nuqta «Tegishli emas»).
- `STAFF_CHECK`da «Yo‘q» bo‘lsa — sabab majburiy. `STAFF_COUNT`da «yomon» > 0 bo‘lsa — sabab majburiy.
  Sonlar 0..100 000 oralig‘idagi butun son.
- Hodimli nuqtada umumiy izoh va topshiriq **ixtiyoriy** (sabablar hodim darajasida yoziladi);
  `CHECK` nuqtada avvalgidek majburiy.

## Ekranlar

1. **Tekshiruv** (`/tekshiruv`):
   - Pastki panel ixcham: chapda «n / N · ball», o‘ngda o‘rtacha o‘lchamdagi «Saqlash» (to‘liq kenglikdagi
     ulkan tugma emas). Telefonda ham bir qator.
   - Bo‘limda hodimli nuqta bo‘lsa — «Smenada kim bor» bloki (hodim chiplari, «hammasi» / «hech kim»).
   - `STAFF_CHECK` kartasi: hodim qatori — ism, ixcham «Ha / Yo‘q / —» tugmalari, «Yo‘q»da sabab maydoni;
     «Hammasiga Ha» tugmasi; kartaning pastida jonli xulosa «7 / 9 · 78%».
   - `STAFF_COUNT` kartasi: hodim qatori — ism, ikki son maydoni (yorliqlari nuqtadan), «yomon» > 0 da sabab;
     pastda «jami 120 · yaxshi 110 · yomon 10 · 92%».
   - Kartada «Tegishli emas» tugmasi (butun nuqta).
2. **Tekshiruv tafsiloti** (`/tarix/[id]`): hodimli nuqta ostida hodimlar jadvali va xulosa jumlasi.
3. **Sozlamalar → bo‘lim**: «Hodimlar» bo‘limi (qo‘shish, ismini o‘zgartirish, yashirish) va har nuqtada
   «Turi» tanlovi + son turida ikki yorliq.
4. **Panel / Bo‘limim hisoboti**: «Hodimlar kesimida» kartasi — davr bo‘yicha har hodim: baholangan
   tekshiruvlar, yiqilishlar soni, ulush %; eng zaif hodimlar tepada.

## Ma’lumotlar modeli

- `QcStaff { id, deptId, name, role, active, position, createdAt }`.
- `QcCheckpoint.kind` (`CHECK` | `STAFF_CHECK` | `STAFF_COUNT`, standart `CHECK`), `okLabel?`, `badLabel?`.
- `QcAudit.staff Json?` = `{ people: [{ id, name }], results: { nuqtaId: { hodimId: yacheyka } } }`;
  yacheyka: `{ v: "yes" | "no" | "na", reason? }` yoki `{ ok, bad, reason? }`.
- Migratsiya faqat qo‘shimcha (mavjud yozuvlar o‘zgarmaydi).

## Jurnal

Bo‘lim sozlamasi farqiga hodimlar ro‘yxati va nuqta turi o‘zgarishlari qo‘shiladi; tekshiruv tuzatilganda
hodim natijalari oldingi nusxasi jurnalga yoziladi.

## Qabul mezonlari

- Eski tekshiruvlar va `CHECK` nuqtalar bali bit-ma-bit o‘zgarmaydi (mavjud testlar o‘tadi).
- Yangi sof testlar: ulush, hosil javob, ball aralash turlar bilan, validatsiya xatolari, hodimlar kesimi.
- PostgreSQL integratsiya testi: hodimli tekshiruv saqlanadi, begona hodim rad etiladi, ismlar
  serverdan olinadi.
- `typecheck`, `lint`, `build` toza; ekran telefonda (375 px) va kompyuterda tekshirilgan.

## Keyingi bosqich (bu ishga kirmaydi)

Hodimga dalil (foto/audio) biriktirish, hodim bo‘yicha alohida topshiriq va bildirishnoma, mas’ulni hodim
ro‘yxatidan tanlash, kalibrlash (tekshiruvchilar orasidagi farq).
