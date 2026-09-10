from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup
from bs4.element import Tag


# ---------------------------------------------------------
# Basic helpers
# ---------------------------------------------------------

STRESS_MARKS = str.maketrans({
    "ˈ": "",
    "ˌ": "",
})

def text(node: Tag | None) -> str | None:
    if node is None:
        return None

    value = " ".join(node.stripped_strings)
    value = re.sub(r"\s+", " ", value).strip()

    return value or None


def normalize_word(value: str | None) -> str | None:
    if not value:
        return None

    value = value.translate(STRESS_MARKS)
    value = value.replace("·", "")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def unique(items: list[Any]) -> list[Any]:
    result = []

    for item in items:
        if item not in result:
            result.append(item)

    return result


def classes(node: Tag) -> set[str]:
    return set(node.get("class", []))


# ---------------------------------------------------------
# Labels
# ---------------------------------------------------------

def parse_labels(node: Tag) -> dict[str, Any]:
    result: dict[str, Any] = {}

    if node.select_one(".o-symbol-ox3000"):
        result["oxford3000"] = True

    if node.select_one(".o-symbol-ox5000"):
        result["oxford5000"] = True

    if node.select_one(".o-symbol-cet4"):
        result["cet4"] = True

    if node.select_one(".o-symbol-cet6"):
        result["cet6"] = True

    if node.select_one(".o-symbol-netm"):
        result["netm"] = True

    for el in node.find_all(class_=True):
        for cls in el.get("class", []):
            match = re.fullmatch(
                r"o-symbol-cefr-(a1|a2|b1|b2|c1|c2)",
                cls,
                re.I,
            )

            if match:
                result["cefr"] = match.group(1).upper()
                return result

    return result


# ---------------------------------------------------------
# References
# ---------------------------------------------------------

def parse_references(node: Tag) -> list[dict[str, Any]]:
    refs = []

    for ref in node.select(".o-reference .o-ref"):
        cls = classes(ref)

        if "o-ref-syn" in cls:
            ref_type = "synonym"

        elif "o-ref-opp" in cls:
            ref_type = "antonym"

        elif "o-ref-idm" in cls:
            ref_type = "idiom"

        else:
            ref_type = "reference"

        for link in ref.select("a.o-ref-word"):
            target = text(
                link.select_one(".o-ref-word-xh")
            )

            if not target:
                target = text(link)

            pos = text(
                link.select_one(".o-ref-word-xpos")
            )

            refs.append({
                "type": ref_type,
                "target": normalize_word(target),
                "display_target": target,
                "pos": pos,
            })

    #
    # 一些 reference 不一定放在标准 .o-reference 里面，
    # 但仍然是 entry://xxx
    #
    for link in node.select('a[href^="entry://"]'):
        if link.find_parent(class_="o-reference"):
            continue

        href = link.get("href", "")

        target = href.removeprefix("entry://")
        target = target.split("#", 1)[0]

        visible = text(link)

        item = {
            "type": "reference",
            "target": normalize_word(target),
            "display_target": visible,
            "pos": None,
        }

        if item not in refs:
            refs.append(item)

    return refs


# ---------------------------------------------------------
# Notes / HELP blocks
# ---------------------------------------------------------

NOTE_CLASS_RE = re.compile(
    r"(?:help|usage|note)",
    re.I,
)


def parse_notes(node: Tag) -> list[dict[str, Any]]:
    notes = []

    for candidate in node.find_all(class_=NOTE_CLASS_RE):
        #
        # 避免 HELP icon / tooltip 自己被当 note
        #
        if candidate.name in {"img", "svg"}:
            continue

        value = text(candidate)

        if not value:
            continue

        if len(value) < 15:
            continue

        #
        # symbol tooltip 通常不是真正的 usage note
        #
        if candidate.find_parent(class_="o-symbol-wrap"):
            continue

        item = {
            "type": "note",
            "text": value,
        }

        if item not in notes:
            notes.append(item)

    return notes


# ---------------------------------------------------------
# Example
# ---------------------------------------------------------

def parse_example(node: Tag) -> dict[str, Any] | None:
    en_node = node.select_one(".o-example-eng")
    zh_node = node.select_one(".o-example-simp")

    en = text(en_node)
    zh = text(zh_node)

    if not en and not zh:
        return None

    labels = []

    #
    # Example-local labels:
    #
    # (figurative)
    # (informal)
    # etc.
    #
    if en_node:
        for label in en_node.select(".o-reg"):
            value = text(label)

            if value:
                labels.append(value)

    glosses = []

    if en_node:
        for gloss in en_node.select(".o-gl"):
            value = text(gloss)

            if value:
                glosses.append(value)

    result: dict[str, Any] = {
        "en": en,
        "zh": zh,
    }

    if labels:
        result["labels"] = unique(labels)

    if glosses:
        result["glosses"] = unique(glosses)

    return result


def parse_examples(node: Tag) -> list[dict[str, Any]]:
    result = []

    #
    # 尽量只拿属于当前 block 的 example-list
    #
    for li in node.select(".o-example-list > li"):
        example = parse_example(li)

        if example:
            result.append(example)

    return result


# ---------------------------------------------------------
# Grammar / patterns
# ---------------------------------------------------------

def parse_grammar(node: Tag) -> list[str]:
    values = []

    for el in node.select(
        ".o-sense-define .o-gram, "
        ".o-sense-define .o-gram-g"
    ):
        value = text(el)

        if value:
            value = value.strip("[] ")
            if value:
                values.append(value)

    return unique(values)


def parse_registers(node: Tag) -> list[str]:
    result = []

    #
    # literary / informal / formal / BrE ...
    #
    for el in node.select(".o-sense-define .o-reg"):
        value = text(el)

        if value:
            result.append(value)

    return unique(result)


def parse_patterns(node: Tag) -> list[str]:
    result = []

    define = node.select_one(".o-sense-define")

    if define:
        for el in define.select(".o-cf"):
            value = text(el)

            if value:
                result.append(value)

    #
    # 有些 construction 放在 example 前面：
    #
    # come to do sth
    # + adv./prep.
    #
    for el in node.select(
        ":scope > .o-example-list .o-example-cf .o-cf"
    ):
        value = text(el)

        if value:
            result.append(value)

    return unique(result)


# ---------------------------------------------------------
# Semantic groups
#
# TO A PLACE
# TRAVEL
# HAPPEN
# ...
# ---------------------------------------------------------

GROUP_RE = re.compile(
    r"^([A-Z][A-Z0-9 /&.,'()\-]{1,80})"
    r"(?:\s+([\u3400-\u9fff].*))?$"
)


def looks_like_group_heading(node: Tag) -> bool:
    value = text(node)

    if not value:
        return False

    if len(value) > 120:
        return False

    #
    # obvious class names
    #
    cls = " ".join(node.get("class", []))

    if re.search(
        r"(shortcut|shcut|topic|semantic|heading|section-head)",
        cls,
        re.I,
    ):
        return True

    #
    # fallback:
    # TO A PLACE 地方
    # HAPPEN 发生
    #
    return bool(GROUP_RE.match(value))


def parse_group_heading(
    sense: Tag,
) -> tuple[str | None, str | None]:
    # In OALD, a shortcut heading normally belongs to a wrapping
    # ``section.o-shortcut`` rather than being a sibling of every sense.
    # Looking at the wrapper first also makes all senses in that section
    # inherit the same semantic group.
    wrapper = sense.find_parent(
        lambda tag: (
            isinstance(tag, Tag)
            and "o-shortcut" in classes(tag)
        )
    )

    if wrapper is not None:
        heading = wrapper.select_one(":scope > .o-shortcut-title")
        value = text(heading)

        if value:
            match = GROUP_RE.match(value)

            if match:
                return (
                    match.group(1).strip(),
                    match.group(2).strip() if match.group(2) else None,
                )

            return value, None

    checked = 0

    for sibling in sense.previous_siblings:
        if not isinstance(sibling, Tag):
            continue

        checked += 1

        if checked > 8:
            break

        if "o-sense" in classes(sibling):
            break

        if looks_like_group_heading(sibling):
            value = text(sibling)

            if not value:
                continue

            match = GROUP_RE.match(value)

            if match:
                return (
                    match.group(1).strip(),
                    match.group(2).strip()
                    if match.group(2)
                    else None,
                )

            return value, None

    return None, None


# ---------------------------------------------------------
# Sense
# ---------------------------------------------------------

def parse_sense(
    node: Tag,
    *,
    pos: str | None,
    key: str,
    group_en: str | None = None,
    group_zh: str | None = None,
) -> dict[str, Any]:
    number = text(node.select_one(".o-sn-g"))

    if number:
        number = number.rstrip(".").strip()

    en = text(
        node.select_one(
            ".o-sense-define .o-def-eng"
        )
    )

    zh = text(
        node.select_one(
            ".o-sense-define .o-def-simp"
        )
    )

    result: dict[str, Any] = {
        "key": key,
        "number": number,
        "pos": pos,
        "definition_en": en,
        "definition_zh": zh,
        "examples": parse_examples(node),
    }

    if group_en or group_zh:
        result["group"] = {
            "en": group_en,
            "zh": group_zh,
        }

    grammar = parse_grammar(node)

    if grammar:
        result["grammar"] = grammar

    registers = parse_registers(node)

    if registers:
        result["registers"] = registers

    patterns = parse_patterns(node)

    if patterns:
        result["patterns"] = patterns

    labels = parse_labels(node)

    if labels:
        result["labels"] = labels

    refs = parse_references(node)

    if refs:
        result["refs"] = refs

    notes = parse_notes(node)

    if notes:
        result["notes"] = notes

    return result


# ---------------------------------------------------------
# Pronunciation
# ---------------------------------------------------------

def parse_pronunciation(root: Tag) -> dict[str, str | None]:
    result = {
        "br": None,
        "us": None,
    }

    #
    # 多词性的时候 pronunciation-set 会重复。
    # 先取 active 即可。
    #
    pronunciation_set = root.select_one(
        ".o-pronunciation-set.o-active"
    )

    if pronunciation_set is None:
        pronunciation_set = root.select_one(
            ".o-pronunciation-set"
        )

    if pronunciation_set is None:
        return result

    for chunk in pronunciation_set.select(
        ".o-pron-chunk"
    ):
        region = text(
            chunk.select_one(".o-pron-geo")
        )

        phonetic = text(
            chunk.select_one(".o-pron-phon")
        )

        if not phonetic:
            continue

        if region == "BrE":
            result["br"] = phonetic

        elif region == "NAmE":
            result["us"] = phonetic

    return result


# ---------------------------------------------------------
# Inflections
# ---------------------------------------------------------

INFLECTION_CLASS_RE = re.compile(
    r"(?:infl|inflect|verb-form|forms?)",
    re.I,
)


def parse_inflections(pos_section: Tag) -> list[str]:
    result = []

    # Inflected forms live in the compact text above the senses.  ``o-pos-extra``
    # is not a forms field: it can contain an entire synonym/usage panel.
    for node in pos_section.select(".o-top-text .o-if"):
        value = text(node)

        if value:
            result.append(value)

    #
    # fallback selectors
    #
    selectors = [
        ".o-inflections",
        ".o-inflection",
        ".o-verb-forms",
        ".o-verb-form",
        ".o-forms",
    ]

    for selector in selectors:
        for node in pos_section.select(selector):
            value = text(node)

            if value and value not in result:
                result.append(value)

    return unique(result)


# ---------------------------------------------------------
# Phrase parsing
# ---------------------------------------------------------

PHRASE_CONTAINER_RE = re.compile(
    r"(?:"
    r"o-idm(?:-|$)|"
    r"o-idiom(?:-|$)|"
    r"o-phrv(?:-|$)|"
    r"o-phrasal(?:-|$)|"
    r"o-pv(?:-|$)|"
    r"o-phrase(?:-|$)"
    r")",
    re.I,
)


PHRASE_HEAD_RE = re.compile(
    r"(?:"
    r"idm.*(?:head|title|xh)|"
    r"idiom.*(?:head|title)|"
    r"phrv.*(?:head|title|xh)|"
    r"phrasal.*(?:head|title)|"
    r"phrase.*(?:head|title|xh)|"
    r"pv.*(?:head|title|xh)"
    r")",
    re.I,
)


def classify_phrase(node: Tag) -> str:
    cls = " ".join(node.get("class", []))

    if re.search(r"(?:idm|idiom)", cls, re.I):
        return "idiom"

    if re.search(
        r"(?:phrv|phrasal|\bo-pv)",
        cls,
        re.I,
    ):
        return "phrasal_verb"

    #
    # fallback: 找前面的 section heading
    #
    for prev in node.find_all_previous(limit=30):
        value = text(prev)

        if not value:
            continue

        value_upper = value.upper()

        if value_upper == "IDIOMS":
            return "idiom"

        if value_upper == "PHRASAL VERBS":
            return "phrasal_verb"

    return "phrase"


def extract_phrase_title(
    container: Tag,
) -> str | None:
    #
    # 先找明显的 phrase-heading class
    #
    for candidate in container.find_all(
        class_=PHRASE_HEAD_RE
    ):
        value = text(candidate)

        if (
            value
            and len(value) <= 150
            and not candidate.select_one(".o-def-eng")
        ):
            return value

    #
    # 常见候选 class
    #
    selectors = [
        ".o-idm",
        ".o-idm-head",
        ".o-idm-title",
        ".o-idiom-head",
        ".o-idiom-title",
        ".o-phrv-head",
        ".o-phrv-title",
        ".o-phrasal-head",
        ".o-phrasal-title",
        ".o-phrase-head",
        ".o-phrase-title",
        ".o-pv-head",
        ".o-pv-title",
    ]

    for selector in selectors:
        candidate = container.select_one(selector)

        if not candidate:
            continue

        if candidate is container:
            continue

        value = text(candidate)

        if value and len(value) <= 150:
            return value

    #
    # fallback：
    # 找 container 里的第一个短 heading-ish node
    #
    for child in container.find_all(
        ["h2", "h3", "h4", "dt"],
        recursive=True,
    ):
        value = text(child)

        if value and len(value) <= 150:
            return value

    return None


def discover_phrase_containers(
    root: Tag,
) -> list[Tag]:
    candidates = []

    for node in root.find_all(
        ["section", "div", "li"],
        class_=True,
    ):
        cls = " ".join(node.get("class", []))

        if not PHRASE_CONTAINER_RE.search(cls):
            continue

        #
        # o-ref-idm 这种不是 phrase block
        #
        if "o-ref" in classes(node):
            continue

        #
        # 真正的 phrase 至少应该有 definition 或 sense
        #
        if not (
            node.select_one(".o-def-eng")
            or node.select_one(".o-def-simp")
            or node.select_one(".o-sense")
        ):
            continue

        candidates.append(node)

    #
    # 去掉包住整个 IDIOMS / PHRASAL VERBS 的大容器。
    # 我们更想要最小 phrase container。
    #
    result = []

    for candidate in candidates:
        nested = False

        for other in candidates:
            if candidate is other:
                continue

            if other in candidate.descendants:
                nested = True
                break

        if not nested:
            result.append(candidate)

    return result


def synthetic_phrase_sense(
    container: Tag,
    *,
    phrase_key: str,
    pos: str | None,
) -> dict[str, Any] | None:
    en = text(container.select_one(".o-def-eng"))
    zh = text(container.select_one(".o-def-simp"))

    if not en and not zh:
        return None

    fake = {
        "key": f"{phrase_key}s0",
        "number": None,
        "pos": pos,
        "definition_en": en,
        "definition_zh": zh,
        "examples": parse_examples(container),
    }

    labels = parse_labels(container)

    if labels:
        fake["labels"] = labels

    refs = parse_references(container)

    if refs:
        fake["refs"] = refs

    notes = parse_notes(container)

    if notes:
        fake["notes"] = notes

    registers = []

    for el in container.select(".o-reg"):
        value = text(el)

        if value:
            registers.append(value)

    if registers:
        fake["registers"] = unique(registers)

    return fake


def _parse_phrases_legacy(
    root: Tag,
) -> tuple[list[dict[str, Any]], list[str]]:
    result = []
    warnings = []

    containers = discover_phrase_containers(root)

    for phrase_index, container in enumerate(
        containers
    ):
        phrase_key = f"p{phrase_index}"

        display_phrase = extract_phrase_title(
            container
        )

        if not display_phrase:
            warnings.append(
                "Found possible phrase container "
                f"but could not determine title: "
                f"{container.get('class')}"
            )
            continue

        phrase_type = classify_phrase(container)

        normalized_phrase = normalize_word(
            display_phrase
        )

        phrase = {
            "key": phrase_key,
            "type": phrase_type,
            "phrase": normalized_phrase,
            "display_phrase": display_phrase,
            "labels": parse_labels(container),
            "senses": [],
        }

        #
        # phrase 自己下面有多个 o-sense
        #
        sense_nodes = container.select(
            ":scope .o-sense"
        )

        #
        # 避免拿到另一个 nested phrase 的 senses
        #
        filtered_senses = []

        for sense in sense_nodes:
            nearest_phrase = None

            parent = sense.parent

            while isinstance(parent, Tag):
                cls = " ".join(
                    parent.get("class", [])
                )

                if PHRASE_CONTAINER_RE.search(cls):
                    nearest_phrase = parent
                    break

                if parent is container:
                    break

                parent = parent.parent

            if (
                nearest_phrase is None
                or nearest_phrase is container
            ):
                filtered_senses.append(sense)

        for sense_index, sense_node in enumerate(
            filtered_senses
        ):
            sense = parse_sense(
                sense_node,
                pos=None,
                key=f"{phrase_key}s{sense_index}",
            )

            phrase["senses"].append(sense)

        #
        # 有的 idiom/phrasal verb 只有一个 definition，
        # 没包 .o-sense。
        #
        if not phrase["senses"]:
            sense = synthetic_phrase_sense(
                container,
                phrase_key=phrase_key,
                pos=None,
            )

            if sense:
                phrase["senses"].append(sense)

        result.append(phrase)

    #
    # 如果 HTML 明明写了 IDIOMS / PHRASAL VERBS，
    # 但一个 phrase 都没抓到，明确报警。
    #
    whole_text = root.get_text(" ", strip=True)

    if (
        (
            "IDIOMS" in whole_text
            or "PHRASAL VERBS" in whole_text
        )
        and not result
    ):
        warnings.append(
            "Entry contains IDIOMS/PHRASAL VERBS "
            "but phrase containers were not recognized. "
            "Run debug_structure(html)."
        )

    return result, warnings


# ---------------------------------------------------------
# Phrase / extend block handling
# ---------------------------------------------------------

PHRASE_BLOCK_RE = re.compile(
    r"(?:idiom(?:s)?-block|idm(?:s)?-block|"
    r"phrasal-block|phrasal-verb-block|phrv-block)",
    re.I,
)

PHRASE_HEAD_CLASS_RE = re.compile(
    r"(?:(?:^|-)idm(?:-|$)|idiom|phrasal|phrv|phrase)",
    re.I,
)


def class_string(node: Tag) -> str:
    return " ".join(node.get("class", []))


def is_phrase_block(node: Tag) -> bool:
    return bool(PHRASE_BLOCK_RE.search(class_string(node)))


def phrase_block_type(node: Tag) -> str:
    cls = class_string(node).lower()

    if "idiom" in cls or "idm" in cls:
        return "idiom"

    if "phrasal" in cls or "phrv" in cls:
        return "phrasal_verb"

    return "phrase"


def nearest_phrase_block(
    node: Tag,
    stop: Tag | None = None,
) -> Tag | None:
    parent = node.parent

    while isinstance(parent, Tag):
        if is_phrase_block(parent):
            return parent

        if parent is stop:
            break

        parent = parent.parent

    return None


def ordinary_sense_nodes(pos_section: Tag) -> list[Tag]:
    result = []

    for sense in pos_section.select(".o-sense"):
        if nearest_phrase_block(sense, stop=pos_section):
            continue

        result.append(sense)

    return result


def phrase_head_text(node: Tag) -> str | None:
    pieces = []

    for string in node.find_all(string=True):
        parent = string.parent
        skip = False

        while isinstance(parent, Tag) and parent is not node:
            parent_classes = classes(parent)

            if (
                "o-symbol-wrap" in parent_classes
                or "o-symbol-tip" in parent_classes
                or parent.name in {"svg", "img"}
            ):
                skip = True
                break

            parent = parent.parent

        if not skip:
            value = str(string).strip()

            if value:
                pieces.append(value)

    value = re.sub(r"\s+", " ", " ".join(pieces)).strip()
    return value or None


def looks_like_phrase_head(node: Tag) -> bool:
    cls = class_string(node)

    if not PHRASE_HEAD_CLASS_RE.search(cls):
        return False

    lower_cls = cls.lower()
    forbidden = (
        "block", "reference", "o-ref", "symbol", "example",
        "sense", "define", "tip", "links",
    )

    if any(item in lower_cls for item in forbidden):
        return False

    if node.select_one(
        ".o-def-eng, .o-def-simp, .o-example-list"
    ):
        return False

    value = phrase_head_text(node)

    if not value or len(value) > 180:
        return False

    return value.upper().strip() not in {
        "IDIOMS", "PHRASAL VERBS", "PHRASAL VERB",
    }


def find_phrase_heads(block: Tag) -> list[Tag]:
    candidates = [
        node
        for node in block.find_all(
            ["div", "span", "section", "h2", "h3", "h4"],
            class_=True,
        )
        if looks_like_phrase_head(node)
    ]

    result = []

    for node in candidates:
        if not any(
            node is not other and node in other.parents
            for other in candidates
        ):
            result.append(node)

    seen = set()
    final = []

    for node in result:
        value = phrase_head_text(node)

        if not value:
            continue

        marker = (normalize_word(value), id(node))

        if marker not in seen:
            seen.add(marker)
            final.append(node)

    return final


def find_phrase_blocks(root: Tag) -> list[Tag]:
    candidates = [
        node
        for node in root.find_all(["div", "section"], class_=True)
        if is_phrase_block(node)
    ]
    result = []

    for node in candidates:
        parent = node.parent
        parent_block = None

        while isinstance(parent, Tag):
            if is_phrase_block(parent):
                parent_block = parent
                break

            if parent is root:
                break

            parent = parent.parent

        if parent_block is None:
            result.append(node)

    return result


def build_dom_order(block: Tag) -> dict[int, int]:
    order = {}
    index = 0

    for node in block.descendants:
        if isinstance(node, Tag):
            order[id(node)] = index
            index += 1

    return order


def node_in_range(
    node: Tag,
    order: dict[int, int],
    start: int,
    end: int,
) -> bool:
    position = order.get(id(node))
    return position is not None and start < position < end


def parse_flat_phrase_sense(
    block: Tag,
    *,
    order: dict[int, int],
    start: int,
    end: int,
    key: str,
) -> dict[str, Any] | None:
    def_nodes = [
        define
        for define in block.select(".o-sense-define")
        if node_in_range(define, order, start, end)
        and not define.find_parent(class_="o-sense")
    ]

    en_node = None
    zh_node = None

    if def_nodes:
        en_node = def_nodes[0].select_one(".o-def-eng")
        zh_node = def_nodes[0].select_one(".o-def-simp")
    else:
        for candidate in block.select(".o-def-eng"):
            if (
                node_in_range(candidate, order, start, end)
                and not candidate.find_parent(class_="o-sense")
            ):
                en_node = candidate
                break

        for candidate in block.select(".o-def-simp"):
            if (
                node_in_range(candidate, order, start, end)
                and not candidate.find_parent(class_="o-sense")
            ):
                zh_node = candidate
                break

    en = text(en_node)
    zh = text(zh_node)

    if not en and not zh:
        return None

    examples = []

    for li in block.select(".o-example-list > li"):
        if (
            node_in_range(li, order, start, end)
            and not li.find_parent(class_="o-sense")
        ):
            parsed = parse_example(li)

            if parsed:
                examples.append(parsed)

    result = {
        "key": key,
        "number": None,
        "pos": None,
        "definition_en": en,
        "definition_zh": zh,
        "examples": examples,
    }

    registers = []

    for node in block.select(".o-reg"):
        if node_in_range(node, order, start, end):
            value = text(node)

            if value:
                registers.append(value)

    if registers:
        result["registers"] = unique(registers)

    return result


def _parse_phrases_flat_legacy(
    root: Tag,
) -> tuple[list[dict[str, Any]], list[str]]:
    phrases = []
    warnings = []
    phrase_map: dict[tuple[str, str], dict[str, Any]] = {}
    phrase_counter = 0

    for block in find_phrase_blocks(root):
        phrase_type = phrase_block_type(block)
        heads = find_phrase_heads(block)

        if not heads:
            warnings.append(
                "Phrase block found but no phrase headings detected: "
                f"{block.get('class')}"
            )
            continue

        order = build_dom_order(block)
        block_end = max(order.values()) + 1 if order else 0

        for index, head in enumerate(heads):
            display_phrase = phrase_head_text(head)

            if not display_phrase:
                continue

            normalized_phrase = normalize_word(display_phrase)

            if not normalized_phrase:
                continue

            start = order.get(id(head))

            if start is None:
                continue

            end = (
                order.get(id(heads[index + 1]), block_end)
                if index + 1 < len(heads)
                else block_end
            )
            map_key = (phrase_type, normalized_phrase)

            if map_key not in phrase_map:
                phrase = {
                    "key": f"p{phrase_counter}",
                    "type": phrase_type,
                    "phrase": normalized_phrase,
                    "display_phrase": display_phrase,
                    "labels": parse_labels(head),
                    "senses": [],
                }
                phrase_counter += 1
                phrase_map[map_key] = phrase
                phrases.append(phrase)
            else:
                phrase = phrase_map[map_key]

            sense_nodes = [
                sense
                for sense in block.select(".o-sense")
                if node_in_range(sense, order, start, end)
                and nearest_phrase_block(sense) is block
            ]

            if sense_nodes:
                for sense_node in sense_nodes:
                    sense_key = f"{phrase['key']}s{len(phrase['senses'])}"
                    parsed = parse_sense(sense_node, pos=None, key=sense_key)
                    signature = (
                        parsed.get("number"),
                        parsed.get("definition_en"),
                        parsed.get("definition_zh"),
                    )

                    if not any(
                        (
                            existing.get("number"),
                            existing.get("definition_en"),
                            existing.get("definition_zh"),
                        ) == signature
                        for existing in phrase["senses"]
                    ):
                        phrase["senses"].append(parsed)
            else:
                sense_key = f"{phrase['key']}s{len(phrase['senses'])}"
                parsed = parse_flat_phrase_sense(
                    block,
                    order=order,
                    start=start,
                    end=end,
                    key=sense_key,
                )

                if parsed:
                    signature = (
                        parsed.get("definition_en"),
                        parsed.get("definition_zh"),
                    )

                    if not any(
                        (
                            existing.get("definition_en"),
                            existing.get("definition_zh"),
                        ) == signature
                        for existing in phrase["senses"]
                    ):
                        phrase["senses"].append(parsed)

    return phrases, warnings


def parse_phrases(
    root: Tag,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse the concrete idiom/phrasal sections used by OALD 10.

    The extend blocks are only grouping containers.  Each child
    ``section.o-idiom`` or ``section.o-phrasal`` is the actual phrase entry.
    Treating the outer block as a flat range made title detection dependent on
    guessed class names and, in practice, returned no phrases at all.
    """
    phrases: list[dict[str, Any]] = []
    phrase_map: dict[tuple[str, str], dict[str, Any]] = {}

    for container in root.select("section.o-idiom, section.o-phrasal"):
        phrase_type = (
            "idiom" if "o-idiom" in classes(container)
            else "phrasal_verb"
        )
        heading = container.select_one(":scope > .o-shortcut-title")
        display_phrase = phrase_head_text(heading) if heading else None

        if not display_phrase:
            continue

        normalized_phrase = normalize_word(display_phrase)

        if not normalized_phrase:
            continue

        map_key = (phrase_type, normalized_phrase)
        phrase = phrase_map.get(map_key)

        if phrase is None:
            phrase = {
                "key": f"p{len(phrases)}",
                "type": phrase_type,
                "phrase": normalized_phrase,
                "display_phrase": display_phrase,
                "labels": parse_labels(container),
                "senses": [],
            }
            phrase_map[map_key] = phrase
            phrases.append(phrase)

        # Only accept senses owned by this concrete phrase section.  This
        # avoids accidental duplication if a future dictionary nests blocks.
        for sense_node in container.select(":scope > section.o-sense"):
            sense_key = f"{phrase['key']}s{len(phrase['senses'])}"
            parsed = parse_sense(sense_node, pos=None, key=sense_key)
            signature = (
                parsed.get("number"),
                parsed.get("definition_en"),
                parsed.get("definition_zh"),
                parsed.get("examples"),
            )

            if not any(
                (
                    existing.get("number"),
                    existing.get("definition_en"),
                    existing.get("definition_zh"),
                    existing.get("examples"),
                ) == signature
                for existing in phrase["senses"]
            ):
                phrase["senses"].append(parsed)

        if not phrase["senses"]:
            parsed = synthetic_phrase_sense(
                container,
                phrase_key=phrase["key"],
                pos=None,
            )

            if parsed:
                phrase["senses"].append(parsed)

    warnings = []

    for block in find_phrase_blocks(root):
        if not block.select("section.o-idiom, section.o-phrasal"):
            warnings.append(
                "Phrase block found but no phrase entries detected: "
                f"{block.get('class')}"
            )

    return phrases, warnings


# ---------------------------------------------------------
# POS
# ---------------------------------------------------------

def parse_pos_name(
    section: Tag,
) -> str | None:
    node = section.select_one(
        ".o-pos-detail > .o-pos-tag > span"
    )

    value = text(node)

    if value:
        return value.lower()

    #
    # fallback
    #
    value = text(
        section.select_one(".o-pos-tag")
    )

    return value.lower() if value else None


# ---------------------------------------------------------
# Main parser
# ---------------------------------------------------------

def parse_entry(
    html: str,
    source_key: str | None = None,
) -> dict[str, Any]:
    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    root = soup.select_one("main.oald-entry")

    if root is None:
        raise ValueError(
            "Cannot find main.oald-entry"
        )

    display_word = text(
        root.select_one(
            ".o-headword .o-head-main .o-h"
        )
    )

    if not display_word:
        display_word = text(
            root.select_one(".o-headword .o-h")
        )

    if not display_word:
        display_word = source_key

    word = (
        source_key
        or normalize_word(display_word)
    )

    result: dict[str, Any] = {
        "word": word,
        "display_word": display_word,
        "pronunciation": parse_pronunciation(root),
        "labels": parse_labels(
            root.select_one(".o-entry-header")
            or root
        ),
        "forms": [],
        "sense_groups": [],
        "senses": [],
        "phrases": [],
        "warnings": [],
    }

    #
    # -----------------------------
    # Ordinary POS + senses
    # -----------------------------
    #
    sense_counter = 0

    for pos_index, pos_section in enumerate(
        root.select(
            ".o-pos-panels > section.o-pos"
        )
    ):
        pos_name = parse_pos_name(
            pos_section
        )

        result["forms"].extend(
            parse_inflections(pos_section)
        )

        current_group = None
        current_group_obj = None

        sense_nodes = ordinary_sense_nodes(
            pos_section
        )

        for sense_node in sense_nodes:
            group_en, group_zh = (
                parse_group_heading(
                    sense_node
                )
            )

            group_identity = (
                pos_name,
                group_en,
                group_zh,
            )

            if group_identity != current_group:
                current_group = group_identity

                current_group_obj = {
                    "pos": pos_name,
                    "title_en": group_en,
                    "title_zh": group_zh,
                    "sense_keys": [],
                }

                result[
                    "sense_groups"
                ].append(
                    current_group_obj
                )

            key = f"s{sense_counter}"

            sense = parse_sense(
                sense_node,
                pos=pos_name,
                key=key,
                group_en=group_en,
                group_zh=group_zh,
            )

            result["senses"].append(
                sense
            )

            current_group_obj[
                "sense_keys"
            ].append(key)

            sense_counter += 1

    result["forms"] = unique(
        result["forms"]
    )

    #
    # -----------------------------
    # Idioms / phrasal verbs
    # -----------------------------
    #
    phrases, phrase_warnings = (
        parse_phrases(root)
    )

    result["phrases"] = phrases
    result["warnings"].extend(
        phrase_warnings
    )

    return result


# ---------------------------------------------------------
# Debugging helper
# ---------------------------------------------------------

def debug_structure(html: str):
    """
    如果某个复杂词 phrase 没识别出来，
    用这个把可疑 DOM class 打出来。

    不参与最终数据库。
    """

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    root = soup.select_one(
        "main.oald-entry"
    )

    if root is None:
        print("NO main.oald-entry")
        return

    print("\n=== POSSIBLE PHRASE STRUCTURE ===")

    for node in root.find_all(
        ["section", "div", "span"],
        class_=True,
    ):
        cls = " ".join(
            node.get("class", [])
        )

        value = text(node)

        interesting = bool(
            re.search(
                r"(idm|idiom|phras|phrv|"
                r"phrase|pv|shortcut|"
                r"shcut|topic)",
                cls,
                re.I,
            )
        )

        if not interesting:
            continue

        if not value:
            continue

        if len(value) > 200:
            value = value[:200] + "..."

        print(
            f"{node.name:<8} "
            f"class={cls!r} "
            f"text={value!r}"
        )
