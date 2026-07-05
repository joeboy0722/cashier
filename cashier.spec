# -*- mode: python ; coding: utf-8 -*-
# cashier.spec — PyInstaller 打包設定
# 用法: pyinstaller cashier.spec
# 輸出: dist/cashier.exe

block_cipher = None

a = Analysis(
    # 入口點：run.py（不含相對匯入，由它去 import app.main）
    ['backend/run.py'],
    pathex=['backend'],   # 讓 PyInstaller 把 backend/ 加入搜尋路徑，找到 app 套件
    binaries=[
        # 這些 DLL 在 venv\Library\bin\ 裡，PyInstaller 無法自動找到，需手動指定
        # 格式: (來源路徑, 目的目錄)，'.' 表示放在 exe 同層
        ('D:/cashier/venv/Library/bin/libssl-3-x64.dll',    '.'),
        ('D:/cashier/venv/Library/bin/libcrypto-3-x64.dll', '.'),
        ('D:/cashier/venv/Library/bin/sqlite3.dll',         '.'),
        ('D:/cashier/venv/Library/bin/ffi.dll',             '.'),
        ('D:/cashier/venv/Library/bin/libexpat.dll',        '.'),
        ('D:/cashier/venv/Library/bin/liblzma.dll',         '.'),
    ],
    datas=[],
    hiddenimports=[
        # uvicorn 核心模組
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.off',
        'uvicorn.lifespan.on',
        # SQLAlchemy
        'sqlalchemy.dialects.sqlite',
        # fastapi / starlette 相關
        'fastapi',
        'starlette',
        'starlette.staticfiles',
        'starlette.middleware',
        'starlette.middleware.cors',
        # app 內部模組（相對匯入，需明確列出讓 PyInstaller 打包）
        'app',
        'app.main',
        'app.database',
        'app.models',
        'app.schemas',
        'app.crud',
        # 其他
        'aiofiles',
        'multipart',
        'python_multipart',
        'email.mime.text',
        'email.mime.multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],                 # onedir 模式：binaries/datas 不塞進 exe，交給 COLLECT
    exclude_binaries=True,
    # 輸出的 exe 名稱
    name='cashier',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    console=True,       # 保留 console 視窗，方便看 log
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# onedir 模式：將所有依賴檔統一蒐集到 dist/cashier/ 目錄
# 部署時將 dist/cashier/ 整個資料夾複製，並在同層放入 frontend/
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='cashier',     # 輸出目錄名稱：dist/cashier/
)
