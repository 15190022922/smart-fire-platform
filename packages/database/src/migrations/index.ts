import { initialSchemaMigration } from "./0001-initial-schema";
import { drawingFileMetadataMigration } from "./0002-drawing-file-metadata";
import { drawingProcessingStateMigration } from "./0003-drawing-processing-state";
import { spatialAreaStructureMigration } from "./0004-spatial-area-structure";
import { deviceCustomAttributesMigration } from "./0005-device-custom-attributes";
import { deviceLifecycleMigration } from "./0006-device-lifecycle";
import { platformNoticesMigration } from "./0007-platform-notices";
import { platformNoticeAttachmentsMigration } from "./0008-platform-notice-attachments";
import { platformNoticeInboxModelMigration } from "./0009-platform-notice-inbox-model";
import { platformNoticeDraftsMigration } from "./0010-platform-notice-drafts";

export const databaseMigrations = [
  initialSchemaMigration,
  drawingFileMetadataMigration,
  drawingProcessingStateMigration,
  spatialAreaStructureMigration,
  deviceCustomAttributesMigration,
  deviceLifecycleMigration,
  platformNoticesMigration,
  platformNoticeAttachmentsMigration,
  platformNoticeInboxModelMigration,
  platformNoticeDraftsMigration,
];

export type DatabaseMigration = (typeof databaseMigrations)[number];

export * from "./runner";
