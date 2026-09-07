# -*- coding: utf-8 -*-
"""把爬到的数据存下来：JSON / CSV / SQLite 三件套。

本脚本使用内置示例数据，不联网即可直接运行：
python 05_save_data.py
"""
import csv
import json
import sqlite3

BOOKS = [
    {"书名": "A Light in the Attic", "价格": 51.77, "评分": 3},
    {"书名": "Tipping the Velvet", "价格": 53.74, "评分": 1},
    {"书名": "Soumission", "价格": 50.10, "评分": 1},
    {"书名": "Sharp Objects", "价格": 47.82, "评分": 4},
    {"书名": "Sapiens: A Brief History of Humankind", "价格": 54.23, "评分": 5},
]

def save_json():
    with open("books.json", "w", encoding="utf-8") as f:
        json.dump(BOOKS, f, ensure_ascii=False, indent=2)
    print("已保存 books.json")

def save_csv():
    with open("books2.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["书名", "价格", "评分"])
        writer.writeheader()
        writer.writerows(BOOKS)
    print("已保存 books2.csv")

def save_sqlite():
    conn = sqlite3.connect("books.db")          # 没有会自动创建
    conn.execute(
        """CREATE TABLE IF NOT EXISTS books (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               title TEXT NOT NULL,
               price REAL,
               rating INTEGER)"""
    )
    conn.executemany(
        "INSERT INTO books (title, price, rating) VALUES (?, ?, ?)",
        [(b["书名"], b["价格"], b["评分"]) for b in BOOKS],
    )
    conn.commit()

    for row in conn.execute("SELECT title, price FROM books WHERE rating >= 4"):
        print("高分书:", row)
    conn.close()
    print("已保存 books.db（SQLite 数据库）")

if __name__ == "__main__":
    save_json()
    save_csv()
    save_sqlite()
