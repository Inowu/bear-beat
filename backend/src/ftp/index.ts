import { FileService } from '../services/fileService';

export const fileService: FileService = new FileService(
  process.env.FILE_SERVICE as 'local' | 'ftp',
);

export const initializeFileService = async () => fileService.init();
