// ERP Version: 2.0.1 (Stable - No I18N)
window.I18N = { ru: {}, en: {} }; 

// Data Persistence Keys
const DB_KEY = 'stroykomplekt_db';
const SESSION_KEY = 'stroykomplekt_session';

// Default Database Seed
const DEFAULT_DATA = {
  plans: [
    { id: 1, empId: 1, title: 'Срочный выезд на объект (Авария)', urgency: 'urgent', status: 'open' },
    { id: 2, empId: 2, title: 'Сверка счетов за месяц', urgency: 'routine', status: 'in_progress' },
    { id: 3, empId: 3, title: 'Заказ комплектующих', urgency: 'routine', status: 'open' },
    { id: 4, empId: 4, title: 'Выдать зарплату бригаде', urgency: 'urgent', status: 'done' }
  ],
  inventory: [
    { id: 101, name: 'Сетевой коммутатор Cisco', category: 'Оборудование', stock: 45, price: 50000 },
    { id: 102, name: 'Перфоратор Makita', category: 'Инструмент', stock: 12, price: 12500 },
    { id: 103, name: 'Кабель ВВГнг 3x2.5 (бухта)', category: 'Материалы', stock: 30, price: 8000 }
  ],
  requests: [
    { id: 1, empName: 'Алексей (Монтажник)', itemName: 'Буры SDS-plus 6мм', qty: 10, status: 'Ожидает' },
    { id: 2, empName: 'Марина (Бухгалтер)', itemName: 'Бумага А4 (коробка)', qty: 2, status: 'Одобрено' }
  ],
  orders: [
    { id: 'ORD-001', client: 'ООО Ромашка', stage: 'В работе', sum: 145000, date: '2026-03-10', workerCategory: 'Монтажники' },
    { id: 'ORD-002', client: 'ИП Иванов', stage: 'Сдан', sum: 32000, date: '2026-03-15', workerCategory: 'Монтажники' },
    { id: 'ORD-003', client: 'Tech Corp', stage: 'Новый', sum: 850000, date: '2026-03-18', workerCategory: 'Офис' },
    { id: 'ORD-004', client: 'СтройИнвест', stage: 'Оплачен', sum: 560000, date: '2026-02-28', workerCategory: 'Монтажники' }
  ],
  users: [
    { id: 1, name: 'Алексей (Монтажник)', login: 'alex', password: '123', role: 'employee', category: 'Монтажники' },
    { id: 2, name: 'Марина (Бухгалтер)', login: 'marina', password: '123', role: 'employee', category: 'Офис' },
    { id: 3, name: 'Игорь (Снабжение)', login: 'igor', password: '123', role: 'employee', category: 'Снабжение' },
    { id: 4, name: 'Елена (HR)', login: 'elena', password: '123', role: 'employee', category: 'Офис' },
    { id: 5, name: 'Дмитрий (Техник)', login: 'dmitry', password: '123', role: 'employee', category: 'Монтажники' },
    { id: 6, name: 'Петр (Клиент)', login: 'peter', password: '123', role: 'client' },
    { id: 7, name: 'Bro', login: 'bro@stroydom.kg', password: '142536', role: 'admin', category: 'Офис' }
  ],
  auditLog: [],
  notifications: [],
  chatMessages: [],
  expenses: [], // New Expense tracking
  settings: {
    tgToken: '8624915292:AAFO7x2HiqLSM-wb9r6RV3Cpt0kc0CdFK_M',
    tgChatId: '-5167131530',
    lastDailyReport: '',
    reportTime: '09:00',
    workerCategories: ['Монтажники', 'Бригадиры', 'Снабжение', 'Офис']
  }
};

const firebaseConfig = {
  apiKey: "AIzaSyC7HkEe1E-gI3fz2hVRleqZYLv3oA0evgc",
  authDomain: "stroydom-erp-3bcbc.firebaseapp.com",
  projectId: "stroydom-erp-3bcbc",
  storageBucket: "stroydom-erp-3bcbc.firebasestorage.app",
  messagingSenderId: "781514266369",
  appId: "1:781514266369:web:23137a1212991eee052d00",
  measurementId: "G-BT7B5DR6HL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let APP_DATA = DEFAULT_DATA;
let CLOUD_STATUS = 'loading'; 
let STATE = JSON.parse(localStorage.getItem(SESSION_KEY)) || { user: null, view: 'login', theme: 'dark' };
if (!STATE.theme) STATE.theme = 'dark'; // Migrate older sessions
const MODAL = { active: false, title: '', html: '', onSubmit: null };

// Global Saves to Firestore
async function saveDB() {
  try {
     // Safety: Always remove passwords before saving to cloud
     const dataToSave = JSON.parse(JSON.stringify(APP_DATA));
     if(dataToSave.users) {
       dataToSave.users.forEach(u => delete u.password);
     }

     await db.collection('erp_system').doc('main_data').set(dataToSave);
     CLOUD_STATUS = 'online';
  } catch(e) {
     CLOUD_STATUS = 'error';
     console.error("Cloud Save Error:", e);
     localStorage.setItem(DB_KEY, JSON.stringify(APP_DATA));
  }
}

// Real-time Data Listener
function initRealtimeSync() {
  db.collection('erp_system').doc('main_data').onSnapshot((doc) => {
    hideLoading();
    if (doc.exists) {
      APP_DATA = doc.data();
      CLOUD_STATUS = 'online';
      render();
    }
  }, (error) => {
    hideLoading();
    CLOUD_STATUS = 'error';
    render();
  });
}

// Data Loader from Firestore
async function loadDB() {
  // Safety timeout: if Firebase doesn't respond in 8s, show login screen
  const loadingTimeout = setTimeout(() => {
    hideLoading();
    CLOUD_STATUS = 'offline';
    const local = localStorage.getItem(DB_KEY);
    if(local) APP_DATA = JSON.parse(local);
    render();
  }, 8000);

  showLoading('Синхронизация с облаком...');
  try {
    const doc = await db.collection('erp_system').doc('main_data').get();
    clearTimeout(loadingTimeout); // Cloud responded — cancel timeout
    if (doc.exists) {
      APP_DATA = doc.data();
      CLOUD_STATUS = 'online';
      
      initRealtimeSync();

      auth.onAuthStateChanged(async (user) => {
        hideLoading(); // Always hide loader when auth state is known
        if (user) {
          const fbEmail = user.email.toLowerCase();
          const fbPrefix = fbEmail.split('@')[0];
          const erpUser = APP_DATA.users.find(u => {
            const uLogin = (u.login || '').toLowerCase();
            const uEmail = (u.email || '').toLowerCase();
            return uEmail === fbEmail || uLogin === fbEmail || uLogin === fbPrefix;
          });
          if (erpUser) {
            if(!erpUser.uid) { erpUser.uid = user.uid; saveDB(); }
            STATE.user = erpUser;
            if (STATE.view === 'login') STATE.view = (erpUser.role === 'client' ? 'client_orders' : 'employee_plans');
            // Clean forced re-renders
            STATE._forceFullRender = true;
          } else {
            STATE.user = null;
            STATE.view = 'login';
          }
        } else {
          STATE.user = null;
          STATE.view = 'login';
        }
        render();
      });
    } else {
      await saveDB();
      initRealtimeSync();
    }
    
    // Migration: Restore settings if they got lost in cloud
    if (!APP_DATA.settings || !APP_DATA.settings.tgToken) {
      APP_DATA.settings = DEFAULT_DATA.settings;
      saveDB();
    }
    // Migration: Ensure expenses array exists
    if (!APP_DATA.expenses) {
      APP_DATA.expenses = [];
    }

    // Check for daily reports
    runDailyReport();
  } catch(e) {
    hideLoading();
    CLOUD_STATUS = 'error';
    const local = localStorage.getItem(DB_KEY);
    if(local) APP_DATA = JSON.parse(local);
    render();
  }
}
function saveSession() {
  localStorage.setItem('ERP_SESSION', JSON.stringify(STATE));
}

function checkLowStock() {
  if(!APP_DATA.inventory) return;
  let changed = false;
  APP_DATA.inventory.forEach(item => {
    if (item.stock <= 5 && !item.lowStockNotified) {
      item.lowStockNotified = true;
      sendTelegramNotification(`⚠️ <b>Склад: Заканчивается товар!</b>\n🚨 Товар: ${item.name}\n📦 Остаток: ${item.stock} шт.\n💰 Закупочная цена: ${item.price} сом\n<i>Рекомендуется сделать дозаказ.</i>`);
      changed = true;
    } else if (item.stock > 5 && item.lowStockNotified) {
      item.lowStockNotified = false;
      changed = true;
    }
  });
  if(changed) saveDB();
}

async function runDailyReport(isManual = false, type = 'full') {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const targetTime = APP_DATA.settings.reportTime || "09:00";

  // Automatic check
  if (!isManual) {
    if (currentTime !== targetTime) return;
    if (APP_DATA.settings.lastDailyReport === today) return;
  }

  let report = "";
  let hasContent = false;

  if (type === 'full' || type === 'orders') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const urgentOrders = (APP_DATA.orders || []).filter(o => o.stage !== 'Оплачен' && (o.date <= today || o.date === tomorrowStr));
    
    if (urgentOrders.length > 0) {
      report += `📈 <b>СВОДКА ПО ЗАКАЗАМ (CRM):</b>\n`;
      urgentOrders.forEach(o => report += `• ${o.client}: <b>${o.sum.toLocaleString()} сом</b> (Срок: ${o.date})\n`);
      report += `\n`;
      hasContent = true;
    }
  }

  if (type === 'full' || type === 'tasks') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const urgentPlans = (APP_DATA.plans || []).filter(p => p.status !== 'done' && (p.date <= today || p.date === tomorrowStr));
    
    if (urgentPlans.length > 0) {
      report += `📋 <b>СВОДКА ПО ЗАДАЧАМ:</b>\n`;
      urgentPlans.forEach(p => {
        const emp = APP_DATA.users.find(u => u.id == p.empId);
        report += `• ${p.title} [${emp ? emp.name : '?'}] (Срок: ${p.date})\n`;
      });
      report += `\n`;
      hasContent = true;
    }
  }

  if (type === 'full') {
    const lowStock = (APP_DATA.inventory || []).filter(i => i.stock <= 5);
    if (lowStock.length > 0) {
      report += `📦 <b>КРИТИЧЕСКИЙ ОСТАТОК СКЛАДА:</b>\n`;
      lowStock.forEach(i => report += `• ${i.name}: <b>${i.stock} шт.</b>\n`);
      report += `\n`;
      hasContent = true;
    }
  }

  if (hasContent) {
    const header = isManual ? `📊 <b>Ручной отчет (${type==='full'?'Полный':(type==='orders'?'Заказы':'Задачи')})</b>` : `☀️ <b>Утренняя сводка ERP</b>`;
    const finalMsg = `${header}\nДата: ${today}\n\n${report}<i>Отправлено из ERP системы</i>`;
    
    await sendTelegramNotification(finalMsg);
    if (!isManual && type === 'full') {
      APP_DATA.settings.lastDailyReport = today;
      saveDB();
    }
    addLog(`Система: Отправлен отчет "${type}" в Telegram (${isManual ? 'вручную' : 'автоматически'})`);
    if(isManual) alert("Отчет успешно отправлен в Telegram!");
  } else if (isManual) {
    alert("Нет актуальных данных для отчета данного типа.");
  }
}

// Core Renderer
function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let dailyReportTimer = null;

function render() {
  hideLoading(); // Always ensure loader is hidden before rendering
  try {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    if (STATE.theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    if (!STATE.user) {
      if (dailyReportTimer) { clearInterval(dailyReportTimer); dailyReportTimer = null; }
      appContainer.innerHTML = renderLogin();
      attachLoginEvents();
    } else {
      const activeSidebar = document.getElementById('sidebar')?.classList.contains('active');
      const activeOverlay = document.getElementById('sidebarOverlay')?.classList.contains('active');
      
      appContainer.innerHTML = renderDashboard() + renderModal();
      attachDashboardEvents();
      
      if (activeSidebar) document.getElementById('sidebar')?.classList.add('active');
      if (activeOverlay) document.getElementById('sidebarOverlay')?.classList.add('active');
      
      if (!dailyReportTimer) dailyReportTimer = setInterval(() => runDailyReport(), 60000);
      checkLowStock(); // Run after render so it doesn't block UI
      if (STATE.view === 'admin_finance') {
        setTimeout(() => initFinanceCharts(), 50);
      }
    }
    if (window.lucide) lucide.createIcons();
  } catch(err) {
    console.error('RENDER CRASH:', err);
    const appContainer = document.getElementById('app');
    if(appContainer) {
      appContainer.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:#111;display:flex;align-items:center;justify-content:center;z-index:9999;">
          <div style="background:#1e1e1e;border:2px solid #e74c3c;border-radius:12px;padding:30px;max-width:500px;text-align:center;">
            <h3 style="color:#e74c3c;margin-top:0;">⚠️ Ошибка интерфейса (ERP V2.0.1)</h3>
            <p style="color:#ccc;font-size:13px;font-family:monospace;text-align:left;background:#0a0a0a;padding:10px;border-radius:6px;word-break:break-all;">${err.message}</p>
            <button onclick="location.reload()" style="background:#e74c3c;color:white;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;margin-top:10px;">🔄 Перезагрузить</button>
          </div>
        </div>
      `;
    }
  }
}

function updateView(newView) {
  STATE.view = newView;
  saveSession();
  render();
}

window.toggleTheme = function() {
  STATE.theme = (STATE.theme === 'light' ? 'dark' : 'light');
  saveSession();
  render();
};

// Activity Audit Logger
function addLog(actionDescription) {
  const userName = STATE.user ? STATE.user.name : 'Система';
  const roleName = STATE.user ? ` (${STATE.user.role})` : '';
  const uid = STATE.user && STATE.user.uid ? ` [ID:${STATE.user.uid.slice(0, 5)}]` : '';
  const time = new Date().toLocaleString('ru-RU');
  
  APP_DATA.auditLog.unshift({ time: time, user: userName + roleName + uid, action: actionDescription });
  if (APP_DATA.auditLog.length > 200) APP_DATA.auditLog.pop();
  saveDB();
}

// Loading UI helpers
function showLoading(text = 'Загрузка...') {
  let loader = document.getElementById('globalLoader');
  if(!loader) {
    loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.className = 'global-loader';
    document.body.appendChild(loader);
  }
  loader.innerHTML = `
    <div class="loader-content">
      <div class="spinner"></div>
      <div class="loader-text">${text}</div>
    </div>
  `;
  loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('globalLoader');
  if(loader) loader.style.display = 'none';
}

function sendNotification(userId, message) {
  APP_DATA.notifications.unshift({ id: Date.now() + Math.random(), userId, text: message, date: new Date().toLocaleString('ru-RU'), read: false });
  saveDB();
}

async function sendTelegramNotification(message) {
  if (!APP_DATA.settings || !APP_DATA.settings.tgToken || !APP_DATA.settings.tgChatId) return;
  const url = `https://api.telegram.org/bot${APP_DATA.settings.tgToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: APP_DATA.settings.tgChatId, text: message, parse_mode: 'HTML' })
    });
  } catch(e) { console.error('TG Error:', e); }
}

// ---------------- VIEWS ---------------- //

function renderLogin() {
  return `
    <div class="login-container animate-fade-in">
      <div class="login-box glass-panel">
        <div class="login-header">
           <div style="display:flex; justify-content:center; margin-bottom:20px;">
             <div style="background:var(--primary-glow); padding:15px; border-radius:18px; border: 1px solid var(--primary);">
               <i data-lucide="shield-check" style="width:40px; height:40px; color:var(--primary);"></i>
             </div>
           </div>
           <h1>ERP CORE</h1>
           <p style="text-transform:uppercase; letter-spacing:2px; font-size:11px; font-weight:700;">Система управления СТРОЙДОМ</p>
        </div>
        
        <div class="role-selector" id="roleSelector">
          <div class="role-btn active" data-role="employee">Сотрудник</div>
          <div class="role-btn" data-role="admin">Админ</div>
          <div class="role-btn" data-role="client">Клиент</div>
        </div>
        
        <form id="loginForm" autocomplete="off">
          <div class="input-block">
            <label><i data-lucide="user" style="width:12px;height:12px;vertical-align:middle;"></i> Логин</label>
            <input type="text" id="username" placeholder="Логин" required autocomplete="off">
          </div>
          <div class="input-block">
            <label><i data-lucide="key" style="width:12px;height:12px;vertical-align:middle;"></i> Пароль</label>
            <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn" style="width: 100%; margin-top: 10px; height:50px; font-size:16px;">
            ВХОД В СИСТЕМУ <i data-lucide="arrow-right" style="width:18px;height:18px;"></i>
          </button>
          <div id="loginError" style="color:var(--danger); font-size:13px; text-align:center; margin-top:16px; font-weight:600; display:none;"></div>
        </form>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const isEmployee = STATE.user.role === 'employee' || STATE.user.role === 'admin';
  const isAdmin = STATE.user.role === 'admin';
  
  let navLinks = '';
  if (isEmployee) {
    navLinks = `
      <div class="nav-item ${STATE.view === 'employee_plans' ? 'active' : ''}" data-view="employee_plans">
        <i data-lucide="check-square"></i> <span>Задачи</span>
      </div>
      <div class="nav-item ${STATE.view === 'employee_orders' ? 'active' : ''}" data-view="employee_orders">
        <i data-lucide="trello"></i> <span>Заказы (CRM)</span>
      </div>
      <div class="nav-item ${STATE.view === 'employee_inventory' ? 'active' : ''}" data-view="employee_inventory">
        <i data-lucide="package"></i> <span>Склад</span>
      </div>
      <div class="nav-item ${STATE.view === 'employee_chat' ? 'active' : ''}" data-view="employee_chat">
        <i data-lucide="message-circle"></i> <span>Чат (Связь)</span>
      </div>
      ${isAdmin ? `
      <div style="margin: 20px 16px 10px; font-size: 10px; font-weight: 800; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">Администрирование</div>
      <div class="nav-item ${STATE.view === 'admin_tasks_history' ? 'active' : ''}" data-view="admin_tasks_history">
        <i data-lucide="archive"></i> <span>Архив задач</span>
      </div>
      <div class="nav-item ${STATE.view === 'admin_requests_history' ? 'active' : ''}" data-view="admin_requests_history">
        <i data-lucide="inbox"></i> <span>Архив склада</span>
      </div>
      <div class="nav-item ${STATE.view === 'admin_finance' ? 'active' : ''}" data-view="admin_finance">
        <i data-lucide="calculator"></i> <span>Финансы</span>
      </div>
      <div class="nav-item ${STATE.view === 'admin_settings' ? 'active' : ''}" data-view="admin_settings">
        <i data-lucide="shield"></i> <span>Сотрудники</span>
      </div>
      <div class="nav-item ${STATE.view === 'admin_logs' ? 'active' : ''}" data-view="admin_logs">
        <i data-lucide="activity"></i> <span>Журнал</span>
      </div>` : ''}
    `;
  } else {
    navLinks = `
      <div class="nav-item ${STATE.view === 'client_orders' ? 'active' : ''}" data-view="client_orders">
        <i data-lucide="shopping-bag"></i> <span>Мои Заказы</span>
      </div>
    `;
  }

  const roleLabel = isAdmin ? 'АДМИНИСТРАТОР' : (STATE.user.role === 'client' ? 'КЛИЕНТ' : 'ИСПОЛНИТЕЛЬ');
  const unreadNotifs = APP_DATA.notifications.filter(n => n.userId === STATE.user.id && !n.read);

  return `
    <div class="dashboard animate-fade-in">
      <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
           <i data-lucide="box" style="width:32px; height:32px; color:var(--primary);"></i>
           <div style="line-height:1.1;">
             <div style="font-size:18px; letter-spacing:1px;">СТРОЙДОМ</div>
             <div style="font-size:10px; color:var(--text-dim); letter-spacing:2px; font-weight:500;">ERP SYSTEM</div>
           </div>
        </div>
        <div class="sidebar-nav">
          ${navLinks}
        </div>
        <div style="padding: 20px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.2);">
           <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
             <div style="width:36px; height:36px; background:var(--primary); border-radius:10px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:800; font-size:16px;">
               ${STATE.user.name[0]}
             </div>
             <div style="overflow:hidden;">
               <div style="font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${STATE.user.name}</div>
               <div style="font-size:10px; color:var(--primary); font-weight:600;">${roleLabel}</div>
             </div>
           </div>
           <button class="btn btn-secondary" id="logoutBtn" style="width:100%; justify-content:center; height:36px; font-size:12px;">
             <i data-lucide="log-out" style="width:14px; height:14px;"></i> ВЫЙТИ
           </button>
        </div>
      </div>
      
      <div class="main-content">
        <div class="topbar">
          <div style="display:flex; align-items:center; gap:16px;">
            <div id="menuToggle" onclick="toggleSidebar()">
              <i data-lucide="menu"></i>
            </div>
            <div class="topbar-title">
              <span style="color:var(--text-muted); font-weight:400; font-size:16px; vertical-align:middle; margin-right:8px;">Доска /</span> 
              ${getViewTitle()}
            </div>
          </div>
          <div class="user-profile">
            <span id="cloudStatus" style="font-size:11px; font-weight:600; padding:8px 16px; border-radius:12px; display:flex; align-items:center; gap:8px;
               background: ${CLOUD_STATUS==='online' ? 'rgba(16, 185, 129, 0.1)' : (CLOUD_STATUS==='error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)')};
               color: ${CLOUD_STATUS==='online' ? 'var(--success)' : (CLOUD_STATUS==='error' ? 'var(--danger)' : 'var(--warning)')};
               border: 1px solid ${CLOUD_STATUS==='online' ? 'rgba(16, 185, 129, 0.2)' : (CLOUD_STATUS==='error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)')};">
               <i data-lucide="${CLOUD_STATUS==='online' ? 'cloud-check' : (CLOUD_STATUS==='error' ? 'cloud-off' : 'cloud-lightning')}" style="width:14px;height:14px;"></i>
               ${CLOUD_STATUS==='online' ? 'ONLINE' : (CLOUD_STATUS==='error' ? 'CONNECTION ERROR' : 'CONNECTING...')}
            </span>

            <div style="position:relative; display:flex; gap:8px;">
               <button class="notif-btn" onclick="toggleTheme()" title="Сменить тему">
                 <i data-lucide="${STATE.theme === 'light' ? 'moon' : 'sun'}"></i>
               </button>
               <button class="notif-btn" onclick="toggleNotif()"><i data-lucide="bell"></i>
                 ${unreadNotifs.length > 0 ? `<span class="notif-badge">${unreadNotifs.length}</span>` : ''}
               </button>
               <div id="notifDropdown" class="notif-dropdown" style="display:none; transform-origin: top right; animation: fadeIn 0.3s ease;">
                 <div style="padding:16px; font-weight:700; border-bottom:1px solid var(--border); color:var(--text-main); font-size:14px;">Уведомления</div>
                 <div style="max-height:300px; overflow-y:auto;">
                   ${APP_DATA.notifications.filter(n => n.userId === STATE.user.id).slice(0, 8).map(n => `
                     <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
                        <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px; font-weight:700;">${n.date}</div>
                        <div style="color:var(--text-main); line-height:1.4;">${n.text}</div>
                     </div>
                   `).join('') || '<div style="padding:32px; color:var(--text-dim); font-size:12px; text-align:center;">Новых уведомлений нет</div>'}
                 </div>
               </div>
            </div>
          </div>
        </div>
        
        <div class="stats-row">
           ${renderViewStats()}
        </div>

        <div class="content-area animate-fade-in">
          ${renderCurrentViewContent()}
        </div>
      </div>
    </div>
  `;
}

function renderViewStats() {
  const isAdmin = STATE.user.role === 'admin';
  const data = [];
  
  switch(STATE.view) {
    case 'employee_plans':
      const myPlans = APP_DATA.plans.filter(p => isAdmin ? p.status!=='archived' : (p.empId === STATE.user.id && p.status!=='archived'));
      data.push({ label: 'Всего задач', value: myPlans.length, icon: 'list' });
      data.push({ label: 'В работе', value: myPlans.filter(p => p.status==='in_progress').length, icon: 'clock', color:'var(--primary)' });
      data.push({ label: 'Завершено', value: myPlans.filter(p => p.status==='done').length, icon: 'check-circle', color:'var(--success)' });
      break;
    case 'employee_inventory':
      data.push({ label: 'Позиций на складе', value: APP_DATA.inventory.length, icon: 'package' });
      data.push({ label: 'Критический остаток', value: APP_DATA.inventory.filter(i => i.stock <= 5).length, icon: 'alert-triangle', color:'var(--danger)' });
      data.push({ label: 'Активные заявки', value: APP_DATA.requests.filter(r => r.status!=='Архивировано').length, icon: 'file-text' });
      break;
    case 'employee_orders':
    case 'client_orders':
      const orders = STATE.view === 'client_orders' ? APP_DATA.orders.filter(o => o.client.includes(STATE.user.name)) : APP_DATA.orders;
      data.push({ label: 'Всего заказов', value: orders.length, icon: 'shopping-cart' });
      data.push({ label: 'В процессе', value: orders.filter(o => o.stage!=='Оплачен').length, icon: 'activity', color:'var(--primary)' });
      data.push({ label: 'Общая сумма', value: orders.reduce((s, o) => s + o.sum, 0).toLocaleString() + ' сом', icon: 'credit-card', color:'var(--success)' });
      break;
    default:
      data.push({ label: 'Система ERP', value: 'ONLINE', icon: 'shield-check' });
      data.push({ label: 'Версия', value: '2.0.1', icon: 'code' });
      data.push({ label: 'База данных', value: 'Cloud Firestore', icon: 'database' });
  }
  
  return data.map(s => `
    <div class="stat-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="stat-label">${s.label}</div>
        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:10px; color:${s.color || 'var(--text-dim)'};">
          <i data-lucide="${s.icon}" style="width:16px; height:16px;"></i>
        </div>
      </div>
      <div class="stat-value" style="color:${s.color || 'var(--text-main)'};">${s.value}</div>
    </div>
  `).join('');
}

function renderModal() {
  if (!MODAL.active) return '';
  const isReadOnly = !MODAL.onSubmit;
  
  return `
    <div class="modal-overlay active">
      <div class="modal-content">
        <div class="modal-header">
          <span>${MODAL.title}</span>
          <i data-lucide="x" class="modal-close" onclick="closeModal()"></i>
        </div>
        <form id="modalForm">
          ${MODAL.html}
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">${isReadOnly ? 'Закрыть' : 'Отмена'}</button>
            ${isReadOnly ? '' : '<button type="submit" class="btn">Сохранить</button>'}
          </div>
        </form>
      </div>
    </div>
  `;
}

function getViewTitle() {
  switch(STATE.view) {
    case 'employee_plans': return 'Задачи персонала';
    case 'employee_orders': return 'Сделки и Заказы (CRM)';
    case 'employee_inventory': return 'Склад и остатки';
    case 'admin_tasks_history': return 'Архив выполненных задач';
    case 'admin_requests_history': return 'Архив заявок склада';
    case 'admin_finance': return 'Финансовая аналитика';
    case 'admin_settings': return 'Управление доступом';
    case 'admin_logs': return 'Аудит действий';
    default: return 'Доска ERP';
  }
}

function renderCurrentViewContent() {
  const isAdmin = STATE.user.role === 'admin';
  switch(STATE.view) {
    
    // ----------- PLANS -----------
    case 'employee_plans': {
      let basePlans = isAdmin ? APP_DATA.plans : APP_DATA.plans.filter(p => p.empId === STATE.user.id);
      // Filter by Employee
      if (isAdmin && STATE.plansFilter && String(STATE.plansFilter) !== 'all') {
         basePlans = basePlans.filter(p => String(p.empId) === String(STATE.plansFilter));
      }

      // Filter by Category
      if (isAdmin && STATE.filterCat) {
         const catEmps = APP_DATA.users.filter(u => u.category === STATE.filterCat).map(u => u.id);
         basePlans = basePlans.filter(p => catEmps.includes(p.empId));
      }

      const displayPlans = basePlans.sort((a, b) => {
         if (isAdmin) {
             const empNameA = (APP_DATA.users.find(u => u.id == a.empId) || {}).name ||'';
             const empNameB = (APP_DATA.users.find(u => u.id == b.empId) || {}).name ||'';
             const nameCmp = empNameA.localeCompare(empNameB);
             if (nameCmp !== 0) return nameCmp;
         }
         return new Date(a.date || '2099-01-01') - new Date(b.date || '2099-01-01');
      });
      
      const renderPlanCard = (p) => {
        const emp = APP_DATA.users.find(u => u.id == p.empId);
        const empName = emp ? escapeHtml(emp.name) : 'Неизвестный';
        const isUrgent = p.urgency === 'urgent';

        return `
          <div class="glass-panel" style="padding:20px; position:relative; overflow:hidden; border-left: 4px solid ${isUrgent ? 'var(--danger)' : 'var(--border)'};">
            ${isUrgent ? '<div style="position:absolute; top:0; right:0; background:var(--danger); color:white; font-size:9px; padding:2px 8px; font-weight:800; border-bottom-left-radius:8px; text-transform:uppercase; letter-spacing:1px;">Срочно</div>' : ''}
            
            <div style="font-weight:700; font-size:16px; margin-bottom:12px; line-height:1.3; color:var(--text-main);">${escapeHtml(p.title)}</div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
               <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                 <i data-lucide="calendar" style="width:14px; height:14px;"></i> ${p.date || 'Без даты'}
               </div>
               ${isAdmin ? `<div style="font-size:11px; color:var(--primary); font-weight:700;">👷 ${empName}</div>` : ''}
            </div>

            <div style="display:flex; gap:8px; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:16px;">
              <div style="display:flex; gap:6px;">
                ${!isAdmin && p.status === 'open' ? `<button class="btn" style="padding:6px 12px; font-size:11px;" onclick="changePlanStatus(${p.id}, 'in_progress')">В работу</button>` : ''}
                ${!isAdmin && p.status === 'in_progress' ? `<button class="btn" style="background:var(--success); color:#000; padding:6px 12px; font-size:11px;" onclick="changePlanStatus(${p.id}, 'done')">Готово</button>` : ''}
                <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openTaskComments(${p.id})" title="Комментарии">
                  <i data-lucide="message-square" style="width:14px;height:14px;"></i>
                  ${(p.comments && p.comments.length) ? `<span style="font-size:10px; margin-left:4px;">${p.comments.length}</span>` : ''}
                </button>
              </div>
              ${isAdmin ? `
              <div class="flex-group-gap-4">
                ${p.status === 'done' ? `<button class="btn btn-secondary" style="padding:8px; color:var(--success);" title="В Архив" onclick="archivePlan(${p.id})"><i data-lucide="folder-down" style="width:14px; height:14px;"></i></button>` : ''}
                <button class="btn btn-secondary" style="padding:8px;" title="Изменить" onclick="editPlan(${p.id})"><i data-lucide="edit-2" style="width:14px; height:14px;"></i></button>
                <button class="btn btn-secondary" style="padding:8px; color:var(--danger);" title="Удалить" onclick="deletePlan(${p.id})"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      };

      const empOptions = APP_DATA.users.filter(u => u.role === 'employee').map(u => 
        `<option value="${u.id}" ${String(STATE.plansFilter) === String(u.id) ? 'selected' : ''}>${u.name}</option>`
      ).join('');

      const catOptions = (APP_DATA.settings?.workerCategories || []).map(c => 
        `<option value="${c}" ${STATE.filterCat === c ? 'selected' : ''}>📁 Группа: ${c}</option>`
      ).join('');

      return `
        <div class="flex-header margin-bottom-32">
           <div class="flex-group">
             ${isAdmin ? `
               <select class="btn btn-secondary" style="text-align:left; background:var(--bg-card); padding:8px 12px; font-size:12px; min-width:180px;" onchange="STATE.filterCat = this.value; render();">
                 <option value="">Все группы</option>
                 ${catOptions}
               </select>
               <select class="btn btn-secondary" style="text-align:left; background:var(--bg-card); padding:8px 12px; font-size:12px; min-width:180px;" onchange="filterPlansByEmp(this.value)">
                 <option value="all">👥 Все сотрудники</option>
                 ${empOptions}
               </select>
             ` : '<h3 style="margin:0;">Мои текущие задачи</h3>'}
           </div>
           ${isAdmin ? `
             <div class="flex-group mobile-flex-stack">
               <button class="btn btn-secondary" onclick="showPlanMap()"><i data-lucide="map"></i> Карта</button>
               <button class="btn btn-secondary" onclick="runDailyReport(true, 'tasks')"><i data-lucide="send"></i> Сводка задач</button>
               <button class="btn" onclick="addPlan()"><i data-lucide="plus"></i> Новая задача</button>
             </div>
           ` : `
             <div class="flex-group mobile-flex-stack">
               <button class="btn btn-secondary" onclick="showPlanMap()"><i data-lucide="map"></i> Карта объектов</button>
             </div>
           `}
        </div>

        <div class="kanban-board">
          <div class="kanban-col">
            <div class="kanban-header">
              <div class="kanban-title"><i data-lucide="circle" style="color:var(--text-dim);"></i> Ожидают</div>
              <div class="kanban-badge">${displayPlans.filter(p => p.status === 'open').length}</div>
            </div>
            ${displayPlans.filter(p => p.status === 'open').map(renderPlanCard).join('') || '<div style="color:var(--text-dim); text-align:center; padding:40px; border:1px dashed var(--border); border-radius:12px; font-size:12px;">Задач нет</div>'}
          </div>
          
          <div class="kanban-col">
            <div class="kanban-header">
              <div class="kanban-title"><i data-lucide="clock" style="color:var(--primary);"></i> В процессе</div>
              <div class="kanban-badge">${displayPlans.filter(p => p.status === 'in_progress').length}</div>
            </div>
            ${displayPlans.filter(p => p.status === 'in_progress').map(renderPlanCard).join('') || '<div style="color:var(--text-dim); text-align:center; padding:40px; border:1px dashed var(--border); border-radius:12px; font-size:12px;">Пусто</div>'}
          </div>

          <div class="kanban-col">
            <div class="kanban-header">
              <div class="kanban-title"><i data-lucide="check-circle" style="color:var(--success);"></i> Выполнено</div>
              <div class="kanban-badge">${displayPlans.filter(p => p.status === 'done').length}</div>
            </div>
            ${displayPlans.filter(p => p.status === 'done').map(renderPlanCard).join('') || '<div style="color:var(--text-dim); text-align:center; padding:40px; border:1px dashed var(--border); border-radius:12px; font-size:12px;">Пусто</div>'}
          </div>
        </div>
      `;
    }
      
    // ----------- INVENTORY -----------
    case 'employee_inventory': {
      const activeRequests = APP_DATA.requests.filter(r => r.status !== 'Архивировано');
      const displayRequests = isAdmin ? activeRequests : activeRequests.filter(r => r.empName === STATE.user.name);
      
      const requestsHtml = `
         <div class="flex-header margin-top-48 margin-bottom-24" style="flex-wrap:wrap;">
           <h3 style="margin:0;">Заявки на закупку/выдачу товара</h3>
           <button class="btn btn-secondary" onclick="createRequest()"><i data-lucide="file-plus" style="width:16px; height:16px; vertical-align:middle;"></i> Оставить заявку</button>
         </div>
         <table style="width:100%; border-collapse: collapse; text-align:left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              <th style="padding: 12px; color:var(--text-muted);">Инициатор</th>
              <th style="padding: 12px; color:var(--text-muted);">Наименование</th>
              <th style="padding: 12px; color:var(--text-muted);">Кол-во</th>
              <th style="padding: 12px; color:var(--text-muted);">Статус</th>
              ${isAdmin ? '<th style="padding: 12px; color:var(--text-muted); text-align:right;">Действия</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${displayRequests.map(r => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px;">${escapeHtml(r.empName)}</td>
                <td style="padding: 12px; font-weight:500;">${escapeHtml(r.itemName)}</td>
                <td style="padding: 12px;">${r.qty} шт.</td>
                <td style="padding: 12px;">
                   <span style="background:${r.status === 'Одобрено' ? 'rgba(39, 174, 96, 0.2)' : (r.status === 'Отклонено' ? 'rgba(192, 57, 43, 0.2)' : 'rgba(255,255,255,0.1)')}; 
                                color:${r.status === 'Одобрено' ? '#2ecc71' : (r.status === 'Отклонено' ? '#e74c3c' : 'var(--text-main)')}; 
                                padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700;">${r.status}</span>
                </td>
                ${isAdmin ? `
                <td style="padding: 12px; text-align:right;">
                  ${r.status === 'Ожидает' ? `
                    <button class="btn btn-secondary" style="padding:6px; color:#2ecc71; margin-right:4px;" title="Одобрить" onclick="approveRequest(${r.id})"><i data-lucide="check" style="width:14px; height:14px;"></i></button>
                    <button class="btn btn-secondary" style="padding:6px; color:#e74c3c;" title="Отклонить" onclick="rejectRequest(${r.id})"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                  ` : `<button class="btn btn-secondary" style="padding:6px; color:var(--text-muted);" title="Убрать в архив" onclick="archiveRequest(${r.id})"><i data-lucide="folder-down" style="width:14px; height:14px;"></i> В архив</button>`}
                </td>` : ''}
              </tr>
            `).join('') || `<tr><td colspan="5" style="padding:24px; color:var(--text-muted); text-align:center;">Заявок пока нет.</td></tr>`}
          </tbody>
         </table>
      `;

      return `
        <div class="glass-panel" style="padding:24px;">
           <div class="flex-header margin-bottom-24" style="flex-wrap:wrap;">
             <h3 style="margin:0;">Товарные остатки склада</h3>
             <div class="flex-group">
               <button class="btn btn-secondary" onclick="startQRScanner()"><i data-lucide="scan" style="width:14px; height:14px; margin-right:4px;"></i> Сканер QR</button>
               <button class="btn btn-secondary" onclick="exportExcel('inventory')"><i data-lucide="download" style="width:14px; height:14px;"></i> Excel</button>
               ${isAdmin ? `
                 <label class="btn btn-secondary" style="cursor:pointer; margin:0;" title="Загрузить список товаров из Excel">
                   <i data-lucide="upload" style="width:16px; height:16px; vertical-align:middle;"></i> Загрузить Excel
                   <input type="file" style="display:none;" accept=".xlsx, .xls" onchange="importExcel(event)">
                 </label>
                 <button class="btn" onclick="addInventory()"><i data-lucide="plus" style="width:16px; height:16px; vertical-align:middle;"></i> Один Товар</button>
               ` : ''}
             </div>
           </div>
           
           <table style="width:100%; border-collapse: collapse; text-align:left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 12px; color:var(--text-muted);">ID</th>
                <th style="padding: 12px; color:var(--text-muted);">Категория</th>
                <th style="padding: 12px; color:var(--text-muted);">Название товара/стройматериала</th>
                <th style="padding: 12px; color:var(--text-muted);">Остаток</th>
                <th style="padding: 12px; color:var(--text-muted);">Закупочная цена (1 ед.)</th>
                <th style="padding: 12px; color:var(--text-muted); text-align:right;">Действия</th>
              </tr>
            </thead>
            <tbody>
              ${APP_DATA.inventory.map(item => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${item.stock <= 5 ? 'background: rgba(192, 57, 43, 0.05);' : ''}">
                  <td style="padding: 12px;">${item.id}</td>
                  <td style="padding: 12px;"><span style="color:var(--primary); font-size:12px; text-transform:uppercase;">${escapeHtml(item.category)}</span></td>
                  <td style="padding: 12px; font-weight: 500; ${item.stock <= 5 ? 'color:var(--danger);' : ''}">${escapeHtml(item.name)}</td>
                  <td style="padding: 12px;"><span style="background:${item.stock <= 5 ? 'var(--danger)' : 'var(--accent)'}; padding:4px 10px; border-radius:4px; font-size:13px; font-weight:700;">${item.stock} шт.</span></td>
                  <td style="padding: 12px;">${item.price.toLocaleString()} сом</td>
                  ${isAdmin ? `
                  <td style="padding: 12px; text-align:right;">
                    <button class="btn btn-secondary" style="padding:6px; margin-right:4px;" title="Изменить" onclick="editInventory(${item.id})"><i data-lucide="edit-2" style="width:14px; height:14px;"></i></button>
                    <button class="btn btn-secondary" style="padding:6px; color:var(--danger);" title="Удалить" onclick="deleteInventory(${item.id})"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
                  </td>` : ''}
                </tr>
              `).join('')}
            </tbody>
           </table>
           
           ${requestsHtml}
        </div>
      `;
    }
      
    // ----------- ORDERS / KANBAN -----------
    case 'employee_orders':
    case 'client_orders': {
      const forClient = STATE.view === 'client_orders';
      let orders = forClient ? APP_DATA.orders.filter(o => o.client.includes(STATE.user.name)) : APP_DATA.orders; 
      
      if (!forClient && STATE.filterCat) {
        orders = orders.filter(o => o.workerCategory === STATE.filterCat);
      }

      const isAdmin = STATE.user?.role === 'admin';
      const catOptions = (APP_DATA.settings?.workerCategories || []).map(c => `
         <option value="${c}" ${STATE.filterCat === c ? 'selected' : ''}>${c}</option>
      `).join('');

      if (forClient) {
        // ... (Client View stays the same)
        return `
         <div class="glass-panel" style="padding:32px;">
           <div class="flex-header margin-bottom-32" style="flex-wrap:wrap;">
             <h3 style="margin:0;">История моих заказов</h3>
             <button class="btn" onclick="clientCreateOrder()"><i data-lucide="plus"></i> Новая заявка</button>
           </div>
           <div class="flex-col-gap-16">
              ${orders.map(order => `
                <div class="glass-panel flex-header-center" style="padding:24px; border-left:4px solid var(--primary);">
                  <div>
                    <div style="font-weight:800; font-size:18px; color:var(--text-main); margin-bottom:4px;">${order.id}</div>
                    <div style="font-size:13px; color:var(--text-dim);"><i data-lucide="clock" style="width:12px;height:12px;"></i> Ожидаемая дата: ${order.date}</div>
                  </div>
                  <div class="flex-group-gap-24">
                    <div style="text-align:right;">
                      <div style="font-weight:800; font-size:22px; color:var(--primary);">${order.sum.toLocaleString()} сом</div>
                      <span class="badge badge-info">${order.stage}</span>
                    </div>
                    <button class="btn btn-secondary" style="padding:12px;" onclick="printInvoice('${order.id}')" title="Печать">
                      <i data-lucide="printer"></i>
                    </button>
                  </div>
                </div>
              `).join('') || '<div style="padding:48px; text-align:center; color:var(--text-dim);">У вас пока нет заказов.</div>'}
           </div>
        </div>`;
      }

      // Kanban CRM for Employees / Admins
      return `
         <div class="flex-header" style="margin-bottom: 32px; flex-wrap:wrap; gap:20px;">
           <div>
             <h3 style="margin-bottom:4px;">Воронка продаж / Сделки</h3>
             <p style="color:var(--text-muted); font-size:13px;">Управление жизненным циклом заказов клиентов.</p>
           </div>
            <div class="flex-group mobile-flex-stack">
             <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:180px;">
                <label style="font-size:11px; font-weight:700; color:var(--text-dim);">ГРУППА РАБОТНИКОВ:</label>
                <select style="background:var(--bg-card); border:1px solid var(--border); color:var(--text-main); padding:6px 12px; border-radius:8px; font-size:12px; width:100%;" onchange="STATE.filterCat = this.value; render();">
                  <option value="">Все группы</option>
                  ${catOptions}
                </select>
             </div>
             ${isAdmin ? `
                <div class="flex-group mobile-flex-stack" style="margin-top:15px;">
                  <button class="btn btn-secondary" style="height:40px;" onclick="runDailyReport(true, 'orders')"><i data-lucide="send"></i> Сводка заказов</button>
                  <button class="btn" style="height:40px;" onclick="addOrder()"><i data-lucide="plus"></i> Создать сделку</button>
               </div>
             ` : ''}
           </div>
         </div>
         <div class="kanban-board">
           ${['Новый', 'В работе', 'Сдан', 'Оплачен'].map(stage => {
              const borderMap = {'Новый': 'var(--text-dim)', 'В работе': 'var(--primary)', 'Сдан': 'var(--secondary)', 'Оплачен': 'var(--success)'};
              const colOrders = orders.filter(o => o.stage === stage);
              const colSum = colOrders.reduce((a, b) => a + (b.sum || 0), 0);
              
              return `
                <div class="kanban-col">
                  <div class="kanban-header" style="border-bottom: 2px solid ${borderMap[stage]}; padding-bottom:12px; margin-bottom:4px;">
                    <div>
                      <div class="kanban-title">${stage}</div>
                      <div style="font-size:11px; font-weight:700; color:var(--text-dim); margin-top:4px;">${colSum.toLocaleString()} сом ${STATE.filterCat ? `(${STATE.filterCat})` : ''}</div>
                    </div>
                    <div class="kanban-badge">${colOrders.length}</div>
                  </div>
                  
                  ${colOrders.map(o => `
                    <div class="glass-panel" style="padding: 20px; border-left: 3px solid ${borderMap[stage]};">
                      <div style="font-weight:800; color:var(--text-main); margin-bottom:12px; font-size:14px; display:flex; justify-content:space-between;">
                        ${o.id}
                        <div style="display:flex; gap:6px;">
                          ${o.workerCategory ? `<span style="font-size:9px; background:var(--bg-main); padding:2px 6px; border-radius:4px; color:var(--primary); border:1px solid var(--primary);">${o.workerCategory}</span>` : ''}
                          ${isAdmin ? `<button class="logout-btn" style="padding:0;" onclick="editOrderSum('${o.id}')"><i data-lucide="edit-3" style="width:12px;height:12px;"></i></button>` : ''}
                        </div>
                      </div>
                      <div style="font-size:15px; margin-bottom:4px; font-weight:700; color:var(--text-main);">👤 ${escapeHtml(o.client)}</div>
                      <div style="font-size:12px; margin-bottom:16px; color:var(--text-dim); font-weight:500;">📅 Срок: ${o.date}</div>
                      
                      <div style="font-weight:800; font-size:20px; color:var(--text-main); margin-bottom:20px;">${o.sum.toLocaleString()} <span style="font-size:12px; color:var(--text-dim);">сом</span></div>
                      
                      <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn btn-secondary" style="width:100%; font-size:11px; padding:8px 0;" onclick="printInvoice('${o.id}')"><i data-lucide="printer" style="width:12px;height:12px;"></i> Печать документов</button>
                        ${isAdmin && stage !== 'Оплачен' ? `<button class="btn" style="width:100%; font-size:11px; padding:8px 0;" onclick="nextOrderStage('${o.id}')">Продвинуть <i data-lucide="chevron-right" style="width:12px;height:12px;"></i></button>` : ''}
                        ${isAdmin && stage !== 'Новый' ? `<button class="btn btn-secondary" style="width:100%; font-size:11px; padding:8px 0;" onclick="prevOrderStage('${o.id}')"><i data-lucide="chevron-left" style="width:12px;height:12px;"></i> Вернуть назад</button>` : ''}
                      </div>
                    </div>
                  `).join('') || '<div style="font-size:12px; color:var(--text-dim); text-align:center; padding:32px; border:1px dashed var(--border); border-radius:12px;">Сделок нет</div>'}
                </div>
              `;
           }).join('')}
         </div>
      `;
    }

    // ----------- ADMIN: REQUESTS HISTORY -----------
    case 'admin_requests_history': {
      const archivedReqs = APP_DATA.requests.filter(r => r.status === 'Архивировано');
      return `
        <div class="glass-panel" style="padding:32px;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 32px;">
             <div>
               <h3 style="margin:0;">Архив снабжения</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">История выданных и отклоненных материалов.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('requests')"><i data-lucide="download"></i> Excel Отчет</button>
           </div>
           
           <div class="table-container">
             <table>
              <thead>
                <tr>
                  <th>Инициатор</th>
                  <th>Наименование</th>
                  <th>Кол-во</th>
                  <th>Прежний статус</th>
                  <th style="text-align:right;">Действия</th>
                </tr>
              </thead>
              <tbody>
                ${archivedReqs.map(r => `
                   <tr>
                     <td style="font-weight:600; color:var(--primary);">${escapeHtml(r.empName)}</td>
                     <td>${escapeHtml(r.itemName)}</td>
                     <td style="color:var(--text-muted);">${r.qty} шт.</td>
                     <td><span class="badge badge-info">${r.prevStatus || 'Отработана'}</span></td>
                     <td style="text-align:right;">
                       <button class="btn btn-secondary" style="padding:8px; color:var(--danger);" onclick="deleteRequest(${r.id})"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                     </td>
                   </tr>
                `).join('') || `<tr><td colspan="5" style="padding:48px; text-align:center; color:var(--text-dim);">Архив пуст</td></tr>`}
              </tbody>
             </table>
           </div>
        </div>
      `;
    }

    // ----------- ADMIN: TASKS HISTORY -----------
    case 'admin_tasks_history': {
      const archivedPlans = APP_DATA.plans.filter(p => p.status === 'archived').sort((a,b) => new Date(b.date || '2000-01-01') - new Date(a.date || '2000-01-01'));
      return `
        <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
             <div>
               <h3 style="margin:0;">Архив выполненных задач</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Полная история поручений и завершенных работ.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('tasks')"><i data-lucide="download"></i> Excel Отчет</button>
           </div>
           
           <div class="table-container">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 12px; color:var(--text-muted);">Исполнитель</th>
                <th style="padding: 12px; color:var(--text-muted);">Текст задачи</th>
                <th style="padding: 12px; color:var(--text-muted);">Дедлайн</th>
                <th style="padding: 12px; color:var(--text-muted);">Срочность</th>
                <th style="padding: 12px; color:var(--text-muted); text-align:right;">Управление</th>
              </tr>
            </thead>
            <tbody>
              ${archivedPlans.map(p => {
                 const empName = escapeHtml((APP_DATA.users.find(u => u.id == p.empId) || {}).name || 'Неизвестный');
                 return `
                 <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                   <td style="padding: 12px; font-weight:600; color:var(--primary);">${empName}</td>
                   <td style="padding: 12px;">${escapeHtml(p.title)}</td>
                   <td style="padding: 12px; color:var(--text-muted);">${p.date || '-'}</td>
                   <td style="padding: 12px;">${p.urgency === 'urgent' ? '<b style="color:var(--danger);">СРОЧНО</b>' : 'Плановая'}</td>
                   <td style="padding: 12px; text-align:right;">
                     <button class="btn btn-secondary" style="padding:6px; color:var(--text-muted); margin-right:4px;" title="Вернуть в работу" onclick="changePlanStatus(${p.id}, 'done')"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i></button>
                     <button class="btn btn-secondary" style="padding:6px; color:var(--danger);" onclick="deletePlan(${p.id})" title="Удалить навсегда"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                   </td>
                 </tr>
                 `;
              }).join('') || `<tr><td colspan="5" style="padding:24px; color:var(--text-muted); text-align:center;">Архив пуст</td></tr>`}
            </tbody>
             </table>
           </div>
        </div>
      `;
    }

    // ----------- ADMIN: FINANCE -----------
    case 'admin_finance': {
      const invValue = APP_DATA.inventory.reduce((a, b) => a + (b.stock * b.price), 0);
      const totalRevenue = APP_DATA.orders.reduce((sum, o) => sum + (o.sum || 0), 0);
      const totalExpenses = (APP_DATA.expenses || []).reduce((sum, e) => sum + (e.sum || 0), 0);
      const netProfit = totalRevenue - totalExpenses;
      
      const stages = ['Новый', 'В работе', 'Сдан', 'Оплачен'];
      const funnelCounts = stages.map(s => APP_DATA.orders.filter(o => o.stage === s).length);
      const maxFunnel = Math.max(...funnelCounts, 1);
      const funnelHtml = stages.map((s, i) => {
        const count = funnelCounts[i];
        const pct = (count / maxFunnel) * 100;
        const colorMap = ['var(--text-dim)', 'var(--primary)', 'var(--secondary)', 'var(--success)'];
        return `
          <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; font-weight:700;">
              <span style="color:var(--text-main);">${s}</span>
              <span style="color:var(--text-muted);">${count} ед.</span>
            </div>
            <div style="width:100%; background:var(--bg-main); height:8px; border-radius:10px; overflow:hidden; border:1px solid var(--border);">
               <div style="width:${pct}%; background:${colorMap[i]}; height:100%; border-radius:10px; transition: width 1s ease;"></div>
            </div>
          </div>
        `;
      }).join('');

      const allFinishedPlans = APP_DATA.plans.filter(p => p.status === 'done' || p.status === 'archived');
      const empStats = {};
      allFinishedPlans.forEach(p => { empStats[p.empId] = (empStats[p.empId] || 0) + 1; });
      const sortedEmps = Object.entries(empStats).sort((a,b) => b[1] - a[1]).slice(0, 4);
      const maxTask = sortedEmps.length ? sortedEmps[0][1] : 1;
      let empStatsHtml = sortedEmps.map(([id, count]) => {
         const empName = (APP_DATA.users.find(u => u.id == id) || {}).name || 'Неизвестный';
         const pct = (count / maxTask) * 100;
         return `
          <div style="padding:16px; background:var(--bg-main); border:1px solid var(--border); border-radius:12px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:10px; font-weight:700;">
              <span>${empName}</span>
              <span style="color:var(--primary);">${count} задач</span>
            </div>
            <div style="width:100%; background:rgba(255,255,255,0.03); height:6px; border-radius:10px; overflow:hidden;">
               <div style="width:${pct}%; background:var(--primary); height:100%; border-radius:10px;"></div>
            </div>
          </div>
         `;
      }).join('');

      return `
        <div class="glass-panel" style="padding:32px;">
           <div class="flex-header" style="margin-bottom: 32px;">
             <div>
               <h3 style="margin:0;">Финансовая аналитика</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Расчет прибыли, активов и продуктивности персонала.</p>
             </div>
              <div class="flex-group">
                <button class="btn btn-secondary" style="background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="runDailyReport(true)"><i data-lucide="send"></i> Отправить сводку</button>
                <button class="btn" style="background:linear-gradient(90deg, #6366f1, #a855f7); color:white;" onclick="generateAIReport()"><i data-lucide="sparkles"></i> AI Анализ</button>
                <button class="btn" style="background:var(--danger); color:white;" onclick="addExpense()"><i data-lucide="minus-circle"></i> Расход</button>
              </div>
           </div>
           
           <div class="grid-cards" style="margin-bottom:32px;">
             <div class="stat-card" style="border: 1px solid var(--border);">
               <div class="stat-label">Активы на складе</div>
               <div class="stat-value" style="font-size:32px; color:var(--primary); font-weight:900;">${invValue.toLocaleString()} <span style="font-size:14px; font-weight:600;">сом</span></div>
             </div>
             <div class="stat-card" style="border: 1px solid var(--border);">
               <div class="stat-label">Чистая прибыль</div>
               <div class="stat-value" style="font-size:32px; color:var(--success); font-weight:900;">${netProfit.toLocaleString()} <span style="font-size:14px; font-weight:600;">сом</span></div>
             </div>
             <div class="stat-card" style="border: 1px solid var(--border);">
               <div class="stat-label">Операционные расходы</div>
               <div class="stat-value" style="font-size:32px; color:var(--danger); font-weight:900;">${totalExpenses.toLocaleString()} <span style="font-size:14px; font-weight:600;">сом</span></div>
             </div>
           </div>

           <div class="grid-2-cols margin-bottom-32" style="grid-template-columns: 2fr 1fr; gap:24px;">
               <div class="glass-panel" style="padding:24px; background:var(--bg-main); min-height:400px; display:flex; flex-direction:column;">
                 <h4 style="margin-bottom:24px; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="line-chart"></i> Динамика финансов (План/Факт)</h4>
                 <div style="flex:1; position:relative;"><canvas id="financeLineChart"></canvas></div>
               </div>
               
               <div class="glass-panel" style="padding:24px; background:var(--bg-main); min-height:400px; display:flex; flex-direction:column;">
                 <h4 style="margin-bottom:24px; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="pie-chart"></i> Воронка заказов</h4>
                 <div style="flex:1; position:relative;"><canvas id="funnelPieChart"></canvas></div>
               </div>
            </div>

            <div class="grid-2-cols margin-bottom-32">
               <div class="glass-panel" style="padding:24px; background:var(--bg-main);">
                 <h4 style="margin-bottom:24px; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="users"></i> Продуктивность (Задачи)</h4>
                 <div class="flex-col-gap-16">
                   ${empStatsHtml || '<p style="color:var(--text-dim); text-align:center;">Данных пока нет</p>'}
                 </div>
               </div>
               <div class="glass-panel" style="padding:24px; background:var(--bg-main);">
                 <h4 style="margin-bottom:24px; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="activity"></i> Статус активности</h4>
                 <div style="padding:40px 20px; text-align:center; color:var(--text-dim);">
                    <div style="font-size:64px; font-weight:900; color:var(--primary); line-height:1;">${APP_DATA.orders.filter(o => o.stage!=='Оплачен').length}</div>
                    <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-top:8px;">Активных объектов в работе</div>
                 </div>
               </div>
            </div>

           <div class="table-container" style="margin-top:32px;">
              <div style="padding:20px; border-bottom:1px solid var(--border); font-weight:700;">Последние транзакции (Касса)</div>
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Категория</th>
                    <th>Комментарий</th>
                    <th style="text-align:right;">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  ${(APP_DATA.expenses || []).slice(0, 10).map(e => `
                    <tr>
                      <td style="color:var(--text-muted); font-size:12px;">${e.date}</td>
                      <td><span class="badge badge-danger">${e.category}</span></td>
                      <td style="font-size:13px;">${e.comment}</td>
                      <td style="text-align:right; font-weight:800; color:var(--danger);">-${e.sum.toLocaleString()} сом</td>
                    </tr>
                  `).join('') || '<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--text-dim);">Транзакций не найдено</td></tr>'}
                </tbody>
              </table>
           </div>
        </div>
      `;
    }
    
    // ----------- ADMIN: SETTINGS -----------
    case 'admin_settings':
      return `
        <div class="glass-panel" style="padding:32px;">
           <div class="flex-header" style="margin-bottom: 32px;">
             <div>
               <h3 style="margin:0;">Управление доступом</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Настройка уведомлений и учетных записей.</p>
             </div>
             <button class="btn" onclick="addUser()"><i data-lucide="user-plus"></i> Новый пользователь</button>
           </div>

           <div class="grid-2-cols" style="margin-bottom:32px;">
             <!-- Telegram Settings -->
             <div class="glass-panel" style="padding:24px; background:var(--bg-main); border-color:var(--secondary);">
                <h4 style="margin-bottom:20px; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="send"></i> Уведомления</h4>
                <div style="display:flex; flex-direction:column; gap:16px;">
                  <div class="input-block" style="margin-bottom:0;">
                    <label>Telegram Chat ID</label>
                    <input id="sysTgChatId" value="${APP_DATA.settings?.tgChatId || ''}" placeholder="-100xxxxxxxxx">
                  </div>
                  <button class="btn" style="background:var(--secondary); color:white; width:100%;" onclick="saveTgSettings()">Обновить канал</button>
                </div>
                <p style="font-size:11px; color:var(--text-dim); margin-top:12px;">ID должен начинаться с минуса (например -100123456789). Проверить ID можно через @getmyid_bot.</p>
             </div>

             <!-- Worker Categories -->
             <div class="glass-panel" style="padding:24px; background:var(--bg-main); border-color:var(--primary);">
                 <div class="flex-header margin-bottom-20">
                  <h4 style="margin:0; color:var(--text-main); display:flex; align-items:center; gap:8px;"><i data-lucide="briefcase"></i> Группы работников</h4>
                  <button class="btn" style="padding:6px 12px; font-size:12px;" onclick="addWorkerCategory()"><i data-lucide="plus" style="width:14px;height:14px;"></i> Добавить</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                  ${(APP_DATA.settings?.workerCategories || []).map(cat => `
                    <div class="badge badge-warning" style="display:flex; align-items:center; gap:8px; padding:6px 12px;">
                      ${cat}
                      <i data-lucide="x" style="width:12px; height:12px; cursor:pointer;" onclick="deleteWorkerCategory('${cat}')"></i>
                    </div>
                  `).join('') || '<p style="color:var(--text-dim); font-size:12px;">Категории не заданы</p>'}
                </div>
             </div>
           </div>
           
           <div class="table-container">
             <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Логин / Группа</th>
                  <th>Роль</th>
                  <th style="text-align:right;">Действия</th>
                </tr>
              </thead>
              <tbody>
                ${APP_DATA.users.map(u => `
                  <tr>
                    <td>
                       <div style="font-weight:700;">${u.name}</div>
                       <div style="font-size:11px; color:var(--text-muted);">${u.tg || 'TG не привязан'}</div>
                    </td>
                    <td>
                       <div style="font-family:monospace; color:var(--primary); font-weight:700;">${u.login}</div>
                       <div style="font-size:11px; color:var(--text-dim); font-weight:600;">📁 ${u.category || 'Без категории'}</div>
                    </td>
                    <td><span class="badge ${u.role==='admin' ? 'badge-danger' : (u.role==='client' ? 'badge-info' : 'badge-warning')}">${u.role}</span></td>
                    <td style="text-align:right;">
                      <button class="btn btn-secondary" style="padding:8px;" onclick="editUser(${u.id})"><i data-lucide="edit-3" style="width:14px; height:14px;"></i></button>
                      ${u.role !== 'admin' ? `<button class="btn btn-secondary" style="padding:8px; color:var(--danger);" onclick="deleteUser(${u.id})"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
             </table>
           </div>
        </div>
      `;

    // ----------- ADMIN: LOGS -----------
    case 'admin_logs':
      return `
        <div class="glass-panel" style="padding:32px;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 32px;">
             <div>
                <h3 style="margin:0;">Журнал событий</h3>
                <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Полный аудит действий всех пользователей в системе.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('logs')"><i data-lucide="download"></i> Excel Выгрузка</button>
           </div>
           
           <div class="table-container">
             <table>
              <thead>
                <tr>
                  <th style="width:180px;">Время</th>
                  <th style="width:200px;">Кто</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                ${APP_DATA.auditLog.map(log => `
                  <tr>
                    <td style="color:var(--text-dim); font-size:12px; font-family:monospace;">${log.time}</td>
                    <td><span class="badge badge-info">${log.user}</span></td>
                    <td style="font-weight:500;">${log.action}</td>
                  </tr>
                `).join('') || `<tr><td colspan="3" style="padding:48px; text-align:center; color:var(--text-dim);">Журнал пуст</td></tr>`}
              </tbody>
             </table>
           </div>
        </div>
      `;

    // ----------- CHAT / COMMUNICATIONS -----------
    case 'employee_chat': {
      const messages = APP_DATA.chatMessages || [];
      const emps = APP_DATA.users.filter(u => u.role !== 'client');
      
      const formatMsgText = (text) => {
        return text.replace(/@\w+/g, (match) => `<span class="mention">${match}</span>`);
      };

      return `
        <div style="display:flex; flex-direction:column; gap:24px; height: calc(100vh - 120px);">
           <div style="display:flex; justify-content:space-between; align-items:center;">
             <div>
               <h3 style="margin:0;">Общий чат сотрудников</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">Используйте @имя для упоминания коллеги.</p>
             </div>
             <div style="display:flex; gap:8px;">
               ${emps.slice(0, 5).map(e => `
                 <button class="btn btn-secondary" style="font-size:10px; padding:4px 8px;" onclick="document.getElementById('chatInput').value += '@${e.login} '; document.getElementById('chatInput').focus();">
                   @${e.login}
                 </button>
               `).join('')}
             </div>
           </div>

           <div class="chat-container">
             <div class="chat-messages" id="chatMessages">
               ${messages.map(m => {
                 const isMine = m.senderId === STATE.user.id;
                 return `
                   <div class="chat-bubble ${isMine ? 'mine' : ''}">
                     <div class="chat-meta">
                       <span>${escapeHtml(m.senderName)} (${m.role})</span>
                       <span class="chat-time">${m.time}</span>
                     </div>
                     <div class="chat-text">${formatMsgText(escapeHtml(m.text))}</div>
                   </div>
                 `;
               }).join('') || '<div style="margin:auto; color:var(--text-dim); text-align:center;">Сообщений пока нет. Будьте первыми!</div>'}
             </div>
             
             <div class="chat-input-area">
               <input id="chatInput" placeholder="Ваше сообщение или предложение..." style="flex:1; background:var(--bg-main); border:1px solid var(--border); color:var(--text-main); padding:12px 20px; border-radius:12px;" onkeydown="if(event.key==='Enter') sendChatMessage()">
               <button class="btn" onclick="sendChatMessage()" style="width:50px; height:50px; padding:0; justify-content:center;">
                 <i data-lucide="send"></i>
               </button>
             </div>
           </div>
        </div>
        <script>
           // Scroll to bottom after render
           setTimeout(() => {
             const chat = document.getElementById('chatMessages');
             if(chat) chat.scrollTop = chat.scrollHeight;
           }, 100);
        </script>
      `;
    }

    default: return '';
  }
}

// ---------------- CHARTS LOGIC ---------------- //
window.initFinanceCharts = function() {
  const lineCtx = document.getElementById('financeLineChart')?.getContext('2d');
  const funnelCtx = document.getElementById('funnelPieChart')?.getContext('2d');
  
  if (!lineCtx || !funnelCtx || !window.Chart) return;

  const textColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#f0f6fc';
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#30363d';

  // Dynamic grouping logic by month could go here. For now, visual representation:
  const labels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн']; 
  const incomeData = [120000, 450000, 890000, 560000, 1200000, 950000]; 
  const expenseData = [80000, 230000, 410000, 320000, 450000, 390000]; 

  // Line Chart
  new Chart(lineCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Оборот (Доходы)', data: incomeData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
        { label: 'Расходы', data: expenseData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: {family: "'Outfit', sans-serif"} } } },
      scales: {
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { display: false } }
      }
    }
  });

  // Funnel Pie Chart
  const stages = ['Новый', 'В работе', 'Сдан', 'Оплачен'];
  const funnelCounts = stages.map(s => APP_DATA.orders.filter(o => o.stage === s).length);

  new Chart(funnelCtx, {
    type: 'doughnut',
    data: {
      labels: stages,
      datasets: [{
        data: funnelCounts,
        backgroundColor: ['#484f58', '#f59e0b', '#6366f1', '#10b981'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: 'bottom', labels: { color: textColor, padding: 20, font: {family: "'Outfit', sans-serif"} } }
      },
      cutout: '75%'
    }
  });
};


// ---------------- GLOBAL MODIFICATION API ---------------- //

window.openModal = function(title, html, onSubmit) {
  MODAL.active = true;
  MODAL.title = title;
  MODAL.html = html;
  MODAL.onSubmit = onSubmit;
  render();
};

window.closeModal = function() {
  MODAL.active = false;
  render();
};

window.archivePlan = function(id) {
  const p = APP_DATA.plans.find(x => String(x.id) === String(id));
  if(p) {
    p.status = 'archived';
    addLog(`Архив: Перенес задачу "${p.title}" в историю`);
    saveDB();
    render();
  }
};

// UI Interactions
window.filterPlansByEmp = function(val) {
   STATE.plansFilter = val;
   saveSession();
   render();
}

window.toggleNotif = function() {
  const el = document.getElementById('notifDropdown');
  if(el) el.style.display = (el.style.display === 'none') ? 'flex' : 'none';
};

window.markNotifRead = function(id) {
  const notif = APP_DATA.notifications.find(n => n.id === id);
  if(notif) { notif.read = true; saveDB(); render(); toggleNotif(); }
};

window.saveTgSettings = function() {
  const v = document.getElementById('sysTgChatId').value;
  APP_DATA.settings.tgChatId = v.trim();
  saveDB();
  addLog('Система: Обновлен Chat ID для Telegram бота');
  alert('Настройки Telegram успешно сохранены!');
};

window.exportExcel = function(type) {
  if (!window.XLSX) return alert("Библиотека Excel еще загружается, подождите секунду...");
  let data = [];
  if (type === 'inventory') {
    data = APP_DATA.inventory.map(i => ({ "ID": i.id, "Название": i.name, "Категория": i.category, "Остаток (шт)": i.stock, "Цена (сом)": i.price }));
  } else if (type === 'logs') {
    data = APP_DATA.auditLog.map(l => ({ "Время": l.time, "Пользователь": l.user, "Событие": l.action }));
  } else if (type === 'tasks') {
    data = APP_DATA.plans.filter(p => p.status === 'archived').map(p => {
       const empName = (APP_DATA.users.find(u => u.id == p.empId) || {}).name || '-';
       return { "Исполнитель": empName, "Задача": p.title, "Дедлайн": (p.date || '-'), "Срочность": (p.urgency === 'urgent' ? 'СРОЧНО' : 'Плановая') };
    });
  } else if (type === 'requests') {
    data = APP_DATA.requests.filter(r => r.status === 'Архивировано').map(r => ({ "Сотрудник": r.empName, "Название товара": r.itemName, "Количество": r.qty, "Статус": (r.prevStatus || 'Отработана') }));
  }
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `StroyKomplekt_${type}.xlsx`);
  addLog(`Экспорт: Выгрузил данные "${type}" в Excel файл`);
};

window.importExcel = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!window.XLSX) return alert("Библиотека Excel загружается, попробуйте еще раз...");
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.SheetNames[0];
      const items = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
      
      let added = 0;
      items.forEach(row => {
         const name = row['Название'] || row['Name'] || row['Товар'] || row['name'];
         if (!name) return;
         
         const price = parseInt(row['Цена'] || row['цена'] || row['Price'] || row['price'] || row['Цена (сом)']) || 0;
         const stock = parseInt(row['Остаток'] || row['остаток'] || row['Количество'] || row['Остаток (шт)']) || 0;
         const cat = row['Категория'] || row['category'] || 'Материалы';
         
         const newId = Math.floor(Math.random()*10000) + APP_DATA.inventory.length;
         APP_DATA.inventory.push({ id: newId, name: name, category: cat, stock: stock, price: price });
         added++;
      });
      
      if (added > 0) {
        addLog(`Склад: Импортировано ${added} товаров из Excel файла`);
        saveDB();
        render();
        alert(`Успешно загружено ${added} товаров!`);
      } else {
        alert("В файле не найдены корректные товары. Сделайте столбцы 'Название', 'Цена' и 'Остаток'.");
      }
    } catch(err) {
      console.error(err);
      alert("Ошибка при чтении файла Excel.");
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = ""; // reset
};

window.nextOrderStage = function(id) {
  const o = APP_DATA.orders.find(x => x.id === id);
  if(!o) return;
  if(o.stage === 'Новый') o.stage = 'В работе';
  else if(o.stage === 'В работе') o.stage = 'Сдан';
  else if(o.stage === 'Сдан') o.stage = 'Оплачен';
  addLog(`CRM: Заказ клиента ${o.client} продвинут на этап "${o.stage}"`);
  render();
};

window.prevOrderStage = function(id) {
  const o = APP_DATA.orders.find(x => x.id === id);
  if(!o) return;
  if(o.stage === 'Оплачен') o.stage = 'Сдан';
  else if(o.stage === 'Сдан') o.stage = 'В работе';
  else if(o.stage === 'В работе') o.stage = 'Новый';
  addLog(`CRM: Заказ клиента ${o.client} возвращен на этап "${o.stage}"`);
  render();
};

window.addOrder = function() {
  const catOptions = (APP_DATA.settings?.workerCategories || []).map(c => `<option value="${c}">${c}</option>`).join('');
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="user"></i> Клиент (Название или ФИО)</label>
      <input id="modClient" placeholder="ООО Весна / Александр" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="banknote"></i> Сумма заказа (сом)</label>
      <input id="modSum" type="number" placeholder="50000" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="calendar"></i> Дедлайн / Дата сдачи</label>
      <input id="modDate" type="date" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="folder"></i> Ответственная группа работников</label>
      <select id="modOrderCat">
        <option value="">Без категории</option>
        ${catOptions}
      </select>
    </div>
  `;
  window.openModal('Новый Лид / Заказ', formHtml, () => {
    const pId = 'ORD-' + Math.floor(Math.random()*10000);
    APP_DATA.orders.push({
      id: pId,
      client: document.getElementById('modClient').value,
      sum: parseInt(document.getElementById('modSum').value) || 0,
      date: document.getElementById('modDate').value,
      workerCategory: document.getElementById('modOrderCat').value,
      stage: 'Новый'
    });
    addLog(`CRM: Создан новый лид/заказ ${pId}`);
    saveDB();
    window.closeModal();
    render();
  });
};

window.clientCreateOrder = function() {
  const formHtml = `
    <div class="input-block">
      <label>Что вам нужно? (Услуга или товар)</label>
      <input id="modClientObj" placeholder="Например: Заливка фундамента" required>
    </div>
    <div class="input-block">
      <label>Желаемая дата (Дедлайн)</label>
      <input id="modDate" type="date" required>
    </div>
  `;
  window.openModal('Оставить заявку на расчет', formHtml, () => {
    const pId = 'ORD-' + Math.floor(Math.random()*10000);
    const objText = document.getElementById('modClientObj').value;
    APP_DATA.orders.push({
      id: pId,
      client: STATE.user.name + ` (${objText})`,
      sum: 0,
      date: document.getElementById('modDate').value,
      stage: 'Новый'
    });
    addLog(`Клиент: ${STATE.user.name} оставил новую заявку "${objText}"`);
    
    // Notify Admin via Telegram
    sendTelegramNotification(`🔔 <b>Новая заявка от клиента!</b>\nКлиент: ${STATE.user.name}\nЗапрос: ${objText}\nДата: ${document.getElementById('modDate').value}`);
    saveDB();
    window.closeModal();
  });
};

window.editOrderSum = function(id) {
  const o = APP_DATA.orders.find(x => x.id === id);
  if(!o) return;
  const newSumStr = prompt(`Укажите новую сумму для заказа ${id} (COM):`, o.sum);
  if(newSumStr !== null) {
      const newSum = parseInt(newSumStr.replace(/\D/g, ''));
      if(!isNaN(newSum)) {
         o.sum = newSum;
         addLog(`CRM: Изменена сумма заказа ${o.id}`);
         saveDB();
         render();
      }
  }
};

window.printInvoice = function(id) {
  const o = APP_DATA.orders.find(x => x.id === id);
  if(!o) return;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html>
      <head>
        <title>Смета / Акт: ${o.id}</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .meta { font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #f5f5f5; }
          .total { font-size: 20px; font-weight: bold; text-align: right; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; }
          .signature { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ООО "СтройДом" - Официальная Смета / Акт работ</div>
          <div class="meta">Заказ: <b>${o.id}</b> | Дата создания: ${new Date().toLocaleDateString()}</div>
        </div>
        <p><b>Заказчик:</b> ${o.client}</p>
        <p><b>Ожидаемая дата сдачи:</b> ${o.date || 'Не указана'}</p>
        <p><b>Текущий этап:</b> ${o.stage}</p>
        
        <table>
          <tr><th>Наименование работ / услуг</th><th>Стоимость</th></tr>
          <tr><td>Выполнение работ и предоставление услуг по заказу ${o.id} согласно договоренностям с ${o.client.split('(')[1] ? o.client.split('(')[1].replace(')', '') : 'клиентом'}</td><td>${o.sum.toLocaleString()} сом</td></tr>
        </table>
        
        <div class="total">ИТОГО К ОПЛАТЕ: ${o.sum.toLocaleString()} сом</div>
        
        <div class="footer">
          <div class="signature">Подпись Исполнителя / Директора<br>(М.П.)</div>
          <div class="signature">Подпись Заказчика</div>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWin.document.close();
};

// REQUESTS CRUD
window.createRequest = function() {
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="box"></i> Наименование материала</label>
      <input id="reqItem" placeholder="Песок сеяный / Арматура 12мм" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="hash"></i> Требуемое количество</label>
      <input id="reqQty" type="number" value="1" min="1" required>
    </div>
  `;
  window.openModal('Оставить заявку в снабжение', formHtml, () => {
    const itemName = document.getElementById('reqItem').value;
    APP_DATA.requests.unshift({
      id: Math.floor(Math.random()*10000),
      empName: STATE.user.name,
      itemName: itemName,
      qty: parseInt(document.getElementById('reqQty').value),
      status: 'Ожидает'
    });
    addLog(`Логистика: Создал заявку на "${itemName}" (ожидает одобрения)`);
    window.closeModal();
  });
};

window.approveRequest = function(id) {
  const req = APP_DATA.requests.find(r => r.id === id);
  if(req) {
    req.status = 'Одобрено';
    addLog(`Склад: Одобрил заявку №${id} для ${req.empName}`);
    // Extract employee id to notify
    const emp = APP_DATA.users.find(u => u.name === req.empName);
    if(emp) {
       sendNotification(emp.id, `СНАБЖЕНИЕ: Ваша заявка "${req.itemName}" (${req.qty} шт.) успешно одобрена.`);
       if (emp.tg) sendTelegramNotification(`✅ <b>Склад одобрил:</b>\nКому: ${emp.tg}\nТовар: ${req.itemName} (${req.qty} шт.)\n📝 <i>Можете подойти и получить.</i>`);
    }
  }
  render();
};

window.rejectRequest = function(id) {
  const req = APP_DATA.requests.find(r => r.id === id);
  if(req) {
    req.status = 'Отклонено';
    addLog(`Склад: Отклонил заявку №${id} от ${req.empName}`);
    const emp = APP_DATA.users.find(u => u.name === req.empName);
    if(emp) sendNotification(emp.id, `ОТКАЗ: Заявка "${req.itemName}" отклонена Администратором.`);
  }
  render();
};

window.archiveRequest = function(id) {
  const req = APP_DATA.requests.find(r => r.id === id);
  if(req) {
    req.prevStatus = req.status;
    req.status = 'Архивировано';
    saveDB();
    addLog(`Архив: Убрал складскую заявку "${req.itemName}" в историю`);
    render();
  }
};

window.deleteRequest = function(id) {
  const req = APP_DATA.requests.find(r => r.id === id);
  if(req && confirm('Безвозвратно удалить заявку из истории?')) {
    APP_DATA.requests = APP_DATA.requests.filter(r => r.id !== id);
    saveDB();
    addLog(`Логистика: Полностью удалил заявку "${req.itemName}"`);
    render();
  }
};

// PLANS CRUD
window.changePlanStatus = function(id, newStatus) {
  const p = APP_DATA.plans.find(x => String(x.id) === String(id));
  if(p) {
    p.status = newStatus;
    if (newStatus === 'in_progress') addLog(`Задачи: Взял в работу объект "${p.title}"`);
    if (newStatus === 'done') addLog(`Задачи: Успешно завершил "${p.title}"`);
    saveDB();
    render();
  }
};

window.openTaskComments = function(id) {
  const p = APP_DATA.plans.find(x => String(x.id) === String(id));
  if(!p) return;
  if(!p.comments) p.comments = [];
  
  const getCommentsHtml = () => `
    <div id="commentsWrapper" style="max-height:45vh; overflow-y:auto; margin-bottom:20px; padding-right:10px; display:flex; flex-direction:column; gap:16px;">
      ${p.comments.map(c => `
      <div class="glass-panel" style="padding:16px; background:var(--bg-main); border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="color:var(--primary); font-size:13px; display:flex; align-items:center; gap:6px;"><i data-lucide="user" style="width:12px;height:12px;"></i> ${c.author}</strong>
          <span style="font-size:11px; color:var(--text-dim); font-weight:600;">${c.time}</span>
        </div>
        <div style="font-size:14px; color:var(--text-main); line-height:1.5;">${c.text}</div>
      </div>
      `).join('') || '<div style="color:var(--text-dim); text-align:center; padding:32px; border:1px dashed var(--border); border-radius:12px;">Комментариев пока нет. Будьте первыми!</div>'}
    </div>
    <div class="input-block" style="margin-top:20px; padding-top:20px; border-top: 1px solid var(--border);">
      <label><i data-lucide="message-square"></i> Написать сообщение</label>
      <textarea id="newCommentText" rows="3" placeholder="Введите ваш комментарий..." style="width:100%; font-family:inherit;"></textarea>
    </div>
  `;

  window.openModal('Обсуждение задачи', getCommentsHtml(), () => {
    const textEl = document.getElementById('newCommentText');
    const text = textEl.value.trim();
    if(text) {
      p.comments.push({
         author: STATE.user.name + (STATE.user.role==='admin' ? ' 👑' : ''),
         text: text,
         time: new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})
      });
      addLog(`Комментарии: ${STATE.user.name} добавил сообщение в задачу "${p.title}"`);
      saveDB();
      // Re-open same modal to show new message
      openTaskComments(id);
    } else {
      window.closeModal();
    }
  });
};

window.deletePlan = function(id) {
  const plan = APP_DATA.plans.find(p => String(p.id) === String(id));
  if (plan) {
    window.openModal('Подтверждение удаления', `<p style="margin-bottom:16px;">Вы действительно хотите безвозвратно удалить задачу: <br/><br/><b>"${plan.title}"</b>?</p>`, () => {
      APP_DATA.plans = APP_DATA.plans.filter(p => String(p.id) !== String(id));
      saveDB();
      addLog(`Планы: Удалил задачу "${plan.title}"`);
      window.closeModal();
    });
  }
};

window.addPlan = function() {
  const empOptions = APP_DATA.users.filter(u => u.role === 'employee').map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="user-check"></i> Исполнитель</label>
      <select id="modEmpId" required>${empOptions}</select>
    </div>
    <div class="input-block">
      <label><i data-lucide="file-text"></i> Суть задачи</label>
      <input id="modTitle" placeholder="Залить фундамент на объекте X" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="calendar"></i> Срок сдачи</label>
      <input id="modDate" type="date" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="alert-triangle"></i> Приоритет</label>
      <select id="modUrgency" required>
        <option value="routine">Обычная (Плановая)</option>
        <option value="urgent">СРОЧНО!</option>
      </select>
    </div>
  `;
  window.openModal('Назначить новую задачу', formHtml, () => {
    const title = document.getElementById('modTitle').value;
    const empId = parseInt(document.getElementById('modEmpId').value);
    APP_DATA.plans.push({
      id: Math.floor(Math.random()*10000),
      empId: empId,
      title: title,
      date: document.getElementById('modDate').value,
      urgency: document.getElementById('modUrgency').value,
      status: 'open'
    });
    addLog(`Планы: Назначил новую задачу "${title}"`);
    sendNotification(empId, `Вам назначена новая задача: "${title}"`);
    const empName = APP_DATA.users.find(u => u.id === empId)?.name || 'Сотрудник';
    sendTelegramNotification(`🆕 <b>Новая задача!</b>\n📝: ${title}\n👤: ${empName}\n📅: ${document.getElementById('modDate').value}\n⚡: ${document.getElementById('modUrgency').options[document.getElementById('modUrgency').selectedIndex].text}`);
    window.closeModal();
  });
};

window.printInvoice = function(id) {
  const order = APP_DATA.orders.find(o => String(o.id) === String(id));
  if (!order) return;

  const invoiceHtml = `
    <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #000; background: #fff;">
      <div style="display:flex; justify-content:space-between; margin-bottom:40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
        <div>
          <h1 style="margin:0; font-size: 28px; color: #1e1e1e;">СтройКомплект ERP</h1>
          <p style="margin:4px 0 0; color: #555;">Официальный счет на оплату</p>
        </div>
        <div style="text-align:right;">
          <h2 style="margin:0; font-size: 24px; color: #4f46e5;">СЧЕТ #${order.id}</h2>
          <p style="margin:4px 0 0; color: #555;">От: ${order.date}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 40px;">
        <h3 style="margin:0 0 8px; color: #555; text-transform:uppercase; font-size:12px;">Заказчик:</h3>
        <p style="margin:0; font-size:18px; font-weight:700;">${escapeHtml(order.client)}</p>
      </div>

      <table style="width:100%; border-collapse: collapse; margin-bottom: 40px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 12px; text-align:left; border: 1px solid #e2e8f0;">Описание услуг / товаров</th>
            <th style="padding: 12px; text-align:right; border: 1px solid #e2e8f0;">Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border: 1px solid #e2e8f0;">Комплексные работы по договору (${escapeHtml(order.client)})</td>
            <td style="padding: 12px; text-align:right; border: 1px solid #e2e8f0; font-weight:600;">${order.sum.toLocaleString()} сом</td>
          </tr>
        </tbody>
      </table>

      <div style="display:flex; justify-content:space-between; margin-top:40px;">
        <div style="width:40%;">
           <div style="border-bottom:1px solid #000; margin-top:40px;"></div>
           <p style="font-size:12px; color:#555; margin-top:4px;">Подпись руководителя</p>
        </div>
        <div style="width: 300px;">
          <div style="display:flex; justify-content:space-between; padding: 12px 0; border-top: 2px solid #000;">
            <strong style="font-size:18px;">ИТОГО К ОПЛАТЕ:</strong>
            <strong style="font-size:18px; color:#10b981;">${order.sum.toLocaleString()} сом</strong>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 80px; text-align:center; color:#94a3b8; font-size:12px;">
        Документ сгенерирован автоматически системой СтройКомплект ERP
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = invoiceHtml;
  
  if (window.html2pdf) {
    html2pdf().set({
      margin: 10,
      filename: `Invoice_${order.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save();
    addLog(`CRM: Сгенерировал PDF счет для ${order.id}`);
  } else {
    alert("Библиотека генерации PDF не загружена. Проверьте интернет-соединение.");
  }
};

window.showPlanMap = function() {
  const mapHtml = `
    <div id="tasksMap" style="width: 100%; height: 60vh; border-radius: 12px; background: #eee; z-index: 10;"></div>
    <div style="margin-top: 12px; font-size: 13px; color: var(--text-dim);">
      * Координаты объектов генерируются на основе адреса. Нажмите на геометку для просмотра деталей.
    </div>
  `;
  
  window.openModal('Карта активности (Объекты)', mapHtml, null);
  
  // Wait for modal to render in DOM
  setTimeout(() => {
    if (!window.L) {
      alert("Карты еще загружаются, попробуйте через пару секунд.");
      return;
    }
    
    // Fallback if modal was closed before timeout
    const mapEl = document.getElementById('tasksMap');
    if (!mapEl) return;

    // Initialize map centered at Bishkek
    const map = L.map('tasksMap').setView([42.8746, 74.5698], 12); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap ERP'
    }).addTo(map);
    
    // Setup Icon to avoid missing image paths
    const iconBase = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28]
    });

    const isAdmin = STATE.user.role === 'admin';
    let basePlans = isAdmin ? APP_DATA.plans : APP_DATA.plans.filter(p => p.empId === STATE.user.id);
    
    // Only show active tasks on the map
    basePlans = basePlans.filter(p => p.status !== 'archived');
    
    // Add markers for tasks
    basePlans.forEach((p, idx) => {
      // Mock coordinates slightly offset around Bishkek center for demonstration
      // Using predictable offsets based on ID to keep markers stable
      const offsetLat = Math.sin(p.id * 10) * 0.05;
      const offsetLng = Math.cos(p.id * 10) * 0.05;
      const lat = 42.8746 + offsetLat;
      const lng = 74.5698 + offsetLng;
      
      const emp = APP_DATA.users.find(u => u.id == p.empId);
      const empName = emp ? escapeHtml(emp.name) : 'Неизвестный';
      
      const colorMap = {
        'open': '#f59e0b',
        'in_progress': '#6366f1',
        'done': '#10b981'
      };
      const textMap = {
        'open': 'Ожидает выполнения',
        'in_progress': 'В работе',
        'done': 'Выполнено'
      };

      const popupHtml = `
        <div style="font-family:'Outfit','Inter',sans-serif; min-width: 200px;">
          <b style="font-size:15px; color:#1e1e1e;">${escapeHtml(p.title)}</b><br>
          <div style="margin-top:8px; color:#555; font-size:13px;">👷 Исполнитель: <b>${empName}</b></div>
          <div style="margin-top:4px; color:${colorMap[p.status]}; font-size:13px; font-weight:800;">
            ${textMap[p.status]}
          </div>
          ${p.urgency === 'urgent' ? '<div style="margin-top:4px; color:#dc2626; font-weight:800; font-size:11px; text-transform:uppercase;">Срочный выезд!</div>' : ''}
        </div>
      `;
      L.marker([lat, lng], {icon: iconBase}).addTo(map).bindPopup(popupHtml);
    });
    
  }, 150);
};

window.editPlan = function(id) {
  const plan = APP_DATA.plans.find(p => String(p.id) === String(id));
  if (!plan) return;

  const empOptions = APP_DATA.users.filter(u => u.role === 'employee').map(u => `<option value="${u.id}" ${u.id === plan.empId ? 'selected' : ''}>${u.name}</option>`).join('');
  
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="user-check"></i> Исполнитель</label>
      <select id="modEmpId" required>${empOptions}</select>
    </div>
    <div class="input-block">
      <label><i data-lucide="file-text"></i> Описание задачи</label>
      <input id="modTitle" value="${plan.title}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="calendar"></i> Срок сдачи</label>
      <input id="modDate" type="date" value="${plan.date || ''}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="alert-triangle"></i> Уровень срочности</label>
      <select id="modUrgency" required>
        <option value="routine" ${plan.urgency === 'routine' ? 'selected' : ''}>Обычная (Плановая)</option>
        <option value="urgent" ${plan.urgency === 'urgent' ? 'selected' : ''}>СРОЧНО!</option>
      </select>
    </div>
  `;
  window.openModal('Редактировать задачу', formHtml, () => {
    plan.empId = parseInt(document.getElementById('modEmpId').value);
    plan.title = document.getElementById('modTitle').value;
    plan.date = document.getElementById('modDate').value;
    plan.urgency = document.getElementById('modUrgency').value;
    addLog(`Планы: Изменил задачу "${plan.title}"`);
    window.closeModal();
  });
};

// INVENTORY CRUD
window.deleteInventory = function(id) {
  const item = APP_DATA.inventory.find(i => i.id === id);
  if (item && confirm('Удалить этот строительный материал из базы?')) {
    APP_DATA.inventory = APP_DATA.inventory.filter(i => i.id !== id);
    addLog(`Склад: Списал/удалил материал "${item.name}"`);
    render();
  }
};

window.addInventory = function() {
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="layers"></i> Категория</label>
      <select id="modCat" required>
        <option value="Материалы">Строительные Материалы</option>
        <option value="Оборудование">Оборудование / Станки</option>
        <option value="Инструмент">Электроинструмент / Ручной</option>
        <option value="Расходники">Расходники / Крепеж</option>
        <option value="Спецодежда">Спецодежда</option>
      </select>
    </div>
    <div class="input-block">
      <label><i data-lucide="tag"></i> Наименование</label>
      <input id="modName" placeholder="Брус 100x100" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="archive"></i> Остаток на складе</label>
      <input id="modStock" type="number" placeholder="0" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="dollar-sign"></i> Закупочная цена (сом)</label>
      <input id="modPrice" type="number" placeholder="500" required>
    </div>
  `;
  window.openModal('Поступление на склад', formHtml, () => {
    const name = document.getElementById('modName').value;
    const stock = parseInt(document.getElementById('modStock').value);
    APP_DATA.inventory.push({
      id: Math.floor(Math.random()*10000),
      category: document.getElementById('modCat').value,
      name: name,
      stock: stock,
      price: parseInt(document.getElementById('modPrice').value),
      history: [{ date: new Date().toLocaleString(), user: STATE.user.name, action: 'Начальный ввод', qty: stock }]
    });
    addLog(`Склад: Добавил новую номенклатуру "${name}"`);
    saveDB();
    window.closeModal();
  });
};

window.editInventory = function(id) {
  const item = APP_DATA.inventory.find(i => i.id === id);
  if (!item) return;

  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="layers"></i> Категория</label>
      <select id="modCat" required>
        <option value="Материалы" ${item.category === 'Материалы' ? 'selected' : ''}>Строительные Материалы</option>
        <option value="Оборудование" ${item.category === 'Оборудование' ? 'selected' : ''}>Оборудование / Станки</option>
        <option value="Инструмент" ${item.category === 'Инструмент' ? 'selected' : ''}>Электроинструмент / Ручной</option>
        <option value="Расходники" ${item.category === 'Расходники' ? 'selected' : ''}>Расходники / Крепеж</option>
        <option value="Спецодежда" ${item.category === 'Спецодежда' ? 'selected' : ''}>Спецодежда</option>
      </select>
    </div>
    <div class="input-block">
      <label><i data-lucide="tag"></i> Наименование материала</label>
      <input id="modName" value="${item.name}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="archive"></i> Остаток</label>
      <input id="modStock" type="number" value="${item.stock}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="dollar-sign"></i> Закупочная цена (сом)</label>
      <input id="modPrice" type="number" value="${item.price}" required>
    </div>
  `;
  window.openModal('Карточка материала', formHtml, () => {
    const oldStock = item.stock;
    item.category = document.getElementById('modCat').value;
    item.name = document.getElementById('modName').value;
    item.stock = parseInt(document.getElementById('modStock').value);
    item.price = parseInt(document.getElementById('modPrice').value);
    
    if (oldStock !== item.stock) {
      if(!item.history) item.history = [];
      const diff = item.stock - oldStock;
      item.history.unshift({ 
        date: new Date().toLocaleString(), 
        user: STATE.user.name, 
        action: diff > 0 ? 'Пополнение' : 'Списание', 
        qty: Math.abs(diff) 
      });
      addLog(`Склад: Изменил остатки "${item.name}" (${oldStock} -> ${item.stock})`);
    } else {
      addLog(`Склад: Обновил карточку материала "${item.name}"`);
    }
    saveDB();
    window.closeModal();
  });
};

window.viewInventoryDetails = function(id) {
  const item = APP_DATA.inventory.find(i => i.id === id);
  if(!item) return;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ERP_ITEM_${item.id}`;
  
  const historyHtml = (item.history || []).map(h => `
    <div style="font-size:12px; padding:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
      <span>${h.date} - <b>${h.action}</b> (${h.qty} шт.)</span>
      <span style="color:var(--text-muted)">${h.user}</span>
    </div>
  `).join('') || '<div style="padding:10px; color:var(--text-muted)">История пуста</div>';

  const html = `
    <div style="display:flex; gap:24px; align-items:flex-start;">
      <div class="glass-panel" style="padding:16px; background:white; text-align:center; border:none; shrink:0;">
        <img src="${qrUrl}" style="width:140px; height:140px; display:block;">
        <div style="font-size:10px; color:#333; font-weight:800; margin-top:8px;">ID: ${item.id}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; margin-bottom:4px;">${item.category}</div>
        <h3 style="margin:0 0 12px 0; font-size:20px;">${item.name}</h3>
        <span class="badge ${item.stock <= 5 ? 'badge-danger' : 'badge-info'}" style="font-size:14px; padding:6px 14px;">${item.stock} шт. в остатке</span>
        
        <div style="margin-top:24px;">
          <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-bottom:12px; display:flex; align-items:center; gap:8px;"><i data-lucide="history"></i> История перемещений</div>
          <div style="max-height:220px; overflow-y:auto; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,0.1);">
            ${historyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  window.openModal('Детали позиции', html, null);
};

window.addExpense = function() {
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="layers"></i> Категория расхода</label>
      <select id="expCat">
        <option value="Зарплата">Зарплата / Выплаты</option>
        <option value="Материалы">Закупка стройматериалов</option>
        <option value="Аренда">Аренда / Коммуналка</option>
        <option value="Налоги">Налоги / Сборы</option>
        <option value="Другое">Прочее / Накладные</option>
      </select>
    </div>
    <div class="input-block">
      <label><i data-lucide="banknote"></i> Сумма (сом)</label>
      <input id="expSum" type="number" placeholder="0" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="message-square"></i> Комментарий</label>
      <input id="expComment" placeholder="Оплата аренды склада за март" required>
    </div>
  `;
  window.openModal('Зафиксировать расход (Касса)', formHtml, () => {
     const sum = parseInt(document.getElementById('expSum').value) || 0;
     APP_DATA.expenses.unshift({
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        category: document.getElementById('expCat').value,
        sum: sum,
        comment: document.getElementById('expComment').value,
        user: STATE.user.name
     });
     addLog(`Финансы: Расход -${sum} сом (${document.getElementById('expCat').value})`);
     window.closeModal();
     saveDB();
     render();
  });
};

window.generateAIReport = function() {
  showLoading('Искусственный интеллект анализирует данные...');
  
  setTimeout(() => {
    hideLoading();
    const rev = APP_DATA.orders.reduce((s, o) => s + (o.sum || 0), 0);
    const exp = (APP_DATA.expenses || []).reduce((s, e) => s + (e.sum || 0), 0);
    const profit = rev - exp;
    const lowItems = APP_DATA.inventory.filter(i => i.stock <= 5).length;
    
    let advice = "";
    if (profit > 0) advice = "✅ Бизнес в плюсе. Рекомендую инвестировать в закупку ходовых материалов.";
    else advice = "⚠️ Расходы превышают доходы. Нужно сократить издержки или повысить цены.";
    if (lowItems > 0) advice += `\n⚠️ Внимание: у вас ${lowItems} позиций на складе почти закончились!`;

    const reportHtml = `
      <div style="background: linear-gradient(135deg, rgba(110, 69, 226, 0.1) 0%, rgba(136, 211, 206, 0.1) 100%); padding: 25px; border-radius: 12px; border: 1px solid var(--primary); box-shadow: var(--shadow);">
        <h3 style="margin-top:0; color:var(--primary); display:flex; align-items:center; gap:10px;">
          <i data-lucide="sparkles"></i> AI Аналитика Бизнеса
        </h3>
        <p style="font-size:15px; line-height:1.6; color:var(--text-main);">
          Отчет на: <b>${new Date().toLocaleDateString()}</b>
          <br/><br/>
          💰 <b>Чистая Прибыль:</b> <span style="color:var(--success); font-weight:800;">${profit.toLocaleString()} сом</span>
          <br/><br/>
          💡 <b>Совет от ИИ:</b> ${advice}
        </p>
      </div>
    `;
    window.openModal('AI Бизнес-Аналитика', reportHtml, null);
    if(window.lucide) lucide.createIcons();
  }, 1200);
};

// CATEGORY MANAGEMENT
window.addWorkerCategory = function() {
  const formHtml = `
    <div class="input-block">
      <label>Название новой группы</label>
      <input id="newCatName" placeholder="например: Плотники" required>
    </div>
  `;
  window.openModal('Добавить группу работников', formHtml, () => {
    const name = document.getElementById('newCatName').value;
    if (name && name.trim()) {
      if (!APP_DATA.settings.workerCategories) APP_DATA.settings.workerCategories = [];
      if (APP_DATA.settings.workerCategories.includes(name.trim())) return alert("Такая группа уже есть.");
      APP_DATA.settings.workerCategories.push(name.trim());
      addLog(`Настройки: Добавлена новая группа работников "${name.trim()}"`);
      saveDB();
      window.closeModal();
      render();
    }
  });
};

window.deleteWorkerCategory = function(name) {
  if (confirm(`Удалить группу "${name}"? Пользователи в этой группе останутся, но без привязки.`)) {
    APP_DATA.settings.workerCategories = APP_DATA.settings.workerCategories.filter(c => c !== name);
    addLog(`Настройки: Удалена группа работников "${name}"`);
    saveDB();
    render();
  }
};

// USER CRUD
window.addUser = function() {
  const catOptions = (APP_DATA.settings?.workerCategories || []).map(c => `<option value="${c}">${c}</option>`).join('');
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="user"></i> Имя / Специализация</label>
      <input id="modUName" placeholder="Артем (Бригадир)" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="send"></i> Telegram @логин</label>
      <input id="modUTG" placeholder="@username">
    </div>
    <div class="input-block">
      <label><i data-lucide="shield"></i> Логин доступа</label>
      <input id="modULogin" placeholder="artem_erp" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="key"></i> Пароль</label>
      <input id="modUPassword" type="password" placeholder="••••••••" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="briefcase"></i> Права доступа</label>
      <select id="modURole" required>
        <option value="employee">Сотрудник</option>
        <option value="client">Клиент</option>
      </select>
    </div>
    <div class="input-block" id="catBlock">
      <label><i data-lucide="folder"></i> Группа работников (для сотрудников)</label>
      <select id="modUCategory">
        <option value="">Без категории</option>
        ${catOptions}
      </select>
    </div>
  `;
  window.openModal('Регистрация в ERP', formHtml, () => {
    const username = document.getElementById('modUName').value;
    APP_DATA.users.push({
      id: Math.floor(Math.random()*10000),
      name: username,
      tg: document.getElementById('modUTG').value,
      login: document.getElementById('modULogin').value,
      password: document.getElementById('modUPassword').value,
      role: document.getElementById('modURole').value,
      category: document.getElementById('modUCategory').value
    });
    addLog(`Безопасность: Зарегистрировал пользователя "${username}"`);
    saveDB();
    window.closeModal();
  });
};
window.editUser = function(id) {
  const user = APP_DATA.users.find(u => u.id === id);
  if(!user) return;
  const catOptions = (APP_DATA.settings?.workerCategories || []).map(c => `<option value="${c}" ${user.category === c ? 'selected' : ''}>${c}</option>`).join('');
  const formHtml = `
    <div class="input-block">
      <label><i data-lucide="user"></i> Имя / Специализация</label>
      <input id="modUName" value="${user.name}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="send"></i> Telegram @логин</label>
      <input id="modUTG" value="${user.tg || ''}" placeholder="@username">
    </div>
    <div class="input-block">
      <label><i data-lucide="shield"></i> Логин доступа</label>
      <input id="modULogin" value="${user.login}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="key"></i> Пароль</label>
      <input id="modUPassword" value="${user.password}" required>
    </div>
    <div class="input-block">
      <label><i data-lucide="briefcase"></i> Права доступа</label>
      <select id="modURole" required disabled>
        <option value="${user.role}">${user.role === 'client' ? 'Клиент' : (user.role === 'admin' ? 'Администратор' : 'Сотрудник')}</option>
      </select>
    </div>
    <div class="input-block">
      <label><i data-lucide="folder"></i> Группа работников</label>
      <select id="modUCategory">
        <option value="">Без категории</option>
        ${catOptions}
      </select>
    </div>
  `;
  window.openModal('Настройки доступа', formHtml, () => {
    user.name = document.getElementById('modUName').value;
    user.tg = document.getElementById('modUTG').value;
    user.login = document.getElementById('modULogin').value;
    user.password = document.getElementById('modUPassword').value;
    user.category = document.getElementById('modUCategory').value;
    addLog(`Безопасность: Изменил данные пользователя "${user.name}"`);
    saveDB();
    window.closeModal();
  });
};

window.deleteUser = function(id) {
  const user = APP_DATA.users.find(u => u.id === id);
  if (user && confirm('Отозвать доступ и удалить пользователя ERP?')) {
    APP_DATA.users = APP_DATA.users.filter(u => u.id !== id);
    APP_DATA.plans = APP_DATA.plans.filter(p => p.empId !== id);
    addLog(`Безопасность: Удалил аккаунт "${user.name}"`);
    saveDB();
    render();
  }
};


// ---------------- QR SCANNER ---------------- //
let scanner = null;
window.startQRScanner = function() {
  const html = `
    <div id="reader" style="width: 100%; min-height: 300px; border-radius: 8px; overflow: hidden; background: #000;"></div>
    <div id="qr-result" style="margin-top: 10px; color: var(--primary); font-weight: 600; text-align: center;"></div>
  `;
  window.openModal('Сканировать QR-код товара', html, null);
  
  setTimeout(() => {
    scanner = new Html5Qrcode("reader");
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        if (decodedText.startsWith("ERP_ITEM_")) {
          const id = parseInt(decodedText.replace("ERP_ITEM_", ""));
          scanner.stop();
          window.closeModal();
          viewInventoryDetails(id);
        } else {
          document.getElementById('qr-result').innerText = "Неизвестный код: " + decodedText;
        }
      },
      (errorMessage) => { /* ignore console noise */ }
    ).catch(err => {
      document.getElementById('reader').innerHTML = `<div style="padding:20px; color:var(--danger)">Ошибка камеры: ${err}</div>`;
    });
  }, 100);
};

// ---------------- EVENTS ---------------- //

function attachLoginEvents() {
  const roleSelector = document.getElementById('roleSelector');
  let selectedRole = 'employee';
  
  if(roleSelector) {
    roleSelector.addEventListener('click', (e) => {
      if(e.target.classList.contains('role-btn')) {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedRole = e.target.dataset.role;
        
        const $user = document.getElementById('username');
        const $pass = document.getElementById('password');
        if (selectedRole === 'admin') {
          $user.value = 'bro@stroydom.kg';
          $pass.value = '142536';
        } else if (selectedRole === 'employee') {
          $user.value = 'alex';
          $pass.value = '123';
        } else {
          $user.value = 'peter';
          $pass.value = '123';
        }
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginInput = document.getElementById('username').value.trim();
      const passwordInput = document.getElementById('password').value;
      const errorLabel = document.getElementById('loginError');
      
      errorLabel.style.display = 'none';

      // Transform login to email (Firebase format)
      const inputStr = loginInput.toLowerCase().trim();
      const email = inputStr.includes('@') ? inputStr : `${inputStr}@stroydom.kg`;
      console.log("Попытка входа через Firebase:", email);

      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, passwordInput);
        const fbUser = userCredential.user;
        
        // Find user in our database matching email or login part
        const fbEmail = fbUser.email.toLowerCase();
        const fbPrefix = fbEmail.split('@')[0];
        
        const validUser = APP_DATA.users.find(u => {
          const uLogin = u.login.toLowerCase();
          const uEmail = (u.email || "").toLowerCase();
          return uEmail === fbEmail || uLogin === fbEmail || uLogin === fbPrefix;
        });

        if (!validUser) {
          errorLabel.innerText = "Пользователь аутентифицирован, но не найден в базе ERP!";
          errorLabel.style.display = 'block';
          return;
        }

        STATE.user = validUser;
        updateView(validUser.role === 'admin' || validUser.role === 'employee' ? 'employee_plans' : 'client_orders');
        addLog(`Авторизовался через Firebase (Безопасный вход)`);

      } catch (error) {
        console.error("Auth Error:", error);
        errorLabel.innerText = "Ошибка входа: " + (error.code === 'auth/user-not-found' ? 'Пользователь не найден' : 'Неверный логин или пароль');
        errorLabel.style.display = 'block';
      }
    });
  }
}

function attachDashboardEvents() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      if (view) {
        updateView(view);
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
          const sb = document.getElementById('sidebar');
          const ov = document.getElementById('sidebarOverlay');
          if(sb) sb.classList.remove('active');
          if(ov) ov.classList.remove('active');
        }
      }
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      addLog(`Вышел из системы`);
      await auth.signOut();
      STATE.user = null;
      updateView('login');
    });
  }
}

document.addEventListener('submit', (e) => {
  if (e.target.id === 'modalForm') {
    e.preventDefault();
    if (MODAL.onSubmit) MODAL.onSubmit(e);
  }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  if (!dailyReportTimer) {
     dailyReportTimer = setInterval(() => runDailyReport(), 60000);
  }
});
window.sendChatMessage = async function() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const newMessage = {
    id: Date.now(),
    senderId: STATE.user.id,
    senderName: STATE.user.name,
    role: STATE.user.role === 'admin' ? 'Админ' : 'Сотрудник',
    text: text,
    time: timeStr
  };

  if(!APP_DATA.chatMessages) APP_DATA.chatMessages = [];
  APP_DATA.chatMessages.push(newMessage);
  // Keep last 100 messages
  if(APP_DATA.chatMessages.length > 100) APP_DATA.chatMessages.shift();

  input.value = '';
  
  // 1. Save to DB
  saveDB();
  
  // 2. Duplicate to Telegram
  const tgMsg = `💬 <b>Чат: Сообщение от ${STATE.user.name}</b>\n\n${text}\n\n<i>Отправлено из ERP системы</i>`;
  sendTelegramNotification(tgMsg);
  
  // 3. Render
  render();
};
window.saveTgSettings = function() {
  const chatId = document.getElementById('sysTgChatId').value;
  const repTime = document.getElementById('sysReportTime').value;
  if(!APP_DATA.settings) APP_DATA.settings = {};
  APP_DATA.settings.tgChatId = chatId;
  APP_DATA.settings.reportTime = repTime;
  addLog(`Настройки: Обновлены параметры уведомлений (Чат: ${chatId}, Время: ${repTime})`);
  saveDB();
  alert("Настройки связи и уведомлений сохранены!");
};

window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if(sb) sb.classList.toggle('active');
  if(overlay) overlay.classList.toggle('active');
};

// ---------------- PREMIUM: PDF GENERATION ---------------- //
window.printInvoice = function(orderId) {
  const o = APP_DATA.orders.find(x => x.id === orderId);
  if(!o) return alert("Заказ не найден");

  const element = document.createElement('div');
  element.style.padding = '40px';
  element.style.color = '#333';
  element.style.fontFamily = 'Arial, sans-serif';
  element.style.background = '#fff';
  
  element.innerHTML = `
    <div style="display:flex; justify-content:space-between; border-bottom:2px solid #eee; padding-bottom:20px; margin-bottom:40px;">
      <div>
        <h1 style="color:#6366f1; margin:0;">СТРОЙДОМ ERP</h1>
        <p style="color:#666; font-size:12px; margin-top:5px;">Система автоматизации строительного бизнеса</p>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0;">СЧЕТ-КВИТАНЦИЯ</h2>
        <p style="color:#666; font-size:14px;">№ ${o.id}</p>
        <p style="color:#666; font-size:12px;">Дата формирования: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>

    <div style="margin-bottom:40px;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px;">
        <div>
          <h4 style="margin-bottom:10px; color:#444;">ИСПОЛНИТЕЛЬ:</h4>
          <p style="font-size:14px; margin:2px 0;">ОсОО "СтройДом"</p>
          <p style="font-size:13px; color:#666;">Киргизия, г. Бишкек</p>
          <p style="font-size:13px; color:#666;">Тел: +996 (XXX) XX-XX-XX</p>
        </div>
        <div>
          <h4 style="margin-bottom:10px; color:#444;">ЗАКАЗЧИК:</h4>
          <p style="font-size:14px; margin:2px 0;">${escapeHtml(o.client)}</p>
          <p style="font-size:13px; color:#666;">Срок выполнения: ${o.date}</p>
        </div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
      <thead>
        <tr style="background:#f8fafc; border-bottom:1px solid #ddd;">
          <th style="padding:12px; text-align:left;">Наименование работ / услуг</th>
          <th style="padding:12px; text-align:right;">Кол-во</th>
          <th style="padding:12px; text-align:right;">Цена</th>
          <th style="padding:12px; text-align:right;">Итого</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:12px; border-bottom:1px solid #eee;">Оказание услуг по договору (Объект ${o.id})</td>
          <td style="padding:12px; border-bottom:1px solid #eee; text-align:right;">1.00</td>
          <td style="padding:12px; border-bottom:1px solid #eee; text-align:right;">${o.sum.toLocaleString()} сом</td>
          <td style="padding:12px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${o.sum.toLocaleString()} сом</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end;">
      <div style="width:250px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span>Скидка:</span>
          <span>0 сом</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:bold; font-size:18px; color:#6366f1; border-top:1px solid #eee; padding-top:10px;">
          <span>К ОПЛАТЕ:</span>
          <span>${o.sum.toLocaleString()} сом</span>
        </div>
      </div>
    </div>

    <div style="margin-top:100px; display:flex; justify-content:space-between;">
      <div style="border-top:1px solid #333; width:200px; padding-top:10px; font-size:12px; color:#666; text-align:center;">
        М.П. (Подпись Исполнителя)
      </div>
      <div style="border-top:1px solid #333; width:200px; padding-top:10px; font-size:12px; color:#666; text-align:center;">
        Подпись Заказчика
      </div>
    </div>
    
    <div style="margin-top:60px; text-align:center; color:#999; font-size:10px;">
      Документ сформирован автоматически в ERP системе СтройДом.<br>
      Благодарим за сотрудничество!
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Invoice_${o.id}_${o.client}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    addLog(`Документы: Сгенерирован и скачан PDF счет для заказа ${o.id}`);
  });
};

// ---------------- PREMIUM: MAPS (LEAFLET) ---------------- //
window.openTaskMap = function(taskId) {
  const p = APP_DATA.plans.find(x => x.id == taskId);
  if(!p) return;

  // Default coordinate if none exists
  if(!p.coords) p.coords = [42.8746, 74.5698]; // Bishkek center
  
  const mapHtml = `
    <div style="height:400px; border-radius:12px; overflow:hidden; border:1px solid var(--border);" id="leafletMap"></div>
    <p style="color:var(--text-muted); font-size:11px; margin-top:12px;">Вы можете передвинуть маркер для уточнения локации объекта.</p>
  `;

  openModal(`Локация объекта: ${p.title}`, mapHtml, () => {
    saveDB();
    closeModal();
    addLog(`Локация: Обновлены координаты для задачи "${p.title}"`);
  });

  // Init leaflet after modal renders
  setTimeout(() => {
    const map = L.map('leafletMap').setView(p.coords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker(p.coords, {draggable: true}).addTo(map);
    marker.on('dragend', function(event) {
      const position = marker.getLatLng();
      p.coords = [position.lat, position.lng];
    });
    
    // Fix map gray tiles issue in modals
    setTimeout(() => map.invalidateSize(), 500);
  }, 300);
};
