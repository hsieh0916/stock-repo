"""
Build code -> 產業別 (industry) mapping for held securities, from the official
TWSE (上市) and TPEx (上櫃) OpenAPI basic-data datasets. Both encode industry as
the same numeric scheme; we map to Chinese names.

Output: data/public/sectors.json and web/public/sectors.json  ({code: industryName})
"""

import os
import json
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATASET = os.path.join(ROOT, "data", "public", "dataset.json")
OUT = os.path.join(ROOT, "data", "public", "sectors.json")
WEB_OUT = os.path.join(ROOT, "web", "public", "sectors.json")

TWSE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
TPEX_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"
UA = "Mozilla/5.0 (compatible; etf-00991a-tracker/0.1)"

# TWSE/TPEx 產業別代碼 -> 名稱
INDUSTRY = {
    "01": "水泥工業", "02": "食品工業", "03": "塑膠工業", "04": "紡織纖維",
    "05": "電機機械", "06": "電器電纜", "08": "玻璃陶瓷", "09": "造紙工業",
    "10": "鋼鐵工業", "11": "橡膠工業", "12": "汽車工業", "14": "建材營造",
    "15": "航運業", "16": "觀光餐旅", "17": "金融保險業", "18": "貿易百貨",
    "19": "綜合", "20": "其他業", "21": "化學工業", "22": "生技醫療業",
    "23": "油電燃氣業", "24": "半導體業", "25": "電腦及週邊設備業",
    "26": "光電業", "27": "通信網路業", "28": "電子零組件業",
    "29": "電子通路業", "30": "資訊服務業", "31": "其他電子業",
    "32": "文化創意業", "33": "農業科技", "34": "電子商務",
    "35": "綠能環保", "36": "數位雲端", "37": "運動休閒", "38": "居家生活",
}


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "ignore"))


def build():
    ds = json.load(open(DATASET, encoding="utf-8"))
    held = set(ds["securities"])

    code_to_ind = {}
    try:
        for r in _get(TWSE_URL):
            code_to_ind[r.get("公司代號")] = r.get("產業別")
    except Exception as e:
        print("sectors: TWSE fetch failed:", e)
    try:
        for r in _get(TPEX_URL):
            code_to_ind[r.get("SecuritiesCompanyCode")] = r.get("SecuritiesIndustryCode")
    except Exception as e:
        print("sectors: TPEx fetch failed:", e)

    sectors = {}
    unmapped = []
    for code in held:
        ind = code_to_ind.get(code)
        name = INDUSTRY.get(ind)
        if name:
            sectors[code] = name
        else:
            sectors[code] = "未分類"
            unmapped.append(code)

    payload = json.dumps(sectors, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(payload)
    if os.path.isdir(os.path.dirname(WEB_OUT)):
        with open(WEB_OUT, "w", encoding="utf-8") as f:
            f.write(payload)
    print(f"sectors: {len(sectors)} codes, {len(set(sectors.values()))} industries, {len(unmapped)} unmapped {unmapped}")
    return sectors


if __name__ == "__main__":
    build()
