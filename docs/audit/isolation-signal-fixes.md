# Vocal isolation signal routing — BOL-14

Fixed locally on 2026-10-10. Historical audit evidence remains unchanged.

Successful vocal isolation now writes a scoped float32 WAV at the recognition sample rate. MLX, faster-whisper and English companion passes decode that WAV. Sherpa continues decoding the same cleaned samples directly. The file remains available throughout lazy faster-whisper iteration and companion decoding, then its temporary directory is removed on success, error or cancellation. Acoustic boundary refinement and emphasis analysis also use the cleaned samples. Original media and recognition input are not overwritten; the displayed waveform still represents the original audio.

Unavailable, failed, nonfinite or incorrectly sized isolation results fall back to the original audio. Progress, saved audioSignal/isolationFallback fields and the final project message report that fallback. Cancellation is propagated. A pre-existing temporary-file descriptor leak in the separator was also fixed by closing the descriptor before FFmpeg writes the temporary WAV.

Verification uses actual temporary WAV files and stub speech decoders, without downloading model weights. Eighteen new tests cover all three engines, cleaned-sample equality, lazy iteration, companion passes, analysis signal routing, decoder/companion errors, cancellation, temporary-directory removal, original-file preservation, unavailable/failed/invalid isolation, and separator descriptor cleanup. The full safe Python suite passed; see evidence/isolation-signal-python.txt. The existing external boot/deployment test remains deselected and existing dependency warnings remain.

Limits: no actual Demucs separation, speech-model quality comparison, hosted job or new video export was performed. This verifies signal selection and lifecycle, not improved recognition accuracy. Cancellation during Demucs still waits for that operation to return. No frontend files changed; the prior frontend verification remains applicable. The localhost development servers are left running for user testing.
