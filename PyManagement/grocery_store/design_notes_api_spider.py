import requests
import csv
import os
import time
import random
from urllib.parse import urljoin

# -------------------------- 可配置参数 --------------------------
BASE_URL = "https://designnotes.cn/"
DELAY_MIN = 0.3  # 最小请求间隔(秒)，接口请求无需等待太长
DELAY_MAX = 0.8  # 最大请求间隔(秒)
PAGE_SIZE = 100  # 单页拉取数量，最大可设为100
TIMEOUT = 15
# ----------------------------------------------------------------

# 随机UA池，模拟真实浏览器访问
UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0"
]


def get_random_headers():
    """生成模拟真实浏览器的请求头，直接请求接口无需XMLHttpRequest标识"""
    return {
        "User-Agent": random.choice(UA_LIST),
        "Referer": BASE_URL,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.8"
    }


def get_all_categories():
    """直接调用分类接口获取全部分类，无需解析HTML"""
    try:
        resp = requests.get(urljoin(BASE_URL, "api/categories"), headers=get_random_headers(), timeout=TIMEOUT)
        resp.raise_for_status()
        categories = resp.json()
        print(f"✅ 共获取到 {len(categories)} 个分类：{[c['name_zh'] for c in categories]}")
        return categories
    except Exception as e:
        print(f"❌ 获取分类失败：{str(e)}")
        return []


def crawl_category_tools(category_info):
    """按分类拉取所有资源，接口直接返回全量JSON数据，无需分页，速度极快"""
    cat_id = category_info["id"]
    cat_name = category_info["name_zh"]
    print(f"🔍 正在拉取【{cat_name}】全量数据")
    try:
        params = {
            "categoryId": cat_id,
            "pageSize": 9999  # 拉取全量
        }
        resp = requests.get(
            urljoin(BASE_URL, "api/tools"),
            params=params,
            headers=get_random_headers(),
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        all_tools = resp.json()
        print(f"📋 【{cat_name}】共拉取到 {len(all_tools)} 个资源")
        return all_tools

    except Exception as e:
        print(f"❌ 【{cat_name}】拉取失败：{str(e)}")
        return []


def format_tool_data(tool_item):
    """将接口返回的原始JSON结构化为CSV需要的字段，自动兼容中英文内容"""
    # 处理图片完整路径
    img_url = urljoin(BASE_URL, tool_item.get("img", "")) if tool_item.get("img") else "无图标"
    bg_url = urljoin(BASE_URL, tool_item.get("background", "")) if tool_item.get("background") else "无背景图"
    # 处理标签
    tags = "、".join([tag.get("zh", tag.get("en", "")) for tag in tool_item.get("tags", [])]) if tool_item.get("tags") else "无标签"

    return {
        "资源名称": tool_item.get("title", "未命名"),
        "资源简介": tool_item.get("depiction", {}).get("zh", ""),
        "详细描述": tool_item.get("description", {}).get("zh", ""),
        "费用类型": tool_item.get("fee", {}).get("zh", "未知"),
        "登录要求": tool_item.get("registration", {}).get("zh", "未知"),
        "所属分类": tool_item.get("category", {}).get("zh", ""),
        "评分": tool_item.get("rating", 0),
        "点赞数": tool_item.get("like_cnt", 0),
        "访问量": tool_item.get("ran_cnt", 0),
        "标签": tags,
        "资源官网地址": tool_item.get("url", "无公开地址"),
        "图标链接": img_url,
        "背景预览图": bg_url,
        "是否需要VPN": "是" if tool_item.get("vpn", 0) == 1 else "否",
        "更新时间": tool_item.get("updatedAt", ""),
        "创建时间": tool_item.get("createdAt", "")
    }


def main():
    """主流程：接口直接拉取JSON数据，每个分类单独保存CSV，无需渲染JS速度极快"""
    # 创建数据存储目录
    os.makedirs("design_notes_api_data", exist_ok=True)

    # 第一步：获取全部分类
    all_categories = get_all_categories()
    if not all_categories:
        print("❌ 未获取到任何有效分类，爬虫终止")
        return

    # 第二步：按分类逐个拉取数据
    for cat_info in all_categories:
        cat_name = cat_info["name_zh"]
        # 过滤文件名非法字符
        invalid_chars = r'\/:*?"<>|'
        safe_cat_name = "".join([c for c in cat_name if c not in invalid_chars])
        save_path = f"design_notes_api_data/{safe_cat_name}.csv"

        # 拉取该分类所有资源
        tools_data = crawl_category_tools(cat_info)
        if not tools_data:
            print(f"ℹ️ 【{cat_name}】未拉取到任何资源，跳过该分类")
            continue

        # 格式化数据
        formatted_data = [format_tool_data(item) for item in tools_data]

        # 写入CSV文件
        with open(save_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=formatted_data[0].keys())
            writer.writeheader()
            writer.writerows(formatted_data)
        print(f"✅ 【{cat_name}】数据已保存至 {save_path}，共 {len(formatted_data)} 条记录")

        # 分类之间加短延时，避免请求过快被限流
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


if __name__ == "__main__":
    main()
