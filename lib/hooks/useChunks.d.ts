export interface FileQueue {
    title: string;
    categories: string[];
    tags: string[];
    thumbnail: File;
    handleUploadProgress: Function;
    service: any;
    description: string;
    duration: string;
}
interface Options {
    maxChunkSize?: number;
    maxVideoSize?: number;
    maxParallelConnections?: number;
}
/**
 * Hook to upload file in chunks
 * @param {Options} options Options used to determine chunk size, max video size and max parallel connections
 * @returns {Function} fileUpload Function to upload file
 */
export default function useChunks(options: Options): {
    progress: any;
    getFileContext: (file: File) => void;
    file: any;
    triggerUpload: (options?: any, id?: string) => void;
};
export {};
