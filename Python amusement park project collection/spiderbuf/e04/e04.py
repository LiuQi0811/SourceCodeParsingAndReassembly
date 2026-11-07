import requests
from lxml import etree
from openpyxl import Workbook



# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"cookie":"admin=69c39a0a5a59ad799daca7dcf3660e80;"
}

wb = Workbook()
ws = wb.active
ws.title = "《2021胡润中国500强》"
th_name = ""

# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers).text
	return html


# 获取后缀列表
def get_suffixs() -> list:
	suffixs = []
	content = get_content("https://spiderbuf.cn/challenge/block-ip-proxy")
	root = etree.HTML(content)
	lis = root.xpath("//ul[@class='pagination']/li/a")
	pages = []
	for li in lis:
		if li.attrib["class"] != "item trap":
			pages.append(li.attrib["href"])
	for page in pages:
		suffix = page.replace("/challenge/block-ip-proxy","")
		suffixs.append(suffix)
	return suffixs


# 生成HTML
def generate_html(content: str,i: int) -> None:
	with open("e04_%d.html" % i,"w",encoding="utf-8") as f:
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
	suffixs = get_suffixs()
	i = 1
	for suffix in suffixs:
		url = "https://spiderbuf.cn/challenge/block-ip-proxy" + suffix
		html = get_content(url)
		generate_html(html,i)
		root = etree.HTML(html)
		trs = root.xpath("//table//tr")
		generate_excel(trs)
		i += 1
	wb.save("e04.xlsx")




# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()