const STORAGE_KEY = 'pulveriza-safra-state-v1';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const navItems = [
  ['dashboard', '🏡', 'Dashboard'],
  ['culturas', '🌱', 'Culturas'],
  ['talhoes', '🧭', 'Talhões / Locais'],
  ['produtos', '🧪', 'Produtos / Estoque'],
  ['nova', '🚜', 'Nova Aplicação'],
  ['alertas', '⚠️', 'Alertas'],
  ['historico', '📒', 'Histórico'],
  ['relatorios', '📊', 'Relatórios'],
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + Number(days || 0));
  return next.toISOString().slice(0, 10);
};
const daysBetween = (start, end) => Math.ceil((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000);
const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const normalize = (value = '') => value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const money = value => BRL.format(Number(value || 0));
const qty = (value, unit = '') => `${NUMBER.format(Number(value || 0))}${unit ? ` ${unit}` : ''}`;

const sampleState = {
  cultures: [
    { id: 'culture-soja', name: 'Soja', season: '2025/2026', area: 86, note: 'Área comercial principal' },
    { id: 'culture-milho', name: 'Milho', season: '2026', area: 42, note: 'Safrinha' },
  ],
  fields: [
    { id: 'field-norte', name: 'Talhão Norte', cultureId: 'culture-soja', hectares: 32, note: 'Próximo à estrada' },
    { id: 'field-baixo', name: 'Baixada', cultureId: 'culture-milho', hectares: 18, note: 'Atenção com umidade' },
  ],
  products: [
    { id: 'product-fungo', name: 'FungoMax', type: 'Fungicida', unit: 'L', purchased: 80, totalPrice: 3600, stock: 16, minStock: 18, doseReference: 0.5, note: 'Exemplo para demonstração' },
    { id: 'product-herbi', name: 'HerbiLimpo', type: 'Herbicida', unit: 'L', purchased: 120, totalPrice: 4200, stock: 64, minStock: 20, doseReference: 1.2, note: '' },
  ],
  applications: [],
};

let state = loadState();
let currentScreen = 'dashboard';

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return sampleState;
  try { return JSON.parse(saved); } catch { return sampleState; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function productUnitCost(product) { return Number(product?.purchased || 0) ? Number(product.totalPrice || 0) / Number(product.purchased) : 0; }
function getCulture(id) { return state.cultures.find(item => item.id === id); }
function getField(id) { return state.fields.find(item => item.id === id); }
function getProduct(id) { return state.products.find(item => item.id === id); }

function init() {
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  buildNav();
  bindNavigation();
  bindForms();
  bindApplicationCalculations();
  renderAll();
}

function buildNav() {
  document.getElementById('navList').innerHTML = navItems.map(([key, icon, label]) => `<button class="nav-item ${key === currentScreen ? 'active' : ''}" type="button" data-goto="${key}"><span>${icon}</span>${label}</button>`).join('');
}
function bindNavigation() {
  document.body.addEventListener('click', event => {
    const target = event.target.closest('[data-goto]');
    if (!target) return;
    showScreen(target.dataset.goto);
  });
  document.getElementById('menuToggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
}
function showScreen(key) {
  currentScreen = key;
  document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.id === key));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.goto === key));
  const item = navItems.find(([screen]) => screen === key);
  document.getElementById('pageTitle').textContent = item?.[2] || 'Pulveriza Safra';
  document.body.classList.remove('menu-open');
  renderAll();
}

function bindForms() {
  document.getElementById('cultureForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    upsert('cultures', { id: data.id || id(), name: data.name, season: data.season, area: Number(data.area), note: data.note });
    form.reset(); toast('Cultura salva.'); renderAll();
  });
  document.getElementById('fieldForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    upsert('fields', { id: data.id || id(), name: data.name, cultureId: data.cultureId, hectares: Number(data.hectares), note: data.note });
    event.currentTarget.reset(); toast('Talhão/local salvo.'); renderAll();
  });
  const productForm = document.getElementById('productForm');
  productForm.addEventListener('input', () => productForm.elements.unitCost.value = money(productUnitCost(Object.fromEntries(new FormData(productForm)))));
  productForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(productForm));
    upsert('products', { id: data.id || id(), name: data.name, type: data.type, unit: data.unit, purchased: Number(data.purchased), totalPrice: Number(data.totalPrice), stock: Number(data.stock), minStock: Number(data.minStock), doseReference: Number(data.doseReference || 0), note: data.note });
    productForm.reset(); productForm.elements.unitCost.value = ''; toast('Produto salvo.'); renderAll();
  });
  document.getElementById('historyFilters').addEventListener('input', renderHistory);
  document.getElementById('manualMode').addEventListener('click', () => document.getElementById('voicePanel').classList.add('hidden'));
  document.getElementById('voiceMode').addEventListener('click', () => document.getElementById('voicePanel').classList.toggle('hidden'));
  document.getElementById('interpretButton').addEventListener('click', interpretVoiceText);
  document.getElementById('speechButton').addEventListener('click', startSpeechCapture);
  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
    const form = document.getElementById('applicationForm');
    form.elements.reapplyDays.value = button.dataset.days;
    form.elements.customReapplyDate.value = '';
    updateApplicationCalculations();
  }));
}
function upsert(collection, record) {
  const index = state[collection].findIndex(item => item.id === record.id);
  if (index >= 0) state[collection][index] = record; else state[collection].push(record);
  saveState();
}

function bindApplicationCalculations() {
  const form = document.getElementById('applicationForm');
  form.elements.date.value = todayISO();
  form.addEventListener('input', updateApplicationCalculations);
  form.addEventListener('change', event => {
    if (event.target.name === 'cultureId') syncFieldsToCulture();
    updateApplicationCalculations();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const product = getProduct(data.productId);
    const risk = calculateRisk(data);
    const calculatedQty = Number(data.dose || 0) * Number(data.hectares || 0);
    const unitCost = productUnitCost(product);
    const usedQty = Number(data.usedQty || 0);
    const totalCost = usedQty * unitCost;
    const app = {
      id: data.id || id(), date: data.date, cultureId: data.cultureId, fieldId: data.fieldId, hectares: Number(data.hectares),
      productId: data.productId, productType: data.productType, dose: Number(data.dose), calculatedQty, usedQty,
      totalCost, costPerHa: Number(data.hectares) ? totalCost / Number(data.hectares) : 0,
      difference: calculatedQty ? ((usedQty - calculatedQty) / calculatedQty) * 100 : 0,
      reason: data.reason, problem: data.problem || 'Não informado', level: data.level, operator: data.operator || 'Não informado', note: data.note,
      weather: { wind: data.wind, fog: data.fog, rainAfter: data.rainAfter, wetSoil: data.wetSoil, timeOfDay: data.timeOfDay },
      risk, reapplyDays: Number(data.reapplyDays || 0), nextReapply: data.customReapplyDate || (data.reapplyDays ? addDays(data.date, data.reapplyDays) : ''),
      graceDays: Number(data.graceDays || 0), graceEnd: data.graceDays ? addDays(data.date, data.graceDays) : '',
    };
    if (product) product.stock = Math.max(0, Number(product.stock || 0) - usedQty);
    state.applications.push(app);
    saveState(); form.reset(); form.elements.date.value = todayISO(); toast('Aplicação salva e estoque atualizado.'); renderAll(); showScreen('dashboard');
  });
}
function updateApplicationCalculations() {
  const form = document.getElementById('applicationForm');
  const data = Object.fromEntries(new FormData(form));
  const product = getProduct(data.productId);
  form.elements.productType.value = product?.type || '';
  const calculated = Number(data.dose || 0) * Number(data.hectares || 0);
  const used = Number(data.usedQty || 0);
  const unitCost = productUnitCost(product);
  form.elements.calculatedQty.value = product ? qty(calculated, product.unit) : NUMBER.format(calculated);
  form.elements.totalCost.value = money(used * unitCost);
  form.elements.costPerHa.value = Number(data.hectares) ? money((used * unitCost) / Number(data.hectares)) : money(0);
  form.elements.difference.value = calculated ? `${NUMBER.format(((used - calculated) / calculated) * 100)}%` : '0%';
  const next = data.customReapplyDate || (data.reapplyDays ? addDays(data.date || todayISO(), data.reapplyDays) : '');
  form.elements.nextReapply.value = next ? new Date(`${next}T12:00:00`).toLocaleDateString('pt-BR') : '';
  const grace = data.graceDays ? addDays(data.date || todayISO(), data.graceDays) : '';
  form.elements.graceEnd.value = grace ? new Date(`${grace}T12:00:00`).toLocaleDateString('pt-BR') : '';
  renderApplicationWarnings(data, calculated, used);
}
function renderApplicationWarnings(data, calculated, used) {
  const risk = calculateRisk(data);
  const warnings = [];
  if (calculated && used > calculated) warnings.push(['danger', 'Atenção: uso acima do previsto. Verifique dose, regulagem ou área informada.']);
  if (risk.rain === 'alto') warnings.push(['danger', 'Risco alto: chuva até 1h depois da aplicação.']);
  if (risk.rain === 'médio') warnings.push(['warning', 'Risco médio: chuva até 3h depois da aplicação.']);
  if (risk.wind) warnings.push(['warning', 'Risco de deriva: havia vento forte.']);
  if (risk.fog) warnings.push(['warning', 'Atenção climática: havia neblina.']);
  document.getElementById('applicationWarnings').innerHTML = warnings.map(([type, text]) => `<div class="warning-box ${type}">${text}</div>`).join('');
}
function calculateRisk(data) {
  return { rain: data.rainAfter === 'Até 1h' ? 'alto' : data.rainAfter === 'Até 3h' ? 'médio' : '', wind: data.wind === 'Forte', fog: data.fog === 'Sim' };
}

function renderAll() {
  fillSelects();
  renderDashboard(); renderCultures(); renderFields(); renderProducts(); renderAlerts(); renderHistory(); renderReports(); updateApplicationCalculations();
}
function fillSelects() {
  const cultureOptions = state.cultures.map(c => `<option value="${c.id}">${c.name} • ${c.season}</option>`).join('');
  document.querySelectorAll('select[name="cultureId"]').forEach(select => {
    const first = select.closest('#historyFilters') ? '<option value="">Todas</option>' : '';
    select.innerHTML = first + cultureOptions;
  });
  syncFieldsToCulture();
  const productOptions = state.products.map(p => `<option value="${p.id}">${p.name} (${p.type})</option>`).join('');
  document.querySelectorAll('select[name="productId"]').forEach(select => {
    const first = select.closest('#historyFilters') ? '<option value="">Todos</option>' : '';
    select.innerHTML = first + productOptions;
  });
}
function syncFieldsToCulture() {
  const appForm = document.getElementById('applicationForm');
  const cultureId = appForm.elements.cultureId.value || state.cultures[0]?.id;
  const fieldOptions = state.fields.filter(f => !cultureId || f.cultureId === cultureId).map(f => `<option value="${f.id}">${f.name} • ${qty(f.hectares, 'ha')}</option>`).join('');
  document.querySelectorAll('select[name="fieldId"]').forEach(select => {
    const first = select.closest('#historyFilters') ? '<option value="">Todos</option>' : '';
    select.innerHTML = first + (select.closest('#applicationForm') ? fieldOptions : state.fields.map(f => `<option value="${f.id}">${f.name}</option>`).join(''));
  });
}

function getAlerts() {
  const today = todayISO();
  const alerts = [];
  state.applications.forEach(app => {
    const culture = getCulture(app.cultureId)?.name || 'Cultura';
    const field = getField(app.fieldId)?.name || 'Talhão';
    if (app.nextReapply) {
      const days = daysBetween(today, app.nextReapply);
      if (days < 0) alerts.push({ type: 'danger', group: 'Aplicação atrasada', title: `${culture} • ${field}`, text: `Reaplicação atrasada há ${Math.abs(days)} dia(s).` });
      else if (days === 0) alerts.push({ type: 'warning', group: 'Reaplicação hoje', title: `${culture} • ${field}`, text: 'Reaplicação vencendo hoje.' });
      else if (days <= 3) alerts.push({ type: 'info', group: 'Reaplicação em até 3 dias', title: `${culture} • ${field}`, text: `Reaplicação em ${days} dia(s).` });
    }
    if (app.graceEnd && daysBetween(today, app.graceEnd) >= 0) alerts.push({ type: 'info', group: 'Carência ativa', title: `${culture} • ${field}`, text: `Carência ativa até ${formatDate(app.graceEnd)}.` });
    if (app.risk?.rain) alerts.push({ type: app.risk.rain === 'alto' ? 'danger' : 'warning', group: 'Aplicação com risco por chuva', title: `${culture} • ${field}`, text: `Risco ${app.risk.rain} por chuva após a aplicação.` });
    if (app.risk?.wind) alerts.push({ type: 'warning', group: 'Aplicação com risco por vento', title: `${culture} • ${field}`, text: 'Risco de deriva por vento forte.' });
  });
  state.products.forEach(product => {
    if (Number(product.stock) <= Number(product.minStock)) alerts.push({ type: 'danger', group: 'Estoque baixo', title: product.name, text: `Estoque atual ${qty(product.stock, product.unit)} abaixo do mínimo ${qty(product.minStock, product.unit)}.` });
    if (Number(product.doseReference) && Number(product.stock) / Number(product.doseReference) < 5) alerts.push({ type: 'warning', group: 'Produto insuficiente para próxima aplicação', title: product.name, text: `Cobertura estimada de apenas ${qty(Number(product.stock) / Number(product.doseReference), 'ha')}.` });
  });
  return alerts;
}
function renderDashboard() {
  const alerts = getAlerts();
  const totalCost = state.applications.reduce((sum, app) => sum + Number(app.totalCost || 0), 0);
  const totalHa = state.applications.reduce((sum, app) => sum + Number(app.hectares || 0), 0);
  const count = group => alerts.filter(alert => alert.group === group).length;
  const riskCount = alerts.filter(alert => alert.group.includes('risco')).length;
  const metrics = [
    ['Reaplicações hoje', count('Reaplicação hoje')], ['Em até 3 dias', count('Reaplicação em até 3 dias')],
    ['Aplicações atrasadas', count('Aplicação atrasada')], ['Risco chuva/vento', riskCount],
    ['Estoque baixo', count('Estoque baixo')], ['Gasto na safra', money(totalCost)], ['Custo médio/ha', money(totalHa ? totalCost / totalHa : 0)], ['Aplicações', state.applications.length],
  ];
  document.getElementById('todayMetrics').innerHTML = metrics.map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  document.getElementById('dashboardAlerts').innerHTML = alerts.slice(0, 6).map(alertNotice).join('') || '<div class="empty">Nenhum alerta crítico agora.</div>';
  document.getElementById('stockCoverage').innerHTML = state.products.map(stockNotice).join('') || '<div class="empty">Cadastre produtos para acompanhar o estoque.</div>';
}
function alertNotice(alert) { return `<div class="notice ${alert.type}"><strong>${alert.group}: ${alert.title}</strong><p>${alert.text}</p></div>`; }
function stockNotice(product) {
  const coverage = product.doseReference ? Number(product.stock) / Number(product.doseReference) : 0;
  return `<div class="notice ${Number(product.stock) <= Number(product.minStock) ? 'danger' : ''}"><strong>${product.name}</strong><p>Saldo: ${qty(product.stock, product.unit)} • Cobre aproximadamente ${product.doseReference ? qty(coverage, 'ha') : 'dose não informada'}.</p></div>`;
}

function renderCultures() { document.getElementById('cultureList').innerHTML = cards(state.cultures, c => `<h3>${c.name}</h3><p>Safra ${c.season}</p><div class="meta"><span class="pill">${qty(c.area, 'ha')}</span><span class="pill info">${c.note || 'Sem observação'}</span></div>`); }
function renderFields() { document.getElementById('fieldList').innerHTML = cards(state.fields, f => `<h3>${f.name}</h3><p>Cultura: ${getCulture(f.cultureId)?.name || 'Não informada'}</p><div class="meta"><span class="pill">${qty(f.hectares, 'ha')}</span><span class="pill info">${f.note || 'Sem observação'}</span></div>`); }
function renderProducts() {
  document.getElementById('productList').innerHTML = cards(state.products, p => `<h3>${p.name}</h3><p>${p.type} • Unidade ${p.unit}</p><div class="meta"><span class="pill">Custo unitário ${money(productUnitCost(p))}</span><span class="pill ${Number(p.stock) <= Number(p.minStock) ? 'danger' : ''}">Estoque ${qty(p.stock, p.unit)}</span><span class="pill warning">Mínimo ${qty(p.minStock, p.unit)}</span><span class="pill info">Cobre ${p.doseReference ? qty(Number(p.stock) / Number(p.doseReference), 'ha') : 'não informado'}</span></div><p>${p.note || ''}</p>`);
}
function cards(items, template) { return items.map(item => `<article class="data-card">${template(item)}</article>`).join('') || '<div class="empty">Nenhum registro cadastrado.</div>'; }
function renderAlerts() { document.getElementById('alertsList').innerHTML = getAlerts().map(alert => `<article class="alert-card"><span class="pill ${alert.type}">${alert.group}</span><h3>${alert.title}</h3><p>${alert.text}</p></article>`).join('') || '<div class="empty">Sem alertas no momento.</div>'; }

function renderHistory() {
  const form = document.getElementById('historyFilters');
  const filters = Object.fromEntries(new FormData(form));
  let apps = [...state.applications].reverse();
  apps = apps.filter(app => !filters.cultureId || app.cultureId === filters.cultureId)
    .filter(app => !filters.fieldId || app.fieldId === filters.fieldId)
    .filter(app => !filters.productId || app.productId === filters.productId)
    .filter(app => !filters.operator || normalize(app.operator).includes(normalize(filters.operator)))
    .filter(app => !filters.start || app.date >= filters.start)
    .filter(app => !filters.end || app.date <= filters.end)
    .filter(app => !filters.riskOnly || app.risk?.rain || app.risk?.wind || app.risk?.fog)
    .filter(app => !filters.lateOnly || (app.nextReapply && daysBetween(todayISO(), app.nextReapply) < 0));
  document.getElementById('historyList').innerHTML = apps.map(applicationCard).join('') || '<div class="empty">Nenhuma aplicação encontrada para os filtros.</div>';
}
function applicationCard(app) {
  const product = getProduct(app.productId);
  const riskTags = [app.risk?.rain ? `Chuva risco ${app.risk.rain}` : '', app.risk?.wind ? 'Vento forte' : '', app.risk?.fog ? 'Neblina' : ''].filter(Boolean);
  return `<article class="data-card"><h3>${formatDate(app.date)} • ${getCulture(app.cultureId)?.name || 'Cultura'}</h3><p>${getField(app.fieldId)?.name || 'Talhão'} • ${product?.name || 'Produto'} • Operador: ${app.operator}</p><div class="meta"><span class="pill">${qty(app.hectares, 'ha')}</span><span class="pill">Usado ${qty(app.usedQty, product?.unit)}</span><span class="pill warning">${money(app.totalCost)}</span>${riskTags.map(tag => `<span class="pill danger">${tag}</span>`).join('')}</div><p>Motivo: ${app.reason} (${app.problem}) • Reaplicação: ${app.nextReapply ? formatDate(app.nextReapply) : 'não informada'} • Carência: ${app.graceEnd ? formatDate(app.graceEnd) : 'não informada'}</p></article>`;
}
function renderReports() {
  const byCulture = sumBy(state.applications, app => getCulture(app.cultureId)?.name || 'Não informada', app => app.totalCost);
  const byProduct = sumBy(state.applications, app => getProduct(app.productId)?.name || 'Não informado', app => app.usedQty);
  const byField = sumBy(state.applications, app => getField(app.fieldId)?.name || 'Não informado', app => app.totalCost);
  const mostUsed = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0];
  const costlyField = Object.entries(byField).sort((a, b) => b[1] - a[1])[0];
  const totalCost = state.applications.reduce((sum, app) => sum + app.totalCost, 0);
  const totalHa = state.applications.reduce((sum, app) => sum + app.hectares, 0);
  const reports = [
    ['Custo total por cultura', formatMap(byCulture, money)], ['Custo por hectare', money(totalHa ? totalCost / totalHa : 0)],
    ['Quantidade usada por produto', formatMap(byProduct, value => NUMBER.format(value))], ['Produto mais usado', mostUsed ? `${mostUsed[0]} (${NUMBER.format(mostUsed[1])})` : 'Sem dados'],
    ['Talhão com maior custo', costlyField ? `${costlyField[0]} • ${money(costlyField[1])}` : 'Sem dados'], ['Aplicações com risco climático', state.applications.filter(app => app.risk?.rain || app.risk?.wind || app.risk?.fog).length],
    ['Saldo de estoque', state.products.map(p => `${p.name}: ${qty(p.stock, p.unit)}`).join('<br>') || 'Sem produtos'], ['Hectares que o estoque cobre', state.products.map(p => `${p.name}: ${p.doseReference ? qty(Number(p.stock) / Number(p.doseReference), 'ha') : 'dose não informada'}`).join('<br>') || 'Sem produtos'],
  ];
  document.getElementById('reportsGrid').innerHTML = reports.map(([title, value]) => `<article class="report-card"><h3>${title}</h3><p>${value}</p></article>`).join('');
}
function sumBy(items, keyFn, valueFn) { return items.reduce((acc, item) => { const key = keyFn(item); acc[key] = (acc[key] || 0) + Number(valueFn(item) || 0); return acc; }, {}); }
function formatMap(map, formatter) { const entries = Object.entries(map); return entries.length ? entries.map(([k, v]) => `${k}: ${formatter(v)}`).join('<br>') : 'Sem dados'; }
function formatDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR'); }

function interpretVoiceText() {
  const text = document.getElementById('voiceText').value;
  if (!text.trim()) return toast('Digite ou fale uma descrição antes de interpretar.');
  const form = document.getElementById('applicationForm');
  const plain = normalize(text);
  const dateMatch = plain.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
  if (plain.includes('hoje')) form.elements.date.value = todayISO();
  else if (dateMatch) {
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : new Date().getFullYear();
    form.elements.date.value = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
  }
  selectByText(form.elements.cultureId, state.cultures, plain); syncFieldsToCulture(); selectByText(form.elements.fieldId, state.fields, plain); selectByText(form.elements.productId, state.products, plain);
  const area = plain.match(/(\d+(?:[,.]\d+)?)\s*(?:ha|hectare|hectares)/); if (area) form.elements.hectares.value = area[1].replace(',', '.');
  const dose = plain.match(/dose\s*(?:de)?\s*(\d+(?:[,.]\d+)?)/) || plain.match(/(\d+(?:[,.]\d+)?)\s*(?:l|ml|kg|g)\s*(?:por|\/)?\s*(?:ha|hectare)/); if (dose) form.elements.dose.value = dose[1].replace(',', '.');
  const used = plain.match(/(?:usei|usado|usou|gastei)\s*(\d+(?:[,.]\d+)?)/); if (used) form.elements.usedQty.value = used[1].replace(',', '.');
  if (plain.includes('vento forte')) form.elements.wind.value = 'Forte'; else if (plain.includes('vento pouco') || plain.includes('pouco vento')) form.elements.wind.value = 'Pouco'; else if (plain.includes('sem vento')) form.elements.wind.value = 'Não';
  if (plain.includes('neblina')) form.elements.fog.value = 'Sim';
  if (plain.includes('ate 1h') || plain.includes('ate 1 hora')) form.elements.rainAfter.value = 'Até 1h'; else if (plain.includes('ate 3h') || plain.includes('ate 3 horas')) form.elements.rainAfter.value = 'Até 3h'; else if (plain.includes('mesmo dia')) form.elements.rainAfter.value = 'No mesmo dia';
  ['praga', 'doenca', 'mato', 'preventivo'].forEach(reason => { if (plain.includes(reason)) form.elements.reason.value = reason === 'doenca' ? 'Doença' : reason[0].toUpperCase() + reason.slice(1); });
  const reapply = plain.match(/reaplic(?:ar|acao)?\s*(?:em)?\s*(\d+)\s*dias?/); if (reapply) form.elements.reapplyDays.value = reapply[1];
  const grace = plain.match(/carencia\s*(?:de)?\s*(\d+)\s*dias?/); if (grace) form.elements.graceDays.value = grace[1];
  ['problem', 'operator', 'note'].forEach(name => { if (!form.elements[name].value) form.elements[name].placeholder = 'Não informado — toque para editar'; });
  const missing = [
    ['date', 'data'], ['cultureId', 'cultura'], ['fieldId', 'talhão/local'], ['hectares', 'área aplicada'],
    ['productId', 'produto'], ['dose', 'dose por hectare'], ['usedQty', 'quantidade usada'], ['operator', 'operador'],
  ].filter(([name]) => !form.elements[name].value).map(([, label]) => label);
  document.getElementById('voiceStatus').innerHTML = missing.length
    ? `<div>Não informado: ${missing.join(', ')}. Revise e edite manualmente antes de confirmar.</div>`
    : '<div>Campos principais interpretados. Revise todos os dados antes de confirmar.</div>';
  updateApplicationCalculations(); toast('Interpretação preenchida. Revise e confirme antes de salvar.');
}
function selectByText(select, records, plain) { const found = records.find(record => plain.includes(normalize(record.name))); if (found) select.value = found.id; }
function startSpeechCapture() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Reconhecimento de voz indisponível neste navegador. Digite o texto no campo.');
  const recognition = new SpeechRecognition(); recognition.lang = 'pt-BR'; recognition.interimResults = false;
  recognition.onresult = event => { document.getElementById('voiceText').value = event.results[0][0].transcript; toast('Voz capturada. Clique em interpretar.'); };
  recognition.start();
}
function toast(message) { const node = document.getElementById('toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2600); }

document.addEventListener('DOMContentLoaded', init);
