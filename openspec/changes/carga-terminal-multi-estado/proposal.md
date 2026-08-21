# Proposal: Carga Terminal Multi-Estado

## Intent

The `/recargas/carga` screen must become a **procedure terminal** for the botellon rotation lifecycle, not a single rigid case. Today it only performs `entregado → recarga` and gives no feedback when a QR is re-scanned. Staff need to structure the whole procedure — receive returns, refill, mark ready — in one scanning session, advancing each botellon's state by the selected operation with clear feedback (green target badge, red invalid badge, beep + ring on duplicate).

## Scope

### In Scope
- 3 operations: **Recibir** (`→recibido`, sources `{entregado}`), **Recargar** (`→recarga`, sources `{entregado, recibido}`, default), **Listo** (`→listo`, sources `{recarga}`)
- One-pass flow: QR scanned once per return; moves directly to the chosen estado
- State-machine update: `recarga` accepts `{entregado, recibido}`; `planta` stays in the machine (exceptions/kanban) but is not a terminal operation
- Generalized `registrarOperacion({botellonIds, operacion, fecha, hora})`; REC + loyalty only in the recarga branch
- STRICT per-op validation from the machine; invalid items marked red (not silently rejected)
- Duplicate-scan beep + transient ring; scanner hook unchanged
- Operation-scoped no-client gate (only recarga requires `cliente_id`)
- 2 sequential work-unit commits to main (backend, then frontend)

### Out of Scope
- Delivery/entregado operations (moverBotellon domain)
- Audit/movimientos table for pure estado moves
- Changes to `useQrScanner` or the single-flow `/recargas/nueva` wizard

## Capabilities

### New Capabilities
- `carga-terminal`: multi-state terminal behavior — operation selector, per-item transition badges (green/red derived from the machine), duplicate-scan beep + highlight, one-pass semantics, op-scoped client gate

### Modified Capabilities
- `batch-carga`: confirm contract generalizes `registrarCarga` → `registrarOperacion`; "Confirm transition entregado→recarga" becomes multi-source; no-client overlay becomes operation-scoped; success screen generalizes (REC/premios only for recarga)

## Approach

- `estados.ts`: add `OPERACIONES` map (op → target/sources) + `esTransicionValida`; add machine edges `entregado→recarga`, `recibido→recarga`
- `cargas.ts`: generalize to `registrarOperacion`; per-op `.in('estado', sources)` guard; recarga branch keeps REC numbering, array insert, loyalty + milestone compensation; other ops = pure estado update + revalidate. `registrarCarga` becomes a thin compat wrapper (delegates, `operacion:'recargar'`) so commit 1 keeps page + existing tests green
- `loyalty.ts`: extract shared milestone-compensation helper
- `page.tsx`: selector (default Recargar), badge via `getTransiciones(item.estado).includes(target)` (re-validates live on op switch), beep + transient `flashId` ring (~600–800ms), op-scoped no-client gate, generalized confirm/success screens
- `beep.ts` (new): tiny Web Audio util — lazy AudioContext create/resume (autoplay policy), mockable in tests
- Delivery: commit 1 = estados + cargas + loyalty + unit tests; commit 2 = beep + page + component tests (+ drop wrapper)

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/utils/estados.ts` | Modified | OPERACIONES map, esTransicionValida, 2 new edges |
| `src/lib/db/cargas.ts` | Modified | registrarCarga → registrarOperacion (+ compat wrapper) |
| `src/lib/db/loyalty.ts` | Modified | extracted compensation helper |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modified | terminal UI |
| `src/lib/scanner/beep.ts` | New | Web Audio beep util |
| `src/lib/scanner/use-qr-scanner.ts` | Unchanged | contract untouched |
| `tests/unit/carga-registrar.test.ts` | Modified | migrate + per-op scenarios |
| `tests/component/carga-page.test.tsx` | Modified | selector, badges, beep/ring, op-gate |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Web Audio autoplay (suspended context) | Med | lazy create/resume; jsdom AudioContext mock |
| Clientless items in non-recarga ops | Med | op-scoped gate; update no-client tests |
| Race with other operators | Med | server `.in('estado', sources)` guard stays source of truth |
| Test churn (769+501-line suites coupled to registrarCarga) | High | migrate per commit, Strict TDD |
| Line budget (~550–750) | High | 2 sequential work-unit commits |

## Rollback Plan

- No schema/DB change. Commit 1 is backward-compatible (wrapper) → revert it alone restores prior machine + action; page unaffected.
- Commit 2 revert restores the old page; wrapper or reverted backend keeps the pair consistent.
- Partial batch failures stay safe via the existing compensating delete.

## Dependencies

- None external. Action has exactly one production consumer (the carga page).

## Success Criteria

- [ ] All 3 operations move botellones to the correct estado; invalid transitions rejected per source
- [ ] recarga branch preserves REC numbering, loyalty, milestone compensation (existing scenarios migrate green)
- [ ] Duplicate scan beeps + rings and scanner stays open
- [ ] Valid items show green target badge; invalid show red
- [ ] Clientless botellones accepted in recibido/listo; still blocked in recargar
- [ ] Suites green after each commit; ~550–750 lines split across 2 commits
