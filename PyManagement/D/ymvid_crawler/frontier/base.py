from abc import ABC, abstractmethod


class URLFrontier(ABC):
    @abstractmethod
    async def put(self, url: str, depth: int = 0, parent: str = ""):
        ...

    @abstractmethod
    async def get(self) -> tuple[str, int] | None:
        ...

    @abstractmethod
    async def mark_done(self, url: str, status: str = "done"):
        ...

    @abstractmethod
    async def mark_error(self, url: str, error: str = ""):
        ...

    @abstractmethod
    async def size(self) -> int:
        ...

    @abstractmethod
    async def close(self):
        ...