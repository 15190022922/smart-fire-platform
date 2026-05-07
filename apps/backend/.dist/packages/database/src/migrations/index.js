"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseMigrations = void 0;
const _0001_initial_schema_1 = require("./0001-initial-schema");
const _0002_drawing_file_metadata_1 = require("./0002-drawing-file-metadata");
const _0003_drawing_processing_state_1 = require("./0003-drawing-processing-state");
const _0004_spatial_area_structure_1 = require("./0004-spatial-area-structure");
const _0005_device_custom_attributes_1 = require("./0005-device-custom-attributes");
const _0006_device_lifecycle_1 = require("./0006-device-lifecycle");
const _0007_platform_notices_1 = require("./0007-platform-notices");
const _0008_platform_notice_attachments_1 = require("./0008-platform-notice-attachments");
const _0009_platform_notice_inbox_model_1 = require("./0009-platform-notice-inbox-model");
const _0010_platform_notice_drafts_1 = require("./0010-platform-notice-drafts");
exports.databaseMigrations = [
    _0001_initial_schema_1.initialSchemaMigration,
    _0002_drawing_file_metadata_1.drawingFileMetadataMigration,
    _0003_drawing_processing_state_1.drawingProcessingStateMigration,
    _0004_spatial_area_structure_1.spatialAreaStructureMigration,
    _0005_device_custom_attributes_1.deviceCustomAttributesMigration,
    _0006_device_lifecycle_1.deviceLifecycleMigration,
    _0007_platform_notices_1.platformNoticesMigration,
    _0008_platform_notice_attachments_1.platformNoticeAttachmentsMigration,
    _0009_platform_notice_inbox_model_1.platformNoticeInboxModelMigration,
    _0010_platform_notice_drafts_1.platformNoticeDraftsMigration,
];
__exportStar(require("./runner"), exports);
