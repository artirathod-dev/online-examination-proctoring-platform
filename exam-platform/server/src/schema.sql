CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  topic TEXT DEFAULT 'General',
  marks INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_min INT NOT NULL,
  pass_percent INT NOT NULL DEFAULT 40,
  shuffle BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id INT REFERENCES exams(id) ON DELETE CASCADE,
  question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, question_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id),
  user_id INT NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  score INT,
  total INT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  UNIQUE (exam_id, user_id)
);
CREATE TABLE IF NOT EXISTS answers (
  attempt_id INT REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INT REFERENCES questions(id),
  selected INT,
  PRIMARY KEY (attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS violations (
  id SERIAL PRIMARY KEY,
  attempt_id INT REFERENCES attempts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  attempt_id INT REFERENCES attempts(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
