# AI data integrity

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The data contract is a timed Word list, not segment text alone. IDs identify words during an editing session; timing is in seconds; original and displayed text can diverge; confidence may be unknown; glossary merges can combine multiple source words. Settings and template IDs come from shared JSON but canvas elements lack equally strong validation.

Several transformations are lossy: romanization normalizes spelling, English verification can replace tokens, glossary matching merges spans, boundary refinement changes timing, and group editing redistributes duration. Per-word original helps inspection but does not provide a durable source transcript revision. CSV currently formats unknown confidence as1.00, which conflates unknown with certainty.

Reliability defects span boundaries: cancelled old jobs can publish into a new generation (BOL-02); stale browser clients overwrite without revision (BOL-05); PATCH silently drops declared options (BOL-23); overlong joins violate layout assumptions (BOL-12); UI settings can fail backend validation (BOL-13). Prioritize these over adding more transformations.

Preserve raw recognition output, engine/revision/task, preprocessing and transformation provenance in a versioned result. Validate after each structural transformation and before result persistence. Record estimated boundaries distinctly. Never report semantic translation fidelity or timestamp precision from schema validity alone.
