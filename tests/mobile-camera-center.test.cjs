const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const script = fs.readFileSync('script.js', 'utf8');
const start = script.indexOf('const centerPoseOnPoint');
const end = script.indexOf('const cloneKeyframe');
const scope = {};
vm.createContext(scope);
vm.runInContext(script.slice(start, end) + '\nthis.center = centerPoseOnPoint; this.frameAt = framePoseAtScreenX; this.vfov = HERO_CAMERA_VFOV_DEG;', scope);

const pose = { position: [-1.66, 0.3, -1.91], lookAt: [-1.82, 0.58, -1.27] };
const body = [-1.7814, 0.83715, -0.737375];
const centred = scope.center(pose, body);
const yaw = (from, to) => Math.atan2(to[2] - from[2], to[0] - from[0]);

assert.equal(JSON.stringify(centred.position), JSON.stringify(pose.position), 'camera position is unchanged');
assert.equal(centred.lookAt[1], pose.lookAt[1], 'height of the look-at (pitch) is unchanged');
assert(Math.abs(yaw(pose.position, centred.lookAt) - yaw(pose.position, body)) < 1e-9, 'look-at now points straight at the body horizontally');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
assert(Math.abs(dist(pose.position, centred.lookAt) - dist(pose.position, pose.lookAt)) < 1e-9, 'look distance is preserved');

assert(/if \(portraitQuery\.matches\) \{\s*return centerPoseOnPoint\(SPLAT_CONFIG\.cameraStart, heroBodyCenter\);/.test(script), 'phones in portrait centre the subject');
assert(/return SPLAT_CONFIG\.cameraStart;\s*\};/.test(script), 'desktop keeps the authored pose object');
assert(script.includes('refreshHeroCameraStart();'), 'the resting pose follows the live viewport (rotation)');

// Sideways phones: the body lands at the requested screen x, on the authored side.
const halfTan = Math.tan((scope.vfov * Math.PI) / 360);
const authoredAngle = yaw(pose.position, body) - yaw(pose.position, pose.lookAt);
for (const aspect of [844 / 390, 932 / 430, 1.6]) {
  const framed = scope.frameAt(pose, body, aspect, 0.4);
  const angle = yaw(pose.position, body) - yaw(pose.position, framed.lookAt);
  const screenX = Math.tan(angle) / (halfTan * aspect);
  assert(Math.abs(Math.abs(screenX) - 0.4) < 1e-9, `body lands 0.4 from centre at aspect ${aspect}`);
  assert.equal(Math.sign(angle), Math.sign(authoredAngle), 'body stays on the authored side');
  assert.equal(JSON.stringify(framed.position), JSON.stringify(pose.position), 'landscape keeps camera position');
  assert.equal(framed.lookAt[1], pose.lookAt[1], 'landscape keeps pitch');
}
assert(script.includes('finalPose: heroCameraStart'), 'intro lands on the phone-centred pose');
assert(script.includes('value + lookAt[index] - SPLAT_CONFIG.cameraStart.lookAt[index]'), 'pointer parallax pivot stays relative to the authored pose');
console.log('PASS: portrait-centred, landscape-right and desktop-authored resting camera');
