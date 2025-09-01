/**
 * Google Drive API client extension
 * Provides Google Drive specific functionality using OAuth authentication
 */

import type { GoogleApiClient } from './google-client.js';

// Google Drive API types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export class GoogleDriveAPI {
  private client: GoogleApiClient;

  constructor(client: GoogleApiClient) {
    this.client = client;
  }

  /**
   * Search for files in Google Drive
   */
  async searchFiles(userId: string, query: string, pageSize: number = 10): Promise<DriveFile[]> {
    const params = new URLSearchParams({
      q: query,
      pageSize: pageSize.toString(),
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)'
    });
    
    const response = await this.client.authenticatedFetch(
      userId,
      `https://www.googleapis.com/drive/v3/files?${params}`
    );
    
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as { files?: DriveFile[] };
    return data.files || [];
  }

  /**
   * Get file content
   */
  async getFile(userId: string, fileId: string): Promise<string> {
    const response = await this.client.authenticatedFetch(
      userId,
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.status}`);
    }
    
    return response.text();
  }

  /**
   * Create a new file
   */
  async createFile(userId: string, name: string, content: string, parentId?: string): Promise<DriveFile> {
    const metadata: any = { name };
    if (parentId) {
      metadata.parents = [parentId];
    }
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('media', new Blob([content], { type: 'text/plain' }));
    
    const response = await this.client.authenticatedFetch(
      userId,
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        body: form,
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Update file content
   */
  async updateFile(userId: string, fileId: string, content: string): Promise<void> {
    const response = await this.client.authenticatedFetch(
      userId,
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: content,
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Create a folder
   */
  async createFolder(userId: string, name: string, parentId?: string): Promise<DriveFile> {
    const metadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) {
      metadata.parents = [parentId];
    }
    
    const response = await this.client.authenticatedFetch(
      userId,
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Share a file with a user
   */
  async shareFile(userId: string, fileId: string, email: string, role: 'reader' | 'writer' | 'commenter' = 'reader'): Promise<void> {
    const permission = {
      type: 'user',
      role,
      emailAddress: email
    };
    
    const response = await this.client.authenticatedFetch(
      userId,
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permission),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to share file: ${response.status}`);
    }
  }

  /**
   * Export a Google Workspace file to a different format
   */
  async exportFile(userId: string, fileId: string, mimeType: string): Promise<string> {
    const response = await this.client.authenticatedFetch(
      userId,
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to export file: ${response.status}`);
    }
    
    return response.text();
  }
}