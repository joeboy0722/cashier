/* ==========================================================================
   Antigravity 大螢幕出餐看板 邏輯 (JS)
   ========================================================================== */

const state = {
    preparingOrders: [],
    readyOrders: [],
    ws: null
};

const DOM = {
    clock: document.getElementById('display-clock-el'),
    preparingList: document.getElementById('preparing-list'),
    readyList: document.getElementById('ready-list'),
    wsDot: document.getElementById('ws-dot'),
    wsText: document.getElementById('ws-text')
};

// ----------------- 初始化 -----------------
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadActiveOrders();
    initWebSocket();
});

// ----------------- 時鐘功能 -----------------
function initClock() {
    const updateClock = () => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        DOM.clock.textContent = `${hrs}:${mins}:${secs}`;
    };
    updateClock();
    setInterval(updateClock, 1000);
}

// ----------------- 載入進行中訂單 -----------------
async function loadActiveOrders() {
    try {
        const res = await fetch('/api/orders/active');
        if (!res.ok) throw new Error("無法讀取進行中訂單");
        const orders = await res.json();
        
        // 拆分狀態
        state.preparingOrders = orders.filter(o => o.status === 'pending');
        state.readyOrders = orders.filter(o => o.status === 'ready');
        
        renderLists();
    } catch (err) {
        console.error("載入初始訂單失敗", err);
    }
}

function renderLists() {
    // 渲染準備中
    DOM.preparingList.innerHTML = '';
    state.preparingOrders.forEach(order => {
        const card = createOrderCard(order);
        DOM.preparingList.appendChild(card);
    });

    // 渲染請取餐
    DOM.readyList.innerHTML = '';
    state.readyOrders.forEach(order => {
        const card = createOrderCard(order);
        // 如果是剛重整，不要加上 newly-added 閃爍動畫，除非是 WS 即時推送
        DOM.readyList.appendChild(card);
    });
}

// 建立訂單卡片 DOM
function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.id = `order-card-${order.id}`;
    card.style.cssText = `
        padding: 16px;
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    
    let itemsHtml = order.items.map(item => {
        return `
            <div class="queue-item-row" style="font-size: 15px; color: #f8fafc; margin-top: 4px; display: flex; flex-direction: column; text-align: left; line-height: 1.4;">
                <div style="font-weight: 700;">${item.item_name} <span style="color: #ff9800; font-weight: 800; margin-left: 4px;">x${item.quantity}</span></div>
                ${item.notes ? `<span class="queue-item-notes" style="font-size: 12px; color: #f43f5e; font-weight: 800; padding-left: 10px; margin-top: 2px;">* ${item.notes}</span>` : ''}
            </div>
        `;
    }).join('');
    
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255, 255, 255, 0.1); padding-bottom:8px; margin-bottom:4px; width: 100%;">
            <span class="queue-number" style="font-size: 20px; font-weight: 800; color: #ff6f00;">#${order.id}</span>
            <span class="queue-table" style="font-size: 13px; font-weight: 700; background: #ff6f00; padding: 3px 10px; border-radius: 20px; color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${order.table_name}</span>
        </div>
        <div class="queue-items-list" style="width: 100%; display: flex; flex-direction: column; gap: 6px;">
            ${itemsHtml}
        </div>
    `;
    return card;
}

// ----------------- WebSocket 連線與即時事件 -----------------
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    state.ws = new WebSocket(wsUrl);
    
    state.ws.onopen = () => {
        DOM.wsText.textContent = '即時伺服器連線成功';
        DOM.wsDot.className = 'dot pulse-green';
    };
    
    state.ws.onclose = () => {
        DOM.wsText.textContent = '連線中斷，重新連線中...';
        DOM.wsDot.className = 'dot';
        setTimeout(initWebSocket, 3000);
    };
    
    state.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleWsEvent(msg);
    };
}

function handleWsEvent(msg) {
    console.log("出餐看板收到 WS 事件:", msg);
    const order = msg.data;
    
    if (msg.event === 'new_order') {
        // 新增至準備中
        if (!state.preparingOrders.some(o => o.id === order.id)) {
            state.preparingOrders.push(order);
            const card = createOrderCard(order);
            DOM.preparingList.appendChild(card);
            
            // 播放一聲短的叮咚提示音
            playChime(440, 'sine', 0.1);
        }
    } 
    else if (msg.event === 'status_updated') {
        const orderId = order.id;
        
        if (order.status === 'ready') {
            // 從「準備中」移至「請取餐」
            
            // 1. 移除準備中的資料與 DOM
            state.preparingOrders = state.preparingOrders.filter(o => o.id !== orderId);
            const preparingCard = document.getElementById(`order-card-${orderId}`);
            if (preparingCard) {
                preparingCard.classList.add('remove-out');
                preparingCard.addEventListener('animationend', () => preparingCard.remove());
            } else {
                // 防呆：若 DOM 不存在直接移除
                const card = document.getElementById(`order-card-${orderId}`);
                if (card) card.remove();
            }

            // 2. 加入請取餐的資料與 DOM
            if (!state.readyOrders.some(o => o.id === orderId)) {
                state.readyOrders.push(order);
                const readyCard = createOrderCard(order);
                readyCard.classList.add('newly-added'); // 加上呼吸發光效果
                DOM.readyList.appendChild(readyCard);
                
                // 3. 語音播報與音效 (Wow!)
                playPickupNotification(order);
            }
        } 
        else if (order.status === 'completed' || order.status === 'paid' || order.status === 'cancelled') {
            // 從列表移除 (已送餐/已付款/被取消)
            state.preparingOrders = state.preparingOrders.filter(o => o.id !== orderId);
            state.readyOrders = state.readyOrders.filter(o => o.id !== orderId);
            
            const card = document.getElementById(`order-card-${orderId}`);
            if (card) {
                card.classList.add('remove-out');
                card.addEventListener('animationend', () => card.remove());
            }
        }
    }
}

// ----------------- 音效與語音播報 (Wow Factor) -----------------

// 使用 Web Audio API 生成乾淨的電子叮咚提示音 (Chime)
function playChime(frequency, type, duration) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 建立雙音符叮咚聲
        const now = audioCtx.currentTime;
        
        // 音符 1
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        
        // 音符 2 (稍晚響起，音調較高)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5
        gain2.gain.setValueAtTime(0.15, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc1.start(now);
        osc1.stop(now + 0.3);
        
        osc2.start(now + 0.15);
        osc2.stop(now + 0.5);
    } catch (e) {
        console.error("無法播放音效", e);
    }
}

// 執行提示音 + TTS 播報
function playPickupNotification(order) {
    // 首先播放叮咚音效
    playChime();
    
    // 延遲一點點播放 TTS，語意更流暢
    setTimeout(() => {
        if ('speechSynthesis' in window) {
            const tableChinese = order.table_name.replace("Table", "桌號");
            const text = `請單號 ${order.id} 號， ${tableChinese} 的顧客，到櫃檯取餐。`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = 0.95; // 速度稍慢一點更清晰
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }, 600);
}
