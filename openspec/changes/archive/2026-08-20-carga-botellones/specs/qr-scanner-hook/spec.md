# qr-scanner-hook Specification

## Purpose

Extract the camera/decode loop currently embedded in `scanner-modal.tsx` into a shared `useQrScanner` hook (`src/lib/scanner/use-qr-scanner.ts`) so the single-flow modal and the new batch-carga page reuse one proven decode path. The hook SHALL preserve the existing modal's decode/lockout/StrictMode/cleanup behavior exactly; the refactor is additive and MUST NOT change single-flow behavior.

## Requirements

### Requirement: Camera acquisition and rAF decode loop

`useQrScanner` MUST acquire a `MediaStream` via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })`, assign it to the `videoRef.current.srcObject`, and drive decode with a `requestAnimationFrame` loop throttled to at most 15 fps (≥66ms per frame), downscaling the capture surface to a max dimension of 640px before running `jsQR`. The hook SHALL expose `videoRef`, `cameraError`, `decodeError`, `setDecodeError`, and `stop`.

#### Scenario: Happy path frames decode

- GIVEN the hook is mounted with a `videoRef`
- WHEN the camera stream is ready and a frame containing a QR is presented
- THEN `jsQR` runs on a ≤640px downscaled canvas at ≤15fps
- AND the decoded raw string is passed to `onDecode`

#### Scenario: Camera permission denied

- GIVEN `getUserMedia` rejects with a `NotAllowedError`
- WHEN the rejection is caught
- THEN `cameraError` is set to `permission-denied` and no stream is started

#### Scenario: Camera unavailable

- GIVEN `getUserMedia` is absent or rejects for a reason other than permission
- WHEN acquisition fails
- THEN `cameraError` is set to `camera-unavailable`

#### Scenario: Missing MediaDevices API

- GIVEN `navigator.mediaDevices?.getUserMedia` is undefined
- WHEN the hook starts
- THEN `cameraError` is set to `camera-unavailable` without throwing

### Requirement: Decode lockout and resolution pause

On a successful decode, the hook MUST apply a 1s lockout (default `lockoutMs = 1000`) so the same code does not double-fire, and MUST pause the loop while an `async onDecode` is resolving to avoid duplicate frames, resuming on failure paths.

#### Scenario: Lockout suppresses rapid duplicate decodes

- GIVEN the same code is decoded twice within `lockoutMs`
- WHEN the second decode is attempted
- THEN `onDecode` is not invoked for the second occurrence

#### Scenario: Loop pauses during async resolution then resumes on failure

- GIVEN `onDecode` is async and resolves to a failure (e.g. code not found)
- WHEN the hook awaits `onDecode`
- THEN no new decode fires during the await
- AND the rAF loop resumes after the failure so scanning continues

### Requirement: StrictMode-safe lifecycle and cleanup

The hook MUST guard against late resolution after unmount using a per-effect `disposed` flag (not a shared ref), MUST cancel the rAF loop and stop every stream track on cleanup, and MUST expose an idempotent `stop()` that stops tracks and cancels the loop.

#### Scenario: Unmount cancels loop and stops tracks

- GIVEN the hook unmounts (including a StrictMode double-mount)
- WHEN cleanup runs
- THEN `cancelAnimationFrame` is called, every `track.stop()` runs, and no late `setState` fires after unmount

#### Scenario: Explicit stop is idempotent

- GIVEN `stop()` has already been called
- WHEN `stop()` is called again
- THEN no error is thrown and no track is stopped twice

### Requirement: Decode error surfacing

The hook SHALL expose `decodeError` and `setDecodeError` so the caller can render a non-blocking overlay while scanning continues and surface caller-side outcomes (not-found / no-client). It SHALL distinguish invalid codes (passed via `parseQrCode`) from not-found / no-client outcomes, delegating resolution to the caller's `onDecode`.

#### Scenario: Invalid code surfaced without stopping

- GIVEN `parseQrCode` rejects a raw string
- WHEN the invalid raw string is decoded
- THEN `decodeError` is set to `invalid-code`
- AND the loop continues scanning

#### Scenario: Caller resolves not-found

- GIVEN `onDecode` returns a `not-found` outcome
- WHEN the hook receives it
- THEN the caller sets `decodeError` to `not-found`
- AND scanning continues

### Requirement: Preserve scanner-modal behavior on refactor

The refactored `scanner-modal.tsx` SHALL consume `useQrScanner` while preserving its existing behavior: redirect to `/recargas/nueva?botellon_id=`, the `no-client` overlay, the `ScanError` copy mapping, and the close-on-backdrop/close-button actions.

#### Scenario: Single-flow redirect preserved

- GIVEN a botellón with a `cliente_id` is decoded in the modal
- WHEN `onDecode` resolves successfully
- THEN the modal stops the stream, closes, and `router.push('/recargas/nueva?botellon_id=...')`

#### Scenario: No-client keeps scanning

- GIVEN a decoded botellón has no `cliente_id`
- WHEN `onDecode` resolves
- THEN the `no-client` overlay renders with no action button
- AND scanning continues

## Testability

The hook MUST be covered by component tests (`tests/component/use-qr-scanner.test.tsx`) using fake rAF/perf timers and a `jsQR` mock; the existing `scanner-modal.test.tsx` (17), `scanner-island.test.tsx` (3), and `mobile-nav.test.tsx` (7) suites MUST remain green post-refactor.
