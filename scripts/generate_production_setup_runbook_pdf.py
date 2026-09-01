#!/usr/bin/env python3
"""Render the production setup Markdown runbook as a polished PDF."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "production-setup-and-protech-onboarding.md"
OUTPUT = (
    ROOT
    / "output"
    / "pdf"
    / "avyukta-crm-production-setup-and-protech-onboarding.pdf"
)

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm

NAVY = colors.HexColor("#17243B")
TEAL = colors.HexColor("#0F766E")
LIGHT_TEAL = colors.HexColor("#E9F7F5")
LIGHT_BLUE = colors.HexColor("#EEF4FA")
LIGHT_GRAY = colors.HexColor("#F4F6F8")
MID_GRAY = colors.HexColor("#667085")
DARK = colors.HexColor("#202939")
BORDER = colors.HexColor("#D9E0E7")
RED = colors.HexColor("#B42318")


def inline_markup(value: str) -> str:
    value = html.escape(value.strip())
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    return value


def styles():
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "RunbookTitle",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=28,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "RunbookSubtitle",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=MID_GRAY,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "RunbookH2",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=NAVY,
            spaceBefore=12,
            spaceAfter=7,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "RunbookH3",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=TEAL,
            spaceBefore=9,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "RunbookBody",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=12.5,
            textColor=DARK,
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "RunbookBullet",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=12.2,
            leftIndent=12,
            firstLineIndent=-7,
            bulletIndent=3,
            textColor=DARK,
            spaceAfter=3,
        ),
        "number": ParagraphStyle(
            "RunbookNumber",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=12.2,
            leftIndent=14,
            firstLineIndent=-10,
            textColor=DARK,
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "RunbookCode",
            parent=sample["Code"],
            fontName="Courier",
            fontSize=7.5,
            leading=10.2,
            textColor=colors.HexColor("#102A43"),
            leftIndent=0,
            rightIndent=0,
            backColor=LIGHT_GRAY,
            borderColor=BORDER,
            borderWidth=0.5,
            borderPadding=7,
            spaceBefore=3,
            spaceAfter=3,
        ),
        "table_header": ParagraphStyle(
            "RunbookTableHeader",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=9.5,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "RunbookTableCell",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9.4,
            textColor=DARK,
        ),
        "callout": ParagraphStyle(
            "RunbookCallout",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.6,
            leading=12.4,
            textColor=RED,
            leftIndent=7,
            rightIndent=7,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "cover_label": ParagraphStyle(
            "CoverLabel",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=TEAL,
        ),
        "cover_value": ParagraphStyle(
            "CoverValue",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=NAVY,
        ),
    }


def page_header_footer(canvas, doc):
    canvas.saveState()
    page_number = canvas.getPageNumber()

    if page_number > 1:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN_X, PAGE_HEIGHT - 12 * mm, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12 * mm)
        canvas.setFillColor(NAVY)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(MARGIN_X, PAGE_HEIGHT - 9 * mm, "AVYUKTA CRM - PRODUCTION RUNBOOK")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN_X, 12 * mm, PAGE_WIDTH - MARGIN_X, 12 * mm)
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGIN_X, 8 * mm, "No live secrets are stored in this document")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 8 * mm, f"Page {page_number}")
    canvas.restoreState()


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_separator_row(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def table_flowable(rows: list[list[str]], sheet) -> Table:
    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    available = PAGE_WIDTH - 2 * MARGIN_X

    if column_count == 5:
        widths = [available * factor for factor in (0.15, 0.12, 0.16, 0.25, 0.32)]
    elif column_count == 4:
        widths = [available * factor for factor in (0.25, 0.27, 0.31, 0.17)]
    else:
        widths = [available / column_count] * column_count

    data = []
    for row_index, row in enumerate(normalized):
        style = sheet["table_header"] if row_index == 0 else sheet["table_cell"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
                ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def make_cover(sheet):
    intro = [
        Spacer(1, 18 * mm),
        Paragraph("PRODUCTION OPERATIONS", sheet["cover_label"]),
        Spacer(1, 4 * mm),
        Paragraph("Avyukta CRM Production Setup and Protech Onboarding Runbook", sheet["title"]),
        Paragraph(
            "A repeatable, secret-safe guide for Vercel, Supabase Auth, Resend SMTP, super administrators, organization onboarding, branding, validation, and release handoff.",
            sheet["subtitle"],
        ),
        Spacer(1, 8 * mm),
    ]

    details = [
        [Paragraph("Production site", sheet["cover_label"]), Paragraph("https://protech.avyukta.ca", sheet["cover_value"])],
        [Paragraph("Production branch", sheet["cover_label"]), Paragraph("main", sheet["cover_value"])],
        [Paragraph("Production database", sheet["cover_label"]), Paragraph("crm-prod / lnybnkbetjjluhpspvjy", sheet["cover_value"])],
        [Paragraph("Development database", sheet["cover_label"]), Paragraph("crm-dev / bfsorhjuivyqlvqrkwgn", sheet["cover_value"])],
        [Paragraph("Last verified", sheet["cover_label"]), Paragraph("2026-08-31", sheet["cover_value"])],
    ]
    detail_table = Table(details, colWidths=[42 * mm, 112 * mm], hAlign="LEFT")
    detail_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    intro.extend(
        [
            detail_table,
            Spacer(1, 10 * mm),
            Table(
                [[Paragraph("SECURITY NOTE", sheet["cover_label"])], [Paragraph("This document deliberately records project references and configuration structure, but never live service-role or SMTP credentials.", sheet["body"])]],
                colWidths=[154 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_TEAL),
                        ("BOX", (0, 0), (-1, -1), 0.8, TEAL),
                        ("LEFTPADDING", (0, 0), (-1, -1), 9),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                        ("TOPPADDING", (0, 0), (-1, -1), 7),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ]
                ),
            ),
            PageBreak(),
        ]
    )
    return intro


def markdown_story(text: str, sheet):
    lines = text.splitlines()
    story = []
    index = 0
    in_code = False
    code_lines: list[str] = []
    first_heading_skipped = False

    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()

        if stripped.startswith("```"):
            if in_code:
                code_text = "<br/>".join(html.escape(line) or " " for line in code_lines)
                story.extend([Paragraph(code_text, sheet["code"]), Spacer(1, 4)])
                code_lines = []
                in_code = False
            else:
                in_code = True
            index += 1
            continue

        if in_code:
            code_lines.append(raw)
            index += 1
            continue

        if not stripped:
            index += 1
            continue

        if stripped.startswith("# ") and not first_heading_skipped:
            first_heading_skipped = True
            index += 1
            continue

        if stripped.startswith("## "):
            heading = stripped[3:]
            story.append(Paragraph(inline_markup(heading), sheet["h2"]))
            index += 1
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(inline_markup(stripped[4:]), sheet["h3"]))
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and is_separator_row(lines[index + 1]):
            rows = [split_table_row(stripped)]
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(split_table_row(lines[index]))
                index += 1
            story.extend([table_flowable(rows, sheet), Spacer(1, 5)])
            continue

        checkbox = re.match(r"^- \[([ xX])\] (.+)$", stripped)
        if checkbox:
            mark = "[x]" if checkbox.group(1).lower() == "x" else "[ ]"
            story.append(
                Paragraph(
                    f'<font name="Courier-Bold">{mark}</font> {inline_markup(checkbox.group(2))}',
                    sheet["bullet"],
                )
            )
            index += 1
            continue

        if stripped.startswith("- "):
            story.append(
                Paragraph(
                    inline_markup(stripped[2:]),
                    sheet["bullet"],
                    bulletText="-",
                )
            )
            index += 1
            continue

        numbered = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if numbered:
            story.append(
                Paragraph(
                    f"<b>{numbered.group(1)}.</b> {inline_markup(numbered.group(2))}",
                    sheet["number"],
                )
            )
            index += 1
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if (
                not candidate
                or candidate.startswith("#")
                or candidate.startswith("-")
                or candidate.startswith("|")
                or candidate.startswith("```")
                or re.match(r"^\d+\.\s+", candidate)
            ):
                break
            paragraph_lines.append(candidate)
            index += 1

        paragraph = " ".join(paragraph_lines)
        style = sheet["callout"] if paragraph.startswith(("Safety rule:", "Important failure rule:", "Go-live decision:")) else sheet["body"]
        story.append(Paragraph(inline_markup(paragraph), style))

    return story


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = styles()
    source_text = SOURCE.read_text(encoding="utf-8")

    document = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="Avyukta CRM Production Setup and Protech Onboarding Runbook",
        author="Avyukta CRM",
        subject="Production configuration and organization onboarding",
    )
    frame = Frame(
        MARGIN_X,
        MARGIN_BOTTOM,
        PAGE_WIDTH - 2 * MARGIN_X,
        PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM,
        id="runbook-frame",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    document.addPageTemplates(
        [PageTemplate(id="runbook", frames=[frame], onPage=page_header_footer)]
    )

    story = make_cover(sheet)
    story.extend(markdown_story(source_text, sheet))
    document.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
