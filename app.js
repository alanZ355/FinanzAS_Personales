/* Finanzas Personales — 100% local, Vanilla JS */
const STORAGE_KEY = 'finanzas_movimientos_v1';
const VERDE = '#22c55e';
const ROJO = '#ef4444';

const $ = (id) => document.getElementById(id);
const form = $('form');
const tipoEl = $('tipo');
const montoEl = $('monto');
const detalleEl = $('detalle');
const fechaEl = $('fecha');
const formError = $('formError');
const btnSubmit = $('btnSubmit');
const btnCancel = $('btnCancel');
const formTitle = $('formTitle');
const listaEl = $('lista');
const listEmpty = $('listEmpty');
const countEl = $('count');
const saldoTotal = $('saldoTotal');
const totalIngresos = $('totalIngresos');
const totalGastos = $('totalGastos');
const chartEmpty = $('chartEmpty');
const backupMsg = $('backupMsg');

let movimientos = load();
let editingId = null;
let chart = null;

// (1) Generador de ids con guarda de `crypto` (funciona en file://, http no-seguro, navegadores viejos)
function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* cae al fallback */ }
  return String(Date.now().toString(36)) + '-' + Math.random().toString(36).slice(2, 10);
}

// (14) Fecha de hoy en YYYY-MM-DD local (evita desplazamiento por zona horaria)
function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function setToday() {
  fechaEl.value = todayLocalISO();
}
setToday();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidMovimiento);
  } catch { return []; }
}

// (3) save() con try/catch: setItem puede lanzar (cuota, modo privado, cookies bloqueadas)
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movimientos));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
function warnSaveFailed() {
  const msg = 'No se pudo guardar en este dispositivo (almacenamiento lleno o bloqueado).';
  showError(msg);
  backupMsg.textContent = msg;
}

// (11) Validación de fecha real, no solo formato (rechaza 2026-02-30, 2026-13-01…)
function isValidFecha(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidMovimiento(m) {
  if (!m || typeof m !== 'object') return false;
  if (m.tipo !== 'ingreso' && m.tipo !== 'gasto') return false;
  if (typeof m.monto !== 'number' || !Number.isFinite(m.monto) || m.monto <= 0) return false;
  if (typeof m.detalle !== 'string' || !m.detalle.trim()) return false;
  if (!isValidFecha(m.fecha)) return false;
  // (2) id restringido a [A-Za-z0-9_-] para que sea seguro interpolarlo como atributo/DOM
  if (typeof m.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(m.id)) return false;
  return true;
}

// (9) Formato de moneda: signo delante ($1,234.56 / -$1,234.56), sin .slice() muerto
const fmtMoney = (n) => {
  const v = Number(n);
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function computeTotals() {
  let ing = 0, gas = 0;
  for (const m of movimientos) {
    if (m.tipo === 'ingreso') ing += m.monto;
    else gas += m.monto;
  }
  return { ing, gas, total: ing - gas };
}

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = !msg;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  showError('');

  const tipo = tipoEl.value;
  const monto = Number(montoEl.value);
  const detalle = detalleEl.value.trim();
  const fecha = fechaEl.value;

  if (!tipo || (tipo !== 'ingreso' && tipo !== 'gasto'))
    return showError('Selecciona un tipo: Ingreso o Gasto.');
  if (!Number.isFinite(monto) || monto <= 0)
    return showError('El monto debe ser un número mayor a $0.00.');
  if (!detalle)
    return showError('El detalle / descripción es obligatorio.');
  // (11) Misma validación estricta que en import, no solo "no vacío"
  if (!isValidFecha(fecha))
    return showError('La fecha no es válida (usa YYYY-MM-DD).');

  if (editingId) {
    const i = movimientos.findIndex((m) => m.id === editingId);
    if (i >= 0) movimientos[i] = { ...movimientos[i], tipo, monto, detalle, fecha };
    editingId = null;
    formTitle.textContent = 'Nuevo movimiento';
    btnSubmit.textContent = 'Agregar';
    btnCancel.hidden = true;
  } else {
    movimientos.unshift({
      id: newId(),
      tipo, monto, detalle, fecha,
    });
  }

  if (!save()) { warnSaveFailed(); return; }
  form.reset();
  setToday();
  render();
});

btnCancel.addEventListener('click', () => {
  editingId = null;
  form.reset();
  setToday();
  formTitle.textContent = 'Nuevo movimiento';
  btnSubmit.textContent = 'Agregar';
  btnCancel.hidden = true;
  showError('');
});

function startEdit(id) {
  const m = movimientos.find((x) => x.id === id);
  if (!m) return;
  editingId = id;
  tipoEl.value = m.tipo;
  montoEl.value = m.monto;
  detalleEl.value = m.detalle;
  fechaEl.value = m.fecha;
  formTitle.textContent = 'Editar movimiento';
  btnSubmit.textContent = 'Guardar cambios';
  btnCancel.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  tipoEl.focus();
}

function removeMov(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  movimientos = movimientos.filter((m) => m.id !== id);
  if (editingId === id) btnCancel.click();
  if (!save()) { warnSaveFailed(); return; }
  render();
}

listaEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'edit') startEdit(id);
  if (action === 'del') removeMov(id);
});

function render() {
  const { ing, gas, total } = computeTotals();
  totalIngresos.textContent = fmtMoney(ing);
  totalGastos.textContent = fmtMoney(gas);
  saldoTotal.textContent = fmtMoney(total);
  saldoTotal.className = 'balance' + (total > 0 ? ' pos' : total < 0 ? ' neg' : '');

  // (8) Orden por fecha desc con 2º criterio explícito: posición de creación
  const sorted = [...movimientos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || movimientos.indexOf(a) - movimientos.indexOf(b)
  );
  countEl.textContent = sorted.length ? `(${sorted.length})` : '';
  listEmpty.style.display = sorted.length ? 'none' : 'block';
  listaEl.innerHTML = '';
  // (2, 13, 15, 17) DOM puro: sin innerHTML, sin XSS por id, signo ASCII, botones con aria-label
  for (const m of sorted) {
    const li = document.createElement('li');
    li.className = 'item';

    const dot = document.createElement('span');
    dot.className = 'dot ' + (m.tipo === 'gasto' ? 'gasto' : 'ingreso');
    dot.setAttribute('aria-hidden', 'true');

    const main = document.createElement('div');
    main.className = 'item-main';
    const strong = document.createElement('strong');
    strong.textContent = m.detalle;
    const small = document.createElement('small');
    small.textContent = (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') + ' · ' + m.fecha;
    main.append(strong, small);

    const montoSpan = document.createElement('span');
    montoSpan.className = 'item-monto ' + (m.tipo === 'gasto' ? 'gasto' : 'ingreso');
    const signo = m.tipo === 'ingreso' ? '+' : '-';
    montoSpan.textContent = signo + fmtMoney(m.monto);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.type = 'button';
    btnEdit.dataset.action = 'edit';
    btnEdit.dataset.id = m.id;
    btnEdit.title = 'Editar';
    btnEdit.setAttribute('aria-label', 'Editar ' + m.detalle);
    btnEdit.textContent = '✏️';
    const btnDel = document.createElement('button');
    btnDel.className = 'icon-btn';
    btnDel.type = 'button';
    btnDel.dataset.action = 'del';
    btnDel.dataset.id = m.id;
    btnDel.title = 'Eliminar';
    btnDel.setAttribute('aria-label', 'Eliminar ' + m.detalle);
    btnDel.textContent = '🗑️';
    actions.append(btnEdit, btnDel);

    li.append(dot, main, montoSpan, actions);
    listaEl.appendChild(li);
  }

  renderChart(ing, gas);
}

function renderChart(ing, gas) {
  // (10) Sin datos: destruir instancia previa y no crear Chart([0,0])
  const hasData = ing > 0 || gas > 0;
  chartEmpty.style.display = hasData ? 'none' : 'grid';
  if (typeof Chart === 'undefined') return;
  if (!hasData) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }
  const ctx = $('chart');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Ingresos', 'Gastos'],
      datasets: [{ data: [ing, gas], backgroundColor: [VERDE, ROJO], borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

// Backup: exportar (12) con appendChild para Safari + manejo de errores
$('btnExport').addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify(movimientos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `finanzas-backup-${d}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    backupMsg.textContent = `Copia exportada: ${movimientos.length} movimiento(s).`;
  } catch (err) {
    console.error(err);
    backupMsg.textContent = 'No se pudo exportar la copia.';
  }
});

// (18) Botón Importar focable por teclado que delega al input oculto
const btnImport = $('btnImport');
if (btnImport) {
  btnImport.addEventListener('click', () => $('fileImport').click());
}

// Backup: importar con validación estricta
$('fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => { backupMsg.textContent = 'No se pudo leer el archivo.'; };
  reader.onload = () => {
    try {
      if (!reader.result || !String(reader.result).trim())
        throw new Error('archivo vacío o ilegible');
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data)) throw new Error('estructura no válida (se esperaba una lista)');
      // (6) Se permite lista vacía: sirve para restaurar un backup intencionalmente vacío
      const limpios = [];
      const vistos = new Set();
      for (const m of data) {
        const norm = {
          // (1) sin referencia directa a crypto; (7) id legacy no conforme se regenera
          id: (typeof m.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(m.id)) ? m.id : newId(),
          tipo: m.tipo,
          monto: Number(m.monto),
          detalle: typeof m.detalle === 'string' ? m.detalle.trim() : '',
          fecha: m.fecha,
        };
        if (!isValidMovimiento(norm)) throw new Error('movimiento inválido: ' + JSON.stringify(m).slice(0, 100));
        // (7) Rechaza ids duplicados (editaría el primero / borraría ambos)
        if (vistos.has(norm.id)) throw new Error('id duplicado en el backup: ' + norm.id);
        vistos.add(norm.id);
        limpios.push(norm);
      }
      if (!confirm(`Se reemplazarán ${movimientos.length} movimiento(s) por ${limpios.length} del backup. ¿Continuar?`)) return;
      movimientos = limpios;
      if (!save()) { warnSaveFailed(); return; }
      render();
      backupMsg.textContent = `Backup restaurado: ${limpios.length} movimiento(s).`;
    } catch (err) {
      backupMsg.textContent = 'Importación rechazada: ' + err.message;
    }
  };
  reader.readAsText(file);
});

$('btnWipe').addEventListener('click', () => {
  if (!movimientos.length) return;
  if (!confirm('¿Borrar TODOS los datos locales? Exporta antes si los necesitas.')) return;
  movimientos = [];
  editingId = null;
  if (!save()) { warnSaveFailed(); return; }
  render();
  backupMsg.textContent = 'Datos locales borrados.';
});

render();
