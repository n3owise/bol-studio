import importlib.util
import json
import sys
from pathlib import Path
import pytest
from server import model_provenance as provenance

ROOT = Path(__file__).resolve().parents[1]

def test_default_revisions_are_immutable_and_custom_requires_pin(tmp_path):
    assert all(len(sha) == 40 for sha in provenance.PINS.values())
    assert provenance.model_revision('large-v3') == provenance.PINS['Systran/faster-whisper-large-v3']
    with pytest.raises(ValueError, match='No pinned revision'):
        provenance.model_revision('unknown/custom')
    with pytest.raises(ValueError, match='immutable'):
        provenance.model_revision('custom/model', 'main')
    assert provenance.model_revision(str(tmp_path)) is None

def test_existing_local_files_are_hashed_without_invented_upstream_revision(tmp_path):
    model = tmp_path / 'encoder.int8.onnx'
    model.write_bytes(b'local asset')
    first = provenance.model_provenance(str(tmp_path))
    assert first['revision'] is None and first['sourceVerified'] is False
    assert first['files'][model.name]['sha256'] == provenance.file_hash(model)
    model.write_bytes(b'changed asset with different size')
    second = provenance.model_provenance(str(tmp_path))
    assert second['files'] != first['files']

def test_prepared_manifest_is_verified_only_when_file_hashes_match(tmp_path):
    (tmp_path / 'tokens.txt').write_text('tokens')
    manifest = provenance.local_manifest(tmp_path)
    manifest.update(repo='fixture/model', revision='a'*40, sourceVerified=True)
    (tmp_path / 'provenance.json').write_text(json.dumps(manifest))
    assert provenance.model_provenance(str(tmp_path))['sourceVerified'] is True
    (tmp_path / 'tokens.txt').write_text('altered')
    assert provenance.model_provenance(str(tmp_path))['sourceVerified'] is False

def test_benchmark_incomplete_models_cannot_win_by_dropping_failures():
    spec = importlib.util.spec_from_file_location('bol_model_comparison_test', ROOT / 'scripts/compare-models.py')
    bench = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = bench
    spec.loader.exec_module(bench)
    a,b = bench.MODELS[:2]
    results = [bench.Result(a,'one',wer=0,lenient_wer=0),bench.Result(a,'two',error='decode failed'),
               bench.Result(b,'one',wer=.2,lenient_wer=.1),bench.Result(b,'two',wer=.2,lenient_wer=.1)]
    report = bench.render(results,[('one','reference'),('two','reference')],[a,b])
    assert 'incomplete / failed · 1/2 scored' in report
    assert '<tr class="win"><td><b>B</b>' in report
    assert '<tr class="win"><td><b>A</b>' not in report

def test_revision_override_does_not_leak_into_companion(monkeypatch):
    monkeypatch.setenv('BOL_MODEL', 'custom/main')
    monkeypatch.setenv('BOL_MODEL_REVISION', 'b'*40)
    monkeypatch.delenv('BOL_MODEL_REVISIONS', raising=False)
    assert provenance.configured_revision('custom/main') == 'b'*40
    assert provenance.configured_revision('mlx-community/whisper-large-v3-turbo') == provenance.PINS['mlx-community/whisper-large-v3-turbo']

@pytest.mark.parametrize('engine', ['mlx', 'faster-whisper'])
def test_companion_records_the_checkpoint_actually_used_without_download(tmp_path, monkeypatch, engine):
    from types import SimpleNamespace
    from server import transcription as speech
    monkeypatch.setenv('BOL_ENGLISH_VERIFY_MODEL', 'fixture/companion')
    monkeypatch.setattr(speech, 'model_provenance', lambda model: {'repo': model, 'revision': 'c'*40})
    monkeypatch.setattr(speech, 'mlx_model_path', lambda model: model)
    if engine == 'mlx':
        monkeypatch.setitem(sys.modules, 'mlx_whisper', SimpleNamespace(transcribe=lambda *args, **kwargs: {'segments': []}))
    else:
        monkeypatch.setitem(sys.modules, 'mlx_whisper', None)
        monkeypatch.setattr(speech.importlib.util, 'find_spec', lambda name: object() if name == 'faster_whisper' else None)
        monkeypatch.setattr(speech, 'read_audio', lambda path: (__import__('numpy').zeros(16000, dtype='float32'), 16000))
        monkeypatch.setattr(speech, '_faster_model', lambda model: SimpleNamespace(transcribe=lambda *args, **kwargs: (iter([]), None)))
    segments = speech._english_companion_decode(tmp_path / 'audio.wav', 'sherpa-hinglish', 'fixture/main', lambda *args: None)
    assert segments == []
    assert segments.provenance == {'backend': engine, 'model': 'fixture/companion', 'repo': 'fixture/companion', 'revision': 'c'*40}

def test_transcription_result_preserves_separate_companion_provenance(tmp_path, monkeypatch):
    import numpy as np
    from scipy.io import wavfile
    from server import transcription as speech
    path = tmp_path / 'audio.wav'; wavfile.write(path, 16000, np.full(16000, .1, np.float32))
    monkeypatch.setattr(speech, 'model_config', lambda: ('sherpa-hinglish', 'fixture/main'))
    monkeypatch.setattr(speech, 'model_provenance', lambda model: {'repo': model, 'revision': 'd'*40})
    monkeypatch.setattr(speech, '_sherpa_decode', lambda *args, **kwargs: ([{'words': [{'word': 'namaste', 'start': .1, 'end': .8, 'probability': .9}]}], 'hi'))
    monkeypatch.setattr(speech, '_english_companion_decode', lambda *args: speech.CompanionSegments([], 'mlx', 'fixture/companion'))
    result = speech.transcribe(path, 1, 'roman', 'hi', lambda *args: None)
    assert result['modelProvenance']['repo'] == 'fixture/main'
    assert result['companionModelProvenance']['repo'] == 'fixture/companion'
    assert result['companionModelProvenance']['backend'] == 'mlx'

def test_unpinned_custom_model_rejected_at_admission_without_download(monkeypatch):
    from server import transcription as speech
    monkeypatch.setattr(speech, 'model_config', lambda: ('faster-whisper', 'fixture/unpinned'))
    monkeypatch.setattr(speech.importlib.util, 'find_spec', lambda name: object())
    monkeypatch.delenv('BOL_MODEL', raising=False)
    monkeypatch.delenv('WHISPER_MODEL', raising=False)
    monkeypatch.delenv('BOL_MODEL_REVISIONS', raising=False)
    with pytest.raises(ValueError, match='No pinned revision'):
        speech.validate_transcription_request('native')


def test_portable_decoder_signal_resamples_without_changing_duration():
    import numpy as np
    from server.transcription import faster_audio_signal
    signal = np.ones(8000, dtype=np.float64)
    decoded = faster_audio_signal(signal, 8000)
    assert len(decoded) == 16000
    assert decoded.dtype == np.float32 and decoded.flags.c_contiguous
    np.testing.assert_allclose(decoded[100:-100], 1, atol=.002)
