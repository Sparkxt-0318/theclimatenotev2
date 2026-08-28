/**
 * Google Drive access.
 *
 * A service account with the folder shared to it read-only. No OAuth consent
 * screen, no refresh tokens, no user in the loop — it keeps working without
 * anyone re-authorising it, which matters for something that must run every
 * week unattended.
 */

import { google, type drive_v3 } from 'googleapis';

import type { WorkerConfig } from '../config';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

export type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
};

export function createDriveClient(config: WorkerConfig): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    credentials: config.googleServiceAccount,
    // Read-only: the worker has no business modifying the editorial folder,
    // and a narrower scope limits what a leaked key could do.
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/** Every document in the watched folder, newest first. */
export async function listDocuments(drive: drive_v3.Drive, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = '${DOCX_MIME}' or mimeType = '${GOOGLE_DOC_MIME}')`,
      fields: 'nextPageToken, files(id, name, modifiedTime, mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
      // Required for folders in a shared drive; harmless otherwise.
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      if (!file.id || !file.name) continue;
      files.push({
        id: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime ?? new Date(0).toISOString(),
        mimeType: file.mimeType ?? DOCX_MIME,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * Downloads a document as .docx bytes.
 *
 * A native Google Doc is exported rather than downloaded, so an editor can work
 * in Docs or upload a Word file and the pipeline handles both identically.
 */
export async function downloadAsDocx(drive: drive_v3.Drive, file: DriveFile): Promise<Buffer> {
  const response =
    file.mimeType === GOOGLE_DOC_MIME
      ? await drive.files.export(
          // No supportsAllDrives here: files.export does not take it in Drive
          // v3 (unlike files.get below). Export reads converted content rather
          // than shared-drive metadata, so it works either way.
          { fileId: file.id, mimeType: DOCX_MIME },
          { responseType: 'arraybuffer' },
        )
      : await drive.files.get(
          { fileId: file.id, alt: 'media', supportsAllDrives: true },
          { responseType: 'arraybuffer' },
        );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Reads an issue number from a filename like "Issue 12 - Cows" or "012-cows".
 *
 * Returns null rather than guessing when there is nothing to read: a wrong
 * issue number collides with a real one through the unique constraint, which is
 * a far more confusing failure than simply having none.
 */
export function issueNumberFromName(name: string): number | null {
  const explicit = /(?:issue|no\.?|#)\s*(\d{1,4})/i.exec(name);
  if (explicit?.[1]) return Number.parseInt(explicit[1], 10);

  const leading = /^(\d{1,4})[\s._-]/.exec(name.trim());
  if (leading?.[1]) return Number.parseInt(leading[1], 10);

  return null;
}

/** URL-safe slug derived from the article title. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      // Strip combining diacritics left behind by the NFKD decomposition.
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'issue'
  );
}
