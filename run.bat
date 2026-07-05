@echo off
chcp 65001 >nul
title 智慧收銀與點餐系統伺服器

echo =====================================================================
echo    智慧收銀與點餐系統 (FastAPI + WebSocket) - 伺服器啟動中
echo =====================================================================
echo.

:: 檢查 venv 是否存在
if not exist "venv\Scripts\activate.bat" (
    echo [錯誤] 找不到 venv 虛擬環境！
    echo 請先在命令列執行: python -m venv venv
    echo 並安裝依賴: .\venv\Scripts\pip install -r backend/requirements.txt
    echo.
    pause
    exit /b
)

:: 啟用虛擬環境並啟動服務
echo [資訊] 正在載入虛擬環境 venv...
call venv\Scripts\activate

echo [資訊] 正在啟動 FastAPI 服務...
python backend/app/main.py

echo.
echo [資訊] 服務已停止。
pause
