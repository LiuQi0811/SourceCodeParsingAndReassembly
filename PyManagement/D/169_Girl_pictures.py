import os
import asyncio
class SingletonMeta(type):
    """单例模式元类：保证爬虫全局只有一个实例"""
    _instances = {}
    def __call__(self, *args, **kwargs) -> None:
        print(self, args, kwargs)


class ImageSpider(metaclass= SingletonMeta):
    print(" ImageSpider ")


class SpiderFactory:
    """简单工厂模式：生成爬虫实例，方便后续扩展不同站点爬虫"""
    @staticmethod
    def create_spider(spider_type: str):
        if spider_type == "image":
            return  ImageSpider()


async def main():
    print(" Main ........")

if __name__ == '__main__':
    asyncio.run(main())
