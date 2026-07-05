import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

def get_base_dir() -> str:
    """
    取得執行基準目錄：
    - PyInstaller 打包後：exe 所在目錄
    - 一般 Python 執行：專案根目錄 (main.py 向上兩層)
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller 環境：sys.executable 就是 exe 路徑
        return os.path.dirname(sys.executable)
    # 一般開發環境：此檔案在 backend/app/database.py，向上兩層為專案根
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# 資料庫路徑固定在執行基準目錄下的 database.db
_db_path = os.path.join(get_base_dir(), "database.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{_db_path}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 取得資料庫連線的 Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

