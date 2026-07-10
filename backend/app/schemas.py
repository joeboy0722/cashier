from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# ----------------- System Config -----------------
class SystemConfigBase(BaseModel):
    key: str
    value: str

class SystemConfigUpdate(BaseModel):
    value: str

class SystemConfig(SystemConfigBase):
    id: int

    class Config:
        from_attributes = True

# ----------------- Layout Config -----------------
class LayoutConfigBase(BaseModel):
    device_type: str # "mobile" 或 "tablet"
    config_json: str # JSON string

class LayoutConfigUpdate(BaseModel):
    config_json: str

class LayoutConfig(LayoutConfigBase):
    id: int

    class Config:
        from_attributes = True

# ----------------- Dining Table -----------------
class DiningTableBase(BaseModel):
    name: str

class DiningTableCreate(DiningTableBase):
    pass

class DiningTableUpdateStatus(BaseModel):
    status: str # "idle" or "dining"

class DiningTable(DiningTableBase):
    id: int
    status: str

    class Config:
        from_attributes = True

# ----------------- Menu Item -----------------
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    category_id: int
    options_json: Optional[str] = None

class MenuItemCreate(MenuItemBase):
    pass

class MenuItem(MenuItemBase):
    id: int

    class Config:
        from_attributes = True

# ----------------- Category -----------------
class CategoryBase(BaseModel):
    name: str
    display_order: int = 0

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    items: List[MenuItem] = []

    class Config:
        from_attributes = True

class CategoryReorderItem(BaseModel):
    id: int
    display_order: int

# ----------------- Order Item -----------------
class OrderItemBase(BaseModel):
    item_name: str
    price: float
    quantity: int
    notes: Optional[str] = None

class OrderItemCreate(BaseModel):
    menu_item_id: int # 點餐時前端傳入菜單 ID
    quantity: int
    notes: Optional[str] = None
    price: Optional[float] = None

class OrderItem(OrderItemBase):
    id: int
    order_id: int

    class Config:
        from_attributes = True

# ----------------- Order -----------------
class OrderCreate(BaseModel):
    table_name: str
    items: List[OrderItemCreate]
    payment_mode: Optional[str] = "post" # "pre" 代表先付，"post" 代表後付

class OrderUpdateStatus(BaseModel):
    status: str # "pending", "ready", "paid", "cancelled"

class Order(BaseModel):
    id: int
    table_name: str
    status: str
    total_price: float
    payment_method: str
    created_at: datetime
    updated_at: datetime
    items: List[OrderItem] = []

    class Config:
        from_attributes = True

# ----------------- History Retention Config -----------------
class RetentionConfigUpdate(BaseModel):
    retention_days: int

# ----------------- User & Auth -----------------
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    role: Optional[str] = "staff" # "admin" 或 "staff"

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class UserRoleUpdate(BaseModel):
    role: str # "admin" 或 "staff"

class TokenResponse(BaseModel):
    token: str
    username: str
    role: str
