import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { ReportResponse, ReportColumnDef } from './reports.service';

export interface GeneratedAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export class ReportAttachmentService {
  /**
   * Helper: Generate a clean, sanitized base filename
   */
  public static getSanitizedFilename(reportType: string, extension: string): string {
    const cleanType = reportType.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    return `${cleanType}_${dateStr}.${extension}`;
  }

  /**
   * Helper: Format value based on column definition
   */
  private static formatCellValue(val: any, col: ReportColumnDef, formatForPdf = false): string {
    if (val === null || val === undefined) return '—';

    if (col.type === 'currency' && typeof val === 'number') {
      // In PDFkit's default Helvetica font, use standard INR / Rs currency notation to avoid Unicode glyph errors
      return formatForPdf ? `INR ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (col.type === 'date' && val) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch {
        return String(val);
      }
    }

    if (typeof val === 'object') {
      return JSON.stringify(val);
    }

    return String(val);
  }

  /**
   * 1. GENERATE CSV ATTACHMENT
   */
  public static generateCsvAttachment(report: ReportResponse): GeneratedAttachment {
    const columns = report.columns || [];
    const records = report.records || [];

    const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');

    const rows = records.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return '""';
          if (c.type === 'currency' && typeof val === 'number') {
            return `"${val.toFixed(2)}"`;
          }
          if (c.type === 'date' && val) {
            try {
              const d = new Date(val);
              return `"${d.toISOString().split('T')[0]}"`;
            } catch {
              return `"${String(val).replace(/"/g, '""')}"`;
            }
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const buffer = Buffer.from(csvContent, 'utf-8');

    return {
      filename: this.getSanitizedFilename(report.reportType, 'csv'),
      content: buffer,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * 2. GENERATE EXCEL (.xlsx) ATTACHMENT
   */
  public static async generateExcelAttachment(report: ReportResponse): Promise<GeneratedAttachment> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'STOCKLEDGER Accounts & Finance';
    workbook.created = new Date();

    const sheetName = report.reportTitle.slice(0, 31).replace(/[\\/?*\[\]]/g, '') || 'Report';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    const columns = report.columns || [];
    const records = report.records || [];

    // Title Row
    worksheet.mergeCells(1, 1, 1, Math.max(columns.length, 4));
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'STOCKLEDGER — Enterprise Accounting Report';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Blue
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 28;

    // Report Subtitle Row
    worksheet.mergeCells(2, 1, 2, Math.max(columns.length, 4));
    const subTitleCell = worksheet.getCell(2, 1);
    subTitleCell.value = `${report.reportTitle} | Generated: ${new Date().toLocaleString('en-IN')}`;
    subTitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(2).height = 20;

    // Blank Spacer
    worksheet.getRow(3).height = 10;

    // Table Header Row (Row 4)
    const headerRowNumber = 4;
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.height = 24;

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.label;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Brand Blue
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    // Data Rows
    records.forEach((record, rIdx) => {
      const rowNumber = headerRowNumber + 1 + rIdx;
      const dataRow = worksheet.getRow(rowNumber);
      dataRow.height = 20;
      const isEven = rIdx % 2 === 0;

      columns.forEach((col, cIdx) => {
        const cell = dataRow.getCell(cIdx + 1);
        const rawVal = record[col.key];

        if (rawVal === null || rawVal === undefined) {
          cell.value = '—';
        } else if (col.type === 'currency' && typeof rawVal === 'number') {
          cell.value = rawVal;
          cell.numFmt = '[$₹-en-IN] #,##0.00;([$₹-en-IN] #,##0.00);"-"';
        } else if (col.type === 'number' && typeof rawVal === 'number') {
          cell.value = rawVal;
          cell.numFmt = '#,##0.##';
        } else if (col.type === 'date' && rawVal) {
          try {
            const d = new Date(rawVal);
            if (!isNaN(d.getTime())) {
              cell.value = d;
              cell.numFmt = 'yyyy-mm-dd';
            } else {
              cell.value = String(rawVal);
            }
          } catch {
            cell.value = String(rawVal);
          }
        } else {
          cell.value = String(rawVal);
        }

        cell.font = { name: 'Arial', size: 9.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }, // Zebra soft slate
          };
        }
      });
    });

    // Auto-fit column widths
    columns.forEach((col, cIdx) => {
      let maxLen = col.label.length;
      records.forEach((r) => {
        const valStr = this.formatCellValue(r[col.key], col);
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      worksheet.getColumn(cIdx + 1).width = Math.min(Math.max(maxLen + 4, 12), 40);
    });

    // Summary count footer
    const summaryRowNumber = headerRowNumber + 1 + records.length;
    worksheet.mergeCells(summaryRowNumber, 1, summaryRowNumber, Math.max(columns.length, 4));
    const summaryCell = worksheet.getCell(summaryRowNumber, 1);
    summaryCell.value = `Total Records: ${records.length} | End of Report`;
    summaryCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
    summaryCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    worksheet.getRow(summaryRowNumber).height = 22;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      filename: this.getSanitizedFilename(report.reportType, 'xlsx'),
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * 3. GENERATE PDF ATTACHMENT (Vector Layout via PDFKit)
   */
  public static async generatePdfAttachment(report: ReportResponse): Promise<GeneratedAttachment> {
    return new Promise((resolve, reject) => {
      try {
        const columns = report.columns || [];
        const records = report.records || [];

        // Choose landscape if more than 5 columns for maximum readability
        const isLandscape = columns.length > 5;
        const doc = new PDFDocument({
          margin: 36,
          size: 'A4',
          layout: isLandscape ? 'landscape' : 'portrait',
          bufferPages: true,
          info: {
            Title: report.reportTitle,
            Author: 'STOCKLEDGER Accounts',
            Subject: 'Financial Report',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const finalBuffer = Buffer.concat(chunks);
          resolve({
            filename: this.getSanitizedFilename(report.reportType, 'pdf'),
            content: finalBuffer,
            contentType: 'application/pdf',
          });
        });
        doc.on('error', (err) => reject(err));

        const pageWidth = isLandscape ? 841.89 : 595.28;
        const pageHeight = isLandscape ? 595.28 : 841.89;
        const contentWidth = pageWidth - 72; // 36 margin on each side

        // Helper: Draw Header Block
        const drawHeader = () => {
          doc.fillColor('#1E3A8A').fontSize(16).font('Helvetica-Bold').text('STOCKLEDGER', 36, 36);
          doc.fillColor('#64748B').fontSize(8.5).font('Helvetica').text('STORE, INVENTORY & ACCOUNTS ENTERPRISE MANAGEMENT', 36, 54);

          doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(report.reportTitle, 36, 70);

          const genDate = new Date().toLocaleString('en-IN');
          doc.fillColor('#64748B').fontSize(8).font('Helvetica')
            .text(`Generated: ${genDate} | Records: ${records.length}`, 36, 86);

          // Horizontal rule
          doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(36, 98).lineTo(pageWidth - 36, 98).stroke();
        };

        drawHeader();

        // Calculate Column Widths
        const totalCols = columns.length || 1;
        const colWidth = Math.floor(contentWidth / totalCols);

        let currentY = 108;
        const rowHeight = 18;
        const bottomThreshold = pageHeight - 50;

        // Draw Table Header
        const drawTableHeader = (y: number) => {
          doc.rect(36, y, contentWidth, 20).fill('#2563EB');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');

          columns.forEach((col, idx) => {
            const cellX = 36 + idx * colWidth + 4;
            const textWidth = colWidth - 8;
            doc.text(col.label, cellX, y + 5, {
              width: textWidth,
              align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
              lineBreak: false,
              ellipsis: true,
            });
          });

          return y + 20;
        };

        currentY = drawTableHeader(currentY);

        // Draw Data Rows
        records.forEach((row, rIdx) => {
          if (currentY + rowHeight > bottomThreshold) {
            doc.addPage();
            drawHeader();
            currentY = drawTableHeader(108);
          }

          const isEven = rIdx % 2 === 0;
          if (isEven) {
            doc.rect(36, currentY, contentWidth, rowHeight).fill('#F8FAFC');
          }

          doc.font('Helvetica').fontSize(7.5).fillColor('#1E293B');

          columns.forEach((col, idx) => {
            const cellX = 36 + idx * colWidth + 4;
            const textWidth = colWidth - 8;
            const formatted = this.formatCellValue(row[col.key], col, true);

            doc.text(formatted, cellX, currentY + 5, {
              width: textWidth,
              align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
              lineBreak: false,
              ellipsis: true,
            });
          });

          // Row bottom border
          doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(36, currentY + rowHeight).lineTo(pageWidth - 36, currentY + rowHeight).stroke();

          currentY += rowHeight;
        });

        // Summary footer on last page
        if (currentY + 25 > bottomThreshold) {
          doc.addPage();
          drawHeader();
          currentY = 108;
        }

        doc.rect(36, currentY + 4, contentWidth, 18).fill('#F1F5F9');
        doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8)
          .text(`Total Records: ${records.length} | STOCKLEDGER Financial Statement`, 42, currentY + 9);

        // Add page numbers on all buffered pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
            .text(`Page ${i + 1} of ${pages.count} • StockLedger Confidential`, 36, pageHeight - 30, {
              align: 'center',
              width: contentWidth,
            });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Unified dispatcher: Generate requested format attachment
   */
  public static async generateAttachment(
    report: ReportResponse,
    format: string
  ): Promise<GeneratedAttachment> {
    const normalized = (format || 'PDF').trim().toLowerCase();

    switch (normalized) {
      case 'excel':
      case 'xlsx':
      case 'xls':
        return await this.generateExcelAttachment(report);

      case 'csv':
        return this.generateCsvAttachment(report);

      case 'pdf':
      default:
        return await this.generatePdfAttachment(report);
    }
  }
}

export default ReportAttachmentService;
