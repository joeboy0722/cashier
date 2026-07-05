/* ==========================================================================
   Antigravity 收銀系統管理後台 邏輯 (JS)
   ========================================================================== */

// 全域狀態管理
const state = {
    tables: [],
    categories: [],
    menuItems: [],
    currentTab: 'tab-cashier',
    selectedTable: null,
    selectedCategory: null, // null 代表全部
    currentDeviceType: 'mobile', // 'mobile' 或 'tablet'
    ipConfig: {
        configured_ip: '',
        internal_ip: '',
        active_ip: ''
    },
    ws: null
};

// DOM 元素快照
const DOM = {
    tabs: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    tabTitle: document.getElementById('current-tab-title'),
    tabDesc: document.getElementById('current-tab-desc'),
    wsStatus: document.getElementById('ws-status'),
    headerServerIp: document.getElementById('header-server-ip'),
    
    // 桌況與收銀
    tablesCashierGrid: document.getElementById('tables-cashier-grid'),
    orderDetailPanel: document.getElementById('order-detail-panel'),
    orderPanelContent: document.getElementById('order-panel-content'),
    detailTableName: document.getElementById('detail-table-name'),
    detailOrdersList: document.getElementById('detail-orders-list'),
    detailTotalAmount: document.getElementById('detail-total-amount'),
    btnCheckout: document.getElementById('btn-checkout'),
    btnClearTableOrders: document.getElementById('btn-clear-table-orders'),

    // 菜單管理
    categoryListUl: document.getElementById('category-list-ul'),
    activeCategoryName: document.getElementById('active-category-name'),
    itemsGridContainer: document.getElementById('items-grid-container'),
    btnAddCategoryModal: document.getElementById('btn-add-category-modal'),
    btnAddItemModal: document.getElementById('btn-add-item-modal'),
    modalCategory: document.getElementById('modal-category'),
    modalItem: document.getElementById('modal-item'),
    btnSaveCategory: document.getElementById('btn-save-category'),
    btnSaveItem: document.getElementById('btn-save-item'),
    itemCategorySelect: document.getElementById('item-category-select'),
    itemImageFile: document.getElementById('item-image-file'),
    btnTriggerUpload: document.getElementById('btn-trigger-upload'),
    itemImagePreviewDiv: document.getElementById('item-image-preview-div'),
    itemImagePreviewImg: document.getElementById('item-image-preview-img'),
    itemImageInput: document.getElementById('item-image-input'),
    
    // 規格編輯器
    btnAddSpecGroup: document.getElementById('btn-add-spec-group'),
    specEditorContainer: document.getElementById('spec-editor-container'),
    
    // 設計器
    btnDesignMobile: document.getElementById('btn-design-mobile'),
    btnDesignTablet: document.getElementById('btn-design-tablet'),
    designerRestaurantName: document.getElementById('designer-restaurant-name'),
    designerPrimaryColor: document.getElementById('designer-primary-color'),
    designerColorHex: document.getElementById('designer-color-hex'),
    designerLayoutStyle: document.getElementById('designer-layout-style'),
    designerPaymentMode: document.getElementById('designer-payment-mode'),
    designerFontSize: document.getElementById('designer-font-size'),
    designerShowImages: document.getElementById('designer-show-images'),
    btnSaveLayout: document.getElementById('btn-save-layout'),
    previewDeviceContainer: document.getElementById('preview-device-container'),
    previewScreen: document.getElementById('preview-screen'),
    previewRestaurantName: document.getElementById('preview-restaurant-name'),
    previewMenuList: document.getElementById('preview-menu-list'),
    
    // 桌號與 QR 碼
    ipConfigInput: document.getElementById('ip-config-input'),
    ipDetectBadge: document.getElementById('ip-detect-badge'),
    btnSaveIp: document.getElementById('btn-save-ip'),
    newTableName: document.getElementById('new-table-name'),
    btnCreateTable: document.getElementById('btn-create-table'),
    tablesManagerList: document.getElementById('tables-manager-list'),
    modalQrcode: document.getElementById('modal-qrcode'),
    qrModalTableName: document.getElementById('qr-modal-table-name'),
    qrModalUrl: document.getElementById('qr-modal-url'),
    qrcodeCanvas: document.getElementById('qrcode-canvas'),
    toastContainer: document.getElementById('toast-container')
};

// ----------------- API 請求封裝 -----------------
const API = {
    async get(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP 錯誤: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`API GET 失敗: ${url}`, err);
            showToast(`讀取失敗: ${err.message}`, 'error');
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
            console.error(`API POST 失敗: ${url}`, err);
            showToast(`送出失敗: ${err.message}`, 'error');
            throw err;
        }
    },
    async put(url, data) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `HTTP 錯誤: ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`API PUT 失敗: ${url}`, err);
            showToast(`更新失敗: ${err.message}`, 'error');
            throw err;
        }
    },
    async delete(url) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `HTTP 錯誤: ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`API DELETE 失敗: ${url}`, err);
            showToast(`刪除失敗: ${err.message}`, 'error');
            throw err;
        }
    }
};

// ----------------- 初始化連線與資料 -----------------
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initModals();
    initWebSocket();
    
    // 載入初始資料
    await loadIpConfig();
    await loadTables();
    await loadCategories();
    await loadMenuItems();
    await loadLayoutConfig();
    
    // 初始化事件監聽
    initEvents();
});

// ----------------- WebSocket 即時同步 -----------------
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    state.ws = new WebSocket(wsUrl);
    
    state.ws.onopen = () => {
        DOM.wsStatus.textContent = '即時同步中';
        DOM.wsStatus.previousElementSibling.className = 'dot pulse-green';
    };
    
    state.ws.onclose = () => {
        DOM.wsStatus.textContent = '連線已中斷 (嘗試重連)';
        DOM.wsStatus.previousElementSibling.className = 'dot';
        setTimeout(initWebSocket, 3000); // 3 秒後自動重連
    };
    
    state.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleWsEvent(msg);
    };
}

function handleWsEvent(msg) {
    console.log("收到 WebSocket 事件:", msg);
    
    if (msg.event === 'new_order') {
        const order = msg.data;
        showToast(`🔔 桌號 ${order.table_name} 有新訂單！總額 NT$ ${order.total_price}`, 'success');
        speakText(`收到新訂單，桌號 ${order.table_name}`);
        
        // 重新整理桌況與明細
        loadTables();
        if (state.selectedTable && state.selectedTable.name === order.table_name) {
            viewTableOrders(state.selectedTable);
        }
    } else if (msg.event === 'status_updated') {
        const order = msg.data;
        // 如果是已結帳
        if (order.status === 'paid') {
            showToast(`💰 訂單 #${order.id} (桌號 ${order.table_name}) 現場支付結帳成功`, 'success');
        }
        
        // 重新整理桌況
        loadTables();
        if (state.selectedTable && state.selectedTable.name === order.table_name) {
            viewTableOrders(state.selectedTable);
        }
    } else if (msg.event === 'tables_updated') {
        // 更新桌況
        renderTablesGrid(msg.data);
    }
}

// 語音合成播報 (TTS)
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// ----------------- 分頁切換 -----------------
function initTabs() {
    DOM.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // 更新按鈕樣式
            DOM.tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新內容顯示
            DOM.tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) content.classList.add('active');
            });
            
            state.currentTab = tabId;
            
            // 更新 Header 文字
            const title = btn.querySelector('span').textContent;
            DOM.tabTitle.textContent = title;
            
            if (tabId === 'tab-cashier') {
                DOM.tabDesc.textContent = '即時查看餐廳桌況，進行現場付費結帳與訂單明細管理。';
                loadTables();
            } else if (tabId === 'tab-menu') {
                DOM.tabDesc.textContent = '設定與組織您的餐點分類及單項品項。';
                loadCategories();
                loadMenuItems();
            } else if (tabId === 'tab-designer') {
                DOM.tabDesc.textContent = '打造專屬的點餐外觀，調整點餐系統的色調與版面設定。';
                loadLayoutConfig();
            } else if (tabId === 'tab-tables') {
                DOM.tabDesc.textContent = '建立您的餐廳桌號，填寫外網 IP 並生成對應點餐 QR Code。';
                loadTables();
            }
        });
    });
}

// ----------------- 基礎資料載入與渲染 -----------------

// 1. IP 配置
async function loadIpConfig() {
    try {
        const data = await API.get('/api/config/ip');
        state.ipConfig = data;
        
        DOM.ipConfigInput.value = data.configured_ip;
        DOM.ipDetectBadge.textContent = `預設內網: ${data.internal_ip}`;
        
        // 頂部 IP 狀態顯示
        DOM.headerServerIp.textContent = `IP: ${data.active_ip}`;
    } catch (err) {
        console.error("載入 IP 設定失敗", err);
    }
}

// 2. 桌號資料
async function loadTables() {
    try {
        const tables = await API.get('/api/tables');
        state.tables = tables;
        
        // 渲染收銀桌況
        renderTablesGrid(tables);
        // 渲染桌號管理列表
        renderTablesManagerList(tables);
    } catch (err) {
        console.error("載入桌號失敗", err);
    }
}

function renderTablesGrid(tables) {
    DOM.tablesCashierGrid.innerHTML = '';
    
    tables.forEach(table => {
        const card = document.createElement('div');
        card.className = `table-card status-${table.status}`;
        if (state.selectedTable && state.selectedTable.name === table.name) {
            card.classList.add('selected');
        }
        
        let statusDesc = '空閒';
        if (table.status === 'dining') statusDesc = '用餐中';
        else if (table.status === 'unpaid') statusDesc = '待付款';
        
        card.innerHTML = `
            <i class="fa-solid fa-utensils table-icon"></i>
            <span class="table-name">${table.name}</span>
            <span class="table-desc">${statusDesc}</span>
        `;
        
        card.addEventListener('click', () => {
            // 選中桌子
            document.querySelectorAll('.table-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedTable = table;
            viewTableOrders(table);
        });
        
        DOM.tablesCashierGrid.appendChild(card);
    });
}

// 檢視單桌訂單細節
async function viewTableOrders(table) {
    DOM.orderPanelContent.classList.add('hidden');
    DOM.orderDetailPanel.querySelector('.panel-empty-state').classList.add('hidden');
    
    DOM.detailTableName.textContent = table.name;
    
    // 渲染桌況標籤
    const badge = DOM.orderPanelContent.querySelector('.badge');
    badge.className = `badge badge-${table.status}`;
    
    let tableStatusText = '空閒';
    if (table.status === 'dining') tableStatusText = '用餐中';
    else if (table.status === 'unpaid') tableStatusText = '待付款';
    badge.textContent = tableStatusText;

    try {
        // 取得所有進行中訂單 (包含 unpaid, pending, ready)
        const orders = await API.get('/api/orders/active');
        // 篩選出目前桌子的訂單
        const tableOrders = orders.filter(o => o.table_name === table.name);
        
        DOM.detailOrdersList.innerHTML = '';
        let totalSum = 0;
        
        if (tableOrders.length === 0) {
            DOM.detailOrdersList.innerHTML = `
                <div class="text-center text-muted" style="padding: 40px 0;">
                    <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px;"></i>
                    <p style="font-size: 13px;">此桌目前無進行中的訂單</p>
                </div>
            `;
            DOM.btnCheckout.disabled = true;
        } else {
            DOM.btnCheckout.disabled = false;
            
            // 檢查是否有待付款訂單
            const hasUnpaid = tableOrders.some(o => o.status === 'unpaid');
            if (hasUnpaid) {
                DOM.btnCheckout.innerHTML = '<i class="fa-solid fa-check"></i> 確認收款並送單製作';
            } else {
                // 檢查是否全為已預付款訂單
                const isAllPrepaid = tableOrders.every(o => o.payment_method === 'Prepaid');
                if (isAllPrepaid) {
                    DOM.btnCheckout.innerHTML = '<i class="fa-solid fa-circle-check"></i> 用餐完畢 (清理桌位)';
                } else {
                    DOM.btnCheckout.innerHTML = '<i class="fa-solid fa-dollar-sign"></i> 現場支付結帳';
                }
            }
            
            tableOrders.forEach(order => {
                totalSum += order.total_price;
                const dateStr = new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                const groupCard = document.createElement('div');
                groupCard.className = 'order-group-card';
                
                let itemsHtml = order.items.map(item => `
                    <div class="order-item-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span class="order-item-name">${item.item_name} <span class="order-item-qty">x${item.quantity}</span></span>
                            <span class="order-item-price">NT$ ${item.price * item.quantity}</span>
                        </div>
                        ${item.notes ? `<span style="font-size: 11px; color: #dc2626; font-weight: 600; padding-left: 8px;">* ${item.notes}</span>` : ''}
                    </div>
                `).join('');
                
                let orderStatusText = '準備中';
                if (order.status === 'unpaid') orderStatusText = '待付款';
                else if (order.status === 'ready') orderStatusText = '請取餐';
                else if (order.status === 'completed') orderStatusText = '已送餐';
                
                groupCard.innerHTML = `
                    <div class="order-group-header">
                        <span>訂單編號 #${order.id} (${dateStr})</span>
                        <span class="status-badge" style="${order.status === 'unpaid' ? 'color: var(--danger-color); font-weight: bold;' : ''}">${orderStatusText}</span>
                    </div>
                    <div class="order-items-list">
                        ${itemsHtml}
                    </div>
                `;
                
                DOM.detailOrdersList.appendChild(groupCard);
            });
        }
        
        DOM.detailTotalAmount.textContent = `NT$ ${totalSum}`;
        DOM.orderPanelContent.classList.remove('hidden');
        
    } catch (err) {
        console.error("載入該桌訂單失敗", err);
    }
}

// 現場支付結帳 / 確認收款 動作
async function handleCheckout() {
    if (!state.selectedTable) return;
    const tableName = state.selectedTable.name;
    
    try {
        // 取得該桌進行中的訂單
        const activeOrders = await API.get('/api/orders/active');
        const tableOrders = activeOrders.filter(o => o.table_name === tableName);
        
        const hasUnpaid = tableOrders.some(o => o.status === 'unpaid');
        
        if (hasUnpaid) {
            // 先付款模式下確認收款，變更狀態為 pending (準備中，送廚房)
            if (confirm(`確認已收取 [${tableName}] 現金付款？\n確認後訂單將送至大螢幕與廚房製作。`)) {
                const unpaidOrders = tableOrders.filter(o => o.status === 'unpaid');
                for (const order of unpaidOrders) {
                    await API.put(`/api/orders/${order.id}/status`, { status: "pending" });
                }
                showToast(`💸 ${tableName} 已完成收款並已送單`, 'success');
                state.selectedTable = null;
                
                await loadTables();
                DOM.orderPanelContent.classList.add('hidden');
                DOM.orderDetailPanel.querySelector('.panel-empty-state').classList.remove('hidden');
            }
        } else {
            const isAllPrepaid = tableOrders.every(o => o.payment_method === 'Prepaid');
            
            if (isAllPrepaid) {
                // 先付款模式下用餐完畢清理桌位
                if (confirm(`確認 [${tableName}] 顧客已用餐完畢離席？\n確認後桌位將釋放重設為空閒。`)) {
                    for (const order of tableOrders) {
                        await API.put(`/api/orders/${order.id}/status`, { status: "paid" });
                    }
                    showToast(`🧹 ${tableName} 用餐完畢，桌位已釋放`, 'success');
                    state.selectedTable = null;
                    
                    await loadTables();
                    DOM.orderPanelContent.classList.add('hidden');
                    DOM.orderDetailPanel.querySelector('.panel-empty-state').classList.remove('hidden');
                }
            } else {
                // 後付款模式下現場付款結帳，變更狀態為 paid (已結帳)
                if (confirm(`確認對 [${tableName}] 進行現場結帳與收銀？`)) {
                    for (const order of tableOrders) {
                        await API.put(`/api/orders/${order.id}/status`, { status: "paid" });
                    }
                    showToast(`💰 ${tableName} 已現場結帳完成`, 'success');
                    state.selectedTable = null;
                    
                    await loadTables();
                    DOM.orderPanelContent.classList.add('hidden');
                    DOM.orderDetailPanel.querySelector('.panel-empty-state').classList.remove('hidden');
                }
            }
        }
        
    } catch (err) {
        showToast(`操作失敗: ${err.message}`, 'error');
    }
}

// 3. 菜單分類與品項
async function loadCategories() {
    try {
        const categories = await API.get('/api/categories');
        state.categories = categories;
        
        // 渲染側邊分類
        renderCategoryList(categories);
        // 渲染新增品項 Modal 的 Select 選項
        renderCategorySelect(categories);
    } catch (err) {
        console.error("載入分類失敗", err);
    }
}

async function loadMenuItems() {
    try {
        const items = await API.get('/api/menu');
        state.menuItems = items;
        renderItemsGrid(items);
    } catch (err) {
        console.error("載入菜單失敗", err);
    }
}

function renderCategoryList(categories) {
    DOM.categoryListUl.innerHTML = '';
    
    // "全部" 分類 (固定首位，不可拖曳)
    const liAll = document.createElement('li');
    liAll.className = `category-item ${state.selectedCategory === null ? 'active' : ''}`;
    liAll.innerHTML = `<span><i class="fa-solid fa-list"></i> 全部商品</span>`;
    liAll.addEventListener('click', () => {
        state.selectedCategory = null;
        document.querySelectorAll('.category-item').forEach(li => li.classList.remove('active'));
        liAll.classList.add('active');
        DOM.activeCategoryName.textContent = '全部';
        filterAndRenderItems();
    });
    DOM.categoryListUl.appendChild(liAll);
    
    // 動態載入分類 (支援拖曳排序)
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.className = `category-item ${state.selectedCategory === cat.id ? 'active' : ''}`;
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-id', cat.id);
        
        li.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                <i class="fa-solid fa-bars drag-handle" title="按住拖曳調整順序"></i>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-folder-open"></i> ${cat.name}</span>
            </div>
            <span class="category-item-actions" style="flex-shrink: 0;">
                <button class="btn-delete-cat" data-id="${cat.id}"><i class="fa-solid fa-trash-can"></i></button>
            </span>
        `;
        
        li.addEventListener('click', (e) => {
            // 如果點擊了刪除按鈕或把手
            if (e.target.closest('.btn-delete-cat') || e.target.closest('.drag-handle')) return;
            
            state.selectedCategory = cat.id;
            document.querySelectorAll('.category-item').forEach(li => li.classList.remove('active'));
            li.classList.add('active');
            DOM.activeCategoryName.textContent = cat.name;
            filterAndRenderItems();
        });
        
        // 綁定拖曳開始
        li.addEventListener('dragstart', (e) => {
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', cat.id);
        });
        
        // 綁定拖曳結束
        li.addEventListener('dragend', async () => {
            li.classList.remove('dragging');
            
            // 重新計算 display_order
            const items = Array.from(DOM.categoryListUl.querySelectorAll('li.category-item'));
            const sortedCats = items
                .filter(el => el.getAttribute('data-id') !== null)
                .map((el, index) => {
                    return {
                        id: parseInt(el.getAttribute('data-id')),
                        display_order: index
                    };
                });
            
            try {
                await API.post('/api/categories/reorder', sortedCats);
                showToast('☰ 分類順序已更新', 'success');
                
                // 重新載入分類狀態但不要重新渲染分類列表以免 DOM 被打亂，只重新渲染 Select 選項
                const updatedCats = await API.get('/api/categories');
                state.categories = updatedCats;
                renderCategorySelect(updatedCats);
            } catch (err) {
                showToast('更新分類順序失敗', 'error');
            }
        });
        
        // 綁定分類刪除
        const delBtn = li.querySelector('.btn-delete-cat');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`確定刪除分類「${cat.name}」？此操作會一併刪除該分類下所有商品！`)) {
                try {
                    await API.delete(`/api/categories/${cat.id}`);
                    showToast('分類已成功刪除', 'success');
                    await loadCategories();
                    await loadMenuItems();
                } catch (err) {
                    showToast('刪除分類失敗', 'error');
                }
            }
        });
        
        DOM.categoryListUl.appendChild(li);
    });
}

function renderCategorySelect(categories) {
    DOM.itemCategorySelect.innerHTML = categories.map(cat => `
        <option value="${cat.id}">${cat.name}</option>
    `).join('');
}

function filterAndRenderItems() {
    if (state.selectedCategory === null) {
        renderItemsGrid(state.menuItems);
    } else {
        const filtered = state.menuItems.filter(item => item.category_id === state.selectedCategory);
        renderItemsGrid(filtered);
    }
}

function renderItemsGrid(items) {
    DOM.itemsGridContainer.innerHTML = '';
    
    if (items.length === 0) {
        DOM.itemsGridContainer.innerHTML = `
            <div class="card text-center text-muted" style="grid-column: 1 / -1; padding: 60px;">
                <i class="fa-solid fa-utensils" style="font-size: 40px; margin-bottom: 12px; color: var(--text-muted);"></i>
                <h4>目前沒有商品</h4>
                <p style="font-size: 13px;">點擊右上方「新增品項」為此分類建立餐點。</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = `menu-item-card ${!item.is_available ? 'soldout' : ''}`;
        
        // 找出分類名稱
        const catObj = state.categories.find(c => c.id === item.category_id);
        const catName = catObj ? catObj.name : '未分類';
        
        // 商品預設圖片
        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
        
        card.innerHTML = `
            <div class="item-img" style="background-image: url('${imgUrl}');">
                ${!item.is_available ? '<span class="item-badge-soldout">已停售</span>' : ''}
            </div>
            <div class="item-card-body">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${item.name}</h4>
                    <span class="badge" style="background: rgba(255,255,255,0.05); font-size:10px;">${catName}</span>
                </div>
                <p>${item.description || '無商品描述'}</p>
                <div class="item-price-row">
                    <span class="price">NT$ ${item.price}</span>
                    <div class="item-actions">
                        <button class="btn-edit-item" title="編輯"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-delete-item" title="刪除"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            </div>
        `;
        
        // 綁定編輯
        card.querySelector('.btn-edit-item').addEventListener('click', () => {
            openEditItemModal(item);
        });
        
        // 綁定刪除
        card.querySelector('.btn-delete-item').addEventListener('click', async () => {
            if (confirm(`確認刪除品項「${item.name}」？`)) {
                try {
                    await API.delete(`/api/menu/${item.id}`);
                    showToast('商品已刪除', 'success');
                    await loadMenuItems();
                } catch (err) {
                    showToast('刪除商品失敗', 'error');
                }
            }
        });
        
        DOM.itemsGridContainer.appendChild(card);
    });
}

// ----------------- 點餐介面設計器 -----------------
async function loadLayoutConfig() {
    try {
        const config = await API.get(`/api/layout/${state.currentDeviceType}`);
        
        // 設定表單值
        DOM.designerRestaurantName.value = config.restaurantName || '';
        DOM.designerPrimaryColor.value = config.primaryColor || '#ff6f00';
        DOM.designerColorHex.textContent = config.primaryColor || '#ff6f00';
        DOM.designerLayoutStyle.value = config.layoutStyle || 'list';
        DOM.designerPaymentMode.value = config.paymentMode || 'post';
        DOM.designerFontSize.value = config.fontSize || 'medium';
        DOM.designerShowImages.checked = config.showImages !== false;
        
        updateLivePreview();
    } catch (err) {
        console.error("載入介面配置失敗", err);
    }
}

function updateLivePreview() {
    const resName = DOM.designerRestaurantName.value || '行動美味餐廳';
    const primaryColor = DOM.designerPrimaryColor.value;
    const layoutStyle = DOM.designerLayoutStyle.value;
    const fontSize = DOM.designerFontSize.value;
    const showImages = DOM.designerShowImages.checked;
    
    // 更新預覽畫面文字
    DOM.previewRestaurantName.textContent = resName;
    
    // 更新 CSS 變數
    DOM.previewScreen.style.setProperty('--p-color', primaryColor);
    
    // 更新字型大小變數
    let fs = '13px';
    if (fontSize === 'small') fs = '11px';
    if (fontSize === 'large') fs = '15px';
    DOM.previewScreen.style.setProperty('--font-s', fs);
    
    // 更新版面 layout class
    DOM.previewScreen.className = `device-screen layout-${layoutStyle}`;
    
    // 動態調整預覽商品卡片圖片與結構
    const cards = DOM.previewMenuList.querySelectorAll('.preview-card');
    cards.forEach(card => {
        const img = card.querySelector('.preview-card-img');
        if (showImages) {
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }
    });
}

async function saveLayoutConfig() {
    const data = {
        restaurantName: DOM.designerRestaurantName.value,
        primaryColor: DOM.designerPrimaryColor.value,
        layoutStyle: DOM.designerLayoutStyle.value,
        paymentMode: DOM.designerPaymentMode.value,
        fontSize: DOM.designerFontSize.value,
        showImages: DOM.designerShowImages.checked
    };
    
    try {
        await API.post(`/api/layout/${state.currentDeviceType}`, data);
        showToast('🎨 介面視覺配置已儲存！', 'success');
    } catch (err) {
        showToast('儲存視覺配置失敗', 'error');
    }
}

// ----------------- 桌位與 QR Code 管理 -----------------
function renderTablesManagerList(tables) {
    DOM.tablesManagerList.innerHTML = '';
    
    tables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'table-manager-card';
        
        card.innerHTML = `
            <div class="table-manager-info">
                <i class="fa-solid fa-table-cells"></i>
                <span class="table-manager-name">${table.name}</span>
            </div>
            <div class="table-manager-actions">
                <button class="btn btn-sm btn-primary btn-generate-qr"><i class="fa-solid fa-qrcode"></i> QR Code</button>
                <button class="btn btn-sm btn-danger btn-delete-table"><i class="fa-solid fa-trash-can"></i> 刪除</button>
            </div>
        `;
        
        // 綁定生成 QR Code
        card.querySelector('.btn-generate-qr').addEventListener('click', () => {
            showQrCodeModal(table.name);
        });
        
        // 綁定刪除桌子
        card.querySelector('.btn-delete-table').addEventListener('click', async () => {
            if (confirm(`確定刪除「${table.name}」？此操作不會影響已完成的訂單。`)) {
                try {
                    await API.delete(`/api/tables/${table.name}`);
                    showToast('桌位已成功移除', 'success');
                    await loadTables();
                } catch (err) {
                    showToast('移除桌位失敗', 'error');
                }
            }
        });
        
        DOM.tablesManagerList.appendChild(card);
    });
}

// 生成並彈出 QR Code Modal
function showQrCodeModal(tableName) {
    DOM.qrModalTableName.textContent = tableName;
    DOM.qrcodeCanvas.innerHTML = ''; // 清空先前的 QR Code
    
    // 計算點餐 URL
    const activeIp = state.ipConfig.active_ip;
    const port = window.location.port ? `:${window.location.port}` : '';
    
    // 如果 activeIp 本身已經包含協議 (http/https)，直接使用；否則自動補上 http
    let baseUrl = activeIp;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}${port}`;
    }
    
    const qrUrl = `${baseUrl}/cashier/frontend/order.html?table=${encodeURIComponent(tableName)}`;
    DOM.qrModalUrl.textContent = qrUrl;
    
    // 呼叫 qrcode.js 生成
    new QRCode(DOM.qrcodeCanvas, {
        text: qrUrl,
        width: 180,
        height: 180,
        colorDark : "#0f172a",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    openModal(DOM.modalQrcode);
}

// ----------------- MODAL 管理 -----------------
function initModals() {
    document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
}

function openModal(modalEl) {
    modalEl.classList.add('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ----------------- 圖形化規格編輯器邏輯 -----------------
function addSpecGroupToEditor(groupData = null) {
    const groupCard = document.createElement('div');
    groupCard.className = 'spec-editor-card';
    groupCard.style.cssText = `
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 12px;
        background: rgba(255, 255, 255, 0.02);
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: relative;
        margin-bottom: 12px;
    `;
    
    const groupName = groupData ? groupData.name : '';
    const groupType = groupData ? groupData.type : 'single';
    const isRequired = groupData ? groupData.required : false;
    
    groupCard.innerHTML = `
        <button type="button" class="btn-remove-group" style="position:absolute; top:8px; right:8px; background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:14px;" title="刪除規格組"><i class="fa-solid fa-trash-can"></i></button>
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:8px; margin-right: 24px;">
            <div>
                <label style="font-size:10px; color:var(--text-secondary); display:block; margin-bottom:4px;">規格組名稱 (如: 甜度, 加料)</label>
                <input type="text" class="form-control spec-group-name" value="${groupName}" placeholder="例如: 冰量" style="font-size:11px; padding:4px 8px; height:28px;">
            </div>
            <div>
                <label style="font-size:10px; color:var(--text-secondary); display:block; margin-bottom:4px;">選擇類型</label>
                <select class="form-control spec-group-type" style="font-size:11px; padding:4px 8px; height:28px;">
                    <option value="single" ${groupType === 'single' ? 'selected' : ''}>單選 (Radio)</option>
                    <option value="multiple" ${groupType === 'multiple' ? 'selected' : ''}>多選 (Checkbox)</option>
                    <option value="quantity" ${groupType === 'quantity' ? 'selected' : ''}>數量加購 (Quantity)</option>
                </select>
            </div>
            <div style="display:flex; align-items:center; justify-content:center; padding-top:14px;">
                <label class="switch-container" style="font-size:10px; display:flex; align-items:center;">
                    <input type="checkbox" class="spec-group-required" ${isRequired ? 'checked' : ''}>
                    <span class="switch-slider" style="width:24px; height:14px; min-width:24px;"></span>
                    <span class="switch-label" style="font-size:10px; margin-left:4px;">必填</span>
                </label>
            </div>
        </div>
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:10px; font-weight:700; color:var(--text-secondary);">選項與加購金額</span>
                <button type="button" class="btn btn-sm btn-add-choice" style="font-size:9px; padding:2px 6px; background:rgba(255,255,255,0.06); border:1px solid var(--border-color); color:var(--text-primary); display:flex; align-items:center; gap:3px;"><i class="fa-solid fa-plus"></i> 新增選項</button>
            </div>
            <div class="choices-editor-container" style="display:flex; flex-direction:column; gap:6px;">
                <!-- 動態選項欄位 -->
            </div>
        </div>
    `;
    
    const choicesContainer = groupCard.querySelector('.choices-editor-container');
    
    // 綁定「新增選項」動作
    groupCard.querySelector('.btn-add-choice').addEventListener('click', () => {
        addChoiceRowToGroup(choicesContainer);
    });
    
    // 綁定「刪除規格組」動作
    groupCard.querySelector('.btn-remove-group').addEventListener('click', () => {
        if (confirm("確認要刪除此規格組嗎？")) {
            groupCard.remove();
        }
    });
    
    // 如果有現成資料，載入選項
    if (groupData && groupData.choices) {
        groupData.choices.forEach(choice => {
            addChoiceRowToGroup(choicesContainer, choice);
        });
    } else {
        // 新增時，預設帶兩筆空白選項
        addChoiceRowToGroup(choicesContainer);
        addChoiceRowToGroup(choicesContainer);
    }
    
    DOM.specEditorContainer.appendChild(groupCard);
}

function addChoiceRowToGroup(container, choiceData = null) {
    const row = document.createElement('div');
    row.className = 'choice-row';
    row.style.cssText = `
        display: grid;
        grid-template-columns: 2fr 1fr 24px;
        gap: 8px;
        align-items: center;
    `;
    
    const choiceName = choiceData ? choiceData.name : '';
    const choicePrice = choiceData ? (choiceData.price_adj || 0) : 0;
    
    row.innerHTML = `
        <input type="text" class="form-control choice-name" value="${choiceName}" placeholder="選項名稱 (如: 半糖, 加大)" style="font-size:11px; padding:4px 8px; height:24px;">
        <input type="number" class="form-control choice-price" value="${choicePrice}" placeholder="加價" style="font-size:11px; padding:4px 8px; height:24px;">
        <button type="button" class="btn-remove-choice" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;" title="移除選項"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
    });
    
    container.appendChild(row);
}

// 收集編輯器中的規格並組裝成 JSON 字串
function collectSpecsFromEditor() {
    const cards = DOM.specEditorContainer.querySelectorAll('.spec-editor-card');
    const options = [];
    
    cards.forEach(card => {
        const groupName = card.querySelector('.spec-group-name').value.trim();
        if (!groupName) return; // 規格名稱必填
        
        const groupType = card.querySelector('.spec-group-type').value;
        const groupRequired = card.querySelector('.spec-group-required').checked;
        
        const choices = [];
        const rows = card.querySelectorAll('.choice-row');
        rows.forEach(row => {
            const choiceName = row.querySelector('.choice-name').value.trim();
            if (!choiceName) return; // 選項名稱必填
            
            const choicePrice = parseFloat(row.querySelector('.choice-price').value) || 0;
            choices.push({
                name: choiceName,
                price_adj: choicePrice
            });
        });
        
        if (choices.length > 0) {
            options.push({
                name: groupName,
                type: groupType,
                required: groupRequired,
                choices: choices
            });
        }
    });
    
    return options.length > 0 ? JSON.stringify(options) : null;
}

// 點餐品項新增/編輯 Modal
function openAddItemModal() {
    document.getElementById('item-modal-title').textContent = '新增菜單品項';
    document.getElementById('item-id-input').value = '';
    document.getElementById('item-name-input').value = '';
    document.getElementById('item-price-input').value = '';
    DOM.itemImageInput.value = '';
    document.getElementById('item-desc-input').value = '';
    document.getElementById('item-available-input').checked = true;
    
    // 清空規格編輯器
    DOM.specEditorContainer.innerHTML = '';
    
    // 清除上傳與預覽狀態
    DOM.itemImageFile.value = '';
    DOM.itemImagePreviewDiv.style.display = 'none';
    DOM.itemImagePreviewImg.src = '';
    
    openModal(DOM.modalItem);
}

function openEditItemModal(item) {
    document.getElementById('item-modal-title').textContent = '編輯菜單品項';
    document.getElementById('item-id-input').value = item.id;
    document.getElementById('item-name-input').value = item.name;
    document.getElementById('item-category-select').value = item.category_id;
    document.getElementById('item-price-input').value = item.price;
    DOM.itemImageInput.value = item.image_url || '';
    document.getElementById('item-desc-input').value = item.description || '';
    document.getElementById('item-available-input').checked = item.is_available;
    
    // 清空並加載規格編輯器
    DOM.specEditorContainer.innerHTML = '';
    if (item.options_json) {
        try {
            const options = JSON.parse(item.options_json);
            options.forEach(group => addSpecGroupToEditor(group));
        } catch (e) {
            console.error("解析品項規格 JSON 失敗", e);
        }
    }
    
    // 設定上傳與預覽狀態
    DOM.itemImageFile.value = '';
    if (item.image_url) {
        DOM.itemImagePreviewImg.src = item.image_url;
        DOM.itemImagePreviewDiv.style.display = 'block';
    } else {
        DOM.itemImagePreviewDiv.style.display = 'none';
        DOM.itemImagePreviewImg.src = '';
    }
    
    openModal(DOM.modalItem);
}

// ----------------- 事件監聽初始化 -----------------
function initEvents() {
    // 1. 收銀結帳按鈕
    DOM.btnCheckout.addEventListener('click', handleCheckout);
    
    // 2. 新增分類 Modal 彈出與儲存
    DOM.btnAddCategoryModal.addEventListener('click', () => {
        document.getElementById('category-name-input').value = '';
        document.getElementById('category-order-input').value = '0';
        openModal(DOM.modalCategory);
    });
    
    DOM.btnSaveCategory.addEventListener('click', async () => {
        const name = document.getElementById('category-name-input').value.trim();
        const displayOrder = parseInt(document.getElementById('category-order-input').value) || 0;
        
        if (!name) {
            showToast('請填寫分類名稱', 'error');
            return;
        }
        
        try {
            await API.post('/api/categories', { name, display_order: displayOrder });
            showToast('分類新增成功', 'success');
            closeAllModals();
            await loadCategories();
        } catch (err) {
            // 錯誤訊息由 API.post 拋出處理
        }
    });

    // 分類拖曳排序 dragover 插入位置計算
    DOM.categoryListUl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingLi = DOM.categoryListUl.querySelector('.dragging');
        if (!draggingLi) return;
        
        const siblings = Array.from(DOM.categoryListUl.querySelectorAll('li.category-item:not(.dragging)'));
        
        // 尋找目標放置位置 (不允許插在「全部」分類之前，因為 data-id 為 null)
        const targetSibling = siblings.find(sibling => {
            if (sibling.getAttribute('data-id') === null) return false;
            
            const rect = sibling.getBoundingClientRect();
            return e.clientY <= rect.top + rect.height / 2;
        });
        
        if (targetSibling) {
            DOM.categoryListUl.insertBefore(draggingLi, targetSibling);
        } else {
            DOM.categoryListUl.appendChild(draggingLi);
        }
    });

    // 3. 新增品項 Modal 彈出與儲存
    DOM.btnAddItemModal.addEventListener('click', openAddItemModal);
    DOM.btnAddSpecGroup.addEventListener('click', () => addSpecGroupToEditor());
    
    DOM.btnSaveItem.addEventListener('click', async () => {
        const id = document.getElementById('item-id-input').value;
        const name = document.getElementById('item-name-input').value.trim();
        const categoryId = parseInt(DOM.itemCategorySelect.value);
        const price = parseFloat(document.getElementById('item-price-input').value);
        const imageUrl = DOM.itemImageInput.value.trim();
        const description = document.getElementById('item-desc-input').value.trim();
        const isAvailable = document.getElementById('item-available-input').checked;
        
        if (!name || isNaN(price) || !categoryId) {
            showToast('請填寫品項名稱、價格並選擇分類', 'error');
            return;
        }
        
        const optionsJson = collectSpecsFromEditor();
        
        const payload = {
            name,
            description,
            price,
            image_url: imageUrl || null,
            is_available: isAvailable,
            category_id: categoryId,
            options_json: optionsJson
        };
        
        try {
            if (id) {
                // 編輯
                await API.put(`/api/menu/${id}`, payload);
                showToast('品項已更新', 'success');
            } else {
                // 新建
                await API.post('/api/menu', payload);
                showToast('品項新增成功', 'success');
            }
            closeAllModals();
            await loadMenuItems();
        } catch (err) {}
    });
    
    // 4. 設計器裝置切換
    DOM.btnDesignMobile.addEventListener('click', () => {
        DOM.btnDesignMobile.classList.add('active');
        DOM.btnDesignTablet.classList.remove('active');
        DOM.previewDeviceContainer.className = 'preview-device-container mobile-mode';
        state.currentDeviceType = 'mobile';
        loadLayoutConfig();
    });
    
    DOM.btnDesignTablet.addEventListener('click', () => {
        DOM.btnDesignTablet.classList.add('active');
        DOM.btnDesignMobile.classList.remove('active');
        DOM.previewDeviceContainer.className = 'preview-device-container tablet-mode';
        state.currentDeviceType = 'tablet';
        loadLayoutConfig();
    });
    
    // 設計器即時變更預覽
    const previewTriggers = [
        DOM.designerRestaurantName,
        DOM.designerPrimaryColor,
        DOM.designerLayoutStyle,
        DOM.designerFontSize,
        DOM.designerShowImages
    ];
    previewTriggers.forEach(el => {
        el.addEventListener('input', () => {
            if (el === DOM.designerPrimaryColor) {
                DOM.designerColorHex.textContent = DOM.designerPrimaryColor.value;
            }
            updateLivePreview();
        });
        el.addEventListener('change', updateLivePreview);
    });
    
    // 設計器預設色盤點選
    document.querySelectorAll('.preset-color').forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.getAttribute('data-color');
            DOM.designerPrimaryColor.value = color;
            DOM.designerColorHex.textContent = color;
            updateLivePreview();
        });
    });
    
    // 儲存配置
    DOM.btnSaveLayout.addEventListener('click', saveLayoutConfig);
    
    // 5. IP 儲存設定
    DOM.btnSaveIp.addEventListener('click', async () => {
        const val = DOM.ipConfigInput.value.trim();
        try {
            await API.post('/api/config/ip', { value: val });
            showToast('🌐 IP 位址已儲存更新', 'success');
            await loadIpConfig();
        } catch (err) {}
    });
    
    // 6. 新增桌號
    DOM.btnCreateTable.addEventListener('click', async () => {
        const name = DOM.newTableName.value.trim();
        if (!name) {
            showToast('請輸入桌號名稱', 'error');
            return;
        }
        
        try {
            await API.post('/api/tables', { name });
            showToast(`桌位「${name}」新增成功`, 'success');
            DOM.newTableName.value = '';
            await loadTables();
        } catch (err) {}
    });

    // 7. 圖片上傳與手動網址預覽
    DOM.btnTriggerUpload.addEventListener('click', () => {
        DOM.itemImageFile.click();
    });

    DOM.itemImageFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            showToast('正在上傳圖片...', 'info');
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || '上傳失敗');
            }

            const data = await res.json();
            
            // 回填 URL 與預覽
            DOM.itemImageInput.value = data.image_url;
            DOM.itemImagePreviewImg.src = data.image_url;
            DOM.itemImagePreviewDiv.style.display = 'block';
            showToast('📷 圖片上傳成功', 'success');

        } catch (err) {
            console.error('上傳圖片失敗', err);
            showToast(`圖片上傳失敗: ${err.message}`, 'error');
        }
    });

    // 當手動貼上圖片網址時，即時更新預覽
    DOM.itemImageInput.addEventListener('input', () => {
        const url = DOM.itemImageInput.value.trim();
        if (url) {
            DOM.itemImagePreviewImg.src = url;
            DOM.itemImagePreviewDiv.style.display = 'block';
        } else {
            DOM.itemImagePreviewDiv.style.display = 'none';
            DOM.itemImagePreviewImg.src = '';
        }
    });

    // 8. 強制清空此桌與取消進行中訂單
    DOM.btnClearTableOrders.addEventListener('click', async () => {
        if (!state.selectedTable) return;
        const tableName = state.selectedTable.name;
        if (confirm(`⚠️ 確定要強制清空「${tableName}」桌位，並取消該桌所有未完結訂單嗎？\n此操作會取消所有準備中、已出餐與待付款訂單，且不可復原！`)) {
            try {
                const res = await API.post(`/api/tables/${tableName}/clear`);
                showToast(`🧹 桌位 ${tableName} 已成功強制清空`, 'success');
                state.selectedTable = null;
                
                await loadTables();
                DOM.orderPanelContent.classList.add('hidden');
                DOM.orderDetailPanel.querySelector('.panel-empty-state').classList.remove('hidden');
            } catch (err) {
                showToast(`強制清空桌位失敗: ${err.message}`, 'error');
            }
        }
    });
}

// ----------------- Toast 通知系統 -----------------
function showToast(message, type = 'info') {
    const container = DOM.toastContainer;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // 3 秒後漸隱移除
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}
