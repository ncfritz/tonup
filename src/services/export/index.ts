import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * File plumbing for export and import, as in Tippytoe: files go out through the share sheet
 * (Files, AirDrop, a NAS in Files) and come in through the document picker. The app uploads
 * nothing (ADR 0001).
 */

export interface FileKind {
  mimeType: string;
  /** iOS uniform type identifier, so the share sheet offers the right apps. */
  uti: string;
}

/** Writes `contents` to the cache folder as `name` and opens the share sheet for it. */
export async function shareTextFile(name: string, contents: string, kind: FileKind) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  try {
    await Sharing.shareAsync(file.uri, { UTI: kind.uti, mimeType: kind.mimeType });
  } finally {
    try {
      file.delete();
    } catch {
      /* best effort */
    }
  }
}

export type PickedFile = { text: string; size: number } | 'canceled' | 'tooBig';

/** Lets the user choose a file in Files and reads it as text. */
export async function pickTextFile(mimeTypes: string[], maxBytes: number): Promise<PickedFile> {
  const result = await DocumentPicker.getDocumentAsync({
    type: mimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return 'canceled';
  const file = new File(result.assets[0].uri);
  try {
    const size = file.size ?? result.assets[0].size ?? 0;
    if (size > maxBytes) return 'tooBig';
    return { text: await file.text(), size };
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      /* best effort */
    }
  }
}
