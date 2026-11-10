from os import name

import requests
from dataclasses import dataclass
from lxml import etree
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment,Side,Border
from openpyxl.chart import BarChart,Reference
import re


# Headers
headers = {
	"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
	"referer": "https://spiderbuf.cn/challenges?sort=rating"
}



# 公司对象
@dataclass
class Company:
	name: str
	rank: int
	value: int
	ceo: str
	industry: str



# 获取内容
def get_content(url: str) -> str:
	html = requests.get(url,headers=headers).text
	return html

# 解析公司信息
def parse_companies(content: str) -> list[Company]:
	root = etree.HTML(content)
	companies = []
	for card in root.xpath("//div[contains(@class,'col-xs-6')]"):
		name = card.findtext("h2",default="").strip()
		if not name:
			continue
		fields = {}
		for p in card.xpath("./p"):
			key, _, val = "".join(p.itertext()).strip().partition("：")
			fields[key.strip()] = val.strip()
		companies.append(
			Company(name=name,
				rank=int(re.sub(r"\D", "", fields.get("排名", "0")) or 0),
				value=int(re.sub(r"\D","",fields.get("企业估值(亿元)","0")) or 0),
				ceo=fields.get("CEO",""),
				industry=fields.get("行业",""))
			)
	return companies

def save_xlsx(companies: list[Company], path: str) -> None:
	wb = Workbook()
	ws = wb.active
	ws.title = "企业明细"
	head_font = Font(name="Microsoft YaHei",bold=True,color="FFFFFF",size=11)
	head_fill = PatternFill("solid",start_color="1F4E79")
	body_font = Font(name="Microsoft YaHei",size=10)
	band_fill = PatternFill("solid", start_color="EEF3F8")
	thin = Side(style="thin", color="D9D9D9")
	border = Border(left=thin, right=thin, top=thin, bottom=thin)

	cols = ["排名","企业名称","企业估值(亿元)","CEO","行业"]
	ws.append(cols)

	for c in ws[1]:
		c.font, c.fill, c.border = head_font, head_fill, border
		c.alignment = Alignment(horizontal="center",vertical="center")

	for i,co in enumerate(companies,start=2):
		ws.append([co.rank, co.name, co.value, co.ceo, co.industry])

		for c in ws[i]:
			c.font, c.border = body_font, border
			if i % 2 == 0:
				c.fill = band_fill
		ws.cell(i,1).alignment = Alignment(horizontal="center")
		ws.cell(i,3).number_format = "#,##0"

	for col, w in zip("ABCDE",[8, 26, 16, 20, 26]):
		ws.column_dimensions[col].width = w
	ws.freeze_panes = "A2"
	ws.auto_filter.ref = f"A1:E{len(companies) + 1}"

	# 行业汇总：用公式引用明细表，改数据自动重算
	ws2= wb.create_sheet("行业汇总")
	ws2.append(["行业", "企业数量", "估值合计(亿元)", "估值均值(亿元)"])

	for c in ws2[1]:
		c.font, c.fill, c.border = head_font, head_fill, border
		c.alignment = Alignment(horizontal="center", vertical="center")
	industries = sorted({co.industry for co in companies if co.industry})
	last = len(companies) + 1
	for i, ind in enumerate(industries, start=2):
		ws2.cell(i, 1, ind)
		ws2.cell(i, 2, f'=COUNTIF(企业明细!$E$2:$E${last},$A{i})')
		ws2.cell(i, 3, f'=SUMIF(企业明细!$E$2:$E${last},$A{i},企业明细!$C$2:$C${last})')
		ws2.cell(i, 4, f'=IFERROR(AVERAGEIF(企业明细!$E$2:$E${last},$A{i},'
                       f'企业明细!$C$2:$C${last}),0)')

		for c in ws2[i]:
			c.font, c.border = body_font, border
		ws2.cell(i, 3).number_format = "#,##0"
		ws2.cell(i, 4).number_format = "#,##0"

	n = len(industries) + 1
	ws2.cell(n + 1, 1, "合计")
	ws2.cell(n + 1, 2, f"=SUM(B2:B{n})")
	ws2.cell(n + 1, 3, f"=SUM(C2:C{n})")

	for c in ws2[n + 1]:
		c.font = Font(name="Microsoft YaHei", bold=True, size=10)
		c.fill = band_fill
	ws2.cell(n + 1, 3).number_format = "#,##0"

	for col, w in zip("ABCD", [26, 12, 18, 18]):
		ws2.column_dimensions[col].width = w
	ws2.freeze_panes = "A2"

	chart = BarChart()
	chart.title = "各行业企业估值合计(亿元)"
	chart.type = "bar"
	chart.height, chart.width = 14, 18
	chart.add_data(Reference(ws2, min_col=3, min_row=1, max_row=n), titles_from_data=True)
	chart.set_categories(Reference(ws2, min_col=1, min_row=2, max_row=n))
	chart.legend = None
	ws2.add_chart(chart, "F2")

	# 保存xlsx
	wb.save(path)



# 获取解析
def obtain_parsing() -> list[Company]:
	content = get_content("https://spiderbuf.cn/challenge/user-agent-referrer")
	companies = parse_companies(content)
	save_xlsx(companies,"胡润中国500强.xlsx")
	return companies




# Main 主入口
def main() -> None:
	data = obtain_parsing()
	print(f"解析 {len(data)} 家企业，已生成 胡润中国500强.xlsx")
	for co in data[:5]:
		print(co.rank, co.name, co.value, co.ceo, co.industry)


if __name__ == "__main__":
	main()