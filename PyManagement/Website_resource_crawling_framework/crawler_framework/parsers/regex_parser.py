"""
解析器实现③：正则表达式 (re) 解析器
支持高效模式匹配、命名捕获组、全量匹配与特定资源提取
"""
import re
from typing import Any, Dict, List, Optional
from crawler_framework.parsers.base import BaseParser, ParseResult


class RegexParser(BaseParser):
    """基于标准库 re 正则表达式的解析策略"""

    @property
    def name(self) -> str:
        return "regex"

    def parse(
        self,
        html_or_text: str,
        base_url: str = "",
        rules: Optional[Dict[str, Any]] = None
    ) -> ParseResult:
        if not html_or_text:
            return ParseResult()

        extracted_data: Dict[str, Any] = {}
        links: List[str] = []
        resources: List[str] = []

        # 1. 执行自定义正则规则
        if rules:
            for field_name, pattern_def in rules.items():
                extracted_data[field_name] = self._extract_by_regex(html_or_text, pattern_def, base_url)
        else:
            # 默认提取标题
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html_or_text, re.IGNORECASE | re.DOTALL)
            if title_match:
                extracted_data["title"] = title_match.group(1).strip()

        # 2. 自动正则提取 href 链接
        href_matches = re.findall(r'<a\s+[^>]*?href=["\']([^"\'>\s]+)["\']', html_or_text, re.IGNORECASE)
        for href in href_matches:
            full_url = self.normalize_url(href, base_url)
            if full_url and full_url not in links:
                links.append(full_url)

        # 3. 自动正则提取媒体/静态文件 (img src, video src, audio src, link href, script src)
        res_patterns = [
            r'<img\s+[^>]*?src=["\']([^"\'>\s]+)["\']',
            r'<video\s+[^>]*?src=["\']([^"\'>\s]+)["\']',
            r'<audio\s+[^>]*?src=["\']([^"\'>\s]+)["\']',
            r'<source\s+[^>]*?src=["\']([^"\'>\s]+)["\']',
            r'<link\s+[^>]*?href=["\']([^"\'>\s]+)["\']',
            r'<script\s+[^>]*?src=["\']([^"\'>\s]+)["\']',
        ]
        for pattern in res_patterns:
            matches = re.findall(pattern, html_or_text, re.IGNORECASE)
            for m in matches:
                full_res = self.normalize_url(m, base_url)
                if full_res and full_res not in resources:
                    resources.append(full_res)

        return ParseResult(
            data=extracted_data,
            extracted_urls=links,
            resource_urls=resources,
            raw_text=re.sub(r"<[^>]+>", " ", html_or_text),
        )

    def _extract_by_regex(self, text: str, pattern_def: Any, base_url: str) -> Any:
        if isinstance(pattern_def, str):
            # 单个模式
            match = re.search(pattern_def, text, re.IGNORECASE | re.DOTALL)
            if not match:
                return None
            # 如果有命名分组，返回分组字典；如果有普通分组，返回group(1)；否则group(0)
            if match.groupdict():
                return match.groupdict()
            elif match.groups():
                return match.group(1).strip()
            return match.group(0).strip()

        elif isinstance(pattern_def, list):
            # 批量匹配所有
            if len(pattern_def) >= 1 and isinstance(pattern_def[0], str):
                pat = pattern_def[0]
                matches = re.findall(pat, text, re.IGNORECASE | re.DOTALL)
                res = []
                for m in matches:
                    if isinstance(m, tuple):
                        res.append([x.strip() for x in m])
                    else:
                        res.append(str(m).strip())
                return res

        elif isinstance(pattern_def, dict):
            out = {}
            for k, p in pattern_def.items():
                out[k] = self._extract_by_regex(text, p, base_url)
            return out

        return None
