#!/usr/bin/env bash
# Cuts the launch film (assets/video/launch.mp4) from the rendered shots.
#   tools/make-launch-video.sh <folder with the source clips>
# The source clips and score are not in the repo (CREDITS.md says where they came from).
# The folder needs: s1-lab s2-arrive s3-eyeliner s4-mascara s5-lipstick s6-light s7-show s8-welcome (.mp4)
# and score.mp3.
# The cut: 24 s, 720 by 1280, 30 frames a second. The story: the dark lab, the hero arrives, eyeliner, mascara and
# lipstick open the cages, everyone walks into the light, the white and gold show, the Welcome stage.
# The last 1.15 s is a held white: intro.js fades the film out over it, shows the drawn logo where the hero
# floated and flies it to Home. If the timings here change, change FILM in intro.js to match
# (light: when the white Welcome stage starts, card: when the Welcome text comes in).
set -euo pipefail
SRC="${1:?give the folder with the source clips}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/video"
mkdir -p "$OUT"
LEN=24
FIT="fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,format=yuv420p"

# name, start in the source, length in the source, length in the film
SHOTS=(
  "s1-lab 0.0 3.0 3.0"
  "s2-arrive 0.0 3.0 3.0"
  "s3-eyeliner 0.4 2.5 2.5"
  "s4-mascara 0.4 2.5 2.5"
  "s5-lipstick 0.4 3.5 3.5"
  "s6-light 0.4 3.5 3.5"
  "s7-show 0.4 3.5 3.5"
  "s8-welcome 0.3 2.5 2.5"
)
inputs=(); filter=""; n=0; labels=""
for row in "${SHOTS[@]}"; do
  read -r name ss len out <<<"$row"
  inputs+=(-ss "$ss" -t "$len" -i "$SRC/$name.mp4")
  speed=$(awk "BEGIN{print $out/$len}")
  frames=$(awk "BEGIN{printf \"%d\", $out*30+0.5}")
  # tpad holds the last frame if a clip runs a few frames short
  filter+="[$n:v]setpts=(PTS-STARTPTS)*$speed,$FIT,tpad=stop_mode=clone:stop_duration=1,trim=end_frame=$frames,setpts=PTS-STARTPTS[v$n];"
  labels+="[v$n]"; n=$((n+1))
done
# join, open from the dark, and end on white that holds (the app's --day colour)
filter+="${labels}concat=n=$n:v=1:a=0,trim=duration=$LEN,fade=t=in:st=0:d=0.35:color=0x1C0F13,fade=t=out:st=$(awk "BEGIN{print $LEN-1.15}"):d=0.4:color=0xFFFFFF[v];"
inputs+=(-i "$SRC/score.mp3")
filter+="[$n:a]atrim=0:$LEN,afade=t=out:st=$(awk "BEGIN{print $LEN-0.6}"):d=0.6,loudnorm=I=-16:TP=-1.5[a]"

ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[v]" -map "[a]" \
  -c:v libx264 -profile:v high -level 3.1 -pix_fmt yuv420p -preset slow -b:v "${VBITRATE:-1500k}" -maxrate 2600k -bufsize 5200k \
  -g 60 -c:a aac -b:a 112k -ar 44100 -movflags +faststart -t $LEN "$OUT/launch.mp4"
ls -l "$OUT"
