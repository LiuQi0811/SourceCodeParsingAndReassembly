from abc import ABC, abstractmethod


class BaseParser(ABC):
    @abstractmethod
    def parse_links(self, text: str, base_url: str) -> list[dict]:
        ...

    @abstractmethod
    def parse_resources(self, text: str, base_url: str) -> list[dict]:
        ...

    @abstractmethod
    def parse_title(self, text: str) -> str:
        ...