import {
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

const COLORS = {
  fur: 0x7c4b35,
  furDark: 0x4c2f24,
  belly: 0xe7b2b6,
  face: 0xf6e7e6,
  patch: 0x5a3b34,
  nose: 0xd58a94,
  blush: 0xd79aa0,
  mouth: 0x4c2f24,
  claw: 0xf3d9d8,
  eye: 0x2b1a17,
  glint: 0xffffff,
  shadow: 0x2b1a17,
};

const BODY_Y = 0.6;
const UPPER_ARM = 0.3;
const FOREARM = 0.3;
const LEG = 0.2;

const matte = (color, roughness = 0.72) => new MeshStandardMaterial({ color, roughness });

function mesh(geometry, material, position = [0, 0, 0]) {
  const item = new Mesh(geometry, material);
  item.position.set(...position);
  return item;
}

function group(position = [0, 0, 0], children = []) {
  const item = new Group();
  item.position.set(...position);
  children.forEach((child) => item.add(child));
  return item;
}

function createClaws(material, { spread, length, drop = 0, pointsForward = false }) {
  return [-1, 0, 1].map((slot) => {
    const claw = mesh(new ConeGeometry(0.022, length, 8), material);
    if (pointsForward) {
      claw.rotation.x = Math.PI / 2;
      claw.position.set(slot * spread, -0.03, 0.11);
    } else {
      claw.rotation.set(Math.PI, 0, slot * 0.25);
      claw.position.set(slot * spread, -drop - length / 2, 0);
    }
    return claw;
  });
}

function createArm(side, materials) {
  const hand = group(
    [0, -FOREARM, 0],
    [
      mesh(new SphereGeometry(0.07, 14, 12), materials.furDark),
      ...createClaws(materials.claw, { spread: 0.035, length: 0.13, drop: 0.05 }),
    ],
  );
  const elbow = group(
    [0, -UPPER_ARM, 0],
    [
      mesh(new CapsuleGeometry(0.066, FOREARM - 0.1, 6, 12), materials.fur, [0, -FOREARM / 2, 0]),
      hand,
    ],
  );
  const shoulder = group(
    [side * 0.32, 0.42, 0],
    [
      mesh(new SphereGeometry(0.09, 14, 12), materials.fur),
      mesh(new CapsuleGeometry(0.075, UPPER_ARM - 0.1, 6, 12), materials.fur, [
        0,
        -UPPER_ARM / 2,
        0,
      ]),
      elbow,
    ],
  );
  return { shoulder, elbow };
}

function createLeg(side, materials) {
  const foot = group(
    [0, -LEG - 0.06, 0.05],
    [
      mesh(new SphereGeometry(0.085, 14, 12), materials.furDark),
      ...createClaws(materials.claw, { spread: 0.04, length: 0.1, pointsForward: true }),
    ],
  );
  return group(
    [side * 0.17, -0.27, 0.02],
    [mesh(new CapsuleGeometry(0.095, LEG - 0.06, 6, 12), materials.fur, [0, -LEG / 2, 0]), foot],
  );
}

function createFace(materials) {
  const mask = mesh(new SphereGeometry(0.25, 26, 20), materials.face, [0, -0.01, 0.13]);
  mask.scale.set(1.02, 0.86, 0.62);

  const patchGeometry = new SphereGeometry(0.085, 16, 12);
  const patchLeft = mesh(patchGeometry, materials.patch, [0.125, 0.0, 0.262]);
  const patchRight = mesh(patchGeometry, materials.patch, [-0.125, 0.0, 0.262]);
  patchLeft.scale.set(1.45, 0.72, 0.3);
  patchRight.scale.set(1.45, 0.72, 0.3);
  patchLeft.rotation.z = -0.5;
  patchRight.rotation.z = 0.5;

  const eyeGeometry = new SphereGeometry(0.03, 12, 10);
  const glintGeometry = new SphereGeometry(0.01, 8, 8);
  const eyes = group(
    [0, 0.015, 0],
    [
      mesh(eyeGeometry, materials.eye, [0.105, 0, 0.283]),
      mesh(eyeGeometry, materials.eye, [-0.105, 0, 0.283]),
      mesh(glintGeometry, materials.glint, [0.113, 0.012, 0.307]),
      mesh(glintGeometry, materials.glint, [-0.097, 0.012, 0.307]),
    ],
  );

  const nose = mesh(new SphereGeometry(0.045, 14, 12), materials.nose, [0, -0.055, 0.29]);
  nose.scale.set(1.25, 0.8, 0.6);

  const smile = mesh(
    new TorusGeometry(0.05, 0.009, 8, 18, Math.PI),
    materials.mouth,
    [0, -0.1, 0.268],
  );
  smile.rotation.z = Math.PI;
  smile.rotation.x = -0.25;

  const cheekGeometry = new SphereGeometry(0.034, 14, 10);
  const cheeks = [1, -1].map((side) => {
    const cheek = mesh(cheekGeometry, materials.blush, [side * 0.118, -0.118, 0.243]);
    cheek.scale.set(1.25, 0.8, 0.3);
    return cheek;
  });

  return { eyes, parts: [mask, patchLeft, patchRight, eyes, nose, smile, ...cheeks] };
}

export function createCharacter() {
  const materials = {
    fur: matte(COLORS.fur),
    furDark: matte(COLORS.furDark),
    belly: matte(COLORS.belly),
    face: matte(COLORS.face, 0.8),
    patch: matte(COLORS.patch),
    nose: matte(COLORS.nose, 0.5),
    blush: matte(COLORS.blush, 0.9),
    mouth: matte(COLORS.mouth, 0.5),
    claw: matte(COLORS.claw, 0.5),
    eye: matte(COLORS.eye, 0.25),
    glint: new MeshBasicMaterial({ color: COLORS.glint }),
  };

  const torso = mesh(new SphereGeometry(0.36, 28, 22), materials.fur, [0, 0.1, 0]);
  torso.scale.set(1, 1.22, 0.9);
  const belly = mesh(new SphereGeometry(0.29, 24, 18), materials.belly, [0, 0.05, 0.17]);
  belly.scale.set(0.82, 1.02, 0.7);

  const face = createFace(materials);
  const skull = mesh(new SphereGeometry(0.3, 28, 22), materials.fur);
  skull.scale.set(1.08, 0.92, 0.95);
  const tuft = mesh(new ConeGeometry(0.07, 0.12, 8), materials.furDark, [0.03, 0.28, 0.02]);
  tuft.rotation.z = -0.3;
  const head = group([0, 0.56, 0.02], [group([0, 0.2, 0], [skull, tuft, ...face.parts])]);

  const armLeft = createArm(1, materials);
  const armRight = createArm(-1, materials);
  const legLeft = createLeg(1, materials);
  const legRight = createLeg(-1, materials);

  const body = group(
    [0, BODY_Y, 0],
    [torso, belly, head, armLeft.shoulder, armRight.shoulder, legLeft, legRight],
  );

  const shadow = mesh(
    new CircleGeometry(0.4, 30),
    new MeshBasicMaterial({
      color: COLORS.shadow,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
    [0, 0.002, 0],
  );
  shadow.rotation.x = -Math.PI / 2;

  return {
    root: group([0, 0, 0], [shadow, body]),
    joints: {
      body,
      head,
      eyes: face.eyes,
      shadow,
      armLeft: armLeft.shoulder,
      elbowLeft: armLeft.elbow,
      armRight: armRight.shoulder,
      elbowRight: armRight.elbow,
      legLeft,
      legRight,
    },
  };
}

const SLEEPY = 0.72;

const REST = {
  lift: 0,
  pitch: 0,
  roll: 0,
  headNod: 0,
  headTurn: 0,
  headTilt: 0,
  blink: SLEEPY,
  armLeftSwing: 0,
  armLeftSpread: 0.16,
  elbowLeft: -0.15,
  armRightSwing: 0,
  armRightSpread: -0.16,
  elbowRight: -0.15,
  elbowRightWave: 0,
  legLeft: 0,
  legRight: 0,
};

const blinkAt = (time) => (time % 5.2 > 4.7 ? 0.08 : SLEEPY);

const POSES = {
  Idle: (time) => ({
    lift: Math.sin(time * 1.4) * 0.008,
    roll: Math.sin(time * 0.7) * 0.03,
    headTilt: Math.sin(time * 0.6) * 0.1,
    headTurn: Math.sin(time * 0.35) * 0.12,
    armLeftSwing: Math.sin(time * 0.9) * 0.05,
    armRightSwing: -Math.sin(time * 0.9) * 0.05,
    blink: blinkAt(time),
  }),

  Walking: (time) => {
    const stride = time * 5.5;
    const step = Math.sin(stride);
    return {
      lift: Math.abs(Math.cos(stride)) * 0.02,
      roll: step * 0.11,
      pitch: -0.06,
      headTilt: -step * 0.08,
      legLeft: step * 0.5,
      legRight: -step * 0.5,
      armLeftSwing: -step * 0.38,
      armRightSwing: step * 0.38,
      elbowLeft: -0.35,
      elbowRight: -0.35,
      blink: blinkAt(time),
    };
  },

  Wave: (time) => ({
    roll: 0.05,
    headTilt: -0.16,
    armRightSpread: -2.5,
    elbowRight: -0.15,
    elbowRightWave: Math.sin(time * 4.5) * 0.5 - 0.35,
    blink: 1,
  }),

  Punch: (time) => ({
    headNod: 0.2,
    armRightSwing: -1.25 + Math.sin(time * 5) * 0.18,
    armRightSpread: -0.1,
    elbowRight: -0.45,
    armLeftSwing: -0.3,
    blink: 1,
  }),

  ThumbsUp: (time) => ({
    lift: Math.abs(Math.sin(time * 3)) * 0.03,
    roll: Math.sin(time * 3) * 0.08,
    headTilt: Math.sin(time * 3) * 0.12,
    armLeftSpread: 2.45,
    armRightSpread: -2.45,
    elbowLeft: -0.3,
    elbowRight: -0.3,
    blink: 0.25,
  }),

  No: (time) => ({
    headTurn: Math.sin(time * 4) * 0.5,
    headNod: 0.16,
    armLeftSpread: 0.45,
    armRightSpread: -0.45,
    elbowLeft: -0.7,
    elbowRight: -0.7,
    blink: 0.5,
  }),

  Jump: (time) => ({
    lift: Math.abs(Math.sin(time * 3.2)) * 0.07,
    roll: Math.sin(time * 3.2) * 0.1,
    armLeftSpread: 2.2 + Math.sin(time * 6.4) * 0.25,
    armRightSpread: -2.2 - Math.sin(time * 6.4) * 0.25,
    headTilt: Math.sin(time * 3.2) * 0.15,
    blink: 0.25,
  }),

  Climb: (time) => {
    const reach = Math.sin(time * 4.2);
    return {
      pitch: -0.12,
      roll: reach * 0.07,
      headNod: -0.28,
      armLeftSwing: -2.55 + reach * 0.4,
      armRightSwing: -2.55 - reach * 0.4,
      armLeftSpread: 0.08,
      armRightSpread: -0.08,
      elbowLeft: -0.35 - reach * 0.3,
      elbowRight: -0.35 + reach * 0.3,
      legLeft: 0.45 + reach * 0.4,
      legRight: 0.45 - reach * 0.4,
      blink: 1,
    };
  },
};

export const createPose = () => ({ ...REST });

export function poseFor(action, time, age) {
  const build = POSES[action] || POSES.Idle;
  return { ...REST, ...build(time, age) };
}

export function blendPose(current, target, amount) {
  const next = current;
  Object.keys(target).forEach((key) => {
    next[key] += (target[key] - next[key]) * amount;
  });
  return next;
}

export function applyPose(joints, pose) {
  const { body, head, eyes, shadow, armLeft, elbowLeft, armRight, elbowRight, legLeft, legRight } =
    joints;

  body.position.y = BODY_Y + pose.lift;
  body.rotation.set(pose.pitch, 0, pose.roll);
  head.rotation.set(pose.headNod, pose.headTurn, pose.headTilt);
  eyes.scale.y = pose.blink;
  shadow.scale.setScalar(1 - pose.lift * 1.4);

  armLeft.rotation.set(pose.armLeftSwing, 0, pose.armLeftSpread);
  elbowLeft.rotation.set(pose.elbowLeft, 0, 0);
  armRight.rotation.set(pose.armRightSwing, 0, pose.armRightSpread);
  elbowRight.rotation.set(pose.elbowRight, 0, pose.elbowRightWave);

  legLeft.rotation.x = -pose.legLeft;
  legRight.rotation.x = -pose.legRight;
}
