import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Clock,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { applyPose, blendPose, createCharacter, createPose, poseFor } from './character';
import styles from './CharacterStage.module.css';

const FIELD_OF_VIEW = 30;
const CAMERA_HEIGHT = 0.93;
const CAMERA_DISTANCE = 3.95;
const BLEND_SPEED = 13;
const TURN_SPEED = 9;
const MAX_PIXEL_RATIO = 2;
const MAX_FRAME_SECONDS = 0.1;
const FULL_TURN = Math.PI * 2;

const shortestTurn = (from, to) => {
  const delta = (((to - from) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return delta > Math.PI ? delta - FULL_TURN : delta;
};

function disposeScene(scene) {
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    [].concat(node.material).forEach((material) => {
      if (material.map) material.map.dispose();
      material.dispose();
    });
  });
}

export default function CharacterStage({
  action = 'Idle',
  heading = 0,
  onReady = null,
  onError = null,
}) {
  const canvasRef = useRef(null);
  const targetRef = useRef({ action, heading });
  const callbacksRef = useRef({ onReady, onError });

  targetRef.current = { action, heading };
  callbacksRef.current = { onReady, onError };

  useEffect(() => {
    const canvas = canvasRef.current;

    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      callbacksRef.current.onError?.();
      return undefined;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    const camera = new PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.1, 50);
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(0, CAMERA_HEIGHT, 0);

    const key = new DirectionalLight(0xffeadc, 3.4);
    key.position.set(2.6, 4.6, 5);
    const rim = new DirectionalLight(0xff9fb5, 2.8);
    rim.position.set(-3.2, 3.4, -4.4);
    const bounce = new DirectionalLight(0xffc9c2, 1);
    bounce.position.set(-1.5, -2, 3);
    scene.add(new HemisphereLight(0xfff1ec, 0xb08a8f, 1.6), key, rim, bounce);

    const { root, joints } = createCharacter();
    root.rotation.y = targetRef.current.heading;
    scene.add(root);

    const clock = new Clock();
    const pose = createPose();
    let playing = targetRef.current.action;
    let startedAt = 0;
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), MAX_FRAME_SECONDS);
      const time = clock.elapsedTime;
      const target = targetRef.current;

      if (playing !== target.action) {
        playing = target.action;
        startedAt = time;
      }

      blendPose(pose, poseFor(playing, time, time - startedAt), Math.min(1, delta * BLEND_SPEED));
      applyPose(joints, pose);
      root.rotation.y +=
        shortestTurn(root.rotation.y, target.heading) * Math.min(1, delta * TURN_SPEED);

      renderer.render(scene, camera);
    };
    tick();
    callbacksRef.current.onReady?.();

    return () => {
      cancelAnimationFrame(frame);
      disposeScene(scene);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

CharacterStage.propTypes = {
  action: PropTypes.string,
  heading: PropTypes.number,
  onReady: PropTypes.func,
  onError: PropTypes.func,
};
