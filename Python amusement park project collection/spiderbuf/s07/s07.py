import requests
from lxml import etree
from openpyxl import Workbook
import re
import json

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
	html = requests.get(url,cookies=cookies, headers=headers)
	html.encoding= "utf-8"
	return html.text


# 下载JSON
def download_json(ls) -> None:
	with open("s07.json","w",encoding="utf-8") as f:
		f.write(json.dumps(ls,ensure_ascii=False))
		f.close()


# 生成EXCEL
def generate_excel(json_ls,root) -> None:
	ths = root.xpath("//table//th")
	th_titles = []
	for th in ths:
		th_titles.append(th.xpath("string(.)"))
	# 创建Excel对象
	wb = Workbook()
	ws= wb.active
	ws.title = "设备信息"
	ws.append(th_titles)

	# 表头 -> JSON key 的对应
	key_map = {
		"IP地址": "ip",
		"MAC地址": "mac",
		"设备名称": "name",
		"设备类型": "type",
		"操作系统": "manufacturer",  # 页面 JS 里这一列填的就是 manufacturer
		"开放端口": "ports",
		"在线状态": "status",
	}

	# 遍历json数据列表
	for js in json_ls:
		row = []
		# 遍历表格标题名称
		for title in th_titles:
			# 获取key
			key = key_map.get(title)
			# 取不到就填 "-"，跟页面显示一致
			row.append(js.get(key, "-") if key else "-")
		ws.append(row)
	# 保存xlsx
	wb.save("s07.xlsx")


# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/scraping-ajax-api")
	root = etree.HTML(content)
	scripts = root.xpath("//script[not(@src)]/text()")
	api = ""
	for script in scripts:
		match = re.search(r'fetch\(\s*["\']([^"\']+)["\']',script)
		if match:
			api = match.group(1)
			break
	json_data = get_content("https://spiderbuf.cn"+ api)
	ls = json.loads(json_data)
	download_json(ls)
	generate_excel(ls,root)









# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()