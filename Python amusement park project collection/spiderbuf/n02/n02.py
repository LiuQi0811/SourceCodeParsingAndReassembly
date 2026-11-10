import requests
from lxml import etree
from openpyxl import Workbook
import base64


# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"referer": "https://spiderbuf.cn/challenges?sort=rating"
}



# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers).text
	return html


# 生成HTML
def generate_html(content: str) -> None:
	with open("n02.html","w",encoding="utf-8") as f:
		f.write(content)
		f.close()


# base64转换图片
def covnert_base64_to_img(img_bytes: bytes) -> None:
	with open("./n02.png","wb") as f:
		f.write(img_bytes)
		f.close()


# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/scraping-images-base64")
	generate_html(content)
	root = etree.HTML(content)
	imgs = root.xpath("//img/@src")
	for img in imgs:
		img = img.replace("data:image/png;base64,","")
		# str转 bytes
		str_bytes = img.encode("raw_unicode_escape")
		decoded  = base64.b64decode(str_bytes)
		covnert_base64_to_img(decoded)


# Main 主入口
def main() -> None:
	obtain_parsing()


if __name__ == "__main__":
	main()