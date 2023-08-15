const concurrently = require("concurrently");
const path = require("path");

const { result } = concurrently([
  {
    command: "npm run dev",
    name: "API",
    prefixColor: "red",
    cwd: path.resolve(__dirname, "backend"),
  },
  {
    command: "npm run start",
    name: "Frontend",
    prefixColor: "blue",
    cwd: path.resolve(__dirname, "frontend"),
  },
]);

result.then(null, (reason) => console.log(reason));
