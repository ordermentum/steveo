"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callback = void 0;
const steveo_sqs_1 = __importDefault(require("../steveo_sqs"));
const callback = async (payload) => {
    console.log('Running fifo task', payload);
};
exports.callback = callback;
exports.default = steveo_sqs_1.default.task('fifo_example', exports.callback, { fifo: true });
