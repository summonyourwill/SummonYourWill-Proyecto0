import state, { heroMap } from "../state.js";

export const SEX = {
  MALE: "male",
  FEMALE: "female",
  NEUTRAL: "neutral"
};

export const SEX_ICON = {
  [SEX.MALE]: "♂",
  [SEX.FEMALE]: "♀",
  [SEX.NEUTRAL]: "⚥"
};

export const SEX_CLASS = {
  [SEX.MALE]: "male",
  [SEX.FEMALE]: "female",
  [SEX.NEUTRAL]: "neutral"
};

/**
 * Generate the next default warrior name that does not conflict with
 * existing heroes.
 *
 * @param {Array<{name: string}>} heroes Current hero list.
 * @returns {string} A unique warrior name.
 */
export function getNextWarriorName(heroes) {
  let i = 1;
  while (heroes.some(h => h.name.toLowerCase() === `warrior${i}`)) {
    i++;
  }
  return `Warrior${i}`;
}

/**
 * Ensure a base hero name is unique by appending a numeric suffix if needed.
 *
 * @param {Array<{name: string}>} heroes Existing heroes.
 * @param {string} base Desired base name.
 * @returns {string} Unique hero name.
 */
export function ensureUniqueHeroName(heroes, base) {
  let name = base;
  let i = 2;
  while (heroes.some(h => h.name.toLowerCase() === name.toLowerCase())) {
    name = `${base} ${i}`;
    i++;
  }
  return name;
}

/**
 * Create a new hero object with default stats and metadata.
 *
 * @param {Array<object>} heroes Existing heroes to calculate id.
 * @param {string} name Hero name.
 * @param {string} [origin="No origin"] Story origin.
 * @param {string} [profession=""] Starting profession.
 * @param {number} [maxProfessions=5] Maximum allowed professions.
 * @returns {object} Newly created hero object.
 */
export function createHero(heroes, name, origin = "No origin", profession = "", maxProfessions = 5) {
  const id = heroes.length ? Math.max(...heroes.map(h => h.id)) + 1 : 1;
  const stats = {
    fuerza: 1,
    suerte: 1,
    inteligencia: 1,
    destreza: 1,
    defensa: 1,
    vida: 1,
    mana: 1,
  };
  return {
    id,
    name,
    avatar: "",
    avatarOffset: 50,
    level: 1,
    exp: 0,
    energia: 100,
    hp: stats.vida,
    hpMax: stats.vida,
    mana: stats.mana,
    manaMax: stats.mana,
    stats,
    missionTime: 0,
    missionStartTime: 0,
    missionDuration: 0,
    collectTime: 0,
    mineTime: 0,
    chopTime: 0,
    workTime: 0,
    restTime: 0,
    restStartTime: 0,
    lastRestTick: 0,
    restDuration: 0,
    lastTimeShown: 0,
    trainTime: 0,
    trainingStat: null,
    // skills array eliminado - ahora se usan ability1/ability2 directamente
    pet: "",
    petImg: "",
    petLevel: 1,
    petExp: 0,
    petOrigin: "No origin",
    petFavorite: false,
    petResourceType: null,
    petPendingCount: 0,
    petLastCollection: Date.now(),
    origin,
    professions: profession ? [profession] : [],
    maxProfessions,
    weapon: "",
    armor: "",
    weaponImg: "",
    armorImg: "",
    secondImg: "",
    secondOffset: 50,
    ability1LearnTime: 0,
    ability2LearnTime: 0,
    ability1Learned: true,
    ability2Learned: true,
    buildTime: 0,
    collectLastShown: 0,
    mineLastShown: 0,
    chopLastShown: 0,
    workLastShown: 0,
    sex: SEX.NEUTRAL,
    favorite: false,
    desc: "",
    petDesc: "",
    hpPotions: 0,
    manaPotions: 0,
    energyPotions: 0,
    expPotions: 0,
    modified: Date.now(),
    petExploreDay: "",
  };
}

/**
 * Retrieve a hero object by its identifier.
 * @param {number} id Hero identifier.
 * @returns {object|null} Matching hero or null if not found.
 */
export function getHeroById(id) {
  return heroMap.get(id) || null;
}

export function rebuildHeroMap() {
  heroMap.clear();
  state.heroes.forEach(h => heroMap.set(h.id, h));
}

export function isBusy(hero) {
  if (
    state.autoClickActive &&
    (state.companions.includes(hero.id) ||
      state.farmers.includes(hero.id) ||
      state.lumberjacks.includes(hero.id) ||
      state.miners.includes(hero.id))
  ) {
    return true;
  }
  if (Object.values(state.upgradeTasks).some(t => t.time > 0 && (t.heroIds || []).includes(hero.id))) {
    return true;
  }
  if (
    state.specialBuilderSlots &&
    state.specialBuilderSlots.some(
      s => s.assignedHeroId === hero.id && (s.status === 'running' || s.status === 'completed')
    )
  ) {
    return true;
  }
  
  // Check if hero is in an individual Mission
  if (state.missions && state.missions.some(mission => 
    mission.heroId === hero.id && mission.heroId !== null
  )) {
    return true;
  }
  
  // Check if hero is in a Group Mission
  if (state.groupMissions && state.groupMissions.some(gm => 
    gm.status === 'running' && gm.heroIds && gm.heroIds.includes(hero.id)
  )) {
    return true;
  }
  
  // Check if hero is in a Daily Mission (state.dailyMissions is an object with day keys)
  if (state.dailyMissions) {
    for (const day in state.dailyMissions) {
      if (state.dailyMissions[day] && Array.isArray(state.dailyMissions[day])) {
        if (state.dailyMissions[day].some(slot => 
          slot.heroId === hero.id && slot.heroId !== null
        )) {
          return true;
        }
      }
    }
  }
  
  return !!(
    hero.missionTime ||
    hero.collectTime ||
    hero.mineTime ||
    hero.chopTime ||
    hero.workTime ||
    hero.buildTime ||
    hero.trainTime ||
    hero.restTime ||
    hero.ability1LearnTime ||
    hero.ability2LearnTime ||
    (hero.state && hero.state.type === "resting")
  );
}

/**
 * Set heroes as busy or not busy for Group Missions
 * @param {Array<number>} heroIds Array of hero IDs
 * @param {boolean} busy Whether to set heroes as busy
 */
export function setHeroesBusy(heroIds, busy) {
  if (!heroIds || !Array.isArray(heroIds)) return;
  
  heroIds.forEach(heroId => {
    const hero = getHeroById(heroId);
    if (hero) {
      if (busy) {
        // Set hero as busy for Group Mission
        hero.state = { type: 'groupMission' };
        hero.status = 'Group Mission';
      } else {
        // Check if hero is still in another Group Mission
        const stillInGroupMission = state.groupMissions && state.groupMissions.some(gm => 
          gm.status === 'running' && gm.heroIds && gm.heroIds.includes(heroId)
        );
        
        if (!stillInGroupMission) {
          // Only reset to ready if not in another Group Mission
          hero.state = { type: 'ready' };
          delete hero.status;
        }
      }
    }
  });
}

/**
 * Check if a hero is busy for construction purposes
 * This function excludes Group Missions from the busy check
 * @param {number} heroId Hero ID to check
 * @returns {boolean} True if hero is busy for construction
 */
export function isHeroBusyForConstruction(heroId) {
  const hero = getHeroById(heroId);
  if (!hero) return false;
  
  if (
    state.autoClickActive &&
    (state.companions.includes(hero.id) ||
      state.farmers.includes(hero.id) ||
      state.lumberjacks.includes(hero.id) ||
      state.miners.includes(hero.id))
  ) {
    return true;
  }
  if (Object.values(state.upgradeTasks).some(t => t.time > 0 && (t.heroIds || []).includes(hero.id))) {
    return true;
  }
  if (
    state.specialBuilderSlots &&
    state.specialBuilderSlots.some(
      s => s.assignedHeroId === hero.id && (s.status === 'running' || s.status === 'completed')
    )
  ) {
    return true;
  }
  
  // Check if hero is in a Daily Mission (exclude Group Missions)
  if (state.dailyMissions) {
    for (const day in state.dailyMissions) {
      if (state.dailyMissions[day] && Array.isArray(state.dailyMissions[day])) {
        if (state.dailyMissions[day].some(slot => 
          slot.heroId === hero.id && slot.heroId !== null
        )) {
          return true;
        }
      }
    }
  }
  
  return !!(
    hero.missionTime ||
    hero.collectTime ||
    hero.mineTime ||
    hero.chopTime ||
    hero.workTime ||
    hero.buildTime ||
    hero.trainTime ||
    hero.restTime ||
    hero.ability1LearnTime ||
    hero.ability2LearnTime ||
    (hero.state && hero.state.type === "resting")
  );
}
