import { register } from "node:module";

register("./ts-loader.mjs", { parentURL: import.meta.url });
