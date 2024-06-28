"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
const steveo_sqs_1 = __importDefault(require("./steveo_sqs"));
const fifo_example_task_1 = __importDefault(require("./tasks/fifo_example_task"));
// const activeTask = process.env.TASK;
const tasks = {
    fifo: fifo_example_task_1.default,
};
let active = true;
process.on('SIGINT', async () => {
    active = false;
    await steveo_sqs_1.default.stop();
});
process.on('unhandledRejection', (reason, promise) => {
    steveo_sqs_1.default.logger.error('Unhandled Rejection', { reason, promise });
});
const start = async () => {
    try {
        await steveo_sqs_1.default.start();
        logger_1.logger.info('consumers ready to process messages...');
        while (active) {
            const id = crypto.randomUUID();
            await tasks.fifo.publish({ message: `Hello ${id}` });
            steveo_sqs_1.default.logger.info('Published message', { id });
            await setTimeout(500);
        }
    }
    catch (e) {
        logger_1.logger.error(e);
        process.exit(1);
    }
};
start();
