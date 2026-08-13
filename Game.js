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
// REGRA MOBILE: Uso de Sensores (Acelerômetro) para jogabilidade imersiva
import { DeviceMotion } from 'expo-sensors';

/* ============ CONFIGURAÇÕES DO JOGO ============ */
const TILT_MAX_DEG = 24; 
const TILT_MAX_RAD = (TILT_MAX_DEG * Math.PI) / 180;
const TURN_RATE = 3.5; 
const BASE_SPEED = 150; 
const MAX_SPEED = 480;  
const ACCEL_RATE = 140; 
const BRAKE_RATE = 300; 
const FRICTION = 50;    
const PLAYER_RADIUS = 15;
const NPC_RADIUS = 15;

const TRACK_OUTER_X = 950;
const TRACK_OUTER_Y = 620;
const TRACK_INNER_X = 480;
const TRACK_INNER_Y = 230;

const COLOR_BG_DEEP = '#10131a';
const COLOR_AMBER = '#ffb703';
const COLOR_CYAN = '#4cc9f0';
const COLOR_DANGER = '#ff4d4f';
const COLOR_ASPHALT = '#33363f';
const COLOR_GRASS = '#4b9646';

/* ============ COMPONENTE DO CARRO ============ */
function CarShape({ x, y, angle, len, wid, color, isPlayer }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}>
      <RoundedRect x={-len / 2 + 3} y={-wid / 2 + 4} width={len} height={wid} r={5} color="rgba(0,0,0,0.28)" />
      <RoundedRect x={-len / 2} y={-wid / 2} width={len} height={wid} r={6} color={color} />
      <Circle cx={len / 2 - 3} cy={-wid / 2 + 3} r={2.1} color={isPlayer ? '#fff' : '#ffe08a'} />
      <Circle cx={len / 2 - 3} cy={wid / 2 - 3} r={2.1} color={isPlayer ? '#fff' : '#ffe08a'} />
    </Group>
  );
}

export default function Game() {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // REGRA MOBILE: Bloqueio de Orientação (O jogo exige modo paisagem)
  const isPortrait = winH > winW;

  const stateRef = useRef({
    screen: 'start',
    player: { x: 0, y: (TRACK_INNER_Y + TRACK_OUTER_Y) / 2, angle: -Math.PI / 2, speed: BASE_SPEED },
    camera: { x: 0, y: -260 },
    npcs: [],
    elapsed: 0,
    accelInput: false,
    brakeInput: false,
    hasTiltData: false,
    tiltSteerRaw: 0,
  });

  const [screen, setScreen] = useState('start');
  const [, forceRender] = useState(0);

  // Inicializa os NPCs na pista
  useEffect(() => {
    stateRef.current.npcs = [
      { t: 0.28, theta: 0.0, w: 0.55, color: '#e63946', x: 0, y: 0, angle: 0 },
      { t: 0.52, theta: 1.35, w: 0.42, color: '#f4a261', x: 0, y: 0, angle: 0 },
      { t: 0.78, theta: 2.75, w: 0.36, color: '#2a9d8f', x: 0, y: 0, angle: 0 },
    ];
  }, []);

  // REGRA MOBILE: Gerenciamento de Sensores
  const handleMotion = (measurement) => {
    const rotation = measurement && measurement.rotation;
    if (!rotation) return;
    // Em modo paisagem, o eixo 'beta' geralmente controla a inclinação lateral
    const beta = rotation.beta; 
    const g = stateRef.current;
    g.hasTiltData = true;
    // Normaliza o valor da inclinação para um intervalo entre -1 e 1
    g.tiltSteerRaw = Math.max(-1, Math.min(1, beta / (TILT_MAX_RAD || 0.4)));
  };

  const attachOrientation = () => {
    DeviceMotion.setUpdateInterval(16);
    DeviceMotion.addListener(handleMotion);
  };

  // Loop principal de renderização e física
  useEffect(() => {
    let raf;
    const loop = () => {
      updateGame(0.016);
      forceRender(f => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const updateGame = (dt) => {
    const g = stateRef.current;
    
    // Movimentação dos NPCs
    g.npcs.forEach(n => {
      n.theta += n.w * dt;
      const rx = TRACK_INNER_X + n.t * (TRACK_OUTER_X - TRACK_INNER_X);
      const ry = TRACK_INNER_Y + n.t * (TRACK_OUTER_Y - TRACK_INNER_Y);
      n.x = Math.cos(n.theta) * rx;
      n.y = Math.sin(n.theta) * ry;
      n.angle = Math.atan2(Math.cos(n.theta) * ry, -Math.sin(n.theta) * rx);
    });

    if (g.screen === 'playing') {
      g.elapsed += dt;

      // REGRA MOBILE: Controle de Velocidade via Pedais Virtuais
      if (g.accelInput) {
        g.player.speed = Math.min(MAX_SPEED, g.player.speed + ACCEL_RATE * dt);
      } else if (g.brakeInput) {
        g.player.speed = Math.max(0, g.player.speed - BRAKE_RATE * dt);
      } else {
        if (g.player.speed > BASE_SPEED) g.player.speed -= FRICTION * dt;
      }

      // REGRA MOBILE: Direção por Inclinação (Acelerômetro)
      const steer = g.tiltSteerRaw;
      g.player.angle += steer * TURN_RATE * dt;

      // Atualiza posição do jogador
      g.player.x += Math.cos(g.player.angle) * g.player.speed * dt;
      g.player.y += Math.sin(g.player.angle) * g.player.speed * dt;

      // Suavização da câmera
      g.camera.x += (g.player.x - g.camera.x) * 0.1;
      g.camera.y += (g.player.y - g.camera.y) * 0.1;

      // Verificação de colisão
      g.npcs.forEach(n => {
        const d = Math.hypot(g.player.x - n.x, g.player.y - n.y);
        if (d < (PLAYER_RADIUS + NPC_RADIUS)) setScreen('gameover');
      });
    }
  };

  const g = stateRef.current;

  return (
    <View style={styles.container}>
      {/* RENDERIZAÇÃO SKIA */}
      <Canvas style={{ width: winW, height: winH }}>
        <Fill color={COLOR_GRASS} />
        <Group transform={[{ translateX: winW/2 - g.camera.x }, { translateY: winH/2 - g.camera.y }]}>
          <Oval x={-TRACK_OUTER_X} y={-TRACK_OUTER_Y} width={TRACK_OUTER_X * 2} height={TRACK_OUTER_Y * 2} color={COLOR_ASPHALT} />
          <Oval x={-TRACK_INNER_X} y={-TRACK_INNER_Y} width={TRACK_INNER_X * 2} height={TRACK_INNER_Y * 2} color={COLOR_GRASS} />
          {g.npcs.map((n, i) => (
            <CarShape key={i} x={n.x} y={n.y} angle={n.angle} len={32} wid={16} color={n.color} isPlayer={false} />
          ))}
          <CarShape x={g.player.x} y={g.player.y} angle={g.player.angle} len={34} wid={17} color={COLOR_CYAN} isPlayer={true} />
        </Group>
      </Canvas>

      {/* INTERFACE DE JOGO (HUD) */}
      {screen === 'playing' && !isPortrait && (
        <>
          {/* PEDAIS DE CONTROLE NO LADO DIREITO */}
          <View style={[styles.pedalGroup, { right: insets.right + 20, bottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
              style={[styles.pedalBtn, { backgroundColor: COLOR_DANGER }]} 
              onPressIn={() => g.brakeInput = true} 
              onPressOut={() => g.brakeInput = false}
            >
              <Text style={styles.pedalText}>FREIO</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.pedalBtn, { backgroundColor: '#2ecc71' }]} 
              onPressIn={() => g.accelInput = true} 
              onPressOut={() => g.accelInput = false}
            >
              <Text style={styles.pedalText}>ACELERAR</Text>
            </TouchableOpacity>
          </View>

          {/* INDICADOR DE INCLINAÇÃO (FEEDBACK VISUAL) */}
          <View style={[styles.tiltIndicator, { left: insets.left + 20, bottom: insets.bottom + 20 }]}>
            <Text style={styles.tiltText}>INCLINE PARA VIRAR</Text>
            <View style={styles.tiltBarBg}>
              <View style={[styles.tiltBarActive, { width: 50, left: 50 + (g.tiltSteerRaw * 50) }]} />
            </View>
          </View>

          {/* VELOCÍMETRO */}
          <View style={[styles.speedo, { top: insets.top + 20 }]}>
            <Text style={styles.speedoText}>{Math.round(g.player.speed)} KM/H</Text>
          </View>
        </>
      )}

      {/* TELA INICIAL COM AVISO DE CONTROLE */}
      {screen === 'start' && !isPortrait && (
        <View style={styles.overlay}>
          <Text style={styles.title}>CORRIDA TURBO</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🎮 CONTROLE POR INCLINAÇÃO</Text>
            <Text style={styles.infoSub}>Incline o celular para os lados para dirigir.</Text>
            <Text style={styles.infoSub}>Use os pedais na tela para acelerar e frear.</Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={() => { 
            attachOrientation();
            setScreen('playing'); 
            g.screen = 'playing'; 
          }}>
            <Text style={styles.startBtnText}>INICIAR CORRIDA</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TELA DE GAME OVER */}
      {screen === 'gameover' && (
        <View style={styles.overlay}>
          <Text style={[styles.title, { color: COLOR_DANGER }]}>BATIDA!</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => { 
            g.player = { x: 0, y: (TRACK_INNER_Y + TRACK_OUTER_Y) / 2, angle: -Math.PI / 2, speed: BASE_SPEED };
            setScreen('playing'); g.screen = 'playing'; 
          }}>
            <Text style={styles.startBtnText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AVISO DE ORIENTAÇÃO */}
      {isPortrait && (
        <View style={styles.portraitWarning}>
          <Text style={styles.warningEmoji}>🔄</Text>
          <Text style={styles.warningText}>Gire o celular para a horizontal</Text>
          <Text style={styles.warningSub}>O jogo exige o modo paisagem para os sensores.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10131a' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 42, fontWeight: '900', color: '#fff', marginBottom: 20, letterSpacing: 3 },
  
  infoBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 15, marginBottom: 30, alignItems: 'center' },
  infoText: { color: COLOR_AMBER, fontWeight: 'bold', fontSize: 18, marginBottom: 5 },
  infoSub: { color: '#ccc', fontSize: 14, textAlign: 'center' },

  startBtn: { paddingVertical: 18, paddingHorizontal: 50, backgroundColor: COLOR_AMBER, borderRadius: 35, elevation: 5 },
  startBtnText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  
  // Pedais
  pedalGroup: { position: 'absolute', flexDirection: 'row', gap: 20 },
  pedalBtn: { width: 110, height: 70, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 3 },
  pedalText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  
  // Indicador de Inclinação
  tiltIndicator: { position: 'absolute', alignItems: 'center' },
  tiltText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginBottom: 5, opacity: 0.7 },
  tiltBarBg: { width: 100, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  tiltBarActive: { position: 'absolute', width: 10, height: 8, top: -2, backgroundColor: COLOR_CYAN, borderRadius: 5 },

  speedo: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 25, borderWidth: 1, borderColor: COLOR_CYAN },
  speedoText: { color: COLOR_CYAN, fontWeight: 'bold', fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  portraitWarning: { ...StyleSheet.absoluteFillObject, backgroundColor: '#10131a', justifyContent: 'center', alignItems: 'center', padding: 40 },
  warningEmoji: { fontSize: 70, marginBottom: 20 },
  warningText: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  warningSub: { color: '#aaa', fontSize: 16, marginTop: 15, textAlign: 'center' }
});
