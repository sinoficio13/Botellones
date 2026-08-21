# Delta for batch-carga

> Part of change `estados-botellon-ciclo-puro` — pure 5-estado cycle. Canonical machine: see `openspec/specs/botellon-ciclo-estados/spec.md`.

## MODIFIED Requirements

### Requirement: Confirm transition is recibido to recarga

The confirm flow MUST keep the botellon state transition `recibido -> recarga`: the batch recarga operation SHALL accept only botellones in estado `recibido` (sources `{recibido}`). An `entregado` botellon MUST NOT be accepted in a recarga batch — it must be received first via Recibir (the one-pass `entregado -> recarga` shortcut is removed). This change MUST NOT introduce a new botellon state, and `registrarCarga` / the single-flow `/recargas/nueva` MUST remain unchanged.
(Previously: "Confirm transition remains entregado to recarga" — the batch accepted `entregado` botellones directly)

#### Scenario: Batch recarga accepts a recibido botellon

- GIVEN items are accumulated and at least one item is in estado `recibido`
- WHEN the user confirms with valid fecha/hora
- THEN `registrarCarga` is called with the same `botellonIds`, fecha, and hora
- AND the item transitions `recibido -> recarga`

#### Scenario: Entregado item is rejected as invalid source

- GIVEN an accumulated item is in estado `entregado`
- WHEN the user confirms the batch
- THEN that item is rejected with reason `estado-entregado` and must be scanned through Recibir before it can be recargado

#### Scenario: Display-field flow unchanged by the new source

- GIVEN items are accumulated with the new client/status fields
- WHEN the user confirms with valid fecha/hora
- THEN `registrarCarga` is called with the same `botellonIds`, fecha, and hora
- AND the `recibido -> recarga` transition and `CargaItemResult` contract are unchanged