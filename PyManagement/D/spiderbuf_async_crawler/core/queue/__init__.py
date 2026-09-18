"""队列策略（策略模式）。

- MemoryQueueStrategy：一次性加载全部 URL 到内存，asyncio.Queue + 去重
- SQLiteQueueStrategy：SQLite 持久化，边发现边入库，支持断点续爬
"""
