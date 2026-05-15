// ─── CONFIG ─────────────────────────────────────────────────────────────────
// Reemplazá estos valores con los de tu proyecto Supabase
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://kgoupyevvazwfkrvekfu.supabase.co';
const SUPABASE_KEY = window.ENV_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnb3VweWV2dmF6d2ZrcnZla2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjQsImV4cCI6MjA5NDI3Njg2NH0.kOPjymydE1ezGxMEIKhwhbIQmnxG5felXiURhaIyk6E';
// ────────────────────────────────────────────────────────────────────────────

let sb, currentUser;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
let allGastos = [];
let allRecurrentes = [];
let dolarHoy = 1200; 
let prefMoneda = localStorage.getItem('prefMoneda') || 'ARS';
let tarjetasCfg = [
  { tarjeta: 'Visa', dia_cierre: 15, dia_vencimiento: 25 },
  { tarjeta: 'Mastercard', dia_cierre: 20, dia_vencimiento: 30 },
  { tarjeta: 'Amex', dia_cierre: 10, dia_vencimiento: 20 }
];
let usuarios = [];
let categorias = [
  { id: 'cat-1', nombre: 'Supermercado', color: '#1D9E75' },
  { id: 'cat-2', nombre: 'Servicios', color: '#185FA5' },
  { id: 'cat-3', nombre: 'Transporte', color: '#BA7517' },
  { id: 'cat-4', nombre: 'Salud', color: '#D85A30' },
  { id: 'cat-5', nombre: 'Educación', color: '#7F77DD' },
  { id: 'cat-6', nombre: 'Entretenimiento', color: '#D4537E' },
  { id: 'cat-7', nombre: 'Ropa', color: '#888780' },
  { id: 'cat-8', nombre: 'Deudas', color: '#185FA5' },
  { id: 'cat-9', nombre: 'Otros', color: '#639922' }
];
let dashMonth = new Date(); dashMonth.setDate(1);

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await showApp();
    } else {
      showAuth();
    }
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        await showApp();
      } else if (event === 'SIGNED_OUT') {
        showAuth();
      }
    });
  } catch (e) {
    showToast('Error de conexión con Supabase. Verificá la configuración.', 'err');
  }
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('app-nav').style.display = 'none';
}

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('app-content').style.display = 'block';
  document.getElementById('app-nav').style.display = 'flex';

  const meta = currentUser.user_metadata;
  const name = meta?.name || currentUser.email.split('@')[0];
  document.getElementById('header-user').textContent = `Hola, ${name}`;
  document.getElementById('cfg-email').textContent = currentUser.email;
  document.getElementById('cfg-name').textContent = name;

  setSyncStatus('ok');
  
  // Pedir permiso para notificaciones
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Carga paralela para mayor velocidad
  await Promise.all([
    loadCategorias(),
    loadUsuarios(),
    loadGastos(),
    loadDeudas(),
    loadRecurrentes(),
    loadTarjetasConfig(),
    loadIngresos(),
    loadGoals()
  ]);
  
  document.getElementById('pref-moneda').value = prefMoneda;
  fetchDolar();
  
  // Activar Realtime
  subscribeRealtime();
  
  initForm();
  renderDash();
  updateNotifStatus();
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones de escritorio.");
    return;
  }
  Notification.requestPermission().then(permission => {
    updateNotifStatus();
    if (permission === "granted") {
      showToast("¡Notificaciones activadas! ✓");
      new Notification("Gastos Familiares", { body: "Las notificaciones están configuradas correctamente." });
    } else {
      showToast("Permiso de notificación denegado", "err");
    }
  });
}

function updateNotifStatus() {
  const el = document.getElementById('notif-status');
  if (!el) return;
  if (!("Notification" in window)) {
    el.textContent = "Navegador no compatible.";
  } else if (Notification.permission === "granted") {
    el.textContent = "✓ Notificaciones activadas.";
    el.style.color = "var(--green)";
  } else if (Notification.permission === "denied") {
    el.textContent = "✕ Notificaciones bloqueadas en este navegador.";
    el.style.color = "var(--red)";
  } else {
    el.textContent = "Estado: Pendiente de activar.";
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register')));
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  clearAuthMessages();
}

function clearAuthMessages() {
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-msg').style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('auth-msg').style.display = 'none';
}

function showAuthMsg(msg) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
}

async function login() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  if (!email || !pass) { showAuthError('Completá todos los campos'); return; }
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner"></span> Ingresando...'; btn.classList.add('btn-loading');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.innerHTML = 'Ingresar'; btn.classList.remove('btn-loading');
  if (error) showAuthError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message);
}

async function register() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass = document.getElementById('r-pass').value;
  if (!name || !email || !pass) { showAuthError('Completá todos los campos'); return; }
  if (pass.length < 6) { showAuthError('La contraseña debe tener al menos 6 caracteres'); return; }
  const btn = document.getElementById('register-btn');
  btn.innerHTML = '<span class="spinner"></span> Creando cuenta...'; btn.classList.add('btn-loading');
  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: { data: { name } }
  });

  if (!error && data?.user) {
    await sb.from('profiles').insert([{
      id: data.user.id,
      name: name,
      email: email
    }]);
  }

  btn.innerHTML = 'Crear cuenta'; btn.classList.remove('btn-loading');

  if (error) showAuthError(error.message);
  else showAuthMsg('¡Cuenta creada! Revisá tu email para confirmar y luego ingresá.');
}

async function forgotPass() {
  const email = prompt('Ingresá tu email para recuperar la contraseña:');
  if (!email) return;
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) showAuthError(error.message);
  else showAuthMsg('Te enviamos un email para restablecer tu contraseña.');
}

async function logout() {
  stopPolling();
  await sb.auth.signOut();
  allGastos = [];
  currentUser = null;
}

// ─── SYNC STATUS ─────────────────────────────────────────────────────────────
function setSyncStatus(status) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-label');
  if (status === 'ok') { dot.className = 'sync-dot'; lbl.textContent = 'Sincronizado'; }
  else if (status === 'sync') { dot.className = 'sync-dot warn'; lbl.textContent = 'Guardando...'; }
  else { dot.className = 'sync-dot warn'; lbl.textContent = 'Sin conexión'; }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.className = 'toast ' + type; t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 3000);
}

// ─── SUPABASE DATA ───────────────────────────────────────────────────────────
async function loadCategorias() {
  const { data, error } = await sb.from('categorias').select('*').order('nombre');
  if (data && data.length) {
    categorias = data;
    // Asegurar que 'Deudas' esté presente si no viene de la DB
    if (!categorias.find(c => c.nombre === 'Deudas')) {
      categorias.push({ id: 'cat-deu', nombre: 'Deudas', color: '#185FA5' });
    }
  }
}

async function fetchDolar() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue');
    const data = await res.json();
    if (data && data.compra) {
      dolarHoy = data.compra;
      renderDash();
      renderDeudas();
    }
  } catch (e) { console.error('Error fetching dolar', e); }
}

async function loadTarjetasConfig() {
  const { data, error } = await sb.from('tarjetas_config').select('*');
  if (data && data.length) tarjetasCfg = data;
}

async function saveTarjetaConfig(tarjeta, dia_cierre) {
  const { error } = await sb.from('tarjetas_config').upsert({ 
    tarjeta, 
    dia_cierre: parseInt(dia_cierre),
    user_id: currentUser.id 
  }, { onConflict: 'tarjeta' });
  
  if (error) showToast('Error al guardar config de tarjeta', 'err');
  else {
    await loadTarjetasConfig();
    renderDeudas();
    showToast('Configuración de tarjeta guardada ✓');
  }
}

async function loadUsuarios() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('name');

  if (data) usuarios = data;
}

async function loadGastos() {
  const { data, error } = await sb.from('gastos').select('*').order('fecha', { ascending: false });
  if (data) { 
    allGastos = data; 
    renderDash(); 
    renderEvolutionChart();
  }
}

async function saveGastoToDB(gasto) {
  setSyncStatus('sync');
  try {
    const { error } = await sb.from('gastos').insert([gasto]);
    if (error) { setSyncStatus('err'); return { data: null, error }; }
    setSyncStatus('ok');
    return { data: [gasto], error: null };
  } catch (e) {
    setSyncStatus('err');
    return { data: null, error: { message: e.message } };
  }
}

async function deleteGastoDB(id) {
  setSyncStatus('sync');
  const { error } = await sb.from('gastos').delete().eq('id', id);
  setSyncStatus(error ? 'err' : 'ok');
  return { error };
}

async function saveCategoriaDB(cat) {
  const { data, error } = await sb.from('categorias').insert([cat]).select();
  return { data, error };
}

async function deleteCategoriaDB(id) {
  const { error } = await sb.from('categorias').delete().eq('id', id);
  return { error };
}

let realtimeChannel = null;
function subscribeRealtime() {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  
  realtimeChannel = sb.channel('public:gastos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, async (payload) => {
      // Recargar datos solo cuando sea necesario
      const { data } = await sb.from('gastos').select('*').order('fecha', { ascending: false });
      if (data) {
        allGastos = data;
        renderDash();
        
        // Notificación si el cambio es de otra persona
        if (payload.eventType === 'INSERT' && payload.new.user_id !== currentUser.id) {
          const partner = payload.new.persona || 'Tu pareja';
          const monto = payload.new.moneda === 'USD' ? 'U$D ' + payload.new.monto : '$' + payload.new.monto;
          
          showToast(`${partner} cargó un gasto de ${monto}`, 'info');
          
          if (Notification.permission === 'granted') {
            new Notification('💰 Nuevo Gasto Familiar', {
              body: `${partner} cargó: ${payload.new.descripcion || payload.new.categoria} por ${monto}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/2454/2454282.png'
            });
          }
        }
      }
    })
    .subscribe();
}

function stopPolling() {
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(n) { 
  const val = prefMoneda === 'USD' ? (n / dolarHoy) : n;
  return (prefMoneda === 'USD' ? 'U$D ' : '$') + parseFloat(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
function fdate(d) { return (d || '').split('-').reverse().join('/'); }
function catColor(nombre) { 
  if (nombre === 'Deudas') return '#185FA5';
  return (categorias.find(c => c.nombre === nombre) || { color: '#888' }).color; 
}
const EMOJIS = { 'Supermercado': '🛒', 'Servicios': '💡', 'Transporte': '🚗', 'Salud': '💊', 'Educación': '📚', 'Entretenimiento': '🎬', 'Ropa': '👕', 'Deudas': '💳', 'Otros': '📦' };
function catEmoji(n) { return EMOJIS[n] || '📦'; }
function personaBadge(p) {
  const currentProfile = usuarios.find(u => u.id === currentUser.id);
  const miNombre = currentProfile?.name || '';

  let cls = 'b-ambos';

  if (p === miNombre) {
    cls = 'b-yo';
  } else if (p !== 'Ambos' && p !== '') {
    cls = 'b-senora';
  }

  return `<span class="badge ${cls}">${p || 'Ambos'}</span>`;
}

function fmtGasto(n, moneda) {
  let finalVal = n;
  if (moneda === 'USD' && prefMoneda === 'ARS') finalVal = n * dolarHoy;
  if (moneda === 'ARS' && prefMoneda === 'USD') finalVal = n / dolarHoy;
  
  const symbol = prefMoneda === 'USD' ? 'U$D ' : '$';
  const res = symbol + parseFloat(finalVal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  if (moneda !== prefMoneda) {
    const origSymbol = moneda === 'USD' ? 'U$D ' : '$';
    const orig = origSymbol + parseFloat(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${res} <span style="font-size:10px;font-weight:400;color:var(--text3);display:block">Original: ${orig}</span>`;
  }
  return res;
}
const fmtDeuda = fmtGasto;


// ─── TABS ────────────────────────────────────────────────────────────────────
function switchTab(t) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tabs = ['home', 'nuevo', 'hist', 'bal', 'goals', 'rep', 'deu', 'rec', 'met', 'cfg'];
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', b.id === 'nb-' + t));
  document.getElementById('p-' + t).classList.add('active');
  document.getElementById('app-content').scrollTop = 0;
  
  // Auto scroll navigation to keep active button visible
  const activeBtn = document.getElementById('nb-' + t);
  if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  if (t === 'home') renderDash();
  if (t === 'nuevo') initForm();
  if (t === 'hist') { initHist(); loadHistorial(); }
  if (t === 'bal') renderBalance();
  if (t === 'goals') renderGoals();
  if (t === 'deu') renderDeudas();
  if (t === 'rec') renderRecurrentes();
  if (t === 'met') renderMetrics();
  if (t === 'cfg') renderConfig();
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function renderDashDeudas() {
  const activas = allDeudas.filter(d => (d.cuotas_pagas||0) < (d.cuotas_total||1));
  if (activas.length === 0) {
    const el = document.getElementById('dash-deudas');
    if (el) el.style.display = 'none';
    return;
  }
  const el = document.getElementById('dash-deudas');
  if (el) {
    el.style.display = 'block';
    const tarjetas = ['Visa','Mastercard','Amex'];
    const porTarjeta = {};
    tarjetas.forEach(t => { porTarjeta[t] = { ars:0, usd:0 }; });
    activas.forEach(d => {
      if (porTarjeta[d.tarjeta]) {
        if (d.moneda === 'USD') porTarjeta[d.tarjeta].usd += parseFloat(d.monto_cuota||0);
        else porTarjeta[d.tarjeta].ars += parseFloat(d.monto_cuota||0);
      }
    });
    el.innerHTML = '<div class="card-title">Cuotas este mes</div>' +
      tarjetas.filter(t => porTarjeta[t].ars > 0 || porTarjeta[t].usd > 0).map(t => {
        const color = TARJETA_COLORS[t];
        let montos = [];
        if (porTarjeta[t].ars > 0) montos.push('$'+porTarjeta[t].ars.toLocaleString('es-AR',{minimumFractionDigits:2}));
        if (porTarjeta[t].usd > 0) montos.push('U$D '+porTarjeta[t].usd.toLocaleString('es-AR',{minimumFractionDigits:2}));
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
          <span class="tarjeta-badge" style="background:${color};color:white">${t}</span>
          <span style="font-size:13px;font-weight:600">${montos.join(' + ')}/mes</span>
        </div>`;
      }).join('') +
      `<button class="btn btn-sm" onclick="switchTab('deu')" style="margin-top:10px;width:100%">Ver detalle →</button>`;
  }
}

    function changeMonth(d) { dashMonth.setMonth(dashMonth.getMonth() + d); renderDash(); }

function getMonthGastos() {
  const y = dashMonth.getFullYear(), m = String(dashMonth.getMonth() + 1).padStart(2, '0');
  return allGastos.filter(g => g.fecha && g.fecha.startsWith(`${y}-${m}`));
}

function renderDash() {
  const mg = getMonthGastos();
  renderDashDeudas();
  renderEvolutionChart();
  document.getElementById('dash-month').textContent = `${MESES[dashMonth.getMonth()]} ${dashMonth.getFullYear()}`;
  
  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  const ym = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}`;
  const totalGastos = mg.reduce((s, g) => s + getMontoARS(g), 0);
  const totalCuotas = getCuotasMes(ym);
  const total = totalGastos + totalCuotas;

  const currentProfile = usuarios.find(u => u.id === currentUser?.id);
  const miNombre = currentProfile?.name || '';
  const parejaProfile = usuarios.find(u => u.id !== currentUser?.id);
  const parejaNombre = parejaProfile?.name || 'Pareja';

  const yo = mg
    .filter(g => g.persona === miNombre)
    .reduce((s, g) => s + getMontoARS(g), 0);

  const pareja = mg
    .filter(g => g.persona !== miNombre && g.persona !== 'Ambos')
    .reduce((s, g) => s + getMontoARS(g), 0);

  const totalIngresos = allIngresos
    .filter(i => i.fecha && i.fecha.startsWith(ym))
    .reduce((s, i) => s + getMontoARS(i), 0);
  const balanceNeto = totalIngresos - total;

  document.getElementById('dash-metrics').innerHTML = `
  <div class="metric" style="grid-column:1/-1; background:var(--surface2)">
    <div class="metric-label">Balance Neto (Sobrante)</div>
    <div class="metric-value ${balanceNeto >= 0 ? 'g' : 'r'}">${fmt(balanceNeto)}</div>
    <div style="font-size:10px; color:var(--text3); margin-top:4px">Ingresos: ${fmt(totalIngresos)} | Gastos: ${fmt(total)}</div>
  </div>
  <div class="metric" style="grid-column:1/-1">
    <div class="metric-label">Total del mes (Gastos + Pendientes)</div>
    <div class="metric-value">${fmt(total)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Gastos del mes</div>
    <div class="metric-value">${fmt(totalGastos)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Cuotas pendientes</div>
    <div class="metric-value" style="color:var(--text3)">${fmt(totalCuotas)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">${miNombre || 'Yo'}</div>
    <div class="metric-value r">${fmt(yo)}</div>
  </div>
  <div class="metric">
    <div class="metric-label">${parejaNombre}</div>
    <div class="metric-value r">${fmt(pareja)}</div>
  </div>
  `;
  const catMap = {};
  mg.forEach(g => { 
    const montoARS = getMontoARS(g);
    catMap[g.categoria] = (catMap[g.categoria] || 0) + montoARS; 
  });

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  
  document.getElementById('dash-cats').innerHTML = sorted.length
    ? sorted.map(([cat, val]) => {
        const cInfo = categorias.find(c => c.nombre === cat) || {};
        const ppto = parseFloat(cInfo.presupuesto || 0);
        const pct = ppto > 0 ? Math.round((val / ppto) * 100) : 0;
        const barColor = (ppto > 0 && val > ppto) ? 'var(--red)' : catColor(cat);
        
        return `<div class="cat-row">
        <div class="cat-row-head">
          <span class="cat-name"><span class="cat-dot" style="background:${catColor(cat)}"></span>${cat}</span>
          <span class="cat-val">${fmt(val)} ${ppto > 0 ? `<span style="color:var(--text3);font-size:11px;font-weight:400">/ ${fmt(ppto)}</span>` : ''}</span>
        </div>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${ppto > 0 ? Math.min(pct, 100) : (val / (sorted[0][1] || 1) * 100)}%;background:${barColor}"></div>
        </div>
        ${ppto > 0 ? `<div style="font-size:10px;text-align:right;margin-top:2px;color:${val > ppto ? 'var(--red)' : 'var(--text2)'}">${pct}% del presupuesto</div>` : ''}
      </div>`;
    }).join('')
    : '<div class="empty"><div class="empty-icon">📊</div>Sin gastos en este mes</div>';

  const recent = mg.slice(0, 5);
  document.getElementById('dash-recent').innerHTML = recent.length
    ? recent.map(g => `<div class="tx-item">
    <div class="tx-dot" style="background:${catColor(g.categoria)}33">${catEmoji(g.categoria)}</div>
    <div class="tx-info">
      <div class="tx-desc">${g.descripcion || g.categoria}</div>
      <div class="tx-meta">${g.categoria} · ${personaBadge(g.persona)}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount">${fmtGasto(g.monto, g.moneda)}</div>
      <div class="tx-date">${fdate(g.fecha)}</div>
    </div>

  </div>`).join('')
    : '<div class="empty"><div class="empty-icon">🧾</div>Sin gastos recientes</div>';
}

// ─── NUEVO GASTO ─────────────────────────────────────────────────────────────
function initForm() {
  const now = new Date();
  document.getElementById('f-fecha').value = now.toISOString().split('T')[0];
  
  document.getElementById('f-cat').innerHTML = categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
  document.getElementById('f-persona').innerHTML = usuarios.map(u => `<option value="${u.name}">${u.name}</option>`).join('') + '<option value="Ambos">Ambos</option>';
  
  document.getElementById('f-moneda').value = prefMoneda;

  const currentProfile = usuarios.find(u => u.id === currentUser.id);
  if (currentProfile) {
    document.getElementById('f-persona').value = currentProfile.name;
  }
}

const BTN_LABEL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg> Guardar gasto';
function resetSaveBtn() {
  const btn = document.getElementById('save-btn');
  btn.innerHTML = BTN_LABEL;
  btn.classList.remove('btn-loading');
}

async function saveGasto() {
  // Validar TODO antes de tocar Supabase o bloquear el botón
  const fecha = document.getElementById('f-fecha').value;
  const montoRaw = document.getElementById('f-monto').value;
  const monto = parseFloat(montoRaw);
  const moneda = document.getElementById('f-moneda').value;
  const cat = document.getElementById('f-cat').value;
  const persona = document.getElementById('f-persona').value;
  const desc = document.getElementById('f-desc').value.trim();
  const notas = document.getElementById('f-notas').value.trim();
  if (!fecha) { showToast('Ingresá la fecha', 'err'); return; }
  if (!montoRaw || montoRaw.trim() === '' || isNaN(monto) || monto <= 0) {
    showToast('Ingresá un monto válido', 'err'); return;
  }
  if (!desc) { showToast('Ingresá una descripción', 'err'); return; }

  // Solo bloquear el botón DESPUÉS de validar
  const btn = document.getElementById('save-btn');
  btn.innerHTML = '<span class="spinner"></span> Guardando...';
  btn.classList.add('btn-loading');

  // Safety timer: 15 segundos máximo
  const safetyTimer = setTimeout(() => {
    resetSaveBtn();
    showToast('Tiempo de espera agotado. Intentá de nuevo.', 'err');
  }, 15000);

  try {
    // Optimistic UI: agregar localmente de inmediato
    const id_temp = 'tmp_' + Date.now();
    const gasto = { id: id_temp, fecha, monto, moneda, categoria: cat, persona, descripcion: desc, notas, user_id: currentUser.id, user_email: currentUser.email };
    allGastos.unshift(gasto);
    renderDash();

    // Persistir en Supabase (sin el id temporal)
    const { id: _drop, ...gastoSB } = gasto;
    const { error } = await saveGastoToDB(gastoSB);

    if (error) {
      // Revertir optimistic update si falló
      allGastos = allGastos.filter(g => g.id !== id_temp);
      renderDash();
      showToast('Error al guardar: ' + error.message, 'err');
    } else {
      showToast('Gasto guardado ✓');
      clearForm();
    }
  } catch (e) {
    showToast('Error inesperado: ' + e.message, 'err');
  } finally {
    clearTimeout(safetyTimer);
    resetSaveBtn();
  }
}

function clearForm() {
  document.getElementById('f-monto').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-notas').value = '';
}

// ─── HISTORIAL ───────────────────────────────────────────────────────────────
// ── MULTISELECT STATE ──
let msCatSel = new Set();
let msPerSel = new Set();
let msInitDone = false;

function toggleMs(id, event) {
  if (event) event.stopPropagation();
  const el = document.getElementById(id);
  const isOpen = el.style.display !== 'none';
  
  // Cerramos otros dropdowns
  document.querySelectorAll('.ms-dropdown').forEach(d => {
    if (d.id !== id) d.style.display = 'none';
  });
  
  el.style.display = isOpen ? 'none' : 'block';
}

// Un solo listener global optimizado
document.addEventListener('click', e => {
  if (!e.target.closest('.ms-wrap')) {
    const drops = document.querySelectorAll('.ms-dropdown');
    let anyOpen = false;
    drops.forEach(d => { if(d.style.display !== 'none') anyOpen = true; });
    
    if (anyOpen) {
      // Usamos requestAnimationFrame para no interferir con el foco inmediato de otros campos
      requestAnimationFrame(() => {
        drops.forEach(d => d.style.display = 'none');
      });
    }
  }
});

function buildMsCat() {
  const items = categorias.map(c => c.nombre);
  const el = document.getElementById('ms-cat');
  el.innerHTML =
    `<div class="ms-item" onclick="msCatToggle('__all__')">
      <div class="ms-check ${msCatSel.size === 0 ? 'on' : ''}"></div>
      <span style="font-weight:600">Todas</span>
    </div>` +
    items.map(item =>
      `<div class="ms-item" onclick="msCatToggle('${item}');event.stopPropagation()">
        <div class="ms-check ${msCatSel.has(item) ? 'on' : ''}"></div>
        <span>${item}</span>
      </div>`
    ).join('');
  const lbl = document.getElementById('ms-cat-label');
  if (msCatSel.size === 0) lbl.textContent = 'Todas';
  else if (msCatSel.size === 1) lbl.textContent = [...msCatSel][0];
  else lbl.textContent = `${msCatSel.size} categorías`;
}

function msCatToggle(val, event) {
  if (event) event.stopPropagation(); // ESTO evita que se cierre al marcar
  if (val === '__all__') msCatSel.clear();
  else {
    if (msCatSel.has(val)) msCatSel.delete(val);
    else msCatSel.add(val);
  }
  buildMsCat();
}

function buildMsPer() {
  const items = [...usuarios.map(u => u.name), 'Ambos'];
  const el = document.getElementById('ms-per');
  el.innerHTML =
    `<div class="ms-item" onclick="msPerToggle('__all__')">
      <div class="ms-check ${msPerSel.size === 0 ? 'on' : ''}"></div>
      <span style="font-weight:600">Todos</span>
    </div>` +
    items.map(item =>
      `<div class="ms-item" onclick="msPerToggle('${item}');event.stopPropagation()">
        <div class="ms-check ${msPerSel.has(item) ? 'on' : ''}"></div>
        <span>${item}</span>
      </div>`
    ).join('');
  const lbl = document.getElementById('ms-per-label');
  if (msPerSel.size === 0) lbl.textContent = 'Todos';
  else if (msPerSel.size === 1) lbl.textContent = [...msPerSel][0];
  else lbl.textContent = `${msPerSel.size} personas`;
}

function msPerToggle(val, event) {
  if (event) event.stopPropagation(); // ESTO evita que se cierre al marcar
  if (val === '__all__') msPerSel.clear();
  else {
    if (msPerSel.has(val)) msPerSel.delete(val);
    else msPerSel.add(val);
  }
  buildMsPer();
}

// El listener anterior fue unificado y movido arriba

function initHist() {
  const now = new Date();
  document.getElementById('h-mes').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!msInitDone) { msCatSel.clear(); msPerSel.clear(); msInitDone = true; }
  buildMsCat();
  buildMsPer();
}


function loadHistorial() {
  document.querySelectorAll('.ms-dropdown').forEach(d => d.style.display = 'none');
  const mes = document.getElementById('h-mes').value;
  let f = allGastos;
  if (mes) f = f.filter(g => g.fecha && g.fecha.startsWith(mes));
  if (msCatSel.size > 0) f = f.filter(g => msCatSel.has(g.categoria));
  if (msPerSel.size > 0) f = f.filter(g => msPerSel.has(g.persona));
  f = f.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  
  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  const total = f.reduce((s, g) => s + getMontoARS(g), 0);

  document.getElementById('hist-list').innerHTML = f.length
    ? `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">${f.length} gastos · <strong>${fmt(total)}</strong></div>` +
    f.map(g => `<div class="tx-item">
    <div class="tx-dot" style="background:${catColor(g.categoria)}33">${catEmoji(g.categoria)}</div>
    <div class="tx-info">
      <div class="tx-desc">${g.descripcion || g.categoria}</div>
      <div class="tx-meta">${g.categoria} · ${personaBadge(g.persona)}${g.notas ? `<br><span style="font-size:10px">${g.notas}</span>` : ''}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount">${fmtGasto(g.monto, g.moneda)}</div>
      <div class="tx-date">${fdate(g.fecha)}</div>
      <button class="btn btn-danger btn-sm" onclick="deleteGasto('${g.id}')" style="margin-top:4px;padding:3px 8px;font-size:12px">🗑</button>
    </div>

  </div>`).join('')
    : '<div class="empty"><div class="empty-icon">🔍</div>Sin resultados</div>';
}

async function deleteGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  const { error } = await deleteGastoDB(id);
  if (error) { showToast('Error al eliminar', 'err'); return; }
  allGastos = allGastos.filter(g => g.id !== id);
  loadHistorial(); renderDash();
  showToast('Gasto eliminado');
}

// ─── REPORTES ────────────────────────────────────────────────────────────────
function togglePeriodo() {
  const tipo = document.getElementById('r-tipo').value;
  document.getElementById('rg-mes').style.display = tipo === 'mes' ? '' : 'none';
  document.getElementById('rg-per').style.display = tipo === 'per' ? '' : 'none';
}

function getReporteData() {
  const tipo = document.getElementById('r-tipo').value;
  if (tipo === 'mes') {
    const mes = document.getElementById('r-mes').value;
    if (!mes) { showToast('Seleccioná un mes', 'err'); return null; }
    const [y, m] = mes.split('-');
    return { list: allGastos.filter(g => g.fecha && g.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha)), label: `${MESES[parseInt(m) - 1]} ${y}` };
  } else {
    const desde = document.getElementById('r-desde').value, hasta = document.getElementById('r-hasta').value;
    if (!desde || !hasta) { showToast('Seleccioná fechas', 'err'); return null; }
    return { list: allGastos.filter(g => g.fecha >= desde && g.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha)), label: `${fdate(desde)} al ${fdate(hasta)}` };
  }
}

function previewReporte() {
  const r = getReporteData(); if (!r) return;
  const { list, label } = r;
  const div = document.getElementById('rep-preview');
  if (!list.length) { div.innerHTML = '<div class="empty">Sin datos para el período</div>'; return; }
  
  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  const total = list.reduce((s, g) => s + getMontoARS(g), 0);
  const catMap = {};
  list.forEach(g => { 
    const montoARS = getMontoARS(g);
    catMap[g.categoria] = (catMap[g.categoria] || 0) + montoARS; 
  });
  div.innerHTML = `<div class="rep-total"><span>${label} · ${list.length} gastos</span><span>${fmt(total)}</span></div>` +
    Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
  <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${catColor(c)};display:inline-block"></span>${c}</span>
    <span style="font-weight:600">${fmt(v)}</span>
  </div>`).join('') +
    `<div class="rep-scroll" style="margin-top:14px"><table>
  <tr><th>Fecha</th><th>Descripción</th><th>Cat.</th><th>Quién</th><th style="text-align:right">Monto</th></tr>
  ${list.map(g => `<tr><td style="white-space:nowrap">${fdate(g.fecha)}</td><td>${g.descripcion || '-'}</td><td>${g.categoria}</td><td>${g.persona}</td><td style="text-align:right;font-weight:600">${fmtGasto(g.monto, g.moneda)}</td></tr>`).join('')}
  <tr><td colspan="4">TOTAL (${prefMoneda})</td><td style="text-align:right">${fmt(total)}</td></tr>
</table></div>`;
}

function exportarExcel() {
  const r = getReporteData(); if (!r) return;
  const { list, label } = r;
  if (!list.length) { showToast('Sin datos', 'err'); return; }
  const wb = XLSX.utils.book_new();
  const data = [['Fecha', 'Descripción', 'Categoría', 'Persona', `Monto (${prefMoneda})`, 'Notas', 'Moneda Original', 'Monto Original']];
  
  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  list.forEach(g => {
    const montoConsolidado = prefMoneda === 'USD' ? (getMontoARS(g) / dolarHoy) : getMontoARS(g);
    data.push([
      fdate(g.fecha), 
      g.descripcion || '', 
      g.categoria, 
      g.persona, 
      montoConsolidado, 
      g.notas || '', 
      g.moneda || 'ARS', 
      parseFloat(g.monto)
    ]);
  });

  const totalARS = list.reduce((s, g) => s + getMontoARS(g), 0);
  const totalConsolidado = prefMoneda === 'USD' ? (totalARS / dolarHoy) : totalARS;
  
  data.push(['', '', '', 'TOTAL CONSOLIDADO', totalConsolidado, '', prefMoneda, '']);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  XLSX.writeFile(wb, `Gastos_${label.replace(/\//g, '-').replace(/ /g, '_')}.xlsx`);
  showToast('Excel exportado ✓');
}

function exportarPDF() {
  const r = getReporteData(); if (!r) return;
  const { list, label } = r;
  if (!list.length) { showToast('Sin datos', 'err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Gastos Familiares', 14, 18);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${label} (Consolidado en ${prefMoneda})`, 14, 27);

  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  const totalARS = list.reduce((s, g) => s + getMontoARS(g), 0);
  const catMap = {};
  list.forEach(g => { 
    const montoARS = getMontoARS(g);
    catMap[g.categoria] = (catMap[g.categoria] || 0) + montoARS; 
  });

  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Resumen por categoría', 14, 38);
  let y = 45;
  Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${c}: ${fmt(v)}`, 18, y); y += 6;
  });

  y += 4; doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL GENERAL: ${fmt(totalARS)}`, 14, y); y += 10;

  doc.autoTable({
    head: [['Fecha', 'Descripción', 'Categoría', 'Persona', `Monto (${prefMoneda})`]],
    body: list.map(g => {
      const mConsolidado = prefMoneda === 'USD' ? (getMontoARS(g) / dolarHoy) : getMontoARS(g);
      const symbol = prefMoneda === 'USD' ? 'U$D ' : '$';
      return [
        fdate(g.fecha), 
        g.descripcion || '', 
        g.categoria, 
        g.persona, 
        symbol + mConsolidado.toLocaleString('es-AR', { minimumFractionDigits: 2 })
      ];
    }),
    startY: y, styles: { fontSize: 9 }, headStyles: { fillColor: [26, 26, 24] },
    foot: [['', '', '', 'TOTAL', fmt(totalARS)]],
    footStyles: { fontStyle: 'bold' }
  });
  doc.save(`Gastos_${label.replace(/\//g, '-').replace(/ /g, '_')}.pdf`);
  showToast('PDF exportado ✓');
}

function exportarBackup() {
  const wb = XLSX.utils.book_new();
  // Hoja Gastos - con nombre en lugar de email
  const data = [['Fecha', 'Descripción', 'Categoría', 'Quién pagó', 'Cargado por', 'Monto ($)', 'Notas']];
  allGastos.forEach(g => {
    const cargadoPor = usuarios.find(u => u.id === g.user_id)?.name || (g.user_email ? g.user_email.split('@')[0] : '');
    data.push([fdate(g.fecha), g.descripcion || '', g.categoria, g.persona, cargadoPor, parseFloat(g.monto), g.notas || '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  // Hoja Categorias
  const catData = [['Nombre', 'Color']];
  categorias.forEach(c => catData.push([c.nombre, c.color]));
  const wsCat = XLSX.utils.aoa_to_sheet(catData);
  wsCat['!cols'] = [{ wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Categorias');
  XLSX.writeFile(wb, 'GastosFamiliares_Backup.xlsx');
  showToast('Backup descargado ✓');
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────
async function addCategoria() {
  const nombre = document.getElementById('new-cat').value.trim();
  const presupuesto = parseFloat(document.getElementById('new-cat-ppto').value || 0);
  const color = document.getElementById('new-cat-color').value;
  if (!nombre) { showToast('Escribí el nombre', 'err'); return; }
  if (categorias.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())) { showToast('Ya existe esa categoría', 'err'); return; }
  const { data, error } = await sb.from('categorias').insert([{ nombre, color, presupuesto }]).select();
  if (error) { showToast('Error al guardar: ' + error.message, 'err'); return; }
  if (data) categorias.push(data[0]);
  document.getElementById('new-cat').value = '';
  document.getElementById('new-cat-ppto').value = '';
  renderConfig(); initForm();
  showToast('Categoría agregada ✓');
}

function renderConfig() {
  document.getElementById('cfg-cats').innerHTML = categorias.map((c, i) =>
    `<div class="cat-cfg-item">
  <span style="width:16px;height:16px;border-radius:50%;background:${c.color};display:inline-block;flex-shrink:0"></span>
  <div style="flex:1">
    <div style="font-size:14px;font-weight:600">${c.nombre}</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3)">
      <span>Presupuesto: $</span>
      <input type="number" value="${c.presupuesto || 0}" 
        onchange="updateCategoriaPpto('${c.id}', this.value)" 
        style="width:80px;padding:2px 4px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text);font-family:inherit">
    </div>
  </div>
  <button class="btn btn-danger btn-sm" onclick="deleteCategoria('${c.id}')">🗑</button>
</div>`
  ).join('');

  const tarjetas = ['Visa', 'Mastercard', 'Amex'];
  document.getElementById('cfg-tarjetas').innerHTML = tarjetas.map(t => {
    const cfg = tarjetasCfg.find(c => c.tarjeta === t) || { dia_cierre: 15 };
    return `<div class="cat-cfg-item">
      <span class="tarjeta-badge" style="background:${TARJETA_COLORS[t]};color:white;width:80px;justify-content:center">${t}</span>
      <div style="flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-end">
        <span style="font-size:12px">Cierra día:</span>
        <input type="number" value="${cfg.dia_cierre}" min="1" max="31" 
          onchange="saveTarjetaConfig('${t}', this.value)" 
          style="width:50px;padding:4px;font-size:12px;text-align:center">
      </div>
    </div>`;
  }).join('');
}

async function updatePrefMoneda(val) {
  prefMoneda = val;
  localStorage.setItem('prefMoneda', val);
  initForm(); // Actualizar moneda por defecto en gastos
  renderDash();
  renderDeudas();
  renderRecurrentes();
  renderConfig();
  showToast(`Moneda cambiada a ${val} ✓`);
}

async function deleteCategoria(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  const { error } = await deleteCategoriaDB(id);
  if (error) { showToast('Error al eliminar', 'err'); return; }
  categorias = categorias.filter(c => c.id !== id);
  renderConfig(); initForm();
}

async function updateCategoriaPpto(id, ppto) {
  const valor = parseFloat(ppto || 0);
  const { error } = await sb.from('categorias').update({ presupuesto: valor }).eq('id', id);
  if (error) showToast('Error al actualizar presupuesto', 'err');
  else {
    const cat = categorias.find(c => c.id === id);
    if (cat) cat.presupuesto = valor;
    renderDash();
    showToast('Presupuesto actualizado ✓');
  }
}

// ─── DEUDAS ──────────────────────────────────────────────────────────────────
let allDeudas = [];
const TARJETA_COLORS = { Visa:'#1a1f71', Mastercard:'#eb001b', Amex:'#2e77bc' };
const TARJETA_EMOJIS = { Visa:'💳', Mastercard:'💳', Amex:'💎' };
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

async function loadDeudas() {
  const { data, error } = await sb.from('deudas').select('*').order('created_at', { ascending: false });
  if (data) allDeudas = data;
}

function showFormDeuda() {
  const now = new Date();
  document.getElementById('d-inicio').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  
  document.getElementById('d-moneda').value = prefMoneda;

  // Ordenar: primero el usuario logueado, luego los demás
  const yo = usuarios.find(u => u.id === currentUser.id);
  const resto = usuarios.filter(u => u.id !== currentUser.id);
  const ordenados = yo ? [yo, ...resto] : usuarios;
  document.getElementById('d-persona').innerHTML = ordenados.map((u, i) =>
    `<option value="${u.name}">${u.name}${i === 0 ? ' (yo)' : ''}</option>`
  ).join('');
  document.getElementById('deu-form').style.display = 'block';
  document.getElementById('deu-form').scrollIntoView({ behavior:'smooth' });
}

function hideFormDeuda() {
  document.getElementById('deu-form').style.display = 'none';
  ['d-desc','d-monto','d-cuotas','d-notas'].forEach(id => document.getElementById(id).value = '');
}

async function saveDeuda() {
  const desc = document.getElementById('d-desc').value.trim();
  const montoRaw = document.getElementById('d-monto').value;
  const monto = parseFloat(montoRaw);
  const moneda = document.getElementById('d-moneda').value;
  const cuotas = parseInt(document.getElementById('d-cuotas').value);
  const inicio = document.getElementById('d-inicio').value;
  const tarjeta = document.getElementById('d-tarjeta').value;
  const persona = document.getElementById('d-persona').value;
  const notas = document.getElementById('d-notas').value.trim();
  if (!desc) { showToast('Ingresá una descripción', 'err'); return; }
  if (!montoRaw || isNaN(monto) || monto <= 0) { showToast('Ingresá un monto válido', 'err'); return; }
  if (!cuotas || cuotas < 1) { showToast('Ingresá la cantidad de cuotas', 'err'); return; }
  if (!inicio) { showToast('Seleccioná el mes de inicio', 'err'); return; }
  const btn = document.getElementById('d-save-btn');
  btn.innerHTML = '<span class="spinner"></span> Guardando...'; btn.classList.add('btn-loading');
  const deuda = { descripcion:desc, monto_total:monto, moneda, cuotas_total:cuotas,
    cuotas_pagas:0, mes_inicio:inicio, tarjeta, persona, notas,
    monto_cuota: Math.round(monto/cuotas*100)/100,
    user_id: currentUser.id, user_email: currentUser.email };
  const safetyTimer = setTimeout(() => {
    btn.innerHTML = 'Guardar'; btn.classList.remove('btn-loading');
    showToast('Tiempo de espera agotado. Intentá de nuevo.', 'err');
  }, 15000);
  try {
    const { error } = await sb.from('deudas').insert([deuda]);
    if (error) {
      showToast('Error: ' + error.message, 'err');
    } else {
      allDeudas.unshift({...deuda, id: Date.now()});
      hideFormDeuda();
      renderDeudas();
      renderDash();
      showToast('Deuda guardada ✓');
    }
  } catch(e) {
    showToast('Error inesperado: ' + e.message, 'err');
  } finally {
    clearTimeout(safetyTimer);
    btn.innerHTML = 'Guardar';
    btn.classList.remove('btn-loading');
  }
}

async function deleteDeuda(id) {
  if (!confirm('¿Eliminar esta deuda?')) return;
  const { error } = await sb.from('deudas').delete().eq('id', id);
  if (error) { showToast('Error al eliminar', 'err'); return; }
  allDeudas = allDeudas.filter(d => d.id !== id);
  renderDeudas();
  showToast('Deuda eliminada');
}

let deudaEnPago = null;

function cerrarModalPago() {
  document.getElementById('modal-pago').style.display = 'none';
  deudaEnPago = null;
}

async function pagarCuota(id) {
  const d = allDeudas.find(x => x.id === id);
  if (!d) return;
  
  deudaEnPago = d;
  document.getElementById('m-pago-desc').textContent = d.descripcion;
  document.getElementById('m-fecha-pago').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-pago').style.display = 'flex';
}

async function confirmarPagoCuota() {
  if (!deudaEnPago) return;
  const d = deudaEnPago;
  const fechaPago = document.getElementById('m-fecha-pago').value;
  if (!fechaPago) { showToast('Seleccioná la fecha', 'err'); return; }

  cerrarModalPago();

  const nuevasPagas = (d.cuotas_pagas || 0) + 1;
  
  showToast('Procesando pago...', 'info');
  
  // 1. Actualizar la deuda
  const { error: errorDeuda } = await sb.from('deudas').update({ cuotas_pagas: nuevasPagas }).eq('id', d.id);
  if (errorDeuda) { showToast('Error al actualizar deuda', 'err'); return; }
  
  // 2. Crear un gasto automático para que se vea en el dashboard
  const gasto = {
    fecha: fechaPago,
    monto: d.monto_cuota,
    moneda: d.moneda,
    categoria: 'Deudas',
    persona: d.persona,
    descripcion: `Pago Cuota ${nuevasPagas}/${d.cuotas_total}: ${d.descripcion}`,
    notas: `Pago de cuota de ${d.tarjeta}. Deuda ID: ${d.id}`,
    user_id: currentUser.id,
    user_email: currentUser.email
  };
  
  const { error: errorGasto } = await sb.from('gastos').insert([gasto]);
  
  if (errorGasto) {
    showToast('Cuota marcada, pero no se pudo crear el gasto', 'warn');
  } else {
    showToast('Cuota pagada y registrada en gastos ✓');
  }

  d.cuotas_pagas = nuevasPagas;
  await loadGastos(); // Recargar para que aparezca en el dash
  renderDeudas();
  renderDash();
}

function getCuotasMes(yearMonth) {
  // yearMonth = 'YYYY-MM'
  return allDeudas.reduce((total, d) => {
    if (!d.mes_inicio) return total;
    const [y, m] = d.mes_inicio.split('-').map(Number);
    const inicio = new Date(y, m-1, 1);
    const [ty, tm] = yearMonth.split('-').map(Number);
    const target = new Date(ty, tm-1, 1);
    
    // Diferencia en meses
    const diffMonths = (target.getFullYear() - inicio.getFullYear()) * 12 + (target.getMonth() - inicio.getMonth());
    
    const cuotasTotal = d.cuotas_total || 1;
    
    if (diffMonths >= 0 && diffMonths < cuotasTotal) {
      // Solo sumamos si esta cuota aún no fue pagada
      // diffMonths es el índice de la cuota (0 para el primer mes)
      // Si cuotas_pagas es 1, significa que la cuota 0 ya se pagó.
      if (diffMonths >= (d.cuotas_pagas || 0)) {
        const montoARS = d.moneda === 'USD' ? d.monto_cuota * dolarHoy : d.monto_cuota;
        return total + parseFloat(montoARS || 0);
      }
    }
    return total;
  }, 0);
}



function getProxVencimiento(tarjeta) {
  const cfg = tarjetasCfg.find(t => t.tarjeta === tarjeta);
  if (!cfg) return { label: 'Sin config', color: 'var(--text3)' };
  
  const hoy = new Date();
  const dia = hoy.getDate();
  const mes = hoy.getMonth();
  const anio = hoy.getFullYear();
  
  // Si hoy es antes o el mismo día del cierre, el resumen cierra este mes
  // Si es después, ya estamos consumiendo para el próximo mes
  let fechaCierre;
  if (dia <= cfg.dia_cierre) {
    fechaCierre = new Date(anio, mes, cfg.dia_cierre);
  } else {
    fechaCierre = new Date(anio, mes + 1, cfg.dia_cierre);
  }
  
  const diffMs = fechaCierre - hoy;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { label: 'CIERRA HOY', color: 'var(--red)' };
  if (diffDays <= 3) return { label: `Cierra en ${diffDays}d`, color: 'var(--red)' };
  return { label: `Cierra en ${diffDays}d`, color: 'var(--green)' };
}

function renderDeudas() {
  const activas = allDeudas.filter(d => (d.cuotas_pagas||0) < (d.cuotas_total||1));
  const terminadas = allDeudas.filter(d => (d.cuotas_pagas||0) >= (d.cuotas_total||1));

  // ── Resumen por tarjeta ──
  const tarjetas = ['Visa','Mastercard','Amex'];
  const resDiv = document.getElementById('deu-resumen');
  const porTarjeta = {};
  tarjetas.forEach(t => { porTarjeta[t] = { ars:0, usd:0, count:0 }; });
  activas.forEach(d => {
    if (porTarjeta[d.tarjeta]) {
      porTarjeta[d.tarjeta].count++;
      if (d.moneda === 'USD') porTarjeta[d.tarjeta].usd += parseFloat(d.monto_cuota||0);
      else porTarjeta[d.tarjeta].ars += parseFloat(d.monto_cuota||0);
    }
  });
  const tarjetasConDeuda = tarjetas.filter(t => porTarjeta[t].count > 0);
  if (tarjetasConDeuda.length === 0) {
    resDiv.innerHTML = '<div class="empty" style="padding:1rem 0"><div class="empty-icon">💳</div>Sin deudas activas</div>';
  } else {
    resDiv.innerHTML = '<div class="card" style="margin-bottom:10px"><div class="card-title">Cuota mensual por tarjeta</div>' +
      tarjetasConDeuda.map(t => {
        const info = porTarjeta[t];
        const color = TARJETA_COLORS[t];
        let montos = [];
        if (info.ars > 0) montos.push('<strong>$'+info.ars.toLocaleString('es-AR',{minimumFractionDigits:2})+'</strong>');
        if (info.usd > 0) montos.push('<strong>U$D '+info.usd.toLocaleString('es-AR',{minimumFractionDigits:2})+'</strong>');
        return `<div class="resumen-tarjeta">
          <span style="display:flex;align-items:center;gap:8px">
            <span class="tarjeta-badge" style="background:${color};color:white">${t}</span>
            <span style="font-size:12px;color:var(--text2)">${info.count} compra${info.count>1?'s':''}</span>
          </span>
          <span style="font-size:14px">${montos.join(' + ')}/mes</span>
        </div>`;
      }).join('') + '</div>';
  }

  // ── Gráfico próximos 12 meses ──
  const grafCard = document.getElementById('deu-grafico-card');
  if (activas.length > 0) {
    grafCard.style.display = 'block';
    const now = new Date();
    const mesesData = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const total = getCuotasMes(ym);
      mesesData.push({ label: MESES_SHORT[d.getMonth()], ym, total });
    }
    const maxVal = Math.max(...mesesData.map(m => m.total), 1);
    document.getElementById('deu-grafico').innerHTML =
      '<div class="bar-chart">' +
      mesesData.map(m => `
        <div class="bar-col">
          <div class="bar-col-val">${m.total > 0 ? '$'+Math.round(m.total/1000)+'k' : ''}</div>
          <div class="bar-col-bar" style="height:${Math.max(m.total/maxVal*100,2)}px;background:${m.total>0?'var(--blue)':'var(--border)'}"></div>
          <div class="bar-col-lbl">${m.label}</div>
        </div>`).join('') +
      '</div>';
  } else {
    grafCard.style.display = 'none';
  }

  // ── Lista de deudas ──
  const lista = document.getElementById('deu-lista');
  if (allDeudas.length === 0) {
    lista.innerHTML = '<div class="empty"><div class="empty-icon">🎉</div>Sin compras en cuotas</div>';
    return;
  }
  lista.innerHTML = [...activas, ...terminadas].map(d => {
    const pagas = d.cuotas_pagas || 0;
    const total = d.cuotas_total || 1;
    const pct = Math.round(pagas/total*100);
    const terminada = pagas >= total;
    const color = TARJETA_COLORS[d.tarjeta] || '#888';
    const [y,m] = (d.mes_inicio||'').split('-');
    const inicioLabel = m && y ? `${MESES_SHORT[parseInt(m)-1]} ${y}` : '';
    const venc = getProxVencimiento(d.tarjeta);
    return `<div class="deu-item" style="${terminada?'opacity:0.5':''}">
      <div class="deu-ico" style="background:${color}22">💳</div>
      <div class="deu-info">
        <div class="deu-desc">${d.descripcion||''}</div>
        <div class="deu-meta">
          <span class="tarjeta-badge" style="background:${color};color:white">${d.tarjeta}</span>
          · <span style="color:${venc.color};font-weight:700;font-size:10px">${venc.label}</span>
          <br>${d.persona} · ${inicioLabel}
          ${d.notas ? `<br><span style="font-size:10px">${d.notas}</span>` : ''}
        </div>
        <div class="deu-progress"><div class="deu-progress-fill" style="width:${pct}%;background:${color}"></div></div>
        <div style="font-size:10px;color:var(--text2);margin-top:3px">${pagas}/${total} cuotas pagadas</div>
      </div>
      <div class="deu-right">
        <div class="deu-monto">${fmtDeuda(d.monto_cuota, d.moneda)}</div>
        <div class="deu-cuota" style="font-size:10px">Total: ${fmtDeuda(d.monto_total, d.moneda).split('<br>')[0]}</div>
        ${!terminada ? `<button class="btn btn-sm" onclick="pagarCuota('${d.id}')" style="margin-top:6px;padding:4px 8px;font-size:11px">✓ Pagar cuota</button>` : '<div style="font-size:11px;color:var(--green);margin-top:4px;font-weight:600">✓ Pagado</div>'}
        <button class="btn btn-danger btn-sm" onclick="deleteDeuda('${d.id}')" style="margin-top:4px;padding:3px 7px;font-size:11px">🗑</button>
      </div>
    </div>`;

  }).join('');
}

// ─── EVOLUCIÓN (CHART) ───────────────────────────────────────────────────────
let evoChart = null;
let metEvoChart = null;
let msMetCatSel = new Set();

function renderEvolutionChart() {
  const ctx = document.getElementById('evolutionChart');
  if (!ctx) return;
  
  const data = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = allGastos
      .filter(g => g.fecha && g.fecha.startsWith(ym))
      .reduce((s, g) => {
        const m = parseFloat(g.monto || 0);
        return s + (g.moneda === 'USD' ? m * dolarHoy : m);
      }, 0);
    data.push({ label: `${MESES_SHORT[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`, value: total });
  }

  if (evoChart) evoChart.destroy();
  evoChart = drawLineChart(ctx, evoChart, [{ label: 'Gastos', data: data, color: '#1D9E75' }]);
}

function renderMetrics() {
  const ctx = document.getElementById('metEvolutionChart');
  if (!ctx) return;
  
  buildMsMetCat();
  
  const catsToShow = msMetCatSel.size > 0 ? Array.from(msMetCatSel) : categorias.map(c => c.nombre);
  const datasets = getEvolutionDataByCategory(catsToShow, 3);
  
  if (metEvoChart) metEvoChart.destroy();
  
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#9b9896' : '#6b6966';

  metEvoChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datasets[0].labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.values,
        borderColor: ds.color,
        backgroundColor: ds.color + '11',
        fill: false,
        tension: 0,
        borderWidth: 3,
        pointRadius: 4,
        borderDash: (ctx) => ctx.index === (datasets[0].labels.length - 1) ? [5, 5] : [], // Punteado para el ultimo punto (proyeccion)
        segment: {
          borderDash: (ctx) => ctx.p0DataIndex === (datasets[0].labels.length - 2) ? [5, 5] : []
        }
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          display: true, 
          position: 'top',
          labels: { color: textColor, font: { size: 10 }, boxWidth: 10 }
        }, 
        tooltip: { 
          mode: 'index', 
          intersect: false,
          callbacks: {
            label: function(ctx) {
              const isProj = ctx.dataIndex === (ctx.dataset.data.length - 1);
              return ctx.dataset.label + ': ' + (prefMoneda === 'USD' ? 'U$D ' : '$') + ctx.parsed.y.toLocaleString('es-AR') + (isProj ? ' (Proj)' : '');
            }
          }
        } 
      },
      scales: {
        y: { 
          display: true, 
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { 
            color: textColor, 
            font: { size: 9 },
            callback: function(val) {
              if (val >= 1000000) return (val/1000000).toFixed(1) + 'M';
              if (val >= 1000) return (val/1000).toFixed(0) + 'k';
              return val;
            }
          }
        },
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
      }
    }
  });
  
  renderMetricsStats();
}

function buildMsMetCat() {
  const items = categorias.map(c => c.nombre);
  const el = document.getElementById('ms-met-cat');
  if (!el) return;
  el.innerHTML =
    `<div class="ms-item" onclick="msMetCatToggle('__all__')">
      <div class="ms-check ${msMetCatSel.size === 0 ? 'on' : ''}"></div>
      <span style="font-weight:600">Todas</span>
    </div>` +
    items.map(item =>
      `<div class="ms-item" onclick="msMetCatToggle('${item}');event.stopPropagation()">
        <div class="ms-check ${msMetCatSel.has(item) ? 'on' : ''}"></div>
        <span>${item}</span>
      </div>`
    ).join('');
  const lbl = document.getElementById('ms-met-cat-label');
  if (msMetCatSel.size === 0) lbl.textContent = 'Todas';
  else if (msMetCatSel.size === 1) lbl.textContent = Array.from(msMetCatSel)[0];
  else lbl.textContent = `${msMetCatSel.size} categorías`;
}

function msMetCatToggle(val, event) {
  if (event) event.stopPropagation();
  if (val === '__all__') msMetCatSel.clear();
  else {
    if (msMetCatSel.has(val)) msMetCatSel.delete(val);
    else msMetCatSel.add(val);
  }
  buildMsMetCat();
  renderMetrics();
}

function getEvolutionDataByCategory(cats, months) {
  const datasets = [];
  const now = new Date();
  const labels = [];
  
  // Etiquetas: meses anteriores + proyección
  for (let i = months; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  // Mes actual
  labels.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  // Mes proyección
  const projDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  labels.push(`${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`);

  cats.forEach(catName => {
    const values = [];
    const cInfo = categorias.find(c => c.nombre === catName) || { color: '#888' };
    
    // Valores reales
    for (let i = 0; i < labels.length - 1; i++) {
      const ym = labels[i];
      const total = allGastos
        .filter(g => g.categoria === catName && g.fecha && g.fecha.startsWith(ym))
        .reduce((s, g) => {
          const m = parseFloat(g.monto || 0);
          const mARS = g.moneda === 'USD' ? m * dolarHoy : m;
          return s + (prefMoneda === 'USD' ? mARS / dolarHoy : mARS);
        }, 0);
      values.push(total);
    }
    
    // Proyección: promedio de los últimos X meses (incluyendo el actual que puede estar incompleto, o solo los anteriores?)
    // Vamos a usar el promedio de los meses reales mostrados
    const avg = values.reduce((s, v) => s + v, 0) / (values.length);
    values.push(avg);
    
    datasets.push({
      label: catName,
      labels: labels,
      values: values,
      color: cInfo.color
    });
  });
  
  return datasets;
}

function drawLineChart(ctx, chartInstance, datasets) {
  if (chartInstance) chartInstance.destroy();
  
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#9b9896' : '#6b6966';

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: datasets[0].data.map(m => m.label),
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data.map(m => m.value),
        borderColor: ds.color,
        backgroundColor: ds.color + '11',
        fill: true,
        tension: 0,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: ds.color,
        pointHoverRadius: 6
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: datasets.length > 1, labels: { color: textColor } }, 
        tooltip: { 
          mode: 'index', 
          intersect: false,
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ': ' + (prefMoneda === 'USD' ? 'U$D ' : '$') + ctx.parsed.y.toLocaleString('es-AR');
            }
          }
        } 
      },
      scales: {
        y: { 
          display: true, 
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { 
            color: textColor, 
            font: { size: 9 },
            callback: function(val) {
              if (val >= 1000000) return (val/1000000).toFixed(1) + 'M';
              if (val >= 1000) return (val/1000).toFixed(0) + 'k';
              return val;
            }
          }
        },
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
      }
    }
  });
}

function renderMetricsStats() {
  const now = new Date();
  const ymCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ymPrev = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const getMontoARS = (g) => {
    const m = parseFloat(g.monto || 0);
    return g.moneda === 'USD' ? m * dolarHoy : m;
  };

  const filterByCat = (g) => msMetCatSel.size === 0 || msMetCatSel.has(g.categoria);

  const totalCurrent = allGastos
    .filter(g => g.fecha && g.fecha.startsWith(ymCurrent) && filterByCat(g))
    .reduce((s, g) => s + getMontoARS(g), 0);
    
  const totalPrev = allGastos
    .filter(g => g.fecha && g.fecha.startsWith(ymPrev) && filterByCat(g))
    .reduce((s, g) => s + getMontoARS(g), 0);
  
  const diff = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev * 100) : 0;
  const diffText = totalPrev > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs mes ant.` : 'N/A';
  const diffColor = diff > 0 ? 'var(--red)' : 'var(--green)';

  const avg3 = allGastos.filter(g => {
    const d = new Date(g.fecha);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return d >= threeMonthsAgo && filterByCat(g);
  }).reduce((s, g) => s + getMontoARS(g), 0) / 3;

  document.getElementById('met-stats-grid').innerHTML = `
    <div class="metric">
      <div class="metric-label">Gasto Mes Actual ${msMetCatSel.size > 0 ? '(Filtrado)' : ''}</div>
      <div class="metric-value">${fmt(totalCurrent)}</div>
      <div style="font-size:10px; color:${diffColor}; font-weight:700; margin-top:4px">${diffText}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Promedio (Últ. 3 meses)</div>
      <div class="metric-value">${fmt(avg3)}</div>
    </div>
  `;

  // Top categorías (siempre basado en lo seleccionado)
  const catMap = {};
  allGastos.filter(g => {
    const d = new Date(g.fecha);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return d >= threeMonthsAgo && filterByCat(g);
  }).forEach(g => {
    catMap[g.categoria] = (catMap[g.categoria] || 0) + getMontoARS(g);
  });

  const top = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('met-top-cats').innerHTML = top.map(([cat, val]) => `
    <div class="cat-row">
      <div class="cat-row-head">
        <span class="cat-name"><span class="cat-dot" style="background:${catColor(cat)}"></span>${cat}</span>
        <span class="cat-val">${fmt(val/3)}/mes</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${(val / (top[0][1] || 1) * 100)}%;background:${catColor(cat)}"></div>
      </div>
    </div>
  `).join('') || '<div class="empty">Sin datos suficientes</div>';
}

// ─── RECURRENTES ─────────────────────────────────────────────────────────────
async function loadRecurrentes() {
  const { data, error } = await sb.from('recurrentes').select('*').order('descripcion');
  if (data) allRecurrentes = data;
}

function renderRecurrentes() {
  const el = document.getElementById('rec-lista');
  if (allRecurrentes.length === 0) {
    el.innerHTML = '<div class="rec-empty">No tenés gastos fijos configurados todavía.</div>';
    return;
  }

  // Detectar qué recurrentes ya fueron cargados este mes
  const ym = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}`;
  const gastosMes = allGastos.filter(g => g.fecha && g.fecha.startsWith(ym));

  el.innerHTML = allRecurrentes.map(r => {
    const yaCargado = gastosMes.some(g => g.descripcion === r.descripcion && g.categoria === r.categoria);
    return `
    <div class="rec-item">
      <div class="tx-dot" style="background:${catColor(r.categoria)}22">${catEmoji(r.categoria)}</div>
      <div class="rec-info">
        <div class="rec-name">${r.descripcion}</div>
        <div class="rec-meta">${r.categoria} · ${personaBadge(r.persona)} · <strong>${r.moneda === 'USD' ? 'U$D ' : '$'}${parseFloat(r.monto).toLocaleString('es-AR')}</strong></div>
      </div>
      <div class="rec-actions">
        ${yaCargado 
          ? '<span style="color:var(--green);font-size:12px;font-weight:700;margin-right:8px">Cargado ✓</span>'
          : `<button class="btn btn-primary btn-sm" onclick="cargarGastoRecurrente('${r.id}')">Cargar</button>`
        }
        <button class="btn btn-danger btn-sm" onclick="deleteRecurrente('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function showFormRec() {
  document.getElementById('rf-cat').innerHTML = categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
  document.getElementById('rf-persona').innerHTML = usuarios.map(u => `<option value="${u.name}">${u.name}</option>`).join('') + '<option value="Ambos">Ambos</option>';
  document.getElementById('rf-moneda').value = prefMoneda;
  
  // Federico por defecto
  const personaSelect = document.getElementById('rf-persona');
  const currentProfile = usuarios.find(u => u.id === currentUser.id);
  if (currentProfile) personaSelect.value = currentProfile.name;

  document.getElementById('rec-form').style.display = 'block';
  document.getElementById('rec-form').scrollIntoView({ behavior: 'smooth' });
}


function hideFormRec() {
  document.getElementById('rec-form').style.display = 'none';
  ['rf-desc', 'rf-monto'].forEach(id => document.getElementById(id).value = '');
}


async function saveRecurrente() {
  const desc = document.getElementById('rf-desc').value.trim();
  const monto = parseFloat(document.getElementById('rf-monto').value);
  const cat = document.getElementById('rf-cat').value;
  const persona = document.getElementById('rf-persona').value;
  const moneda = document.getElementById('rf-moneda').value;

  if (!desc || isNaN(monto) || monto <= 0) { showToast('Completá los datos correctamente', 'err'); return; }

  const btn = document.getElementById('rf-save-btn');
  btn.innerHTML = '<span class="spinner"></span>'; btn.classList.add('btn-loading');

  const item = { descripcion: desc, monto, categoria: cat, persona, moneda, user_id: currentUser.id, user_email: currentUser.email };
  
  const { data, error } = await sb.from('recurrentes').insert([item]).select();
  
  btn.innerHTML = 'Guardar'; btn.classList.remove('btn-loading');

  if (error) { showToast('Error: ' + error.message, 'err'); }
  else {
    if (data && data[0]) allRecurrentes.push(data[0]);
    hideFormRec();
    renderRecurrentes();
    showToast('Gasto fijo guardado ✓');
  }
}

async function deleteRecurrente(id) {
  if (!confirm('¿Eliminar este gasto fijo?')) return;
  const { error } = await sb.from('recurrentes').delete().eq('id', id);
  if (error) { showToast('Error al eliminar', 'err'); return; }
  allRecurrentes = allRecurrentes.filter(r => r.id !== id);
  renderRecurrentes();
}

async function cargarGastoRecurrente(id) {
  const r = allRecurrentes.find(x => x.id === id);
  if (!r) return;

  const hoy = new Date();
  const fecha = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  
  const gasto = { 
    fecha, 
    monto: r.monto, 
    categoria: r.categoria, 
    persona: r.persona, 
    descripcion: r.descripcion, 
    moneda: r.moneda || 'ARS',
    notas: 'Carga automática (Fijo)',
    user_id: currentUser.id, 
    user_email: currentUser.email 
  };

  showToast('Cargando...', 'info');
  const { error } = await sb.from('gastos').insert([gasto]);

  if (error) { showToast('Error: ' + error.message, 'err'); }
  else {
    await loadGastos();
    renderRecurrentes();
    showToast('Gasto cargado al mes actual ✓');
  }
}

async function cargarTodosRecurrentes() {
  const ym = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}`;
  const gastosMes = allGastos.filter(g => g.fecha && g.fecha.startsWith(ym));
  const pendientes = allRecurrentes.filter(r => !gastosMes.some(g => g.descripcion === r.descripcion && g.categoria === r.categoria));

  if (pendientes.length === 0) { showToast('No hay gastos fijos pendientes este mes', 'info'); return; }

  const btn = document.getElementById('btn-cargar-todo');
  btn.innerHTML = '<span class="spinner"></span> Cargando...'; btn.classList.add('btn-loading');

  const hoy = new Date();
  const fecha = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const nuevos = pendientes.map(r => ({
    fecha, monto: r.monto, categoria: r.categoria, persona: r.persona, 
    descripcion: r.descripcion, moneda: r.moneda || 'ARS',
    notas: 'Carga automática masiva', user_id: currentUser.id, user_email: currentUser.email 
  }));

  const { error } = await sb.from('gastos').insert(nuevos);
  btn.innerHTML = 'Cargar todo'; btn.classList.remove('btn-loading');

  if (error) { showToast('Error: ' + error.message, 'err'); }
  else {
    await loadGastos();
    renderRecurrentes();
    showToast(`Se cargaron ${nuevos.length} gastos fijos ✓`);
  }
}

// ─── BALANCE E INGRESOS ─────────────────────────────────────────────────────
let allIngresos = [];

async function loadIngresos() {
  const { data } = await sb.from('ingresos').select('*').order('fecha', { ascending: false });
  if (data) allIngresos = data;
}

function showFormIngreso() {
  document.getElementById('bal-form').style.display = 'block';
  document.getElementById('i-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('i-moneda').value = prefMoneda;
}

function hideFormIngreso() {
  document.getElementById('bal-form').style.display = 'none';
}

async function saveIngreso() {
  const desc = document.getElementById('i-desc').value.trim();
  const monto = parseFloat(document.getElementById('i-monto').value);
  const moneda = document.getElementById('i-moneda').value;
  const fecha = document.getElementById('i-fecha').value;
  if (!desc || isNaN(monto) || !fecha) { showToast('Completá los datos', 'err'); return; }
  const btn = document.getElementById('i-save-btn');
  btn.innerHTML = '<span class="spinner"></span>'; btn.classList.add('btn-loading');
  const { error } = await sb.from('ingresos').insert([{ descripcion: desc, monto, moneda, fecha, user_id: currentUser.id }]);
  btn.innerHTML = 'Guardar'; btn.classList.remove('btn-loading');
  if (error) showToast('Error: ' + error.message, 'err');
  else { showToast('Ingreso guardado ✓'); hideFormIngreso(); await loadIngresos(); renderBalance(); }
}

function renderBalance() {
  const ym = `${dashMonth.getFullYear()}-${String(dashMonth.getMonth() + 1).padStart(2, '0')}`;
  const ingMes = allIngresos.filter(i => i.fecha && i.fecha.startsWith(ym));
  const gastMes = allGastos.filter(g => g.fecha && g.fecha.startsWith(ym));
  const getMontoARS = (val, mon) => mon === 'USD' ? val * dolarHoy : val;
  const totalIng = ingMes.reduce((s, i) => s + getMontoARS(i.monto, i.moneda), 0);
  const totalGast = gastMes.reduce((s, g) => s + getMontoARS(g.monto, g.moneda), 0);
  const neto = totalIng - totalGast;
  document.getElementById('bal-summary').innerHTML = `
    <div class="metric">
      <div class="metric-label">Ingresos</div>
      <div class="metric-value g">${fmt(totalIng)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Gastos</div>
      <div class="metric-value r">${fmt(totalGast)}</div>
    </div>
    <div class="metric" style="grid-column:1/-1">
      <div class="metric-label">Balance Neto (Sobrante)</div>
      <div class="metric-value ${neto >= 0 ? 'g' : 'r'}">${fmt(neto)}</div>
    </div>`;
  document.getElementById('bal-ingresos-list').innerHTML = ingMes.length 
    ? ingMes.map(i => `
      <div class="tx-item">
        <div class="tx-dot" style="background:var(--green)22">💰</div>
        <div class="tx-info">
          <div class="tx-desc">${i.descripcion}</div>
          <div class="tx-meta">${fdate(i.fecha)}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount" style="color:var(--green)">${fmtGasto(i.monto, i.moneda)}</div>
          <button class="btn btn-danger btn-sm" onclick="deleteIngreso('${i.id}')" style="margin-top:4px;padding:2px 6px">🗑</button>
        </div>
      </div>`).join('')
    : '<div class="empty">Sin ingresos este mes</div>';
}

async function deleteIngreso(id) {
  if (!confirm('¿Eliminar ingreso?')) return;
  await sb.from('ingresos').delete().eq('id', id);
  await loadIngresos();
  renderBalance();
}

// ─── METAS DE AHORRO ─────────────────────────────────────────────────────────
let allMetas = [];
async function loadGoals() {
  const { data } = await sb.from('metas').select('*').order('created_at');
  if (data) allMetas = data;
}
function showFormMeta() {
  document.getElementById('goal-form').style.display = 'block';
  document.getElementById('g-moneda').value = prefMoneda;
}
function hideFormMeta() {
  document.getElementById('goal-form').style.display = 'none';
}
async function saveMeta() {
  const desc = document.getElementById('g-desc').value.trim();
  const target = parseFloat(document.getElementById('g-target').value);
  const current = parseFloat(document.getElementById('g-current').value || 0);
  const moneda = document.getElementById('g-moneda').value;
  if (!desc || isNaN(target)) { showToast('Completá los datos', 'err'); return; }
  const { error } = await sb.from('metas').insert([{ descripcion: desc, monto_objetivo: target, monto_actual: current, moneda, user_id: currentUser.id }]);
  if (error) showToast('Error: ' + error.message, 'err');
  else { showToast('Meta creada ✓'); hideFormMeta(); await loadGoals(); renderGoals(); }
}
function renderGoals() {
  const el = document.getElementById('goals-list');
  el.innerHTML = allMetas.length 
    ? allMetas.map(m => {
        const pct = Math.min(Math.round((m.monto_actual / m.monto_objetivo) * 100), 100);
        return `
        <div class="deu-card">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-weight:700">${m.descripcion}</span>
            <span style="font-size:12px;color:var(--text2)">${pct}%</span>
          </div>
          <div class="deu-progress"><div class="deu-progress-fill" style="width:${pct}%;background:var(--green)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px">
            <span>${fmtGasto(m.monto_actual, m.moneda)}</span>
            <span style="color:var(--text3)">Meta: ${fmtGasto(m.monto_objetivo, m.moneda)}</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-sm" style="flex:1" onclick="updateMetaMonto('${m.id}')">Actualizar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMeta('${m.id}')">🗑</button>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty">No tienes metas de ahorro todavía.</div>';
}
async function updateMetaMonto(id) {
  const m = allMetas.find(x => x.id === id);
  const nuevo = prompt(`¿Cuánto tienes ahorrado ahora para "${m.descripcion}"?`, m.monto_actual);
  if (nuevo === null) return;
  const val = parseFloat(nuevo);
  if (isNaN(val)) return;
  await sb.from('metas').update({ monto_actual: val }).eq('id', id);
  await loadGoals();
  renderGoals();
  showToast('Meta actualizada ✓');
}
async function deleteMeta(id) {
  if (!confirm('¿Eliminar meta?')) return;
  await sb.from('metas').delete().eq('id', id);
  await loadGoals();
  renderGoals();
}
// ─── START ───────────────────────────────────────────────────────────────────

const now = new Date();
document.getElementById('r-mes') && (document.getElementById('r-mes').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
init();
