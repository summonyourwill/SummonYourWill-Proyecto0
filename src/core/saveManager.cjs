const fs = require('fs').promises;
const path = require('path');

let logger;
try {
  const candidatePaths = [
    // Ruta en desarrollo: src/core -> ../../logger.cjs
    path.resolve(__dirname, '../../logger.cjs'),
    // Ruta tras copy a build: core -> ../logger.cjs
    path.resolve(__dirname, '../logger.cjs'),
    // Ruta dentro de resources (por si se copiara allí)
    process && process.resourcesPath ? path.resolve(process.resourcesPath, 'app.asar.unpacked', 'logger.cjs') : ''
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      logger = require(candidate);
      break;
    } catch (_) {}
  }
} catch (_) {}

if (!logger) {
  // Fallback: logger a consola para no romper la app si falta el archivo
  logger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
  };
}

// Función para obtener la ruta de documentos
function getDocumentsPath() {
  try {
    const { app } = require('electron');
    return app.getPath('documents');
  } catch (error) {
    // Si no estamos en Electron, usar la carpeta actual
    return process.cwd();
  }
}

// Función para obtener la ruta de userData
function getUserDataPath() {
  try {
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (error) {
    // Si no estamos en Electron, usar la carpeta actual
    return process.cwd();
  }
}

const SAVE_DIR = path.join(getDocumentsPath(), 'SummonYourWillSaves');
const SAVE_FILE_PATH = path.join(SAVE_DIR, 'save.json');
const LEGACY_SAVE_PATH = path.join(getUserDataPath(), 'save.json');

// Función para generar ID único aleatorio
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Utilidades para imágenes → convertir rutas a base64 (data URL)
async function pathExists(target) {
  try { await fs.access(target); return true; } catch (_) { return false; }
}

function guessMimeByExt(filePath) {
  const ext = (path.extname(filePath) || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function resolveImageCandidates(img, typeFolder, unitName) {
  const candidates = [];
  if (img && typeof img === 'string') {
    if (/^data:image\//i.test(img)) {
      // Ya es data URL
      return { dataUrl: img, tried: [] };
    }
    // Si es ruta relativa o absoluta
    if (path.isAbsolute(img)) {
      candidates.push(img);
    } else {
      candidates.push(path.resolve(__dirname, '../../', img));
      candidates.push(path.resolve(__dirname, '../', img));
    }
  }
  // Fallbacks por carpeta/tipo y nombre
  const baseSrcDev = path.resolve(__dirname, '../../src/Population');
  const baseSrcBuild = path.resolve(__dirname, '../Population');
  const fileNames = [];
  if (unitName) fileNames.push(`${unitName}.png`, `${unitName}.jpg`, `${unitName}.jpeg`, `${unitName}.webp`);
  // Si img venía como nombre simple
  if (img && !/[/\\]/.test(img)) {
    fileNames.push(img);
  }
  const folders = typeFolder ? [typeFolder, ''] : [''];
  for (const folder of folders) {
    for (const fname of fileNames) {
      candidates.push(path.join(baseSrcDev, folder, fname));
      candidates.push(path.join(baseSrcBuild, folder, fname));
    }
  }
  return { dataUrl: null, tried: candidates };
}

async function loadImageAsDataUrl(img, typeFolder, unitName) {
  try {
    const res = await resolveImageCandidates(img, typeFolder, unitName);
    if (res.dataUrl) return res.dataUrl; // ya era base64
    for (const candidate of res.tried) {
      if (await pathExists(candidate)) {
        const buf = await fs.readFile(candidate);
        const mime = guessMimeByExt(candidate);
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    }
  } catch (e) {
    logger && logger.warn && logger.warn('[saveManager] No se pudo convertir imagen a base64:', e.message);
  }
  return '';
}

// Función para generar archivo heroes.json
async function generateHeroesFile(heroes, chiefId) {
  try {
    const heroesForJson = heroes.map(hero => ({
      ...hero,
      id: hero.id, // Mantener id del juego
      chief_id: chiefId // ID numérico del village chief
    }));
    
    const heroesPath = path.join(SAVE_DIR, 'heroes.json');
    await fs.writeFile(heroesPath, JSON.stringify(heroesForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo heroes.json generado en:', heroesPath);
    
    return heroesForJson;
  } catch (error) {
    logger.error('❌ Error al generar heroes.json:', error);
    return heroes;
  }
}

// Función para generar archivo pets.json
async function generatePetsFile(heroes, chiefId) {
  try {
    const pets = [];
    
    heroes.forEach(hero => {
      if (hero && hero.pet && String(hero.pet).trim() !== '') {
        const {
          pet, petImg, petLevel, petExp, petOrigin, petFavorite,
          petResourceType, petPendingCount, petLastCollection,
          petExploreDay, petDesc,
          ...ownerRest
        } = hero;

        pets.push({
          id_hero: hero.id, // ID del héroe en el juego
          chief_id: chiefId, // ID numérico del village chief
          name: hero.pet,
          img: hero.petImg || '',
          level: hero.petLevel || 1,
          exp: hero.petExp || 0,
          origin: hero.petOrigin || 'No origin',
          favorite: hero.petFavorite || false,
          resourceType: hero.petResourceType || null,
          pendingCount: hero.petPendingCount || 0,
          lastCollection: hero.petLastCollection || Date.now(),
          exploreDay: hero.petExploreDay || '',
          desc: hero.petDesc || '',
          // Embed del héroe dueño (resto de datos del héroe)
          owner_hero: ownerRest
        });
      }
    });
    
    // Si no hay mascotas, no generar archivo
    if (pets.length === 0) {
      logger.info('ℹ️ No hay mascotas para guardar. No se genera pets.json');
      return [];
    }

    const petsPath = path.join(SAVE_DIR, 'pets.json');
    await fs.writeFile(petsPath, JSON.stringify(pets, null, 2), 'utf-8');
    logger.info('✅ Archivo pets.json generado en:', petsPath);
    
    return pets;
  } catch (error) {
    logger.error('❌ Error al generar pets.json:', error);
    return [];
  }
}

// Función para generar archivo villagechief.json (sin abilities)
async function generateVillageChiefFile(villageChief, bossStats) {
  try {
    const villageChiefForJson = {
      ...villageChief,
      // Mantener id del juego para el esquema
      id: villageChief.id || 1,
      // Incluir las propiedades específicas solicitadas
      nivel: villageChief.level || 1,
      experiencia: villageChief.exp || 0,
      imagen: villageChief.avatar || '',
      inventario: {
        hpPotions: villageChief.hpPotions || 0,
        manaPotions: villageChief.manaPotions || 0,
        energyPotions: villageChief.energyPotions || 0,
        expPotions: villageChief.expPotions || 0
      },
      stats: bossStats || {}
    };
    
    // Eliminar campos no deseados del objeto resultante
    delete villageChiefForJson.familiars;
    delete villageChiefForJson.habilities;
    delete villageChiefForJson.partnerAbilities;
    delete villageChiefForJson.abilities;
    
    const villageChiefPath = path.join(SAVE_DIR, 'villagechief.json');
    await fs.writeFile(villageChiefPath, JSON.stringify(villageChiefForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo villagechief.json generado en:', villageChiefPath);
    
    return villageChiefForJson;
  } catch (error) {
    logger.error('❌ Error al generar villagechief.json:', error);
    return villageChief;
  }
}

// Función para generar archivo villagechief_abilities.json
async function generateVillageChiefAbilitiesFile(villageChief) {
  try {
    const abilitiesArray = Array.isArray(villageChief.abilities)
      ? villageChief.abilities
      : (Array.isArray(villageChief.habilities) ? villageChief.habilities : []);

    const pathOut = path.join(SAVE_DIR, 'villagechief_abilities.json');
    await fs.writeFile(pathOut, JSON.stringify(abilitiesArray, null, 2), 'utf-8');
    logger.info('✅ Archivo villagechief_abilities.json generado en:', pathOut);

    return abilitiesArray;
  } catch (error) {
    logger.error('❌ Error al generar villagechief_abilities.json:', error);
    return [];
  }
}

// Función para generar archivo partner.json (sin abilities)
async function generatePartnerFile(partner, partnerStats, chiefId) {
  try {
    const { id, ...partnerWithoutId } = partner; // Remover id del juego
    const partnerForJson = {
      ...partnerWithoutId,
      chief_id: chiefId, // ID numérico del village chief
      // Incluir las propiedades específicas solicitadas
      nivel: partner.level || 1,
      experiencia: partner.exp || 0,
      imagen: partner.img || '',
      inventario: {
        hpPotions: partner.hpPotions || 0,
        manaPotions: partner.manaPotions || 0,
        energyPotions: partner.energyPotions || 0,
        expPotions: partner.expPotions || 0
      },
      stats: partnerStats || {}
    };
    
    const partnerPath = path.join(SAVE_DIR, 'partner.json');
    await fs.writeFile(partnerPath, JSON.stringify(partnerForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo partner.json generado en:', partnerPath);
    
    return partnerForJson;
  } catch (error) {
    logger.error('❌ Error al generar partner.json:', error);
    return partner;
  }
}

// Función para generar archivo partner_abilities.json
async function generatePartnerAbilitiesFile(villageChief) {
  try {
    const abilities = Array.isArray(villageChief && villageChief.partnerAbilities)
      ? villageChief.partnerAbilities
      : (villageChief && typeof villageChief.partnerAbilities === 'object' && villageChief.partnerAbilities
          ? [villageChief.partnerAbilities]
          : []);
    const pathOut = path.join(SAVE_DIR, 'partner_abilities.json');
    await fs.writeFile(pathOut, JSON.stringify(abilities, null, 2), 'utf-8');
    logger.info('✅ Archivo partner_abilities.json generado en:', pathOut);
    return abilities;
  } catch (error) {
    logger.error('❌ Error al generar partner_abilities.json:', error);
    return [];
  }
}

// Función para generar archivo familiars.json
async function generateFamiliarsFile(familiars, chiefId) {
  try {
    const familiarsForJson = familiars.map(familiar => {
      const { id, ...familiarWithoutId } = familiar; // Remover id del juego
      return {
        ...familiarWithoutId,
        chief_id: chiefId // ID numérico del village chief
      };
    });
    
    const familiarsPath = path.join(SAVE_DIR, 'familiars.json');
    await fs.writeFile(familiarsPath, JSON.stringify(familiarsForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo familiars.json generado en:', familiarsPath);
    
    return familiarsForJson;
  } catch (error) {
    logger.error('❌ Error al generar familiars.json:', error);
    return familiars;
  }
}

// Función para generar archivo Elites.json
async function generateElitesFile(elites) {
  try {
    const elitesForJson = await Promise.all((Array.isArray(elites) ? elites : []).map(async elite => {
      const img64 = await loadImageAsDataUrl(elite.img, 'Elites', elite.name);
      return {
        id: elite.id ?? elite.name,
        name: elite.name,
        img: elite.img,
        img64,
        desc: elite.desc,
        level_quantity: elite.Level ?? elite.level_quantity ?? 1
      };
    }));
    
    const elitesPath = path.join(SAVE_DIR, 'Elites.json');
    await fs.writeFile(elitesPath, JSON.stringify(elitesForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo Elites.json generado en:', elitesPath);
    
    return elitesForJson;
  } catch (error) {
    logger.error('❌ Error al generar Elites.json:', error);
    return elites;
  }
}

// Función para generar archivo SpecialSoldiers.json
async function generateSpecialSoldiersFile(specialSoldiers) {
  try {
    const specialSoldiersForJson = await Promise.all((Array.isArray(specialSoldiers) ? specialSoldiers : []).map(async soldier => {
      const img64 = await loadImageAsDataUrl(soldier.img, 'SpecialSoldiers', soldier.name);
      return {
        id: soldier.id ?? soldier.name,
        name: soldier.name,
        img: soldier.img,
        img64,
        desc: soldier.desc,
        level_quantity: soldier.Quantity ?? soldier.level_quantity ?? 1
      };
    }));
    
    const specialSoldiersPath = path.join(SAVE_DIR, 'SpecialSoldiers.json');
    await fs.writeFile(specialSoldiersPath, JSON.stringify(specialSoldiersForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo SpecialSoldiers.json generado en:', specialSoldiersPath);
    
    return specialSoldiersForJson;
  } catch (error) {
    logger.error('❌ Error al generar SpecialSoldiers.json:', error);
    return specialSoldiers;
  }
}

// Función para generar archivo SpecialCitizens.json
async function generateSpecialCitizensFile(specialCitizens) {
  try {
    const specialCitizensForJson = await Promise.all((Array.isArray(specialCitizens) ? specialCitizens : []).map(async citizen => {
      const img64 = await loadImageAsDataUrl(citizen.img, 'SpecialCitizens', citizen.name);
      return {
        id: citizen.id ?? citizen.name,
        name: citizen.name,
        img: citizen.img,
        img64,
        desc: citizen.desc,
        level_quantity: citizen.Quantity ?? citizen.level_quantity ?? 1
      };
    }));
    
    const specialCitizensPath = path.join(SAVE_DIR, 'SpecialCitizens.json');
    await fs.writeFile(specialCitizensPath, JSON.stringify(specialCitizensForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo SpecialCitizens.json generado en:', specialCitizensPath);
    
    return specialCitizensForJson;
  } catch (error) {
    logger.error('❌ Error al generar SpecialCitizens.json:', error);
    return specialCitizens;
  }
}

// Función para generar archivo lifemissions.json
async function generateLifeMissionsFile(lifeMissionsData) {
  try {
    const lifeMissionsForJson = {
      tasks: lifeMissionsData.lifeTasks || Array.from({ length: 9 }, () => ({ text: "", difficulty: "", completed: false })),
      tasksDay: lifeMissionsData.lifeTasksDay || new Date().toISOString().split('T')[0],
      otherText: lifeMissionsData.lifeOtherText || "",
      gold: lifeMissionsData.lifeGold || 0,
      goldDay: lifeMissionsData.lifeGoldDay || new Date().toISOString().split('T')[0]
    };
    
    const lifeMissionsPath = path.join(SAVE_DIR, 'lifemissions.json');
    await fs.writeFile(lifeMissionsPath, JSON.stringify(lifeMissionsForJson, null, 2), 'utf-8');
    logger.info('✅ Archivo lifemissions.json generado en:', lifeMissionsPath);
    
    return lifeMissionsForJson;
  } catch (error) {
    logger.error('❌ Error al generar lifemissions.json:', error);
    return lifeMissionsData;
  }
}

// Función para generar archivo projects.json
async function generateProjectsFile(projectsData) {
  try {
    // Validar que projects sea un array, si no lo es, usar array vacío
    let projectsArray = projectsData.projects || [];
    if (!Array.isArray(projectsArray)) {
      logger.warn('⚠️ projects no es un array, usando array vacío. Valor recibido:', typeof projectsArray);
      projectsArray = [];
    }
    
    // Guardar SOLO el array de proyectos (sin wrapper), igual que el export de projects.html
    const projectsPath = path.join(SAVE_DIR, 'projects.json');
    await fs.writeFile(projectsPath, JSON.stringify(projectsArray, null, 2), 'utf-8');
    logger.info('✅ Archivo projects.json generado en:', projectsPath);
    
    return projectsArray;
  } catch (error) {
    logger.error('❌ Error al generar projects.json:', error);
    return [];
  }
}

// Función para generar archivo diary.json
async function generateDiaryFile(diaryData) {
  try {
    const diaryPath = path.join(SAVE_DIR, 'diary.json');
    await fs.writeFile(diaryPath, JSON.stringify(diaryData, null, 2), 'utf-8');
    logger.info('✅ Archivo diary.json generado en:', diaryPath);
    return diaryData;
  } catch (error) {
    logger.error('❌ Error al generar diary.json:', error);
    return {};
  }
}

// Función para generar archivo weekplan.json
async function generateWeekplanFile(weekplanData) {
  try {
    const weekplanPath = path.join(SAVE_DIR, 'weekplan.json');
    await fs.writeFile(weekplanPath, JSON.stringify(weekplanData, null, 2), 'utf-8');
    logger.info('✅ Archivo weekplan.json generado en:', weekplanPath);
    return weekplanData;
  } catch (error) {
    logger.error('❌ Error al generar weekplan.json:', error);
    return {};
  }
}

// Función para generar archivo habitscalendar.json
async function generateHabitsCalendarFile(habitsCalendarData) {
  try {
    const habitsCalendarPath = path.join(SAVE_DIR, 'habitscalendar.json');
    await fs.writeFile(habitsCalendarPath, JSON.stringify(habitsCalendarData, null, 2), 'utf-8');
    logger.info('✅ Archivo habitscalendar.json generado en:', habitsCalendarPath);
    return habitsCalendarData;
  } catch (error) {
    logger.error('❌ Error al generar habitscalendar.json:', error);
    return {};
  }
}

async function ensureSaveDir() {
  try {
    await fs.mkdir(SAVE_DIR, { recursive: true });
  } catch (err) {
    logger.error('❌ Error creating save directory:', err);
  }
}

async function migrateLegacySave() {
  try {
    const [legacyExists, newExists] = await Promise.all([
      fs.access(LEGACY_SAVE_PATH).then(() => true).catch(() => false),
      fs.access(SAVE_FILE_PATH).then(() => true).catch(() => false)
    ]);
    if (legacyExists && !newExists) {
      await ensureSaveDir();
      await fs.copyFile(LEGACY_SAVE_PATH, SAVE_FILE_PATH);
      await fs.unlink(LEGACY_SAVE_PATH).catch(() => {});
      logger.info('📁 Migrated save file to:', SAVE_FILE_PATH);
    }
  } catch (err) {
    logger.error('❌ Error migrating save file:', err);
  }
}


async function saveGame(data) {
  try {
    await ensureSaveDir();
    
    // Guardar el save.json principal
    const tmpPath = SAVE_FILE_PATH + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, SAVE_FILE_PATH);
    logger.info('✅ Partida guardada en:', SAVE_FILE_PATH);
    
    let chiefId = null;
    
    // Generar villagechief.json (sin abilities) primero para obtener el ID numérico
    if (data.villageChief) {
      const villageChiefResult = await generateVillageChiefFile(data.villageChief, data.bossStats);
      chiefId = villageChiefResult.id; // Este será el ID numérico del village chief
      // Generar abilities en archivo separado
      await generateVillageChiefAbilitiesFile(data.villageChief);
    }
    
    // Generar archivos adicionales usando el chiefId
    if (data.heroes && Array.isArray(data.heroes)) {
      await generateHeroesFile(data.heroes, chiefId);

      // Generar pets.json solo si hay héroes con mascota
      if (data.heroes.some(h => h && h.pet && String(h.pet).trim() !== '')) {
        await generatePetsFile(data.heroes, chiefId);
      }
    }
    
<<<<<<< HEAD
    // Generar partner.json y partner_abilities.json
    if (data.partner) {
      await generatePartnerFile(data.partner, data.partnerStats, chiefId);
      await generatePartnerAbilitiesFile(data.villageChief || {});
    }
=======
    // Generar villains.json - COMENTADO
    // if (data.villains && Array.isArray(data.villains)) {
    //   await generateVillainsFile(data.villains, chiefId);
    // }
    
    // Generar partner.json y partner_abilities.json - COMENTADO
    // if (data.partner) {
    //   await generatePartnerFile(data.partner, data.partnerStats, chiefId);
    //   await generatePartnerAbilitiesFile(data.villageChief || {});
    // }
>>>>>>> develop
    
    // Generar familiars.json - COMENTADO
    // if (data.villageChief && data.villageChief.familiars && Array.isArray(data.villageChief.familiars)) {
    //   await generateFamiliarsFile(data.villageChief.familiars, chiefId);
    // }
    
    // Generar Elites.json
    if (data.Elites && Array.isArray(data.Elites)) {
      await generateElitesFile(data.Elites);
    }
    
    // Generar SpecialSoldiers.json
    if (data.SpecialSoldiers && Array.isArray(data.SpecialSoldiers)) {
      await generateSpecialSoldiersFile(data.SpecialSoldiers);
    }
    
    // Generar SpecialCitizens.json
    if (data.SpecialCitizens && Array.isArray(data.SpecialCitizens)) {
      await generateSpecialCitizensFile(data.SpecialCitizens);
    }
    
    // Generar lifemissions.json (siempre se genera para mantener consistencia)
    await generateLifeMissionsFile({
      lifeTasks: data.lifeTasks,
      lifeTasksDay: data.lifeTasksDay,
      lifeOtherText: data.lifeOtherText,
      lifeGold: data.lifeGold,
      lifeGoldDay: data.lifeGoldDay
    });
    
    // Generar projects.json (siempre se genera para mantener consistencia)
    await generateProjectsFile({
      projects: data.projects,
      projectPoints: data.projectPoints
    });
    
    // Generar diary.json (siempre se genera para mantener consistencia)
    await generateDiaryFile({
      diaryEntries: data.diaryEntries || {}
    });
    
    // Generar weekplan.json (siempre se genera para mantener consistencia)
    await generateWeekplanFile({
      events: data.weekplanEvents || []
    });
    
    // Generar habitscalendar.json (siempre se genera para mantener consistencia)
    await generateHabitsCalendarFile({
      habitsData: data.habitsData || {},
      habitsMonth: data.habitsMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`,
      habitsLastProcessed: data.habitsLastProcessed || new Date().toISOString().split('T')[0]
    });
    
    logger.info('✅ Archivos JSON generados correctamente');
    
  } catch (error) {
    logger.error('❌ Error al guardar partida:', error);
  }
}

async function loadLifeMissions() {
  try {
    const lifeMissionsPath = path.join(SAVE_DIR, 'lifemissions.json');
    const data = await fs.readFile(lifeMissionsPath, 'utf-8');
    logger.info('✅ LifeMissions cargado desde:', lifeMissionsPath);
    return JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('⚠️ Error al cargar lifemissions.json:', error.message);
    }
    return null;
  }
}

async function loadProjects() {
  try {
    const projectsPath = path.join(SAVE_DIR, 'projects.json');
    const data = await fs.readFile(projectsPath, 'utf-8');
    logger.info('✅ Projects cargado desde:', projectsPath);
    const parsed = JSON.parse(data);
    
    // projects.json debe contener directamente el array
    if (Array.isArray(parsed)) {
      return parsed;
    } else {
      logger.warn('⚠️ projects.json no contiene un array válido');
      return null;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('⚠️ Error al cargar projects.json:', error.message);
    }
    return null;
  }
}

async function loadDiary() {
  try {
    const diaryPath = path.join(SAVE_DIR, 'diary.json');
    const data = await fs.readFile(diaryPath, 'utf-8');
    const diaryData = JSON.parse(data);
    logger.info('✅ Diary cargado desde:', diaryPath);
    return diaryData.diaryEntries || {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('⚠️ diary.json no encontrado, usando datos vacíos');
      return {};
    }
    logger.error('❌ Error al cargar diary.json:', error);
    return {};
  }
}

async function loadWeekplan() {
  try {
    const weekplanPath = path.join(SAVE_DIR, 'weekplan.json');
    const data = await fs.readFile(weekplanPath, 'utf-8');
    const weekplanData = JSON.parse(data);
    logger.info('✅ Weekplan cargado desde:', weekplanPath);
    return weekplanData.events || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('⚠️ weekplan.json no encontrado, usando datos vacíos');
      return [];
    }
    logger.error('❌ Error al cargar weekplan.json:', error);
    return [];
  }
}

async function loadHabitsCalendar() {
  try {
    const habitsCalendarPath = path.join(SAVE_DIR, 'habitscalendar.json');
    const data = await fs.readFile(habitsCalendarPath, 'utf-8');
    const habitsCalendarData = JSON.parse(data);
    logger.info('✅ HabitsCalendar cargado desde:', habitsCalendarPath);
    return habitsCalendarData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('⚠️ habitscalendar.json no encontrado, usando datos vacíos');
      return {};
    }
    logger.error('❌ Error al cargar habitscalendar.json:', error);
    return {};
  }
}

async function loadGame(defaultData = {}) {
  try {
    await migrateLegacySave();
    const data = await fs.readFile(SAVE_FILE_PATH, 'utf-8');
    logger.info('✅ Partida cargada desde:', SAVE_FILE_PATH);
    const gameData = JSON.parse(data);
    
    // Intentar cargar lifemissions.json como respaldo si los datos no están en save.json
    if (!gameData.lifeTasks && !gameData.lifeOtherText) {
      const lifeMissions = await loadLifeMissions();
      if (lifeMissions) {
        gameData.lifeTasks = lifeMissions.tasks;
        gameData.lifeTasksDay = lifeMissions.tasksDay;
        gameData.lifeOtherText = lifeMissions.otherText;
        gameData.lifeGold = lifeMissions.gold;
        gameData.lifeGoldDay = lifeMissions.goldDay;
        logger.info('✅ Datos de LifeMissions restaurados desde lifemissions.json');
      }
    }
    
    // Intentar cargar projects.json como respaldo si los datos no están en save.json
    if (gameData.projects === undefined) {
      const projectsArray = await loadProjects();
      if (projectsArray && Array.isArray(projectsArray)) {
        gameData.projects = projectsArray;
        logger.info('✅ Datos de Projects restaurados desde projects.json');
      }
    }
    
    // Intentar cargar diary.json como respaldo si los datos no están en save.json
    if (!gameData.diaryEntries) {
      const diaryData = await loadDiary();
      if (diaryData && Object.keys(diaryData).length > 0) {
        gameData.diaryEntries = diaryData;
        logger.info('✅ Datos de Diary restaurados desde diary.json');
      }
    }
    
    // Intentar cargar weekplan.json como respaldo si los datos no están en save.json
    if (!gameData.weekplanEvents) {
      const weekplanData = await loadWeekplan();
      if (weekplanData && Array.isArray(weekplanData)) {
        gameData.weekplanEvents = weekplanData;
        logger.info('✅ Datos de Weekplan restaurados desde weekplan.json');
      }
    }
    
    // Intentar cargar habitscalendar.json como respaldo si los datos no están en save.json
    if (!gameData.habitsData) {
      const habitsCalendarData = await loadHabitsCalendar();
      if (habitsCalendarData && Object.keys(habitsCalendarData).length > 0) {
        gameData.habitsData = habitsCalendarData.habitsData || {};
        gameData.habitsMonth = habitsCalendarData.habitsMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
        gameData.habitsLastProcessed = habitsCalendarData.habitsLastProcessed || new Date().toISOString().split('T')[0];
        logger.info('✅ Datos de HabitsCalendar restaurados desde habitscalendar.json');
      }
    }
    
    // Validar que projects sea siempre un array
    if (!Array.isArray(gameData.projects)) {
      logger.warn('⚠️ gameData.projects no es un array, corrigiendo a array vacío');
      gameData.projects = [];
    }
    
    // Asegurar que projectPoints exista
    if (gameData.projectPoints === undefined) {
      gameData.projectPoints = 0;
    }
    
    // Asegurar que diaryEntries exista
    if (!gameData.diaryEntries) {
      gameData.diaryEntries = {};
    }
    
    // Asegurar que weekplanEvents exista
    if (!gameData.weekplanEvents) {
      gameData.weekplanEvents = [];
    }
    
    // Asegurar que los datos del calendario de hábitos existan
    if (!gameData.habitsData) {
      gameData.habitsData = {};
    }
    if (!gameData.habitsMonth) {
      gameData.habitsMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    }
    if (!gameData.habitsLastProcessed) {
      gameData.habitsLastProcessed = new Date().toISOString().split('T')[0];
    }
    
    return gameData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('⚠️ No se encontró save.json. Intentando cargar partida0.json automáticamente...');
      
      // Intentar cargar partida0.json automáticamente
      try {
        const partida0Path = path.join(__dirname, '../../partida0.json');
        const partida0Content = await fs.readFile(partida0Path, 'utf-8');
        const partida0Data = JSON.parse(partida0Content);
        
        logger.info('✅ partida0.json cargado correctamente como datos iniciales');
        
        // Guardar automáticamente como save.json para futuras sesiones
        await saveGame(partida0Data);
        logger.info('📁 Datos de partida0.json guardados como save.json para próximas sesiones');
        
        return partida0Data;
      } catch (partida0Error) {
        logger.error('❌ Error al cargar partida0.json:', partida0Error.message);
        logger.warn('⚠️ Usando datos por defecto como último recurso');
        return defaultData;
      }
    } else {
      logger.error('❌ Error al cargar partida:', error);
      if (error.name === 'SyntaxError') {
        try {
          const corrupt = SAVE_FILE_PATH + '.corrupt';
          await fs.rename(SAVE_FILE_PATH, corrupt);
          logger.warn('⚠️ Archivo de guardado corrupto renombrado a:', corrupt);
          logger.warn('⚠️ Intentando cargar partida0.json como respaldo...');
          
          // Intentar cargar partida0.json como respaldo para archivos corruptos
          try {
            const partida0Path = path.join(__dirname, '../../partida0.json');
            const partida0Content = await fs.readFile(partida0Path, 'utf-8');
            const partida0Data = JSON.parse(partida0Content);
            
            logger.info('✅ partida0.json cargado como respaldo después de archivo corrupto');
            
            // Guardar automáticamente como save.json
            await saveGame(partida0Data);
            logger.info('📁 Datos de partida0.json guardados como nuevo save.json');
            
            return partida0Data;
          } catch (partida0Error) {
            logger.error('❌ Error al cargar partida0.json como respaldo:', partida0Error.message);
          }
        } catch (renameErr) {
          logger.error('❌ Error al renombrar archivo corrupto:', renameErr);
        }
      }
      
      logger.warn('⚠️ Usando datos por defecto como último recurso');
      return defaultData;
    }
  }
}

async function deleteSave() {
  try {
    await fs.unlink(SAVE_FILE_PATH);
    logger.info('🗑️ Partida eliminada en:', SAVE_FILE_PATH);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.error('❌ Error al eliminar partida:', error);
    }
  }
}

// Función auxiliar para limpiar archivos adicionales durante el reset
async function cleanAdditionalFiles() {
  const filesToClean = [
    'lifemissions.json',
    'diary.json', 
    'weekplan.json',
    'habitscalendar.json',
    'projects.json'
  ];
  
  const cleanResults = [];
  
  for (const fileName of filesToClean) {
    try {
      const filePath = path.join(SAVE_DIR, fileName);
      await fs.unlink(filePath);
      logger.info(`🧹 ${fileName} eliminado correctamente`);
      cleanResults.push({ file: fileName, success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info(`ℹ️ ${fileName} no existía, no necesita limpieza`);
        cleanResults.push({ file: fileName, success: true, notFound: true });
      } else {
        logger.warn(`⚠️ Error al eliminar ${fileName}:`, error.message);
        cleanResults.push({ file: fileName, success: false, error: error.message }); 
      }
    }
  }
  
  return cleanResults;
}

async function resetToPartida0() {
  try {
    logger.info('🔄 Iniciando reset completo del juego...');
    
    // Paso 1: Limpiar archivos adicionales
    logger.info('🧹 Limpiando archivos adicionales...');
    const cleanResults = await cleanAdditionalFiles();
    const cleanedFiles = cleanResults.filter(r => r.success).length;
    const totalFiles = cleanResults.length;
    logger.info(`✅ Limpieza completada: ${cleanedFiles}/${totalFiles} archivos procesados correctamente`);
    
    // Paso 2: Leer el contenido de partida0.json
    logger.info('📖 Cargando datos iniciales desde partida0.json...');
    const partida0Path = path.join(__dirname, '../../partida0.json');
    const partida0Content = await fs.readFile(partida0Path, 'utf-8');
    const partida0Data = JSON.parse(partida0Content);
    
    // Paso 3: Guardar esos datos en save.json usando la función saveGame existente
    logger.info('💾 Guardando datos iniciales como save.json...');
    await saveGame(partida0Data);
    
    logger.info('🎉 Reset completado exitosamente:');
    logger.info('   📁 partida0.json → save.json');
    logger.info('   🧹 Archivos adicionales limpiados');
    logger.info('   🎮 Juego listo para empezar desde cero');
    
    return true;
  } catch (error) {
    logger.error('❌ Error durante el reset:', error);
    return false;
  }
}

module.exports = {
  saveGame,
  loadGame,
  deleteSave,
  resetToPartida0,
};
