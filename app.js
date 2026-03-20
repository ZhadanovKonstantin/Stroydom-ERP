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
    { id: 'ORD-001', client: 'ООО Ромашка', stage: 'В работе', sum: 145000, date: '2026-03-10' },
    { id: 'ORD-002', client: 'ИП Иванов', stage: 'Сдан', sum: 32000, date: '2026-03-15' },
    { id: 'ORD-003', client: 'Tech Corp', stage: 'Новый', sum: 850000, date: '2026-03-18' },
    { id: 'ORD-004', client: 'СтройИнвест', stage: 'Оплачен', sum: 560000, date: '2026-02-28' }
  ],
  users: [
    { id: 1, name: 'Алексей (Монтажник)', login: 'alex', password: '123', role: 'employee' },
    { id: 2, name: 'Марина (Бухгалтер)', login: 'marina', password: '123', role: 'employee' },
    { id: 3, name: 'Игорь (Снабжение)', login: 'igor', password: '123', role: 'employee' },
    { id: 4, name: 'Елена (HR)', login: 'elena', password: '123', role: 'employee' },
    { id: 5, name: 'Дмитрий (Техник)', login: 'dmitry', password: '123', role: 'employee' },
    { id: 6, name: 'Петр (Клиент)', login: 'peter', password: '123', role: 'client' },
    { id: 7, name: 'Bro', login: 'bro@stroydom.kg', password: '142536', role: 'admin' }
  ],
  auditLog: [],
  notifications: [],
  expenses: [], // New Expense tracking
  settings: {
    tgToken: '8624915292:AAFO7x2HiqLSM-wb9r6RV3Cpt0kc0CdFK_M',
    tgChatId: '-5167131530',
    lastDailyReport: ''
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
let STATE = JSON.parse(localStorage.getItem(SESSION_KEY)) || { user: null, view: 'login' };
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

async function runDailyReport() {
  const today = new Date().toISOString().split('T')[0];
  if (APP_DATA.settings.lastDailyReport === today) return;

  let report = `☀️ <b>Утренняя сводка ERP: ${today}</b>\n\n`;
  let hasContent = false;

  // 1. Stock Section
  const lowStock = APP_DATA.inventory.filter(i => i.stock <= 5);
  if (lowStock.length > 0) {
    report += `📦 <b>КРИТИЧЕСКИЙ ОСТАТОК (<=5 шт):</b>\n`;
    lowStock.forEach(i => report += `• ${i.name}: <b>${i.stock} шт.</b>\n`);
    report += `\n`;
    hasContent = true;
  }

  // 2. Deadline Section
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const urgentPlans = APP_DATA.plans.filter(p => p.status !== 'done' && (p.date <= today || p.date === tomorrowStr));
  const urgentOrders = APP_DATA.orders.filter(o => o.stage !== 'Оплачен' && (o.date <= today || o.date === tomorrowStr));

  if (urgentPlans.length > 0 || urgentOrders.length > 0) {
    report += `⏳ <b>СРОЧНЫЕ ДЕДЛАЙНЫ (Сегодня/Завтра):</b>\n`;
    urgentPlans.forEach(p => report += `• Задача: "${p.title}" (${p.date || '!'})\n`);
    urgentOrders.forEach(o => report += `• Заказ: ${o.client} (${o.date || '!'})\n`);
    hasContent = true;
  }

  if (hasContent) {
    await sendTelegramNotification(report);
    APP_DATA.settings.lastDailyReport = today;
    saveDB();
  }
}

// Core Renderer
function render() {
  try {
    checkLowStock();
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    if (!STATE.user) {
      appContainer.innerHTML = renderLogin();
      attachLoginEvents();
    } else {
      appContainer.innerHTML = renderDashboard() + renderModal();
      attachDashboardEvents();
    }
    if (window.lucide) lucide.createIcons();
  } catch(err) {
    console.error('RENDER CRASH:', err);
    const appContainer = document.getElementById('app');
    if(appContainer) {
      appContainer.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:#111;display:flex;align-items:center;justify-content:center;z-index:9999;">
          <div style="background:#1e1e1e;border:2px solid #e74c3c;border-radius:12px;padding:30px;max-width:500px;text-align:center;">
            <h3 style="color:#e74c3c;margin-top:0;">⚠️ Ошибка интерфейса</h3>
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
      <div class="glass-panel login-box">
        <div class="login-header">
          <h1>СтройКомплект</h1>
          <p>Вход в систему ERP</p>
        </div>
        
        <div class="role-selector" id="roleSelector">
          <div class="role-btn active" data-role="employee">Сотрудник</div>
          <div class="role-btn" data-role="admin">Админ</div>
          <div class="role-btn" data-role="client">Клиент</div>
        </div>
        
        <form id="loginForm">
          <div class="input-block">
            <label>Имя пользователя (Логин)</label>
            <input type="text" id="username" placeholder="Например: alex" required>
          </div>
          <div class="input-block">
            <label>Пароль</label>
            <input type="password" id="password" placeholder="••••••••" value="123" required>
          </div>
          <button type="submit" class="btn" style="width: 100%; margin-top: 10px;">Войти</button>
          <div id="loginError" style="color:#ff7b72; font-size:13px; text-align:center; margin-top:12px; display:none;"></div>
        </form>
        
        <div style="margin-top:24px; font-size:12px; color:var(--text-muted); text-align:center; line-height: 1.5;">
           Логины сотрудников: alex, marina, igor, elena, dmitry<br/>
           Логин клиента: peter<br/>
           Пароль для всех: 123
        </div>
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
        <i data-lucide="check-square"></i> Задачи
      </div>
      <div class="nav-item ${STATE.view === 'employee_orders' ? 'active' : ''}" data-view="employee_orders">
        <i data-lucide="trello"></i> Заказы (CRM)
      </div>
      <div class="nav-item ${STATE.view === 'employee_inventory' ? 'active' : ''}" data-view="employee_inventory">
        <i data-lucide="package"></i> Склад
      </div>
      ${isAdmin ? `
      <div class="nav-item ${STATE.view === 'admin_tasks_history' ? 'active' : ''}" data-view="admin_tasks_history" style="margin-top:20px; border-top: 1px solid var(--border); border-radius: 0; padding-top:20px;">
        <i data-lucide="archive"></i> Архив задач
      </div>
      <div class="nav-item ${STATE.view === 'admin_requests_history' ? 'active' : ''}" data-view="admin_requests_history">
        <i data-lucide="inbox"></i> Архив склада
      </div>
      <div class="nav-item ${STATE.view === 'admin_finance' ? 'active' : ''}" data-view="admin_finance">
        <i data-lucide="calculator"></i> Финансы
      </div>
      <div class="nav-item ${STATE.view === 'admin_settings' ? 'active' : ''}" data-view="admin_settings">
        <i data-lucide="shield"></i> Учетные записи
      </div>
      <div class="nav-item ${STATE.view === 'admin_logs' ? 'active' : ''}" data-view="admin_logs">
        <i data-lucide="activity"></i> Журнал действий
      </div>` : ''}
    `;
  } else {
    navLinks = `
      <div class="nav-item ${STATE.view === 'client_orders' ? 'active' : ''}" data-view="client_orders">
        <i data-lucide="list"></i> My Orders
      </div>
    `;
  }

  const roleBadge = STATE.user.role === 'admin' 
    ? '<span style="background: var(--accent); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">Админ</span>' 
    : '';

  const unreadNotifs = APP_DATA.notifications.filter(n => n.userId === STATE.user.id && !n.read);

  return `
    <div class="dashboard animate-fade-in">
      <div class="sidebar">
        <div class="sidebar-header">
          СтройКомплект
        </div>
        <div class="sidebar-nav">
          ${navLinks}
        </div>
      </div>
      <div class="main-content">
        <div class="topbar">
          <div class="topbar-title">
            ${getViewTitle()}
            <span id="cloudStatus" style="margin-left:12px; font-size:10px; padding:2px 8px; border-radius:10px; vertical-align:middle; 
               background:${CLOUD_STATUS==='online' ? 'rgba(46, 204, 113, 0.2)' : (CLOUD_STATUS==='error' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(255,165,0,0.2)')};
               color:${CLOUD_STATUS==='online' ? '#2ecc71' : (CLOUD_STATUS==='error' ? '#e74c3c' : '#ffa500')};">
               <i data-lucide="${CLOUD_STATUS==='online' ? 'cloud-check' : (CLOUD_STATUS==='error' ? 'cloud-off' : 'cloud-lightning')}" style="width:12px;height:12px; vertical-align:text-top; margin-right:4px;"></i>
               Cloud: ${CLOUD_STATUS==='online' ? I18N[STATE.lang].cloud_synced : (CLOUD_STATUS==='error' ? I18N[STATE.lang].cloud_error : I18N[STATE.lang].cloud_loading)}
            </span>
          </div>
          <div class="user-profile">
            <div style="position:relative; margin-right: 16px;">
               <button class="notif-btn" onclick="toggleNotif()"><i data-lucide="bell"></i>
                 ${unreadNotifs.length > 0 ? `<span class="notif-badge">${unreadNotifs.length}</span>` : ''}
               </button>
               <div id="notifDropdown" class="notif-dropdown" style="display:none;">
                 <div style="padding:12px; font-weight:700; border-bottom:1px solid var(--border); color:var(--primary);">Уведомления</div>
                 ${APP_DATA.notifications.filter(n => n.userId === STATE.user.id).slice(0, 8).map(n => `
                   <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
                      <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">${n.date}</div>
                      <div>${n.text}</div>
                   </div>
                 `).join('') || '<div style="padding:16px; color:var(--text-muted); font-size:12px; text-align:center;">Нет новых уведомлений</div>'}
               </div>
            </div>
            
            <i data-lucide="user"></i>
            <span>${STATE.user.name}</span>
            ${roleBadge}
            <button class="logout-btn" id="logoutBtn" title="Выйти" style="margin-left:8px;">
              <i data-lucide="log-out"></i>
            </button>
          </div>
        </div>
        
        <div class="content-area animate-fade-in">
          ${renderCurrentViewContent()}
        </div>
      </div>
    </div>
  `;
}

function renderModal() {
  if (!MODAL.active) return '';
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
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button type="submit" class="btn">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function getViewTitle() {
  const lang = STATE.lang || 'ru';
  switch(STATE.view) {
    case 'employee_plans': return I18N[lang].view_plans;
    case 'employee_orders': return I18N[lang].view_orders;
    case 'employee_inventory': return I18N[lang].view_inventory;
    case 'admin_tasks_history': return I18N[lang].view_history_tasks;
    case 'admin_requests_history': return I18N[lang].view_history_req;
    case 'admin_finance': return I18N[lang].view_finance;
    case 'admin_settings': return I18N[lang].view_accounts;
    case 'admin_logs': return I18N[lang].view_logs;
    default: return I18N[lang].dashboard;
  }
}

function renderCurrentViewContent() {
  const isAdmin = STATE.user.role === 'admin';
  switch(STATE.view) {
    
    // ----------- PLANS -----------
    case 'employee_plans': {
      let basePlans = isAdmin ? APP_DATA.plans : APP_DATA.plans.filter(p => p.empId === STATE.user.id);
      if (isAdmin && STATE.plansFilter && String(STATE.plansFilter) !== 'all') {
         basePlans = basePlans.filter(p => String(p.empId) === String(STATE.plansFilter));
      }

      const displayPlans = basePlans.sort((a, b) => {
         if (isAdmin) {
             const empNameA = (APP_DATA.users.find(u => u.id == a.empId) || {}).name || 'ЯЯЯ';
             const empNameB = (APP_DATA.users.find(u => u.id == b.empId) || {}).name || 'ЯЯЯ';
             const nameCmp = empNameA.localeCompare(empNameB);
             if (nameCmp !== 0) return nameCmp;
         }
         return new Date(a.date || '2099-01-01') - new Date(b.date || '2099-01-01');
      });
      
      const renderPlanCard = (p) => {
        const emp = APP_DATA.users.find(u => u.id == p.empId);
        const empName = emp ? emp.name : 'Неизвестный';
        const urgencyBadge = p.urgency === 'urgent' 
          ? `<span style="background:rgba(192, 57, 43, 0.2); color:var(--danger); padding:4px 8px; border-radius:4px; font-weight:800; font-size:10px; text-transform:uppercase;">🔥 Срочно</span>`
          : ``;

        return `
          <div style="background: rgba(255,255,255,0.05); padding:16px; border-radius:8px; border: 1px solid var(--border); ${p.urgency === 'urgent' ? 'border-left: 4px solid var(--danger);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
              <div style="font-weight:600; font-size:15px; line-height:1.4;">${p.title}</div>
              ${urgencyBadge}
            </div>
            
            <div style="color:var(--text-muted); font-size:11px; margin-bottom: 8px;"><i data-lucide="calendar" style="width:10px; height:10px;"></i> Срок: ${p.date || 'Не указан'}</div>

            <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
              ${isAdmin ? `<span style="background:rgba(243, 156, 18, 0.1); color:var(--text-muted); padding:4px 8px; border-radius:4px; font-weight:600; font-size:10px; text-transform:uppercase;">👷 ${empName}</span>` : ''}
            </div>

            <div style="display:flex; gap:8px; justify-content:space-between; align-items:center;">
              <div style="display:flex; gap:8px;">
                ${!isAdmin && p.status === 'open' ? `<button class="btn" style="padding:6px 12px; font-size:10px;" onclick="changePlanStatus(${p.id}, 'in_progress')">Взять в работу</button>` : ''}
                ${!isAdmin && p.status === 'in_progress' ? `<button class="btn" style="background:var(--success); color:white; padding:6px 12px; font-size:10px;" onclick="changePlanStatus(${p.id}, 'done')">✅ Завершить</button>` : ''}
                <button class="btn btn-secondary" style="padding:6px 12px; font-size:10px;" onclick="openTaskComments(${p.id})"><i data-lucide="message-square" style="width:12px;height:12px; margin-right:4px;"></i> Обсуждение ${(p.comments && p.comments.length) ? `(${p.comments.length})` : ''}</button>
              </div>
              ${isAdmin ? `
              <div style="display:flex; gap:4px;">
                ${p.status === 'done' ? `<button class="btn btn-secondary" style="padding:6px; color:var(--success);" title="Завершить и убрать в Архив" onclick="archivePlan(${p.id})"><i data-lucide="folder-down" style="width:14px; height:14px;"></i></button>` : ''}
                <button class="btn btn-secondary" style="padding:6px;" title="Изменить" onclick="editPlan(${p.id})"><i data-lucide="edit-2" style="width:14px; height:14px;"></i></button>
                <button class="btn btn-secondary" style="padding:6px; color:var(--danger);" title="Удалить" onclick="deletePlan(${p.id})"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      };

      const empOptions = APP_DATA.users.filter(u => u.role === 'employee').map(u => 
        `<option value="${u.id}" ${String(STATE.plansFilter) === String(u.id) ? 'selected' : ''}>${u.name}</option>`
      ).join('');

      const filterHtml = isAdmin ? `
        <div style="display:flex; align-items:center; gap: 12px;">
           <select style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--border); border-radius:4px; padding:8px 12px; font-size:13px; outline:none;" onchange="filterPlansByEmp(this.value)">
             <option value="all" ${!STATE.plansFilter || String(STATE.plansFilter) === 'all' ? 'selected' : ''}>📋 Все задачи (Все сотрудники)</option>
             ${empOptions}
           </select>
        </div>
      ` : '';

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
           ${filterHtml ? filterHtml : `<p style="color:var(--text-muted);">Ваши рабочие поручения по фазам.</p>`}
           ${isAdmin ? '<button class="btn" onclick="addPlan()"><i data-lucide="plus" style="width:16px; height:16px; vertical-align:middle;"></i> Добавить задачу</button>' : ''}
        </div>
        <div class="grid-cards">
          <div class="glass-panel card" style="border-top-color: var(--text-muted);">
            <div class="card-title" style="color:var(--text-muted);"><i data-lucide="circle"></i> Ожидают выполнения</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
               ${displayPlans.filter(p => p.status === 'open').map(renderPlanCard).join('') || '<div style="color:var(--text-muted); font-size:13px;">Нет задач</div>'}
            </div>
          </div>
          <div class="glass-panel card" style="border-top-color: var(--primary);">
            <div class="card-title" style="color:var(--primary);"><i data-lucide="clock"></i> В процессе (В работе)</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
               ${displayPlans.filter(p => p.status === 'in_progress').map(renderPlanCard).join('') || '<div style="color:var(--text-muted); font-size:13px;">Пусто</div>'}
            </div>
          </div>
          <div class="glass-panel card" style="border-top-color: var(--success);">
            <div class="card-title" style="color:var(--success);"><i data-lucide="check-circle-2"></i> Завершенные</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
               ${displayPlans.filter(p => p.status === 'done').map(renderPlanCard).join('') || '<div style="color:var(--text-muted); font-size:13px;">Пусто</div>'}
            </div>
          </div>
        </div>
      `;
    }
      
    // ----------- INVENTORY -----------
    case 'employee_inventory': {
      const activeRequests = APP_DATA.requests.filter(r => r.status !== 'Архивировано');
      const displayRequests = isAdmin ? activeRequests : activeRequests.filter(r => r.empName === STATE.user.name);
      
      const requestsHtml = `
         <div style="margin-top: 48px; display:flex; justify-content:space-between; margin-bottom: 24px;">
           <h3>Заявки на закупку/выдачу товара</h3>
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
                <td style="padding: 12px;">${r.empName}</td>
                <td style="padding: 12px; font-weight:500;">${r.itemName}</td>
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
           <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
             <h3>Товарные остатки склада</h3>
             <div style="display:flex; gap:8px; align-items:center;">
               <button class="btn btn-secondary" onclick="startQRScanner()"><i data-lucide="scan" style="width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Сканер QR</button>
               <button class="btn btn-secondary" onclick="exportExcel('inventory')"><i data-lucide="download" style="width:16px; height:16px; vertical-align:middle;"></i> Скачать Excel</button>
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
                  <td style="padding: 12px;"><span style="color:var(--primary); font-size:12px; text-transform:uppercase;">${item.category}</span></td>
                  <td style="padding: 12px; font-weight: 500; ${item.stock <= 5 ? 'color:var(--danger);' : ''}">${item.name}</td>
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
      // client sees only their orders by matching substring of their name
      const orders = forClient ? APP_DATA.orders.filter(o => o.client.includes(STATE.user.name)) : APP_DATA.orders; 

      if (forClient) {
        return `
         <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 24px;">
             <h3>Мои заказы</h3>
             <button class="btn" onclick="clientCreateOrder()"><i data-lucide="plus" style="width:16px; height:16px; vertical-align:middle;"></i> Оставить новую заявку</button>
           </div>
           <div style="display:flex; flex-direction:column; gap:12px;">
              ${orders.map(order => `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding:16px; border-radius:var(--radius); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-weight:700; margin-bottom:4px; color:var(--primary);">${order.id} — ООО "СтройДом" (Поставщик)</div>
                    <div style="font-size:12px; color:var(--text-muted)">Дата отгрузки: ${order.date}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap: 12px;">
                    <span style="font-weight:800; font-size:16px; margin-right:16px;">${order.sum.toLocaleString()} сом</span>
                    <span style="background:rgba(255,255,255,0.1); color:var(--text-main); font-weight:600; padding:6px 12px; border-radius:4px; font-size:12px;">${order.stage}</span>
                    <button class="btn btn-secondary" style="padding:6px; margin-left:8px;" onclick="printInvoice('${order.id}')" title="Распечатать Акт"><i data-lucide="printer" style="width:14px; height:14px;"></i></button>
                  </div>
                </div>
              `).join('')}
           </div>
        </div>`;
      }

      // Kanban CRM for Employees / Admins
      return `
         <div style="margin-bottom: 24px; display:flex; justify-content:space-between; align-items:center;">
           <div>
             <h3 style="margin-bottom:8px;">Воронка заказов</h3>
             <p style="color:var(--text-muted); font-size:13px;">Проводите карточки клиентов по этапам до успешной оплаты сделки.</p>
           </div>
           ${isAdmin ? '<button class="btn" onclick="addOrder()"><i data-lucide="plus" style="width:16px; height:16px; vertical-align:middle;"></i> Новый лид (Заказ)</button>' : ''}
         </div>
         <div class="kanban-board">
           ${['Новый', 'В работе', 'Сдан', 'Оплачен'].map(stage => {
              const borderMap = {'Новый': 'var(--text-muted)', 'В работе': 'var(--primary)', 'Сдан': '#9b59b6', 'Оплачен': 'var(--success)'};
              return `
                <div class="kanban-col" style="border-top-color: ${borderMap[stage]};">
                  <div style="display:flex; justify-content:space-between;">
                    <h4 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${stage}</h4>
                    <span style="color:var(--text-muted); font-size:12px; font-weight:700;">${APP_DATA.orders.filter(o => o.stage === stage).reduce((a, b) => a + b.sum, 0).toLocaleString()} сом</span>
                  </div>
                  
                  ${APP_DATA.orders.filter(o => o.stage === stage).map(o => `
                    <div class="glass-panel" style="background: rgba(255,255,255,0.03); padding: 16px; border: 1px solid var(--border); border-left: 3px solid ${borderMap[stage]};">
                      <div style="font-weight:800; color:var(--text-main); margin-bottom:8px;">${o.id}</div>
                      <div style="font-size:14px; margin-bottom:12px; color:var(--primary); font-weight:500;">👤 ${o.client}</div>
                      <div style="font-size:12px; margin-bottom:12px; color:var(--text-muted);">До: ${o.date}</div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <div style="font-weight:700; font-size:18px;">${o.sum.toLocaleString()} сом</div>
                        ${isAdmin ? `<button class="btn btn-secondary" style="padding:4px; font-size:10px;" onclick="editOrderSum('${o.id}')" title="Изменить сумму"><i data-lucide="edit-2" style="width:12px;height:12px;"></i></button>` : ''}
                      </div>
                      <button class="btn btn-secondary" style="width:100%; font-size:11px; padding:8px 0; margin-bottom:4px; background: rgba(52, 152, 219, 0.1); color: #3498db; border-color: #3498db;" onclick="printInvoice('${o.id}')"><i data-lucide="printer" style="width:12px; height:12px; vertical-align:middle;"></i> Печать сметы/акта</button>
                      ${isAdmin && stage !== 'Оплачен' ? `<button class="btn" style="width:100%; font-size:11px; padding:8px 0; margin-bottom:4px;" onclick="nextOrderStage('${o.id}')">Вперед <i data-lucide="chevron-right" style="width:12px; height:12px; vertical-align:middle;"></i></button>` : ''}
                      ${isAdmin && stage !== 'Новый' ? `<button class="btn btn-secondary" style="width:100%; font-size:11px; padding:8px 0;" onclick="prevOrderStage('${o.id}')"><i data-lucide="chevron-left" style="width:12px; height:12px; vertical-align:middle;"></i> Назад</button>` : ''}
                    </div>
                  `).join('') || '<div style="font-size:12px; color:rgba(255,255,255,0.2); text-align:center;">Пусто</div>'}
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
        <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
             <div>
               <h3>Архив складских операций</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Историческая база данных выданных материалов и отклоненных заявок.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('requests')"><i data-lucide="download" style="width:16px; height:16px; vertical-align:middle;"></i> Скачать отчет в Excel</button>
           </div>
           
           <table style="width:100%; border-collapse: collapse; text-align:left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 12px; color:var(--text-muted);">Инициатор</th>
                <th style="padding: 12px; color:var(--text-muted);">Наименование</th>
                <th style="padding: 12px; color:var(--text-muted);">Количество</th>
                <th style="padding: 12px; color:var(--text-muted);">Прошлый Статус</th>
                <th style="padding: 12px; color:var(--text-muted); text-align:right;">Управление</th>
              </tr>
            </thead>
            <tbody>
              ${archivedReqs.map(r => `
                 <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                   <td style="padding: 12px; font-weight:600; color:var(--primary);">${r.empName}</td>
                   <td style="padding: 12px;">${r.itemName}</td>
                   <td style="padding: 12px; color:var(--text-muted);">${r.qty} шт.</td>
                   <td style="padding: 12px;"><span style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:11px; text-transform:uppercase;">${r.prevStatus || 'Отработана'}</span></td>
                   <td style="padding: 12px; text-align:right;">
                     <button class="btn btn-secondary" style="padding:6px; color:var(--danger);" onclick="deleteRequest(${r.id})" title="Удалить навсегда"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                   </td>
                 </tr>
              `).join('') || `<tr><td colspan="5" style="padding:24px; color:var(--text-muted); text-align:center;">Архив склада пуст</td></tr>`}
            </tbody>
           </table>
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
               <h3>Архив выполненных задач</h3>
               <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">База данных всех исторических поручений сотрудников.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('tasks')"><i data-lucide="download" style="width:16px; height:16px; vertical-align:middle;"></i> Скачать отчет в Excel</button>
           </div>
           
           <table style="width:100%; border-collapse: collapse; text-align:left;">
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
                 const empName = (APP_DATA.users.find(u => u.id == p.empId) || {}).name || 'Неизвестный';
                 return `
                 <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                   <td style="padding: 12px; font-weight:600; color:var(--primary);">${empName}</td>
                   <td style="padding: 12px;">${p.title}</td>
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
      `;
    }

    // ----------- ADMIN: FINANCE -----------
    case 'admin_finance': {
      const invValue = APP_DATA.inventory.reduce((a, b) => a + (b.stock * b.price), 0);
      const totalRevenue = APP_DATA.orders.reduce((sum, o) => sum + (o.sum || 0), 0);
      const totalExpenses = (APP_DATA.expenses || []).reduce((sum, e) => sum + (e.sum || 0), 0);
      const netProfit = totalRevenue - totalExpenses;
      
      const revPaid = APP_DATA.orders.filter(o => o.stage === 'Оплачен').reduce((a, b) => a + b.sum, 0);
      const pending = APP_DATA.orders.filter(o => o.stage !== 'Оплачен').reduce((a, b) => a + b.sum, 0);
      
      const stages = ['Новый', 'В работе', 'Сдан', 'Оплачен'];
      const funnelCounts = stages.map(s => APP_DATA.orders.filter(o => o.stage === s).length);
      const maxFunnel = Math.max(...funnelCounts, 1);
      const funnelHtml = stages.map((s, i) => {
        const count = funnelCounts[i];
        const pct = (count / maxFunnel) * 100;
        const colors = ['var(--text-muted)', 'var(--primary)', '#9b59b6', 'var(--success)'];
        return `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; font-weight:600;">
              <span>${s}</span>
              <span>${count} заказов</span>
            </div>
            <div style="width:100%; background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden;">
               <div style="width:${pct}%; background:${colors[i]}; height:100%; border-radius:6px; transition: width 1s ease-out;"></div>
            </div>
          </div>
        `;
      }).join('');

      const allFinishedPlans = APP_DATA.plans.filter(p => p.status === 'done' || p.status === 'archived');
      const empStats = {};
      allFinishedPlans.forEach(p => { empStats[p.empId] = (empStats[p.empId] || 0) + 1; });
      const sortedEmps = Object.entries(empStats).sort((a,b) => b[1] - a[1]).slice(0, 5);
      const maxTask = sortedEmps.length ? sortedEmps[0][1] : 1;
      let empStatsHtml = sortedEmps.map(([id, count]) => {
         const empName = (APP_DATA.users.find(u => u.id == id) || {}).name || 'Неизвестный';
         const pct = (count / maxTask) * 100;
         return `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; font-weight:600; color:var(--text-main);">
              <span>👷 ${empName}</span>
              <span>${count} задач</span>
            </div>
            <div style="width:100%; background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden;">
               <div style="width:${pct}%; background:var(--accent); height:100%; border-radius:6px; transition: width 1s ease-out;"></div>
            </div>
          </div>
         `;
      }).join('');
      if(!empStatsHtml) empStatsHtml = '<div style="color:var(--text-muted); font-size:13px; padding:20px 0;">Пока нет завершенных задач.</div>';

      return `
        <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
             <div>
               <h3>Финансовая аналитика (Бюджет компании)</h3>
               <p style="color:var(--text-muted); font-size:13px;">Учет активов строительной базы и движения средств по заказам (Валюта: сом).</p>
             </div>
             <div style="display:flex; gap:8px;">
               <button class="btn" onclick="generateAIReport()" style="background:linear-gradient(135deg, #6e45e2 0%, #88d3ce 100%); border:none;"><i data-lucide="sparkles" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i> AI Анализ бизнеса</button>
               <button class="btn" onclick="addExpense()" style="background:var(--danger); border:none;"><i data-lucide="minus-circle" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i> Записать Расход</button>
             </div>
           </div>
           
           <div class="grid-cards" style="grid-template-columns: repeat(3, 1fr);">
             <div class="glass-panel card" style="border-top-color: var(--primary);">
               <div class="card-title">📦 Активы склада</div>
               <div style="font-size:24px; font-weight:800; color:var(--text-main);">${invValue.toLocaleString()} <span style="font-size:14px; color:var(--text-muted);">сом</span></div>
             </div>
             <div class="glass-panel card" style="border-top-color: var(--success);">
               <div class="card-title">💰 Чистая Прибыль</div>
               <div style="font-size:24px; font-weight:800; color:var(--success);">${netProfit.toLocaleString()} <span style="font-size:14px; color:var(--text-muted);">сом</span></div>
             </div>
             <div class="glass-panel card" style="border-top-color: var(--danger);">
               <div class="card-title">📉 Общие Расходы</div>
               <div style="font-size:24px; font-weight:800; color:var(--danger);">${totalExpenses.toLocaleString()} <span style="font-size:14px; color:var(--text-muted);">сом</span></div>
             </div>
           </div>

           <div style="display:grid; grid-template-columns: 1fr 2fr; gap:24px; margin-top:24px;">
              <div class="glass-panel" style="padding:20px; border: 1px solid rgba(255,255,255,0.05);">
                <h4 style="margin-bottom:15px; color:var(--primary);">🧾 Касса (Последние 10)</h4>
                <div style="max-height:250px; overflow-y:auto;">
                  ${(APP_DATA.expenses || []).slice(0, 10).map(e => `
                    <div style="font-size:12px; padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                      <div>
                        <div style="font-weight:600;">${e.category}</div>
                        <div style="font-size:10px; color:var(--text-muted)">${e.date}</div>
                      </div>
                      <span style="color:var(--danger); font-weight:700;">-${e.sum.toLocaleString()} сом</span>
                    </div>
                  `).join('') || '<div style="color:var(--text-muted); padding:10px 0;">Нет записей</div>'}
                </div>
              </div>
              
              <div class="glass-panel" style="padding:20px; border: 1px solid rgba(255,255,255,0.05);">
                <h4 style="margin-bottom:20px; display:flex; align-items:center; gap:8px;"><i data-lucide="bar-chart-2" style="width:18px; height:18px; color:var(--primary);"></i> Воронка обработки Лидов</h4>
                ${funnelHtml}
              </div>
           </div>

           <div class="glass-panel" style="padding:24px; margin-top: 24px; border: 1px solid rgba(255,255,255,0.05);">
             <h4 style="margin-bottom:20px; display:flex; align-items:center; gap:8px;"><i data-lucide="award" style="width:18px; height:18px; color:var(--accent);"></i> Высокая продуктивность сотрудников (Закрытые задачи)</h4>
             <div style="display:grid; grid-template-columns: 1fr 1fr; gap:40px;">
                ${empStatsHtml}
             </div>
           </div>

        </div>
      `;
    }
    
    // ----------- ADMIN: SETTINGS -----------
    case 'admin_settings':
      return `
        <div class="glass-panel" style="padding:24px; margin-bottom: 24px; border: 1px solid #3498db;">
           <div style="display:flex; justify-content:space-between; align-items:flex-end;">
             <div class="input-block" style="flex:1; margin-bottom:0; margin-right: 16px;">
               <label style="color:#3498db;"><i data-lucide="send" style="width:12px;height:12px;"></i> Chat ID группы Telegram (Куда бот будет писать)</label>
               <input id="sysTgChatId" value="${APP_DATA.settings?.tgChatId || ''}" placeholder="Например: -1001234567890">
             </div>
             <button class="btn btn-secondary" onclick="saveTgSettings()">Сохранить ID</button>
           </div>
           <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">Инструкция: Добавьте вашего бота в рабочую группу. Напишите любое сообщение в группу, затем узнайте её ID через @getmyid_bot (обычно с минусом).</p>
        </div>

        <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
             <h3>Сотрудники и клиенты</h3>
             <button class="btn" onclick="addUser()"><i data-lucide="user-plus" style="width:16px; height:16px; vertical-align:middle;"></i> Регистрация пользователя</button>
           </div>
           
           <table style="width:100%; border-collapse: collapse; text-align:left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 12px; color:var(--text-muted);">Имя (Должность)</th>
                <th style="padding: 12px; color:var(--text-muted);">Логин</th>
                <th style="padding: 12px; color:var(--text-muted);">Пароль</th>
                <th style="padding: 12px; color:var(--text-muted);">Роль</th>
                <th style="padding: 12px; color:var(--text-muted); text-align:right;">Действия</th>
              </tr>
            </thead>
            <tbody>
              ${APP_DATA.users.map(u => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 12px; font-weight:500;">${u.name}</td>
                  <td style="padding: 12px; color:var(--primary); font-weight:700;">${u.login}</td>
                  <td style="padding: 12px; color:var(--text-muted);">***</td>
                  <td style="padding: 12px;"><span style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">${u.role}</span></td>
                  <td style="padding: 12px; text-align:right;">
                    <button class="btn btn-secondary" style="padding:6px;" title="Изменить" onclick="editUser(${u.id})"><i data-lucide="edit-3" style="width:14px; height:14px;"></i></button>
                    ${u.role !== 'admin' ? `<button class="btn btn-secondary" style="padding:6px; color:var(--danger); margin-left:4px;" title="Удалить" onclick="deleteUser(${u.id})"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
           </table>
        </div>
      `;

    // ----------- ADMIN: LOGS -----------
    case 'admin_logs':
      return `
        <div class="glass-panel" style="padding:24px;">
           <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
             <div>
                <h3>Системный журнал безопасности</h3>
                <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Автоматическая фиксация всех действий персонала и клиентов.</p>
             </div>
             <button class="btn btn-secondary" onclick="exportExcel('logs')"><i data-lucide="download" style="width:16px; height:16px; vertical-align:middle;"></i> Скачать отчет в Excel</button>
           </div>
           
           <div style="background: rgba(0,0,0,0.3); border: 1px solid #333; border-radius: var(--radius); padding: 16px; max-height: 60vh; overflow-y: auto;">
             <table style="width:100%; border-collapse: collapse; text-align:left;">
              <thead>
                <tr style="border-bottom: 2px solid #444;">
                  <th style="padding: 12px; color:var(--text-muted); width: 200px;">Время</th>
                  <th style="padding: 12px; color:var(--text-muted); width: 250px;">Пользователь</th>
                  <th style="padding: 12px; color:var(--text-muted);">Событие / Действие</th>
                </tr>
              </thead>
              <tbody>
                ${APP_DATA.auditLog.map(log => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                    <td style="padding: 12px; font-size:13px; color:var(--text-muted);">${log.time}</td>
                    <td style="padding: 12px; font-size:13px; color:var(--primary); font-weight:600;">${log.user}</td>
                    <td style="padding: 12px; font-size:14px;">${log.action}</td>
                  </tr>
                `).join('') || `<tr><td colspan="3" style="padding:24px; color:var(--text-muted); text-align:center;">Журнал пуст. Действий не зафиксировано.</td></tr>`}
              </tbody>
             </table>
           </div>
        </div>
      `;
      
    default: return '';
  }
}

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
  const formHtml = `
    <div class="input-block">
      <label>Клиент (Название или ФИО)</label>
      <input id="modClient" required>
    </div>
    <div class="input-block">
      <label>Сумма заказа (сом)</label>
      <input id="modSum" type="number" required>
    </div>
    <div class="input-block">
      <label>Дедлайн / Дата сдачи</label>
      <input id="modDate" type="date" required>
    </div>
  `;
  window.openModal('Новый Лид / Заказ', formHtml, () => {
    const pId = 'ORD-' + Math.floor(Math.random()*10000);
    APP_DATA.orders.push({
      id: pId,
      client: document.getElementById('modClient').value,
      sum: parseInt(document.getElementById('modSum').value) || 0,
      date: document.getElementById('modDate').value,
      stage: 'Новый'
    });
    addLog(`CRM: Создан новый лид/заказ ${pId}`);
    window.closeModal();
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
      <label>Наименование материала</label>
      <input id="reqItem" required>
    </div>
    <div class="input-block">
      <label>Требуемое количество</label>
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
    <div id="commentsWrapper" style="max-height:40vh; overflow-y:auto; margin-bottom:16px; padding-right:8px; display:flex; flex-direction:column; gap:12px;">
      ${p.comments.map(c => `
      <div style="padding:12px; border-radius:8px; background: rgba(255,255,255,0.05); border: 1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:var(--primary); font-size:13px;">${c.author}</strong>
          <span style="font-size:11px; color:var(--text-muted);">${c.time}</span>
        </div>
        <div style="font-size:14px; color:var(--text-main); line-height:1.4;">${c.text}</div>
      </div>
      `).join('') || '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">Пока нет комментариев. Напишите первым!</div>'}
    </div>
    <div class="input-block" style="margin-bottom:0; padding-top:16px; border-top: 1px solid var(--border);">
      <label>Ваш комментарий</label>
      <textarea id="newCommentText" rows="3" placeholder="Введите текст сообщения..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-main); border-radius:var(--radius); padding:10px; resize:none;"></textarea>
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
      <label>Строитель / Сотрудник (Исполнитель)</label>
      <select id="modEmpId" required>${empOptions}</select>
    </div>
    <div class="input-block">
      <label>Краткое описание задачи</label>
      <input id="modTitle" required>
    </div>
    <div class="input-block">
      <label>Срок сдачи (Дедлайн)</label>
      <input id="modDate" type="date" required>
    </div>
    <div class="input-block">
      <label>Приоритет исполнения</label>
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

window.editPlan = function(id) {
  const plan = APP_DATA.plans.find(p => String(p.id) === String(id));
  if (!plan) return;

  const empOptions = APP_DATA.users.filter(u => u.role === 'employee').map(u => `<option value="${u.id}" ${u.id === plan.empId ? 'selected' : ''}>${u.name}</option>`).join('');
  
  const formHtml = `
    <div class="input-block">
      <label>Сотрудник (Исполнитель)</label>
      <select id="modEmpId" required>${empOptions}</select>
    </div>
    <div class="input-block">
      <label>Описание задачи</label>
      <input id="modTitle" value="${plan.title}" required>
    </div>
    <div class="input-block">
      <label>Срок сдачи (Дедлайн)</label>
      <input id="modDate" type="date" value="${plan.date || ''}" required>
    </div>
    <div class="input-block">
      <label>Уровень срочности</label>
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
      <label>Категория</label>
      <select id="modCat" required>
        <option value="Материалы">Строительные Материалы</option>
        <option value="Оборудование">Оборудование / Станки</option>
        <option value="Инструмент">Электроинструмент / Ручной</option>
        <option value="Расходники">Расходники / Крепеж</option>
        <option value="Спецодежда">Спецодежда</option>
      </select>
    </div>
    <div class="input-block">
      <label>Наименование</label>
      <input id="modName" required>
    </div>
    <div class="input-block">
      <label>Фактический остаток на складе</label>
      <input id="modStock" type="number" required>
    </div>
    <div class="input-block">
      <label>Закупочная цена (в сомах)</label>
      <input id="modPrice" type="number" required>
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
      <label>Категория</label>
      <select id="modCat" required>
        <option value="Материалы" ${item.category === 'Материалы' ? 'selected' : ''}>Строительные Материалы</option>
        <option value="Оборудование" ${item.category === 'Оборудование' ? 'selected' : ''}>Оборудование / Станки</option>
        <option value="Инструмент" ${item.category === 'Инструмент' ? 'selected' : ''}>Электроинструмент / Ручной</option>
        <option value="Расходники" ${item.category === 'Расходники' ? 'selected' : ''}>Расходники / Крепеж</option>
        <option value="Спецодежда" ${item.category === 'Спецодежда' ? 'selected' : ''}>Спецодежда</option>
      </select>
    </div>
    <div class="input-block">
      <label>Наименование материала</label>
      <input id="modName" value="${item.name}" required>
    </div>
    <div class="input-block">
      <label>Остаток</label>
      <input id="modStock" type="number" value="${item.stock}" required>
    </div>
    <div class="input-block">
      <label>Закупочная цена (сом)</label>
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
    <div style="display:flex; gap:20px; align-items:flex-start;">
      <div style="text-align:center;">
        <img src="${qrUrl}" style="border: 4px solid white; border-radius: 8px; margin-bottom:10px;">
        <div style="font-size:11px; color:var(--text-muted)">QR-код товара ID:${item.id}</div>
      </div>
      <div style="flex:1;">
        <h4 style="margin-top:0;">${item.name}</h4>
        <p style="color:var(--primary); font-weight:700;">${item.stock} шт. на складе</p>
        <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:10px;">
          <h5 style="margin-bottom:10px;">История перемещений:</h5>
          <div style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:4px; background:rgba(0,0,0,0.1)">
            ${historyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  window.openModal('Детальная информация', html, null);
};

window.addExpense = function() {
  const formHtml = `
    <div class="input-block">
      <label>Категория расхода</label>
      <select id="expCat">
        <option value="Зарплата">Зарплата / Выплаты</option>
        <option value="Материалы">Закупка стройматериалов</option>
        <option value="Аренда">Аренда / Коммуналка</option>
        <option value="Налоги">Налоги / Сборы</option>
        <option value="Другое">Прочее / Накладные</option>
      </select>
    </div>
    <div class="input-block">
      <label>Сумма (сом)</label>
      <input id="expSum" type="number" required>
    </div>
    <div class="input-block">
      <label>Комментарий / Кому</label>
      <input id="expComment" placeholder="Например: Закупка арматуры у Виктора" required>
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
  showLoading(STATE.lang === 'ru' ? 'Искусственный интеллект анализирует данные...' : 'AI is analyzing your business data...');
  
  setTimeout(() => {
    hideLoading();
    const rev = APP_DATA.orders.reduce((s, o) => s + (o.sum || 0), 0);
    const exp = (APP_DATA.expenses || []).reduce((s, e) => s + (e.sum || 0), 0);
    const profit = rev - exp;
    const lowItems = APP_DATA.inventory.filter(i => i.stock <= 5).length;
    
    let advice = "";
    if (STATE.lang === 'ru') {
       if (profit > 0) advice = "✅ Бизнес в плюсе. Рекомендую инвестировать в закупку ходовых материалов.";
       else advice = "⚠️ Расходы превышают доходы. Нужно сократить издержки.";
       if (lowItems > 0) advice += `\n⚠️ Внимание: у вас ${lowItems} позиций почти закончились!`;
    } else {
       if (profit > 0) advice = "✅ Business is profitable. Invest in high-demand stock.";
       else advice = "⚠️ Expenses exceed revenue. Consider cost reduction.";
       if (lowItems > 0) advice += `\n⚠️ Warning: ${lowItems} items are low on stock!`;
    }

    const reportHtml = `
      <div style="background: linear-gradient(135deg, rgba(110, 69, 226, 0.1) 0%, rgba(136, 211, 206, 0.1) 100%); padding: 25px; border-radius: 12px; border: 1px solid var(--primary); box-shadow: var(--shadow);">
        <h3 style="margin-top:0; color:var(--primary); display:flex; align-items:center; gap:10px;">
          <i data-lucide="sparkles"></i> ${STATE.lang === 'ru' ? 'AI Аналитика Бизнеса' : 'AI Business Insights'}
        </h3>
        <p style="font-size:15px; line-height:1.6; color:var(--text-main);">
          ${STATE.lang === 'ru' ? 'Отчет на:' : 'Report generated on:'} <b>${new Date().toLocaleDateString()}</b>:
          <br/><br/>
          💰 <b>${STATE.lang === 'ru' ? 'Чистая Прибыль:' : 'Net Profit:'}</b> <span style="color:var(--success); font-weight:800;">${profit.toLocaleString()} сом</span>. 
          <br/><br/>
          💡 <b>${STATE.lang === 'ru' ? 'Совет от ИИ:' : 'AI Advice:'}</b> ${advice}
        </p>
      </div>
    `;
    window.openModal(STATE.lang === 'ru' ? 'AI Бизнес-Аналитика' : 'AI Business Analytics', reportHtml, null);
    if(window.lucide) lucide.createIcons();
  }, 1200);
};

// USER CRUD
window.addUser = function() {
  const formHtml = `
    <div class="input-block">
      <label>Имя и Специализация</label>
      <input id="modUName" placeholder="Например: Иван (Арматурщик)" required>
    </div>
    <div class="input-block">
      <label>Telegram (через @) *теги</label>
      <input id="modUTG" placeholder="@ivan_worker">
    </div>
    <div class="input-block">
      <label>Уникальный логин доступа</label>
      <input id="modULogin" placeholder="ivan123" required>
    </div>
    <div class="input-block">
      <label>Пароль</label>
      <input id="modUPassword" placeholder="Пароль" required>
    </div>
    <div class="input-block">
      <label>Группа прав (Роль)</label>
      <select id="modURole" required>
        <option value="employee">Сотрудник</option>
        <option value="client">Клиент заказчик</option>
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
    });
    addLog(`Безопасность: Зарегистрировал пользователя "${username}"`);
    saveDB();
    window.closeModal();
  });
};
window.editUser = function(id) {
  const user = APP_DATA.users.find(u => u.id === id);
  if(!user) return;
  const formHtml = `
    <div class="input-block">
      <label>Имя и Специализация</label>
      <input id="modUName" value="${user.name}" required>
    </div>
    <div class="input-block">
      <label>Telegram (через @)</label>
      <input id="modUTG" value="${user.tg || ''}" placeholder="@ivan_worker">
    </div>
    <div class="input-block">
      <label>Уникальный логин доступа</label>
      <input id="modULogin" value="${user.login}" required>
    </div>
    <div class="input-block">
      <label>Пароль</label>
      <input id="modUPassword" value="${user.password}" required>
    </div>
    <div class="input-block">
      <label>Группа прав</label>
      <select id="modURole" required disabled>
        <option value="${user.role}">${user.role === 'client' ? 'Клиент' : (user.role === 'admin' ? 'Администратор' : 'Сотрудник')}</option>
      </select>
    </div>
  `;
  window.openModal('Настройки доступа', formHtml, () => {
    user.name = document.getElementById('modUName').value;
    user.tg = document.getElementById('modUTG').value;
    user.login = document.getElementById('modULogin').value;
    user.password = document.getElementById('modUPassword').value;
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
      if (view) updateView(view);
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

document.addEventListener('DOMContentLoaded', loadDB);
