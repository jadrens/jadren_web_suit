from mdict_utils import reader
from parser import parse_entry, debug_structure

import json


path = "dicts/oxford-10-en2cn.mdx"


def query_word(word: str):
    result = reader.query(
        path,
        word,
    )

    if result is None:
        return None

    if isinstance(result, bytes):
        result = result.decode(
            "utf-8",
            errors="replace",
        )

    return result


for word in [
    "apple",
    "fish",
]:
    html = query_word(word)

    if not html:
        print("NOT FOUND:", word)
        continue

    #
    # redirect 暂时先跳过
    #
    if html.strip().startswith("@@@LINK="):
        print(
            word,
            "=>",
            html.strip(),
        )
        continue

    data = parse_entry(
        html,
        source_key=word,
    )

    print(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        )
    )

    print(
        "\nSENSES:",
        len(data["senses"])
    )

    print(
        "PHRASES:",
        len(data["phrases"])
    )

    print(
        "WARNINGS:",
        data["warnings"]
    )
