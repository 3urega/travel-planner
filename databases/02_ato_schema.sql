-- ATO (Autonomous Travel Operator) schema.
-- Sesiones de agente y trail completo de auditoría.
-- Convenciones: TEXT + CHECK en lugar de VARCHAR; NOT NULL en campos requeridos por negocio.

CREATE TABLE IF NOT EXISTS ato_session (
    id TEXT NOT NULL
        CONSTRAINT pk__ato_session PRIMARY KEY
        CONSTRAINT chk__ato_session__id__max_length CHECK (length(id) <= 36),
    goal TEXT NOT NULL,
    status TEXT NOT NULL
        CONSTRAINT chk__ato_session__status
            CHECK (status IN ('active', 'awaiting_approval', 'completed', 'cancelled')),
    -- plan_id es opcional: se rellena tras generar el plan
    plan_id TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ato_audit_event (
    id TEXT NOT NULL
        CONSTRAINT pk__ato_audit_event PRIMARY KEY
        CONSTRAINT chk__ato_audit_event__id__max_length CHECK (length(id) <= 36),
    session_id TEXT NOT NULL
        CONSTRAINT chk__ato_audit_event__session_id__max_length CHECK (length(session_id) <= 36),
    type TEXT NOT NULL
        CONSTRAINT chk__ato_audit_event__type__max_length CHECK (length(type) <= 64),
    actor TEXT NOT NULL
        CONSTRAINT chk__ato_audit_event__actor
            CHECK (actor IN ('llm', 'system', 'user')),
    -- Campos opcionales (pueden no aplicar a todos los tipos de evento)
    plan_id TEXT,
    step_id TEXT,
    reason TEXT,
    payload_snapshot JSONB,
    approval_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx__ato_audit_event__session_id
    ON ato_audit_event (session_id);

CREATE INDEX IF NOT EXISTS idx__ato_audit_event__created_at
    ON ato_audit_event (created_at);

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '2')
ON CONFLICT (key) DO UPDATE SET value = '2', updated_at = now();
