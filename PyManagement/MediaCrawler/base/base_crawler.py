
from abc import ABC,abstractmethod

class AbstractCrawler(ABC):
    print(" Crawler Factory Class .....")
    @abstractmethod
    async def start(self):
        """
         start crawler
        """
        pass