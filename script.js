// Transparent placeholder image to avoid broken icons
export const EMPTY_SRC = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
import {
  getItem,
  setItem,
  removeItem,
  getNextWarriorName,
  ensureUniqueHeroName,
  createHero,
  getHeroById,
  isBusy,
  rebuildHeroMap,
  renderMissions,
  renderVillage,
  renderTerrains,
  preloadAudio,
  playSound,
  unloadAllAudio,
  onVisibilityChanged,
  createPomodoroHowl,
  pomodoroHowls,
  soundVolume,
  setSoundVolume,
  missionDescriptions,
  missionExpRewards,
  missionEnergyCost,
  missionDuration,
  formatMissionTime,
  isMinigameActive,
  minigameOpened,
  minigameClosed,
  initMinigameControl,
  createPool,
  getHowler,
  startLoop,
  stopLoop,
  state,
  BUILD_WOOD_COST,
  BUILD_STONE_COST,
  BUILD_ENERGY_COST,
  MAX_HOUSES,
  extraHouses,
  getTerrainCost,
  recalcMaxHouses,
  setExtraHouses,
  MAX_FOOD,
  MAX_WOOD,
  MAX_STONE,
  setMaxFood,
  setMaxWood,
  setMaxStone,
  appendOverlay,
  removeOverlay,
  renderDailyMissionDay,
  renderDailyMissions,
  getWeekKey,
  getDailyMissionSlot,
  lru,
  SEX,
  SEX_ICON,
  SEX_CLASS,
  initSpecialBuilderAssignment,
  renderSection,
  openHeroPicker,
  assignHeroToSlot,
  cancelAssignment,
  openImproveModal,
  confirmImprove,
  levelUp
} from "./src/index.js";
import { startGame, endGame, setProgressCallback, pauseGame, resumeGame } from "./minigames/framework.js";
import { createPlaceholderGame } from "./minigames/placeholder.js";
import { resizeImageToBase64 } from "./renderer/utils/imageResizer.js";
import { openConfirm } from './ui/modals.js';
import { isSectionVisible, showHeroSelector } from "./ui/villageControls.js";
import { UI_PERF_FLAG, initUIPerf } from './performance/uiPerf.js';
export {
  money,
  food,
  wood,
  stone,
  houses,
  terrain,
  autoClickActive,
  companions,
  farmers,
  lumberjacks,
  miners,
  buildingTask,
  upgradeTasks,
  buildingLevels,
  buildSelectionOpen,
  heroes,
  heroMap,
  missions,
  MAX_TERRAIN
} from "./src/state.js";

export const professionIcons = {
  Warrior: '⚔️',
  Archer: '🏹',
  Ninja: '🥷',
  Summoner: '🔮',
  Mage: '✨',
  Healer: '💖',
  Monk: '🧘',
  Tank: '🪖',
  Buffer: '📯',
  Thief: '🦹',
  Miner: '⛏️',
  Lumberjack: '🌲',
  Farmer: '🌾',
  Builder: '🧱',
  Merchant: '💰',
  Entertainer: '🎭',
  Leader: '👑',
  Paladin: '✝️',
  Berserker: '😡',
  Necromancer: '☠️',
  Alchemist: '⚗️',
  Chef: '👨‍🍳',
  Fisher: '🎣',
  Blacksmith: '🔨',
  Tamer: '🐕‍🦺',
  Diplomat: '🤝',
  Scholar: '📚',
  Spy: '🕵️‍♂️',
  Druid: '🌿',
  Brawler: '🥊',
  CareTaker: '🐑',
  Vanguard: '🗡️',
  Strategist: '🧠',
  Explorer: '🧗‍♂️',
  Lider: '👑'
};

let ipcRenderer = null;
try {
  ipcRenderer = window.electronAPI;
} catch {}

if (typeof localStorage === 'undefined') {
  global.localStorage = { getItem() { return null; }, setItem() {} };
}

if (localStorage.getItem('imported') === 'true') {
  localStorage.removeItem('imported');
  location.reload();
}

// unique id for websocket progress tracking
const CLIENT_ID_KEY = 'clientId';
let clientId = localStorage.getItem(CLIENT_ID_KEY);
if (!clientId) {
  clientId = Math.random().toString(36).slice(2);
  localStorage.setItem(CLIENT_ID_KEY, clientId);
}

export const perfOptimizations = true;
window.perfOptimizations = perfOptimizations;

if (UI_PERF_FLAG) initUIPerf();


// helper to avoid running animations when the tab is hidden
export function rAF(fn) {
  if (document.hidden) {
    return setTimeout(() => fn(performance.now()), 100);
  }
  return requestAnimationFrame(fn);
}

export function chunk(items, fn, budgetMs = 8) {
  let i = 0;
  function frame() {
    const end = performance.now() + budgetMs;
    while (i < items.length && performance.now() < end) fn(items[i++]);
    if (i < items.length) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function resolveSrc(path) {
  if (!path) return '';
  try {
    return new URL(path, import.meta.url).href;
  } catch {
    return path;
  }
}

export const SAVE_VERSION = 4;

// La inicialización de groupMissions se hará en initializeStateData()

function renderHeroesIfVisible() {
  if (isSectionVisible('heroes-section')) {
    scheduleRenderHeroes();
  }
}

let renderHeroesRaf = null;
export function scheduleRenderHeroes() {
  if (renderHeroesRaf !== null) return;
  renderHeroesRaf = requestAnimationFrame(() => {
    renderHeroesRaf = null;
    renderHeroes();
  });
}

export function cancelScheduledRenderHeroes() {
  if (renderHeroesRaf !== null) {
    cancelAnimationFrame(renderHeroesRaf);
    renderHeroesRaf = null;
  }
}



function renderVillageChiefIfVisible() {
  if (isSectionVisible('village-section')) {
    renderVillageChief();
  }
}

let lastVillageState = { terrain: -1, houses: -1, upgrades: '', food: -1, wood: -1, stone: -1 };
let villageRenderPending = false;

function renderVillageIfVisible() {
  if (isSectionVisible('village-section')) {
    const upgradeState = Object.entries(state.upgradeTasks)
      .map(([k, v]) => `${k}:${v.time}`)
      .join('|');
    if (
      state.terrain !== lastVillageState.terrain ||
      state.houses !== lastVillageState.houses ||
      upgradeState !== lastVillageState.upgrades ||
      state.food !== lastVillageState.food ||
      state.wood !== lastVillageState.wood ||
      state.stone !== lastVillageState.stone
    ) {
      lastVillageState = { terrain: state.terrain, houses: state.houses, upgrades: upgradeState, food: state.food, wood: state.wood, stone: state.stone };
      if (!villageRenderPending) {
        villageRenderPending = true;
        requestIdleCallback(() => {
          renderVillage();
          villageRenderPending = false;
        });
      }
    }
  }
}

function renderTerrainsIfVisible() {
  if (isSectionVisible('terrain-section')) {
    renderTerrains();
  }
}

let socket = null;
function connectSocket() {
  if (location.protocol === 'file:' && !location.host) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.host || 'localhost:8080';
  socket = new WebSocket(`${proto}://${host}/ws`);
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'hello', id: clientId }));
  });
  socket.addEventListener('message', e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'progress') {
        console.log('Progress loaded', msg.progress);
      }
    } catch {}
  });
}

// Estado inicial de la partida
let citizens = 0;
let soldiers = 0;
let summonCost = 100;
let lockPartnerImage = false;
function getTodayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}
const getToday = getTodayKey;
let fortuneDay = "";
let fortuneLastPrize = "";
let bossRushDay = getToday();
let bossRushCount = 0;
let enemyDay = getToday();
let enemyCount = 0;
let chiefSurvivalDay = getToday();
let chiefSurvivalWins = 0;
let giantBossLevel = 1;
let lifeTasksDay = getToday();
let lifeTasks = Array.from({ length: 9 }, () => ({ text: "", difficulty: "", completed: false }));
let lifeOtherText = "";
let lifeGoldDay = getToday();
let lifeGold = 0;
let habitsData = {};
let habitsMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
let habitsMaxMonth = (()=>{ const d=new Date(); d.setMonth(d.getMonth()+12); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
let habitsCardEl = null;
let habitsLastProcessed = getToday();
let dailyPomodoros = 0;
let dailyMeditations = 0;
let currentChiefExtra = "";
let saveTimeout = null;
const TIME_MULTIPLIER = 3;
const AUTOCLICK_INTERVAL_MS = 60_000;     // 1 minute
const AUTOCLICK_PRODUCE = 20;             // units per cycle
const AUTOCLICK_ENERGY_COST = 20;         // % per cycle
const REST_INTERVAL_MS = 60_000;          // 1 minute
const REST_ENERGY_GAIN = 10;              // % per cycle
const HEROES_PER_PAGE = 8;
const PETS_PER_PAGE = 8;
const FAMILIAR_COUNT = 100;
const HABILITY_COUNT = 100;
const PARTNER_ABILITY_COUNT = 100;
const ABILITY_STEP_COUNT = 3;
const PET_RESOURCE_INTERVAL = 60 * 1000; // 1 minute
// Allow pets to accumulate up to 10 resources before collection
const PET_MAX_PENDING = 10;
const PET_RESOURCE_ICONS = { food: '🥔', wood: '🪵', stone: '🪨', gold: '💰' };
const PET_RESOURCE_TYPES = Object.keys(PET_RESOURCE_ICONS);
let unlockedFamiliars = 3;
let unlockedHabilities = 3;
let unlockedPartnerAbilities = 3;
const PROFESSION_LIMIT = 5;
const PROFESSION_MAX = 5;
const PROFESSION_REMOVE_COST = 300;
function randomPetResource() {
  return PET_RESOURCE_TYPES[Math.floor(Math.random() * PET_RESOURCE_TYPES.length)];
}
function recalcSummonCost() {
  summonCost = (state.heroes.length + 1) * 100;
}
let chiefFamiliarSort = 'number';
let chiefHabilitySort = 'number';
let partnerAbilitySort = 'number';
let currentSilenceFam = null;
let currentSilenceAbility = null;
let currentPomodoroAbility = null;
let currentPomodoroMinutes = 25;
let silenceMsgHandler = null;
let pomodoroMsgHandler = null;
let pomodoroLevelSound = null;
async function playPomodoroLevelSound() {
  const Howler = await getHowler();
  if (Howler?.ctx?.state === 'suspended') {
    try { await Howler.ctx.resume(); } catch {}
  }
  if (!pomodoroLevelSound) {
    try {
      pomodoroLevelSound = await createPomodoroHowl({ src: ['src/VictorySound.mp3'], html5: true });
    } catch {}
  } else {
    pomodoroHowls.add(pomodoroLevelSound);
  }
  try {
    pomodoroLevelSound.once('end', () => pomodoroHowls.delete(pomodoroLevelSound));
    pomodoroLevelSound.play();
  } catch {}
}

export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
}

export function showBreakNotification(currentTask = '') {
  if (!('Notification' in window)) return;
  const title = 'Time for a break!';
  const body = currentTask ? `Task: ${currentTask}` : 'Great job — take 5 minutes.';
  const icon = 'assets/favicon_16x16.png';
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon, silent: true }); } catch {}
  } else {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', text: `${title} ${body}` }}));
  }
  try {
    const audio = new Audio('src/VictorySound.mp3');
    audio.play().catch(() => {});
  } catch {}
}
const CHIEF_ITEMS_PER_PAGE = 4;
const CHIEF_MAX_PAGES = 25;
const PARTNER_ITEMS_PER_PAGE = 4;
const PARTNER_MAX_PAGES = 25;
let MAX_PETS = 5;
let profilePublic = false;
export { MAX_PETS };
const BUILDING_IMAGES = {
  Tower: "src/Buildings/Tower.png",
  Castle: "src/Buildings/Castle.png",
  Dungeons: "src/Buildings/Dungeon.png",
  Pantry: "src/Buildings/FoodStorage.png",
  Lumberyard: "src/Buildings/WoodStorage.png",
  Quarry: "src/Buildings/StoneStorage.png",
  Gym: "src/Buildings/Gym.png",
  ArcheryField: "src/Buildings/ArcheryField.png",
  MageAcademy: "src/Buildings/MageAcademy.png",
  BoxingRing: "src/Buildings/BoxingRing.png",
  LifeAltar: "src/Buildings/LifeAltar.png",
  FortuneTotem: "src/Buildings/FortuneTotem.png",
  PetSanctuary: "src/Buildings/PetSanctuary.png",
  Hospital: "src/Buildings/Hospital.png",
  Ashram: "src/Buildings/Ashram.png",
};
// Mapping of minigame names to their HTML sources
export const GAME_SOURCES = {
  PetExploration: "src/OtherMinigames/PetExploration.html",
  ChiefSurvival: "src/OtherMinigames/ChiefSurvival.html",
  Projects: "projects.html",
  FightIntruders: "src/OtherMinigames/FightIntruders.html",
};

// Extra assets each minigame requires
export const GAME_ASSETS = {};

const UPGRADE_HERO_COUNTS = {
  Gym: 4,
  ArcheryField: 4,
  MageAcademy: 4,
  BoxingRing: 4,
  FortuneTotem: 1,
  LifeAltar: 1,
  Hospital: 4,
  Ashram: 3,
  Castle: 12,
  Dungeons: 2,
  Pantry: 4,       // FoodStorage
  PetSanctuary: 3,
  Quarry: 4,       // StoneStorage
  Tower: 6,
  Lumberyard: 4,   // WoodStorage
  House: 3,
};
const UPGRADE_TIMES = {
  House: 300,
  PetSanctuary: 600,
  Pantry: 180,
  Lumberyard: 180,
  Quarry: 180,
  Gym: 240,
  ArcheryField: 240,
  MageAcademy: 240,
  BoxingRing: 240,
  Ashram: 240,
  LifeAltar: 240,
  FortuneTotem: 240,
  Tower: 1200,
  Castle: 1800,
  Dungeons: 900,
  Hospital: 900,
};
let currentHeroPage = 1;
let heroSort = "name";
let heroSortAsc = true;
let heroFilterOrigin = null;
let heroFilterProfession = null;
let heroFilterFavorites = false;
let heroFilterReady = false;
let heroFilterSex = null;
let heroFilterSearch = null;
let currentPetPage = 1;
let petSort = "name";
let petSortAsc = true;
let petFilterOrigin = null;
let petFilterFavorites = false;
let petFilterSearch = null;
let MAX_LEVEL = 10;
let CHIEF_MAX_LEVEL = 20;
let PARTNER_MAX_LEVEL = 20;
let castleLevelFixApplied = false;
let MAX_STATS = {
  fuerza: 5,
  destreza: 5,
  inteligencia: 5,
  defensa: 5,
  vida: 5,
  mana: 5,
  suerte: 5,
};
let CHIEF_MAX_STATS = {
  fuerza: 15,
  destreza: 15,
  inteligencia: 15,
  defensa: 15,
  vida: 15,
  mana: 15,
  suerte: 15,
};
const PARTNER_MAX_STAT = 15;
let PARTNER_MAX_STATS = {
  fuerza: PARTNER_MAX_STAT,
  destreza: PARTNER_MAX_STAT,
  inteligencia: PARTNER_MAX_STAT,
  defensa: PARTNER_MAX_STAT,
  vida: PARTNER_MAX_STAT,
  mana: PARTNER_MAX_STAT,
  suerte: PARTNER_MAX_STAT,
};

export function updateMaxLevelsFromCastle() {
  const castleLevel = state.buildingLevels?.Castle || 0;
  MAX_LEVEL = 10 + 5 * castleLevel;
  CHIEF_MAX_LEVEL = 20 + 10 * castleLevel;
  PARTNER_MAX_LEVEL = 20 + 10 * castleLevel;
}
const bossStats = {
  fuerza: 1,
  suerte: 1,
  inteligencia: 1,
  destreza: 1,
  defensa: 1,
  vida: 1,
  mana: 1,
};
const partnerStats = {
  fuerza: 1,
  suerte: 1,
  inteligencia: 1,
  destreza: 1,
  defensa: 1,
  vida: 1,
  mana: 1,
};
let nextLevelExpTable = {};
let acumulatedExpTable = {};

async function loadExpTables() {
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs/promises');
      const next = await fs.readFile(new URL('./NextLevelExpTable.json', import.meta.url), 'utf8');
      nextLevelExpTable = JSON.parse(next);
      const acum = await fs.readFile(new URL('./AcumulatedLevelExpTable.json', import.meta.url), 'utf8');
      acumulatedExpTable = JSON.parse(acum);
    } catch (err) {
      console.error('Failed to load exp tables', err);
    }
  } else {
    try {
      nextLevelExpTable = await fetch('NextLevelExpTable.json').then(r => r.json());
      acumulatedExpTable = await fetch('AcumulatedLevelExpTable.json').then(r => r.json());
    } catch (err) {
      console.error('Failed to load exp tables', err);
    }
  }
}
const restingHeroes = new Set();
const restDomQueue = [];
let restDomRaf = null;
function flushRestDomUpdates() {
  restDomQueue.forEach(({ hero, energyText, timerText }) => {
    if (hero.energyEl && hero.energyEl.offsetParent !== null) {
      hero.energyEl.textContent = energyText;
    }
    if (hero.lowEnergyEl && hero.lowEnergyEl.offsetParent !== null) {
      hero.lowEnergyEl.textContent = hero.energia <= 20 ? "Low energy!" : "";
    }
    if (hero.restTimerEl && hero.restTimerEl.offsetParent !== null) {
      hero.restTimerEl.textContent = timerText;
    }
  });
  restDomQueue.length = 0;
  restDomRaf = null;
}
function queueRestDomUpdate(hero, energyText, timerText) {
  restDomQueue.push({ hero, energyText, timerText });
  if (!restDomRaf) {
    restDomRaf = requestAnimationFrame(flushRestDomUpdates);
  }
}

// --- General DOM text batching for timers ---
const timerDomQueue = [];
let timerDomRaf = null;
function flushTimerDom() {
  timerDomQueue.forEach(({ el, text }) => {
    if (el && el.offsetParent !== null) {
      el.textContent = text;
    }
  });
  timerDomQueue.length = 0;
  timerDomRaf = null;
}
function queueTimerText(el, text) {
  if (!el) return;
  timerDomQueue.push({ el, text });
  if (!timerDomRaf) {
    timerDomRaf = requestAnimationFrame(flushTimerDom);
  }
}

const buildTimerEls = { main: null, select: null, inline: null };
const upgradeTimerRefs = new Map();
let villageChief = {
  name: "Village Chief",
  avatar: "",
  avatarOffset: 50,
  avatarOffsetX: 50,
  level: 1,
  exp: 0,
  hpPotions: 10,
  manaPotions: 10,
  energyPotions: 10,
  expPotions: 10,
  familiars: Array.from({ length: FAMILIAR_COUNT }, (_, i) => ({
    name: `No name${i + 1}`,
    img: "",
    imgOffset: 50,
    imgOffsetX: 50,
    level: 1,
    desc: "",
    modified: Date.now(),
    firstModified: Date.now(),
    number: i + 1
  })),
  habilities: Array.from({ length: HABILITY_COUNT }, (_, i) => ({
    name: `No name${i + 1}`,
    img: "",
    imgOffset: 50,
    imgOffsetX: 50,
    level: 1,
    desc: "",
    modified: Date.now(),
    firstModified: Date.now(),
    number: i + 1
  }))
  ,
  // partnerAbilities: Array.from({ length: PARTNER_ABILITY_COUNT }, (_, i) => ({
  //   name: `No name${i + 1}`,
  //   img: "",
  //   imgOffset: 50,
  //   imgOffsetX: 50,
  //   level: 1,
  //   desc: "",
  //   modified: Date.now(),
  //   firstModified: Date.now(),
  //   number: i + 1
  // })),
  unlockedFamiliars: 3,
  unlockedHabilities: 3
  // unlockedPartnerAbilities: 3
};
// Solo definir la propiedad si no existe para evitar errores en producción
if (!window.hasOwnProperty('villageChief')) {
  Object.defineProperty(window, 'villageChief', {
    get: () => villageChief,
    set: v => { villageChief = v; },
    configurable: true
  });
}
let partner = {
  name: "Partner",
  img: "",
  imgOffset: 50,
  imgOffsetX: 50,
  level: 1,
  exp: 0,
  energia: 100,
  hpPotions: 0,
  manaPotions: 0,
  energyPotions: 0,
  expPotions: 0
};
// Solo definir la propiedad si no existe para evitar errores en producción
if (!window.hasOwnProperty('partner')) {
  Object.defineProperty(window, 'partner', {
    get: () => partner,
    set: v => { partner = v; },
    configurable: true
  });
}
let currentPetHero = null;
const UPGRADE_TIME = 180; // 3 minutes
// La inicialización de state.upgradeTasks y state.buildingLevels se hará en initializeStateData()

// Offload construction timers to a dedicated worker
const constructionWorker = new Worker(new URL('./constructionWorker.js', import.meta.url));
constructionWorker.onmessage = ({ data }) => {
  if (data.batch) {
    data.batch.forEach(handleConstructionUpdate);
  } else {
    handleConstructionUpdate(data);
  }
};

function handleConstructionUpdate({ idConstruccion, tiempoRestante, tipo, done }) {
  if (tipo === 'build') {
    const starting = state.buildingTask.time === 0 && tiempoRestante > 0;
    state.buildingTask.time = tiempoRestante;
    if (!state.buildingTask.heroes || state.buildingTask.heroes.every(h => !h)) {
      state.buildingTask.heroes = state.buildingTask.heroIds.map(id => state.heroMap.get(id));
    }
    state.buildingTask.heroes.forEach(h => {
      if (h) h.buildTime = tiempoRestante;
    });
    if (state.buildingTask.lastTimeShown !== tiempoRestante) {
      state.buildingTask.lastTimeShown = tiempoRestante;
      const text = formatTime(tiempoRestante);
      [buildTimerEls.main, buildTimerEls.select, buildTimerEls.inline].forEach(el => queueTimerText(el, text));
    }
    const selectCard = document.getElementById('build-select-card');
    if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === 'none')) {
      showInlineBuildTimer();
    }
    if (starting || done) updateBuildButtonHeight();
    if (done) {
      scheduleSaveGame();
      buildHouse();
    }
  } else if (tipo === 'upgrade') {
    const task = state.upgradeTasks[idConstruccion];
    if (!task) return;
    const starting = task.time === 0 && tiempoRestante > 0;
    task.time = tiempoRestante;
    const ref = upgradeTimerRefs.get(idConstruccion);
    if (task.lastTimeShown !== tiempoRestante) {
      task.lastTimeShown = tiempoRestante;
      const text = formatTime(tiempoRestante);
      if (ref) [ref.main, ref.inline].forEach(el => queueTimerText(el, text));
    }
    if (!task.heroes || task.heroes.length === 0 || task.heroes.every(h => !h)) {
      task.heroes = task.heroIds.map(id => state.heroMap.get(id));
    }
    task.heroes.forEach(h => {
      if (h) h.buildTime = tiempoRestante;
    });
    const selectCard = document.getElementById('build-select-card');
    if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === 'none')) {
      showUpgradeInlineTimer(idConstruccion);
    }
    if (starting || done) updateBuildButtonHeight();
    if (done) {
      scheduleSaveGame();
      completeUpgrade(idConstruccion);
    }
  }
}
let buildSelectAvatars = [];
let buildSelectSelects = [];
let upgradePreviewLabel = null;
let upgradePreviewCount = 0;

function migrateSave(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid save');
  if (!data.version) data.version = 1;
  if (data.version < 2) {
    if (Array.isArray(data.heroes)) {
      data.heroes.forEach(h => {
        if (h.ability1LearnTime === undefined) h.ability1LearnTime = 0;
        if (h.ability2LearnTime === undefined) h.ability2LearnTime = 0;
        if (h.ability1Learned === undefined) h.ability1Learned = true;
        if (h.ability2Learned === undefined) h.ability2Learned = true;
      });
    }
    if (data.lifeGold === undefined) data.lifeGold = 0;
    if (data.lifeGoldDay === undefined) data.lifeGoldDay = getToday();
    if (!data.PARTNER_MAX_STATS) {
      data.PARTNER_MAX_STATS = { ...PARTNER_MAX_STATS };
    }
  }
  if (data.version < 3) {
    if (Array.isArray(data.heroes)) {
      data.heroes.forEach(h => {
        if (h && h.buildTime > 0 && (!h.state || h.state.type !== 'ready')) {
          h.buildTime = 0;
          h.state = { type: 'ready' };
        }
      });
    }
  }
  if (data.version < 4) {
    if (Array.isArray(data.heroes)) {
      data.heroes.forEach(h => {
        if (h && !h.sex) h.sex = SEX.NEUTRAL;
      });
    }
  }
  const maxPartnerLvl = data.PARTNER_MAX_LEVEL ?? PARTNER_MAX_LEVEL;
  if (data.partner && data.partner.level >= maxPartnerLvl) {
    data.partner.level = maxPartnerLvl;
    data.partner.exp = 0;
  }
  if (!data.buildingLevels) data.buildingLevels = {};
  if (data.MAX_PETS !== undefined) {
    const psLvl = data.MAX_PETS - 5;
    if (psLvl > 0 && (data.buildingLevels.PetSanctuary || 0) < psLvl) {
      data.buildingLevels.PetSanctuary = psLvl;
    }
  }
  if (data.buildingLevels.Tower === undefined) {
    data.buildingLevels.Tower = 0;
  }
  if (!Array.isArray(data.projects)) data.projects = [];
  if (data.projectPoints === undefined) data.projectPoints = 0;
  data.version = SAVE_VERSION;
  return data;
}

async function loadGame() {
  let data;
  try {
    data = ipcRenderer
      ? await ipcRenderer.invoke('get-game-state')
      : getItem('gameState');
  } catch (err) {
    console.error('Failed to load save', err);
    showAlert('Save file corrupted. Starting new game.');
    return;
  }
  if (!data) return;
  const migrated = data.version === undefined || data.version < SAVE_VERSION;
  try {
    data = migrateSave(data);
  } catch (err) {
    console.error('Migration failed', err);
    showAlert('Save file incompatible. Starting new game.');
    return;
  }
  castleLevelFixApplied = data.castleLevelFixApplied ?? false;
  try {
    localStorage.setItem('syw_points', String(data.projectPoints || 0));
    localStorage.setItem('syw_projects_v1', JSON.stringify(data.projects || []));
  } catch {}
  state.money = data.money ?? state.money;
  state.food = data.food ?? state.food;
  state.wood = data.wood ?? state.wood;
  state.stone = data.stone ?? state.stone;
  state.terrain = data.terrain ?? state.terrain;
  state.houses = data.houses ?? state.houses;
  recalcMaxHouses();
  if (state.houses > MAX_HOUSES) state.houses = MAX_HOUSES;
  citizens = data.citizens ?? citizens;
  soldiers = data.soldiers ?? soldiers;
  state.heroes = (data.heroes || []).filter(Boolean);
  scheduleRenderHeroes();
  // Removed lastsave.json loading - heroes are loaded from save.json only
  state.heroes = (state.heroes || []).filter(Boolean);
  let updatedSex = false;
  state.heroes.forEach(h => {
    if (!h.sex) {
      h.sex = SEX.NEUTRAL;
      updatedSex = true;
    }
    if (h.avatarOffset === undefined) h.avatarOffset = 50;
    if (h.secondImg === undefined) h.secondImg = "";
    if (h.secondOffset === undefined) h.secondOffset = 50;
    if (h.maxProfessions === undefined || h.maxProfessions < PROFESSION_LIMIT) h.maxProfessions = PROFESSION_LIMIT;
    if (h.missionStartTime === undefined) h.missionStartTime = Date.now();
    if (h.missionDuration === undefined) h.missionDuration = h.missionTime || 0;
    if (h.lastTimeShown === undefined) h.lastTimeShown = 0;
    if (h.restStartTime && h.restDuration) {
      const now = Date.now();
      const elapsedMs = now - h.restStartTime;
      const intervals = Math.floor(elapsedMs / REST_INTERVAL_MS);
      const recovered = Math.min(100 - h.energia, intervals * REST_ENERGY_GAIN);
      h.energia += recovered;
      const remaining = h.restDuration - intervals;
      const remainderMs = elapsedMs % REST_INTERVAL_MS;
      if (remaining > 0 && h.energia < 100) {
        h.restDuration = remaining;
        h.restTime = remaining;
        h.restStartTime = now - remainderMs;
        h.lastRestTick = now - remainderMs;
        h.lastEnergyShown = h.energia;
        h.lastTimeShown = h.restTime;
        restingHeroes.add(h);
        removeTimer(`rest_${h.id}`);
        addTimer({
          id: `rest_${h.id}`,
          type: 'rest',
          heroId: h.id,
          startTime: now - remainderMs,
          lastTick: now - remainderMs,
          duration: remaining * REST_INTERVAL_MS,
          interval: REST_INTERVAL_MS,
          paused: false,
          completed: false,
        });
      } else {
        h.restDuration = 0;
        h.restTime = 0;
        h.restStartTime = 0;
        h.lastRestTick = 0;
      }
    } else {
      h.restTime = 0;
    }
    if (h.missionTime <= 0) {
      h.missionStartTime = 0;
      h.missionDuration = 0;
      h.state = { type: 'ready' };
    }
  });
  rebuildHeroMap();
  recalcSummonCost();
  scheduleRenderHeroes();
  if (updatedSex) saveGame();
  if (data.missions) {
    state.missions.length = 0;
    state.missions.push(...data.missions);
    if (state.missions.length < missionExpRewards.length) {
      for (let i = state.missions.length; i < missionExpRewards.length; i++) {
        state.missions.push({
          id: i + 1,
          heroId: null,
          pendingHeroId: null,
          completed: false,
          expReward: missionExpRewards[i],
          description: missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)]
        });
      }
    }
  }
  state.missions.forEach(m => {
    if (m.pendingHeroId === undefined) m.pendingHeroId = null;
    if (!m.description)
      m.description =
        missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)];
    m.expReward = missionExpRewards[m.id - 1] || m.expReward || 20;
    
    // Migración: detectar misiones del sistema antiguo sin timestamps
    if (m.heroId && !m.startedAt && !m.endAt && !m.durationMs) {
      const hero = state.heroes.find(h => h.id === m.heroId);
      if (hero) {
        // Si el héroe tiene missionTime = 0, la misión ya completó
        if (hero.missionTime === 0 || hero.missionTime === undefined) {
          console.log(`🔧 Migración: Misión ${m.id} completada (sistema antiguo) - Héroe: ${hero.name}`);
          m.status = 'completed';
          m.completed = true;
          m.rewardApplied = false;
          hero.missionTime = 0;
          hero.missionStartTime = 0;
          hero.missionDuration = 0;
        } else {
          // Si tiene missionTime > 0, intentar recuperar la información
          console.log(`🔧 Migración: Misión ${m.id} en curso (sistema antiguo) - Héroe: ${hero.name}, tiempo restante: ${hero.missionTime}s`);
          const now = Date.now();
          const remainingMs = hero.missionTime * 1000;
          const endTime = now + remainingMs;
          const startTime = hero.missionStartTime || (now - (hero.missionDuration - hero.missionTime) * 1000);
          
          m.startedAt = new Date(startTime).toISOString();
          m.endAt = new Date(endTime).toISOString();
          m.durationMs = hero.missionDuration * 1000;
          m.status = 'running';
        }
      } else {
        // No hay héroe, limpiar la misión
        console.log(`⚠️ Migración: Misión ${m.id} limpiada (héroe no encontrado)`);
        m.heroId = null;
        m.completed = false;
        m.status = 'idle';
      }
    }
  });
  state.dailyMissions = data.dailyMissions ?? state.dailyMissions;
  state.groupMissions = (data.groupMissions || state.groupMissions || []).slice(0,4);
  while (state.groupMissions.length < 4) {
    const i = state.groupMissions.length;
    state.groupMissions.push({
      id: i + 1,
      title: `GroupMission${i + 1}`,
      description: null,
      heroIds: [null, null, null, null, null],
      status: 'idle',
      started: false,
      startAt: null,
      endAt: null,
      sameOriginBonus: false,
      rewardApplied: false
    });
  }
  // Limpiar timers obsoletos (ya no necesitamos timers para misiones)
  activeTimers = activeTimers.filter(t => {
    // Eliminar timers de misiones que ahora usan el modelo de Special Builder
    if (t.type === 'mission' || t.type === 'dailyMission') {
      return false; // Eliminar todos los timers de misiones del sistema antiguo
    }
    return true;
  });
  saveTimers();
  villageChief = data.villageChief ?? villageChief;
  if (villageChief.avatarOffset === undefined) villageChief.avatarOffset = 50;
  if (villageChief.avatarOffsetX === undefined) villageChief.avatarOffsetX = 50;
  if (!villageChief.name) villageChief.name = "Village Chief";
  if (villageChief.hpPotions === undefined) villageChief.hpPotions = 10;
  if (villageChief.manaPotions === undefined) villageChief.manaPotions = 10;
  if (villageChief.energyPotions === undefined) villageChief.energyPotions = 10;
  if (villageChief.expPotions === undefined) villageChief.expPotions = 10;
  if (!villageChief.familiars || !Array.isArray(villageChief.familiars)) {
    villageChief.familiars = Array.from({ length: FAMILIAR_COUNT }, (_, i) => ({
      name: `No name${i + 1}`,
      img: "",
      imgOffset: 50,
      imgOffsetX: 50,
      level: 1,
      stepImgs: [],
      activeStep: 0,
      desc: "",
      modified: Date.now()
    }));
  } else {
    for (let i = 0; i < FAMILIAR_COUNT; i++) {
      if (!villageChief.familiars[i]) {
        villageChief.familiars[i] = {
          name: `No name${i + 1}`,
          img: "",
          level: 1,
          desc: "",
          modified: Date.now()
        };
      } else {
        const f = villageChief.familiars[i];
        if (f.name === undefined) f.name = `No name${i + 1}`;
        if (f.img === undefined) f.img = "";
        if (f.imgOffset === undefined) f.imgOffset = 50;
        if (f.imgOffsetX === undefined) f.imgOffsetX = 50;
        if (f.level === undefined) f.level = 1;
        if (f.desc === undefined) f.desc = "";
        if (f.modified === undefined) f.modified = Date.now();
        if (f.firstModified === undefined) f.firstModified = f.modified;
        if (f.number === undefined) f.number = i + 1;
      }
    }
  }
  makeListNamesUnique(villageChief.familiars);
  if (!villageChief.habilities || !Array.isArray(villageChief.habilities)) {
    villageChief.habilities = Array.from({ length: HABILITY_COUNT }, (_, i) => ({
      name: `No name${i + 1}`,
      img: "",
      imgOffset: 50,
      imgOffsetX: 50,
      level: 1,
      stepImgs: [],
      activeStep: 0,
      desc: "",
      modified: Date.now()
    }));
  } else {
    for (let i = 0; i < HABILITY_COUNT; i++) {
      if (!villageChief.habilities[i]) {
        villageChief.habilities[i] = {
          name: `No name${i + 1}`,
          img: "",
          level: 1,
          desc: "",
          modified: Date.now()
        };
      } else {
        const h = villageChief.habilities[i];
        if (h.name === undefined) h.name = `No name${i + 1}`;
        if (h.img === undefined) h.img = "";
        if (h.imgOffset === undefined) h.imgOffset = 50;
        if (h.imgOffsetX === undefined) h.imgOffsetX = 50;
        if (h.level === undefined) h.level = 1;
        if (h.desc === undefined) h.desc = "";
        if (h.modified === undefined) h.modified = Date.now();
        if (h.firstModified === undefined) h.firstModified = h.modified;
        if (h.number === undefined) h.number = i + 1;
        if (h.stepImgs === undefined) h.stepImgs = [];
        if (h.activeStep === undefined) h.activeStep = 0;
      }
    }
  }
  makeListNamesUnique(villageChief.habilities);
  // if (!villageChief.partnerAbilities || !Array.isArray(villageChief.partnerAbilities)) {
  //   villageChief.partnerAbilities = Array.from({ length: PARTNER_ABILITY_COUNT }, (_, i) => ({
  //     name: `No name${i + 1}`,
  //     img: "",
  //     imgOffset: 50,
  //     imgOffsetX: 50,
  //     level: 1,
  //     desc: "",
  //     modified: Date.now()
  //   }));
  // } else {
  //   for (let i = 0; i < PARTNER_ABILITY_COUNT; i++) {
  //     if (!villageChief.partnerAbilities[i]) {
  //       villageChief.partnerAbilities[i] = {
  //         name: `No name${i + 1}`,
  //         img: "",
  //         level: 1,
  //         desc: "",
  //         modified: Date.now()
  //       };
  //     } else {
  //       const p = villageChief.partnerAbilities[i];
  //       if (p.name === undefined) p.name = `No name${i + 1}`;
  //       if (p.img === undefined) p.img = "";
  //       if (p.imgOffset === undefined) p.imgOffset = 50;
  //       if (p.imgOffsetX === undefined) p.imgOffsetX = 50;
  //       if (p.level === undefined) p.level = 1;
  //       if (p.desc === undefined) p.desc = "";
  //       if (p.modified === undefined) p.modified = Date.now();
  //       if (p.firstModified === undefined) p.firstModified = p.modified;
  //       if (p.number === undefined) p.number = i + 1;
  //       if (p.stepImgs === undefined) p.stepImgs = [];
  //       if (p.activeStep === undefined) p.activeStep = 0;
  //     }
  //   }
  // }
  // makeListNamesUnique(villageChief.partnerAbilities);
  state.companions = (data.companions ?? state.companions).concat(Array(8).fill(null)).slice(0, 8);
  state.farmers = (data.farmers ?? state.farmers).concat(Array(8).fill(null)).slice(0, 8);
  state.lumberjacks = (data.lumberjacks ?? state.lumberjacks).concat(Array(8).fill(null)).slice(0, 8);
  state.miners = (data.miners ?? state.miners).concat(Array(8).fill(null)).slice(0, 8);
  // partner = data.partner ?? partner;
  // if (partner.exp === undefined) partner.exp = 0;
  // if (partner.hpPotions === undefined) partner.hpPotions = 0;
  // if (partner.manaPotions === undefined) partner.manaPotions = 0;
  // if (partner.energyPotions === undefined) partner.energyPotions = 0;
  // if (partner.expPotions === undefined) partner.expPotions = 0;
  // if (partner.energia === undefined) partner.energia = 100;
  state.autoClickActive = data.autoClickActive ?? state.autoClickActive;
  fortuneDay = data.fortuneDay ?? fortuneDay;
  fortuneLastPrize = data.fortuneLastPrize ?? fortuneLastPrize;
  bossRushDay = data.bossRushDay ?? bossRushDay;
  bossRushCount = data.bossRushCount ?? bossRushCount;
  enemyDay = data.enemyDay ?? enemyDay;
  enemyCount = data.enemyCount ?? enemyCount;
  chiefSurvivalDay = data.chiefSurvivalDay ?? chiefSurvivalDay;
  chiefSurvivalWins = data.chiefSurvivalWins ?? chiefSurvivalWins;
  giantBossLevel = data.giantBossLevel ?? giantBossLevel;
  lifeTasks = data.lifeTasks ?? lifeTasks;
  lifeTasksDay = data.lifeTasksDay ?? lifeTasksDay;
  lifeOtherText = data.lifeOtherText ?? lifeOtherText;
  lifeGold = data.lifeGold ?? lifeGold;
  lifeGoldDay = data.lifeGoldDay ?? lifeGoldDay;
  habitsData = data.habitsData ?? habitsData;
  habitsMonth = data.habitsMonth ?? habitsMonth;
  habitsLastProcessed = data.habitsLastProcessed ?? habitsLastProcessed;
  unlockedFamiliars = data.unlockedFamiliars ?? unlockedFamiliars;
  unlockedHabilities = data.unlockedHabilities ?? unlockedHabilities;
  // unlockedPartnerAbilities = data.unlockedPartnerAbilities ?? unlockedPartnerAbilities;
  if (data.bossStats) {
    Object.assign(bossStats, data.bossStats);
  }
  // if (data.partnerStats) {
  //   Object.assign(partnerStats, data.partnerStats);
  // }
  if (data.buildingTask) Object.assign(state.buildingTask, data.buildingTask);
  if (!state.buildingTask.heroes) state.buildingTask.heroes = state.buildingTask.heroIds ? state.buildingTask.heroIds.map(id => state.heroMap.get(id)) : [null, null, null];
  if (state.buildingTask.cost === undefined) state.buildingTask.cost = 0;
  if (data.upgradeTasks) Object.assign(state.upgradeTasks, data.upgradeTasks);
  Object.keys(UPGRADE_HERO_COUNTS).forEach(b => {
    if (!state.upgradeTasks[b]) state.upgradeTasks[b] = { heroIds: [], heroes: [], time: 0, cost: 0, energy: 0, exp: 0 };
    if (!state.upgradeTasks[b].heroes) state.upgradeTasks[b].heroes = state.upgradeTasks[b].heroIds.map(id => state.heroMap.get(id));
    if (state.upgradeTasks[b].cost === undefined) state.upgradeTasks[b].cost = 0;
    if (state.upgradeTasks[b].energy === undefined) state.upgradeTasks[b].energy = 0;
    if (state.upgradeTasks[b].exp === undefined) state.upgradeTasks[b].exp = 0;
  });
  if (data.buildingLevels) Object.assign(state.buildingLevels, data.buildingLevels);
  Object.keys(BUILDING_IMAGES).forEach(b => {
    if (state.buildingLevels[b] === undefined) state.buildingLevels[b] = 0;
  });
  setExtraHouses(data.extraHouses ?? extraHouses);
  state.heroes.forEach(h => {
    if (h.petLevel > (state.buildingLevels.PetSanctuary || 0)) {
      h.petLevel = state.buildingLevels.PetSanctuary || 0;
    }
  });
  MAX_PETS = data.MAX_PETS ?? MAX_PETS;
  setMaxFood(data.MAX_FOOD ?? MAX_FOOD);
  setMaxWood(data.MAX_WOOD ?? MAX_WOOD);
  setMaxStone(data.MAX_STONE ?? MAX_STONE);
  const pantryLevel = state.buildingLevels.Pantry || 0;
  const lumberLevel = state.buildingLevels.Lumberyard || 0;
  const quarryLevel = state.buildingLevels.Quarry || 0;
  const expectedFoodCap = (pantryLevel + 1) * 10;
  const expectedWoodCap = (lumberLevel + 1) * 10;
  const expectedStoneCap = (quarryLevel + 1) * 10;
  if (MAX_FOOD !== expectedFoodCap) setMaxFood(expectedFoodCap);
  if (MAX_WOOD !== expectedWoodCap) setMaxWood(expectedWoodCap);
  if (MAX_STONE !== expectedStoneCap) setMaxStone(expectedStoneCap);
  MAX_LEVEL = data.MAX_LEVEL ?? MAX_LEVEL;
  CHIEF_MAX_LEVEL = Math.max(20, data.CHIEF_MAX_LEVEL ?? CHIEF_MAX_LEVEL);
  // PARTNER_MAX_LEVEL = data.PARTNER_MAX_LEVEL ?? PARTNER_MAX_LEVEL;
  if (data.MAX_STATS) {
    Object.assign(MAX_STATS, data.MAX_STATS);
  } else if (data.MAX_STAT !== undefined) {
    Object.keys(MAX_STATS).forEach(k => { MAX_STATS[k] = data.MAX_STAT; });
  }
  if (data.CHIEF_MAX_STATS) {
    Object.assign(CHIEF_MAX_STATS, data.CHIEF_MAX_STATS);
  } else if (data.CHIEF_MAX_STAT !== undefined) {
    Object.keys(CHIEF_MAX_STATS).forEach(k => { CHIEF_MAX_STATS[k] = Math.max(15, data.CHIEF_MAX_STAT); });
  }
  // if (data.PARTNER_MAX_STATS) {
  //   Object.assign(PARTNER_MAX_STATS, data.PARTNER_MAX_STATS);
  // }
  if (!castleLevelFixApplied) {
    updateMaxLevelsFromCastle();
    castleLevelFixApplied = true;
    scheduleSaveGame();
  }
  checkHabitsMonth();
  updateHabitStats();
  updatePetAutoCollection();
  const savedAt = data.savedAt || Date.now();
  if (state.buildingTask.time > 0 && !state.buildingTask.endAt) {
    state.buildingTask.endAt = savedAt + state.buildingTask.time * 1000;
  }
  Object.values(state.upgradeTasks).forEach(t => {
    if (t.time > 0 && !t.endAt) {
      t.endAt = savedAt + t.time * 1000;
    }
  });
  const offlineSeconds = Math.floor((Date.now() - savedAt) / 1000);
  if (offlineSeconds > 0) applyHiddenTime(offlineSeconds);
  if (migrated) saveGame();
}


function refreshBuildSelectionOptions() {
  buildSelectSelects.forEach((sel, idx) => {
    const current = parseInt(sel.value) || null;
    sel.innerHTML = "";
    const opt = document.createElement("option");
    opt.textContent = "Choose Builder";
    opt.value = "";
    sel.appendChild(opt);
    state.heroes.forEach(h => {
      const already = buildSelectSelects.some((s, j) => j !== idx && parseInt(s.value) === h.id);
      if (!already && h.energia > 50 && !isBusy(h)) {
        const o = document.createElement("option");
        o.value = h.id;
        o.textContent = h.name;
        if (h.id === current) o.selected = true;
        sel.appendChild(o);
      }
    });
  });
  refreshBuildSelectionAvatars();
}

function refreshBuildSelectionAvatars() {
  buildSelectSelects.forEach((sel, i) => {
    const img = buildSelectAvatars[i];
    if (!img) return;
    const id = parseInt(sel.value);
    if (id) {
      const hero = state.heroMap.get(id);
      img.src = hero.avatar || EMPTY_SRC;
      img.style.objectPosition = `center ${hero.avatarOffset ?? 50}%`;
      if (!hero.avatar) img.classList.add("empty"); else img.classList.remove("empty");
    } else {
      img.src = EMPTY_SRC;
      img.classList.add("empty");
    }
  });
  updateUpgradePreview();
}

function updateUpgradePreview() {
  if (!upgradePreviewLabel) return;
  const preview = document.getElementById('upgrade-preview');
  if (!preview) return;
  const selected = buildSelectSelects.filter(s => parseInt(s.value)).length;
  if (selected === upgradePreviewCount) {
    preview.style.display = 'block';
    preview.src = BUILDING_IMAGES[upgradePreviewLabel] || '';
  } else {
    preview.style.display = 'none';
  }
}

// Función de inicialización de datos de estado - debe llamarse después de que todos los módulos se hayan cargado
function initializeStateData() {
  // Inicializar volumen del reproductor de música
  sywAudio.volume = soundVolume;
  
  // Inicializar state.upgradeTasks y state.buildingLevels
  Object.keys(UPGRADE_HERO_COUNTS).forEach(b => {
    if (!state.upgradeTasks[b]) state.upgradeTasks[b] = { heroIds: [], heroes: [], time: 0, lastTimeShown: null };
  });
  Object.keys(BUILDING_IMAGES).forEach(b => {
    if (state.buildingLevels[b] === undefined) state.buildingLevels[b] = 0;
  });
  if (state.buildingLevels.Tower === undefined) state.buildingLevels.Tower = 3;
  
  // Inicializar groupMissions
  state.groupMissions = (state.groupMissions || []).slice(0, 4);
  while (state.groupMissions.length < 4) {
    state.groupMissions.push({
      id: state.groupMissions.length + 1,
      title: `GroupMission${state.groupMissions.length + 1}`,
      description: null,
      heroIds: [null, null, null, null, null],
      status: 'idle',
      started: false,
      startAt: null,
      endAt: null,
      sameOriginBonus: false,
      rewardApplied: false
    });
  }
  state.groupMissions.forEach((gm, idx) => {
    gm.id = idx + 1;
    gm.title = `GroupMission${idx + 1}`;
  });
  
  if (villageChief.level === undefined) villageChief.level = 1;
  if (villageChief.exp === undefined) villageChief.exp = 0;

  state.heroes.forEach(h => {
    if (h.level === undefined) h.level = 1;
    if (h.exp === undefined) h.exp = 0;
    if (h.stats === undefined) {
      h.stats = {
        fuerza: 1,
        suerte: 1,
        inteligencia: 1,
        destreza: 1,
        defensa: 1,
        vida: 1,
        mana: 1,
      };
    }
    Object.keys(h.stats).forEach(s => {
      if (h.stats[s] > MAX_STATS[s]) h.stats[s] = MAX_STATS[s];
    });
    if (h.stats.defensa === undefined) h.stats.defensa = 1;
    if (h.hp === undefined || h.hpMax === undefined) {
      h.hp = h.stats.vida;
      h.hpMax = h.stats.vida;
    }
    if (h.mana === undefined || h.manaMax === undefined) {
      h.mana = h.stats.mana;
      h.manaMax = h.stats.mana;
    }
    if (!h.skills || !Array.isArray(h.skills)) {
      h.skills = [
        { name: "Basic Attack", img: "" },
        { name: "Special Attack", img: "" },
        { name: "none", img: "" },
        { name: "none", img: "" },
      ];
    } else {
      // normalize legacy ability names
      if (h.skills[2] && h.skills[2].name === "Extra Ability 1") {
        h.skills[2].name = "none";
      }
      if (h.skills[3] && h.skills[3].name === "Extra Ability 2") {
        h.skills[3].name = "none";
      }
    }
    if (!h.pet) h.pet = "";
    if (!h.petImg) h.petImg = "";
    if (h.petLevel === undefined) h.petLevel = 1;
    if (h.petExp === undefined) h.petExp = 0;
    if (!h.petOrigin) h.petOrigin = "No origin";
    if (h.petFavorite === undefined) h.petFavorite = false;
    if (h.petExploreDay === undefined) h.petExploreDay = "";
    if (h.petLastCollection === undefined) h.petLastCollection = Date.now();
    if (h.petPendingCount === undefined) {
      if (Array.isArray(h.petPending)) {
        h.petPendingCount = h.petPending.length;
      } else {
        h.petPendingCount = parseInt(h.petPending || '0', 10) || 0;
      }
    }
    delete h.petPending;
    if (!h.petResourceType) h.petResourceType = h.petResource || null;
    if (h.desc === undefined) h.desc = "";
    if (h.petDesc === undefined) h.petDesc = "";
    if (!h.origin) h.origin = "No origin";
    if (!h.professions) h.professions = [];
    if (h.favorite === undefined) h.favorite = false;
    if (!h.weapon) h.weapon = "";
    if (!h.armor) h.armor = "";
    if (!h.weaponImg) h.weaponImg = "";
      if (!h.armorImg) h.armorImg = "";
      if (h.ability1LearnTime === undefined) h.ability1LearnTime = 0;
      if (h.ability2LearnTime === undefined) h.ability2LearnTime = 0;
      if (h.ability1Learned === undefined) h.ability1Learned = true;
      if (h.ability2Learned === undefined) h.ability2Learned = true;
      if (h.collectTime === undefined) h.collectTime = 0;
      if (h.collectLastShown === undefined) h.collectLastShown = h.collectTime;
      if (h.mineTime === undefined) h.mineTime = 0;
      if (h.mineLastShown === undefined) h.mineLastShown = h.mineTime;
      if (h.chopTime === undefined) h.chopTime = 0;
      if (h.chopLastShown === undefined) h.chopLastShown = h.chopTime;
      if (h.workTime === undefined) h.workTime = 0;
      if (h.workLastShown === undefined) h.workLastShown = h.workTime;
      if (h.buildTime === undefined) h.buildTime = 0;
      if (h.hpPotions === undefined) h.hpPotions = 0;
      if (h.manaPotions === undefined) h.manaPotions = 0;
      if (h.energyPotions === undefined) h.energyPotions = 0;
      if (h.expPotions === undefined) h.expPotions = 0;
      if (h.modified === undefined) h.modified = Date.now();
  });
  
  // Inicializar misiones solo si está vacío para evitar duplicados
  if (state.missions.length === 0) {
    state.missions.push(...Array.from({ length: missionExpRewards.length }, (_, i) => ({
      id: i + 1,
      heroId: null,
      pendingHeroId: null,
      completed: false,
      expReward: missionExpRewards[i],
      description: missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)]
    }))); 
  }

  if (state.missions.length < missionExpRewards.length) {
    for (let i = state.missions.length; i < missionExpRewards.length; i++) {
      state.missions.push({
        id: i + 1,
        heroId: null,
        pendingHeroId: null,
        completed: false,
        expReward: missionExpRewards[i],
        description: missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)]
      });
    }
  }

  state.missions.forEach(m => {
    if (!m.description) {
      m.description = missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)];
    }
    m.expReward = missionExpRewards[m.id - 1] || m.expReward || 20;
    if (m.pendingHeroId === undefined) {
      m.pendingHeroId = null;
    }
  });
}

let openStats = {};
let openTraining = {};
let openBossStats = false;
let openChiefInventory = false;
let openChiefFamiliars = false;
let openChiefPopulation = false;
let openHeroesManagement = false;
let restOrderUsed = false;
let cancelRestUsed = false;
let autoAssignStage = 0;

function anyStatsOpen() {
  return Object.keys(openStats).length > 0;
}
let openChiefHabilities = false;
let openPartnerAbilities = false;
let openPartnerStats = false;
let openPartnerInventory = false;
let chiefFamiliarPage = 1;
let chiefHabilityPage = 1;
let partnerAbilityPage = 1;
let autoClickLastTick = Date.now();
let hiddenSince = null;
let lastUpdate = Date.now();

// ---- Centralized timer system ----
const TIMER_STORAGE_KEY = 'activeTimers';

// Constantes de tiempo para optimización de rendimiento
import { MIN, HOUR, TIMER_INTERVALS, TRAIN_TIMER_MINUTES, calculateTrainingTimeRemaining, formatTrainingTime, isTrainingComplete, getTrainingEndTime } from './src/utils/timerConstants.js';

let activeTimers = [];

try {
  const stored = localStorage.getItem(TIMER_STORAGE_KEY);
  if (stored) activeTimers = JSON.parse(stored);
} catch {}

let timersPaused = false;
let timersResumeTimeout;

export function pauseTimers() {
  timersPaused = true;
}

function resumeTimers() {
  timersPaused = false;
}

function pauseTimersFor(ms) {
  pauseTimers();
  clearTimeout(timersResumeTimeout);
  timersResumeTimeout = setTimeout(resumeTimers, ms);
}

function pauseTimersBriefly() {
  pauseTimersFor(1000);
}

export function updateTimerPause() {
  const shouldPause =
    openChiefFamiliars ||
    openChiefHabilities ||
    openPartnerAbilities ||
    currentChiefExtra === "Life Missions" ||
    currentChiefExtra === "Habits" ||
    currentChiefExtra === "Autoclick enabled";
  if (shouldPause) pauseTimers(); else resumeTimers();
}

function saveTimers() {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(activeTimers));
  } catch {}
}

export function addTimer(timer) {
  activeTimers.push(timer);
  saveTimers();
}

export function removeTimer(id) {
  const idx = activeTimers.findIndex(t => t.id === id);
  if (idx !== -1) {
    activeTimers.splice(idx, 1);
    saveTimers();
  }
}

function applyEffect(timer, ticks) {
  switch (timer.type) {
    case 'rest': {
      const hero = getHeroById(timer.heroId);
      if (!hero) break;
      hero.energia = Math.min(hero.energia + ticks * REST_ENERGY_GAIN, 100);
      break;
    }
    case 'autoclick':
      for (let i = 0; i < ticks; i++) autoClickTick();
      updateResourcesDisplay();
      if (!anyStatsOpen()) renderHeroesIfVisible();
      updateAutoClickButtonHeight();
      break;
    default:
      break;
  }
}

function finishTimer(timer) {
  switch (timer.type) {
    case 'rest': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        hero.restTime = 0;
        hero.restStartTime = 0;
        hero.lastRestTick = 0;
        hero.restDuration = 0;
        restingHeroes.delete(hero);
        hero.energyEl = null;
        hero.lowEnergyEl = null;
        hero.restTimerEl = null;
      }
      break;
    }
    // Ability learning cases removed - all abilities are now unlocked by default
    case 'farm': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        hero.collectTime = 0;
        hero.collectLastShown = 0;
        state.food = Math.min(MAX_FOOD, state.food + 3);
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      }
      updateResourcesDisplay();
      renderHeroesIfVisible();
      break;
    }
    case 'mine': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        hero.mineTime = 0;
        hero.mineLastShown = 0;
        state.stone = Math.min(MAX_STONE, state.stone + 3);
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      }
      updateResourcesDisplay();
      renderHeroesIfVisible();
      break;
    }
    case 'chop': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        hero.chopTime = 0;
        hero.chopLastShown = 0;
        state.wood = Math.min(MAX_WOOD, state.wood + 3);
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      }
      updateResourcesDisplay();
      renderHeroesIfVisible();
      break;
    }
    case 'work': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        hero.workTime = 0;
        hero.workLastShown = 0;
        state.money += 100;
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 20);
        autoStartRest(hero);
      }
      updateResourcesDisplay();
      renderHeroesIfVisible();
      break;
    }
    case 'buildHouse':
      buildHouse();
      break;
    case 'buildPetSanctuary':
      if (typeof buildPetSanctuary === 'function') buildPetSanctuary();
      break;
    case 'train': {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        if (timer.stat && hero.stats[timer.stat] < MAX_STATS[timer.stat]) {
          hero.stats[timer.stat]++;
        }
        hero.trainingStat = null;
        hero.trainTime = 0;
        hero.trainingEndAt = null;
        
        // Actualizar UI para mostrar "Ready"
        const statEl = document.getElementById(`train-timer-${hero.id}-${timer.stat}`);
        if (statEl) statEl.textContent = "Ready";
        const mainEl = document.getElementById(`train-main-${hero.id}`);
        if (mainEl) mainEl.textContent = "Ready";
      }
      break;
    }
    case 'work':
      state.money += 100;
      const workHero = getHeroById(timer.heroId);
      if (workHero) {
        addHeroExp(workHero, 20);
        workHero.energia = Math.max(0, workHero.energia - 20);
        autoStartRest(workHero);
        workHero.workTime = 0;
      }
      break;
    case 'farm':
      state.food = Math.min(MAX_FOOD, state.food + 50);
      const farmHero = getHeroById(timer.heroId);
      if (farmHero) {
        farmHero.energia = Math.max(0, farmHero.energia - 10);
        autoStartRest(farmHero);
        addHeroExp(farmHero, 20);
        farmHero.collectTime = 0;
      }
      break;
    case 'chop':
      state.wood = Math.min(MAX_WOOD, state.wood + 50);
      const chopHero = getHeroById(timer.heroId);
      if (chopHero) {
        chopHero.energia = Math.max(0, chopHero.energia - 10);
        autoStartRest(chopHero);
        addHeroExp(chopHero, 20);
        chopHero.chopTime = 0;
      }
      break;
    case 'mine':
      state.stone = Math.min(MAX_STONE, state.stone + 50);
      const mineHero = getHeroById(timer.heroId);
      if (mineHero) {
        mineHero.energia = Math.max(0, mineHero.energia - 10);
        autoStartRest(mineHero);
        addHeroExp(mineHero, 20);
        mineHero.mineTime = 0;
      }
      break;
    case 'mission': {
      const hero = getHeroById(timer.heroId);
      const slot = state.missions.find(m => m.id === timer.slotId);
      if (hero && slot) {
        // Marcar como completada pero NO aplicar recompensa aún (igual que group missions)
        slot.completed = true;
        slot.status = 'completed';
        slot.rewardApplied = false; // La recompensa se aplicará al hacer click en "Collect Reward"
        
        // NO liberar al héroe aún, NO aplicar recompensas aún
        // Solo limpiar los tiempos para la UI
        hero.missionTime = 0;
        hero.missionStartTime = 0;
        hero.missionDuration = 0;
        
        renderMissions();
        renderHeroesIfVisible();
      }
      break;
    }
    case 'dailyMission': {
      const hero = getHeroById(timer.heroId);
      const slot = getDailyMissionSlot(timer.slotId);
      if (hero && slot) {
        // Marcar como completada pero NO aplicar recompensa aún
        slot.completed = true;
        slot.status = 'completed';
        slot.completedWeek = getWeekKey(new Date());
        slot.completedHeroId = hero.id;
        slot.rewardApplied = false;
        
        // NO liberar al héroe aún, NO aplicar recompensas aún
        // Solo limpiar los tiempos para la UI
        hero.missionTime = 0;
        hero.missionStartTime = 0;
        hero.missionDuration = 0;
        
        renderDailyMissions();
        renderHeroesIfVisible();
        renderMissions();
      }
      break;
    }
  }
  updateResourcesDisplay();
  scheduleSaveGame();
}

function processAllTimers(now = Date.now()) {
  if (timersPaused) return;
  let changed = false;
  for (const timer of activeTimers) {
    if (isMinigameActive || timer.completed) continue;
    const elapsed = now - timer.startTime;

    if (["farm","mine","chop","work"].includes(timer.type)) {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        const keyMap = { farm: 'collectTime', mine: 'mineTime', chop: 'chopTime', work: 'workTime' };
        const key = keyMap[timer.type];
        const remaining = Math.max(0, Math.ceil((timer.duration - elapsed) / 1000));
        hero[key] = remaining;
        const tEl = document.getElementById(`${timer.type}-timer-${hero.id}`);
        if (tEl && tEl.offsetParent !== null) {
          tEl.textContent = "10m";
        }
        if (remaining <= 0) {
          finishTimer(timer);
          timer.completed = true;
        }
        changed = true;
      }
      continue;
    }

    if (timer.interval) {
      const last = timer.lastTick || timer.startTime;
      const ticks = Math.floor((now - last) / timer.interval);
      if (ticks > 0) {
        applyEffect(timer, ticks);
        timer.lastTick = last + ticks * timer.interval;
        changed = true;
      }
    }

    if (elapsed >= timer.duration) {
      finishTimer(timer);
      timer.completed = true;
      changed = true;
    }

    if (timer.type === 'rest') {
      const hero = getHeroById(timer.heroId);
      if (hero) {
        const elapsedMs = now - hero.restStartTime;
        const intervals = Math.floor(elapsedMs / REST_INTERVAL_MS);
        hero.restTime = Math.max(0, hero.restDuration - intervals);
        if (hero.restTime <= 0 || hero.energia >= 100) {
          finishTimer(timer);
          timer.completed = true;
          changed = true;
        }
      }
    }
    // Las misiones ahora usan el modelo de Special Builder y se verifican
    // cada 30 minutos con checkAllMissions(), no necesitan procesamiento aquí
    
    // Nuevo sistema de entrenamiento por minuto
    if (timer.type === 'train') {
      const hero = getHeroById(timer.heroId);
      if (hero && timer.endAt) {
        const minutesRemaining = calculateTrainingTimeRemaining(timer.endAt);
        hero.trainTime = minutesRemaining;
        
        // Actualizar UI solo si es visible
        const statEl = document.getElementById(`train-timer-${hero.id}-${timer.stat}`);
        if (statEl && statEl.offsetParent !== null) {
          statEl.textContent = formatTrainingTime(minutesRemaining);
        }
        
        const mainEl = document.getElementById(`train-main-${hero.id}`);
        if (mainEl && mainEl.offsetParent !== null) {
          mainEl.textContent = formatTrainingTime(minutesRemaining);
        }
        
        // Verificar si el entrenamiento ha terminado
        if (isTrainingComplete(timer.endAt)) {
          finishTimer(timer);
          timer.completed = true;
          changed = true;
        }
      }
    }
  }
  if (changed) {
    activeTimers = activeTimers.filter(t => !t.completed);
    saveTimers();
    scheduleSaveGame();
  }
}

// Función para actualizar los overlays de los temporizadores de construcción y mejora
function updateConstructionOverlays() {
  // Actualizar overlay de construcción de casa
  if (state.buildingTask.time > 0) {
    const selectCard = document.getElementById('build-select-card');
    if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === 'none')) {
      showInlineBuildTimer();
    }
  }
  
  // Actualizar overlays de mejoras
  Object.entries(state.upgradeTasks).forEach(([label, task]) => {
    if (task.time > 0) {
      const selectCard = document.getElementById('build-select-card');
      if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === 'none')) {
        showUpgradeInlineTimer(label);
      }
    }
  });
}

initMinigameControl(() => activeTimers, processAllTimers);

setInterval(() => {
  if (!document.hidden) {
    processAllTimers(Date.now());
    updateConstructionOverlays();
  }
}, MIN);

// Correct heroes stuck at 97% or heroes left in a blocked state
setInterval(() => {
  if (document.hidden) return;
  let changed = false;
  Array.from(restingHeroes).forEach(hero => {
    if (hero.restTime === 1 && hero.energia >= 100 - REST_ENERGY_GAIN) {
      hero.energia = 100;
      hero.restTime = 0;
      removeTimer(`rest_${hero.id}`);
      updateRest(hero);
      changed = true;
    }
  });
  state.heroes.forEach(h => {
    const inactive =
      h.missionTime <= 0 &&
      h.collectTime <= 0 &&
      h.mineTime <= 0 &&
      h.chopTime <= 0 &&
      h.workTime <= 0 &&
      h.buildTime <= 0 &&
      h.trainTime <= 0 &&
      h.restTime <= 0 &&
      h.ability1LearnTime <= 0 &&
      h.ability2LearnTime <= 0;
    if (h.energia >= 97 && h.energia < 100 && inactive) {
      h.energia = 100;
      h.state = { type: 'ready' };
      changed = true;
    }
  });
  if (changed) {
    saveGame();
    scheduleRenderHeroes();
    renderMissions();
    renderVillageChief();
  }
}, MIN);

setInterval(() => {
  if (!document.hidden && cleanupHeroBuildStatus()) {
    renderHeroesIfVisible();
  }
}, 3 * MIN);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) processAllTimers(Date.now());
});

let scrollTicking = false;
function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    if (perfOptimizations) performance.mark('scroll-handler:start');
    pauseTimersFor(3000);
    if (perfOptimizations) {
      performance.mark('scroll-handler:end');
      performance.measure('scroll-handler', 'scroll-handler:start', 'scroll-handler:end');
    }
    scrollTicking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

export function saveGame() {
  // Update remaining rest time for heroes before saving
  const now = Date.now();
  state.heroes.forEach(h => {
    if (h.restStartTime && h.restDuration) {
      const elapsedMs = now - h.restStartTime;
      const intervals = Math.floor(elapsedMs / REST_INTERVAL_MS);
      const elapsedTime = intervals;
      const remainderMs = elapsedMs % REST_INTERVAL_MS;
      if (elapsedTime < h.restDuration) {
        h.restDuration -= elapsedTime;
        h.restTime = h.restDuration;
        h.restStartTime = now - remainderMs;
        h.lastRestTick = now - remainderMs;
      } else {
        h.restDuration = 0;
        h.restTime = 0;
        h.restStartTime = 0;
        h.lastRestTick = 0;
      }
    }
  });

  // Eliminar campos de partner del villageChief antes de guardar
  delete villageChief.partnerAbilities;
  delete villageChief.unlockedPartnerAbilities;
  delete villageChief.partnerLevel;

  recalcSummonCost();
  const gameState = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    money: state.money,
    food: state.food,
    wood: state.wood,
    stone: state.stone,
    houses: state.houses,
    terrain: state.terrain,
    citizens,
    soldiers,
    summonCost,
    heroes: state.heroes,
    missions: state.missions,
    groupMissions: state.groupMissions,
    dailyMissions: state.dailyMissions,
    villageChief,
    companions: state.companions,
    farmers: state.farmers,
    lumberjacks: state.lumberjacks,
    miners: state.miners,
    MAX_PETS,
    MAX_FOOD,
    MAX_WOOD,
    MAX_STONE,
    MAX_LEVEL,
    CHIEF_MAX_LEVEL,
    MAX_STATS,
    CHIEF_MAX_STATS,
    castleLevelFixApplied,
    autoClickActive: state.autoClickActive,
    bossRushDay,
    bossRushCount,
    enemyDay,
    enemyCount,
    chiefSurvivalDay,
    chiefSurvivalWins,
    giantBossLevel,
    fortuneDay,
    fortuneLastPrize,
      lifeTasks,
      lifeTasksDay,
      lifeOtherText,
      lifeGold,
      lifeGoldDay,
      habitsData,
    habitsMonth,
    habitsLastProcessed,
    unlockedFamiliars,
    unlockedHabilities,
    bossStats,
    buildingTask: state.buildingTask,
    upgradeTasks: state.upgradeTasks,
    buildingLevels: state.buildingLevels,
    extraHouses,
    projects: (()=>{ try{ return JSON.parse(localStorage.getItem('syw_projects_v1')||'[]'); }catch{ return []; } })(),
    projectPoints: Number(localStorage.getItem('syw_points')||0)
  };
  if (ipcRenderer) {
    ipcRenderer.send('set-game-state', gameState);
  } else {
    setItem('gameState', gameState);
  }
}

export function scheduleSaveGame() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveGame();
  }, 200);
}

function cleanupHeroBuildStatus() {
  const activeIds = new Set();
  if (state.buildingTask.time > 0) {
    state.buildingTask.heroIds.filter(Boolean).forEach(id => activeIds.add(id));
  }
  Object.values(state.upgradeTasks).forEach(t => {
    if (t.time > 0) {
      (t.heroIds || []).filter(Boolean).forEach(id => activeIds.add(id));
    }
  });
  let changed = false;
  state.heroMap.forEach(h => {
    if (!activeIds.has(h.id) && h.buildTime !== 0) {
      h.buildTime = 0;
      changed = true;
    }
  });
  return changed;
}

async function exportSave() {
  const data = ipcRenderer
    ? await ipcRenderer.invoke('get-game-state')
    : getItem('gameState');
  if (!data) return;
  if (ipcRenderer) {
    const filePath = await ipcRenderer.invoke('show-save-dialog');
    if (filePath) {
      await ipcRenderer.invoke('save-file', { filePath, data });
    }
  } else {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summonyourwill_save.json";
    a.click();
    URL.revokeObjectURL(url);
  }
}

function importSave() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== 'object' || data.version === undefined) {
          showAlert('Archivo inválido: falta versión.');
          return;
        }

        let saveData = data;
        if (data.version < SAVE_VERSION) {
          try {
            saveData = migrateSave(data);
          } catch (e) {
            console.error('Migration failed', e);
            showAlert('Archivo demasiado antiguo. No es compatible.');
            return;
          }
        } else if (data.version > SAVE_VERSION) {
          showAlert('Archivo de una versión más reciente. Actualiza el juego.');
          return;
        }

        try {
          if (ipcRenderer) {
            ipcRenderer.send('set-game-state', saveData);
          } else {
            setItem('gameState', saveData);
          }
        } catch (e) {
          try {
            localStorage.clear();
            if (ipcRenderer) {
              ipcRenderer.send('set-game-state', saveData);
            } else {
              setItem('gameState', saveData);
            }
          } catch {
            throw e;
          }
        }
        await loadGame();
        cleanupHeroBuildStatus();
        updateResourcesDisplay();
        renderVillageChief();
        renderTerrains();
        renderVillage();
        scheduleRenderHeroes();
        renderMissions();
        renderPetManagement();
        renderGames();
        renderTutorial();
        renderSettings();
        saveGame();
        const container = getImportAlertContainer();
        showAlert('Import successful.', container ? { container } : {});
      } catch (err) {
        console.error('Import failed', err);
        showAlert("Error al importar: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function getImportAlertContainer() {
  switch (currentView) {
    case 'home':
      return document.getElementById('village-chief');
    case 'missions':
      return document.getElementById('daily-missions-card') || document.getElementById('missions-section');
    case 'pets':
      return document.getElementById('pet-management-section');
    default:
      return null;
  }
}

function importHeroDataFromJSON(jsonData) {
  try {
    state.heroes = jsonData;
    rebuildHeroMap();
    scheduleRenderHeroes();
  } catch (err) {
    console.error('Error importing hero data:', err);
  }
}

function updateResourcesDisplay() {
  const moneyEl = document.getElementById("money-display");
  if (moneyEl) moneyEl.innerHTML = `💰 <b>Gold:</b><br>${state.money}`;
  const foodEl = document.getElementById("food-display");
  if (foodEl) foodEl.innerHTML = `🍖 <b>Food:</b><br>${state.food}/${MAX_FOOD}`;
  const woodEl = document.getElementById("wood-display");
  if (woodEl) woodEl.innerHTML = `🪵 <b>Wood:</b><br>${state.wood}/${MAX_WOOD}`;
  const stoneEl = document.getElementById("stone-display");
  if (stoneEl) stoneEl.innerHTML = `🪨 <b>Stone:</b><br>${state.stone}/${MAX_STONE}`;
  const goldVal = document.getElementById("gold-val");
  if (goldVal) goldVal.textContent = state.money;
  const foodVal = document.getElementById("food-val");
  if (foodVal) foodVal.textContent = `${state.food}/${MAX_FOOD}`;
  const woodVal = document.getElementById("wood-val");
  if (woodVal) woodVal.textContent = `${state.wood}/${MAX_WOOD}`;
  const stoneVal = document.getElementById("stone-val");
  if (stoneVal) stoneVal.textContent = `${state.stone}/${MAX_STONE}`;
  const citEl = document.getElementById("citizens-display");
  if (citEl) citEl.textContent = `Citizens: ${citizens}/${state.terrain * 50}`;
  const solEl = document.getElementById("soldiers-display");
  if (solEl) solEl.textContent = `Soldiers: ${soldiers}/${state.terrain * 50}`;
  const terrainEl = document.getElementById("terrain-display");
  if (terrainEl) {
    terrainEl.textContent = `Terrain: ${state.terrain}/${state.MAX_TERRAIN}`;
    terrainEl.title = "1 terrain = 5 houses";
  }
  const housesEl = document.getElementById("houses-display");
  if (housesEl) {
    housesEl.textContent = `Houses: ${state.houses}/${MAX_HOUSES}`;
    housesEl.title = "1 house = 5 heroes";
  }
  const gamesGold = document.getElementById("games-gold-display");
  if (gamesGold) gamesGold.textContent = `Gold: ${state.money}`;
  const gamesFood = document.getElementById("games-food-display");
  if (gamesFood) gamesFood.textContent = `Food: ${state.food}`;
  const gamesWood = document.getElementById("games-wood-display");
  if (gamesWood) gamesWood.textContent = `Wood: ${state.wood}`;
  const gamesStone = document.getElementById("games-stone-display");
  if (gamesStone) gamesStone.textContent = `Stone: ${state.stone}`;
  const heroTitle = document.querySelector("#heroes-section h1");
  if (heroTitle) heroTitle.textContent = `My Heroes (${state.heroes.length}/${state.houses})`;
  const petsTitle = document.querySelector("#pets-section h1");
  if (petsTitle) {
    const totalPets = state.heroes.filter(h => h.pet).length;
    petsTitle.textContent = `My Pets (${totalPets}/${MAX_PETS})`;
  }
  const sbtn = document.getElementById("summon-btn");
  if (sbtn) {
    sbtn.textContent = `HeroSummon (${summonCost} Gold)`;
    const noHouse = state.heroes.length >= state.houses;
    const noGoldSummon = state.money < summonCost;
    sbtn.disabled = noHouse || noGoldSummon;
    sbtn.title = noGoldSummon
      ? "Not enough Gold"
      : noHouse
      ? "Add house to summon again"
      : "";
    const note = sbtn.nextSibling;
    if (note && note.classList && note.classList.contains("timer")) note.remove();
  }
  const citBtn = document.getElementById("citizen-btn");
  if (citBtn) {
    const noGold = state.money < 100;
    citBtn.disabled = citizens >= state.terrain * 50 || noGold;
    citBtn.title = noGold ? "Not enough Gold" : "";
  }
  const solBtn = document.getElementById("soldier-btn");
  if (solBtn) {
    const noGold = state.money < 200;
    solBtn.disabled = soldiers >= state.terrain * 50 || noGold;
    solBtn.title = noGold ? "Not enough Gold" : "";
  }
  const proBtn = document.getElementById("promote-btn");
  if (proBtn) {
    const noGold = state.money < 500;
    const noEligible = !state.heroes.some(h => (h.maxProfessions ?? PROFESSION_LIMIT) < PROFESSION_MAX);
    proBtn.disabled = noGold || noEligible;
    proBtn.title = noGold ? "Not enough Gold" : "AllowExtraProfession";
  }
  const famBtn = document.getElementById("familiar-btn");
  if (famBtn) {
    const familiarCost = 1500 * (unlockedFamiliars + 1);
    const noGold = state.money < familiarCost;
    famBtn.disabled = noGold || unlockedFamiliars >= FAMILIAR_COUNT;
    famBtn.title = noGold ? "Not enough Gold" : "";
  }
  const abilBtn = document.getElementById("ability-btn");
  if (abilBtn) {
    const abilityCost = 1000 * (unlockedHabilities + 1);
    const noGold = state.money < abilityCost;
    abilBtn.disabled = noGold || unlockedHabilities >= HABILITY_COUNT;
    abilBtn.title = noGold ? "Not enough Gold" : "";
  }
}

function updateHeroControls() {
  const originSel = document.getElementById("origin-filter");
  const profSel = document.getElementById("profession-filter");
  const favCheck = document.getElementById("favorite-check");
  const readyCheck = document.getElementById("ready-check");
  const sexSel = document.getElementById("sex-filter");
  const searchInput = document.getElementById("hero-search");
  const searchList = document.getElementById("hero-search-list");
  if (!originSel || !profSel || !favCheck || !readyCheck || !sexSel) return;

  const readOnly = currentView === "profiles";
  
  const origins = [...new Set(state.heroes.map(h => h.origin || "No origin"))].sort((a,b)=>a.localeCompare(b));
  const currentOrigin = heroFilterOrigin || "";
  originSel.innerHTML = "<option value=''>Filter by origin</option>";
  origins.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    originSel.appendChild(opt);
  });
  originSel.value = currentOrigin;
  originSel.onmousedown = pauseTimersBriefly;

  const professions = Object.keys(professionIcons)
    .filter(p => p !== 'Necromancer')
    .sort((a,b)=>a.localeCompare(b));
  const currentProf = heroFilterProfession || "";
  profSel.innerHTML = "<option value=''>Filter by profession</option>";
  professions.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    profSel.appendChild(opt);
  });
  profSel.value = currentProf;
  profSel.onmousedown = pauseTimersBriefly;

  const sexes = [SEX.MALE, SEX.FEMALE, SEX.NEUTRAL];
  const currentSex = heroFilterSex || "";
  sexSel.innerHTML = "<option value=''>Filter by sex</option>";
  sexes.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    sexSel.appendChild(opt);
  });
  sexSel.value = currentSex;
  sexSel.onmousedown = pauseTimersBriefly;

  if (searchInput && searchList) {
    searchInput.value = heroFilterSearch || "";
    if (document.activeElement !== searchInput) {
      const q = searchInput.value.toLowerCase();
      const names = [...new Set(state.heroes.map(h => h.name || "").filter(n => n.toLowerCase().includes(q)))]
        .sort((a,b)=>a.localeCompare(b));
      searchList.innerHTML = names.map(n => `<option value="${n}"></option>`).join("");
    }
  }

  favCheck.checked = heroFilterFavorites;
  readyCheck.checked = heroFilterReady;
  originSel.disabled = false;
  profSel.disabled = false;
  sexSel.disabled = false;
  if (searchInput) searchInput.disabled = false;
  favCheck.disabled = false;
  readyCheck.disabled = false;

  const removeBtn = document.getElementById("remove-filter-btn");
  if (removeBtn) removeBtn.style.display = (heroFilterOrigin || heroFilterProfession || heroFilterSex || heroFilterSearch) ? "inline-block" : "none";
}

function updatePetControls() {
  const originSel = document.getElementById("pet-origin-filter");
  const favCheck = document.getElementById("pet-favorite-check");
  const searchInput = document.getElementById("pet-search");
  const searchList = document.getElementById("pet-search-list");
  if (!originSel || !favCheck) return;

  const origins = [...new Set(state.heroes.map(h => h.petOrigin || "No origin"))].sort((a,b)=>a.localeCompare(b));
  const currentOrigin = petFilterOrigin || "";
  originSel.innerHTML = "<option value=''>Filter by origin</option>";
  origins.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    originSel.appendChild(opt);
  });
  originSel.value = currentOrigin;
  originSel.onmousedown = pauseTimersBriefly;
  favCheck.checked = petFilterFavorites;
  if (searchInput && searchList) {
    searchInput.value = petFilterSearch || "";
    if (document.activeElement !== searchInput) {
      const q = searchInput.value.toLowerCase();
      const names = [...new Set(state.heroes.filter(h => h.pet).map(h => h.pet || "").filter(n => n.toLowerCase().includes(q)))]
        .sort((a,b)=>a.localeCompare(b));
      searchList.innerHTML = names.map(n => `<option value="${n}"></option>`).join("");
    }
    searchInput.disabled = false;
  }
  originSel.disabled = false;
  favCheck.disabled = false;
  const removeBtn = document.getElementById("pet-remove-filter-btn");
  if (removeBtn) removeBtn.style.display = (petFilterOrigin || petFilterSearch) ? "inline-block" : "none";
}

function expNeededForLevel(level, max = MAX_LEVEL) {
  if (level >= max) return 0;
  if (level >= 1000) return 5000;
  const needed = nextLevelExpTable[level];
  return needed === undefined ? 100 : needed;
}

function expTotalForLevel(level) {
  if (level > 1000) return 485850 + 5000 * (level - 1000);
  const total = acumulatedExpTable[level];
  return total === undefined ? 0 : total;
}

function addHeroExp(hero, amount, maxLevel = MAX_LEVEL) {
  hero.exp = (hero.exp || 0) + amount;
  while (hero.level < maxLevel) {
    const need = expNeededForLevel(hero.level, maxLevel);
    if (hero.exp >= need) {
      hero.exp -= need;
      hero.level = (hero.level || 1) + 1;
    } else {
      break;
    }
  }
  if (hero.level >= maxLevel) {
    hero.level = maxLevel;
    hero.exp = 0;
  }
}

function addPetExp(hero, amount, maxLevel = MAX_LEVEL) {
  hero.petExp = (hero.petExp || 0) + amount;
  while (hero.petLevel < maxLevel) {
    const need = expNeededForLevel(hero.petLevel, maxLevel);
    if (hero.petExp >= need) {
      hero.petExp -= need;
      hero.petLevel = (hero.petLevel || 1) + 1;
    } else {
      break;
    }
  }
  if (hero.petLevel >= maxLevel) {
    hero.petLevel = maxLevel;
    hero.petExp = 0;
  }
}


function ensureUniqueFamiliarName(list, base) {
  let name = base;
  let i = 2;
  while (list.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    name = `${base} ${i}`;
    i++;
  }
  return name;
}

function ensureUniqueAbilityName(list, base) {
  let name = base;
  let i = 2;
  while (list.some(h => h.name.toLowerCase() === name.toLowerCase())) {
    name = `${base} ${i}`;
    i++;
  }
  return name;
}

function makeListNamesUnique(list) {
  const counts = {};
  list.forEach(item => {
    const name = (item.name || "No name").trim();
    counts[name] = (counts[name] || 0) + 1;
  });
  const used = {};
  list.forEach(item => {
    const name = (item.name || "No name").trim();
    if (counts[name] > 1) {
      used[name] = (used[name] || 0) + 1;
      item.name = used[name] > 1 ? `${name} ${used[name]}` : name;
    } else {
      item.name = name;
    }
  });
}

function focusNoScroll(el) {
  if (!el) return;
  const x = window.scrollX;
  const y = window.scrollY;
  el.focus({ preventScroll: true });
  window.scrollTo(x, y);
}

function openEditModal(label, value, onOk, opts = {}) {
  const existing = document.querySelector(".edit-overlay");
  if (existing) removeOverlay(existing);
  const isDesc = /Description/.test(label);
  if (isDesc) pauseTimers();
  else if (/Name|Origin/.test(label)) pauseTimersFor(3000);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay edit-overlay";
  if (opts.container) overlay.classList.add('card-modal');
  const modal = document.createElement("div");
  modal.className = "modal";

  const input = opts.multiLine ? document.createElement('textarea') : document.createElement('input');
  if (!opts.multiLine) input.type = 'text';
  input.value = value || "";
  input.placeholder = label;
  if (opts.multiLine) {
    input.rows = opts.rows || 4;
    modal.style.minWidth = "360px";
    input.style.minHeight = "160px";
    input.style.width = "340px";
  }

  let datalist;
  if (opts.suggestions && !opts.multiLine) {
    datalist = document.createElement('datalist');
    const listId = `suggest-${Math.random().toString(36).slice(2)}`;
    datalist.id = listId;
    const uniq = [...new Map(opts.suggestions.map(s => [s.toLowerCase(), s])).values()];
    uniq.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      datalist.appendChild(opt);
    });
    input.setAttribute('list', listId);
  }

  const warn = document.createElement("div");
  warn.style.color = "red";
  warn.style.fontSize = "0.8em";
  warn.style.display = "none";
  warn.style.marginTop = "4px";

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.gap = "6px";

  const ok = document.createElement("button");
  ok.textContent = "Ok";
  ok.className = "btn btn-blue white-text";
  ok.style.flex = "1";
  function check() {
    if (opts.validate) {
      const msg = opts.validate(input.value.trim());
      if (msg) {
        warn.textContent = msg;
        warn.style.display = "block";
        ok.disabled = true;
        return false;
      }
    }
    warn.style.display = "none";
    ok.disabled = false;
    return true;
  }
  ok.onclick = () => {
    if (!check()) return;
    const val = input.value.trim();
    removeOverlay(overlay);
    if (isDesc) updateTimerPause();
    onOk(val);
  };
  input.addEventListener("input", check);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !opts.multiLine) {
      e.preventDefault();
      ok.click();
    }
  });
  check();

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.className = "btn btn-green white-text";
  cancel.style.flex = "1";
  cancel.onclick = () => {
    removeOverlay(overlay);
    if (isDesc) updateTimerPause();
  };

  buttons.appendChild(ok);
  buttons.appendChild(cancel);

  modal.appendChild(input);
  if (datalist) modal.appendChild(datalist);
  modal.appendChild(warn);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  if (opts.container) {
    if (getComputedStyle(opts.container).position === 'static') {
      opts.container.style.position = 'relative';
    }
    opts.container.appendChild(overlay);
  } else {
    appendOverlay(overlay);
  }
  overlay.tabIndex = -1;
  overlay.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      ok.click();
    }
  });
  focusNoScroll(overlay);
  focusNoScroll(input);
}

function collectOrigins(items, key) {
  const map = new Map();
  items.forEach(it => {
    const val = (it[key] || '').trim();
    if (!val || val.toLowerCase() === 'no origin') return;
    const low = val.toLowerCase();
    if (!map.has(low)) map.set(low, val);
  });
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}

function getHeroOrigins() {
  return collectOrigins(state.heroes, 'origin');
}

function getPetOrigins() {
  return collectOrigins(state.heroes, 'petOrigin');
}

function hasStarted(g) {
  return g && (g.status === 'running' || g.status === 'completed' || !!g.startAt);
}

function canStart(groupId, state) {
  if (groupId === 1) return true;
  for (let i = 1; i < groupId; i++) {
    if (!hasStarted(state[i])) return false;
  }
  return true;
}

function firstMissingPrereq(groupId, state) {
  for (let i = 1; i < groupId; i++) {
    if (!hasStarted(state[i])) return i;
  }
  return null;
}

function showToast(text) {
  try {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', text } }));
  } catch (e) {
    console.error(text);
  }
}

function showAlert(message, opts = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay card-modal";
  if (opts.container) overlay.classList.add('card-modal');
  overlay.style.zIndex =
    2000 + document.querySelectorAll('.modal-overlay, .sy-modal-overlay').length;
  const modal = document.createElement("div");
  modal.className = "modal";
  const text = document.createElement("div");
  text.textContent = message;
  const ok = document.createElement("button");
  ok.textContent = "OK";
  ok.className = "btn btn-blue white-text";
  ok.onclick = () => {
    if (opts.container) overlay.remove(); else removeOverlay(overlay);
  };
  modal.appendChild(text);
  modal.appendChild(ok);
  overlay.appendChild(modal);
  if (opts.container) {
    if (getComputedStyle(opts.container).position === 'static') {
      opts.container.style.position = 'relative';
    }
    opts.container.appendChild(overlay);
  } else {
    appendOverlay(overlay);
  }
  overlay.tabIndex = -1;
  overlay.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      ok.click();
    }
  });
  focusNoScroll(overlay);
}


function showZoomImage(src, container) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay zoom-overlay";
  if (container) overlay.classList.add('card-modal');
  const img = document.createElement("img");
  img.src = src;
  img.className = "main-image";
  img.onload = () => {
    if (img.naturalWidth < 250 && img.naturalHeight < 250) {
      img.style.width = img.naturalWidth * 2 + "px";
      img.style.height = img.naturalHeight * 2 + "px";
    }
  };
  const topBar = document.createElement('div');
  topBar.className = 'zoom-top-bar';
  const counter = document.createElement('span');
  counter.id = 'image-counter';
  topBar.appendChild(counter);
  overlay.appendChild(topBar);
  overlay.appendChild(img);
  overlay.onclick = () => removeOverlay(overlay);
  appendOverlay(overlay, container);
}

function downloadImage(src) {
  const url = src || document.querySelector('.main-image')?.src;
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = 'SummonYourWill-image.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function addMoveArrows(container, img, obj, key = 'avatarOffset', isBg = false, xKey = null) {
  function apply() {
    const y = obj[key] ?? 50;
    const x = xKey ? obj[xKey] ?? 50 : null;
    if (isBg) {
      img.style.backgroundPosition = x !== null ? `${x}% ${y}%` : `center ${y}%`;
    } else {
      img.style.objectPosition = x !== null ? `${x}% ${y}%` : `center ${y}%`;
    }
  }
  const up = document.createElement('div');
  up.className = 'move-icon move-up';
  up.textContent = '▲';
  up.onclick = e => {
    e.stopPropagation();
    const val = obj[key] ?? 50;
    obj[key] = Math.max(0, val - 5);
    apply();
    scheduleSaveGame();
  };
  const down = document.createElement('div');
  down.className = 'move-icon move-down';
  down.textContent = '▼';
  down.onclick = e => {
    e.stopPropagation();
    const val = obj[key] ?? 50;
    obj[key] = Math.min(100, val + 5);
    apply();
    scheduleSaveGame();
  };
  container.appendChild(up);
  container.appendChild(down);
  if (xKey) {
    const left = document.createElement('div');
    left.className = 'move-icon move-left';
    left.textContent = '◀';
    left.onclick = e => {
      e.stopPropagation();
      const val = obj[xKey] ?? 50;
      obj[xKey] = Math.max(0, val - 5);
      apply();
      scheduleSaveGame();
    };
    const right = document.createElement('div');
    right.className = 'move-icon move-right';
    right.textContent = '▶';
    right.onclick = e => {
      e.stopPropagation();
      const val = obj[xKey] ?? 50;
      obj[xKey] = Math.min(100, val + 5);
      apply();
      scheduleSaveGame();
    };
    container.appendChild(left);
    container.appendChild(right);
  }
  apply();
}

function appendBuildHeroes(container, ids) {
  const row = document.createElement('div');
  row.className = 'building-hero-row';
  ids.forEach(id => {
    if (!id) return;
    const h = state.heroMap.get(id);
    if (!h) return;
    const wrap = document.createElement('div');
    wrap.className = 'hero-mini';
    const img = document.createElement('img');
    img.src = h.avatar || EMPTY_SRC;
    img.className = 'mission-avatar';
    if (!h.avatar) img.classList.add('empty');
    const name = document.createElement('div');
    name.className = 'mini-name';
    name.textContent = h.name;
    wrap.appendChild(img);
    wrap.appendChild(name);
    row.appendChild(wrap);
  });
  container.appendChild(row);
}

function chooseHeroPet(callback) {
  const existing = document.querySelector('.hero-pet-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'builder-modal-overlay hero-pet-overlay';
  const modal = document.createElement('div');
  modal.className = 'builder-modal';
  
  const title = document.createElement('h3');
  title.textContent = 'Pet Exploration';
  title.className = 'builder-modal-title';
  modal.appendChild(title);

  const formGroup = document.createElement('div');
  formGroup.className = 'builder-form-group';
  
  const label = document.createElement('label');
  label.textContent = 'Choose Hero:';
  label.className = 'builder-label';
  formGroup.appendChild(label);

  const select = document.createElement('select');
  select.className = 'builder-select';
  state.heroes
    .filter(h => h.pet && h.petExploreDay !== getToday())
    .forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.pet || h.name;
      select.appendChild(opt);
    });

  if (select.options.length === 0) {
    const msg = document.createElement('div');
    msg.textContent = 'No pet available today';
    msg.style.textAlign = 'center';
    msg.style.padding = '20px';
    msg.style.color = '#666';
    modal.appendChild(msg);
    
    const btnRow = document.createElement('div');
    btnRow.className = 'builder-modal-buttons';
    
    const start = document.createElement('button');
    start.textContent = 'Play';
    start.className = 'btn btn-blue';
    start.disabled = true;
    btnRow.appendChild(start);
    
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.className = 'btn btn-lightyellow';
    close.onclick = () => removeOverlay(overlay);
    btnRow.appendChild(close);
    
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    appendOverlay(overlay);
    return;
  }

  formGroup.appendChild(select);
  modal.appendChild(formGroup);

  const btnRow = document.createElement('div');
  btnRow.className = 'builder-modal-buttons';

  const ok = document.createElement('button');
  ok.textContent = 'Start';
  ok.className = 'btn btn-celeste';
  ok.onclick = () => {
    const hero = state.heroMap.get(parseInt(select.value));
    if (hero) {
      currentPetHero = hero;
    }
    removeOverlay(overlay);
    callback(hero);
  };
  btnRow.appendChild(ok);

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn btn-lightyellow';
  cancel.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(cancel);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay);
  focusNoScroll(select);
}

function showAddPetPopup() {
  pauseTimersFor(3000);
  const available = state.heroes
    .filter(h => !h.pet)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  if (available.length === 0) {
    showAlert('All heroes already have pets');
    return;
  }
  if (state.heroes.filter(h => h.pet).length >= MAX_PETS) {
    showAlert('Pet limit reached');
    return;
  }
  let imgData = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.padding = '10px';
  const heroSel = document.createElement('select');
  available.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.name;
    heroSel.appendChild(opt);
  });
  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Pet name';
  const originInput = document.createElement('input');
  originInput.placeholder = 'Origin (optional)';
  const petOriginList = document.createElement('datalist');
  const petOriginListId = `pet-origin-${Date.now()}`;
  petOriginList.id = petOriginListId;
  getPetOrigins().forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    petOriginList.appendChild(opt);
  });
  originInput.setAttribute('list', petOriginListId);
  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.style.display = 'none';
  const imgBtn = document.createElement('button');
  imgBtn.textContent = 'Select image';
  imgBtn.className = 'btn btn-blue white-text';
  const imgNote = document.createElement('span');
  imgNote.textContent = '(optional)';
  const imgRow = document.createElement('div');
  imgRow.style.display = 'flex';
  imgRow.style.alignItems = 'center';
  imgRow.style.gap = '6px';
  imgBtn.style.flex = '0 0 33%';
  imgNote.style.flex = '1';
  imgRow.appendChild(imgBtn);
  imgRow.appendChild(imgNote);
  imgBtn.onclick = () => imgInput.click();
  imgInput.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      resizeImageToBase64(file, 160, 160, resized => { imgData = resized; });
      imgNote.textContent = file.name;
    } else {
      imgData = '';
      imgNote.textContent = '(optional)';
    }
  };
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const ok = document.createElement('button');
  ok.textContent = 'Add';
  ok.className = 'btn btn-blue white-text';
  ok.style.flex = '1';
  ok.onclick = () => {
    const hero = state.heroMap.get(parseInt(heroSel.value));
    const name = nameInput.value.trim();
    if (!hero || !name) { showAlert('Name required'); return; }
    hero.pet = name;
    hero.petOrigin = originInput.value.trim() || 'No origin';
    hero.petImg = imgData;
    hero.petLastCollection = Date.now();
    hero.petPendingCount = 0;
    hero.petResourceType = null;
    if (hero.petLevel === undefined) hero.petLevel = 1;
    if (hero.petExp === undefined) hero.petExp = 0;
    saveGame();
    const totalPets = state.heroes.filter(h => h.pet).length;
    const pages = Math.max(1, Math.ceil(totalPets / PETS_PER_PAGE));
    if (currentPetPage > pages) currentPetPage = pages;
    scheduleRenderHeroes();
    renderPets();
    renderVillage();
    updateResourcesDisplay();
    removeOverlay(overlay);
  };
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn btn-green white-text';
  cancel.style.flex = '1';
  cancel.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(cancel);
  modal.appendChild(heroSel);
  modal.appendChild(nameInput);
  modal.appendChild(originInput);
  modal.appendChild(petOriginList);
  modal.appendChild(imgRow);
  modal.appendChild(imgInput);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay);
  focusNoScroll(nameInput);
}

function showFreePetPopup() {
  pauseTimersFor(3000);
  const owned = state.heroes.filter(h => h.pet);
  if (owned.length === 0) {
    showAlert('No pets to free');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.padding = '10px';
  const select = document.createElement('select');
  owned.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = `${h.pet} (${h.name})`;
    select.appendChild(opt);
  });
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const ok = document.createElement('button');
  ok.textContent = 'Free';
  ok.className = 'btn btn-red white-text';
  ok.style.flex = '1';
  ok.onclick = () => {
    const hero = state.heroMap.get(parseInt(select.value));
    if (!hero) return;
    hero.pet = '';
    hero.petImg = '';
    hero.petOrigin = 'No origin';
    hero.petFavorite = false;
    hero.petLevel = 1;
    hero.petExp = 0;
    hero.petPendingCount = 0;
    hero.petResourceType = null;
    hero.petDesc = '';
    hero.petExploreDay = '';
    hero.petLastCollection = Date.now();
    saveGame();
    scheduleRenderHeroes();
    renderPets();
    renderVillage();
    updateResourcesDisplay();
    removeOverlay(overlay);
  };
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn btn-green white-text';
  cancel.style.flex = '1';
  cancel.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(cancel);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay);
  focusNoScroll(select);
}

function showChangePetOwnerPopup(currentHero) {
  pauseTimersFor(3000);
  const candidates = state.heroes.filter(h => !h.pet);
  if (candidates.length === 0) {
    showAlert('No heroes without pets');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.padding = '10px';
  const select = document.createElement('select');
  candidates.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.name;
    select.appendChild(opt);
  });
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const ok = document.createElement('button');
  ok.textContent = 'Change';
  ok.className = 'btn btn-blue white-text';
  ok.style.flex = '1';
  ok.onclick = () => {
    const newHero = state.heroMap.get(parseInt(select.value));
    if (!newHero) return;
    newHero.pet = currentHero.pet;
    newHero.petImg = currentHero.petImg;
    newHero.petOrigin = currentHero.petOrigin;
    newHero.petFavorite = currentHero.petFavorite;
    newHero.petLevel = currentHero.petLevel;
    newHero.petExp = currentHero.petExp;
    newHero.petPendingCount = currentHero.petPendingCount;
    newHero.petResourceType = currentHero.petResourceType;
    newHero.petDesc = currentHero.petDesc;
    newHero.petExploreDay = currentHero.petExploreDay;
    newHero.petLastCollection = currentHero.petLastCollection;

    currentHero.pet = '';
    currentHero.petImg = '';
    currentHero.petOrigin = 'No origin';
    currentHero.petFavorite = false;
    currentHero.petLevel = 1;
    currentHero.petExp = 0;
    currentHero.petPendingCount = 0;
    currentHero.petResourceType = null;
    currentHero.petDesc = '';
    currentHero.petExploreDay = '';
    currentHero.petLastCollection = Date.now();

    saveGame();
    scheduleRenderHeroes();
    renderPets();
    renderVillage();
    updateResourcesDisplay();
    removeOverlay(overlay);
  };
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn btn-green white-text';
  cancel.style.flex = '1';
  cancel.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(cancel);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay);
  focusNoScroll(select);
}

function chooseHeroes(count, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.padding = '10px';
  const perRow = Math.min(count, 5);
  const width = Math.max(perRow * 140 + 40, 520);
  modal.style.width = `${Math.min(width, window.innerWidth * 0.92)}px`;
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '10px';
  const rows = [];
  const rowCount = Math.ceil(count / perRow);
  for (let r = 0; r < rowCount; r++) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.justifyContent = 'center';
    rows.push(row);
    container.appendChild(row);
  }
  const avatars = [];
  const selects = [];
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    const img = document.createElement('img');
    img.className = 'modal-avatar empty';
    avatars[i] = img;
    const sel = document.createElement('select');
    selects[i] = sel;
    sel.addEventListener('change', () => { refreshOptions(); checkReady(); });
    wrap.appendChild(img);
    wrap.appendChild(sel);
    rows[Math.floor(i / perRow)].appendChild(wrap);
  }
  modal.appendChild(container);
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start';
  startBtn.className = 'btn btn-blue white-text';
  startBtn.style.flex = '1';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn btn-green white-text';
  cancel.style.flex = '1';
  cancel.onclick = () => removeOverlay(overlay);
  startBtn.onclick = () => {
    const ids = selects.map(s => parseInt(s.value));
    removeOverlay(overlay);
    callback(ids.map(id => state.heroMap.get(id)));
  };
  btnRow.appendChild(startBtn);
  btnRow.appendChild(cancel);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, document.getElementById('village-section'));

  function refreshOptions() {
    selects.forEach((sel, idx) => {
      const current = parseInt(sel.value) || null;
      sel.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = 'Choose Hero';
      opt.value = '';
      sel.appendChild(opt);
      state.heroes.forEach(h => {
        const already = selects.some((s, j) => j !== idx && parseInt(s.value) === h.id);
        if (!already && !isBusy(h)) {
          const o = document.createElement('option');
          o.value = h.id;
          o.textContent = h.name;
          if (h.id === current) o.selected = true;
          sel.appendChild(o);
        }
      });
    });
    refreshAvatars();
  }

  function refreshAvatars() {
    selects.forEach((sel, i) => {
      const img = avatars[i];
      const id = parseInt(sel.value);
      if (id) {
        const hero = state.heroMap.get(id);
        img.src = hero.avatar || EMPTY_SRC;
        img.style.objectPosition = `center ${hero.avatarOffset ?? 50}%`;
        if (!hero.avatar) img.classList.add('empty');
        else img.classList.remove('empty');
      } else {
        img.src = EMPTY_SRC;
        img.classList.add('empty');
      }
    });
  }

  function checkReady() {
    startBtn.disabled = selects.some(s => !parseInt(s.value));
  }

  refreshOptions();
  checkReady();
}

function renderWorkers(container, arr, allowEdit, prefix = "Worker", resource = "Gold") {
  container.innerHTML = "";
  container.className = "companions";
  const highlightMap = { Worker: 'Entertainer', Farmer: 'Farmer', Lumberjack: 'Lumberjack', Miner: 'Miner' };
  const highlightProf = highlightMap[prefix];
  arr.forEach((cid, idx) => {
    const slot = document.createElement("div");
    slot.className = "companion-slot";
    slot.title = `${prefix} ${idx + 1}`;

    if (cid) {
      const hero = state.heroMap.get(cid);
      if (hero) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "x";
        removeBtn.className = "remove-companion";
        removeBtn.disabled = !allowEdit;
        removeBtn.onclick = () => {
          if (!allowEdit) return;
          arr[idx] = null;
          saveGame();
          renderVillageChief();
          renderMissions();
          if (state.autoClickActive) {
            showChiefExtra("Autoclick enabled", () => {
              toggleAutoClick();
            });
          }
        };
        slot.appendChild(removeBtn);

        const img = document.createElement("img");
        img.src = hero.avatar || EMPTY_SRC;
        img.className = "avatar";
        if (!hero.avatar) img.classList.add("empty");
        slot.appendChild(img);

        const name = document.createElement("strong");
        const hasProf = highlightProf && (hero.professions || []).includes(highlightProf);
        name.textContent = hasProf ? `${professionIcons[highlightProf]} ${hero.name}` : hero.name;
        if (hasProf) name.style.color = '#b28d25';
        slot.appendChild(name);

        const level = document.createElement("div");
        const need = expNeededForLevel(hero.level);
        level.innerHTML = hero.level >= MAX_LEVEL
          ? `Lvl: ${hero.level}<br>EXP: ${hero.exp}`
          : `Lvl: ${hero.level}<br>EXP: ${hero.exp}/${need}`;
        slot.appendChild(level);
      } else {
        arr[idx] = null;
      }
    }

    if (!arr[idx]) {
      const select = document.createElement("select");
      const opt = document.createElement("option");
      opt.textContent = `${prefix} ${idx + 1}`;
      opt.value = "";
      select.appendChild(opt);
      state.heroes.forEach(h => {
        const alreadyUsed =
          state.companions.includes(h.id) ||
          state.farmers.includes(h.id) ||
          state.lumberjacks.includes(h.id) ||
          state.miners.includes(h.id);
        if (!alreadyUsed && !isBusy(h)) {
          const option = document.createElement("option");
          option.value = h.id;
          const hasProf = highlightProf && (h.professions || []).includes(highlightProf);
          option.textContent = hasProf ? `${professionIcons[highlightProf]} ${h.name}` : h.name;
          if (hasProf) option.style.color = '#b28d25';
          select.appendChild(option);
        }
      });
      select.onchange = e => {
        const id = parseInt(e.target.value);
        if (!id) return;
        arr[idx] = id;
        saveGame();
        renderVillageChief();
        renderMissions();
        if (state.autoClickActive) {
          showChiefExtra("Autoclick enabled", () => {
            toggleAutoClick();
          });
        }
      };
      slot.appendChild(select);
    }

    container.appendChild(slot);
  });
}

function renderAllCompanions(container, allowEdit) {
  container.innerHTML = "";
  container.className = "companions";
  const configs = [
    [state.companions, "Worker", "Gold"],
    [state.farmers, "Farmer", "Food"],
    [state.lumberjacks, "Lumberjack", "Wood"],
    [state.miners, "Miner", "Stone"],
  ];
  const highlightMap = { Worker: 'Entertainer', Farmer: 'Farmer', Lumberjack: 'Lumberjack', Miner: 'Miner' };
  configs.forEach(([arr, prefix, resource]) => {
    const highlightProf = highlightMap[prefix];
    const row = document.createElement("div");
    row.className = "companion-row";
    arr.forEach((cid, idx) => {
      const slot = document.createElement("div");
      slot.className = "companion-slot";
      slot.title = `${prefix} ${idx + 1}`;
      const label = document.createElement("div");
      label.className = "companion-label";
      label.textContent = `${prefix} ${idx + 1}`;
      slot.appendChild(label);

      if (cid) {
        const hero = state.heroMap.get(cid);
        if (hero) {
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "x";
          removeBtn.className = "remove-companion";
          removeBtn.disabled = !allowEdit;
          removeBtn.onclick = () => {
            if (!allowEdit) return;
            arr[idx] = null;
            saveGame();
            renderVillageChief();
            renderMissions();
            if (state.autoClickActive) {
              showChiefExtra("Autoclick enabled", () => {
                toggleAutoClick();
              });
            }
          };
          label.appendChild(removeBtn);

          const img = document.createElement("img");
          img.src = hero.avatar || EMPTY_SRC;
          img.className = "avatar";
          if (!hero.avatar) img.classList.add("empty");
          slot.appendChild(img);

          const name = document.createElement("strong");
          const hasProf = highlightProf && (hero.professions || []).includes(highlightProf);
          name.textContent = hasProf ? `${professionIcons[highlightProf]} ${hero.name}` : hero.name;
          if (hasProf) name.style.color = '#b28d25';
          slot.appendChild(name);

          const level = document.createElement("div");
          const need = expNeededForLevel(hero.level);
          level.innerHTML = hero.level >= MAX_LEVEL
            ? `Lvl: ${hero.level}<br>EXP: ${hero.exp}`
            : `Lvl: ${hero.level}<br>EXP: ${hero.exp}/${need}`;
          slot.appendChild(level);
        } else {
          arr[idx] = null;
        }
      }

      if (!arr[idx]) {
        const circle = document.createElement("div");
        circle.className = "companion-circle";
        slot.appendChild(circle);
        const select = document.createElement("select");
        const opt = document.createElement("option");
        opt.textContent = `${prefix} ${idx + 1}`;
        opt.value = "";
        select.appendChild(opt);
        state.heroes.forEach(h => {
          const alreadyUsed =
            state.companions.includes(h.id) ||
            state.farmers.includes(h.id) ||
            state.lumberjacks.includes(h.id) ||
            state.miners.includes(h.id);
          if (!alreadyUsed && !isBusy(h)) {
            const option = document.createElement("option");
            option.value = h.id;
            const hasProf = highlightProf && (h.professions || []).includes(highlightProf);
            option.textContent = hasProf ? `${professionIcons[highlightProf]} ${h.name}` : h.name;
            if (hasProf) option.style.color = '#b28d25';
            select.appendChild(option);
          }
        });
        if (prefix === 'Farmer' && state.food >= MAX_FOOD) {
          select.disabled = true;
          select.title = 'Storage Full';
        }
        if (prefix === 'Lumberjack' && state.wood >= MAX_WOOD) {
          select.disabled = true;
          select.title = 'Storage Full';
        }
        if (prefix === 'Miner' && state.stone >= MAX_STONE) {
          select.disabled = true;
          select.title = 'Storage Full';
        }
        select.onchange = e => {
          const id = parseInt(e.target.value);
          if (!id) return;
          arr[idx] = id;
          saveGame();
          renderVillageChief();
          renderMissions();
          if (state.autoClickActive) {
            showChiefExtra("Autoclick enabled", () => {
              toggleAutoClick();
            });
          }
        };
        slot.appendChild(select);
      }

      row.appendChild(slot);
    });
    container.appendChild(row);
  });
}

let lastAutoClickDisplay = "";
let autoClickFrame = null;
function updateAutoClickTimer() {
  const timerEl = document.getElementById("auto-click-timer");
  if (!timerEl) return;
  const remainingMs = Math.max(0, AUTOCLICK_INTERVAL_MS - (Date.now() - autoClickLastTick));
  const text = state.autoClickActive && !isMinigameActive
    ? `${Math.ceil(remainingMs / 1000)}s`
    : "";
  if (text === lastAutoClickDisplay) return;
  lastAutoClickDisplay = text;
  if (autoClickFrame) cancelAnimationFrame(autoClickFrame);
  autoClickFrame = rAF(() => {
    timerEl.textContent = text;
  });
}

function updateAutoClickButtonHeight() {
  const btn = document.getElementById("auto-click-btn");
  if (!btn) return;
  btn.style.minHeight = "24px";
}

export function updateBuildButtonHeight() {
  const houseCol = document.getElementById('build-house-column');
  if (houseCol) {
    const btn = houseCol.querySelector('button');
    if (btn) {
      btn.style.minHeight = state.buildingTask.time > 0 ? '' : '50px';
    }
  }
  document.querySelectorAll('#build-house-card button[id^="btn-"]').forEach(b => {
    const label = b.id.replace('btn-','');
    const t = state.upgradeTasks[label];
    b.style.minHeight = t && t.time > 0 ? '' : '50px';
  });
}

function updateSummonInputs() {
  const overlay = document.querySelector(".summon-overlay");
  if (!overlay) return;
  const disabled = state.heroes.length >= state.houses;
  overlay.querySelectorAll("input").forEach(i => {
    i.disabled = disabled;
  });
  const btn = overlay.querySelector("#summon-confirm-btn");
  if (btn) btn.disabled = disabled;
}

function formatTime(t) {
  // Solo mostrar minutos, redondeando hacia arriba
  const minutes = Math.max(0, Math.ceil(t / 60));
  return `${minutes}m`;
}

function fortuneAvailable() {
  return fortuneDay !== getToday();
}

function bossRushAvailable() {
  if (bossRushDay !== getToday()) {
    bossRushDay = getToday();
    bossRushCount = 0;
  }
  return bossRushCount < 5;
}

function enemyEncounterAvailable() {
  if (enemyDay !== getToday()) {
    enemyDay = getToday();
    enemyCount = 0;
  }
  return enemyCount < 5;
}

function chiefSurvivalAvailable() {
  if (chiefSurvivalDay !== getToday()) {
    chiefSurvivalDay = getToday();
    chiefSurvivalWins = 0;
  }
  return chiefSurvivalWins < 5;
}

function cleanupFightIntrudersDaily() {
  const today = getTodayKey();
  const lists = [
    (villageChief?.habilities || villageChief?.abilities || []),
    (villageChief?.partnerAbilities || partner?.abilities || [])
  ];
  for (const list of lists) {
    for (const a of list) {
      if (a?.fightIntrudersDay && a.fightIntrudersDay !== today) {
        delete a.fightIntrudersDay;
      }
    }
  }
}

function addGoldToTotal(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (typeof state?.money === 'number') state.money += amount;
  if (state?.resources?.gold?.value != null) state.resources.gold.value += amount;
  if (state?.resources?.gold?.amount != null) state.resources.gold.amount += amount;
  if (typeof window.gold === 'number') window.gold += amount;
  if (typeof updateResourcesDisplay === 'function') updateResourcesDisplay();
  if (typeof updateHUD === 'function') updateHUD();
}

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d) return;
  if (d.type === 'fightIntrudersAbilityUsed') {
    if (Number.isFinite(d.gold) && d.gold > 0) addGoldToTotal(d.gold);

    const today = d.today || getTodayKey();
    const chiefList   = (villageChief?.habilities || villageChief?.abilities || []);
    const partnerList = (villageChief?.partnerAbilities || partner?.abilities || []);
    const list = d.who === 'partner' ? partnerList : chiefList;
    const ab = list.find(a => a?.name === d.abilityName);
    if (ab) ab.fightIntrudersDay = today;

    if (typeof saveGame === 'function') saveGame();
  } else if (d.type === 'fightIntrudersReset') {
    villageChief?.habilities?.forEach(h => delete h.fightIntrudersDay);
    villageChief?.partnerAbilities?.forEach(a => delete a.fightIntrudersDay);
    if (typeof saveGame === 'function') saveGame();
  }
});

function startRest(hero) {
  if (hero.energia >= 100) return;
  const now = Date.now();
  const falta = 100 - hero.energia;
  const minutes = Math.ceil(falta / REST_ENERGY_GAIN);
  hero.restDuration = minutes;
  hero.restTime = minutes;
  hero.restStartTime = now;
  hero.lastRestTick = now;
  hero.lastEnergyShown = hero.energia;
  hero.lastTimeShown = hero.restTime;
  hero.energyEl = document.getElementById(`hero-energy-${hero.id}`);
  hero.lowEnergyEl = document.getElementById(`hero-low-energy-${hero.id}`);
  hero.restTimerEl = document.getElementById(`rest-timer-${hero.id}`);
  restingHeroes.add(hero);
  removeTimer(`rest_${hero.id}`);
  addTimer({
    id: `rest_${hero.id}`,
    type: 'rest',
    heroId: hero.id,
    startTime: now,
    lastTick: now,
    duration: hero.restDuration * REST_INTERVAL_MS,
    interval: REST_INTERVAL_MS,
    paused: false,
    completed: false,
  });
}

function updateRest(hero) {
  if (isMinigameActive) return;
  const energyChanged = hero.lastEnergyShown !== hero.energia;
  const timeChanged = hero.lastTimeShown !== hero.restTime;
  if (energyChanged || timeChanged) {
    const energyText = `${hero.energia}%`;
    const timerText = `${hero.restTime}m`;
    queueRestDomUpdate(hero, energyText, timerText);
    hero.lastEnergyShown = hero.energia;
    hero.lastTimeShown = hero.restTime;
  }
  if (hero.restTime <= 0 || hero.energia >= 100) {
    restingHeroes.delete(hero);
    hero.energyEl = null;
    hero.lowEnergyEl = null;
    hero.restTimerEl = null;
  }
}

function autoStartRest(hero) {
  if (hero.energia <= 0 && hero.restTime <= 0) {
    startRest(hero);
  }
}

function startAutoClick() {
  autoClickLastTick = Date.now();
  removeTimer('autoclick');
  addTimer({
    id: 'autoclick',
    type: 'autoclick',
    startTime: autoClickLastTick,
    lastTick: autoClickLastTick,
    duration: Number.MAX_SAFE_INTEGER,
    interval: AUTOCLICK_INTERVAL_MS,
    paused: false,
    completed: false,
  });
  updateAutoClickTimer();
}

const expBatch = [];

function autoClickTick() {
  expBatch.length = 0;
  let goldGain = 0;
  let foodGain = 0;
  let woodGain = 0;
  let stoneGain = 0;
  const groups = [
    [state.companions, amount => { goldGain += amount; }],
    [state.farmers, amount => { foodGain += amount; }],
    [state.lumberjacks, amount => { woodGain += amount; }],
    [state.miners, amount => { stoneGain += amount; }]
  ];
  groups.forEach(([arr, add]) => {
    arr.forEach((cid, idx) => {
      if (!cid) return;
      const h = state.heroMap.get(cid);
      if (!h || h.energia <= 0) {
        arr[idx] = null;
        if (h) autoStartRest(h);
        return;
      }
      add(AUTOCLICK_PRODUCE);
      expBatch.push(h);
      h.energia = Math.max(0, (h.energia || 0) - AUTOCLICK_ENERGY_COST);
      if (h.energia <= 0) {
        arr[idx] = null;
        autoStartRest(h);
      }
    });
  });
  expBatch.forEach(h => addHeroExp(h, 1));
  state.money += goldGain;
  state.food = Math.min(MAX_FOOD, state.food + foodGain);
  state.wood = Math.min(MAX_WOOD, state.wood + woodGain);
  state.stone = Math.min(MAX_STONE, state.stone + stoneGain);
  if (state.food >= MAX_FOOD) state.farmers.fill(null);
  if (state.wood >= MAX_WOOD) state.lumberjacks.fill(null);
  if (state.stone >= MAX_STONE) state.miners.fill(null);
  // Village Chief ya no gana experiencia con autoclick
  // if (villageChief.level < CHIEF_MAX_LEVEL) {
  //   addHeroExp(villageChief, 1, CHIEF_MAX_LEVEL);
  // }
  if (state.autoClickActive) {
    const active = [state.companions, state.farmers, state.lumberjacks, state.miners].some(arr => arr.some(Boolean));
    if (!active) {
      state.autoClickActive = false;
      stopAutoClick();
      renderVillageChiefIfVisible();
      renderMissions();
    }
  }
}

function stopAutoClick() {
  removeTimer('autoclick');
  updateAutoClickTimer();
  const btn = document.getElementById('auto-click-btn');
  if (btn) {
    btn.textContent = 'Enable autoclick';
    btn.disabled = false;
  }
  const row = document.getElementById('auto-click-row');
  if (row) row.innerHTML = '';
  updateAutoClickButtonHeight();
}

function clearAutoClickHeroesFromDailyMissions() {
  const autoHeroes = new Set([
    ...state.companions,
    ...state.farmers,
    ...state.lumberjacks,
    ...state.miners
  ]);
  for (const day in state.dailyMissions) {
    state.dailyMissions[day].forEach(slot => {
      if (slot.heroId && autoHeroes.has(slot.heroId)) {
        const hero = state.heroMap.get(slot.heroId);
        if (hero) {
          hero.missionTime = 0;
          hero.missionStartTime = 0;
          hero.missionDuration = 0;
          hero.state = { type: 'ready' };
          removeTimer(`daily_${slot.id}`);
        }
        slot.heroId = null;
        slot.completed = false;
        slot.completedHeroId = null;
      }
    });
  }
}

function toggleAutoClick() {
  state.autoClickActive = !state.autoClickActive;
  if (state.autoClickActive) {
    startAutoClick();
    clearAutoClickHeroesFromDailyMissions();
    showChiefExtra("Autoclick enabled");
  } else {
    stopAutoClick();
    if (currentChiefExtra === "Autoclick enabled") {
      const card = document.getElementById("chief-extra");
      if (card) {
        card.style.display = "none";
        card.innerHTML = "";
      }
      currentChiefExtra = "";
    }
  }
  scheduleSaveGame();
  scheduleRenderHeroes();
  renderVillageChief();
  renderMissions();
  renderDailyMissions();
}



export function buyTerrain() {
  const cost = getTerrainCost();
  if (state.terrain >= state.MAX_TERRAIN) return;
  if (state.money >= cost) {
    state.money -= cost;
    state.terrain += 1;
    recalcMaxHouses();
    updateResourcesDisplay();
    saveGame();
    renderTerrainsIfVisible();
    renderVillageChiefIfVisible();
    renderVillageIfVisible();
  }
}

function showResourceShop(opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  if (opts.container) overlay.classList.add('card-modal');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.width = '700px';

  const createRow = (label, buy, price = 1, potionKey = null, priceLabel = '') => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '4px';
    const text = document.createElement('span');
    text.style.display = 'inline-block';
    text.style.width = '100px';
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = '0';
    input.style.width = '60px';
    const getRemaining = () => {
      if (potionKey) return Infinity;
      if (label === 'Food') return MAX_FOOD - state.food;
      if (label === 'Wood') return MAX_WOOD - state.wood;
      if (label === 'Stone') return MAX_STONE - state.stone;
      return Infinity;
    };
    const getAvailable = () => {
      if (potionKey) return villageChief[potionKey] || 0;
      if (label === 'Food') return state.food;
      if (label === 'Wood') return state.wood;
      if (label === 'Stone') return state.stone;
      return Infinity;
    };
    const btn = document.createElement('button');
    const updateBtn = () => { btn.disabled = (parseInt(input.value) || 0) <= 0; };
    if (buy) {
      input.max = String(getRemaining());
      input.addEventListener('input', () => {
        const remaining = getRemaining();
        if (parseInt(input.value) > remaining) input.value = remaining;
        updateBtn();
      });
    } else {
      input.max = String(getAvailable());
      input.addEventListener('input', () => {
        const avail = getAvailable();
        if (parseInt(input.value) > avail) input.value = avail;
        updateBtn();
      });
    }
    updateBtn();
    btn.textContent = buy ? "Buy" : "Sell";
    btn.className = "btn btn-blue";
    btn.style.width = "80px";
    btn.style.flex = '1';
    btn.onclick = () => {
      const val = parseInt(input.value) || 0;
      if (val <= 0) return;
      if (buy) {
        const cost = val * price;
        if (state.money < cost) return;
        state.money -= cost;
        if (potionKey) {
          villageChief[potionKey] = (villageChief[potionKey] || 0) + val;
        } else {
          if (label === 'Food') state.food = Math.min(MAX_FOOD, state.food + val);
          if (label === 'Wood') state.wood = Math.min(MAX_WOOD, state.wood + val);
          if (label === 'Stone') state.stone = Math.min(MAX_STONE, state.stone + val);
        }
      } else {
        const gain = val * price;
        if (potionKey) {
          const owned = villageChief[potionKey] || 0;
          if (owned >= val) {
            villageChief[potionKey] = owned - val;
            state.money += gain;
          }
        } else {
          if (label === 'Food' && state.food >= val) { state.food -= val; state.money += gain; }
          if (label === 'Wood' && state.wood >= val) { state.wood -= val; state.money += gain; }
          if (label === 'Stone' && state.stone >= val) { state.stone -= val; state.money += gain; }
        }
      }
      updateResourcesDisplay();
      saveGame();
      if (currentChiefExtra === "Autoclick enabled") {
        const cont = document.querySelector('#chief-extra .companions');
        if (cont) {
          renderAllCompanions(cont, true);
        } else {
          showChiefExtra("Autoclick enabled");
        }
      }
      renderVillageIfVisible();
      if (buy) input.max = String(getRemaining());
      else input.max = String(getAvailable());
      input.value = '0';
      updateBtn();
    };
    row.append(text, input, btn);
    if (priceLabel) {
      const priceInfo = document.createElement('span');
      priceInfo.textContent = priceLabel;
      priceInfo.style.marginLeft = '4px';
      row.appendChild(priceInfo);
    }
    return row;
  };

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '20px';
  const sellCol = document.createElement('div');
  const sellTitle = document.createElement('strong');
  sellTitle.textContent = 'Sell Items (5 Gold each)';
  sellTitle.style.display = 'block';
  sellTitle.style.marginBottom = '3px';
  sellCol.appendChild(sellTitle);
  sellCol.appendChild(createRow('Food', false, 5));
  sellCol.appendChild(createRow('Wood', false, 5));
  sellCol.appendChild(createRow('Stone', false, 5));
  const buyCol = document.createElement('div');
  const buyTitle = document.createElement('strong');
  buyTitle.textContent = 'Buy Items (20 Gold each)';
  buyTitle.style.display = 'block';
  buyTitle.style.marginBottom = '3px';
  buyCol.appendChild(buyTitle);
  buyCol.appendChild(createRow('Food', true, 20));
  buyCol.appendChild(createRow('Wood', true, 20));
  buyCol.appendChild(createRow('Stone', true, 20));
  wrap.appendChild(sellCol);
  wrap.appendChild(buyCol);
  modal.appendChild(wrap);

  const potWrap = document.createElement('div');
  potWrap.style.display = 'flex';
  potWrap.style.gap = '20px';
  const potBuyCol = document.createElement('div');
  const potBuyTitle = document.createElement('strong');
  potBuyTitle.textContent = 'Buy Potions';
  potBuyTitle.style.display = 'block';
  potBuyTitle.style.marginBottom = '3px';
  potBuyCol.appendChild(potBuyTitle);
  potBuyCol.appendChild(createRow('Healing Potion', true, 5, 'hpPotions', '(5 Gold each)'));
  potBuyCol.appendChild(createRow('Mana Potion', true, 5, 'manaPotions', '(5 Gold each)'));
  potBuyCol.appendChild(createRow('Energy Potion', true, 10, 'energyPotions', '(10 Gold each)'));
  potBuyCol.appendChild(createRow('Exp Potion', true, 20, 'expPotions', '(20 Gold each)'));
  const potSellCol = document.createElement('div');
  const potSellTitle = document.createElement('strong');
  potSellTitle.textContent = 'Sell Potions';
  potSellTitle.style.display = 'block';
  potSellTitle.style.marginBottom = '3px';
  potSellCol.appendChild(potSellTitle);
  potSellCol.appendChild(createRow('Healing Potion', false, 2, 'hpPotions', '(2 Gold each)'));
  potSellCol.appendChild(createRow('Mana Potion', false, 2, 'manaPotions', '(2 Gold each)'));
  potSellCol.appendChild(createRow('Energy Potion', false, 5, 'energyPotions', '(5 Gold each)'));
  potSellCol.appendChild(createRow('Exp Potion', false, 10, 'expPotions', '(10 Gold each)'));
  potWrap.appendChild(potBuyCol);
  potWrap.appendChild(potSellCol);
  modal.appendChild(potWrap);

  const closeBottom = document.createElement('button');
  closeBottom.textContent = 'Close';
  closeBottom.className = 'btn btn-green white-text';
  closeBottom.style.marginTop = '20px';
  closeBottom.onclick = () => removeOverlay(overlay);
  modal.appendChild(closeBottom);

  overlay.appendChild(modal);
  if (opts.container) {
    if (getComputedStyle(opts.container).position === 'static') {
      opts.container.style.position = 'relative';
    }
    opts.container.appendChild(overlay);
  } else {
    appendOverlay(overlay);
  }
}


function showGamesShop() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.width = 'min(700px, 92vw)';
  const close = document.createElement('button');
  close.textContent = '❌';
  close.className = 'close-btn';
  close.onclick = () => removeOverlay(overlay);
  modal.appendChild(close);

  const grid = document.createElement('div');
  grid.className = 'shop-grid';
  for (let i = 1; i <= 5; i++) {
    const item = document.createElement('div');
    item.className = 'shop-item';
    item.textContent = `Item ${i}`;
    const buy = document.createElement('button');
    buy.textContent = 'Buy';
    buy.className = 'btn btn-blue';
    item.appendChild(buy);
    grid.appendChild(item);
  }
  modal.appendChild(grid);

  const closeBottom = document.createElement('button');
  closeBottom.textContent = 'Close';
  closeBottom.className = 'btn btn-green white-text';
  closeBottom.style.marginTop = '20px';
  closeBottom.onclick = () => removeOverlay(overlay);
  modal.appendChild(closeBottom);

  overlay.appendChild(modal);
  appendOverlay(overlay);
  overlay.tabIndex = -1;
  focusNoScroll(overlay);
}

function renderVillageChief() {
  recalcSummonCost();
  const container = document.getElementById("village-chief");
  if (!container) return;
  const savedExtra = document.getElementById("chief-extra");
  Array.from(container.children).forEach(child => {
    if (child !== savedExtra) child.remove();
  });

  const card = document.createElement("div");
  card.className = "chief-card";

  const avatarCol = document.createElement("div");
  avatarCol.className = "chief-avatar-col";

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "avatar-wrap";
  const readOnly = currentView === "profiles";

  const img = document.createElement("img");
  img.src = villageChief.avatar || EMPTY_SRC;
  img.className = "avatar chief-avatar";
  img.style.objectPosition = `${villageChief.avatarOffsetX ?? 50}% ${villageChief.avatarOffset ?? 50}%`;
  if (!villageChief.avatar) img.classList.add("empty");
  if (!readOnly) {
    img.title = "Edit Image (500x500px recommended)";
    img.onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.style.display = "none";
      input.onchange = e => {
        const reader = new FileReader();
        reader.onload = ev => {
          villageChief.avatar = ev.target.result;
          saveGame();
          renderVillageChief();
        };
        reader.readAsDataURL(e.target.files[0]);
      };
      input.click();
    };
  }

  const zoom = document.createElement("div");
  zoom.className = "zoom-icon";
  zoom.textContent = "🔍";
  zoom.classList.toggle("disabled", !villageChief.avatar);
  zoom.onclick = e => {
    e.stopPropagation();
    if (zoom.classList.contains("disabled")) return;
    showZoomImage(img.src, card);
  };
  avatarWrap.appendChild(img);
  avatarWrap.appendChild(zoom);
  if (!readOnly) {
    addMoveArrows(avatarWrap, img, villageChief, 'avatarOffset', false, 'avatarOffsetX');
  }

  const chiefExpNeeded = expNeededForLevel(villageChief.level, CHIEF_MAX_LEVEL);
  const chiefExpText =
    villageChief.level >= CHIEF_MAX_LEVEL
      ? `Exp: ${villageChief.exp}`
      : `Exp: ${villageChief.exp}/${chiefExpNeeded}`;

  const chiefName = document.createElement('div');
  chiefName.className = 'chief-name';
  chiefName.textContent = villageChief.name;
  chiefName.style.cursor = readOnly ? 'default' : 'pointer';
  chiefName.title = readOnly ? '' : 'Edit Name';
  if (!readOnly) {
    chiefName.onclick = () => {
      openEditModal('Name', villageChief.name, nuevo => {
        if (nuevo) {
          villageChief.name = nuevo;
          saveGame();
          renderVillageChief();
        }
      }, {container: card});
    };
  }
  avatarCol.appendChild(chiefName);
  avatarCol.appendChild(avatarWrap);
  const chiefLevel = document.createElement('div');
  chiefLevel.className = 'chief-level';
  chiefLevel.textContent = `Level: ${villageChief.level}/${CHIEF_MAX_LEVEL} ${chiefExpText}`;
  avatarCol.appendChild(chiefLevel);

  // Crear el reproductor de música fijo en la esquina superior derecha
  let musicSlot = document.getElementById("chiefMusicSlot");
  if (!musicSlot) {
    musicSlot = document.createElement("div");
    musicSlot.id = "chiefMusicSlot";
    document.body.appendChild(musicSlot);
  }
  musicSlot.innerHTML = `<div class="mini-player" id="sywPlayer">
  <div class="manage-row">
    <span class="music-emoji">🎵</span>
    <button id="sywChange">ChangeSong</button>
    <button id="sywAdd">AddMusic</button>
    <button id="sywRemove">RemoveMusic</button>
    <button id="sywMinimize">–</button>
  </div>
  <div class="controls-row">
    <div class="controls">
      <button id="sywMute"  title="Mute/Unmute" aria-label="Mute">🔊</button>
      <button id="sywPrev"  title="Previous"    aria-label="Previous">⏮</button>
      <button id="sywPlay"  title="Play/Pause"  aria-label="Play">▶</button>
      <button id="sywNext"  title="Next"        aria-label="Next">⏭</button>
    </div>
    <div class="title-wrap">
      <div class="title" id="sywTitle" title="—">—</div>
    </div>
  </div>
  <div class="progress-row">
    <span id="sywCurrent">00:00</span>
    <input type="range" id="sywSeek" min="0" value="0">
    <span id="sywDuration">00:00</span>
  </div>
</div>`;

  card.appendChild(avatarCol);

  const info = document.createElement('div');
  info.className = 'info-section';

  card.appendChild(info);

  // Botones Stats e Inventory en la segunda columna
  const statsInventoryRow = document.createElement('div');
  statsInventoryRow.style.display = 'flex';
  statsInventoryRow.style.gap = '4px';
  statsInventoryRow.style.justifyContent = 'center';

  const bossStatsBtn = document.createElement("button");
  bossStatsBtn.textContent = "Stats";
  bossStatsBtn.className = "btn btn-green";
  bossStatsBtn.style.flex = "1";
  bossStatsBtn.onclick = () => {
    openBossStats = !openBossStats;
    renderVillageChief();
  };
  statsInventoryRow.appendChild(bossStatsBtn);

  const inventoryBtn = document.createElement("button");
  inventoryBtn.textContent = "Inventory";
  inventoryBtn.className = "btn btn-green";
  inventoryBtn.style.flex = "1";
  inventoryBtn.onclick = () => {
    openChiefInventory = !openChiefInventory;
    renderVillageChief();
  };
  statsInventoryRow.appendChild(inventoryBtn);

  info.appendChild(statsInventoryRow);

  // Abilities y LearnAbility en la misma fila
  const abilityRow = document.createElement('div');
  abilityRow.style.display = 'flex';
  abilityRow.style.gap = '4px';
  abilityRow.style.marginTop = '8px';
  abilityRow.style.justifyContent = 'center';

  const habilitiesBtn = document.createElement("button");
  habilitiesBtn.textContent = "Abilities";
  habilitiesBtn.className = "btn btn-green";
  habilitiesBtn.style.flex = "1";
  habilitiesBtn.onclick = () => {
      if (!openChiefHabilities) {
        openChiefFamiliars = false;
        openChiefPopulation = false;
        chiefHabilitySort = 'number';
        chiefHabilityPage = 1;
      }
    openChiefHabilities = !openChiefHabilities;
    renderVillageChief();
  };
  abilityRow.appendChild(habilitiesBtn);

  // Botón LearnAbility en la misma fila
  const learnAbilityBtn = document.createElement("button");
  learnAbilityBtn.id = "ability-btn";
  const abilityCost = 1000 * (unlockedHabilities + 1);
  learnAbilityBtn.textContent = "LearnAbility";
  learnAbilityBtn.className = "btn btn-green";
  learnAbilityBtn.style.flex = "1";
  learnAbilityBtn.onclick = () => {
    openConfirm({
      message: `Spend ${abilityCost} Gold to learn an ability?`,
      container,
      onConfirm: learnAbility,
    });
  };
  learnAbilityBtn.disabled = state.money < abilityCost || unlockedHabilities >= HABILITY_COUNT;
  if (learnAbilityBtn.disabled && state.money < abilityCost) learnAbilityBtn.title = "Not enough Gold";
  abilityRow.appendChild(learnAbilityBtn);

  info.appendChild(abilityRow);

  // Shop, DailyTribute y HeroOrders en la misma fila
  const actionRow = document.createElement('div');
  actionRow.style.display = 'flex';
  actionRow.style.gap = '4px';
  actionRow.style.marginTop = '8px';
  actionRow.style.justifyContent = 'center';

  const shopBtn = document.createElement("button");
  shopBtn.textContent = "Shop";
  shopBtn.className = "btn btn-yellow";
  shopBtn.style.flex = "1";
  shopBtn.onclick = () => showResourceShop();
  actionRow.appendChild(shopBtn);

  const pB2 = document.createElement("button");
  pB2.id = "daily-tribute-btn";
  pB2.textContent = "DailyTribute";
  pB2.className = "btn btn-lightred";
  pB2.style.flex = "1";
  const dtToday = new Date().toDateString();
  const claimedTribute = villageChief.dailyTributeDate === dtToday;
  let dtTitle;
  if (claimedTribute) {
    dtTitle = "Claimed! Next collection available tomorrow.";
    const r = villageChief.dailyTributeRewards;
    if (r) {
      dtTitle += `\n${r.totalGold} Gold`;
      if (r.potionSummary) dtTitle += `, ${r.potionSummary}`;
    }
  } else {
    dtTitle = "Claim your daily tribute";
  }
  pB2.title = dtTitle;
  pB2.onclick = showDailyTribute;
  actionRow.appendChild(pB2);

  info.appendChild(actionRow);

  // Fila de AssignAutoclickers y CancelAutoclick
  const autoclickManagementRow = document.createElement('div');
  autoclickManagementRow.style.display = 'flex';
  autoclickManagementRow.style.gap = '4px';
  autoclickManagementRow.style.marginTop = '8px';
  autoclickManagementRow.style.justifyContent = 'center';

  const assignAutoBtn = document.createElement('button');
  assignAutoBtn.id = 'assign-autoclickers-btn';
  assignAutoBtn.textContent = 'FillAutoclickers';
  assignAutoBtn.className = 'btn btn-green';
  assignAutoBtn.style.flex = '1';
  assignAutoBtn.onclick = () => {
    if (autoAssignStage === 0) {
      assignAutoBtn.textContent = 'Enable Autoclic';
      autoAssignStage = 1;
      return;
    }
    const readyHeroes = state.heroes.filter(h =>
      h.state?.type === 'ready' &&
      !isBusy(h) &&
      h.restTime <= 0 &&
      !state.companions.includes(h.id) &&
      !state.farmers.includes(h.id) &&
      !state.lumberjacks.includes(h.id) &&
      !state.miners.includes(h.id)
    );
    const groups = [
      { arr: state.companions, check: () => true },
      { arr: state.farmers, check: () => state.food < MAX_FOOD },
      { arr: state.lumberjacks, check: () => state.wood < MAX_WOOD },
      { arr: state.miners, check: () => state.stone < MAX_STONE }
    ];
    let gIndex = 0;
    readyHeroes.forEach(h => {
      let attempts = 0;
      while (attempts < groups.length) {
        const g = groups[gIndex];
        const slot = g.arr.indexOf(null);
        if (slot !== -1 && g.check()) {
          g.arr[slot] = h.id;
          gIndex = (gIndex + 1) % groups.length;
          return;
        }
        gIndex = (gIndex + 1) % groups.length;
        attempts++;
      }
    });
    if (!state.autoClickActive) toggleAutoClick();
    saveGame();
    scheduleRenderHeroes();
    renderVillageChief();
    renderMissions();
    autoAssignStage = 0;
    assignAutoBtn.textContent = 'FillAutoclickers';
    // Actualizar vista de autoclickers si está abierta
    if (currentChiefExtra === "Autoclick enabled") {
      showChiefExtra("Autoclick enabled");
    }
  };
  autoclickManagementRow.appendChild(assignAutoBtn);

  const cancelAutoClickBtn = document.createElement('button');
  cancelAutoClickBtn.textContent = 'RemoveAutoclickers';
  cancelAutoClickBtn.className = 'btn btn-red';
  cancelAutoClickBtn.style.flex = '1';
  cancelAutoClickBtn.onclick = () => {
    state.companions.fill(null);
    state.farmers.fill(null);
    state.lumberjacks.fill(null);
    state.miners.fill(null);
    if (state.autoClickActive) toggleAutoClick();
    autoAssignStage = 0;
    const assignBtn = document.getElementById('assign-autoclickers-btn');
    if (assignBtn) assignBtn.textContent = 'FillAutoclickers';
    scheduleRenderHeroes();
    renderVillageChief();
    // Actualizar vista de autoclickers si está abierta
    if (currentChiefExtra === "Autoclick enabled") {
      showChiefExtra("Autoclick enabled");
    }
  };
  autoclickManagementRow.appendChild(cancelAutoClickBtn);

  info.appendChild(autoclickManagementRow);

  // Enable autoclic centrado debajo de AssignAutoclickers/CancelAutoclic
  const autoBtn = document.createElement("button");
  autoBtn.id = "auto-click-btn";
  autoBtn.textContent = state.autoClickActive ? "Disable autoclic" : "Enable autoclic";
  autoBtn.className = "btn btn-lightyellow";
  autoBtn.style.marginTop = "1px";
  autoBtn.style.minHeight = "24px";
  autoBtn.style.color = "#fff";
  autoBtn.onclick = toggleAutoClick;
  const allGroups = [state.companions, state.farmers, state.lumberjacks, state.miners];
  const companionBusy = allGroups.some(group =>
    group.some(cid => {
      const h = state.heroMap.get(cid);
      return h && isBusy(h);
    })
  );
  if (state.autoClickActive && companionBusy) {
    autoBtn.disabled = true;
  }
  const autoWrap = document.createElement("div");
  autoWrap.id = "auto-click-wrap";
  autoWrap.style.display = "flex";
  autoWrap.style.flexDirection = "column";
  autoWrap.style.alignItems = "center";
  autoWrap.style.width = "100%";
  autoWrap.appendChild(autoBtn);
  const timerRow = document.createElement("div");
  timerRow.id = "auto-click-row";
  timerRow.style.display = "flex";
  timerRow.style.alignItems = "center";
  timerRow.style.justifyContent = "center";
  timerRow.style.gap = "8px";
  timerRow.style.width = "100%";
  timerRow.style.marginTop = "4px";
  if (state.autoClickActive) {
    const down = document.createElement("button");
    down.textContent = "\u25BC";
    down.className = "down-small";
    down.style.marginTop = "2px";
    down.onclick = () => {
      if (currentChiefExtra !== "Autoclick enabled") {
        showChiefExtra("Autoclick enabled");
      } else {
        const card = document.getElementById("chief-extra");
        if (card) { card.innerHTML = ""; card.style.display = "none"; }
        currentChiefExtra = "";
        updateAutoClickButtonHeight();
      }
    };
    timerRow.appendChild(down);
    const stop = document.createElement("button");
    stop.textContent = "\u274C";
    stop.className = "close-small";
    stop.style.marginTop = "2px";
    stop.onclick = toggleAutoClick;
    timerRow.appendChild(stop);
  }
  autoWrap.appendChild(timerRow);
  // removed timer display
  updateAutoClickButtonHeight();

  const autoCard = document.createElement("div");
  autoCard.style.marginTop = "10px";
  autoCard.appendChild(autoWrap);
  info.appendChild(autoCard);

  // Productivity tabs en la tercera columna
  const prodCol = document.createElement("div");
  prodCol.className = "chief-action-col";
  prodCol.style.gap = "4px";
  prodCol.style.marginLeft = "4px";

  const prodTabs = [
    { id: 'life', label: 'LifeMissions' },
    { id: 'diary', label: 'Diary' },
    { id: 'weekplan', label: 'WeekPlan' },
    { id: 'habits', label: 'HabitsCalendar' },
    { id: 'projects', label: 'Projects' },
    { id: 'silence', label: 'SilenceTemple' },
    { id: 'pomodoro', label: 'PomodoroTower' }
  ];

  // Crear filas para agrupar botones en pares
  const createRow = (btn1Config, btn2Config) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '4px';
    row.style.width = '100%';
    row.style.marginTop = '4px';
    
    [btn1Config, btn2Config].forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'population-tab';
      btn.textContent = label;
      btn.style.flex = '1';
      btn.onclick = () => {
        if (id === 'silence') {
          showSilenceTempleModal();
        } else if (id === 'pomodoro') {
          showPomodoroTowerModal();
        } else {
          const extraCard = document.getElementById('chief-extra');
          if (!extraCard) return;
          
          if (currentChiefExtra === label) {
            extraCard.innerHTML = '';
            extraCard.style.display = 'none';
            currentChiefExtra = '';
          } else {
            extraCard.innerHTML = '';
            extraCard.style.display = 'block';
            extraCard.style.position = 'relative';
            currentChiefExtra = label;
            
            if (id === 'life') {
              renderLifeMissions(extraCard);
            } else if (id === 'diary') {
              renderDiary(extraCard);
            } else if (id === 'weekplan') {
              renderWeekPlan(extraCard);
            } else if (id === 'habits') {
              renderHabits(extraCard);
            } else if (id === 'projects') {
              // Mostrar animación de experiencia la primera vez
              showExpGainAnimation('projects', extraCard);
              
              const iframe = document.createElement('iframe');
              iframe.className = 'html-game-frame';
              iframe.src = GAME_SOURCES.Projects;
              iframe.onload = () => {
                try {
                  const chiefAbilities = (villageChief.habilities || [])
                    .slice(0, villageChief.unlockedHabilities ?? unlockedHabilities)
                    .map((a, idx) => ({
                      id: a.id ?? a.number ?? String(idx + 1),
                      label: a.label ?? a.name ?? `Ability ${idx + 1}`,
                      name: a.name ?? a.label ?? `Ability ${idx + 1}`,
                      level: a.level ?? a.lvl ?? a.abilityLevel ?? a.lvlAbility ?? a.skillLevel ?? 1
                    }));
                  iframe.contentWindow.postMessage({
                    type: 'projectsData',
                    partner: {
                      unlockedPartnerAbilities: villageChief.unlockedHabilities ?? unlockedHabilities,
                      abilities: chiefAbilities
                    }
                  }, '*');
                } catch {}
              };
              extraCard.appendChild(iframe);
            }
          }
        }
      };
      row.appendChild(btn);
    });
    return row;
  };
  
  // Primera fila: LifeMissions y Diary
  const row1 = createRow(prodTabs[0], prodTabs[1]);
  row1.style.marginTop = '0';
  prodCol.appendChild(row1);
  
  // Segunda fila: WeekPlan y HabitsCalendar
  prodCol.appendChild(createRow(prodTabs[2], prodTabs[3]));
  
  // Resto de botones individuales (Projects, SilenceTemple, PomodoroTower)
  prodTabs.slice(4).forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'population-tab';
    btn.textContent = label;
    btn.style.marginTop = '4px';
    btn.style.width = '100%';
    btn.onclick = () => {
      if (id === 'silence') {
        showSilenceTempleModal();
      } else if (id === 'pomodoro') {
        showPomodoroTowerModal();
      } else {
        const extraCard = document.getElementById('chief-extra');
        if (!extraCard) return;
        
        if (currentChiefExtra === label) {
          extraCard.innerHTML = '';
          extraCard.style.display = 'none';
          currentChiefExtra = '';
        } else {
          extraCard.innerHTML = '';
          extraCard.style.display = 'block';
          extraCard.style.position = 'relative';
          currentChiefExtra = label;
          
          if (id === 'projects') {
            const iframe = document.createElement('iframe');
            iframe.className = 'html-game-frame';
            iframe.src = GAME_SOURCES.Projects;
            iframe.onload = () => {
              try {
                const chiefAbilities = (villageChief.habilities || [])
                  .slice(0, villageChief.unlockedHabilities ?? unlockedHabilities)
                  .map((a, idx) => ({
                    id: a.id ?? a.number ?? String(idx + 1),
                    label: a.label ?? a.name ?? `Ability ${idx + 1}`,
                    name: a.name ?? a.label ?? `Ability ${idx + 1}`,
                    level: a.level ?? a.lvl ?? a.abilityLevel ?? a.lvlAbility ?? a.skillLevel ?? 1
                  }));
                iframe.contentWindow.postMessage({
                  type: 'projectsData',
                  partner: {
                    unlockedPartnerAbilities: villageChief.unlockedHabilities ?? unlockedHabilities,
                    abilities: chiefAbilities
                  }
                }, '*');
              } catch {}
            };
            extraCard.appendChild(iframe);
          }
          
          const closeBtn = document.createElement('button');
          closeBtn.textContent = '❌';
          closeBtn.className = 'close-btn';
          closeBtn.style.position = 'absolute';
          closeBtn.style.top = '8px';
          closeBtn.style.right = '8px';
          closeBtn.style.zIndex = '10';
          closeBtn.onclick = () => {
            extraCard.innerHTML = '';
            extraCard.style.display = 'none';
            currentChiefExtra = '';
          };
          extraCard.appendChild(closeBtn);
        }
      }
    };
    prodCol.appendChild(btn);
  });

  card.appendChild(prodCol);

  if (currentView === "profiles") {
    shopBtn.style.display = "none";
    autoWrap.style.display = "none";
    unlockBtn.style.display = "none";
  }


  const statsDiv = document.createElement("div");
  statsDiv.className = "stats";
  statsDiv.id = "boss-stats";
  if (openBossStats) statsDiv.classList.add("expand-row");
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "❌";
  closeBtn.className = "close-btn";
  closeBtn.onclick = () => {
    statsDiv.classList.remove("expand-row");
    openBossStats = false;
    renderVillageChief();
  };
  statsDiv.appendChild(closeBtn);
  const columns = document.createElement("div");
  columns.className = "stats-columns";
  const col = document.createElement("div");
  col.className = "stats-column";
  const title = document.createElement("div");
  title.className = "stats-column-title";
  title.textContent = "Stats";
  col.appendChild(title);
  const grid = document.createElement("div");
  grid.className = "stats-grid";
  const order = [
    "fuerza",
    "suerte",
    "inteligencia",
    "destreza",
    "defensa",
    "vida",
    "mana",
  ];
  const labels = {
    fuerza: "Strength",
    suerte: "Luck",
    inteligencia: "Intelligence",
    destreza: "Dexterity",
    defensa: "Defense",
    vida: "HP",
    mana: "Mana",
  };
  order.forEach(stat => {
    const line = document.createElement("div");
    line.className = "stat-line";
    const span = document.createElement("span");
    span.textContent = `${labels[stat]}: ${bossStats[stat]}`;
    line.appendChild(span);
    grid.appendChild(line);
  });
  col.appendChild(grid);
  columns.appendChild(col);
  statsDiv.appendChild(columns);
  card.appendChild(statsDiv);

  const invDiv = document.createElement("div");
  invDiv.className = "stats";
  invDiv.id = "boss-inventory";
  if (openChiefInventory) invDiv.classList.add("expand-row");
  const closeInv = document.createElement("button");
  closeInv.textContent = "❌";
  closeInv.className = "close-btn";
  closeInv.onclick = () => { openChiefInventory = false; invDiv.classList.remove("expand-row"); };
  invDiv.appendChild(closeInv);
  const invCols = document.createElement("div");
  invCols.className = "stats-columns";
  const potCol = document.createElement("div");
  potCol.className = "stats-column";
  const potTitle = document.createElement("div");
  potTitle.className = "stats-column-title";
  potTitle.textContent = "Chief Potions";
  potCol.appendChild(potTitle);
  [
    ["hpPotions","HealingPotions"],
    ["manaPotions","ManaPotions"],
    ["energyPotions","EnergyPotions"],
    ["expPotions","ExpPotions"]
  ].forEach(([key,label]) => {
    const line = document.createElement("div");
    line.className = "potion-item";
    const span = document.createElement("span");
    span.textContent = `${label}: ${villageChief[key]}`;
    line.appendChild(span);
    potCol.appendChild(line);
  });
  invCols.appendChild(potCol);
  invDiv.appendChild(invCols);
  card.appendChild(invDiv);

  const famDiv = document.createElement("div");
  famDiv.className = "stats";
  famDiv.id = "boss-familiars";
  if (openChiefFamiliars) famDiv.classList.add("expand-row");
  const closeFam = document.createElement("button");
  closeFam.textContent = "❌";
  closeFam.className = "close-btn";
  closeFam.onclick = () => {
    openChiefFamiliars = false;
    renderVillageChief();
  };
  famDiv.appendChild(closeFam);
  const famTitle = document.createElement('div');
  famTitle.textContent = 'My Familiars';
  famTitle.style.fontWeight = 'bold';
  famTitle.style.alignSelf = 'flex-start';
  famDiv.appendChild(famTitle);
  const famGrid = document.createElement("div");
  famGrid.className = "familiars-grid";
  const famWrapper = document.createElement('div');
  famWrapper.className = 'scroll-wrapper';
  famWrapper.appendChild(famGrid);
  const famSortBar = document.createElement('div');
  famSortBar.className = 'sort-bar';
  ['number','name','level','modified'].forEach(opt=>{
    const b=document.createElement('button');
    b.className='button';
    const labels={name:'Order by Name',level:'Order by Level',number:'Order by Number',modified:'Order by LastModification'};
    b.textContent=labels[opt];
    b.disabled=chiefFamiliarSort===opt;
    b.onclick=()=>{chiefFamiliarSort=opt;renderVillageChief();};
    famSortBar.appendChild(b);
  });
  famDiv.appendChild(famSortBar);
  let famList = villageChief.familiars.slice().sort((a,b)=>{
    if(chiefFamiliarSort==='name') return a.name.localeCompare(b.name);
    if(chiefFamiliarSort==='level') return (b.level||1)-(a.level||1);
    if(chiefFamiliarSort==='number') return (a.number||0)-(b.number||0);
    return (b.modified||0)-(a.modified||0);
  });
  const famPages = CHIEF_MAX_PAGES;
  if (chiefFamiliarPage > famPages) chiefFamiliarPage = famPages;
  const famStart = (chiefFamiliarPage - 1) * CHIEF_ITEMS_PER_PAGE;
  famList = famList.slice(famStart, famStart + CHIEF_ITEMS_PER_PAGE);
  famList.forEach((fam, idx) => {
    const globalIdx = famStart + idx;
    const slot = document.createElement("div");
    slot.className = "familiar-slot";
    if (globalIdx >= villageChief.unlockedFamiliars) slot.classList.add("locked");
    const num = document.createElement('div');
    num.className = 'slot-number';
    num.textContent = fam.number ?? globalIdx + 1;
    slot.appendChild(num);
    const imgDiv = document.createElement("div");
    imgDiv.className = "slot-img familiar-img";
    if (fam.img) imgDiv.style.backgroundImage = `url(${fam.img})`;
    imgDiv.style.backgroundPosition = `center ${fam.imgOffset ?? 50}%`;
    if (!readOnly) {
      imgDiv.title = "Edit Image (320x320 recommended)";
      imgDiv.onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        input.onchange = e => {
          const reader = new FileReader();
            reader.onload = ev => {
              fam.img = ev.target.result;
              const now = Date.now();
              if (fam.firstModified === undefined) fam.firstModified = now;
              fam.modified = now;
              saveGame();
              renderVillageChief();
            };
          reader.readAsDataURL(e.target.files[0]);
        };
        input.click();
      };
    }
    const zoom = document.createElement("div");
    zoom.className = "zoom-icon";
    zoom.textContent = "🔍";
    zoom.classList.toggle("disabled", !fam.img);
    zoom.onclick = e => {
      e.stopPropagation();
      if (zoom.classList.contains("disabled")) return;
      showZoomImage(fam.img, slot);
    };
    const famDl = document.createElement('div');
    famDl.className = 'download-icon';
    famDl.textContent = '🡇';
    famDl.classList.toggle('disabled', !fam.img);
    famDl.title = 'Download image';
    famDl.setAttribute('aria-label', 'Download image');
    famDl.onclick = e => {
      e.stopPropagation();
      if (famDl.classList.contains('disabled')) return;
      downloadImage(fam.img);
    };
    if (!readOnly && fam.img) {
      const del = document.createElement("button");
      del.textContent = "❌";
      del.className = "close-small";
      del.style.position = "absolute";
      del.style.top = "2px";
      del.style.right = "2px";
      del.onclick = e => {
        e.stopPropagation();
          fam.img = "";
          const now = Date.now();
          if (fam.firstModified === undefined) fam.firstModified = now;
          fam.modified = now;
          saveGame();
          renderVillageChief();
        };
      slot.appendChild(del);
    }
    const nameDiv = document.createElement("div");
    nameDiv.textContent = `${fam.name} (Lvl:${fam.level||1})`;
    nameDiv.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      nameDiv.onclick = () => {
        openEditModal("Familiar Name", fam.name, nuevo => {
            if (nuevo) {
              fam.name = ensureUniqueFamiliarName(
                villageChief.familiars.filter(f => f !== fam),
                nuevo
              );
              const now = Date.now();
              if (fam.firstModified === undefined) fam.firstModified = now;
              fam.modified = now;
              saveGame();
              renderVillageChief();
            }
        }, {container: famDiv});
      };
    }
    const descDiv=document.createElement('div');
    descDiv.className='small-desc desc-preview';
    const descText=(fam.desc||'').trim();
    const truncated=descText.length>90;
    descDiv.textContent="Description: "+(descText? (truncated?descText.slice(0,90):descText) : 'No description');
    descDiv.style.cursor = (!descText || !readOnly) ? 'pointer' : 'default';
    if(truncated){
      const dots=document.createElement('span');
      dots.textContent='...';
      dots.style.cursor='pointer';
      dots.onclick=e=>{e.stopPropagation();showAlert(fam.desc);};
      descDiv.appendChild(dots);
    }
    if (!readOnly) {
      descDiv.onclick=()=>{
        openEditModal('Familiar Description', fam.desc, val=>{
          fam.desc=val;
          const now = Date.now();
          if (fam.firstModified === undefined) fam.firstModified = now;
          fam.modified=now;
          saveGame();
          renderVillageChief();
        }, {multiLine:true, container: famDiv});
      };
    }
    slot.appendChild(imgDiv);
    if (!readOnly) addMoveArrows(imgDiv, imgDiv, fam, 'imgOffset', true, 'imgOffsetX');
    slot.appendChild(zoom);
    slot.appendChild(famDl);
    slot.appendChild(nameDiv);
    slot.appendChild(descDiv);
    if (globalIdx >= villageChief.unlockedFamiliars) {
      const overlay = document.createElement('div');
      overlay.className = 'locked-overlay';
      overlay.textContent = 'Locked';
      slot.appendChild(overlay);
    }
    famGrid.appendChild(slot);
  });
  famDiv.appendChild(famWrapper);
  const famPag = document.createElement("div");
  famPag.className = "pagination";
  const famPrev = document.createElement("button");
  famPrev.textContent = "Prev";
  famPrev.disabled = chiefFamiliarPage === 1;
  famPrev.onclick = () => {
    if (chiefFamiliarPage > 1) {
      chiefFamiliarPage--;
      renderVillageChief();
    }
  };
  famPag.appendChild(famPrev);
  const famInfo = document.createElement("span");
  famInfo.textContent = ` Page ${chiefFamiliarPage} of ${famPages} `;
  famPag.appendChild(famInfo);
  const famNext = document.createElement("button");
  famNext.textContent = "Next";
  famNext.disabled = chiefFamiliarPage === famPages;
  famNext.onclick = () => {
    if (chiefFamiliarPage < famPages) {
      chiefFamiliarPage++;
      renderVillageChief();
    }
  };
  famPag.appendChild(famNext);
    famDiv.appendChild(famPag);
    card.appendChild(famDiv);

    const popDiv = document.createElement("div");
    popDiv.className = "stats";
    popDiv.id = "chief-population";
    if (openChiefPopulation) popDiv.classList.add("expand-row");
    const popClose = document.createElement("button");
    popClose.textContent = "❌";
    popClose.className = "close-btn";
    popClose.onclick = () => { openChiefPopulation = false; popDiv.classList.remove("expand-row"); };
    popDiv.appendChild(popClose);
    const popRow = document.createElement("div");
    popRow.style.display = "flex";
    popRow.style.gap = "20px";
    popRow.style.justifyContent = "center";
    popRow.style.textAlign = "center";
    popRow.style.width = "100%";
    const cit = document.createElement("div");
    cit.id = "citizens-display";
    cit.textContent = `Citizens: ${citizens}/${state.terrain * 50}`;
    const sol = document.createElement("div");
    sol.id = "soldiers-display";
    sol.textContent = `Soldiers: ${soldiers}/${state.terrain * 50}`;
    popRow.appendChild(cit);
    popRow.appendChild(sol);
    const popCard = document.createElement("div");
    popCard.className = "card";
    popCard.appendChild(popRow);
    popDiv.appendChild(popCard);
    card.appendChild(popDiv);


  const habDiv = document.createElement("div");
  habDiv.className = "stats";
  habDiv.id = "boss-habilities";
  if (openChiefHabilities) habDiv.classList.add("expand-row");
  const closeHab = document.createElement("button");
  closeHab.textContent = "❌";
  closeHab.className = "close-btn";
  closeHab.onclick = () => {
    openChiefHabilities = false;
    renderVillageChief();
  };
  habDiv.appendChild(closeHab);
  const habTitle = document.createElement('div');
  habTitle.textContent = 'My Abilities';
  habTitle.style.fontWeight = 'bold';
  habTitle.style.alignSelf = 'flex-start';
  habDiv.appendChild(habTitle);
  const habGrid = document.createElement("div");
  habGrid.className = "habilities-grid";
  const habWrapper = document.createElement('div');
  habWrapper.className = 'scroll-wrapper';
  habWrapper.appendChild(habGrid);
  // Removed sort bar - abilities are always ordered by number
  let habList = villageChief.habilities.slice().sort((a,b)=>{
    return (a.number||0)-(b.number||0); // Always sort by number
  });
  const habPages = CHIEF_MAX_PAGES;
  if (chiefHabilityPage > habPages) chiefHabilityPage = habPages;
  const habStart = (chiefHabilityPage - 1) * CHIEF_ITEMS_PER_PAGE;
  habList = habList.slice(habStart, habStart + CHIEF_ITEMS_PER_PAGE);
  habList.forEach((hab, idx) => {
    const globalIdx = habStart + idx;
    const slot = document.createElement("div");
    slot.className = "hability-slot";
    const num = document.createElement('div');
    num.className = 'slot-number';
    num.textContent = hab.number ?? globalIdx + 1;
    num.style.position = "absolute";
    num.style.top = "2px";
    num.style.right = "2px";
    slot.appendChild(num);
    const imgDiv = document.createElement("div");
    imgDiv.className = "slot-img hability-img";
    const stepIdx = hab.activeStep ?? 0;
    let imgSrc = stepIdx === 0 ? hab.img : (hab.stepImgs[stepIdx-1] || "");
    if (imgSrc) imgDiv.style.backgroundImage = `url(${imgSrc})`;
    imgDiv.style.backgroundPosition = `center ${hab.imgOffset ?? 50}%`;
    if (!readOnly) {
      imgDiv.title = "Edit Image (320x320 recommended)";
      imgDiv.onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        input.onchange = e => {
          const reader = new FileReader();
            reader.onload = ev => {
              if (stepIdx === 0) {
                hab.img = ev.target.result;
              } else {
                hab.stepImgs[stepIdx-1] = ev.target.result;
              }
              const now = Date.now();
              if (hab.firstModified === undefined) hab.firstModified = now;
              hab.modified = now;
              saveGame();
              renderVillageChief();
            };
          reader.readAsDataURL(e.target.files[0]);
        };
        input.click();
      };
    }
    const zoom = document.createElement("div");
    zoom.className = "zoom-icon";
    zoom.textContent = "🔍";
    zoom.classList.toggle("disabled", !imgSrc);
    zoom.onclick = e => {
      e.stopPropagation();
      if (zoom.classList.contains("disabled")) return;
      showZoomImage(imgSrc, slot);
    };
    const habDl = document.createElement('div');
    habDl.className = 'download-icon';
    habDl.textContent = '🡇';
    habDl.classList.toggle('disabled', !imgSrc);
    habDl.title = 'Download image';
    habDl.setAttribute('aria-label', 'Download image');
    habDl.style.position = "absolute";
    habDl.style.top = "2px";
    habDl.style.left = "2px";
    habDl.onclick = e => {
      e.stopPropagation();
      if (habDl.classList.contains('disabled')) return;
      downloadImage(imgSrc);
    };
    if (!readOnly && imgSrc) {
      const del = document.createElement("button");
      del.textContent = "❌";
      del.className = "close-small";
      del.style.position = "absolute";
      del.style.top = "2px";
      del.style.right = "25px"; // Moved left to avoid overlap with number
      del.onclick = e => {
        e.stopPropagation();
          if (stepIdx === 0) {
            hab.img = "";
          } else {
            hab.stepImgs[stepIdx-1] = "";
          }
          const now = Date.now();
          if (hab.firstModified === undefined) hab.firstModified = now;
          hab.modified = now;
          saveGame();
          renderVillageChief();
        };
      slot.appendChild(del);
    }
    const nameDiv = document.createElement("div");
    nameDiv.textContent = `${hab.name} (Lvl:${hab.level||1})`;
    nameDiv.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      nameDiv.onclick = () => {
        openEditModal("Ability Name", hab.name, nuevo => {
            if (nuevo) {
              hab.name = ensureUniqueAbilityName(
                villageChief.habilities.filter(h => h !== hab),
                nuevo
              );
              const now = Date.now();
              if (hab.firstModified === undefined) hab.firstModified = now;
              hab.modified = now;
              saveGame();
              renderVillageChief();
            }
        }, {container: habDiv});
      };
    }
    const descDiv=document.createElement('div');
    descDiv.className='small-desc';
    const descText=(hab.desc||'').trim();
    const trunc=descText.length>90;
    descDiv.textContent="Description: "+(descText? (trunc?descText.slice(0,90):descText) : 'No description');
    descDiv.style.cursor = (!descText || !readOnly) ? 'pointer' : 'default';
    if(trunc){
      const dots=document.createElement('span');
      dots.textContent='...';
      dots.style.cursor='pointer';
      dots.onclick=e=>{e.stopPropagation();showAlert(hab.desc);};
      descDiv.appendChild(dots);
    }
    if(!readOnly) descDiv.onclick=()=>{
        openEditModal('Ability Description', hab.desc, val=>{
          hab.desc=val;
          const now = Date.now();
          if (hab.firstModified === undefined) hab.firstModified = now;
          hab.modified=now;
          saveGame();
          renderVillageChief();
        },{multiLine:true, container: habDiv});
      };
    slot.appendChild(imgDiv);
    if (!readOnly) addMoveArrows(imgDiv, imgDiv, hab, 'imgOffset', true, 'imgOffsetX');
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    for (let t = 0; t < ABILITY_STEP_COUNT; t++) {
      const dot = document.createElement('span');
      dot.className = 'timeline-dot';
      if (t === stepIdx) dot.classList.add('active');
      dot.textContent = t === stepIdx ? '●' : '○';
      dot.onclick = e => {
        e.stopPropagation();
        if (t === stepIdx) return;
        if (t === 0 ? hab.img : hab.stepImgs[t-1]) {
          hab.activeStep = t;
          scheduleSaveGame();
          renderVillageChief();
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.style.display = 'none';
          input.onchange = ev => {
            const reader = new FileReader();
            reader.onload = rv => {
              if (t === 0) hab.img = rv.target.result; else hab.stepImgs[t-1] = rv.target.result;
              hab.activeStep = t;
              const now = Date.now();
              if (hab.firstModified === undefined) hab.firstModified = now;
              hab.modified = now;
              scheduleSaveGame();
              renderVillageChief();
            };
            reader.readAsDataURL(ev.target.files[0]);
          };
          input.click();
        }
      };
      timeline.appendChild(dot);
    }
    imgDiv.appendChild(timeline);
    slot.appendChild(zoom);
    slot.appendChild(habDl);
    slot.appendChild(nameDiv);
    slot.appendChild(descDiv);
    if (globalIdx >= villageChief.unlockedHabilities) {
      const overlay = document.createElement('div');
      overlay.className = 'locked-overlay';
      overlay.textContent = 'Locked';
      slot.classList.add('locked');
      slot.appendChild(overlay);
    }
    habGrid.appendChild(slot);
  });
  habDiv.appendChild(habWrapper);
  const habPag = document.createElement("div");
  habPag.className = "pagination";
  const habPrev = document.createElement("button");
  habPrev.textContent = "Prev";
  habPrev.disabled = chiefHabilityPage === 1;
  habPrev.onclick = () => {
    if (chiefHabilityPage > 1) {
      chiefHabilityPage--;
      renderVillageChief();
    }
  };
  habPag.appendChild(habPrev);
  const habInfo = document.createElement("span");
  habInfo.textContent = ` Page ${chiefHabilityPage} of ${habPages} `;
  habPag.appendChild(habInfo);
  const habNext = document.createElement("button");
  habNext.textContent = "Next";
  habNext.disabled = chiefHabilityPage === habPages;
  habNext.onclick = () => {
    if (chiefHabilityPage < habPages) {
      chiefHabilityPage++;
      renderVillageChief();
    }
  };
  habPag.appendChild(habNext);
  habDiv.appendChild(habPag);
  card.appendChild(habDiv);

  const partnerDiv = document.createElement("div");
  partnerDiv.className = "stats";
  partnerDiv.id = "partner-abilities";
  if (openPartnerAbilities) partnerDiv.classList.add("expand-row");
  const closePart = document.createElement("button");
  closePart.textContent = "❌";
  closePart.className = "close-btn";
  closePart.onclick = () => { openPartnerAbilities = false; renderVillageChief(); };
  partnerDiv.appendChild(closePart);
  const partTitle = document.createElement('div');
  partTitle.textContent = 'My P_abilities';
  partTitle.style.fontWeight = 'bold';
  partTitle.style.alignSelf = 'flex-start';
  partnerDiv.appendChild(partTitle);
  const partGrid = document.createElement('div');
  partGrid.className = 'habilities-grid';
  const partWrapper = document.createElement('div');
  partWrapper.className = 'scroll-wrapper';
  partWrapper.appendChild(partGrid);
  const partSort = document.createElement('div');
  partSort.className = 'sort-bar';
  ['number','name','level','modified'].forEach(opt => {
    const b = document.createElement('button');
    b.className = 'btn btn-green';
    const labels={name:'Order by Name',level:'Order by Level',number:'Order by Number',modified:'Order by LastModification'};
    b.textContent = labels[opt];
    b.disabled = partnerAbilitySort===opt;
    b.onclick = () => {partnerAbilitySort=opt;renderVillageChief();};
    partSort.appendChild(b);
  });
  partnerDiv.appendChild(partSort);
  let partList = (villageChief.partnerAbilities || []).slice().sort((a,b)=>{
    if(partnerAbilitySort==='name') return a.name.localeCompare(b.name);
    if(partnerAbilitySort==='level') return (b.level||1)-(a.level||1);
    if(partnerAbilitySort==='number') return (a.number||0)-(b.number||0);
    return (b.modified||0)-(a.modified||0);
  });
  const partPages = PARTNER_MAX_PAGES;
  if (partnerAbilityPage > partPages) partnerAbilityPage = partPages;
  const partStart = (partnerAbilityPage - 1) * PARTNER_ITEMS_PER_PAGE;
  partList = partList.slice(partStart, partStart + PARTNER_ITEMS_PER_PAGE);
  partList.forEach((ab,idx)=>{
    const globalIdx = partStart + idx;
    const slot = document.createElement('div');
    slot.className = 'hability-slot';
    const num = document.createElement('div');
    num.className = 'slot-number';
    num.textContent = ab.number ?? globalIdx + 1;
    slot.appendChild(num);
    const imgDiv = document.createElement('div');
    imgDiv.className = 'slot-img hability-img';
    const stepIdxP = ab.activeStep ?? 0;
    let imgSrcP = stepIdxP === 0 ? ab.img : (ab.stepImgs[stepIdxP-1] || "");
    if (imgSrcP) imgDiv.style.backgroundImage = `url(${imgSrcP})`;
    imgDiv.style.backgroundPosition = `center ${ab.imgOffset ?? 50}%`;
    if (!readOnly) {
      imgDiv.title = 'Edit Image (320x320 recommended)';
      imgDiv.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.onchange = e => {
          const reader = new FileReader();
          reader.onload = ev => {
            if (stepIdxP === 0) {
              ab.img = ev.target.result;
            } else {
              ab.stepImgs[stepIdxP-1] = ev.target.result;
            }
            const now = Date.now();
            if (ab.firstModified === undefined) ab.firstModified = now;
            ab.modified = now;
            saveGame();
            renderVillageChief();
          };
          reader.readAsDataURL(e.target.files[0]);
        };
        input.click();
      };
    }
    const zoom = document.createElement('div');
    zoom.className = 'zoom-icon';
    zoom.textContent = '🔍';
    zoom.classList.toggle('disabled', !imgSrcP);
    zoom.onclick = e => { e.stopPropagation(); if(zoom.classList.contains('disabled')) return; showZoomImage(imgSrcP, slot); };
    const partDl = document.createElement('div');
    partDl.className = 'download-icon';
    partDl.textContent = '🡇';
    partDl.classList.toggle('disabled', !imgSrcP);
    partDl.title = 'Download image';
    partDl.setAttribute('aria-label', 'Download image');
    partDl.onclick = e => {
      e.stopPropagation();
      if (partDl.classList.contains('disabled')) return;
      downloadImage(imgSrcP);
    };
    if (!readOnly && imgSrcP) {
      const del = document.createElement('button');
      del.textContent = '❌';
      del.className = 'close-small';
      del.style.position = 'absolute';
      del.style.top = '2px';
      del.style.right = '2px';
      del.onclick = e => { e.stopPropagation(); if(stepIdxP===0){ab.img='';} else {ab.stepImgs[stepIdxP-1]='';} const now=Date.now(); if(ab.firstModified===undefined) ab.firstModified=now; ab.modified=now; saveGame(); renderVillageChief(); };
      slot.appendChild(del);
    }
    const nameDiv = document.createElement('div');
    nameDiv.textContent = `${ab.name} (Lvl:${ab.level||1})`;
    nameDiv.style.cursor= readOnly ? 'default' : 'pointer';
    if (!readOnly) nameDiv.onclick=()=>{ openEditModal('Ability Name',ab.name,val=>{ if(val){ ab.name=ensureUniqueAbilityName((villageChief.partnerAbilities || []).filter(h=>h!==ab),val); const now=Date.now(); if(ab.firstModified===undefined) ab.firstModified=now; ab.modified=now; saveGame(); renderVillageChief(); }},{container: partnerDiv}); };
    const descDiv=document.createElement('div');
    descDiv.className='small-desc';
    const dtxt=(ab.desc||'').trim();
    const trunc=dtxt.length>90;
    descDiv.textContent='Description: '+(dtxt?(trunc?dtxt.slice(0,90):dtxt):'No description');
    descDiv.style.cursor = (!dtxt || !readOnly) ? 'pointer' : 'default';
    if(trunc){ const dots=document.createElement('span'); dots.textContent='...'; dots.style.cursor='pointer'; dots.onclick=e=>{e.stopPropagation();showAlert(ab.desc);}; descDiv.appendChild(dots); }
    if(!readOnly) descDiv.onclick=()=>{openEditModal('Ability Description',ab.desc,val=>{ab.desc=val; const now=Date.now(); if(ab.firstModified===undefined) ab.firstModified=now; ab.modified=now; saveGame(); renderVillageChief();},{multiLine:true, container: partnerDiv});};
    slot.appendChild(imgDiv);
    if (!readOnly) addMoveArrows(imgDiv, imgDiv, ab, 'imgOffset', true, 'imgOffsetX');
    const timelineP = document.createElement('div');
    timelineP.className = 'timeline';
    for (let t = 0; t < ABILITY_STEP_COUNT; t++) {
      const dot = document.createElement('span');
      dot.className = 'timeline-dot';
      if (t === stepIdxP) dot.classList.add('active');
      dot.textContent = t === stepIdxP ? '●' : '○';
      dot.onclick = e => {
        e.stopPropagation();
        if (t === stepIdxP) return;
        if (t === 0 ? ab.img : ab.stepImgs[t-1]) {
          ab.activeStep = t;
          scheduleSaveGame();
          renderVillageChief();
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.style.display = 'none';
          input.onchange = ev => {
            const reader = new FileReader();
            reader.onload = rv => {
              if (t === 0) ab.img = rv.target.result; else ab.stepImgs[t-1] = rv.target.result;
              ab.activeStep = t;
              const now = Date.now();
              if (ab.firstModified === undefined) ab.firstModified = now;
              ab.modified = now;
              scheduleSaveGame();
              renderVillageChief();
            };
            reader.readAsDataURL(ev.target.files[0]);
          };
          input.click();
        }
      };
      timelineP.appendChild(dot);
    }
    imgDiv.appendChild(timelineP);
    slot.appendChild(zoom);
    slot.appendChild(partDl);
    slot.appendChild(nameDiv);
    slot.appendChild(descDiv);
    if(globalIdx>=villageChief.unlockedPartnerAbilities){
      const overlay=document.createElement('div');
      overlay.className='locked-overlay';
      overlay.textContent='Locked';
      slot.classList.add('locked');
      slot.appendChild(overlay);
    }
    partGrid.appendChild(slot);
  });
  partnerDiv.appendChild(partWrapper);
  const partPag=document.createElement('div');
  partPag.className='pagination';
  const partPrev=document.createElement('button');
  partPrev.textContent='Prev';
  partPrev.disabled=partnerAbilityPage===1;
  partPrev.onclick=()=>{ if(partnerAbilityPage>1){ partnerAbilityPage--; renderVillageChief(); } };
  partPag.appendChild(partPrev);
  const partInfo=document.createElement('span');
  partInfo.textContent=` Page ${partnerAbilityPage} of ${partPages} `;
  partPag.appendChild(partInfo);
  const partNext=document.createElement('button');
  partNext.textContent='Next';
  partNext.disabled=partnerAbilityPage===partPages;
  partNext.onclick=()=>{ if(partnerAbilityPage<partPages){ partnerAbilityPage++; renderVillageChief(); } };
  partPag.appendChild(partNext);
  partnerDiv.appendChild(partPag);
  card.appendChild(partnerDiv);

  const pStatsDiv = document.createElement("div");
  pStatsDiv.className = "stats";
  pStatsDiv.id = "partner-stats";
  if (openPartnerStats) pStatsDiv.classList.add("expand-row");
  const pClose = document.createElement("button");
  pClose.textContent = "❌";
  pClose.className = "close-btn";
  pClose.onclick = () => { openPartnerStats = false; pStatsDiv.classList.remove("expand-row"); renderVillageChief(); };
  pStatsDiv.appendChild(pClose);
  const pCols = document.createElement("div");
  pCols.className = "stats-columns";
  const pCol = document.createElement("div");
  pCol.className = "stats-column";
  const pTitle = document.createElement("div");
  pTitle.className = "stats-column-title";
  pTitle.textContent = "P_Stats";
  pCol.appendChild(pTitle);
  const pGrid = document.createElement("div");
  pGrid.className = "stats-grid";
  const pOrder = ["fuerza","suerte","inteligencia","destreza","defensa","vida","mana"];
  const pLabels = { fuerza:"Strength", suerte:"Luck", inteligencia:"Intelligence", destreza:"Dexterity", defensa:"Defense", vida:"HP", mana:"Mana" };
  pOrder.forEach(stat => {
    const line = document.createElement("div");
    line.className = "stat-line";
    const span = document.createElement("span");
    span.textContent = `${pLabels[stat]}: ${partnerStats[stat]}`;
    line.appendChild(span);
    pGrid.appendChild(line);
  });
  pCol.appendChild(pGrid);
  pCols.appendChild(pCol);
  pStatsDiv.appendChild(pCols);
  card.appendChild(pStatsDiv);

  const pInvDiv = document.createElement("div");
  pInvDiv.className = "stats";
  pInvDiv.id = "partner-inventory";
  if (openPartnerInventory) pInvDiv.classList.add("expand-row");
  const pInvClose = document.createElement("button");
  pInvClose.textContent = "❌";
  pInvClose.className = "close-btn";
  pInvClose.onclick = () => { openPartnerInventory = false; pInvDiv.classList.remove("expand-row"); renderVillageChief(); };
  pInvDiv.appendChild(pInvClose);
  const pInvCols = document.createElement("div");
  pInvCols.className = "stats-columns";
  const pInvCol = document.createElement("div");
  pInvCol.className = "stats-column";
  const pInvTitle = document.createElement("div");
  pInvTitle.className = "stats-column-title";
  pInvTitle.textContent = "Partner Potions";
  pInvCol.appendChild(pInvTitle);
  [
    ["hpPotions","HealingPotions", () => { partnerStats.vida += 1; }],
    ["manaPotions","ManaPotions", () => { partnerStats.mana += 1; }],
    ["energyPotions","EnergyPotions", () => { partner.energia = Math.min(100, (partner.energia || 0) + 20); }],
    ["expPotions","ExpPotions", () => { partner.exp = (partner.exp || 0) + 5; }]
  ].forEach(([key,label,drinkFn]) => {
    const line = document.createElement("div");
    line.className = "potion-item";
    const span = document.createElement("span");
    span.textContent = `${label}: ${partner[key]}`;
    line.appendChild(span);
    if (!readOnly) {
      const drink = document.createElement("button");
      drink.textContent = "Drink";
      drink.onclick = () => {
        if (partner[key] > 0) { partner[key]--; drinkFn(); saveGame(); renderVillageChief(); }
      };
      const plus = document.createElement("span");
      plus.textContent = "➕";
      plus.className = "potion-icon potion-plus";
      plus.onclick = () => {
        if (villageChief[key] > 0) { villageChief[key]--; partner[key]++; saveGame(); renderVillageChief(); }
      };
      const minus = document.createElement("span");
      minus.textContent = "➖";
      minus.className = "potion-icon potion-minus";
      minus.onclick = () => {
        if (partner[key] > 0) { partner[key]--; villageChief[key]++; saveGame(); renderVillageChief(); }
      };
      line.appendChild(drink);
      line.appendChild(plus);
      line.appendChild(minus);
    }
    pInvCol.appendChild(line);
  });
  pInvCols.appendChild(pInvCol);
  pInvDiv.appendChild(pInvCols);
  card.appendChild(pInvDiv);

  container.insertBefore(card, savedExtra || null);
  updateResourcesDisplay();

  if (!savedExtra) {
    const extra = document.createElement("div");
    extra.className = "chief-card card gold-border";
    extra.id = "chief-extra";
    extra.style.display = "none";
    extra.style.marginTop = "20px";
    container.appendChild(extra);
  }
  updateTimerPause();

  setTimeout(() => initChiefMusicPlayer(card), 0);
}

let TRACKS = [];
let sywIdx = 0;
const sywAudio = new Audio();
// El volumen se inicializará después de cargar los módulos
async function sywRefreshTracks(){
  if (!window.music) return;
  const currentId = TRACKS[sywIdx]?.id;
  try {
    TRACKS = (await window.music.list()).sort((a,b)=>a.title.localeCompare(b.title));
  } catch (e){
    console.error(e);
    TRACKS = [];
  }
  if (currentId){
    const idx = TRACKS.findIndex(t => t.id === currentId);
    sywIdx = idx >= 0 ? idx : 0;
  } else {
    sywIdx = 0;
  }
}
sywAudio.preload = "metadata";
sywAudio.addEventListener('ended', sywNext);
sywAudio.addEventListener('timeupdate', sywSyncTime);
sywAudio.addEventListener('loadedmetadata', async () => {
  if (sywDurationEl) sywDurationEl.textContent = sywFormatTime(sywAudio.duration);
  if (sywSeekEl) sywSeekEl.max = sywAudio.duration;
  sywSyncTime();
  const track = TRACKS[sywIdx];
  if (track && track.durationSec === 0 && window.music){
    try {
      const sec = Math.round(sywAudio.duration);
      await window.music.updateDuration(track.id, sec);
      track.durationSec = sec;
    } catch (e){
      console.error(e);
    }
  }
});
sywAudio.addEventListener('error', () => {
  console.warn('[SYW Player] Failed to load:', TRACKS[sywIdx]?.title);
});

let sywBtnMute, sywBtnPrev, sywBtnPlay, sywBtnNext, sywTitleEl;
let sywBtnChange, sywBtnAdd, sywBtnRemove, sywBtnMinimize, sywCurrentEl, sywDurationEl, sywSeekEl, sywCard;
let sywSeeking = false;

function sywFormatTime(sec){
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}
function sywSyncTime(){
  if (sywCurrentEl) sywCurrentEl.textContent = sywFormatTime(sywAudio.currentTime);
  if (sywSeekEl && !sywSeeking) sywSeekEl.value = sywAudio.currentTime;
}
function sywSeek(e){ sywAudio.currentTime = e.target.value; }
function sywSeekInput(e){ sywSeeking = true; sywSeek(e); }
function sywSeekChange(){ sywSeeking = false; }
function sywOpenChange(){ openChangeSongModal(sywCard); }
async function sywOpenAdd(){
  try {
    if (window.music) {
      await window.music.import();
      await sywRefreshTracks();
      if (!sywAudio.src && TRACKS.length) sywLoad(sywIdx);
    }
  } catch (e) {
    console.error(e);
  }
}
function sywOpenRemove(){ openRemoveMusicModal(sywCard); }

function sywLoad(i){
  if (!TRACKS.length) return;
  sywIdx = (i + TRACKS.length) % TRACKS.length;
  const t = TRACKS[sywIdx];
  if (sywTitleEl){
    sywTitleEl.textContent = t.title;
    sywTitleEl.title = t.title;
  }
  sywAudio.src = t.absPath;
  if (sywSeekEl){
    sywSeekEl.value = 0;
    sywSeekEl.max = t.durationSec || 0;
  }
  if (sywCurrentEl) sywCurrentEl.textContent = sywFormatTime(0);
  if (sywDurationEl) sywDurationEl.textContent = t.durationSec ? sywFormatTime(t.durationSec) : '00:00';
}

function sywPlay(){
  if (!sywAudio.src) sywLoad(sywIdx);
  if (!sywAudio.src) return;
  sywAudio.play().then(() => {
    if (sywBtnPlay){ sywBtnPlay.textContent = "⏸"; sywBtnPlay.setAttribute('aria-label','Pause'); }
  }).catch(() => {});
}
function sywPause(){
  sywAudio.pause();
  if (sywBtnPlay){ sywBtnPlay.textContent = "▶"; sywBtnPlay.setAttribute('aria-label','Play'); }
}
function sywTogglePlay(){ sywAudio.paused ? sywPlay() : sywPause(); }
function sywPrev(){ if (TRACKS.length){ sywLoad(sywIdx - 1); sywPlay(); } }
function sywNext(){ if (TRACKS.length){ sywLoad(sywIdx + 1); sywPlay(); } }
function sywToggleMute(){
  sywAudio.muted = !sywAudio.muted;
  if (sywBtnMute) sywBtnMute.textContent = sywAudio.muted ? "🔇" : "🔊";
}

function sywToggleMinimize(){
  const musicSlot = document.getElementById("chiefMusicSlot");
  if (musicSlot) {
    musicSlot.classList.toggle("minimized");
    if (sywBtnMinimize) {
      sywBtnMinimize.textContent = musicSlot.classList.contains("minimized") ? "+" : "–";
    }
  }
}

async function openChangeSongModal(card){
  if (!card) return;
  await sywRefreshTracks();
  if (!TRACKS.length) { alert('No tracks'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const select = document.createElement('select');
  TRACKS.forEach((t, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = t.title;
    select.appendChild(opt);
  });
  select.value = sywIdx;
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.marginTop = '8px';
  const changeBtn = document.createElement('button');
  changeBtn.textContent = 'Change';
  changeBtn.className = 'btn btn-blue white-text';
  changeBtn.onclick = () => { sywLoad(parseInt(select.value,10)); sywPlay(); overlay.remove(); };
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn btn-lightyellow';
  closeBtn.onclick = () => overlay.remove();
  btnRow.appendChild(changeBtn);
  btnRow.appendChild(closeBtn);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(overlay);
  select.focus();
}

async function openRemoveMusicModal(card){
  if (!card || !window.music) return;
  const tracks = (await window.music.list()).filter(t => !t.builtIn).sort((a,b)=>a.title.localeCompare(b.title));
  if (!tracks.length) { showAlert('No user tracks', { container: card }); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const select = document.createElement('select');
  tracks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    select.appendChild(opt);
  });
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.marginTop = '8px';
  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  delBtn.className = 'btn btn-red white-text';
  delBtn.onclick = () => {
    const id = select.value;
    openConfirm({
      title: 'Confirm',
      message: 'Delete this track from your library?',
      container: card,
      onConfirm: async () => {
        const currentIdx = sywIdx;
        const wasCurrent = TRACKS[sywIdx] && TRACKS[sywIdx].id === id;
        try{ await window.music.delete(id); }catch(e){ console.error(e); }
        await sywRefreshTracks();
        overlay.remove();
        if (wasCurrent){
          if (TRACKS.length){
            sywIdx = Math.min(currentIdx, TRACKS.length-1);
            sywLoad(sywIdx);
            sywPlay();
          } else {
            sywAudio.pause();
            sywAudio.src = '';
            if (sywTitleEl){ sywTitleEl.textContent = '—'; sywTitleEl.title = '—'; }
          }
        }
      }
    });
  };
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn btn-lightyellow';
  closeBtn.onclick = () => overlay.remove();
  btnRow.appendChild(delBtn);
  btnRow.appendChild(closeBtn);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(overlay);
  select.focus();
}

function openPlaceholderModal(title, action, card){
  if (!card) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const titleEl = document.createElement('h3');
  titleEl.style.margin = '0 0 8px';
  titleEl.textContent = title;
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.justifyContent = 'center';
  const actionBtn = document.createElement('button');
  actionBtn.textContent = action;
  actionBtn.className = 'btn btn-blue white-text';
  actionBtn.onclick = () => overlay.remove();
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn btn-lightyellow';
  closeBtn.onclick = () => overlay.remove();
  btnRow.appendChild(actionBtn);
  btnRow.appendChild(closeBtn);
  modal.appendChild(titleEl);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.appendChild(overlay);
  actionBtn.focus();
}

function initChiefMusicPlayer(card){
  sywCard = card;
  const newMute = document.getElementById('sywMute');
  const newPrev = document.getElementById('sywPrev');
  const newPlay = document.getElementById('sywPlay');
  const newNext = document.getElementById('sywNext');
  const newTitle = document.getElementById('sywTitle');
  const newChange = document.getElementById('sywChange');
  const newAdd = document.getElementById('sywAdd');
  const newRemove = document.getElementById('sywRemove');
  const newMinimize = document.getElementById('sywMinimize');
  const newCurrent = document.getElementById('sywCurrent');
  const newDuration = document.getElementById('sywDuration');
  const newSeek = document.getElementById('sywSeek');

  if (!newMute || !newPrev || !newPlay || !newNext || !newTitle || !newChange || !newAdd || !newRemove || !newMinimize || !newCurrent || !newDuration || !newSeek) return;

  if (sywBtnMute) sywBtnMute.removeEventListener('click', sywToggleMute);
  if (sywBtnPrev) sywBtnPrev.removeEventListener('click', sywPrev);
  if (sywBtnPlay) sywBtnPlay.removeEventListener('click', sywTogglePlay);
  if (sywBtnNext) sywBtnNext.removeEventListener('click', sywNext);
  if (sywBtnChange) sywBtnChange.removeEventListener('click', sywOpenChange);
  if (sywBtnAdd) sywBtnAdd.removeEventListener('click', sywOpenAdd);
  if (sywBtnRemove) sywBtnRemove.removeEventListener('click', sywOpenRemove);
  if (sywBtnMinimize) sywBtnMinimize.removeEventListener('click', sywToggleMinimize);
  if (sywSeekEl){
    sywSeekEl.removeEventListener('input', sywSeekInput);
    sywSeekEl.removeEventListener('change', sywSeekChange);
  }

  sywBtnMute = newMute;
  sywBtnPrev = newPrev;
  sywBtnPlay = newPlay;
  sywBtnNext = newNext;
  sywTitleEl = newTitle;
  sywBtnChange = newChange;
  sywBtnAdd = newAdd;
  sywBtnRemove = newRemove;
  sywBtnMinimize = newMinimize;
  sywCurrentEl = newCurrent;
  sywDurationEl = newDuration;
  sywSeekEl = newSeek;

  sywBtnPlay.addEventListener('click', sywTogglePlay);
  sywBtnPrev.addEventListener('click', sywPrev);
  sywBtnNext.addEventListener('click', sywNext);
  sywBtnMute.addEventListener('click', sywToggleMute);
  sywBtnChange.addEventListener('click', sywOpenChange);
  sywBtnAdd.addEventListener('click', sywOpenAdd);
  sywBtnRemove.addEventListener('click', sywOpenRemove);
  sywBtnMinimize.addEventListener('click', sywToggleMinimize);
  sywSeekEl.addEventListener('input', sywSeekInput);
  sywSeekEl.addEventListener('change', sywSeekChange);
  sywRefreshTracks().then(() => {
    if (!sywAudio.src && TRACKS.length) {
      sywLoad(sywIdx);
    } else if (TRACKS.length) {
      sywTitleEl.textContent = TRACKS[sywIdx].title;
      sywTitleEl.title = TRACKS[sywIdx].title;
    }
    if (sywAudio.src){
      sywBtnPlay.textContent = sywAudio.paused ? "▶" : "⏸";
      sywBtnPlay.setAttribute('aria-label', sywAudio.paused ? 'Play' : 'Pause');
      sywBtnMute.textContent = sywAudio.muted ? "🔇" : "🔊";
      if (sywDurationEl && !isNaN(sywAudio.duration)){
        sywDurationEl.textContent = sywFormatTime(sywAudio.duration);
        sywSeekEl.max = sywAudio.duration;
      }
      sywSyncTime();
    }
  });
}

function showChiefExtra(label, onClose) {
  const card = document.getElementById("chief-extra");
  if (!card) return;
  card.innerHTML = "";
  const isMiniGame =
    label === "Fortune Wheel" ||
    label === "Projects" ||
    label === "FightIntruders";
  if (isMiniGame) {
    minigameOpened();
  }
  const close = document.createElement("button");
  close.textContent = "x";
  close.className = "close-btn";
  if (label === "Enemy Encounter") close.classList.add("enemy-game-close");
  close.onclick = () => {
    if (isMiniGame) minigameClosed();
    card.innerHTML = "";
    card.style.display = "none";
    currentChiefExtra = "";
    updateAutoClickButtonHeight();
    updateTimerPause();
    if (label === "Autoclick enabled") {
      renderVillageChief();
    } else if (onClose) {
      onClose();
    }
  };
  card.appendChild(close);
  currentChiefExtra = label;
  updateTimerPause();
  if (label === "Autoclick enabled") {
    const wrap = document.createElement("div");
    wrap.style.gridColumn = "1 / -1";
    const subtitle = document.createElement("div");
    subtitle.textContent = "Hide this card to start autoclicking  ------------> (❌)";
    subtitle.style.textAlign = "center";
    subtitle.style.paddingBottom = "8px";
    wrap.appendChild(subtitle);
    const all = document.createElement("div");
    renderAllCompanions(all, true);
    wrap.appendChild(all);
    card.appendChild(wrap);
  } else if (label === "Fortune Wheel") {
    renderFortuneWheel(card);
  } else if (label === "Life Missions") {
    const wrap = document.createElement("div");
    wrap.className = "card gold-border";
    renderLifeMissions(wrap);
    card.appendChild(wrap);
  } else if (label === "Habits") {
    const wrap = document.createElement("div");
    wrap.className = "card gold-border";
    wrap.style.position = "relative";
    renderHabits(wrap);
    card.appendChild(wrap);
  } else if (label === "Projects") {
    const iframe = document.createElement("iframe");
    iframe.className = "html-game-frame";
    iframe.src = GAME_SOURCES.Projects;
    card.appendChild(iframe);
  } else if (label === "FightIntruders") {
    const iframe = document.createElement("iframe");
    iframe.className = "html-game-frame";
    iframe.src = GAME_SOURCES.FightIntruders;
    iframe.onload = () => {
      iframe.contentWindow.postMessage({
        type: "fightIntrudersData",
        chief: {
          name: villageChief.name,
          avatar: resolveSrc(villageChief.avatar || EMPTY_SRC),
          abilities: villageChief.habilities
            .slice(0, villageChief.unlockedHabilities ?? unlockedHabilities)
            .map((h, idx) => ({
              id: h.id ?? h.number ?? String(idx + 1),
              label: h.label ?? h.name ?? `Ability ${idx + 1}`,
              name: h.name ?? h.label ?? `Ability ${idx + 1}`,
              img: resolveSrc(h.img || EMPTY_SRC),
              level: h.level ?? h.lvl ?? h.abilityLevel ?? h.lvlAbility ?? h.skillLevel ?? 1,
              fightIntrudersDay: h.fightIntrudersDay || null
            }))
        },
        partner: {
          name: partner.name,
          avatar: resolveSrc(partner.img || partner.photoUrl || partner.imageUrl || partner.avatar || EMPTY_SRC),
          abilities: villageChief.partnerAbilities
            .slice(0, villageChief.unlockedPartnerAbilities ?? unlockedPartnerAbilities)
            .map((a, idx) => ({
              id: a.id ?? a.number ?? String(idx + 1),
              label: a.label ?? a.name ?? `P_Ability ${idx + 1}`,
              name: a.name ?? a.label ?? `P_Ability ${idx + 1}`,
              img: resolveSrc(a.img || EMPTY_SRC),
              level: a.level ?? a.lvl ?? a.abilityLevel ?? a.lvlAbility ?? a.skillLevel ?? 1,
              fightIntrudersDay: a.fightIntrudersDay || null
            }))
        }
      }, "*");
    };
    card.appendChild(iframe);
  } else if (label === "DailyTribute") {
    const wrap = document.createElement("div");
    if (dailyTributeInfo) {
      const text = document.createElement("div");
      text.style.paddingBottom = "15px"; // Agregar padding bottom
      let html =
        `${dailyTributeInfo.claimedToday ? "Claimed" : "Claim your daily tribute"}:<br>` +
        `• 250 Gold for each Hero (Total: ${dailyTributeInfo.goldFromHeroes} Gold)<br>` +
        `• 200 Gold for each Pet (Total: ${dailyTributeInfo.goldFromPets} Gold)<br>` +
        `• 100 Gold per Dungeon level (Total: ${dailyTributeInfo.goldFromDungeons} Gold)<br>` +
        `<br><strong>Total = ${dailyTributeInfo.totalGold} Gold</strong><br>`;
      text.innerHTML = html;
      wrap.appendChild(text);
    }
    card.appendChild(wrap);
  } else if (label === "Enemy Encounter") {
    renderEnemyEncounter(card);
  } else if (label) {
    const div = document.createElement("div");
    div.textContent = label;
    card.appendChild(div);
  }
  card.style.display = "flex";
  card.style.flexDirection = "column";
  updateAutoClickButtonHeight();
}

export function showVillageExtra(label, onClose) {
  hideBuildCard();
  const card = document.getElementById("build-select-card");
  if (!card) return;
  if (UPGRADE_HERO_COUNTS[label]) {
    showUpgradeModal(label, UPGRADE_HERO_COUNTS[label], label === "Castle" ? 6 : UPGRADE_HERO_COUNTS[label]);
    return;
  }
  state.buildSelectionOpen = true;
  card.innerHTML = "";
  card.classList.add("construction-card");
  if (label !== "Enemy Encounter") {
    card.style.display = "grid";
    const close = document.createElement("button");
    close.textContent = "x";
    close.className = "close-btn";
    close.onclick = () => {
      state.buildSelectionOpen = false;
      card.innerHTML = "";
      card.style.display = "none";
      card.classList.remove("construction-card");
      if (onClose) onClose();
    };
    card.appendChild(close);
  } else {
    card.style.display = "none";
  }

  if (label === "Enemy Encounter") {
    renderEnemyEncounter(card);
    return;
  }

  if (BUILDING_IMAGES[label]) {
    const imgContainer = document.createElement("div");
    imgContainer.id = "constructionImageContainer";
    const img = document.createElement("img");
    img.src = BUILDING_IMAGES[label];
    img.className = "building-img";
    img.style.gridColumn = "1 / -1";
    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
    requestAnimationFrame(() => {
      imgContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else if (label) {
    const div = document.createElement("div");
    div.textContent = label;
    card.appendChild(div);
  }

}

function closeAllPanels() {
  document.querySelectorAll('.stats.expand-row').forEach(el => el.classList.remove('expand-row'));
  openStats = {};
  openTraining = {};
  const chiefExtra = document.getElementById('chief-extra');
  if (chiefExtra) {
    const pomo = chiefExtra.querySelector('iframe[src*="PomodoroTower.html"]');
    if (pomo && currentPomodoroAbility) {
      chiefExtra.style.display = 'none';
    } else {
      chiefExtra.innerHTML = '';
      chiefExtra.style.display = 'none';
    }
  }
  currentChiefExtra = '';
  hideBuildCard();
  if (state.buildingTask.time > 0) {
    resumeBuild();
    showInlineBuildTimer();
  }
  const terrainCard2 = document.getElementById('terrain-card-2');
  if (terrainCard2) terrainCard2.style.display = 'none';
  renderHeroesIfVisible();
}

function hideBuildCard() {
  const buildCard = document.getElementById('build-select-card');
  if (buildCard) {
    buildCard.innerHTML = '';
    buildCard.style.display = 'none';
    buildCard.classList.remove('progress-card');
    buildCard.classList.remove('construction-card');
  }
  state.buildSelectionOpen = false;
}

let dailyTributeInfo = null;
function showDailyTribute() {
  if (currentChiefExtra === "DailyTribute") {
    const card = document.getElementById("chief-extra");
    if (card) {
      card.innerHTML = "";
      card.style.display = "none";
      currentChiefExtra = "";
      updateAutoClickButtonHeight();
      updateTimerPause();
    }
    return;
  }
  const today = new Date().toDateString();
  if (villageChief.dailyTributeDate === today) {
    dailyTributeInfo = { claimedToday: true, goldFromDungeons: 0, ...(villageChief.dailyTributeRewards || {}) };
    showChiefExtra("DailyTribute");
    return;
  }
  const familiarCount = unlockedFamiliars;
  const familiarLevels = villageChief.familiars
    .slice(0, familiarCount)
    .reduce((sum, f) => sum + (f.level || 1), 0);
  const heroCount = state.heroes.length;
  const petCount = state.heroes.filter(h => h.pet).length;
  const dungeonLevel = state.buildingLevels?.Dungeons || 0;
  const partnerLevel = partner.level || 0;
  const goldFromFamiliars = familiarCount * 500 + familiarLevels * 50;
  const goldFromHeroes = heroCount * 250;
  const goldFromPets = petCount * 200;
  const goldFromDungeons = dungeonLevel * 100;
  const totalGold = goldFromFamiliars + goldFromHeroes + goldFromPets + goldFromDungeons;
  const potionTypes = ["Health", "Mana", "Energy", "Experience"];
  const chosenPotions = [];
  for (let i = 0; i < partnerLevel; i++) {
    const type = potionTypes[Math.floor(Math.random() * potionTypes.length)];
    chosenPotions.push(type);
    if (type === "Health") villageChief.hpPotions++;
    else if (type === "Mana") villageChief.manaPotions++;
    else if (type === "Energy") villageChief.energyPotions++;
    else villageChief.expPotions++;
  }
  const potionCounts = chosenPotions.reduce((acc, p) => {
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const order = ["Energy", "Experience", "Health", "Mana"];
  const potionSummaryParts = order.filter(type => potionCounts[type])
    .map(type => `${potionCounts[type]} ${type}`);
  const potionSummary = potionSummaryParts.length > 1
    ? potionSummaryParts.slice(0, -1).join(' ') + ' y ' + potionSummaryParts.slice(-1)
    : (potionSummaryParts[0] || '');
  villageChief.dailyTributeRewards = {
    goldFromFamiliars,
    goldFromHeroes,
    goldFromPets,
    goldFromDungeons,
    totalGold,
    potionSummary,
    partnerLevel
  };
  state.money += totalGold;
  updateResourcesDisplay();
  villageChief.dailyTributeDate = today;
  saveGame();
  const btn = document.getElementById("daily-tribute-btn");
  if (btn) {
    let title = "Claimed! Next collection available tomorrow.";
    title += `\n${totalGold} Gold`;
    if (potionSummary) title += `, ${potionSummary}`;
    btn.title = title;
  }
  dailyTributeInfo = {
    partnerLevel,
    potionSummary,
    goldFromFamiliars,
    goldFromHeroes,
    goldFromPets,
    goldFromDungeons,
    totalGold,
    claimedToday: false
  };
  showChiefExtra("DailyTribute");
}

let currentView = "home";
function showView(view = "home") {
  minigameClosed();
  
  // Restore population sections if leaving population view
  if (currentView === "population" && view !== "population") {
    restorePopulationSectionsToOriginal();
  }
  
  currentView = view;
  restOrderUsed = false;
  closeAllPanels();
  const sections = {
    village: document.getElementById("village-section"),
    terrain: document.getElementById("terrain-section"),
    specialBuilder: document.getElementById("special-builder-assignment"),
    games: document.getElementById("games-section"),
    missions: document.getElementById("missions-section"),
    pets: document.getElementById("pets-section"),
    petManagement: document.getElementById("pet-management-section"),
    heroes: document.getElementById("heroes-section"),
    profiles: document.getElementById("profiles-section"),
    tutorial: document.getElementById("tutorial-section"),
    settings: document.getElementById("settings-section"),
    population: document.getElementById("population-section"),
    productivity: document.getElementById("productivity-section")
  };
  Object.values(sections).forEach(sec => {
    if (sec) sec.style.display = "none";
  });

  if (["games", "settings", "tutorial"].includes(view)) {
    document.querySelector(".header").style.display = "none";
  } else {
    document.querySelector(".header").style.display = "flex";
  }
  const exportBtnEl = document.getElementById("export-btn");
  const importBtnEl = document.getElementById("import-btn");
  const resetBtnEl = document.getElementById("reset-btn");
  const logoutMain = document.getElementById("logout-btn-main");
  const logoutShare = document.getElementById("logout-btn-share");
  const shareWrap = document.getElementById("share-wrap");
  if (view === "profiles") {
    if (exportBtnEl) exportBtnEl.style.display = "none";
    if (importBtnEl) importBtnEl.style.display = "none";
    if (resetBtnEl) resetBtnEl.style.display = "none";
    if (logoutMain) logoutMain.style.display = "none";
    if (logoutShare) logoutShare.style.display = "inline-block";
    if (shareWrap) shareWrap.style.display = "flex";
    if (sections.heroes && sections.pets) {
      sections.pets.parentNode.insertBefore(sections.heroes, sections.pets);
    }
  } else {
    if (exportBtnEl) exportBtnEl.style.display = "inline-block";
    if (importBtnEl) importBtnEl.style.display = "inline-block";
    if (resetBtnEl) resetBtnEl.style.display = "inline-block";
    if (logoutMain) logoutMain.style.display = "inline-block";
    if (logoutShare) logoutShare.style.display = "none";
    if (shareWrap) shareWrap.style.display = "none";
    if (sections.heroes && sections.pets) {
      sections.heroes.parentNode.insertBefore(sections.pets, sections.heroes);
    }
  }
  const chief = document.getElementById("village-chief-section");
  const showChief = view === "home" || view === "heroes" || view === "profiles";
  if (chief) {
    chief.style.display = showChief ? "block" : "none";
    if (showChief) renderVillageChief();
  }

  if (view === "games") {
    if (sections.games) sections.games.style.display = "block";
    renderGames();
  } else if (view === "tutorial") {
    if (sections.tutorial) sections.tutorial.style.display = "block";
    renderTutorial();
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  } else if (view === "settings") {
    if (sections.settings) sections.settings.style.display = "block";
    renderSettings();
    const content = document.querySelector('.content');
    if (content) content.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  } else if (view === "population") {
    if (sections.population) {
      sections.population.style.display = "block";
      initPopulationView();
    }
  } else if (view === "productivity") {
    if (sections.productivity) sections.productivity.style.display = "block";
    initProductivityTabs();
  } else {
    if (view !== "home" && view !== "heroes" && view !== "pets" && sections[view]) {
      sections[view].style.display = "block";
    }
  }

  if (view === "village") {
    if (sections.terrain) {
      sections.terrain.style.display = "block";
      const upgradeState = Object.entries(state.upgradeTasks)
        .map(([k, v]) => `${k}:${v.time}`)
        .join('|');
      lastVillageState = {
        terrain: state.terrain,
        houses: state.houses,
        upgrades: upgradeState,
        food: state.food,
        wood: state.wood,
        stone: state.stone,
      };
      renderVillage();
      renderTerrains();
    }
    if (sections.specialBuilder) {
      sections.specialBuilder.style.display = "block";
      renderSection();
    }
  } else {
    if (sections.terrain) sections.terrain.style.display = "none";
    if (sections.specialBuilder) sections.specialBuilder.style.display = "none";
  }

  if ((view === "pets" || view === "profiles") && sections.pets) {
    sections.pets.style.display = "block";
    renderPets();
    if (view === "profiles") setupPetEventListeners();
  } else if (sections.pets) {
    sections.pets.style.display = "none";
  }
  if (sections.petManagement) {
    sections.petManagement.style.display = view === "pets" ? "block" : "none";
    if (view === "pets") {
      renderPetManagement();
      setupPetEventListeners();
    }
  }
  if (sections.heroes) {
    const hideHeroes = ["events", "missions", "games", "village", "tutorial", "settings", "population"].includes(view);
    sections.heroes.style.display = hideHeroes ? "none" : "block";
    if (!hideHeroes) {
      scheduleRenderHeroes();
    } else {
      cancelScheduledRenderHeroes();
    }
  }
  if (sections.profiles) {
    if (view === "profiles") {
      sections.profiles.style.display = "block";
    } else {
      sections.profiles.style.display = "none";
    }
  }

  if (view === "missions") {
    renderMissions();
    if (document.getElementById('group-mission-section')) {
      renderGroupMissions();
    }
  }

  document.querySelectorAll('.sidebar button').forEach(btn => {
    if (btn.dataset.view === view) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function renderFortuneWheel(card) {
  card.classList.add("card", "gold-border");
  const title = document.createElement("h3");
  title.textContent = "Wheel of Fortune";
  card.appendChild(title);

  const container = document.createElement("div");
  container.className = "wheel-container";
  const pointer = document.createElement("div");
  pointer.className = "pointer";
  container.appendChild(pointer);
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  container.appendChild(canvas);
  card.appendChild(container);

  const button = document.createElement("button");
  button.textContent = "Spin";
  button.className = "btn btn-green spin-btn white-text";
  button.disabled = fortuneDay === getToday();
  if (button.disabled) button.title = "1 time per day";
  card.appendChild(button);

  const resultDiv = document.createElement("div");
  resultDiv.className = "fortune-result";
  if (fortuneLastPrize) resultDiv.textContent = "You won: " + fortuneLastPrize;
  card.appendChild(resultDiv);

  var options = [
    "10500 Gold", "1680 Gold", "1770 Gold", "1860 Gold", "2040 Gold",
    "2220 Gold", "2580 Gold", "2850 Gold", "3300 Gold", "3750 Gold",
    "4200 Gold", "4650 Gold", "5100 Gold", "5550 Gold", "6000 Gold"
  ];
  const softColors = ["#FFFACD", "#D0E8F2", "#D5ECC2", "#FCE2DB", "#F6DFEB"];
  const colors = options.map((opt, i) =>
    i === 0 ? "#FFD700" : softColors[i % softColors.length]
  );

  const ctx = canvas.getContext("2d");
  canvas.style.display = "block";
  function setupCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.style.width = "400px";
    canvas.style.height = "400px";
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = rect.width / 2;
    centerX = rect.width / 2;
    centerY = rect.height / 2;
  }
  let radius, centerX, centerY;
  setupCanvas();
  window.addEventListener("resize", setupCanvas);
  let currentAngle = 0;

  function drawWheel() {
    const arc = (2 * Math.PI) / options.length;
    for (let i = 0; i < options.length; i++) {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = colors[i];
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + arc);
      ctx.fill();
      ctx.save();
      ctx.fillStyle = "#333";
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = "right";
      ctx.font = "bold 14px Arial";
      ctx.fillText(options[i], radius - 10, 5);
      ctx.restore();
    }
  }

  function drawRotatedWheel(angle) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    drawWheel();
    ctx.restore();
  }

  drawWheel();

  function award(prize) {
    if (prize.includes("Gold")) {
      state.money += parseInt(prize);
    } else if (prize.includes("Food")) {
      state.food += parseInt(prize);
    } else if (prize.includes("Wood")) {
      state.wood += parseInt(prize);
    } else if (prize.includes("Stone")) {
      state.stone += parseInt(prize);
    } else if (prize.includes("House")) {
      state.houses = Math.min(state.houses + 1, MAX_HOUSES);
    }
    updateResourcesDisplay();
    saveGame();
    renderVillage();
  }

  let spun = false;
  button.onclick = () => {
    if (spun) return;
    spun = true;
    button.disabled = true;
    button.title = "1 time per day";
    fortuneDay = getToday();
    const fbtn = document.querySelector('.fortune-button');
    if (fbtn) {
      fbtn.disabled = true;
      fbtn.title = '1 time per day';
    }
    const arc = 360 / options.length;
    const spinAngle = Math.floor(Math.random() * 360) + 360 * 5;
    const spinTime = 5000;
    const start = performance.now();
    const startAngle = currentAngle;
    const targetAngle = startAngle + spinAngle;
    resultDiv.textContent = "";

    function animate(ts) {
      const elapsed = ts - start;
      if (elapsed < spinTime) {
        const progress = elapsed / spinTime;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentAngle = startAngle + (targetAngle - startAngle) * easeOut;
        drawRotatedWheel(currentAngle);
        rAF(animate);
      } else {
        currentAngle = targetAngle;
        drawRotatedWheel(currentAngle);
        const normalized = (360 - (currentAngle % 360) + 270) % 360;
        const index = Math.floor(normalized / arc) % options.length;
        const result = options[index];
        resultDiv.textContent = "You won: " + result;
        fortuneLastPrize = result;
        award(result);
        const fbtn2 = document.querySelector('.fortune-button');
        if (fbtn2) {
          fbtn2.innerHTML = `FortuneWheel<br><span class='btn-subtext'>(You already won ${result}!)</span>`;
        }
      }
    }

    rAF(animate);
  };
}

function renderLifeMissions(card) {
  [...card.querySelectorAll(':scope > :not(.close-btn)')].forEach(el => el.remove());
  
  // Mostrar animación de experiencia la primera vez
  showExpGainAnimation('lifemissions', card);
  
  const title = document.createElement("h3");
  title.textContent = "Checklist";
  title.style.textAlign = "center";
  card.appendChild(title);

  // Botón de cerrar
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "❌";
  closeBtn.className = "close-btn";
  closeBtn.onclick = () => {
    const extraCard = document.getElementById('chief-extra');
    if (extraCard) {
      extraCard.style.display = 'none';
      extraCard.innerHTML = '';
      currentChiefExtra = null;
    }
  };
  card.appendChild(closeBtn);

  const readOnly = currentView === "profiles";

  const grid = document.createElement("div");
  grid.className = "tasks-grid";
  grid.style.alignSelf = "center";
  card.appendChild(grid);

  const otherInput = document.createElement("textarea");
  otherInput.id = "life-other-task";
  otherInput.placeholder = "Remember other task";
  otherInput.value = lifeOtherText;
  otherInput.onchange = () => {
    lifeOtherText = otherInput.value;
    saveGame();
  };
  otherInput.style.display = "block";
  otherInput.style.margin = "10px auto";
  otherInput.style.width = "450px";
  otherInput.style.height = "60px";
  if (readOnly) {
    otherInput.disabled = true;
  }
  card.appendChild(otherInput);

  const goldDisplay = document.createElement("div");
  goldDisplay.id = "life-gold-display";
  goldDisplay.style.textAlign = "left";
  goldDisplay.style.fontWeight = "bold";
  goldDisplay.style.fontSize = "1.2em";
  goldDisplay.style.paddingBottom = "15px"; // Agregar padding bottom
  card.appendChild(goldDisplay);

  if (lifeTasksDay !== getToday()) {
    const prev = lifeTasks;
    lifeTasks = Array.from({ length: 9 }, (_, i) => {
      const t = prev[i];
      if (t && t.text && !t.completed) {
        return { text: t.text, difficulty: t.difficulty, completed: false };
      }
      return { text: "", difficulty: "", completed: false };
    });
    lifeTasksDay = getToday();
    habitsLastProcessed = getToday();
    saveGame();
  }
  if (lifeGoldDay !== getToday()) {
    lifeGold = 0;
    lifeGoldDay = getToday();
    saveGame();
  }
  let totalGold = lifeGold;

  const difficulties = {
    easy: { gold: 400, class: "easy" },
    normal: { gold: 1000, class: "normal" },
    hard: { gold: 2500, class: "hard" }
  };

  const columns = [[], [], []];
  for (let i = 0; i < 9; i++) {
    const task = lifeTasks[i] || { text: "", difficulty: "", completed: false };
    const taskDiv = document.createElement("div");
    taskDiv.className = "task";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Task " + (i + 1);
    input.value = task.text;
    input.onchange = () => {
      lifeTasks[i].text = input.value;
      saveGame();
    };
    if (readOnly) input.disabled = true;

    const select = document.createElement("select");
    select.innerHTML = `
      <option value="">Difficulty</option>
      <option value="easy">Easy</option>
      <option value="normal">Normal</option>
      <option value="hard">Hard</option>`;
    select.value = task.difficulty;
    if (readOnly) select.disabled = true;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.disabled = true;
    checkbox.checked = task.completed;

    const applyDifficulty = () => {
      taskDiv.classList.remove("easy", "normal", "hard");
      if (select.value && difficulties[select.value]) {
        taskDiv.classList.add(difficulties[select.value].class);
        checkbox.disabled = false;
      } else {
        checkbox.disabled = true;
      }
    };
    applyDifficulty();

    if (task.completed || readOnly) {
      checkbox.disabled = true;
      select.disabled = true;
      input.disabled = true;
    }

    if (!readOnly) select.addEventListener("change", () => {
      lifeTasks[i].difficulty = select.value;
      if (!select.value) {
        checkbox.checked = false;
        lifeTasks[i].completed = false;
      }
      applyDifficulty();
      saveGame();
    });

    if (!readOnly) checkbox.addEventListener("change", () => {
      if (checkbox.checked && select.value && difficulties[select.value]) {
        const confirmMsg =
          "Are you sure you want to mark this task as completed?\nThis action cannot be undone.";
        checkbox.checked = false;
        openConfirm({
          message: confirmMsg,
          container: card,
          onConfirm: () => {
            checkbox.checked = true;
            const reward = difficulties[select.value].gold;
            state.money += reward;
            addHeroExp(villageChief, reward, CHIEF_MAX_LEVEL);
            renderVillageChief();
            lifeTasks[i].completed = true;
            checkbox.disabled = true;
            select.disabled = true;
            input.disabled = true;
            updateResourcesDisplay();
            lifeGold += reward;
            lifeGoldDay = getToday();
            totalGold = lifeGold;
            goldDisplay.innerHTML = "\uD83D\uDCB0 <b>Gold:</b> " + totalGold;
            saveGame();
            setTimeout(() => {
              renderLifeMissions(card);
              const next = card.querySelector('input[type="text"]:not([disabled])');
              if (next) focusNoScroll(next);
            }, 0);
          }});
      } else {
        checkbox.checked = false;
      }
    });

      if (task.completed && select.value && difficulties[select.value]) {
        // already accounted in lifeGold
      }

    taskDiv.appendChild(input);
    taskDiv.appendChild(select);
    taskDiv.appendChild(checkbox);
    if (task.completed && !readOnly) {
        const reset = document.createElement('span');
        reset.textContent = '🗑️';
        reset.className = 'reset-btn';
        reset.onclick = () => {
          lifeTasks[i] = { text: '', difficulty: '', completed: false };
          renderLifeMissions(card);
          saveGame();
        };
        taskDiv.appendChild(reset);
      }

    columns[i % 3].push(taskDiv);
  }

  columns.forEach(colTasks => {
    const colDiv = document.createElement("div");
    colDiv.className = "column";
    colTasks.forEach(task => colDiv.appendChild(task));
    grid.appendChild(colDiv);
  });
  goldDisplay.innerHTML = "\uD83D\uDCB0 <b>Gold:</b> " + totalGold;
  const first = card.querySelector('input[type="text"]:not([disabled])');
  if (first) focusNoScroll(first);
}

function checkHabitsMonth() {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (!habitsMonth || habitsMonth < current) {
    habitsMonth = current;
    if (!habitsData[habitsMonth]) habitsData[habitsMonth] = {};
    saveGame();
  }
  const max = new Date(now);
  max.setMonth(max.getMonth()+12);
  habitsMaxMonth = `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,'0')}`;
}

function updateHabitStats() {
  const today = new Date(getToday());
  let next = new Date(habitsLastProcessed);
  next.setDate(next.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  while (next <= yesterday) {
    const monthKey = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
    const day = next.getDate();
    const record = habitsData[monthKey]?.[day];
    if (record) {
      record.awarded = record.awarded || {};
      const checkAward = (field, stat) => {
        if (record[field] && !record.awarded[field]) {
          bossStats[stat] += 1;
          record.awarded[field] = true;
        }
      };
      checkAward('Training', 'fuerza');
      checkAward('Mental Health', 'mana');
      checkAward('Study', 'inteligencia');
      checkAward('Work', 'destreza');
      checkAward('Diary', 'vida');
      checkAward('Other1', 'suerte');
      checkAward('Other2', 'defensa');
    }
    habitsLastProcessed = next.toDateString();
    next.setDate(next.getDate() + 1);
  }
  scheduleSaveGame();
}

function isHabitEditable(year, month, day) {
  const today = new Date(getToday());
  const earliest = new Date(today);
  earliest.setUTCDate(earliest.getUTCDate() - 6);
  const target = new Date(Date.UTC(year, month - 1, day));
  return target >= earliest && target <= today;
}

// Función helper para mostrar la animación de experiencia ganada
function showExpGainAnimation(sectionName, container) {
  // Obtener la fecha actual (sin hora)
  const today = new Date().toISOString().split('T')[0]; // Formato: YYYY-MM-DD
  const storageKey = `expGainShown_${sectionName}`;
  
  // Verificar si ya se mostró hoy
  const storedData = localStorage.getItem(storageKey);
  if (storedData) {
    try {
      const { date } = JSON.parse(storedData);
      if (date === today) {
        return; // Ya se mostró hoy, no hacer nada
      }
    } catch (e) {
      // Si hay error al parsear, continuar y sobrescribir
    }
  }

  // Marcar como mostrado hoy
  localStorage.setItem(storageKey, JSON.stringify({ date: today, shown: true }));

  // Dar experiencia al VillageChief
  addHeroExp(villageChief, 100, CHIEF_MAX_LEVEL);
  saveGame();
  renderVillageChiefIfVisible();

  // Crear el contenedor del toast
  const toastStack = document.createElement('div');
  toastStack.id = `toast-stack-${sectionName}`;
  toastStack.style.cssText = `
    position: fixed;
    top: 28px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    width: min(92vw, 360px);
    z-index: 9999;
  `;

  // Crear el estilo
  const style = document.createElement('style');
  style.textContent = `
    .papyrus-toast {
      position: relative;
      width: 100%;
      background: radial-gradient(120% 90% at 50% 10%, rgba(255,255,255,0.55), rgba(247,232,195,0.85) 45%, rgba(214,183,120,0.9) 100%),
                  radial-gradient(150% 120% at 50% 120%, rgba(0,0,0,0.04), rgba(0,0,0,0.12));
      border-radius: 14px;
      padding: 12px 18px;
      text-align: center;
      color: #3a2710;
      font-family: "Cinzel", "MedievalSharp", serif;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-shadow: 0 1px 0 rgba(255,255,255,0.25);
      box-shadow:
        0 14px 40px rgba(0,0,0,0.45),
        inset 0 0 0 1px rgba(60,45,20,0.25),
        inset 0 1px 0 rgba(255,255,255,0.35);
      overflow: hidden;
      pointer-events: auto;
      animation:
        toast-pop 220ms ease-out,
        toast-float 2300ms ease-out forwards;
    }

    .papyrus-toast::before,
    .papyrus-toast::after{
      content:"";
      position:absolute;
      inset: 6px;
      border: 2px solid rgba(96,72,28,0.65);
      border-radius: 10px;
      pointer-events:none;
      opacity: 0.7;
    }
    
    .papyrus-toast::after{
      inset: 0;
      border: none;
      background:
        repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 4px),
        radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.2), transparent 60%);
      mix-blend-mode: multiply;
      opacity: 0.45;
    }

    .papyrus-toast .rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(96,72,28,0.9), transparent);
      margin: 8px 0 0;
      opacity: .65;
    }

    .toast-line {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: clamp(16px, 2.6vw, 22px);
    }
    
    .toast-line .star {
      font-size: 1.1em;
      line-height: 1;
      filter: drop-shadow(0 0 6px rgba(214,178,94,0.65));
    }
    
    .toast-line .exp {
      color: #d6b25e;
      text-shadow:
        -1px -1px 0 #000,
         0   -1px 0 #000,
         1px -1px 0 #000,
        -1px  0   0 #000,
         1px  0   0 #000,
        -1px  1px 0 #000,
         0    1px 0 #000,
         1px  1px 0 #000,
        0 0 6px rgba(214,178,94,0.55);
    }

    @keyframes toast-pop {
      from { transform: translateY(-8px) scale(0.96); opacity: 0; }
      to   { transform: translateY(0)    scale(1);     opacity: 1; }
    }
    
    @keyframes toast-float {
      0%   { opacity: 1; transform: translateY(0) scale(1); }
      70%  { opacity: 0.95; transform: translateY(-8px) scale(1.01); }
      100% { opacity: 0; transform: translateY(-20px) scale(1.02); }
    }
  `;

  // Crear el toast
  const toast = document.createElement('div');
  toast.className = 'papyrus-toast';
  toast.innerHTML = `
    <div class="toast-line">
      <span class="star">✦</span>
      <span>You gained</span>
      <span class="exp">100 Exp!</span>
      <span class="star">✦</span>
    </div>
    <div class="rule"></div>
  `;

  // Agregar todo al DOM
  document.head.appendChild(style);
  toastStack.appendChild(toast);
  document.body.appendChild(toastStack);

  // Remover después de la animación
  setTimeout(() => {
    toastStack.remove();
    style.remove();
  }, 2650);
}

async function renderDiary(card) {
  [...card.querySelectorAll(':scope > :not(.close-btn)')].forEach(el => el.remove());
  
  // Mostrar animación de experiencia la primera vez
  showExpGainAnimation('diary', card);
  
  // Crear iframe para cargar diary con srcdoc
  const iframeContainer = document.createElement('div');
  iframeContainer.style.width = '100%';
  iframeContainer.style.height = '80vh';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.borderRadius = '8px';
  iframeContainer.style.marginTop = '10px';
  
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  
  // Cargar el contenido usando el sistema de caché de minijuegos
  try {
    const htmlContent = await fetchMinigameHtml('diary.html');
    if (!htmlContent) {
      throw new Error('No content loaded');
    }
    
    // Usar srcdoc en lugar de src para evitar problemas de seguridad
    iframe.srcdoc = htmlContent;
    
    // Listener para recibir mensajes del iframe del diary
    const diaryMessageHandler = (event) => {
      if (event.data && event.data.type === 'dailyReward') {
        // Dar el oro
        state.money += event.data.amount;
        updateResourcesDisplay();
        saveGame();
      }
    };
    
    // Agregar el listener cuando el iframe carga
    iframe.onload = () => {
      window.addEventListener('message', diaryMessageHandler);
    };
    
    iframeContainer.appendChild(iframe);
    card.appendChild(iframeContainer);
  } catch (error) {
    console.error('Error loading diary.html:', error);
    const errorDiv = document.createElement('div');
    errorDiv.textContent = 'Error loading diary content';
    errorDiv.style.padding = '20px';
    errorDiv.style.color = 'red';
    card.appendChild(errorDiv);
  }

  // Botón de cerrar
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "❌";
  closeBtn.className = "close-btn";
  closeBtn.onclick = () => {
    const extraCard = document.getElementById('chief-extra');
    if (extraCard) {
      extraCard.style.display = 'none';
      extraCard.innerHTML = '';
      currentChiefExtra = null;
    }
  };
  card.appendChild(closeBtn);
}

async function renderWeekPlan(card) {
  [...card.querySelectorAll(':scope > :not(.close-btn)')].forEach(el => el.remove());
  
  // Mostrar animación de experiencia la primera vez
  showExpGainAnimation('weekplan', card);
  
  // Crear iframe para cargar weekplan con srcdoc
  const iframeContainer = document.createElement('div');
  iframeContainer.style.width = '100%';
  iframeContainer.style.height = '80vh';
  iframeContainer.style.overflow = 'hidden';
  iframeContainer.style.borderRadius = '8px';
  iframeContainer.style.marginTop = '10px';
  
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  
  // Cargar el contenido usando el sistema de caché de minijuegos
  try {
    const htmlContent = await fetchMinigameHtml('weekplan.html');
    if (!htmlContent) {
      throw new Error('No content loaded');
    }
    
    // Usar srcdoc en lugar de src para evitar problemas de seguridad
    iframe.srcdoc = htmlContent;
    
    iframeContainer.appendChild(iframe);
    card.appendChild(iframeContainer);
  } catch (error) {
    console.error('Error loading weekplan.html:', error);
    const errorDiv = document.createElement('div');
    errorDiv.textContent = 'Error loading weekplan content';
    errorDiv.style.padding = '20px';
    errorDiv.style.color = 'red';
    card.appendChild(errorDiv);
  }

  // Botón de cerrar
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "❌";
  closeBtn.className = "close-btn";
  closeBtn.onclick = () => {
    const extraCard = document.getElementById('chief-extra');
    if (extraCard) {
      extraCard.style.display = 'none';
      extraCard.innerHTML = '';
      currentChiefExtra = null;
    }
  };
  card.appendChild(closeBtn);
}

function renderHabits(card) {
  habitsCardEl = card;
  checkHabitsMonth();
  updateHabitStats();
  const [year, month] = habitsMonth.split('-').map(Number);
  const date = new Date(year, month - 1);
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth());
  card.innerHTML = '';
  card.style.position = 'relative';
  
  // Mostrar animación de experiencia la primera vez
  showExpGainAnimation('habits', card);
  
  // Botón de cerrar
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "❌";
  closeBtn.className = "close-btn";
  closeBtn.onclick = () => {
    const extraCard = document.getElementById('chief-extra');
    if (extraCard) {
      extraCard.style.display = 'none';
      extraCard.innerHTML = '';
      currentChiefExtra = null;
    }
  };
  card.appendChild(closeBtn);
  
  const title = document.createElement('h3');
  title.className = 'calendar-title';
  const prev = document.createElement('span');
  prev.textContent = '⬅️';
  prev.className = 'calendar-arrow';
  const prevDate = new Date(year, month - 2);
  if (prevDate < currentStart) prev.classList.add('disabled');
  prev.onclick = () => {
    if (prevDate < currentStart) return;
    habitsMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    if (!habitsData[habitsMonth]) habitsData[habitsMonth] = {};
    renderHabits(card);
    saveGame();
  };
  const label = document.createElement('span');
  label.textContent = date.toLocaleString('en', { month: 'long', year: 'numeric' });
  const next = document.createElement('span');
  next.textContent = '➡️';
  next.className = 'calendar-arrow';
  const maxDate = new Date(habitsMaxMonth.split('-')[0], habitsMaxMonth.split('-')[1] - 1);
  const nextDate = new Date(year, month);
  if (nextDate > maxDate) next.classList.add('disabled');
  next.onclick = () => {
    if (nextDate > maxDate) return;
    habitsMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    if (!habitsData[habitsMonth]) habitsData[habitsMonth] = {};
    renderHabits(card);
    saveGame();
  };
  title.appendChild(prev);
  title.appendChild(label);
  title.appendChild(next);
  card.appendChild(title);

  const weekRow = document.createElement('div');
  weekRow.className = 'calendar-weekdays';
  const weekNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  weekNames.forEach(d => {
    const w = document.createElement('div');
    w.textContent = d;
    weekRow.appendChild(w);
  });
  card.appendChild(weekRow);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  card.appendChild(grid);

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = new Date(year, month - 1, 1).getDay();
  const offset = (startDay + 6) % 7;
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty-day';
    grid.appendChild(empty);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('button');
    btn.className = 'calendar-day';
    const editable = isHabitEditable(year, month, d);
    if (!editable) btn.classList.add('locked');
    const record = habitsData[habitsMonth]?.[d] || {};
    const num = document.createElement('div');
    num.className = 'calendar-day-num';
    num.textContent = d;
    const bellWrap = document.createElement('div');
    bellWrap.className = 'calendar-event-bell-wrap';
    bellWrap.onclick = e => { e.stopPropagation(); openHabitEventPopup(d); };
    bellWrap.title = record.Event || '';
    const bell = document.createElement('div');
    bell.className = 'calendar-event-bell';
    bell.textContent = '🔔';
    if (record.Event) bell.classList.add('has-event');
    bellWrap.appendChild(bell);
    btn.appendChild(num);
    btn.appendChild(bellWrap);
    const icons = document.createElement('div');
    icons.className = 'calendar-icons';
    const rows = [0, 1, 2, 3].map(() => {
      const r = document.createElement('div');
      r.className = 'icon-row';
      return r;
    });
    const order = [
      'Training',
      'Mental Health',
      'Study',
      'Work',
      'Other1',
      'Other2',
      'Diary'
    ];
    const iconMap = {
      Training: '💪',
      'Mental Health': '🧠',
      Study: '📚',
      Work: '💼',
      Other1: '🍀',
      Other2: '🛡️',
      Diary: '💗'
    };
    order.forEach((k, idx) => {
      if (record[k]) {
        const span = document.createElement('span');
        span.textContent = iconMap[k];
        if (k === 'Diary') span.className = 'diary-icon';
        if (k === 'Other1') span.className = 'other1-icon';
        if (k === 'Other2') span.className = 'other2-icon';
        const rowIdx = idx < 2 ? 0 : idx < 4 ? 1 : idx < 6 ? 2 : 3;
        rows[rowIdx].appendChild(span);
      }
    });
    rows.forEach(r => icons.appendChild(r));
    const daily = document.createElement('div');
    daily.className = 'daily-stats';
    const pomos = record.Pomodoros || 0;
    const meds = record.Meditations || 0;
    daily.innerHTML = `Pomodoros: ${pomos}<br>Meditations: ${meds}`;
    btn.appendChild(icons);
    btn.appendChild(daily);
    if (editable && currentView !== "profiles") btn.onclick = () => openHabitPopup(d, card, btn);
    grid.appendChild(btn);
  }

}

function openHabitPopup(day, container, btn) {
  if (currentView === "profiles") return;
  const [year, month] = habitsMonth.split('-').map(Number);
  if (!isHabitEditable(year, month, day)) return;
  const monthData = habitsData[habitsMonth] || (habitsData[habitsMonth] = {});
  const record = monthData[day] || (monthData[day] = {});
  record.awarded = record.awarded || {};

  const startDay = new Date(year, month - 1, 1).getDay();
  const offset = (startDay + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = offset + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const index = offset + day - 1;
  const row = Math.floor(index / 7);
  const grid = container.querySelector('.calendar-grid');
  let target = btn;
  if (row < 2 && grid.children[offset + 7]) {
    target = grid.children[offset + 7];
  } else if (row >= rows - 2 && grid.children[offset + 7 * (rows - 2)]) {
    target = grid.children[offset + 7 * (rows - 2)];
  }
  target.scrollIntoView({ block: 'center' });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') removeOverlay(overlay);
  });
  const modal = document.createElement('div');
  modal.className = 'modal';
  const close = document.createElement('button');
  close.textContent = 'x';
  close.className = 'close-btn';
  close.onclick = () => removeOverlay(overlay);
  modal.appendChild(close);
  const fields = ['Training','Mental Health','Study','Work','Other1','Other2'];
  const placeholderMap = {
    Training: 'Training(Str)',
    'Mental Health': 'Mental Health(Mana)',
    Study: 'Study(Int)',
    Work: 'Work(Dex)',
    Other1: 'Other1(Luck)',
    Other2: 'Other2(Def)'
  };
  const inputs = {};
  fields.forEach(f => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholderMap[f];
    input.value = record[f] || '';
    modal.appendChild(input);
    inputs[f] = input;
  });
  const diary = document.createElement('textarea');
  diary.placeholder = 'Diary(HP)';
  diary.value = record.Diary || '';
  modal.appendChild(diary);
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.justifyContent = 'flex-end';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'btn btn-blue';
  saveBtn.onclick = () => {
    let gainedGold = 0;
    fields.forEach(f => {
      const oldVal = record[f] || '';
      const newVal = inputs[f].value;
      if (!oldVal && newVal && !record.awarded[f]) {
        if (f === 'Training') bossStats.fuerza += 1;
        if (f === 'Mental Health') bossStats.mana += 1;
        if (f === 'Study') bossStats.inteligencia += 1;
        if (f === 'Work') bossStats.destreza += 1;
        if (f === 'Other1') bossStats.suerte += 1;
        if (f === 'Other2') bossStats.defensa += 1;
        record.awarded[f] = true;
        state.money += 500;
        gainedGold += 500;
      }
      record[f] = newVal;
    });
    const oldDiary = record.Diary || '';
    const newDiary = diary.value;
    if (!oldDiary && newDiary && !record.awarded.Diary) {
      bossStats.vida += 1;
      record.awarded.Diary = true;
      state.money += 500;
      gainedGold += 500;
    }
    record.Diary = newDiary;
    if (gainedGold > 0) updateResourcesDisplay();
    updateHabitStats();
    renderVillageChief();
    saveGame();
    
    // Actualizar el botón del día inmediatamente
    if (btn && record) {
      // Remover los iconos antiguos
      const oldIcons = btn.querySelector('.calendar-icons');
      if (oldIcons) oldIcons.remove();
      
      // Crear nuevos iconos
      const icons = document.createElement('div');
      icons.className = 'calendar-icons';
      const rows = [0, 1, 2, 3].map(() => {
        const r = document.createElement('div');
        r.className = 'icon-row';
        return r;
      });
      const order = ['Training', 'Mental Health', 'Study', 'Work', 'Other1', 'Other2', 'Diary'];
      const iconMap = {
        Training: '💪',
        'Mental Health': '🧠',
        Study: '📚',
        Work: '💼',
        Other1: '🍀',
        Other2: '🛡️',
        Diary: '💗'
      };
      order.forEach((k, idx) => {
        if (record[k]) {
          const span = document.createElement('span');
          span.textContent = iconMap[k];
          if (k === 'Diary') span.className = 'diary-icon';
          if (k === 'Other1') span.className = 'other1-icon';
          if (k === 'Other2') span.className = 'other2-icon';
          const rowIdx = idx < 2 ? 0 : idx < 4 ? 1 : idx < 6 ? 2 : 3;
          rows[rowIdx].appendChild(span);
        }
      });
      rows.forEach(r => icons.appendChild(r));
      
      // Insertar los nuevos iconos antes de daily-stats
      const dailyStats = btn.querySelector('.daily-stats');
      if (dailyStats) {
        btn.insertBefore(icons, dailyStats);
      } else {
        btn.appendChild(icons);
      }
    }
    
    removeOverlay(overlay);
  };
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'btn btn-green white-text';
  closeBtn.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(closeBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  container.appendChild(overlay);
  overlay.focus();
}

function openHabitEventPopup(day) {
  const [year, month] = habitsMonth.split('-').map(Number);
  const monthData = habitsData[habitsMonth] || (habitsData[habitsMonth] = {});
  const record = monthData[day] || (monthData[day] = {});
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;
  const modal = document.createElement('div');
  modal.className = 'modal';
  const close = document.createElement('button');
  close.textContent = 'x';
  close.className = 'close-btn';
  close.onclick = () => removeOverlay(overlay);
  modal.appendChild(close);
  const label = document.createElement('label');
  label.textContent = 'Event remainder';
  label.style.display = 'block';
  const input = document.createElement('textarea');
  input.style.width = '100%';
  input.rows = 6;
  input.value = record.Event || '';
  modal.appendChild(label);
  modal.appendChild(input);
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'btn btn-blue';
  const save = () => {
    record.Event = input.value;
    saveGame();
    removeOverlay(overlay);
    if (habitsCardEl) renderHabits(habitsCardEl);
  };
  saveBtn.onclick = save;
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      removeOverlay(overlay);
    }
  });
  modal.appendChild(saveBtn);
  overlay.appendChild(modal);
  appendOverlay(overlay, habitsCardEl);
  input.focus();
}

function renderEnemyEncounter(card, container = card, showVillains = true) {
  enemySetup(card, container, showVillains);
}

function enemySetup(card, container = card, showVillains = true) {
  pauseTimersFor(3000);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay card-modal";
  const modal = document.createElement("div");
  modal.className = "modal";

  if (container) container.style.position = 'relative';
  const title = container.querySelector('h1');
  if (title) {
    overlay.style.alignItems = 'start';
    overlay.style.justifyItems = 'center';
    overlay.style.paddingTop = `${title.offsetTop}px`;
  }

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Enemy Name";

  const originInput = document.createElement("input");
  originInput.type = "text";
  originInput.placeholder = "Origin";
  const originList = document.createElement('datalist');
  const originListId = `enemy-origin-${Date.now()}`;
  originList.id = originListId;
  getHeroOrigins().forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    originList.appendChild(opt);
  });
  originInput.setAttribute('list', originListId);

  const heroSelect = document.createElement("select");
  heroSelect.id = "villain-origin-selector";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.style.display = "none";
  const fileLabel = document.createElement("button");
  fileLabel.textContent = "Enemy Avatar";
  fileLabel.className = "btn btn-green white-text";
  const fileNameSpan = document.createElement("span");
  fileNameSpan.textContent = "None Selected";
  const avatarPreview = document.createElement("img");
  avatarPreview.className = "avatar modal-avatar";
  avatarPreview.style.display = "none";
  avatarPreview.onclick = () => fileInput.click();
  let avatarData = "";
  fileLabel.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      resizeImageToBase64(file, 160, 200, resized => {
        avatarData = resized;
        avatarPreview.src = resized;
        avatarPreview.style.display = "block";
        fileNameSpan.style.display = "none";
      });
    } else {
      avatarData = "";
      avatarPreview.style.display = "none";
      fileNameSpan.textContent = "None Selected";
      fileNameSpan.style.display = "inline";
    }
  };

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.gap = "6px";

    const ok = document.createElement("button");
    ok.textContent = "Start";
    ok.className = "btn btn-blue white-text";
  ok.style.flex = "1";
  ok.onclick = () => {
    const heroId = parseInt(heroSelect.value);
    if (!heroId) return;
    const hero = state.heroMap.get(heroId);
    const name = nameInput.value.trim() || "Enemy";
    const origin = originInput.value.trim() || "No origin";
    const avatar = avatarData;
    removeOverlay(overlay);
    const tempEnemy = { name, origin, avatar, avatarOffset: 50 };
    startEnemyGame(card, hero, tempEnemy);
  };

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.className = "btn btn-green white-text";
  cancel.style.flex = "1";
  cancel.onclick = () => {
    removeOverlay(overlay);
    card.innerHTML = "";
    state.buildSelectionOpen = false;
    showView(currentView);
    renderGames();
  };

  buttons.appendChild(ok);
  buttons.appendChild(cancel);
  modal.appendChild(nameInput);
  modal.appendChild(originInput);
  modal.appendChild(originList);
  const avatarRow = document.createElement("div");
  avatarRow.style.display = "flex";
  avatarRow.style.gap = "6px";
  avatarRow.style.alignItems = "center";
  avatarRow.appendChild(fileLabel);
  avatarRow.appendChild(fileNameSpan);
  avatarRow.appendChild(avatarPreview);
  modal.appendChild(avatarRow);
  modal.appendChild(heroSelect);
  modal.appendChild(fileInput);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
  showHeroSelector();
  if (heroSelect.options.length === 0) ok.disabled = true;
  updateSummonInputs();
  focusNoScroll(nameInput);
}

  function startEnemyGame(card, hero, villain) {
    const globalState = state;
  minigameOpened();
  card.innerHTML = "";
  card.style.display = "grid";
  let endTimer = 0;
  const close = document.createElement("button");
  close.textContent = "x";
  close.className = "close-btn enemy-game-close";
  close.onclick = () => {
    running = false;
    stopLoop();
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    window.removeEventListener('resize', setupCanvas);
    minigameClosed();
    unloadAllAudio();
    card.innerHTML = "";
    card.style.display = "none";
    globalState.buildSelectionOpen = false;
    scheduleRenderHeroes();
    renderGames();
    updateResourcesDisplay();
  };
  card.appendChild(close);
  const container = document.createElement("div");
  container.className = "enemy-game-container";
  container.style.gridColumn = "1 / -1";
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  container.appendChild(canvas);
  const message = document.createElement("div");
  message.className = "enemy-message";
  message.textContent = "New Enemy founded";
  message.style.display = "none";
  container.appendChild(message);
  card.appendChild(container);
  let goldReward = 0;
  const XP_REWARD = 20;
  const ctx = canvas.getContext("2d");
  function setupCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);
  const heroImg = new Image();
  heroImg.src = hero.avatar || EMPTY_SRC;
  const vilImg = new Image();
  vilImg.src = villain.avatar || EMPTY_SRC;
  preloadAudio(["src/arrow.mp3", "src/vanish.mp3"]);
  const bulletPool = createPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 60, remove: false }));
  const SPEED = { HERO: 280, ENEMY: 160, BULLET: 700 };

    const enemyState = {
    hx: 50,
    hy: 200,
    ex: 350,
    ey: 200,
    bullets: [],
    over: false,
    arm: 0,
    enemyTargetX: 350,
    enemyTargetY: 200,
    enemyMoveTime: 0,
    enemyHp: 100
  };
  let running = true;

  function drawStick(x, y, color, img, armSwing) {
    const w = 60;
    const h = 170;
    const top = y - h;
    const left = x - w / 2;
    const r = 8;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = "white";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left, top, w, h, r);
    } else {
      ctx.moveTo(left + r, top);
      ctx.lineTo(left + w - r, top);
      ctx.quadraticCurveTo(left + w, top, left + w, top + r);
      ctx.lineTo(left + w, top + h - r);
      ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
      ctx.lineTo(left + r, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
    }
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left, top, w, h, r);
    } else {
      ctx.moveTo(left + r, top);
      ctx.lineTo(left + w - r, top);
      ctx.quadraticCurveTo(left + w, top, left + w, top + r);
      ctx.lineTo(left + w, top + h - r);
      ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
      ctx.lineTo(left + r, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
    }
    ctx.clip();
    if (img.complete) {
      ctx.drawImage(img, left, top, w, h);
    }
    ctx.restore();
  }

  function drawHealthBar(x, y, hp) {
    const w = 60;
    const h = 8;
    const pct = Math.max(0, hp) / 100;
    const bx = x - w / 2;
    const by = y - 90;
    ctx.fillStyle = "#333";
    ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = "#999";
    ctx.strokeRect(bx, by, w, h);
    ctx.fillStyle = "#cc0000";
    ctx.fillRect(bx + 1, by + 1, (w - 2) * pct, h - 2);
  }

  const keys = {};
  function shoot(tx, ty) {
      const angle = Math.atan2(ty - enemyState.hy, tx - enemyState.hx);
      const b = bulletPool.acquire();
      b.x = enemyState.hx;
      b.y = enemyState.hy;
    b.vx = Math.cos(angle) * SPEED.BULLET;
    b.vy = Math.sin(angle) * SPEED.BULLET;
    b.life = 60;
    b.remove = false;
      enemyState.bullets.push(b);
    playSound("src/arrow.mp3");
  }
  const onKeyDown = e => {
    keys[e.key.toLowerCase()] = true;
      if (e.key === " ") {
        e.preventDefault();
        shoot(enemyState.ex, enemyState.ey);
    }
  };
  const onKeyUp = e => {
      keys[e.key.toLowerCase()] = false;
  };
  document.addEventListener("keydown", onKeyDown, { passive: false });
  document.addEventListener("keyup", onKeyUp);

  function update(dt) {
    if (document.hidden) return;
      if (!running && !enemyState.over) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const speed = SPEED.HERO * dt;
    const maxX = canvas.width;
    const maxY = canvas.height;
      if (keys["a"]) enemyState.hx = Math.max(0, enemyState.hx - speed);
      if (keys["d"]) enemyState.hx = Math.min(maxX, enemyState.hx + speed);
      if (keys["w"]) enemyState.hy = Math.max(0, enemyState.hy - speed);
      if (keys["s"]) enemyState.hy = Math.min(maxY, enemyState.hy + speed);
      if (keys["a"] || keys["d"] || keys["w"] || keys["s"]) {
        enemyState.arm += 0.2 * dt;
    }

      enemyState.enemyMoveTime -= dt;
      if (enemyState.enemyMoveTime <= 0) {
        enemyState.enemyTargetX = Math.random() * maxX;
        enemyState.enemyTargetY = Math.random() * (maxY - 60) + 30;
        enemyState.enemyMoveTime = 0.8 + Math.random() * 0.8;
    }
      const dx = enemyState.enemyTargetX - enemyState.ex;
      const dy = enemyState.enemyTargetY - enemyState.ey;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = SPEED.ENEMY * dt;
      const ratio = Math.min(step / dist, 1);
        enemyState.ex += dx * ratio;
        enemyState.ey += dy * ratio;
    }

      drawStick(enemyState.hx, enemyState.hy, "green", heroImg, Math.sin(enemyState.arm));
      if (!enemyState.over) {
        drawStick(enemyState.ex, enemyState.ey, "red", vilImg, 0);
        drawHealthBar(enemyState.ex, enemyState.ey, enemyState.enemyHp);
    }

      enemyState.bullets.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
        const left = enemyState.ex - 40;
        const top = enemyState.ey - 150;
        if (
          !enemyState.over &&
        b.x >= left &&
        b.x <= left + 80 &&
        b.y >= top &&
        b.y <= top + 150
      ) {
          enemyState.enemyHp -= 10;
          if (enemyState.enemyHp <= 0) {
            enemyState.enemyHp = 0;
            enemyState.over = true;
          playSound("src/vanish.mp3");
          goldReward = 200 + Math.floor(Math.random() * 301);
          message.textContent = `New Enemy founded (${hero.name} ha ganado ${XP_REWARD} exp y ${goldReward} gold)`;
          message.style.display = "block";
        }
        b.remove = true;
      }
    });
      enemyState.bullets = enemyState.bullets.filter(b => {
      const keep = !b.remove && b.life > 0 && b.x >= 0 && b.x <= canvas.width && b.y >= 0 && b.y <= canvas.height;
      if (!keep) bulletPool.release(b);
      return keep;
    });
      if (enemyState.over && running) {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStick(enemyState.hx, enemyState.hy, "green", heroImg, Math.sin(enemyState.arm));
    }
    checkEnd(dt);
  }

  function draw() {}

  canvas.addEventListener("pointerdown", e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tx = (e.clientX - rect.left) * scaleX;
    const ty = (e.clientY - rect.top) * scaleY;
    shoot(tx, ty);
  });

  startLoop(update, draw);

  function checkEnd(dt) {
      if (!enemyState.over) return;
    endTimer += dt;
    if (endTimer >= 0.5) {
      endTimer = 0;
      running = false;
      stopLoop();
        addHeroExp(hero, XP_REWARD);
        enemyCount++;
        globalState.money += goldReward;
        hero.energia = Math.floor(hero.energia * 0.5);
      saveGame();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener('resize', setupCanvas);
      minigameClosed();
      unloadAllAudio();
      card.innerHTML = "";
      card.style.display = "none";
      globalState.buildSelectionOpen = false;
      scheduleRenderHeroes();
      renderGames();
      updateResourcesDisplay();
    }
  }
}

  function bossSetup(card, container = document.getElementById("games-section")) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay card-modal";
    const modal = document.createElement("div");
    modal.className = "modal boss-modal";
    if (container) {
      container.style.position = 'relative';
      const title = container.querySelector('h1');
      if (title) {
        overlay.style.alignItems = 'start';
        overlay.style.justifyItems = 'center';
        overlay.style.paddingTop = `${title.offsetTop}px`;
      }
    }

    const wrap = document.createElement("div");
  wrap.className = "boss-select-grid";

  const roles = [
    { label: "Choose Archer1", type: "archer" },
    { label: "Choose Archer2", type: "archer" },
    { label: "Choose Mage1", type: "mage" },
    { label: "Choose Mage2", type: "mage" },
    { label: "Choose Warrior1", type: "warrior" },
    { label: "ChooseWarrior2", type: "warrior" }
  ];

  const selects = [];
  const avatars = [];
  const statDivs = [];

  const refresh = () => {
    selects.forEach((sel, idx) => {
      const current = parseInt(sel.value) || 0;
      sel.innerHTML = "";
      const opt = document.createElement("option");
      opt.textContent = roles[idx].label;
      opt.value = "";
      sel.appendChild(opt);
      state.heroes.forEach(h => {
        const taken = selects.some((s, j) => j !== idx && parseInt(s.value) === h.id);
        if (!taken && !isBusy(h) && (h.energia || 0) >= 30) {
          const o = document.createElement("option");
          o.value = h.id;
          const roleType = roles[idx].type;
          const profName = roleType.charAt(0).toUpperCase() + roleType.slice(1);
          const icon = professionIcons[profName] || "";
          const statLabel = roleType === "archer" ? "Dex" : roleType === "mage" ? "Int" : "Str";
          const statVal = roleType === "archer" ? h.stats.destreza : roleType === "mage" ? h.stats.inteligencia : h.stats.fuerza;
          const hasProf = (h.professions || []).includes(profName);
          o.textContent = `${hasProf ? icon + " " : ""}${h.name} (${statLabel}: ${statVal})`;
          if (hasProf) o.style.color = '#b28d25';
          if (h.id === current) o.selected = true;
          sel.appendChild(o);
        }
      });
    });
    selects.forEach((sel, i) => {
      const img = avatars[i];
      const statBox = statDivs[i];
      const id = parseInt(sel.value);
      const role = roles[i].type;
      if (id) {
        const h = state.heroMap.get(id);
        img.src = h.avatar || EMPTY_SRC;
        if (!h.avatar) img.classList.add("empty"); else img.classList.remove("empty");
        const dex = h.stats.destreza;
        const intl = h.stats.inteligencia;
        const str = h.stats.fuerza;
        statBox.innerHTML = `\n          <div class="boss-stat-line${role === 'archer' ? ' highlight-stat' : ''}">Dexterity: ${dex}</div>\n          <div class="boss-stat-line${role === 'mage' ? ' highlight-stat' : ''}">Intelligence: ${intl}</div>\n          <div class="boss-stat-line${role === 'warrior' ? ' highlight-stat' : ''}">Strength: ${str}</div>`;
      } else {
        img.src = EMPTY_SRC;
        img.classList.add("empty");
        statBox.innerHTML = `\n          <div class="boss-stat-line${role === 'archer' ? ' highlight-stat' : ''}">Dexterity:</div>\n          <div class="boss-stat-line${role === 'mage' ? ' highlight-stat' : ''}">Intelligence:</div>\n          <div class="boss-stat-line${role === 'warrior' ? ' highlight-stat' : ''}">Strength:</div>`;
      }
    });
    startBtn.disabled = selects.some(s => !parseInt(s.value));
    const remaining = selects.filter(s => !parseInt(s.value)).length;
    notice.textContent = remaining ? `Select ${remaining} more hero(s)` : "";
  };

  roles.forEach((r, i) => {
    const box = document.createElement("div");
    box.className = "mission-slot boss-slot";

    const avatar = document.createElement("img");
    avatar.src = EMPTY_SRC;
    avatar.className = "mission-avatar empty";
    avatars[i] = avatar;
    box.appendChild(avatar);

    const stat = document.createElement("div");
    statDivs[i] = stat;

    const sel = document.createElement("select");
    selects[i] = sel;
    sel.onchange = refresh;
    box.appendChild(sel);
    box.appendChild(stat);
    wrap.appendChild(box);
  });

  const notice = document.createElement("div");
  notice.className = "boss-select-notice";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "6px";

  const startBtn = document.createElement("button");
  startBtn.textContent = "Start";
  startBtn.className = "btn btn-blue";
  startBtn.style.flex = "1";
  startBtn.disabled = true;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "btn btn-green white-text";
  closeBtn.style.flex = "1";
  closeBtn.onclick = () => removeOverlay(overlay);

  controls.appendChild(startBtn);
  controls.appendChild(closeBtn);

    startBtn.onclick = () => {
      const chosen = selects.map(sel => state.heroMap.get(parseInt(sel.value)));
      removeOverlay(overlay);
      startBossRush(card, chosen);
    };

  modal.appendChild(wrap);
  modal.appendChild(notice);
  modal.appendChild(controls);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
  refresh();
}

function startBossRush(card, selectedHeroes) {
  minigameOpened();
  card.innerHTML = "";
  card.style.display = "flex";
  card.classList.add("boss-rush-card");
  card.style.position = "relative";
  card.style.flexDirection = "column";
  card.style.gap = "6px";
  card.style.paddingBottom = "10px";

  const close = document.createElement("button");
  close.textContent = "x";
  close.className = "close-btn";

  let running = true;
  let timer;
  let bulletInterval;
  const heroBackup = state.heroes;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    running = false;
    clearInterval(timer);
    clearInterval(bulletInterval);
    state.heroes = heroBackup;
    scheduleRenderHeroes();
  };

  close.onclick = () => {
    cleanup();
    minigameClosed();
    unloadAllAudio();
    card.innerHTML = "";
    card.style.display = "none";
    card.classList.remove("boss-rush-card");
    renderGames();
    saveGame();
  };
  card.appendChild(close);
  const topRow = document.createElement("div");
  topRow.className = "boss-rush-top";

  const soundBtn = document.createElement("button");
  soundBtn.textContent = "\ud83d\udd0a";
  soundBtn.className = "btn btn-green sound-btn";
  soundBtn.style.position = "absolute";
  soundBtn.style.left = "10px";
  topRow.appendChild(soundBtn);

  const centerWrap = document.createElement("div");
  centerWrap.className = "boss-middle";
  topRow.appendChild(centerWrap);

  const heroLabels = document.createElement("div");
  heroLabels.className = "boss-heroes";
  const heroTypes = ["archer", "archer", "mage", "mage", "warrior", "warrior"];
  const heroInfo = selectedHeroes.map((h, i) => ({
    name: h ? h.name : "?",
    type: heroTypes[i],
    icon: heroTypes[i] === "archer" ? "\u27B6" : heroTypes[i] === "mage" ? "\ud83d\udd25" : "\u2694",
    stat:
      i < 2
        ? h ? h.stats.destreza : 0
        : i < 4
        ? h ? h.stats.inteligencia : 0
        : h ? h.stats.fuerza : 0,
    statLabel: i < 2 ? "dex" : i < 4 ? "int" : "str"
  }));
  heroInfo.forEach(h => {
    const d = document.createElement("div");
    d.className = "hero-info";
    d.innerHTML = `<div class="hero-icon">${h.icon}</div><div>${h.name}</div><div class="stat">(${h.stat} ${h.statLabel})</div>`;
    heroLabels.appendChild(d);
  });
  card.appendChild(topRow);

  const label = document.createElement("div");
  label.className = "boss-label";
  label.textContent = `GiantBoss: ${giantBossLevel}`;
  label.style.paddingTop = "10px";
  centerWrap.appendChild(label);

  const hpBar = document.createElement("div");
  hpBar.className = "boss-health";
  hpBar.style.width = "380px";
  const hpFill = document.createElement("div");
  hpFill.className = "boss-health-fill";
  hpFill.style.width = "100%";
  const hpText = document.createElement("div");
  hpText.className = "boss-health-text";
  hpBar.appendChild(hpFill);
  hpBar.appendChild(hpText);
  centerWrap.appendChild(hpBar);
  centerWrap.appendChild(heroLabels);

  const container = document.createElement("div");
  container.className = "boss-rush-container";
  container.style.gridColumn = "1 / -1";
  const canvas = document.createElement("canvas");
  canvas.height = 400;
  container.appendChild(canvas);
  card.appendChild(container);
  canvas.width = container.clientWidth || 800;
  const message = document.createElement("div");
  message.className = "enemy-message";
  message.style.display = "none";
  container.appendChild(message);

  const timerEl = document.createElement("div");
  timerEl.className = "timer boss-timer";
  timerEl.textContent = "30s";
  container.appendChild(timerEl);

  const ctx = canvas.getContext("2d");
  const floor = canvas.height - 50;
  const bossHp = 40 + (giantBossLevel - 1);
  const boss = {
    x: canvas.width - 200,
    y: floor - 110,
    hp: bossHp,
    max: bossHp,
    size: 220
  };
  hpText.textContent = `${boss.hp} / ${boss.max}`;
  const OFFSET = boss.size / 2;
  const wall = { x: 355 + OFFSET, width: 150, height: 100, offset: 3 };
  const archerWall = { x: 80 + OFFSET, width: 140, height: 150, offset: 3 };
  const HERO_SCALE = 1.8;
  const HERO_HEIGHT = 64 * HERO_SCALE;
  const GROUND_OFFSET = 112;
  const heroImgs = selectedHeroes.map(h => {
    const img = new Image();
    img.src = (h && h.avatar) ? h.avatar : EMPTY_SRC;
    return img;
  });
  state.heroes = [
    { x: archerWall.x + 30, y: floor - archerWall.height - HERO_HEIGHT + archerWall.offset + GROUND_OFFSET + 1, type: "archer", img: heroImgs[0], idx: 0, stat: selectedHeroes[0] ? selectedHeroes[0].stats.destreza : 1 },
    { x: archerWall.x + archerWall.width - 30, y: floor - archerWall.height - HERO_HEIGHT + archerWall.offset + GROUND_OFFSET + 1, type: "archer", img: heroImgs[1], idx: 1, stat: selectedHeroes[1] ? selectedHeroes[1].stats.destreza : 1 },
    { x: wall.x + 28, y: floor - wall.height - HERO_HEIGHT + wall.offset + GROUND_OFFSET + 1, type: "mage", img: heroImgs[2], idx: 2, stat: selectedHeroes[2] ? selectedHeroes[2].stats.inteligencia : 1 },
    { x: wall.x + wall.width - 28, y: floor - wall.height - HERO_HEIGHT + wall.offset + GROUND_OFFSET + 1, type: "mage", img: heroImgs[3], idx: 3, stat: selectedHeroes[3] ? selectedHeroes[3].stats.inteligencia : 1 },
    { x: wall.x + wall.width + 180, y: floor - HERO_HEIGHT + GROUND_OFFSET + 1, type: "warrior", img: heroImgs[4], idx: 4, stat: selectedHeroes[4] ? selectedHeroes[4].stats.fuerza : 1 },
    { x: wall.x + wall.width + 260, y: floor - HERO_HEIGHT + GROUND_OFFSET + 1, type: "warrior", img: heroImgs[5], idx: 5, stat: selectedHeroes[5] ? selectedHeroes[5].stats.fuerza : 1 },
  ];
  let bullets = [];
  let damageTexts = [];
  const damageTextPool = createPool(() => ({ x: 0, y: 0, opacity: 1, value: 0 }));
  message.style.left = '10px';
  message.style.bottom = '10px';
  message.style.top = 'auto';
  message.style.transform = 'none';

  preloadAudio(["src/arrow.mp3", "src/fireball.mp3", "src/sword.mp3", "src/vanish.mp3", "src/VictorySound.mp3", "src/LosingSound.mp3"]);
  const bulletPool = createPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, icon: '', damage: 0, life: 120, remove: false }));
  let soundOn = true;
  soundBtn.onclick = () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "\ud83d\udd0a" : "\ud83d\udd07";
    getHowler().then(h => h.mute(!soundOn));
  };

  function drawStick(x, y, img, offset) {
    const SCALE = HERO_SCALE;
    const w = 40 * SCALE;
    const h = HERO_HEIGHT;
    const left = x - w / 2;
    const top = y - h;
    const r = 8 * SCALE;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left, top, w, h, r);
    } else {
      ctx.moveTo(left + r, top);
      ctx.lineTo(left + w - r, top);
      ctx.quadraticCurveTo(left + w, top, left + w, top + r);
      ctx.lineTo(left + w, top + h - r);
      ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
      ctx.lineTo(left + r, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
    }
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left, top, w, h, r);
    } else {
      ctx.moveTo(left + r, top);
      ctx.lineTo(left + w - r, top);
      ctx.quadraticCurveTo(left + w, top, left + w, top + r);
      ctx.lineTo(left + w, top + h - r);
      ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
      ctx.lineTo(left + r, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - r);
      ctx.lineTo(left, top + r);
      ctx.quadraticCurveTo(left, top, left + r, top);
    }
    ctx.clip();
    if (img && img.complete) {
      ctx.drawImage(img, left, top, w, h);
    }
    ctx.restore();
  }

  function spawnBullet(h) {
    if (boss.hp <= 0) return;
    let icon;
    if (h.type === "archer") {
      icon = "\u27B6";
      playSound("src/arrow.mp3");
    } else if (h.type === "mage") {
      icon = "\ud83d\udd25";
      playSound("src/fireball.mp3");
    } else {
      icon = "\uD83D\uDDE1";
      playSound("src/sword.mp3");
    }
    const targetX = boss.x;
    const targetY = boss.y - boss.size / 2;
    const angle = Math.atan2(targetY - h.y, targetX - h.x);
    const damage = h.stat || 1;
    const b = bulletPool.acquire();
    b.x = h.x;
    b.y = h.y;
    b.vx = Math.cos(angle) * 5;
    b.vy = Math.sin(angle) * 5;
    b.icon = icon;
    b.damage = damage;
    b.life = 120;
    b.remove = false;
    bullets.push(b);
  }

  bulletInterval = setInterval(() => {
    state.heroes.forEach(h => spawnBullet(h));
  }, 1000); // Mantener 1 segundo para animaciones fluidas
  let tick = 0;

  let lastDraw = 0;
  function draw(ts) {
    if (!running) return;
    if (!lastDraw) lastDraw = ts;
    const delta = ts - lastDraw;
    lastDraw = ts;
    const dt = Math.min(delta, 64) / 16;
    tick += 0.1 * dt;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#888";
    const archerBottom = floor + archerWall.offset;
    ctx.fillRect(archerWall.x, archerBottom - archerWall.height, archerWall.width, archerWall.height);
    const wallBottom = floor + wall.offset;
    ctx.fillRect(wall.x, wallBottom - wall.height, wall.width, wall.height);

    state.heroes.forEach(h => drawStick(h.x, h.y, h.img, h.idx));

    ctx.font = `${boss.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(boss.hp > 0 ? "\ud83d\udc79" : "\ud83d\udc80", boss.x, boss.y);

    ctx.font = "20px sans-serif";
    bullets.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      ctx.fillText(b.icon, b.x, b.y);
      if (
        b.x >= boss.x - boss.size * 0.66 &&
        b.x <= boss.x + boss.size * 0.66 &&
        b.y >= boss.y - boss.size * 0.66 &&
        b.y <= boss.y + boss.size * 0.66 &&
        boss.hp > 0
      ) {
        boss.hp -= b.damage;
        hpFill.style.width = `${(boss.hp / boss.max) * 100}%`;
        hpText.textContent = `${boss.hp} / ${boss.max}`;
        const t = damageTextPool.acquire();
        t.x = boss.x;
        t.y = boss.y - boss.size / 2 - 40;
        t.opacity = 1;
        t.value = b.damage;
        damageTexts.push(t);
        b.remove = true;
        if (boss.hp <= 0) finish(true);
      }
    });
    bullets = bullets.filter(b => {
      const keep = !b.remove && b.life > 0 && b.x >= 0 && b.x <= canvas.width && b.y >= 0 && b.y <= canvas.height;
      if (!keep) bulletPool.release(b);
      return keep;
    });

    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 32px sans-serif";
    damageTexts.forEach(t => {
      ctx.globalAlpha = t.opacity;
      ctx.fillText(`-${t.value}`, t.x, t.y);
      t.y -= 1 * dt;
      t.opacity -= 0.02 * dt;
    });
    ctx.globalAlpha = 1;
    damageTexts = damageTexts.filter(t => {
      const keep = t.opacity > 0;
      if (!keep) damageTextPool.release(t);
      return keep;
    });
    if (running) rAF(draw);
  }

  let time = 30;
  timerEl.textContent = `${time}s`;
  timer = setInterval(() => {
    time--;
    timerEl.textContent = `${time}s`;
    if (time <= 0) finish(false);
  }, 1000); // Mantener 1 segundo para countdown fluido

  function finish(win) {
    cleanup();
    bossRushCount++;
    const reward = 50 * giantBossLevel;
    if (win) {
      playSound("src/vanish.mp3");
      playSound("src/VictorySound.mp3");
      selectedHeroes.forEach(h => {
        if (h) {
          addHeroExp(h, 20);
          h.energia = Math.max(0, h.energia - 30);
          autoStartRest(h);
        }
      });
      state.money += reward;
      updateResourcesDisplay();
      scheduleRenderHeroes();
    } else {
      playSound("src/LosingSound.mp3");
    }
    giantBossLevel++;
    label.textContent = `GiantBoss: ${giantBossLevel}`;
    saveGame();
    message.style.display = "block";
    message.textContent = win ? `Victory! You won ${reward} Gold!` : "Defeat!";
    hpText.textContent = `${boss.hp} / ${boss.max}`;
    rAF(draw);
  }

  rAF(draw);
}


export function showBuildModal() {
  hideBuildCard();
  const selectCard = document.getElementById("build-select-card");
  if (!selectCard) return;
  selectCard.classList.remove('progress-card');
  state.buildSelectionOpen = true;
  upgradePreviewLabel = null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay card-modal";
  const modal = document.createElement("div");
  modal.className = "modal";
  const grid = document.createElement("div");
  grid.style.display = "flex";
  grid.style.gap = "10px";
  grid.style.justifyContent = "center";
  grid.style.width = "100%";
  buildSelectAvatars = [];
  buildSelectSelects = [];
  for (let i=0;i<3;i++){
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.alignItems = "center";
    col.style.gap = "8px";
    const img = document.createElement("img");
    img.className = "modal-avatar empty";
    buildSelectAvatars[i] = img;
    const sel = document.createElement("select");
    sel.addEventListener("change", () => {
      refreshBuildSelectionOptions();
      checkReady();
    });
    buildSelectSelects[i] = sel;
    col.appendChild(img);
    col.appendChild(sel);
    grid.appendChild(col);
  }
  const width = Math.max(buildSelectSelects.length * 110 + 40, 520);
  modal.style.width = `${Math.min(width, window.innerWidth * 0.92)}px`;
  modal.appendChild(grid);
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  btnRow.style.justifyContent = "center";
  btnRow.style.width = "100%";
  const buildBtn = document.createElement("button");
  buildBtn.textContent = "Improve";
  buildBtn.className = "btn btn-blue";
  buildBtn.title = getBuildHouseTooltip();
  buildBtn.onclick = () => {
    if (state.houses >= MAX_HOUSES) {
      removeOverlay(overlay);
      showAlert("Need more terrain");
      return;
    }
    const cost = 10 * (state.houses + 1);
    if (state.food < cost || state.wood < cost || state.stone < cost) {
      removeOverlay(overlay);
      showAlert("Not enough materials");
      return;
    }
    state.buildingTask.cost = cost;
    state.food = Math.max(0, state.food - cost);
    state.wood = Math.max(0, state.wood - cost);
    state.stone = Math.max(0, state.stone - cost);
    const previewSrc = "src/Buildings/House.png";
    removeOverlay(overlay);
    selectCard.innerHTML = "";
    selectCard.classList.add('progress-card');
    const close = document.createElement("button");
    close.textContent = "x";
    close.className = "close-btn";
    close.onclick = () => {
      selectCard.style.display = "none";
      showInlineBuildTimer();
      // Forzar refresh del overlay del botón al cerrar la card
      if (state.buildingTask.time > 0) {
        showInlineBuildTimer();
      }
    };
    selectCard.appendChild(close);
    const img = document.createElement("img");
    img.src = previewSrc;
    img.className = "build-progress";
    const ids = buildSelectSelects.map(sel => parseInt(sel.value) || null);
    appendBuildHeroes(selectCard, ids);
    selectCard.appendChild(img);
    const timerEl = document.createElement("div");
    timerEl.id = "build-house-timer";
    timerEl.className = "timer";
    timerEl.style.textAlign = "center";
    selectCard.appendChild(timerEl);
    buildTimerEls.main = timerEl;
    selectCard.style.display = "grid";
    const inline = document.getElementById("build-house-inline-timer");
    if (inline) inline.remove();
    state.buildingTask.heroIds = ids;
    state.buildingTask.heroes = ids.map(id => state.heroMap.get(id));
    state.buildingTask.time = 300;
    state.buildingTask.endAt = Date.now() + state.buildingTask.time * 1000;
    state.buildingTask.heroes.forEach(h => {
      if (h) {
        h.buildStartExp = { level: h.level, exp: h.exp };
        addHeroExp(h, 20);
        h.energia = Math.max(0, h.energia - 30);
        h.buildTime = state.buildingTask.time;
        autoStartRest(h);
      }
    });
    updateResourcesDisplay();
    resumeBuild();
    renderVillageIfVisible();
    // Ensure heroes assigned to construction don't appear in mission selector
    renderMissions();
    scheduleRenderHeroes();
    state.buildSelectionOpen = false;
  };
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "btn btn-green white-text";
  closeBtn.onclick = () => {
    removeOverlay(overlay);
    state.buildSelectionOpen = false;
  };
  btnRow.appendChild(buildBtn);
  btnRow.appendChild(closeBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, document.getElementById('village-section'));
  const checkReady = () => {
    const cost = 10 * (state.houses + 1);
    const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
    buildBtn.disabled = buildSelectSelects.some(s => !parseInt(s.value)) || state.houses >= MAX_HOUSES || state.buildingTask.time > 0 || insufficient;
    if (state.buildingTask.time > 0) {
      buildBtn.title = "House under construction";
    } else if (insufficient) {
      buildBtn.title = `¡Insufficiente Resources! ${getBuildHouseTooltip()}`;
    } else if (state.houses >= MAX_HOUSES) {
      buildBtn.title = "Need more terrain";
    } else {
      buildBtn.title = getBuildHouseTooltip();
    }
  };
  refreshBuildSelectionOptions();
  checkReady();
  updateUpgradePreview();
}

export function showStorageModal() {
  hideBuildCard();
  const card = document.getElementById("build-select-card");
  if (!card) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay card-modal";
  const modal = document.createElement("div");
  modal.className = "modal";
  const select = document.createElement("select");
  ["Food Storage", "Wood Storage", "Stone Storage"].forEach(txt => {
    const o = document.createElement("option");
    o.value = txt;
    o.textContent = txt;
    select.appendChild(o);
  });
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  const ok = document.createElement("button");
  ok.textContent = "Accept";
  ok.className = "btn btn-blue";
  ok.onclick = () => {
    removeOverlay(overlay);
    showVillageExtra(select.value);
  };
  const close = document.createElement("button");
  close.textContent = "Close";
  close.className = "btn btn-green white-text";
  close.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(close);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, document.getElementById('village-section'));
}

export function showTrainingModal() {
  hideBuildCard();
  const card = document.getElementById("build-select-card");
  if (!card) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal";
  const select = document.createElement("select");
  [
    "Gym",
    "ArcheryField",
    "MageAcademy",
    "BoxingRing",
    "LifeAltar",
    "Ashram",
    "FortuneTotem",
  ].forEach(txt => {
    const o = document.createElement("option");
    o.value = txt;
    o.textContent = txt;
    select.appendChild(o);
  });
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  const ok = document.createElement("button");
  ok.textContent = "Accept";
  ok.className = "btn btn-blue";
  ok.onclick = () => {
    removeOverlay(overlay);
    showVillageExtra(select.value);
  };
  const close = document.createElement("button");
  close.textContent = "Close";
  close.className = "btn btn-green white-text";
  close.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(close);
  modal.appendChild(select);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
}

export function showSilenceTempleModal() {
  const container = (currentView === 'productivity' ? document.getElementById('productivity-section') : null) || document.getElementById('village-chief');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.padding = '10px';
  
  // Si estamos en productivity, mostrar habilidades del village chief
  const select = document.createElement('select');
  select.style.width = '100%';
  select.style.marginBottom = '10px';
  
  if (currentView === 'productivity') {
    // Mostrar solo habilidades desbloqueadas del village chief
    for (let i = 0; i < unlockedHabilities; i++) {
      const hab = villageChief.habilities[i];
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${hab.name} (Lvl: ${hab.level || 1})`;
      select.appendChild(o);
    }
  } else {
    // Comportamiento original para familiars (solo desbloqueados)
    for (let i = 0; i < unlockedFamiliars; i++) {
      const fam = villageChief.familiars[i];
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${fam.name} (Lvl: ${fam.level || 1})`;
      select.appendChild(o);
    }
  }
  const techSelect = document.createElement('select');
  [
    ['446','🫁 4-4-6 Relaxing (Inhalar 4s, mantener 4s, exhalar 6s)'],
    ['kapalabhati','🔥 Kapalabhati Energizing (Respiración rápida con exhalaciones forzadas)'],
    ['nadi','🌬️ Nadi Shodhana / Nadi Balancing (Respiración alterna por las fosas nasales)']
  ].forEach(([val,txt])=>{
    const o=document.createElement('option');
    o.value=val;
    o.textContent=txt;
    techSelect.appendChild(o);
  });
  const techBenefits = {
    '446': [
      'Activa el sistema nervioso parasimpático',
      'Reduce el estrés y la ansiedad',
      'Mejora el sueño y la relajación general'
    ],
    'kapalabhati': [
      'Aumenta la energía y la claridad mental',
      'Estimula el sistema digestivo',
      'Limpia las vías respiratorias y despierta el cuerpo'
    ],
    'nadi': [
      'Equilibra ambos hemisferios cerebrales',
      'Calma la mente y mejora la concentración',
      'Armoniza el flujo de energía (prana)'
    ]
  };
  const benefitsDiv = document.createElement('div');
  benefitsDiv.style.fontSize = '0.9rem';
  benefitsDiv.style.margin = '8px 0';
  function renderBenefits() {
    benefitsDiv.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Beneficios:';
    title.style.fontWeight = 'bold';
    benefitsDiv.appendChild(title);
    const ul = document.createElement('ul');
    (techBenefits[techSelect.value] || []).forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    benefitsDiv.appendChild(ul);
  }
  techSelect.onchange = renderBenefits;
  renderBenefits();
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.justifyContent = 'center';
  const ok = document.createElement('button');
  ok.textContent = 'Meditate';
  ok.className = 'btn btn-blue white-text';
  ok.onclick = () => {
    const idx = parseInt(select.value);
    removeOverlay(overlay);
    
    if (currentView === 'productivity') {
      // Para productivity, usar habilidades del village chief
      currentSilenceAbility = villageChief.habilities[idx];
      const tech = techSelect.value;
      renderSilenceTempleCard(currentSilenceAbility, tech, 'ability');
    } else {
      // Comportamiento original para familiars
      currentSilenceFam = villageChief.familiars[idx];
      const tech = techSelect.value;
      renderSilenceTempleCard(currentSilenceFam, tech, 'familiar');
    }
  };
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.className = 'btn btn-green white-text';
  close.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(close);
  modal.appendChild(select);
  modal.appendChild(techSelect);
  modal.appendChild(benefitsDiv);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
}

function renderSilenceTempleCard(target, tech = '446', type = 'familiar') {
  const card = (currentView === 'productivity' ? document.getElementById('productivity-extra') : null) || document.getElementById('chief-extra');
  if (!card) return;
  card.innerHTML = '';
  minigameOpened();
  const close = document.createElement('button');
  close.textContent = 'x';
  close.className = 'close-btn';
  close.type = 'button';
  close.onclick = showCloseConfirm;
  card.appendChild(close);
  const iframe = document.createElement('iframe');
  iframe.className = 'html-game-frame';
  const url = new URL('src/OtherMinigames/SilenceTemple.html', location.href);
  url.searchParams.set('name', target.name);
  url.searchParams.set('level', target.level || 1);
  url.searchParams.set('tech', tech);
  url.searchParams.set('type', type);
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const day = today.getDate();
  const rec = habitsData[monthKey]?.[day] || {};
  dailyMeditations = rec.Meditations || 0;
  url.searchParams.set('daily', dailyMeditations);
  iframe.src = url.toString();
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'familiarData',
      name: target.name,
      level: target.level || 1,
      img: resolveSrc(target.img || EMPTY_SRC)
    }, '*');
  };
  if (silenceMsgHandler) window.removeEventListener('message', silenceMsgHandler);
  silenceMsgHandler = e => {
    if (e.data && e.data.type === 'silenceTempleComplete' && (currentSilenceFam || currentSilenceAbility)) {
      const target = currentSilenceAbility || currentSilenceFam;
      target.level = (target.level || 1) + 1;
      state.money += 2000;
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      const day = today.getDate();
      habitsData[monthKey] = habitsData[monthKey] || {};
      const rec = habitsData[monthKey][day] = habitsData[monthKey][day] || {};
      rec.Meditations = (rec.Meditations || 0) + 1;
      dailyMeditations = rec.Meditations;
      saveGame();
      renderVillageChief();
      const vc = document.getElementById('village-chief');
      showAlert(`${target.name} leveled up! You also won 2000Gold!`, { container: vc });
      if (currentChiefExtra === 'Habits') {
        const c = document.getElementById('chief-extra');
        if (c) renderHabits(c);
      }
      card.innerHTML = '';
      card.style.display = 'none';
      currentSilenceFam = null;
      currentSilenceAbility = null;
      window.removeEventListener('message', silenceMsgHandler);
      silenceMsgHandler = null;
      minigameClosed();
    }
  };
  window.addEventListener('message', silenceMsgHandler);
  card.appendChild(iframe);
  card.style.display = 'block';

  function closeMinigame() {
    if (silenceMsgHandler) {
      window.removeEventListener('message', silenceMsgHandler);
      silenceMsgHandler = null;
    }
    card.innerHTML = '';
    card.style.display = 'none';
    minigameClosed();
  }

  function showCloseConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay card-modal';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const msg = document.createElement('p');
    msg.textContent = 'Exit meditation?';

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.justifyContent = 'center';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-red';
    confirmBtn.textContent = 'Exit';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-green';
    cancelBtn.textContent = 'Cancel';

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(msg);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    card.appendChild(overlay);

    const focusables = [confirmBtn, cancelBtn];
    let focusIdx = 0;
    confirmBtn.focus();

    function remove() {
      overlay.remove();
      close.focus();
    }

    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        remove();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        focusIdx = e.shiftKey
          ? (focusIdx + focusables.length - 1) % focusables.length
          : (focusIdx + 1) % focusables.length;
        focusables[focusIdx].focus();
      }
    });

    cancelBtn.onclick = remove;
    confirmBtn.onclick = () => {
      remove();
      closeMinigame();
    };
  }
}


export function showPomodoroTowerModal() {
  const card = (currentView === 'productivity' ? document.getElementById('productivity-extra') : null) || document.getElementById('chief-extra');
  const container = (currentView === 'productivity' ? document.getElementById('productivity-section') : null) || document.getElementById('village-chief');
  if (currentPomodoroAbility) {
    if (card && card.firstChild) {
      card.style.display = 'block';
      return;
    }
    renderPomodoroTowerCard(currentPomodoroAbility);
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const select = document.createElement('select');
  for (let i = 0; i < unlockedHabilities; i++) {
    const ab = villageChief.habilities[i];
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${ab.name} (Lvl: ${ab.level || 1})`;
    select.appendChild(o);
  }
  const timeSelect = document.createElement('select');
  [25,45].forEach(t=>{
    const o=document.createElement('option');
    o.value=t;
    o.textContent=`${t} min`;
    timeSelect.appendChild(o);
  });
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const ok = document.createElement('button');
  ok.textContent = 'Start';
  ok.className = 'btn btn-blue';
  ok.onclick = () => {
    const idx = parseInt(select.value);
    currentPomodoroMinutes = parseInt(timeSelect.value);
    removeOverlay(overlay);
    currentPomodoroAbility = villageChief.habilities[idx];
    renderPomodoroTowerCard(currentPomodoroAbility, currentPomodoroMinutes);
  };
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.className = 'btn btn-green white-text';
  close.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(ok);
  btnRow.appendChild(close);
  modal.appendChild(select);
  modal.appendChild(timeSelect);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
}

function renderPomodoroTowerCard(ab, minutes = 25) {
  const card = (currentView === 'productivity' ? document.getElementById('productivity-extra') : null) || document.getElementById('chief-extra');
  if (!card) return;
  card.innerHTML = '';
  minigameOpened();
  ensureNotificationPermission();
  const controls = document.createElement('div');
  controls.style.position = 'absolute';
  controls.style.top = '4px';
  controls.style.right = '8px';
  controls.style.display = 'flex';
  controls.style.gap = '4px';

  const close = document.createElement('button');
  close.textContent = 'x';
  close.className = 'close-btn';
  close.style.fontSize = '1.4em';
  close.style.position = 'static';
  close.style.top = 'auto';
  close.style.right = 'auto';
  close.onclick = showCloseConfirm;
  const hide = document.createElement('button');
  hide.textContent = '–';
  hide.className = 'minus-small';
  hide.style.fontSize = '1.4em';
  hide.style.position = 'static';
  hide.onclick = () => { card.style.display = 'none'; };
  controls.appendChild(hide);
  controls.appendChild(close);
  card.appendChild(controls);
  const iframe = document.createElement('iframe');
  iframe.className = 'html-game-frame';
  const key = Date.now().toString();
  sessionStorage.setItem(
    'pomodoroTowerData-' + key,
    JSON.stringify({ name: ab.name, level: ab.level || 1, img: ab.img, minutes })
  );
  const url = new URL('minigames/PomodoroTower.html', location.href);
  url.searchParams.set('key', key);
  url.searchParams.set('minutes', minutes);
  iframe.dataset.key = key;
  iframe.src = url.toString();
  card.appendChild(iframe);
  function showCloseConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay card-modal';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const msg = document.createElement('p');
    msg.textContent = 'If you close the pomodoro the timer will reset to 0 and you will need to choose an ability again.';
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.justifyContent = 'center';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-red';
    confirmBtn.textContent = 'Exit';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-green';
    cancelBtn.textContent = 'Cancel';
    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(msg);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    card.appendChild(overlay);
    const focusables = [confirmBtn, cancelBtn];
    let focusIdx = 0;
    confirmBtn.focus();
    function remove() {
      overlay.remove();
      close.focus();
    }
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        remove();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        focusIdx = e.shiftKey
          ? (focusIdx + focusables.length - 1) % focusables.length
          : (focusIdx + 1) % focusables.length;
        focusables[focusIdx].focus();
      }
    });
    cancelBtn.onclick = remove;
    confirmBtn.onclick = () => {
      remove();
      if (pomodoroMsgHandler) {
        window.removeEventListener('message', pomodoroMsgHandler);
        pomodoroMsgHandler = null;
      }
      const frame = card.querySelector('iframe');
      if (frame && frame.dataset.key) {
        sessionStorage.removeItem('pomodoroTowerData-' + frame.dataset.key);
      }
      currentPomodoroAbility = null;
      card.innerHTML = '';
      card.style.display = 'none';
      minigameClosed();
    };
  }
  if (pomodoroMsgHandler) window.removeEventListener('message', pomodoroMsgHandler);
  pomodoroMsgHandler = e => {
    if (e.data && e.data.type === 'pomodoroTowerComplete' && currentPomodoroAbility) {
      currentPomodoroAbility.level = (currentPomodoroAbility.level || 1) + 1;
      const reward = currentPomodoroMinutes === 45 ? 5000 : 2500;
      state.money += reward;
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      const day = today.getDate();
      habitsData[monthKey] = habitsData[monthKey] || {};
      const rec = habitsData[monthKey][day] = habitsData[monthKey][day] || {};
      rec.Pomodoros = (rec.Pomodoros || 0) + 1;
      dailyPomodoros = rec.Pomodoros;
      showBreakNotification(currentPomodoroAbility.name);
      playPomodoroLevelSound();
      saveGame();
      renderVillageChief();
      const vc = document.getElementById('village-chief');
      showAlert(`${currentPomodoroAbility.name} leveled up! You also won ${reward}Gold!`, { container: vc });
      setTimeout(() => playPomodoroLevelSound(), 2000);
      if (currentChiefExtra === 'Habits') {
        const c = document.getElementById('chief-extra');
        if (c) renderHabits(c);
      }
      const c = document.getElementById('chief-extra');
      if (c) {
        const frame = c.querySelector('iframe');
        if (frame && frame.dataset.key) {
          sessionStorage.removeItem('pomodoroTowerData-' + frame.dataset.key);
        }
        c.innerHTML = '';
        c.style.display = 'none';
      }
      currentPomodoroAbility = null;
      window.removeEventListener('message', pomodoroMsgHandler);
      pomodoroMsgHandler = null;
      minigameClosed();
    }
  };
  window.addEventListener('message', pomodoroMsgHandler);
  card.style.display = 'block';
}

export function getBuildHouseTooltip() {
  const cost = 10 * (state.houses + 1);
  return `-${cost} Food -${cost} Wood -${cost} Stone +1House +20Exp -30% Energy`;
}

export function getUpgradeRequirements(label) {
  let lvl = state.buildingLevels[label] || 0;
  if (label === 'PetSanctuary') {
    const inferred = (MAX_PETS ?? 5) - 5;
    if (lvl < inferred) lvl = inferred;
  }
  let cost;
  let energy = 30;
  let exp = 10;
  if (label === 'Castle') {
    cost = (lvl + 1) * 50;
    energy = 50;
    exp = 50;
  } else if (label === 'Tower') {
    cost = (lvl + 1) * 20;
    energy = 50;
    exp = 30;
  } else if (label === 'PetSanctuary') {
    cost = (MAX_PETS + 1) * 20;
    energy = 50;
    exp = 30;
  } else {
    cost = (lvl + 1) * 10;
  }
  return { cost, energy, exp };
}

export function getUpgradeTooltip(label) {
  const { cost, energy, exp } = getUpgradeRequirements(label);
  return `-${cost} Food -${cost} Wood -${cost} Stone -${energy}% Energy +${exp} Exp`;
}

export function buildHouse() {
  state.houses += 1;
  state.buildingTask.heroes.forEach(h => {
    if (h) {
      h.buildTime = 0;
      delete h.buildStartExp;
    }
  });
  state.buildingTask.heroIds = [null, null, null];
  state.buildingTask.heroes = [null, null, null];
  state.buildingTask.time = 0;
  state.buildingTask.cost = 0;
  state.buildingTask.endAt = 0;
  state.buildingTask.lastTimeShown = null;
  updateResourcesDisplay();
  const selTimerEl = document.getElementById("build-select-timer");
  const startBtnEl = document.querySelector("#build-select-card .btn-blue");
  if (selTimerEl) selTimerEl.remove();
  if (startBtnEl) startBtnEl.disabled = false;
  const inlineCard = document.getElementById("build-house-inline-timer");
  if (inlineCard) inlineCard.remove();
  buildTimerEls.main = null;
  buildTimerEls.select = null;
  buildTimerEls.inline = null;
  const progressCard = document.getElementById("build-select-card");
  if (progressCard) {
    progressCard.style.display = "none";
    progressCard.classList.remove("progress-card");
  }
  const mainBtn = document.querySelector('#build-house-column button');
  if (mainBtn) {
    const cost = 10 * (state.houses + 1);
    const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
    mainBtn.disabled = state.houses >= state.terrain * 5 || insufficient;
    mainBtn.style.background = mainBtn.disabled ? 'gray' : '';
    if (state.houses >= state.terrain * 5) {
      mainBtn.title = 'Need more terrain';
    } else if (insufficient) {
      mainBtn.title = `¡Insufficiente Resources! ${getBuildHouseTooltip()}`;
    } else {
      mainBtn.title = getBuildHouseTooltip();
    }
  }
  if (state.buildSelectionOpen) {
    showBuildModal();
  }
  renderVillage();
  if (!anyStatsOpen()) renderHeroesIfVisible();
}

export function resumeBuild() {
  if (state.buildingTask.time <= 0) return;
  if (state.buildingTask.endAt) {
    state.buildingTask.time = Math.max(0, Math.ceil((state.buildingTask.endAt - Date.now()) / 1000));
    if (state.buildingTask.time <= 0) {
      buildHouse();
      return;
    }
  } else {
    state.buildingTask.endAt = Date.now() + state.buildingTask.time * 1000;
  }
  const selectCard = document.getElementById("build-select-card");
  if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === "none")) {
    showInlineBuildTimer();
  }
  buildTimerEls.main = document.getElementById("build-house-timer");
  buildTimerEls.select = document.getElementById("build-select-timer");
  buildTimerEls.inline = document.getElementById("build-house-inline-time");
  const text = formatTime(state.buildingTask.time);
  [buildTimerEls.main, buildTimerEls.select, buildTimerEls.inline].forEach(el => queueTimerText(el, text));
  state.buildingTask.lastTimeShown = state.buildingTask.time;
  constructionWorker.postMessage({ idConstruccion: 'build', tiempoRestante: state.buildingTask.time, tipo: 'build' });
}


export function showInlineBuildTimer() {
  const group = document.getElementById("build-house-column");
  if (!group) return;
  let wrap = document.getElementById("build-house-inline-timer");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "build-house-inline-timer";
    wrap.className = "build-inline-timer";
    const time = document.createElement("span");
    time.id = "build-house-inline-time";
    time.className = "timer";
    wrap.appendChild(time);
    buildTimerEls.inline = time;
    const down = document.createElement("button");
    down.textContent = "\u25BC";
    down.className = "down-small";
    down.onclick = (e) => {
      e.stopPropagation();
      const progress = document.getElementById("build-select-card");
      if (progress) {
        if (!progress.querySelector('#build-house-timer')) {
          progress.innerHTML = '';
          progress.classList.add('progress-card');
          const close = document.createElement('button');
          close.textContent = 'x';
          close.className = 'close-btn';
          close.onclick = () => { progress.style.display = 'none'; progress.classList.remove('progress-card'); showInlineBuildTimer(); };
          progress.appendChild(close);
          const img = document.createElement('img');
          img.src = 'src/Buildings/House.png';
          img.className = 'build-progress';
          appendBuildHeroes(progress, state.buildingTask.heroIds);
          progress.appendChild(img);
          const timerEl = document.createElement('div');
          timerEl.id = 'build-house-timer';
          timerEl.className = 'timer';
          timerEl.style.textAlign = 'center';
          progress.appendChild(timerEl);
          buildTimerEls.main = timerEl;
        }
        progress.style.display = 'flex';
      }
      wrap.remove();
    };
    wrap.appendChild(down);
    const stop = document.createElement("button");
    stop.textContent = "\u274C";
    stop.className = "close-small";
    stop.onclick = (e) => { e.stopPropagation(); cancelBuild(); };
    wrap.appendChild(stop);
  }
  const btn = group.querySelector('button');
  if (btn && wrap.parentElement !== group) group.appendChild(wrap);
  const timeEl = document.getElementById("build-house-inline-time");
  if (timeEl) timeEl.textContent = formatTime(state.buildingTask.time);
  updateBuildButtonHeight();
}

export function showUpgradeInlineTimer(label) {
  const btn = document.getElementById(`btn-${label}`);
  if (!btn) return;
  let wrap = document.getElementById(`upgrade-inline-${label}`);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = `upgrade-inline-${label}`;
    wrap.className = 'upgrade-inline-timer';
    const time = document.createElement('span');
    time.id = `upgrade-inline-time-${label}`;
    time.className = 'timer';
    wrap.appendChild(time);
    const ref = upgradeTimerRefs.get(label) || {};
    ref.inline = time;
    upgradeTimerRefs.set(label, ref);
    const down = document.createElement('button');
    down.textContent = '\u25BC';
    down.className = 'down-small';
    down.onclick = (e) => {
      e.stopPropagation();
      showUpgradeProgress(label);
      wrap.remove();
      const ref = upgradeTimerRefs.get(label);
      if (ref) ref.inline = null;
    };
    wrap.appendChild(down);
    const stop = document.createElement('button');
    stop.textContent = '\u274C';
    stop.className = 'close-small';
    stop.onclick = (e) => { e.stopPropagation(); cancelUpgrade(label); };
    wrap.appendChild(stop);
  }
  const column = btn.parentElement;
  if (column && wrap.parentElement !== column) column.appendChild(wrap);
  const timeEl = document.getElementById(`upgrade-inline-time-${label}`);
  if (timeEl) {
    const ref = upgradeTimerRefs.get(label) || { inline: timeEl };
    ref.inline = timeEl;
    upgradeTimerRefs.set(label, ref);
    queueTimerText(timeEl, formatTime(state.upgradeTasks[label].time));
  }
  updateBuildButtonHeight();
}

export function cancelBuild() {
  const heroes =
    state.buildingTask.heroes && state.buildingTask.heroes.some(h => h)
      ? state.buildingTask.heroes
      : state.buildingTask.heroIds.map(id => state.heroMap.get(id));
  heroes.forEach(h => {
    if (h) {
      h.buildTime = 0;
      if (h.buildStartExp) {
        h.level = h.buildStartExp.level;
        h.exp = h.buildStartExp.exp;
        delete h.buildStartExp;
      }
      h.energia = Math.min(100, h.energia + 30);
    }
  });
  state.food = Math.min(MAX_FOOD, state.food + state.buildingTask.cost);
  state.wood = Math.min(MAX_WOOD, state.wood + state.buildingTask.cost);
  state.stone = Math.min(MAX_STONE, state.stone + state.buildingTask.cost);
  state.buildingTask.heroIds = [null, null, null];
  state.buildingTask.heroes = [null, null, null];
  state.buildingTask.time = 0;
  state.buildingTask.cost = 0;
  state.buildingTask.endAt = 0;
  state.buildingTask.lastTimeShown = null;
  constructionWorker.postMessage({ idConstruccion: 'build', tiempoRestante: 0, tipo: 'build' });
  updateResourcesDisplay();
  const inline = document.getElementById("build-house-inline-timer");
  if (inline) inline.remove();
  const card = document.getElementById("build-select-card");
  if (card) {
    card.style.display = "none";
    card.classList.remove("progress-card");
  }
  updateBuildButtonHeight();
  scheduleSaveGame();
  renderVillage();
  scheduleRenderHeroes();
}

export function cancelUpgrade(label) {
  const task = state.upgradeTasks[label];
  if (!task || task.time <= 0) return;
  const heroes =
    task.heroes && task.heroes.length
      ? task.heroes
      : task.heroIds.map(id => state.heroMap.get(id));
  heroes.forEach(h => {
    if (h) {
      h.buildTime = 0;
      if (h.buildStartExp) {
        h.level = h.buildStartExp.level;
        h.exp = h.buildStartExp.exp;
        delete h.buildStartExp;
      }
      const energyRefund =
        task.energy ?? (['Tower', 'PetSanctuary'].includes(label) ? 50 : label === 'Castle' ? 50 : 30);
      h.energia = Math.min(100, h.energia + energyRefund);
    }
  });
  state.food = Math.min(MAX_FOOD, state.food + (task.cost || 0));
  state.wood = Math.min(MAX_WOOD, state.wood + (task.cost || 0));
  state.stone = Math.min(MAX_STONE, state.stone + (task.cost || 0));
  task.heroIds = [];
  task.heroes = [];
  task.time = 0;
  task.endAt = 0;
  task.lastTimeShown = null;
  constructionWorker.postMessage({ idConstruccion: label, tiempoRestante: 0, tipo: 'upgrade' });
  const wrap = document.getElementById(`upgrade-inline-${label}`);
  if (wrap) wrap.remove();
  const ref = upgradeTimerRefs.get(label);
  const timer = ref ? ref.main : null;
  if (timer && timer.parentElement) {
    const card = document.getElementById('build-select-card');
    if (card && card.contains(timer)) {
      card.style.display = 'none';
      card.classList.remove('progress-card');
    }
  }
  upgradeTimerRefs.delete(label);
  resumeUpgrades();
  updateResourcesDisplay();
  updateBuildButtonHeight();
  scheduleSaveGame();
  renderVillage();
  scheduleRenderHeroes();
}

export function showUpgradeModal(label, count, cols = count) {
  hideBuildCard();
  const selectCard = document.getElementById("build-select-card");
  if (!selectCard) return;
  selectCard.classList.remove('progress-card');
  if (state.upgradeTasks[label] && state.upgradeTasks[label].time > 0) {
    showUpgradeProgress(label);
    return;
  }
  state.buildSelectionOpen = true;
  upgradePreviewLabel = label;
  upgradePreviewCount = count;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay card-modal";
  const modal = document.createElement("div");
  modal.className = "modal";
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gap = "10px";
  grid.style.marginBottom = "10px";
  buildSelectAvatars = [];
  buildSelectSelects = [];
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    const img = document.createElement("img");
    img.className = "modal-avatar empty";
    buildSelectAvatars[i] = img;
    const sel = document.createElement("select");
    sel.addEventListener("change", () => {
      refreshBuildSelectionOptions();
      checkReady();
    });
    buildSelectSelects[i] = sel;
    wrap.appendChild(img);
    wrap.appendChild(sel);
    grid.appendChild(wrap);
  }
  const baseWidth = cols * 140 + (cols - 1) * 10 + 60;
  const width = Math.max(baseWidth, 520);
  const wideLabels = ["Lumberyard", "Pantry", "Quarry"];
  modal.style.width = wideLabels.includes(label)
    ? `${width}px`
    : `${Math.min(width, window.innerWidth * 0.92)}px`;
  modal.appendChild(grid);
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  btnRow.style.justifyContent = "center";
  const ok = document.createElement("button");
  ok.textContent = "Improve";
  ok.className = "btn btn-blue";
  ok.title = getUpgradeTooltip(label);
  ok.onclick = () => {
    const ids = buildSelectSelects.map(s => parseInt(s.value) || null);
    const { cost, energy, exp: expGain } = getUpgradeRequirements(label);
    const time = UPGRADE_TIMES[label] || UPGRADE_TIME;
    if (state.food < cost || state.wood < cost || state.stone < cost) {
      removeOverlay(overlay);
      showAlert('Not enough materials');
      return;
    }
    state.food = Math.max(0, state.food - cost);
    state.wood = Math.max(0, state.wood - cost);
    state.stone = Math.max(0, state.stone - cost);
    const heroesSelected = ids.map(id => state.heroMap.get(id));
    heroesSelected.forEach(h => {
      if (h) {
        h.buildStartExp = { level: h.level, exp: h.exp };
        addHeroExp(h, expGain);
        h.energia = Math.max(0, h.energia - energy);
        h.buildTime = time;
        autoStartRest(h);
      }
    });
    updateResourcesDisplay();
    removeOverlay(overlay);
    upgradePreviewLabel = null;
    state.upgradeTasks[label] = { heroIds: ids, heroes: heroesSelected, time, cost, energy, exp: expGain, endAt: Date.now() + time * 1000, lastTimeShown: time };
    showUpgradeProgress(label);
    state.buildSelectionOpen = false;
    renderVillage();
  };
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "btn btn-green white-text";
  closeBtn.onclick = () => { removeOverlay(overlay); state.buildSelectionOpen = false; upgradePreviewLabel = null; };
  btnRow.appendChild(ok);
  btnRow.appendChild(closeBtn);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, document.getElementById('village-section'));
  const checkReady = () => {
    const missing = buildSelectSelects.some(s => !parseInt(s.value));
    const capReached = label === 'PetSanctuary' && MAX_PETS >= state.houses;
    const { cost } = getUpgradeRequirements(label);
    const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
    ok.disabled = missing || capReached || insufficient;
    if (capReached) {
      ok.title = 'Need more houses';
    } else if (insufficient) {
      ok.title = `¡Insufficiente Resources! ${getUpgradeTooltip(label)}`;
    } else {
      ok.title = getUpgradeTooltip(label);
    }
  };
  refreshBuildSelectionOptions();
  checkReady();
}

function showUpgradeProgress(label) {
  const selectCard = document.getElementById("build-select-card");
  if (!selectCard) return;
  selectCard.innerHTML = "";
  selectCard.classList.add('progress-card');
  const close = document.createElement("button");
  close.textContent = "x";
  close.className = "close-btn";
  close.onclick = () => {
    selectCard.style.display = "none";
    selectCard.classList.remove('progress-card');
    // Forzar refresh del overlay del botón al cerrar la card
    if (state.upgradeTasks[label] && state.upgradeTasks[label].time > 0) {
      showUpgradeInlineTimer(label);
    }
  };
  selectCard.appendChild(close);
  const img = document.createElement("img");
  img.src = BUILDING_IMAGES[label] || "";
  img.className = "build-progress";
  appendBuildHeroes(selectCard, state.upgradeTasks[label].heroIds || []);
  selectCard.appendChild(img);
  if (label === 'PetSanctuary') {
    const totalPets = state.heroes.filter(h => h.pet).length;
    const countEl = document.createElement('div');
    countEl.textContent = `Pets: ${totalPets}/${MAX_PETS}`;
    countEl.style.textAlign = 'center';
    countEl.style.gridColumn = '1 / -1';
    selectCard.appendChild(countEl);
  }
  const timerEl = document.createElement("div");
  timerEl.id = `upgrade-timer-${label}`;
  timerEl.className = "timer";
  timerEl.style.textAlign = "center";
  timerEl.style.gridColumn = "1 / -1";
  selectCard.appendChild(timerEl);
  const ref = upgradeTimerRefs.get(label) || {};
  ref.main = timerEl;
  upgradeTimerRefs.set(label, ref);
  queueTimerText(timerEl, formatTime(state.upgradeTasks[label].time));
  selectCard.style.display = "flex";
  selectCard.style.justifyContent = "center";
  selectCard.style.alignItems = "center";
  resumeUpgrades();
  updateBuildButtonHeight();
}


function resumeUpgrades() {
  if (!Object.values(state.upgradeTasks).some(t => t.time > 0)) return;
  if (state.buildingTask.time <= 0) {
    const btn = document.querySelector('#build-house-column button');
    if (btn) {
      const cost = 10 * (state.houses + 1);
      const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
      btn.disabled = state.houses >= state.terrain * 5 || insufficient;
      btn.style.background = btn.disabled ? 'gray' : '';
      if (state.houses >= state.terrain * 5) {
        btn.title = 'Need more terrain';
      } else if (insufficient) {
        btn.title = `¡Insufficiente Resources! ${getBuildHouseTooltip()}`;
      } else {
        btn.title = getBuildHouseTooltip();
      }
    }
  } else if (state.buildingTask.time > 0) {
    const wrap = document.getElementById('build-house-inline-timer');
    if (!wrap) showInlineBuildTimer();
  }
  for (const [label, task] of Object.entries(state.upgradeTasks)) {
    if (task.time > 0 && task.endAt) {
      task.time = Math.max(0, Math.ceil((task.endAt - Date.now()) / 1000));
    } else if (task.time > 0 && !task.endAt) {
      task.endAt = Date.now() + task.time * 1000;
    }
    if (task.time > 0) {
      const timer = document.getElementById(`upgrade-timer-${label}`);
      if (timer) {
        const ref = upgradeTimerRefs.get(label) || {};
        ref.main = timer;
        upgradeTimerRefs.set(label, ref);
        queueTimerText(timer, formatTime(task.time));
        task.lastTimeShown = task.time;
      }
      const selectCard = document.getElementById('build-select-card');
      if (!state.buildSelectionOpen && (!selectCard || selectCard.style.display === 'none')) {
        showUpgradeInlineTimer(label);
      }
      constructionWorker.postMessage({ idConstruccion: label, tiempoRestante: task.time, tipo: 'upgrade' });
    } else {
      const wrap = document.getElementById(`upgrade-inline-${label}`);
      if (wrap) wrap.remove();
      const ref = upgradeTimerRefs.get(label);
      if (ref) {
        ref.inline = null;
        ref.main = null;
      }
    }
  }
  updateBuildButtonHeight();
}

function completeUpgrade(label) {
  const task = state.upgradeTasks[label];
  if (!task) return;
  task.time = 0;
  task.endAt = 0;
  task.lastTimeShown = null;
  task.heroes.forEach(h => {
    if (h) {
      h.buildTime = 0;
      delete h.buildStartExp;
      addHeroExp(h, task.exp || 10);
    }
  });
  task.heroIds = [];
  task.heroes = [];
  const wrap = document.getElementById(`upgrade-inline-${label}`);
  if (wrap) wrap.remove();
  state.buildingLevels[label] = (state.buildingLevels[label] || 0) + 1;
  const lvl = state.buildingLevels[label];
  if (label === 'PetSanctuary') {
    if (MAX_PETS < state.houses) MAX_PETS += 1;
    const btn = document.getElementById('btn-PetSanctuary');
    if (btn) { btn.disabled = false; btn.style.background = ''; }
  }
  if (label === 'Pantry') {
    setMaxFood((lvl + 1) * 10);
    const b = document.getElementById('btn-Pantry');
    if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Pantry'); }
  }
  if (label === 'Lumberyard') {
    setMaxWood((lvl + 1) * 10);
    const b = document.getElementById('btn-Lumberyard');
    if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Lumberyard'); }
  }
  if (label === 'Quarry') {
    setMaxStone((lvl + 1) * 10);
    const b = document.getElementById('btn-Quarry');
    if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Quarry'); }
  }
  if (label === 'Castle') {
    updateMaxLevelsFromCastle();
  }
  const statMap = {
    Gym: 'fuerza',
    ArcheryField: 'destreza',
    MageAcademy: 'inteligencia',
    BoxingRing: 'defensa',
    LifeAltar: 'vida',
    Ashram: 'mana',
    FortuneTotem: 'suerte'
  };
  if (statMap[label]) {
    const stat = statMap[label];
    MAX_STATS[stat] += 1;
    CHIEF_MAX_STATS[stat] += 1;
    PARTNER_MAX_STATS[stat] += 1;
  }
  renderVillageIfVisible();
  renderTerrainsIfVisible();
  if (!anyStatsOpen()) renderHeroesIfVisible();
  updateResourcesDisplay();
}

function resumeRest(hero) {
  hero.energyEl = document.getElementById(`hero-energy-${hero.id}`);
  hero.lowEnergyEl = document.getElementById(`hero-low-energy-${hero.id}`);
  hero.restTimerEl = document.getElementById(`rest-timer-${hero.id}`);
  restingHeroes.add(hero);
  updateRest(hero);
}

function resumeTrain(hero) {
  if (!hero.trainingStat) return;
  const stat = hero.trainingStat;
  
  // Nuevo sistema de entrenamiento por minuto
  if (hero.trainingEndAt) {
    const minutesRemaining = calculateTrainingTimeRemaining(hero.trainingEndAt);
    hero.trainTime = minutesRemaining;
    
    const mainEl = document.getElementById(`train-main-${hero.id}`);
    if (mainEl) mainEl.textContent = formatTrainingTime(minutesRemaining);
    
    const statEl = document.getElementById(`train-timer-${hero.id}-${stat}`);
    if (statEl) statEl.textContent = formatTrainingTime(minutesRemaining);
  }
}

function resumeMission(hero, slot) {
  const timerEl = document.getElementById(`mission-timer-${slot.id}`);
  if (timerEl) {
    const dur = missionDuration(slot.id);
    timerEl.textContent = dur === 7200 ? '2h' : dur === 3600 ? '1h' : '30m';
  }
}

function resumeAllActivities() {
  state.heroes.forEach(hero => {
    if (hero.restTime > 0 && hero.trainTime > 0) {
      hero.trainTime = 0;
      hero.trainingStat = null;
      hero.trainingEndAt = null;
      removeTimer(`train_${hero.id}`);
    }
    if (hero.energia <= 0 && hero.restTime <= 0) {
      autoStartRest(hero);
    }
    if (hero.restTime > 0) {
      resumeRest(hero);
    }
    if (hero.trainTime > 0) {
      resumeTrain(hero);
    }
    if (hero.missionTime > 0) {
      const slot = state.missions.find(m => m.heroId === hero.id);
      if (slot) {
        resumeMission(hero, slot);
        if (!activeTimers.some(t => t.type === 'mission' && t.heroId === hero.id)) {
          const start = hero.missionStartTime
            ? hero.missionStartTime
            : Date.now() - (hero.missionDuration - hero.missionTime) * 1000;
          addTimer({
            id: `mission_${slot.id}`,
            type: 'mission',
            heroId: hero.id,
            slotId: slot.id,
            startTime: start,
            duration: (hero.missionDuration || hero.missionTime) * 1000,
            paused: false,
            completed: false
          });
        }
      }
    }
  });
  if (state.buildingTask.time > 0) {
    resumeBuild();
  }
  if (Object.values(state.upgradeTasks).some(t => t.time > 0)) {
    resumeUpgrades();
  }
  // Actualizar overlays después de reanudar actividades
  updateConstructionOverlays();
  if (!anyStatsOpen()) renderHeroesIfVisible();
  renderVillageChiefIfVisible();
}

function applyHiddenTime(seconds) {
  if (seconds <= 0) return;
  if (state.autoClickActive) {
    const elapsedMs = seconds * 1000;
    const ticks = Math.floor(elapsedMs / AUTOCLICK_INTERVAL_MS);
    for (let i = 0; i < ticks; i++) {
      autoClickTick();
    }
    autoClickLastTick = Date.now() - (elapsedMs % AUTOCLICK_INTERVAL_MS);
    updateAutoClickButtonHeight();
    updateAutoClickTimer();
  }

  if (state.buildingTask.time > 0) {
    if (state.buildingTask.endAt) {
      state.buildingTask.time = Math.max(0, Math.ceil((state.buildingTask.endAt - Date.now()) / 1000));
    } else {
      state.buildingTask.time = Math.max(0, state.buildingTask.time - seconds);
      state.buildingTask.endAt = Date.now() + state.buildingTask.time * 1000;
    }
    state.buildingTask.heroes.forEach(h => {
      if (h) h.buildTime = state.buildingTask.time;
    });
    if (state.buildingTask.time === 0) {
      buildHouse();
    }
  }
  state.heroes.forEach(hero => {
    if (hero.collectTime > 0) {
      if (hero.collectTime <= seconds) {
        hero.collectTime = 0;
        state.food += 3;
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      } else {
        hero.collectTime -= seconds;
      }
    }
    if (hero.mineTime > 0) {
      if (hero.mineTime <= seconds) {
        hero.mineTime = 0;
        state.stone += 3;
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      } else {
        hero.mineTime -= seconds;
      }
    }
    if (hero.chopTime > 0) {
      if (hero.chopTime <= seconds) {
        hero.chopTime = 0;
        state.wood += 3;
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      } else {
        hero.chopTime -= seconds;
      }
    }
    if (hero.workTime > 0) {
      if (hero.workTime <= seconds) {
        hero.workTime = 0;
        state.money += 20;
        addHeroExp(hero, 5);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
      } else {
        hero.workTime -= seconds;
      }
    }
    
    // Nuevo sistema de entrenamiento por minuto
    if (hero.trainTime > 0 && hero.trainingEndAt) {
      const now = Date.now();
      if (isTrainingComplete(hero.trainingEndAt)) {
        // El entrenamiento ha terminado
        if (hero.stats[hero.trainingStat] < MAX_STATS[hero.trainingStat]) {
          hero.stats[hero.trainingStat]++;
        }
        hero.trainingStat = null;
        hero.trainTime = 0;
        hero.trainingEndAt = null;
        removeTimer(`train_${hero.id}`);
      } else {
        // Actualizar tiempo restante basado en endAt
        const minutesRemaining = calculateTrainingTimeRemaining(hero.trainingEndAt);
        hero.trainTime = minutesRemaining;
      }
    }
  });
  for (const [label, task] of Object.entries(state.upgradeTasks)) {
    if (task.time > 0) {
      if (task.endAt) {
        task.time = Math.max(0, Math.ceil((task.endAt - Date.now()) / 1000));
      } else {
        task.time = Math.max(0, task.time - seconds);
        task.endAt = Date.now() + task.time * 1000;
      }
      task.heroes.forEach(h => {
        if (h) h.buildTime = task.time;
      });
      if (task.time === 0) {
        task.endAt = 0;
        state.buildingLevels[label] = (state.buildingLevels[label] || 0) + 1;
        const lvl = state.buildingLevels[label];
        if (label === 'PetSanctuary') {
          if (MAX_PETS < state.houses) MAX_PETS += 1;
          const btn = document.getElementById('btn-PetSanctuary');
          if (btn) { btn.disabled = false; btn.style.background = ''; }
        }
        if (label === 'Pantry') {
          setMaxFood((lvl + 1) * 10);
          const b = document.getElementById('btn-Pantry');
          if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Pantry'); }
        }
        if (label === 'Lumberyard') {
          setMaxWood((lvl + 1) * 10);
          const b = document.getElementById('btn-Lumberyard');
          if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Lumberyard'); }
        }
        if (label === 'Quarry') {
          setMaxStone((lvl + 1) * 10);
          const b = document.getElementById('btn-Quarry');
          if (b) { b.disabled = false; b.style.background = ''; b.title = getUpgradeTooltip('Quarry'); }
        }
        if (label === 'Castle') {
          updateMaxLevelsFromCastle();
        }
        const statMap2 = {
          Gym: 'fuerza',
          ArcheryField: 'destreza',
          MageAcademy: 'inteligencia',
          BoxingRing: 'defensa',
          LifeAltar: 'vida',
          Ashram: 'mana',
          FortuneTotem: 'suerte'
        };
        if (statMap2[label]) {
          const stat = statMap2[label];
          MAX_STATS[stat] += 1;
          CHIEF_MAX_STATS[stat] += 1;
          PARTNER_MAX_STATS[stat] += 1;
        }
      }
    }
  }
  updateResourcesDisplay();
  if (!anyStatsOpen()) renderHeroesIfVisible();
  renderVillageChiefIfVisible();
  renderMissions();
  renderVillage();
  renderTerrainsIfVisible();
  updatePetAutoCollection();
  updateConstructionOverlays();
  scheduleSaveGame();
}

function updatePetAutoCollection() {
  const now = Date.now();
  let changed = false;
  state.heroes.forEach(hero => {
    if (!hero.pet) return;
    if (hero.petPendingCount >= PET_MAX_PENDING) return;
    const last = hero.petLastCollection || now;
    const elapsed = Math.floor((now - last) / PET_RESOURCE_INTERVAL);
    if (elapsed <= 0) return;
    const add = Math.min(elapsed, PET_MAX_PENDING - (hero.petPendingCount || 0));
    if (add <= 0) return;
    if (!hero.petResourceType) hero.petResourceType = randomPetResource();
    hero.petPendingCount = (hero.petPendingCount || 0) + add;
    hero.petLastCollection = last + add * PET_RESOURCE_INTERVAL;
    changed = true;
  });
  if (changed) {
    if (isSectionVisible('pets-section')) {
      renderPets();
    }
    updateFullCollectIcons();
  }
  return changed;
}

function gameTick() {
  let changed = false;
  let needsRender = false;
  state.heroes.forEach(hero => {
    // Farm, Mine, Chop and Work timers are now handled by the centralized timer
    // to keep UI counters fixed at 10m. The per-hero decrements and DOM updates
    // were removed to reduce lag.
    if (hero.trainTime > 0) {
      // Nuevo sistema de entrenamiento por minuto
      const stat = hero.trainingStat;
      const minutesRemaining = calculateTrainingTimeRemaining(hero.trainingEndAt);
      
      // Actualizar tiempo restante
      hero.trainTime = minutesRemaining;
      
      // Actualizar UI solo si es visible
      const mainEl = document.getElementById(`train-main-${hero.id}`);
      if (mainEl && mainEl.offsetParent !== null) {
        mainEl.textContent = formatTrainingTime(minutesRemaining);
      }
      
      const statEl = document.getElementById(`train-timer-${hero.id}-${stat}`);
      if (statEl && statEl.offsetParent !== null) {
        statEl.textContent = formatTrainingTime(minutesRemaining);
      }
      
      // Verificar si el entrenamiento ha terminado
      if (isTrainingComplete(hero.trainingEndAt)) {
        if (hero.stats[stat] < MAX_STATS[stat]) hero.stats[stat]++;
        if (stat === 'vida') {
          hero.hpMax = hero.stats.vida;
          hero.hp = hero.hpMax;
        } else if (stat === 'mana') {
          hero.manaMax = hero.stats.mana;
          hero.mana = hero.manaMax;
        }
        hero.trainingStat = null;
        hero.trainTime = 0;
        hero.trainingEndAt = null;
        handlePendingMissions(hero);
        needsRender = true;
      }
      changed = true;
    }
    // mission timers handled by centralized timer

    // pet resource generation handled globally
  });

  Array.from(restingHeroes).forEach(hero => {
    const prevEnergy = hero.energia;
    const prevTime = hero.restTime;
    updateRest(hero);
    if (hero.restTime <= 0 || hero.energia >= 100) {
      needsRender = true;
    }
    if (hero.energia !== prevEnergy || hero.restTime !== prevTime) {
      changed = true;
    }
  });

  const petsChanged = updatePetAutoCollection();

  if (changed || petsChanged) {
    scheduleSaveGame();
    renderVillageChiefIfVisible();
    updateFullCollectIcons();
  } else {
    updateFullCollectIcons();
  }

  if (needsRender && !anyStatsOpen()) {
    renderHeroesIfVisible();
  }
}

function centralGameLoop() {
  const now = Date.now();
  const elapsed = now - lastUpdate;
  if (elapsed >= MIN) { // Cambiar a 1 minuto para el nuevo sistema
    lastUpdate = now;
    if (!isMinigameActive) {
      gameTick();
    }
  }
  requestAnimationFrame(centralGameLoop);
}

function renderSexBadge(cardEl, hero) {
  if (!hero.sex) hero.sex = SEX.NEUTRAL;

  const imgContainer = cardEl.querySelector('.hero-image-container');
  if (!imgContainer) return;

  let badge = imgContainer.querySelector(".sex-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "sex-badge";
    badge.setAttribute("data-role", "sex-badge");
    badge.title = "Set sex";
    imgContainer.appendChild(badge);
    badge.addEventListener("click", ev => {
      ev.stopPropagation();
      openSexPopup(cardEl, hero);
    });
  }

  badge.textContent = SEX_ICON[hero.sex];
  badge.classList.remove("male", "female", "neutral");
  badge.classList.add(SEX_CLASS[hero.sex]);
}

function openSexPopup(cardEl, hero) {
  closeAnySexPopup();
  const popup = document.createElement("div");
  popup.className = "sex-popup";
  popup.setAttribute("data-role", "sex-popup");
  popup.innerHTML = `
    <div class="option" data-sex="${SEX.MALE}">
      <span class="icon ${SEX_CLASS[SEX.MALE]}">${SEX_ICON[SEX.MALE]}</span>
      <span>Male</span>
    </div>
    <div class="option" data-sex="${SEX.FEMALE}">
      <span class="icon ${SEX_CLASS[SEX.FEMALE]}">${SEX_ICON[SEX.FEMALE]}</span>
      <span>Female</span>
    </div>
    <div class="option" data-sex="${SEX.NEUTRAL}">
      <span class="icon ${SEX_CLASS[SEX.NEUTRAL]}">${SEX_ICON[SEX.NEUTRAL]}</span>
      <span>Neutral</span>
    </div>
  `;
  popup.querySelectorAll(".option").forEach(opt => {
    opt.addEventListener("click", () => {
      const newSex = opt.getAttribute("data-sex");
      if (newSex && hero.sex !== newSex) {
        hero.sex = newSex;
        saveGame();
        renderSexBadge(cardEl, hero);
      }
      closeAnySexPopup();
    });
  });
  cardEl.appendChild(popup);
  centerPopupOverCard(cardEl, popup);
  setTimeout(() => {
    document.addEventListener("click", docClickToClose, { once: true });
  }, 0);
}

function centerPopupOverCard(cardEl, popupEl) {
  const cardRect = cardEl.getBoundingClientRect();
  const cardW = cardRect.width;
  const cardH = cardRect.height;
  popupEl.style.visibility = "hidden";
  popupEl.style.left = "0px";
  popupEl.style.top = "0px";
  requestAnimationFrame(() => {
    const pw = popupEl.offsetWidth;
    const ph = popupEl.offsetHeight;
    const left = Math.max(6, (cardW - pw) / 2);
    const top = Math.max(6, (cardH - ph) / 2);
    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
    popupEl.style.visibility = "visible";
  });
}

function docClickToClose(e) {
  const popup = document.querySelector(".sex-popup");
  if (!popup) return;
  if (!popup.contains(e.target)) closeAnySexPopup();
}

function closeAnySexPopup() {
  document.querySelectorAll(".sex-popup").forEach(p => p.remove());
}

export function renderHeroes() {
  if (perfOptimizations) performance.mark('render-hero-list:start');
  recalcSummonCost();
  if (document.querySelector('.edit-overlay')) return;
  const container = document.getElementById("heroes");
  const pagination = document.getElementById("hero-pagination");
  closeAnySexPopup();
  if (!container) return;
  container.innerHTML = "";
  if (pagination) pagination.innerHTML = "";

  const readOnly = currentView === "profiles";

  if (document.activeElement?.id !== "hero-search") {
    updateHeroControls();
  }

  let list = state.heroes.filter(Boolean);
  if (heroFilterOrigin) {
    list = list.filter(h => h.origin === heroFilterOrigin);
  }
  if (heroFilterProfession) {
    list = list.filter(h => (h.professions || []).includes(heroFilterProfession));
  }
  if (heroFilterFavorites) {
    list = list.filter(h => h.favorite);
  }
  if (heroFilterReady) {
    list = list.filter(h => !isBusy(h));
  }
  if (heroFilterSex) {
    list = list.filter(h => (h.sex || SEX.NEUTRAL) === heroFilterSex);
  }
  if (heroFilterSearch) {
    const q = heroFilterSearch.toLowerCase();
    list = list.filter(h => (h.name || "").toLowerCase().includes(q));
  }
  const sortedHeroes = list.sort((a, b) => {
    if (heroSort === "level") {
      return heroSortAsc ? (a.level || 0) - (b.level || 0) : (b.level || 0) - (a.level || 0);
    }
    return heroSortAsc
      ? (a.name || "").localeCompare(b.name || "")
      : (b.name || "").localeCompare(a.name || "");
  });
  const heroPages = Math.max(1, Math.ceil(sortedHeroes.length / HEROES_PER_PAGE));
  if (currentHeroPage > heroPages) currentHeroPage = heroPages;
  const start = (currentHeroPage - 1) * HEROES_PER_PAGE;
  const pageHeroes = sortedHeroes.slice(start, start + HEROES_PER_PAGE);
  const fragment = document.createDocumentFragment();

  pageHeroes.forEach((hero, index) => {
    const div = document.createElement("div");
    div.className = "hero hero-card";
    div.setAttribute("data-hero-id", hero.id);

    const star = document.createElement("div");
    star.className = "favorite-star" + (hero.favorite ? " selected" : "");
    star.textContent = "★";
    star.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      star.onclick = () => {
        hero.favorite = !hero.favorite;
        saveGame();
        scheduleRenderHeroes();
      };
    }
    div.appendChild(star);

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "avatar-wrap image-wrapper hero-image hero-image-container";
    const avatar = document.createElement("img");
    avatar.src = hero.avatar || EMPTY_SRC;
    avatar.className = "avatar";
    avatar.style.objectPosition = `center ${hero.avatarOffset ?? 50}%`;
    if (!hero.avatar) avatar.classList.add("empty");
    avatarWrap.appendChild(avatar);

    const dlIcon = document.createElement('div');
    dlIcon.className = 'download-icon';
    dlIcon.textContent = '🡇';
    dlIcon.classList.toggle('disabled', !hero.avatar);
    dlIcon.title = 'Download image';
    dlIcon.setAttribute('aria-label', 'Download image');
    dlIcon.onclick = e => {
      e.stopPropagation();
      if (dlIcon.classList.contains('disabled')) return;
      downloadImage(avatar.src);
    };
    avatarWrap.appendChild(dlIcon);
    avatar.title = "Edit Image (160x200 recommended)";
    if (!readOnly) avatar.onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.style.display = "none";
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        resizeImageToBase64(file, 160, 200, resized => {
          hero.avatar = resized;
          hero.modified = Date.now();
          saveGame();
          scheduleRenderHeroes();
          renderVillageChief();
          renderMissions();
          renderPets();
          refreshBuildSelectionAvatars();
        });
      };
      input.click();
    };


    const info = document.createElement("div");
    info.className = "info-section";

    const nameSpan = document.createElement("strong");
    nameSpan.textContent = hero.name;
    nameSpan.style.cursor = readOnly ? "default" : "pointer";
    nameSpan.title = readOnly ? "" : "Edit Name";
    if (!readOnly)
      nameSpan.onclick = () => {
        openEditModal(
          "Name",
          hero.name,
          nuevo => {
            if (nuevo) {
              const others = state.heroes.filter(h => h.id !== hero.id);
              hero.name = ensureUniqueHeroName(others, nuevo);
              saveGame();
              scheduleRenderHeroes();
              renderMissions();
              renderVillageChief();
            }
          },
          { container: div }
        );
      };
    info.appendChild(nameSpan);
    info.appendChild(document.createElement("br"));
    const profLine = document.createElement('div');
    profLine.textContent = 'Profession: ';
    const sortedProfs = [...hero.professions].sort((a,b)=>a.localeCompare(b));
    sortedProfs.forEach(p => {
      const span = document.createElement('span');
      span.textContent = professionIcons[p] || '';
      span.title = p;
      span.style.marginRight = '4px';
      profLine.appendChild(span);
    });
    info.appendChild(profLine);
    const originContainer = document.createElement("span");
    originContainer.textContent = "Origin: ";
    const originSpan = document.createElement("span");
    originSpan.textContent = hero.origin || "No origin";
    originSpan.style.cursor = readOnly ? "default" : "pointer";
    originSpan.title = readOnly ? "" : "Edit Origin";
    if (!readOnly)
      originSpan.onclick = () => {
        openEditModal(
          "Origin",
          hero.origin,
          nuevo => {
            if (nuevo !== null) {
              hero.origin = nuevo || "No origin";
              saveGame();
              scheduleRenderHeroes();
            }
          },
          { container: div, suggestions: getHeroOrigins() }
        );
      };
    originContainer.appendChild(originSpan);
    info.appendChild(originContainer);
    const isCompanionHero =
      state.companions.includes(hero.id) ||
      state.farmers.includes(hero.id) ||
      state.lumberjacks.includes(hero.id) ||
      state.miners.includes(hero.id);
    const needed = expNeededForLevel(hero.level);
    const expLine = hero.level >= MAX_LEVEL
      ? `EXP: ${hero.exp}`
      : `EXP: ${hero.exp}/${needed}`;
    const notes = [];
    if (hero.buildTime > 0) notes.push("<span class='building-note'>Hero is building</span>");
    if (hero.ability1LearnTime > 0 || hero.ability2LearnTime > 0) notes.push("<span class='learning-note'>Learning an Ability</span>");
    if (hero.missionTime > 0) notes.push("<span class='mission-note'>Hero is on a Mission</span>");
    
    // Verificar si el héroe está en una Group Mission
    if (state.groupMissions && state.groupMissions.some(gm => 
      gm.heroIds && gm.heroIds.includes(hero.id) && gm.status === 'running'
    )) {
      notes.push("<span class='group-mission-note' style='color: red; font-weight: bold;'>Hero is on a Group Mission</span>");
    }
    
    if (state.autoClickActive && isCompanionHero && hero.restTime <= 0) notes.push("<span class='auto-note'>Autoclicking</span>");
      info.insertAdjacentHTML(
        "beforeend",
          `<br>Level: ${hero.level}/<span title="Improve Caste to Increase">${MAX_LEVEL}</span><br>${expLine}<br>Energy: <span id="hero-energy-${hero.id}">${hero.energia}%</span> <span id="hero-low-energy-${hero.id}" style="color:red">${hero.energia <= 20 ? "Low energy!" : ""}</span>${notes.length ? "<br>" + notes.join("<br>") : ""}`
        );
      if (state.specialBuilderSlots && state.specialBuilderSlots.some(s => s.assignedHeroId === hero.id && s.status !== 'idle')) {
        const sbLine = document.createElement('div');
        sbLine.className = 'special-builder-note';
        sbLine.textContent = 'On special builder assignment';
        info.appendChild(sbLine);
      }
      const descSpan = document.createElement('span');
      descSpan.textContent = hero.desc ? (hero.desc.length > 60 ? hero.desc.slice(0,60) + '...' : hero.desc) : 'Empty';
      descSpan.style.cursor = readOnly ? 'default' : 'pointer';
      if (!readOnly) descSpan.onclick = () => {
        openEditModal('Hero Description', hero.desc, val => {
        hero.desc = val;
        hero.modified = Date.now();
        saveGame();
        scheduleRenderHeroes();
      }, { multiLine: true, container: div });
    };
    const descLine = document.createElement('div');
    descLine.style.fontSize = '0.85em';
    descLine.classList.add('desc-preview');
    descLine.append('Description: ');
    descLine.appendChild(descSpan);
    info.appendChild(descLine);

    function createAction(label, key, seconds, actionFn) {
      const block = document.createElement("div");
      block.className = "action-block";

      const btn = document.createElement("button");
      btn.className = "btn btn-green";
      btn.textContent = label;
      btn.style.width = "100%";
      if (label === "Rest") btn.id = `rest-btn-${hero.id}`;
      if (label === "Farm") btn.title = "-10% Energy +50 Food +20Exp";
      if (label === "Mine") btn.title = "-10% Energy +50 Stone +20Exp";
      if (label === "Chop") btn.title = "-10% Energy +50 Wood +20Exp";
      if (label === "Work") btn.title = "+20 Exp -20% Energy +100 Gold";

      const timer = document.createElement("div");
      timer.className = "timer";
      if (label === "Training") timer.id = `train-main-${hero.id}`;
      else if (label === "Rest") timer.id = `rest-timer-${hero.id}`;
      else if (["Farm", "Mine", "Chop", "Work"].includes(label)) {
        const base = label.toLowerCase();
        timer.id = `${base}-timer-${hero.id}`;
        timer.textContent = "";
        timer.style.display = "none";
      }
      const stopMain = document.createElement("button");
      stopMain.textContent = "❌";
      stopMain.className = "close-small";
      stopMain.style.display = "none";
      const downMain = document.createElement("button");
      downMain.textContent = "\u25BC";
      downMain.className = "down-small";
      downMain.style.display = "none";
      const timerWrap = document.createElement("div");
      timerWrap.style.display = "flex";
      timerWrap.style.alignItems = "center";
      timerWrap.appendChild(timer);
      timerWrap.appendChild(stopMain);
      timerWrap.appendChild(downMain);
      let restNote;
      if (label === "Rest" && hero.restTime > 0) {
        restNote = document.createElement("div");
        restNote.className = "timer";
        restNote.textContent = `1m => ${REST_ENERGY_GAIN}%`;
      }
      const busy = isBusy(hero);
      const isThisActionActive = hero[key] > 0;
      const trainingActive = hero.trainTime > 0;
      const trainingOpen = openTraining[hero.id];
      const statsOpen = openStats[hero.id];
      if (label === "Training") {
        if (trainingActive) btn.classList.add("btn-green");
        else btn.classList.remove("btn-green");
      }

      if (trainingOpen) {
        if (label !== "Training") btn.disabled = true;
      } else {
        if (label === "Training") {
          if (hero.missionTime > 0) {
            btn.disabled = true;
            btn.title = "Currently on a mission";
          } else if (busy && !isThisActionActive) {
            btn.disabled = true;
            btn.title = "Currently busy";
          } else {
            btn.disabled = hero.energia <= 0 || (isThisActionActive && !trainingActive);
          }
        } else if (label === "Rest") {
          if (hero.restTime > 0) {
            btn.textContent = "Stop Rest";
            btn.disabled = false;
          } else {
            btn.disabled = hero.energia >= 100 || busy;
          }
        } else if (label !== "Stats") {
          btn.disabled = hero.energia <= 0 || (busy && !isThisActionActive);
          if (label === "Farm" && state.food >= MAX_FOOD) {
            btn.disabled = true;
            btn.title = "FoodStorage Full";
          } else if (label === "Mine" && state.stone >= MAX_STONE) {
            btn.disabled = true;
            btn.title = "StoneStorage Full";
          } else if (label === "Chop" && state.wood >= MAX_WOOD) {
            btn.disabled = true;
            btn.title = "WoodStorage Full";
          } else if (!["Farm","Mine","Chop","Work","Training"].includes(label)) {
            // keep existing tooltip
          }
        }
      }

      if (state.autoClickActive && isCompanionHero && label !== "Stats") {
        if (!(label === "Rest" && hero.restTime > 0)) {
          btn.disabled = true;
        }
      }

      if (isThisActionActive && label !== "Rest") {
        if (["Farm", "Mine", "Chop", "Work"].includes(label)) {
          timer.textContent = "10m";
          timer.style.display = "inline";
        } else {
          const displayTime = hero[key];
          timer.textContent = `${displayTime}s`;
        }
        if (label === "Training") {
          timer.id = `train-main-${hero.id}`;
          btn.disabled = false;
          if (!statsOpen) {
            stopMain.style.display = "inline";
            downMain.style.display = "inline";
            downMain.onclick = () => {
              openStats[hero.id] = true;
              openTraining[hero.id] = true;
              scheduleRenderHeroes();
            };
            stopMain.onclick = () => {
              hero.trainingStat = null;
              hero.trainTime = 0;
              hero.energia = Math.min(100, hero.energia + 10);
              handlePendingMissions(hero);
              removeTimer(`train_${hero.id}`);
              saveGame();
              scheduleRenderHeroes();
            };
          } else {
            stopMain.style.display = "none";
            downMain.style.display = "none";
          }
        } else if (["Farm", "Mine", "Chop", "Work"].includes(label)) {
          btn.disabled = true;
          stopMain.style.display = "inline";
          stopMain.onclick = () => {
            hero[key] = 0;
            const typeMap = {
              collectTime: 'farm',
              mineTime: 'mine',
              chopTime: 'chop',
              workTime: 'work'
            };
            const tType = typeMap[key];
            if (tType) removeTimer(`${tType}_${hero.id}`);
            saveGame();
            scheduleRenderHeroes();
          };
        } else {
          btn.disabled = true;
          stopMain.style.display = "none";
          downMain.style.display = "none";
        }
      } else if (isThisActionActive && label === "Rest") {
        const displayTime = hero[key];
        timer.textContent = `${displayTime}m`;
      }

      btn.onclick = () => {
        if (label === "Stats") {
          if (openStats[hero.id]) {
            delete openStats[hero.id];
            if (openTraining[hero.id]) delete openTraining[hero.id];
          } else {
            openStats[hero.id] = true;
          }
          scheduleRenderHeroes();
          return;
        }

        if (label === "Training") {
          if (hero.trainTime > 0) {
            if (openTraining[hero.id]) {
              delete openTraining[hero.id];
              delete openStats[hero.id];
            } else {
              openStats[hero.id] = true;
              openTraining[hero.id] = true;
            }
            scheduleRenderHeroes();
            return;
          }
          if (openTraining[hero.id]) {
            delete openTraining[hero.id];
            delete openStats[hero.id];
            scheduleRenderHeroes();
            return;
          }
          const statsEl = document.getElementById(`stats-${hero.id}`);
          if (statsEl) statsEl.classList.add("expand-row");
          openStats[hero.id] = true;
          openTraining[hero.id] = true;
          scheduleRenderHeroes();
          return;
        }

        if (label === "Rest") {
          if (hero.restTime > 0) {
            hero.restTime = 0;
            hero.restStartTime = 0;
            hero.lastRestTick = 0;
            hero.restDuration = 0;
            restingHeroes.delete(hero);
            hero.energyEl = null;
            hero.lowEnergyEl = null;
            hero.restTimerEl = null;
            removeTimer(`rest_${hero.id}`);
            saveGame();
            scheduleRenderHeroes();
            return;
          }
          startRest(hero);
          const groups = [state.companions, state.farmers, state.lumberjacks, state.miners];
          let found = false;
          groups.forEach(arr => {
            const i = arr.indexOf(hero.id);
            if (i !== -1) {
              arr[i] = null;
              found = true;
            }
          });
          if (found && state.autoClickActive) toggleAutoClick();
          scheduleRenderHeroes();
          return;
        }


        hero[key] = seconds * TIME_MULTIPLIER;
        const lastMap = {
          collectTime: 'collectLastShown',
          mineTime: 'mineLastShown',
          chopTime: 'chopLastShown',
          workTime: 'workLastShown'
        };
        if (lastMap[key]) hero[lastMap[key]] = hero[key];
        const typeMap = {
          collectTime: 'farm',
          mineTime: 'mine',
          chopTime: 'chop',
          workTime: 'work'
        };
        const tType = typeMap[key];
        if (tType) {
          addTimer({
            id: `${tType}_${hero.id}`,
            type: tType,
            heroId: hero.id,
            startTime: Date.now(),
            duration: seconds * TIME_MULTIPLIER * 1000,
            paused: false,
            completed: false,
          });
        }
        saveGame();

        scheduleRenderHeroes();
        };

      block.appendChild(btn);
      block.appendChild(timerWrap);
      if (restNote) block.appendChild(restNote);
      return block;
    }
    let actions = [
      createAction("Stats", "estado", 0, () => {}),
      createAction("Farm", "collectTime", 200, () => {
        state.food += 50;
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
        updateResourcesDisplay();
      }),
      createAction("Mine", "mineTime", 200, () => {
        state.stone += 50;
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
        updateResourcesDisplay();
      }),
      createAction("Chop", "chopTime", 200, () => {
        state.wood += 50;
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
        updateResourcesDisplay();
      }),
      createAction("Work", "workTime", 200, () => {
        state.money += 100;
        addHeroExp(hero, 20);
        hero.energia = Math.max(0, hero.energia - 20);
        autoStartRest(hero);
        updateResourcesDisplay();
      }),
      // Botón Training oculto - Puede volver a usarse en el futuro
      // createAction("Training", "trainTime", 0, () => {}),
      createAction("Rest", "restTime", 0, () => {})
    ];
    if (readOnly) {
      actions = [actions[0]];
    }

    const deleteBlock = document.createElement("div");
    deleteBlock.className = "action-block";

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn btn-green";
    delBtn.style.background = "#dc3545";
    if (state.autoClickActive && isCompanionHero) {
      delBtn.disabled = true;
    }

      delBtn.onclick = () => {
        openConfirm({
          message: "Are you sure you want to delete this hero?",
          onConfirm: () => {
            const idx = state.heroes.indexOf(hero);
            if (idx !== -1) {
              state.heroes.splice(idx, 1);
              state.heroMap.delete(hero.id);
              restingHeroes.delete(hero);
              hero.energyEl = null;
              hero.lowEnergyEl = null;
              hero.restTimerEl = null;
            }
            state.companions = state.companions.map(c => (c === hero.id ? null : c));
            state.farmers = state.farmers.map(c => (c === hero.id ? null : c));
            state.lumberjacks = state.lumberjacks.map(c => (c === hero.id ? null : c));
            state.miners = state.miners.map(c => (c === hero.id ? null : c));
            state.missions.forEach(m => {
              if (m.heroId === hero.id) {
                m.heroId = null;
                m.completed = false;
              }
            });
            state.money += 100;
            recalcSummonCost();
            saveGame();
            updateResourcesDisplay();
            scheduleRenderHeroes();
            renderMissions();
            renderVillageChief();
            const sumBtn = document.getElementById("summon-confirm-btn");
            if (sumBtn) sumBtn.disabled = state.heroes.length >= state.houses;
            const overlay = document.querySelector(".summon-overlay, .edit-overlay");
            if (overlay) removeOverlay(overlay);
            updateSummonInputs();
          },
          container: div
        });
      };

    if (!readOnly) {
      deleteBlock.appendChild(delBtn);
      actions.push(deleteBlock);
    }

    const actionsContainer = document.createElement("div");
    actionsContainer.className = "hero-actions";
    actions.forEach(a => actionsContainer.appendChild(a));

    div.appendChild(avatarWrap);
    div.appendChild(info);
    div.appendChild(actionsContainer);

    const statsDiv = document.createElement("div");
    statsDiv.className = "stats";
    statsDiv.id = `stats-${hero.id}`;

    if (openStats[hero.id]) statsDiv.classList.add("expand-row");

    if (openStats[hero.id]) {
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "❌";
      closeBtn.className = "close-btn";
      closeBtn.onclick = () => {
        statsDiv.classList.remove("expand-row");
        delete openStats[hero.id];
        delete openTraining[hero.id];
        scheduleRenderHeroes();
      };
      statsDiv.appendChild(closeBtn);
    }

    const columns = document.createElement("div");
    columns.className = "stats-columns";

    // Columna de Stats oculta - Puede volver a usarse en el futuro
    /*
    const statesCol = document.createElement("div");
    statesCol.className = "stats-column";
    const statesTitle = document.createElement("div");
    statesTitle.className = "stats-column-title";
    statesTitle.textContent = "Stats";
    statesCol.appendChild(statesTitle);

    const grid = document.createElement("div");
    grid.className = "stats-grid";
    const statOrder = [
      "fuerza",
      "suerte",
      "inteligencia",
      "destreza",
      "defensa",
      "vida",
      "mana",
    ];
    const statLabels = {
      fuerza: "Strength",
      suerte: "Luck",
      inteligencia: "Intelligence",
      destreza: "Dexterity",
      defensa: "Defense",
      vida: "HP",
      mana: "Mana",
    };
    statOrder.forEach(stat => {
      if (hero.stats[stat] === undefined) return;
      const line = document.createElement("div");
      line.className = "stat-line";

      const label = document.createElement("span");
      const tipMap = {
        fuerza: "Improve Gym",
        destreza: "Improve ArcheryField",
        inteligencia: "Improve MageAcademy",
        defensa: "Improve BoxingRing",
        mana: "Improve Ashram",
        vida: "Improve LifeAltar",
        suerte: "Improve FortuneTotem",
      };
      const curVal = hero.stats[stat];
      const showCap = ["fuerza","destreza","inteligencia","defensa","mana","vida","suerte"];
      if (showCap.includes(stat)) {
        label.textContent = `${statLabels[stat]}: ${curVal}/`;
        const maxSpan = document.createElement("span");
        maxSpan.textContent = MAX_STATS[stat];
        if (tipMap[stat]) maxSpan.title = tipMap[stat];
        label.appendChild(maxSpan);
      } else {
        label.textContent = `${statLabels[stat]}: ${curVal}`;
      }

      const btn = document.createElement("button");
      btn.textContent = "Train";
      btn.className = "btn btn-green white-text";
      btn.title = "-10% Energy";
      btn.style.width = "80px";
      btn.style.textAlign = "center";

      if (!openTraining[hero.id]) {
        btn.style.display = "none";
      }

      const timer = document.createElement("span");
      timer.className = "timer";
      timer.id = `train-timer-${hero.id}-${stat}`;
      const stopBtn = document.createElement("button");
      stopBtn.textContent = "\u274C";
      stopBtn.className = "close-small";
      const timerWrap = document.createElement("div");
      timerWrap.style.display = "flex";
      timerWrap.style.alignItems = "center";
      timerWrap.style.gap = "2px";
      timerWrap.appendChild(timer);
      timerWrap.appendChild(stopBtn);

      const entrenandoEste = hero.trainTime > 0 && hero.trainingStat === stat;
      const entrenandoOtro = hero.trainTime > 0 && hero.trainingStat !== stat;

      if (openTraining[hero.id] && entrenandoEste) {
        // Nuevo sistema de entrenamiento por minuto
        if (hero.trainingEndAt) {
          const minutesRemaining = calculateTrainingTimeRemaining(hero.trainingEndAt);
          timer.textContent = formatTrainingTime(minutesRemaining);
        } else {
          timer.textContent = formatTrainingTime(hero.trainTime);
        }
        btn.disabled = true;
        stopBtn.style.display = "inline";
        stopBtn.onclick = () => {
          hero.trainingStat = null;
          hero.trainTime = 0;
          hero.trainingEndAt = null;
          hero.energia = Math.min(100, hero.energia + 10);
          removeTimer(`train_${hero.id}`);
          saveGame();
          scheduleRenderHeroes();
        };
      } else {
        stopBtn.style.display = "none";
      }

      if (hero.missionTime > 0) {
        btn.disabled = true;
        btn.title = "Currently on a mission";
      } else if (hero.restTime > 0) {
        btn.disabled = true;
        btn.title = "Currently resting";
      } else {
        btn.disabled = hero.energia <= 0 || entrenandoOtro || entrenandoEste || hero.stats[stat] >= MAX_STATS[stat];
      }

      btn.onclick = () => {
        if (hero.energia <= 0 || hero.trainTime > 0) return;
        btn.disabled = true;

        hero.energia = Math.max(0, hero.energia - 10);
        autoStartRest(hero);
        
        // Nuevo sistema de entrenamiento por minuto
        const trainingEndTime = getTrainingEndTime();
        hero.trainTime = TRAIN_TIMER_MINUTES;
        hero.trainingStat = stat;
        hero.trainingEndAt = trainingEndTime;
        
        // Mostrar tiempo inicial en formato de minutos
        timer.textContent = formatTrainingTime(TRAIN_TIMER_MINUTES);
        const mainTimer = document.getElementById(`train-main-${hero.id}`);
        if (mainTimer) mainTimer.textContent = formatTrainingTime(TRAIN_TIMER_MINUTES);

        addTimer({
          id: `train_${hero.id}`,
          type: 'train',
          heroId: hero.id,
          startTime: Date.now(),
          duration: TRAIN_TIMER_MINUTES * MIN,
          paused: false,
          completed: false,
          stat,
          endAt: trainingEndTime,
        });

          stopBtn.style.display = "inline";
          stopBtn.onclick = () => {
            hero.trainingStat = null;
            hero.trainTime = 0;
            hero.energia = Math.min(100, hero.energia + 10);
            removeTimer(`train_${hero.id}`);
            saveGame();
            scheduleRenderHeroes();
          };

        const tEl = document.getElementById(`train-timer-${hero.id}-${stat}`);
        if (tEl) tEl.textContent = formatTrainingTime(TRAIN_TIMER_MINUTES);
        const mainTimerEl = document.getElementById(`train-main-${hero.id}`);
        if (mainTimerEl) mainTimerEl.textContent = formatTrainingTime(TRAIN_TIMER_MINUTES);
      };

      if (!openTraining[hero.id]) timer.style.display = "none";

      line.appendChild(label);
      line.appendChild(btn);
      line.appendChild(timerWrap);
      grid.appendChild(line);
    });
    statesCol.appendChild(grid);
    columns.appendChild(statesCol);
    */

    const abilitiesCol = document.createElement("div");
    abilitiesCol.className = "stats-column abilities-column";
    const abilTitle = document.createElement("div");
    abilTitle.className = "stats-column-title";
    abilTitle.textContent = "Abilities";
    abilitiesCol.appendChild(abilTitle);
    const abilGrid = document.createElement("div");
    abilGrid.className = "skills-grid";
      const skillInfo = [
        { index: 2, label: "Ability 1" },
        { index: 3, label: "Ability 2" }
      ];
      skillInfo.forEach(info => {
        const i = info.index;
        const line = document.createElement("div");
        line.className = "skill-line";
        const ab = hero.skills[i];
        const labelSpan = document.createElement("span");
        labelSpan.textContent = info.label + ":";
        line.appendChild(labelSpan);

        // Mostrar imagen de la habilidad si existe
        if (ab.img) {
          const img = document.createElement("img");
          img.src = ab.img;
          img.style.width = "24px";
          img.style.height = "24px";
          img.style.marginRight = "8px";
          img.style.verticalAlign = "middle";
          line.appendChild(img);
        }

        // Siempre mostrar la habilidad como desbloqueada con opción de cambiar nombre
        const span = document.createElement("span");
        span.textContent = ab.name === "none" ? "Change Name" : ab.name;
        span.style.cursor = readOnly ? "default" : "pointer";
        if (!readOnly) {
          span.onclick = () => {
            openEditModal(info.label, ab.name === "none" ? "" : ab.name, val => {
              if (val) {
                ab.name = val;
                saveGame();
                scheduleRenderHeroes();
              }
            }, {container: div});
          };
        }
        line.appendChild(span);
        abilGrid.appendChild(line);
      });
    abilitiesCol.appendChild(abilGrid);

    const secondLabel = document.createElement('div');
    secondLabel.style.fontWeight = 'bold';
    secondLabel.style.marginTop = '6px';
    secondLabel.textContent = '2nd Image';
    abilitiesCol.appendChild(secondLabel);
    const secondSlot = document.createElement('div');
    secondSlot.className = 'slot-img image-wrapper second-image hero-second-image ability-slot';
    secondSlot.style.width = '160px';
    secondSlot.style.height = '160px';
    secondSlot.style.marginTop = '2px';
    secondSlot.title = 'Edit Image (160x160 recommended)';
    secondSlot.style.backgroundPosition = `center ${hero.secondOffset ?? 50}%`;
    if (hero.secondImg) secondSlot.style.backgroundImage = `url(${hero.secondImg})`;
    if (!readOnly) {
      secondSlot.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          resizeImageToBase64(file, 160, 160, resized => {
            hero.secondImg = resized;
            saveGame();
            scheduleRenderHeroes();
          });
        };
        input.click();
      };
    }
    const secondDl = document.createElement('div');
    secondDl.className = 'download-icon';
    secondDl.textContent = '🡇';
    secondDl.classList.toggle('disabled', !hero.secondImg);
    secondDl.onclick = e => {
      e.stopPropagation();
      if (secondDl.classList.contains('disabled')) return;
      downloadImage(hero.secondImg);
    };
    secondSlot.appendChild(secondDl);
    abilitiesCol.appendChild(secondSlot);
    columns.appendChild(abilitiesCol);

    const petCol = document.createElement("div");
    petCol.className = "stats-column pet-column hero-col-pet";
    const petTitle = document.createElement("div");
    petTitle.className = "stats-column-title";
    petTitle.textContent = "Pet";
    petCol.appendChild(petTitle);
    const petName = document.createElement("div");
    petName.textContent = hero.pet || "No name";
    const totalPets = state.heroes.filter(h => h.pet).length;
    const canEditPet = (totalPets < MAX_PETS || !!hero.pet) && !readOnly;
    petName.style.cursor = canEditPet ? "pointer" : "default";
    petName.title = canEditPet ? "Edit Pet Name" : "";
    if (canEditPet) {
      petName.onclick = () => {
        openEditModal(
          "Pet name",
          hero.pet,
          nuevo => {
            if (nuevo) {
              hero.pet = nuevo;
              saveGame();
              updateResourcesDisplay();
              scheduleRenderHeroes();
              renderPets();
            }
          },
          {
            validate: val => {
              if (!val) return null;
              const exists = state.heroes.some(
                h => h.id !== hero.id && h.pet && h.pet.toLowerCase() === val.toLowerCase()
              );
              return exists ? "That pet name already exists" : null;
            },
            container: div
          }
        );
      };
    }
    petCol.appendChild(petName);

    if (hero.pet) {
      const petOrigin = document.createElement("div");
      petOrigin.textContent = hero.petOrigin || "No origin";
      if (!readOnly) {
        petOrigin.style.cursor = "pointer";
        petOrigin.title = "Edit Pet Origin";
        petOrigin.onclick = () => {
          openEditModal("Pet Origin", hero.petOrigin, nuevo => {
            if (nuevo !== null) {
              hero.petOrigin = nuevo || "No origin";
              saveGame();
              scheduleRenderHeroes();
              renderPets();
            }
          }, {container: div, suggestions: getPetOrigins()});
        };
      }
      const petImgSlot = document.createElement("div");
      petImgSlot.className = "slot-img pet-image-container pet-box";
      petImgSlot.style.width = '160px';
      petImgSlot.title = "Edit Image (160x160 recommended)";
      if (hero.petImg) petImgSlot.style.backgroundImage = `url(${hero.petImg})`;
      if (!readOnly) {
        petImgSlot.onclick = () => {
          const input = document.createElement("input");
          input.type = "file";
          input.style.display = "none";
          input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            resizeImageToBase64(file, 160, 160, resized => {
              hero.petImg = resized;
              saveGame();
              scheduleRenderHeroes();
              renderPets();
            });
          };
          input.click();
        };
      }
      petCol.appendChild(petOrigin);
      petCol.appendChild(petImgSlot);
      const petInfo = document.createElement("div");
      const need = expNeededForLevel(hero.petLevel);
      petInfo.innerHTML = `Level: ${hero.petLevel} <br>Exp: ${hero.petExp}/${need}`;
      petCol.appendChild(petInfo);
    }
    const equipCol = document.createElement("div");
    equipCol.className = "stats-column equip-column hero-col-abilitiesimg";
    const equipTitle = document.createElement("div");
    equipTitle.className = "stats-column-title";
    equipTitle.textContent = "Abilities(Img)";
    equipCol.appendChild(equipTitle);
    const equipGrid = document.createElement("div");
    equipGrid.className = "equip-grid";
    const arma = document.createElement("div");
    arma.className = "equip-item";
    arma.textContent = "Ability 1:";
      const armaImg = document.createElement("div");
      armaImg.className = "slot-img image-wrapper ability-image ability-image-1 ability-slot";
      if (!readOnly) armaImg.title = "Edit Image (160x160 recommended)";
      if (hero.weaponImg) armaImg.style.backgroundImage = `url(${hero.weaponImg})`;
      if (!readOnly) {
        armaImg.onclick = () => {
          const input = document.createElement("input");
          input.type = "file";
          input.style.display = "none";
          input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            resizeImageToBase64(file, 160, 160, resized => {
              hero.weaponImg = resized;
              saveGame();
              scheduleRenderHeroes();
            });
          };
          input.click();
        };
      }
    const armaDl = document.createElement('div');
    armaDl.className = 'download-icon';
    armaDl.textContent = '🡇';
    armaDl.classList.toggle('disabled', !hero.weaponImg);
    armaDl.onclick = e => {
      e.stopPropagation();
      if (armaDl.classList.contains('disabled')) return;
      downloadImage(hero.weaponImg);
    };
      armaImg.appendChild(armaDl);
      if (!hero.ability1Learned) {
        armaDl.classList.add('disabled');
        armaImg.classList.add('locked');
        const overlay = document.createElement('div');
        overlay.className = 'locked-overlay';
        overlay.id = `ability1-overlay-${hero.id}`;
        overlay.textContent = hero.ability1LearnTime > 0 ? 'Learning 3m' : 'Locked';
        armaImg.appendChild(overlay);
      }
      arma.appendChild(armaImg);

    const armadura = document.createElement("div");
    armadura.className = "equip-item";
    armadura.textContent = "Ability 2:";
      const armorImg = document.createElement("div");
      armorImg.className = "slot-img image-wrapper ability-image ability-image-2 ability-slot";
      if (!readOnly) armorImg.title = "Edit Image (160x160 recommended)";
      if (hero.armorImg) armorImg.style.backgroundImage = `url(${hero.armorImg})`;
      if (!readOnly) {
        armorImg.onclick = () => {
          const input = document.createElement("input");
          input.type = "file";
          input.style.display = "none";
          input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            resizeImageToBase64(file, 160, 160, resized => {
              hero.armorImg = resized;
              saveGame();
              scheduleRenderHeroes();
            });
          };
          input.click();
        };
      }
    const armorDl = document.createElement('div');
    armorDl.className = 'download-icon';
    armorDl.textContent = '🡇';
    armorDl.classList.toggle('disabled', !hero.armorImg);
    armorDl.onclick = e => {
      e.stopPropagation();
      if (armorDl.classList.contains('disabled')) return;
      downloadImage(hero.armorImg);
    };
      armorImg.appendChild(armorDl);
      if (!hero.ability2Learned) {
        armorDl.classList.add('disabled');
        armorImg.classList.add('locked');
        const overlay = document.createElement('div');
        overlay.className = 'locked-overlay';
        overlay.id = `ability2-overlay-${hero.id}`;
        overlay.textContent = hero.ability2LearnTime > 0 ? 'Learning 3m' : 'Locked';
        armorImg.appendChild(overlay);
      }
      armadura.appendChild(armorImg);

    equipGrid.appendChild(arma);
    equipGrid.appendChild(armadura);
    equipCol.appendChild(equipGrid);
    columns.appendChild(equipCol);
    columns.appendChild(petCol);

    const potCol = document.createElement("div");
    potCol.className = "stats-column";
    const potTitle = document.createElement("div");
    potTitle.className = "stats-column-title";
    potTitle.textContent = "Potions";
    potCol.appendChild(potTitle);
    [
      ["hpPotions","HealingPotions", () => { hero.hp = Math.min(hero.hpMax, hero.hp + 10); }],
      ["manaPotions","ManaPotions", () => { hero.mana = Math.min(hero.manaMax, hero.mana + 10); }],
      ["energyPotions","EnergyPotions", () => { hero.energia = Math.min(100, hero.energia + 20); }],
      ["expPotions","ExpPotions", () => { addHeroExp(hero, 5); }]
    ].forEach(([key,label,drinkFn]) => {
      const line = document.createElement("div");
      line.className = "potion-item";
      const span = document.createElement("span");
      span.textContent = `${label}: ${hero[key]}`;
      line.appendChild(span);
      if (!readOnly) {
        const drink = document.createElement("button");
        drink.textContent = "Drink";
        drink.className = "hero-drink-btn";
        drink.onclick = () => {
          if (hero[key] > 0) {
            hero[key]--; drinkFn();
            saveGame(); scheduleRenderHeroes(); renderVillageChief();
          }
        };
        const plus = document.createElement("span");
        plus.textContent = "➕";
        plus.className = "potion-icon potion-plus";
        plus.onclick = () => {
          if (villageChief[key] > 0) {
            villageChief[key]--; hero[key]++; saveGame(); scheduleRenderHeroes(); renderVillageChief();
          }
        };
        const minus = document.createElement("span");
        minus.textContent = "➖";
        minus.className = "potion-icon potion-minus";
        minus.onclick = () => {
          if (hero[key] > 0) {
            hero[key]--; villageChief[key]++; saveGame(); scheduleRenderHeroes(); renderVillageChief();
          }
        };
        line.appendChild(drink); line.appendChild(plus); line.appendChild(minus);
      }
      potCol.appendChild(line);
    });
    columns.appendChild(potCol);

    const profCol = document.createElement("div");
    profCol.className = "stats-column prof-column";
    const profTitle = document.createElement("div");
    profTitle.className = "stats-column-title";
    const allowed = hero.maxProfessions ?? PROFESSION_LIMIT;
    profTitle.textContent = `Professions ${hero.professions.length}/${allowed}`;
    profCol.appendChild(profTitle);
    hero.professions.sort((a,b)=>a.localeCompare(b));
    hero.professions.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "profession-item";
      const span = document.createElement("span");
      span.textContent = p;
      item.appendChild(span);
      if (!readOnly) {
        const del = document.createElement("button");
        del.textContent = "x";
        del.onclick = () => {
          openConfirm({
            message: `Remove profession for ${PROFESSION_REMOVE_COST} gold?`,
            onConfirm: () => {
              if (state.money < PROFESSION_REMOVE_COST) {
                showAlert("Not enough gold");
                return;
              }
              state.money -= PROFESSION_REMOVE_COST;
              hero.professions.splice(idx, 1);
              updateResourcesDisplay();
              saveGame();
              scheduleRenderHeroes();
            },
            container: div
          });
        };
        item.appendChild(del);
      }
      profCol.appendChild(item);
    });
    if (!readOnly && hero.professions.length < allowed) {
      const select = document.createElement("select");
      select.className = "profession-select";
      const opt = document.createElement("option");
      opt.textContent = "Add profession";
      opt.value = "";
      select.appendChild(opt);
      const allProfs = [
        "Summoner","Mage","Buffer","Healer","Ninja","Warrior","Tank","Monk","Archer","Builder","Merchant","Farmer","Miner","Lumberjack","Thief","Entertainer","Leader","Paladin","Berserker","Necromancer","Alchemist","Chef","Fisher","Blacksmith","Tamer","Diplomat","Scholar","Spy","Druid","Brawler","CareTaker","Vanguard","Strategist","Explorer"
      ].sort((a,b)=>a.localeCompare(b));
      allProfs.forEach(prof => {
        if (!hero.professions.includes(prof)) {
          const o = document.createElement("option");
          o.value = prof;
          o.textContent = prof;
          select.appendChild(o);
        }
      });
      select.onchange = e => {
        const val = e.target.value;
        if (!val) return;
        openConfirm({
          message: `Add profession ${val}?`,
          onConfirm: () => {
            hero.professions.push(val);
            hero.professions.sort((a,b)=>a.localeCompare(b));
            saveGame();
            scheduleRenderHeroes();
          },
          onCancel: () => {},
          container: div
        });
        select.value = "";
      };
      profCol.appendChild(select);
    }
    columns.appendChild(profCol);

    statsDiv.appendChild(columns);

    div.appendChild(statsDiv);
    renderSexBadge(div, hero);
    fragment.appendChild(div);
  });
  container.appendChild(fragment);

  if (pagination) {
    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentHeroPage === 1;
    prev.onclick = () => { if (currentHeroPage > 1) { currentHeroPage--; scheduleRenderHeroes(); } };
    const info = document.createElement("span");
    info.textContent = ` Page ${currentHeroPage} of ${heroPages} `;
    const next = document.createElement("button");
    next.textContent = "Next";
    next.disabled = currentHeroPage === heroPages;
    next.onclick = () => { if (currentHeroPage < heroPages) { currentHeroPage++; scheduleRenderHeroes(); } };
    pagination.appendChild(prev);
    pagination.appendChild(info);
    pagination.appendChild(next);
  }
  if (perfOptimizations) {
    performance.mark('render-hero-list:end');
    performance.measure('render-hero-list', 'render-hero-list:start', 'render-hero-list:end');
  }
}

function renderPets() {
  const container = document.getElementById("pets");
  const pagination = document.getElementById("pet-pagination");
  if (!container) return;
  container.innerHTML = "";
  if (pagination) pagination.innerHTML = "";
  const readOnly = currentView === "profiles";

  if (document.activeElement?.id !== "pet-search") {
    updatePetControls();
  }

  let list = state.heroes.filter(h => h.pet);
  if (petFilterOrigin) list = list.filter(h => h.petOrigin === petFilterOrigin);
  if (petFilterFavorites) list = list.filter(h => h.petFavorite);
  if (petFilterSearch) {
    const q = petFilterSearch.toLowerCase();
    list = list.filter(h => (h.pet || "").toLowerCase().includes(q));
  }

  const sorted = list.sort((a,b) => {
    if (petSort === "level") {
      return petSortAsc ? (a.petLevel||0) - (b.petLevel||0) : (b.petLevel||0) - (a.petLevel||0);
    }
    return petSortAsc
      ? (a.pet||"").localeCompare(b.pet||"")
      : (b.pet||"").localeCompare(a.pet||"");
  });
  const petPages = Math.max(1, Math.ceil(sorted.length / PETS_PER_PAGE));
  if (currentPetPage > petPages) currentPetPage = petPages;
  const start = (currentPetPage - 1) * PETS_PER_PAGE;
  const pagePets = sorted.slice(start, start + PETS_PER_PAGE);

  pagePets.forEach(hero => {
    const div = document.createElement("div");
    div.className = "hero pet-card";

    const star = document.createElement("div");
    star.className = "favorite-star" + (hero.petFavorite ? " selected" : "");
    star.textContent = "★";
    star.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      star.onclick = () => {
        hero.petFavorite = !hero.petFavorite;
        saveGame();
        renderPets();
      };
    }
    div.appendChild(star);

    const ownerImg = document.createElement("img");
    ownerImg.src = hero.avatar || EMPTY_SRC;
    ownerImg.className = "avatar";
    if (!hero.avatar) ownerImg.classList.add("empty");

    const ownerInfo = document.createElement("div");
    ownerInfo.style.display = "flex";
    ownerInfo.style.flexDirection = "column";
    const ownerLabel = document.createElement("strong");
    ownerLabel.textContent = "owner";
    const hName = document.createElement("span");
    hName.textContent = hero.name;
    ownerInfo.appendChild(ownerLabel);
    ownerInfo.appendChild(hName);
    if (!readOnly) {
      const changeBtn = document.createElement('button');
      changeBtn.textContent = 'ChangeOwner';
      changeBtn.className = 'btn btn-blue';
      changeBtn.style.fontSize = '0.7em';
      changeBtn.style.marginTop = '4px';
      changeBtn.style.padding = '2px 4px';
      changeBtn.onclick = e => {
        e.stopPropagation();
        showChangePetOwnerPopup(hero);
      };
      ownerInfo.appendChild(changeBtn);
    }

    const petWrap = document.createElement("div");
    petWrap.className = "avatar-wrap pet-image-container";

    const petImg = document.createElement("img");
    petImg.src = hero.petImg || EMPTY_SRC;
    petImg.className = "pet-avatar";
    if (!hero.petImg) petImg.classList.add("empty");
    if (!readOnly) {
      petImg.title = "Edit Image (160x160 recommended)";
      petImg.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          resizeImageToBase64(file, 160, 160, resized => {
            hero.petImg = resized;
            saveGame();
            renderPets();
            scheduleRenderHeroes();
          });
        };
        input.click();
      };
    }

    petWrap.appendChild(petImg);

    const dlIcon = document.createElement('div');
    dlIcon.className = 'download-icon';
    dlIcon.textContent = '🡇';
    dlIcon.classList.toggle('disabled', !hero.petImg);
    dlIcon.title = 'Download image';
    dlIcon.setAttribute('aria-label', 'Download image');
    dlIcon.onclick = e => {
      e.stopPropagation();
      if (dlIcon.classList.contains('disabled')) return;
      downloadImage(petImg.src);
    };
    petWrap.appendChild(dlIcon);

    const resWrap = document.createElement("div");
    resWrap.className = "pet-resource-icons";
    if (hero.petPendingCount > 0) {
      const icon = document.createElement("div");
      icon.className = "pet-resource-icon";
      icon.textContent = PET_RESOURCE_ICONS[hero.petResourceType] || '💰';
      const count = document.createElement("span");
      count.className = "pet-resource-count";
      count.textContent = `x${hero.petPendingCount}`;
      icon.appendChild(count);
      if (!readOnly) {
        icon.title = "Collect";
        icon.onclick = e => {
          e.stopPropagation();
          const qty = hero.petPendingCount || 0;
          if (hero.petResourceType === 'food') {
            state.food = Math.min(MAX_FOOD, state.food + qty);
          } else if (hero.petResourceType === 'wood') {
            state.wood = Math.min(MAX_WOOD, state.wood + qty);
          } else if (hero.petResourceType === 'stone') {
            state.stone = Math.min(MAX_STONE, state.stone + qty);
          } else {
            state.money += qty;
          }
          if (qty > 0) addPetExp(hero, qty);
          hero.petPendingCount = 0;
          hero.petResourceType = null;
          hero.petLastCollection = Date.now();
          saveGame();
          updateResourcesDisplay();
          renderPets();
          updateFullCollectIcons();
        };
      } else {
        icon.style.pointerEvents = 'none';
        icon.style.opacity = '0.5';
      }
      resWrap.appendChild(icon);
    }
    petWrap.appendChild(resWrap);
    div.appendChild(petWrap);

    const info = document.createElement("div");
    info.className = "info-section";
    const nameSpan = document.createElement("strong");
    nameSpan.textContent = hero.pet || "No name";
    nameSpan.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      nameSpan.title = "Edit Name";
      nameSpan.onclick = () => {
        openEditModal("Pet name", hero.pet, nuevo => {
          if (nuevo) {
            hero.pet = nuevo;
            saveGame();
            updateResourcesDisplay();
            renderPets();
            scheduleRenderHeroes();
          }
        }, {container: div});
      };
    }
    info.appendChild(nameSpan);
    info.appendChild(document.createElement("br"));
    const originSpan = document.createElement("span");
    originSpan.textContent = `Origin: ${hero.petOrigin || "No origin"}`;
    originSpan.style.cursor = readOnly ? "default" : "pointer";
    if (!readOnly) {
      originSpan.title = "Edit Origin";
      originSpan.onclick = () => {
        openEditModal("Pet Origin", hero.petOrigin, nuevo => {
          if (nuevo !== null) {
            hero.petOrigin = nuevo || "No origin";
            saveGame();
            renderPets();
            scheduleRenderHeroes();
          }
        }, {container: div, suggestions: getPetOrigins()});
      };
    }
    info.appendChild(originSpan);
    const needPet = expNeededForLevel(hero.petLevel);
    info.insertAdjacentHTML("beforeend", `<br>Level: ${hero.petLevel} <br>Exp: ${hero.petExp}/${needPet}`);
    const pDescSpan = document.createElement('span');
    pDescSpan.textContent = hero.petDesc ? (hero.petDesc.length>60 ? hero.petDesc.slice(0,60)+'...' : hero.petDesc) : 'Empty';
    pDescSpan.style.cursor = readOnly ? 'default' : 'pointer';
    if (!readOnly) {
      pDescSpan.onclick = () => {
        openEditModal('Pet Description', hero.petDesc, val => {
          hero.petDesc = val;
          saveGame();
          renderPets();
          scheduleRenderHeroes();
        }, {multiLine:true, container: div});
      };
    }
    const pDescLine = document.createElement('div');
    pDescLine.style.fontSize = '0.85em';
    pDescLine.append('Description: ');
    pDescLine.appendChild(pDescSpan);
    info.appendChild(pDescLine);
    div.appendChild(info);
    div.appendChild(ownerImg);
    div.appendChild(ownerInfo);

    container.appendChild(div);
  });

  if (pagination) {
    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentPetPage === 1;
    prev.onclick = () => { if (currentPetPage > 1) { currentPetPage--; renderPets(); } };
    const info = document.createElement("span");
    info.textContent = ` Page ${currentPetPage} of ${petPages} `;
    const next = document.createElement("button");
    next.textContent = "Next";
    next.disabled = currentPetPage === petPages;
    next.onclick = () => { if (currentPetPage < petPages) { currentPetPage++; renderPets(); } };
    pagination.appendChild(prev);
    pagination.appendChild(info);
    pagination.appendChild(next);
  }
}

export function startMission(hero, slot) {
  console.log('🚀 startMission() llamada:', {
    heroName: hero.name,
    heroId: hero.id,
    slotId: slot.id,
    isBusy: isBusy(hero)
  });
  
  if (isBusy(hero)) {
    console.log('❌ startMission() cancelada: héroe ocupado');
    return;
  }
  
  const duration = missionDuration(slot.id); // En segundos
  const now = Date.now();
  const durationMs = duration * 1000;
  
  console.log('⏱️ Configurando misión:', {
    duration: duration,
    durationMs: durationMs,
    now: new Date(now).toLocaleString(),
    endAt: new Date(now + durationMs).toLocaleString()
  });
  
  // Modelo de Special Builder: timestamps ISO y endAt explícito
  slot.heroId = hero.id;
  slot.startedAt = new Date(now).toISOString();
  slot.endAt = new Date(now + durationMs).toISOString();
  slot.durationMs = durationMs;
  slot.status = 'running';
  
  console.log('✅ Slot actualizado:', {
    heroId: slot.heroId,
    startedAt: slot.startedAt,
    endAt: slot.endAt,
    durationMs: slot.durationMs,
    status: slot.status
  });
  
  // Mantener propiedades del héroe para compatibilidad con UI
  hero.missionTime = duration;
  hero.missionDuration = duration;
  hero.missionStartTime = now;
  
  console.log('✅ Héroe actualizado:', {
    missionTime: hero.missionTime,
    missionDuration: hero.missionDuration,
    missionStartTime: hero.missionStartTime
  });
  
  scheduleRenderHeroes();
  // Forzar actualización inmediata del DOM
  setTimeout(() => {
    renderMissions();
    renderGroupMissions(); // Actualizar group missions para que el héroe no aparezca disponible
  }, 0);
  renderDailyMissions();
  scheduleSaveGame();
  
  console.log('✅ startMission() completada');
}

function handlePendingMissions(hero) {
  state.missions.forEach(slot => {
    if (slot.pendingHeroId === hero.id && hero.trainTime <= 0) {
      slot.heroId = hero.id;
      slot.pendingHeroId = null;
      startMission(hero, slot);
    }
  });
}


function getTotalPetResources() {
  const totals = { gold: 0, food: 0, wood: 0, stone: 0 };
  state.heroes.forEach(h => {
    const qty = h.petPendingCount || 0;
    if (qty > 0) {
      const type = h.petResourceType || 'gold';
      totals[type] += qty;
    }
  });
  return totals;
}

function collectAllPetResources() {
  const totals = { gold: 0, food: 0, wood: 0, stone: 0 };
  state.heroes.forEach(hero => {
    const qty = hero.petPendingCount || 0;
    if (qty > 0) {
      const type = hero.petResourceType || 'gold';
      const full = (
        (type === 'food' && state.food >= MAX_FOOD) ||
        (type === 'wood' && state.wood >= MAX_WOOD) ||
        (type === 'stone' && state.stone >= MAX_STONE)
      );
      if (!full) {
        totals[type] += qty;
        if (type === 'food') {
          state.food = Math.min(MAX_FOOD, state.food + qty);
        } else if (type === 'wood') {
          state.wood = Math.min(MAX_WOOD, state.wood + qty);
        } else if (type === 'stone') {
          state.stone = Math.min(MAX_STONE, state.stone + qty);
        } else {
          state.money += qty;
        }
        if (qty > 0) addPetExp(hero, qty);
        hero.petPendingCount = 0;
        hero.petResourceType = null;
        hero.petLastCollection = Date.now();
      }
    }
  });
  updateResourcesDisplay();
  saveGame();
  if (isSectionVisible('pets-section')) renderPets();
  scheduleSaveGame();
  return totals;
}

function updateFullCollectIcons() {
  const totals = getTotalPetResources();
  
  // Buscar en ambos contextos: el original y el clonado en population
  const contexts = [
    document, // Contexto original
    document.getElementById('population-content') // Contexto clonado en population
  ].filter(Boolean);
  
  contexts.forEach(context => {
    const wrap = context.querySelector('#full-collect-icons');
    if (!wrap) return;
    
    Object.keys(PET_RESOURCE_ICONS).forEach(type => {
      const span = wrap.querySelector(`#full-${type}-count`);
      if (span) span.textContent = `x${totals[type] || 0}`;
    });
  });
}

function renderPetManagement(containerContext = null) {
  console.log('renderPetManagement called, containerContext:', containerContext);
  
  // Si estamos en population tab, buscar dentro de population-content
  let card;
  if (containerContext) {
    card = containerContext.querySelector("#pet-management-card");
    console.log('Buscando card en containerContext:', card);
  } else {
    // Verificar si estamos en el tab de population-pets
    const populationContent = document.getElementById("population-content");
    const petManagementInPopulation = populationContent?.querySelector("#pet-management-card");
    
    if (petManagementInPopulation && petManagementInPopulation.offsetParent !== null) {
      // El card en population está visible, usar ese
      card = petManagementInPopulation;
      console.log('Usando card de population-content (visible):', card);
    } else {
      // Usar el card original
      card = document.getElementById("pet-management-card");
      console.log('Usando card original:', card);
    }
  }
  
  if (!card) {
    console.warn('No se encontró pet-management-card');
    return;
  }
  
  console.log('Card encontrado, limpiando innerHTML');
  card.innerHTML = "";

  const addBtn = document.createElement("button");
  addBtn.id = "add-pet-btn";
  addBtn.className = "btn btn-blue";
  addBtn.textContent = "AddPet";
  addBtn.style.width = '100%';
  addBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Click directo en AddPet');
    showAddPetPopup();
  };

  const wrap = document.createElement('div');
  wrap.id = 'full-collect-wrap';
  const btn = document.createElement("button");
  btn.id = 'full-pet-collect-btn';
  btn.className = 'btn btn-green white-text';
  btn.style.height = '100%';
  btn.textContent = 'FullRecolection';
  btn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Click directo en FullRecolection');
    collectAllPetResources();
    renderPetManagement(containerContext);
  };
  wrap.appendChild(btn);
  const icons = document.createElement('div');
  icons.id = 'full-collect-icons';
  Object.entries(PET_RESOURCE_ICONS).forEach(([type, icon]) => {
    const div = document.createElement('div');
    div.className = 'pet-resource-icon';
    div.textContent = icon;
    const span = document.createElement('span');
    span.className = 'pet-resource-count';
    span.id = `full-${type}-count`;
    span.textContent = 'x0';
    div.appendChild(span);
    icons.appendChild(div);
  });
  wrap.appendChild(icons);

  const freeBtn = document.createElement("button");
  freeBtn.id = "free-pet-btn";
  freeBtn.className = "btn btn-red";
  freeBtn.textContent = "FreePet";
  freeBtn.style.width = '100%';
  freeBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Click directo en FreePet');
    showFreePetPopup();
  };

  const slot2 = document.createElement('div');
  const slot4 = document.createElement('div');
  card.appendChild(addBtn);
  card.appendChild(slot2);
  card.appendChild(wrap);
  card.appendChild(slot4);
  card.appendChild(freeBtn);
  console.log('Botones añadidos al card, actualizando íconos');
  updateFullCollectIcons();
}


const loadedAssets = new Set();
function preloadAssets(urls = []) {
  const loaders = [];
  urls.forEach(url => {
    if (!url || loadedAssets.has(url)) return;
    loadedAssets.add(url);
    loaders.push(new Promise(resolve => {
      const isAudio = /\.(mp3|wav|ogg)(\?.*)?$/i.test(url);
      const el = isAudio ? new Audio() : new Image();
      const done = () => resolve();
      if (isAudio) {
        el.addEventListener('canplaythrough', done, { once: true });
      } else {
        el.onload = done;
      }
      el.onerror = done;
      el.src = url;
    }));
  });
  return Promise.all(loaders);
}

let minigameHtmlCache = null;
async function fetchMinigameHtml(src) {
  if (!src) return null;
  // Inicializar cache si aún no existe
  if (!minigameHtmlCache) minigameHtmlCache = lru;
  const cached = minigameHtmlCache.get(src);
  if (cached) return cached;
  
  try {
    // Intentar usar el método de Electron si está disponible
    if (window.electronAPI && window.electronAPI.invoke) {
      const html = await window.electronAPI.invoke('read-html-file', src);
      if (html) {
        minigameHtmlCache.set(src, html);
        return html;
      }
    }
    
    // Fallback a fetch para desarrollo o navegadores
    const response = await fetch(src);
    const html = await response.text();
    minigameHtmlCache.set(src, html);
    return html;
  } catch (error) {
    console.error(`Error loading ${src}:`, error);
    return null;
  }
}

function scheduleIdleTask(task){
  if("requestIdleCallback" in window){
    requestIdleCallback(task,{timeout:2000});
  }else{
    setTimeout(task,200);
  }
}

function showLoading(container, text = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.textContent = text;
  overlay.appendChild(modal);
  appendOverlay(overlay);
  return () => removeOverlay(overlay);
}

let commonAssetsLoaded = false;
function preloadCommonImages() {
  if (commonAssetsLoaded) return;
  const urls = [
    'src/Buildings/House.png',
    ...Object.values(BUILDING_IMAGES)
  ];
  state.heroes.forEach(h => {
    if (h.avatar) urls.push(h.avatar);
    if (h.petImg) urls.push(h.petImg);
  });
  if (villageChief.avatar) urls.push(villageChief.avatar);
  commonAssetsLoaded = true;
  preloadAssets(urls);
}

function preloadMinigameAssets(){
  Object.keys(GAME_SOURCES).forEach(name=>{
    fetchMinigameHtml(GAME_SOURCES[name]);
    const assets=GAME_ASSETS[name];
    if(assets) preloadAssets(assets);
  });
}

function buildNextLevelTable(card){
  card.innerHTML = "";
  const close = document.createElement("button");
  close.textContent = "❌";
  close.className = "close-btn";
  close.onclick = () => { card.style.display = "none"; };
  card.appendChild(close);
  const container = document.createElement("div");
  container.className = "level-table-container";
  const ranges = [
    [1,250],
    [251,500],
    [501,750],
    [751,1000]
  ];
  ranges.forEach(([start,end])=>{
    const table = document.createElement("table");
    const header = document.createElement("tr");
    header.innerHTML = "<th>Level</th><th>Exp</th>";
    table.appendChild(header);
    for(let i=start;i<=end;i++){
      if(i === 1000){
        const row = document.createElement("tr");
        row.innerHTML = "<td>1000+</td><td>5000</td>";
        table.appendChild(row);
        break;
      }
      const exp = expNeededForLevel(i, Infinity);
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i}</td><td>${exp}</td>`;
      table.appendChild(row);
    }
    container.appendChild(table);
  });
  card.appendChild(container);
}

function buildAcumulatedLevelTable(card){
  card.innerHTML = "";
  const close = document.createElement("button");
  close.textContent = "❌";
  close.className = "close-btn";
  close.onclick = () => { card.style.display = "none"; };
  card.appendChild(close);
  const container = document.createElement("div");
  container.className = "level-table-container";
  const ranges = [
    [1,250],
    [251,500],
    [501,750],
    [751,1000]
  ];
  ranges.forEach(([start,end])=>{
    const table = document.createElement("table");
    const header = document.createElement("tr");
    header.innerHTML = "<th>Level</th><th>Exp</th>";
    table.appendChild(header);
    for(let i=start;i<=end;i++){
      if(i === 1000){
        const row = document.createElement("tr");
        row.innerHTML = "<td>1000+</td><td>485850+5000*(Level-1000)</td>";
        table.appendChild(row);
        break;
      }
      const exp = expTotalForLevel(i);
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i}</td><td>${exp}</td>`;
      table.appendChild(row);
    }
    container.appendChild(table);
  });
  card.appendChild(container);
}

function renderTutorial(){
  const nextBtn = document.getElementById("next-level-table-btn");
  const nextCard = document.getElementById("next-level-table-card");
  const acumBtn = document.getElementById("acumulated-level-table-btn");
  const acumCard = document.getElementById("acumulated-level-table-card");
  if(!nextBtn || !nextCard || !acumBtn || !acumCard) return;
  nextBtn.onclick = () => {
    const show = nextCard.style.display === "none";
    nextCard.style.display = show ? "block" : "none";
    acumCard.style.display = "none";
    if(show && !nextCard.firstChild) buildNextLevelTable(nextCard);
  };
  acumBtn.onclick = () => {
    const show = acumCard.style.display === "none";
    acumCard.style.display = show ? "block" : "none";
    nextCard.style.display = "none";
    if(show && !acumCard.firstChild) buildAcumulatedLevelTable(acumCard);
  };

  const infoCard = document.getElementById("tutorial-info-card");
  if (infoCard) {
    infoCard.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;"><strong>1. Important Notes</strong>
<strong>1.1. Save & Music Folders:</strong> Save files are stored in ...\\documents\\SummonYourWillSaves; music is stored in ...\\SummonYourWillMusic.

<strong>2. Characters</strong>

<strong>2.1 Village Chief</strong>
Role: The leader of your village.
Has: Abilities, Stats, and an Inventory.

<strong>2.2 Heroes (Main Characters)</strong>
Role: Primary workforce and adventurers.
Resource generation: Auto-clicking, Work / Farm / Mine / Chop, Missions.
Village building: Help construct and upgrade structures.
Each Hero has: Stats, Inventory, a Pet slot, and two Abilities.

<strong>2.3 Pets</strong>
Role: Assign to Heroes to enhance performance.

<strong>3. Village - Key Structures & Effects</strong>

Terrain: Increases max Houses (each Terrain level adds +5 Houses).

Houses: Increase max Heroes (1 Hero per House).

Pet Sanctuary: Increases max Pets.

Tower: Village defense structure.

Food/Wood/Stone Storage: Raise caps for Food, Wood, Stone.

Training Grounds: Raise max attainable stats for Heroes.

Dungeon: Generates daily Gold via Daily Tribute.

Castle: Raises level caps for Village Chief, Heroes, Partner.

<strong>4. Features</strong>

<strong>4.1 Silence Temple</strong>
Modes:

4-4-6 Relaxing: Inhale 4s, hold 4s, exhale 6s.

Kapalabhati Energizing: Rapid breathing with forceful exhalations.

Nadi Balancing: Alternate-nostril breathing.
Rewards: Upgrades Familiar level after 2 minutes; also gives Gold.

<strong>4.2 Pomodoro Tower</strong>
Technique: Focus cycles of 25 or 45 minutes.
Rewards: Upgrades Village Chief ability level; also gives Gold.

<strong>4.3 Projects</strong>
Manage your real-life projects.

<strong>4.4 Habits Calendar</strong>
Daily habits → Chief stats:
Exercise → Strength, Study → Intelligence, Meditation → Mana, etc.
Rewards: Upgrades Village Chief stats; also gives Gold.

<strong>4.5 Life Missions</strong>
Daily tasks with difficulty tiers:

Easy: 400 Gold

Normal: 1000 Gold

Hard: 2500 Gold

<strong>4.6 Custom Music Player</strong>
Personalized music player for your sessions.

<strong>4.7 Hero Orders</strong>
Partner issues global orders to all Heroes: Rest, Work, Auto-click.

<strong>4.8 Export / Import / Reset</strong>

Export: Save current game data to .json for use later.

Import: Load a saved .json game.

Reset: Start fresh from level 0 with default data.

<strong>4.9 SaveAllImages (Setting)</strong>
When enabled: Saves all app images to ..\\images\\SummonYourWillImages.

<strong>5. Minigames</strong>

<strong>5.1 Fight Intruders</strong>
Use Village Chief and Partner abilities to repel intruders and earn Gold.

<strong>5.2 Giant Boss</strong>
6 Heroes fight a giant monster that gets stronger after each defeat.

<strong>5.3 Enemy Encounters</strong>
Capture-style minigame for hero XP and rewards.

<strong>5.4 Pet Exploration</strong>
Each Pet can collect Gold once per day with the Village Chief and Partner.

<strong>5.5 Chief Survival</strong>
Earn 1000 Gold for each level the Chief survives.


<strong>5.7 Fortune Wheel</strong>
Daily wheel to earn Gold.</pre>`;
  }
}

function sanitizeFileName(str) {
  return (str || "")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_');
}

function getImageExtension(src) {
  if (typeof src !== 'string') return '.png';
  if (src.startsWith('data:')) {
    const m = src.match(/^data:(?:image\/)?([^;]+)/i);
    return m && m[1] ? `.${m[1].toLowerCase()}` : '.png';
  }
  const urlExt = src.split('.').pop().toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(urlExt)) return `.${urlExt}`;
  return '.png';
}

function collectCarouselImages(ab) {
  if (!ab) return [];

  // Arrays "típicos"
  const preferredArrays = [
    ab.images, ab.gallery, ab.carousel, ab.imageUrls, ab.photos, ab.pictures
  ];
  for (const a of preferredArrays) {
    if (Array.isArray(a) && a.some(Boolean)) {
      return a.filter(Boolean).slice(0, 3);
    }
  }

  // Campos sueltos comunes
  const singles = [ab.image1, ab.image2, ab.image3, ab.img, ab.img2, ab.img3]
    .filter(Boolean);

  // Fallback genérico: busca el primer array de strings que parezcan imágenes
  const anyImageArrays = Object.values(ab).filter(v =>
    Array.isArray(v) &&
    v.length &&
    v.every(x => typeof x === 'string' && (
      x.startsWith('data:') ||
      /^https?:/i.test(x) ||
      /\.(png|jpe?g|webp)$/i.test(x)
    ))
  );

  const extra = anyImageArrays.length ? anyImageArrays[0].filter(Boolean) : [];
  return [...singles, ...extra].slice(0, 3);
}

function pickFirstTruthy(arr) {
  return arr.find(Boolean) ?? null;
}

function getHeroMainAndSecond(hero) {
  const arr  = Array.isArray(hero.images)   ? hero.images.filter(Boolean)   : [];
  const pics = Array.isArray(hero.pictures) ? hero.pictures.filter(Boolean) : [];

  const main = pickFirstTruthy([
    hero.mainImage,
    hero.portrait,
    hero.image,
    hero.img,          // ← muchos héroes usan este como principal
    hero.avatar,
    arr[0],
    pics[0]
  ]);

  const second = pickFirstTruthy([
    hero.secondImage,
    hero.secondaryImage,
    hero.secondImg,    // ← slot alternativo
    hero.img2,         // ← en algunos héroes quedó así
    arr[1],
    pics[1]
  ]);

  return [main, second];
}

async function exportAllImages() {
  const items = [];
  const add = (subdir, name, src, idx) => {
    if (!src) return;
    const ext = getImageExtension(src);
    const suffix = idx !== undefined ? `-${idx}` : '';
    items.push({ subdir, filename: `${sanitizeFileName(name)}${suffix}${ext}`, src });
  };
  try {
    add('VillageChiefPartner/VillageChief', villageChief.name, villageChief.avatar);
    add('VillageChiefPartner/Partner', partner.name, partner.img);
    (villageChief.habilities || [])
      .slice(0, villageChief.unlockedHabilities ?? (villageChief.habilities ? villageChief.habilities.length : 0))
      .forEach(ab => {
        collectCarouselImages(ab).forEach((img, i) =>
          add('VillageChiefPartner/My Abilities', ab.name, img, i + 1)
        );
      });
    (villageChief.partnerAbilities || [])
      .slice(0, villageChief.unlockedPartnerAbilities ?? (villageChief.partnerAbilities ? villageChief.partnerAbilities.length : 0))
      .forEach(ab => {
        collectCarouselImages(ab).forEach((img, i) =>
          add('VillageChiefPartner/My PAbilities', ab.name, img, i + 1)
        );
      });
    (villageChief.familiars || [])
      .slice(0, villageChief.unlockedFamiliars ?? (villageChief.familiars ? villageChief.familiars.length : 0))
      .forEach(f => add('Familiars', f.name, f.img));
    (state.heroes || []).forEach(h => {
      const HERO = sanitizeFileName(h?.name ?? 'Hero');
      const [main, second] = getHeroMainAndSecond(h);
      if (main) add('Heroes', HERO, main, 1);
      if (second && second !== main) add('Heroes', HERO, second, 2);

      // --- Ability 1 ---
      const ability1 =
        (h.skills && h.skills[2]) || h.ability1 || (h.abilities?.[0] ?? null);

      const A1name = (ability1?.name && ability1.name !== "none")
        ? sanitizeFileName(ability1.name)
        : (h.weapon ? sanitizeFileName(h.weapon) : null);

      const A1src =
        ability1?.image ||
        ability1?.img ||
        (Array.isArray(ability1?.stepImgs) ? ability1.stepImgs[0] : null) ||
        h.weaponImg; // ← UI guarda la imagen aquí

      if (A1name && A1src) {
        add('Heroes', `${HERO}-Ability1(${A1name})`, A1src);
      }

      // --- Ability 2 ---
      const ability2 =
        (h.skills && h.skills[3]) || h.ability2 || (h.abilities?.[1] ?? null);

      const A2name = (ability2?.name && ability2.name !== "none")
        ? sanitizeFileName(ability2.name)
        : (h.armor ? sanitizeFileName(h.armor) : null);

      const A2src =
        ability2?.image ||
        ability2?.img ||
        (Array.isArray(ability2?.stepImgs) ? ability2.stepImgs[0] : null) ||
        h.armorImg; // ← UI guarda la imagen aquí

      if (A2name && A2src) {
        add('Heroes', `${HERO}-Ability2(${A2name})`, A2src);
      }

      if (h.pet && h.petImg) add('Pets', `${sanitizeFileName(h.pet)}-${HERO}`, h.petImg);
    });
    console.table(items.map(x => ({
      subdir: x.subdir,
      filename: x.filename,
      srcSample: (x.src || '').slice(0, 60)
    })));
    const dir = await ipcRenderer.invoke('export-all-images', items);
    showAlert(`Images exported to ${dir}`);
  } catch (err) {
    console.error('exportAllImages failed', err);
    showAlert('Error exporting images');
  }
}

function renderSettings() {
  const slider = document.getElementById('volume-slider');
  if (!slider) return;
  slider.value = Math.round(soundVolume * 100);
  slider.oninput = e => {
    const v = parseInt(e.target.value, 10) / 100;
    setSoundVolume(v);
    sywAudio.volume = v;
  };
  const btn = document.getElementById('export-images-btn');
  if (btn) btn.onclick = exportAllImages;
}

function renderGames() {
  const card = document.getElementById("games-card");
  const buttonsCard = document.getElementById("games-buttons-card");
  let detailCard = document.getElementById("games-card-2");
  const gamesSection = document.getElementById("games-section");
  if (!card) return;
  card.innerHTML = "";
  if (buttonsCard) buttonsCard.innerHTML = "";
  if (!detailCard) {
    detailCard = document.createElement("div");
    detailCard.id = "games-card-2";
    detailCard.className = "chief-card";
    if (buttonsCard && buttonsCard.parentNode) {
      buttonsCard.parentNode.insertBefore(detailCard, buttonsCard.nextSibling);
    }
  } else {
    detailCard.innerHTML = "";
  }
  detailCard.style.display = "none";
  if (gamesSection) gamesSection.style.position = "relative";
  if (fortuneDay !== getToday() && fortuneLastPrize) {
    fortuneLastPrize = "";
    saveGame();
  }

  const goldDiv = document.createElement("div");
  goldDiv.id = "games-gold-display";
  goldDiv.textContent = `Gold: ${state.money}`;
  goldDiv.style.whiteSpace = "nowrap";
  goldDiv.style.marginLeft = "10px";
  card.appendChild(goldDiv);

  const foodDiv = document.createElement("div");
  foodDiv.id = "games-food-display";
  foodDiv.textContent = `Food: ${state.food}`;
  foodDiv.style.whiteSpace = "nowrap";
  foodDiv.style.marginLeft = "10px";
  card.appendChild(foodDiv);

  const woodDiv = document.createElement("div");
  woodDiv.id = "games-wood-display";
  woodDiv.textContent = `Wood: ${state.wood}`;
  woodDiv.style.whiteSpace = "nowrap";
  woodDiv.style.marginLeft = "10px";
  card.appendChild(woodDiv);

  const stoneDiv = document.createElement("div");
  stoneDiv.id = "games-stone-display";
  stoneDiv.textContent = `Stone: ${state.stone}`;
  stoneDiv.style.whiteSpace = "nowrap";
  stoneDiv.style.marginLeft = "10px";
  card.appendChild(stoneDiv);

  if (buttonsCard && detailCard) {
    buttonsCard.style.display = "flex";
    buttonsCard.style.flexWrap = "wrap";
    buttonsCard.style.gap = "6px";
    const btnWrap = document.createElement("div");
    btnWrap.style.display = "contents";
    const gameNames = {
      1: "GiantBoss",
      2: "EnemyEncounter",
      3: "PetExploration",
      4: "ChiefSurvival",
      5: "FortuneWheel",
    };
    for (let i = 1; i <= Object.keys(gameNames).length; i++) {
      const label = gameNames[i];
      const holder = document.createElement("div");
      holder.style.display = "flex";
      holder.style.flexDirection = "column";
      holder.style.alignItems = "center";
      holder.style.flex = "1";

      const btn = document.createElement("button");
      btn.className = "btn btn-celeste";
      btn.style.width = "100%";
      btn.textContent = label;
      if (label === "PetExploration") {
        btn.title = "50 ExpPet + 20*Gold/Resources";
      } else if (label === "ChiefSurvival") {
        btn.disabled = !chiefSurvivalAvailable();
        btn.title = chiefSurvivalAvailable()
          ? `${5 - chiefSurvivalWins} chances left`
          : "Come back tomorrow";
      } else if (label === "GiantBoss") {
        btn.title = "-30% energy +20 exp";
        btn.disabled = !bossRushAvailable();
      } else if (label === "EnemyEncounter") {
        btn.title = "It adds new Villain -50% Energy • +20 XP";
        btn.disabled = !enemyEncounterAvailable();
      } else if (label === "FortuneWheel") {
        const showPrize = fortuneDay === getToday() && fortuneLastPrize;
        btn.innerHTML = showPrize
          ? `FortuneWheel<br><span class='btn-subtext'>(You already won ${fortuneLastPrize}!)</span>`
          : "FortuneWheel";
        btn.className = "btn btn-yellow white-text fortune-button";
        btn.disabled = fortuneDay === getToday();
        if (btn.disabled) btn.title = "1 time per day";
      }
      btn.onclick = () => {
        detailCard.innerHTML = "";
        if (label === "GiantBoss") {
          if (!bossRushAvailable()) return;
          bossSetup(detailCard, gamesSection);
          return;
        }
        if (label === "EnemyEncounter") {
          if (!enemyEncounterAvailable()) return;
          const hasHero = state.heroes.some(h => !isBusy(h) && h.energia >= 50);
          if (!hasHero) { showAlert('No heroes available', { container: detailCard }); return; }
          renderEnemyEncounter(detailCard, gamesSection, false);
          return;
        }
        if (label === "FortuneWheel") {
          const close = document.createElement("button");
          close.textContent = "❌";
          close.className = "close-btn";
          close.onclick = () => {
            minigameClosed();
            detailCard.style.display = "none";
            detailCard.innerHTML = "";
            detailCard.dataset.game = "";
          };
          detailCard.appendChild(close);
          detailCard.dataset.game = "FortuneWheel";
          detailCard.style.display = "block";
          minigameOpened();
          renderFortuneWheel(detailCard);
          return;
        }
        if (label.startsWith("Game")) {
          if (detailCard.style.display !== "none" && detailCard.dataset.game === label) {
            minigameClosed();
            detailCard.style.display = "none";
            detailCard.innerHTML = "";
            detailCard.dataset.game = "";
            return;
          }

          if (detailCard.style.display !== "none") minigameClosed();

          minigameOpened();
          detailCard.innerHTML = "";
          detailCard.dataset.game = label;

          const close = document.createElement("button");
          close.textContent = "❌";
          close.className = "close-btn";
          close.onclick = () => {
            minigameClosed();
            detailCard.style.display = "none";
            detailCard.innerHTML = "";
            detailCard.dataset.game = "";
          };

          const container = document.createElement("div");
          container.className = "game-container";

          detailCard.appendChild(close);
          detailCard.appendChild(container);
          detailCard.style.display = "block";
          return;
        }
        detailCard.dataset.game = "";
        let src = GAME_SOURCES[label];
        const assets = GAME_ASSETS[label] || [];

        const launch = (hero, html) => {
          minigameOpened();
          detailCard.innerHTML = "";
          const close = document.createElement("button");
          close.textContent = "❌";
          close.className = "close-btn";
          let msgHandler;
          close.onclick = () => {
            minigameClosed();
            endGame(0);
            unloadAllAudio();
            detailCard.style.display = "none";
            detailCard.innerHTML = "";
            if (msgHandler) window.removeEventListener("message", msgHandler);
          };
          const container = document.createElement("div");
          container.className = "game-container";
          detailCard.appendChild(close);
          detailCard.appendChild(container);
          detailCard.style.display = "block";
          if (src) {
            const iframe = document.createElement("iframe");
            if (html) {
              iframe.srcdoc = html;
            } else {
              iframe.src = src;
            }
            iframe.className = "html-game-frame";
            iframe.onload = () => {
              if (label === "PetExploration") {
                iframe.contentWindow.postMessage({
                  type: "petExplorationImages",
                  familiar: resolveSrc(villageChief.avatar || EMPTY_SRC),
                  pet: resolveSrc(hero.petImg || EMPTY_SRC),
                }, "*");
              } else if (label === "FightIntruders") {
                iframe.contentWindow.postMessage({
                  type: "fightIntrudersData",
                  chief: {
                    name: villageChief.name,
                    avatar: resolveSrc(villageChief.avatar || EMPTY_SRC),
                    abilities: villageChief.habilities
                      .slice(0, villageChief.unlockedHabilities ?? unlockedHabilities)
                      .map(h => ({
                        name: h.name,
                        img: resolveSrc(h.img || EMPTY_SRC),
                        level: h.level ?? h.lvl ?? h.abilityLevel ?? h.lvlAbility ?? h.skillLevel ?? 1
                      }))
                  },
                  partner: {
                    name: partner.name,
                    avatar: resolveSrc(partner.img || partner.photoUrl || partner.imageUrl || partner.avatar || EMPTY_SRC),
                    abilities: villageChief.partnerAbilities
                      .slice(0, villageChief.unlockedPartnerAbilities ?? unlockedPartnerAbilities)
                      .map(a => ({
                        name: a.name,
                        img: resolveSrc(a.img || EMPTY_SRC),
                        level: a.level ?? a.lvl ?? a.abilityLevel ?? a.lvlAbility ?? a.skillLevel ?? 1
                      }))
                  }
                }, "*");
              } else {
                iframe.contentWindow.postMessage({
                  type: "chiefAvatar",
                  src: resolveSrc(villageChief.avatar || EMPTY_SRC),
                }, "*");
              }
            };
            if (label === "PetExploration") {
              msgHandler = e => {
                if (e.data && e.data.type === "petExplorationWin") {
                  state.money += e.data.gold;
                  updateResourcesDisplay();
                  if (currentPetHero) {
                    currentPetHero.petExploreDay = getToday();
                    addPetExp(currentPetHero, 50);
                    scheduleRenderHeroes();
                    currentPetHero = null;
                  }
                  saveGame();
                }
              };
              window.addEventListener("message", msgHandler);
            } else {
              msgHandler = e => {
                if (e.data && e.data.type === "chiefSurvivalWin") {
                  state.money += e.data.gold;
                  chiefSurvivalWins++;
                  updateResourcesDisplay();
                  showAlert(`You won: ${e.data.gold} Gold`);
                  saveGame();
                  renderGames();
                }
              };
              window.addEventListener("message", msgHandler);
            }
            container.appendChild(iframe);
          } else {
            startGame(createPlaceholderGame(label), container, label);
          }
        };

        let selectedFamiliarAvatar = null;
        const loadAndLaunch = hero => {
          const removeLoading = showLoading(detailCard);
          let url = src;
          let htmlPromise = fetchMinigameHtml(src);
          if (label === "PetExploration") {
            selectedFamiliarAvatar = resolveSrc(villageChief.avatar || EMPTY_SRC);
            url = `${src}?familiar=${encodeURIComponent(selectedFamiliarAvatar)}&pet=${encodeURIComponent(resolveSrc(hero.petImg || EMPTY_SRC))}`;
            htmlPromise = Promise.resolve(null);
          } else if (label === "ChiefSurvival") {
            url = src;
            htmlPromise = Promise.resolve(null);
          }
          Promise.all([
            preloadAssets(assets),
            htmlPromise
          ]).then(([_, html]) => {
            removeLoading();
            src = url;
            launch(hero, html);
          });
        };

        if (label === "PetExploration") {
          chooseHeroPet(hero => {
            if (!hero) return;
            loadAndLaunch(hero);
          });
        } else {
          loadAndLaunch();
        }
      };

      const info = document.createElement("div");
      info.style.fontSize = "12px";
      info.style.marginTop = "2px";
      if (label === "GiantBoss") {
        info.textContent = bossRushAvailable() ? `${5 - bossRushCount} chances left` : "Come back tomorrow";
      } else if (label === "EnemyEncounter") {
        info.textContent = enemyEncounterAvailable() ? `${5 - enemyCount} chances left` : "Come back tomorrow";
      } else if (label === "ChiefSurvival") {
        info.textContent = chiefSurvivalAvailable() ? `${5 - chiefSurvivalWins} chances left` : "Come back tomorrow";
      }

      holder.appendChild(btn);
      if (info.textContent) holder.appendChild(info);
      btnWrap.appendChild(holder);
    }
    buttonsCard.appendChild(btnWrap);
    detailCard.style.display = "none";
  }
}

function showBossStats() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal";
  const close = document.createElement("button");
  close.textContent = "x";
  close.className = "close-btn";
  close.onclick = () => removeOverlay(overlay);
  modal.appendChild(close);

  const columns = document.createElement("div");
  columns.className = "stats-columns";
  const col = document.createElement("div");
  col.className = "stats-column";
  const title = document.createElement("div");
  title.className = "stats-column-title";
  title.textContent = "Stats";
  col.appendChild(title);
  const grid = document.createElement("div");
  grid.className = "stats-grid";
  const order = [
    "fuerza",
    "suerte",
    "inteligencia",
    "destreza",
    "defensa",
    "vida",
    "mana",
  ];
  const labels = {
    fuerza: "Strength",
    suerte: "Luck",
    inteligencia: "Intelligence",
    destreza: "Dexterity",
    defensa: "Defense",
    vida: "HP",
    mana: "Mana",
  };
  order.forEach(stat => {
    const line = document.createElement("div");
    line.className = "stat-line";
    const span = document.createElement("span");
    span.textContent = `${labels[stat]}: ${bossStats[stat]}`;
    line.appendChild(span);
    grid.appendChild(line);
  });
  col.appendChild(grid);
  columns.appendChild(col);
  modal.appendChild(columns);
  overlay.appendChild(modal);
  appendOverlay(overlay);
}
function summonHero() {
  console.log('🔍 summonHero called');
  console.log('📊 Current state:', {
    heroes: state.heroes.length,
    houses: state.houses,
    money: state.money,
    summonCost: summonCost
  });
  
  recalcSummonCost();
  
  if (state.heroes.length >= state.houses) {
    console.log('❌ Blocked: No houses available');
    return;
  }
  if (state.money < summonCost) {
    console.log('❌ Blocked: Not enough money');
    return;
  }
  
  console.log('✅ Validations passed, opening popup');
  pauseTimersFor(3000);

  const existing = document.querySelector(".summon-overlay");
  if (existing) existing.remove();
  
  // Buscar la card que contiene el botón SummonHero
  const summonBtn = document.getElementById("summon-btn");
  const heroActionsCard = summonBtn ? summonBtn.closest('div') : null;
  
  let overlay, modal;
  
  if (heroActionsCard) {
    // Crear overlay que se posiciona relativo a la card
    overlay = document.createElement("div");
    overlay.className = "modal-overlay summon-overlay";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    
    modal = document.createElement("div");
    modal.className = "modal";
    
    overlay.appendChild(modal);
    
    // Asegurar que la card tenga position: relative para que el overlay se posicione correctamente
    const originalPosition = heroActionsCard.style.position;
    if (getComputedStyle(heroActionsCard).position === 'static') {
      heroActionsCard.style.position = 'relative';
    }
    
    // Agregar el overlay a la card
    heroActionsCard.appendChild(overlay);
  } else {
    // Fallback: usar overlay normal si no se encuentra la card
    overlay = document.createElement("div");
    overlay.className = "modal-overlay summon-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    
    modal = document.createElement("div");
    modal.className = "modal";
    overlay.appendChild(modal);
  }

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = "";
  nameInput.placeholder = "Name";

  const originInput = document.createElement("input");
  originInput.type = "text";
  originInput.value = "";
  originInput.placeholder = "Origin";

  const originList = document.createElement('datalist');
  const originListId = `hero-origin-${Date.now()}`;
  originList.id = originListId;
  getHeroOrigins().forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    originList.appendChild(opt);
  });
  originInput.setAttribute('list', originListId);

  let avatarData = "";
  const imgInput = document.createElement("input");
  imgInput.type = "file";
  imgInput.style.display = "none";
  const imgBtn = document.createElement("button");
  imgBtn.textContent = "Select image";
  imgBtn.className = "btn btn-blue white-text";
  const imgNote = document.createElement("span");
  imgNote.textContent = "(optional)";
  const imgRow = document.createElement("div");
  imgRow.style.display = "flex";
  imgRow.style.alignItems = "center";
  imgRow.style.gap = "6px";
  imgBtn.style.flex = "0 0 33%";
  imgNote.style.flex = "1";
  imgRow.appendChild(imgBtn);
  imgRow.appendChild(imgNote);
  imgBtn.onclick = () => imgInput.click();
  imgInput.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      resizeImageToBase64(file, 160, 200, resized => { avatarData = resized; });
      imgNote.textContent = file.name;
    } else {
      avatarData = "";
      imgNote.textContent = "(optional)";
    }
  };

  const profSelect = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Add profession";
  profSelect.appendChild(emptyOpt);
  const professions = [
    "Summoner","Mage","Buffer","Healer","Ninja","Warrior","Tank","Monk","Archer","Builder","Merchant","Farmer","Miner","Lumberjack","Thief","Entertainer","Leader","Paladin","Berserker","Necromancer","Alchemist","Chef","Fisher","Blacksmith","Tamer","Diplomat","Scholar","Spy","Druid","Brawler","CareTaker","Vanguard","Strategist","Explorer"
  ].sort((a,b)=>a.localeCompare(b));
  professions.forEach(p => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    profSelect.appendChild(o);
  });

  const disabled = state.heroes.length >= state.houses;
  nameInput.disabled = disabled;
  originInput.disabled = disabled;
  profSelect.disabled = disabled;

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.gap = "6px";

  const ok = document.createElement("button");
  ok.textContent = "Summon";
  ok.className = "btn btn-blue";
  ok.style.flex = "1";
  ok.id = "summon-confirm-btn";
  ok.disabled = state.heroes.length >= state.houses;
  ok.onclick = () => {
    let name = nameInput.value.trim();
    let origin = originInput.value.trim() || "No origin";
    if (!name) {
      name = getNextWarriorName(state.heroes);
    }
    name = ensureUniqueHeroName(state.heroes, name);
    if (state.money < summonCost) return;
    const profession = profSelect.value;
    state.money -= summonCost;
    const newHero = createHero(state.heroes, name, origin, profession);
    newHero.avatar = avatarData;
    state.heroes.push(newHero);
    state.heroMap.set(newHero.id, newHero);
    recalcSummonCost();
    updateResourcesDisplay();
    saveGame();
    scheduleRenderHeroes();
    renderMissions();
    renderVillageChief();
    if (currentChiefExtra === "Autoclick enabled") {
      showChiefExtra("Autoclick enabled");
    }
    if (state.buildSelectionOpen) {
      showBuildModal();
    }
    removeOverlay(overlay);
  };

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.className = "btn btn-green white-text";
  cancel.style.flex = "1";
  cancel.onclick = () => {
    removeOverlay(overlay);
  };

  buttons.appendChild(ok);
  buttons.appendChild(cancel);
  modal.appendChild(nameInput);
  modal.appendChild(originInput);
  modal.appendChild(originList);
  modal.appendChild(imgRow);
  modal.appendChild(imgInput);
  modal.appendChild(profSelect);
  modal.appendChild(buttons);
  
  // El modal ya está dentro del overlay, no necesitamos agregarlo de nuevo
  // Solo agregar al DOM si no se agregó a la card
  if (!heroActionsCard) {
    console.log('📦 About to append overlay');
    const modalRoot = document.getElementById('modal-root');
    console.log('📦 Modal root element:', modalRoot);
    
    appendOverlay(overlay);
    console.log('✅ Overlay appended');
  } else {
    console.log('✅ Overlay already appended to heroActionsCard');
  }
  overlay.tabIndex = -1;
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ok.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel.click();
    }
  });
  focusNoScroll(nameInput);
}


function learnAbility() {
  const cost = 1000 * (unlockedHabilities + 1);
  if (state.money < cost || unlockedHabilities >= HABILITY_COUNT) return;
  state.money -= cost;
  unlockedHabilities++;
  villageChief.unlockedHabilities = unlockedHabilities;
  updateResourcesDisplay();
  saveGame();
  renderVillageChief();
}

function unlockPartnerAbility() {
  const cost = 2000 * (unlockedPartnerAbilities + 1);
  if (state.money < cost || unlockedPartnerAbilities >= PARTNER_ABILITY_COUNT) return;
  state.money -= cost;
  unlockedPartnerAbilities++;
  // villageChief.unlockedPartnerAbilities = unlockedPartnerAbilities;
  updateResourcesDisplay();
  saveGame();
  renderVillageChief();
}

// startAbilityLearning function removed - all heroes now have abilities unlocked by default

async function performReset() {
  // Usar resetToPartida0 del saveManager para copiar partida0.json a save.json
  if (ipcRenderer) {
    try {
      const success = await ipcRenderer.invoke('reset-to-partida0');
      if (success) {
        console.log('Reset completado exitosamente, recargando...');
        resetGameCompletely();
      } else {
        showAlert('Error al resetear el juego. Por favor intente nuevamente.');
      }
    } catch (error) {
      console.error('Error al ejecutar reset:', error);
      showAlert('Error al resetear el juego. Por favor intente nuevamente.');
    }
  } else {
    // Fallback para navegador (sin Electron)
    // Limpiar localStorage y recargar
    resetGameCompletely();
  }
}

function resetGameCompletely() {
  try { if (ipcRenderer) ipcRenderer.send('skip-save-on-quit'); } catch {}
  try {
    if (ipcRenderer) {
      ipcRenderer.send('set-game-state', {});
    } else {
      removeItem('gameState');
    }
  } catch {}
  localStorage.clear();
  sessionStorage.clear();

  // Borrar IndexedDB
  if (indexedDB?.databases) {
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => indexedDB.deleteDatabase(db.name));
    });
  }

  // Borrar caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }

  // Borrar cookies (opcional)
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
  });

  // Solicitar reinicio completo al proceso principal
  if (ipcRenderer && ipcRenderer.send) {
    ipcRenderer.send('reset-everything');
  } else {
    location.reload();
  }
}

const GM_BASE_REWARD = 10000;
const GM_DURATION_MS = 8 * 60 * 60 * 1000;
const GM_DESCRIPTIONS = [
  "Escort traders through the canyon.",
  "Investigate ruins near the valley.",
  "Guard the eastern bridge at night.",
  "Scout the northern border for threats.",
  "Clear the forest path for caravans.",
  "Assist villagers with fortifications.",
  "Recover relics from the old shrine."
];

function randomDesc() {
  return GM_DESCRIPTIONS[Math.floor(Math.random() * GM_DESCRIPTIONS.length)];
}

function ensureDescriptions() {
  state.groupMissions.forEach(m => {
    if (!m.description) m.description = randomDesc();
  });
}

function getAllHeroes() {
  return state.heroes || [];
}

function heroHasFullEnergy(h) {
  const e = (h.energyPercent ?? h.energy ?? h.energia ?? h.stamina ?? 0);
  return Number(e) >= 100;
}

function setHeroesBusy(heroIds, busy) {
  const map = new Set(heroIds);
  for (const h of getAllHeroes()) {
    const id = h.id != null ? String(h.id) : h.name;
    if (map.has(id)) {
      h.busy = !!busy;
      if (busy) h.status = 'Busy';
      else if (h.status === 'Busy') delete h.status;
    }
  }
}

function isHeroBusy(heroId) {
  // Verificar si está en special builder slots (builders 1-8)
  if (state?.specialBuilderSlots) {
    const busyInBuilder = state.specialBuilderSlots.some(slot => 
      slot.assignedHeroId === heroId && (slot.status === 'running' || slot.status === 'completed')
    );
    if (busyInBuilder) return true;
  }
  
  if (state?.builder?.current?.heroId === heroId) return true;
  
  // Verificar si está en Missions individuales
  if (state?.missions) {
    const busyInMission = state.missions.some(mission => 
      mission.heroId === heroId && mission.heroId !== null
    );
    if (busyInMission) return true;
  }
  
  // Verificar si está en Group Missions
  for (const gm of state.groupMissions || []) {
    if (gm?.started && Array.isArray(gm.heroIds) && gm.heroIds.includes(heroId)) return true;
  }
  
  // Verificar si está en Daily Missions
  if (state?.dailyMissions) {
    for (const day in state.dailyMissions) {
      const daySlots = state.dailyMissions[day];
      if (Array.isArray(daySlots)) {
        const busyInDailyMission = daySlots.some(slot => 
          slot.heroId === heroId && slot.heroId !== null
        );
        if (busyInDailyMission) return true;
      }
    }
  }
  
  const timers = state?.timers || [];
  if (timers.some(t => !t.completed && !t.paused && t.heroId === heroId)) return true;
  return false;
}

function getHeroOrigin(h) {
  return (h.origin || h.faction || h.race || '').toString().trim().toLowerCase();
}

function getGroupMissionHoursRemaining(gm) {
  if (gm.status !== 'running' || !gm.endAt) return 0;
  const now = Date.now();
  const remaining = Math.max(0, gm.endAt - now);
  return Math.ceil(remaining / (60 * 60 * 1000)); // Convertir a horas y redondear hacia arriba
}

function getEligibleHeroes() {
  return (state.heroes || []).filter(h => {
    // Verificar energía (diferentes propiedades posibles)
    const hasEnergy = 
      h.energia === 100 ||           // Propiedad principal
      h.energy === 100 ||            // Propiedad alternativa
      h.energyPct === 100 ||         // Porcentaje de energía
      h.energyPercent === 100 ||     // Porcentaje alternativo
      (h.energy?.current === h.energy?.max && h.energy?.max > 0); // Objeto energía
    
    return hasEnergy && !isHeroBusy(h.id);
  });
}

function renderGroupMissionCard(missionIndex) {
  const gm = state.groupMissions[missionIndex];
  const groupId = missionIndex + 1;
  const gmState = {};
  state.groupMissions.forEach((m, idx) => (gmState[idx + 1] = m));
  const canStartMission = canStart(groupId, gmState);
  const missingPrereq = canStartMission ? null : firstMissingPrereq(groupId, gmState);
  const chosen = new Set(gm.heroIds.filter(Boolean));
  
  // Obtener héroes elegibles (ya filtrados por isHeroBusy en getEligibleHeroes)
  const allEligible = getEligibleHeroes();

  const cardEl = document.querySelector(`#gm-card-${missionIndex}`);
  if (!cardEl) return;
  cardEl.innerHTML = '';

  // Verificar si todos los héroes seleccionados tienen el mismo origin
  const selectedHeroes = gm.heroIds
    .filter(Boolean)
    .map(id => state.heroes.find(h => h.id === id))
    .filter(Boolean);
  
  const hasAllHeroesSelected = selectedHeroes.length === 5;
  const allSameOrigin = hasAllHeroesSelected && 
    selectedHeroes.every(h => getHeroOrigin(h) === getHeroOrigin(selectedHeroes[0]));

  // Aplicar color dorado si todos los héroes tienen el mismo origin
  if (allSameOrigin) {
    cardEl.style.backgroundColor = '#FFD700'; // Dorado
    cardEl.style.borderColor = '#FFA500'; // Naranja para el borde
  } else {
    cardEl.style.backgroundColor = ''; // Reset al color original
    cardEl.style.borderColor = ''; // Reset al borde original
  }

  const title = document.createElement('h3');
  title.textContent = `GroupMission${missionIndex + 1}`;
  cardEl.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'group-desc';
  desc.textContent = gm.description;
  cardEl.appendChild(desc);

  const slots = document.createElement('div');
  slots.className = 'hero-slots';
  gm.heroIds.forEach((heroId, slotIndex) => {
    const select = document.createElement('select');
    select.id = `gm${missionIndex}-slot${slotIndex}`;

    const optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '— Select hero —';
    select.appendChild(optEmpty);

    // Si la misión está en curso o completada, mostrar solo el héroe seleccionado
    if (gm.status === 'running' || gm.status === 'completed') {
      if (heroId) {
        const selectedHero = state.heroes.find(h => h.id === heroId);
        if (selectedHero) {
          const opt = document.createElement('option');
          opt.value = String(selectedHero.id);
          const heroOrigin = getHeroOrigin(selectedHero);
          const originDisplay = heroOrigin.charAt(0).toUpperCase() + heroOrigin.slice(1);
          opt.textContent = `${selectedHero.name} [${originDisplay}]`;
          opt.selected = true;
          select.appendChild(opt);
        }
      }
      select.disabled = true;
      select.classList.add('is-locked');
      select.title = gm.status === 'running' ? 'Mission in progress' : 'Mission completed';
    } else {
      // Filtrar héroes disponibles y ordenar por origin alfabéticamente
      const options = allEligible
        .filter(h => !chosen.has(h.id) || h.id === heroId)
        .sort((a, b) => {
          const originA = getHeroOrigin(a);
          const originB = getHeroOrigin(b);
          return originA.localeCompare(originB);
        });

      options.forEach(h => {
        const opt = document.createElement('option');
        opt.value = String(h.id);
        // Cambiar formato de [Nombre héroe] (Lv.X) a [Nombre héroe] [(Origin héroe)]
        const heroOrigin = getHeroOrigin(h);
        const originDisplay = heroOrigin.charAt(0).toUpperCase() + heroOrigin.slice(1); // Capitalizar primera letra
        opt.textContent = `${h.name} [${originDisplay}]`;
        if (heroId === h.id) opt.selected = true;
        select.appendChild(opt);
      });

      if (!canStartMission) {
        select.disabled = true;
        select.classList.add('is-locked');
        if (missingPrereq != null) {
          select.title = `Locked: inicia primero GroupMission ${missingPrereq}.`;
        }
      }
    }

    select.onchange = () => {
      const val = select.value ? parseInt(select.value, 10) : null;
      const prev = gm.heroIds[slotIndex];
      if (prev && chosen.has(prev)) chosen.delete(prev);
      gm.heroIds[slotIndex] = val;
      if (val) chosen.add(val);
      renderGroupMissionCard(missionIndex);
      scheduleSaveGame?.();
    };

    slots.appendChild(select);
  });
  cardEl.appendChild(slots);

  const footer = document.createElement('div');
  footer.className = 'group-footer';

  const info = document.createElement('div');
  info.className = 'group-info';
  // Mostrar recompensa base o bonus si todos los héroes tienen el mismo origin
  const baseReward = allSameOrigin ? 20000 : GM_BASE_REWARD;
  const rewardText = allSameOrigin ? `${baseReward} Gold (Bonus: Same Origin!)` : `${baseReward} Gold`;
  info.innerHTML = `${rewardText} — Energy: 100%`;
  footer.appendChild(info);

  const btnStart = document.createElement('button');
  btnStart.className = 'gm-start';
  btnStart.textContent = 'Start mission';
  const invalid = gm.heroIds.some(id => !id || isHeroBusy(id)) || gm.status !== 'idle';
  btnStart.disabled = invalid || !canStartMission;
  if (!canStartMission) {
    btnStart.classList.add('is-locked');
    if (missingPrereq != null) {
      btnStart.title = `Locked: inicia primero GroupMission ${missingPrereq}.`;
    }
    const lock = document.createElement('span');
    lock.textContent = ' 🔒';
    btnStart.appendChild(lock);
  }
  btnStart.onclick = () => {
    const gmStateNow = {};
    state.groupMissions.forEach((m, idx) => (gmStateNow[idx + 1] = m));
    if (!canStart(groupId, gmStateNow)) {
      const miss = firstMissingPrereq(groupId, gmStateNow);
      showToast(`No puedes iniciar GroupMission ${groupId}. Debes iniciar antes GroupMission ${miss}.`);
      return;
    }
    if (gm.heroIds.some(id => !id || isHeroBusy(id))) return;
    gm.started = true;
    gm.status = 'running';
    gm.startAt = Date.now();
    gm.endAt = gm.startAt + GM_DURATION_MS;
    gm.rewardApplied = false;
    const origins = gm.heroIds
      .map(id => (state.heroes || []).find(h => h.id === id))
      .filter(Boolean)
      .map(getHeroOrigin)
      .filter(Boolean);
    gm.sameOriginBonus = origins.length === 5 && origins.every(o => o === origins[0]);
    setHeroesBusy(gm.heroIds.filter(Boolean), true);
    renderGroupMissions();
    scheduleSaveGame?.();
  };
  footer.appendChild(btnStart);

  const btnCancel = document.createElement('button');
  btnCancel.className = 'gm-cancel';
  
  // Cambiar texto y funcionalidad según el estado de la misión
  if (gm.status === 'completed' && !gm.rewardApplied) {
    btnCancel.textContent = 'Collect Reward';
    btnCancel.onclick = () => {
      // Aplicar recompensa si no se ha aplicado
      if (!gm.rewardApplied) {
        const reward = gm.sameOriginBonus ? 20000 : GM_BASE_REWARD;
        addGoldToTotal(reward);
        gm.rewardApplied = true;
        
        // Mostrar mensaje de recompensa
        const rewardMessage = gm.sameOriginBonus ? 
          `¡Recompensa recolectada! +${reward} Gold (Bonus por mismo origin!)` : 
          `¡Recompensa recolectada! +${reward} Gold`;
        showToast(rewardMessage);
        
        // Liberar héroes y resetear misión
        setHeroesBusy(gm.heroIds.filter(Boolean), false);
        gm.heroIds = [null, null, null, null, null];
        gm.started = false;
        gm.status = 'idle';
        gm.startAt = gm.endAt = null;
        gm.sameOriginBonus = false;
        renderGroupMissions();
        scheduleSaveGame?.();
      }
    };
  } else {
    btnCancel.textContent = 'Cancel mission';
    btnCancel.onclick = () => {
      if (gm.started) setHeroesBusy(gm.heroIds.filter(Boolean), false);
      gm.heroIds = [null, null, null, null, null];
      gm.started = false;
      gm.status = 'idle';
      gm.startAt = gm.endAt = null;
      gm.sameOriginBonus = false;
      gm.rewardApplied = false;
      renderGroupMissions();
      scheduleSaveGame?.();
    };
  }
  footer.appendChild(btnCancel);

  const status = document.createElement('div');
  status.className = 'group-status group-muted';
  if (gm.status === 'running') {
    const hoursRemaining = getGroupMissionHoursRemaining(gm);
    if (hoursRemaining > 0) {
      status.textContent = `${hoursRemaining}H`;
    } else {
      status.innerHTML = '<b>Completed!</b>';
    }
  } else if (gm.status === 'completed') {
    status.innerHTML = '<b>Completed!</b>';
  } else {
    status.textContent = '';
  }
  footer.appendChild(status);

  cardEl.appendChild(footer);

  const xBtn = document.createElement('div');
  xBtn.className = 'group-x';
  xBtn.textContent = '×';
  xBtn.title = 'Reset GroupMission';
  xBtn.onclick = () => {
    if (gm.started) setHeroesBusy(gm.heroIds.filter(Boolean), false);
    gm.heroIds = [null, null, null, null, null];
    gm.started = false;
    gm.status = 'idle';
    gm.startAt = gm.endAt = null;
    gm.sameOriginBonus = false;
    gm.rewardApplied = false;
    gm.description = randomDesc();
    renderGroupMissions();
    scheduleSaveGame?.();
  };
  cardEl.appendChild(xBtn);


}

function renderGroupMissions() {
  ensureDescriptions();
  const wrap = document.getElementById('group-mission-grid');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.groupMissions.forEach((_, idx) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.id = `gm-card-${idx}`;
    wrap.appendChild(card);
    renderGroupMissionCard(idx);
  });
}

// Función de diagnóstico para depurar misiones
function debugMissions() {
  console.log('🔍 ===== DIAGNÓSTICO DE MISIONES =====');
  console.log('Hora actual:', new Date().toLocaleString());
  console.log('Timestamp actual:', Date.now());
  
  state.missions.forEach(slot => {
    if (slot.heroId) {
      const hero = getHeroById(slot.heroId);
      console.log(`\n📋 Misión ${slot.id}:`);
      console.log('  - Héroe:', hero?.name || 'No encontrado');
      console.log('  - status:', slot.status);
      console.log('  - completed:', slot.completed);
      console.log('  - rewardApplied:', slot.rewardApplied);
      console.log('  - startedAt:', slot.startedAt);
      console.log('  - endAt:', slot.endAt);
      console.log('  - durationMs:', slot.durationMs);
      
      if (slot.endAt) {
        const end = Date.parse(slot.endAt);
        const now = Date.now();
        const diff = end - now;
        console.log('  - Tiempo fin:', new Date(end).toLocaleString());
        console.log('  - Diferencia (ms):', diff);
        console.log('  - ¿Debería completarse?:', diff <= 0 ? '✅ SÍ' : '❌ NO (faltan ' + Math.ceil(diff / 60000) + ' min)');
      } else if (slot.startedAt && slot.durationMs) {
        const start = Date.parse(slot.startedAt);
        const end = start + slot.durationMs;
        const now = Date.now();
        const diff = end - now;
        console.log('  - ⚠️ NO TIENE endAt (formato antiguo)');
        console.log('  - Inicio calculado:', new Date(start).toLocaleString());
        console.log('  - Fin calculado:', new Date(end).toLocaleString());
        console.log('  - ¿Debería completarse?:', diff <= 0 ? '✅ SÍ' : '❌ NO');
      } else {
        console.log('  - ⚠️ DATOS INCOMPLETOS - no se puede determinar fin');
      }
      
      if (hero) {
        console.log('  - hero.missionTime:', hero.missionTime);
        console.log('  - hero.missionStartTime:', hero.missionStartTime);
        console.log('  - hero.missionDuration:', hero.missionDuration);
      }
    }
  });
  
  console.log('\n🔍 ===== FIN DIAGNÓSTICO =====\n');
}

// Función para forzar la verificación y completación de misiones
function forceCheckAndCompleteMissions() {
  console.log('🚀 ===== FORZANDO VERIFICACIÓN DE MISIONES =====');
  
  // Primero ejecutar diagnóstico
  debugMissions();
  
  // Ahora forzar verificación
  console.log('\n⚡ Forzando verificación...\n');
  checkMissions();
  
  console.log('\n✅ Verificación forzada completada');
  console.log('🔄 Ejecuta debugMissions() nuevamente para ver los cambios\n');
}

// Hacer disponibles globalmente para debug
window.debugMissions = debugMissions;
window.forceCheckAndCompleteMissions = forceCheckAndCompleteMissions;
window.checkMissions = checkMissions;

// Función de verificación de misiones individuales (modelo Special Builder)
function checkMissions() {
  const now = Date.now();
  let changed = false;
  
  console.log('🔄 Ejecutando checkMissions() - Hora:', new Date().toLocaleString());
  
  // Verificar misiones individuales (1-21)
  state.missions.forEach(slot => {
    // Normalizar estado de misiones antiguas
    if (slot.heroId && slot.endAt && !slot.status) {
      slot.status = 'running';
    }
    
    // Verificar si la misión tiene un héroe asignado y tiempo de finalización
    if (slot.heroId && slot.endAt) {
      const end = Date.parse(slot.endAt);
      const hero = getHeroById(slot.heroId);
      
      // Si ya pasó el tiempo de finalización, marcar como completada
      if (end <= now) {
        // Marcar como completada pero NO aplicar recompensa aún (igual que group missions)
        if (slot.status !== 'completed' && !slot.completed) {
          console.log(`✅ Misión ${slot.id} completada automáticamente - Hora fin: ${new Date(end).toLocaleString()}, Hora actual: ${new Date(now).toLocaleString()}`);
          slot.status = 'completed';
          slot.completed = true;
          slot.rewardApplied = false; // La recompensa se aplicará al hacer click en "Collect Reward"
          
          // NO liberar al héroe aún, NO aplicar recompensas aún
          // Solo limpiar los tiempos para la UI
          if (hero) {
            hero.missionTime = 0;
            hero.missionStartTime = 0;
            hero.missionDuration = 0;
          }
          changed = true;
        }
      } else if (hero && slot.status === 'running') {
        // Actualizar tiempo restante en el héroe para la UI
        const remainingMs = end - now;
        hero.missionTime = Math.max(0, Math.ceil(remainingMs / 1000));
      }
    }
    
    // Verificar misiones con startedAt pero sin endAt (migración de formato antiguo)
    if (slot.heroId && slot.startedAt && !slot.endAt && slot.durationMs) {
      const start = Date.parse(slot.startedAt);
      const end = start + slot.durationMs;
      slot.endAt = new Date(end).toISOString();
      console.log(`🔧 Misión ${slot.id} migrada - endAt establecido a: ${slot.endAt}`);
      changed = true;
      
      // Ahora verificar si ya debería estar completada
      if (end <= now && slot.status !== 'completed' && !slot.completed) {
        console.log(`✅ Misión ${slot.id} completada automáticamente (después de migración)`);
        slot.status = 'completed';
        slot.completed = true;
        slot.rewardApplied = false;
        const hero = getHeroById(slot.heroId);
        if (hero) {
          hero.missionTime = 0;
          hero.missionStartTime = 0;
          hero.missionDuration = 0;
        }
      }
    }
  });
  
  // Verificar misiones diarias
  Object.values(state.dailyMissions).forEach(daySlots => {
    daySlots.forEach(slot => {
      // Normalizar estado de misiones antiguas
      if (slot.heroId && slot.endAt && !slot.status) {
        slot.status = 'running';
      }
      
      if (slot.heroId && slot.endAt) {
        const end = Date.parse(slot.endAt);
        const hero = getHeroById(slot.heroId);
        
        if (end <= now) {
          // Marcar como completada pero NO aplicar recompensa aún
          if (slot.status !== 'completed' && !slot.completed) {
            console.log(`✅ Misión diaria ${slot.id} completada automáticamente`);
            slot.status = 'completed';
            slot.completed = true;
            slot.completedWeek = getWeekKey(new Date());
            slot.completedHeroId = hero?.id || null;
            slot.rewardApplied = false;
            
            // NO liberar al héroe aún, NO aplicar recompensas aún
            if (hero) {
              hero.missionTime = 0;
              hero.missionStartTime = 0;
              hero.missionDuration = 0;
            }
            changed = true;
          }
        } else if (hero && slot.status === 'running') {
          // Actualizar tiempo restante en el héroe para la UI
          const remainingMs = end - now;
          hero.missionTime = Math.max(0, Math.ceil(remainingMs / 1000));
        }
      }
      
      // Verificar misiones con startedAt pero sin endAt
      if (slot.heroId && slot.startedAt && !slot.endAt && slot.durationMs) {
        const start = Date.parse(slot.startedAt);
        const end = start + slot.durationMs;
        slot.endAt = new Date(end).toISOString();
        console.log(`🔧 Misión diaria ${slot.id} migrada - endAt establecido`);
        changed = true;
        
        if (end <= now && slot.status !== 'completed' && !slot.completed) {
          console.log(`✅ Misión diaria ${slot.id} completada automáticamente (después de migración)`);
          slot.status = 'completed';
          slot.completed = true;
          slot.completedWeek = getWeekKey(new Date());
          slot.completedHeroId = getHeroById(slot.heroId)?.id || null;
          slot.rewardApplied = false;
          const hero = getHeroById(slot.heroId);
          if (hero) {
            hero.missionTime = 0;
            hero.missionStartTime = 0;
            hero.missionDuration = 0;
          }
        }
      }
    });
  });
  
  if (changed) {
    console.log('✅ checkMissions() completó con cambios - guardando y renderizando');
    renderMissions();
    renderDailyMissions();
    renderHeroesIfVisible();
    scheduleSaveGame();
  } else {
    console.log('ℹ️ checkMissions() completó sin cambios');
  }
}

// Función para recolectar recompensa de misión individual
export function collectMissionReward(slot) {
  if (!slot || slot.status !== 'completed' || slot.rewardApplied) return;
  
  const hero = getHeroById(slot.heroId);
  if (!hero) return;
  
  // Aplicar recompensas
  state.money += slot.expReward;
  addHeroExp(hero, slot.expReward);
  
  // Reducir energía del héroe
  const energyLoss = missionEnergyCost(slot.id);
  hero.energia = Math.max(0, hero.energia - energyLoss);
  autoStartRest(hero);
  
  // Mostrar mensaje de recompensa
  showToast(`¡Misión completada! +${slot.expReward} Gold`);
  
  // Marcar recompensa como aplicada y limpiar misión
  slot.rewardApplied = true;
  slot.heroId = null;
  slot.completed = false;
  slot.status = 'idle';
  slot.startedAt = null;
  slot.endAt = null;
  slot.durationMs = 0;
  slot.description = missionDescriptions[Math.floor(Math.random() * missionDescriptions.length)];
  
  // Actualizar UI y guardar
  updateResourcesDisplay();
  renderMissions();
  renderHeroesIfVisible();
  scheduleSaveGame();
}

// Función para recolectar recompensa de misión diaria
export function collectDailyMissionReward(slot) {
  if (!slot || slot.status !== 'completed' || slot.rewardApplied) return;
  
  const hero = getHeroById(slot.heroId);
  if (!hero) return;
  
  // Aplicar recompensas
  state.money += 5000;
  addHeroExp(hero, 5000);
  
  // Reducir energía del héroe
  hero.energia = Math.max(0, hero.energia - 50);
  autoStartRest(hero);
  
  // Mostrar mensaje de recompensa
  showToast('¡Misión diaria completada! +5000 Gold');
  
  // Marcar recompensa como aplicada y limpiar misión
  slot.rewardApplied = true;
  slot.heroId = null;
  slot.status = 'idle';
  slot.startedAt = null;
  slot.endAt = null;
  slot.durationMs = 0;
  
  // Actualizar UI y guardar
  updateResourcesDisplay();
  renderDailyMissions();
  renderHeroesIfVisible();
  scheduleSaveGame();
}

function tickGroupMissions() {
  const now = Date.now();
  let changed = false;
  
  for (const m of (state.groupMissions || [])) {
    if (m.status === 'running' && m.endAt && now >= m.endAt) {
      m.status = 'completed';
      m.started = false;
      // NO aplicar recompensa automáticamente - dejar que el usuario la recolecte
      // Solo restaurar energía de los héroes
      for (const id of m.heroIds.filter(Boolean)) {
        const h = getAllHeroes().find(x => (x.id != null ? String(x.id) : x.name) === id);
        if (h) {
          // Restaurar energía completa al completar la misión
          if ('energyPercent' in h) h.energyPercent = 100;
          if ('energy' in h) h.energy = 100;
          if ('stamina' in h) h.stamina = 100;
          if ('energia' in h) h.energia = 100;
        }
      }
      changed = true;
    }
  }
  
  if (changed) {
    saveGame?.();
    if (document.getElementById('group-mission-grid')) {
      renderGroupMissions();
    }
  }
}

// Función unificada para verificar todos los tipos de misiones cada 30 minutos
function checkAllMissions() {
  checkMissions();
  tickGroupMissions();
}

// checkAllMissions se ejecutará después de inicializar el estado

function setupPetEventListeners() {
  const petSearchInput = document.getElementById("pet-search");
  if (petSearchInput) {
    petSearchInput.oninput = e => {
      const q = e.target.value.toLowerCase();
      const list = document.getElementById("pet-search-list");
      if (list) {
        const names = [...new Set(state.heroes.filter(h => h.pet).map(h => h.pet || "").filter(n => n.toLowerCase().includes(q)))]
          .sort((a,b)=>a.localeCompare(b));
        list.innerHTML = names.map(n => `<option value="${n}"></option>`).join("");
      }
    };
    const applyPetSearch = () => {
      petFilterSearch = petSearchInput.value.trim() || null;
      currentPetPage = 1;
      renderPets();
      updatePetControls();
    };
    petSearchInput.addEventListener('change', applyPetSearch);
    petSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyPetSearch(); });
  }

  const petSortLevelBtn = document.getElementById("pet-sort-level-btn");
  if (petSortLevelBtn) petSortLevelBtn.onclick = () => {
    if (petSort === "level") {
      petSortAsc = !petSortAsc;
    } else {
      petSort = "level";
      petSortAsc = false;
    }
    currentPetPage = 1;
    renderPets();
  };
  const petSortNameBtn = document.getElementById("pet-sort-name-btn");
  if (petSortNameBtn) petSortNameBtn.onclick = () => {
    if (petSort === "name") {
      petSortAsc = !petSortAsc;
    } else {
      petSort = "name";
      petSortAsc = true;
    }
    currentPetPage = 1;
    renderPets();
  };
  const petOriginSel = document.getElementById("pet-origin-filter");
  if (petOriginSel) petOriginSel.onchange = e => {
    petFilterOrigin = e.target.value || null;
    currentPetPage = 1;
    renderPets();
    updatePetControls();
  };
  const petFavCheck = document.getElementById("pet-favorite-check");
  if (petFavCheck) petFavCheck.onchange = e => {
    if (currentView === "profiles") return;
    petFilterFavorites = e.target.checked;
    currentPetPage = 1;
    renderPets();
    updatePetControls();
  };
  const petRemoveBtn = document.getElementById("pet-remove-filter-btn");
  if (petRemoveBtn) petRemoveBtn.onclick = () => {
    petFilterOrigin = null;
    petFilterSearch = null;
    petSort = "name";
    petSortAsc = true;
    currentPetPage = 1;
    renderPets();
    updatePetControls();
  };
}

async function init() {
  // Remove any stray overlays that might block interaction
  document.querySelectorAll('.modal-overlay, .sy-modal-overlay').forEach(el => el.remove());
  document.body.classList.remove('body--lock-scroll');
  
  await loadExpTables();
  await loadGame();
  
  // Inicializar y normalizar datos de estado después de cargar el juego
  initializeStateData();
  
  // Ahora que el estado está inicializado, verificar todas las misiones
  checkAllMissions();
  setInterval(checkAllMissions, 30 * MIN); // Cada 30 minutos (modelo simplificado)
  
  cleanupFightIntrudersDaily();
  renderDailyMissions();
  if ("serviceWorker" in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register("sw.js").catch(err => console.error("SW registration failed", err));
  }
  connectSocket();
  preloadAudio(["src/arrow.mp3", "src/fireball.mp3", "src/sword.mp3", "src/vanish.mp3", "src/VictorySound.mp3", "src/LosingSound.mp3"]);
  setProgressCallback(progress => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'progress', id: clientId, progress }));
    }
  });
  updateResourcesDisplay();
  renderVillageChief();
  renderTerrains();
  renderVillage();
  initSpecialBuilderAssignment();
  scheduleRenderHeroes();
  renderMissions();
  renderGroupMissions();
  tickGroupMissions(); // Verificar estado de misiones al cargar
  renderPetManagement();
  renderGames();
  renderTutorial();
  renderSettings();

  resumeAllActivities();
  lastUpdate = Date.now();
  requestAnimationFrame(centralGameLoop);
  onVisibilityChanged(false);

  function handleVisibility(hidden = document.hidden) {
    if (hidden) {
      hiddenSince = Date.now();
      if (typeof gc === 'function') setTimeout(() => gc(), 0);
      pauseGame();
      onVisibilityChanged(true);
    } else {
      if (hiddenSince) {
        const diff = Math.floor((Date.now() - hiddenSince) / 1000);
        hiddenSince = null;
        applyHiddenTime(diff);
      }
      lastUpdate = Date.now();
      resumeGame();
      onVisibilityChanged(false);
    }
  }

  document.addEventListener('visibilitychange', () => handleVisibility(document.hidden));
  if (ipcRenderer && ipcRenderer.on) {
    ipcRenderer.on('app-visibility', (_e, data) => handleVisibility(data.hidden));
  }

  if (state.autoClickActive) {
    startAutoClick();
    showChiefExtra("Autoclick enabled", () => {
      toggleAutoClick();
    });
  }

  updateHeroControls();
  updatePetControls();
  showView("home");

  // Los event listeners de héroes se asignan dinámicamente cuando se crean los controles

  setupPetEventListeners();

  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.onclick = exportSave;
  const importBtn = document.getElementById("import-btn");
  if (importBtn) importBtn.onclick = importSave;

  const shareBtn = document.getElementById("share-btn");
  const shareStatus = document.getElementById("share-status");
  if (shareBtn && shareStatus) {
    shareBtn.onclick = () => {
      const confirmMsg = profilePublic ?
        "Make profile private?" : "Share profile publicly?";
      openConfirm({
        message: confirmMsg,
        onConfirm: () => {
          profilePublic = !profilePublic;
          shareStatus.textContent = profilePublic ? "Public" : "Private";
          shareBtn.textContent = profilePublic ? "Hide" : "Share";
        }
      });
    };
  }

  const logoutMain = document.getElementById("logout-btn-main");
  if (logoutMain) logoutMain.onclick = () => {
    openConfirm({
      message: 'Do you want to export your save before exiting?',
      onConfirm: async () => {
        await exportSave();
        window.location.href = 'login.html';
      },
      onCancel: () => { window.location.href = 'login.html'; }
    });
  };
  const logoutShare = document.getElementById("logout-btn-share");
  if (logoutShare) logoutShare.onclick = () => {
    openConfirm({
      message: 'Do you want to export your save before exiting?',
      onConfirm: async () => {
        await exportSave();
        window.location.href = 'login.html';
      },
      onCancel: () => { window.location.href = 'login.html'; }
    });
  };




  document.getElementById("reset-btn").onclick = () => {
    openConfirm({
      message: "Are you sure you want to reset the game?",
      onConfirm: performReset,
      onCancel: () => {}
    });
  };

  if (ipcRenderer) {
    ipcRenderer.on('request-close', () => {
      const cont = document.querySelector('.content');
      const sx = cont ? cont.scrollLeft : 0;
      const sy = cont ? cont.scrollTop : 0;
      pauseTimers();
      lockPartnerImage = true;
      const pImg = document.getElementById('partner-img');
      if (pImg) pImg.style.pointerEvents = 'none';
      openConfirm({
        message: 'Do you want to save the game before closing?',
        onReturn: () => {
          const img = document.getElementById('partner-img');
          if (img) img.style.pointerEvents = '';
          lockPartnerImage = false;
          resumeTimers();
        },
        onConfirm: () => {
          saveGame();
          try {
            localStorage.removeItem('offlineMode');
          } catch {}
          ipcRenderer.send('close-approved');
        },
        onCancel: () => {
          try {
            localStorage.removeItem('offlineMode');
          } catch {}
          ipcRenderer.send('close-approved');
        }
      });
      if (cont) cont.scrollTo(sx, sy);
    });
  } else {
    window.addEventListener('beforeunload', () => {
      if (confirm('Do you want to save the game before closing?\n\nYes: Save and exit\nNo: Exit without saving')) {
        saveGame();
      }
      try {
        localStorage.removeItem('offlineMode');
      } catch {}
    });
  }

  // reveal UI once everything is ready
  document.body.classList.remove("loading");
}

// allow requiring this file in Node tests without running the game
const api = {
  init,
  saveGame,
  updateResourcesDisplay,
  updateHeroControls,
  expNeededForLevel,
  addHeroExp,
  addPetExp,
  createHero,
  updateAutoClickTimer,
  fortuneAvailable,
  bossRushAvailable,
  startAutoClick,
  stopAutoClick,
  toggleAutoClick,
  renderVillageChief,
  renderVillage,
  renderTerrains,
  showChiefExtra,
  showVillageExtra,
  showBuildModal,
  showUpgradeModal,
  showSilenceTempleModal,
  showPomodoroTowerModal,
  getBuildHouseTooltip,
  getUpgradeRequirements,
  getUpgradeTooltip,
  buildHouse,
  resumeBuild,
  resumeUpgrades,
  cancelBuild,
  cancelUpgrade,
  showInlineBuildTimer,
  showUpgradeInlineTimer,
  updateBuildButtonHeight,
  updateAutoClickButtonHeight,
  resolveSrc,
  refreshBuildSelectionOptions,
  refreshBuildSelectionAvatars,
  renderAllCompanions,
  resumeRest,
  resumeTrain,
  resumeMission,
  resumeAllActivities,
  renderHeroes,
  renderPets,
  startMission,
  renderMissions,
  renderDailyMissions,
  renderPetManagement,
  renderGames,
  summonHero,
  showAlert,
  showBossStats,
  food: state.food,
  wood: state.wood,
  stone: state.stone,
  buildingTask: state.buildingTask,
  upgradeTasks: state.upgradeTasks,
  buildingLevels: state.buildingLevels,
  handlePendingMissions,
  updatePetControls,
  showView,
  exportSave,
  importSave,
  importHeroDataFromJSON,
  buyTerrain,
  showResourceShop,
  showGamesShop,
  downloadImage,
  terrain: state.terrain,
  MAX_PETS,
  MAX_TERRAIN: state.MAX_TERRAIN,
  MAX_LEVEL,
  CHIEF_MAX_LEVEL,
  PARTNER_MAX_LEVEL,
  MAX_STATS,
  CHIEF_MAX_STATS,
  missionEnergyCost,
  formatMissionTime,
  removeTimer,
  updateMaxLevelsFromCastle,
    GAME_SOURCES,
    GAME_ASSETS,
    preloadMinigameAssets,
  renderTutorial,
  openHeroPicker,
  assignHeroToSlot,
  cancelAssignment,
  openImproveModal,
  confirmImprove,
  levelUp,
  init
};

// Population tabs management
let currentPopulationTab = null;
let populationOriginalParents = {};
let populationInitialized = false;
let populationSectionsClones = {};

function updatePopulationInfo() {
  const populationInfo = document.getElementById('population-info');
  if (!populationInfo) return;
  
  const heroesCount = state.heroes.length;
  const petsCount = state.heroes.filter(h => h.pet).length;
  
  populationInfo.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
      <span style="color: #2563eb;">Heroes: ${heroesCount}</span> | 
      <span style="color: #16a34a;">Pets: ${petsCount}</span>
    </div>
    <div style="font-size: 14px; color: #666;">
      Click on the buttons below to view Heroes or Pets.
    </div>
  `;
}

function initPopulationView() {
  // Guardar clones de las secciones originales
  if (!populationSectionsClones.pets) {
    const petsSection = document.getElementById("pets-section");
    const petManagementSection = document.getElementById("pet-management-section");
    
    if (petsSection) {
      populationSectionsClones.pets = petsSection.cloneNode(true);
      populationOriginalParents.pets = petsSection.parentNode;
    }
    if (petManagementSection) {
      populationSectionsClones.petManagement = petManagementSection.cloneNode(true);
      populationOriginalParents.petManagement = petManagementSection.parentNode;
    }
    
    const chiefPopDiv = document.getElementById("chief-population");
    const homePopCard = chiefPopDiv ? chiefPopDiv.querySelector('.card') : null;
    if (homePopCard) {
      populationOriginalParents.homePopCardParent = homePopCard.parentNode;
      populationOriginalParents.homePopCardEl = homePopCard;
    }
  }

  if (!populationInitialized) {
    const tabButtons = document.querySelectorAll('.population-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.populationTab;
        showPopulationTab(tab);
      });
    });
    populationInitialized = true;
  }
  
  // Resetear todos los tabs a no activos
  const tabButtons = document.querySelectorAll('.population-tab');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Limpiar contenido
  const populationContent = document.getElementById("population-content");
  if (populationContent) {
    populationContent.innerHTML = '';
  }
  
  updatePopulationInfo();
  // No mostrar ningún tab por defecto
}

function assignHeroEventListeners() {
  const sortLevelBtn = document.getElementById("sort-level-btn");
  if (sortLevelBtn) sortLevelBtn.onclick = () => {
    if (heroSort === "level") {
      heroSortAsc = !heroSortAsc;
    } else {
      heroSort = "level";
      heroSortAsc = false;
    }
    currentHeroPage = 1;
    scheduleRenderHeroes();
  };

  const sortNameBtn = document.getElementById("sort-name-btn");
  if (sortNameBtn) sortNameBtn.onclick = () => {
    if (heroSort === "name") {
      heroSortAsc = !heroSortAsc;
    } else {
      heroSort = "name";
      heroSortAsc = true;
    }
    currentHeroPage = 1;
    scheduleRenderHeroes();
  };

  const originSel = document.getElementById("origin-filter");
  if (originSel) originSel.onchange = e => {
    heroFilterOrigin = e.target.value || null;
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };

  const profSel = document.getElementById("profession-filter");
  if (profSel) profSel.onchange = e => {
    heroFilterProfession = e.target.value || null;
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };

  const favCheck = document.getElementById("favorite-check");
  if (favCheck) favCheck.onchange = e => {
    heroFilterFavorites = e.target.checked;
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };

  const readyCheck = document.getElementById("ready-check");
  if (readyCheck) readyCheck.onchange = e => {
    heroFilterReady = e.target.checked;
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };

  const sexSel = document.getElementById("sex-filter");
  if (sexSel) sexSel.onchange = e => {
    heroFilterSex = e.target.value || null;
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };

  const searchInput = document.getElementById("hero-search");
  if (searchInput) {
    searchInput.oninput = e => {
      const q = e.target.value.toLowerCase();
      const list = document.getElementById("hero-search-list");
      if (list) {
        const names = [...new Set(state.heroes.map(h => h.name || "").filter(n => n.toLowerCase().includes(q)))]
          .sort((a,b)=>a.localeCompare(b));
        list.innerHTML = names.map(n => `<option value="${n}"></option>`).join("");
      }
    };
    const applySearch = () => {
      heroFilterSearch = searchInput.value.trim() || null;
      currentHeroPage = 1;
      scheduleRenderHeroes();
      updateHeroControls();
    };
    searchInput.addEventListener('change', applySearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') applySearch(); });
  }

  const removeFilterBtn = document.getElementById("remove-filter-btn");
  if (removeFilterBtn) removeFilterBtn.onclick = () => {
    heroFilterOrigin = null;
    heroFilterProfession = null;
    heroFilterSex = null;
    heroFilterSearch = null;
    heroSort = "name";
    currentHeroPage = 1;
    scheduleRenderHeroes();
    updateHeroControls();
  };
}

function showPopulationTab(tab) {
  // Actualizar tab actual
  currentPopulationTab = tab;
  
  const tabButtons = document.querySelectorAll('.population-tab');
  tabButtons.forEach(btn => {
    if (btn.dataset.populationTab === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  const populationContent = document.getElementById("population-content");
  
  if (!populationContent) return;
  
  // Limpiar completamente el contenido
  populationContent.innerHTML = '';
  
  if (tab === "heroes") {
    // Tarjeta con borde dorado para botones de acciones
    const heroActionsCard = document.createElement('div');
    heroActionsCard.style.background = 'white';
    heroActionsCard.style.border = '2px solid #D4AF37';
    heroActionsCard.style.borderRadius = '8px';
    heroActionsCard.style.padding = '12px';
    heroActionsCard.style.marginBottom = '20px';
    heroActionsCard.style.boxShadow = '0 2px 8px rgba(212, 175, 55, 0.3)';

    // Fila de botones de órdenes: WorkOrder, CancelWork, RestOrder, CancelRest
    const ordersRow = document.createElement('div');
    ordersRow.style.display = 'flex';
    ordersRow.style.gap = '10px';
    ordersRow.style.marginBottom = '10px';

    const workOrderBtn = document.createElement('button');
    workOrderBtn.textContent = 'WorkOrder';
    workOrderBtn.className = 'btn btn-yellow';
    workOrderBtn.style.flex = '1';
    workOrderBtn.onclick = () => {
      const readyHeroes = state.heroes.filter(h =>
        h.state?.type === 'ready' &&
        !isBusy(h) &&
        h.restTime <= 0 &&
        h.energia > 0 &&
        !state.companions.includes(h.id) &&
        !state.farmers.includes(h.id) &&
        !state.lumberjacks.includes(h.id) &&
        !state.miners.includes(h.id)
      );
      readyHeroes.forEach(hero => {
        if (hero.workTime > 0) return;
        hero.workTime = 200 * TIME_MULTIPLIER;
        hero.workLastShown = hero.workTime;
        addTimer({
          id: `work_${hero.id}`,
          type: 'work',
          heroId: hero.id,
          startTime: Date.now(),
          duration: 200 * TIME_MULTIPLIER * 1000,
          paused: false,
          completed: false,
        });
      });
      saveGame();
      scheduleRenderHeroes();
    };
    ordersRow.appendChild(workOrderBtn);

    const cancelWorkBtn = document.createElement('button');
    cancelWorkBtn.textContent = 'CancelWork';
    cancelWorkBtn.className = 'btn btn-red';
    cancelWorkBtn.style.flex = '1';
    cancelWorkBtn.onclick = () => {
      state.heroes.forEach(h => {
        if (h.workTime > 0) {
          h.workTime = 0;
          h.workStartTime = 0;
          h.workLastShown = 0;
          removeTimer(`work_${h.id}`);
          h.state = { type: 'ready' };
          const timerEl = document.getElementById(`work-timer-${h.id}`);
          if (timerEl) timerEl.textContent = '';
          const btn = document.getElementById(`work-btn-${h.id}`);
          if (btn) {
            btn.textContent = 'Work';
            btn.disabled = h.energia <= 0 || isBusy(h);
          }
        }
      });
      saveGame();
      scheduleRenderHeroes();
    };
    ordersRow.appendChild(cancelWorkBtn);

    const restOrderBtn = document.createElement('button');
    restOrderBtn.textContent = 'RestOrder';
    restOrderBtn.className = 'btn btn-green';
    restOrderBtn.style.flex = '1';
    restOrderBtn.disabled = restOrderUsed;
    if (restOrderUsed) restOrderBtn.style.background = 'gray';
    restOrderBtn.onclick = () => {
      state.heroes.forEach(h => {
        if (!isBusy(h) && h.restTime <= 0 && h.energia < 100) {
          startRest(h);
          const groups = [state.companions, state.farmers, state.lumberjacks, state.miners];
          let found = false;
          groups.forEach(arr => {
            const i = arr.indexOf(h.id);
            if (i !== -1) { arr[i] = null; found = true; }
          });
          if (found && state.autoClickActive) toggleAutoClick();
        }
      });
      cancelRestUsed = false;
      restOrderUsed = true;
      saveGame();
      scheduleRenderHeroes();
      renderVillageChief();
    };
    ordersRow.appendChild(restOrderBtn);

    const cancelRestBtn = document.createElement('button');
    cancelRestBtn.textContent = 'CancelRest';
    cancelRestBtn.className = 'btn btn-red';
    cancelRestBtn.style.flex = '1';
    cancelRestBtn.disabled = cancelRestUsed;
    if (cancelRestUsed) cancelRestBtn.style.background = 'gray';
    cancelRestBtn.onclick = () => {
      state.heroes.forEach(h => {
        if (h.restTime > 0) {
          h.restTime = 0;
          h.restStartTime = 0;
          h.lastRestTick = 0;
          h.restDuration = 0;
          restingHeroes.delete(h);
          h.energyEl = null;
          h.lowEnergyEl = null;
          h.restTimerEl = null;
          removeTimer(`rest_${h.id}`);
          h.state = { type: 'ready' };
          const timerEl = document.getElementById(`rest-timer-${h.id}`);
          if (timerEl) timerEl.textContent = '';
          const btn = document.getElementById(`rest-btn-${h.id}`);
          if (btn) {
            btn.textContent = 'Rest';
            btn.disabled = h.energia >= 100 || isBusy(h);
          }
        }
      });
      restOrderUsed = false;
      cancelRestUsed = true;
      saveGame();
      scheduleRenderHeroes();
      renderVillageChief();
    };
    ordersRow.appendChild(cancelRestBtn);
    
    heroActionsCard.appendChild(ordersRow);

    // Agregar botones SummonHero y PromoteHero
    const buttonsRow = document.createElement('div');
    buttonsRow.style.display = 'flex';
    buttonsRow.style.gap = '10px';
    
    // Botón SummonHero
    const summonBtn = document.createElement('button');
    summonBtn.id = "summon-btn";
    summonBtn.className = 'btn btn-blue';
    summonBtn.textContent = `SummonHero (${summonCost} Gold)`;
    summonBtn.onclick = () => {
      console.log('🎯 SummonHero button clicked!');
      summonHero();
    };
    const noHouse = state.heroes.length >= state.houses;
    const noGoldSummon = state.money < summonCost;
    summonBtn.disabled = noHouse || noGoldSummon;
    if (summonBtn.disabled) {
      summonBtn.title = noGoldSummon ? "Not enough Gold" : "Add house to summon again";
    }
    summonBtn.style.flex = '1';
    buttonsRow.appendChild(summonBtn);
    
    heroActionsCard.appendChild(buttonsRow);
    populationContent.appendChild(heroActionsCard);

    // Crear sección completa de My Heroes
    const heroesSection = document.createElement('div');
    heroesSection.id = 'heroes-section';
    heroesSection.style.display = 'block';

    const heroesTitle = document.createElement('h1');
    heroesTitle.textContent = `My Heroes (${state.heroes.length}/${state.houses})`;
    heroesSection.appendChild(heroesTitle);

    // Controles de héroes
    const heroControls = document.createElement('div');
    heroControls.className = 'hero-controls';

    const controlsRow1 = document.createElement('div');
    controlsRow1.className = 'hero-controls-row';

    // Favorites
    const favGroup = document.createElement('div');
    favGroup.className = 'control-group';
    favGroup.setAttribute('data-icon', '⭐');
    const favLabel = document.createElement('label');
    const favCheck = document.createElement('input');
    favCheck.type = 'checkbox';
    favCheck.id = 'favorite-check';
    favLabel.appendChild(favCheck);
    favLabel.appendChild(document.createTextNode(' Favorites'));
    favGroup.appendChild(favLabel);
    controlsRow1.appendChild(favGroup);

    // Ready
    const readyGroup = document.createElement('div');
    readyGroup.className = 'control-group';
    readyGroup.setAttribute('data-icon', '✅');
    const readyLabel = document.createElement('label');
    const readyCheck = document.createElement('input');
    readyCheck.type = 'checkbox';
    readyCheck.id = 'ready-check';
    readyLabel.appendChild(readyCheck);
    readyLabel.appendChild(document.createTextNode(' Ready'));
    readyGroup.appendChild(readyLabel);
    controlsRow1.appendChild(readyGroup);

    // Order by buttons
    const orderGroup = document.createElement('div');
    orderGroup.className = 'control-group';
    orderGroup.setAttribute('data-icon', '🧭');
    const orderLabel = document.createElement('span');
    orderLabel.style.fontWeight = 'bold';
    orderLabel.style.marginRight = '4px';
    orderLabel.textContent = 'Order by:';
    orderGroup.appendChild(orderLabel);
    
    const sortNameBtn = document.createElement('button');
    sortNameBtn.id = 'sort-name-btn';
    sortNameBtn.className = 'btn btn-green';
    sortNameBtn.textContent = 'Name';
    orderGroup.appendChild(sortNameBtn);
    
    const sortLevelBtn = document.createElement('button');
    sortLevelBtn.id = 'sort-level-btn';
    sortLevelBtn.className = 'btn btn-green';
    sortLevelBtn.textContent = 'Level';
    orderGroup.appendChild(sortLevelBtn);
    controlsRow1.appendChild(orderGroup);

    // Search
    const searchGroup = document.createElement('div');
    searchGroup.className = 'control-group';
    searchGroup.setAttribute('data-icon', '🔍');
    const heroSearch = document.createElement('input');
    heroSearch.type = 'text';
    heroSearch.id = 'hero-search';
    heroSearch.setAttribute('list', 'hero-search-list');
    heroSearch.placeholder = 'Search hero';
    const heroSearchList = document.createElement('datalist');
    heroSearchList.id = 'hero-search-list';
    searchGroup.appendChild(heroSearch);
    searchGroup.appendChild(heroSearchList);
    controlsRow1.appendChild(searchGroup);

    heroControls.appendChild(controlsRow1);

    // Segunda fila de controles
    const controlsRow2 = document.createElement('div');
    controlsRow2.className = 'hero-controls-row';

    const filterGroup = document.createElement('div');
    filterGroup.className = 'control-group';
    filterGroup.setAttribute('data-icon', '🔧');
    const filterLabel = document.createElement('span');
    filterLabel.style.fontWeight = 'bold';
    filterLabel.style.marginRight = '4px';
    filterLabel.textContent = 'Filter by:';
    filterGroup.appendChild(filterLabel);

    const sexFilter = document.createElement('select');
    sexFilter.id = 'sex-filter';
    filterGroup.appendChild(sexFilter);

    const originFilter = document.createElement('select');
    originFilter.id = 'origin-filter';
    filterGroup.appendChild(originFilter);

    const professionFilter = document.createElement('select');
    professionFilter.id = 'profession-filter';
    filterGroup.appendChild(professionFilter);

    const removeFilterBtn = document.createElement('button');
    removeFilterBtn.id = 'remove-filter-btn';
    removeFilterBtn.className = 'btn btn-green';
    removeFilterBtn.style.display = 'none';
    removeFilterBtn.textContent = 'RemoveFilter';
    filterGroup.appendChild(removeFilterBtn);

    controlsRow2.appendChild(filterGroup);
    heroControls.appendChild(controlsRow2);

    heroesSection.appendChild(heroControls);

    // Contenedor de héroes
    const heroesContainer = document.createElement('div');
    heroesContainer.id = 'heroes';
    heroesSection.appendChild(heroesContainer);

    // Paginación
    const heroPagination = document.createElement('div');
    heroPagination.id = 'hero-pagination';
    heroPagination.className = 'pagination';
    heroesSection.appendChild(heroPagination);

    populationContent.appendChild(heroesSection);

    // Asignar event listeners a los controles de héroes
    assignHeroEventListeners();
    
    // Actualizar controles y renderizar
    updateHeroControls();
    setTimeout(() => {
      scheduleRenderHeroes();
    }, 0);
  } else if (tab === "pets") {
    // Usar clones frescos de las secciones originales
    if (populationSectionsClones.petManagement) {
      const freshPetManagementSection = populationSectionsClones.petManagement.cloneNode(true);
      populationContent.appendChild(freshPetManagementSection);
      freshPetManagementSection.style.display = "block";
      console.log('Llamando renderPetManagement con freshPetManagementSection:', freshPetManagementSection);
      renderPetManagement(freshPetManagementSection);
    }
    if (populationSectionsClones.pets) {
      const freshPetsSection = populationSectionsClones.pets.cloneNode(true);
      populationContent.appendChild(freshPetsSection);
      freshPetsSection.style.display = "block";
      renderPets();
    }
    // Re-asignar event listeners después de clonar
    setupPetEventListeners();
  }
}

function restorePopulationSectionsToOriginal() {
  // Limpiar completamente populationContent para evitar secciones duplicadas
  const populationContent = document.getElementById("population-content");
  if (populationContent) {
    populationContent.innerHTML = '';
  }
  
  // Resetear el tab actual
  currentPopulationTab = null;
  
  // Restaurar las secciones originales a sus padres
  if (populationOriginalParents.pets && populationSectionsClones.pets) {
    const originalPets = populationOriginalParents.pets.querySelector('#pets-section');
    if (!originalPets) {
      populationOriginalParents.pets.appendChild(populationSectionsClones.pets.cloneNode(true));
    }
  }
  if (populationOriginalParents.petManagement && populationSectionsClones.petManagement) {
    const originalPetMgmt = populationOriginalParents.petManagement.querySelector('#pet-management-section');
    if (!originalPetMgmt) {
      populationOriginalParents.petManagement.appendChild(populationSectionsClones.petManagement.cloneNode(true));
    }
  }
  
  if (populationOriginalParents.homePopCardEl && populationOriginalParents.homePopCardParent &&
      populationOriginalParents.homePopCardEl.parentNode !== populationOriginalParents.homePopCardParent) {
    populationOriginalParents.homePopCardParent.appendChild(populationOriginalParents.homePopCardEl);
  }
}

function renderPartnersInDiv(container) {
  const title = document.createElement('h1');
  title.textContent = 'Partners';
  container.appendChild(title);
  
  const card = document.createElement('div');
  card.className = 'chief-card card';
  card.style.gridTemplateColumns = '360px 1fr';
  card.style.marginBottom = '20px';
  
  const partnerSlot = document.createElement('div');
  partnerSlot.className = 'partner-slot';
  
  const partnerWrap = document.createElement('div');
  partnerWrap.className = 'avatar-wrap';
  
  const partnerImg = document.createElement('img');
  partnerImg.className = 'avatar chief-avatar';
  partnerImg.src = partner.img || EMPTY_SRC;
  partnerImg.style.objectPosition = `${partner.imgOffsetX ?? 50}% ${partner.imgOffset ?? 50}%`;
  if (!partner.img) partnerImg.classList.add('empty');
  
  partnerWrap.appendChild(partnerImg);
  partnerSlot.appendChild(partnerWrap);
  
  const partnerName = document.createElement('div');
  partnerName.className = 'partner-name';
  partnerName.textContent = partner.name || 'Partner';
  partnerSlot.appendChild(partnerName);
  
  const partnerLevel = document.createElement('div');
  partnerLevel.className = 'partner-level';
  partnerLevel.textContent = `Level: ${partner.level || 1}`;
  partnerSlot.appendChild(partnerLevel);
  
  // Agregar botones de Partner
  const partnerRow = document.createElement("div");
  partnerRow.style.display = "flex";
  partnerRow.style.gap = "4px";
  partnerRow.style.marginTop = "4px";
  partnerRow.style.width = "100%";
  
  const partnerAbBtn = document.createElement("button");
  partnerAbBtn.textContent = "P_Abilities";
  partnerAbBtn.className = "btn btn-lightred";
  partnerAbBtn.style.flex = "1";
  partnerAbBtn.style.width = "100%";
  partnerAbBtn.title = "Partner Abilities";
  partnerAbBtn.onclick = () => {
    if (!openPartnerAbilities) {
      partnerAbilitySort = 'number';
      partnerAbilityPage = 1;
    }
    openPartnerAbilities = !openPartnerAbilities;
    renderPartnersInDiv(container.parentNode || container);
  };
  partnerRow.appendChild(partnerAbBtn);
  partnerSlot.appendChild(partnerRow);
  
  const statsRow = document.createElement("div");
  statsRow.style.display = "flex";
  statsRow.style.gap = "4px";
  statsRow.style.marginTop = "4px";
  statsRow.style.width = "100%";
  
  const partnerStatsBtn = document.createElement("button");
  partnerStatsBtn.textContent = "P_Stats";
  partnerStatsBtn.className = "btn btn-lightred";
  partnerStatsBtn.style.flex = "1";
  partnerStatsBtn.title = "Partner Stats";
  partnerStatsBtn.onclick = () => {
    openPartnerStats = !openPartnerStats;
    renderPartnersInDiv(container.parentNode || container);
  };
  statsRow.appendChild(partnerStatsBtn);

  const pInvBtn = document.createElement("button");
  pInvBtn.textContent = "P_Inventory";
  pInvBtn.className = "btn btn-lightred";
  pInvBtn.style.flex = "1";
  pInvBtn.title = "Partner Inventory";
  pInvBtn.onclick = () => { 
    openPartnerInventory = !openPartnerInventory; 
    renderPartnersInDiv(container.parentNode || container); 
  };
  statsRow.appendChild(pInvBtn);
  partnerSlot.appendChild(statsRow);
  
  card.appendChild(partnerSlot);
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'info-section';
  infoDiv.innerHTML = `<strong>Partner</strong><br>Your co-lead who grows through project work.`;
  card.appendChild(infoDiv);
  
  container.appendChild(card);
  
  // Renderizar secciones expandibles
  renderPartnerAbilitiesSection(container);
  renderPartnerStatsSection(container);
  renderPartnerInventorySection(container);
}

function renderPartnerAbilitiesSection(container) {
  const partnerDiv = document.createElement("div");
  partnerDiv.className = "stats";
  partnerDiv.id = "partner-abilities";
  if (openPartnerAbilities) partnerDiv.classList.add("expand-row");
  
  const closePart = document.createElement("button");
  closePart.textContent = "❌";
  closePart.className = "close-btn";
  closePart.onclick = () => { 
    openPartnerAbilities = false; 
    renderPartnersInDiv(container);
  };
  partnerDiv.appendChild(closePart);
  
  const partTitle = document.createElement('div');
  partTitle.textContent = 'My P_abilities';
  partTitle.style.fontWeight = 'bold';
  partTitle.style.alignSelf = 'flex-start';
  partnerDiv.appendChild(partTitle);
  
  const partGrid = document.createElement('div');
  partGrid.className = 'habilities-grid';
  const partWrapper = document.createElement('div');
  partWrapper.className = 'scroll-wrapper';
  partWrapper.appendChild(partGrid);
  
  const partSort = document.createElement('div');
  partSort.className = 'sort-bar';
  ['number','name','level','modified'].forEach(opt => {
    const b = document.createElement('button');
    b.className = 'btn btn-green';
    const labels={name:'Order by Name',level:'Order by Level',number:'Order by Number',modified:'Order by LastModification'};
    b.textContent = labels[opt];
    b.disabled = partnerAbilitySort===opt;
    b.onclick = () => {partnerAbilitySort=opt; renderPartnersInDiv(container);};
    partSort.appendChild(b);
  });
  partnerDiv.appendChild(partSort);
  
  let partList = (villageChief.partnerAbilities || []).slice().sort((a,b)=>{
    if(partnerAbilitySort==='name') return a.name.localeCompare(b.name);
    if(partnerAbilitySort==='level') return (b.level||1)-(a.level||1);
    if(partnerAbilitySort==='number') return (a.number||0)-(b.number||0);
    return (b.modified||0)-(a.modified||0);
  });
  
  const partPages = PARTNER_MAX_PAGES;
  if (partnerAbilityPage > partPages) partnerAbilityPage = partPages;
  const partStart = (partnerAbilityPage - 1) * PARTNER_ITEMS_PER_PAGE;
  partList = partList.slice(partStart, partStart + PARTNER_ITEMS_PER_PAGE);
  
  partList.forEach((ab,idx)=>{
    const globalIdx = partStart + idx;
    const slot = document.createElement('div');
    slot.className = 'hability-slot';
    const num = document.createElement('div');
    num.className = 'slot-number';
    num.textContent = ab.number ?? globalIdx + 1;
    slot.appendChild(num);
    
    const imgDiv = document.createElement('div');
    imgDiv.className = 'slot-img hability-img';
    const stepIdxP = ab.activeStep ?? 0;
    let imgSrcP = stepIdxP === 0 ? ab.img : (ab.stepImgs[stepIdxP-1] || "");
    if (imgSrcP) imgDiv.style.backgroundImage = `url(${imgSrcP})`;
    imgDiv.style.backgroundPosition = `center ${ab.imgOffset ?? 50}%`;
    
    const nameDiv = document.createElement('div');
    nameDiv.textContent = `${ab.name} (Lvl:${ab.level||1})`;
    
    const descDiv=document.createElement('div');
    descDiv.className='small-desc';
    const dtxt=(ab.desc||'').trim();
    descDiv.textContent='Description: '+(dtxt || 'No description');
    
    slot.appendChild(imgDiv);
    slot.appendChild(nameDiv);
    slot.appendChild(descDiv);
    
    if(globalIdx>=villageChief.unlockedPartnerAbilities){
      const overlay=document.createElement('div');
      overlay.className='locked-overlay';
      overlay.textContent='Locked';
      slot.classList.add('locked');
      slot.appendChild(overlay);
    }
    partGrid.appendChild(slot);
  });
  
  partnerDiv.appendChild(partWrapper);
  
  const partPag=document.createElement('div');
  partPag.className='pagination';
  const partPrev=document.createElement('button');
  partPrev.textContent='Prev';
  partPrev.disabled=partnerAbilityPage===1;
  partPrev.onclick=()=>{ if(partnerAbilityPage>1){ partnerAbilityPage--; renderPartnersInDiv(container); } };
  partPag.appendChild(partPrev);
  const partInfo=document.createElement('span');
  partInfo.textContent=` Page ${partnerAbilityPage} of ${partPages} `;
  partPag.appendChild(partInfo);
  const partNext=document.createElement('button');
  partNext.textContent='Next';
  partNext.disabled=partnerAbilityPage===partPages;
  partNext.onclick=()=>{ if(partnerAbilityPage<partPages){ partnerAbilityPage++; renderPartnersInDiv(container); } };
  partPag.appendChild(partNext);
  partnerDiv.appendChild(partPag);
  
  container.appendChild(partnerDiv);
}

function renderPartnerStatsSection(container) {
  const pStatsDiv = document.createElement("div");
  pStatsDiv.className = "stats";
  pStatsDiv.id = "partner-stats";
  if (openPartnerStats) pStatsDiv.classList.add("expand-row");
  
  const pClose = document.createElement("button");
  pClose.textContent = "❌";
  pClose.className = "close-btn";
  pClose.onclick = () => { 
    openPartnerStats = false; 
    pStatsDiv.classList.remove("expand-row"); 
    renderPartnersInDiv(container);
  };
  pStatsDiv.appendChild(pClose);
  
  const pCols = document.createElement("div");
  pCols.className = "stats-columns";
  const pCol = document.createElement("div");
  pCol.className = "stats-column";
  const pTitle = document.createElement("div");
  pTitle.className = "stats-column-title";
  pTitle.textContent = "P_Stats";
  pCol.appendChild(pTitle);
  
  const pGrid = document.createElement("div");
  pGrid.className = "stats-grid";
  const pOrder = ["fuerza","suerte","inteligencia","destreza","defensa","vida","mana"];
  const pLabels = { fuerza:"Strength", suerte:"Luck", inteligencia:"Intelligence", destreza:"Dexterity", defensa:"Defense", vida:"HP", mana:"Mana" };
  
  pOrder.forEach(stat => {
    const line = document.createElement("div");
    line.className = "stat-line";
    const span = document.createElement("span");
    span.textContent = `${pLabels[stat]}: ${partnerStats[stat]}`;
    line.appendChild(span);
    pGrid.appendChild(line);
  });
  
  pCol.appendChild(pGrid);
  pCols.appendChild(pCol);
  pStatsDiv.appendChild(pCols);
  
  container.appendChild(pStatsDiv);
}

function renderPartnerInventorySection(container) {
  const pInvDiv = document.createElement("div");
  pInvDiv.className = "stats";
  pInvDiv.id = "partner-inventory";
  if (openPartnerInventory) pInvDiv.classList.add("expand-row");
  
  const pInvClose = document.createElement("button");
  pInvClose.textContent = "❌";
  pInvClose.className = "close-btn";
  pInvClose.onclick = () => { 
    openPartnerInventory = false; 
    pInvDiv.classList.remove("expand-row"); 
    renderPartnersInDiv(container);
  };
  pInvDiv.appendChild(pInvClose);
  
  const pInvCols = document.createElement("div");
  pInvCols.className = "stats-columns";
  const pInvCol = document.createElement("div");
  pInvCol.className = "stats-column";
  const pInvTitle = document.createElement("div");
  pInvTitle.className = "stats-column-title";
  pInvTitle.textContent = "Partner Potions";
  pInvCol.appendChild(pInvTitle);
  
  [
    ["hpPotions","HealingPotions", () => { partnerStats.vida += 1; }],
    ["manaPotions","ManaPotions", () => { partnerStats.mana += 1; }],
    ["energyPotions","EnergyPotions", () => { partner.energia = Math.min(100, (partner.energia || 0) + 20); }],
    ["expPotions","ExpPotions", () => { partner.exp = (partner.exp || 0) + 5; }]
  ].forEach(([key,label,drinkFn]) => {
    const line = document.createElement("div");
    line.className = "potion-item";
    line.style.display = "flex";
    line.style.justifyContent = "space-between";
    line.style.alignItems = "center";
    line.style.padding = "4px 0";
    
    const txt = document.createElement("span");
    txt.textContent = `${label}: ${partnerInventory[key] || 0}`;
    line.appendChild(txt);
    
    const drinkBtn = document.createElement("button");
    drinkBtn.textContent = "Drink";
    drinkBtn.className = "btn btn-blue";
    drinkBtn.style.padding = "2px 8px";
    drinkBtn.style.fontSize = "0.85rem";
    drinkBtn.disabled = !partnerInventory[key] || partnerInventory[key] <= 0;
    drinkBtn.onclick = () => {
      if (partnerInventory[key] > 0) {
        partnerInventory[key]--;
        drinkFn();
        saveGame();
        renderPartnersInDiv(container);
      }
    };
    line.appendChild(drinkBtn);
    pInvCol.appendChild(line);
  });
  
  pInvCols.appendChild(pInvCol);
  pInvDiv.appendChild(pInvCols);
  
  container.appendChild(pInvDiv);
}

function renderHeroesManagement(container) {
  container.innerHTML = '';
  
  // Crear contenedor flex para los botones
  const buttonsRow = document.createElement('div');
  buttonsRow.style.display = 'flex';
  buttonsRow.style.gap = '10px';
  buttonsRow.style.marginBottom = '10px';
  
  // Botón SummonHero
  const summonBtn = document.createElement('button');
  summonBtn.id = "summon-btn";
  summonBtn.className = 'btn btn-blue';
  summonBtn.textContent = `SummonHero (${summonCost} Gold)`;
  summonBtn.onclick = () => {
    console.log('🎯 SummonHero button clicked (second location)!');
    summonHero();
  };
  const noHouse = state.heroes.length >= state.houses;
  const noGoldSummon = state.money < summonCost;
  summonBtn.disabled = noHouse || noGoldSummon;
  if (summonBtn.disabled) {
    summonBtn.title = noGoldSummon ? "Not enough Gold" : "Add house to summon again";
  }
  summonBtn.style.flex = '1';
  buttonsRow.appendChild(summonBtn);
  
  container.appendChild(buttonsRow);
}


// Special Units System - Inicializar arrays globales
if (!window.Elites) window.Elites = [];
if (!window.SpecialCitizens) window.SpecialCitizens = [];
if (!window.SpecialSoldiers) window.SpecialSoldiers = [];

function renderSpecialUnitsView(container) {
  container.innerHTML = '';
  
  // Título principal
  const title = document.createElement('h1');
  title.textContent = 'POPULATION';
  title.style.textAlign = 'center';
  title.style.color = '#FFD700';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '20px';
  container.appendChild(title);
  
  // Botones de invocación
  const summonButtons = document.createElement('div');
  summonButtons.style.display = 'flex';
  summonButtons.style.justifyContent = 'center';
  summonButtons.style.gap = '15px';
  summonButtons.style.marginBottom = '20px';
  summonButtons.style.flexWrap = 'wrap';
  
  // Botón principal de Special Units (5000 Gold)
  const summonSpecialBtn = document.createElement('button');
  summonSpecialBtn.id = "special-units-btn";
  summonSpecialBtn.textContent = '🃏Summon SpecialUnits (5000 Gold)🃏';
  summonSpecialBtn.className = 'btn btn-gold';
  summonSpecialBtn.title = '5 Random Units (Elites/Sp.Citizen/Sp.Soldier)';
  summonSpecialBtn.onclick = toggleSpecialUnitsMinigame;
  summonButtons.appendChild(summonSpecialBtn);
  
  
  container.appendChild(summonButtons);
  
  // Estadísticas con contadores reales
  const statsContainer = document.createElement('div');
  statsContainer.style.display = 'flex';
  statsContainer.style.justifyContent = 'center';
  statsContainer.style.gap = '20px';
  statsContainer.style.marginBottom = '30px';
  statsContainer.style.flexWrap = 'wrap';
  statsContainer.style.textAlign = 'center';
  
  const familiars = state.familiars ? state.familiars.length : 0;
  const heroes = state.heroes ? state.heroes.filter(h => h.type === 'hero').length : 0;
  const pets = state.pets ? state.pets.length : 0;
  
  const stats = [
    { label: 'Citizens', value: `${citizens}/${state.terrain * 50}`, icon: '😊', id: 'citizens-display' },
    { label: 'Soldiers', value: `${soldiers}/${state.terrain * 50}`, icon: '⚔️', id: 'soldiers-display' },
    { label: 'Familiars', value: `${familiars}/100`, icon: '🐾', id: 'familiars-display' },
    { label: 'Heroes', value: `${heroes}`, icon: '🦸', id: 'heroes-total-display' },
    { label: 'Pets', value: `${pets}`, icon: '🐕', id: 'pets-total-display' },
    { label: 'Elites', value: `${window.Elites.length}`, icon: '👑', id: 'elites-display' },
    { label: 'SpecialCitizens', value: `${window.SpecialCitizens.length}`, icon: '🏛️', id: 'special-citizens-display' },
    { label: 'SpecialSoldiers', value: `${window.SpecialSoldiers.length}`, icon: '🛡️', id: 'special-soldiers-display' }
  ];
  
  stats.forEach(stat => {
    const statDiv = document.createElement('div');
    statDiv.id = stat.id;
    statDiv.style.display = 'flex';
    statDiv.style.alignItems = 'center';
    statDiv.style.gap = '5px';
    statDiv.style.fontSize = '14px';
    statDiv.innerHTML = `${stat.icon} ${stat.label}: ${stat.value}`;
    statsContainer.appendChild(statDiv);
  });
  
  container.appendChild(statsContainer);
  
  // Crear las tres secciones principales con datos reales
  const sectionsContainer = document.createElement('div');
  sectionsContainer.style.display = 'flex';
  sectionsContainer.style.flexDirection = 'column';
  sectionsContainer.style.gap = '30px';
  
  // Sección Elites
  const elitesSection = createSpecialUnitsSection('Elites', 'Search elites...', window.Elites, 'elite');
  sectionsContainer.appendChild(elitesSection);
  
  // Sección Special Citizens
  const specialCitizensSection = createSpecialUnitsSection('Special Citizens', 'Search special citizens...', window.SpecialCitizens, 'specialCitizen');
  sectionsContainer.appendChild(specialCitizensSection);
  
  // Sección Special Soldiers
  const specialSoldiersSection = createSpecialUnitsSection('Special Soldiers', 'Search special soldiers...', window.SpecialSoldiers, 'specialSoldier');
  sectionsContainer.appendChild(specialSoldiersSection);
  
  container.appendChild(sectionsContainer);
}

function createSpecialUnitsSection(title, searchPlaceholder, units, type) {
  const section = document.createElement('div');
  section.id = type === 'elite' ? 'elites' : (type === 'specialCitizen' ? 'special-citizens' : 'special-soldiers');
  section.style.backgroundColor = '#FFF8DC';
  section.style.border = '2px solid #DAA520';
  section.style.borderRadius = '10px';
  section.style.padding = '20px';
  
  // Título de la sección
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = title;
  sectionTitle.style.textAlign = 'center';
  sectionTitle.style.color = '#B8860B';
  sectionTitle.style.marginBottom = '15px';
  section.appendChild(sectionTitle);
  
  // Barra de búsqueda y ordenamiento
  const searchBar = document.createElement('div');
  searchBar.style.display = 'flex';
  searchBar.style.gap = '10px';
  searchBar.style.marginBottom = '15px';
  searchBar.style.alignItems = 'center';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = searchPlaceholder;
  searchInput.style.flex = '1';
  searchInput.style.padding = '8px';
  searchInput.style.border = '1px solid #DAA520';
  searchInput.style.borderRadius = '5px';
  searchInput.style.fontSize = '14px';
  searchBar.appendChild(searchInput);
  
  const sortBtn = document.createElement('button');
  sortBtn.textContent = 'Sort by Name';
  sortBtn.className = 'btn';
  sortBtn.style.backgroundColor = '#4682B4';
  sortBtn.style.color = 'white';
  sortBtn.style.padding = '8px 15px';
  sortBtn.style.border = 'none';
  sortBtn.style.borderRadius = '5px';
  sortBtn.style.fontSize = '14px';
  searchBar.appendChild(sortBtn);
  
  section.appendChild(searchBar);
  
  // Área de contenido
  const contentArea = document.createElement('div');
  contentArea.id = `${section.id}-content`;
  contentArea.style.minHeight = '200px';
  contentArea.style.border = '1px solid #DAA520';
  contentArea.style.borderRadius = '5px';
  contentArea.style.backgroundColor = '#FFFACD';
  contentArea.style.display = 'grid';
  contentArea.style.gridTemplateColumns = 'repeat(5, 1fr)';
  contentArea.style.gap = '15px';
  contentArea.style.padding = '20px';
  
  // Renderizar unidades
  renderUnitsInSection(contentArea, units, type);
  
  section.appendChild(contentArea);
  
  return section;
}

function renderUnitsInSection(container, units, type) {
  container.innerHTML = '';
  
  if (units.length === 0) {
    const noUnitsDiv = document.createElement('div');
    noUnitsDiv.style.gridColumn = '1 / -1';
    noUnitsDiv.style.textAlign = 'center';
    noUnitsDiv.style.color = '#666';
    noUnitsDiv.style.fontStyle = 'italic';
    noUnitsDiv.style.padding = '40px';
    noUnitsDiv.textContent = `No ${type === 'elite' ? 'elites' : (type === 'specialCitizen' ? 'special citizens' : 'special soldiers')} found`;
    container.appendChild(noUnitsDiv);
    return;
  }
  
  // Mostrar máximo 5 unidades
  const displayUnits = units.slice(0, 5);
  
  displayUnits.forEach(unit => {
    const card = document.createElement('div');
    card.style.width = '160px';
    card.style.height = '280px';
    card.style.borderRadius = '10px';
    card.style.padding = '10px';
    card.style.position = 'relative';
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.3s ease';
    
    // Color según tipo
    if (type === 'elite') {
      card.style.backgroundColor = '#ffd700';
      card.style.border = '2px solid #b8860b';
    } else {
      card.style.backgroundColor = '#c0c0c0';
      card.style.border = '2px solid #808080';
    }
    
    // Badge de tipo
    const badge = document.createElement('div');
    badge.style.position = 'absolute';
    badge.style.top = '5px';
    badge.style.left = '5px';
    badge.style.backgroundColor = 'rgba(0,0,0,0.7)';
    badge.style.color = 'white';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '3px';
    badge.style.fontSize = '10px';
    badge.textContent = type.toUpperCase();
    card.appendChild(badge);
    
    // Nombre
    const name = document.createElement('div');
    name.textContent = unit.name;
    name.style.textAlign = 'center';
    name.style.fontWeight = 'bold';
    name.style.fontSize = '14px';
    name.style.marginTop = '25px';
    name.style.height = '48px';
    name.style.display = 'flex';
    name.style.alignItems = 'center';
    name.style.justifyContent = 'center';
    card.appendChild(name);
    
    // Imagen
    const imgDiv = document.createElement('div');
    imgDiv.style.width = '120px';
    imgDiv.style.height = '120px';
    imgDiv.style.margin = '10px auto';
    imgDiv.style.backgroundImage = `url(${unit.img || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNEREQiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI2MCIgeT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIzNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuKdpDwvdGV4dD4KPHN2Zz4='})`;
    imgDiv.style.backgroundSize = 'cover';
    imgDiv.style.backgroundPosition = 'center';
    imgDiv.style.borderRadius = '8px';
    imgDiv.style.border = '1px solid rgba(0,0,0,0.2)';
    card.appendChild(imgDiv);
    
    // Level/Quantity
    const levelDiv = document.createElement('div');
    levelDiv.style.textAlign = 'center';
    levelDiv.style.fontWeight = 'bold';
    levelDiv.style.fontSize = '16px';
    levelDiv.style.color = '#333';
    levelDiv.textContent = type === 'elite' ? `Level: ${unit.Level || 1}` : `Quantity: ${unit.Quantity || 1}`;
    card.appendChild(levelDiv);
    
    // Descripción
    const descDiv = document.createElement('div');
    descDiv.style.textAlign = 'center';
    descDiv.style.fontSize = '10px';
    descDiv.style.color = '#666';
    descDiv.style.marginTop = '5px';
    descDiv.style.height = '30px';
    descDiv.style.overflow = 'hidden';
    descDiv.style.display = '-webkit-box';
    descDiv.style.webkitLineClamp = '3';
    descDiv.style.webkitBoxOrient = 'vertical';
    descDiv.textContent = unit.desc || 'No description available';
    card.appendChild(descDiv);
    
    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px) scale(1.05)';
      card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
      card.style.boxShadow = 'none';
    });
    
    container.appendChild(card);
  });
}

function toggleSpecialUnitsMinigame() {
  const existing = document.getElementById('special-units-minigame');
  if (existing) {
    existing.remove();
    return;
  }
  
  createSpecialUnitsMinigame();
}

function createSpecialUnitsMinigame() {
  const container = document.getElementById('population-content');
  if (!container) return;
  
  const minigame = document.createElement('div');
  minigame.id = 'special-units-minigame';
  minigame.style.backgroundColor = '#fffacd';
  minigame.style.border = '2px solid gold';
  minigame.style.borderRadius = '10px';
  minigame.style.padding = '20px';
  minigame.style.marginTop = '20px';
  minigame.style.textAlign = 'center';
  
  // Header
  const header = document.createElement('div');
  header.style.backgroundColor = '#ffd700';
  header.style.padding = '10px';
  header.style.borderRadius = '8px';
  header.style.marginBottom = '20px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  
  const title = document.createElement('h2');
  title.textContent = '🎴 Special Units Pack Opening 🎴';
  title.style.margin = '0';
  title.style.color = '#000';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => minigame.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  minigame.appendChild(header);
  
  // Pack visual
  const packContainer = document.createElement('div');
  packContainer.style.marginBottom = '20px';
  
  const pack = document.createElement('div');
  pack.style.width = '150px';
  pack.style.height = '200px';
  pack.style.backgroundColor = '#ffd700';
  pack.style.border = '3px solid #b8860b';
  pack.style.borderRadius = '15px';
  pack.style.margin = '0 auto 20px';
  pack.style.display = 'flex';
  pack.style.flexDirection = 'column';
  pack.style.justifyContent = 'center';
  pack.style.alignItems = 'center';
  pack.style.cursor = 'pointer';
  pack.style.transition = 'transform 0.3s ease';
  pack.style.position = 'relative';
  
  pack.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 10px;">⭐⭐⭐</div>
    <div style="font-weight: bold; text-align: center; font-size: 14px;">
      MAGIC PACK<br>
      Contains 5 cards!
    </div>
  `;
  
  pack.addEventListener('mouseenter', () => {
    pack.style.transform = 'scale(1.05)';
  });
  
  pack.addEventListener('mouseleave', () => {
    pack.style.transform = 'scale(1)';
  });
  
  packContainer.appendChild(pack);
  minigame.appendChild(packContainer);
  
  // Open Pack button
  const openBtn = document.createElement('button');
  openBtn.textContent = 'OPEN PACK (5000 Gold)';
  openBtn.className = 'btn btn-gold';
  openBtn.style.fontSize = '16px';
  openBtn.style.padding = '12px 24px';
  openBtn.onclick = () => openSpecialUnitsPack(minigame, openBtn, pack, packContainer);
  minigame.appendChild(openBtn);
  
  container.appendChild(minigame);
}

async function openSpecialUnitsPack(minigame, openBtn, pack, packContainer) {
  if (state.money < 5000) {
    showAlert('Not enough gold! Need 5000 gold.');
    return;
  }
  
  // Guardar posición de scroll
  const scrollPosition = window.pageYOffset;
  
  // Deducir oro inmediatamente
  state.money -= 5000;
  updateResourcesDisplay();
  
  // Deshabilitar botón
  openBtn.disabled = true;
  openBtn.textContent = 'OPENING...';
  
  try {
    // Cargar datos (simulados por ahora)
    const elitesData = await loadElitesData();
    const specialCitizensData = await loadSpecialCitizensData();
    const specialSoldiersData = await loadSpecialSoldiersData();
    
    // Generar 5 unidades aleatorias
    const generatedUnits = generateRandomUnits(elitesData, specialCitizensData, specialSoldiersData);
    
    // Añadir a colecciones
    addUnitsToCollections(generatedUnits);
    
    // Actualizar UI
    updateSpecialUnitsCounters();
    saveGame();
    
    // Animación del pack
    pack.style.transform = 'rotateY(180deg)';
    
    setTimeout(() => {
      packContainer.innerHTML = '';
      showRevealedCards(packContainer, generatedUnits);
      
      // Mostrar celebración
      const celebration = document.createElement('div');
      celebration.textContent = '🎉 PACK OPENED! 🎉';
      celebration.style.fontSize = '24px';
      celebration.style.fontWeight = 'bold';
      celebration.style.color = '#ffd700';
      celebration.style.marginBottom = '20px';
      packContainer.appendChild(celebration);
      
      // Re-habilitar botón después de 3 segundos
      setTimeout(() => {
        openBtn.disabled = false;
        openBtn.textContent = 'OPEN PACK (5000 Gold)';
      }, 3000);
      
      // Restaurar scroll
      window.scrollTo(0, scrollPosition);
    }, 500);
    
  } catch (error) {
    console.error('Error opening pack:', error);
    openBtn.disabled = false;
    openBtn.textContent = 'OPEN PACK (5000 Gold)';
    showAlert('Error opening pack. Please try again.');
  }
}

// Funciones auxiliares para cargar datos (simuladas por ahora)
async function loadElitesData() {
  // Por ahora retornamos datos simulados
  return [
    { id: 'epic-wizard', name: 'Epic Wizard Casting', img: 'Elites/epic-wizard.png', desc: 'A powerful wizard capable of casting epic spells' },
    { id: 'air-bender', name: 'AirBender', img: 'Elites/air-bender.png', desc: 'Master of air manipulation and wind control' },
    { id: 'fire-bender', name: 'FireBender', img: 'Elites/fire-bender.png', desc: 'Wielder of fire and flame magic' }
  ];
}

async function loadSpecialCitizensData() {
  return [
    { id: 'dwarf-blacksmith', name: 'Dwarf Blacksmith', img: 'SpecialCitizens/dwarf-blacksmith.png', desc: 'Expert craftsman and weapon maker' },
    { id: 'dwarf-lumberjack', name: 'Dwarf Lumberjack', img: 'SpecialCitizens/dwarf-lumberjack.png', desc: 'Master of wood cutting and forestry' }
  ];
}

async function loadSpecialSoldiersData() {
  return [
    { id: 'dwarf-knight', name: 'Dwarf Knight', img: 'SpecialSoldiers/dwarf-knight.png', desc: 'Heavy armored warrior with shield and sword' },
    { id: 'elf-archer', name: 'Elf Archer', img: 'SpecialSoldiers/elf-archer.png', desc: 'Precise archer with excellent aim' },
    { id: 'human-king', name: 'Human King Swordman', img: 'SpecialSoldiers/human-king.png', desc: 'Royal warrior with kingly combat skills' }
  ];
}

function generateRandomUnits(elites, specialCitizens, specialSoldiers) {
  const units = [];
  
  for (let i = 0; i < 5; i++) {
    const random = Math.random();
    let unit;
    
    if (random < 0.05) {
      // 5% chance for Elite
      unit = { ...elites[Math.floor(Math.random() * elites.length)], type: 'elite' };
    } else if (random < 0.5) {
      // 45% chance for Special Citizen
      unit = { ...specialCitizens[Math.floor(Math.random() * specialCitizens.length)], type: 'specialCitizen' };
    } else {
      // 50% chance for Special Soldier
      unit = { ...specialSoldiers[Math.floor(Math.random() * specialSoldiers.length)], type: 'specialSoldier' };
    }
    
    units.push(unit);
  }
  
  return units;
}

function addUnitsToCollections(units) {
  units.forEach(unit => {
    if (unit.type === 'elite') {
      const existing = window.Elites.find(e => e.id === unit.id);
      if (existing) {
        existing.Level = (existing.Level || 1) + 1;
      } else {
        window.Elites.push({ ...unit, Level: 1 });
      }
    } else if (unit.type === 'specialCitizen') {
      const existing = window.SpecialCitizens.find(s => s.id === unit.id);
      if (existing) {
        existing.Quantity = (existing.Quantity || 1) + 1;
      } else {
        window.SpecialCitizens.push({ ...unit, Quantity: 1 });
      }
    } else if (unit.type === 'specialSoldier') {
      const existing = window.SpecialSoldiers.find(s => s.id === unit.id);
      if (existing) {
        existing.Quantity = (existing.Quantity || 1) + 1;
      } else {
        window.SpecialSoldiers.push({ ...unit, Quantity: 1 });
      }
    }
  });
}

function updateSpecialUnitsCounters() {
  const elitesCounter = document.getElementById('elites-display');
  const specialCitizensCounter = document.getElementById('special-citizens-display');
  const specialSoldiersCounter = document.getElementById('special-soldiers-display');
  
  if (elitesCounter) {
    elitesCounter.innerHTML = `👑 Elites: ${window.Elites.length}`;
  }
  if (specialCitizensCounter) {
    specialCitizensCounter.innerHTML = `🏛️ SpecialCitizens: ${window.SpecialCitizens.length}`;
  }
  if (specialSoldiersCounter) {
    specialSoldiersCounter.innerHTML = `🛡️ SpecialSoldiers: ${window.SpecialSoldiers.length}`;
  }
}

function showRevealedCards(container, units) {
  const cardsGrid = document.createElement('div');
  cardsGrid.style.display = 'grid';
  cardsGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
  cardsGrid.style.gap = '15px';
  cardsGrid.style.marginTop = '20px';
  
  units.forEach((unit, index) => {
    const card = document.createElement('div');
    card.style.width = '160px';
    card.style.height = '280px';
    card.style.borderRadius = '10px';
    card.style.padding = '10px';
    card.style.position = 'relative';
    card.style.animation = 'cardReveal 0.8s ease-out forwards';
    card.style.animationDelay = `${index * 0.15}s`;
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px) scale(0.8) rotateX(90deg)';
    
    // Color según tipo
    if (unit.type === 'elite') {
      card.style.backgroundColor = '#ffd700';
      card.style.border = '2px solid #b8860b';
    } else {
      card.style.backgroundColor = '#c0c0c0';
      card.style.border = '2px solid #808080';
    }
    
    // Contenido de la carta
    card.innerHTML = `
      <div style="position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
        ${unit.type.toUpperCase()}
      </div>
      <div style="text-align: center; font-weight: bold; font-size: 14px; margin-top: 25px; height: 48px; display: flex; align-items: center; justify-content: center;">
        ${unit.name}
      </div>
      <div style="width: 120px; height: 120px; margin: 10px auto; background: url('${unit.img || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNEREQiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSI2MCIgeT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIzNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuKdpDwvdGV4dD4KPHN2Zz4='}') center/cover; border-radius: 8px; border: 1px solid rgba(0,0,0,0.2);"></div>
      <div style="text-align: center; font-weight: bold; font-size: 16px; color: #333;">
        ${unit.type === 'elite' ? 'Level: 1' : 'Quantity: 1'}
      </div>
      <div style="text-align: center; font-size: 10px; color: #666; margin-top: 5px; height: 30px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
        ${unit.desc || 'No description available'}
      </div>
    `;
    
    cardsGrid.appendChild(card);
  });
  
  container.appendChild(cardsGrid);
}

// Productivity tabs management
let currentProductivityTab = "life";
let productivityInitialized = false;

function initProductivityTabs() {
  const prodSection = document.getElementById('productivity-section');
  if (prodSection && !document.getElementById('productivity-extra')) {
    const extra = document.createElement('div');
    extra.className = 'chief-card card';
    extra.id = 'productivity-extra';
    extra.style.display = 'none';
    prodSection.appendChild(extra);
  }
  
  const tabButtons = document.querySelectorAll('.productivity-tab');
  if (!productivityInitialized) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.productivityTab;
        showProductivityTab(tab);
      });
    });
    productivityInitialized = true;
  }
  showProductivityTab("life");
}

function showProductivityTab(tab) {
  currentProductivityTab = tab;
  const tabButtons = document.querySelectorAll('.productivity-tab');
  tabButtons.forEach(btn => {
    if (btn.dataset.productivityTab === tab) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const content = document.getElementById('productivity-content');
  const extraCard = document.getElementById('productivity-extra');
  if (!content || !extraCard) return;
  
  content.innerHTML = '';
  extraCard.innerHTML = '';
  extraCard.style.display = 'none';

  if (tab === 'life') {
    extraCard.style.display = 'block';
    renderLifeMissions(extraCard);
  } else if (tab === 'diary') {
    extraCard.style.display = 'block';
    renderDiary(extraCard);
  } else if (tab === 'weekplan') {
    extraCard.style.display = 'block';
    renderWeekPlan(extraCard);
  } else if (tab === 'habits') {
    extraCard.style.display = 'block';
    renderHabits(extraCard);
  } else if (tab === 'projects') {
    extraCard.style.display = 'block';
    const iframe = document.createElement('iframe');
    iframe.className = 'html-game-frame';
    iframe.src = GAME_SOURCES.Projects;
    iframe.onload = () => {
      try {
        const chiefAbilities = (villageChief.habilities || [])
          .slice(0, villageChief.unlockedHabilities ?? unlockedHabilities)
          .map((a, idx) => ({
            id: a.id ?? a.number ?? String(idx + 1),
            label: a.label ?? a.name ?? `Ability ${idx + 1}`,
            name: a.name ?? a.label ?? `Ability ${idx + 1}`,
            level: a.level ?? a.lvl ?? a.abilityLevel ?? a.lvlAbility ?? a.skillLevel ?? 1
          }));
        iframe.contentWindow.postMessage({
          type: 'projectsData',
          partner: {
            unlockedPartnerAbilities: villageChief.unlockedHabilities ?? unlockedHabilities,
            abilities: chiefAbilities
          }
        }, '*');
      } catch {}
    };
    extraCard.appendChild(iframe);
  } else if (tab === 'silence') {
    showSilenceTempleModal();
  } else if (tab === 'pomodoro') {
    showPomodoroTowerModal();
  }
}
export default api;

