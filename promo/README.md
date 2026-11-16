# ReelSave promo reel

A 28.5 second vertical reel (1080x1920, 30 fps) built with [Remotion](https://github.com/remotion-dev/remotion).
The finished video is `out/reelsave-promo.mp4`.

## Edit and render

```
cd promo
npm install
npx remotion studio          # live preview in your browser
npm run render               # writes out/reelsave-promo.mp4
```

All scenes, captions and timings live in `src/Promo.tsx`. Photos, voice lines, music, fonts and the app
recording live in `public/`.

In a cloud session with a preinstalled Chromium, add
`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
to the render command.

## Where the assets came from

- `rec.mp4`: a recording of the real ReelSave page with a staged demo post.
- `img*.jpg`: AI generated photos. The people shown do not exist.
- `vo*.wav` and `music.mp3`: AI generated voice and music.
- Poppins font: SIL Open Font License, see `public/poppins-OFL.txt`.

Remotion is free for individuals and small teams. Companies with four or more people need a Remotion licence.
