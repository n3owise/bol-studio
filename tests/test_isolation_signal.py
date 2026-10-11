from pathlib import Path
import sys
from types import SimpleNamespace

import numpy as np
import pytest
from scipy.io import wavfile
from server import transcription as speech

@pytest.fixture(autouse=True)
def stub_model_downloads_and_provenance(monkeypatch):
    # Decoder tests use synthetic checkpoints; provenance is covered separately.
    monkeypatch.setattr(speech, "mlx_model_path", lambda model: model)
    monkeypatch.setattr(speech, "model_provenance", lambda model: {"testCheckpoint": True})



@pytest.mark.parametrize('engine', ['mlx', 'faster-whisper', 'sherpa-hinglish'])
@pytest.mark.parametrize('outcome', ['success', 'decode_error', 'companion_error', 'cancelled'])
def test_all_decoders_and_companions_use_cleaned_signal_and_remove_files(tmp_path, monkeypatch, engine, outcome):
    original = tmp_path / 'audio.wav'
    source = tmp_path / 'source.bin'
    original_samples = np.full(16000, .1, dtype=np.float32)
    cleaned = np.full(16000, .25, dtype=np.float32)
    wavfile.write(original, 16000, original_samples)
    source.write_bytes(b'untouched source')
    original_bytes = original.read_bytes()
    monkeypatch.setattr(speech, 'model_config', lambda: (engine, 'test-model'))
    monkeypatch.setattr(speech, 'denoise_available', lambda: True)
    monkeypatch.setattr(speech, 'isolate_vocals_from_source', lambda *args: cleaned)
    def refine(words, audio, *args):
        np.testing.assert_array_equal(audio, cleaned)
        return words
    def emphasize(words, audio, *args):
        np.testing.assert_array_equal(audio, cleaned)
    monkeypatch.setattr(speech, 'refine_word_boundaries_with_vad', refine)
    monkeypatch.setattr(speech, 'suggest_emphasis', emphasize)
    captured = []
    directories = []
    real_temporary = speech.tempfile.TemporaryDirectory
    def temporary(*args, **kwargs):
        result = real_temporary(*args, **kwargs)
        directories.append(Path(result.name))
        return result
    monkeypatch.setattr(speech.tempfile, 'TemporaryDirectory', temporary)
    cancel = [False]
    segments = [{'words': [{'word': 'नमस्ते', 'start': .1, 'end': .7, 'probability': .9}]}]

    def inspect(path):
        path = Path(path)
        assert path != original and path.is_file()
        rate, data = wavfile.read(path)
        assert rate == 16000
        np.testing.assert_array_equal(data, cleaned)
        captured.append(path)
        if outcome == 'decode_error':
            raise RuntimeError('synthetic decoder error')
        if outcome == 'cancelled':
            cancel[0] = True

    if engine == 'mlx':
        def decode(path, **kwargs):
            inspect(path)
            return {'segments': segments, 'language': 'hi'}
        monkeypatch.setitem(sys.modules, 'mlx_whisper', SimpleNamespace(transcribe=decode))
    elif engine == 'faster-whisper':
        def decode(path, **kwargs):
            # Inspection happens on iteration, like faster-whisper's lazy stream.
            def stream():
                np.testing.assert_array_equal(path, cleaned)
                assert path.dtype == np.float32
                if outcome == 'decode_error': raise RuntimeError('synthetic decoder error')
                if outcome == 'cancelled': cancel[0] = True
                yield SimpleNamespace(words=[SimpleNamespace(word='नमस्ते',start=.1,end=.7,probability=.9)],end=.7)
            return stream(), SimpleNamespace(language='hi')
        monkeypatch.setattr(speech, '_faster_model', lambda _: SimpleNamespace(transcribe=decode))
    else:
        def decode(audio, *args, **kwargs):
            np.testing.assert_array_equal(audio, cleaned)
            if outcome == 'decode_error': raise RuntimeError('synthetic decoder error')
            if outcome == 'cancelled': cancel[0] = True
            return segments, 'hi'
        monkeypatch.setattr(speech, '_sherpa_decode', decode)

    def companion(path, *args):
        inspect(path)
        if outcome == 'companion_error': raise RuntimeError('synthetic companion error')
        return []
    monkeypatch.setattr(speech, '_english_companion_decode', companion)
    def run():
        return speech.transcribe(original,1,'roman','hi',lambda *args: None,
                                 isolateVocals=True,source_path=source,is_cancelled=lambda:cancel[0])
    if outcome == 'success':
        result = run()
        assert result['audioSignal'] == 'isolated-vocals'
        assert result['isolationFallback'] is False
        assert captured, 'the companion must receive the isolated WAV even for Sherpa'
    else:
        with pytest.raises(speech.TranscriptionCancelled if outcome == 'cancelled' else RuntimeError): run()
    assert all(not p.exists() and not p.parent.exists() for p in captured)
    assert directories and all(not p.exists() for p in directories)
    assert original.read_bytes() == original_bytes
    assert source.read_bytes() == b'untouched source'


@pytest.mark.parametrize('available,separated', [(False,None),(True,None)])
def test_failed_or_unavailable_isolation_reports_original_signal(tmp_path,monkeypatch,available,separated):
    path=tmp_path/'audio.wav'
    wavfile.write(path,16000,np.full(16000,.1,dtype=np.float32))
    monkeypatch.setattr(speech,'model_config',lambda:('mlx','test-model'))
    monkeypatch.setattr(speech,'denoise_available',lambda:available)
    monkeypatch.setattr(speech,'isolate_vocals_from_source',lambda *args:separated)
    captured=[]
    def decode(p,**kwargs):
        assert Path(p)==path
        return {'segments':[], 'language':'en'}
    monkeypatch.setitem(sys.modules,'mlx_whisper',SimpleNamespace(transcribe=decode))
    result=speech.transcribe(path,1,'native','en',lambda _,message:captured.append(message),isolateVocals=True,source_path=path)
    assert result['audioSignal']=='original' and result['isolationFallback']
    assert any('Using the original audio' in m for m in captured)


@pytest.mark.parametrize('bad_signal', ['raises','nan','wrong_length'])
def test_separation_failure_never_prevents_original_transcription(tmp_path,monkeypatch,bad_signal):
    path=tmp_path/'audio.wav'
    wavfile.write(path,16000,np.full(16000,.1,dtype=np.float32))
    monkeypatch.setattr(speech,'model_config',lambda:('mlx','test-model'))
    monkeypatch.setattr(speech,'denoise_available',lambda:True)
    def separate(*args):
        if bad_signal=='raises': raise RuntimeError('separator failed')
        return np.full(16000 if bad_signal=='nan' else 10,np.nan if bad_signal=='nan' else .2,dtype=np.float32)
    monkeypatch.setattr(speech,'isolate_vocals_from_source',separate)
    def decode(p,**kwargs):
        assert Path(p)==path
        return {'segments':[],'language':'en'}
    monkeypatch.setitem(sys.modules,'mlx_whisper',SimpleNamespace(transcribe=decode))
    result=speech.transcribe(path,1,'native','en',lambda *args:None,isolateVocals=True,source_path=path)
    assert result['audioSignal']=='original' and result['isolationFallback']


def test_separator_closes_temporary_descriptor_and_removes_failed_decode(tmp_path,monkeypatch):
    import os
    from server import denoise
    source=tmp_path/'source.bin';source.write_bytes(b'synthetic')
    monkeypatch.setattr(denoise,'available',lambda:True)
    monkeypatch.setitem(sys.modules,'torch',SimpleNamespace())
    monkeypatch.setitem(sys.modules,'torchaudio',SimpleNamespace())
    captured=[]
    real_mkstemp=denoise.tempfile.mkstemp
    def make(*args,**kwargs):
        descriptor,filename=real_mkstemp(*args,dir=tmp_path,**kwargs)
        captured.append((descriptor,Path(filename)))
        return descriptor,filename
    monkeypatch.setattr(denoise.tempfile,'mkstemp',make)
    def fail(*args,**kwargs): raise RuntimeError('synthetic decode failure')
    monkeypatch.setattr(denoise.subprocess,'run',fail)
    assert denoise.isolate_vocals_from_source(source,16000,16000) is None
    assert captured and not captured[0][1].exists()
    with pytest.raises(OSError):os.fstat(captured[0][0])
