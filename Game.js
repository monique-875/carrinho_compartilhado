import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Canvas,
  Fill,
  Group,
  Oval,
  RoundedRect,
  Rect,
  Circle,
  DashPathEffect,
} from '@shopify/react-native-skia';
import { DeviceMotion } from 'expo-sensors';

/* ============ CONFIG ============ */
const TILT_MAX_DEG = 24; 
const TILT_MAX_RAD = (TILT_MAX_DEG * Math.PI) / 180;
const TURN_RATE = 3.1; 
const BASE_SPEED = 205; 
const MAX_SPEED = 330;
const SPEED_RAMP_TIME = 45; 
const PLAYER_RADIUS = 15;
const NPC_RADIUS = 15;
const PLAYER_LEN = 34;
const PLAYER_WID = 17;
const NPC_LEN = 32;
const NPC_WID = 16;

const TRACK_OUTER_X = 950;
const TRACK_OUTER_Y = 620;
const TRACK_INNER_X = 480;
const TRACK_INNER_Y = 230;

const COLOR_BG_DEEP = '#10131a';
const COLOR_PANEL = '#1b2130';
const COLOR_AMBER = '#ffb703';
const COLOR_CYAN = '#4cc9f0';
const COLOR_DANGER = '#ff4d4f';
const COLOR_TEXT_HI = '#f5f3ee';
const COLOR_TEXT_MID = '#aab0bf';
const COLOR_GRASS = '#4b9646'; 
const COLOR_ASPHALT = '#33363f';
const COLOR_EDGE = '#f5f3ee';

/* ============ HELPERS ============ */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function sign(v) {
  return v < 0 ? -1 : 1;
}
function formatTime(s) {
  const m = Math.floor(s / 60);
  const secNum = s - m * 60;
  let secStr = secNum.toFixed(2);
  if (secNum < 10) secStr = '0' + secStr;
  return m + ':' + secStr;
}

function makeNpcDefs() {
  return [
    { t: 0.28, theta: 0.0, w: 0.55, color: '#e63946' },
    { t: 0.52, theta: 1.35, w: 0.42, color: '#f4a261' },
    { t: 0.78, theta: 2.75, w: 0.36, color: '#2a9d8f' },
    { t: 0.4, theta: 4.1, w: -0.5, color: '#e76f51' },
    { t: 0.66, theta: 5.35, w: -0.38, color: '#8338ec' },
    { t: 0.87, theta: 0.85, w: 0.3, color: '#3a86ff' },
  ];
}
function makeNpcs() {
  return makeNpcDefs().map((d) => ({
    t: d.t,
    theta: d.theta,
    w: d.w,
    color: d.color,
    x: 0,
    y: 0,
    angle: 0,
  }));
}

const PROPS = (function buildProps() {
  const list = [];
  for (let i = 0; i < 28; i++) {
    const theta = (i / 28) * Math.PI * 2 + (i % 2) * 0.11;
    const rx = TRACK_OUTER_X + 90 + ((i * 37) % 90);
    const ry = TRACK_OUTER_Y + 55 + ((i * 53) % 80);
    list.push({
      x: Math.cos(theta) * rx,
      y: Math.sin(theta) * ry,
      r: 12 + ((i * 17) % 12),
      bush: i % 3 === 0,
    });
  }
  return list;
})();

const START_LINE_SEGS = 8;
const START_LINE = (function buildStartLine() {
  const y1 = -TRACK_OUTER_Y;
  const y2 = -TRACK_INNER_Y;
  const segH = (y2 - y1) / START_LINE_SEGS;
  const list = [];
  for (let i = 0; i < START_LINE_SEGS; i++) {
    list.push({
      y: y1 + i * segH,
      h: segH + 0.5,
      color: i % 2 === 0 ? COLOR_EDGE : '#20222a',
    });
  }
  return list;
})();

function createInitialState() {
  const player = {
    x: 0,
    y: (TRACK_INNER_Y + TRACK_OUTER_Y) / 2,
    angle: -Math.PI / 2,
    speed: BASE_SPEED,
  };
  return {
    screen: 'start', 
    player,
    camera: { x: player.x, y: player.y - 40 },
    npcs: makeNpcs(),
    particles: [],
    elapsed: 0,
    bestTime: 0,
    hasTiltData: false,
    invertSteer: false,
    tiltSteerRaw: 0,
    touchSteer: 0,
    steerDisplay: 0,
    shakeTime: 0,
  };
}

function CarShape({ x, y, angle, len, wid, color, isPlayer }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}>
      <RoundedRect x={-len / 2 + 3} y={-wid / 2 + 4} width={len} height={wid} r={5} color="rgba(0,0,0,0.28)" />
      <RoundedRect x={-len / 2} y={-wid / 2} width={len} height={wid} r={6} color={color} />
      <RoundedRect
        x={-len / 2}
        y={-wid / 2}
        width={len}
        height={wid}
        r={6}
        style="stroke"
        strokeWidth={1.4}
        color="rgba(0,0,0,0.35)"
      />
      <RoundedRect
        x={len * 0.06}
        y={-wid / 2 + 3}
        width={len * 0.3}
        height={wid - 6}
        r={3}
        color="rgba(205,228,255,0.7)"
      />
      <Circle cx={len / 2 - 3} cy={-wid / 2 + 3} r={2.1} color={isPlayer ? '#fff59d' : '#ffe08a'} />
      <Circle cx={len / 2 - 3} cy={wid / 2 - 3} r={2.1} color={isPlayer ? '#fff59d' : '#ffe08a'} />
      {isPlayer && (
        <Rect x={-len / 2 + 4} y={-2} width={len - 8} height={4} color="rgba(255,255,255,0.85)" />
      )}
    </Group>
  );
}

export default function Game() {
  const stateRef = useRef(createInitialState());
  const motionSub = useRef(null);

  const [screen, setScreen] = useState('start');
  const [, forceRender] = useState(0);
  const [invertChecked, setInvertChecked] = useState(false);
  const [finalTimeText, setFinalTimeText] = useState('0:00.00');
  const [bestTimeText, setBestTimeText] = useState('0:00.00');

  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const changeScreen = (next) => {
    stateRef.current.screen = next;
    setScreen(next);
  };

  const handleMotion = (measurement) => {
    const rotation = measurement && measurement.rotation;
    if (!rotation) return;
    const beta = rotation.beta;
    if (beta === null || beta === undefined) return;
    const g = stateRef.current;
    g.hasTiltData = true;
    g.tiltSteerRaw = clamp(beta / TILT_MAX_RAD, -1, 1);
  };

  const attachOrientation = () => {
    if (motionSub.current) return;
    DeviceMotion.setUpdateInterval(16);
    motionSub.current = DeviceMotion.addListener(handleMotion);
  };

  const spawnCrash = (x, y) => {
    const g = stateRef.current;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 70 + Math.random() * 210;
      g.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.55 + Math.random() * 0.4,
        maxLife: 1,
        color: Math.random() < 0.5 ? COLOR_AMBER : COLOR_DANGER,
      });
    }
    g.shakeTime = 0.35;
  };

  const triggerGameOver = (x, y) => {
    const g = stateRef.current;
    if (g.screen !== 'playing') return;
    spawnCrash(x, y);
    if (g.elapsed > g.bestTime) g.bestTime = g.elapsed;
    setFinalTimeText(formatTime(g.elapsed));
    setBestTimeText(formatTime(g.bestTime));
    changeScreen('gameover');
  };

  const resetWorld = () => {
    const g = stateRef.current;
    g.player.x = 0;
    g.player.y = (TRACK_INNER_Y + TRACK_OUTER_Y) / 2;
    g.player.angle = -Math.PI / 2;
    g.player.speed = BASE_SPEED;
    g.camera.x = g.player.x;
    g.camera.y = g.player.y - 40;
    g.npcs = makeNpcs();
    g.elapsed = 0;
    g.particles = [];
    g.shakeTime = 0;
  };

  const beginPlay = () => {
    resetWorld();
    changeScreen('playing');
  };

  const handlePlayPress = () => {
    stateRef.current.invertSteer = invertChecked;
    const needsPermission = Platform.OS === 'ios';
    if (needsPermission) {
      changeScreen('permission');
    } else {
      attachOrientation();
      beginPlay();
    }
  };

  const handleGrantPress = async () => {
    try {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res && res.status === 'granted') attachOrientation();
    } catch (e) {}
    beginPlay();
  };

  const handleSkipPress = () => beginPlay();
  const handleRespawnPress = () => beginPlay();

  const update = (dt) => {
    const g = stateRef.current;

    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) g.particles.splice(i, 1);
    }
    if (g.shakeTime > 0) g.shakeTime = Math.max(0, g.shakeTime - dt);

    for (let i = 0; i < g.npcs.length; i++) {
      const n = g.npcs[i];
      n.theta += n.w * dt;
      const rx = TRACK_INNER_X + n.t * (TRACK_OUTER_X - TRACK_INNER_X);
      const ry = TRACK_INNER_Y + n.t * (TRACK_OUTER_Y - TRACK_INNER_Y);
      n.x = Math.cos(n.theta) * rx;
      n.y = Math.sin(n.theta) * ry;
      const dx = -Math.sin(n.theta) * rx * sign(n.w);
      const dy = Math.cos(n.theta) * ry * sign(n.w);
      n.angle = Math.atan2(dy, dx);
    }

    const steer = g.hasTiltData ? g.tiltSteerRaw * (g.invertSteer ? -1 : 1) : g.touchSteer;
    g.steerDisplay = steer;

    if (g.screen === 'playing') {
      g.elapsed += dt;
      const rampT = clamp(g.elapsed / SPEED_RAMP_TIME, 0, 1);
      const targetSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * rampT;
      g.player.angle += steer * TURN_RATE * dt;
      const rOuter = Math.hypot(g.player.x / TRACK_OUTER_X, g.player.y / TRACK_OUTER_Y);
      const rInner = Math.hypot(g.player.x / TRACK_INNER_X, g.player.y / TRACK_INNER_Y);
      const onTrack = rOuter <= 1.08 && rInner >= 0.92;
      g.player.speed = targetSpeed * (onTrack ? 1 : 0.55);
      g.player.x += Math.cos(g.player.angle) * g.player.speed * dt;
      g.player.y += Math.sin(g.player.angle) * g.player.speed * dt;
      g.camera.x += (g.player.x - g.camera.x) * 0.12;
      g.camera.y += (g.player.y - g.camera.y) * 0.12;

      for (let j = 0; j < g.npcs.length; j++) {
        const m = g.npcs[j];
        const d = Math.hypot(g.player.x - m.x, g.player.y - m.y);
        if (d < (PLAYER_RADIUS + NPC_RADIUS) * 0.82) {
          triggerGameOver((g.player.x + m.x) / 2, (g.player.y + m.y) / 2);
          break;
        }
      }
    } else if (g.screen === 'start') {
      g.camera.x += (0 - g.camera.x) * 0.01;
      g.camera.y += (-260 - g.camera.y) * 0.01;
    }
  };

  useEffect(() => {
    let raf;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt);
      forceRender((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (motionSub.current) {
        motionSub.current.remove();
        motionSub.current = null;
      }
    };
  }, []);

  const setTouchLeft = (down) => {
    stateRef.current.touchSteer = down ? -1 : stateRef.current.touchSteer === -1 ? 0 : stateRef.current.touchSteer;
  };
  const setTouchRight = (down) => {
    stateRef.current.touchSteer = down ? 1 : stateRef.current.touchSteer === 1 ? 0 : stateRef.current.touchSteer;
  };

  const g = stateRef.current;
  const needleDeg = (g.steerDisplay || 0) * 48;
  const shakeMag = g.shakeTime > 0 ? (g.shakeTime / 0.35) * 9 : 0;
  const shakeX = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
  const shakeY = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
  const worldTransform = [
    { translateX: winW / 2 - g.camera.x + shakeX },
    { translateY: winH / 2 - g.camera.y + shakeY },
  ];
  const trackMidX = (TRACK_OUTER_X + TRACK_INNER_X) / 2;
  const trackMidY = (TRACK_OUTER_Y + TRACK_INNER_Y) / 2;

  return (
    <View style={styles.container}>
      <Canvas style={{ width: winW, height: winH }}>
        <Fill color={COLOR_GRASS} />
        <Group transform={worldTransform}>
          <Oval x={-TRACK_OUTER_X} y={-TRACK_OUTER_Y} width={TRACK_OUTER_X * 2} height={TRACK_OUTER_Y * 2} color={COLOR_ASPHALT} />
          <Oval x={-TRACK_INNER_X} y={-TRACK_INNER_Y} width={TRACK_INNER_X * 2} height={TRACK_INNER_Y * 2} color={COLOR_GRASS} />
          <Oval x={-TRACK_OUTER_X} y={-TRACK_OUTER_Y} width={TRACK_OUTER_X * 2} height={TRACK_OUTER_Y * 2} style="stroke" strokeWidth={6} color={COLOR_EDGE} />
          <Oval x={-TRACK_INNER_X} y={-TRACK_INNER_Y} width={TRACK_INNER_X * 2} height={TRACK_INNER_Y * 2} style="stroke" strokeWidth={6} color={COLOR_EDGE} />
          <Oval x={-trackMidX} y={-trackMidY} width={trackMidX * 2} height={trackMidY * 2} style="stroke" strokeWidth={4} color={COLOR_AMBER}>
            <DashPathEffect intervals={[22, 22]} />
          </Oval>
          {START_LINE.map((seg, i) => (
            <Rect key={'sl' + i} x={-8} y={seg.y} width={16} height={seg.h} color={seg.color} />
          ))}
          {PROPS.map((p, i) => (
            <Group key={'prop' + i}>
              <Oval x={p.x - p.r * 0.9} y={p.y + p.r * 0.5 - p.r * 0.35} width={p.r * 1.8} height={p.r * 0.7} color="rgba(0,0,0,0.18)" />
              {!p.bush && <Rect x={p.x - 2} y={p.y - 2} width={4} height={p.r * 0.6} color="#6b4423" />}
              <Circle cx={p.x} cy={p.y - (p.bush ? 0 : p.r * 0.3)} r={p.r * (p.bush ? 0.7 : 0.55)} color={p.bush ? '#3f8a3f' : '#2f7a3a'} />
            </Group>
          ))}
          {g.npcs.map((n, i) => (
            <CarShape key={'npc' + i} x={n.x} y={n.y} angle={n.angle} len={NPC_LEN} wid={NPC_WID} color={n.color} isPlayer={false} />
          ))}
          <CarShape x={g.player.x} y={g.player.y} angle={g.player.angle} len={PLAYER_LEN} wid={PLAYER_WID} color={COLOR_CYAN} isPlayer />
          {g.particles.map((p, i) => (
            <Group key={'part' + i} opacity={Math.max(0, p.life / p.maxLife)}>
              <Rect x={p.x - 3} y={p.y - 3} width={6} height={6} color={p.color} />
            </Group>
          ))}
        </Group>
      </Canvas>

      {screen === 'playing' && (
        <>
          <View pointerEvents="none" style={[styles.hudTimerWrap, { top: insets.top + 16 }]}>
            <View style={styles.hudTimerPill}>
              <Text style={styles.hudLabel}>Tempo</Text>
              <Text style={styles.hudTimerValue}>{formatTime(g.elapsed)}</Text>
            </View>
          </View>
          <View pointerEvents="none" style={[styles.gaugeWrap, { bottom: insets.bottom + 22 }]}>
            <View style={styles.gauge}>
              <View style={styles.gaugePivot}>
                <View style={[styles.gaugeNeedle, { transform: [{ rotate: needleDeg + 'deg' }] }]} />
              </View>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.6} style={[styles.tbtn, styles.tbtnLeft, { bottom: insets.bottom + 20 }]} onPressIn={() => setTouchLeft(true)} onPressOut={() => setTouchLeft(false)}>
            <Text style={styles.tbtnText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6} style={[styles.tbtn, styles.tbtnRight, { bottom: insets.bottom + 20 }]} onPressIn={() => setTouchRight(true)} onPressOut={() => setTouchRight(false)}>
            <Text style={styles.tbtnText}>▶</Text>
          </TouchableOpacity>
        </>
      )}

      {screen === 'start' && (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>🏁 Corrida Turbo</Text>
            <Text style={styles.h1}>Sinta a pista.{'\n'}Incline pra virar.</Text>
            <Text style={styles.sub}>Segure o celular na horizontal e incline para a esquerda ou direita pra guiar o carro. Desvie do tráfego.</Text>
            <TouchableOpacity style={styles.invertRow} activeOpacity={0.7} onPress={() => setInvertChecked((v) => !v)}>
              <View style={[styles.checkbox, invertChecked && styles.checkboxChecked]}>{invertChecked && <Text style={styles.checkboxMark}>✓</Text>}</View>
              <Text style={styles.invertLabel}>Inverter direção do sensor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={handlePlayPress}>
              <Text style={styles.btnPrimaryText}>▶ Jogar</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Sem sensor? Use os botões ◀ ▶ na tela.</Text>
          </View>
        </View>
      )}

      {screen === 'permission' && (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Sensor de movimento</Text>
            <Text style={styles.h2}>Precisamos da sua permissão</Text>
            <Text style={styles.sub}>O iPhone pede autorização pra usar o acelerômetro.</Text>
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={handleGrantPress}>
              <Text style={styles.btnPrimaryText}>Permitir sensor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} activeOpacity={0.7} onPress={handleSkipPress}>
              <Text style={styles.btnGhostText}>Jogar sem sensor</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {screen === 'gameover' && (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={[styles.eyebrow, styles.eyebrowCrash]}>💥 Batida!</Text>
            <Text style={styles.h2}>Fim de jogo</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}><Text style={styles.statLabel}>Tempo</Text><Text style={styles.statValue}>{finalTimeText}</Text></View>
              <View style={styles.statBlock}><Text style={styles.statLabel}>Melhor</Text><Text style={styles.statValue}>{bestTimeText}</Text></View>
            </View>
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={handleRespawnPress}>
              <Text style={styles.btnPrimaryText}>🔄 Renascer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR_BG_DEEP },
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(9,11,15,0.92)' },
  card: { backgroundColor: COLOR_PANEL, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 32, paddingHorizontal: 28, maxWidth: 380, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10 },
  eyebrow: { fontWeight: '800', letterSpacing: 1.5, fontSize: 12, color: COLOR_AMBER, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  eyebrowCrash: { color: COLOR_DANGER },
  h1: { color: COLOR_TEXT_HI, fontSize: 25, fontWeight: '800', textAlign: 'center', marginBottom: 12, lineHeight: 30 },
  h2: { color: COLOR_TEXT_HI, fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  sub: { color: COLOR_TEXT_MID, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  invertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLOR_AMBER, borderColor: COLOR_AMBER },
  checkboxMark: { color: '#1a1300', fontSize: 13, fontWeight: '800' },
  invertLabel: { color: COLOR_TEXT_MID, fontSize: 13 },
  btnPrimary: { width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: COLOR_AMBER, alignItems: 'center', shadowColor: COLOR_AMBER, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  btnPrimaryText: { color: '#1a1300', fontWeight: '800', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' },
  btnGhost: { marginTop: 10, width: '100%', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  btnGhostText: { color: COLOR_TEXT_MID, fontWeight: '600', fontSize: 13 },
  hint: { marginTop: 14, fontSize: 12, color: COLOR_TEXT_MID, opacity: 0.75, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 24, gap: 28 },
  statBlock: { alignItems: 'center' },
  statLabel: { fontSize: 11, letterSpacing: 1, color: COLOR_TEXT_MID, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 22, fontWeight: '700', color: COLOR_TEXT_HI },
  hudTimerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hudTimerPill: { backgroundColor: 'rgba(16,19,26,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 18, alignItems: 'center' },
  hudLabel: { fontSize: 10, letterSpacing: 1.2, color: COLOR_CYAN, textTransform: 'uppercase' },
  hudTimerValue: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 19, fontWeight: '700', color: COLOR_TEXT_HI },
  gaugeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  gauge: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: COLOR_CYAN, backgroundColor: 'rgba(16,19,26,0.55)' },
  gaugePivot: { position: 'absolute', left: 29, top: 29, width: 0, height: 0 },
  gaugeNeedle: { position: 'absolute', left: -1.5, top: -22, width: 3, height: 22, borderRadius: 2, backgroundColor: COLOR_AMBER },
  tbtn: { position: 'absolute', width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(16,19,26,0.5)', alignItems: 'center', justifyContent: 'center' },
  tbtnLeft: { left: 18 },
  tbtnRight: { right: 18 },
  tbtnText: { color: COLOR_TEXT_HI, fontSize: 22 },
});
