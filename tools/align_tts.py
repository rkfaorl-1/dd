"""TTS 음성 파일의 쉼 구간에 맞춰 cuts.json 각 컷의 나레이션 시작·끝 시각(tts)을 채운다.

사용법: python3 tools/align_tts.py episodes/ep01 path/to/tts.mp3

음성 인식 없이 동작한다: ffmpeg로 쉼(무음) 구간을 찾고, 컷별 나레이션 글자 수로
예상 경계 시각을 계산한 뒤, 가장 가까운 쉼에 순서를 지키며 맞춘다(동적 계획법).
한 호흡 안에서 끊기는 컷 등 자동 결과가 틀린 곳은 cuts.json의 "tts_overrides"에
{"C079": [333.9, 336.8]}처럼 적어 두면 그 값을 우선한다.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HANGUL = re.compile(r"[가-힣0-9]")


def detect_silences(audio, noise="-40dB", min_len=0.25):
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", audio, "-af",
         f"silencedetect=noise={noise}:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio],
        capture_output=True, text=True).stdout)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends)), dur


def chars(narr):
    return 0 if narr.startswith("(") else len(HANGUL.findall(narr))


def align(cuts, silences, total):
    speech_start = next((b for a, b in silences if a < 0.05), 0.0)
    speech_end = next((a for a, b in silences if b > total - 0.05), total)
    pauses = [(a, b) for a, b in silences if a > 0.05 and b < total - 0.05]

    def speech_to_real(x):
        t, acc = speech_start, 0.0
        for a, b in pauses:
            if acc + (a - t) >= x:
                break
            acc += a - t
            t = b
        return t + (x - acc)

    speech_len = (speech_end - speech_start) - sum(b - a for a, b in pauses)
    narrated = [c for c in cuts if chars(c["narr"])]
    total_chars = sum(chars(c["narr"]) for c in narrated)
    est, acc = [], 0
    for c in narrated[:-1]:
        acc += chars(c["narr"])
        est.append(speech_to_real(acc / total_chars * speech_len))

    mids = [((a + b) / 2, b - a) for a, b in pauses]
    n, m, inf = len(est), len(mids), float("inf")

    def cost(i, j):  # 예상 시각과 가까울수록, 쉼이 길수록(문장 끝일수록) 유리
        return abs(mids[j][0] - est[i]) - 0.6 * min(mids[j][1], 1.2)

    dp = [[inf] * m for _ in range(n)]
    back = [[-1] * m for _ in range(n)]
    for j in range(m):
        dp[0][j] = cost(0, j)
    for i in range(1, n):
        best, best_j = inf, -1
        for j in range(m):
            if j > 0 and dp[i - 1][j - 1] < best:
                best, best_j = dp[i - 1][j - 1], j - 1
            if best < inf:
                dp[i][j], back[i][j] = best + cost(i, j), best_j
    j = min(range(m), key=lambda k: dp[n - 1][k])
    chosen = [0] * n
    for i in range(n - 1, -1, -1):
        chosen[i] = j
        j = back[i][j]

    bounds = [speech_start] + [mids[j][0] for j in chosen] + [speech_end]
    return {c["id"]: [round(bounds[k], 1), round(bounds[k + 1], 1)]
            for k, c in enumerate(narrated)}


def main(ep_dir, audio):
    path = Path(ep_dir) / "cuts.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    silences, total = detect_silences(audio)
    timing = align(data["cuts"], silences, total)
    timing.update(data.get("tts_overrides", {}))
    for c in data["cuts"]:
        if c["id"] in timing:
            c["tts"] = timing[c["id"]]
    data["tts_total"] = round(total, 1)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"aligned {len(timing)} cuts to {total:.1f}s of audio")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
