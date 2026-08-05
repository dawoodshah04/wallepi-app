import { Paths, File, Directory } from "expo-file-system";

const CACHE_LIMIT_BYTES = 50 * 1024 * 1024; // 50MB

export async function enforceCacheLimit(): Promise<void> {
  try {
    const documentDir = Paths.document;
    const contents = documentDir.list();

    // Gather all wallpaper image files in the documents directory
    const files: File[] = [];
    let totalSize = 0;

    for (const item of contents) {
      if (item instanceof File && /\.(jpe?g|png|webp)$/i.test(item.name)) {
        files.push(item);
        totalSize += item.size;
      }
    }

    // Enforce the 50MB download cache limit asynchronously
    if (totalSize <= CACHE_LIMIT_BYTES) {
      return;
    }

    // Sort files by modification time (oldest first)
    files.sort((a, b) => {
      const timeA = a.lastModified ?? 0;
      const timeB = b.lastModified ?? 0;
      return timeA - timeB;
    });

    // Delete oldest files until we are under the limit
    for (const file of files) {
      if (totalSize <= CACHE_LIMIT_BYTES) {
        break;
      }
      const fileSize = file.size;
      try {
        file.delete();
        totalSize -= fileSize;
      } catch {
        // Silently fail if file is locked or in use
      }
    }
  } catch {
    // Suppress file system errors
  }
}
