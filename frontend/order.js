/* ==========================================================================
   Antigravity 點餐客戶端 邏輯 (JS)
   ========================================================================== */

// 點餐端狀態
const state = {
    mode: 'mobile', // 'mobile' (掃碼) 或 'tablet' (平板)
    tableName: '',   // 綁定桌號
    layoutConfig: {},
    categories: [],
    menuItems: [],
    cart: {}, // 格式: { itemId: { id, name, price, quantity } }
    selectedCategoryId: null // null 代表全部
};

// DOM 元素快照
const DOM = {
    bindScreen: document.getElementById('bind-screen'),
    bindTableSelect: document.getElementById('bind-table-select'),
    btnBindTable: document.getElementById('btn-bind-table'),
    
    orderScreen: document.getElementById('order-screen'),
    restaurantNameDisplay: document.getElementById('restaurant-name-display'),
    tableNameDisplay: document.getElementById('table-name-display'),
    btnUnbindTablet: document.getElementById('btn-unbind-tablet'),
    
    categoryNav: document.getElementById('category-nav-el'),
    menuItemsContainer: document.getElementById('menu-items-container'),
    
    cartBar: document.getElementById('cart-bar-el'),
    cartTrigger: document.getElementById('cart-trigger'),
    cartItemCount: document.getElementById('cart-item-count'),
    cartTotalPriceDisplay: document.getElementById('cart-total-price-display'),
    btnSubmitOrderTrigger: document.getElementById('btn-submit-order-trigger'),
    
    cartDrawerBackdrop: document.getElementById('cart-drawer-backdrop'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    cartItemsList: document.getElementById('cart-items-list'),
    drawerTotalPriceDisplay: document.getElementById('drawer-total-price-display'),
    btnClearCart: document.getElementById('btn-clear-cart'),
    btnSubmitOrderFinal: document.getElementById('btn-submit-order-final'),
    
    successOverlay: document.getElementById('success-overlay'),
    successTableName: document.getElementById('success-table-name'),
    successTimer: document.getElementById('success-timer'),
    toastContainer: document.getElementById('toast-container'),
    
    // 已點餐明細選取器
    btnViewOrdered: document.getElementById('btn-view-ordered'),
    modalOrderedHistory: document.getElementById('modal-ordered-history'),
    btnCloseOrderedModal: document.getElementById('btn-close-ordered-modal'),
    btnCloseOrderedModalBtn: document.getElementById('btn-close-ordered-modal-btn'),
    orderedHistoryList: document.getElementById('ordered-history-list'),
    
    // 商品規格客製選配選取器
    modalSpecSelect: document.getElementById('modal-spec-select'),
    btnCloseSpecModal: document.getElementById('btn-close-spec-modal'),
    specProductName: document.getElementById('spec-product-name'),
    specOptionsList: document.getElementById('spec-options-list'),
    btnSpecMinus: document.getElementById('btn-spec-minus'),
    btnSpecPlus: document.getElementById('btn-spec-plus'),
    specQuantity: document.getElementById('spec-quantity'),
    btnConfirmSpecAdd: document.getElementById('btn-confirm-spec-add'),
    specTotalPrice: document.getElementById('spec-total-price')
};

// ----------------- API 封裝 -----------------
const API = {
    async get(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP 錯誤: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`GET 失敗: ${url}`, err);
            showToast(`資料載入失敗: ${err.message}`, 'error');
            throw err;
        }
    },
    async post(url, data) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `HTTP 錯誤: ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`POST 失敗: ${url}`, err);
            showToast(`送出失敗: ${err.message}`, 'error');
            throw err;
        }
    }
};

// ----------------- 初始化與路由判斷 -----------------
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 判斷桌號與點餐模式
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const tabletBoundTable = localStorage.getItem('tablet_bound_table');
    
    if (tableParam) {
        // 手機掃碼點餐模式 (由 URL 帶參數)
        state.mode = 'mobile';
        state.tableName = tableParam;
        initOrderSystem();
    } else if (tabletBoundTable) {
        // 平板已綁定點餐模式 (由 localStorage 儲存)
        state.mode = 'tablet';
        state.tableName = tabletBoundTable;
        initOrderSystem();
    } else {
        // 未綁定，顯示平板綁定畫面
        state.mode = 'tablet';
        showBindScreen();
    }
    
    initEvents();
});

// ----------------- 平板綁定邏輯 -----------------
async function showBindScreen() {
    DOM.bindScreen.classList.remove('hidden');
    DOM.orderScreen.classList.add('hidden');
    
    try {
        const tables = await API.get('/api/tables');
        DOM.bindTableSelect.innerHTML = tables.map(t => `
            <option value="${t.name}">${t.name}</option>
        `).join('');
    } catch (err) {
        console.error("載入桌號列表失敗", err);
    }
}

// ----------------- 啟動點餐系統 -----------------
async function initOrderSystem() {
    DOM.bindScreen.classList.add('hidden');
    DOM.orderScreen.classList.remove('hidden');
    
    // 渲染桌號名稱
    DOM.tableNameDisplay.textContent = state.tableName;
    
    // 如果是平板模式，顯示「解除綁定」按鈕
    if (state.mode === 'tablet') {
        DOM.btnUnbindTablet.classList.remove('hidden');
    }
    
    // 載入介面視覺配置與菜單
    await loadLayoutConfig();
    await loadCategories();
    await loadMenuItems();
    
    // 檢查是否有已點餐點，並啟動定期狀態輪詢
    await checkActiveOrders();
    setInterval(checkActiveOrders, 8000);
    
    // 啟動即時同步連線
    initWebSocket();
}

// ----------------- 即時同步連線 (WebSocket) -----------------
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = async (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'categories_reordered' || msg.event === 'menu_updated') {
                loadCategories();
                loadMenuItems();
            } else if (msg.event === 'layout_updated') {
                loadLayoutConfig();
            } else if (msg.event === 'status_updated') {
                const order = msg.data;
                if (order && order.table_name === state.tableName) {
                    // 即時更新本桌訂單狀態與明細
                    await checkActiveOrders();
                    
                    if (order.status === 'ready') {
                        // 播放音效與語音播報
                        playChime();
                        const isTablet = state.mode === 'tablet';
                        const speechText = isTablet 
                            ? `桌號 ${state.tableName} 的餐點已製作完成。` 
                            : `您的餐點已製作完成，請至櫃台取餐。`;
                        playTextToSpeech(speechText);
                        
                        showToast(`🔔 餐點已完成！請至櫃台取餐`, 'success');
                        
                        // 自動開啟已點餐歷史 Modal 以便顧客確認取餐
                        showOrderedHistoryModal();
                    }
                }
            }
        } catch (e) {
            console.error("解析 WS 訊息失敗", e);
        }
    };
    
    ws.onclose = () => {
        setTimeout(initWebSocket, 5000); // 斷線自動重連
    };
}

// 檢查目前桌號是否有進行中的訂單
async function checkActiveOrders() {
    if (!state.tableName) return;
    try {
        const orders = await API.get('/api/orders/active');
        // 篩選出目前桌子的進行中訂單
        const tableOrders = orders.filter(o => o.table_name === state.tableName);
        
        if (tableOrders.length > 0) {
            // 有訂單，顯示「已點餐點」按鈕
            DOM.btnViewOrdered.classList.remove('hidden');
            
            // 如果此時「已點餐明細 Modal」剛好是開啟的，順便重新渲染狀態
            if (DOM.modalOrderedHistory.style.display === 'flex' || DOM.modalOrderedHistory.classList.contains('active')) {
                renderOrderedHistory(tableOrders);
            }
        } else {
            // 無訂單，隱藏「已點餐點」按鈕
            DOM.btnViewOrdered.classList.add('hidden');
            closeOrderedHistoryModal();
        }
    } catch (err) {
        console.error("檢查已點餐點狀態失敗", err);
    }
}

// 顯示已點餐明細 Modal
async function showOrderedHistoryModal() {
    try {
        const orders = await API.get('/api/orders/active');
        const tableOrders = orders.filter(o => o.table_name === state.tableName);
        
        renderOrderedHistory(tableOrders);
        
        DOM.modalOrderedHistory.style.display = 'flex';
        setTimeout(() => {
            DOM.modalOrderedHistory.classList.add('active');
        }, 10);
    } catch (err) {
        showToast("無法載入已點餐點歷史", "error");
    }
}

function renderOrderedHistory(tableOrders) {
    DOM.orderedHistoryList.innerHTML = '';
    
    if (tableOrders.length === 0) {
        DOM.orderedHistoryList.innerHTML = `
            <div style="text-align:center; padding:30px 0; color:var(--text-muted);">
                <i class="fa-solid fa-receipt" style="font-size:32px; margin-bottom:8px;"></i>
                <p>目前沒有進行中的點餐紀錄</p>
            </div>
        `;
        return;
    }
    
    tableOrders.forEach(order => {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'ordered-history-group';
        orderDiv.style.border = '1px solid #e2e8f0';
        orderDiv.style.borderRadius = '8px';
        orderDiv.style.padding = '12px';
        orderDiv.style.background = '#f8fafc';
        orderDiv.style.marginBottom = '12px';
        
        // 翻譯狀態與樣式
        let statusText = '準備中';
        let statusBadgeStyle = 'background: #fef3c7; color: #d97706;'; // 黃色
        
        if (order.status === 'unpaid') {
            statusText = '待付款 (請至櫃台)';
            statusBadgeStyle = 'background: #fee2e2; color: #dc2626; font-weight: bold;';
        } else if (order.status === 'ready') {
            statusText = '請取餐 (餐點完成)';
            statusBadgeStyle = 'background: #d1fae5; color: #059669; font-weight: bold;';
        } else if (order.status === 'completed') {
            statusText = '已出餐 / 待結帳';
            statusBadgeStyle = 'background: #e0f2fe; color: #0369a1; font-weight: bold;';
        }
        
        const dateStr = new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let itemsHtml = order.items.map(item => `
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-secondary); margin-bottom:6px;">
                <span>${item.item_name} <strong style="color:var(--text-primary);">x${item.quantity}</strong></span>
                <span>NT$ ${item.price * item.quantity}</span>
            </div>
        `).join('');
        
        orderDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:6px; border-bottom:1px dashed #e2e8f0; font-size:12px;">
                <span style="color:#64748b;">單號 #${order.id} (${dateStr})</span>
                <span style="padding:2px 8px; border-radius:10px; font-size:10px; ${statusBadgeStyle}">${statusText}</span>
            </div>
            <div class="ordered-items">
                ${itemsHtml}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:6px; border-top:1px solid #e2e8f0; font-size:13px; font-weight:bold;">
                <span>小計</span>
                <span style="color:var(--primary-color);">NT$ ${order.total_price}</span>
            </div>
        `;
        
        DOM.orderedHistoryList.appendChild(orderDiv);
    });
}

function closeOrderedHistoryModal() {
    DOM.modalOrderedHistory.classList.remove('active');
    setTimeout(() => {
        DOM.modalOrderedHistory.style.display = 'none';
    }, 300);
}

// 載入介面視覺配置並套用樣式引擎
async function loadLayoutConfig() {
    try {
        const config = await API.get(`/api/layout/${state.mode}`);
        state.layoutConfig = config;
        
        // 1. 渲染餐廳名稱
        DOM.restaurantNameDisplay.textContent = config.restaurantName || "行動美味餐廳";
        
        // 2. 套用主題顏色 (CSS 變數)
        document.documentElement.style.setProperty('--primary-color', config.primaryColor || '#ff6f00');
        
        // 計算 Hover 顏色 (此處使用簡單的 filter: brightness 或是直接用 CSS)
        document.documentElement.style.setProperty('--primary-hover', adjustColorBrightness(config.primaryColor || '#ff6f00', -15));
        
        // 3. 套用字型大小 (調整根 font-size)
        let fontSizePx = '16px';
        if (config.fontSize === 'small') fontSizePx = '14px';
        if (config.fontSize === 'large') fontSizePx = '18px';
        document.documentElement.style.fontSize = fontSizePx;
        
        // 4. 套用版面樣式 Class
        DOM.menuItemsContainer.className = `menu-grid layout-${config.layoutStyle || 'list'}`;
        
    } catch (err) {
        console.error("載入點餐介面配置失敗", err);
    }
}

// 輔助函式: 調暗十六進位顏色
function adjustColorBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}

// ----------------- 載入菜單與渲染 -----------------
async function loadCategories() {
    try {
        const categories = await API.get('/api/categories');
        state.categories = categories;
        renderCategoryNav(categories);
    } catch (err) {
        console.error("載入分類失敗", err);
    }
}

async function loadMenuItems() {
    try {
        const items = await API.get('/api/menu');
        state.menuItems = items;
        filterAndRenderMenu();
    } catch (err) {
        console.error("載入商品失敗", err);
    }
}

// 渲染滾動分類條
function renderCategoryNav(categories) {
    DOM.categoryNav.innerHTML = '';
    
    // 「全部商品」標籤
    const tabAll = document.createElement('span');
    tabAll.className = `category-tab ${state.selectedCategoryId === null ? 'active' : ''}`;
    tabAll.textContent = '全部商品';
    tabAll.addEventListener('click', () => {
        state.selectedCategoryId = null;
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tabAll.classList.add('active');
        filterAndRenderMenu();
    });
    DOM.categoryNav.appendChild(tabAll);
    
    // 各個分類標籤
    categories.forEach(cat => {
        const tab = document.createElement('span');
        tab.className = `category-tab ${state.selectedCategoryId === cat.id ? 'active' : ''}`;
        tab.textContent = cat.name;
        tab.addEventListener('click', () => {
            state.selectedCategoryId = cat.id;
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filterAndRenderMenu();
        });
        DOM.categoryNav.appendChild(tab);
    });
}

function filterAndRenderMenu() {
    if (state.selectedCategoryId === null) {
        renderMenuGrid(state.menuItems);
    } else {
        const filtered = state.menuItems.filter(item => item.category_id === state.selectedCategoryId);
        renderMenuGrid(filtered);
    }
}

function renderMenuGrid(items) {
    DOM.menuItemsContainer.innerHTML = '';
    
    if (items.length === 0) {
        DOM.menuItemsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-secondary);">
                <i class="fa-solid fa-cookie-bite" style="font-size:36px; margin-bottom:10px;"></i>
                <p>此分類目前沒有提供餐點</p>
            </div>
        `;
        return;
    }
    
    const showImages = state.layoutConfig.showImages !== false;
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `menu-item-order-card ${!item.is_available ? 'soldout' : ''} ${!showImages ? 'no-image' : ''}`;
        
        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
        
        card.innerHTML = `
            <div class="menu-item-img" style="background-image: url('${imgUrl}');"></div>
            <div class="menu-item-info">
                <div class="item-title-row">
                    <h3>${item.name}</h3>
                    <p class="item-desc-text">${item.description || '無描述'}</p>
                </div>
                <div class="item-bottom-row">
                    <span class="item-price">NT$ ${item.price}</span>
                    <button class="add-to-cart-btn" data-id="${item.id}">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
        
        // 點選加號
        card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(item);
        });
        
        DOM.menuItemsContainer.appendChild(card);
    });
}

// ----------------- 商品客製規格 Modal 邏輯 -----------------
const specState = {
    item: null,
    quantity: 1,
    totalAdj: 0
};

function openSpecModal(item) {
    specState.item = item;
    specState.quantity = 1;
    specState.totalAdj = 0;
    
    DOM.specProductName.textContent = item.name;
    DOM.specQuantity.textContent = 1;
    
    renderSpecOptions(item);
    calculateSpecTotalPrice();
    
    DOM.modalSpecSelect.style.display = 'flex';
    setTimeout(() => {
        DOM.modalSpecSelect.classList.add('active');
    }, 10);
}

function closeSpecModal() {
    DOM.modalSpecSelect.classList.remove('active');
    setTimeout(() => {
        DOM.modalSpecSelect.style.display = 'none';
        specState.item = null;
    }, 300);
}

function renderSpecOptions(item) {
    DOM.specOptionsList.innerHTML = '';
    
    let options = [];
    try {
        options = JSON.parse(item.options_json || '[]');
    } catch (e) {
        console.error("解析規格 JSON 失敗", e);
    }
    
    if (options.length === 0) return;
    
    options.forEach((group, gIdx) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'spec-group';
        groupDiv.style.marginBottom = '16px';
        
        const requiredLabel = group.required ? '<span style="color:var(--danger-color); font-size:11px; margin-left:4px;">(必選)</span>' : '';
        groupDiv.innerHTML = `
            <h5 style="font-size:13px; font-weight:700; color:#475569; margin-bottom:8px; text-align:left;">${group.name}${requiredLabel}</h5>
            <div class="spec-choices-container" style="display:flex; flex-direction:column; gap:8px;"></div>
        `;
        
        const container = groupDiv.querySelector('.spec-choices-container');
        
        if (group.type === 'quantity') {
            // 數量加購模式 (每個選項帶加減按鈕)
            group.choices.forEach(choice => {
                const choiceDiv = document.createElement('div');
                choiceDiv.className = 'spec-quantity-row';
                choiceDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: var(--radius-sm);
                    background: white;
                `;
                
                choiceDiv.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
                        <span style="font-weight:600; color:var(--text-primary);">${choice.name}</span>
                        ${choice.price_adj > 0 ? `<span style="color:var(--primary-color); font-weight:700; font-size:11px;">+NT$ ${choice.price_adj}/份</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <button type="button" class="spec-choice-qty-minus" style="width:26px; height:26px; border-radius:50%; border:1px solid #cbd5e1; background:white; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-minus" style="color: var(--text-secondary);"></i></button>
                        <span class="spec-choice-qty-val" data-group="${group.name}" data-name="${choice.name}" data-price="${choice.price_adj || 0}" style="font-weight:bold; min-width:16px; text-align:center;">0</span>
                        <button type="button" class="spec-choice-qty-plus" style="width:26px; height:26px; border-radius:50%; border:1px solid #cbd5e1; background:white; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-plus" style="color: var(--text-secondary);"></i></button>
                    </div>
                `;
                
                const minusBtn = choiceDiv.querySelector('.spec-choice-qty-minus');
                const plusBtn = choiceDiv.querySelector('.spec-choice-qty-plus');
                const valSpan = choiceDiv.querySelector('.spec-choice-qty-val');
                
                minusBtn.addEventListener('click', () => {
                    let val = parseInt(valSpan.textContent) || 0;
                    if (val > 0) {
                        val--;
                        valSpan.textContent = val;
                        // 更新邊框暗示
                        if (val === 0) {
                            choiceDiv.style.borderColor = '#cbd5e1';
                            choiceDiv.style.background = 'white';
                        }
                        calculateSpecTotalPrice();
                    }
                });
                
                plusBtn.addEventListener('click', () => {
                    let val = parseInt(valSpan.textContent) || 0;
                    val++;
                    valSpan.textContent = val;
                    // 更新邊框為已選取樣式
                    choiceDiv.style.borderColor = 'var(--primary-color)';
                    choiceDiv.style.background = 'rgba(255, 111, 0, 0.02)';
                    calculateSpecTotalPrice();
                });
                
                container.appendChild(choiceDiv);
            });
        } else {
            // 單選/多選勾選模式
            const isSingle = group.type === 'single';
            const inputName = `spec_group_${gIdx}`;
            
            group.choices.forEach((choice, cIdx) => {
                const label = document.createElement('label');
                label.className = 'spec-option-label';
                label.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                    background: white;
                `;
                
                const inputHtml = isSingle
                    ? `<input type="radio" name="${inputName}" class="spec-input" data-group="${group.name}" data-name="${choice.name}" data-price="${choice.price_adj || 0}" ${cIdx === 0 ? 'checked' : ''} style="accent-color: var(--primary-color);">`
                    : `<input type="checkbox" class="spec-input" data-group="${group.name}" data-name="${choice.name}" data-price="${choice.price_adj || 0}" style="accent-color: var(--primary-color);">`;
                    
                label.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${inputHtml}
                        <span style="font-weight:600; color:var(--text-primary);">${choice.name}</span>
                    </div>
                    ${choice.price_adj > 0 ? `<span style="color:var(--primary-color); font-weight:700;">+NT$ ${choice.price_adj}</span>` : ''}
                `;
                
                const input = label.querySelector('.spec-input');
                input.addEventListener('change', () => {
                    updateSpecLabelStyles(container, isSingle);
                    calculateSpecTotalPrice();
                });
                
                container.appendChild(label);
            });
            updateSpecLabelStyles(container, isSingle);
        }
        
        DOM.specOptionsList.appendChild(groupDiv);
    });
}

function updateSpecLabelStyles(container, isSingle) {
    const labels = container.querySelectorAll('.spec-option-label');
    labels.forEach(label => {
        const input = label.querySelector('.spec-input');
        if (input.checked) {
            label.style.borderColor = 'var(--primary-color)';
            label.style.background = 'rgba(255, 111, 0, 0.04)';
        } else {
            label.style.borderColor = '#cbd5e1';
            label.style.background = 'white';
        }
    });
}

function calculateSpecTotalPrice() {
    if (!specState.item) return;
    
    let totalAdj = 0;
    
    // 1. 單選/多選勾選加價
    const inputs = DOM.specOptionsList.querySelectorAll('.spec-input:checked');
    inputs.forEach(input => {
        totalAdj += parseFloat(input.getAttribute('data-price') || '0');
    });
    
    // 2. 數量加購加價
    const qtyVals = DOM.specOptionsList.querySelectorAll('.spec-choice-qty-val');
    qtyVals.forEach(span => {
        const qty = parseInt(span.textContent) || 0;
        const price = parseFloat(span.getAttribute('data-price') || '0');
        totalAdj += qty * price;
    });
    
    specState.totalAdj = totalAdj;
    const singlePrice = specState.item.price + totalAdj;
    const totalPrice = singlePrice * specState.quantity;
    
    DOM.specTotalPrice.textContent = `NT$ ${totalPrice}`;
}

// ----------------- 購物車功能 -----------------
function addToCart(item, customQuantity = 1, notes = "", customPrice = null, fromSpec = false) {
    // 檢查是否含有客製規格 JSON 且非空，且不是從規格 Modal 確認加入的，若是則進入選配視窗
    if (!fromSpec && item.options_json && JSON.parse(item.options_json || '[]').length > 0) {
        openSpecModal(item);
        return;
    }

    const finalPrice = customPrice !== null ? customPrice : item.price;
    // 建立唯一的購物車鍵值，區分同商品不同備註
    const cartKey = item.id + '_' + encodeURIComponent(notes);

    if (state.cart[cartKey]) {
        state.cart[cartKey].quantity += customQuantity;
    } else {
        state.cart[cartKey] = {
            cartKey: cartKey,
            id: item.id,
            name: item.name,
            basePrice: item.price,
            price: finalPrice,
            quantity: customQuantity,
            notes: notes
        };
    }
    
    showToast(`🛒 已加入購物車: ${item.name} ${notes ? `(${notes})` : ''}`);
    updateCartBar();
}

function updateCartBar() {
    let totalQty = 0;
    let totalPrice = 0;
    
    Object.values(state.cart).forEach(item => {
        totalQty += item.quantity;
        totalPrice += item.price * item.quantity;
    });
    
    if (totalQty > 0) {
        DOM.cartBar.classList.remove('hidden');
        DOM.cartItemCount.textContent = totalQty;
        DOM.cartTotalPriceDisplay.textContent = `NT$ ${totalPrice}`;
        DOM.drawerTotalPriceDisplay.textContent = `NT$ ${totalPrice}`;
    } else {
        DOM.cartBar.classList.add('hidden');
        closeCartDrawer();
    }
}

// 渲染購物車抽屜項目
function renderCartDrawer() {
    DOM.cartItemsList.innerHTML = '';
    
    const items = Object.values(state.cart);
    if (items.length === 0) {
        DOM.cartItemsList.innerHTML = `
            <div style="text-align:center; padding:40px 0; color:var(--text-muted);">
                <i class="fa-solid fa-cart-shopping" style="font-size:32px; margin-bottom:8px;"></i>
                <p>購物車是空的</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        
        row.innerHTML = `
            <div class="cart-item-info">
                <span class="cart-item-name">${item.name}</span>
                ${item.notes ? `<span class="cart-item-notes" style="font-size: 11px; color: #64748b; display: block; margin-top: 2px;">* ${item.notes}</span>` : ''}
                <span class="cart-item-price">NT$ ${item.price * item.quantity}</span>
            </div>
            <div class="quantity-control">
                <button class="quantity-btn btn-minus" data-id="${item.cartKey}"><i class="fa-solid fa-minus"></i></button>
                <span class="quantity-value">${item.quantity}</span>
                <button class="quantity-btn btn-plus" data-id="${item.cartKey}"><i class="fa-solid fa-plus"></i></button>
            </div>
        `;
        
        // 減數量
        row.querySelector('.btn-minus').addEventListener('click', () => {
            changeQuantity(item.cartKey, -1);
        });
        // 加數量
        row.querySelector('.btn-plus').addEventListener('click', () => {
            changeQuantity(item.cartKey, 1);
        });
        
        DOM.cartItemsList.appendChild(row);
    });
}

function changeQuantity(itemId, change) {
    if (!state.cart[itemId]) return;
    
    state.cart[itemId].quantity += change;
    
    if (state.cart[itemId].quantity <= 0) {
        delete state.cart[itemId];
    }
    
    updateCartBar();
    renderCartDrawer();
}

function openCartDrawer() {
    renderCartDrawer();
    DOM.cartDrawerBackdrop.style.display = 'block';
    // 給予些微延遲，確保 transition 能作用
    setTimeout(() => {
        DOM.cartDrawerBackdrop.classList.add('active');
    }, 10);
}

function closeCartDrawer() {
    DOM.cartDrawerBackdrop.classList.remove('active');
    setTimeout(() => {
        DOM.cartDrawerBackdrop.style.display = 'none';
    }, 300);
}

function clearCart() {
    if (confirm('確定清空購物車所有餐點嗎？')) {
        state.cart = {};
        updateCartBar();
        closeCartDrawer();
    }
}

// ----------------- 送出訂單 -----------------
async function submitOrder() {
    const items = Object.values(state.cart);
    if (items.length === 0) return;
    
    const paymentMode = state.layoutConfig.paymentMode || "post";
    
    const orderPayload = {
        table_name: state.tableName,
        items: items.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
            notes: item.notes || null,
            price: item.price
        })),
        payment_mode: paymentMode
    };
    
    try {
        await API.post('/api/orders', orderPayload);
        
        // 清空購物車並關閉抽屜
        state.cart = {};
        updateCartBar();
        closeCartDrawer();
        
        // 顯示點餐成功畫面
        showSuccessOverlay();
        
        // 送出成功後立即更新已點餐點狀態
        await checkActiveOrders();
        
    } catch (err) {
        showToast('送出訂單失敗，請稍後再試', 'error');
    }
}

function showSuccessOverlay() {
    DOM.successTableName.textContent = state.tableName;
    
    // 依付款模式更新顯示文字
    const titleEl = DOM.successOverlay.querySelector('h2');
    const pEl = DOM.successOverlay.querySelector('p');
    
    if (state.layoutConfig.paymentMode === 'pre') {
        titleEl.textContent = '訂單已建立！';
        pEl.textContent = '請至櫃台完成付款，付款後廚房將開始為您製作。';
    } else {
        titleEl.textContent = '點餐送出成功！';
        pEl.textContent = '廚房已收到您的訂單，餐點現點現做，請耐心等候。';
    }
    
    DOM.successOverlay.classList.remove('hidden');
    
    let countdown = 4; // 給予稍微長一點的時間讓客人看清楚字
    DOM.successTimer.textContent = countdown;
    
    const interval = setInterval(() => {
        countdown -= 1;
        DOM.successTimer.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(interval);
            DOM.successOverlay.classList.add('hidden');
        }
    }, 1000);
}

// ----------------- 事件綁定 -----------------
function initEvents() {
    // 1. 平板綁定動作
    DOM.btnBindTable.addEventListener('click', () => {
        const val = DOM.bindTableSelect.value;
        if (val) {
            localStorage.setItem('tablet_bound_table', val);
            state.tableName = val;
            state.mode = 'tablet';
            initOrderSystem();
        }
    });
    
    // 2. 解除平板綁定
    DOM.btnUnbindTablet.addEventListener('click', () => {
        if (confirm('是否要解除此平板桌號綁定？解除後將重新載入設定。')) {
            localStorage.removeItem('tablet_bound_table');
            window.location.reload();
        }
    });
    
    // 3. 購物車開關
    DOM.cartTrigger.addEventListener('click', openCartDrawer);
    DOM.btnCloseDrawer.addEventListener('click', closeCartDrawer);
    
    DOM.cartDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === DOM.cartDrawerBackdrop) closeCartDrawer();
    });
    
    // 4. 清空購物車與送出
    DOM.btnClearCart.addEventListener('click', clearCart);
    DOM.btnSubmitOrderTrigger.addEventListener('click', openCartDrawer); // 點擊直接開啟購物車確認
    DOM.btnSubmitOrderFinal.addEventListener('click', submitOrder);
    
    // 5. 查看已點餐點與關閉 Modal
    DOM.btnViewOrdered.addEventListener('click', showOrderedHistoryModal);
    DOM.btnCloseOrderedModal.addEventListener('click', closeOrderedHistoryModal);
    DOM.btnCloseOrderedModalBtn.addEventListener('click', closeOrderedHistoryModal);
    
    DOM.modalOrderedHistory.addEventListener('click', (e) => {
        if (e.target === DOM.modalOrderedHistory) closeOrderedHistoryModal();
    });
    
    // 6. 商品規格 Modal 的增減數量與確認加入
    DOM.btnCloseSpecModal.addEventListener('click', closeSpecModal);
    
    DOM.btnSpecMinus.addEventListener('click', () => {
        if (specState.quantity > 1) {
            specState.quantity -= 1;
            DOM.specQuantity.textContent = specState.quantity;
            calculateSpecTotalPrice();
        }
    });
    
    DOM.btnSpecPlus.addEventListener('click', () => {
        specState.quantity += 1;
        DOM.specQuantity.textContent = specState.quantity;
        calculateSpecTotalPrice();
    });
    
    DOM.modalSpecSelect.addEventListener('click', (e) => {
        if (e.target === DOM.modalSpecSelect) closeSpecModal();
    });
    
    DOM.btnConfirmSpecAdd.addEventListener('click', () => {
        if (!specState.item) return;
        
        // 檢查必選規格組
        let options = [];
        try {
            options = JSON.parse(specState.item.options_json || '[]');
        } catch (e) {}
        
        // 驗證必選組是否都有選中
        for (let i = 0; i < options.length; i++) {
            const group = options[i];
            if (group.required) {
                if (group.type === 'quantity') {
                    // 驗證此組所有選項的數量加總是否大於 0
                    const qtyVals = DOM.specOptionsList.querySelectorAll(`.spec-choice-qty-val[data-group="${group.name}"]`);
                    let sum = 0;
                    qtyVals.forEach(span => sum += parseInt(span.textContent) || 0);
                    if (sum === 0) {
                        showToast(`請選擇必填項目: ${group.name}`, 'error');
                        return;
                    }
                } else {
                    const checked = DOM.specOptionsList.querySelectorAll(`.spec-input[data-group="${group.name}"]:checked`);
                    if (checked.length === 0) {
                        showToast(`請選擇必填項目: ${group.name}`, 'error');
                        return;
                    }
                }
            }
        }
        
        const checkedInputs = DOM.specOptionsList.querySelectorAll('.spec-input:checked');
        const selectedNames = Array.from(checkedInputs).map(el => el.getAttribute('data-name'));
        
        // 額外收集大於 0 的數量加購選項
        const qtyVals = DOM.specOptionsList.querySelectorAll('.spec-choice-qty-val');
        qtyVals.forEach(span => {
            const qty = parseInt(span.textContent) || 0;
            if (qty > 0) {
                const name = span.getAttribute('data-name');
                selectedNames.push(`${name} x${qty}`);
            }
        });
        
        const notes = selectedNames.join(', ');
        
        const finalPrice = specState.item.price + specState.totalAdj;
        
        // 呼叫 addToCart 真正寫入 state.cart (傳入 fromSpec = true)
        addToCart(specState.item, specState.quantity, notes, finalPrice, true);
        closeSpecModal();
    });
}

// ----------------- Toast 通知系統 -----------------
function showToast(message, type = 'info') {
    const container = DOM.toastContainer;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fa-solid fa-info-circle"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-exclamation-circle"></i>';
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 2500);
}

// ----------------- 音效與語音播報系統 -----------------
function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch(e) {
        console.error("提示音效播放失敗", e);
    }
}

function playTextToSpeech(text) {
    try {
        if ('speechSynthesis' in window) {
            // 播放前先取消正在發聲的語音以防重疊
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-TW';
            utterance.rate = 0.95; // 稍慢一點比較自然
            window.speechSynthesis.speak(utterance);
        }
    } catch(e) {
        console.error("語音 TTS 播放失敗", e);
    }
}
