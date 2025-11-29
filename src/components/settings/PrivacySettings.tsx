"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Shield, 
  Download, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Eye,
  Clock
} from 'lucide-react';

interface ConsentStatus {
  autoSaveConsent: boolean;
  autoSaveConsentDate: string | null;
  autoSaveConsentVersion: string | null;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedDate: string | null;
  privacyPolicyVersion: string | null;
}

interface DataExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  requestedAt: string;
  completedAt: string | null;
  fileUrl: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  created_at: string;
}

export function PrivacySettings() {
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportRequest, setExportRequest] = useState<DataExportRequest | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load consent status
  useEffect(() => {
    loadConsentStatus();
  }, []);

  const loadConsentStatus = async () => {
    try {
      const response = await fetch('/api/gdpr/consent');
      const data = await response.json();
      
      if (data.success) {
        setConsent(data.consent);
      }
    } catch (error) {
      console.error('Error loading consent status:', error);
      toast.error('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = async (field: 'autoSaveConsent' | 'privacyPolicyAccepted', value: boolean) => {
    setSaving(true);
    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: value,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConsent(data.consent);
        toast.success(
          field === 'autoSaveConsent' 
            ? (value ? 'Auto-save consent enabled' : 'Auto-save consent withdrawn')
            : (value ? 'Privacy policy accepted' : 'Privacy policy acceptance withdrawn')
        );
      } else {
        toast.error(data.error || 'Failed to update consent');
      }
    } catch (error) {
      console.error('Error updating consent:', error);
      toast.error('Failed to update consent');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    setExportLoading(true);
    try {
      const response = await fetch('/api/gdpr/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      const data = await response.json();

      if (data.success) {
        setExportRequest(data.export);
        toast.success('Data export requested. Processing...');
        
        // Poll for completion
        if (data.export.status === 'pending' || data.export.status === 'processing') {
          pollExportStatus(data.export.id);
        }
      } else {
        toast.error(data.error || 'Failed to request data export');
      }
    } catch (error) {
      console.error('Error requesting export:', error);
      toast.error('Failed to request data export');
    } finally {
      setExportLoading(false);
    }
  };

  const pollExportStatus = async (requestId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.error('Export request timed out');
        return;
      }

      try {
        const response = await fetch(`/api/gdpr/export?requestId=${requestId}`);
        const data = await response.json();

        if (data.success && data.export) {
          setExportRequest(data.export);

          if (data.export.status === 'completed') {
            toast.success('Data export completed!');
            if (data.export.fileUrl) {
              // In production, this would download the file
              window.open(data.export.fileUrl, '_blank');
            }
          } else if (data.export.status === 'failed') {
            toast.error(data.export.errorMessage || 'Export failed');
          } else {
            // Still processing, poll again
            setTimeout(poll, 2000);
            attempts++;
          }
        }
      } catch (error) {
        console.error('Error polling export status:', error);
        setTimeout(poll, 2000);
        attempts++;
      }
    };

    poll();
  };

  const loadAuditLog = async () => {
    setAuditLoading(true);
    try {
      const response = await fetch('/api/gdpr/audit-log?limit=50');
      const data = await response.json();

      if (data.success) {
        setAuditLog(data.auditLog);
      }
    } catch (error) {
      console.error('Error loading audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setAuditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Privacy & GDPR Compliance
        </h2>
        <p className="text-gray-600 mt-1">
          Manage your data privacy settings and GDPR rights
        </p>
      </div>

      {/* Consent Management */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Consent Management</h3>
        
        <div className="space-y-4">
          {/* Auto-Save Consent */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">Auto-Save Consent</h4>
                {consent?.autoSaveConsent && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Allow Attendry to automatically save relevant speakers as contacts when discovered at events.
              </p>
              {consent?.autoSaveConsentDate && (
                <p className="text-xs text-gray-500">
                  Consent given: {new Date(consent.autoSaveConsentDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consent?.autoSaveConsent || false}
                onChange={(e) => handleConsentChange('autoSaveConsent', e.target.checked)}
                disabled={saving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Privacy Policy */}
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium">Privacy Policy</h4>
                {consent?.privacyPolicyAccepted && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                I have read and accept the privacy policy.
              </p>
              {consent?.privacyPolicyAcceptedDate && (
                <p className="text-xs text-gray-500">
                  Accepted: {new Date(consent.privacyPolicyAcceptedDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consent?.privacyPolicyAccepted || false}
                onChange={(e) => handleConsentChange('privacyPolicyAccepted', e.target.checked)}
                disabled={saving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Download className="w-5 h-5" />
              Data Export
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Request a copy of all your data (GDPR Right to Access)
            </p>
          </div>
        </div>

        {exportRequest && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Export Status: {exportRequest.status}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Requested: {new Date(exportRequest.requestedAt).toLocaleString()}
                </p>
              </div>
              {exportRequest.status === 'completed' && exportRequest.fileUrl && (
                <a
                  href={exportRequest.fileUrl}
                  download
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Download
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleExportData('json')}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export as JSON
          </button>
          <button
            onClick={() => handleExportData('csv')}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export as CSV
          </button>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Data Access Audit Log
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              View a log of all data access, deletions, and consent changes
            </p>
          </div>
          <button
            onClick={loadAuditLog}
            disabled={auditLoading}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {auditLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {auditLog.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="p-3 border border-gray-200 rounded-lg text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-600">
                  <span className="capitalize">{entry.resource_type}</span>
                  {entry.resource_id && (
                    <span className="text-gray-400"> • ID: {entry.resource_id.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No audit log entries yet. Data access will be logged here.
          </p>
        )}
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Your GDPR Rights</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li><strong>Right to Access:</strong> Request a copy of all your data</li>
              <li><strong>Right to Deletion:</strong> Delete contacts and data (Right to be Forgotten)</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
              <li><strong>Right to Data Portability:</strong> Export your data in machine-readable format</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

