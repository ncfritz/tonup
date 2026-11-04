// Capture's photos are square (docs/plan/capture-lab.md › Capture flow): the viewfinder is a
// square the width of the screen showing the middle of the camera's frame, and the photo kept is
// that same square. The board then fills the labelling screens edge to edge, and the model's
// square input sees the photo undistorted.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Photo } from './visit';

/** The centred square of a width × height image, in its pixels. */
export function squareOf(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

/** Crops a photo to its centred square (upright, as the viewfinder showed it). */
export async function cropToSquare(uri: string): Promise<Photo> {
  // Rendered once first so the crop works on the upright pixels, whatever the EXIF orientation.
  const upright = await ImageManipulator.manipulate(uri).renderAsync();
  const square = await ImageManipulator.manipulate(upright)
    .crop(squareOf(upright.width, upright.height))
    .renderAsync();
  const saved = await square.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
