"""
数据存储模块 - 支持 JSON / CSV / SQLite 三种格式
"""
import csv
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from config import OUTPUT_DIR, DATABASE_PATH


class BaseStorage:
    """存储基类"""

    def __init__(self, output_path: Optional[Path] = None):
        self.output_path = output_path or OUTPUT_DIR / f"adobe_stock_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.items_count = 0

    def save_item(self, item: Dict[str, Any]):
        """保存单个条目"""
        raise NotImplementedError

    def save_batch(self, items: List[Dict[str, Any]]):
        """批量保存"""
        for item in items:
            self.save_item(item)

    def close(self):
        """关闭/完成写入"""
        pass

    def get_count(self) -> int:
        return self.items_count


class JsonStorage(BaseStorage):
    """JSON Lines 格式存储（每行一个 JSON 对象，便于增量写入）"""

    def __init__(self, output_path: Optional[Path] = None):
        super().__init__(output_path)
        self.output_path = Path(str(self.output_path) + ".jsonl")
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.file = open(self.output_path, "a", encoding="utf-8")

    def save_item(self, item: Dict[str, Any]):
        item["crawled_at"] = datetime.now().isoformat()
        # 关键词列表转字符串以便存储
        if isinstance(item.get("keywords"), list):
            item["keywords"] = ",".join(str(k) for k in item["keywords"])
        self.file.write(json.dumps(item, ensure_ascii=False) + "\n")
        self.file.flush()
        self.items_count += 1

    def close(self):
        self.file.close()
        # 同时导出一个格式化的 JSON 文件
        self._export_formatted_json()

    def _export_formatted_json(self):
        """导出一个格式化的 JSON 数组文件便于阅读"""
        items = []
        with open(self.output_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        items.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        formatted_path = self.output_path.with_suffix(".json")
        with open(formatted_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)


class CsvStorage(BaseStorage):
    """CSV 格式存储"""

    # 定义字段顺序
    FIELDNAMES = [
        "id", "title", "asset_type", "details_url", "thumbnail_url",
        "preview_url", "contributor_name", "contributor_id",
        "keywords", "category", "width", "height",
        "description", "created_at", "author", "license_url",
        "is_editorial", "is_free", "download_count",
        "crawled_at",
    ]

    def __init__(self, output_path: Optional[Path] = None):
        super().__init__(output_path)
        self.output_path = Path(str(self.output_path) + ".csv")
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.file_exists = self.output_path.exists()
        self.file = open(self.output_path, "a", encoding="utf-8-sig", newline="")
        self.writer = csv.DictWriter(self.file, fieldnames=self.FIELDNAMES, extrasaction="ignore")
        if not self.file_exists:
            self.writer.writeheader()

    def save_item(self, item: Dict[str, Any]):
        item["crawled_at"] = datetime.now().isoformat()
        if isinstance(item.get("keywords"), list):
            item["keywords"] = ",".join(str(k) for k in item["keywords"])
        # 填充缺失字段
        row = {k: item.get(k, "") for k in self.FIELDNAMES}
        self.writer.writerow(row)
        self.file.flush()
        self.items_count += 1

    def close(self):
        self.file.close()


class SqliteStorage(BaseStorage):
    """SQLite 数据库存储"""

    def __init__(self, db_path: Optional[Path] = None):
        super().__init__(None)
        self.db_path = db_path or DATABASE_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self._create_table()

    def _create_table(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                title TEXT,
                asset_type TEXT,
                details_url TEXT,
                thumbnail_url TEXT,
                preview_url TEXT,
                contributor_name TEXT,
                contributor_id TEXT,
                keywords TEXT,
                category TEXT,
                width INTEGER,
                height INTEGER,
                description TEXT,
                created_at TEXT,
                is_editorial INTEGER DEFAULT 0,
                is_free INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                crawled_at TEXT,
                raw_data TEXT
            )
        """)
        self.conn.commit()

    def save_item(self, item: Dict[str, Any]):
        cursor = self.conn.cursor()
        crawled_at = datetime.now().isoformat()
        keywords = item.get("keywords", [])
        if isinstance(keywords, list):
            keywords_str = ",".join(str(k) for k in keywords)
        else:
            keywords_str = str(keywords)

        raw_data = json.dumps(item, ensure_ascii=False, default=str)

        try:
            cursor.execute("""
                INSERT OR REPLACE INTO assets
                (id, title, asset_type, details_url, thumbnail_url, preview_url,
                 contributor_name, contributor_id, keywords, category,
                 width, height, description, created_at, is_editorial, is_free,
                 download_count, crawled_at, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(item.get("id", "")),
                item.get("title", ""),
                item.get("asset_type", ""),
                item.get("details_url", ""),
                item.get("thumbnail_url", ""),
                item.get("preview_url", ""),
                item.get("contributor_name", "") or item.get("author", ""),
                str(item.get("contributor_id", "")),
                keywords_str,
                item.get("category", ""),
                int(item.get("width", 0) or 0),
                int(item.get("height", 0) or 0),
                item.get("description", "") or item.get("meta_description", ""),
                item.get("created_at", "") or item.get("upload_date", ""),
                1 if item.get("is_editorial") else 0,
                1 if item.get("is_free") else 0,
                int(item.get("download_count", 0) or 0),
                crawled_at,
                raw_data,
            ))
            self.conn.commit()
            self.items_count += 1
        except sqlite3.Error as e:
            print(f"[SQLite Error] {e}")

    def close(self):
        self.conn.close()


def create_storage(format: str = "json", output_name: str = "") -> BaseStorage:
    """工厂函数：根据格式创建对应的存储实例"""
    output_path = None
    if output_name:
        output_path = OUTPUT_DIR / output_name

    format = format.lower()
    if format == "csv":
        return CsvStorage(output_path)
    elif format == "sqlite":
        return SqliteStorage()
    else:
        return JsonStorage(output_path)
