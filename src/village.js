import state from './state.js';
import {
  showBuildModal,
  showVillageExtra,
  showInlineBuildTimer,
  showUpgradeInlineTimer,
  updateBuildButtonHeight,
  getBuildHouseTooltip,
  getUpgradeTooltip,
  getUpgradeRequirements,
  buyTerrain,
  MAX_PETS,
  MAX_TERRAIN
} from '../script.js';
import { MAX_HOUSES, getTerrainCost } from './buildings.js';

const upgradeButtonRefs = {};
let buildBtn = null;
let buildWrap = null;

/**
 * Render the village overview and build/upgrade controls. The function
 * rebuilds the section each time to reflect the current game state.
 *
 * @returns {void}
 */
export function renderVillage() {
  const overview = document.getElementById("village-overview-card");
  const card = document.getElementById("build-house-card");
  const selectCard = document.getElementById("build-select-card");
  if (!card) return;
  if (overview) {
    overview.innerHTML = "";

    const b = state.buildingLevels;
    const lvl = label => `Lv ${b[label] ?? 0}`;
    const totalPets = state.heroes.filter(h => h.pet).length;
    // Calcular capacidad real de mascotas basada en el nivel de PetSanctuary
    const actualMaxPets = 5 + (b.PetSanctuary || 0);
    const items = [
      ["\u{1F3E0}", `House\n${state.houses}/${MAX_HOUSES}`],
      ["\u{1F43E}", `PetSanct.\n${totalPets}/${actualMaxPets}`],
      ["\u{1F357}", `FoodStor\n${lvl("Pantry")}`],
      ["\u{1FAB5}", `WoodStor\n${lvl("Lumberyard")}`],
      ["\u{1FAA8}", `StoneStor\n${lvl("Quarry")}`],
      ["\u{1F3F0}", `Castle\n${lvl("Castle")}`],
      ["\u{1F4B0}", `Dungeon\n${lvl("Dungeons")}`],
      // Edificios ocultos (posiciones 9-16) - Pueden volver a usarse en el futuro
      // ["\u{1F94A}", `BoxRing ${lvl("BoxingRing")}`],
      // ["\u{1F3CB}\uFE0F", `Gym ${lvl("Gym")}`],
      // ["\u{1F3F9}", `Archery ${lvl("ArcheryField")}`],
      // ["\u{1F52D}", `MageAcad ${lvl("MageAcademy")}`],
      // ["\u{1F3E5}", `Hospital ${lvl("Hospital")}`],
      // ["\u{1F64F}", `Ashram ${lvl("Ashram")}`],
      // ["\u{1F48A}", `LifeAltar ${lvl("LifeAltar")}`],
      // ["\u{1F381}", `Fortune ${lvl("FortuneTotem")}`],
    ];
    items.forEach(([icon, text]) => {
      const d = document.createElement("div");
      d.className = "overview-item";
      const i = document.createElement("div");
      i.className = "icon";
      i.textContent = icon;
      const t = document.createElement("div");
      t.innerHTML = text.replace(/\n/g, '<br>');
      d.appendChild(i);
      d.appendChild(t);
      overview.appendChild(d);
    });
  }
  if (selectCard) {
    const upgrading = Object.values(state.upgradeTasks).some(t => t.time > 0);
    if (!state.buildSelectionOpen && state.buildingTask.time <= 0 && !upgrading && selectCard.style.display === "none") {
      selectCard.innerHTML = "";
    }
  }

  const fragment = document.createDocumentFragment();

  function ensureBuildButton() {
    if (!buildWrap) {
      buildWrap = document.createElement("div");
      buildWrap.id = "build-house-column";
      buildWrap.className = "build-column";
      buildWrap.style.display = "flex";
      buildWrap.style.flexDirection = "column";
      buildWrap.style.alignItems = "center";
      buildBtn = document.createElement("button");
      buildBtn.id = "btn-build-house";
      buildBtn.className = "btn btn-celeste";
      buildBtn.style.width = "100%";
      buildBtn.style.padding = "6px 12px";
      buildBtn.style.flex = "0";
      buildBtn.type = "button";
      buildWrap.appendChild(buildBtn);
      fragment.appendChild(buildWrap);
    }
    buildBtn.textContent = "Houses";
    const cost = 10 * (state.houses + 1);
    const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
    const disabled = state.houses >= state.terrain * 5 || state.buildingTask.time > 0 || insufficient;
    buildBtn.disabled = disabled;
    buildBtn.style.background = disabled ? 'gray' : '';
    buildBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (state.houses >= state.terrain * 5) {
      buildWrap.title = "Need more terrain";
    } else if (state.buildingTask.time > 0) {
      buildWrap.title = "House under construction";
    } else {
      buildWrap.title = getBuildHouseTooltip();
    }
    if (!disabled) {
      buildBtn.onclick = e => {
        e.preventDefault();
        showBuildModal();
      };
    } else {
      buildBtn.onclick = null;
    }
  }

  function ensureUpgradeButton(label, text = label) {
    if (!upgradeButtonRefs[label]) {
      const wrap = document.createElement("div");
      wrap.id = `wrap-${label}`;
      wrap.className = "build-column";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      const btn = document.createElement("button");
      btn.id = `btn-${label}`;
      btn.className = "btn btn-celeste";
      btn.style.width = "100%";
      btn.style.padding = "6px 12px";
      btn.style.flex = "0";
      btn.type = "button";
      wrap.appendChild(btn);
      upgradeButtonRefs[label] = { wrap, btn };
      fragment.appendChild(wrap);
    }
    const { wrap, btn } = upgradeButtonRefs[label];
    btn.textContent = text;
    const tip = getUpgradeTooltip(label);
    wrap.title = tip;
    const { cost } = getUpgradeRequirements(label);
    const insufficient = state.food < cost || state.wood < cost || state.stone < cost;
    const upgrading = state.upgradeTasks[label] && state.upgradeTasks[label].time > 0;
    btn.disabled = upgrading || insufficient;
    btn.style.background = btn.disabled ? 'gray' : '';
    btn.style.filter = '';
    btn.style.opacity = '';
    btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
    if (upgrading) {
      wrap.title = `${label} upgrading`;
      btn.onclick = null;
    } else if (!btn.disabled) {
      btn.onclick = () => { showVillageExtra(label); };
    } else {
      btn.onclick = null;
    }
  }

  ensureBuildButton();
  const totalPetsBtn = state.heroes.filter(h => h.pet).length;
  // Calcular capacidad real de mascotas basada en el nivel de PetSanctuary
  const actualMaxPets = 5 + (state.buildingLevels.PetSanctuary || 0);
  ensureUpgradeButton("PetSanctuary", `PetSanctuary (${totalPetsBtn}/${actualMaxPets})`);
  ensureUpgradeButton("Pantry", "FoodStorage");
  ensureUpgradeButton("Lumberyard", "WoodStorage");
  ensureUpgradeButton("Quarry", "StoneStorage");
  ensureUpgradeButton("Castle", "Castle");
  ensureUpgradeButton("Dungeons", "Dungeons");
  // Botones de upgrade ocultos - Pueden volver a usarse en el futuro
  // ensureUpgradeButton("Hospital", "Hospital");
  // ensureUpgradeButton("Gym", "Gym(Str)");
  // ensureUpgradeButton("ArcheryField", "ArcheryField(Dex)");
  // ensureUpgradeButton("MageAcademy", "MageAcademy(Int)");
  // ensureUpgradeButton("BoxingRing", "BoxingRing(Def)");
  // ensureUpgradeButton("Ashram", "Ashram(Mana)");
  // ensureUpgradeButton("LifeAltar", "LifeAltar(HP)");
  // ensureUpgradeButton("FortuneTotem", "FortuneTotem(Luck)");

  if (fragment.childNodes.length) {
    card.appendChild(fragment);
  }

  if (state.buildingTask.time > 0 && (!selectCard || selectCard.style.display === "none")) {
    showInlineBuildTimer();
  }
  Object.entries(state.upgradeTasks).forEach(([label, task]) => {
    if (task.time > 0 && (!selectCard || selectCard.style.display === "none")) {
      showUpgradeInlineTimer(label);
    }
  });
  updateBuildButtonHeight();
}

export function renderTerrains() {
  const card = document.getElementById("terrain-card");
  const card2 = document.getElementById("terrain-card-2");
  if (!card) return;
  const title = document.querySelector("#terrain-section h1");
  if (title) title.textContent = `My Terrains (${state.terrain}/${MAX_TERRAIN})`;
  card.innerHTML = "";
  card.style.display = "flex";
  card.style.gap = "10px";
  const viewBtn = document.createElement("button");
  viewBtn.textContent = "ViewTerrain";
  viewBtn.className = "btn btn-celeste";
  viewBtn.style.flex = "1";
  viewBtn.onclick = () => {
    if (card2) {
      card2.style.display = card2.style.display === "none" ? "block" : "none";
    }
  };
  card.appendChild(viewBtn);
  const btn = document.createElement("button");
  const cost = getTerrainCost();
  btn.textContent = `Buy Terrain (${cost} gold)`;
  btn.className = "btn btn-celeste";
  btn.style.flex = "1";
  btn.disabled = state.terrain >= MAX_TERRAIN || state.money < cost;
  if (btn.disabled) btn.title = state.terrain >= MAX_TERRAIN ? "Max terrain reached" : "Not Enough Gold";
  btn.onclick = buyTerrain;
  card.appendChild(btn);
  if (card2) {
    card2.innerHTML = "";
    const close = document.createElement("button");
    close.textContent = "❌";
    close.className = "close-btn";
    close.onclick = () => { card2.style.display = "none"; };
    card2.appendChild(close);
    const img = document.createElement("img");
    img.src = "src/Buildings/Terrain.jpg";
    img.style.maxWidth = "40%";
    img.style.display = "block";
    img.style.margin = "0 auto";
    card2.appendChild(img);
    card2.style.display = "none";
  }
}
