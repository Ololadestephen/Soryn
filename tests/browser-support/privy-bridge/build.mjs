import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack.js");
const directory = resolve("tests/browser-support/privy-bridge");
const compiler = webpack({
  mode: "development",
  devtool: false,
  entry: process.argv[3]
    ? resolve(process.argv[3])
    : resolve(directory, "entry.tsx"),
  output: {
    path: resolve(process.argv[2]),
    filename: "bridge.js",
    publicPath: "/",
  },
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
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({
        NODE_ENV: "development",
        NEXT_PUBLIC_PRIVY_APP_ID: "chog-character-fixture",
      }),
    }),
  ],
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
