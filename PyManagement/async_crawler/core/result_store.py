# core/result_store.py
import json
import asyncio
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, String, Text, Integer
from typing import Any, Dict, List
import os

Base = declarative_base()

class CrawlResultDB(Base):
    """结构化爬取结果表"""
    __tablename__ = "crawl_results"
    id = Column(String, primary_key=True)
    task_id = Column(String, index=True)
    url = Column(Text, index=True)
    title = Column(Text, nullable=True)
    # 存储解析后结构化json数据
    data_json = Column(Text, nullable=True)
    resource_type = Column(String, nullable=True)
    saved_file_path = Column(Text, nullable=True)
    crawl_time = Column(Integer, nullable=True)


class BaseResultStore(ABC):
    @abstractmethod
    async def save_result(self, task_id: str, url: str, result_data: Dict[str, Any]):
        """保存单条抓取解析结果"""
        pass

    @abstractmethod
    async def query_results(self, limit: int = 100) -> List[Dict]:
        """查询结果，用于后续导出"""
        pass

    async def close(self):
        """释放底层资源；无资源后端默认空操作"""
        pass


class SQLiteResultStore(BaseResultStore):
    def __init__(self, db_path: str = "crawler.db"):
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        self.async_session = sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)
        self._lock = asyncio.Lock()

    async def init_table(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(CrawlResultDB.metadata.create_all)

    async def save_result(self, task_id: str, url: str, result_data: Dict[str, Any]):
        import time
        async with self._lock:
            async with self.async_session() as session:
                record = CrawlResultDB(
                    id=f"res_{task_id}",
                    task_id=task_id,
                    url=url,
                    title=result_data.get("title"),
                    data_json=json.dumps(result_data.get("parsed_data", {}), ensure_ascii=False),
                    resource_type=result_data.get("resource_type"),
                    saved_file_path=result_data.get("saved_file_path"),
                    crawl_time=int(time.time())
                )
                session.add(record)
                await session.commit()

    async def query_results(self, limit: int = 100) -> List[Dict]:
        async with self._lock:
            async with self.async_session() as session:
                from sqlalchemy import select
                stmt = select(CrawlResultDB).limit(limit)
                result = await session.execute(stmt)
                rows = result.scalars().all()
                res_list = []
                for row in rows:
                    item = {
                        "id": row.id,
                        "task_id": row.task_id,
                        "url": row.url,
                        "title": row.title,
                        "parsed_data": json.loads(row.data_json) if row.data_json else {},
                        "resource_type": row.resource_type,
                        "saved_file_path": row.saved_file_path,
                        "crawl_time": row.crawl_time
                    }
                    res_list.append(item)
                return res_list

    async def close(self):
        """关闭引擎，释放 aiosqlite 后台连接，避免关闭时悬挂任务报错"""
        await self.engine.dispose()


class JsonLinesResultStore(BaseResultStore):
    """JSONL行存储，适合大数据流式写入"""
    def __init__(self, save_path: str = "crawl_result.jsonl"):
        self.save_path = save_path
        self._lock = asyncio.Lock()

    async def save_result(self, task_id: str, url: str, result_data: Dict[str, Any]):
        import time
        record = {
            "task_id": task_id,
            "url": url,
            "title": result_data.get("title"),
            "parsed_data": result_data.get("parsed_data", {}),
            "resource_type": result_data.get("resource_type"),
            "saved_file_path": result_data.get("saved_file_path"),
            "crawl_time": int(time.time())
        }
        async with self._lock:
            with open(self.save_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

    async def query_results(self, limit: int = 100) -> List[Dict]:
        if not os.path.exists(self.save_path):
            return []
        items = []
        async with self._lock:
            with open(self.save_path, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    if idx >= limit:
                        break
                    items.append(json.loads(line))
        return items
