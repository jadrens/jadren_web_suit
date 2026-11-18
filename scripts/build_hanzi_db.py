#!/usr/bin/env python3
"""Build the character data used by the /tools/hanzi lookup tool.

Sources (all cached under .data/hanzi-sources):

* Unihan.zip          https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
  kRSUnicode, kTotalStrokes, kMandarin, kDefinition, kIRG_*Source
* CJKRadicals.txt     https://www.unicode.org/Public/UCD/latest/ucd/CJKRadicals.txt
  Kangxi radical number -> radical character -> unified ideograph
* USourceData.txt     https://www.unicode.org/Public/UCD/latest/ucd/USourceData.txt
  U-source (unencoded) ideographs and their review status (UAX #45)
* ids.txt             https://github.com/cjkvi/cjkvi-ids (derived from CHISE)
  Ideographic Description Sequences

Output (committed under public/hanzi):

* core.json.gz     characters, radical-stroke index, pinyin, IRG sources,
                   Kangxi radicals, U-source table
* details.json.gz  IDS, definitions, variant relations (loaded on demand)

Run: bun run hanzi:build  (or python3 scripts/build_hanzi_db.py)
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / ".data" / "hanzi-sources"
OUTPUT_DIR = ROOT / "public" / "hanzi"

UNICODE_BASE = "https://www.unicode.org/Public/UCD/latest/ucd"
SOURCES = {
    "Unihan.zip": f"{UNICODE_BASE}/Unihan.zip",
    "CJKRadicals.txt": f"{UNICODE_BASE}/CJKRadicals.txt",
    "USourceData.txt": f"{UNICODE_BASE}/USourceData.txt",
    "ids.txt": "https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt",
}
UNIHAN_FILES = (
    "Unihan_IRGSources.txt",
    "Unihan_Readings.txt",
    "Unihan_Variants.txt",
)

IRG_FIELDS = (
    ("kIRG_GSource", 1),
    ("kIRG_TSource", 2),
    ("kIRG_JSource", 4),
    ("kIRG_KSource", 8),
    ("kIRG_KPSource", 16),
    ("kIRG_HSource", 32),
    ("kIRG_MSource", 64),
    ("kIRG_VSource", 128),
    ("kIRG_UKSource", 256),
    ("kIRG_SSource", 512),
    ("kIRG_USource", 1024),
)
VARIANT_FIELDS = {
    "s": "kSimplifiedVariant",
    "t": "kTraditionalVariant",
    "v": "kSemanticVariant",
    "z": "kZVariant",
    "c": "kCompatibilityVariant",
}
CODEPOINT_RE = re.compile(r"U\+([0-9A-F]{4,6})")
RS_RE = re.compile(r"^(\d+)'*\.(\d+)$")
BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"
SRC_ALPHABET = BASE36 + "ABCDEFGHIJKLMNOPQRSTUVWXYZ-_"


def log(message: str) -> None:
    print(message, file=sys.stderr)


def download(name: str, url: str) -> Path:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    path = SOURCE_DIR / name
    if path.exists() and path.stat().st_size > 0:
        return path
    log(f"downloading {name} ...")
    request = urllib.request.Request(url, headers={"User-Agent": "jadren-blog-hanzi-build/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, path.open("wb") as handle:
        while chunk := response.read(1 << 16):
            handle.write(chunk)
    return path


def ensure_unihan() -> None:
    archive = download("Unihan.zip", SOURCES["Unihan.zip"])
    if all((SOURCE_DIR / name).exists() for name in UNIHAN_FILES):
        return
    log("extracting Unihan.zip ...")
    with zipfile.ZipFile(archive) as bundle:
        for name in UNIHAN_FILES:
            bundle.extract(name, SOURCE_DIR)


def read_unihan() -> dict[str, dict[str, str]]:
    fields: dict[str, dict[str, str]] = {}
    for name in UNIHAN_FILES:
        with (SOURCE_DIR / name).open(encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 3:
                    continue
                codepoint, field, value = parts[0], parts[1], parts[2]
                fields.setdefault(field, {})[codepoint] = value
    return fields


def read_radicals() -> list[list[object]]:
    radicals: list[list[object]] = []
    with (SOURCE_DIR / "CJKRadicals.txt").open(encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#") or not line.strip():
                continue
            number, radical, ideograph = (part.strip() for part in line.split(";"))
            radicals.append(
                [
                    number,
                    chr(int(radical, 16)) if radical else "",
                    chr(int(ideograph, 16)) if ideograph else "",
                ]
            )
    radicals.sort(key=lambda item: (int(item[0].rstrip("'")), item[0].count("'")))
    return radicals


def read_usource() -> list[list[str]]:
    rows: list[list[str]] = []
    with (SOURCE_DIR / "USourceData.txt").open(encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#") or not line.strip():
                continue
            fields = line.rstrip("\n").split(";")
            if len(fields) < 10:
                # Keep the row shape stable even if Unicode adds/trims a field later.
                fields += [""] * (10 - len(fields))
            rows.append(fields[:10])
    return rows


def read_ids() -> dict[str, str]:
    values: dict[str, str] = {}
    with (SOURCE_DIR / "ids.txt").open(encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#") or not line.strip():
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 3 or not fields[0].startswith("U+"):
                continue
            variants = [value.strip() for value in fields[2:] if value.strip()]
            if variants:
                values[fields[0]] = "\t".join(variants)
    return values


def variant_characters(value: str) -> list[str]:
    seen: list[str] = []
    for match in CODEPOINT_RE.finditer(value):
        character = chr(int(match.group(1), 16))
        if character not in seen:
            seen.append(character)
    return seen


def primary_rs(value: str) -> str:
    return value.split()[0] if value.split() else ""


def encode_mask(mask: int) -> str:
    """Two base-64 digits; the client reads one fixed-width pair per character."""
    return SRC_ALPHABET[mask // 64] + SRC_ALPHABET[mask % 64]


def write_gzip_json(path: Path, document: object) -> int:
    payload = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=9) as compressed:
            compressed.write(payload)
    size = path.stat().st_size
    log(f"wrote {path.relative_to(ROOT)}  {size / 1_000_000:.2f} MB (json {len(payload) / 1_000_000:.2f} MB)")
    return size


def main() -> None:
    for name, url in SOURCES.items():
        download(name, url)
    ensure_unihan()

    fields = read_unihan()
    rs_field = fields["kRSUnicode"]
    strokes_field = fields["kTotalStrokes"]
    mandarin_field = fields.get("kMandarin", {})
    definition_field = fields.get("kDefinition", {})

    codepoints = sorted(rs_field, key=lambda value: int(value[2:], 16))
    characters = [chr(int(value[2:], 16)) for value in codepoints]
    index_of = {codepoint: index for index, codepoint in enumerate(codepoints)}
    index_of_char = {character: index for index, character in enumerate(characters)}

    rs_values = [primary_rs(rs_field[value]) for value in codepoints]
    stroke_values = [strokes_field[value].split()[0] for value in codepoints]

    masks: list[int] = [0] * len(codepoints)
    for field, bit in IRG_FIELDS:
        for codepoint in fields.get(field, {}):
            index = index_of.get(codepoint)
            if index is not None:
                masks[index] |= bit
    source_masks = "".join(encode_mask(value) for value in masks)

    pinyin: dict[str, str] = {}
    definitions: dict[str, str] = {}
    for index, codepoint in enumerate(codepoints):
        if codepoint in mandarin_field:
            pinyin[str(index)] = mandarin_field[codepoint]
        if codepoint in definition_field:
            definitions[str(index)] = definition_field[codepoint]

    usource_links: dict[str, str] = {}
    for codepoint, value in fields.get("kIRG_USource", {}).items():
        index = index_of.get(codepoint)
        if index is not None:
            usource_links[str(index)] = value.split()[0]

    ids_by_codepoint = read_ids()
    ids: dict[str, str] = {}
    for index, codepoint in enumerate(codepoints):
        value = ids_by_codepoint.get(codepoint)
        if value:
            ids[str(index)] = value

    variant_maps: dict[str, dict[str, str]] = {key: fields.get(field, {}) for key, field in VARIANT_FIELDS.items()}
    variants: dict[str, dict[str, list[str]]] = {}
    for index, codepoint in enumerate(codepoints):
        entry: dict[str, list[str]] = {}
        for key, mapping in variant_maps.items():
            value = mapping.get(codepoint)
            if not value:
                continue
            related = variant_characters(value)
            if related:
                entry[key] = related
        if entry:
            variants[str(index)] = entry

    multi_rs: dict[str, str] = {}
    for index, codepoint in enumerate(codepoints):
        value = rs_field[codepoint]
        if len(value.split()) > 1:
            multi_rs[str(index)] = value

    radicals = read_radicals()
    radical_strokes: dict[str, int] = {}
    for number, _radical, ideograph in radicals:
        if ideograph and ideograph in index_of_char:
            radical_strokes[number] = int(stroke_values[index_of_char[ideograph]])
    radicals = [item + [radical_strokes.get(item[0], 0)] for item in radicals]

    usource = read_usource()

    version = "18.0.0"
    with (SOURCE_DIR / "Unihan_IRGSources.txt").open(encoding="utf-8") as handle:
        for line in handle:
            match = re.search(r"Unicode Version ([0-9.]+)", line)
            if match:
                version = match.group(1)
                break

    built = date.today().isoformat()
    core = {
        "version": version,
        "built": built,
        "chars": "".join(characters),
        "rs": ",".join(rs_values),
        "ts": ",".join(stroke_values),
        "src": source_masks,
        "py": pinyin,
        "ul": usource_links,
        "radicals": radicals,
        "u": usource,
    }
    details = {
        "version": version,
        "ids": ids,
        "def": definitions,
        "vars": variants,
        "rsAll": multi_rs,
    }

    core_size = write_gzip_json(OUTPUT_DIR / "core.json.gz", core)
    details_size = write_gzip_json(OUTPUT_DIR / "details.json.gz", details)

    log("")
    log(f"characters       {len(characters):,}")
    log(f"with pinyin      {len(pinyin):,}")
    log(f"with definition  {len(definitions):,}")
    log(f"with IDS         {len(ids):,}")
    log(f"with variants    {len(variants):,}")
    log(f"U-source rows    {len(usource):,} (unencoded {sum(1 for row in usource if row[1] in {'FutureWS', 'WS-2024', 'NoAction', 'Rejected'})})")
    log(f"total            {(core_size + details_size) / 1_000_000:.2f} MB")


if __name__ == "__main__":
    main()
