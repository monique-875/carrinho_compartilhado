// Importa a biblioteca principal do React e os "Hooks" para gerenciar o estado e ciclo de vida do jogo
import React, { useEffect, useRef, useState } from 'react';

// Importa os componentes visuais e utilitários nativos para montar a interface do aplicativo
import {
  View,               // Bloco/caixa de layout (equivalente a uma <div> na web)
  Text,               // Componente para exibir textos na tela
  TouchableOpacity,   // Botão clicável que reduz a opacidade ao ser tocado
  StyleSheet,         // Módulo para criar e organizar os estilos CSS no React Native
  Platform,           // Permite identificar se o app está rodando em iOS ou Android
  useWindowDimensions,// Hook para obter a largura e altura em tempo real da tela do celular
} from 'react-native';

// Importa o Hook para calcular as áreas seguras da tela (evita a barra de status e a área da câmera/notch)
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importa os elementos de renderização gráfica 2D de alta performance da biblioteca Skia
import {
  Canvas,         // A "lousa/tela" onde todos os gráficos 2D de alto desempenho são desenhados
  Fill,           // Preenche todo o fundo do Canvas com uma cor específica
  Group,          // Agrupa múltiplos elementos visuais para aplicar transformações (como mover ou girar) juntos
  Oval,           // Desenha formas ovais ou elipses
  RoundedRect,    // Desenha retângulos com cantos arredondados (usado no corpo dos carros)
  Rect,           // Desenha retângulos tradicionais com cantos retos
  Circle,         // Desenha círculos perfeitos (usado em faróis e vegetação)
  DashPathEffect, // Aplica efeito de linha tracejada nos contornos (usado na faixa central do asfalto)
} from '@shopify/react-native-skia';

// Importa o módulo de sensores do Expo para ler a inclinação, giroscópio e aceleração do celular
import { DeviceMotion } from 'expo-sensors';

// --- CONFIGURAÇÕES DE MOVIMENTO E INCLINAÇÃO ---

// Define o ângulo máximo (em graus) que a inclinação do celular vai registrar para fazer o carro virar
const TILT_MAX_DEG = 24;

// Converte o ângulo máximo de graus para RADIANOS (fórmula da matemática necessária para o código fazer cálculos de física)
const TILT_MAX_RAD = (TILT_MAX_DEG * Math.PI) / 180;

// Multiplicador da taxa de curva: define quão rápido ou sensível o carro responde ao girar o celular
const TURN_RATE = 3.1;

// Velocidade inicial (mínima) do carro do jogador ao começar a partida
const BASE_SPEED = 205;

// Velocidade máxima que o carro do jogador pode atingir
const MAX_SPEED = 330;

// Tempo (em segundos) necessário para o jogo ir aumentando a velocidade do carro da inicial até a máxima
const SPEED_RAMP_TIME = 45;


// --- DIMENSÕES DOS VEÍCULOS ---

// Raio de colisão do jogador (usado para detectar batidas/contatos em forma de círculo)
const PLAYER_RADIUS = 15;

// Raio de colisão dos carrinhos adversários (NPCs)
const NPC_RADIUS = 15;

// Comprimento (altura) do visual do carro do jogador em pixels
const PLAYER_LEN = 34;

// Largura do visual do carro do jogador em pixels
const PLAYER_WID = 17;

// Comprimento (altura) do visual dos carrinhos adversários em pixels
const NPC_LEN = 32;

// Largura do visual dos carrinhos adversários em pixels
const NPC_WID = 16;


// --- DIMENSÕES DA PISTA DE CORRIDA ---

// Largura e altura da borda EXTERNA da pista oval (onde ficam as zebras/grama de fora)
const TRACK_OUTER_X = 950;
const TRACK_OUTER_Y = 620;

// Largura e altura da borda INTERNA da pista oval (o canteiro central do circuito)
const TRACK_INNER_X = 480;
const TRACK_INNER_Y = 230;


// --- PALETA DE CORES DO JOGO (Códigos Hexadecimais de Cor) ---

// Cor de fundo geral do aplicativo (azul/cinza muito escuro)
const COLOR_BG_DEEP = '#10131a';

// Cor de fundo para os painéis de menu e telas de aviso (azul escuro)
const COLOR_PANEL = '#1b2130';

// Cor amarelada/dourada para destaques, pontuação ou elementos importantes
const COLOR_AMBER = '#ffb703';

// Cor ciano/azul claro vibrante para botões, detalhes ou luzes
const COLOR_CYAN = '#4cc9f0';

// Cor vermelha de alerta (usada para colisões, game over ou avisos de perigo)
const COLOR_DANGER = '#ff4d4f';

// Cor do texto principal (branco levemente amarelado para não cansar a vista)
const COLOR_TEXT_HI = '#f5f3ee';

// Cor do texto secundário (cinza claro para informações menos importantes)
const COLOR_TEXT_MID = '#aab0bf';

// Cor verde da grama que fica em volta e dentro da pista
const COLOR_GRASS = '#4b9646';

// Cor cinza escuro do asfalto da pista de corrida
const COLOR_ASPHALT = '#33363f';

// Cor clara (branca/off-white) para pintar as faixas e bordas da pista
const COLOR_EDGE = '#f5f3ee';
/* ============ HELPERS (Funções Utilitárias / Auxiliares) ============ */

// Limita um valor (v) dentro de um intervalo entre o mínimo (lo) e o máximo (hi)
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Retorna -1 se o número for negativo, ou 1 se for positivo (usado para saber a direção do movimento)
function sign(v) {
  return v < 0 ? -1 : 1;
}

// Converte o tempo em segundos para o formato "Minutos:Segundos.Milésimos" (ex: "1:05.32")
function formatTime(s) {
  // Calcula a quantidade inteira de minutos
  const m = Math.floor(s / 60);
  // Pega os segundos restantes após tirar os minutos
  const secNum = s - m * 60;
  // Arredonda os segundos para 2 casas decimais e transforma em texto
  let secStr = secNum.toFixed(2);
  // Adiciona um zero à esquerda se os segundos forem menores que 10 (ex: "09.50")
  if (secNum < 10) secStr = '0' + secStr;
  // Retorna a string formatada no padrão mm:ss.ms
  return m + ':' + secStr;
}

// Cria a "receita" (configurações) dos carros adversários (NPCs)
function makeNpcDefs() {
  return [
    // t: posição na largura da pista, theta: ângulo na curva, w: velocidade angular, color: cor
    { t: 0.28, theta: 0.0, w: 0.55, color: '#e63946' },
    { t: 0.52, theta: 1.35, w: 0.42, color: '#f4a261' },
    { t: 0.78, theta: 2.75, w: 0.36, color: '#2a9d8f' },
    { t: 0.4, theta: 4.1, w: -0.5, color: '#e76f51' },
    { t: 0.66, theta: 5.35, w: -0.38, color: '#8338ec' },
    { t: 0.87, theta: 0.85, w: 0.3, color: '#3a86ff' },
  ];
}

// Cria a lista de objetos dos carrinhos adversários com suas posições x, y e ângulo iniciais zerados
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

// Cria automaticamente 28 cenários/objetos de decoração (árvores e arbustos) ao redor da pista
const PROPS = (function buildProps() {
  const list = [];
  // Loop para gerar 28 elementos visuais
  for (let i = 0; i < 28; i++) {
    // Calcula a posição em ângulo em volta do circuito
    const theta = (i / 28) * Math.PI * 2 + (i % 2) * 0.11;
    // Calcula o raio X (distância do centro) para colocar a árvore fora da pista
    const rx = TRACK_OUTER_X + 90 + ((i * 37) % 90);
    // Calcula o raio Y para colocar a árvore fora da pista
    const ry = TRACK_OUTER_Y + 55 + ((i * 53) % 80);
    // Adiciona o objeto à lista com posição, tamanho e se é arbusto ou árvore
    list.push({
      x: Math.cos(theta) * rx,
      y: Math.sin(theta) * ry,
      r: 12 + ((i * 17) % 12),
      bush: i % 3 === 0, // A cada 3 elementos, define como arbusto
    });
  }
  return list;
})();

// Quantidade de blocos quadriculados da linha de chegada
const START_LINE_SEGS = 8;

// Monta os segmentos de cor intercalada (zebra) para a linha de chegada
const START_LINE = (function buildStartLine() {
  const y1 = -TRACK_OUTER_Y;
  const y2 = -TRACK_INNER_Y;
  // Calcula a altura de cada segmento quadriculado
  const segH = (y2 - y1) / START_LINE_SEGS;
  const list = [];
  for (let i = 0; i < START_LINE_SEGS; i++) {
    list.push({
      y: y1 + i * segH,
      h: segH + 0.5,
      // Intercala entre a cor clara da borda e uma cor escura
      color: i % 2 === 0 ? COLOR_EDGE : '#20222a',
    });
  }
  return list;
})();

// Função que define as informações iniciais quando o jogo começa ou recomeça
function createInitialState() {
  // Posição inicial e ângulo do jogador
  const player = {
    x: 0,
    y: (TRACK_INNER_Y + TRACK_OUTER_Y) / 2, // Fica exatamente no meio da pista
    angle: -Math.PI / 2, // Apontando para cima
    speed: BASE_SPEED,
  };
  // Retorna o objeto com todo o estado inicial do jogo
  return {
    screen: 'start', // Tela inicial
    player,
    camera: { x: player.x, y: player.y - 40 }, // Câmera posicionada um pouco à frente do jogador
    npcs: makeNpcs(), // Adiciona os adversários
    particles: [], // Lista de faíscas/fumaça da batida
    elapsed: 0, // Cronômetro de tempo
    bestTime: 0, // Recorde de tempo
    hasTiltData: false, // Confirma se o sensor está funcionando
    invertSteer: false, // Inverter direção da curva
    tiltSteerRaw: 0, // Leitura bruta do sensor
    touchSteer: 0, // Entrada do controle por toque
    steerDisplay: 0, // Valor final usado para virar o carro
    shakeTime: 0, // Duração do tremor de tela na batida
  };
}

// COMPONENTE VISUAL: Desenha a forma do carrinho (jogador ou NPC)
function CarShape({ x, y, angle, len, wid, color, isPlayer }) {
  return (
    // Agrupa todos os desenhos do carro e os posiciona/rotaciona de uma só vez
    <Group transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}>
      {/* Sombra do carro */}
      <RoundedRect x={-len / 2 + 3} y={-wid / 2 + 4} width={len} height={wid} r={5} color="rgba(0,0,0,0.28)" />
      {/* Corpo principal do carro */}
      <RoundedRect x={-len / 2} y={-wid / 2} width={len} height={wid} r={6} color={color} />
      {/* Contorno em volta do carro */}
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
      {/* Para-brisa (vidro dianteiro) */}
      <RoundedRect
        x={len * 0.06}
        y={-wid / 2 + 3}
        width={len * 0.3}
        height={wid - 6}
        r={3}
        color="rgba(205,228,255,0.7)"
      />
      {/* Farol Esquerdo */}
      <Circle cx={len / 2 - 3} cy={-wid / 2 + 3} r={2.1} color={isPlayer ? '#fff59d' : '#ffe08a'} />
      {/* Farol Direito */}
      <Circle cx={len / 2 - 3} cy={wid / 2 - 3} r={2.1} color={isPlayer ? '#fff59d' : '#ffe08a'} />
      {/* Faixa decorativa no teto (exclusiva do jogador) */}
      {isPlayer && (
        <Rect x={-len / 2 + 4} y={-2} width={len - 8} height={4} color="rgba(255,255,255,0.85)" />
      )}
    </Group>
  );
}

// COMPONENTE PRINCIPAL DO JOGO
export default function Game() {
  // Referência para guardar o estado do jogo sem disparar re-renderizações desnecessárias
  const stateRef = useRef(createInitialState());
  // Guarda a inscrição/conexão do sensor de movimento do celular
  const motionSub = useRef(null);

  // Estados do React para controlar a interface gráfica
  const [screen, setScreen] = useState('start'); // Controla qual tela está aberta
  const [, forceRender] = useState(0); // Força a atualização visual do jogo a cada frame
  const [invertChecked, setInvertChecked] = useState(false); // Armazena a opção de inverter direção
  const [finalTimeText, setFinalTimeText] = useState('0:00.00'); // Texto do tempo final
  const [bestTimeText, setBestTimeText] = useState('0:00.00'); // Texto do melhor tempo

  // Mede as dimensões da janela do celular
  const { width: winW, height: winH } = useWindowDimensions();
  // Obtém o espaço seguro das bordas (notch/câmera do celular)
  const insets = useSafeAreaInsets();

  // Função para mudar de tela no jogo (ex: 'start' -> 'playing')
  const changeScreen = (next) => {
    stateRef.current.screen = next;
    setScreen(next);
  };

  // Processa as leituras recebidas do sensor de inclinação do celular
  const handleMotion = (measurement) => {
    const rotation = measurement && measurement.rotation;
    if (!rotation) return;
    const beta = rotation.beta; // Ângulo de inclinação lateral
    if (beta === null || beta === undefined) return;
    const g = stateRef.current;
    g.hasTiltData = true; // Confirma que o sensor está funcionando
    // Normaliza a inclinação entre -1 (total esquerda) e 1 (total direita)
    g.tiltSteerRaw = clamp(beta / TILT_MAX_RAD, -1, 1);
  };

  // Ativa a escuta contínua do sensor de movimento do celular
  const attachOrientation = () => {
    if (motionSub.current) return;
    DeviceMotion.setUpdateInterval(16); // Atualiza aproximadamente a cada 16ms (60 FPS)
    motionSub.current = DeviceMotion.addListener(handleMotion);
  };

  // Cria o efeito visual de explosão/faíscas em uma colisão
  const spawnCrash = (x, y) => {
    const g = stateRef.current;
    // Gera 22 partículas voando em direções aleatórias
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
    g.shakeTime = 0.35; // Ativa a trepidação da câmera por 0.35 segundos
  };

  // Dispara o Fim de Jogo quando ocorre uma batida
  const triggerGameOver = (x, y) => {
    const g = stateRef.current;
    if (g.screen !== 'playing') return;
    spawnCrash(x, y); // Cria a explosão
    // Atualiza o recorde pessoal se o tempo atual for maior
    if (g.elapsed > g.bestTime) g.bestTime = g.elapsed;
    setFinalTimeText(formatTime(g.elapsed));
    setBestTimeText(formatTime(g.bestTime));
    changeScreen('gameover'); // Vai para a tela de Game Over
  };

  // Reseta o jogador, adversários e variáveis para o estado inicial da pista
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

  // Inicia a partida
  const beginPlay = () => {
    resetWorld();
    changeScreen('playing');
  };

  // Trata o clique no botão de Jogar
  const handlePlayPress = () => {
    stateRef.current.invertSteer = invertChecked;
    const needsPermission = Platform.OS === 'ios';
    // Se for iPhone, pede permissão para o sensor primeiro
    if (needsPermission) {
      changeScreen('permission');
    } else {
      attachOrientation();
      beginPlay();
    }
  };

  // Pede a permissão de acesso ao sensor no iOS
  const handleGrantPress = async () => {
    try {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res && res.status === 'granted') attachOrientation();
    } catch (e) {}
    beginPlay();
  };

  // Funções para os botões secundários nos menus
  const handleSkipPress = () => beginPlay();
  const handleRespawnPress = () => beginPlay();

  // LOOP DE ATUALIZAÇÃO DA FÍSICA (Executado a cada quadro/frame do jogo)
  const update = (dt) => {
    const g = stateRef.current;

    // Atualiza o movimento e o tempo de vida das partículas de explosão
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; // Desaceleração por atrito
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) g.particles.splice(i, 1); // Remove partícula morta
    }
    // Reduz o tempo de tremor da tela
    if (g.shakeTime > 0) g.shakeTime = Math.max(0, g.shakeTime - dt);

    // Movel os carros adversários (NPCs) ao longo da curva oval
    for (let i = 0; i < g.npcs.length; i++) {
      const n = g.npcs[i];
      n.theta += n.w * dt;
      const rx = TRACK_INNER_X + n.t * (TRACK_OUTER_X - TRACK_INNER_X);
      const ry = TRACK_INNER_Y + n.t * (TRACK_OUTER_Y - TRACK_INNER_Y);
      n.x = Math.cos(n.theta) * rx;
      n.y = Math.sin(n.theta) * ry;
      // Calcula a rotação correta do carrinho acompanhando a curva da pista
      const dx = -Math.sin(n.theta) * rx * sign(n.w);
      const dy = Math.cos(n.theta) * ry * sign(n.w);
      n.angle = Math.atan2(dy, dx);
    }

    // Define se o volante usará o sensor de inclinação ou os botões da tela
    const steer = g.hasTiltData ? g.tiltSteerRaw * (g.invertSteer ? -1 : 1) : g.touchSteer;
    g.steerDisplay = steer;

    // Se estiver no meio da partida
    if (g.screen === 'playing') {
      g.elapsed += dt; // Incrementa o tempo de jogo
      // Aumenta gradualmente a velocidade máxima conforme o tempo passa
      const rampT = clamp(g.elapsed / SPEED_RAMP_TIME, 0, 1);
      const targetSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * rampT;
      // Vira o ângulo do carro do jogador
      g.player.angle += steer * TURN_RATE * dt;
     
      // Checa se o jogador está dentro dos limites do asfalto
      const rOuter = Math.hypot(g.player.x / TRACK_OUTER_X, g.player.y / TRACK_OUTER_Y);
      const rInner = Math.hypot(g.player.x / TRACK_INNER_X, g.player.y / TRACK_INNER_Y);
      const onTrack = rOuter <= 1.08 && rInner >= 0.92;
     
      // Se sair para a grama, reduz a velocidade pela metade
      g.player.speed = targetSpeed * (onTrack ? 1 : 0.55);
      // Move o jogador para frente com base no ângulo atual
      g.player.x += Math.cos(g.player.angle) * g.player.speed * dt;
      g.player.y += Math.sin(g.player.angle) * g.player.speed * dt;
      // Faz a câmera seguir o jogador suavemente
      g.camera.x += (g.player.x - g.camera.x) * 0.12;
      g.camera.y += (g.player.y - g.camera.y) * 0.12;

      // Teste de colisão entre o Jogador e cada um dos Adversários
      for (let j = 0; j < g.npcs.length; j++) {
        const m = g.npcs[j];
        const d = Math.hypot(g.player.x - m.x, g.player.y - m.y); // Calcula a distância entre eles
        if (d < (PLAYER_RADIUS + NPC_RADIUS) * 0.82) { // Se a distância for menor que a soma dos raios -> Batida!
          triggerGameOver((g.player.x + m.x) / 2, (g.player.y + m.y) / 2);
          break;
        }
      }
    } else if (g.screen === 'start') {
      // Movimento suave de câmera no menu inicial
      g.camera.x += (0 - g.camera.x) * 0.01;
      g.camera.y += (-260 - g.camera.y) * 0.01;
    }
  };

  // Hook que inicia o Game Loop assim que o componente entra na tela
  useEffect(() => {
    let raf;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      // Calcula o intervalo de tempo delta (dt) entre quadros
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      update(dt); // Atualiza lógica do jogo
      forceRender((f) => f + 1); // Redesenha a tela
      raf = requestAnimationFrame(loop); // Pede o próximo quadro
    };
    raf = requestAnimationFrame(loop);
    // Limpeza ao fechar o componente: cancela o loop e remove listeners
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (motionSub.current) {
        motionSub.current.remove();
        motionSub.current = null;
      }
    };
  }, []);

  // Funções para registrar os toques nos botões da tela
  const setTouchLeft = (down) => {
    stateRef.current.touchSteer = down ? -1 : stateRef.current.touchSteer === -1 ? 0 : stateRef.current.touchSteer;
  };
  const setTouchRight = (down) => {
    stateRef.current.touchSteer = down ? 1 : stateRef.current.touchSteer === 1 ? 0 : stateRef.current.touchSteer;
  };

  const g = stateRef.current;
  // Calcula a rotação da ponteira do indicador de direção
  const needleDeg = (g.steerDisplay || 0) * 48;
  // Calcula o efeito de tremer a tela
  const shakeMag = g.shakeTime > 0 ? (g.shakeTime / 0.35) * 9 : 0;
  const shakeX = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
  const shakeY = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
  // Matriz de transformação para posicionar o mundo do jogo relativo à câmera
  const worldTransform = [
    { translateX: winW / 2 - g.camera.x + shakeX },
    { translateY: winH / 2 - g.camera.y + shakeY },
  ];
  const trackMidX = (TRACK_OUTER_X + TRACK_INNER_X) / 2;
  const trackMidY = (TRACK_OUTER_Y + TRACK_INNER_Y) / 2;

  return (
    <View style={styles.container}>
      {/* CANVAS SKIA: Área principal onde todo o gráfico do jogo é pintado */}
      <Canvas style={{ width: winW, height: winH }}>
        {/* Fundo de Grama */}
        <Fill color={COLOR_GRASS} />
        <Group transform={worldTransform}>
          {/* Asfalto Externo da Pista */}
          <Oval x={-TRACK_OUTER_X} y={-TRACK_OUTER_Y} width={TRACK_OUTER_X * 2} height={TRACK_OUTER_Y * 2} color={COLOR_ASPHALT} />
          {/* Canteiro Central (Grama Interna) */}
          <Oval x={-TRACK_INNER_X} y={-TRACK_INNER_Y} width={TRACK_INNER_X * 2} height={TRACK_INNER_Y * 2} color={COLOR_GRASS} />
          {/* Zebras/Bordas Externa e Interna */}
          <Oval x={-TRACK_OUTER_X} y={-TRACK_OUTER_Y} width={TRACK_OUTER_X * 2} height={TRACK_OUTER_Y * 2} style="stroke" strokeWidth={6} color={COLOR_EDGE} />
          <Oval x={-TRACK_INNER_X} y={-TRACK_INNER_Y} width={TRACK_INNER_X * 2} height={TRACK_INNER_Y * 2} style="stroke" strokeWidth={6} color={COLOR_EDGE} />
          {/* Linha Tracejada Amarela no Meio da Pista */}
          <Oval x={-trackMidX} y={-trackMidY} width={trackMidX * 2} height={trackMidY * 2} style="stroke" strokeWidth={4} color={COLOR_AMBER}>
            <DashPathEffect intervals={[22, 22]} />
          </Oval>
          {/* Renderiza os quadriculados da Linha de Chegada */}
          {START_LINE.map((seg, i) => (
            <Rect key={'sl' + i} x={-8} y={seg.y} width={16} height={seg.h} color={seg.color} />
          ))}
          {/* Renderiza as árvores e arbustos de decoração */}
          {PROPS.map((p, i) => (
            <Group key={'prop' + i}>
              <Oval x={p.x - p.r * 0.9} y={p.y + p.r * 0.5 - p.r * 0.35} width={p.r * 1.8} height={p.r * 0.7} color="rgba(0,0,0,0.18)" />
              {!p.bush && <Rect x={p.x - 2} y={p.y - 2} width={4} height={p.r * 0.6} color="#6b4423" />}
              <Circle cx={p.x} cy={p.y - (p.bush ? 0 : p.r * 0.3)} r={p.r * (p.bush ? 0.7 : 0.55)} color={p.bush ? '#3f8a3f' : '#2f7a3a'} />
            </Group>
          ))}
          {/* Renderiza os carros adversários */}
          {g.npcs.map((n, i) => (
            <CarShape key={'npc' + i} x={n.x} y={n.y} angle={n.angle} len={NPC_LEN} wid={NPC_WID} color={n.color} isPlayer={false} />
          ))}
          {/* Renderiza o carro do Jogador */}
          <CarShape x={g.player.x} y={g.player.y} angle={g.player.angle} len={PLAYER_LEN} wid={PLAYER_WID} color={COLOR_CYAN} isPlayer />
          {/* Renderiza as faíscas da batida */}
          {g.particles.map((p, i) => (
            <Group key={'part' + i} opacity={Math.max(0, p.life / p.maxLife)}>
              <Rect x={p.x - 3} y={p.y - 3} width={6} height={6} color={p.color} />
            </Group>
          ))}
        </Group>
      </Canvas>

      {/* INTERFACE HUD (Exibida durante a corrida) */}
      {screen === 'playing' && (
        <>
          {/* Painel com Cronômetro */}
          <View pointerEvents="none" style={[styles.hudTimerWrap, { top: insets.top + 16 }]}>
            <View style={styles.hudTimerPill}>
              <Text style={styles.hudLabel}>Tempo</Text>
              <Text style={styles.hudTimerValue}>{formatTime(g.elapsed)}</Text>
            </View>
          </View>
          {/* Mostrador analógico do volante/inclinação */}
          <View pointerEvents="none" style={[styles.gaugeWrap, { bottom: insets.bottom + 22 }]}>
            <View style={styles.gauge}>
              <View style={styles.gaugePivot}>
                <View style={[styles.gaugeNeedle, { transform: [{ rotate: needleDeg + 'deg' }] }]} />
              </View>
            </View>
          </View>
          {/* Botões de toque para a esquerda e direita */}
          <TouchableOpacity activeOpacity={0.6} style={[styles.tbtn, styles.tbtnLeft, { bottom: insets.bottom + 20 }]} onPressIn={() => setTouchLeft(true)} onPressOut={() => setTouchLeft(false)}>
            <Text style={styles.tbtnText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6} style={[styles.tbtn, styles.tbtnRight, { bottom: insets.bottom + 20 }]} onPressIn={() => setTouchRight(true)} onPressOut={() => setTouchRight(false)}>
            <Text style={styles.tbtnText}>▶</Text>
          </TouchableOpacity>
        </>
      )}

      {/* TELA INICIAL (MENU DE INÍCIO) */}
      {screen === 'start' && (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>🏁 Corrida Turbo</Text>
            <Text style={styles.h1}>Sinta a pista.{'\n'}Incline pra virar.</Text>
            <Text style={styles.sub}>Segure o celular na horizontal e incline para a esquerda ou direita pra guiar o carro. Desvie do tráfego.</Text>
            {/* Opção para inverter os controles */}
            <TouchableOpacity style={styles.invertRow} activeOpacity={0.7} onPress={() => setInvertChecked((v) => !v)}>
              <View style={[styles.checkbox, invertChecked && styles.checkboxChecked]}>{invertChecked && <Text style={styles.checkboxMark}>✓</Text>}</View>
              <Text style={styles.invertLabel}>Inverter direção do sensor</Text>
            </TouchableOpacity>
            {/* Botão para iniciar o jogo */}
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={handlePlayPress}>
              <Text style={styles.btnPrimaryText}>▶ Jogar</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Sem sensor? Use os botões ◀ ▶ na tela.</Text>
          </View>
        </View>
      )}

      {/* TELA DE SOLICITAÇÃO DE PERMISSÃO (EXCLUSIVA iOS) */}
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

      {/* TELA DE FIM DE JOGO (GAME OVER) */}
      {screen === 'gameover' && (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={[styles.eyebrow, styles.eyebrowCrash]}>💥 Batida!</Text>
            <Text style={styles.h2}>Fim de jogo</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}><Text style={styles.statLabel}>Tempo</Text><Text style={styles.statValue}>{finalTimeText}</Text></View>
              <View style={styles.statBlock}><Text style={styles.statLabel}>Melhor</Text><Text style={styles.statValue}>{bestTimeText}</Text></View>
            </View>
            {/* Botão de reiniciar/renascer */}
            <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85} onPress={handleRespawnPress}>
              <Text style={styles.btnPrimaryText}>🔄 Renascer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

/* ============ ESTILOS DA INTERFACE (CSS-in-JS) ============ */
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
