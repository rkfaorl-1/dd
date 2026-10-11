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
    return int(dur.rstrip("s"))


def main(ep_dir):
    ep = Path(ep_dir)
    data = json.loads((ep / "cuts.json").read_text(encoding="utf-8"))
    cuts, suffix = data["cuts"], data["video_suffix"]

    counts = Counter(c["kind"] for c in cuts)
    total = sum(seconds(c["dur"]) for c in cuts)
    new_videos = [c for c in cuts if c["kind"] == "V"]

    out = [f"# {data['episode']} — 컷별 스토리보드", ""]
    out.append(f"총 {len(cuts)}컷 · 화면 합계 약 {total // 60}분 {total % 60}초 "
               f"(실제 길이는 TTS에 맞춰 조정) · " +
               " · ".join(f"{KIND[k]} {counts[k]}" for k in "VIRT"))
    out.append(f"\n새로 생성할 영상 클립 {len(new_videos)}개 "
               f"(합계 {sum(seconds(c['dur']) for c in new_videos)}초)\n")
    out.append("> **읽는 법**")
    out.append("> - `이미지(GPT)`의 R1~R7은 `01_연출노트.md` 5장의 기준 이미지입니다. 같은 장소의 GPT 대화창에서 기준 이미지를 첨부하고 생성하세요.")
    out.append("> - `= C0xx`는 해당 컷의 이미지나 영상을 다시 쓴다는 뜻입니다.")
    out.append(f"> - 모든 `영상(H3)` 프롬프트 끝에 다음 문장을 붙이세요: `{suffix}`")
    out.append(">   (범인이 등장하는 5·6부 컷은 *No new people appear.*를 빼세요.)")
    out.append("> - 나레이션 칸은 그 컷 동안 흐를 TTS 문장입니다. 컷 길이는 TTS 실제 길이에 맞춰 늘리거나 줄이세요.\n")

    part = None
    for c in cuts:
        if c["part"] != part:
            part = c["part"]
            out.append(f"\n## {data['parts'][part]}\n")
        tech = ", ".join(f"`{t}`" for t in c["tech"]) or "-"
        out.append(f"### {c['id']} · {KIND[c['kind']]} {c['dur']} · 기준 {c['ref']}")
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
        w.writerow(["컷", "파트", "형태", "길이", "기준", "나레이션", "화면", "기법",
                    "이미지 프롬프트(GPT)", "영상 프롬프트(H3)", "사운드"])
        for c in cuts:
            w.writerow([c["id"], data["parts"][c["part"]], KIND[c["kind"]], c["dur"], c["ref"],
                        c["narr"], c["shot"], " ".join(c["tech"]), c["img"], c["vid"], c["snd"]])

    narr = sum(len(HANGUL.findall(c["narr"])) for c in cuts if not c["narr"].startswith("("))
    print(f"{len(cuts)} cuts, {dict(counts)}, screen {total}s, "
          f"new video clips {len(new_videos)}, narration hangul {narr}")


if __name__ == "__main__":
    main(sys.argv[1])
