import io
import json
from datetime import date
from typing import Any, List

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.models import models

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and display total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        
        # Footer text
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.0 * inch, 0.35 * inch, footer_text)
        
        doc_info = "PeoplePay360 — Official Confidential Payslip Document"
        self.drawString(0.5 * inch, 0.35 * inch, doc_info)
        
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(0.5 * inch, 0.5 * inch, 8.0 * inch, 0.5 * inch)
        
        self.restoreState()


def format_currency(val: float) -> str:
    amount = float(val or 0.0)
    sign = "-" if amount < 0 else ""
    abs_val = abs(amount)
    formatted = f"{abs_val:,.2f}"
    return f"{sign}Rs. {formatted}"


def generate_payslip_pdf(payslip: models.Payslip) -> bytes:
    """
    Generates a professional PDF document bytes for a stored Payslip record.
    Uses strictly STORED Payslip and PayslipLine database data — NO recalculation.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,  # 0.5 in
        rightMargin=36,
        topMargin=36,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    PRIMARY = colors.HexColor("#1E3A8A")  # Deep Navy
    SECONDARY = colors.HexColor("#3B82F6")  # Bright Blue
    TEXT_MAIN = colors.HexColor("#1F2937")  # Dark Slate
    TEXT_MUTED = colors.HexColor("#4B5563")  # Gray
    BG_LIGHT = colors.HexColor("#F8FAFC")  # Soft Gray
    ACCENT_GREEN = colors.HexColor("#059669")  # Emerald
    ACCENT_RED = colors.HexColor("#DC2626")  # Crimson
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    # Typography Styles
    style_brand = ParagraphStyle("Brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=PRIMARY)
    style_title = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=SECONDARY, alignment=2) # Right align
    style_section_heading = ParagraphStyle("SecHeading", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=PRIMARY)
    style_body_bold = ParagraphStyle("BodyBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=TEXT_MAIN)
    style_body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT_MAIN)
    style_body_muted = ParagraphStyle("BodyMuted", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=TEXT_MUTED)
    style_th = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.white)
    style_td = ParagraphStyle("TD", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXT_MAIN)
    style_td_bold = ParagraphStyle("TDBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=TEXT_MAIN)
    style_td_right = ParagraphStyle("TDRight", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXT_MAIN, alignment=2)
    style_td_right_bold = ParagraphStyle("TDRightBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=TEXT_MAIN, alignment=2)

    story = []

    # 1. Header Banner Table
    emp_name = f"{payslip.employee.first_name} {payslip.employee.last_name}" if payslip.employee else "N/A"
    emp_code = payslip.employee.employee_number if payslip.employee else "N/A"
    dept_name = payslip.employee.department.name if (payslip.employee and payslip.employee.department) else "N/A"
    contract_name = payslip.contract.name if payslip.contract else "Active Contract"
    payrun_name = payslip.payrun.name if payslip.payrun else "Payroll Run"
    struct_name = payslip.payrun.salary_structure.name if (payslip.payrun and payslip.payrun.salary_structure) else "Standard Structure"
    payslip_status = (payslip.status or "draft").upper()

    header_left = [
        Paragraph("PEOPLEPAY360", style_brand),
        Paragraph("Enterprise HR & Payroll System", style_body_muted),
    ]
    header_right = [
        Paragraph("PAYSLIP DOCUMENT", style_title),
        Paragraph(f"<b>Status:</b> {payslip_status}", ParagraphStyle("St", parent=style_td_right, textColor=ACCENT_GREEN if payslip_status == "PAID" else SECONDARY)),
        Paragraph(f"<b>Ref ID:</b> {payslip.id[:18]}...", style_td_right),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[3.8 * inch, 3.7 * inch])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=4, spaceAfter=10))

    # 2. Employee & Payroll Info Grid
    info_data = [
        [
            Paragraph("<b>EMPLOYEE INFORMATION</b>", style_section_heading),
            "",
            Paragraph("<b>PAYROLL PERIOD INFORMATION</b>", style_section_heading),
            ""
        ],
        [
            Paragraph("Employee Name:", style_body_muted), Paragraph(emp_name, style_body_bold),
            Paragraph("Payrun Name:", style_body_muted), Paragraph(payrun_name, style_body_bold)
        ],
        [
            Paragraph("Employee Code:", style_body_muted), Paragraph(emp_code, style_body),
            Paragraph("Payroll Period:", style_body_muted), Paragraph(f"{payslip.period_start} to {payslip.period_end}", style_body)
        ],
        [
            Paragraph("Department:", style_body_muted), Paragraph(dept_name, style_body),
            Paragraph("Salary Structure:", style_body_muted), Paragraph(struct_name, style_body)
        ],
        [
            Paragraph("Contract Title:", style_body_muted), Paragraph(contract_name, style_body),
            Paragraph("Worked Attendance:", style_body_muted), Paragraph(f"{payslip.worked_days} Days / {payslip.worked_hours} Hours", style_body)
        ],
    ]

    info_table = Table(info_data, colWidths=[1.3 * inch, 2.45 * inch, 1.3 * inch, 2.45 * inch])
    info_table.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("SPAN", (2, 0), (3, 0)),
        ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEBELOW", (0, 0), (1, 0), 1, PRIMARY),
        ("LINEBELOW", (2, 0), (3, 0), 1, PRIMARY),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 12))

    # Parse PayslipLines from database (sorted by sequence)
    lines = sorted(payslip.lines, key=lambda l: l.sequence) if payslip.lines else []

    # Separate Earnings & Deductions
    earnings_lines = [l for l in lines if l.category in ["basic", "allowance", "gross"] or (l.category != "deduction" and l.category != "net" and l.amount >= 0)]
    deduction_lines = [l for l in lines if l.category == "deduction" or (l.category != "net" and l.category != "gross" and l.amount < 0)]

    # 3. Earnings & Deductions Tables Side-by-Side (or stacked if wide)
    # Earnings Table
    earn_table_data = [[Paragraph("EARNINGS RULE", style_th), Paragraph("CODE", style_th), Paragraph("AMOUNT", ParagraphStyle("THr", parent=style_th, alignment=2))]]
    for el in earnings_lines:
        earn_table_data.append([
            Paragraph(el.rule_name, style_td),
            Paragraph(el.rule_code, style_td_bold),
            Paragraph(format_currency(el.amount), style_td_right)
        ])
    if not earnings_lines:
        earn_table_data.append([Paragraph("No separate earnings lines", style_td), Paragraph("-", style_td), Paragraph(format_currency(payslip.gross_salary), style_td_right)])

    # Subtotals
    earn_table_data.append([
        Paragraph("<b>TOTAL GROSS EARNINGS</b>", style_td_bold),
        "",
        Paragraph(format_currency(payslip.gross_salary), style_td_right_bold)
    ])

    earn_table = Table(earn_table_data, colWidths=[2.0 * inch, 0.7 * inch, 1.0 * inch])
    earn_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("SPAN", (0, -1), (1, -1)),
        ("BACKGROUND", (0, -1), (-1, -1), BG_LIGHT),
    ]))

    # Deductions Table
    deduct_table_data = [[Paragraph("DEDUCTION RULE", style_th), Paragraph("CODE", style_th), Paragraph("AMOUNT", ParagraphStyle("THr", parent=style_th, alignment=2))]]
    for dl in deduction_lines:
        deduct_table_data.append([
            Paragraph(dl.rule_name, style_td),
            Paragraph(dl.rule_code, style_td_bold),
            Paragraph(format_currency(abs(dl.amount)), ParagraphStyle("TDr", parent=style_td_right, textColor=ACCENT_RED))
        ])
    if not deduction_lines:
        deduct_table_data.append([Paragraph("No deduction lines", style_td), Paragraph("-", style_td), Paragraph(format_currency(0.0), style_td_right)])

    # Subtotal
    deduct_table_data.append([
        Paragraph("<b>TOTAL DEDUCTIONS</b>", style_td_bold),
        "",
        Paragraph(format_currency(payslip.total_deductions), ParagraphStyle("TDrb", parent=style_td_right_bold, textColor=ACCENT_RED))
    ])

    deduct_table = Table(deduct_table_data, colWidths=[2.0 * inch, 0.7 * inch, 1.0 * inch])
    deduct_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("SPAN", (0, -1), (1, -1)),
        ("BACKGROUND", (0, -1), (-1, -1), BG_LIGHT),
    ]))

    # Combine Earnings & Deductions Tables in 2 Columns
    tables_side_by_side = Table([[earn_table, deduct_table]], colWidths=[3.75 * inch, 3.75 * inch])
    tables_side_by_side.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(tables_side_by_side)
    story.append(Spacer(1, 10))

    # 4. Prominent Net Pay Box
    net_pay_str = format_currency(payslip.net_salary)
    net_box_data = [
        [
            Paragraph("<b>NET PAYABLE AMOUNT:</b>", ParagraphStyle("NB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=PRIMARY)),
            Paragraph(f"<b>{net_pay_str}</b>", ParagraphStyle("NA", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=ACCENT_GREEN, alignment=2))
        ]
    ]
    net_box_table = Table(net_box_data, colWidths=[4.0 * inch, 3.5 * inch])
    net_box_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")), # Emerald tint
        ("BOX", (0, 0), (-1, -1), 1.5, ACCENT_GREEN),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(net_box_table)
    story.append(Spacer(1, 14))

    # 5. Complete Salary Rule Breakdown Table (Ordered by Sequence)
    breakdown_data = [[
        Paragraph("SEQ", style_th),
        Paragraph("RULE NAME", style_th),
        Paragraph("CODE", style_th),
        Paragraph("CATEGORY", style_th),
        Paragraph("AMOUNT", ParagraphStyle("THr2", parent=style_th, alignment=2))
    ]]

    for line in lines:
        cat_str = (line.category or "other").title()
        amt_color = ACCENT_RED if line.category == "deduction" else ACCENT_GREEN if line.category == "net" else TEXT_MAIN
        amt_text = format_currency(line.amount)
        
        breakdown_data.append([
            Paragraph(f"[{line.sequence}]", style_td_bold),
            Paragraph(line.rule_name, style_td),
            Paragraph(line.rule_code, style_td_bold),
            Paragraph(cat_str, style_td),
            Paragraph(amt_text, ParagraphStyle("TDa", parent=style_td_right_bold, textColor=amt_color))
        ])

    breakdown_table = Table(breakdown_data, colWidths=[0.6 * inch, 2.8 * inch, 1.3 * inch, 1.2 * inch, 1.6 * inch])
    breakdown_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
    ]))

    story.append(KeepTogether([
        Paragraph("<b>COMPLETE SALARY RULE BREAKDOWN (EXECUTION SEQUENCE)</b>", style_section_heading),
        Spacer(1, 4),
        breakdown_table
    ]))

    # 6. Warnings Section (if present)
    warnings = []
    if payslip.warnings_json:
        try:
            warnings = json.loads(payslip.warnings_json)
        except Exception:
            warnings = []

    if warnings:
        story.append(Spacer(1, 12))
        warn_paragraphs = [Paragraph("<b>PAYROLL CALCULATION WARNINGS:</b>", ParagraphStyle("WH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#B45309")))]
        for w in warnings:
            warn_paragraphs.append(Paragraph(f"• {w}", ParagraphStyle("WB", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#92400E"))))

        warn_table = Table([[warn_paragraphs]], colWidths=[7.5 * inch])
        warn_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(warn_table)

    # Build PDF using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
