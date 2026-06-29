import RNFS from 'react-native-fs';
import DeviceInfo from 'react-native-device-info';
import { DEV_FORCE_MODEL } from '../config';
import {
  FALLBACK_MODEL,
  PRIMARY_MODEL,
  type ModelSpec,
} from './modelRegistry';

export type DownloadProgress = {
  /** 0..1 fraction complete. */
  fraction: number;
  bytesWritten: number;
  totalBytes: number;
};

/**
 * Selects, downloads, and caches the on-device model.
 *
 * Selection is RAM-based: the 8B model is only chosen on devices with enough
 * total memory to hold it without being OOM-killed; everything else falls back
 * to the 3B model.
 */
export const ModelManager = {
  /** Local cache path for a model's GGUF file. */
  getLocalPath(model: ModelSpec): string {
    return `${RNFS.DocumentDirectoryPath}/${model.fileName}`;
  },

  /** Temp path a download is streamed to before being atomically renamed. */
  getPartPath(model: ModelSpec): string {
    return `${this.getLocalPath(model)}.part`;
  },

  /**
   * True if the model is already fully downloaded.
   *
   * A complete file only ever appears at the final path after a successful
   * download is renamed from its `.part` temp file, so an interrupted download
   * can never be mistaken for a complete one. We still size-check against the
   * exact expected byte count as a defensive guard.
   */
  async isDownloaded(model: ModelSpec): Promise<boolean> {
    const path = this.getLocalPath(model);
    if (!(await RNFS.exists(path))) {
      return false;
    }
    const stat = await RNFS.stat(path);
    return Number(stat.size) >= model.sizeBytes;
  },

  /**
   * Pick the best model for this device based on total RAM. Returns the spec
   * and whether the fallback was used (so the UI can explain the choice).
   */
  async pickModel(): Promise<{ model: ModelSpec; usedFallback: boolean }> {
    // Dev override: force a model regardless of device RAM.
    if (DEV_FORCE_MODEL === 'fallback') {
      return { model: FALLBACK_MODEL, usedFallback: true };
    }
    if (DEV_FORCE_MODEL === 'primary') {
      return { model: PRIMARY_MODEL, usedFallback: false };
    }

    const totalRam = await DeviceInfo.getTotalMemory();
    if (totalRam >= PRIMARY_MODEL.minRamBytes) {
      return { model: PRIMARY_MODEL, usedFallback: false };
    }
    return { model: FALLBACK_MODEL, usedFallback: true };
  },

  /**
   * Ensure the model is present locally, downloading it if needed.
   * Reports progress via the callback. Throws on insufficient storage or a
   * failed download.
   */
  async ensureDownloaded(
    model: ModelSpec,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<string> {
    const path = this.getLocalPath(model);
    const partPath = this.getPartPath(model);

    if (await this.isDownloaded(model)) {
      return path;
    }

    // Discard any leftovers: a truncated final file from an older build, or a
    // half-written .part from a previous interrupted attempt.
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
    if (await RNFS.exists(partPath)) {
      await RNFS.unlink(partPath);
    }

    // Make sure there's room (model size + a small margin).
    const fsInfo = await RNFS.getFSInfo();
    if (fsInfo.freeSpace < model.sizeBytes * 1.05) {
      throw new Error(
        `Not enough free storage for ${model.name}. ` +
          `Need ~${Math.ceil(model.sizeBytes / 1e9)}GB free.`,
      );
    }

    // Download to a temp .part file; only promote it to the final path once the
    // transfer completes successfully, so the cache never holds a partial file.
    const { promise } = RNFS.downloadFile({
      fromUrl: model.url,
      toFile: partPath,
      background: true,
      discretionary: true,
      progressInterval: 500,
      progress: res => {
        const total = res.contentLength > 0 ? res.contentLength : model.sizeBytes;
        onProgress?.({
          fraction: total > 0 ? res.bytesWritten / total : 0,
          bytesWritten: res.bytesWritten,
          totalBytes: total,
        });
      },
    });

    const result = await promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      if (await RNFS.exists(partPath)) {
        await RNFS.unlink(partPath);
      }
      throw new Error(
        `Download failed for ${model.name} (HTTP ${result.statusCode}).`,
      );
    }

    await RNFS.moveFile(partPath, path);
    return path;
  },
};
