from typing import List
from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime

# ----------------- System Config -----------------
def get_system_config(db: Session, key: str):
    return db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()

def update_system_config(db: Session, key: str, value: str):
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if config:
        config.value = value
    else:
        config = models.SystemConfig(key=key, value=value)
        db.add(config)
    db.commit()
    db.refresh(config)
    return config

# ----------------- Layout Config -----------------
def get_layout_config(db: Session, device_type: str):
    return db.query(models.LayoutConfig).filter(models.LayoutConfig.device_type == device_type).first()

def update_layout_config(db: Session, device_type: str, config_json: str):
    config = db.query(models.LayoutConfig).filter(models.LayoutConfig.device_type == device_type).first()
    if config:
        config.config_json = config_json
    else:
        config = models.LayoutConfig(device_type=device_type, config_json=config_json)
        db.add(config)
    db.commit()
    db.refresh(config)
    return config

# ----------------- Dining Table -----------------
def get_tables(db: Session):
    return db.query(models.DiningTable).all()

def get_table_by_name(db: Session, name: str):
    return db.query(models.DiningTable).filter(models.DiningTable.name == name).first()

def create_table(db: Session, table: schemas.DiningTableCreate):
    db_table = models.DiningTable(name=table.name, status="idle")
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
    return db_table

def delete_table(db: Session, table_name: str):
    db_table = db.query(models.DiningTable).filter(models.DiningTable.name == table_name).first()
    if db_table:
        db.delete(db_table)
        db.commit()
        return True
    return False

def update_table_status(db: Session, name: str, status: str):
    db_table = db.query(models.DiningTable).filter(models.DiningTable.name == name).first()
    if db_table:
        db_table.status = status
        db.commit()
        db.refresh(db_table)
        return db_table
    return None

# ----------------- Category -----------------
def get_categories(db: Session):
    return db.query(models.Category).order_by(models.Category.display_order.asc()).all()

def create_category(db: Session, category: schemas.CategoryCreate):
    db_category = models.Category(name=category.name, display_order=category.display_order)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id: int):
    db_category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
        return True
    return False

def reorder_categories(db: Session, reorder_items: List[schemas.CategoryReorderItem]):
    for item in reorder_items:
        db_category = db.query(models.Category).filter(models.Category.id == item.id).first()
        if db_category:
            db_category.display_order = item.display_order
    db.commit()
    return True

# ----------------- Menu Item -----------------
def get_menu_items(db: Session, category_id: int = None):
    query = db.query(models.MenuItem)
    if category_id is not None:
        query = query.filter(models.MenuItem.category_id == category_id)
    return query.all()

def get_menu_item(db: Session, item_id: int):
    return db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()

def create_menu_item(db: Session, item: schemas.MenuItemCreate):
    db_item = models.MenuItem(
        name=item.name,
        description=item.description,
        price=item.price,
        image_url=item.image_url,
        is_available=item.is_available,
        category_id=item.category_id,
        options_json=item.options_json
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_menu_item(db: Session, item_id: int, item: schemas.MenuItemCreate):
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if db_item:
        db_item.name = item.name
        db_item.description = item.description
        db_item.price = item.price
        db_item.image_url = item.image_url
        db_item.is_available = item.is_available
        db_item.category_id = item.category_id
        db_item.options_json = item.options_json
        db.commit()
        db.refresh(db_item)
        return db_item
    return None

def delete_menu_item(db: Session, item_id: int):
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
        return True
    return False

# ----------------- Order -----------------
def get_orders(db: Session, status: str = None):
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(models.Order.created_at.desc()).all()

def get_active_orders(db: Session):
    # 回傳準備中與請取餐的訂單 (排除已結帳與取消)
    return db.query(models.Order).filter(models.Order.status.in_(["unpaid", "pending", "ready", "completed"])).order_by(models.Order.created_at.asc()).all()

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def create_order(db: Session, order_in: schemas.OrderCreate):
    # 建立新訂單，先付款模式初始狀態為 "unpaid"，後付款模式為 "pending"
    initial_status = "unpaid" if order_in.payment_mode == "pre" else "pending"
    initial_payment_method = "Prepaid" if order_in.payment_mode == "pre" else "Cash"
    db_order = models.Order(
        table_name=order_in.table_name,
        status=initial_status,
        total_price=0.0,
        payment_method=initial_payment_method
    )
    db.add(db_order)
    db.flush() # 取得 order_id

    total = 0.0
    for item_in in order_in.items:
        menu_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_in.menu_item_id).first()
        if not menu_item:
            continue
        
        item_price = item_in.price if item_in.price is not None else menu_item.price
        db_order_item = models.OrderItem(
            order_id=db_order.id,
            item_name=menu_item.name,
            price=item_price,
            quantity=item_in.quantity,
            notes=item_in.notes
        )
        db.add(db_order_item)
        total += item_price * item_in.quantity

    db_order.total_price = total
    
    # 後付款模式點餐後自動將桌子狀態更新為 "dining"
    if order_in.payment_mode == "post":
        table = db.query(models.DiningTable).filter(models.DiningTable.name == order_in.table_name).first()
        if table:
            table.status = "dining"

    db.commit()
    db.refresh(db_order)
    return db_order

def update_order_status(db: Session, order_id: int, status: str):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db_order:
        target_status = status
        # 智慧判定：若後廚通知已取餐 (completed)，且該訂單為先付款模式 (Prepaid)，則直接變更為 paid (已結帳)
        if status == "completed" and db_order.payment_method == "Prepaid":
            target_status = "paid"
            
        db_order.status = target_status
        
        # 如果狀態改為 "pending" (例如確認收款)，桌子狀態改為 "dining"
        if target_status == "pending":
            table = db.query(models.DiningTable).filter(models.DiningTable.name == db_order.table_name).first()
            if table:
                table.status = "dining"
        
        # 如果狀態改為 "paid" 或 "cancelled"
        if target_status in ["paid", "cancelled"]:
            table = db.query(models.DiningTable).filter(models.DiningTable.name == db_order.table_name).first()
            if table:
                # 檢查該桌是否還有其他未結帳的 active 訂單
                other_active = db.query(models.Order).filter(
                    models.Order.table_name == db_order.table_name,
                    models.Order.status.in_(["unpaid", "pending", "ready", "completed"]),
                    models.Order.id != order_id
                ).count()
                if other_active == 0:
                    table.status = "idle"
                    
        db.commit()
        db.refresh(db_order)
        return db_order
    return None

def clear_table_orders(db: Session, table_name: str):
    # 將指定桌號的所有未完結訂單 (unpaid, pending, ready, completed) 狀態一律改為 "cancelled"
    active_orders = db.query(models.Order).filter(
        models.Order.table_name == table_name,
        models.Order.status.in_(["unpaid", "pending", "ready", "completed"])
    ).all()
    
    for order in active_orders:
        order.status = "cancelled"
        
    table = db.query(models.DiningTable).filter(models.DiningTable.name == table_name).first()
    if table:
        table.status = "idle"
        
    db.commit()
    return active_orders
