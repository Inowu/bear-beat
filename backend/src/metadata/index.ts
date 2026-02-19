export {
  inferTrackMetadataFromName,
  isTrackLikeFileName,
  normalizeCatalogPath,
  prettyMediaName,
  toCatalogRelativePath,
} from './inferTrackMetadata';
export {
  __clearTrackMetadataSyncSchedulerForTests,
  backfillSpotifyCoversForCatalog,
  backfillSpotifyCoversForPaths,
  enrichFilesWithTrackMetadata,
  enrichSearchDocumentsWithTrackMetadata,
  getTrackMetadataMapByPaths,
  inferTrackMetadataFromFile,
  resolveChildCatalogPath,
  scheduleTrackMetadataSyncForFiles,
  syncTrackMetadataForFiles,
  toTrackMetadataCreateInput,
} from './store';
export {
  rebuildTrackMetadataIndex,
} from './scanner';
export type {
  InferredTrackMetadata,
} from './inferTrackMetadata';
export type {
  TrackMetadataView,
} from './store';
export type {
  TrackMetadataScanOptions,
  TrackMetadataScanResult,
} from './scanner';
