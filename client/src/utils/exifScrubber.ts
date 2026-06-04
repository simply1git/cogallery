export async function scrubExif(file: File): Promise<File> {
  // Only process JPEG images. HEIC/PNG/Video require different parsers.
  if (file.type !== 'image/jpeg') {
    return file;
  }

  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);
  
  // Check valid JPEG magic number
  if (dataView.getUint16(0) !== 0xFFD8) {
    return file;
  }

  let offset = 2;
  const chunks: Uint8Array[] = [];
  let lastOffset = 0;

  while (offset < dataView.byteLength) {
    const marker = dataView.getUint16(offset);
    
    // Stop if we hit Start of Scan (SOS)
    if (marker === 0xFFDA) {
      break;
    }

    // Is it an APP1 (Exif) marker?
    if (marker === 0xFFE1) {
      // Find length of segment
      const length = dataView.getUint16(offset + 2);
      
      // Save everything up to this marker
      chunks.push(new Uint8Array(buffer, lastOffset, offset - lastOffset));
      
      // Skip the APP1 segment
      offset += 2 + length;
      lastOffset = offset;
    } else {
      // Find length of this non-APP1 segment
      const length = dataView.getUint16(offset + 2);
      offset += 2 + length;
    }
  }

  // If no APP1 was found/removed, just return the original file
  if (chunks.length === 0) {
    return file;
  }

  // Add the remaining part of the file (from lastOffset to end)
  chunks.push(new Uint8Array(buffer, lastOffset));

  // Assemble the new blob
  const cleanBlob = new Blob(chunks, { type: file.type });
  
  // Create a new File object with the same name and dates
  return new File([cleanBlob], file.name, {
    type: file.type,
    lastModified: file.lastModified
  });
}
