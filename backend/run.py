"""
PyInstaller 打包入口點 (run.py)
- 不使用任何相對匯入
- 把 backend/ 目錄加入 sys.path，讓 'app' 套件可以被找到
- 以絕對路徑 import app.main，讓 main.py 裡的相對匯入正常運作

用法:
  cashier.exe                        # 預設 0.0.0.0:8000
  cashier.exe --port 9000            # 自訂 port
  cashier.exe --host 127.0.0.1       # 自訂 host
  cashier.exe --host 0.0.0.0 --port 9000
"""
import sys
import os
import argparse

# 確保 backend 目錄在 sys.path 中
# PyInstaller 打包後此路徑已內建，開發環境需要手動加入
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import uvicorn
from app.main import app, base_dir, frontend_dir, upload_dir

if __name__ == '__main__':
    # 解析命令列參數
    parser = argparse.ArgumentParser(description='收銀系統伺服器')
    parser.add_argument('--host', default='0.0.0.0', help='監聽位址 (預設: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8000, help='監聽埠號 (預設: 8000)')
    args = parser.parse_args()

    print(f"=== 收銀系統啟動 ===")
    print(f"基準目錄  : {base_dir}")
    print(f"前端目錄  : {frontend_dir}")
    print(f"上傳目錄  : {upload_dir}")
    print(f"伺服器網址: http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)
