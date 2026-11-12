#!/usr/bin/env bash
# Cuts the opening film (assets/video/launch.mp4) from the rendered shots.
#   tools/make-launch-video.sh <folder with the source clips>
# The source clips, music and voice are not in the repo (CREDITS.md says where they came from).
# The folder needs: s0 (lipstick close-up) s1 (she reads the base, reaches for her phone) s3b (the heart rises)
# s4t (the heart becomes the rabbit) s5 (she and the rabbit) as .mp4, plus music.mp3 and voice.mp3.
# The cut: 13.8 s, 720 by 1280, 30 frames a second. From 3.2 to 8.0 s the picture is only a blurred vanity:
# intro.js draws the phone, the two cards and every word over the film as real text. The last 1.5 s holds the
# final frame while the voice finishes. If a time here changes, change FILM in intro.js to match.
set -euo pipefail
SRC="${1:?give the folder with the source clips}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/video"
mkdir -p "$OUT"
LEN=13.8
FIT="fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,format=yuv420p"

# name, start in the source, length in the source, length in the film
SHOTS=(
  "s0 0.8 1.0 1.0"
  "s1 0.3 2.7 2.2"
  "PLATE 0 0 4.8"
  "s3b 1.2 1.8 0.9"
  "s4t 0.1 2.9 1.5"
  "s5 0.3 1.9 3.4"
)
inputs=(); filter=""; n=0; labels=""
for row in "${SHOTS[@]}"; do
  read -r name ss len out <<<"$row"
  frames=$(awk "BEGIN{printf \"%d\", $out*30+0.5}")
  if [ "$name" = PLATE ]; then   # the end of s1, held and blurred, behind the phone the app draws
    inputs+=(-ss 2.9 -t 0.1 -i "$SRC/s1.mp4")
    filter+="[$n:v]$FIT,boxblur=22:2,eq=brightness=-0.07,tpad=stop_mode=clone:stop_duration=6,trim=end_frame=$frames,setpts=PTS-STARTPTS[v$n];"
  else
    inputs+=(-ss "$ss" -t "$len" -i "$SRC/$name.mp4")
    speed=1; [ "$name" = s5 ] || speed=$(awk "BEGIN{print $out/$len}")   # s5 plays at its own speed, then holds
    filter+="[$n:v]setpts=(PTS-STARTPTS)*$speed,$FIT,tpad=stop_mode=clone:stop_duration=4,trim=end_frame=$frames,setpts=PTS-STARTPTS[v$n];"
  fi
  labels+="[v$n]"; n=$((n+1))
done
# join, open from the dark, and bloom to white on the cut from the dressing room into the garden (8.9 s)
filter+="${labels}concat=n=$n:v=1:a=0,trim=duration=$LEN,fade=t=in:st=0:d=0.3:color=0x1C0F13[j];"
filter+="color=white:s=720x1280:r=30:d=$LEN,format=rgba,fade=t=in:st=8.6:d=0.3:alpha=1,fade=t=out:st=8.9:d=0.35:alpha=1[w];[j][w]overlay=enable='between(t,8.6,9.25)',format=yuv420p[v];"

# the voice: each line cut from the take and placed on its beat (start and end in the take, time in the film)
LINES=(
  "0.00 1.61 0.10"     # I love this shade.
  "2.28 3.79 1.90"     # Was it tested on animals?
  "4.46 5.19 3.70"     # Let me check.
  "6.01 7.68 6.20"     # Oh! This one's kind.
  "8.42 9.89 8.85"     # Beauty that's kind to them.
  "10.63 13.32 10.60"  # Cruelty-free looks beautiful on you.
)
inputs+=(-i "$SRC/music.mp3" -i "$SRC/voice.mp3"); mi=$n; vi=$((n+1)); mix=""; k=0
for row in "${LINES[@]}"; do
  read -r a b at _ <<<"$row"
  ms=$(awk "BEGIN{printf \"%d\", $at*1000}")
  filter+="[$vi:a]atrim=$(awk "BEGIN{print ($a>0.06)?$a-0.06:0}"):$(awk "BEGIN{print $b+0.1}"),asetpts=PTS-STARTPTS,afade=t=in:d=0.03,adelay=$ms|$ms[s$k];"
  mix+="[s$k]"; k=$((k+1))
done
filter+="${mix}amix=inputs=$k:normalize=0,loudnorm=I=-15:TP=-1.5[vo];[$mi:a]volume=0.32,afade=t=out:st=$(awk "BEGIN{print $LEN-1.2}"):d=1.2[mu];[mu][vo]amix=inputs=2:normalize=0:duration=longest,atrim=0:$LEN[a]"

ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[v]" -map "[a]" \
  -c:v libx264 -profile:v high -level 3.1 -pix_fmt yuv420p -preset slow -b:v "${VBITRATE:-1700k}" -maxrate 2800k -bufsize 5600k \
  -g 60 -c:a aac -b:a 128k -ar 44100 -movflags +faststart -t $LEN "$OUT/launch.mp4"
ls -l "$OUT"
