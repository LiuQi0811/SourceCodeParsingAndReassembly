import requests
from lxml import etree
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Side,Border,Alignment
import re


# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"referer": "https://spiderbuf.cn/challenges?sort=rating"
}


# 把所有 ::before / ::after 的 content 抽成映射表
class_map = {}

FIELDS = ["导演", "编剧", "主演", "类型", "制片国家/地区", "语言", "上映日期", "片长", "又名"]

COLS = [("name", "片名", 34), ("score", "豆瓣评分", 10), ("导演", "导演", 18),
        ("类型", "类型", 16), ("制片国家/地区", "制片国家/地区", 14), ("语言", "语言", 16),
        ("上映日期", "上映日期", 30), ("片长", "片长", 12), ("又名", "又名", 30),
        ("imdb", "IMDb", 12), ("intro", "简介", 60)]


def norm(s) -> str:
	return re.sub(r"\s+","", s or "")

def dedup(seq):
    out = []
    for x in seq:
        x = x.strip()
        if x and x not in out:
            out.append(x)
    return out

# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers).text
	return html

# 生成classmap 映射
def generate_classmap(content: str) -> None:
	for cls, pseudo, val in re.findall(r'\.([\w-]+)::(before|after)\s*\{\s*content:\s*"([^"]*)"',content):
			class_map[(cls, pseudo)] = val


def save_excel(rows, path="SpiderBuf_n04_电影数据.xlsx") -> None:
	wb = Workbook()
	ws = wb.active
	ws.title = "高分电影"
	head_font = Font(name="Microsoft YaHei", bold=True, color="FFFFFF", size=11)
	head_fill = PatternFill("solid", start_color="4F46E5")
	body_font = Font(name="Microsoft YaHei", size=10)
	thin = Side(style="thin", color="D1D5DB")
	border = Border(left=thin, right=thin, top=thin, bottom=thin)
	
	ws.append([c[1] for c in COLS])
	for c in ws[1]:
		c.font, c.fill, c.border = head_font, head_fill, border
		c.alignment = Alignment(horizontal="center", vertical="center")
	ws.row_dimensions[1].height = 26

	for i, m in enumerate(rows, start=2):
		ws.append([m.get(k, "") for k, _, _ in COLS])

		for c in ws[i]:
			c.font, c.border = body_font, border
			c.alignment = Alignment(vertical="center", wrap_text=True)
		ws.cell(row=i, column=2).font = Font(name="Microsoft YaHei", size=11, bold=True, color="DC2626")
		ws.cell(row=i, column=2).alignment = Alignment(horizontal="center", vertical="center")
		ws.row_dimensions[i].height = 48

	for idx, (_, _, w) in enumerate(COLS, start=1):
		ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = w

	ws.freeze_panes = "A2"
	ws.auto_filter.ref = ws.dimensions
	# 保存成excel
	wb.save(path)


# 获取解析
def obtain_parsing() -> list:
	content = get_content("https://spiderbuf.cn/challenge/css-pseudo-elements")
	content = re.sub(r"<br\s*/?>", "\n", content, flags=re.I)
	generate_classmap(content)
	root = etree.HTML(content)
	rows = []
	for item in root.xpath("//div[contains(@class,'grid') and .//h2[@class]]"):
		block = item.xpath(".//span[contains(@class,'rbmsak')]/..")[0]
		rec = {
			"name": item.xpath("./h2/text()")[0].strip(),
			"score": "".join(block.xpath("./span[contains(@class,'rbmsak')]/text()")),
			"imdb": ""
		}

		for line in "".join(block.itertext()).splitlines():
			line = norm(line)
			if not line:
				continue

			for f in FIELDS:
				if line.startswith(f+ ":"):
					rec[f] = " / ".join(dedup(re.split(r"[／/]", line[len(f) + 1:])))
					break
				else:
					if line.startswith("IMDb:"):
						rec["imdb"] = line[5:]

		for f in FIELDS:
			rec.setdefault(f, "")
		rows.append(rec)

	intros = []
	for row in root.xpath("//div[@style='margin-top: 10px;']"):
		t = norm("".join(row.itertext()))
		if t.startswith("简介："):
			intros.append(t[3:])

	for i, r in enumerate(rows):
		r["intro"] = intros[i] if i < len(intros) else ""

	return rows



# Main 主入口
def main() -> None:
	data = obtain_parsing()
	save_excel(data)


if __name__ == "__main__":
	main()