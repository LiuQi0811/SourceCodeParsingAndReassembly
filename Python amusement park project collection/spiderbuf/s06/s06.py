import requests
from lxml import etree
from openpyxl import Workbook


# Cookies
cookies = {
	"_ga": "GA1.1.395531496.1790070605"
}

# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
}


# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,cookies=cookies, headers=headers).text
	return html


# 生成HTML
def generate_html(content: str) -> None:
	with open("s06.html","w",encoding="utf-8") as f:
		f.write(content)
		f.close()

# 生成EXCEL
def generate_excel(tr_list: str) -> None:
	wb = Workbook()
	ws = wb.active
	# tr遍历
	for tr in tr_list:
		cells = tr.xpath("./td | ./th")
		row = [(c.xpath("string(.)") or "") for c in cells]
		if row:
			ws.append(row)
	# 保存xlsx
	wb.save("s06.xlsx")


# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/scraping-iframe")
	root = etree.HTML(content)
	# 获取iframe 网址后缀
	iframe_suffix = str(root.xpath("//iframe/@src")[0])
	html = get_content("https://spiderbuf.cn" + iframe_suffix)
	generate_html(html)
	root = etree.HTML(html)
	trs = root.xpath("//table//tr")
	generate_excel(trs)


# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()