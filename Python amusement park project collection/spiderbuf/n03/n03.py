from openpyxl.descriptors import base
import requests
from lxml import etree
from openpyxl import Workbook
import time



# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"referer": "https://spiderbuf.cn/challenges?sort=rating"
}


# 基础地址
base_url = "https://spiderbuf.cn/challenge/scraper-bypass-request-limit/%d"

wb = Workbook()
ws = wb.active
ws.title = "公司信息"

th_name = ""

# 获取页面
def get_pages() -> None:
	max_no = 20
	for i in range(1, max_no + 1):
		url = base_url % i
		html = get_content(url)
		generate_html(html,i)
		root = etree.HTML(html)
		trs = root.xpath("//table//tr")
		generate_excel(trs)
	# 睡眠
	time.sleep(1)
		# 保存xlsx
	wb.save("n03.xlsx")



# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers).text
	return html


# 生成HTML
def generate_html(content: str,index: int) -> None:
	with open("n03_%d.html" % index,"w",encoding="utf-8") as f:
		f.write(content)
		f.close()


# 生成EXCEL
def generate_excel(tr_list: str) -> None:
	global th_name
	if not th_name:
		ths = tr_list[0].xpath("ancestor::table[1]//th")
		th_name = [th.xpath("string(.)").strip() for th in ths]
	if ws.max_row == 1 and th_name:
		ws.append(th_name)
	# 遍历tr
	for tr in tr_list:
		cells = tr.xpath("./td")
		row = [(c.text or "").strip() for c in cells]
		if row:
			ws.append(row)


# 获取解析
def obtain_parsing() -> None:
	get_pages()



# Main 主入口
def main() -> None:
	obtain_parsing()


if __name__ == "__main__":
	main()