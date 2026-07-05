from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class DiningTable(Base):
    __tablename__ = "dining_tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # 桌號名稱，如 "Table 1"
    status = Column(String, default="idle") # 桌況: "idle" (空閒), "dining" (用餐中)

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # 分類名稱，如 "主餐", "飲料"
    display_order = Column(Integer, default=0) # 顯示順序

    items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")

class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True) # 商品圖片 URL
    is_available = Column(Boolean, default=True) # 是否供應
    options_json = Column(String, nullable=True) # 儲存客製化與附餐規格配置 JSON 字串
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)

    category = relationship("Category", back_populates="items")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, nullable=False) # 記錄點餐桌號
    status = Column(String, default="pending") # 訂單狀態: "pending" (準備中), "ready" (請取餐/已出餐), "paid" (已結帳), "cancelled" (已取消)
    total_price = Column(Float, default=0.0)
    payment_method = Column(String, default="Cash") # 現場支付預設為 Cash (現金/現場付)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String, nullable=False) # 記錄點餐當時商品名稱
    price = Column(Float, nullable=False) # 記錄點餐當時價格
    quantity = Column(Integer, default=1)
    notes = Column(String, nullable=True) # 記錄顧客此品項選中的規格(例如：不要蔥, 加珍珠)

    order = relationship("Order", back_populates="items")

class LayoutConfig(Base):
    __tablename__ = "layout_configs"

    id = Column(Integer, primary_key=True, index=True)
    device_type = Column(String, unique=True, index=True, nullable=False) # "mobile" 或 "tablet"
    config_json = Column(String, nullable=False) # 儲存配置 JSON 字串，例如 {"primaryColor": "#ff5722", "layoutStyle": "grid-2"}

class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False) # 例如 "server_ip"
    value = Column(String, nullable=False)
