# DESIGN.md: Sarkari Sahayak (voice form filler extension)

## Product
Chrome/Chromium MV3 extension. User speaks in a regional Indian language,
the extension fills the open web form. One screen, one action.

## UI: side panel only (360px wide, dark)
- Header: "Sarkari Sahayak" + language dropdown (default: bengali)
- Big round mic button (hold or tap to toggle), pulsing while recording
- Transcript box (shows what Saaras heard)
- Field list: each detected form field with its filled value,
  green check when filled, amber if the model was unsure
- Status line: Listening / Transcribing / Understanding / Filled
- Optional: "Upload document" button (Vision) and "Read back" button (TTS)

## Tokens (swap if your theme differs)
bg #1e1e2e | surface #313244 | text #cdd6f4 | accent #cba6f7
success #a6e3a1 | warn #f9e2af | error #f38ba8
radius 12px | font system-ui | spacing 8/12/16

## Behavior rules
- Never submit the form. Fill and highlight only.
- Highlight filled fields on the page with a 2px accent outline.
- Every state change updates the status line within 100ms.
- On any API error, show the error text in the panel, never fail silently.