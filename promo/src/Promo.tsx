import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender } from 'remotion';

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
export const TOTAL = f(28.5);
const YELLOW = '#FFD60A';
const PURPLE = '#5b3df5';

// Fonts ship with the project so the render matches on every machine.
const fontHandle = delayRender('fonts');
Promise.all(
  [['Poppins-Black.ttf', '900'], ['Poppins-Bold.ttf', '700'], ['Poppins-Medium.ttf', '500']].map(([file, weight]) => {
    const face = new FontFace('Poppins', `url(${staticFile(file)})`, { weight });
    return face.load().then((loaded) => document.fonts.add(loaded));
  }),
).then(() => continueRender(fontHandle));

// Voice lines: start time in the reel, seconds.
const VO = [0.3, 5.75, 7.9, 12.85, 17.85, 23.3];
const VO_LEN = [5.06, 1.61, 3.49, 4.45, 4.8, 2.94];

const KenBurns: React.FC<{ src: string; dur: number; from?: number; to?: number; ox?: string; oy?: string; children?: React.ReactNode }> = ({ src, dur, from = 1, to = 1.12, ox = '50%', oy = '40%', children }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, dur], [from, to], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: `${ox} ${oy}` }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)' }} />
    </AbsoluteFill>
  );
};

// A caption that pops in at `at` seconds (relative to its Sequence) and stays until `until`.
const Cap: React.FC<{ at: number; until: number; y: number; size?: number; color?: string; children: React.ReactNode; rotate?: number; bg?: string; x?: number }> = ({ at, until, y, size = 104, color = '#fff', children, rotate = 0, bg, x = 540 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = f(at);
  if (frame < start || frame >= f(until)) return null;
  const pop = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', left: x - 520, width: 1040, top: y, display: 'flex', justifyContent: 'center', transform: `translateY(-50%) scale(${0.5 + 0.5 * pop}) rotate(${rotate}deg)`, opacity: Math.min(1, pop * 2) }}>
      <div style={{
        fontFamily: 'Poppins', fontWeight: 900, fontSize: size, lineHeight: 1.08, textAlign: 'center', color, textTransform: 'uppercase', letterSpacing: -1,
        padding: bg ? '14px 34px' : 0, borderRadius: 26, background: bg ?? 'transparent',
        textShadow: bg ? 'none' : '0 6px 0 rgba(0,0,0,0.85), 0 0 24px rgba(0,0,0,0.55)',
        WebkitTextStroke: bg ? '0' : '3px rgba(0,0,0,0.85)', paintOrder: 'stroke fill',
        boxShadow: bg ? '0 10px 0 rgba(0,0,0,0.35)' : 'none',
      }}>{children}</div>
    </div>
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ backgroundColor: '#fff', opacity: interpolate(frame, [0, 5], [0.85, 0], { extrapolateRight: 'clamp' }), pointerEvents: 'none' }} />;
};

const Phone: React.FC<{ startFrom: number }> = ({ startFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #6e50ff 0%, #1c105a 100%)' }}>
      <div style={{ position: 'absolute', left: 66, top: 306, width: 948, height: 1548, borderRadius: 84, background: '#0c0a18', boxShadow: '0 40px 90px rgba(0,0,0,0.55)', transform: `translateY(${(1 - enter) * 500}px) rotate(${(1 - enter) * 4}deg)` }}>
        <div style={{ position: 'absolute', left: 24, top: 24, width: 900, height: 1500, borderRadius: 64, overflow: 'hidden', background: '#f6f5f2' }}>
          <OffthreadVideo src={staticFile('rec.mp4')} startFrom={startFrom} muted style={{ width: 900, height: 1500 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ src: string; dur: number }> = ({ src, dur }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, dur], [1.06, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ overflow: 'hidden' }}><Img src={staticFile(src)} style={{ width: '100%', height: '100%', transform: `scale(${scale})` }} /></AbsoluteFill>;
};

// Top progress bar, so viewers see how short the reel is.
const Bar: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 46, height: 10, borderRadius: 10, background: 'rgba(255,255,255,0.28)' }}>
      <div style={{ width: `${(frame / TOTAL) * 100}%`, height: '100%', borderRadius: 10, background: '#fff' }} />
    </div>
  );
};

const musicVolume = (frame: number) => {
  const t = frame / FPS;
  const talking = VO.some((s, i) => t > s - 0.15 && t < s + VO_LEN[i] + 0.1);
  const base = talking ? 0.2 : 0.5;
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [TOTAL - 36, TOTAL - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return base * fadeIn * fadeOut;
};

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 1. Hook */}
      <Sequence from={0} durationInFrames={f(5.6)}>
        <KenBurns src="img10.jpg" dur={f(5.6)} oy="30%" />
        <Cap at={0.3} until={2.45} y={1500} size={88}>Still paying to save<br /><span style={{ color: YELLOW }}>an Instagram reel?</span></Cap>
        <Cap at={2.54} until={5.6} y={1010} size={96} bg="#ff3b30" rotate={-7} x={330}>Ads</Cap>
        <Cap at={3.39} until={5.6} y={1230} size={96} bg="#ff9f0a" rotate={5} x={720}>Pop ups</Cap>
        <Cap at={4.34} until={5.6} y={1480} size={96} bg="#ff375f" rotate={-3}>Sign up walls</Cap>
      </Sequence>

      {/* 2. Stop, meet ReelSave */}
      <Sequence from={f(5.6)} durationInFrames={f(0.82)}>
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, #ff463c, #be1428)' }} />
        <Cap at={0.12} until={0.82} y={960} size={300}>Stop!</Cap>
        <Flash />
      </Sequence>
      <Sequence from={f(6.42)} durationInFrames={f(1.18)}>
        <Card src="card_brand.png" dur={f(1.18)} />
        <Cap at={0.04} until={1.18} y={380} size={110} color={YELLOW}>Meet</Cap>
        <Flash />
      </Sequence>

      {/* 3. Demo: paste and download */}
      <Sequence from={f(7.6)} durationInFrames={f(5.0)}>
        <Phone startFrom={f(1.49)} />
        <Cap at={0.3} until={1.33} y={185} size={104}>Copy the link</Cap>
        <Cap at={1.37} until={2.09} y={185} size={130} color={YELLOW}>Paste</Cap>
        <Cap at={2.13} until={3.34} y={185} size={104}>Tap download</Cap>
        <Cap at={3.38} until={5.0} y={185} size={124} color={YELLOW}>That's it!</Cap>
      </Sequence>

      {/* 4. Video or MP3 */}
      <Sequence from={f(12.6)} durationInFrames={f(1.7)}>
        <KenBurns src="img11.jpg" dur={f(1.7)} from={1.04} to={1.14} oy="30%" />
        <Cap at={0.25} until={1.7} y={1250} size={110}>Full quality<br /><span style={{ color: YELLOW }}>video</span></Cap>
        <Flash />
      </Sequence>
      <Sequence from={f(14.3)} durationInFrames={f(3.3)}>
        <Phone startFrom={f(7.29)} />
        <Cap at={0.04} until={1.4} y={185} size={96}>Or the sound</Cap>
        <Cap at={1.45} until={3.3} y={185} size={124} color={YELLOW}>as an MP3</Cap>
      </Sequence>

      {/* 5. No ads, no sign up, no limits, free */}
      <Sequence from={f(17.6)} durationInFrames={f(1.15)}>
        <KenBurns src="img13.jpg" dur={f(1.15)} from={1.02} to={1.1} />
        <Cap at={0.25} until={1.15} y={1420} size={170}>No <span style={{ color: YELLOW }}>ads</span></Cap>
        <Flash />
      </Sequence>
      <Sequence from={f(18.75)} durationInFrames={f(1.05)}>
        <KenBurns src="img12.jpg" dur={f(1.05)} from={1.02} to={1.1}>
          <div style={{ position: 'absolute', left: '15%', top: '73%', width: '17%', height: '11%', borderRadius: '50%', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }} />
        </KenBurns>
        <Cap at={0.14} until={1.05} y={1560} size={140} bg={PURPLE}>No sign up</Cap>
        <Flash />
      </Sequence>
      <Sequence from={f(19.8)} durationInFrames={f(1.1)}>
        <KenBurns src="img14.jpg" dur={f(1.1)} from={1.02} to={1.14} oy="60%" />
        <Cap at={0.1} until={1.1} y={520} size={160}>No <span style={{ color: YELLOW }}>limits</span></Cap>
        <Flash />
      </Sequence>
      <Sequence from={f(20.9)} durationInFrames={f(2.1)}>
        <Card src="card_free.png" dur={f(2.1)} />
        <Cap at={0.1} until={2.1} y={800} size={300} color={YELLOW}>Free</Cap>
        <Cap at={0.78} until={2.1} y={1130} size={110}>and open source</Cap>
        <Flash />
      </Sequence>

      {/* 6. End card */}
      <Sequence from={f(23.0)} durationInFrames={TOTAL - f(23.0)}>
        <Card src="card_end.png" dur={f(5.5)} />
        <Cap at={1.27} until={3.4} y={900} size={120} x={540}>Paste.</Cap>
        <Cap at={2.03} until={3.4} y={1050} size={120}>Tap.</Cap>
        <Cap at={2.65} until={3.4} y={1220} size={150} color={YELLOW}>Saved!</Cap>
        <Cap at={3.4} until={5.5} y={1000} size={84}>Want the link?</Cap>
        <Cap at={3.7} until={5.5} y={1210} size={92} bg="#fff" color={PURPLE} rotate={-3}>Comment "REEL"</Cap>
        <Flash />
      </Sequence>

      <Bar />

      {VO.map((s, i) => (
        <Sequence key={i} from={f(s)}><Audio src={staticFile(`vo${i}.wav`)} volume={1.25} /></Sequence>
      ))}
      <Audio src={staticFile('music.mp3')} volume={musicVolume} />
    </AbsoluteFill>
  );
};
