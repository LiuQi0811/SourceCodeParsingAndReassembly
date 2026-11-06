import requests
from lxml import etree
from openpyxl import Workbook

# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"cookie":"admin=69c39a0a5a59ad799daca7dcf3660e80;"
}


# 获取内容
def get_content(url: str) -> str:
	payload = {
		"username": "admin",
		"password": "123456"
	}
	html = requests.get(url,headers=headers,data=payload).text
	return html



# 生成HTML
def generate_html(content: str) -> None:
	with open("e02.html","w",encoding="utf-8") as f:
		f.write(content)
		f.close()



# 生成EXCEL
def generate_excel(tr_list: str) -> None:
	wb = Workbook()
	ws = wb.active
	ws.title = "公司信息"
	# 遍历tr
	for tr in tr_list:
		cells = tr.xpath("./td | ./th")
		row = [(c.text or "").strip() for c in cells]
		if row:
			ws.append(row)
	# 保存xlsx
	wb.save("e02.xlsx")


# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/web-scraping-with-captcha/list")
	generate_html(content)
	print(content)
	root = etree.HTML(content)
	trs = root.xpath("//table//tr")
	generate_excel(trs)



# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()