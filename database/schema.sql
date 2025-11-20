-- Vehicle Models Database Schema (WLTP Dataset)
-- Source: https://data.gov.il/dataset/degem-rechev-wltp
-- Resource ID: 142afde2-6228-49f9-8a29-9b6c3a0cbe40

-- ===========================================
-- MAIN TABLE: vehicle_models
-- ===========================================

CREATE TABLE vehicle_models (
    id SERIAL PRIMARY KEY,

    -- IDENTIFICATION (for dropdown selection)
    tozeret_cd INTEGER NOT NULL,           -- Manufacturer code
    tozeret_nm VARCHAR(100) NOT NULL,      -- Manufacturer name (Hebrew)
    tozeret_eretz_nm VARCHAR(50),          -- Country of origin
    tozar VARCHAR(100),                    -- Brand name
    degem_cd INTEGER NOT NULL,             -- Model code
    degem_nm VARCHAR(50) NOT NULL,         -- Model technical name
    kinuy_mishari VARCHAR(100),            -- Commercial name (e.g., "Corolla", "Civic")
    sug_degem CHAR(1),                     -- Vehicle type: M=Private, N=Commercial, etc.
    shnat_yitzur INTEGER NOT NULL,         -- Year of manufacture
    ramat_gimur VARCHAR(50),               -- Trim level (e.g., "COMFORT", "STYLE")

    -- BASIC SPECIFICATIONS
    nefah_manoa INTEGER,                   -- Engine volume (cc)
    koah_sus INTEGER,                      -- Horsepower
    mishkal_kolel INTEGER,                 -- Gross weight (kg)
    gova INTEGER,                          -- Height (mm)
    mispar_dlatot INTEGER,                 -- Number of doors
    mispar_moshavim INTEGER,               -- Number of seats
    merkav VARCHAR(50),                    -- Body type

    -- FUEL & DRIVETRAIN
    delek_cd INTEGER,                      -- Fuel code
    delek_nm VARCHAR(50),                  -- Fuel type name
    hanaa_cd INTEGER,                      -- Drive type code
    hanaa_nm VARCHAR(50),                  -- Drive type (4x4, 4x2, etc.)
    technologiat_hanaa_cd INTEGER,         -- Drive technology code
    technologiat_hanaa_nm VARCHAR(50),     -- Drive technology (Regular, Hybrid, Electric)
    automatic_ind INTEGER DEFAULT 0,       -- Automatic transmission (1=yes)
    sug_mamir_cd INTEGER,                  -- Converter type code
    sug_mamir_nm VARCHAR(50),              -- Converter type

    -- TOWING CAPACITY
    kosher_grira_im_blamim INTEGER,        -- Towing with brakes (kg)
    kosher_grira_bli_blamim INTEGER,       -- Towing without brakes (kg)

    -- EMISSIONS (NEDC)
    kamut_CO2 DECIMAL(10,2),
    kamut_NOX DECIMAL(10,2),
    kamut_PM10 DECIMAL(10,2),
    kamut_HC DECIMAL(10,2),
    kamut_HC_NOX DECIMAL(10,2),
    kamut_CO DECIMAL(10,2),
    kamut_CO2_city DECIMAL(10,2),
    kamut_NOX_city DECIMAL(10,2),
    kamut_PM10_city DECIMAL(10,2),
    kamut_HC_city DECIMAL(10,2),
    kamut_CO_city DECIMAL(10,2),
    kamut_CO2_hway DECIMAL(10,2),
    kamut_NOX_hway DECIMAL(10,2),
    kamut_PM10_hway DECIMAL(10,2),
    kamut_HC_hway DECIMAL(10,2),
    kamut_CO_hway DECIMAL(10,2),

    -- EMISSIONS (WLTP)
    CO2_WLTP DECIMAL(10,2),
    HC_WLTP DECIMAL(10,2),
    PM_WLTP DECIMAL(10,2),
    NOX_WLTP DECIMAL(10,2),
    CO_WLTP DECIMAL(10,2),
    CO2_WLTP_NEDC DECIMAL(10,2),

    -- ENVIRONMENTAL RATING
    madad_yarok INTEGER,                   -- Green index
    kvutzat_zihum INTEGER,                 -- Pollution group
    kvuzat_agra_cd INTEGER,                -- Fee group code

    -- STANDARD EQUIPMENT (Boolean indicators)
    mazgan_ind INTEGER DEFAULT 0,                    -- Air conditioning
    abs_ind INTEGER DEFAULT 0,                       -- ABS brakes
    hege_koah_ind INTEGER DEFAULT 0,                 -- Power steering
    halon_bagg_ind INTEGER DEFAULT 0,                -- Sunroof
    galgaley_sagsoget_kala_ind INTEGER DEFAULT 0,    -- Alloy wheels
    argaz_ind INTEGER DEFAULT 0,                     -- Cargo box
    matzlemat_reverse_ind INTEGER DEFAULT 0,         -- Reverse camera
    bakarat_yatzivut_ind INTEGER DEFAULT 0,          -- Stability control

    -- AIRBAGS & WINDOWS
    kariot_avir_source VARCHAR(10),
    mispar_kariot_avir INTEGER,                      -- Number of airbags
    halonot_hashmal_source VARCHAR(10),
    mispar_halonot_hashmal INTEGER,                  -- Electric windows count

    -- SAFETY SYSTEMS (ADAS)
    bakarat_stiya_menativ_ind INTEGER DEFAULT 0,     -- Lane departure warning
    bakarat_stiya_menativ_makor_hatkana VARCHAR(20),
    nitur_merhak_milfanim_ind INTEGER DEFAULT 0,     -- Forward collision warning
    nitur_merhak_milfanim_makor_hatkana VARCHAR(20),
    zihuy_beshetah_nistar_ind INTEGER DEFAULT 0,     -- Blind spot detection
    bakarat_shyut_adaptivit_ind INTEGER DEFAULT 0,   -- Adaptive cruise control
    zihuy_holchey_regel_ind INTEGER DEFAULT 0,       -- Pedestrian detection
    zihuy_holchey_regel_makor_hatkana VARCHAR(20),
    maarechet_ezer_labalam_ind INTEGER DEFAULT 0,    -- Brake assist
    hayshaney_lahatz_avir_batzmigim_ind INTEGER DEFAULT 0, -- TPMS
    hayshaney_hagorot_ind INTEGER DEFAULT 0,         -- Belt sensors
    teura_automatit_benesiya_kadima_ind INTEGER DEFAULT 0, -- Auto emergency braking
    shlita_automatit_beorot_gvohim_ind INTEGER DEFAULT 0,  -- Auto high beams
    shlita_automatit_beorot_gvohim_makor_hatkana VARCHAR(20),
    zihuy_matzav_hitkarvut_mesukenet_ind INTEGER DEFAULT 0, -- Collision warning
    zihuy_tamrurey_tnua_ind INTEGER DEFAULT 0,       -- Traffic sign recognition
    zihuy_rechev_do_galgali INTEGER DEFAULT 0,       -- Motorcycle detection
    zihuy_tamrurey_tnua_makor_hatkana VARCHAR(20),
    bakarat_stiya_activ_s INTEGER DEFAULT 0,         -- Active lane keep
    blima_otomatit_nesia_leahor INTEGER DEFAULT 0,   -- Auto brake reverse
    bakarat_mehirut_isa INTEGER DEFAULT 0,           -- ISA speed control
    blimat_hirum_lifnei_holhei_regel_ofanaim INTEGER DEFAULT 0, -- Emergency brake for pedestrians/cyclists
    hitnagshut_cad_shetah_met INTEGER DEFAULT 0,     -- Side collision blind spot
    alco_lock INTEGER DEFAULT 0,                     -- Alcohol lock ready

    -- SAFETY RATINGS
    nikud_betihut DECIMAL(3,1),            -- Safety score
    ramat_eivzur_betihuty INTEGER,         -- Safety equipment level
    sug_tkina_cd INTEGER,                  -- Standard type code
    sug_tkina_nm VARCHAR(50),              -- Standard type (European, etc.)

    -- ELECTRIC VEHICLE
    dg_metach_solela DECIMAL(10,2),        -- Battery voltage

    -- METADATA
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- UNIQUE CONSTRAINT for dropdown selection
    UNIQUE(tozeret_cd, degem_cd, shnat_yitzur, ramat_gimur)
);

-- ===========================================
-- INDEXES for efficient dropdown queries
-- ===========================================

-- For manufacturer dropdown (first level)
CREATE INDEX idx_manufacturers ON vehicle_models(tozeret_cd, tozeret_nm);

-- For model dropdown (second level - filtered by manufacturer)
CREATE INDEX idx_models ON vehicle_models(tozeret_cd, kinuy_mishari, degem_nm);

-- For year dropdown (third level)
CREATE INDEX idx_years ON vehicle_models(tozeret_cd, degem_cd, shnat_yitzur);

-- For trim level dropdown (fourth level)
CREATE INDEX idx_trims ON vehicle_models(tozeret_cd, degem_cd, shnat_yitzur, ramat_gimur);

-- For search functionality
CREATE INDEX idx_search ON vehicle_models(tozeret_nm, kinuy_mishari, shnat_yitzur);

-- ===========================================
-- VIEWS for dropdown selection
-- ===========================================

-- View: Distinct manufacturers for dropdown
CREATE VIEW v_manufacturers AS
SELECT DISTINCT
    tozeret_cd,
    tozeret_nm,
    tozeret_eretz_nm
FROM vehicle_models
ORDER BY tozeret_nm;

-- View: Models by manufacturer for dropdown
CREATE VIEW v_models_by_manufacturer AS
SELECT DISTINCT
    tozeret_cd,
    degem_cd,
    kinuy_mishari,
    degem_nm
FROM vehicle_models
ORDER BY kinuy_mishari;

-- View: Years by model for dropdown
CREATE VIEW v_years_by_model AS
SELECT DISTINCT
    tozeret_cd,
    degem_cd,
    shnat_yitzur
FROM vehicle_models
ORDER BY shnat_yitzur DESC;

-- View: Trim levels by model and year
CREATE VIEW v_trims AS
SELECT DISTINCT
    tozeret_cd,
    degem_cd,
    shnat_yitzur,
    ramat_gimur
FROM vehicle_models
ORDER BY ramat_gimur;
