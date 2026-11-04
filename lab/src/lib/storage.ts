import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { dataDir } from './env';

export const photosDir = () => path.join(dataDir(), 'photos');
export const thumbsDir = () => path.join(dataDir(), 'thumbs');

export const THUMB_WIDTH = 480;

export interface PreparedPhoto {
  jpeg: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  /** Mean brightness 0–255. */
  brightness: number;
}

/**
 * Normalises an uploaded photo: applies its EXIF orientation to the pixels (labels are in the
 * orientation the phone showed, and PIL in training ignores EXIF), and makes a thumbnail for the
 * gallery and a brightness for coverage.
 */
export async function preparePhoto(input: Buffer): Promise<PreparedPhoto> {
  const upright = await sharp(input).rotate().jpeg({ quality: 92 }).toBuffer({
    resolveWithObject: true,
  });
  const thumb = await sharp(upright.data)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const stats = await sharp(upright.data).resize({ width: 256 }).greyscale().stats();
  return {
    jpeg: upright.data,
    thumb,
    width: upright.info.width,
    height: upright.info.height,
    brightness: stats.channels[0]?.mean ?? 0,
  };
}

export function savePhoto(name: string, photo: PreparedPhoto) {
  fs.mkdirSync(photosDir(), { recursive: true });
  fs.mkdirSync(thumbsDir(), { recursive: true });
  fs.writeFileSync(path.join(photosDir(), name), photo.jpeg);
  fs.writeFileSync(path.join(thumbsDir(), name), photo.thumb);
}

/** A stored file's path, refusing anything that isn't a plain file name. */
export function storedFile(kind: 'photo' | 'thumb', name: string): string | null {
  if (!/^[A-Za-z0-9._-]+\.jpg$/.test(name)) return null;
  const file = path.join(kind === 'photo' ? photosDir() : thumbsDir(), name);
  return fs.existsSync(file) ? file : null;
}
