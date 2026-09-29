import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(process.cwd(),'../../../ShotCraft Studio.app/Contents/Resources/video-shotcraft/workbench');
const require=createRequire(path.join(root,'package.json'));
for(const module of ['@rspack/plugin-react-refresh','@remotion/bundler','@remotion/renderer','@remotion/cli','react','remotion']){require.resolve(module);console.log('OK '+module)}
console.log('Desktop render dependencies resolve. Packaging must preserve nested exports/ directories in node_modules.');
