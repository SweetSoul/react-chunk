import { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface FileQueue {
  [key: string]: any;
}

interface ChunkObj {
  id: string;
  index: number;
  data: Blob;
  size: number;
  started: boolean;
  isLastChunk: boolean;
}

interface Options {
  maxChunkSize?: number;
  maxVideoSize?: number;
  maxParallelConnections?: number;
  dataToAppendAtEnd?: { [key: string]: any };
  handleUploadProgress?: Function;
  service: Function;
}

/**
 * Hook to upload file in chunks
 * @param {Options} options Options used to determine chunk size, max video size and max parallel connections
 * @returns {Function} fileUpload Function to upload file
 */
export default function useChunks(options: Options) {
  const [progress, setProgress] = useState(0);

  const maxChunkSize = options.maxChunkSize || 5 * 1024 * 2;
  const maxVideoSize = parseInt('5000');
  const maxParallelConnections = options.maxParallelConnections || 5;

  const fileToBeUpload = useRef<File>();
  const fileSize = useRef<number>(0);
  const chunkCount = useRef<number>(0);
  const fileUID = useRef<string>();
  const uploadService = useRef<Function>();
  const progressHandler = useRef<Function>();
  const entityId = useRef<string>();
  const chunkStorage = useRef<ChunkObj[]>([]);
  const uploadSpots = useRef<Array<{ index: number } | null>>(new Array(maxParallelConnections).fill(null));
  const count = useRef(0);

  const getFileContext = (file: File) => {
    const _file = file;
    if (!_file) return;
    if (_file.size > maxVideoSize * 1024 * 1024) {
      return;
    }
    fileSize.current = _file.size;
    const _totalCount =
      _file.size % maxChunkSize === 0 ? _file.size / maxChunkSize : Math.floor(_file.size / maxChunkSize) + 1;
    chunkCount.current = _totalCount;
    fileToBeUpload.current = _file;
    const _uuid = uuidv4();
    fileUID.current = _uuid;
    chunkStorage.current = new Array(_totalCount).fill(null);
    chunkStorage.current.forEach((_, index) => {
      const _begin = index * maxChunkSize;
      const _end = _begin + maxChunkSize;
      const _chunk = _file.slice(_begin, _end);
      const _size = _chunk.size;
      chunkStorage.current[index] = {
        id: _uuid,
        index: index + 1,
        data: _chunk,
        size: _size,
        started: false,
        isLastChunk: index === _totalCount - 1,
      };
    });
  };

  const setupRefs = (options: FileQueue) => {
    uploadService.current = options.service;
    progressHandler.current = options.handleUploadProgress;
  };

  const fileUpload = (options?: FileQueue, id?: string) => {
    if (!uploadService.current && options) setupRefs(options);
    if (!entityId.current && id) entityId.current = id;
    const chunkObj = chunkStorage.current.find((c) => !c?.started && c?.index === count.current + 1);
    if (!chunkObj) return;
    if (chunkObj.isLastChunk && !uploadSpots.current.every((spot) => spot === null)) return;
    uploadChunk(chunkObj);
  };

  const uploadChunk = async (chunkObj: ChunkObj) => {
    try {
      const spotIndex = await uploadSpots.current.findIndex((spot) => spot === null);
      uploadSpots.current[spotIndex] = await { index: chunkObj.index };
      chunkStorage.current[chunkObj.index - 1].started = true;
      count.current++;
      if (uploadSpots.current.some((spot) => spot === null)) {
        fileUpload();
      }
      const formData = new FormData();
      if (fileUID.current) formData.append('dzuuid', fileUID.current);
      formData.append('dzchunkindex', chunkObj.index.toString());
      formData.append('dztotalfilesize', fileSize.current.toString());
      formData.append('dzchunksize', chunkObj.size.toString());
      formData.append('dztotalchunkcount', chunkCount.current.toString());
      formData.append('dzchunkbyteoffset', (chunkObj.index * maxChunkSize).toString());
      if (fileToBeUpload.current?.name)
        formData.append('file_extension', fileToBeUpload.current.name.split('.').pop()!);
      if (fileToBeUpload.current?.type) formData.append('mime_type', fileToBeUpload.current.type);
      if (chunkObj.isLastChunk) {
      }
      formData.append('video', chunkObj.data);
      if (!uploadService.current) return;
      const response = await uploadService.current(formData, entityId.current!);
      if (response.status === 200) {
        if (chunkObj.isLastChunk) {
          await uploadCompleted();
        } else {
          const _percentage = Math.round((chunkObj.size * 100) / fileSize.current);
          setProgress((curr) => {
            let _new = curr + _percentage < 100 ? curr + _percentage : 100;
            progressHandler.current?.(_new);
            return _new;
          });
          const nullIndex = await uploadSpots.current.findIndex((spot) => spot?.index === chunkObj.index);
          uploadSpots.current[nullIndex] = await null;
          if (chunkObj.index < chunkCount.current - 1) {
            fileUpload();
          }
          if (uploadSpots.current.every((spot) => spot === null) && chunkObj.index === chunkCount.current - 1) {
            fileUpload();
          }
        }
      }
    } catch (error: any) {}
  };

  const uploadCompleted = async () => {
    setProgress(100);
    progressHandler.current?.(100);
    uploadService.current = undefined;
    progressHandler.current = undefined;
    entityId.current = undefined;
    chunkStorage.current = [];
    uploadSpots.current = new Array(maxParallelConnections).fill(null);
    fileToBeUpload.current = undefined;
    fileUID.current = undefined;
    fileSize.current = 0;
    chunkCount.current = 0;
  };

  return { progress, getFileContext, file: fileToBeUpload, triggerUpload: fileUpload };
}
