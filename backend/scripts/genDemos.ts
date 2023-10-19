import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

const inputDir = '/home/zcylla/Downloads';
const outputDir = path.join(__dirname, '../demos');
console.log(outputDir);

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to recursively process files in directories
function processFilesInDirectory(directoryPath: string) {
  const files = fs.readdirSync(directoryPath);

  for (const filename of files) {
    console.log(filename);

    try {
      const filePath = path.join(directoryPath, filename);

      if (fs.statSync(filePath).isFile()) {
        const extension = path.extname(filename).slice(1);
        const outputFilename = `${path.basename(
          filename,
          `.${extension}`,
        )}.${extension}`;
        const outputFilePath = path.join(outputDir, outputFilename);

        if (fs.existsSync(outputFilePath)) {
          console.log(`Skipped: ${filename} (Output file already exists)`);
        } else {
          if (extension === 'mp3') {
            ffmpeg(filePath)
              .toFormat('mp4')
              .output(outputFilePath)
              .on('end', () => {
                console.log(`Processed: ${filename}`);
              })
              .on('error', (error) => {
                console.log(`${filename} Error - ${error}`);
              })
              .run();
          } else if (extension === 'mp4') {
            ffmpeg(filePath)
              .audioCodec('libmp3lame')
              .audioQuality(4)
              .on('error', () => console.log(`Error: ${filename}`))
              .on('end', () => {
                console.log(`Processed: ${filename}`);
              })
              .save(outputFilePath);
          }
        }
      } else if (fs.statSync(filePath).isDirectory()) {
        // Recursively process files in nested directories
        processFilesInDirectory(filePath);
      }
    } catch (e) {}
  }
}

// Start processing files in the specified input directory
processFilesInDirectory(inputDir);
