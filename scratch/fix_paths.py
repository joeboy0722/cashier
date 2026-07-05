import re

# 1. 處理 main.py
main_path = "backend/app/main.py"
with open(main_path, "r", encoding="utf-8") as f:
    content = f.read()

# 替換 API 路由前綴
content = content.replace('@app.get("/api/', '@app.get("/cashier/api/')
content = content.replace('@app.post("/api/', '@app.post("/cashier/api/')
content = content.replace('@app.put("/api/', '@app.put("/cashier/api/')
content = content.replace('@app.delete("/api/', '@app.delete("/cashier/api/')

# 替換 WebSocket
content = content.replace('@app.websocket("/ws")', '@app.websocket("/cashier/ws")')

# 替換 mount 靜態路徑
content = content.replace('app.mount("/frontend"', 'app.mount("/cashier/frontend"')
content = content.replace('app.mount("/uploads"', 'app.mount("/cashier/uploads"')

# 替換圖片上傳回傳的網址
content = content.replace('"/uploads/{filename}"', '"/cashier/uploads/{filename}"')

# 替換重導向
content = content.replace('url="/frontend/admin.html"', 'url="/cashier/frontend/admin.html"')

# 額外新增 @app.get("/cashier") 重新導向
redirect_code = """
@app.get("/cashier")
def read_cashier_root():
    return RedirectResponse(url="/cashier/frontend/admin.html")

@app.get("/")
"""
content = content.replace('@app.get("/")', redirect_code)

with open(main_path, "w", encoding="utf-8") as f:
    f.write(content)
print("main.py 替換完成")

# 2. 處理前端 JS
js_files = [
    "frontend/admin.js",
    "frontend/order.js",
    "frontend/kitchen.js"
]

for js_path in js_files:
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()
    
    # 替換 API_BASE
    js_content = js_content.replace("const API_BASE = '/api';", "const API_BASE = '/cashier/api';")
    js_content = js_content.replace('const API_BASE = "/api";', 'const API_BASE = "/cashier/api";')
    
    # 替換 WebSocket URL
    js_content = js_content.replace("'/ws'", "'/cashier/ws'")
    js_content = js_content.replace('"/ws"', '"/cashier/ws"')
    
    # 替換 admin.js 中的 QR Code URL
    if "admin.js" in js_path:
        js_content = js_content.replace("'/frontend/order.html?table='", "'/cashier/frontend/order.html?table='")
        js_content = js_content.replace('"/frontend/order.html?table="', '"/cashier/frontend/order.html?table="')
        
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"{js_path} 替換完成")

# 3. 處理 display.js
display_js_path = "frontend/display.js"
with open(display_js_path, "r", encoding="utf-8") as f:
    d_content = f.read()
d_content = d_content.replace("'/api/orders/active'", "'/cashier/api/orders/active'")
d_content = d_content.replace('"/api/orders/active"', '"/cashier/api/orders/active"')
d_content = d_content.replace("'/ws'", "'/cashier/ws'")
d_content = d_content.replace('"/ws"', '"/cashier/ws"')
with open(display_js_path, "w", encoding="utf-8") as f:
    f.write(d_content)
print("display.js 替換完成")

# 4. 處理 admin.html
admin_html_path = "frontend/admin.html"
with open(admin_html_path, "r", encoding="utf-8") as f:
    h_content = f.read()
h_content = h_content.replace('href="/frontend/display.html"', 'href="/cashier/frontend/display.html"')
h_content = h_content.replace('href="/frontend/kitchen.html"', 'href="/cashier/frontend/kitchen.html"')
with open(admin_html_path, "w", encoding="utf-8") as f:
    f.write(h_content)
print("admin.html 替換完成")
