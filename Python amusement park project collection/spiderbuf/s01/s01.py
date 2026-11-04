import requests
from lxml import etree
from openpyxl import Workbook

# 获取内容
def get_content(url:str) -> str:
	html = requests.get(url).text
	return html

# 生成HTML
def generate_html(content: str) -> None:
	with open("s01.html","w", encoding="utf-8") as f:
		f.write(content)
		f.close()

# 生成TXT
def generate_txt(tr_list) -> None:
	with open("s01.txt","w", encoding="utf-8") as f:
		for tr in tr_list:
			td_list = tr.xpath("./td")
			result = ""
			for td in td_list:
				result = result + str(td.text) + "|"
			if result != "":
				f.write(result + "\n")

# 生成EXCEL
def generate_excel(tr_list) -> None:
	# 创建Excel对象
	wb = Workbook()
	ws = wb.active
	ws.title = "设备信息"

	# tr遍历
	for tr in tr_list:
		cells = tr.xpath("./td | ./th")
		row = [(c.text or "").strip() for c in cells]
		if row:
			ws.append(row)
	# 保存xlsx
	wb.save("s01.xlsx")

# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/requests-lxml-for-scraping-beginner")
	generate_html(content)
	root = etree.HTML(content)
	tr_list = root.xpath("//tr")
	generate_txt(tr_list)
	generate_excel(tr_list)

def main() -> None:
	obtain_parsing()



if __name__ == "__main__":
	main()