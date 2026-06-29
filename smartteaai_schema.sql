-- ============================================================================
-- SmartTeaAI - Complete MySQL Schema
-- ============================================================================
-- An AI-Powered Market Intelligence and Price Forecasting System
-- for the Sri Lankan Tea Industry
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smartteaai
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smartteaai;

-- ============================================================================
-- SECTION 1 - USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,           -- bcrypt hashed
    full_name       VARCHAR(150),
    role            ENUM('ADMIN','FARMER','BROKER','EXPORTER','BUYER','ANALYST')
                        NOT NULL DEFAULT 'FARMER',
    grade_focus     VARCHAR(20)  DEFAULT NULL,        -- e.g. 'BOPF' - farmer primary grade
    elevation_focus VARCHAR(20)  DEFAULT NULL,        -- 'High' | 'Medium' | 'Low'
    is_approved     BOOLEAN      DEFAULT FALSE,        -- admin must approve new accounts
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_alert_preferences (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    user_id               INT NOT NULL,
    grade                 VARCHAR(20)  DEFAULT 'ALL',
    elevation             VARCHAR(20)  DEFAULT 'ALL',
    price_increase_pct    DECIMAL(5,2) DEFAULT 5.00,   -- alert if predicted rise > this %
    price_drop_pct        DECIMAL(5,2) DEFAULT 5.00,
    risk_alerts_enabled   BOOLEAN      DEFAULT TRUE,
    weather_alerts_enabled BOOLEAN     DEFAULT TRUE,
    fx_alerts_enabled     BOOLEAN      DEFAULT TRUE,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ============================================================================
-- SECTION 2 - RAW DATA SOURCES  (collected by Python scripts)
-- ============================================================================

-- Weather: from collect_weather.py - 23 sub-districts, High/Medium/Low elevation
CREATE TABLE raw_weather (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`    VARCHAR(7) NOT NULL,
    region        VARCHAR(100)   NOT NULL,             -- e.g. 'Ramboda', 'Ratnapura'
    elevation     ENUM('High','Medium','Low') NOT NULL,
    rainfall_mm   DECIMAL(10,4),
    avg_temp_c    DECIMAL(6,3),                       -- mean of daily max
    min_temp_c    DECIMAL(6,3),
    max_temp_c    DECIMAL(6,3),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_region_month (`year_month`, region)
);

-- USD/LKR exchange rate: from process_fx.py - manual CBSL download, aggregated
CREATE TABLE raw_fx_rates (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`          VARCHAR(7) NOT NULL UNIQUE,
    usd_lkr_avg         DECIMAL(10,4),
    usd_lkr_min         DECIMAL(10,4),
    usd_lkr_max         DECIMAL(10,4),
    usd_lkr_volatility  DECIMAL(10,4),                -- max - min
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily USD/LKR spot rate: from process_fx.py (CBSL scrape) — audit/raw layer
CREATE TABLE raw_fx_daily (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    `date`      DATE NOT NULL UNIQUE,
    usd_lkr     DECIMAL(10,4),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLTB: Sub District Price — audit/raw layer, feeds the frontend
-- Grade & Elevation Comparison module (not merged into raw_sltb_features)
CREATE TABLE raw_sltb_sub_district_price (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`  VARCHAR(7) NOT NULL,
    sub_district  VARCHAR(100) NOT NULL,
    monthly_avg   DECIMAL(10,4),
    cum_avg       DECIMAL(10,4),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_sub_district_month (`year_month`, sub_district)
);

-- SLTB: Production Volume by Elevation
CREATE TABLE raw_sltb_production_elevation (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`  VARCHAR(7) NOT NULL,
    elevation     VARCHAR(20) NOT NULL,              -- High | Medium | Low | Total
    quantity_kg   DECIMAL(14,2),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_prod_elevation_month (`year_month`, elevation)
);

-- SLTB: Production Volume by Process (Orthodox / CTC / Green Tea)
CREATE TABLE raw_sltb_production_process (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`  VARCHAR(7) NOT NULL,
    process       VARCHAR(50) NOT NULL,
    quantity_kg   DECIMAL(14,2),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_prod_process_month (`year_month`, process)
);

-- SLTB: Sales Volume Direct — price + quantity per elevation (key ML feature source)
CREATE TABLE raw_sltb_sales_volume (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`  VARCHAR(7) NOT NULL,
    process       VARCHAR(50),                       -- sale type, e.g. 'Direct'
    elevation     VARCHAR(20) NOT NULL,              -- High | Medium | Low
    quantity_kg   DECIMAL(14,2),
    price_rs      DECIMAL(10,4),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_sales_volume (`year_month`, elevation, process)
);

-- SLTB: Export (Black / Green / ... by package type)
CREATE TABLE raw_sltb_export (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`    VARCHAR(7) NOT NULL,
    tea_category    VARCHAR(50) NOT NULL,
    package_type    VARCHAR(100) NOT NULL,
    quantity_kg     DECIMAL(14,2),
    fob_rs_per_kg   DECIMAL(10,4),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_export_record (`year_month`, tea_category, package_type)
);

-- SLTB: Reexport — same structure as Export, audit/raw layer only
CREATE TABLE raw_sltb_reexport (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`    VARCHAR(7) NOT NULL,
    tea_category    VARCHAR(50) NOT NULL,
    package_type    VARCHAR(100) NOT NULL,
    quantity_kg     DECIMAL(14,2),
    fob_rs_per_kg   DECIMAL(10,4),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reexport_record (`year_month`, tea_category, package_type)
);

-- Tea auction prices: from SLTB / World Bank Pink Sheet
CREATE TABLE raw_tea_prices (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`    VARCHAR(7)   NOT NULL,
    grade         VARCHAR(20)  NOT NULL,               -- BOPF, BOP, OP, Pekoe, Dust
    elevation     ENUM('High','Medium','Low') NOT NULL,
    price_lkr_kg  DECIMAL(10,4) NOT NULL,
    volume_kg     BIGINT        DEFAULT NULL,           -- quantity sold that month, if available
    source        VARCHAR(100)  DEFAULT 'SLTB',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_price_record (`year_month`, grade, elevation)
);

-- Export / production volumes: Tea Exporters Association + SLTB
CREATE TABLE raw_export_production (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`         VARCHAR(7) NOT NULL UNIQUE,
    production_kg      BIGINT,
    export_kg          BIGINT,
    high_grown_kg      BIGINT,
    mid_grown_kg       BIGINT,
    low_grown_kg       BIGINT,
    top_destination_1  VARCHAR(50)  DEFAULT NULL,      -- e.g. 'Iraq'
    top_destination_2  VARCHAR(50)  DEFAULT NULL,      -- e.g. 'Russia'
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel / oil price: World Bank Pink Sheet (Brent crude proxy) + CPC local diesel
CREATE TABLE raw_fuel_price (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`         VARCHAR(7) NOT NULL UNIQUE,
    oil_brent_usd_bbl  DECIMAL(10,4),
    diesel_lkr_litre   DECIMAL(10,4) DEFAULT NULL,      -- local CPC price, manually entered
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitor tea prices: World Bank Pink Sheet (Mombasa/Nairobi)
CREATE TABLE raw_competitor_prices (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`        VARCHAR(7) NOT NULL UNIQUE,
    mombasa_usd_kg    DECIMAL(10,4),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw news articles collected for sentiment scoring (before FinBERT scoring)
CREATE TABLE raw_news_articles (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(500),
    description     TEXT,
    source          VARCHAR(150),
    published_date  DATE,
    `year_month`      VARCHAR(7),
    sentiment_label ENUM('POSITIVE','NEGATIVE','NEUTRAL') DEFAULT NULL,
    sentiment_score DECIMAL(6,4) DEFAULT NULL,          -- -1.0 to +1.0, from FinBERT
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_year_month (`year_month`)
);

-- Aggregated weekly/monthly sentiment score (used as ML feature)
CREATE TABLE sentiment_scores (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`     VARCHAR(7) NOT NULL UNIQUE,
    avg_score      DECIMAL(6,4) NOT NULL,               -- average across all articles that month
    article_count  INT DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- SECTION 3 - UNIFIED ML FEATURE TABLE
-- ============================================================================
-- This is the merged, feature-engineered table that feeds the ML models.
-- Populated by the Python merge/feature-engineering pipeline (Week 2).

CREATE TABLE raw_sltb_features (
    id                              INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`                    VARCHAR(7) NOT NULL UNIQUE,

    -- Sales price & volume (Sales Volume Direct, by elevation) — ML prediction targets
    sales_price_rs_direct           DECIMAL(10,4),
    sales_price_rs_high             DECIMAL(10,4),
    sales_price_rs_low              DECIMAL(10,4),
    sales_price_rs_medium           DECIMAL(10,4),
    sales_quantity_kg_direct        DECIMAL(14,2),
    sales_quantity_kg_high          DECIMAL(14,2),
    sales_quantity_kg_low           DECIMAL(14,2),
    sales_quantity_kg_medium        DECIMAL(14,2),

    -- Production
    prod_high_kg                    DECIMAL(14,2),
    prod_medium_kg                  DECIMAL(14,2),
    prod_low_kg                     DECIMAL(14,2),
    prod_ctc_kg                     DECIMAL(14,2),
    prod_orthodox_kg                DECIMAL(14,2),
    prod_green_tea_kg               DECIMAL(14,2),

    -- Export (Black tea only — see collect_sltb.py build_features())
    export_black_qty_kg             DECIMAL(14,2),
    export_black_fob_avg            DECIMAL(10,4),

    -- Weather: national average (collect_weather.py)
    rainfall_mm                     DECIMAL(10,4),
    avg_temp_c                      DECIMAL(6,3),

    -- Economic (process_fx.py / collect_oil.py)
    usd_lkr_avg                     DECIMAL(10,4),
    oil_price                       DECIMAL(10,4),

    -- Sentiment
    sentiment_score                 DECIMAL(6,4),

    -- Engineered lag / rolling features (per sales price column)
    sales_price_rs_direct_lag1      DECIMAL(10,4),
    sales_price_rs_direct_lag3      DECIMAL(10,4),
    sales_price_rs_direct_roll3     DECIMAL(10,4),
    sales_price_rs_high_lag1        DECIMAL(10,4),
    sales_price_rs_high_lag3        DECIMAL(10,4),
    sales_price_rs_high_roll3       DECIMAL(10,4),
    sales_price_rs_low_lag1         DECIMAL(10,4),
    sales_price_rs_low_lag3         DECIMAL(10,4),
    sales_price_rs_low_roll3        DECIMAL(10,4),
    sales_price_rs_medium_lag1      DECIMAL(10,4),
    sales_price_rs_medium_lag3      DECIMAL(10,4),
    sales_price_rs_medium_roll3     DECIMAL(10,4),

    -- Time features
    month                           TINYINT,
    quarter                         TINYINT,
    is_peak_season                  BOOLEAN,

    updated_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================================
-- SECTION 4 - ML MODELS, EVALUATION & EXPLAINABILITY
-- ============================================================================

CREATE TABLE ml_models (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    model_name      ENUM('ARIMA','RANDOM_FOREST','XGBOOST','LSTM') NOT NULL,
    version         VARCHAR(20)   NOT NULL,             -- e.g. 'v1.0', trained date-based
    file_path       VARCHAR(255)  NOT NULL,             -- path to .pkl / .h5 file
    hyperparameters JSON          DEFAULT NULL,         -- stores tuned params
    is_active        BOOLEAN      DEFAULT FALSE,        -- only one active "best model" at a time
    trained_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE model_evaluations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    model_id        INT NOT NULL,
    mae             DECIMAL(10,4),
    rmse            DECIMAL(10,4),
    mape            DECIMAL(8,6),
    r2_score        DECIMAL(8,6),
    evaluated_on    VARCHAR(20)  DEFAULT 'test_set',    -- 'train' | 'validation' | 'test_set'
    evaluated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE
);

CREATE TABLE feature_importance (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    model_id        INT NOT NULL,
    feature_name    VARCHAR(100) NOT NULL,
    importance      DECIMAL(10,6) NOT NULL,             -- SHAP mean |value|
    `rank`            TINYINT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE
);


-- ============================================================================
-- SECTION 5 - PREDICTIONS, RECOMMENDATIONS, RISK
-- ============================================================================

CREATE TABLE predictions (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`        VARCHAR(7)   NOT NULL,
    grade             VARCHAR(20)  NOT NULL,
    elevation         ENUM('High','Medium','Low') NOT NULL,
    predicted_price   DECIMAL(10,4) NOT NULL,
    price_lower_bound DECIMAL(10,4),                    -- confidence range
    price_upper_bound DECIMAL(10,4),
    confidence        DECIMAL(5,4),                     -- 0.0 - 1.0
    risk_level        ENUM('LOW','MEDIUM','HIGH') NOT NULL,
    model_id          INT NOT NULL,
    actual_price      DECIMAL(10,4) DEFAULT NULL,       -- filled in once real auction result known
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id),
    INDEX idx_pred_lookup (`year_month`, grade, elevation)
);

CREATE TABLE shap_explanations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    prediction_id   INT NOT NULL,
    feature_name    VARCHAR(100) NOT NULL,
    shap_value      DECIMAL(10,4) NOT NULL,             -- + or - contribution in price terms
    `rank`            TINYINT,                            -- 1 = most influential
    plain_language  VARCHAR(255)  DEFAULT NULL,         -- e.g. "Below-average rainfall"
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
);

CREATE TABLE recommendations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    prediction_id   INT NOT NULL,
    action          ENUM('SELL','HOLD','MONITOR') NOT NULL,
    justification   TEXT,                                -- plain-language, SHAP-derived
    target_role     ENUM('FARMER','BROKER','EXPORTER','BUYER','ANALYST','ALL') DEFAULT 'ALL',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
);

CREATE TABLE risk_volatility (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    `year_month`        VARCHAR(7) NOT NULL,
    grade             VARCHAR(20) NOT NULL,
    elevation         ENUM('High','Medium','Low') NOT NULL,
    volatility_score  DECIMAL(10,4),
    risk_level        ENUM('LOW','MEDIUM','HIGH') NOT NULL,
    spike_detected    BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_risk_record (`year_month`, grade, elevation)
);


-- ============================================================================
-- SECTION 6 - WHAT-IF SCENARIO SIMULATOR
-- ============================================================================

CREATE TABLE scenarios (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    grade               VARCHAR(20),
    elevation           ENUM('High','Medium','Low'),

    -- Hypothetical inputs the user adjusted
    rainfall_change_pct DECIMAL(6,2)  DEFAULT 0,
    fx_change_pct       DECIMAL(6,2)  DEFAULT 0,
    export_change_pct   DECIMAL(6,2)  DEFAULT 0,
    fuel_change_pct      DECIMAL(6,2) DEFAULT 0,
    sentiment_override  DECIMAL(6,4)  DEFAULT NULL,

    -- Output
    predicted_price_impact_pct DECIMAL(8,4),
    predicted_risk_level       ENUM('LOW','MEDIUM','HIGH'),
    recommended_action         ENUM('SELL','HOLD','MONITOR'),

    saved_label         VARCHAR(150)  DEFAULT NULL,      -- user-given name if saved
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ============================================================================
-- SECTION 7 - ALERTS & NOTIFICATIONS
-- ============================================================================

CREATE TABLE alerts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    alert_type      ENUM('PRICE_INCREASE','PRICE_DROP','HIGH_VOLATILITY',
                         'FX_IMPACT','WEATHER_RISK','MODEL_UPDATE') NOT NULL,
    grade           VARCHAR(20)  DEFAULT 'ALL',
    elevation       VARCHAR(20)  DEFAULT 'ALL',
    message         VARCHAR(500) NOT NULL,
    severity        ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
    related_prediction_id INT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (related_prediction_id) REFERENCES predictions(id) ON DELETE SET NULL
);

CREATE TABLE user_alerts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    alert_id        INT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_alert (user_id, alert_id)
);


-- ============================================================================
-- SECTION 8 - REPORTS
-- ============================================================================

CREATE TABLE reports (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    report_type     ENUM('WEEKLY','MONTHLY') NOT NULL,
    `year_month`      VARCHAR(7) NOT NULL,
    file_path       VARCHAR(255) NOT NULL,               -- generated PDF location
    generated_by    INT  DEFAULT NULL,                    -- NULL = auto-generated, else admin user_id
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE report_downloads (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    report_id       INT NOT NULL,
    user_id         INT NOT NULL,
    downloaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);


-- ============================================================================
-- SECTION 9 - SYSTEM / AUDIT LOG  (admin module)
-- ============================================================================

CREATE TABLE audit_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT  DEFAULT NULL,
    action_type     ENUM('LOGIN','DATA_UPLOAD','MODEL_RETRAIN',
                         'USER_APPROVED','USER_DEACTIVATED','REPORT_DOWNLOAD') NOT NULL,
    details         VARCHAR(500) DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE data_uploads (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    uploaded_by     INT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    dataset_type    ENUM('TEA_PRICES','WEATHER','FX_RATES','EXPORT_VOLUME','OTHER') NOT NULL,
    rows_processed  INT DEFAULT 0,
    status          ENUM('SUCCESS','FAILED','PARTIAL') DEFAULT 'SUCCESS',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
