#!/usr/bin/env bash
# Cuts the launch film (assets/video/launch.mp4) from the rendered shots.
#   tools/make-launch-video.sh <folder with the source clips>
# The source clips, flash stills and score are not in the repo (CREDITS.md says where they came from).
# The folder needs: s1-stage s2-feet s4-lipstick s5-door s6-screen s8-low s9-hero s10-final (.mp4),
# f-tip f-ears f-cheek f-hearts (.png) and score.mp3.
# The cut: 20 s, 720 by 1280, 30 frames a second. The last 1.15 s is a held pink-white flash:
# intro.js fades the film out over it and flies the drawn logo to Home.
set -euo pipefail
SRC="${1:?give the folder with the source clips}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/video"
mkdir -p "$OUT"
FIT="fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,format=yuv420p"

# name, start in the source, length in the source, length in the film
SHOTS=(
  "s1-stage 0.25 2.75 1.2"
  "s2-feet 0.15 1.8 1.8"
  "BURST1 0 0 0.667"
  "s4-lipstick 0.8 2.333 2.333"
  "s5-door 1.0 2.5 2.5"
  "s6-screen 1.0 2.0 2.0"
  "BURST2 0 0 0.667"
  "s8-low 0.0 2.833 2.833"
  "s9-hero 2.0 3.0 3.0"
  "s10-final 1.6 3.0 3.0"
)
inputs=(); filter=""; n=0; labels=""
still() {   # a flash-cut still: held for $2 frames, sliding a little
  inputs+=(-loop 1 -framerate 30 -t 1 -i "$SRC/$1.png")
  filter+="[$n:v]scale=792:1408,crop=720:1280:'36-36*n/$2':'64-64*n/$2',fps=30,setsar=1,format=yuv420p,trim=end_frame=$2,setpts=PTS-STARTPTS[v$n];"
  labels+="[v$n]"; n=$((n+1))
}
for row in "${SHOTS[@]}"; do
  read -r name ss len out <<<"$row"
  case "$name" in
    BURST1) for s in f-tip f-ears f-cheek f-hearts; do still "$s" 5; done ;;
    BURST2) for s in f-hearts f-cheek f-ears f-tip f-hearts; do still "$s" 4; done ;;
    *)
      inputs+=(-ss "$ss" -t "$len" -i "$SRC/$name.mp4")
      speed=$(awk "BEGIN{print $out/$len}")
      frames=$(awk "BEGIN{printf \"%d\", $out*30+0.5}")
      filter+="[$n:v]setpts=(PTS-STARTPTS)*$speed,$FIT,trim=end_frame=$frames,setpts=PTS-STARTPTS[v$n];"
      labels+="[v$n]"; n=$((n+1)) ;;
  esac
done
# join, open from the dark, and end on a pink-white flash that holds (the app's --spot colour)
filter+="${labels}concat=n=$n:v=1:a=0,trim=duration=20,fade=t=in:st=0:d=0.25:color=0x1C0F13,fade=t=out:st=18.45:d=0.4:color=0xFFE3E8[v];"
inputs+=(-i "$SRC/score.mp3")
filter+="[$n:a]atrim=0:20,afade=t=out:st=19.3:d=0.7,loudnorm=I=-16:TP=-1.5[a]"

ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[v]" -map "[a]" \
  -c:v libx264 -profile:v high -level 3.1 -pix_fmt yuv420p -preset slow -b:v "${VBITRATE:-1500k}" -maxrate 2600k -bufsize 5200k \
  -g 60 -c:a aac -b:a 112k -ar 44100 -movflags +faststart -t 20 "$OUT/launch.mp4"
ls -l "$OUT"
