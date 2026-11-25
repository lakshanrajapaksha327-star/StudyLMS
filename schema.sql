-- =============================================================================
-- AI STUDY ASSISTANT & NOTEBOOKLM PLATFORM DATABASE SCHEMA
-- PostgreSQL 14+ Compatible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- 2. CUSTOM TYPES / ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_type_enum AS ENUM ('pdf', 'text', 'markdown', 'pasted', 'url');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tutor_persona_enum AS ENUM (
        'Standard Tutor',
        'Socratic Tutor',
        'Exam Coach',
        'Simplified Explainer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_sender_enum AS ENUM ('user', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE card_difficulty_enum AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE card_status_enum AS ENUM ('new', 'learning', 'mastered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quiz_question_type_enum AS ENUM ('multiple-choice', 'true-false', 'short-answer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type_enum AS ENUM ('reading', 'quiz', 'notes', 'review', 'assignment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- -----------------------------------------------------------------------------
-- 3. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- 4. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'student',
    avatar_url TEXT,
    study_goal_minutes INT DEFAULT 60 CHECK (study_goal_minutes >= 0),
    streak_days INT DEFAULT 0 CHECK (streak_days >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- -----------------------------------------------------------------------------
-- 5. NOTEBOOKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notebooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(30) DEFAULT '#4F46E5',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_notebooks_updated_at
    BEFORE UPDATE ON notebooks
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- -----------------------------------------------------------------------------
-- 6. DOCUMENTS (NOTEBOOKLM GROUNDED SOURCES) TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_type document_type_enum NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    summary TEXT,
    key_concepts JSONB DEFAULT '[]'::jsonb,
    file_size_bytes BIGINT DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- -----------------------------------------------------------------------------
-- 7. DOCUMENT CHUNKS TABLE (FOR RAG GROUNDING & VECTOR SEARCH)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id);


-- -----------------------------------------------------------------------------
-- 8. STUDY NOTES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_study_notes_updated_at
    BEFORE UPDATE ON study_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- -----------------------------------------------------------------------------
-- 9. FLASHCARD SETS & FLASHCARDS TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcard_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_flashcard_sets_updated_at
    BEFORE UPDATE ON flashcard_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    hint TEXT,
    difficulty card_difficulty_enum DEFAULT 'medium',
    status card_status_enum DEFAULT 'new',
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flashcards_set_id ON flashcards(set_id);


-- -----------------------------------------------------------------------------
-- 10. QUIZ SETS & QUIZ QUESTIONS TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    best_score NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_quiz_sets_updated_at
    BEFORE UPDATE ON quiz_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
    question_type quiz_question_type_enum DEFAULT 'multiple-choice',
    question TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_set_id ON quiz_questions(quiz_set_id);


-- -----------------------------------------------------------------------------
-- 11. QUIZ ATTEMPTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,
    total_questions INT NOT NULL,
    correct_count INT NOT NULL,
    time_taken_seconds INT DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- -----------------------------------------------------------------------------
-- 12. CHAT SESSIONS & CHAT MESSAGES TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES notebooks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat Session',
    persona tutor_persona_enum DEFAULT 'Standard Tutor',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender chat_sender_enum NOT NULL,
    text_content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    sources_used JSONB DEFAULT '[]'::jsonb,
    tokens_consumed INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);


-- -----------------------------------------------------------------------------
-- 13. STUDY PLANNER TASKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(120) NOT NULL,
    scheduled_date DATE NOT NULL,
    duration_minutes INT DEFAULT 30 CHECK (duration_minutes > 0),
    completed BOOLEAN DEFAULT FALSE,
    priority task_priority_enum DEFAULT 'medium',
    task_type task_type_enum DEFAULT 'review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON study_tasks(user_id, scheduled_date);


-- -----------------------------------------------------------------------------
-- 14. USER PREFERENCES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'system',
    ai_model_preference VARCHAR(50) DEFAULT 'gemini-3.6-flash',
    default_card_count INT DEFAULT 5,
    socratic_tutor_mode BOOLEAN DEFAULT FALSE,
    auto_summarize BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- -----------------------------------------------------------------------------
-- 15. ACTIVITY LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    notebook_title VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);


-- -----------------------------------------------------------------------------
-- 16. INDEXES FOR PERFORMANCE & FULL-TEXT SEARCH
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notebooks_user ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_notebook ON documents(notebook_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_notebook ON study_notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_notebook ON quiz_sets(notebook_id);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_notes_fts ON study_notes USING gin(to_tsvector('english', title || ' ' || content));


-- -----------------------------------------------------------------------------
-- 17. SEED DATA (INITIAL DEMO DATA)
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'student@aistudio.edu',
    '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    'Alex Rivera',
    'student'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO notebooks (id, user_id, title, description, color)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Calculus & Differential Equations',
    'Limits, derivatives, integrals, and differential equations notes and grounded sources',
    '#6366F1'
) ON CONFLICT DO NOTHING;

INSERT INTO documents (id, notebook_id, user_id, title, file_type, content, summary, key_concepts)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Calculus Fundamentals & Limits',
    'pdf',
    'Calculus is the mathematical study of continuous change. Fundamental theorem of calculus links differentiation with integration.',
    'A comprehensive overview of foundational calculus theorems including limits, continuity, and L''Hopital''s rule.',
    '["Limits", "Derivatives", "Integration", "Fundamental Theorem"]'::jsonb
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
