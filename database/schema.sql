-- =========================================================
-- Bonyad Materials — PostgreSQL schema
-- Run with:  psql "$DATABASE_URL" -f database/schema.sql
-- Idempotent: safe to re-run.
-- =========================================================

-- Needed for gen_random_uuid() if you later want UUIDs.
-- (Not used below, but harmless to enable.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------
-- 1) materials
-- Mirrors the frontend record:
--   id, name, category, unit, unitPriceAFN, availableQuantity, description
-- Column names are snake_case; the API layer maps them to camelCase
-- so the React code does not change.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
  id                  SERIAL PRIMARY KEY,
  name                TEXT        NOT NULL CHECK (length(trim(name)) > 0),
  category            TEXT        NOT NULL CHECK (category IN ('cement', 'aggregates', 'fittings')),
  unit                TEXT        NOT NULL CHECK (unit IN ('bag', 'load', 'piece')),
  unit_price_afn      INTEGER     NOT NULL CHECK (unit_price_afn > 0),
  available_quantity  INTEGER     NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  description         TEXT        NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful for filtering/sorting on the Materials page.
CREATE INDEX IF NOT EXISTS materials_category_idx     ON materials (category);
CREATE INDEX IF NOT EXISTS materials_unit_price_idx   ON materials (unit_price_afn);
CREATE INDEX IF NOT EXISTS materials_available_idx    ON materials (available_quantity) WHERE available_quantity > 0;

-- Keep updated_at fresh on UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materials_set_updated_at ON materials;
CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- 2) enquiries
-- One row per submitted sample quotation.
-- Totals are stored so the record is reproducible even if
-- prices change later. They are recomputed server-side on
-- insert — never trusted from the client.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
  id            SERIAL PRIMARY KEY,
  alias         TEXT        NOT NULL CHECK (length(trim(alias)) > 0),
  email         TEXT        NOT NULL CHECK (position('@' IN email) > 1),
  notes         TEXT        NOT NULL DEFAULT '',
  subtotal      INTEGER     NOT NULL CHECK (subtotal      >= 0),
  discount      INTEGER     NOT NULL CHECK (discount      >= 0),
  final_estimate INTEGER    NOT NULL CHECK (final_estimate >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------
-- admins: staff accounts that can manage materials.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL CHECK (position('@' IN email) > 1),
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);

-- ---------------------------------------------------------
-- 3) enquiry_lines
-- One row per material in an enquiry.
-- Snapshot of name/unit/price at submit time so history
-- stays accurate even if the material is edited or deleted.
-- This is what keeps "bags, loads, pieces" separated in
-- line summaries: unit is stored per line.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiry_lines (
  id                  SERIAL PRIMARY KEY,
  enquiry_id          INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  material_id         INTEGER          REFERENCES materials(id) ON DELETE SET NULL,
  material_name       TEXT    NOT NULL,                -- snapshot
  unit                TEXT    NOT NULL CHECK (unit IN ('bag', 'load', 'piece')),
  unit_price_afn      INTEGER NOT NULL CHECK (unit_price_afn > 0),   -- snapshot
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  line_cost_afn       INTEGER NOT NULL CHECK (line_cost_afn >= 0),   -- quantity * unit_price
  -- Only monetary cost is combined into the total; units stay separate.
  UNIQUE (enquiry_id, material_id)
);

CREATE INDEX IF NOT EXISTS enquiry_lines_enquiry_idx ON enquiry_lines (enquiry_id);

-- ---------------------------------------------------------
-- 4) Seed data — the 9 sample materials from data.js
-- ON CONFLICT keeps this safe to re-run.
-- ---------------------------------------------------------
INSERT INTO materials (id, name, category, unit, unit_price_afn, available_quantity, description)
VALUES
  (1, 'Portland Cement', 'cement',     'bag',  600,  50, 'General-purpose 50 kg cement for concrete, mortar and plaster.'),
  (2, 'White Cement',    'cement',     'bag',  850,  20, 'Fine white cement for tile joints and decorative finishes.'),
  (3, 'Quick-Set Cement','cement',     'bag',  700,  15, 'Sets in about 30 minutes. Good for small repairs.'),
  (4, 'River Sand',      'aggregates', 'load', 900,  12, 'One sample load of washed sand for plaster and block laying.'),
  (5, 'Gravel',          'aggregates', 'load', 1100,  8, 'One sample load of 20 mm gravel for concrete mixes.'),
  (6, 'Crushed Stone',   'aggregates', 'load', 1300,  0, 'Sharp crushed stone for road bases and drainage.'),
  (7, 'PVC Elbow',       'fittings',   'piece',120, 200, '90 degree PVC elbow for drain pipes.'),
  (8, 'Door Hinge',      'fittings',   'piece',250,  60, 'Heavy steel hinge for wooden or metal doors.'),
  (9, 'Water Tap',       'fittings',   'piece',480,  25, 'Brass garden tap with a half-inch thread.')
ON CONFLICT (id) DO NOTHING;

-- Make the SERIAL sequence continue after the seed ids.
SELECT setval(pg_get_serial_sequence('materials', 'id'), (SELECT MAX(id) FROM materials));