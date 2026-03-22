-- ADG (Autonomous Decision Graph): grafo de decisiones versionado.
-- Hito 1: graph + versión inicial + nodos goal/plan_step + edges depends_on.

CREATE TABLE IF NOT EXISTS adg_graph (
    id TEXT NOT NULL
        CONSTRAINT pk__adg_graph PRIMARY KEY
        CONSTRAINT chk__adg_graph__id__max_length CHECK (length(id) <= 36),
    session_id TEXT NOT NULL
        CONSTRAINT chk__adg_graph__session_id__max_length CHECK (length(session_id) <= 36),
    plan_id TEXT NOT NULL
        CONSTRAINT chk__adg_graph__plan_id__max_length CHECK (length(plan_id) <= 36),
    goal TEXT NOT NULL,
    status TEXT NOT NULL
        CONSTRAINT chk__adg_graph__status
            CHECK (status IN ('active', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx__adg_graph__session_id ON adg_graph (session_id);

CREATE TABLE IF NOT EXISTS adg_graph_version (
    id TEXT NOT NULL
        CONSTRAINT pk__adg_graph_version PRIMARY KEY
        CONSTRAINT chk__adg_graph_version__id__max_length CHECK (length(id) <= 36),
    graph_id TEXT NOT NULL
        CONSTRAINT fk__adg_graph_version__graph
            REFERENCES adg_graph (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL
        CONSTRAINT chk__adg_graph_version__version_positive CHECK (version_number >= 1),
    parent_version_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq__adg_graph_version__graph_version UNIQUE (graph_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx__adg_graph_version__graph_id ON adg_graph_version (graph_id);

CREATE TABLE IF NOT EXISTS adg_graph_node (
    id TEXT NOT NULL
        CONSTRAINT pk__adg_graph_node PRIMARY KEY
        CONSTRAINT chk__adg_graph_node__id__max_length CHECK (length(id) <= 36),
    graph_version_id TEXT NOT NULL
        CONSTRAINT fk__adg_graph_node__version
            REFERENCES adg_graph_version (id) ON DELETE CASCADE,
    node_type TEXT NOT NULL
        CONSTRAINT chk__adg_graph_node__type
            CHECK (node_type IN (
                'goal', 'plan_step', 'simulation', 'decision', 'approval', 'execution'
            )),
    status TEXT NOT NULL
        CONSTRAINT chk__adg_graph_node__status
            CHECK (status IN ('pending', 'completed', 'blocked', 'failed', 'skipped')),
    logical_id TEXT NOT NULL
        CONSTRAINT chk__adg_graph_node__logical_id__max_length CHECK (length(logical_id) <= 128),
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq__adg_graph_node__version_logical UNIQUE (graph_version_id, logical_id)
);

CREATE INDEX IF NOT EXISTS idx__adg_graph_node__graph_version_id
    ON adg_graph_node (graph_version_id);

CREATE TABLE IF NOT EXISTS adg_graph_edge (
    id TEXT NOT NULL
        CONSTRAINT pk__adg_graph_edge PRIMARY KEY
        CONSTRAINT chk__adg_graph_edge__id__max_length CHECK (length(id) <= 36),
    graph_version_id TEXT NOT NULL
        CONSTRAINT fk__adg_graph_edge__version
            REFERENCES adg_graph_version (id) ON DELETE CASCADE,
    from_node_id TEXT NOT NULL
        CONSTRAINT fk__adg_graph_edge__from
            REFERENCES adg_graph_node (id) ON DELETE CASCADE,
    to_node_id TEXT NOT NULL
        CONSTRAINT fk__adg_graph_edge__to
            REFERENCES adg_graph_node (id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL
        CONSTRAINT chk__adg_graph_edge__type
            CHECK (edge_type IN ('depends_on', 'produces', 'influences')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT chk__adg_graph_edge__no_self_loop CHECK (from_node_id <> to_node_id)
);

CREATE INDEX IF NOT EXISTS idx__adg_graph_edge__graph_version_id
    ON adg_graph_edge (graph_version_id);

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '3')
ON CONFLICT (key) DO UPDATE SET value = '3', updated_at = now();
