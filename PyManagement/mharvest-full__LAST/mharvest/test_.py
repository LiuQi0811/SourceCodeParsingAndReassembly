from mharvest import Crawler, CrawlConfig, HttpClient, FileStore

client = HttpClient(delay=0.5)
store = FileStore("./downloads")
crawler = Crawler(client, store, CrawlConfig(depth=5,max_pages= 100))
report = crawler.run("https://www.169tp.com/")
print(report.summary())