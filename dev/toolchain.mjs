import {createRequire} from 'node:module';
import path from 'node:path';
export const requireTool = createRequire(path.resolve(process.env.VT_TOOLCHAIN || '.', 'package.json'));
