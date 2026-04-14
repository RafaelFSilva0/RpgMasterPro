/**
 * ══════════════════════════════════════════════════
 *  PAINEL DO MESTRE RPG PRO v3 — script.js
 *  Arquitetura modular: Store → UI → Módulos
 * ══════════════════════════════════════════════════
 */
'use strict';

/* ══════════════════════════════════════════════════
   STORE — estado global centralizado
══════════════════════════════════════════════════ */
const Store = (() => {
  const KEYS = {
    players:       'rpg3_players',
    npcs:          'rpg3_npcs',
    relationships: 'rpg3_relationships',
    items:         'rpg3_items',
    combat:        'rpg3_combat',
    notes:         'rpg3_notes',
    organizations: 'rpg3_organizations',
    masterLogs:    'rpg3_masterlogs',
    loreProfiles:  'rpg3_loreprofiles',
  };

  const state = {
    players:       [],
    npcs:          [],
    relationships: [],   // { id, npcId, playerId, value(1-5), note, updatedAt }
    items:         [],   // { id, name, description, image, holderType, holderId, locationNote, ... }
    combat:        { combatants: [], currentTurn: 0, round: 1 },
    notes:         [],
    organizations: [],
    masterLogs:    [],
    loreProfiles:  [],
  };

  function load() {
    for (const [key, sk] of Object.entries(KEYS)) {
      try {
        const raw = localStorage.getItem(sk);
        if (raw) state[key] = JSON.parse(raw);
      } catch (e) { console.error(`Store.load ${key}:`, e); }
    }
  }

  function save(key) {
    try { localStorage.setItem(KEYS[key], JSON.stringify(state[key])); }
    catch (e) { console.error(`Store.save ${key}:`, e); }
    App.updateBadges();
  }

  function get(key) { return state[key]; }

  function set(key, value) { state[key] = value; save(key); }

  return { load, save, get, set };
})();

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function genId()  { return '_' + Math.random().toString(36).substr(2, 9); }
function now()    { return new Date().toISOString(); }

function esc(v) {
  const m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' };
  return String(v ?? '').replace(/[&<>"']/g, c => m[c]);
}

function formatTs(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function hpClass(cur, max) {
  if (!max) return 'high';
  const p = (cur / max) * 100;
  return p > 60 ? 'high' : p > 30 ? 'medium' : 'low';
}
function hpPct(cur, max) {
  if (!max) return 0;
  return Math.min(100, Math.max(0, (cur / max) * 100));
}

/** Render avatar img+fallback combo */
function avHtml(url, ph, cls='avatar', phCls='avatar-ph') {
  if (!url) return `<span class="${phCls}">${ph}</span>`;
  return `<img src="${esc(url)}" class="${cls}" alt=""
    onclick="UI.openLightbox('${esc(url)}')"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
  /><span class="${phCls}" style="display:none">${ph}</span>`;
}

/** Resolve entity name by id (NPC or Player) */
function entityName(id) {
  const n = Store.get('npcs').find(x => x.id === id);
  if (n) return n.name;
  const p = Store.get('players').find(x => x.id === id);
  if (p) return p.characterName;
  return id;
}
function entityImg(id) {
  const n = Store.get('npcs').find(x => x.id === id);
  if (n) return n.image || '';
  const p = Store.get('players').find(x => x.id === id);
  if (p) return p.image || '';
  return '';
}

/* ══════════════════════════════════════════════════
   UI — utilitários de interface
══════════════════════════════════════════════════ */
const UI = {
  openModal(id)  { document.getElementById(id).classList.add('open'); document.body.style.overflow='hidden'; },
  closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow=''; },
  closeOnOverlay(e, id) { if (e.target === document.getElementById(id)) this.closeModal(id); },

  previewImg(inputId, previewId, phId) {
    const url = document.getElementById(inputId).value.trim();
    const img = document.getElementById(previewId);
    const ph  = document.getElementById(phId);
    if (url) {
      img.src = url; img.style.display = 'block';
      if (ph) ph.style.display = 'none';
      img.onerror = () => { img.style.display='none'; if (ph) ph.style.display=''; };
    } else {
      img.style.display = 'none';
      if (ph) ph.style.display = '';
    }
  },

  openLightbox(src) {
    if (!src || src === 'undefined') return;
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
  },
  closeLightbox() { document.getElementById('lightbox').classList.remove('open'); },

  toast(msg, type = 'info', ms = 2800) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${{success:'✅',error:'❌',info:'⚡'}[type]||'⚡'}</span><span>${esc(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => {
      t.style.animation = 't-out .3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, ms);
  },

  confirm(title, message, onOk) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent   = message;
    document.getElementById('confirm-ok-btn').onclick = () => { this.closeModal('modal-confirm'); onOk(); };
    this.openModal('modal-confirm');
  },

  clearForm(fields) {
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  },

  resetImgPreview(prevId, phId) {
    const img = document.getElementById(prevId);
    const ph  = document.getElementById(phId);
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (ph)  ph.style.display = '';
  },
};

/* ══════════════════════════════════════════════════
   APP — navegação global e timers
══════════════════════════════════════════════════ */
const App = {
  _sessionStart: Date.now(),

  switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  },

  updateBadges() {
    const s = Store.get;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('badge-players',       s('players').length);
    set('badge-npcs',          s('npcs').length);
    set('badge-relationships', s('relationships').length);
    set('badge-items',         s('items').length);
    set('badge-combat',        s('combat').combatants.length);
    set('badge-lore',          s('masterLogs').length);
    set('badge-notes',         s('notes').length);
  },

  updateClock() {
    const elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2,'0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2,'0');
    const s = String(elapsed % 60).padStart(2,'0');
    const el = document.getElementById('session-time');
    if (el) el.textContent = `${h}:${m}:${s}`;
  },

  confirmClearAll() {
    UI.confirm('⚠️ Limpar Tudo', 'Apaga TODOS os dados. Ação irreversível!', () => {
      ['players','npcs','relationships','items','notes','organizations','masterLogs','loreProfiles'].forEach(k => Store.set(k, []));
      Store.set('combat', { combatants:[], currentTurn:0, round:1 });
      renderAll();
      UI.toast('Painel limpo.', 'info');
    });
  },

  init() {
    Store.load();
    renderAll();
    this.updateBadges();
    setInterval(() => this.updateClock(), 1000);
    this.switchTab('players');
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => {
          m.classList.remove('open'); document.body.style.overflow = '';
        });
      }
      if (!e.target.matches('input,textarea,select')) {
        const ct = document.getElementById('tab-combat');
        if (ct && ct.classList.contains('active')) {
          if (e.key === 'ArrowRight') CombatMod.nextTurn();
          if (e.key === 'ArrowLeft')  CombatMod.prevTurn();
        }
      }
    });
    console.log('%c⚔️ Mestre RPG PRO v3', 'color:#c9a96e;font-size:16px;font-weight:bold');
  },
};

function renderAll() {
  PlayerMod.render();
  NpcMod.render();
  RelMod.renderNpcList();
  ItemMod.render();
  CombatMod.render();
  LoreMod.renderLogs(); LoreMod.renderOrgs(); LoreMod.renderProfiles();
  NoteMod.render();
}

/* ══════════════════════════════════════════════════
   PLAYERS MODULE
══════════════════════════════════════════════════ */
const PlayerMod = {
  openModal(id = null) {
    const isEdit = id != null;
    document.getElementById('player-modal-title').textContent = isEdit ? '✏️ Editar Jogador' : '👥 Novo Jogador';
    UI.clearForm(['player-id','player-image','player-charname','player-playername','player-notes']);
    UI.resetImgPreview('player-img-prev','player-img-ph');
    if (isEdit) {
      const p = Store.get('players').find(x => x.id === id);
      if (!p) return;
      document.getElementById('player-id').value         = p.id;
      document.getElementById('player-image').value      = p.image || '';
      document.getElementById('player-charname').value   = p.characterName;
      document.getElementById('player-playername').value = p.playerName || '';
      document.getElementById('player-notes').value      = p.notes || '';
      if (p.image) UI.previewImg('player-image','player-img-prev','player-img-ph');
    }
    UI.openModal('modal-player');
  },

  save() {
    const charName = document.getElementById('player-charname').value.trim();
    if (!charName) { UI.toast('Nome do personagem é obrigatório.','error'); return; }
    const id = document.getElementById('player-id').value;
    const data = {
      characterName: charName,
      playerName:    document.getElementById('player-playername').value.trim(),
      image:         document.getElementById('player-image').value.trim(),
      notes:         document.getElementById('player-notes').value.trim(),
    };
    const players = Store.get('players');
    if (id) {
      const i = players.findIndex(x => x.id === id);
      if (i !== -1) players[i] = { ...players[i], ...data };
      UI.toast(`"${charName}" atualizado!`, 'success');
    } else {
      players.push({ id: genId(), ...data, createdAt: now() });
      UI.toast(`"${charName}" criado!`, 'success');
    }
    Store.save('players');
    this.render();
    UI.closeModal('modal-player');
  },

  delete(id) {
    const p = Store.get('players').find(x => x.id === id);
    if (!p) return;
    UI.confirm('🗑️ Remover Jogador', `Remover "${p.characterName}"?`, () => {
      Store.set('players', Store.get('players').filter(x => x.id !== id));
      Store.set('combat', { ...Store.get('combat'), combatants: Store.get('combat').combatants.filter(c => c.playerId !== id) });
      this.render(); CombatMod.render();
      UI.toast('Jogador removido.', 'info');
    });
  },

  addToCombat(id) {
    const p = Store.get('players').find(x => x.id === id);
    if (!p) return;
    if (Store.get('combat').combatants.find(c => c.playerId === id)) {
      UI.toast(`"${p.characterName}" já está no combate.`, 'error'); return;
    }
    const initStr = prompt(`Iniciativa de "${p.characterName}":`, '');
    if (initStr === null) return;
    const initiative = parseInt(initStr);
    if (isNaN(initiative)) { UI.toast('Iniciativa inválida.', 'error'); return; }
    const combat = Store.get('combat');
    combat.combatants.push({ id:genId(), name:p.characterName, initiative, hp:0, hpMax:0, dead:false, playerId:id, npcId:null, image:p.image||'' });
    CombatMod._sort(); Store.save('combat'); CombatMod.render();
    UI.toast(`"${p.characterName}" adicionado!`, 'success');
    App.switchTab('combat');
  },

  render() {
    const list   = document.getElementById('player-list');
    const empty  = document.getElementById('player-empty');
    const search = (document.getElementById('player-search')?.value || '').toLowerCase().trim();
    const data   = Store.get('players').filter(p =>
      !search || p.characterName.toLowerCase().includes(search) || (p.playerName||'').toLowerCase().includes(search)
    );
    list.innerHTML = '';
    empty.classList.toggle('visible', data.length === 0);
    data.forEach(p => list.appendChild(this._card(p)));
  },

  _card(p) {
    const card = document.createElement('div');
    card.className = 'entity-card align-player';
    // Itens em posse
    const ownedItems = Store.get('items').filter(i => i.holderType === 'player' && i.holderId === p.id);
    const itemsBadge = ownedItems.length ? `<span class="badge badge-item-player">🎒 ${ownedItems.length} ite${ownedItems.length>1?'ns':'m'}</span>` : '';
    card.innerHTML = `
      <div class="card-avatar-row" onclick="PlayerMod.openModal('${p.id}')">
        ${avHtml(p.image,'👤')}
        <div class="card-info">
          <div class="card-name">${esc(p.characterName)}</div>
          <div class="card-meta">
            <span class="badge badge-player">Jogador</span>
            ${p.playerName ? `<span style="font-size:11px;color:var(--txt-m)">🎮 ${esc(p.playerName)}</span>` : ''}
            ${itemsBadge}
          </div>
        </div>
      </div>
      ${p.notes ? `<div class="tags-row"><span style="font-size:12px;color:var(--txt-m);font-style:italic;padding:0 0 6px 0">${esc(p.notes)}</span></div>` : ''}
      <div class="card-actions">
        <button class="card-btn edit"   onclick="PlayerMod.openModal('${p.id}')">✏️ Editar</button>
        <button class="card-btn combat" onclick="PlayerMod.addToCombat('${p.id}')">⚔️ Combate</button>
        <button class="card-btn rel"    onclick="RelMod.openForPlayer('${p.id}')">❤️ Rel.</button>
        <button class="card-btn delete" onclick="PlayerMod.delete('${p.id}')">🗑️</button>
      </div>
    `;
    return card;
  },
};

/* ══════════════════════════════════════════════════
   NPC MODULE
══════════════════════════════════════════════════ */
const NpcMod = {
  _filter: 'all',
  _detailId: null,
  _detailTab: 'info',

  setFilter(f, el) {
    this._filter = f;
    document.querySelectorAll('#tab-npcs .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    this.render();
  },

  openModal(id = null) {
    const isEdit = id != null;
    document.getElementById('npc-modal-title').textContent = isEdit ? '✏️ Editar NPC' : '✨ Novo NPC';
    UI.clearForm(['npc-id','npc-image','npc-name','npc-tags','npc-desc','npc-hp','npc-hp-max','npc-sheet-stats','npc-sheet-abilities','npc-sheet-notes']);
    document.getElementById('npc-importance').value = 'secundario';
    document.getElementById('npc-alignment').value  = 'neutro';
    document.getElementById('npc-hostility').value  = 'nao_hostil';
    document.getElementById('npc-status').value     = 'Vivo';
    UI.resetImgPreview('npc-img-prev','npc-img-ph');
    if (isEdit) {
      const n = Store.get('npcs').find(x => x.id === id);
      if (!n) return;
      document.getElementById('npc-id').value              = n.id;
      document.getElementById('npc-image').value           = n.image || '';
      document.getElementById('npc-name').value            = n.name;
      document.getElementById('npc-importance').value      = n.importance || 'secundario';
      document.getElementById('npc-alignment').value       = n.alignment  || 'neutro';
      document.getElementById('npc-hostility').value       = n.hostility  || 'nao_hostil';
      document.getElementById('npc-status').value          = n.status     || 'Vivo';
      document.getElementById('npc-hp').value              = n.hp ?? '';
      document.getElementById('npc-hp-max').value          = n.hpMax ?? '';
      document.getElementById('npc-tags').value            = n.tags || '';
      document.getElementById('npc-desc').value            = n.description || '';
      document.getElementById('npc-sheet-stats').value     = n.sheet?.stats     || '';
      document.getElementById('npc-sheet-abilities').value = n.sheet?.abilities || '';
      document.getElementById('npc-sheet-notes').value     = n.sheet?.notes     || '';
      if (n.image) UI.previewImg('npc-image','npc-img-prev','npc-img-ph');
    }
    UI.openModal('modal-npc');
  },

  save() {
    const name = document.getElementById('npc-name').value.trim();
    if (!name) { UI.toast('Nome é obrigatório.','error'); return; }
    const id    = document.getElementById('npc-id').value;
    const hp    = parseInt(document.getElementById('npc-hp').value)     || 0;
    const hpMax = parseInt(document.getElementById('npc-hp-max').value) || 0;
    const data  = {
      name,
      image:       document.getElementById('npc-image').value.trim(),
      importance:  document.getElementById('npc-importance').value,
      alignment:   document.getElementById('npc-alignment').value,
      hostility:   document.getElementById('npc-hostility').value,
      status:      document.getElementById('npc-status').value,
      hp, hpMax,
      tags:        document.getElementById('npc-tags').value.trim(),
      description: document.getElementById('npc-desc').value.trim(),
      sheet: {
        stats:     document.getElementById('npc-sheet-stats').value.trim(),
        abilities: document.getElementById('npc-sheet-abilities').value.trim(),
        notes:     document.getElementById('npc-sheet-notes').value.trim(),
      },
    };
    const npcs = Store.get('npcs');
    if (id) {
      const i = npcs.findIndex(x => x.id === id);
      if (i !== -1) npcs[i] = { ...npcs[i], ...data };
      UI.toast(`"${name}" atualizado!`, 'success');
    } else {
      npcs.push({ id:genId(), ...data, createdAt:now() });
      UI.toast(`"${name}" criado!`, 'success');
    }
    Store.save('npcs');
    this.render();
    UI.closeModal('modal-npc');
  },

  delete(id) {
    const n = Store.get('npcs').find(x => x.id === id);
    if (!n) return;
    UI.confirm('🗑️ Deletar NPC', `Remover "${n.name}"?`, () => {
      Store.set('npcs', Store.get('npcs').filter(x => x.id !== id));
      Store.set('combat', { ...Store.get('combat'), combatants: Store.get('combat').combatants.filter(c => c.npcId !== id) });
      this.render(); CombatMod.render();
      UI.toast(`"${n.name}" removido.`, 'info');
    });
  },

  addToCombat(id) {
    const n = Store.get('npcs').find(x => x.id === id);
    if (!n) return;
    if (Store.get('combat').combatants.find(c => c.npcId === id)) {
      UI.toast(`"${n.name}" já está no combate.`, 'error'); return;
    }
    const initStr = prompt(`Iniciativa de "${n.name}":`, '');
    if (initStr === null) return;
    const initiative = parseInt(initStr);
    if (isNaN(initiative)) { UI.toast('Iniciativa inválida.', 'error'); return; }
    const combat = Store.get('combat');
    combat.combatants.push({ id:genId(), name:n.name, initiative, hp:n.hp||0, hpMax:n.hpMax||0, dead:n.status==='Morto', npcId:id, playerId:null, image:n.image||'' });
    CombatMod._sort(); Store.save('combat'); CombatMod.render();
    UI.toast(`"${n.name}" adicionado!`, 'success');
    App.switchTab('combat');
  },

  render() {
    const search = (document.getElementById('npc-search')?.value || '').toLowerCase().trim();
    const f      = this._filter;
    const lists  = { principal:[], secundario:[] };

    Store.get('npcs').forEach(n => {
      if (search && !n.name.toLowerCase().includes(search) && !(n.tags||'').toLowerCase().includes(search) && !(n.description||'').toLowerCase().includes(search)) return;
      if (f !== 'all') {
        if (f === 'principal'  && n.importance !== 'principal')  return;
        if (f === 'secundario' && n.importance !== 'secundario') return;
        if (f === 'aliado'     && n.alignment  !== 'aliado')     return;
        if (f === 'inimigo'    && n.alignment  !== 'inimigo')    return;
        if (f === 'hostil'     && n.hostility  !== 'hostil')     return;
      }
      lists[n.importance === 'principal' ? 'principal' : 'secundario'].push(n);
    });

    const total = lists.principal.length + lists.secundario.length;
    document.getElementById('npc-empty').classList.toggle('visible', total === 0);
    ['principal','secundario'].forEach(g => {
      const el = document.getElementById(`npc-list-${g}`);
      el.innerHTML = '';
      lists[g].forEach(n => el.appendChild(this._card(n)));
    });
  },

  _card(n) {
    const pct = hpPct(n.hp, n.hpMax);
    const cls = hpClass(n.hp, n.hpMax);
    const statusEmoji = { Vivo:'💚', Morto:'💀', Inconsciente:'💛' };
    const alignLabel  = { aliado:'🟢 Aliado', inimigo:'🔴 Inimigo', neutro:'⚪ Neutro' };
    const tagsHtml    = (n.tags||'').split(',').map(t=>t.trim()).filter(Boolean)
      .map(t=>`<span class="tag" onclick="event.stopPropagation();NpcMod._tagSearch('${esc(t)}')">${esc(t)}</span>`).join('');
    const ownedItems  = Store.get('items').filter(i => i.holderType === 'npc' && i.holderId === n.id);
    const itemsBadge  = ownedItems.length ? `<span class="badge badge-item-npc">🎒 ${ownedItems.length}</span>` : '';

    const card = document.createElement('div');
    card.className = `entity-card align-${n.alignment||'neutro'} status-${(n.status||'').toLowerCase().replace(' ','')}`;
    card.innerHTML = `
      ${n.importance === 'principal' ? '<span class="ribbon">PRINCIPAL</span>' : ''}
      <div class="card-avatar-row" onclick="NpcMod.openDetail('${n.id}')">
        ${avHtml(n.image,'🧑')}
        <div class="card-info">
          <div class="card-name">${statusEmoji[n.status]||'💚'} ${esc(n.name)}</div>
          <div class="card-meta">
            <span class="badge badge-align-${n.alignment||'neutro'}">${alignLabel[n.alignment]||'Neutro'}</span>
            ${n.hostility==='hostil'?'<span class="badge badge-hostil">⚠️ Hostil</span>':''}
            <span class="badge badge-status-${(n.status||'vivo').toLowerCase().replace(' ','')}">${esc(n.status||'Vivo')}</span>
            ${itemsBadge}
          </div>
        </div>
      </div>
      ${n.hpMax ? `<div class="card-hp-row"><div class="hp-label-row"><span>HP</span><span>${n.hp}/${n.hpMax}</span></div><div class="hp-bar"><div class="hp-fill ${cls}" style="width:${pct}%"></div></div></div>` : ''}
      ${tagsHtml ? `<div class="tags-row">${tagsHtml}</div>` : ''}
      <div class="card-actions">
        <button class="card-btn edit"   onclick="event.stopPropagation();NpcMod.openModal('${n.id}')">✏️</button>
        <button class="card-btn sheet"  onclick="event.stopPropagation();NpcMod.openDetail('${n.id}','sheet')">📋 Ficha</button>
        <button class="card-btn combat" onclick="event.stopPropagation();NpcMod.addToCombat('${n.id}')">⚔️</button>
        <button class="card-btn delete" onclick="event.stopPropagation();NpcMod.delete('${n.id}')">🗑️</button>
      </div>
    `;
    return card;
  },

  _tagSearch(tag) {
    document.getElementById('npc-search').value = tag;
    this.setFilter('all', document.querySelector('[data-nf="all"]'));
  },

  openDetail(id, tab = 'info') {
    this._detailId  = id;
    this._detailTab = tab;
    const n = Store.get('npcs').find(x => x.id === id);
    if (!n) return;
    document.getElementById('detail-name').textContent = n.name;
    const colors = { aliado:'var(--green)', inimigo:'var(--red)', neutro:'var(--gray)' };
    document.getElementById('detail-header').style.borderBottom = `2px solid ${colors[n.alignment]||'var(--gold)'}`;
    document.getElementById('detail-combat-btn').onclick = () => { UI.closeModal('modal-npc-detail'); NpcMod.addToCombat(id); };
    document.getElementById('detail-edit-btn').onclick   = () => { UI.closeModal('modal-npc-detail'); NpcMod.openModal(id); };
    // Activate tab
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    const tabs = document.querySelectorAll('.detail-tab');
    const tabIdx = { info:0, sheet:1, relations:2, items:3 };
    if (tabs[tabIdx[tab]]) tabs[tabIdx[tab]].classList.add('active');
    this._renderDetailBody(n, tab);
    UI.openModal('modal-npc-detail');
  },

  switchDetailTab(tab, el) {
    this._detailTab = tab;
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const n = Store.get('npcs').find(x => x.id === this._detailId);
    if (n) this._renderDetailBody(n, tab);
  },

  _renderDetailBody(n, tab) {
    const body = document.getElementById('detail-body');
    const pct  = hpPct(n.hp, n.hpMax);
    const cls  = hpClass(n.hp, n.hpMax);
    const alignLabel = { aliado:'🟢 Aliado', inimigo:'🔴 Inimigo', neutro:'⚪ Neutro' };

    if (tab === 'info') {
      const tagsHtml = (n.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
      body.innerHTML = `
        <div class="detail-avatar-block">
          ${avHtml(n.image,'🧑','detail-avatar','detail-avatar-ph')}
          <div style="flex:1">
            <div class="detail-badges">
              <span class="badge badge-align-${n.alignment||'neutro'}">${alignLabel[n.alignment]||'Neutro'}</span>
              <span class="badge badge-status-${(n.status||'vivo').toLowerCase().replace(' ','')}">${esc(n.status||'Vivo')}</span>
              ${n.importance==='principal'?'<span class="badge badge-principal">⭐ Principal</span>':''}
              ${n.hostility==='hostil'?'<span class="badge badge-hostil">⚠️ Hostil</span>':''}
            </div>
            ${n.hpMax?`<div class="detail-hp-block" style="margin-top:10px"><div class="detail-lbl">HP</div><div class="detail-hp-nums">${n.hp} <span style="font-size:14px;color:var(--txt-m)">/ ${n.hpMax}</span></div><div class="hp-bar" style="height:8px"><div class="hp-fill ${cls}" style="width:${pct}%"></div></div></div>`:''}
          </div>
        </div>
        ${n.description?`<div class="detail-lbl">Descrição</div><div class="detail-desc">${esc(n.description)}</div>`:''}
        ${tagsHtml?`<div class="detail-lbl" style="margin-top:10px">Tags</div><div class="tags-row">${tagsHtml}</div>`:''}
      `;
    } else if (tab === 'sheet') {
      const sh = n.sheet || {};
      body.innerHTML = `
        ${sh.stats?`<div class="detail-lbl">📊 Stats</div><div class="sheet-block"><pre>${esc(sh.stats)}</pre></div>`:''}
        ${sh.abilities?`<div class="detail-lbl" style="margin-top:12px">⚡ Habilidades</div><div class="sheet-block"><pre>${esc(sh.abilities)}</pre></div>`:''}
        ${sh.notes?`<div class="detail-lbl" style="margin-top:12px">🗒️ Notas Táticas</div><div class="sheet-block"><pre>${esc(sh.notes)}</pre></div>`:''}
        ${!sh.stats&&!sh.abilities&&!sh.notes?`<p style="color:var(--txt-m);font-style:italic">Ficha ainda não preenchida.</p>`:''}
        <div style="margin-top:14px"><button class="btn-secondary" onclick="UI.closeModal('modal-npc-detail');NpcMod.openModal('${n.id}')">✏️ Editar Ficha</button></div>
      `;
    } else if (tab === 'relations') {
      const profile = Store.get('loreProfiles').find(p => p.npcId === n.id);
      const mkList  = (ids, emoji) => !ids?.length ? `<p style="color:var(--txt-m);font-style:italic;font-size:13px">Nenhum.</p>`
        : ids.map(rid=>`<div class="rel-mini-item">${avHtml(entityImg(rid),emoji,'rel-mini-img','rel-mini-ph')}<span class="rel-mini-name">${esc(entityName(rid))}</span></div>`).join('');
      const mkOrgs = (ids) => !ids?.length ? `<p style="color:var(--txt-m);font-style:italic;font-size:13px">Nenhuma.</p>`
        : ids.map(oid=>{ const o=Store.get('organizations').find(x=>x.id===oid); return `<span class="tag">🏛 ${esc(o?o.name:oid)}</span>`; }).join('');

      if (!profile) {
        body.innerHTML = `<p style="color:var(--txt-m);margin-bottom:14px">Nenhum perfil de relação para ${esc(n.name)}.</p>
          <button class="btn-primary" onclick="UI.closeModal('modal-npc-detail');LoreMod.openProfileModal('${n.id}')">+ Criar Perfil</button>`;
      } else {
        body.innerHTML = `
          <div class="rel-cols">
            <div><div class="rel-col-title" style="color:var(--green)">🤝 Aliados</div><div class="rel-mini-list">${mkList(profile.allies,'🤝')}</div></div>
            <div><div class="rel-col-title" style="color:var(--red)">⚔️ Inimigos</div><div class="rel-mini-list">${mkList(profile.enemies,'⚔️')}</div></div>
          </div>
          ${profile.alliedOrganizations?.length?`<div class="detail-lbl">Orgs. Aliadas</div><div class="tags-row">${mkOrgs(profile.alliedOrganizations)}</div>`:''}
          ${profile.knownOrganizations?.length?`<div class="detail-lbl" style="margin-top:8px">Orgs. Conhecidas</div><div class="tags-row">${mkOrgs(profile.knownOrganizations)}</div>`:''}
          ${profile.notes?`<div class="detail-lbl" style="margin-top:12px">📒 Notas</div><div class="detail-desc">${esc(profile.notes)}</div>`:''}
          <div style="margin-top:14px"><button class="btn-secondary" onclick="UI.closeModal('modal-npc-detail');LoreMod.openProfileModal('${n.id}')">✏️ Editar Perfil</button></div>
        `;
      }
    } else if (tab === 'items') {
      const ownedItems = Store.get('items').filter(i => i.holderType === 'npc' && i.holderId === n.id);
      if (!ownedItems.length) {
        body.innerHTML = `<p style="color:var(--txt-m);font-style:italic">Nenhum item em posse.</p>
          <button class="btn-ghost" style="margin-top:12px" onclick="UI.closeModal('modal-npc-detail');App.switchTab('items')">Ver todos os itens</button>`;
      } else {
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${ownedItems.map(it=>`
              <div style="background:var(--bg-e);border:1px solid var(--brd);border-radius:var(--r);padding:10px;display:flex;gap:10px;align-items:center">
                ${it.image?`<img src="${esc(it.image)}" style="width:38px;height:38px;border-radius:var(--rs);object-fit:cover;cursor:pointer;border:1px solid var(--brd)" onclick="UI.openLightbox('${esc(it.image)}')" onerror="this.style.display='none'"/>`:'<span style="font-size:24px">📦</span>'}
                <div><div style="font-family:var(--fd);font-size:12px;color:var(--txt)">${esc(it.name)}</div>${it.description?`<div style="font-size:11px;color:var(--txt-m)">${esc(it.description.substring(0,40))}${it.description.length>40?'...':''}</div>`:''}</div>
              </div>`).join('')}
          </div>
          <div style="margin-top:14px"><button class="btn-ghost" onclick="UI.closeModal('modal-npc-detail');App.switchTab('items')">Ver todos os itens →</button></div>
        `;
      }
    }
  },
};

/* ══════════════════════════════════════════════════
   RELATIONSHIPS MODULE
══════════════════════════════════════════════════ */
const RelMod = {
  _selectedNpcId: null,

  _getOrCreate(npcId, playerId) {
    const rels = Store.get('relationships');
    let rel = rels.find(r => r.npcId === npcId && r.playerId === playerId);
    if (!rel) {
      rel = { id:genId(), npcId, playerId, value:0, note:'', updatedAt:now() };
      rels.push(rel);
    }
    return rel;
  },

  setStars(npcId, playerId, value) {
    const rel = this._getOrCreate(npcId, playerId);
    rel.value     = value;
    rel.updatedAt = now();
    Store.save('relationships');
    // re-render apenas as estrelas sem rebuild total
    const starsEl = document.getElementById(`stars-${npcId}-${playerId}`);
    if (starsEl) starsEl.innerHTML = this._starsHtml(npcId, playerId, value);
    App.updateBadges();
  },

  setNote(npcId, playerId, note) {
    const rel = this._getOrCreate(npcId, playerId);
    rel.note      = note;
    rel.updatedAt = now();
    Store.save('relationships');
  },

  _starsHtml(npcId, playerId, value) {
    return [1,2,3,4,5].map(i =>
      `<span class="rel-star${i <= value?' active':''}"
        onclick="RelMod.setStars('${npcId}','${playerId}',${i})"
        title="${i} estrela${i>1?'s':''}">❤️</span>`
    ).join('');
  },

  renderNpcList() {
    const container = document.getElementById('rel-npc-list');
    const empty     = document.getElementById('rel-npc-empty');
    const search    = (document.getElementById('rel-npc-search')?.value||'').toLowerCase().trim();
    const npcs      = Store.get('npcs').filter(n => !search || n.name.toLowerCase().includes(search));
    container.innerHTML = '';
    empty.style.display = npcs.length === 0 ? 'block' : 'none';
    npcs.forEach(n => {
      const item = document.createElement('div');
      item.className = `rel-npc-item${this._selectedNpcId === n.id ? ' selected' : ''}`;
      item.innerHTML = `
        ${avHtml(n.image,'🧑','comb-avatar','comb-avatar-ph')}
        <div>
          <div class="rel-npc-name">${esc(n.name)}</div>
          <div class="rel-npc-sub">${n.alignment==='aliado'?'🟢':n.alignment==='inimigo'?'🔴':'⚪'} ${esc(n.alignment||'neutro')}</div>
        </div>
      `;
      item.onclick = () => { this._selectedNpcId = n.id; this.renderNpcList(); this.renderRelContent(); };
      container.appendChild(item);
    });
  },

  renderRelContent() {
    const panel = document.getElementById('rel-content');
    const npcId = this._selectedNpcId;
    if (!npcId) return;
    const n = Store.get('npcs').find(x => x.id === npcId);
    if (!n) return;
    const players = Store.get('players');

    if (players.length === 0) {
      panel.innerHTML = `<div class="rel-placeholder"><span>👥</span><p>Nenhum jogador cadastrado ainda.</p></div>`;
      return;
    }

    const rows = players.map(p => {
      const rel = Store.get('relationships').find(r => r.npcId === npcId && r.playerId === p.id);
      const val = rel?.value || 0;
      const note = rel?.note || '';
      return `
        <div class="rel-player-row">
          ${avHtml(p.image,'👤','comb-avatar','comb-avatar-ph')}
          <div class="rel-player-info">
            <div class="rel-player-name">${esc(p.characterName)}</div>
            ${p.playerName?`<div class="rel-player-sub">🎮 ${esc(p.playerName)}</div>`:''}
          </div>
          <div id="stars-${npcId}-${p.id}" class="rel-stars">
            ${this._starsHtml(npcId, p.id, val)}
          </div>
          <input type="text" class="rel-note-input" placeholder="Observação..."
            value="${esc(note)}"
            onchange="RelMod.setNote('${npcId}','${p.id}',this.value)"
            oninput="RelMod.setNote('${npcId}','${p.id}',this.value)"
          />
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="rel-npc-header">
        ${avHtml(n.image,'🧑','rel-npc-header-img','rel-npc-header-ph')}
        <div>
          <div class="rel-npc-header-name">${esc(n.name)}</div>
          <div class="rel-npc-header-sub">${n.description?esc(n.description.substring(0,60))+'...':'Sem descrição'}</div>
        </div>
      </div>
      <div>${rows}</div>
    `;
  },

  openForPlayer(playerId) {
    App.switchTab('relationships');
    // selecionar primeiro NPC automaticamente
    if (!this._selectedNpcId && Store.get('npcs').length > 0) {
      this._selectedNpcId = Store.get('npcs')[0].id;
    }
    this.renderNpcList();
    this.renderRelContent();
  },
};

/* ══════════════════════════════════════════════════
   ITEMS MODULE
══════════════════════════════════════════════════ */
const ItemMod = {
  _filter: 'all',

  setFilter(f, el) {
    this._filter = f;
    document.querySelectorAll('#tab-items .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    this.render();
  },

  toggleHolderSelect() {
    const type    = document.getElementById('item-holder-type').value;
    const selWrap = document.getElementById('item-holder-select-wrap');
    const locWrap = document.getElementById('item-location-wrap');
    selWrap.classList.toggle('hidden', type !== 'player' && type !== 'npc');
    locWrap.classList.toggle('hidden', type !== 'location');

    if (type === 'player' || type === 'npc') {
      const label  = document.getElementById('item-holder-label');
      const select = document.getElementById('item-holder-id');
      label.textContent = type === 'player' ? 'Jogador' : 'NPC';
      select.innerHTML  = '<option value="">-- Selecione --</option>';
      const list = type === 'player' ? Store.get('players') : Store.get('npcs');
      list.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = type === 'player' ? e.characterName : e.name;
        select.appendChild(opt);
      });
    }
  },

  openModal(id = null) {
    const isEdit = id != null;
    document.getElementById('item-modal-title').textContent = isEdit ? '✏️ Editar Item' : '🎒 Novo Item';
    UI.clearForm(['item-id','item-image','item-name','item-desc','item-location-note']);
    document.getElementById('item-holder-type').value = 'none';
    UI.resetImgPreview('item-img-prev','item-img-ph');
    document.getElementById('item-holder-select-wrap').classList.add('hidden');
    document.getElementById('item-location-wrap').classList.add('hidden');

    if (isEdit) {
      const it = Store.get('items').find(x => x.id === id);
      if (!it) return;
      document.getElementById('item-id').value          = it.id;
      document.getElementById('item-image').value       = it.image || '';
      document.getElementById('item-name').value        = it.name;
      document.getElementById('item-desc').value        = it.description || '';
      document.getElementById('item-holder-type').value = it.holderType || 'none';
      if (it.image) UI.previewImg('item-image','item-img-prev','item-img-ph');
      this.toggleHolderSelect();
      if (it.holderId) {
        const sel = document.getElementById('item-holder-id');
        if (sel) sel.value = it.holderId;
      }
      if (it.locationNote) document.getElementById('item-location-note').value = it.locationNote;
              document.getElementById('item-sheet-stats').value     = it.sheet?.stats     || '';
       document.getElementById('item-sheet-abilities').value = it.sheet?.abilities || '';
       document.getElementById('item-sheet-notes').value     = it.sheet?.notes     || '';
       
    }
    UI.openModal('modal-item');
  },

  save() {
    const name = document.getElementById('item-name').value.trim();
    if (!name) { UI.toast('Nome é obrigatório.','error'); return; }
    const id         = document.getElementById('item-id').value;
    const holderType = document.getElementById('item-holder-type').value;
    const holderId   = ['player','npc'].includes(holderType) ? (document.getElementById('item-holder-id')?.value || '') : '';
    const data = {
      name,
      description:  document.getElementById('item-desc').value.trim(),
      image:        document.getElementById('item-image').value.trim(),
      holderType,
      holderId,
      locationNote: holderType === 'location' ? document.getElementById('item-location-note').value.trim() : '',
      updatedAt:    now(),
    };
    const items = Store.get('items');
    if (id) {
      const i = items.findIndex(x => x.id === id);
      if (i !== -1) items[i] = { ...items[i], ...data };
      UI.toast(`"${name}" atualizado!`, 'success');
    } else {
      items.push({ id:genId(), ...data, createdAt:now() });
      UI.toast(`"${name}" criado!`, 'success');
    }
    Store.save('items');
    this.render();
    // Atualizar cards de NPCs e Jogadores (badge de itens)
    PlayerMod.render(); NpcMod.render();
    UI.closeModal('modal-item');
  },

  delete(id) {
    const it = Store.get('items').find(x => x.id === id);
    if (!it) return;
    UI.confirm('🗑️ Remover Item', `Remover "${it.name}"?`, () => {
      Store.set('items', Store.get('items').filter(x => x.id !== id));
      this.render(); PlayerMod.render(); NpcMod.render();
      UI.toast('Item removido.','info');
    });
  },

  _holderLabel(it) {
    if (it.holderType === 'player') {
      const p = Store.get('players').find(x => x.id === it.holderId);
      return p ? `👤 ${p.characterName}` : '👤 Jogador removido';
    }
    if (it.holderType === 'npc') {
      const n = Store.get('npcs').find(x => x.id === it.holderId);
      return n ? `🧑 ${n.name}` : '🧑 NPC removido';
    }
    if (it.holderType === 'location') return `📍 ${it.locationNote || 'Local'}`;
    return '📦 Sem dono';
  },

  _holderBadgeCls(it) {
    const map = { player:'badge-item-player', npc:'badge-item-npc', location:'badge-item-location', none:'badge-item-none' };
    return map[it.holderType] || 'badge-item-none';
  },

  render() {
    const list  = document.getElementById('item-list');
    const empty = document.getElementById('item-empty');
    const search = (document.getElementById('item-search')?.value||'').toLowerCase().trim();
    const f      = this._filter;

    const data = Store.get('items').filter(it => {
      if (search && !it.name.toLowerCase().includes(search) && !(it.description||'').toLowerCase().includes(search)) return false;
      if (f !== 'all' && it.holderType !== f) return false;
      return true;
    });

    list.innerHTML = '';
    empty.classList.toggle('visible', data.length === 0);

    data.forEach(it => {
      const card = document.createElement('div');
      card.className = 'entity-card align-item';
      card.innerHTML = `
        <div class="card-avatar-row">
          ${it.image
            ? `<img src="${esc(it.image)}" class="item-avatar" alt="" onclick="UI.openLightbox('${esc(it.image)}')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span class="item-avatar-ph" style="display:none">📦</span>`
            : `<span class="item-avatar-ph">📦</span>`
          }
          <div class="card-info">
            <div class="card-name">${esc(it.name)}</div>
            <div class="card-meta">
              <span class="badge ${this._holderBadgeCls(it)}">${this._holderLabel(it)}</span>
            </div>
          </div>
        </div>
        ${it.description ? `<div class="tags-row"><span style="font-size:13px;color:var(--txt-s);padding:0 0 6px 0">${esc(it.description)}</span></div>` : ''}
        <div class="card-actions">
          <button class="card-btn edit"   onclick="ItemMod.openModal('${it.id}')">✏️ Editar</button>
          <button class="card-btn delete" onclick="ItemMod.delete('${it.id}')">🗑️ Remover</button>
        </div>
      `;
      list.appendChild(card);
    });
  },
};

/* ══════════════════════════════════════════════════
   COMBAT MODULE
══════════════════════════════════════════════════ */
const CombatMod = {
  _activeTab: 'manual',

  openModal() {
    UI.clearForm(['comb-name','comb-init','comb-hp','comb-hp-max','comb-player-init','comb-npc-init']);
    // populate player select
    const pSel = document.getElementById('comb-player-sel');
    pSel.innerHTML = '<option value="">-- Selecione --</option>';
    Store.get('players').forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = `${p.characterName} (${p.playerName||'?'})`;
      pSel.appendChild(o);
    });
    // populate npc select
    const nSel = document.getElementById('comb-npc-sel');
    nSel.innerHTML = '<option value="">-- Selecione --</option>';
    Store.get('npcs').forEach(n => {
      const o = document.createElement('option');
      o.value = n.id; o.textContent = `${n.name} (HP:${n.hp||0}/${n.hpMax||0})`;
      nSel.appendChild(o);
    });
    this.switchTab('manual', document.querySelector('[data-ct="manual"]'));
    UI.openModal('modal-combatant');
  },

  switchTab(tab, el) {
    this._activeTab = tab;
    document.querySelectorAll('#modal-combatant .modal-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    ['manual','player','npc'].forEach(t => document.getElementById(`ct-${t}`).classList.toggle('hidden', t !== tab));
  },

  save() {
    const tab = this._activeTab;
    const combat = Store.get('combat');

    if (tab === 'manual') {
      const name = document.getElementById('comb-name').value.trim();
      const init = parseInt(document.getElementById('comb-init').value);
      if (!name)       { UI.toast('Nome obrigatório.','error'); return; }
      if (isNaN(init)) { UI.toast('Iniciativa obrigatória.','error'); return; }
      const hp    = parseInt(document.getElementById('comb-hp').value)     || 0;
      const hpMax = parseInt(document.getElementById('comb-hp-max').value) || hp;
      combat.combatants.push({ id:genId(), name, initiative:init, hp, hpMax, dead:false, playerId:null, npcId:null, image:'' });
      UI.toast(`"${name}" adicionado!`,'success');

    } else if (tab === 'player') {
      const pid  = document.getElementById('comb-player-sel').value;
      const init = parseInt(document.getElementById('comb-player-init').value);
      if (!pid)        { UI.toast('Selecione um jogador.','error'); return; }
      if (isNaN(init)) { UI.toast('Iniciativa obrigatória.','error'); return; }
      if (combat.combatants.find(c => c.playerId === pid)) { UI.toast('Jogador já no combate.','error'); return; }
      const p = Store.get('players').find(x => x.id === pid);
      combat.combatants.push({ id:genId(), name:p.characterName, initiative:init, hp:0, hpMax:0, dead:false, playerId:pid, npcId:null, image:p.image||'' });
      UI.toast(`"${p.characterName}" adicionado!`,'success');

    } else {
      const nid  = document.getElementById('comb-npc-sel').value;
      const init = parseInt(document.getElementById('comb-npc-init').value);
      if (!nid)        { UI.toast('Selecione um NPC.','error'); return; }
      if (isNaN(init)) { UI.toast('Iniciativa obrigatória.','error'); return; }
      if (combat.combatants.find(c => c.npcId === nid)) { UI.toast('NPC já no combate.','error'); return; }
      const n = Store.get('npcs').find(x => x.id === nid);
      combat.combatants.push({ id:genId(), name:n.name, initiative:init, hp:n.hp||0, hpMax:n.hpMax||0, dead:n.status==='Morto', playerId:null, npcId:nid, image:n.image||'' });
      UI.toast(`"${n.name}" adicionado!`,'success');
    }

    this._sort(); Store.save('combat'); this.render(); UI.closeModal('modal-combatant');
  },

  _sort() {
    const c = Store.get('combat');
    c.combatants.sort((a,b) => b.initiative - a.initiative);
    c.currentTurn = Math.min(c.currentTurn, Math.max(c.combatants.length - 1, 0));
  },

  nextTurn() {
    const c = Store.get('combat');
    if (!c.combatants.length) return;
    c.currentTurn++;
    if (c.currentTurn >= c.combatants.length) {
      c.currentTurn = 0; c.round++;
      UI.toast(`⚔️ Rodada ${c.round}!`,'info');
    }
    Store.save('combat'); this.render();
  },

  prevTurn() {
    const c = Store.get('combat');
    if (!c.combatants.length) return;
    c.currentTurn--;
    if (c.currentTurn < 0) {
      c.currentTurn = c.combatants.length - 1;
      c.round = Math.max(1, c.round - 1);
    }
    Store.save('combat'); this.render();
  },

  reset() {
    UI.confirm('🔄 Resetar Combate','Remover todos os combatentes?', () => {
      Store.set('combat', { combatants:[], currentTurn:0, round:1 });
      this.render(); UI.toast('Combate resetado.','info');
    });
  },

  remove(id) {
    const c = Store.get('combat');
    const x = c.combatants.find(x => x.id === id);
    c.combatants = c.combatants.filter(x => x.id !== id);
    c.currentTurn = Math.min(c.currentTurn, Math.max(c.combatants.length - 1, 0));
    Store.save('combat'); this.render();
    if (x) UI.toast(`"${x.name}" removido.`,'info');
  },

  toggleDead(id) {
    const c = Store.get('combat');
    const x = c.combatants.find(x => x.id === id);
    if (!x) return;
    x.dead = !x.dead;
    Store.save('combat'); this.render();
    UI.toast(x.dead ? `💀 ${x.name} morreu.` : `${x.name} reviveu.`, x.dead?'error':'success');
  },

  changeHP(id, delta) {
    const c = Store.get('combat');
    const x = c.combatants.find(x => x.id === id);
    if (!x) return;
    const inp = document.getElementById(`hp-amt-${id}`);
    const amt = parseInt(inp?.value) || 1;
    x.hp = Math.max(0, x.hp + delta * amt);
    if (x.hp === 0 && delta < 0) { x.dead = true; UI.toast(`💀 ${x.name} chegou a 0 HP!`,'error'); }
    Store.save('combat'); this.render();
  },

  render() {
    const c   = Store.get('combat');
    const all = c.combatants;
    document.getElementById('round-number').textContent = c.round;
    document.getElementById('combat-empty').classList.toggle('visible', all.length === 0);

    const players = all.filter(x => x.playerId !== null);
    const npcs    = all.filter(x => x.playerId === null);

    const mkRow = (x, globalIdx) => {
      const isActive = globalIdx === c.currentTurn;
      const pct = hpPct(x.hp, x.hpMax);
      const cls = hpClass(x.hp, x.hpMax);
      const sheetBtn = x.npcId
        ? `<button class="card-btn sheet" onclick="NpcMod.openDetail('${x.npcId}','sheet')" style="flex:0;padding:6px 9px" title="Ficha">📋</button>`
        : '';
      const row = document.createElement('div');
      row.className = `combatant-row${isActive?' active-turn':''}${x.dead?' dead':''}`;
      row.innerHTML = `
        <div class="init-badge">${x.initiative}</div>
        ${x.image
          ? `<img src="${esc(x.image)}" class="comb-avatar" onclick="UI.openLightbox('${esc(x.image)}')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span class="comb-avatar-ph" style="display:none">${x.playerId?'👤':'🧑'}</span>`
          : `<span class="comb-avatar-ph">${x.playerId?'👤':'🧑'}</span>`
        }
        <div class="combatant-info">
          <div class="combatant-name">${esc(x.name)}</div>
          <div class="combatant-hp-row">
            <span class="hp-text-sm">${x.hp} / ${x.hpMax||'?'}</span>
            ${x.hpMax?`<div class="hp-bar-mini"><div class="hp-fill-mini hp-fill ${cls}" style="width:${pct}%"></div></div>`:''}
          </div>
        </div>
        <div class="hp-controls">
          <input class="hp-ctrl-input" id="hp-amt-${x.id}" type="number" value="1" min="1" onclick="event.stopPropagation()"/>
          <button class="hp-ctrl-btn heal" onclick="CombatMod.changeHP('${x.id}',1)"  title="Curar">+</button>
          <button class="hp-ctrl-btn dmg"  onclick="CombatMod.changeHP('${x.id}',-1)" title="Dano">−</button>
        </div>
        <div class="comb-row-btns">
          ${sheetBtn}
          <button class="card-btn" onclick="CombatMod.toggleDead('${x.id}')" title="${x.dead?'Reviver':'Matar'}">${x.dead?'💚':'💀'}</button>
          <button class="card-btn delete" onclick="CombatMod.remove('${x.id}')" title="Remover">🗑️</button>
        </div>
      `;
      if (isActive) setTimeout(() => row.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
      return row;
    };

    const renderCol = (list, colId, emptyId) => {
      const el = document.getElementById(colId);
      const em = document.getElementById(emptyId);
      el.innerHTML = '';
      em.style.display = list.length === 0 ? 'block' : 'none';
      list.forEach(x => el.appendChild(mkRow(x, all.indexOf(x))));
    };

    renderCol(players, 'combat-players-list', 'combat-players-empty');
    renderCol(npcs,    'combat-npcs-list',    'combat-npcs-empty');
  },
};

/* ══════════════════════════════════════════════════
   LORE MODULE
══════════════════════════════════════════════════ */
const LoreMod = {
  openOrgModal(id = null) {
    const isEdit = id != null;
    document.getElementById('org-modal-title').textContent = isEdit ? '✏️ Editar Org.' : '🏛 Nova Organização';
    UI.clearForm(['org-id','org-name','org-desc']);
    if (isEdit) {
      const o = Store.get('organizations').find(x => x.id === id);
      if (!o) return;
      document.getElementById('org-id').value   = o.id;
      document.getElementById('org-name').value = o.name;
      document.getElementById('org-desc').value = o.description || '';
    }
    UI.openModal('modal-org');
  },

  saveOrg() {
    const name = document.getElementById('org-name').value.trim();
    if (!name) { UI.toast('Nome obrigatório.','error'); return; }
    const id = document.getElementById('org-id').value;
    const data = { name, description: document.getElementById('org-desc').value.trim() };
    const orgs = Store.get('organizations');
    if (id) { const i=orgs.findIndex(x=>x.id===id); if(i!==-1) orgs[i]={...orgs[i],...data}; UI.toast('Atualizado!','success'); }
    else    { orgs.push({ id:genId(), ...data }); UI.toast(`"${name}" criada!`,'success'); }
    Store.save('organizations'); this.renderOrgs(); UI.closeModal('modal-org');
  },

  deleteOrg(id) {
    const o = Store.get('organizations').find(x=>x.id===id);
    if (!o) return;
    UI.confirm('🗑️ Remover','Remover esta organização?', () => {
      Store.set('organizations', Store.get('organizations').filter(x=>x.id!==id));
      this.renderOrgs(); UI.toast('Removida.','info');
    });
  },

  renderOrgs() {
    const c = document.getElementById('org-list');
    const e = document.getElementById('org-empty');
    const orgs = Store.get('organizations');
    c.innerHTML = '';
    e.style.display = orgs.length === 0 ? 'block' : 'none';
    orgs.forEach(o => {
      const item = document.createElement('div');
      item.className = 'org-item';
      item.innerHTML = `
        <span style="font-size:18px">🏛</span>
        <div style="flex:1;min-width:0">
          <div class="org-name">${esc(o.name)}</div>
          ${o.description?`<div class="org-desc">${esc(o.description.substring(0,55))}${o.description.length>55?'...':''}</div>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="card-btn edit" onclick="LoreMod.openOrgModal('${o.id}')" style="flex:0;padding:5px 8px">✏️</button>
          <button class="card-btn delete" onclick="LoreMod.deleteOrg('${o.id}')" style="flex:0;padding:5px 8px">🗑️</button>
        </div>
      `;
      c.appendChild(item);
    });
  },

  openLogModal(id = null) {
    const isEdit = id != null;
    document.getElementById('log-modal-title').textContent = isEdit ? '✏️ Editar Entrada' : '📚 Nova Entrada';
    UI.clearForm(['log-id','log-title','log-content']);
    const sel = document.getElementById('log-npcs');
    sel.innerHTML = '';
    Store.get('npcs').forEach(n => {
      const o = document.createElement('option'); o.value=n.id; o.textContent=n.name; sel.appendChild(o);
    });
    if (isEdit) {
      const log = Store.get('masterLogs').find(x=>x.id===id);
      if (!log) return;
      document.getElementById('log-id').value      = log.id;
      document.getElementById('log-title').value   = log.title;
      document.getElementById('log-content').value = log.content;
      Array.from(sel.options).forEach(o => o.selected = (log.relatedNPCs||[]).includes(o.value));
    }
    UI.openModal('modal-log');
  },

  saveLog() {
    const title   = document.getElementById('log-title').value.trim();
    const content = document.getElementById('log-content').value.trim();
    if (!title||!content) { UI.toast('Título e conteúdo obrigatórios.','error'); return; }
    const id = document.getElementById('log-id').value;
    const relatedNPCs = Array.from(document.getElementById('log-npcs').selectedOptions).map(o=>o.value);
    const data = { title, content, relatedNPCs };
    const logs = Store.get('masterLogs');
    if (id) {
      const i=logs.findIndex(x=>x.id===id);
      if (i!==-1) logs[i]={...logs[i],...data};
      UI.toast('Entrada atualizada!','success');
    } else {
      logs.unshift({ id:genId(), ...data, createdAt:now() });
      UI.toast('Entrada criada!','success');
    }
    Store.save('masterLogs'); this.renderLogs(); UI.closeModal('modal-log');
  },

  deleteLog(id) {
    Store.set('masterLogs', Store.get('masterLogs').filter(x=>x.id!==id));
    this.renderLogs(); UI.toast('Entrada removida.','info');
  },

  renderLogs() {
    const c = document.getElementById('log-list');
    const e = document.getElementById('log-empty');
    const search = (document.getElementById('log-search')?.value||'').toLowerCase().trim();
    const list = Store.get('masterLogs').filter(l => !search || l.title.toLowerCase().includes(search) || l.content.toLowerCase().includes(search));
    c.innerHTML = '';
    e.classList.toggle('visible', list.length===0);
    list.forEach(log => {
      const npcBadges = (log.relatedNPCs||[]).map(nid => {
        const n = Store.get('npcs').find(x=>x.id===nid);
        return n?`<span class="tag">🧑 ${esc(n.name)}</span>`:'';
      }).join('');
      const card = document.createElement('div');
      card.className = 'log-card';
      card.innerHTML = `
        <div class="log-card-head">
          <div class="log-card-title">📜 ${esc(log.title)}</div>
          <span class="log-card-date">${formatTs(log.createdAt)}</span>
        </div>
        <div class="log-card-body">${esc(log.content)}</div>
        ${npcBadges?`<div class="log-card-npcs">${npcBadges}</div>`:''}
        <div class="log-card-acts">
          <button class="card-btn edit"   onclick="LoreMod.openLogModal('${log.id}')">✏️ Editar</button>
          <button class="card-btn delete" onclick="LoreMod.deleteLog('${log.id}')">🗑️ Excluir</button>
        </div>
      `;
      c.appendChild(card);
    });
  },

  openProfileModal(preNpcId = null) {
    document.getElementById('lore-profile-title').textContent = '🔗 Perfil de Relação';
    UI.clearForm(['lore-profile-id','lore-profile-tags','lore-profile-notes']);
    const npcSel = document.getElementById('lore-profile-npc');
    npcSel.innerHTML = '<option value="">-- Selecione --</option>';
    Store.get('npcs').forEach(n => {
      const o=document.createElement('option'); o.value=n.id; o.textContent=n.name;
      if (preNpcId && n.id===preNpcId) o.selected=true;
      npcSel.appendChild(o);
    });
    const all = [
      ...Store.get('npcs').map(n=>({id:n.id,label:`🧑 ${n.name}`})),
      ...Store.get('players').map(p=>({id:p.id,label:`👤 ${p.characterName}`})),
    ];
    ['lore-profile-allies','lore-profile-enemies'].forEach(sid => {
      const sel = document.getElementById(sid); sel.innerHTML='';
      all.forEach(e=>{ const o=document.createElement('option'); o.value=e.id; o.textContent=e.label; sel.appendChild(o); });
    });
    ['lore-profile-allied-orgs','lore-profile-known-orgs'].forEach(sid => {
      const sel=document.getElementById(sid); sel.innerHTML='';
      Store.get('organizations').forEach(o=>{ const opt=document.createElement('option'); opt.value=o.id; opt.textContent=o.name; sel.appendChild(opt); });
    });
    if (preNpcId) {
      const existing = Store.get('loreProfiles').find(p=>p.npcId===preNpcId);
      if (existing) {
        document.getElementById('lore-profile-id').value    = existing.id;
        document.getElementById('lore-profile-tags').value  = (existing.tags||[]).join(', ');
        document.getElementById('lore-profile-notes').value = existing.notes||'';
        Array.from(document.getElementById('lore-profile-allies').options).forEach(o=>o.selected=(existing.allies||[]).includes(o.value));
        Array.from(document.getElementById('lore-profile-enemies').options).forEach(o=>o.selected=(existing.enemies||[]).includes(o.value));
        Array.from(document.getElementById('lore-profile-allied-orgs').options).forEach(o=>o.selected=(existing.alliedOrganizations||[]).includes(o.value));
        Array.from(document.getElementById('lore-profile-known-orgs').options).forEach(o=>o.selected=(existing.knownOrganizations||[]).includes(o.value));
      }
    }
    UI.openModal('modal-lore-profile');
  },

  saveProfile() {
    const npcId = document.getElementById('lore-profile-npc').value;
    if (!npcId) { UI.toast('Selecione um NPC central.','error'); return; }
    const id = document.getElementById('lore-profile-id').value;
    const data = {
      npcId,
      allies:              Array.from(document.getElementById('lore-profile-allies').selectedOptions).map(o=>o.value),
      enemies:             Array.from(document.getElementById('lore-profile-enemies').selectedOptions).map(o=>o.value),
      alliedOrganizations: Array.from(document.getElementById('lore-profile-allied-orgs').selectedOptions).map(o=>o.value),
      knownOrganizations:  Array.from(document.getElementById('lore-profile-known-orgs').selectedOptions).map(o=>o.value),
      tags:                document.getElementById('lore-profile-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
      notes:               document.getElementById('lore-profile-notes').value.trim(),
      updatedAt:           now(),
    };
    const profiles = Store.get('loreProfiles');
    if (id) {
      const i=profiles.findIndex(x=>x.id===id);
      if(i!==-1) profiles[i]={...profiles[i],...data};
    } else {
      Store.set('loreProfiles', profiles.filter(p=>p.npcId!==npcId));
      Store.get('loreProfiles').push({ id:genId(), ...data });
    }
    Store.save('loreProfiles'); this.renderProfiles(); UI.closeModal('modal-lore-profile');
    UI.toast('Perfil salvo!','success');
  },

  deleteProfile(id) {
    Store.set('loreProfiles', Store.get('loreProfiles').filter(x=>x.id!==id));
    this.renderProfiles(); UI.toast('Perfil removido.','info');
  },

  renderProfiles() {
    const c = document.getElementById('lore-profile-list');
    const e = document.getElementById('lore-profile-empty');
    const profiles = Store.get('loreProfiles');
    c.innerHTML='';
    e.style.display = profiles.length===0?'block':'none';
    profiles.forEach(p=>{
      const n=Store.get('npcs').find(x=>x.id===p.npcId);
      const item=document.createElement('div');
      item.className='profile-item';
      item.innerHTML=`
        <div class="profile-name">🔗 ${esc(n?n.name:p.npcId)}</div>
        <div class="profile-sub">${(p.allies||[]).length?`🤝 ${p.allies.length}`:''} ${(p.enemies||[]).length?`⚔️ ${p.enemies.length}`:''}</div>
        <div style="display:flex;gap:4px;margin-top:7px">
          <button class="card-btn edit" onclick="LoreMod.openProfileModal('${p.npcId}')" style="flex:0;padding:4px 8px;font-size:11px">✏️</button>
          <button class="card-btn delete" onclick="LoreMod.deleteProfile('${p.id}')" style="flex:0;padding:4px 8px;font-size:11px">🗑️</button>
        </div>`;
      c.appendChild(item);
    });
  },
};

/* ══════════════════════════════════════════════════
   NOTES MODULE
══════════════════════════════════════════════════ */
const NoteMod = {
  _filter: 'all',

  setFilter(f, el) {
    this._filter = f;
    document.querySelectorAll('#tab-notes .chip').forEach(c=>c.classList.remove('active'));
    el.classList.add('active');
    this.render();
  },

  openModal(id = null) {
    const isEdit = id != null;
    document.getElementById('note-modal-title').textContent = isEdit ? '✏️ Editar Nota' : '📝 Nova Nota';
    UI.clearForm(['note-id','note-content']);
    document.getElementById('note-type').value = 'Evento';
    if (isEdit) {
      const note = Store.get('notes').find(n=>n.id===id);
      if (!note) return;
      document.getElementById('note-id').value      = note.id;
      document.getElementById('note-type').value    = note.type;
      document.getElementById('note-content').value = note.content;
    }
    UI.openModal('modal-note');
  },

  save() {
    const content = document.getElementById('note-content').value.trim();
    if (!content) { UI.toast('Conteúdo obrigatório.','error'); return; }
    const id   = document.getElementById('note-id').value;
    const type = document.getElementById('note-type').value;
    const notes = Store.get('notes');
    if (id) {
      const i = notes.findIndex(n=>n.id===id);
      if(i!==-1) notes[i]={...notes[i],type,content};
      UI.toast('Nota atualizada!','success');
    } else {
      notes.unshift({ id:genId(), type, content, timestamp:now() });
      UI.toast('Nota criada!','success');
    }
    Store.save('notes'); this.render(); UI.closeModal('modal-note');
  },

  delete(id) {
    Store.set('notes', Store.get('notes').filter(n=>n.id!==id));
    this.render(); UI.toast('Nota removida.','info');
  },

  enableEdit(id) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    const note = Store.get('notes').find(n=>n.id===id);
    if (!card || !note) return;
    const el = card.querySelector('.note-text');
    const ta = document.createElement('textarea');
    ta.className = 'note-text editing';
    ta.value = note.content;
    el.replaceWith(ta);
    ta.focus();
    const save = () => {
      const t = ta.value.trim();
      if (t && t !== note.content) { note.content=t; Store.save('notes'); UI.toast('Salvo.','success'); }
      this.render();
    };
    ta.addEventListener('blur', save);
    ta.addEventListener('keydown', e => {
      if (e.key==='Enter'&&e.ctrlKey) ta.blur();
      if (e.key==='Escape') { ta.removeEventListener('blur',save); this.render(); }
    });
  },

  render() {
    const list  = document.getElementById('notes-list');
    const empty = document.getElementById('notes-empty');
    const search = (document.getElementById('note-search')?.value||'').toLowerCase().trim();
    const f      = this._filter;
    const data   = Store.get('notes').filter(n =>
      (f==='all'||n.type===f) && (!search||n.content.toLowerCase().includes(search)||n.type.toLowerCase().includes(search))
    );
    list.innerHTML = '';
    empty.classList.toggle('visible', data.length===0);
    const icons = { Evento:'⚡', NPC:'🧑', Local:'🗺️', Outro:'📌' };
    data.forEach(note=>{
      const card=document.createElement('div');
      card.className='note-card'; card.dataset.id=note.id;
      card.innerHTML=`
        <div class="note-header">
          <span class="note-badge note-${esc(note.type)}">${icons[note.type]||'📌'} ${esc(note.type)}</span>
          <span class="note-ts">${formatTs(note.timestamp)}</span>
        </div>
        <div class="note-text">${esc(note.content)}</div>
        <div class="note-actions">
          <button class="card-btn edit"   onclick="NoteMod.enableEdit('${note.id}')">✏️ Editar</button>
          <button class="card-btn delete" onclick="NoteMod.delete('${note.id}')">🗑️ Excluir</button>
        </div>`;
      list.appendChild(card);
    });
  },
};

/* ══════════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());
