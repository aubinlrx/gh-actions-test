"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const name = (0, core_1.getInput)("name");
console.log(`Hello ${name}!`);
