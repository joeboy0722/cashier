/* ==========================================================================
   後廚出餐工作看板 (KDS) 邏輯 (JS)
   ========================================================================== */

const API_BASE = '/cashier/api';

// 全域狀態
const state = {
    preparingOrders: [], // 製作中 (status: pending)
    readyOrders: [],     // 請取餐 (status: ready)
    ws: null
};

// DOM 快照
const DOM = {
    listPreparing: document.getElementById('list-preparing'),
    listReady: document.getElementById('list-ready'),
    countPreparing: document.getElementById('count-preparing'),
    countReady: document.getElementById('count-ready'),
    wsDot: document.getElementById('ws-dot'),
    wsText: document.getElementById('ws-text')
};

// ----------------- API 封裝 -----------------
const API = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP 錯誤: ${res.status}`);
        return await res.json();
    },
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`HTTP 錯誤: ${res.status}`);
        return await res.json();
    }
};

// ----------------- 頁面初始化 -----------------
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 載入進行中訂單
    await loadActiveOrders();
    
    // 2. 初始化 WebSocket 連線
    initWebSocket();
});

async function loadActiveOrders() {
    try {
        const orders = await API.get(`${API_BASE}/orders/active`);
        
        // 篩選狀態
        state.preparingOrders = orders.filter(o => o.status === 'pending');
        state.readyOrders = orders.filter(o => o.status === 'ready');
        
        renderAll();
    } catch (err) {
        console.error("載入後廚訂單失敗", err);
    }
}

// ----------------- 渲染邏輯 -----------------
function renderAll() {
    renderPreparingList();
    renderReadyList();
}

function renderPreparingList() {
    DOM.countPreparing.textContent = state.preparingOrders.length;
    
    if (state.preparingOrders.length === 0) {
        DOM.listPreparing.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check"></i>
                <p>目前沒有待製作餐點，可以稍作休息！</p>
            </div>
        `;
        return;
    }
    
    DOM.listPreparing.innerHTML = '';
    state.preparingOrders.forEach(order => {
        const card = createPreparingCard(order);
        DOM.listPreparing.appendChild(card);
    });
}

function renderReadyList() {
    DOM.countReady.textContent = state.readyOrders.length;
    
    if (state.readyOrders.length === 0) {
        DOM.listReady.innerHTML = `
            <div class="empty-state" style="padding: 40px 10px;">
                <i class="fa-solid fa-clipboard-check" style="font-size:32px;"></i>
                <p style="font-size:12px; margin-top:8px;">無待取餐點</p>
            </div>
        `;
        return;
    }
    
    DOM.listReady.innerHTML = '';
    state.readyOrders.forEach(order => {
        const card = createReadyCard(order);
        DOM.listReady.appendChild(card);
    });
}

// 建立準備中卡片 DOM
function createPreparingCard(order) {
    const card = document.createElement('div');
    card.className = 'kds-card';
    card.id = `order-card-${order.id}`;
    
    const dateStr = new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const itemsHtml = order.items.map(item => `
        <div class="item-row">
            <div class="item-title">
                <span>${item.item_name}</span>
                <span class="item-qty">x${item.quantity}</span>
            </div>
            ${item.notes ? `<span class="item-notes">* ${item.notes}</span>` : ''}
        </div>
    `).join('');
    
    card.innerHTML = `
        <div class="card-header">
            <span class="card-id">#${order.id} <span style="font-size:12px; color:var(--text-secondary); font-weight:normal;">(${dateStr})</span></span>
            <span class="card-table">${order.table_name}</span>
        </div>
        <div class="card-body">
            ${itemsHtml}
        </div>
        <div class="card-footer">
            <button class="btn-finish" data-id="${order.id}">
                <i class="fa-solid fa-circle-check"></i>
                <span>製作完成 (通知取餐)</span>
            </button>
        </div>
    `;
    
    // 綁定製作完成按鈕
    card.querySelector('.btn-finish').addEventListener('click', async () => {
        await setOrderStatus(order.id, 'ready');
    });
    
    return card;
}

// 建立請取餐卡片 DOM
function createReadyCard(order) {
    const card = document.createElement('div');
    card.className = 'ready-card';
    card.id = `order-card-${order.id}`;
    
    card.innerHTML = `
        <div class="ready-info">
            <span class="ready-title">單號 #${order.id}</span>
            <span class="ready-table">桌號：${order.table_name}</span>
        </div>
        <button class="btn-clear" data-id="${order.id}" title="完成取餐/清除卡片">
            <i class="fa-solid fa-check"></i>
        </button>
    `;
    
    // 綁定清除/已取餐按鈕
    card.querySelector('.btn-clear').addEventListener('click', async () => {
        await setOrderStatus(order.id, 'completed');
    });
    
    return card;
}

// 變更訂單狀態的 API 呼叫
async function setOrderStatus(orderId, status) {
    try {
        await API.put(`${API_BASE}/orders/${orderId}/status`, { status });
    } catch (err) {
        alert(`狀態變更失敗: ${err.message}`);
    }
}

// ----------------- WebSocket 連線與即時更新 -----------------
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/cashier/ws`;
    
    state.ws = new WebSocket(wsUrl);
    
    state.ws.onopen = () => {
        DOM.wsText.textContent = '即時伺服器連線成功';
        DOM.wsDot.className = 'status-dot active';
    };
    
    state.ws.onclose = () => {
        DOM.wsText.textContent = '連線中斷，重新連線中...';
        DOM.wsDot.className = 'status-dot';
        setTimeout(initWebSocket, 3000);
    };
    
    state.ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWsEvent(msg);
        } catch (e) {
            console.error("解析 WS 訊息失敗", e);
        }
    };
}

function handleWsEvent(msg) {
    const order = msg.data;
    if (!order) return;
    
    const orderId = order.id;
    console.log("KDS 收到 WS 事件:", msg);
    
    if (msg.event === 'new_order') {
        // 新訂單滑入：若是後付款模式，訂單直接是 pending 狀態，此時需要加入準備中列表
        if (order.status === 'pending') {
            if (!state.preparingOrders.some(o => o.id === orderId)) {
                state.preparingOrders.push(order);
                renderPreparingList();
                playChime(); // 響起清脆新單通知音
            }
        }
    } 
    else if (msg.event === 'status_updated') {
        // 狀態變更連動
        // 1. 先從所有清單中移除
        state.preparingOrders = state.preparingOrders.filter(o => o.id !== orderId);
        state.readyOrders = state.readyOrders.filter(o => o.id !== orderId);
        
        // 2. 根據最新狀態分流
        if (order.status === 'pending') {
            // 付款完成，新單送進後廚
            state.preparingOrders.push(order);
            playChime();
        } else if (order.status === 'ready') {
            // 製作完成，放入待取餐列表
            state.readyOrders.push(order);
        }
        
        // 重新渲染清單
        renderAll();
    }
}
