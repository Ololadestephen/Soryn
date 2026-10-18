import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack.js");
const directory = resolve("tests/browser-support/privy-bridge");
const compiler = webpack({
  mode: "development",
  devtool: false,
  entry: resolve(directory, "entry.tsx"),
  output: { path: resolve(process.argv[2]), filename: "bridge.js" },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@privy-io/react-auth$": resolve(directory, "mock.tsx"),
      "../identity/OfficialExperience$": resolve(
        directory,
        "unused-experience.tsx",
      ),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: resolve(directory, "transpile.mjs"),
      },
    ],
  },
});
await new Promise((done, reject) =>
  compiler.run((error, stats) => {
    if (error || stats?.hasErrors())
      reject(error ?? new Error(stats.toString({ all: false, errors: true })));
    else done();
  }),
);
await new Promise((done, reject) =>
  compiler.close((error) => (error ? reject(error) : done())),
);
