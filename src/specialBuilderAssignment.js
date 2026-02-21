import state from './state.js';
import { isBusy } from './heroes/index.js';
import { getItem, setItem } from './storage.js';
import { renderVillage } from './village.js';
import { openConfirm } from '../ui/modals.js';
import { appendOverlay, removeOverlay } from './ui/overlay.js';
import { MAX_HOUSES } from './buildings.js';
import { buildHouse } from '../script.js';
import { MAX_FOOD, MAX_WOOD, MAX_STONE, setMaxFood, setMaxWood, setMaxStone } from './resources.js';

const STORAGE_KEY = 'specialBuilderSlots';
const SLOT_CONFIG = [
  { slotId: 1, baseHours: 2, castle: false },
  { slotId: 2, baseHours: 2, castle: false },
  { slotId: 3, baseHours: 2, castle: false },
  { slotId: 4, baseHours: 8, castle: true },
  { slotId: 5, baseHours: 2, castle: false },
  { slotId: 6, baseHours: 2, castle: false },
  { slotId: 7, baseHours: 2, castle: false },
  { slotId: 8, baseHours: 8, castle: true },
];

let slots = [];

function saveSlots() {
  setItem(STORAGE_KEY, slots);
}

function requestSave() {
  import('../script.js').then(m => m.scheduleSaveGame && m.scheduleSaveGame()).catch(() => {});
}

function computeDisplayHours(slot) {
  const cfg = SLOT_CONFIG.find(c => c.slotId === slot.slotId);
  let h = cfg.baseHours;
  const hero = state.heroMap.get(slot.assignedHeroId);
  if (hero && Array.isArray(hero.professions) && hero.professions.some(p => p.toLowerCase() === 'builder')) {
    h /= 2;
  }
  return `${h}H`;
}

function displayBuildingName(name) {
  const map = { Pantry: 'FoodStorage', Lumberyard: 'WoodStorage', Quarry: 'StoneStorage' };
  return map[name] || name;
}

function checkSlots() {
  const now = Date.now();
  let changed = false;
  slots.forEach(s => {
    if (s.status === 'running' && s.startedAt) {
      const end = Date.parse(s.startedAt) + s.durationMs;
      if (end <= now) {
        s.status = 'completed';
        changed = true;
      }
    }
  });
  if (changed) {
    saveSlots();
    renderSection();
  }
}

export function initSpecialBuilderAssignment() {
  const stored = getItem(STORAGE_KEY) || [];
  slots = SLOT_CONFIG.map(cfg => {
    const found = stored.find(s => s.slotId === cfg.slotId) || {};
    return {
      slotId: cfg.slotId,
      assignedHeroId: found.assignedHeroId ?? null,
      startedAt: found.startedAt ?? null,
      durationMs: found.durationMs ?? 0,
      status: found.status ?? 'idle',
    };
  });
  state.specialBuilderSlots = slots;
  checkSlots();
  renderSection();
  setInterval(checkSlots, 3_600_000); // Cambiado de 1000ms a 1 hora para optimización
}

export function renderSection() {
  const section = document.getElementById('special-builder-assignment');
  if (!section) return;
  section.innerHTML = '';
  const title = document.createElement('h1');
  title.textContent = 'Special Builder Assignment';
  section.appendChild(title);
  const grid = document.createElement('div');
  grid.className = 'builder-grid';
  section.appendChild(grid);
  slots.forEach(slot => {
    const card = document.createElement('div');
    card.className = 'special-builder-card chief-card card';
    const t = document.createElement('div');
    t.style.fontWeight = 'bold';
    const cfg = SLOT_CONFIG.find(c => c.slotId === slot.slotId);
    t.textContent = cfg && cfg.castle ? `🏰 Builder ${slot.slotId}` : `Builder ${slot.slotId}`;
    card.appendChild(t);
    const avatar = document.createElement('div');
    avatar.className = 'builder-avatar';
    const hero = state.heroMap.get(slot.assignedHeroId);
    if (hero) {
      if (hero.avatar) {
        avatar.style.backgroundImage = `url(${hero.avatar})`;
      } else if (hero.avatarUrl) {
        avatar.style.backgroundImage = `url(${hero.avatarUrl})`;
      } else {
        avatar.textContent = '👤';
      }
    } else {
      avatar.textContent = '👤';
    }
    card.appendChild(avatar);

    if (slot.status === 'completed') {
      const gridWrap = document.createElement('div');
      gridWrap.className = 'builder-completed-grid';

      const nameEl = document.createElement('div');
      nameEl.className = 'builder-name';
      nameEl.textContent = hero ? hero.name : '';
      gridWrap.appendChild(nameEl);

      const status = document.createElement('div');
      status.setAttribute('role', 'status');
      status.textContent = 'Completed!';
      gridWrap.appendChild(status);

      const improve = document.createElement('button');
      improve.className = 'btn btn-blue';
      improve.textContent = 'Improve';
      improve.setAttribute('aria-label', 'Improve');
      improve.onclick = () => openImproveModal(slot.slotId);
      gridWrap.appendChild(improve);

      card.appendChild(gridWrap);
    } else {
      // Mostrar tiempo + botón × primero (si está corriendo)
      if (slot.status === 'running') {
        const row = document.createElement('div');
        row.setAttribute('role', 'status');
        row.textContent = computeDisplayHours(slot);
        const cancel = document.createElement('button');
        cancel.className = 'btn btn-red';
        cancel.textContent = '×';
        cancel.setAttribute('aria-label', 'Cancel assignment');
        cancel.onclick = () => cancelAssignment(slot.slotId);
        row.appendChild(cancel);
        card.appendChild(row);
      }

      // Luego mostrar el nombre del héroe
      if (hero) {
        const nameEl = document.createElement('div');
        nameEl.className = 'builder-name';
        nameEl.textContent = hero.name;
        card.appendChild(nameEl);
      }

      // Solo mostrar botón "Choose Builder" si no hay héroe asignado
      if (!slot.assignedHeroId) {
        const choose = document.createElement('button');
        choose.className = 'btn btn-celeste';
        choose.textContent = 'Choose Builder';
        choose.setAttribute('aria-label', 'Choose Builder');
        
        // Verificar si hay héroes disponibles con 100% de energía
        const taken = new Set(slots.filter(s => s.status !== 'idle').map(s => s.assignedHeroId));
        const hasAvailableHeroes = state.heroes.some(h => {
          const isBlocked = h.energia !== 100 || taken.has(h.id) || isBusy(h);
          return !isBlocked;
        });
        
        choose.disabled = slot.status !== 'idle' || !hasAvailableHeroes;
        if (!hasAvailableHeroes && slot.status === 'idle') {
          choose.title = 'Hero with 100% Energy is needed';
        }
        choose.onclick = () => openHeroPicker(slot.slotId);
        card.appendChild(choose);
      }
    }
    grid.appendChild(card);
  });
}

export function openHeroPicker(slotId) {
  if (window.perfOptimizations) performance.mark('open-hero-modal:start');
  const section = document.getElementById('special-builder-assignment');
  if (!section) return;
  section.querySelectorAll('.builder-modal-overlay').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'builder-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'builder-modal';
  
  const title = document.createElement('h3');
  title.textContent = 'Select Builder';
  title.className = 'builder-modal-title';
  modal.appendChild(title);

  const formGroup = document.createElement('div');
  formGroup.className = 'builder-form-group';
  
  const label = document.createElement('label');
  label.textContent = 'Choose Hero:';
  label.className = 'builder-label';
  formGroup.appendChild(label);

  const taken = new Set(slots.filter(s => s.status !== 'idle').map(s => s.assignedHeroId));
  const heroes = state.heroes.slice().sort(() => Math.random() - 0.5);

  const select = document.createElement('select');
  select.className = 'builder-select';
  heroes.forEach(h => {
    // Filtrar héroes bloqueados (no mostrar héroes que estarían deshabilitados)
    const isBlocked = h.energia !== 100 || taken.has(h.id) || isBusy(h);
    if (isBlocked) return; // No mostrar héroes bloqueados
    
    const opt = document.createElement('option');
    opt.value = h.id;
    const isBuilder = Array.isArray(h.professions) && h.professions.some(p => p.toLowerCase() === 'builder');
    const icon = isBuilder ? '🛠️ ' : '';
    opt.textContent = `${icon}${h.name} - Energy: ${h.energia ?? 0}%`;
    if (isBuilder) {
      opt.style.color = 'gold';
      opt.style.fontWeight = 'bold';
    }
    select.appendChild(opt);
  });
  const firstEnabled = Array.from(select.options).findIndex(o => !o.disabled);
  select.selectedIndex = firstEnabled;
  formGroup.appendChild(select);
  
  modal.appendChild(formGroup);

  const btnRow = document.createElement('div');
  btnRow.className = 'builder-modal-buttons';

  const confirm = document.createElement('button');
  confirm.className = 'btn btn-celeste';
  confirm.textContent = 'Confirm';
  confirm.disabled = firstEnabled === -1;
  confirm.onclick = () => {
    const heroId = select.value;
    if (heroId) assignHeroToSlot(slotId, heroId);
    overlay.remove();
  };
  btnRow.appendChild(confirm);

  const cancel = document.createElement('button');
  cancel.className = 'btn btn-lightyellow';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => overlay.remove();
  btnRow.appendChild(cancel);

  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  section.appendChild(overlay);

  if (window.perfOptimizations) {
    performance.mark('open-hero-modal:end');
    performance.measure('open-hero-modal', 'open-hero-modal:start', 'open-hero-modal:end');
  }

  if (firstEnabled === -1) {
    cancel.focus();
  } else {
    select.focus();
  }
}

export function assignHeroToSlot(slotId, heroId) {
  const id = parseInt(heroId);
  const hero = state.heroMap.get(id);
  if (!hero) return;
  const cfg = SLOT_CONFIG.find(c => c.slotId === slotId);
  let durationMs = cfg.baseHours * 60 * 60 * 1000;
  if (hero.professions && hero.professions.some(p => p.toLowerCase() === 'builder')) {
    durationMs /= 2;
  }
  hero.energia = 1;
  requestSave();
  const slot = slots.find(s => s.slotId === slotId);
  slot.assignedHeroId = id;
  slot.startedAt = new Date().toISOString();
  slot.durationMs = durationMs;
  slot.status = 'running';
  saveSlots();
  renderSection();
}

export function cancelAssignment(slotId) {
  const container = document.getElementById('special-builder-assignment');
  openConfirm({
    title: 'Cancel this assignment?',
    container,
    onConfirm() {
      resetSlot(slotId);
      renderSection();
    }
  });
}

function resetSlot(slotId) {
  const slot = slots.find(s => s.slotId === slotId);
  if (!slot) return;
  slot.assignedHeroId = null;
  slot.startedAt = null;
  slot.durationMs = 0;
  slot.status = 'idle';
  saveSlots();
}

export function resetAllSlots() {
  slots.forEach(slot => {
    slot.assignedHeroId = null;
    slot.startedAt = null;
    slot.durationMs = 0;
    slot.status = 'idle';
  });
  saveSlots();
  renderSection();
}

export function openImproveModal(slotId) {
  const cfg = SLOT_CONFIG.find(c => c.slotId === slotId);
  const container = document.getElementById('special-builder-assignment');
  if (cfg && cfg.castle) {
    openConfirm({
      title: 'Upgrade Castle?',
      onConfirm: () => confirmImprove(slotId, 'Castle'),
      container
    });
    return;
  }
  if (!container) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const title = document.createElement('h3');
  title.textContent = 'Choose Construction to Improve';
  modal.appendChild(title);

  const hiddenBuildings = ['ArcheryField', 'Ashram', 'BoxingRing', 'FortuneTotem', 'Gym', 'Hospital', 'LifeAltar', 'MageAcademy', 'Tower'];
  const buildings = Object.keys(state.buildingLevels || {})
    .filter(name => name !== 'Castle' && !hiddenBuildings.includes(name))
    .sort((a,b)=>displayBuildingName(a).localeCompare(displayBuildingName(b), undefined, {sensitivity:'base'}));

  const select = document.createElement('select');
  select.style.width = '100%';
  if (state.houses < MAX_HOUSES) {
    const houseOpt = document.createElement('option');
    houseOpt.value = 'Houses';
    houseOpt.textContent = `Houses (${state.houses}/${MAX_HOUSES})`;
    select.appendChild(houseOpt);
  }
  buildings.forEach(name => {
    const opt = document.createElement('option');
    const lvl = state.buildingLevels[name] || 0;
    opt.value = name;
    opt.textContent = `${displayBuildingName(name)} (Lv ${lvl})`;
    select.appendChild(opt);
  });
  modal.appendChild(select);

  const btnRow = document.createElement('div');
  btnRow.className = 'builder-modal-buttons';

  const confirm = document.createElement('button');
  confirm.className = 'btn btn-celeste';
  confirm.textContent = 'Confirm';
  confirm.onclick = () => { confirmImprove(slotId, select.value); removeOverlay(overlay); };
  btnRow.appendChild(confirm);

  const cancel = document.createElement('button');
  cancel.className = 'btn btn-lightyellow';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => removeOverlay(overlay);
  btnRow.appendChild(cancel);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
  select.focus();
}

function showMessage(message) {
  const container = document.getElementById('special-builder-assignment');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay card-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const msgEl = document.createElement('p');
  msgEl.style.margin = '0 0 16px';
  msgEl.textContent = message;
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn-celeste white-text';
  ok.textContent = 'Accept';
  ok.onclick = () => removeOverlay(overlay);
  modal.appendChild(msgEl);
  modal.appendChild(ok);
  overlay.appendChild(modal);
  appendOverlay(overlay, container);
  ok.focus();
}

export function confirmImprove(slotId, buildingName) {
  try {
    // Obtener el héroe asignado antes de resetear el slot
    const slot = slots.find(s => s.slotId === slotId);
    const assignedHero = slot && slot.assignedHeroId ? state.heroMap.get(slot.assignedHeroId) : null;
    
    let message;
    if (buildingName === 'Houses') {
      if (state.houses >= MAX_HOUSES) {
        showMessage(`Cannot build more Houses (${state.houses}/${MAX_HOUSES})`);
        return;
      }
      buildHouse();
      message = `Built House (${state.houses}/${MAX_HOUSES})`;
    } else {
      const lvl = levelUp(buildingName);
      message = `Improved ${displayBuildingName(buildingName)} to level ${lvl}`;
    }
    
    resetSlot(slotId);
    
    // Si hay un héroe asignado y tiene poca energía, ponerlo a descansar automáticamente
    if (assignedHero && assignedHero.energia <= 1) {
      // Importar las funciones de descanso del script principal
      import('../script.js').then(m => {
        if (m.autoStartRest) {
          m.autoStartRest(assignedHero);
        }
      }).catch(() => {});
    }
    
    renderSection();
    showMessage(message);
  } catch (err) {
    showMessage('Upgrade failed. Please try again.');
  }
}

export function levelUp(buildingName) {
  state.buildingLevels[buildingName] = (state.buildingLevels[buildingName] || 0) + 1;
  const lvl = state.buildingLevels[buildingName];
  if (buildingName === 'Pantry') {
    setMaxFood((lvl + 1) * 10);
  }
  if (buildingName === 'Lumberyard') {
    setMaxWood((lvl + 1) * 10);
  }
  if (buildingName === 'Quarry') {
    setMaxStone((lvl + 1) * 10);
  }
  import('../script.js')
    .then(m => {
      if (buildingName === 'Castle' && m.updateMaxLevelsFromCastle) {
        m.updateMaxLevelsFromCastle();
      }
      if (m.updateResourcesDisplay) m.updateResourcesDisplay();
    })
    .catch(() => {});
  renderVillage();
  requestSave();
  return state.buildingLevels[buildingName];
}

