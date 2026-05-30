#!/usr/bin/env node
import { run } from "../dist/index.js";

run().then((code) => {
  process.exitCode = code;
});
