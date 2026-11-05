import requests
from lxml import etree
import re
from openpyxl import Workbook

# Cookies
cookies = {
	"_ga": "GA1.1.395531496.1790070605"
}

# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
}

# Base url
base_url = "https://spiderbuf.cn/challenge/web-pagination-scraper?pageno=%d"

# 创建Excel对象
wb = Workbook()
wb.remove(wb.active)  # 删掉默认的 Sheet

# 获取内容
def get_content(url: str,modulo=False) -> str:
	if modulo:
		html = requests.get(url % 1,cookies=cookies,headers=headers).text
	else:
		html = requests.get(url,cookies=cookies,headers=headers).text
	return html

# 生成HTML
def generate_html(index: int,content: str) -> None:
	with open("s04_%d.html"% index,"w",encoding="utf-8") as f:
		f.write(content)
		f.close()

# 生成EXCEL
def generate_excel(index,tr_list) -> None:
	ws = wb.create_sheet("配置清单_%d" % index)
	# tr遍历
	for tr in tr_list:
		cells = tr.xpath("./td | ./th")
		row = [(c.text or "").strip() for c in cells]
		if row:
			ws.append(row)

# 获取解析
def obtain_parsing() -> None:
	content = get_content(base_url,True)
	root = etree.HTML(content)
	lis = root.xpath("//ul[@class='pagination']/li")
	# 分页文本
	page_text = lis[0].xpath("string(.)")
	# 正在匹配页数
	ls = re.findall("[0-9]",page_text)
	# 最大页数
	max_no = int(ls[0])
	for i in range(1, max_no + 1):
		url = base_url % i
		html = get_content(url)
		generate_html(i,html)
		root = etree.HTML(html)
		trs = root.xpath("//tr")
		generate_excel(i,trs)
	# 保存xlsx
	wb.save("s04.xlsx")

# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()