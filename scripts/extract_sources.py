"""
Manba Excel fayllaridan seed uchun JSON ma'lumot chiqaradi.

Ishlatish:
    python scripts/extract_sources.py [MANBA_PAPKA]

MANBA_PAPKA default: C:/Users/user/Desktop/OTK KPI tizimi
Natija: data/*.json  (git'ga commit qilinadi — seed shu fayllardan o'qiydi)

Bu skript bir marta ishlatiladi. Keyinchalik manba fayllar yangilansa, qayta ishga tushiring.
"""

from __future__ import annotations

import io
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PERIOD_TO = os.environ.get("BASELINE_PERIOD_TO", date.today().isoformat())

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/user/Desktop/OTK KPI tizimi")
OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)

F_KPI = SRC / "iPOST_OTK_Ish_tartibi_va_KPI.xlsx"
F_TG = SRC / "iPOST_Telegram_tahlili_2.xlsx"
F_CHECK = SRC / "iPOST_Tekshirish_royxati.xlsx"

# Xodim nomlarini barqaror kalitga bog'lash
OWNER_KEYS = {
    "Ulug'bek M.": "ulugbek",
    "Jasur B.": "jasur",
    "Saidali Sh.": "saidali",
    "Bo'lim boshlig'i": "head",
    "—": None,
    "": None,
}

# KPI ko'rsatkichlarini avtomatik hisoblanadigan metrikalarga bog'lash.
# Tartib — 'KPI pasporti' varag'idagi 1..20 raqamlariga mos.
KPI_METRICS = [
    ("zoneA_resolution_rate", "AUTO", "percent"),
    ("zoneA_avg_close_hours", "AUTO", "hours"),
    ("warehouse_audit_count", "AUTO", "count"),
    ("lost_return_share", "MANUAL", "percent"),
    ("registry_discipline", "AUTO", "percent"),
    ("stuck_tracks_share", "MANUAL", "percent"),
    ("daily_control_completion", "AUTO", "percent"),
    ("escalation_within_2h", "AUTO", "percent"),
    ("zoneB_internal_close_rate", "AUTO", "percent"),
    ("repeat_share", "AUTO", "percent"),
    ("official_ontime_rate", "AUTO", "percent"),
    ("fcr_rate", "AUTO", "percent"),
    ("avg_first_response_hours", "AUTO", "hours"),
    ("graded_calls_count", "AUTO", "count"),
    ("registry_discipline", "AUTO", "percent"),
    ("dept_sla_rate", "AUTO", "percent"),
    ("proactive_share", "AUTO", "percent"),
    ("systemic_solutions_count", "AUTO", "count"),
    ("load_balance_ratio", "AUTO", "ratio"),
    ("mgmt_ontime_rate", "MANUAL", "percent"),
]


def s(v) -> str:
    """Katakni tozalangan matnga aylantirish."""
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return str(v).replace("\n", " ").strip()


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    return None


def rows(ws, start: int):
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i >= start:
            yield row


def write(name: str, payload) -> None:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    size = len(payload) if isinstance(payload, list) else len(payload.keys())
    print(f"  ✔ {name:28} ({size} yozuv)")


# ─────────────────────────────────────────────────────────────────────────────
print("iPOST OTK — manba eksporti")
wb = openpyxl.load_workbook(F_KPI, data_only=True)

# 1. Zonalar ---------------------------------------------------------------
ws = wb["Ish taqsimoti"]
panel = wb["Boshqaruv paneli"]
zones = []
for row in panel.iter_rows(min_row=26, max_row=29, values_only=True):
    raw = s(row[1])
    if not raw or raw[0] not in "ABCD":
        continue
    code = raw[0]
    zones.append(
        {
            "code": code,
            "name": raw.split("—", 1)[1].strip() if "—" in raw else raw,
            "ownerKey": OWNER_KEYS.get(_o := s(row[2]).replace("Ulug'bek Muqimjonov", "Ulug'bek M.").replace("Jasur Bafaev", "Jasur B.").replace("Saidali Shadiyev", "Saidali Sh."), None)
            or ("ulugbek" if "Ulug" in _o else "jasur" if "Jasur" in _o else "saidali" if "Saidali" in _o else "head"),
            "location": s(row[3]),
            "coverage": s(row[4]),
            "outcome": s(row[7]),
        }
    )
write("zones.json", zones)

# 2. 43 vazifa -------------------------------------------------------------
tasks = []
for row in rows(ws, 6):
    if not isinstance(row[1], (int, float)):
        continue
    tasks.append(
        {
            "no": int(row[1]),
            "zone": s(row[2]),
            "title": s(row[3]),
            "source": s(row[4]),
            "ownerKey": OWNER_KEYS.get(s(row[5]), "head"),
            "backupKey": OWNER_KEYS.get(s(row[6])),
            "frequency": s(row[7]),
            "slaHours": num(row[8]),
            "priority": s(row[9]),
            "kind": s(row[10]),
        }
    )
write("tasks.json", tasks)

# 3. KPI pasporti + kalkulyatordan aniq maqsad qiymatlari -------------------
ws = wb["KPI pasporti"]
passport = []
for row in rows(ws, 6):
    if not isinstance(row[1], (int, float)):
        continue
    who = s(row[2])
    key = (
        "ulugbek" if "Ulug" in who else "jasur" if "Jasur" in who else "saidali" if "Saidali" in who else "head"
    )
    passport.append(
        {
            "no": int(row[1]),
            "ownerKey": key,
            "name": s(row[3]),
            "weight": num(row[4]),
            "direction": "HIGHER_BETTER" if "Yuqori" in s(row[5]) else "LOWER_BETTER",
            "targetText": s(row[6]),
            "formula": s(row[7]),
            "dataSource": s(row[8]),
            "period": s(row[9]),
        }
    )

# Kalkulyatordagi raqamli maqsadlar (aniq qiymat manbasi)
calc = wb["KPI kalkulyator"]
calc_rows: list[dict] = []
for row in calc.iter_rows(min_row=15, max_row=52, values_only=True):
    if isinstance(row[1], (int, float)) and s(row[2]):
        calc_rows.append({"label": s(row[2]), "weight": num(row[3]), "target": num(row[5])})

assert len(calc_rows) == len(passport) == 20, f"kutilgan 20, topildi {len(calc_rows)}/{len(passport)}"

indicators = []
for i, (p, c) in enumerate(zip(passport, calc_rows)):
    code, source, fmt = KPI_METRICS[i]
    indicators.append(
        {
            **p,
            "code": f"{p['ownerKey']}_{code}",
            "metric": code,
            "metricSource": source,
            "unit": fmt,
            "target": c["target"],
            "shortLabel": c["label"],
        }
    )
write("kpi-indicators.json", indicators)

# 4. Kalkulyator sozlamalari ------------------------------------------------
settings = {
    "bonusShareOfSalary": num(calc["D8"].value),
    "entryThresholdScore": num(calc["D9"].value),
    "upperCapCoefficient": num(calc["D10"].value),
    "gradeScale": [
        {"min": 110, "label": "A'lo"},
        {"min": 95, "label": "Yaxshi"},
        {"min": 85, "label": "Qoniqarli"},
        {"min": 70, "label": "Past"},
        {"min": 0, "label": "Qoniqarsiz"},
    ],
}
write("kpi-settings.json", settings)

# 5. Checklist shablonlari -------------------------------------------------
checklists = []
for sheet, kind in [
    ("Checklist Ombor-RS", "WAREHOUSE"),
    ("Checklist Filial", "BRANCH"),
    ("Checklist Murojaat", "CALL"),
]:
    cs = wb[sheet]
    items = []
    for row in rows(cs, 11):
        if not isinstance(row[1], (int, float)):
            continue
        items.append({"no": int(row[1]), "title": s(row[2]), "requirement": s(row[3]), "max": int(num(row[5]) or 2)})
    checklists.append(
        {
            "kind": kind,
            "title": s(cs["B2"].value),
            "note": s(cs["B3"].value),
            "items": items,
        }
    )
write("checklists.json", checklists)

# 6. Quvvat hisobi ---------------------------------------------------------
cap = wb["Quvvat hisobi"]
capacity = {
    "inputs": {
        "monthlyVolume": num(cap["C7"].value),
        "workingDays": num(cap["C8"].value),
        "hoursPerDay": num(cap["C9"].value),
        "specialists": num(cap["C10"].value),
        "utilisation": num(cap["C11"].value),
        "proactiveShare": num(cap["C12"].value),
    },
    "zoneLoad": [
        {
            "zone": s(row[1])[0],
            "flowShare": num(row[2]),
            "minutesPerCase": num(row[4]),
        }
        for row in rows(cap, 16)
        if s(row[1])[:1] in ("A", "B", "C")
    ],
}
write("capacity.json", capacity)

# 7. Boshqaruv panelidagi joriy holat + 6 oylik maqsadlar -------------------
targets = []
for row in rows(panel, 33):
    if not s(row[1]) or s(row[1]).startswith("IZOH"):
        continue
    targets.append(
        {
            "metric": s(row[1]),
            "now": s(row[2]),
            "in3Months": s(row[3]),
            "in6Months": s(row[4]),
            "source": s(row[5]),
        }
    )
write("goals.json", targets)

# 8. Telegram baseline -----------------------------------------------------
tg = openpyxl.load_workbook(F_TG, data_only=True)

UZ_MONTH_ALL = {
    "Yanvar": 1, "Fevral": 2, "Mart": 3, "Aprel": 4, "May": 5, "Iyun": 6,
    "Iyul": 7, "Avgust": 8, "Sentabr": 9, "Oktabr": 10, "Noyabr": 11, "Dekabr": 12,
}


def pick(sheet, label, default=None):
    """'Umumiy xulosa' varag'idan ko'rsatkichni nomi bo'yicha olish."""
    for row in sheet.iter_rows(values_only=True):
        for i, cell in enumerate(row):
            if s(cell) == label and i + 1 < len(row):
                value = num(row[i + 1])
                if value is not None:
                    return value
    if default is None:
        raise KeyError(f"'{label}' topilmadi — manba fayl tuzilmasi o'zgargan")
    return default


xul = tg["Umumiy xulosa"]

months = []
for row in rows(tg["Oylik dinamika"], 5):
    label = s(row[1])
    if not label or label == "JAMI":
        continue
    name, year = label.split()
    months.append(
        {
            "period": f"{year}-{UZ_MONTH_ALL[name]:02d}",
            "label": label,
            "cases": int(num(row[2]) or 0),
            "noTrace": int(num(row[3]) or 0),
            "withTrack": int(num(row[5]) or 0),
            "medianFirstResponseMin": num(row[6]) or 0,
        }
    )

accounts = [
    {
        "account": s(row[1]),
        "cases": int(num(row[2]) or 0),
        "ownOnly": int(num(row[3]) or 0),
        "shared": int(num(row[4]) or 0),
        "sessions": int(num(row[5]) or 0),
        "tracks": int(num(row[6]) or 0),
        "customers": int(num(row[7]) or 0),
        "unanswered": int(num(row[8]) or 0),
        "medianMin": num(row[9]),
        "within1h": num(row[10]),
    }
    for row in rows(tg["Akkaunt statistikasi"], 6)
    # Yig'indi qatori (dedublikatsiyagacha) va varaq oxiridagi izoh tashlab ketiladi —
    # haqiqiy akkaunt qatorida ish soni albatta bo'ladi
    if s(row[1]) and not s(row[1]).startswith("YIG") and num(row[2]) is not None
]

operators = [
    {
        "name": s(row[1]),
        "login": s(row[2]),
        "role": s(row[3]),
        "total": int(num(row[4]) or 0),
        "status": int(num(row[5]) or 0),
        "archive": int(num(row[6]) or 0),
        "approved": int(num(row[7]) or 0),
    }
    for row in rows(tg["102 tizimi"], 6)
    if s(row[2]).startswith("@")
]

prof = tg["Yuklama profili"]
breakdowns = []
for i, r in enumerate(rows(prof, 5)):
    if s(r[1]) and ":" in s(r[1]):
        breakdowns.append({"kind": "HOUR", "label": s(r[1]), "value": int(num(r[2]) or 0), "sortOrder": i})
    if s(r[4]) and num(r[5]) is not None:
        breakdowns.append({"kind": "WEEKDAY", "label": s(r[4]), "value": int(num(r[5]) or 0), "sortOrder": i})
    if s(r[7]) and num(r[8]) is not None:
        breakdowns.append({"kind": "TOPIC", "label": s(r[7]), "value": int(num(r[8]) or 0), "sortOrder": i})

# Davr: oylik dinamikaning birinchi va oxirgi oyi
first_period = months[0]["period"] if months else "2025-11"
last_period = months[-1]["period"] if months else "2026-08"

payload = {
    "label": f"Telegram eksporti — {UZ_MONTH_ALL and months[-1]['label'] if months else 'noma`lum'}",
    "sourceFile": F_TG.name,
    "periodFrom": f"{first_period}-01",
    "periodTo": PERIOD_TO,
    "summary": {
        "totalCases": int(pick(xul, "JAMI ISH (unikal murojaat)")),
        "withTrack": int(pick(xul, "shundan trek bo'yicha")),
        "withoutTrack": int(pick(xul, "shundan treksiz")),
        "uniqueCustomers": int(pick(xul, "Unikal mijoz / manba")),
        "sharedCases": int(pick(xul, "Ulashilgan ish (2+ akkaunt)")),
        "accountsSum": int(pick(xul, "Akkauntlar yig'indisi (takror bilan)")),
        "excludedCases": int(pick(xul, "Shubhali — hisobga olinmadi")),
        "answeredCases": int(pick(xul, "Javob berilgan")),
        "lateAnswered": int(pick(xul, "Kech javob berilgan")),
        "noTraceCases": int(pick(xul, "Telegramda javob izi yo'q")),
        "otherChannel": int(pick(xul, "Boshqa kanalda ishlangan (trek bo'yicha)")),
        "noReplyNeeded": int(pick(xul, "Javob talab qilmagan (yopuvchi xabar)")),
        "medianFirstResponseMin": pick(xul, "Birinchi javob — median"),
        "within1hShare": pick(xul, "1 soat ichida javob"),
        "within24hShare": pick(xul, "24 soat ichida javob"),
        "outsideHoursShare": pick(xul, "Ish vaqtidan tashqari kelgan"),
        "system102Cases": sum(o["total"] for o in operators),
        "totalMessages": int(pick(xul, "Jami xabar")),
        "totalSessions": int(pick(xul, "Jami suhbat (sessiya)")),
    },
    "months": months,
    "accounts": accounts,
    "operators": operators,
    "breakdowns": breakdowns,
}
write("baseline-import.json", payload)

# 9. Tekshirish ro'yxati (javob izi yo'q ishlar) ---------------------------
ck = openpyxl.load_workbook(F_CHECK, data_only=True, read_only=True)
queue = []
for sheet, has_track in [("1. Trek bo'yicha", True), ("2. Treksiz", False)]:
    for row in rows(ck[sheet], 2):
        if not s(row[0]):
            continue
        queue.append(
            {
                "date": s(row[0])[:10],
                "track": s(row[1]) or None,
                "customer": s(row[2]),
                "originType": s(row[3]),
                "category": s(row[4]),
                "account": s(row[5]),
                "text": s(row[6])[:400],
                "hasTrack": has_track,
            }
        )
write("review-queue.json", queue)

print(f"\nTayyor — {OUT}")
