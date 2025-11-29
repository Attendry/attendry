/**
 * GDPR Compliance Service
 * Handles consent management, data export, and audit logging
 */

import { supabaseServer } from '@/lib/supabase-server';

export interface ConsentStatus {
  autoSaveConsent: boolean;
  autoSaveConsentDate: string | null;
  autoSaveConsentVersion: string | null;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedDate: string | null;
  privacyPolicyVersion: string | null;
}

export interface DataExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  requestedAt: string;
  completedAt: string | null;
  fileUrl: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
}

/**
 * Get user's consent status
 */
export async function getConsentStatus(userId: string): Promise<ConsentStatus | null> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('user_discovery_profiles')
    .select('auto_save_consent, auto_save_consent_date, auto_save_consent_version, privacy_policy_accepted, privacy_policy_accepted_date, privacy_policy_version')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    autoSaveConsent: data.auto_save_consent ?? false,
    autoSaveConsentDate: data.auto_save_consent_date,
    autoSaveConsentVersion: data.auto_save_consent_version,
    privacyPolicyAccepted: data.privacy_policy_accepted ?? false,
    privacyPolicyAcceptedDate: data.privacy_policy_accepted_date,
    privacyPolicyVersion: data.privacy_policy_version,
  };
}

/**
 * Update user's consent status
 */
export async function updateConsentStatus(
  userId: string,
  updates: Partial<ConsentStatus>,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const supabase = await supabaseServer();
  
  const updateData: Record<string, any> = {};
  
  if (updates.autoSaveConsent !== undefined) {
    updateData.auto_save_consent = updates.autoSaveConsent;
    if (updates.autoSaveConsent) {
      updateData.auto_save_consent_date = new Date().toISOString();
      updateData.auto_save_consent_version = '1.0'; // Current version
    }
  }
  
  if (updates.privacyPolicyAccepted !== undefined) {
    updateData.privacy_policy_accepted = updates.privacyPolicyAccepted;
    if (updates.privacyPolicyAccepted) {
      updateData.privacy_policy_accepted_date = new Date().toISOString();
      updateData.privacy_policy_version = '1.0'; // Current version
    }
  }

  const { error } = await supabase
    .from('user_discovery_profiles')
    .update(updateData)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating consent status:', error);
    return false;
  }

  // Log consent change
  await logDataAccess(
    userId,
    updates.autoSaveConsent !== undefined 
      ? (updates.autoSaveConsent ? 'consent_given' : 'consent_withdrawn')
      : 'consent_updated',
    'profile',
    null,
    { updates },
    ipAddress,
    userAgent
  );

  return true;
}

/**
 * Log data access for GDPR audit trail
 */
export async function logDataAccess(
  userId: string,
  action: 'view' | 'export' | 'delete' | 'consent_given' | 'consent_withdrawn' | 'consent_updated',
  resourceType: 'contact' | 'profile' | 'research' | 'all',
  resourceId: string | null = null,
  details: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  const supabase = await supabaseServer();
  
  // Use direct insert instead of RPC for better error handling
  const { data, error } = await supabase
    .from('data_access_audit_log')
    .insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error logging data access:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Soft delete a contact (GDPR compliant)
 */
export async function deleteContact(
  userId: string,
  contactId: string,
  reason: string = 'user_request',
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const supabase = await supabaseServer();
  
  // Soft delete: update contact to mark as deleted
  const { error: updateError } = await supabase
    .from('saved_speaker_profiles')
    .update({
      deleted_at: new Date().toISOString(),
      deletion_reason: reason,
      archived: true,
      monitor_updates: false,
    })
    .eq('id', contactId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error deleting contact:', updateError);
    return false;
  }

  // Log the deletion
  await logDataAccess(
    userId,
    'delete',
    'contact',
    contactId,
    { reason, deleted_at: new Date().toISOString() },
    ipAddress,
    userAgent
  );

  return true;
}

/**
 * Get user's data summary for export
 */
export async function getUserDataSummary(userId: string): Promise<Record<string, any> | null> {
  const supabase = await supabaseServer();
  
  // Get counts from each table
  const [contactsResult, archivedResult, deletedResult, researchResult, eventsResult] = await Promise.all([
    supabase
      .from('saved_speaker_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('saved_speaker_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('archived', true)
      .is('deleted_at', null),
    supabase
      .from('saved_speaker_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('deleted_at', 'is', null),
    supabase
      .from('contact_research')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('collected_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  return {
    contacts: contactsResult.count || 0,
    archived_contacts: archivedResult.count || 0,
    deleted_contacts: deletedResult.count || 0,
    research_records: researchResult.count || 0,
    events: eventsResult.count || 0,
    exported_at: new Date().toISOString(),
  };
}

/**
 * Export user's data
 */
export async function exportUserData(
  userId: string,
  format: 'json' | 'csv' = 'json'
): Promise<DataExportRequest | null> {
  const supabase = await supabaseServer();
  
  // Create export request
  const { data: request, error: requestError } = await supabase
    .from('data_export_requests')
    .insert({
      user_id: userId,
      status: 'pending',
      format,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single();

  if (requestError || !request) {
    console.error('Error creating export request:', requestError);
    return null;
  }

  // Log export request
  await logDataAccess(userId, 'export', 'all', null, { format, requestId: request.id });

  // In a production environment, you would trigger a background job here
  // For now, we'll process it synchronously
  try {
    await processDataExport(request.id, userId, format);
  } catch (error) {
    console.error('Error processing export:', error);
    // Update request status to failed
    await supabase
      .from('data_export_requests')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', request.id);
  }

  return {
    id: request.id,
    status: request.status,
    format: request.format,
    requestedAt: request.requested_at,
    completedAt: request.completed_at,
    fileUrl: request.file_url,
    expiresAt: request.expires_at,
    errorMessage: request.error_message,
  };
}

/**
 * Process data export (internal function)
 */
async function processDataExport(
  requestId: string,
  userId: string,
  format: 'json' | 'csv'
): Promise<void> {
  const supabase = await supabaseServer();
  
  // Update status to processing
  await supabase
    .from('data_export_requests')
    .update({ status: 'processing' })
    .eq('id', requestId);

  // Fetch all user data
  const [contacts, research, events] = await Promise.all([
    supabase
      .from('saved_speaker_profiles')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('contact_research')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('collected_events')
      .select('*')
      .eq('user_id', userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    contacts: contacts.data || [],
    research: research.data || [],
    events: events.data || [],
  };

  // Convert to requested format
  let fileContent: string;
  let fileName: string;
  let contentType: string;

  if (format === 'json') {
    fileContent = JSON.stringify(exportData, null, 2);
    fileName = `user-data-export-${userId}-${Date.now()}.json`;
    contentType = 'application/json';
  } else {
    // CSV format (simplified - would need proper CSV library in production)
    fileContent = convertToCSV(exportData);
    fileName = `user-data-export-${userId}-${Date.now()}.csv`;
    contentType = 'text/csv';
  }

  // Store file URL (generated on-demand when downloaded)
  const fileUrl = `/api/gdpr/export/${requestId}/download`;

  // Update request with completion
  await supabase
    .from('data_export_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      file_url: fileUrl,
    })
    .eq('id', requestId);

  // Store file content temporarily (in production, use Supabase Storage)
  // For now, we'll need to implement a download endpoint that generates the file on-demand
}

/**
 * Convert data to CSV (simplified)
 */
function convertToCSV(data: any): string {
  // This is a simplified CSV conversion
  // In production, use a proper CSV library
  const lines: string[] = [];
  
  // Add header
  lines.push('Type,ID,Data');
  
  // Add contacts
  if (data.contacts) {
    data.contacts.forEach((contact: any) => {
      lines.push(`Contact,${contact.id},"${JSON.stringify(contact).replace(/"/g, '""')}"`);
    });
  }
  
  // Add research
  if (data.research) {
    data.research.forEach((r: any) => {
      lines.push(`Research,${r.id},"${JSON.stringify(r).replace(/"/g, '""')}"`);
    });
  }
  
  // Add events
  if (data.events) {
    data.events.forEach((event: any) => {
      lines.push(`Event,${event.id},"${JSON.stringify(event).replace(/"/g, '""')}"`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Get export request status
 */
export async function getExportRequest(
  userId: string,
  requestId: string
): Promise<DataExportRequest | null> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('data_export_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    format: data.format,
    requestedAt: data.requested_at,
    completedAt: data.completed_at,
    fileUrl: data.file_url,
    expiresAt: data.expires_at,
    errorMessage: data.error_message,
  };
}

/**
 * Get user's audit log
 */
export async function getAuditLog(
  userId: string,
  limit: number = 100
): Promise<any[]> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('data_access_audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching audit log:', error);
    return [];
  }

  return data || [];
}

