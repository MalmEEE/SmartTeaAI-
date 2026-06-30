"""
Sri Lankan Tea Sub-Districts with coordinates and elevation mapping.
Matches the sub-districts shown in SLTB Sub District Price table.
Used by collect_weather.py to fetch weather per sub-district.
"""

TEA_REGIONS = [
    # ── HIGH GROWN (above 4000 ft / 1200m) ────────────────────
    {"name": "Nuwara Eliya",              "elevation": "High",   "lat": 6.9497,  "lon": 80.7891},
    {"name": "Ramboda",                   "elevation": "High",   "lat": 7.0167,  "lon": 80.6833},
    {"name": "Pundaluoya",                "elevation": "High",   "lat": 6.9833,  "lon": 80.7333},
    {"name": "Agarapatana",               "elevation": "High",   "lat": 6.8833,  "lon": 80.6500},
    {"name": "Nanuoya Lindula Talawakele","elevation": "High",   "lat": 6.9333,  "lon": 80.6667},
    {"name": "Patana Kotagala",           "elevation": "High",   "lat": 6.8667,  "lon": 80.5833},
    {"name": "Hatton Dickoya",            "elevation": "High",   "lat": 6.8833,  "lon": 80.5833},
    {"name": "Bogawantalawa",             "elevation": "High",   "lat": 6.8167,  "lon": 80.6833},
    {"name": "Upcot Maskeliya",           "elevation": "High",   "lat": 6.7833,  "lon": 80.7333},
    {"name": "Watawala Ginigat Notron",   "elevation": "High",   "lat": 6.9667,  "lon": 80.5833},

    # ── MEDIUM GROWN (2000–4000 ft / 600–1200m) ───────────────
    {"name": "Kandy",                     "elevation": "Medium", "lat": 7.2906,  "lon": 80.6337},
    {"name": "Matale",                    "elevation": "Medium", "lat": 7.4675,  "lon": 80.6234},
    {"name": "Hewaheta",                  "elevation": "Medium", "lat": 7.1167,  "lon": 80.7167},
    {"name": "Udapussellawa",             "elevation": "Medium", "lat": 7.0333,  "lon": 80.8667},
    {"name": "Halgranoya",                "elevation": "Medium", "lat": 6.9500,  "lon": 80.8333},
    {"name": "Badulla",                   "elevation": "Medium", "lat": 6.9934,  "lon": 81.0550},
    {"name": "Bandarawela",               "elevation": "Medium", "lat": 6.8297,  "lon": 80.9878},

    # ── LOW GROWN (below 2000 ft / 600m) ──────────────────────
    {"name": "Ratnapura",                 "elevation": "Low",    "lat": 6.6828,  "lon": 80.3992},
    {"name": "Kalutara",                  "elevation": "Low",    "lat": 6.5854,  "lon": 80.0000},
    {"name": "Galle",                     "elevation": "Low",    "lat": 6.0535,  "lon": 80.2210},
    {"name": "Matara",                    "elevation": "Low",    "lat": 5.9549,  "lon": 80.5550},
    {"name": "Kegalle",                   "elevation": "Low",    "lat": 7.2513,  "lon": 80.3464},
    {"name": "Kurunegala",                "elevation": "Low",    "lat": 7.4863,  "lon": 80.3647},
]