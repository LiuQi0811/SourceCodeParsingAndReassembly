import requests
from lxml import etree
from openpyxl import Workbook
from openpyxl.styles import PatternFill,Font,Alignment
import re
import sys

URL = "https://spiderbuf.cn/challenge/css-sprites"

# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"referer": "https://spiderbuf.cn/challenges?sort=rating"
}


# 雪碧图每个数字格的宽度(px)
CELL_W = 12

# 所有数字 span 共有的基类
SPRITE_CLS = "sprite"

# 把 base64 图解码后逐格渲染成 ASCII 实测得到（格序 -> 数字）：
#   格0=7 格1=2 格2=3 格3=6 格4=4 格5=8 格6=1 格7=5 格8=9 格9=0
GLYPH_ORDER = [7, 2, 3, 6, 4, 8, 1, 5, 9, 0]

# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers,timeout=15)
	html.raise_for_status()
	html.encoding = html.apparent_encoding or "utf-8"
	return html.text


# 构建样式映射
def build_class_map(html: str) -> dict[str,int]:
	# 匹配形如：.abcdef { background-position: -106px 0px; display: inline-block; }
	pattern = re.compile(r"\.(?P<name>[a-zA-Z]+)\s*\{[^}]*?background-position:\s*(?P<x>-?\d+)\s*px",re.S)
	cmap: dict[str, int] = {}
	for m in pattern.finditer(html):
		name,x = m.group("name"), int(m.group("x"))

		# .sprite 是基类，不是数字
		if name == SPRITE_CLS:
			continue
		idx = round(-x / CELL_W) % 10
		cmap[name] = GLYPH_ORDER[idx]
	return cmap


# 解析值
def parse_value(p_tag, cmap: dict[str, int]) -> str:
	"""把一个 <p>企业估值...> 里的所有 sprite span 拼成数字"""
	digits = []
	for span in p_tag.xpath('.//span[contains(concat(" ",@class," ")," sprite ")]'):
		classes = span.get("class","").split()
		for c in classes:
			if c != SPRITE_CLS and c in cmap:
				digits.append(str(cmap[c]))
				break
	return "".join(digits)


def field(card, keyword: str) -> str:
	nodes = card.xpath(f'.//p[contains(., "{keyword}")]')
	if not nodes:
	 	return ""
	txt = nodes[0].xpath("string(.)").strip()
	return txt.split("：", 1)[-1].split(":", 1)[-1].strip()

CARD_XPATH = (
	'//div[.//h2 and .//p[contains(., "企业估值")] '
	'and not(.//div[.//h2 and .//p[contains(., "企业估值")]])]'
)

# 获取解析
def obtain_parsing():
	content = get_content(URL)
	root = etree.HTML(content)
	cmap = build_class_map(content)
	if not cmap:
		raise RuntimeError("没解析到雪碧图映射，页面结构可能变了")

	rows, seen = [], set()
	for card in root.xpath(CARD_XPATH):
		name = card.xpath(".//h2[1]/text()")
		name = name[0].strip() if name else ""
		rank = field(card,"排名")
		ceo = field(card, "CEO")
		industry = field(card, "行业")
		vp = card.xpath('.//p[contains(., "企业估值")]')
		value = parse_value(vp[0], cmap) if vp else ""

		key = (rank, name)
		if key in seen:
			continue
		seen.add(key)
		rows.append([rank, name, value, ceo, industry])
	return cmap, rows

# 保存Excel
def save(rows, path="hurun_500.xlsx"):
	wb = Workbook()
	ws = wb.active
	ws.title = "2021胡润中国500强"
	heads = ["排名", "企业", "企业估值(亿元)", "CEO", "行业"]
	ws.append(heads)
	hfill = PatternFill("solid", fgColor="4F46E5")
	for c in ws[1]:
		c.font = Font(bold=True, color="FFFFFF")
		c.fill = hfill
		c.alignment = Alignment(horizontal="center", vertical="center")

	for r in rows:
		ws.append([r[0], r[1], int(r[2]) if r[2].isdigit() else r[2], r[3], r[4]])

	for col, w in zip("ABCDE", [8, 20, 16, 12, 28]):
		ws.column_dimensions[col].width = w

	ws.freeze_panes = "A2"

	wb.save(path)
	return path


# Main 主入口
def main() -> None:
	if len(sys.argv) > 1:
		with open(sys.argv[1], encoding="utf-8") as f:
			html = f.read()
	else:
		html = get_content(URL)

	cmap, rows = obtain_parsing()
	# 生成Excel
	out = save(rows)


if __name__ == "__main__":
	main()