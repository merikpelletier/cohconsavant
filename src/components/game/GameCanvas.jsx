import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Loader2 } from 'lucide-react';
import { loadHeightMapAsNormal, loadAlbedoTexture } from './museumTextures';

const CYAN = 0x00F0FF;
const RED = 0xFF0000;
const PEDESTAL_HEIGHT = 0.6;

function makeSquareOutline(size, color, opacity) {
  const s = size;
  const points = [
    new THREE.Vector3(-s, 0, -s), new THREE.Vector3(s, 0, -s),
    new THREE.Vector3(s, 0, -s), new THREE.Vector3(s, 0, s),
    new THREE.Vector3(s, 0, s), new THREE.Vector3(-s, 0, s),
    new THREE.Vector3(-s, 0, s), new THREE.Vector3(-s, 0, -s),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(geo, mat);
}

function makeSquareFill(size, color, opacity) {
  const geo = new THREE.PlaneGeometry(size * 2, size * 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Thick rope mesh between two points — touches element bases
function makeRopeMesh(start, end, opacity = 0.8, pulse = false) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length() || 0.01;
  const geo = new THREE.CylinderGeometry(0.035, 0.035, length, 8);
  const mat = new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.5, transparent: true, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  const axis = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
  if (pulse) {
    mesh.userData.pulse = true;
    mesh.userData.baseOpacity = opacity;
  }
  return mesh;
}

export default function GameCanvas({ elements, connections, selectedElementId, selectedElementBId, onSelectElement, placementMode, onPlaceCreation, creationModelUrl, onSelectConnection, session, theme, environmentConfig, floorTextureUrl, floorNormalUrl, wallTextureUrl, wallNormalUrl }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const elementMeshesRef = useRef([]);
  const ropeLinesRef = useRef([]);
  const previewRopeRef = useRef([]);
  const overlayRef = useRef([]);
  const selectionOverlayRef = useRef([]);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const touchMoveRef = useRef({ x: 0, z: 0 });
  const joystickRef = useRef({ active: false });
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });

  const propsRef = useRef({});
  propsRef.current = { placementMode, onPlaceCreation, onSelectElement, onSelectConnection };

  const selectedIdsRef = useRef({ a: null, b: null });
  selectedIdsRef.current = { a: selectedElementId, b: selectedElementBId };

  const elementsRef = useRef([]);
  elementsRef.current = elements;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer, scene, camera, animationId;
    const width = container.clientWidth || 400;
    const heightPx = container.clientHeight || 600;

    scene = new THREE.Scene();

    const cfg = environmentConfig || {};
    const fogColor = cfg.fog_color || '#08080c';
    const fogDensity = cfg.fog_density || 0.045;
    const ambientColor = cfg.ambient_color || '#1a1510';
    const ambientIntensity = cfg.ambient_intensity || 0.15;
    const spotlightColor = cfg.spotlight_color || '#e6d3a8';
    const spotlightIntensity = cfg.spotlight_intensity || 4.0;
    const floorColor = cfg.floor_color || '#3e2a1d';
    const wallColor = cfg.wall_color || '#1c1815';
    const pedestalColor = cfg.pedestal_color || '#0a0a0a';
    const accentColor = cfg.accent_color || '#b8a070';
    const floorRoughness = cfg.floor_roughness ?? 0.3;
    const floorMetalness = cfg.floor_metalness ?? 0.2;
    const wallRoughness = cfg.wall_roughness ?? 0.9;

    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(new THREE.Color(fogColor), fogDensity);
    sceneRef.current = scene;

    const ROOM = 7;
    const WALL_H = 4;

    camera = new THREE.PerspectiveCamera(75, width / heightPx, 0.1, 100);
    camera.position.set(0, 1.6, 5.5);
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, heightPx);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    scene.environment = pmremGen.fromScene(envScene, 0.04).texture;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, heightPx),
      0.6, 0.5, 0.85
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // === Museum gallery lighting ===
    const ambient = new THREE.AmbientLight(new THREE.Color(ambientColor), ambientIntensity);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(new THREE.Color(ambientColor), new THREE.Color(floorColor), 0.2);
    scene.add(hemiLight);

    // === Load PBR textures and build museum environment ===
    const buildMuseum = async () => {
      const floorAlbedo = floorTextureUrl ? await loadAlbedoTexture(floorTextureUrl, 8) : null;
      const floorNormal = floorNormalUrl ? await loadHeightMapAsNormal(floorNormalUrl, 2.0, 8) : null;
      const wallAlbedo = wallTextureUrl ? await loadAlbedoTexture(wallTextureUrl, 4) : null;
      const wallNormal = wallNormalUrl ? await loadHeightMapAsNormal(wallNormalUrl, 2.0, 4) : null;

      // === Floor (polished museum surface) ===
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(floorColor),
        roughness: floorRoughness,
        metalness: floorMetalness,
        envMapIntensity: 0.9,
      });
      if (floorAlbedo) { floorMat.map = floorAlbedo; floorMat.needsUpdate = true; }
      if (floorNormal) { floorMat.normalMap = floorNormal; floorMat.needsUpdate = true; }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.name = 'ground';
      floor.receiveShadow = true;
      scene.add(floor);

      const wallMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wallColor),
        roughness: wallRoughness,
        metalness: 0.0,
      });
      if (wallAlbedo) { wallMat.map = wallAlbedo; wallMat.needsUpdate = true; }
      if (wallNormal) { wallMat.normalMap = wallNormal; wallMat.needsUpdate = true; }

      // Four perimeter walls — open museum gallery room
      const wallGroup = new THREE.Group();
      const wallThickness = 0.3;
      const wallGeoNS = new THREE.BoxGeometry(ROOM * 2 + wallThickness, WALL_H, wallThickness);
      const wallGeoEW = new THREE.BoxGeometry(wallThickness, WALL_H, ROOM * 2);
      for (const z of [-ROOM, ROOM]) {
        const wall = new THREE.Mesh(wallGeoNS, wallMat);
        wall.position.set(0, WALL_H / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wallGroup.add(wall);
      }
      for (const x of [-ROOM, ROOM]) {
        const wall = new THREE.Mesh(wallGeoEW, wallMat);
        wall.position.set(x, WALL_H / 2, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wallGroup.add(wall);
      }
      scene.add(wallGroup);

      // === Ceiling beams with track-mounted spotlights ===
      const spotPositions = [
        [-2, 3.5, -2], [2, 3.5, -2], [-2, 3.5, 2], [2, 3.5, 2], [0, 3.5, 0],
        [0, 3.5, -4], [0, 3.5, 4], [-4, 3.5, 0], [4, 3.5, 0],
      ];
      const bulbColor = new THREE.Color(spotlightColor);
      spotPositions.forEach(([x, y, z]) => {
        const spot = new THREE.SpotLight(
          bulbColor,
          spotlightIntensity,
          14,
          Math.PI / 5,
          0.4,
          1.5
        );
        spot.position.set(x, y, z);
        spot.target.position.set(x, 0, z);
        spot.castShadow = true;
        spot.shadow.mapSize.set(512, 512);
        spot.shadow.camera.near = 0.5;
        spot.shadow.camera.far = 12;
        spot.shadow.bias = -0.001;
        scene.add(spot);
        scene.add(spot.target);

        // Track light fixture (cylinder)
        const fixtureGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.2, 8);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, y + 0.1, z);
        scene.add(fixture);

        // Glowing bulb
        const bulbGeo = new THREE.SphereGeometry(0.05, 10, 10);
        const bulbMat = new THREE.MeshBasicMaterial({ color: bulbColor });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(x, y - 0.05, z);
        scene.add(bulb);

        // Soft glow halo
        const haloGeo = new THREE.SphereGeometry(0.15, 10, 10);
        const haloMat = new THREE.MeshBasicMaterial({ color: bulbColor, transparent: true, opacity: 0.15 });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(x, y - 0.05, z);
        scene.add(halo);

        // Hanging wire
        const wireLen = WALL_H + 0.5 - y;
        if (wireLen > 0.01) {
          const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, wireLen, 4);
          const wireMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
          const wire = new THREE.Mesh(wireGeo, wireMat);
          wire.position.set(x, y + wireLen / 2, z);
          scene.add(wire);
        }
      });

    };

    buildMuseum().catch(() => {});

    // First-person look + wall collision
    renderer.domElement.style.touchAction = 'none';
    let yaw = 0;
    let pitch = 0;
    const PITCH_LIMIT = Math.PI / 2 - 0.1;
    const LOOK_SENS = 0.003;

    const BOUND = ROOM - 0.6;
    const isWallAt = (x, z) => {
      return Math.abs(x) > BOUND || Math.abs(z) > BOUND;
    };

    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    const onKeyDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k in keys) keys[k] = true;
    };
    const onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k in keys) keys[k] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const moveSpeed = 0.18;
    const moveDir = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (clientX, clientY) => {
      const { placementMode: pm, onPlaceCreation: placeCb, onSelectElement: selectCb, onSelectConnection: connCb } = propsRef.current;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      if (pm && placeCb) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(floorRef.current);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          placeCb({ x: point.x, y: 0, z: point.z });
        }
        return;
      }

      raycaster.setFromCamera(mouse, camera);
      raycaster.params.Line.threshold = 0.4;

      const ropeHits = raycaster.intersectObjects(ropeLinesRef.current, true);
      if (ropeHits.length > 0) {
        let obj = ropeHits[0].object;
        while (obj && !obj.userData.connectionId) { obj = obj.parent; }
        if (obj && obj.userData.connectionId) {
          connCb?.(obj.userData.connectionId);
          return;
        }
      }

      const intersects = raycaster.intersectObjects(elementMeshesRef.current, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData.elementId) { obj = obj.parent; }
        if (obj && obj.userData.elementId) {
          selectCb?.(obj.userData.elementId);
        }
      }
    };

    const floorRef = { current: null };
    // Wait for floor to be created in buildMuseum
    const checkFloor = setInterval(() => {
      const ground = scene.getObjectByName('ground');
      if (ground) { floorRef.current = ground; clearInterval(checkFloor); }
    }, 100);

    let lookActive = false;
    let lookLastX = 0, lookLastY = 0;
    let downX = 0, downY = 0, downTime = 0, didDrag = false;

    const onPointerDown = (e) => {
      lookActive = true;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
      didDrag = false;
    };
    const onPointerMove = (e) => {
      if (!lookActive) return;
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) didDrag = true;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      yaw -= dx * LOOK_SENS;
      pitch -= dy * LOOK_SENS;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    };
    const onPointerUp = () => {
      lookActive = false;
      if (!didDrag && Date.now() - downTime < 400) {
        handleClick(downX, downY);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      moveDir.set(0, 0, 0);
      if (keys.w || keys.ArrowUp) moveDir.z -= 1;
      if (keys.s || keys.ArrowDown) moveDir.z += 1;
      if (keys.a || keys.ArrowLeft) moveDir.x -= 1;
      if (keys.d || keys.ArrowRight) moveDir.x += 1;
      const touch = touchMoveRef.current;
      if (touch.x !== 0 || touch.z !== 0) {
        moveDir.x += touch.x;
        moveDir.z += touch.z;
      }
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        const right = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();
        const move = new THREE.Vector3();
        move.addScaledVector(cameraForward, -moveDir.z);
        move.addScaledVector(right, moveDir.x);
        move.multiplyScalar(moveSpeed);
        const newX = camera.position.x + move.x;
        const newZ = camera.position.z + move.z;
        if (!isWallAt(newX, camera.position.z)) camera.position.x = newX;
        if (!isWallAt(camera.position.x, newZ)) camera.position.z = newZ;
      }

      // Pulse overlay items
      overlayRef.current.forEach(item => {
        if (item.userData.pulse) {
          const pulse = 0.6 + Math.sin(elapsed * 3 + (item.userData.phase || 0)) * 0.25;
          if (item.material) item.material.opacity = pulse * (item.userData.baseOpacity || 0.6);
        }
      });

      // Pulse preview rope (pending connection)
      previewRopeRef.current.forEach(item => {
        if (item.userData.pulse) {
          const pulse = 0.4 + Math.sin(elapsed * 4) * 0.35;
          if (item.material) item.material.opacity = pulse * (item.userData.baseOpacity || 0.8);
        }
      });

      // Animate selected elements (scale pulse + vertical bob + ring rotation)
      const selIds = selectedIdsRef.current;
      const activeSelectedIds = [selIds.a, selIds.b].filter(Boolean);
      elementMeshesRef.current.forEach(mesh => {
        const baseScale = mesh.userData.baseScale || 1;
        const baseY = mesh.userData.baseY || 0;
        if (activeSelectedIds.includes(mesh.userData.elementId)) {
          const pulse = 1 + Math.sin(elapsed * 4) * 0.06;
          mesh.scale.setScalar(baseScale * pulse);
          mesh.position.y = baseY + Math.sin(elapsed * 3) * 0.1;
        } else {
          mesh.scale.setScalar(baseScale);
          mesh.position.y = baseY;
        }
      });
      selectionOverlayRef.current.forEach(item => {
        if (item.userData.rotate) {
          item.rotation.z += 0.03;
        }
      });

      composer.render();
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    setLoading(false);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(checkFloor);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  // Load/unload elements + overlay markers + pedestals
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    [...elementMeshesRef.current, ...overlayRef.current].forEach(mesh => {
      scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    elementMeshesRef.current = [];
    overlayRef.current = [];

    const loader = new GLTFLoader();

    const sel = selectedIdsRef.current;
    elements.forEach((el) => {
      if (!el.position) return;
      const pos = new THREE.Vector3(el.position.x || 0, el.position.y || 0, el.position.z || 0);
      const isSelected = el.id === sel.a || el.id === sel.b;

      // Black display pedestal under each element
      const pedGeo = new THREE.BoxGeometry(0.7, PEDESTAL_HEIGHT, 0.7);
      const pedMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.9,
        metalness: 0.1,
      });
      const pedestal = new THREE.Mesh(pedGeo, pedMat);
      pedestal.position.set(pos.x, PEDESTAL_HEIGHT / 2, pos.z);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      scene.add(pedestal);
      overlayRef.current.push(pedestal);

      // Cyan glowing base ring on pedestal top
      const baseOutline = makeSquareOutline(0.4, CYAN, 0.7);
      baseOutline.position.set(pos.x, PEDESTAL_HEIGHT + 0.01, pos.z);
      baseOutline.userData.pulse = true;
      baseOutline.userData.baseOpacity = 0.7;
      baseOutline.userData.phase = Math.random() * Math.PI * 2;
      scene.add(baseOutline);
      overlayRef.current.push(baseOutline);

      if (el.model_url) {
        loader.load(
          el.model_url,
          (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = 1.3 / maxDim;
            model.scale.setScalar(scale);
            model.position.set(
              pos.x - center.x * scale,
              PEDESTAL_HEIGHT - box.min.y * scale,
              pos.z - center.z * scale
            );
            model.rotation.y = ((el.rotation || 0) * Math.PI) / 180;
            model.userData.elementId = el.id;
            model.userData.elementData = el;
            model.userData.baseScale = scale;
            model.userData.baseY = PEDESTAL_HEIGHT - box.min.y * scale;

            model.traverse((obj) => {
              if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
              }
            });

            if (isSelected) {
              model.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                  obj.material.emissive = new THREE.Color(RED);
                  obj.material.emissiveIntensity = 0.3;
                }
              });
            }

            scene.add(model);
            elementMeshesRef.current.push(model);
          },
          undefined,
          () => createPlaceholder(el, pos, scene, isSelected)
        );
      } else {
        createPlaceholder(el, pos, scene, isSelected);
      }
    });
  }, [elements]);

  // Selection visuals — update rings + emissive WITHOUT reloading models.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    selectionOverlayRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    selectionOverlayRef.current = [];

    const selectedIds = [selectedElementId, selectedElementBId].filter(Boolean);

    elementMeshesRef.current.forEach(mesh => {
      const isSel = selectedIds.includes(mesh.userData.elementId);
      mesh.traverse(obj => {
        if (obj.isMesh && obj.material) {
          obj.material.emissive = new THREE.Color(isSel ? RED : 0x222222);
          obj.material.emissiveIntensity = isSel ? 0.3 : 0.15;
        }
      });

      if (isSel) {
        const pos = mesh.position;
        const selRing = makeSquareOutline(0.55, RED, 0.9);
        selRing.position.set(pos.x, PEDESTAL_HEIGHT + 0.03, pos.z);
        selRing.userData.pulse = true;
        selRing.userData.baseOpacity = 0.9;
        scene.add(selRing);
        selectionOverlayRef.current.push(selRing);

        const torusGeo = new THREE.TorusGeometry(0.45, 0.025, 8, 32);
        const torusMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.8 });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.position.set(pos.x, PEDESTAL_HEIGHT + 0.06, pos.z);
        torus.rotation.x = -Math.PI / 2;
        torus.userData.rotate = true;
        scene.add(torus);
        selectionOverlayRef.current.push(torus);
      }
    });
  }, [selectedElementId, selectedElementBId, elements]);

  // Red ropes — thick cylinders with red sphere nodes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    ropeLinesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    ropeLinesRef.current = [];

    const els = elementsRef.current;
    connections.forEach((conn) => {
      const elemA = els.find(e => e.id === conn.element_a_id);
      const elemB = els.find(e => e.id === conn.element_b_id);
      if (!elemA?.position || !elemB?.position) return;

      const startY = PEDESTAL_HEIGHT + 0.3;
      const endY = PEDESTAL_HEIGHT + 0.3;
      const start = new THREE.Vector3(elemA.position.x, startY, elemA.position.z);
      const end = new THREE.Vector3(elemB.position.x, endY, elemB.position.z);

      const rope = makeRopeMesh(start, end, 0.65);
      rope.userData.connectionId = conn.id;
      scene.add(rope);
      ropeLinesRef.current.push(rope);

      const nodeGeo = new THREE.SphereGeometry(0.1, 12, 12);
      const nodeMat = new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.8 });
      const nodeA = new THREE.Mesh(nodeGeo, nodeMat);
      nodeA.position.copy(start);
      nodeA.userData.connectionId = conn.id;
      scene.add(nodeA);
      ropeLinesRef.current.push(nodeA);

      const nodeB = new THREE.Mesh(nodeGeo, nodeMat.clone());
      nodeB.position.copy(end);
      nodeB.userData.connectionId = conn.id;
      scene.add(nodeB);
      ropeLinesRef.current.push(nodeB);
    });
  }, [connections]);

  // Preview red rope between selected elements A and B
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    previewRopeRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    previewRopeRef.current = [];

    if (!selectedElementId || !selectedElementBId) return;

    const els = elementsRef.current;
    const elemA = els.find(e => e.id === selectedElementId);
    const elemB = els.find(e => e.id === selectedElementBId);
    if (!elemA?.position || !elemB?.position) return;

    const startY = PEDESTAL_HEIGHT + 0.3;
    const endY = PEDESTAL_HEIGHT + 0.3;
    const start = new THREE.Vector3(elemA.position.x, startY, elemA.position.z);
    const end = new THREE.Vector3(elemB.position.x, endY, elemB.position.z);

    const rope = makeRopeMesh(start, end, 0.8, true);
    scene.add(rope);
    previewRopeRef.current.push(rope);

    const nodeGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const nodeMat = new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.8 });
    const nodeA = new THREE.Mesh(nodeGeo, nodeMat);
    nodeA.position.copy(start);
    nodeA.userData.pulse = true;
    nodeA.userData.baseOpacity = 0.9;
    scene.add(nodeA);
    previewRopeRef.current.push(nodeA);

    const nodeB = new THREE.Mesh(nodeGeo, nodeMat.clone());
    nodeB.position.copy(end);
    nodeB.userData.pulse = true;
    nodeB.userData.baseOpacity = 0.9;
    scene.add(nodeB);
    previewRopeRef.current.push(nodeB);
  }, [selectedElementId, selectedElementBId]);

  function createPlaceholder(el, pos, scene, isSelected) {
    const group = new THREE.Group();
    group.position.set(pos.x, PEDESTAL_HEIGHT, pos.z);
    group.rotation.y = ((el.rotation || 0) * Math.PI) / 180;
    group.userData.elementId = el.id;
    group.userData.elementData = el;
    group.userData.baseScale = 1;
    group.userData.baseY = PEDESTAL_HEIGHT;

    const emissiveColor = isSelected ? RED : 0x222222;
    const emissiveIntensity = isSelected ? 0.3 : 0.15;

    const makeMat = (color, roughness = 0.7, metalness = 0.1) => new THREE.MeshLambertMaterial({
      color, emissive: emissiveColor, emissiveIntensity,
    });

    switch (el.element_type) {
      case 'character': {
        const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.85, 4, 12), makeMat(0x3a3a44));
        coat.position.y = 0.75;
        group.add(coat);
        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), makeMat(0x404048));
        shoulders.position.y = 1.2;
        shoulders.scale.set(1, 0.5, 1);
        group.add(shoulders);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), makeMat(0x6a5a4a));
        head.position.y = 1.45;
        group.add(head);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), makeMat(0x1a1a20));
        brim.position.y = 1.56;
        group.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.13, 16), makeMat(0x1a1a20));
        crown.position.y = 1.65;
        group.add(crown);
        break;
      }
      case 'object':
      case 'prop': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.4), makeMat(0x4a3a2a));
        body.position.y = 0.2;
        group.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.07, 0.42), makeMat(0x3a2a1a));
        lid.position.y = 0.41;
        group.add(lid);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 12, Math.PI), makeMat(0x2a2a2a));
        handle.position.set(0, 0.45, 0);
        handle.rotation.x = Math.PI / 2;
        group.add(handle);
        break;
      }
      case 'furniture': {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.6), makeMat(0x4a3a30));
        seat.position.y = 0.38;
        group.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.1), makeMat(0x4a3a30));
        back.position.set(0, 0.7, -0.25);
        group.add(back);
        for (const [sx, sz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.05), makeMat(0x2a2018));
          leg.position.set(sx, 0.19, sz);
          group.add(leg);
        }
        break;
      }
      case 'structure': {
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.55), makeMat(0x4a4038));
        top.position.y = 0.7;
        group.add(top);
        for (const [sx, sz] of [[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), makeMat(0x2a2520));
          leg.position.set(sx, 0.35, sz);
          group.add(leg);
        }
        break;
      }
      case 'nature': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 8), makeMat(0x5a4030));
        trunk.position.y = 0.45;
        group.add(trunk);
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), makeMat(0x3a5a30));
        foliage.position.y = 1.2;
        group.add(foliage);
        break;
      }
      case 'decor': {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.04, 16), makeMat(0x2a2a2a));
        base.position.y = 0.02;
        group.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 8), makeMat(0x3a3a3a));
        pole.position.y = 0.7;
        group.add(pole);
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 16, 1, true), makeMat(0x4a3a28));
        shade.position.y = 1.4;
        group.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0xFFE080 }));
        bulb.position.y = 1.4;
        group.add(bulb);
        break;
      }
      case 'environment':
      default: {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), makeMat(0x5a4a3a));
        crate.position.y = 0.25;
        group.add(crate);
      }
    }

    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    scene.add(group);
    elementMeshesRef.current.push(group);
  }

  const onJoystickStart = (e) => {
    e.preventDefault();
    const base = e.touches ? e.touches[0] : e;
    joystickRef.current = { startX: base.clientX, startY: base.clientY, active: true };
  };
  const onJoystickMove = (e) => {
    if (!joystickRef.current?.active) return;
    e.preventDefault();
    const base = e.touches ? e.touches[0] : e;
    const dx = base.clientX - joystickRef.current.startX;
    const dy = base.clientY - joystickRef.current.startY;
    const max = 50;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const clampedX = (dx / len) * Math.min(len, max) / max;
    const clampedY = (dy / len) * Math.min(len, max) / max;
    touchMoveRef.current = { x: clampedX, z: clampedY };
    setJoyKnob({ x: dx, y: dy });
  };
  const onJoystickEnd = () => {
    joystickRef.current = { active: false };
    touchMoveRef.current = { x: 0, z: 0 };
    setJoyKnob({ x: 0, y: 0 });
  };

  return (
    <div ref={mountRef} className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0a0a]">
          <Loader2 size={28} className="animate-spin" style={{ color: '#00F0FF' }} />
          <p className="text-gray-500 text-xs">Loading gallery…</p>
        </div>
      )}

      <div
        className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 touch-none flex items-center justify-center z-10"
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onMouseDown={onJoystickStart}
        onMouseMove={(e) => joystickRef.current?.active && onJoystickMove(e)}
        onMouseUp={onJoystickEnd}
        onMouseLeave={onJoystickEnd}
      >
        <div
          className="w-7 h-7 rounded-full border-2"
          style={{
            borderColor: '#00F0FF',
            background: 'rgba(0,240,255,0.15)',
            transform: `translate(${joyKnob.x * 0.5}px, ${joyKnob.y * 0.5}px)`,
            transition: joystickRef.current?.active ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {placementMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-yellow-500/30 z-10">
          <p className="text-yellow-400 text-sm font-bold">Tap the ground to place</p>
        </div>
      )}
    </div>
  );
}