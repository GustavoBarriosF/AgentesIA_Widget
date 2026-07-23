import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";

const isProd = process.env.NODE_ENV === "production";
const BACKEND_URL =
  process.env.BACKEND_URL || "https://backend.chat.nexoradeveloper.com";

export default {
  input: "src/index.js",
  output: [
    {
      file: "dist/widget.min.js",
      format: "iife",
      name: "TrivoxWidget",
      exports: "named",
      plugins: isProd ? [terser()] : [],
      sourcemap: true,
    },
    {
      file: "dist/widget.esm.js",
      format: "es",
      exports: "named",
      sourcemap: true,
    },
  ],
  plugins: [
    postcss({ inject: false, minimize: isProd }),
    replace({
      preventAssignment: true,
      __BACKEND_URL__: JSON.stringify(BACKEND_URL),
      __VERSION__: JSON.stringify("1.0.0"),
    }),
    resolve({ browser: true }),
    commonjs(),
  ],
};
