-- ADG interactivo: nodos selection_* y estados de ejecución extendidos.
-- Aplica después de 03_adg_schema.sql

ALTER TABLE adg_graph_node DROP CONSTRAINT IF EXISTS chk__adg_graph_node__type;
ALTER TABLE adg_graph_node ADD CONSTRAINT chk__adg_graph_node__type
    CHECK (node_type IN (
        'goal',
        'plan_step',
        'simulation',
        'decision',
        'approval',
        'execution',
        'selection_request',
        'selection_result'
    ));

ALTER TABLE adg_graph_node DROP CONSTRAINT IF EXISTS chk__adg_graph_node__status;
ALTER TABLE adg_graph_node ADD CONSTRAINT chk__adg_graph_node__status
    CHECK (status IN (
        'pending',
        'ready',
        'running',
        'waiting_user',
        'waiting_approval',
        'completed',
        'blocked',
        'failed',
        'skipped',
        'cancelled'
    ));

ALTER TABLE ato_session DROP CONSTRAINT IF EXISTS chk__ato_session__status;
ALTER TABLE ato_session ADD CONSTRAINT chk__ato_session__status
    CHECK (status IN (
        'active',
        'awaiting_approval',
        'awaiting_selection',
        'completed',
        'cancelled'
    ));

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '4')
ON CONFLICT (key) DO UPDATE SET value = '4', updated_at = now();
