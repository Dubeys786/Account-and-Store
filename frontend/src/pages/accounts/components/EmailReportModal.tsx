import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertTriangle, Loader2, Send, ExternalLink, FileText, FileSpreadsheet, FileDown } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import apiRequest from '../../../services/api';
import { ReportType } from '../AccountsReportsPage';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  reportTitle: string;
  currentFilters: Record<string, any>;
  summaryInfo: {
    dateRangeText: string;
    storeName: string;
    partyName: string;
    recordCount: number;
  };
}

type LoadingStep = 'idle' | 'preparing' | 'generating' | 'sending' | 'success' | 'error';

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportTitle,
  currentFilters,
  summaryInfo,
}) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    format: string;
    previewUrl?: string;
    recipients: string;
  } | null>(null);

  // Pre-fill form fields when modal opens
  useEffect(() => {
    if (isOpen) {
      const todayFormatted = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      setSubject(`StockLedger - ${reportTitle} - ${todayFormatted}`);
      setMessage(
`Hello,

Please find attached the requested StockLedger financial report.

Report:
${reportTitle}

Date Range:
${summaryInfo.dateRangeText}

Store:
${summaryInfo.storeName}

Records:
${summaryInfo.recordCount}

This report was generated from StockLedger.

Regards,
StockLedger
Accounts & Finance`
      );

      setLoadingStep('idle');
      setErrorMessage('');
      setSuccessInfo(null);
    }
  }, [isOpen, reportTitle, summaryInfo.dateRangeText, summaryInfo.storeName, summaryInfo.recordCount]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (summaryInfo.recordCount === 0) {
      setErrorMessage('No records found for the selected filters. Please adjust your criteria before emailing.');
      return;
    }

    if (!to.trim()) {
      setErrorMessage('Recipient "To" email address is required.');
      return;
    }

    setErrorMessage('');
    setLoadingStep('preparing');

    // Progressive visual steps
    const step1Timer = setTimeout(() => {
      setLoadingStep('generating');
    }, 600);

    const step2Timer = setTimeout(() => {
      setLoadingStep('sending');
    }, 1300);

    try {
      const payload = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        message: message.trim(),
        reportType,
        format,
        filters: {
          ...currentFilters,
          storeName: summaryInfo.storeName,
          partyName: summaryInfo.partyName,
          dateRangeText: summaryInfo.dateRangeText,
        },
      };

      const res = await apiRequest('/accounts/reports/email', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      clearTimeout(step1Timer);
      clearTimeout(step2Timer);

      if (res.success) {
        setLoadingStep('success');
        setSuccessInfo({
          message: res.message || `Report emailed successfully to ${to.trim()}`,
          format: format.toUpperCase(),
          recipients: to.trim(),
          previewUrl: res.data?.previewUrl,
        });
      } else {
        setLoadingStep('error');
        setErrorMessage(res.message || 'Unable to send the report. Please try again.');
      }
    } catch (err: any) {
      clearTimeout(step1Timer);
      clearTimeout(step2Timer);
      setLoadingStep('error');
      setErrorMessage(err.message || 'Unable to send the report. Please try again.');
    }
  };

  const isProcessing = loadingStep === 'preparing' || loadingStep === 'generating' || loadingStep === 'sending';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onClose}
      title="Email Financial Report"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
          >
            {loadingStep === 'success' ? 'Close' : 'Cancel'}
          </Button>

          {loadingStep !== 'success' && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={
                isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )
              }
              onClick={handleSendEmail}
              disabled={isProcessing || summaryInfo.recordCount === 0}
            >
              {loadingStep === 'preparing'
                ? 'Preparing report...'
                : loadingStep === 'generating'
                ? 'Generating attachment...'
                : loadingStep === 'sending'
                ? 'Sending email...'
                : 'Send Email'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Zero Data Warning */}
        {summaryInfo.recordCount === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">No records found for the selected filters.</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Cannot email an empty report. Please close this dialog and adjust your filter parameters to view and email records.
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {loadingStep === 'success' && successInfo && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successInfo.message}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Report <span className="font-medium">{reportTitle}</span> has been dispatched in{' '}
              <span className="font-bold underline">{successInfo.format}</span> format.
            </p>
            {successInfo.previewUrl && (
              <div className="pt-2 border-t border-emerald-200 mt-2">
                <a
                  href={successInfo.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium underline text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Ethereal SMTP Mail Preview & Download Attachment
                </a>
              </div>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-900 animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Unable to send the report. Please try again.</p>
              <p className="text-[11px] text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Report Filter Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Target Report Summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
            <div>
              <span className="font-semibold text-slate-500 text-[11px]">Report:</span>{' '}
              <span className="font-medium text-slate-900">{reportTitle}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500 text-[11px]">Date Range:</span>{' '}
              <span className="font-medium text-slate-900">{summaryInfo.dateRangeText}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500 text-[11px]">Store:</span>{' '}
              <span className="font-medium text-slate-900">{summaryInfo.storeName}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500 text-[11px]">Party:</span>{' '}
              <span className="font-medium text-slate-900">{summaryInfo.partyName}</span>
            </div>
            <div className="sm:col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span className="font-semibold text-slate-600 text-[11px]">Records to Email:</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-xs">
                {summaryInfo.recordCount.toLocaleString()} records
              </span>
            </div>
          </div>
        </div>

        {/* Email Form Fields */}
        {loadingStep !== 'success' && (
          <form onSubmit={handleSendEmail} className="space-y-3">
            {/* Recipient To Email */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                To Email <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isProcessing}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com (comma-separate multiple)"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              />
            </div>

            {/* CC & BCC (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">CC (Optional)</label>
                <input
                  type="text"
                  disabled={isProcessing}
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="manager@example.com"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">BCC (Optional)</label>
                <input
                  type="text"
                  disabled={isProcessing}
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="audit@example.com"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isProcessing}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 font-medium text-slate-800"
              />
            </div>

            {/* Report Format Selection */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Report Format <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setFormat('pdf')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    format === 'pdf'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-red-500" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setFormat('excel')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    format === 'excel'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setFormat('csv')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    format === 'csv'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                rows={5}
                disabled={isProcessing}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 text-slate-700 leading-relaxed"
              />
            </div>
          </form>
        )}

        {/* Loading Indicator Progress Notice */}
        {isProcessing && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-3 text-blue-800">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-semibold text-xs">
              {loadingStep === 'preparing' && 'Preparing report data...'}
              {loadingStep === 'generating' && `Generating ${format.toUpperCase()} financial attachment...`}
              {loadingStep === 'sending' && 'Sending email through mail server...'}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EmailReportModal;
