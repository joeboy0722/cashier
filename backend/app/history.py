import os
import sqlite3
from datetime import datetime, timedelta

def get_history_dir() -> str:
    """
    取得歷史資料庫的存放目錄，若不存在則建立。
    """
    from .database import get_base_dir
    history_dir = os.path.join(get_base_dir(), "history_db")
    os.makedirs(history_dir, exist_ok=True)
    return history_dir

def record_transaction(order) -> bool:
    """
    將一筆結帳/收款確認的訂單，記錄到當天的歷史資料庫中。
    """
    try:
        db_dir = get_history_dir()
        # 使用當前伺服器日期 YYYY-MM-DD 作為檔名
        today_str = datetime.now().strftime("%Y-%m-%d")
        db_path = os.path.join(db_dir, f"{today_str}.db")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 建立歷史交易主表與明細表 (若不存在)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            table_name TEXT,
            total_price REAL,
            payment_method TEXT,
            created_at TEXT
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transaction_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            item_name TEXT,
            price REAL,
            quantity INTEGER,
            notes TEXT,
            FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
        )
        """)
        
        # 避免同一筆訂單重複記錄
        cursor.execute("SELECT id FROM transactions WHERE order_id = ?", (order.id,))
        if cursor.fetchone():
            conn.close()
            return False
            
        # 插入主表
        created_at_str = datetime.now().isoformat()
        cursor.execute("""
        INSERT INTO transactions (order_id, table_name, total_price, payment_method, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (order.id, order.table_name, order.total_price, order.payment_method, created_at_str))
        
        transaction_id = cursor.lastrowid
        
        # 插入明細表
        for item in order.items:
            cursor.execute("""
            INSERT INTO transaction_items (transaction_id, item_name, price, quantity, notes)
            VALUES (?, ?, ?, ?, ?)
            """, (transaction_id, item.item_name, item.price, item.quantity, item.notes))
            
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"寫入歷史交易記錄失敗: {e}")
        return False

def query_transactions(start_date_str: str, end_date_str: str) -> dict:
    """
    查詢指定日期範圍內的所有歷史交易，並計算總收款統計。
    """
    db_dir = get_history_dir()
    
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        # 若日期格式不對，預設只查今天
        today = datetime.now().date()
        start_date = today
        end_date = today
        start_date_str = today.strftime("%Y-%m-%d")
        end_date_str = today.strftime("%Y-%m-%d")

    all_transactions = []
    total_revenue = 0.0
    
    # 遍歷日期區間
    curr_date = start_date
    while curr_date <= end_date:
        date_str = curr_date.strftime("%Y-%m-%d")
        db_path = os.path.join(db_dir, f"{date_str}.db")
        
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # 確保 transactions 資料表存在
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
                if cursor.fetchone():
                    cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC")
                    tx_rows = cursor.fetchall()
                    
                    for tx in tx_rows:
                        tx_dict = dict(tx)
                        # 撈取對應的明細
                        cursor.execute("SELECT * FROM transaction_items WHERE transaction_id = ?", (tx_dict['id'],))
                        item_rows = cursor.fetchall()
                        tx_dict['items'] = [dict(item) for item in item_rows]
                        
                        all_transactions.append(tx_dict)
                        total_revenue += tx_dict['total_price']
                conn.close()
            except Exception as e:
                print(f"讀取歷史資料庫 {date_str}.db 失敗: {e}")
                
        curr_date += timedelta(days=1)
        
    # 依交易時間由新到舊排序
    all_transactions.sort(key=lambda x: x['created_at'], reverse=True)
    
    return {
        "start_date": start_date_str,
        "end_date": end_date_str,
        "total_revenue": total_revenue,
        "total_count": len(all_transactions),
        "transactions": all_transactions
    }

def clean_expired_databases(retention_days: int):
    """
    自動清理超過保留期限的歷史資料庫檔案。
    retention_days <= 0 表示永久保留。
    """
    if retention_days <= 0:
        return
        
    try:
        db_dir = get_history_dir()
        today = datetime.now().date()
        limit_date = today - timedelta(days=retention_days)
        
        for filename in os.listdir(db_dir):
            if filename.endswith(".db"):
                # 檔名格式為 YYYY-MM-DD.db
                date_part = filename[:-3]
                try:
                    file_date = datetime.strptime(date_part, "%Y-%m-%d").date()
                    if file_date < limit_date:
                        file_path = os.path.join(db_dir, filename)
                        os.remove(file_path)
                        print(f"[系統清理] 已自動刪除過期的歷史資料庫: {filename}")
                except ValueError:
                    # 忽略不符合日期格式的檔名
                    continue
    except Exception as e:
        print(f"清理過期資料庫失敗: {e}")
