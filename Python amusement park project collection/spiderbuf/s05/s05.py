import requests
from lxml import etree
from typing import Any

# Cookies
cookies = {
	"_ga": "GA1.1.395531496.1790070605"
}

# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
}

# 获取内容
def get_content(url: str,type_body="text") -> Any:
	if type_body =="content":
		html = requests.get(url,cookies=cookies, headers=headers).content
	else:
		html = requests.get(url,cookies=cookies, headers=headers).text
	return html


# 生成HTML
def generate_html(content: str) -> None:
	with open("s05.html","w",encoding="utf-8") as f:
		f.write(content)
		f.close()


# 下载图片
def download_img(img: str,content: bytes) -> None:
	with open("./assets/"+str(img).replace("/",""),"wb") as f:
		f.write(content)
		f.close()


# 获取解析
def obtain_parsing() -> None:
	content = get_content("https://spiderbuf.cn/challenge/scraping-images-from-web")
	generate_html(content)
	root = etree.HTML(content)
	imgs = root.xpath("//img/@src")
	for img in imgs:
		html = get_content("https://spiderbuf.cn"+ img,type_body="content")
		download_img(img,html)


# Main 主入口
def main() -> None:
	obtain_parsing()

if __name__ == "__main__":
	main()