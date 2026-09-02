import requests,json
from bs4 import BeautifulSoup
headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://www.douyin.com',
    'priority': 'u=1, i',
    'referer': 'https://www.douyin.com/jingxuan',
    'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'uifid': 'ad6934b0ab4e320902181a25912539b0861279799a57efa23bca0f8a191970a4f11e0bbc34c4d28337d8b1138794250db9fc2c1ade3ffdf742af88f67f145e1f7cbc476de0ae217c8e238c46522267c83f1030c605dd7b8fe6388dc5f2b2e9229d9a8cd5aed277a9e17530c542cf2c835b41d475af8f9f0e7726d5c4914a75a13a23ef45648bef4566382ef5021cdf2cd7934986eaa81af0ee67b20e6be56b7a',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    'x-secsdk-csrf-token': 'DOWNGRADE',
    'cookie': 'enter_pc_once=1; UIFID_TEMP=ad6934b0ab4e320902181a25912539b0861279799a57efa23bca0f8a191970a4f11e0bbc34c4d28337d8b1138794250d62bf3a86b83f5b4ac8a1503f57198d236d5702a4141bb44f27ad4cea2d0c77ec; s_v_web_id=verify_mskd6lam_42CdlcBy_h7s6_4vey_BWZd_gtCUWXOqcESf; hevc_supported=true; dy_swidth=1680; dy_sheight=1050; odin_tt=92e6bf77cb404522602c9c4aa5820eaf740173531d218bf07c5d3f0872d929773e14d2e3640453c6a5fd45a8fe2e9a586217af2a14af55385c9b2c0f7c493481e4d629e18ff04d95570a27df49ba0e89; fpk1=U2FsdGVkX1/BZxa/uMBMhbIJX2AjpJSx0sa3/7VWxJ7Z2BLw48r25OToXs+4MBoxC436HwmdfXWo+4laH7sMhg==; fpk2=4fc07ba599f9d84ac2c5f3d36be5aadf; passport_csrf_token=69a96103bd21ff4a54e0437bd5e9c085; passport_csrf_token_default=69a96103bd21ff4a54e0437bd5e9c085; __security_mc_1_s_sdk_crypt_sdk=65d63aae-4752-adb5; bd_ticket_guard_regenerate_keys_time=2026-08-08/20:43:08; bd_ticket_guard_client_web_domain=2; is_dash_user=1; volume_info=%7B%22isUserMute%22%3Afalse%2C%22isMute%22%3Afalse%2C%22volume%22%3A0.5%7D; UIFID=ad6934b0ab4e320902181a25912539b0861279799a57efa23bca0f8a191970a4f11e0bbc34c4d28337d8b1138794250db9fc2c1ade3ffdf742af88f67f145e1f7cbc476de0ae217c8e238c46522267c83f1030c605dd7b8fe6388dc5f2b2e9229d9a8cd5aed277a9e17530c542cf2c835b41d475af8f9f0e7726d5c4914a75a13a23ef45648bef4566382ef5021cdf2cd7934986eaa81af0ee67b20e6be56b7a; strategyABtestKey=%221786242243.222%22; download_guide=%223%2F20260809%2F0%22; __ac_nonce=06a7826b100ef6564c667; __ac_signature=_02B4Z6wo00f01Y5pNAQAAIDAgM9XARFfCW2OSTCAAAnj1e; douyin.com; device_web_cpu_core=8; device_web_memory_size=16; is_support_rtm_web_ts=1; bd_ticket_guard_client_data=eyJiZC10aWNrZXQtZ3VhcmQtdmVyc2lvbiI6MiwiYmQtdGlja2V0LWd1YXJkLWl0ZXJhdGlvbi12ZXJzaW9uIjoxLCJiZC10aWNrZXQtZ3VhcmQtcmVlLXB1YmxpYy1rZXkiOiJCS1dKNkVuc2VNYzIvc0lXS0FZOVU4dHF0V1ZMQmxVS01haVIwNXlCbTdmdGswdkYvaHg2TXFJYU5tRm5mTzZ5SEJDR0FJMGo1QS9MbTNLdnVOa3pLZTA9IiwiYmQtdGlja2V0LWd1YXJkLXdlYi12ZXJzaW9uIjoyfQ%3D%3D; biz_trace_id=d93e952a; bd_ticket_guard_client_data_v2=eyJyZWVfcHVibGljX2tleSI6IkJLV0o2RW5zZU1jMi9zSVdLQVk5VTh0cXRXVkxCbFVLTWFpUjA1eUJtN2Z0azB2Ri9oeDZNcUlhTm1GbmZPNnlIQkNHQUkwajVBL0xtM0t2dU5rektlMD0iLCJyZXFfY29udGVudCI6InNlY190cyIsInJlcV9zaWduIjoiamxuRkdDaHdRdFRQQU9iOEJLT2cyanFFU1phZDBJWFMzcTBkdGl3cmpVYz0iLCJzZWNfdHMiOiIjaHlYdGpIRHdlNUVnUTFXa2NkK0VkdjgyQi9hcnUxT2FrNTlyNmFvVGFLS0pBMnEydGZVYk50Vk42NUpTIn0%3D; ttwid=1%7Ck4zDa_o0fTohc8BTICFjF03UF5OGnXtrIHpV5y2_hBs%7C1786259476%7C8934ea2b200289c9020d9fb14cf1777ebae10dd62f827151346df9637ca5dc33; sdk_source_info=7e276470716a68645a606960273f276364697660272927676c715a6d6069756077273f276364697660272927666d776a68605a607d71606b766c6a6b5a7666776c7571273f275e58272927666a6b766a69605a696c6061273f27636469766027292762696a6764695a7364776c6467696076273f275e582729277672715a646971273f2763646976602729277f6b5a666475273f2763646976602729276d6a6e5a6b6a716c273f2763646976602729276c6b6f5a7f6367273f27636469766027292771273f2735353c3332313c3037333d3234272927676c715a75776a716a666a69273f2763646976602778; bit_env=F7wotvutkoSLxTdgmTqGLrjX7Xhx1F43nB5UUyAiLhwxk9U_fYU3JOXWsLjPnstaTAT9gnGQ1hOXIo6o8eSmX3Ci3RWbCWTNw_o5Jkv0lluCVx6qH05Qsplzk9rZPNYo2BkOUPktbYsqx2QVGs46pB7zAZv68Ld8c8DO8DLxddOhNsR1KGJEQfJ4rFMldAD1KApXl74rMbs6rCpF1PMzzQl0XfPKOQr19lsIOzXuayA_jAFA2L3btpBe6D4N4bDWpeUVmdyohMJgD41nCbcxQ_QKfZcC-u0UfXV604MHQDcmImcih9EDZeO2t1HusEkCnPkIZC-csmiQ-GwGNDcu-bwmajCIP9ho19ZRAs4jfD-ILkYuHDVrE6knptxsPDF_LhnX2c7SKHxSCH04rYkNgMSfWNElrwLgIKb-a9QImKY0N4ZE-3pt3v2sOc06erJ0uZ6wk1tbV_eCA1b4DPz75Xq-VvRt2bxHdykv0C5CUZmJt4WxBJAyWxsgztjM4Scg_qAUyQUtt7k1geHpJotH4j1SRqFkZtm6DxdFkK_rEIk%3D; gulu_source_res=eyJwX2luIjoiYzk4ZmM3MWE3ZjZhODEzYTJmYzFhNDI5NWMwYzUxYmNiOTBmYjE0MmZiOTU3ZTM3YmM0ZmUzN2Q0MWI5Mzc1ZiJ9; passport_auth_mix_state=733u6dp7cpiycdng90ne0e8i0dcim5xh; home_can_add_dy_2_desktop=%220%22; IsDouyinActive=true; stream_recommend_feed_params=%22%7B%5C%22cookie_enabled%5C%22%3Atrue%2C%5C%22screen_width%5C%22%3A1680%2C%5C%22screen_height%5C%22%3A1050%2C%5C%22browser_online%5C%22%3Atrue%2C%5C%22cpu_core_num%5C%22%3A8%2C%5C%22device_memory%5C%22%3A16%2C%5C%22downlink%5C%22%3A10%2C%5C%22effective_type%5C%22%3A%5C%224g%5C%22%2C%5C%22round_trip_time%5C%22%3A100%7D%22',
}

params = {
    'device_platform': 'webapp',
    'aid': '6383',
    'channel': 'channel_pc_web',
    'module_id': '3003101',
    'count': '20',
    'filterGids': '',
    'presented_ids': '',
    'refresh_index': '1',
    'refer_id': '',
    'refer_type': '10',
    'pull_type': '0',
    'awemePcRecRawData': '{"is_xigua_user":0,"danmaku_switch_status":0,"is_client":false}',
    'Seo-Flag': '0',
    'install_time': '1786192979',
    'tag_id': '',
    'use_lite_type': '2',
    'pre_log_id': '',
    'pre_item_ids': '7653205380238953762,7665666540594875658,7665649287037734184,7657091406453313738,7660861408439012651,7652769693710748963,7645867451180034127,7655222862529269032,7671529702284201226,7646366687503343794',
    'pre_room_ids': '',
    'pre_item_from': 'sati',
    'xigua_user': '0',
    'pc_client_type': '1',
    'pc_libra_divert': 'Mac',
    'update_version_code': '170400',
    'support_h265': '1',
    'support_dash': '1',
    'version_code': '170400',
    'version_name': '17.4.0',
    'cookie_enabled': 'true',
    'screen_width': '1680',
    'screen_height': '1050',
    'browser_language': 'zh-CN',
    'browser_platform': 'MacIntel',
    'browser_name': 'Chrome',
    'browser_version': '150.0.0.0',
    'browser_online': 'true',
    'engine_name': 'Blink',
    'engine_version': '150.0.0.0',
    'os_name': 'Mac OS',
    'os_version': '10.15.7',
    'cpu_core_num': '8',
    'device_memory': '16',
    'platform': 'PC',
    'downlink': '10',
    'effective_type': '4g',
    'round_trip_time': '100',
    'webid': '7671640389132355135',
    'uifid': 'ad6934b0ab4e320902181a25912539b0861279799a57efa23bca0f8a191970a4f11e0bbc34c4d28337d8b1138794250db9fc2c1ade3ffdf742af88f67f145e1f7cbc476de0ae217c8e238c46522267c83f1030c605dd7b8fe6388dc5f2b2e9229d9a8cd5aed277a9e17530c542cf2c835b41d475af8f9f0e7726d5c4914a75a13a23ef45648bef4566382ef5021cdf2cd7934986eaa81af0ee67b20e6be56b7a',
    'verifyFp': 'verify_mskd6lam_42CdlcBy_h7s6_4vey_BWZd_gtCUWXOqcESf',
    'fp': 'verify_mskd6lam_42CdlcBy_h7s6_4vey_BWZd_gtCUWXOqcESf',
    'msToken': '3UZm9T_ji19sl9dJQrviHVU8y2Wxa7G7NQL3ionqcjJdgqLipyRqUyxsI7VzdjxWV8_LdWXxuSn_nOWUr1did5BsCOe8RM0Y7HjUzRx52hEG7NqT9rwplT1PyZ3yWKN6xNgKqcNvESGJN9644meFa_AeVydX-l9PPz-Yj-kL9Qi09Td_TMnjIw==',
    # 'a_bogus': 'YJUVD76jYp8bcVMb8KnIeSxl3wglrs8yqMiQSFHP7OzGaXeaeRPvKxTenOYHswCJpbBkho37rf/0bxfPYGUz8F9kLmkfS0sWhtAV96mohZqpTPJZXq6sSvSEFv-x0STY//IJNxwXItUKI253wrnYlVAG75FwmQmpRHqbdZSbG95GDWgPmZafO/LWYfwS-b2-UD==',
    'a_bogus': 'mX45kzyLdNAcFd/tuKc4t1eU2hLlrTuy4BTdbSVPtpaRPHePnbP4KNSMjxFy5g/dZbpshF3HVxFAYdVcmTXzZF9kLmkkSmt6wtIc9Wmo/H7vPTigXHWTSfbxLv-NUWTYOQI7NPE1ItlFIoQ3hNnYlVAa95zwmORpRqq6d/tbn9RTDS6PuZayOZLWYEwe55o4TD==',
}

data = {
    'encoded_pre_item_ids': 'MDUEDNwEVczcHaGvRwH8LwQT5vyK4M8PWYnDvUaKQDnRYDfWoQQQT2NOg5JTC3K2Tx2xwKfgVw==,MDUEDHDypS5ksIT3yHj9mQQTk5SR5QgExAuJq8rSdUH4UB7qqQQQlO0XfagxqNPpWUS+q6ODAQ==,MDUEDAG+ThuI4FIWH/NZVAQTokIgIgwjy2GhWu6nNdqjpasvAwQQ97OdGEtzBzZJER0S43AGxw==,MDUEDI8wgyqdpt5zGuqU7QQTGZ9fj9fFyXPl14WuQW93P3BBCAQQZ3Z2r6nmejLs7mFNxN9k4Q==,MDUEDKFwUcdowFK7h8UYPAQTwY5tHEMS7WvuANOoWPbYlYbW/AQQZUnhW+DvNThn+6mhcbiYTQ==,MDUEDLsjnb/ZfuPv1f8mAQQTjS8bVlGS3RVqXW+G9UQb12kGvwQQ9Srt94QJ8R+rZJFJ8JjK3g==,MDUEDARHzzcFyhtpN274IgQTxFOxQLd5A1UFz+tSwS1PtFaTXwQQMDY3VBGJItUSwNMtFPW3kw==,MDUEDAXVZ/Njp/E3wZTaAwQTxf9XyCd3z3BvcekhPFbGLD2Z2gQQfwXhrlCFSk1YNKiITpSauA==,MDUEDByd7vQMZ/p+SPgDogQTLc9/rHtj7cdCeyE5+pUsIbQ1xwQQ3gwdW2POeaQtKKNM1WUJFw==,MDUEDLU8vYrBqJQzwYPXVAQTzdw55hNWoKX9YrEMxxGEgyJDIwQQWDfEyl3BBU/udWpdzH6dYg==',
    'encoded_pre_room_ids': '',
}

response = requests.post('https://www.douyin.com/aweme/v2/web/module/feed/', params=params, headers=headers, data=data)
content = response.content.decode("utf-8")
json_data = json.loads(content)
print(" ########  ",json_data["aweme_list"][0]["music"]["title"])
print(" ########  end ############")
print(json_data["aweme_list"][0])
print(json_data["aweme_list"][0]["article_info"])