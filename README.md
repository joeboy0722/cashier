# Cashier - 智慧雙軌收銀與後廚出餐看板系統 (KDS)

這是一個為現代餐飲業設計的商業級、即時聯動點餐與收銀結帳系統。系統完美整合了**「手機掃碼點餐 / 桌上平板點餐」**、**「櫃台收銀與桌況管理後台」**、**「出餐大螢幕看板」** 以及 **「後廚工作看板 (KDS)」** 四大核心維度，並透過 WebSocket 實現毫秒級的雙向狀態同步與語音播報。

---

## 🚀 系統核心亮點

### 1. 先付款 / 後付款雙軌收銀流 (Pre-pay & Post-pay)
*   **店內平板 / 掃碼點餐自由配置**：後台可為不同的點餐端獨立儲存付款邏輯。
*   **先付款流程**：顧客送單 ➔ 產生 `待付款` 訂單（看板此時不顯示，避免插單）➔ 櫃台確認收款 ➔ 訂單狀態更新為 `製作中` ➔ 廚房大螢幕與 KDS 即時滑入卡片。顧客用餐完畢後一鍵清理桌位。
*   **後付款流程**：顧客送單 ➔ 訂單直接進入 `製作中` ➔ 客人用餐 ➔ 吃飽後至櫃台現場結帳，自動核銷並釋放桌況。

### 2. 智慧出餐與收銀解耦設計 (防跑單機制)
*   引進 **`completed` (已送餐/待結帳)** 中間狀態。
*   當後廚在 KDS 點選「已取餐」時，卡片會自動從大螢幕和廚房螢幕上隱藏。
    *   **先付款訂單**：系統自動分流直接改為 `paid` (已結帳) 並釋放桌況。
    *   **後付款訂單**：狀態變更為 `completed`，收銀台維持 A1 桌為 **「用餐中 (黃色)」**，直到客人至櫃台完成現場支付，防堵漏收銀與跑單漏洞！

### 3. 多維客製規格與數量加購系統
*   **全圖形化規格編輯器**：管理者可在後台為餐點任意新增 `單選 (Radio)`、`多選 (Checkbox)` 以及 **`數量加購 (Quantity)`**（適合如加購飲料 x2、滷蛋 x1 等非單純勾選的場景）規格組。
*   **點餐價格即時加乘**：顧客點餐彈窗隨著加購附餐的數量增減即時更新小計，加入購物車後自動在備註欄位以紅色字體拼接數量（如：`* 無糖, 加點溫泉蛋 x2`）。

### 4. 毫秒級分類拖曳排序 (WebSocket 即時重排)
*   後台採用 HTML5 原生 Drag & Drop API，店員直接抓取 `☰` 即可拖曳調整菜單分類順序。
*   拖曳結束後，系統不僅在資料庫中批量重排，還會透過 WebSocket 向所有顧客的手機與平板**廣播事件，一秒內即時重新排列分類選單，免整理網頁**。

### 5. 語音播報與音頻振盪合成技術 (零延遲、零頻寬)
*   **大螢幕出餐播報**：餐點完成時，利用 Web Speech API 語音合成，大聲播報「請 #1 號 A1桌 顧客取餐」。
*   **顧客手機/平板即時語音提示**：餐點出餐時，顧客手機網頁會發出清脆的叮咚聲並語音播報「您的餐點已完成，請至櫃台取餐」，同時自動彈出點餐歷史視窗，體驗極佳。
*   **電子合成音 (Chime)**：利用 Web Audio API 在毫秒間即時向音效卡發出頻波指令合成「叮咚」音效，完全不需加載任何音訊檔，0 延遲且 0 網路頻寬佔用。

---

## 🛠️ 技術棧說明

*   **後端應用**：FastAPI (Python 3.10+)、SQLAlchemy (ORM)、SQLite (輕量持久化資料庫)
*   **即時同步**：WebSockets (全雙工雙向通訊機制)
*   **前端介面**：原生 HTML5、CSS3 (動態毛玻璃與深色高對比質感)、Vanilla JS (無框架編譯，極速載入)
*   **語音音效**：Web Audio API (聲波振盪器合成)、Web Speech API (SpeechSynthesis 語音合成)
*   **打包部署**：PyInstaller (onedir 模式，可打包為獨立 exe，無需安裝 Python)

---

## 📂 專案目錄結構

```text
cashier/
├── backend/
│   ├── app/
│   │   ├── crud.py        # 資料庫 CRUD 業務邏輯 (包含智慧付款分流判定)
│   │   ├── database.py    # SQLAlchemy 資料庫初始化、連線、動態路徑偵測
│   │   ├── main.py        # FastAPI 應用、API 路由與 WS 連線管理器
│   │   ├── models.py      # 資料庫模型 (Order, MenuItem, DiningTable 等)
│   │   └── schemas.py     # Pydantic 數據模型驗證
│   ├── requirements.txt   # Python 依賴包列表
│   └── run.py             # PyInstaller 打包入口點 (支援 --host / --port 參數)
├── frontend/
│   ├── admin.html         # 櫃台收銀與桌況管理後台
│   ├── admin.js           # 後台操作、拖曳排序與規格編輯邏輯
│   ├── admin.css          # 後台高質感排版與動畫
│   ├── display.html       # 出餐大螢幕看板 (雙欄準備中/請取餐)
│   ├── display.js         # 看板語音播報與 WS 即時卡片切換
│   ├── kitchen.html       # 後廚工作看板 (KDS) (深色高對比觸控版面)
│   ├── kitchen.js         # 後廚出餐完成與 WS 新單叮咚通知
│   ├── order.html         # 顧客點餐端 (手機/平板自適應)
│   ├── order.js           # 點餐端購物車、規格選擇、餐點完成語音播放
│   └── order.css          # 點餐端版型樣式
├── cashier.spec           # PyInstaller 打包設定檔
├── run.bat                # Windows 開發環境一鍵啟動腳本
└── .gitignore             # 排除檔案 (已忽略 venv, DB, 圖片 uploads 等暫存)
```

---

## ⚙️ 快速安裝與部署指南

### 方式一：開發環境 (原始碼直接執行)

請先在本機安裝 Python 3.10+，於專案根目錄下執行：

```bash
# 建立虛擬環境 (如果沒有建立過)
python -m venv venv

# 啟動虛擬環境 (Windows)
.\venv\Scripts\activate

# 安裝後端 FastAPI 相關依賴
pip install -r backend/requirements.txt
```

啟動服務（擇一）：

```bash
# 方式 A：直接雙擊 run.bat
run.bat

# 方式 B：手動啟動
python backend/app/main.py
```

---

### 方式二：打包為獨立 exe (無需安裝 Python)

安裝 PyInstaller 後執行打包：

```bash
pip install pyinstaller
pyinstaller cashier.spec --clean -y
```

打包完成後，`dist/cashier/` 即為可獨立部署的資料夾：

```text
dist/cashier/             ← 整個資料夾複製到目標機器
├── cashier.exe           ← 雙擊啟動，或命令列帶參數執行
├── _internal/            ← Python 執行環境 (自動產生，勿刪)
├── frontend/             ← 手動複製 frontend/ 資料夾至此
├── uploads/              ← 圖片上傳目錄 (自動建立)
└── database.db           ← SQLite 資料庫 (自動建立)
```

啟動選項：

```bash
cashier.exe                          # 預設 0.0.0.0:8000
cashier.exe --port 9000              # 自訂 port
cashier.exe --host 127.0.0.1        # 自訂 host
cashier.exe --host 0.0.0.0 --port 9000
cashier.exe --help                   # 查看說明
```

---

## 🌐 入口 URL 清單

服務啟動後（預設 port 8000），可透過以下網址存取：

| 功能 | URL |
|---|---|
| 收銀管理後台 | `http://localhost:8000/cashier/frontend/admin.html` |
| 出餐大螢幕 | `http://localhost:8000/cashier/frontend/display.html` |
| 後廚看板 (KDS) | `http://localhost:8000/cashier/frontend/kitchen.html` |
| 顧客點餐端 (A1桌) | `http://<內網IP>:8000/cashier/frontend/order.html?table=A1` |

> 後台的「桌號管理」頁面會自動為每張桌子產生 QR Code，掃碼即可點餐，無需手動輸入 URL。

---

## 🔗 所有路由前綴

所有 API 與靜態資源統一以 `/cashier` 為根路徑，方便反向代理 (Nginx/Caddy) 的子路徑部署：

| 類型 | 路徑 |
|---|---|
| WebSocket | `/cashier/ws` |
| REST API | `/cashier/api/...` |
| 前端靜態檔 | `/cashier/frontend/...` |
| 上傳圖片 | `/cashier/uploads/...` |
