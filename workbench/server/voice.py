from pathlib import Path
from typing import Any
import os,sys,json,base64,wave,uuid,urllib.request,shutil,stat,subprocess,hashlib,re
class DoubaoTTS:
    name = "doubao-tts-2.0"
    endpoint = "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse"
    default_speaker = "zh_male_liufei_uranus_bigtts"

    def __init__(self, api_key: str, speaker: str, resource_id: str = "seed-tts-2.0", speech_rate: int = 0) -> None:
        if not api_key or not speaker:
            raise ValueError("Doubao TTS requires an API key and speaker ID")
        if not -50 <= speech_rate <= 100:
            raise ValueError("Doubao TTS speech_rate must be between -50 and 100")
        self.api_key = api_key
        self.speaker = speaker
        self.resource_id = resource_id
        self.speech_rate = speech_rate

    @staticmethod
    def parse_sse(lines: Any) -> tuple[bytes, list[dict[str, Any]]]:
        audio = bytearray()
        words: list[dict[str, Any]] = []
        finished = False
        for raw in lines:
            line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[5:].strip())
            code = payload.get("code")
            if code not in (0, 20000000):
                raise RuntimeError(f"Doubao TTS error {code}: {payload.get('message', 'unknown error')}")
            if payload.get("data"):
                audio.extend(base64.b64decode(payload["data"], validate=True))
            sentence = payload.get("sentence") or {}
            for item in sentence.get("words") or []:
                words.append({"text": item["word"], "start": float(item["startTime"]), "end": float(item["endTime"]), "confidence": item.get("confidence")})
            if code == 20000000:
                finished = True
        if not finished or not audio or not words:
            raise RuntimeError("Doubao TTS did not return complete audio and word timestamps")
        return bytes(audio), words

    def synthesize(self, text: str, output: Path, **options: Any) -> dict[str, Any]:
        scenes = options.get("scenes")
        if not scenes:
            raise ValueError("Doubao TTS requires storyboard scenes for exact scene offsets")
        output.parent.mkdir(parents=True, exist_ok=True)
        combined = bytearray()
        word_groups = []
        sample_rate = 24000
        for scene in scenes:
            payload = {"user": {"uid": "skill-video-agent"}, "req_params": {"text": scene["narration"], "speaker": self.speaker, "audio_params": {"format": "pcm", "sample_rate": sample_rate, "enable_subtitle": True, "speech_rate": self.speech_rate}}}
            request = urllib.request.Request(self.endpoint, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json", "Accept": "text/event-stream", "X-Api-Key": self.api_key, "X-Api-Resource-Id": self.resource_id, "X-Api-Request-Id": str(uuid.uuid4())}, method="POST")
            with urllib.request.urlopen(request, timeout=120) as response:
                pcm, words = self.parse_sse(response)
            if len(pcm) % 2:
                raise RuntimeError("Doubao PCM stream has an odd byte count")
            offset = len(combined) / (sample_rate * 2)
            scene_duration = len(pcm) / (sample_rate * 2)
            if any(word["start"] < 0 or word["end"] > scene_duration + 0.15 for word in words):
                raise RuntimeError("Doubao word timestamps exceed their scene audio")
            word_groups.append({"words": [{**word, "start": round(word["start"] + offset, 3), "end": round(word["end"] + offset, 3)} for word in words]})
            combined.extend(pcm)
        with wave.open(str(output), "wb") as stream:
            stream.setnchannels(1)
            stream.setsampwidth(2)
            stream.setframerate(sample_rate)
            stream.writeframes(combined)
        return {"provider": self.name, "fallback": False, "duration": len(combined) / (sample_rate * 2), "voice": self.speaker, "resourceId": self.resource_id, "speechRate": self.speech_rate, "wordGroups": word_groups}


def doubao_api_key() -> str:
    """Resolve a Doubao secret without printing it or reading project files."""
    environment_key = os.environ.get("DOUBAO_TTS_API_KEY", "").strip()
    if environment_key:
        return environment_key
    private_file = Path.home() / ".config" / "skill-video-agent" / "doubao.key"
    if private_file.exists() or private_file.is_symlink():
        if private_file.is_symlink() or private_file.parent.is_symlink():
            raise RuntimeError("Refusing a symlinked Doubao secret path")
        file_stat = private_file.stat()
        parent_stat = private_file.parent.stat()
        if file_stat.st_uid != os.getuid() or stat.S_IMODE(file_stat.st_mode) != 0o600 or parent_stat.st_uid != os.getuid() or stat.S_IMODE(parent_stat.st_mode) != 0o700:
            raise RuntimeError("Doubao secret file must be owned by this user, mode 0600, inside a mode 0700 directory")
        private_key = private_file.read_text(encoding="utf-8").strip()
        if not private_key:
            raise RuntimeError("Doubao secret file is empty")
        return private_key
    security = shutil.which("security")
    if not security:
        return ""
    try:
        result = subprocess.run([security, "find-generic-password", "-a", os.environ.get("USER", ""), "-s", "skill-video-agent-doubao", "-w"], check=False, capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""



if __name__ == '__main__':
 try:
  output=Path(sys.argv[1]);v=json.loads(sys.argv[2]);key=doubao_api_key()
  if not key: raise RuntimeError('未配置豆包凭证，请配置 DOUBAO_TTS_API_KEY 或现有本机凭证后重试。')
  result=DoubaoTTS(key,v['speaker'],speech_rate=int(v.get('rate',0))).synthesize(v['text'],output,scenes=[{'narration':v['text']}])
  words=result['wordGroups'][0]['words'];last=0
  for word in words:
   if word['start']<last or word['end']<=word['start'] or word['end']>result['duration']+.03: raise RuntimeError('词时间未通过单调性和音频范围校验')
   last=word['end']
  normalize=lambda s: ''.join(c for c in s if c.isalnum()).lower()
  if normalize(''.join(w['text'] for w in words))!=normalize(v['text']): raise RuntimeError('返回的词文本与口播不一致，不能标为精确对齐')
  print(json.dumps({'duration':result['duration'],'words':words,'text':v['text'],'verified':True,'provider':result['provider'],'audioSha256':hashlib.sha256(output.read_bytes()).hexdigest()},ensure_ascii=False))
 except Exception as e:
  print(str(e),file=sys.stderr);sys.exit(1)
