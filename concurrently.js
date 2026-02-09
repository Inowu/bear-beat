const concurrently = require("concurrently");
const path = require("path");

const { result } = concurrently([
  {
    command: "npm run dev",
    name: "BE",
    prefixColor: "red",
    cwd: path.resolve(__dirname, "backend"),
  },
  {
    // Some local scripts load backend/.env (PORT=5001) into process.env, which would
    // unintentionally force CRA to boot on 5001 and conflict with the API. Keep FE on 3000.
    command: "PORT=3000 npm run start",
    name: "FE",
    prefixColor: "blue",
    cwd: path.resolve(__dirname, "frontend"),
  },
]);

result.then(null, (reason) => console.log(reason));
