import { FileService } from '../services/fileService';

export let fileService: FileService;

export const initializeFileService = async () => {
  fileService = new FileService(process.env.FILE_SERVICE as 'local' | 'ftp');

  await fileService.init();
};
