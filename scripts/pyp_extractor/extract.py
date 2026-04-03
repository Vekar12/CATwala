#!/usr/bin/env python3
"""
CAT Previous Year Paper Extractor
Handles three PDF formats:
  - Old (2017-2023): "Section : Verbal Ability", "Question No. : N", options "A) ..."
  - New-ABCD (2024): "SECTION: VERBAL ABILITY...", "N. question", options "A. ..."
  - New-1234 (2025): "SECTION: VERBAL ABILITY...", "N. question", options "1. 2. 3. 4."
Answers: separate key PDF or embedded at end of questions PDF.

Usage:
  python3 extract.py <year> <slot> <questions_pdf> <output_json> [answer_key_pdf]
"""

import pdfplumber
import re
import json
import sys
from pathlib import Path

# ─── Constants ─────────────────────────────────────────────────────────────────

SECTION_MAP = {
    'VARC': 'Verbal Ability & Reading Comprehension',
    'DILR': 'Data Interpretation & Logical Reasoning',
    'QA':   'Quantitative Ability',
}

TITA_PATTERNS = [
    re.compile(r'key in this sequence', re.IGNORECASE),
    re.compile(r'type in the answer', re.IGNORECASE),
    re.compile(r'key in the answer', re.IGNORECASE),
    re.compile(r'key in your answer', re.IGNORECASE),
    re.compile(r'key in the number', re.IGNORECASE),
    re.compile(r'enter your answer', re.IGNORECASE),
    re.compile(r'properly sequenced.*coherent paragraph', re.IGNORECASE),
    re.compile(r'does NOT belong to the paragraph', re.IGNORECASE),
    re.compile(r'four of them can be put together', re.IGNORECASE),
    re.compile(r'five sentences.*four of them', re.IGNORECASE),
    re.compile(r'numerical\s+answer', re.IGNORECASE),
    re.compile(r'identify the odd sentence', re.IGNORECASE),
]

# ─── PDF Utilities ─────────────────────────────────────────────────────────────

def extract_text(pdf_path):
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or '')
    return pages


def clean(text):
    text = re.sub(r'^Actual CAT \d{4}.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d{1,3}\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def is_tita(directions):
    return any(p.search(directions) for p in TITA_PATTERNS)

# ─── Format Detection ──────────────────────────────────────────────────────────

def detect_format(text):
    if re.search(r'SECTION\s*:\s*VERBAL ABILITY AND READING', text, re.IGNORECASE):
        # 2025 uses 1/2/3/4 options; 2024 uses A/B/C/D
        if re.search(r'\n\s*[A-D]\.\s+\S', text):
            return 'new-abcd'
        return 'new-1234'
    return 'old'

# ─── Section Splitter ──────────────────────────────────────────────────────────

def split_into_sections_old(text):
    """Split old-format text into {VARC, DILR, QA} blocks."""
    pat = re.compile(
        r'(?m)(?=Section\s*:\s*(?:Verbal Ability|DI\s*&\s*Reasoning|Data Interpretation|Quantitative))',
        re.IGNORECASE
    )
    section_names = {
        'verbal': 'VARC', 'di &': 'DILR', 'data': 'DILR', 'quant': 'QA',
    }
    parts = pat.split(text)
    result = {'VARC': '', 'DILR': '', 'QA': ''}
    for part in parts:
        for key, sec in section_names.items():
            if re.match(rf'Section\s*:\s*.*{key}', part, re.IGNORECASE):
                result[sec] += part
                break
    return result


def split_into_sections_new(text):
    """Split new-format text into {VARC, DILR, QA} blocks using SECTION: headers."""
    pat = re.compile(
        r'(?m)(?=SECTION\s*:\s*(?:VERBAL ABILITY|DI\s*&\s*LOGICAL|DATA INTERPRETATION|QUANTITATIVE))',
        re.IGNORECASE
    )
    section_names = {
        'verbal': 'VARC',
        'di &': 'DILR',
        'data interpretation': 'DILR',
        'quantitative': 'QA',
    }
    parts = pat.split(text)
    result = {'VARC': '', 'DILR': '', 'QA': ''}
    for part in parts:
        matched = False
        for key, sec in section_names.items():
            if re.match(rf'SECTION\s*:\s*{re.escape(key)}', part, re.IGNORECASE):
                result[sec] += part
                matched = True
                break
        if not matched:
            # Try broader match
            m = re.match(r'SECTION\s*:\s*(\w[\w\s&]*)', part, re.IGNORECASE)
            if m:
                label = m.group(1).strip().lower()
                if 'verbal' in label:
                    result['VARC'] += part
                elif 'di' in label or 'data' in label or 'logical' in label:
                    result['DILR'] += part
                elif 'quant' in label:
                    result['QA'] += part
    return result

# ─── Option Parsers ────────────────────────────────────────────────────────────

def parse_abcd_paren(text):
    m = re.search(r'(?:^|\n)\s*[A-D]\)', text)
    if not m:
        return {}, text.strip()
    pre = text[:m.start()].strip()
    opts = {}
    for om in re.finditer(r'(?:^|\s)([A-D])\)\s*(.*?)(?=(?:\s[A-D]\)|\Z))', text[m.start():], re.DOTALL):
        opts[om.group(1)] = re.sub(r'\s+', ' ', om.group(2)).strip()
    return opts, pre


def parse_abcd_dot(text):
    """Parse A. B. C. D. options — multiline or inline."""
    # Inline: "A. text B. text C. text D. text" on one line
    inline = re.search(r'\bA\.\s+(.+?)\s+B\.\s+(.+?)\s+C\.\s+(.+?)\s+D\.\s+(.+?)(?=\n|$)', text)
    if inline:
        pre = text[:inline.start()].strip()
        return {
            'A': inline.group(1).strip(), 'B': inline.group(2).strip(),
            'C': inline.group(3).strip(), 'D': inline.group(4).strip(),
        }, pre
    # Multiline
    m = re.search(r'(?:^|\n)\s*[A-D]\.\s', text)
    if not m:
        return {}, text.strip()
    pre = text[:m.start()].strip()
    opts = {}
    for om in re.finditer(r'(?:^|\n)\s*([A-D])\.\s*(.*?)(?=(?:\n\s*[A-D]\.\s|\Z))', text[m.start():], re.DOTALL):
        opts[om.group(1)] = re.sub(r'\s+', ' ', om.group(2)).strip()
    return opts, pre


def parse_1234_opts(text):
    """Detect 1. 2. 3. 4. option block (all four on consecutive lines or on one line)."""
    # Multi-line: each option on its own line "1. text\n2. text..."
    m = re.search(
        r'(?:^|\n)\s*1\.\s+(.*?)\n\s*2\.\s+(.*?)\n\s*3\.\s+(.*?)\n\s*4\.\s+(.*?)(?=\n|$)',
        text, re.DOTALL
    )
    if m:
        pre = text[:m.start()].strip()
        return {'A': m.group(1).strip(), 'B': m.group(2).strip(),
                'C': m.group(3).strip(), 'D': m.group(4).strip()}, pre
    # Single-line: "1. txt  2. txt  3. txt  4. txt" (2+ spaces between options)
    m2 = re.search(
        r'1\.\s+(.+?)\s{2,}2\.\s+(.+?)\s{2,}3\.\s+(.+?)\s{2,}4\.\s+(.+?)(?=\n|$)',
        text
    )
    if m2:
        pre = text[:m2.start()].strip()
        return {'A': m2.group(1).strip(), 'B': m2.group(2).strip(),
                'C': m2.group(3).strip(), 'D': m2.group(4).strip()}, pre
    # Single-line single-space: "1. txt 2. txt 3. txt 4. txt"
    m3 = re.search(
        r'(?:^|\n)\s*1\.\s+(.+?)\s+2\.\s+(.+?)\s+3\.\s+(.+?)\s+4\.\s+(.+?)(?=\s*\n|$)',
        text
    )
    if m3:
        pre = text[:m3.start()].strip()
        return {'A': m3.group(1).strip(), 'B': m3.group(2).strip(),
                'C': m3.group(3).strip(), 'D': m3.group(4).strip()}, pre
    return {}, text.strip()


def split_passage_question(content):
    paras = [p.strip() for p in re.split(r'\n\s*\n', content) if p.strip()]
    if len(paras) <= 1:
        return '', content.strip()
    return '\n\n'.join(paras[:-1]), paras[-1]

# ─── Old Format Question Parser ────────────────────────────────────────────────

def parse_questions_old(section_text, section, paper_id):
    questions = []
    cur_dir = ''
    cur_tita = False
    passage_store = {}
    pg = 0

    chunks = re.split(
        r'(?m)(?=DIRECTIONS\s+for\s+the\s+question|Question\s+No\.\s*:\s*\d+)',
        section_text, flags=re.IGNORECASE
    )

    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue

        dm = re.match(
            r'DIRECTIONS\s+for\s+the\s+question[s]?\s*:(.*?)(?=Question\s+No\.|$)',
            chunk, re.DOTALL | re.IGNORECASE
        )
        if dm:
            cur_dir = dm.group(1).strip()
            cur_tita = is_tita(cur_dir)
            if re.search(r'Read the passage|Read the following', cur_dir, re.IGNORECASE):
                pg += 1
            remainder = chunk[dm.end():].strip()
            if not remainder:
                continue
            chunk = remainder

        qm = re.match(r'Question\s+No\.\s*:\s*(\d+)\s*(.*)', chunk, re.DOTALL | re.IGNORECASE)
        if not qm:
            continue

        qnum = int(qm.group(1))
        content = qm.group(2).strip()
        options, pre = parse_abcd_paren(content)
        q_type = 'MCQ' if options else 'TITA'

        passage, q_text = '', pre
        if section == 'VARC' and re.search(r'Read the passage|Read the following', cur_dir, re.IGNORECASE):
            if pg not in passage_store:
                passage, q_text = split_passage_question(pre)
                passage_store[pg] = passage
            else:
                passage = passage_store.get(pg, '')

        questions.append({
            'id': f"{paper_id}-{section.lower()}-{qnum}",
            'number': qnum,
            'section': section,
            'type': q_type,
            'directions': cur_dir,
            'passage': passage,
            'passage_group': pg if passage else None,
            'question': q_text,
            'options': options,
            'correct_answer': None,
            'explanation': '',
        })

    return questions

# ─── New Format Question Parser ────────────────────────────────────────────────

def extract_qnum_range(range_str):
    """Extract question numbers from strings like '1 to 4', '5 and 6', '20', '1-4'."""
    nums = [int(n) for n in re.findall(r'\d+', range_str or '')]
    if not nums:
        return []
    if len(nums) == 1:
        return nums
    # "1 to 4" or "1-4" → [1,2,3,4]
    if len(nums) == 2 and nums[1] - nums[0] <= 10:
        return list(range(nums[0], nums[1] + 1))
    return nums


def find_question_block(text, qnum, next_qnum=None):
    """Find the text block for question qnum in text. Returns the content after 'N. '."""
    # Look for line starting with exactly this number followed by '. '
    pat = re.compile(rf'(?:^|\n)\s*{qnum}\.\s+', re.MULTILINE)
    m = pat.search(text)
    if not m:
        return None
    start = m.end()
    if next_qnum:
        end_pat = re.compile(rf'(?:^|\n)\s*{next_qnum}\.\s+', re.MULTILINE)
        em = end_pat.search(text, start)
        end = em.start() if em else len(text)
    else:
        end = len(text)
    return text[start:end].strip()


DIRECTION_RE = re.compile(
    r'DIRECTIONS?\s+for\s+(?:the\s+)?question[s]?\s*([\d\s\-,to&]+)?\s*:',
    re.IGNORECASE
)


def parse_questions_new(section_text, section, paper_id, fmt, valid_qnums=None, answers_dict=None):
    """
    Parse questions in new format (2024/2025).
    Handles both DIRECTION(S)-block questions and standalone questions (e.g. QA with no directions).
    """
    questions = []
    passage_store = {}
    pg = 0

    # Track which question numbers have already been captured (to avoid duplicates)
    captured = set()

    # ── Pass 1: DIRECTIONS-based questions ─────────────────────────────────────
    dir_splits = DIRECTION_RE.split(section_text)
    # dir_splits alternates: [pre_text, range_str, body, range_str, body, ...]
    # After split on the full pattern, we get fragments; work with finditer instead

    for dm in DIRECTION_RE.finditer(section_text):
        # range_str is captured group 1 of DIRECTION_RE
        range_str = (dm.group(1) or '').strip()
        body_start = dm.end()

        # Find body: everything up to the next DIRECTION block or section end
        next_dir = DIRECTION_RE.search(section_text, body_start)
        body_end = next_dir.start() if next_dir else len(section_text)
        dir_body = section_text[body_start:body_end].strip()

        cur_tita = is_tita(dir_body)
        cur_dir = re.split(r'\n\s*\d{1,2}\.\s', dir_body)[0].strip()

        if re.search(r'passage|information given below|following information', dir_body, re.IGNORECASE):
            pg += 1

        # Determine expected question numbers in this block
        expected = extract_qnum_range(range_str)
        if not expected:
            found = [int(n) for n in re.findall(r'(?:^|\n)\s*(\d{1,2})\.\s+\S', dir_body, re.MULTILINE)]
            if valid_qnums:
                expected = sorted(set(n for n in found if n in valid_qnums))
            else:
                expected = sorted(set(found))
        if not expected:
            continue

        for i, qnum in enumerate(expected):
            if qnum in captured:
                continue
            next_q = expected[i + 1] if i + 1 < len(expected) else None
            content = find_question_block(dir_body, qnum, next_q)
            if content is None:
                continue

            if fmt == 'new-abcd':
                options, pre = parse_abcd_dot(content)
                if not options:
                    options, pre = parse_abcd_paren(content)
            else:
                options, pre = parse_1234_opts(content)
                if not options and cur_tita:
                    pre = content

            q_type = 'MCQ' if options else 'TITA'
            passage, q_text = '', pre if pre else content

            if section == 'VARC' and re.search(r'passage', cur_dir, re.IGNORECASE):
                if pg not in passage_store:
                    passage, q_text = split_passage_question(pre or content)
                    passage_store[pg] = passage
                else:
                    passage = passage_store.get(pg, '')

            questions.append({
                'id': f"{paper_id}-{section.lower()}-{qnum}",
                'number': qnum, 'section': section, 'type': q_type,
                'directions': cur_dir, 'passage': passage,
                'passage_group': pg if passage else None,
                'question': q_text, 'options': options,
                'correct_answer': None, 'explanation': '',
            })
            captured.add(qnum)

    # ── Pass 2: Standalone questions (no DIRECTIONS) ───────────────────────────
    # Find question numbers not yet captured that appear with A/B/C/D options
    if valid_qnums:
        remaining = sorted(set(valid_qnums) - captured)
        for i, qnum in enumerate(remaining):
            next_q = remaining[i + 1] if i + 1 < len(remaining) else None
            content = find_question_block(section_text, qnum, next_q)
            if content is None:
                continue

            if fmt == 'new-abcd':
                options, pre = parse_abcd_dot(content)
                if not options:
                    options, pre = parse_abcd_paren(content)
            else:
                options, pre = parse_1234_opts(content)

            # For standalone: include if options parsed, it's known TITA, or answer key has an entry
            ans_type = (answers_dict or {}).get(qnum, {}).get('type')
            has_answer = qnum in (answers_dict or {})
            if not options and ans_type != 'TITA' and not has_answer:
                continue

            q_type = 'MCQ' if options else 'TITA'
            q_text = pre if pre else content

            questions.append({
                'id': f"{paper_id}-{section.lower()}-{qnum}",
                'number': qnum, 'section': section, 'type': q_type,
                'directions': '', 'passage': None,
                'passage_group': None, 'question': q_text, 'options': options,
                'correct_answer': None, 'explanation': '',
            })
            captured.add(qnum)

    return questions

# ─── Answer Key Parsers ────────────────────────────────────────────────────────

def parse_embedded_answers(text):
    answers = {}
    for block in re.split(r'(?=QNo:-\s*\d+)', text):
        m = re.match(r'QNo:-\s*(\d+)\s*,\s*Correct\s*Answer:-\s*([A-D]|\d+(?:\.\d+)?)', block.strip())
        if not m:
            continue
        qnum = int(m.group(1))
        em = re.search(r'Explanation:-\s*(.*)', block, re.DOTALL)
        answers[qnum] = {
            'correct_answer': m.group(2).strip(),
            'explanation': re.sub(r'\s+', ' ', em.group(1).strip()) if em else '',
            'type': 'MCQ',
        }
    return answers


def parse_table_answer_key(text, year):
    answers = {}

    # Extract explanations
    expl = {}
    es = re.search(r'Q\.\s*No\s+Explanation', text, re.IGNORECASE)
    if es:
        for em in re.finditer(r'(?:^|\n)\s*(\d+)\.\s+(.*?)(?=(?:\n\s*\d+\.\s)|\Z)', text[es.end():], re.DOTALL):
            expl[int(em.group(1))] = re.sub(r'\s+', ' ', em.group(2).strip())

    # Parse table area (before explanation section)
    table_text = text[:es.start()] if es else text
    ks = re.search(r'Answer Key', table_text, re.IGNORECASE)
    if ks:
        table_text = table_text[ks.end():]

    # Match entries: N. KEY or N. VALUE (TITA)
    pat = re.compile(r'(\d+)\.\s+([A-D]|\d+(?:\.\d+)?)\s*(?:\(TITA\))?')
    for m in pat.finditer(table_text):
        qnum = int(m.group(1))
        raw = m.group(2).strip()
        is_tita_q = bool(re.search(r'\(TITA\)', table_text[m.start():m.end() + 8]))

        # Normalize 2025 1-4 MCQ answers → A-D
        if year >= 2025 and not is_tita_q and raw in ('1', '2', '3', '4'):
            raw = {'1': 'A', '2': 'B', '3': 'C', '4': 'D'}[raw]

        answers[qnum] = {
            'correct_answer': raw,
            'explanation': expl.get(qnum, ''),
            'type': 'TITA' if is_tita_q else 'MCQ',
        }
    return answers


def get_answers(questions_text, answer_key_pdf, year):
    if answer_key_pdf and Path(answer_key_pdf).exists():
        pages = extract_text(answer_key_pdf)
        key_text = clean('\n\n'.join(pages))
        if 'QNo:-' in key_text:
            return parse_embedded_answers(key_text)
        if re.search(r'Answer Key|Q\.\s*No\s+Key', key_text, re.IGNORECASE):
            return parse_table_answer_key(key_text, year)
    if 'QNo:-' in questions_text:
        return parse_embedded_answers(questions_text)
    return {}

# ─── Main Builder ──────────────────────────────────────────────────────────────

def build_paper(year, slot, questions_pdf, answer_key_pdf=None):
    paper_id = f"cat-{year}-slot{slot}"
    slot_label = ['I', 'II', 'III'][slot - 1] if slot <= 3 else str(slot)
    title = f"CAT {year} Slot {slot_label}"

    print(f"[{paper_id}] Reading {Path(questions_pdf).name}...")
    pages = extract_text(questions_pdf)
    text = clean('\n\n'.join(pages))

    fmt = detect_format(text)
    print(f"[{paper_id}] Format: {fmt}")

    # Get answers early (to use as validation for new format)
    answers = get_answers(text, answer_key_pdf, year)
    valid_qnums = set(answers.keys()) if answers else None
    print(f"[{paper_id}] Answers found: {len(answers)}")

    # Split into sections and parse questions
    if fmt == 'old':
        section_texts = split_into_sections_old(text)
        sections_data = {
            sec: parse_questions_old(section_texts[sec], sec, paper_id)
            for sec in ('VARC', 'DILR', 'QA')
        }
    else:
        section_texts = split_into_sections_new(text)
        # Partition valid_qnums by section (based on which section text each qnum appears in)
        section_qnums = {'VARC': set(), 'DILR': set(), 'QA': set()}
        if valid_qnums:
            for sec, st in section_texts.items():
                for qnum in valid_qnums:
                    pat = re.compile(rf'(?:^|\n)\s*{qnum}\.\s+\S', re.MULTILINE)
                    if pat.search(st):
                        section_qnums[sec].add(qnum)
            # Resolve conflicts: assign to the section with the most context
            for qnum in valid_qnums:
                belonging = [sec for sec in ('VARC', 'DILR', 'QA') if qnum in section_qnums[sec]]
                if len(belonging) > 1:
                    # Keep only the one whose section number range seems right
                    # Simple heuristic: small numbers → VARC, medium → DILR, large → QA
                    for sec in belonging[1:]:
                        section_qnums[sec].discard(qnum)

        sections_data = {
            sec: parse_questions_new(section_texts[sec], sec, paper_id, fmt,
                                     section_qnums[sec] if section_qnums[sec] else valid_qnums,
                                     answers_dict=answers)
            for sec in ('VARC', 'DILR', 'QA')
        }

    # Merge answers into questions
    for qs in sections_data.values():
        for q in qs:
            ans = answers.get(q['number'])
            if ans:
                q['correct_answer'] = ans['correct_answer']
                q['explanation'] = ans.get('explanation', '')
                if ans.get('type') == 'TITA':
                    q['type'] = 'TITA'

    total = sum(len(qs) for qs in sections_data.values())
    result = {
        'id': paper_id,
        'year': year,
        'slot': slot,
        'title': title,
        'has_solutions': bool(answers),
        'total_questions': total,
        'duration_minutes': 120,
        'sections': {
            sec: {
                'name': SECTION_MAP[sec],
                'duration_minutes': 40,
                'questions': sections_data[sec],
            }
            for sec in ('VARC', 'DILR', 'QA')
        },
    }

    print(f"[{paper_id}] VARC:{len(sections_data['VARC'])} DILR:{len(sections_data['DILR'])} QA:{len(sections_data['QA'])} Total:{total}")
    return result


def main():
    if len(sys.argv) < 5:
        print("Usage: python3 extract.py <year> <slot> <questions_pdf> <output_json> [answer_key_pdf]")
        sys.exit(1)
    year, slot = int(sys.argv[1]), int(sys.argv[2])
    questions_pdf, output_json = sys.argv[3], sys.argv[4]
    answer_key_pdf = sys.argv[5] if len(sys.argv) > 5 else None

    result = build_paper(year, slot, questions_pdf, answer_key_pdf)

    out = Path(output_json)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"[{result['id']}] Saved → {output_json}")


if __name__ == '__main__':
    main()
