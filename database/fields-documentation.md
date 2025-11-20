# Vehicle Models Database - Field Documentation

## Data Source
- **API**: https://data.gov.il/api/3/action/datastore_search
- **Resource ID**: `142afde2-6228-49f9-8a29-9b6c3a0cbe40`
- **Total Records**: ~93,850 vehicle models
- **Update Frequency**: Daily (automatic)

---

## Field Categories

### 1. Identification Fields (For Dropdowns)

| Field | Hebrew | Type | Description | Dropdown Level |
|-------|--------|------|-------------|----------------|
| `tozeret_cd` | קוד יצרן | INTEGER | Manufacturer code | 1st |
| `tozeret_nm` | שם יצרן | TEXT | Manufacturer name | 1st |
| `tozeret_eretz_nm` | ארץ ייצור | TEXT | Country of origin | - |
| `tozar` | מותג | TEXT | Brand name | - |
| `degem_cd` | קוד דגם | INTEGER | Model code | 2nd |
| `degem_nm` | שם דגם טכני | TEXT | Technical model name | 2nd |
| `kinuy_mishari` | כינוי מסחרי | TEXT | Commercial name (Corolla, Civic) | 2nd |
| `sug_degem` | סוג דגם | CHAR | M=Private, N=Commercial | - |
| `shnat_yitzur` | שנת ייצור | INTEGER | Year of manufacture | 3rd |
| `ramat_gimur` | רמת גימור | TEXT | Trim level (COMFORT, STYLE) | 4th |

### 2. Basic Specifications

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `nefah_manoa` | נפח מנוע | INTEGER | Engine volume in cc |
| `koah_sus` | כוח סוס | INTEGER | Horsepower |
| `mishkal_kolel` | משקל כולל | INTEGER | Gross weight in kg |
| `gova` | גובה | INTEGER | Height in mm |
| `mispar_dlatot` | מספר דלתות | INTEGER | Number of doors |
| `mispar_moshavim` | מספר מושבים | INTEGER | Number of seats |
| `merkav` | מרכב | TEXT | Body type (sedan, SUV, etc.) |

### 3. Fuel & Drivetrain

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `delek_cd` | קוד דלק | INTEGER | Fuel code |
| `delek_nm` | סוג דלק | TEXT | Fuel type: בנזין, דיזל, חשמל, היברידי |
| `hanaa_cd` | קוד הנעה | INTEGER | Drive type code |
| `hanaa_nm` | סוג הנעה | TEXT | 4x4, 4x2, etc. |
| `technologiat_hanaa_nm` | טכנולוגיית הנעה | TEXT | Regular, Hybrid, Electric |
| `automatic_ind` | גיר אוטומטי | BOOL | 1=Automatic, 0=Manual |
| `sug_mamir_nm` | סוג ממיר | TEXT | Converter type |

### 4. Towing Capacity

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `kosher_grira_im_blamim` | כושר גרירה עם בלמים | INTEGER | Towing capacity with brakes (kg) |
| `kosher_grira_bli_blamim` | כושר גרירה בלי בלמים | INTEGER | Towing capacity without brakes (kg) |

### 5. Emissions - WLTP Standard

| Field | Hebrew | Description |
|-------|--------|-------------|
| `CO2_WLTP` | פליטת CO2 | Carbon dioxide (g/km) |
| `HC_WLTP` | פליטת HC | Hydrocarbons (mg/km) |
| `PM_WLTP` | חלקיקים | Particulate matter (mg/km) |
| `NOX_WLTP` | תחמוצות חנקן | Nitrogen oxides (mg/km) |
| `CO_WLTP` | פחמן חד-חמצני | Carbon monoxide (mg/km) |

### 6. Environmental Ratings

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `madad_yarok` | מדד ירוק | INTEGER | Green index (lower is better) |
| `kvutzat_zihum` | קבוצת זיהום | INTEGER | Pollution group (1-15) |
| `kvuzat_agra_cd` | קבוצת אגרה | INTEGER | Fee/tax group |

### 7. Standard Equipment (Boolean: 1=Yes, 0=No)

| Field | Hebrew | Description |
|-------|--------|-------------|
| `mazgan_ind` | מזגן | Air conditioning |
| `abs_ind` | ABS | Anti-lock brakes |
| `hege_koah_ind` | הגה כוח | Power steering |
| `automatic_ind` | גיר אוטומטי | Automatic transmission |
| `halon_bagg_ind` | חלון גג | Sunroof |
| `galgaley_sagsoget_kala_ind` | גלגלי סגסוגת | Alloy wheels |
| `argaz_ind` | ארגז | Cargo box |
| `matzlemat_reverse_ind` | מצלמת רברס | Reverse camera |
| `bakarat_yatzivut_ind` | בקרת יציבות | Stability control (ESC) |
| `mispar_kariot_avir` | מספר כריות אוויר | Number of airbags |
| `mispar_halonot_hashmal` | חלונות חשמליים | Electric windows count |

### 8. Safety Systems (ADAS)

| Field | Hebrew | Description |
|-------|--------|-------------|
| `bakarat_stiya_menativ_ind` | בקרת סטייה מנתיב | Lane departure warning |
| `nitur_merhak_milfanim_ind` | ניטור מרחק מלפנים | Forward collision warning |
| `zihuy_beshetah_nistar_ind` | זיהוי בשטח נסתר | Blind spot detection |
| `bakarat_shyut_adaptivit_ind` | בקרת שיוט אדפטיבית | Adaptive cruise control |
| `zihuy_holchey_regel_ind` | זיהוי הולכי רגל | Pedestrian detection |
| `maarechet_ezer_labalam_ind` | מערכת עזר לבלם | Brake assist |
| `hayshaney_lahatz_avir_batzmigim_ind` | חיישני לחץ צמיגים | TPMS |
| `teura_automatit_benesiya_kadima_ind` | תאורה אוטומטית | Auto emergency braking |
| `shlita_automatit_beorot_gvohim_ind` | שליטה באורות גבוהים | Auto high beams |
| `zihuy_tamrurey_tnua_ind` | זיהוי תמרורים | Traffic sign recognition |
| `bakarat_stiya_activ_s` | בקרת סטייה אקטיבית | Active lane keep assist |

### 9. Safety Ratings

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `nikud_betihut` | ניקוד בטיחות | DECIMAL | Safety score (0-5 stars) |
| `ramat_eivzur_betihuty` | רמת אבזור בטיחותי | INTEGER | Safety equipment level (1-5) |
| `sug_tkina_nm` | תקן | TEXT | Standard type (אירופאית) |

### 10. Electric Vehicles

| Field | Hebrew | Type | Description |
|-------|--------|------|-------------|
| `dg_metach_solela` | מתח סוללה | DECIMAL | Battery voltage |

---

## Dropdown Selection Flow

### Cascade Order:
```
1. Manufacturer (tozeret_nm)
      ↓
2. Model (kinuy_mishari)
      ↓
3. Year (shnat_yitzur)
      ↓
4. Trim Level (ramat_gimur)
```

### API Queries for Dropdowns

#### 1. Get All Manufacturers
```javascript
const url = `${API_BASE}?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&sql=SELECT DISTINCT tozeret_cd, tozeret_nm FROM "142afde2-6228-49f9-8a29-9b6c3a0cbe40" ORDER BY tozeret_nm`;
```

#### 2. Get Models by Manufacturer
```javascript
const filters = JSON.stringify({ tozeret_cd: selectedManufacturerCode });
const url = `${API_BASE}?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&filters=${encodeURIComponent(filters)}&distinct=true&fields=degem_cd,kinuy_mishari,degem_nm`;
```

#### 3. Get Years by Model
```javascript
const filters = JSON.stringify({
    tozeret_cd: selectedManufacturerCode,
    degem_cd: selectedModelCode
});
const url = `${API_BASE}?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&filters=${encodeURIComponent(filters)}&distinct=true&fields=shnat_yitzur`;
```

#### 4. Get Trim Levels
```javascript
const filters = JSON.stringify({
    tozeret_cd: selectedManufacturerCode,
    degem_cd: selectedModelCode,
    shnat_yitzur: selectedYear
});
const url = `${API_BASE}?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&filters=${encodeURIComponent(filters)}&distinct=true&fields=ramat_gimur`;
```

#### 5. Get Full Vehicle Specs
```javascript
const filters = JSON.stringify({
    tozeret_cd: selectedManufacturerCode,
    degem_cd: selectedModelCode,
    shnat_yitzur: selectedYear,
    ramat_gimur: selectedTrim
});
const url = `${API_BASE}?resource_id=142afde2-6228-49f9-8a29-9b6c3a0cbe40&filters=${encodeURIComponent(filters)}&limit=1`;
```

---

## Key Points for Implementation

1. **Primary Key**: Use combination of `(tozeret_cd, degem_cd, shnat_yitzur, ramat_gimur)` for unique identification

2. **Display Name**: Use `kinuy_mishari` (commercial name) for user-friendly display, fall back to `degem_nm` if empty

3. **Manufacturer Display**: Show `tozeret_nm` with `tozeret_eretz_nm` in parentheses

4. **Fuel Types**:
   - 1 = בנזין (Petrol)
   - 2 = דיזל (Diesel)
   - 3 = חשמל (Electric)
   - 7 = היברידי בנזין (Hybrid Petrol)

5. **Vehicle Types (sug_degem)**:
   - M = רכב פרטי (Private)
   - N = רכב מסחרי (Commercial)

6. **Boolean Fields**: All `_ind` suffix fields are boolean (0/1)

7. **Installation Source**: Fields ending with `_makor_hatkana` indicate if feature is factory installed (יצרן) or aftermarket
