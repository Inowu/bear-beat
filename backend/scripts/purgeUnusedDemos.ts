const fs = require('fs');
const path = require('path');

function readDirectoryRecursively(directoryPath) {
  let fileList: string[] = [];

  function readDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);

    items.forEach((item: any) => {
      const itemPath = path.join(currentPath, item);

      if (fs.statSync(itemPath).isDirectory()) {
        // If it's a directory, recursively call the function
        readDirectory(itemPath);
      } else {
        // If it's a file, add the file path to the array
        fileList.push(itemPath);
      }
    });
  }

  // Start reading the directory recursively
  readDirectory(directoryPath);

  return fileList;
}

const directoryPath = '/home/products';
const products = readDirectoryRecursively(directoryPath).map((f) =>
  path.basename(f),
);

const demos = readDirectoryRecursively('./demos').map((f) => path.basename(f));

for (const demo of demos) {
  const dPath = path.resolve('./demos', demo);
  if (!products.includes(demo)) {
    console.log('Purge -> ', dPath);
    fs.unlinkSync(dPath);
  }
}
