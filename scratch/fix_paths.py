import os

js_files = [
    "frontend/admin.js",
    "frontend/order.js",
    "frontend/kitchen.js",
    "frontend/display.js"
]

for js_path in js_files:
    if not os.path.exists(js_path):
        continue
        
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 替換 API 請求路徑
    content = content.replace("'/api/", "'/cashier/api/")
    content = content.replace('"/api/', '"/cashier/api/')
    content = content.replace("`/api/", "`/cashier/api/")
    
    # 替換 WebSocket 連線路徑 (解決 /ws 403 問題)
    content = content.replace("host}/ws", "host}/cashier/ws")
    content = content.replace("'/ws'", "'/cashier/ws'")
    content = content.replace('"/ws"', '"/cashier/ws"')
    
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"前端 {js_path} 徹底更新前綴完畢")
