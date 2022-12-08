"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const uuid_1 = require("uuid");
/**
 * Hook to upload file in chunks
 * @param {Options} options Options used to determine chunk size, max video size and max parallel connections
 * @returns {Function} fileUpload Function to upload file
 */
function useChunks(options) {
    const [progress, setProgress] = (0, react_1.useState)(0);
    const maxChunkSize = options.maxChunkSize || 5 * 1024 * 2;
    const maxVideoSize = parseInt("5000");
    const maxParallelConnections = parseInt( || "3");
    const fileToBeUpload = (0, react_1.useRef)();
    const fileSize = (0, react_1.useRef)(0);
    const chunkCount = (0, react_1.useRef)(0);
    const fileUID = (0, react_1.useRef)();
    const titleData = (0, react_1.useRef)();
    const categoriesData = (0, react_1.useRef)();
    const tagsData = (0, react_1.useRef)();
    const descriptionData = (0, react_1.useRef)();
    const durationData = (0, react_1.useRef)();
    const thumbnailData = (0, react_1.useRef)();
    const uploadService = (0, react_1.useRef)();
    const progressHandler = (0, react_1.useRef)();
    const entityId = (0, react_1.useRef)();
    const chunkStorage = (0, react_1.useRef)([]);
    const uploadSpots = (0, react_1.useRef)(new Array(maxParallelConnections).fill(null));
    const count = (0, react_1.useRef)(0);
    const getFileContext = (file) => {
        const _file = file;
        if (!_file)
            return;
        if (_file.size > maxVideoSize * 1024 * 1024) {
            notify("File size is too large", "Error");
            return;
        }
        fileSize.current = _file.size;
        const _totalCount = _file.size % maxChunkSize === 0 ? _file.size / maxChunkSize : Math.floor(_file.size / maxChunkSize) + 1;
        chunkCount.current = _totalCount;
        fileToBeUpload.current = _file;
        const _uuid = (0, uuid_1.v4)();
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
    const setupRefs = (options) => {
        titleData.current = options.title;
        categoriesData.current = options.categories;
        tagsData.current = options.tags;
        thumbnailData.current = options.thumbnail;
        uploadService.current = options.service;
        descriptionData.current = options.description;
        durationData.current = options.duration;
        progressHandler.current = options.handleUploadProgress;
    };
    const fileUpload = (options, id) => {
        if (!titleData.current && options)
            setupRefs(options);
        if (!entityId.current && id)
            entityId.current = id;
        const chunkObj = chunkStorage.current.find(c => !(c === null || c === void 0 ? void 0 : c.started) && (c === null || c === void 0 ? void 0 : c.index) === count.current + 1);
        if (!chunkObj)
            return;
        if (chunkObj.isLastChunk && !uploadSpots.current.every(spot => spot === null))
            return;
        uploadChunk(chunkObj);
    };
    const uploadChunk = (chunkObj) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const spotIndex = yield uploadSpots.current.findIndex(spot => spot === null);
            uploadSpots.current[spotIndex] = yield { index: chunkObj.index };
            chunkStorage.current[chunkObj.index - 1].started = true;
            count.current++;
            if (uploadSpots.current.some(spot => spot === null)) {
                fileUpload();
            }
            const formData = new FormData();
            if (fileUID.current)
                formData.append("dzuuid", fileUID.current);
            formData.append("dzchunkindex", chunkObj.index.toString());
            formData.append("dztotalfilesize", fileSize.current.toString());
            formData.append("dzchunksize", chunkObj.size.toString());
            formData.append("dztotalchunkcount", chunkCount.current.toString());
            formData.append("dzchunkbyteoffset", (chunkObj.index * maxChunkSize).toString());
            if ((_a = fileToBeUpload.current) === null || _a === void 0 ? void 0 : _a.name)
                formData.append("file_extension", fileToBeUpload.current.name.split(".").pop());
            if ((_b = fileToBeUpload.current) === null || _b === void 0 ? void 0 : _b.type)
                formData.append("mime_type", fileToBeUpload.current.type);
            if (chunkObj.isLastChunk) {
                if (titleData.current)
                    formData.append("title", titleData.current);
                if (durationData.current)
                    formData.append("duration", durationData.current);
                if (descriptionData.current)
                    formData.append("description", descriptionData.current);
                if ((_c = categoriesData.current) === null || _c === void 0 ? void 0 : _c.length)
                    categoriesData.current.forEach(c => formData.append("categories[]", c));
                if ((_d = tagsData.current) === null || _d === void 0 ? void 0 : _d.length)
                    tagsData.current.forEach(t => formData.append("tags[]", t));
                if (thumbnailData.current)
                    formData.append("thumbnail", thumbnailData.current);
            }
            formData.append("video", chunkObj.data);
            if (!uploadService.current)
                return;
            const response = yield uploadService.current(formData, entityId.current);
            if (response.status === 200) {
                if (chunkObj.isLastChunk) {
                    yield uploadCompleted();
                }
                else {
                    const _percentage = Math.round((chunkObj.size * 100) / fileSize.current);
                    setProgress(curr => {
                        var _a;
                        let _new = curr + _percentage < 100 ? curr + _percentage : 100;
                        (_a = progressHandler.current) === null || _a === void 0 ? void 0 : _a.call(progressHandler, _new);
                        return _new;
                    });
                    const nullIndex = yield uploadSpots.current.findIndex(spot => (spot === null || spot === void 0 ? void 0 : spot.index) === chunkObj.index);
                    uploadSpots.current[nullIndex] = yield null;
                    if (chunkObj.index < chunkCount.current - 1) {
                        fileUpload();
                    }
                    if (uploadSpots.current.every(spot => spot === null) && chunkObj.index === chunkCount.current - 1) {
                        fileUpload();
                    }
                }
            }
        }
        catch (error) {
            notify(getErrorFromArray(error), "Error");
        }
    });
    const uploadCompleted = () => __awaiter(this, void 0, void 0, function* () {
        var _e;
        setProgress(100);
        (_e = progressHandler.current) === null || _e === void 0 ? void 0 : _e.call(progressHandler, 100);
        titleData.current = undefined;
        categoriesData.current = undefined;
        tagsData.current = undefined;
        thumbnailData.current = undefined;
        uploadService.current = undefined;
        progressHandler.current = undefined;
        descriptionData.current = undefined;
        durationData.current = undefined;
        entityId.current = undefined;
        chunkStorage.current = [];
        uploadSpots.current = new Array(maxParallelConnections).fill(null);
        fileToBeUpload.current = undefined;
        fileUID.current = undefined;
        fileSize.current = 0;
        chunkCount.current = 0;
    });
    return { progress, getFileContext, file: fileToBeUpload, triggerUpload: fileUpload };
}
exports.default = useChunks;
