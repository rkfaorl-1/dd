"""cuts.json → 스토리보드 마크다운 + CSV 생성.

사용법: python3 tools/storyboard.py episodes/ep01
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

KIND = {"V": "영상", "I": "이미지", "R": "재사용", "T": "타이틀/암전"}
HANGUL = re.compile(r"[가-힣]")


def seconds(dur):
    return float(dur.rstrip("s")) if dur.rstrip("s").replace(".", "").isdigit() else 0.0


def clock(t):
    return f"{int(t // 60):02d}:{t % 60:04.1f}"


def timeline(cuts):
    """컷별 편집 위치·화면 길이·생성할 클립 길이를 계산한다.

    나레이션 컷은 TTS 시각(tts)을 따르고, 나레이션 없는 고정 길이 컷(콜드오픈, 암전 등)은
    그만큼 이후 TTS를 뒤로 민다.
    """
    offset, rows = 0.0, {}
    for c in cuts:
        if "tts" in c:
            a, b = c["tts"]
            start, length = a + offset, b - a
        else:
            length = seconds(c["dur"])  # 0이면 앞 컷 위에 겹치는 컷
            start = (rows[prev]["end"] if length else rows[prev]["start"]) if rows else 0.0
            offset += length
        gen = None
        if c["kind"] == "V":
            gen = c.get("gen") or min(15, max(6, -(-(length or 6) // 1)))
        rows[c["id"]] = {"start": start, "len": length, "end": start + length, "gen": gen}
        prev = c["id"]
    return rows


def main(ep_dir):
    ep = Path(ep_dir)
    data = json.loads((ep / "cuts.json").read_text(encoding="utf-8"))
    cuts, suffix = data["cuts"], data["video_suffix"]

    counts = Counter(c["kind"] for c in cuts)
    rows = timeline(cuts)
    total = max(r["end"] for r in rows.values())
    new_videos = [c for c in cuts if c["kind"] == "V"]
    gen_total = sum(rows[c["id"]]["gen"] for c in new_videos)

    out = [f"# {data['episode']} — 컷별 스토리보드", ""]
    out.append(f"총 {len(cuts)}컷 · 완성 길이 약 {clock(total)} · " +
               " · ".join(f"{KIND[k]} {counts[k]}" for k in "VIRT"))
    out.append(f"\n새로 생성할 영상 클립 {len(new_videos)}개 (생성 길이 합계 {gen_total:.0f}초)\n")
    if "tts_total" in data:
        out.append(f"> **TTS 배치:** 편집 타임라인 00:14.0에 TTS({data['tts_total']}초)를 놓고, "
                   "C045 위치에서 TTS 사이에 2초 무음을 끼우세요. `편집 위치`는 그 기준입니다. "
                   "TTS 시각은 쉼 구간으로 자동 정렬한 값이라 ±0.5초 오차가 있을 수 있습니다.\n")
    out.append("> **읽는 법**")
    out.append("> - `이미지(GPT)`의 R·P 코드는 `01_연출노트.md` 6장의 기준 이미지입니다. 같은 장소의 GPT 대화창에서 기준 이미지를 첨부하고 생성하세요.")
    out.append("> - `= C0xx`는 해당 컷의 이미지나 영상을 다시 쓴다는 뜻입니다.")
    out.append(f"> - 모든 `영상(H3)` 프롬프트 끝에 다음 문장을 붙이세요: `{suffix}`")
    out.append(">   (범인이 등장하는 5·6부 컷은 *No new people appear.*를 빼세요.)")
    out.append("> - `화면`은 그 컷이 화면에 머무는 시간, `H3 생성`은 만들 클립 길이(최소 6초)입니다. 남는 부분은 잘라 쓰거나 천천히 재생하세요.\n")

    part = None
    for c in cuts:
        if c["part"] != part:
            part = c["part"]
            out.append(f"\n## {data['parts'][part]}\n")
        tech = ", ".join(f"`{t}`" for t in c["tech"]) or "-"
        r = rows[c["id"]]
        head = f"### {c['id']} · {KIND[c['kind']]} · 기준 {c['ref']}"
        out.append(head)
        info = f"- **편집 위치:** {clock(r['start'])} · 화면 {r['len']:.1f}초" if r["len"] else \
            f"- **편집 위치:** {clock(r['start'])} · 앞 컷에 겹침"
        if "tts" in c:
            info += f" · TTS {clock(c['tts'][0])}–{clock(c['tts'][1])}"
        if r["gen"]:
            info += f" · **H3 생성 {r['gen']:.0f}초**"
            if r["len"] > 15:
                info += " (15초 초과 — 이미지 확대로 늘리거나 2컷으로 나눌 것)"
        out.append(info)
        out.append(f"- **나레이션:** {c['narr']}")
        out.append(f"- **화면:** {c['shot']}")
        out.append(f"- **기법:** {tech}")
        if c["img"] != "-":
            out.append(f"- **이미지(GPT):** {c['img']}" if c["img"].startswith(("=", "Use")) and len(c["img"]) < 60
                       else f"- **이미지(GPT):**\n  ```\n  {c['img']}\n  ```")
        if c["vid"] != "-":
            out.append(f"- **영상(H3):** {c['vid']}" if not c["vid"][:1].isascii() or c["vid"].startswith("=")
                       else f"- **영상(H3):**\n  ```\n  {c['vid']}\n  ```")
        out.append(f"- **사운드:** {c['snd']}\n")

    (ep / "02_스토리보드.md").write_text("\n".join(out), encoding="utf-8")

    with open(ep / "cuts.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["컷", "파트", "형태", "편집 위치", "화면 길이(초)", "H3 생성(초)", "기준", "나레이션", "화면", "기법",
                    "이미지 프롬프트(GPT)", "영상 프롬프트(H3)", "사운드"])
        for c in cuts:
            r = rows[c["id"]]
            w.writerow([c["id"], data["parts"][c["part"]], KIND[c["kind"]], clock(r["start"]),
                        f"{r['len']:.1f}", f"{r['gen']:.0f}" if r["gen"] else "", c["ref"],
                        c["narr"], c["shot"], " ".join(c["tech"]), c["img"], c["vid"], c["snd"]])

    narr = sum(len(HANGUL.findall(c["narr"])) for c in cuts if not c["narr"].startswith("("))
    print(f"{len(cuts)} cuts, {dict(counts)}, total {clock(total)}, "
          f"new video clips {len(new_videos)} ({gen_total:.0f}s to generate), narration hangul {narr}")


if __name__ == "__main__":
    main(sys.argv[1])
