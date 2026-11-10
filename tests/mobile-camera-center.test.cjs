const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const script = fs.readFileSync('script.js', 'utf8');
const start = script.indexOf('const centerPoseOnPoint');
const end = script.indexOf('const cloneKeyframe');
const scope = {};
vm.createContext(scope);
vm.runInContext(script.slice(start, end) + '\nthis.center = centerPoseOnPoint;', scope);

const pose = { position: [-1.66, 0.3, -1.91], lookAt: [-1.82, 0.58, -1.27] };
const body = [-1.7814, 0.83715, -0.737375];
const centred = scope.center(pose, body);
const yaw = (from, to) => Math.atan2(to[2] - from[2], to[0] - from[0]);

assert.equal(JSON.stringify(centred.position), JSON.stringify(pose.position), 'camera position is unchanged');
assert.equal(centred.lookAt[1], pose.lookAt[1], 'height of the look-at (pitch) is unchanged');
assert(Math.abs(yaw(pose.position, centred.lookAt) - yaw(pose.position, body)) < 1e-9, 'look-at now points straight at the body horizontally');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
assert(Math.abs(dist(pose.position, centred.lookAt) - dist(pose.position, pose.lookAt)) < 1e-9, 'look distance is preserved');

assert(/portraitQuery\.matches\s*\?\s*centerPoseOnPoint\(SPLAT_CONFIG\.cameraStart, heroBodyCenter\)\s*:\s*SPLAT_CONFIG\.cameraStart;/.test(script), 'desktop and landscape keep the authored pose object');
assert(script.includes('refreshHeroCameraStart();'), 'the resting pose follows the live viewport (rotation)');
assert(script.includes('finalPose: heroCameraStart'), 'intro lands on the phone-centred pose');
assert(script.includes('value + lookAt[index] - SPLAT_CONFIG.cameraStart.lookAt[index]'), 'pointer parallax pivot stays relative to the authored pose');
console.log('PASS: phone-only centred resting camera');
