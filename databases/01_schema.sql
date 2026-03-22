-- Esquema mínimo inicial (convención TEXT + CHECK; ver docs/database/).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT NOT NULL
        CONSTRAINT pk__app_meta PRIMARY KEY
        CONSTRAINT chk__app_meta__key__max_length
            CHECK (length(key) <= 128),
    value TEXT NOT NULL
        CONSTRAINT chk__app_meta__value__max_length
            CHECK (length(value) <= 1024),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT (key) DO NOTHING;
