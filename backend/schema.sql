CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1001;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  enrollment TEXT UNIQUE NOT NULL,
  hostel TEXT,
  department TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','dept_head','admin')),
  head_department TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  label TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  ticket_no TEXT UNIQUE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id),
  image_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_label TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','assigned','in_progress','resolved','reopened','closed','linked')),
  problem_type TEXT,
  category TEXT,
  department TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  summary TEXT,
  embedding DOUBLE PRECISION[],
  parent_id INT REFERENCES complaints(id),
  affected_count INT NOT NULL DEFAULT 1,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to INT REFERENCES users(id),
  resolution_note TEXT,
  -- 3rd-party worker arranged by the department head (not an app user)
  worker_name TEXT,
  worker_phone TEXT,
  expected_date DATE,
  worker_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_dept_status ON complaints(department, status);
CREATE INDEX IF NOT EXISTS idx_complaints_parent ON complaints(parent_id);

-- dropdown category chosen by the student + "this is not a duplicate" flag (safe to re-run on an existing DB)
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS main_category TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS skip_dedupe BOOLEAN NOT NULL DEFAULT FALSE;

-- Visibility chosen by the reporter: TRUE = shown on the public campus feed / search, FALSE = private
-- (only the reporter and the staff handling it can see it). Existing rows stay public.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_complaints_public ON complaints(is_public) WHERE parent_id IS NULL;

-- "I'm facing this too" votes; the reporter of a root ticket is also a row here
CREATE TABLE IF NOT EXISTS complaint_votes (
  complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  confirmed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (complaint_id, user_id)
);

-- Public comments on feed items
CREATE TABLE IF NOT EXISTS complaint_comments (
  id SERIAL PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_complaint ON complaint_comments(complaint_id, created_at);

-- Address book of outside workers per department, so heads can re-pick them quickly
CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  UNIQUE (department, phone)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  complaint_id INT REFERENCES complaints(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: coordinates are placeholders. Replace with real GPS points of your campus spots.
INSERT INTO locations (label, lat, lng) VALUES
  ('Block A Bathroom, Aryabhatta Hostel', 23.81420, 91.28410),
  ('Block B Bathroom, Aryabhatta Hostel', 23.81435, 91.28435),
  ('Block C Corridor, Aryabhatta Hostel', 23.81450, 91.28460),
  ('Mess Hall, Aryabhatta Hostel',        23.81400, 91.28480),
  ('Block A Bathroom, Bhaskara Hostel',   23.81520, 91.28600),
  ('Block B Corridor, Bhaskara Hostel',   23.81540, 91.28625),
  ('Central Library Ground Floor',        23.81300, 91.28700),
  ('Main Academic Building Lobby',        23.81250, 91.28650),
  ('Computer Centre',                     23.81280, 91.28720),
  ('Main Gate Road',                      23.81150, 91.28550),
  ('Sports Complex',                      23.81600, 91.28800)
ON CONFLICT (label) DO NOTHING;
