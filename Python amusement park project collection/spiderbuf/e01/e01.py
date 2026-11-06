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
def get_content(url: str,method="GET") -> str:
	payload = {
		"username": "admin",
		"password":"123456"
	}
	if method =="POST":
		html = requests.post(url,cookies=cookies,headers=headers,data=payload).text
	else:
		html = requests.get(url,cookies=cookies, headers=headers).text
	return html


# 生成HTML
def generate_html(content: str) -> None:
	with open("e01.html","w",encoding="utf-8") as f:
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
	wb.save("e01.xlsx")





# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/scraper-login-username-password/login","POST")
	generate_html(content)
	root = etree.HTML(content)
	trs = root.xpath("//table//tr")
	generate_excel(trs)




# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()