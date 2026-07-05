import json
import os
import socket
import sys
import shutil
import uuid
from typing import List, Dict, Set

# 確保直接執行此腳本時，相對導入 (relative import) 能正常運作
if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "app"

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas, crud
from .database import engine, Base, get_db, get_base_dir

# 初始化資料庫表格
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="收銀與點餐系統 API")

# 允許跨域請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 偵測本機內網 IP
def get_internal_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 不需要真正建立連線，僅用於取得本機出站 IP
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

# ----------------- WebSocket 連線管理 -----------------
class ConnectionManager:
    def __init__(self):
        # 儲存所有作用中的 WebSocket 連線
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # 將訊息廣播給所有連線的客戶端
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                # 移除失效連線
                self.active_connections.remove(connection)

manager = ConnectionManager()

@app.websocket("/cashier/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 保持連線，監聽客戶端訊息（目前主要由 API 觸發廣播，此處主要維持 heartbeat 或接收簡單指令）
            data = await websocket.receive_text()
            # 可以在此擴充處理客戶端傳來的 WS 訊息
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ----------------- API 路由 -----------------

# 1. 系統 IP 設定
@app.get("/cashier/api/config/ip")
def get_ip_config(db: Session = Depends(get_db)):
    config = crud.get_system_config(db, "server_ip")
    internal_ip = get_internal_ip()
    
    # 回傳設定的外網 IP/網址，以及預設偵測的內網 IP
    return {
        "configured_ip": config.value if config else "",
        "internal_ip": internal_ip,
        "active_ip": config.value if (config and config.value.strip()) else internal_ip
    }

@app.post("/cashier/api/config/ip")
def update_ip_config(config_in: schemas.SystemConfigUpdate, db: Session = Depends(get_db)):
    config = crud.update_system_config(db, "server_ip", config_in.value)
    return {"message": "IP 設定已更新", "server_ip": config.value}

# 2. 點餐介面配置 Layout Config
@app.get("/cashier/api/layout/{device_type}")
def get_layout(device_type: str, db: Session = Depends(get_db)):
    config = crud.get_layout_config(db, device_type)
    if not config:
        # 回傳預設值
        default_configs = {
            "mobile": {
                "primaryColor": "#ff6f00", # 溫暖橘色
                "layoutStyle": "grid-2",   # 雙欄
                "showImages": True,
                "fontSize": "medium",
                "restaurantName": "行動美味餐廳"
            },
            "tablet": {
                "primaryColor": "#29b6f6", # 清爽藍色
                "layoutStyle": "grid-3",   # 三欄
                "showImages": True,
                "fontSize": "large",
                "restaurantName": "平板自助點餐機"
            }
        }
        default_val = json.dumps(default_configs.get(device_type, default_configs["mobile"]))
        # 寫入資料庫當預設值
        config = crud.update_layout_config(db, device_type, default_val)
    return json.loads(config.config_json)

@app.post("/cashier/api/layout/{device_type}")
def save_layout(device_type: str, request_data: dict, db: Session = Depends(get_db)):
    config_json = json.dumps(request_data)
    crud.update_layout_config(db, device_type, config_json)
    return {"message": f"{device_type} 介面配置已更新"}

# 3. 桌號管理
@app.get("/cashier/api/tables", response_model=List[schemas.DiningTable])
def read_tables(db: Session = Depends(get_db)):
    return crud.get_tables(db)

@app.post("/cashier/api/tables", response_model=schemas.DiningTable)
def add_table(table: schemas.DiningTableCreate, db: Session = Depends(get_db)):
    db_table = crud.get_table_by_name(db, name=table.name)
    if db_table:
        raise HTTPException(status_code=400, detail="此桌號已存在")
    return crud.create_table(db, table)

@app.delete("/cashier/api/tables/{name}")
def remove_table(name: str, db: Session = Depends(get_db)):
    success = crud.delete_table(db, table_name=name)
    if not success:
        raise HTTPException(status_code=404, detail="桌號不存在")
    return {"message": f"桌號 {name} 已刪除"}

# 4. 菜單分類管理
@app.get("/cashier/api/categories", response_model=List[schemas.Category])
def read_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)

@app.post("/cashier/api/categories", response_model=schemas.Category)
def add_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, category)

@app.delete("/cashier/api/categories/{id}")
def remove_category(id: int, db: Session = Depends(get_db)):
    success = crud.delete_category(db, category_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="分類不存在")
    return {"message": "分類已刪除"}

@app.post("/cashier/api/categories/reorder")
async def reorder_categories(reorder_data: List[schemas.CategoryReorderItem], db: Session = Depends(get_db)):
    crud.reorder_categories(db, reorder_data)
    # 透過 WebSocket 廣播「分類重排」事件，讓所有點餐端能免整理重新排序
    await manager.broadcast({
        "event": "categories_reordered",
        "data": None
    })
    return {"message": "分類順序已更新"}

# 5. 菜單品項管理
@app.get("/cashier/api/menu", response_model=List[schemas.MenuItem])
def read_menu(category_id: int = None, db: Session = Depends(get_db)):
    return crud.get_menu_items(db, category_id=category_id)

@app.post("/cashier/api/menu", response_model=schemas.MenuItem)
def add_menu_item(item: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    return crud.create_menu_item(db, item)

@app.put("/cashier/api/menu/{id}", response_model=schemas.MenuItem)
def update_menu_item(id: int, item: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    db_item = crud.update_menu_item(db, item_id=id, item=item)
    if not db_item:
        raise HTTPException(status_code=404, detail="品項不存在")
    return db_item

@app.delete("/cashier/api/menu/{id}")
def remove_menu_item(id: int, db: Session = Depends(get_db)):
    success = crud.delete_menu_item(db, item_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="品項不存在")
    return {"message": "品項已刪除"}

# 6. 訂單管理
@app.get("/cashier/api/orders", response_model=List[schemas.Order])
def read_orders(status: str = None, db: Session = Depends(get_db)):
    return crud.get_orders(db, status=status)

@app.get("/cashier/api/orders/active", response_model=List[schemas.Order])
def read_active_orders(db: Session = Depends(get_db)):
    return crud.get_active_orders(db)

@app.post("/cashier/api/orders", response_model=schemas.Order)
async def submit_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    db_order = crud.create_order(db, order)
    
    order_data = schemas.Order.model_validate(db_order).model_dump()
    order_data["created_at"] = order_data["created_at"].isoformat()
    order_data["updated_at"] = order_data["updated_at"].isoformat()
    
    # 根據訂單狀態決定發送事件 (unpaid 不送大螢幕，但送後台)
    event_name = "new_order" if db_order.status == "pending" else "new_unpaid_order"
    
    await manager.broadcast({
        "event": event_name,
        "data": order_data
    })
    
    # 即時同步更新桌況給後台
    tables = crud.get_tables(db)
    tables_data = [schemas.DiningTable.model_validate(t).model_dump() for t in tables]
    await manager.broadcast({
        "event": "tables_updated",
        "data": tables_data
    })
    
    return db_order

@app.put("/cashier/api/orders/{id}/status", response_model=schemas.Order)
async def update_order_status(id: int, status_update: schemas.OrderUpdateStatus, db: Session = Depends(get_db)):
    db_order = crud.update_order_status(db, order_id=id, status=status_update.status)
    if not db_order:
        raise HTTPException(status_code=404, detail="訂單不存在")
    
    order_data = schemas.Order.model_validate(db_order).model_dump()
    order_data["created_at"] = order_data["created_at"].isoformat()
    order_data["updated_at"] = order_data["updated_at"].isoformat()
    
    # 若原本是 unpaid，收款後改為 pending，對大螢幕而言這是一筆「新訂單」
    if status_update.status == "pending":
        await manager.broadcast({
            "event": "new_order",
            "data": order_data
        })
    else:
        await manager.broadcast({
            "event": "status_updated",
            "data": order_data
        })
    
    # 如果有桌況的變動，廣播桌況更新
    tables = crud.get_tables(db)
    tables_data = [schemas.DiningTable.model_validate(t).model_dump() for t in tables]
    await manager.broadcast({
        "event": "tables_updated",
        "data": tables_data
    })
    
    return db_order

@app.post("/cashier/api/tables/{name}/clear")
async def clear_table(name: str, db: Session = Depends(get_db)):
    cancelled_orders = crud.clear_table_orders(db, table_name=name)
    
    # 透過 WebSocket 廣播每一筆被取消的訂單
    for order in cancelled_orders:
        order_data = schemas.Order.model_validate(order).model_dump()
        order_data["created_at"] = order_data["created_at"].isoformat()
        order_data["updated_at"] = order_data["updated_at"].isoformat()
        
        await manager.broadcast({
            "event": "status_updated",
            "data": order_data
        })
        
    # 廣播桌況更新
    tables = crud.get_tables(db)
    tables_data = [schemas.DiningTable.model_validate(t).model_dump() for t in tables]
    await manager.broadcast({
        "event": "tables_updated",
        "data": tables_data
    })
    
    return {"message": f"桌位 {name} 已強制清空，共取消 {len(cancelled_orders)} 筆未完結訂單"}

# ----------------- 靜態檔案與首頁導向 -----------------

# 取得執行基準目錄：
#   開發環境 → d:/cashier/  (main.py 向上兩層)
#   打包 exe → exe 所在目錄
# 兩種情況下 frontend/ 和 uploads/ 都在基準目錄的同一層
base_dir = get_base_dir()
frontend_dir = os.path.join(base_dir, "frontend")
upload_dir = os.path.join(base_dir, "uploads")

# 掛載前端網頁目錄，讓 /cashier/frontend 路由可以讀取所有 HTML/JS/CSS 靜態檔
app.mount("/cashier/frontend", StaticFiles(directory=frontend_dir), name="frontend")

# 建立與掛載 uploads 目錄
os.makedirs(upload_dir, exist_ok=True)
app.mount("/cashier/uploads", StaticFiles(directory=upload_dir), name="uploads")

# 圖片上傳 API
@app.post("/cashier/api/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只允許上傳圖片檔案")
    
    # 取得副檔名
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
        ext = "png"
        
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"image_url": f"/cashier/uploads/{filename}"}


@app.get("/cashier")
def read_cashier_root():
    return RedirectResponse(url="/cashier/frontend/admin.html")

@app.get("/")

def read_root():
    # 預設首頁重新導向到管理者後台
    return RedirectResponse(url="/cashier/frontend/admin.html")

if __name__ == "__main__":
    import uvicorn
    # 直接執行 python main.py 或打包後 exe 啟動時
    print(f"=== 收銀系統啟動 ===")
    print(f"基準目錄  : {base_dir}")
    print(f"前端目錄  : {frontend_dir}")
    print(f"上傳目錄  : {upload_dir}")
    print(f"伺服器網址: http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
