# core/queue_strategy.py
import asyncio
import uuid
from abc import ABC, abstractmethod
from typing import List, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, String, Enum, Integer, Text
from core.task_model import CrawlTask, TaskStatus, ParserType
from utils.url_utils import url_fingerprint

Base = declarative_base()


class TaskDBModel(Base):
    __tablename__ = "crawl_tasks"
    id = Column(String, primary_key=True)
    url = Column(Text, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    parser_type = Column(Enum(ParserType), default=ParserType.BS4)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    referer = Column(Text, nullable=True)
    url_fp = Column(String, index=True)  # url指纹索引


class BaseQueueStrategy(ABC):
    @abstractmethod
    async def put(self, task: CrawlTask) -> bool:
        """入队，返回 True 表示真正新增，False 表示因已存在被跳过"""
        pass

    @abstractmethod
    async def get(self) -> Optional[CrawlTask]:
        pass

    @abstractmethod
    async def update_task_status(self, task_id: str, status: TaskStatus, retry_count: int = None):
        pass

    @abstractmethod
    async def qsize(self) -> int:
        pass

    async def close(self):
        """释放底层资源；无资源后端默认空操作"""
        pass


class MemoryQueueStrategy(BaseQueueStrategy):
    def __init__(self):
        self.queue = asyncio.Queue()
        self.task_map = dict()

    async def put(self, task: CrawlTask) -> bool:
        self.task_map[task.task_id] = task
        await self.queue.put(task)
        return True

    async def get(self) -> Optional[CrawlTask]:
        try:
            task = self.queue.get_nowait()
            task.status = TaskStatus.RUNNING
            self.task_map[task.task_id] = task
            return task
        except asyncio.QueueEmpty:
            return None

    async def update_task_status(self, task_id: str, status: TaskStatus, retry_count: int = None):
        if task_id in self.task_map:
            t = self.task_map[task_id]
            t.status = status
            if retry_count is not None:
                t.retry_count = retry_count

    async def qsize(self) -> int:
        return self.queue.qsize()


class SQLiteQueueStrategy(BaseQueueStrategy):
    def __init__(self, db_path: str = "crawler.db"):
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        self.async_session = sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)
        self._lock = asyncio.Lock()

    async def init_table(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def put(self, task: CrawlTask) -> bool:
        async with self._lock:
            async with self.async_session() as session:
                fp = url_fingerprint(task.url)
                from sqlalchemy import select
                stmt = select(TaskDBModel).where(TaskDBModel.url_fp == fp)
                result = await session.execute(stmt)
                exist = result.scalar_one_or_none()
                if exist:
                    return False
                db_task = TaskDBModel(
                    id=task.task_id,
                    url=task.url,
                    status=task.status,
                    parser_type=task.parser_type,
                    retry_count=task.retry_count,
                    max_retry=task.max_retry,
                    referer=task.referer,
                    url_fp=fp
                )
                session.add(db_task)
                await session.commit()
                return True

    async def get(self) -> Optional[CrawlTask]:
        async with self._lock:
            async with self.async_session() as session:
                from sqlalchemy import select
                stmt = select(TaskDBModel).where(TaskDBModel.status == TaskStatus.PENDING).limit(1)
                result = await session.execute(stmt)
                db_task = result.scalar_one_or_none()
                if not db_task:
                    return None
                db_task.status = TaskStatus.RUNNING
                await session.commit()
                task = CrawlTask(
                    url=db_task.url,
                    task_id=db_task.id,
                    status=db_task.status,
                    parser_type=db_task.parser_type,
                    retry_count=db_task.retry_count,
                    max_retry=db_task.max_retry,
                    referer=db_task.referer
                )
                return task

    async def update_task_status(self, task_id: str, status: TaskStatus, retry_count: int = None):
        async with self._lock:
            async with self.async_session() as session:
                from sqlalchemy import select
                stmt = select(TaskDBModel).where(TaskDBModel.id == task_id)
                result = await session.execute(stmt)
                db_task = result.scalar_one_or_none()
                if not db_task:
                    return
                db_task.status = status
                if retry_count is not None:
                    db_task.retry_count = retry_count
                await session.commit()

    async def qsize(self) -> int:
        async with self._lock:
            async with self.async_session() as session:
                from sqlalchemy import select, func
                stmt = select(func.count(TaskDBModel.id)).where(TaskDBModel.status == TaskStatus.PENDING)
                result = await session.execute(stmt)
                cnt = result.scalar()
                return cnt

    async def close(self):
        """关闭引擎，释放 aiosqlite 后台连接，避免关闭时悬挂任务报错"""
        await self.engine.dispose()
