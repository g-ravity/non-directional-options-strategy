import { Console } from 'console';
import fs from 'fs';

export const logger = new Console({
	stdout: fs.createWriteStream('logs.txt'),
	stderr: fs.createWriteStream('error-logs.txt'),
});
