import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Loader2, Move, Magnet, Save } from 'lucide-react';
import { loadHeightMapAsNormal, loadAlbedoTexture, createRedWoodTexture } from './museumTextures';

const CYAN = 0x00F0FF;
const RED = 0xFF0000;
const PEDESTAL_HEIGHT = 0.6;
const ROOM = 7;
const WALL_H = 4;
const BOUND = ROOM - 0.6;

export default function GalleryEditorCanvas({ assets, theme, environmentConfig, onPositionChange, onSelectAsset, selectedAssetId, focusAssetId }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const elementMeshesRef = useRef([]);
  const pedestalsRef = useRef([]);
  const glassCoversRef = useRef([]);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraTargetRef = useRef(null);
  const floorRef = useRef(null);
  const wallsRef = useRef([]);
  const glassEnvMapRef = useRef(null);
  const draggingRef = useRef(null);
  const [draggingName, setDraggingName] = useState(null);
  const [snapMode, setSnapMode] = useState(true);

  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;

  const selectedAssetIdRef = useRef(selectedAssetId);
  selectedAssetIdRef.current = selectedAssetId;

  const snapModeRef = useRef(snapMode);
  snapModeRef.current = snapMode;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer, scene, camera, animationId;
    const width = container.clientWidth || 400;
    const heightPx = container.clientHeight || 600;

    scene = new THREE.Scene();
    sceneRef.current = scene;

    const cfg = environmentConfig || {};
    const fogColor = cfg.fog_color || '#08080c';
    const fogDensity = cfg.fog_density || 0.035;
    const ambientColor = cfg.ambient_color || '#1a1510';
    const ambientIntensity = cfg.ambient_intensity || 0.2;
    const spotlightColor = cfg.spotlight_color || '#e6d3a8';
    const spotlightIntensity = cfg.spotlight_intensity || 4.0;
    const floorColor = cfg.floor_color || '#3e2a1d';
    const wallColor = cfg.wall_color || '#1c1815';

    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(new THREE.Color(fogColor), fogDensity);

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

    // No scene.environment — RoomEnvironment was reflecting a teal grid onto the glossy floor.
    // Lighting is handled by ambient + hemisphere + directional + spotlights below.

    // Create an env map ONLY for glass materials (not assigned to scene.environment)
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const glassEnv = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
    glassEnvMapRef.current = glassEnv;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());

    // Lighting
    scene.add(new THREE.AmbientLight(new THREE.Color('#ffffff'), Math.max(ambientIntensity, 0.8)));
    scene.add(new THREE.HemisphereLight(new THREE.Color('#ffffff'), new THREE.Color(floorColor), 0.6));
    const dirLight = new THREE.DirectionalLight(new THREE.Color('#ffffff'), 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Build museum environment
    const buildMuseum = async () => {
      const wallTextureUrl = theme?.wall_texture_url;
      const wallNormalUrl = theme?.wall_normal_url;

      // Always use the user-provided floor texture directly — ignore theme/admin floor texture + normal map
      const floorAlbedo = await loadAlbedoTexture('https://media.appClient.com/images/public/6a677e4bbc6dc07f2ab500cd/f43efe30e_image.png', 6);
      const floorNormal = null;
      const wallAlbedo = wallTextureUrl ? await loadAlbedoTexture(wallTextureUrl, 4) : null;
      const wallNormal = wallNormalUrl ? await loadHeightMapAsNormal(wallNormalUrl, 2.0, 4) : null;
      const floorTint = new THREE.Color('#ffffff');

      // Floor
      const floorMat = new THREE.MeshStandardMaterial({
        color: floorTint,
        roughness: cfg.floor_roughness ?? 0.35,
        metalness: 0.0,
        envMapIntensity: 0,
      });
      if (floorAlbedo) { floorMat.map = floorAlbedo; floorMat.needsUpdate = true; }
      if (floorNormal) { floorMat.normalMap = floorNormal; floorMat.needsUpdate = true; }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.name = 'ground';
      floor.receiveShadow = true;
      scene.add(floor);
      floorRef.current = floor;

      // Walls
      const wallMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wallColor),
        roughness: cfg.wall_roughness ?? 0.9,
        metalness: 0.0,
      });
      if (wallAlbedo) { wallMat.map = wallAlbedo; wallMat.needsUpdate = true; }
      if (wallNormal) { wallMat.normalMap = wallNormal; wallMat.needsUpdate = true; }

      const wallThickness = 0.3;
      const wallGeoNS = new THREE.BoxGeometry(ROOM * 2 + wallThickness, WALL_H, wallThickness);
      const wallGeoEW = new THREE.BoxGeometry(wallThickness, WALL_H, ROOM * 2);
      const wallConfigs = [
        { geo: wallGeoNS, pos: [0, WALL_H / 2, -ROOM], normal: 'south' },
        { geo: wallGeoNS, pos: [0, WALL_H / 2, ROOM], normal: 'north' },
        { geo: wallGeoEW, pos: [-ROOM, WALL_H / 2, 0], normal: 'west' },
        { geo: wallGeoEW, pos: [ROOM, WALL_H / 2, 0], normal: 'east' },
      ];
      wallConfigs.forEach(({ geo, pos, normal }) => {
        const wall = new THREE.Mesh(geo, wallMat);
        wall.position.set(...pos);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.userData.isWall = true;
        wall.userData.wallNormal = normal;
        scene.add(wall);
        wallsRef.current.push(wall);
      });

      // Spotlights
      const bulbColor = new THREE.Color(spotlightColor);
      const spotPositions = [
        [-2, 3.5, -2], [2, 3.5, -2], [-2, 3.5, 2], [2, 3.5, 2], [0, 3.5, 0],
      ];
      spotPositions.forEach(([x, y, z]) => {
        const spot = new THREE.SpotLight(bulbColor, Math.max(spotlightIntensity, 8), 20, Math.PI / 4, 0.5, 1.0);
        spot.position.set(x, y, z);
        spot.target.position.set(x, 0, z);
        spot.castShadow = true;
        spot.shadow.mapSize.set(512, 512);
        spot.shadow.bias = -0.001;
        scene.add(spot);
        scene.add(spot.target);
        const fixtureGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.2, 8);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, y + 0.1, z);
        scene.add(fixture);
        const bulbGeo = new THREE.SphereGeometry(0.05, 10, 10);
        const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: bulbColor }));
        bulb.position.set(x, y - 0.05, z);
        scene.add(bulb);
      });
    };

    buildMuseum().then(() => setLoading(false)).catch(() => setLoading(false));

    // First-person look + movement
    renderer.domElement.style.touchAction = 'none';
    let yaw = 0;
    let pitch = 0;
    const PITCH_LIMIT = Math.PI / 2 - 0.1;
    const LOOK_SENS = 0.003;

    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    const onKeyDown = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in keys) keys[k] = true; };
    const onKeyUp = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in keys) keys[k] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const moveSpeed = 0.18;
    const moveDir = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const isWallAt = (x, z) => Math.abs(x) > BOUND || Math.abs(z) > BOUND;

    // Drag logic
    let lookActive = false;
    let lookLastX = 0, lookLastY = 0;
    let downX = 0, downY = 0, downTime = 0, didDrag = false;
    let dragStart = false;

    const tryStartDrag = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(elementMeshesRef.current, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData.assetId) { obj = obj.parent; }
        if (obj && obj.userData.assetId) {
          draggingRef.current = {
            assetId: obj.userData.assetId,
            mesh: obj,
            surface: obj.userData.surface || 'floor',
          };
          setDraggingName(obj.userData.assetName);
          dragStart = true;
          return true;
        }
      }
      return false;
    };

    const updateDragPosition = (clientX, clientY) => {
      if (!draggingRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const { surface } = draggingRef.current;

      if (surface === 'wall') {
        // Raycast to walls
        const wallHits = raycaster.intersectObjects(wallsRef.current, false);
        if (wallHits.length > 0) {
          const point = wallHits[0].point;
          const snapped = snapModeRef.current ? snapWallPoint(point, wallHits[0].object) : point;
          draggingRef.current.mesh.position.x = snapped.x;
          draggingRef.current.mesh.position.y = snapped.y;
          draggingRef.current.mesh.position.z = snapped.z;
          onPositionChangeRef.current?.(draggingRef.current.assetId, { x: snapped.x, y: snapped.y, z: snapped.z }, 'wall');
        }
      } else {
        // Raycast to floor
        const floorHits = raycaster.intersectObject(floorRef.current, false);
        if (floorHits.length > 0) {
          const point = floorHits[0].point;
          const x = snapModeRef.current ? Math.round(point.x * 2) / 2 : point.x;
          const z = snapModeRef.current ? Math.round(point.z * 2) / 2 : point.z;
          const cx = Math.max(-BOUND, Math.min(BOUND, x));
          const cz = Math.max(-BOUND, Math.min(BOUND, z));
          draggingRef.current.mesh.position.x = cx;
          draggingRef.current.mesh.position.z = cz;
          onPositionChangeRef.current?.(draggingRef.current.assetId, { x: cx, y: 0, z: cz }, 'floor');
        }
      }
    };

    const endDrag = () => {
      if (draggingRef.current) {
        draggingRef.current = null;
        setDraggingName(null);
      }
      dragStart = false;
    };

    const onPointerDown = (e) => {
      lookActive = true;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
      didDrag = false;
      // Try to start drag — if we grab an element, don't look around
      if (tryStartDrag(e.clientX, e.clientY)) {
        lookActive = false;
      }
    };
    const onPointerMove = (e) => {
      if (draggingRef.current) {
        if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) didDrag = true;
        if (!didDrag) return;
        updateDragPosition(e.clientX, e.clientY);
        return;
      }
      if (!lookActive) return;
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
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
      if (draggingRef.current && !didDrag) {
        onSelectAssetRef.current?.(draggingRef.current.assetId);
      }
      endDrag();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    // Touch joystick
    const touchMoveRef = { x: 0, z: 0 };
    let joyActive = false, joyStartX = 0, joyStartY = 0;

    const clock = new THREE.Clock();
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      moveDir.set(0, 0, 0);
      if (keys.w || keys.ArrowUp) moveDir.z -= 1;
      if (keys.s || keys.ArrowDown) moveDir.z += 1;
      if (keys.a || keys.ArrowLeft) moveDir.x -= 1;
      if (keys.d || keys.ArrowRight) moveDir.x += 1;
      if (touchMoveRef.x !== 0 || touchMoveRef.z !== 0) {
        moveDir.x += touchMoveRef.x;
        moveDir.z += touchMoveRef.z;
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

      // Fly camera to focused element
      if (cameraTargetRef.current) {
        const target = cameraTargetRef.current;
        const mesh = elementMeshesRef.current.find(m => m.userData.assetId === target.assetId);
        if (mesh) {
          const tx = mesh.position.x;
          const tz = mesh.position.z;
          const ty = mesh.position.y;
          // Position camera a few units in front of the element
          const dx = camera.position.x - tx;
          const dz = camera.position.z - tz;
          const dist = Math.sqrt(dx * dx + dz * dz) || 1;
          const desiredDist = 2.5;
          const nx = tx + (dx / dist) * desiredDist;
          const nz = tz + (dz / dist) * desiredDist;
          camera.position.x += (nx - camera.position.x) * 0.12;
          camera.position.z += (nz - camera.position.z) * 0.12;
          camera.position.y += (Math.max(1.2, ty + 0.5) - camera.position.y) * 0.12;
          // Look at the element
          const lookTarget = new THREE.Vector3(tx, ty, tz);
          const dir = lookTarget.clone().sub(camera.position).normalize();
          const targetYaw = Math.atan2(-dir.x, -dir.z);
          const targetPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
          yaw += (targetYaw - yaw) * 0.12;
          pitch += (targetPitch - pitch) * 0.12;
          camera.rotation.y = yaw;
          camera.rotation.x = pitch;
          // Stop when close enough
          if (Math.abs(nx - camera.position.x) < 0.05 && Math.abs(nz - camera.position.z) < 0.05) {
            cameraTargetRef.current = null;
          }
        } else {
          cameraTargetRef.current = null;
        }
      }

      // Pulse dragging / selected element
      elementMeshesRef.current.forEach(mesh => {
        const base = mesh.userData.baseScale || 1;
        const userScale = mesh.userData.assetScale || 1;
        // Keep floor objects sitting on the pedestal when scaled
        if (mesh.userData.surface === 'floor' && mesh.userData.boxMinY !== undefined) {
          mesh.position.y = PEDESTAL_HEIGHT - mesh.userData.boxMinY * base * userScale;
        }
        if (draggingRef.current?.mesh === mesh) {
          mesh.scale.setScalar(base * userScale * (1 + Math.sin(elapsed * 6) * 0.05));
        } else if (selectedAssetIdRef.current === mesh.userData.assetId) {
          mesh.scale.setScalar(base * userScale * (1 + Math.sin(elapsed * 4) * 0.03));
        } else {
          mesh.scale.setScalar(base * userScale);
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

    // Expose joystick handlers via ref
    container._joystick = { touchMoveRef, getJoyActive: () => joyActive, setJoyActive: (v) => { joyActive = v; }, joyStart: (x, y) => { joyStartX = x; joyStartY = y; } };

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      resizeObserver.disconnect();
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

  // Load/unload elements — only re-runs when the set of assets changes (IDs + model URLs),
  // NOT when positions change. Prevents duplicate models from overlapping async loads.
  const assetKey = assets.map(a => `${a.id}:${a.model_url || ''}:${a.media_url || ''}:${a.default_surface || 'floor'}:${JSON.stringify(a.texture_files || [])}`).join('|');
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;

    // Clear existing models + pedestals
    [...elementMeshesRef.current, ...pedestalsRef.current, ...glassCoversRef.current].forEach(mesh => {
      scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
    });
    elementMeshesRef.current = [];
    pedestalsRef.current = [];
    glassCoversRef.current = [];

    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const objLoader = new OBJLoader();

    // Builds a LoadingManager that remaps texture filenames to uploaded URLs.
    // Only used for OBJ/FBX — GLB never goes through this.
    const makeTextureManager = (textureFiles) => {
      const manager = new THREE.LoadingManager();
      const fileMap = {};
      (textureFiles || []).forEach(tf => {
        if (tf.filename && tf.url) {
          fileMap[tf.filename.toLowerCase()] = tf.url;
        }
      });
      manager.setURLModifier(url => {
        const filename = url.split('?')[0].split('/').pop().toLowerCase();
        if (fileMap[filename]) return fileMap[filename];
        return url;
      });
      return manager;
    };

    const loadModel = (url, textureFiles, onLoad, onError) => {
      const ext = url.split('?')[0].split('.').pop().toLowerCase();
      const hasTextures = textureFiles && textureFiles.length > 0;

      if (ext === 'obj') {
        const mtlFile = (textureFiles || []).find(tf =>
          tf.filename && tf.filename.toLowerCase().endsWith('.mtl')
        );
        if (mtlFile) {
          const manager = makeTextureManager(textureFiles);
          const mtlLoader = new MTLLoader(manager);
          mtlLoader.load(mtlFile.url, (materials) => {
            materials.preload();
            // Fix: MTLLoader doesn't set colorSpace on diffuse textures — in three.js 0.171+
            // with ColorManagement enabled, textures default to NoColorSpace and render dark/black.
            // Also set DoubleSide to fix OBJ models with inverted normals (black silhouette).
            Object.values(materials.materials).forEach(mat => {
              mat.side = THREE.DoubleSide;
              if (mat.map) { mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.needsUpdate = true; }
              if (mat.emissiveMap) { mat.emissiveMap.colorSpace = THREE.SRGBColorSpace; }
              if (mat.specularMap) { mat.specularMap.colorSpace = THREE.SRGBColorSpace; }
            });
            const objWithMtl = new OBJLoader(manager);
            objWithMtl.setMaterials(materials);
            objWithMtl.load(url, (obj) => onLoad({ scene: obj }), undefined, onError);
          }, undefined, onError);
        } else {
          objLoader.load(url, (obj) => onLoad({ scene: obj }), undefined, onError);
        }
      } else if (ext === 'fbx') {
        if (hasTextures) {
          const manager = makeTextureManager(textureFiles);
          const fbxLoaderWithTex = new FBXLoader(manager);
          fbxLoaderWithTex.load(url, (obj) => onLoad({ scene: obj }), undefined, onError);
        } else {
          fbxLoader.load(url, (obj) => onLoad({ scene: obj }), undefined, onError);
        }
      } else {
        // GLB/GLTF — never use a custom manager
        gltfLoader.load(url, onLoad, undefined, onError);
      }
    };

    assets.forEach((asset, index) => {
      const pos = asset.default_position || getDefaultPosition(asset, index, assets.length);
      const surface = asset.default_surface || 'floor';
      // Wall assets: auto-snap to nearest wall surface so they're always visible and properly mounted
      const position = surface === 'wall'
        ? (() => { const s = snapToNearestWall(pos.x || 0, pos.y || 1.5, pos.z || 0); return new THREE.Vector3(s.x, s.y, s.z); })()
        : new THREE.Vector3(pos.x || 0, PEDESTAL_HEIGHT, pos.z || 0);

      // Pedestal + glass cover for floor elements
      if (surface === 'floor') {
        const pedGeo = new THREE.BoxGeometry(0.7, PEDESTAL_HEIGHT, 0.7);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, metalness: 0.1 });
        const pedestal = new THREE.Mesh(pedGeo, pedMat);
        pedestal.position.set(pos.x || 0, PEDESTAL_HEIGHT / 2, pos.z || 0);
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;
        pedestal.userData.assetId = asset.id;
        scene.add(pedestal);
        pedestalsRef.current.push(pedestal);

      }

      if (asset.model_url) {
        loadModel(
          asset.model_url,
          asset.texture_files,
          (gltf) => {
            if (cancelled) return;
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = 1.3 / maxDim;
            model.scale.setScalar(scale);
            const baseY = surface === 'wall' ? 0 : PEDESTAL_HEIGHT - box.min.y * scale;
            model.position.set(
              position.x - center.x * scale,
              baseY,
              position.z - center.z * scale
            );
            model.rotation.y = ((asset.default_rotation || 0) * Math.PI) / 180;
            model.userData.assetId = asset.id;
            model.userData.assetName = asset.name;
            model.userData.surface = surface;
            model.userData.baseScale = scale;
            model.userData.assetScale = asset.default_scale || 1;
            model.userData.baseY = baseY;
            model.userData.boxMinY = box.min.y;

            model.traverse((obj) => {
              if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                // Fix: ensure DoubleSide for inverted normals + SRGB color space on diffuse maps
                if (obj.material) {
                  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                  mats.forEach(m => {
                    m.side = THREE.DoubleSide;
                    if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; }
                    m.needsUpdate = true;
                  });
                }
              }
            });

            scene.add(model);
            elementMeshesRef.current.push(model);
          },
          undefined,
          (err) => {
            console.error('[GalleryEditor] Model load failed:', asset.name, asset.model_url, err);
            if (cancelled) return;
            const ph = createPlaceholder(asset, position, scene, surface);
            elementMeshesRef.current.push(ph);
          }
        );
      } else if (asset.media_url) {
        // Image-only asset: render as a framed picture on the wall
        const group = new THREE.Group();
        const picW = 1.0;
        const picH = 1.3;
        // Frame backing (dark wood)
        const frameGeo = new THREE.BoxGeometry(picW + 0.12, picH + 0.12, 0.05);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.6, metalness: 0.3 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.z = -0.03;
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);
        // Gold inner border
        const borderGeo = new THREE.BoxGeometry(picW + 0.04, picH + 0.04, 0.06);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.4, metalness: 0.7 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = 0.0;
        group.add(border);
        // Picture plane
        const picGeo = new THREE.PlaneGeometry(picW, picH);
        const tex = new THREE.TextureLoader().load(asset.media_url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
        });
        const picMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.0 });
        const pic = new THREE.Mesh(picGeo, picMat);
        pic.position.z = 0.035;
        group.add(pic);

        group.position.set(position.x, position.y, position.z);
        group.rotation.y = ((asset.default_rotation || 0) * Math.PI) / 180;
        group.userData.assetId = asset.id;
        group.userData.assetName = asset.name;
        group.userData.surface = surface;
        group.userData.baseY = position.y;
        group.userData.assetScale = asset.default_scale || 1;
        scene.add(group);
        elementMeshesRef.current.push(group);
      } else {
        const ph = createPlaceholder(asset, position, scene, surface);
        elementMeshesRef.current.push(ph);
      }
    });

    return () => { cancelled = true; };
  }, [assetKey]);

  // Update positions of existing meshes + pedestals when asset positions change (e.g. during drag)
  useEffect(() => {
    assets.forEach((asset, index) => {
      const pos = asset.default_position || getDefaultPosition(asset, index, assets.length);
      const surface = asset.default_surface || 'floor';

      elementMeshesRef.current.forEach(mesh => {
        if (mesh.userData.assetId === asset.id) {
          if (surface === 'wall') {
            const s = snapToNearestWall(pos.x || 0, pos.y || 1.5, pos.z || 0);
            mesh.position.x = s.x;
            mesh.position.y = s.y;
            mesh.position.z = s.z;
          } else {
            mesh.position.x = pos.x || 0;
            mesh.position.z = pos.z || 0;
            mesh.position.y = mesh.userData.baseY ?? PEDESTAL_HEIGHT;
          }
          mesh.rotation.y = ((asset.default_rotation || 0) * Math.PI) / 180;
          mesh.userData.assetScale = asset.default_scale || 1;
        }
      });
      pedestalsRef.current.forEach(ped => {
        if (ped.userData.assetId === asset.id) {
          ped.position.x = pos.x || 0;
          ped.position.z = pos.z || 0;
          ped.visible = surface === 'floor';
        }
      });
});
  }, [assets]);

  // Focus camera on an element when focusAssetId changes
  useEffect(() => {
    if (focusAssetId) {
      cameraTargetRef.current = { assetId: focusAssetId };
    }
  }, [focusAssetId]);

  // Joystick handlers
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyRef = useRef({ active: false });
  const onJoystickStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const base = e.touches ? e.touches[0] : e;
    joyRef.current = { startX: base.clientX, startY: base.clientY, active: true };
  };
  const onJoystickMove = (e) => {
    if (!joyRef.current?.active) return;
    e.preventDefault();
    e.stopPropagation();
    const base = e.touches ? e.touches[0] : e;
    const dx = base.clientX - joyRef.current.startX;
    const dy = base.clientY - joyRef.current.startY;
    const max = 50;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const clampedX = (dx / len) * Math.min(len, max) / max;
    const clampedY = (dy / len) * Math.min(len, max) / max;
    const container = mountRef.current;
    if (container?._joystick) {
      container._joystick.touchMoveRef.x = clampedX;
      container._joystick.touchMoveRef.z = clampedY;
    }
    setJoyKnob({ x: dx, y: dy });
  };
  const onJoystickEnd = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    joyRef.current = { active: false };
    const container = mountRef.current;
    if (container?._joystick) {
      container._joystick.touchMoveRef.x = 0;
      container._joystick.touchMoveRef.z = 0;
    }
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

      {/* Top toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <button
          onClick={() => setSnapMode(!snapMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border transition-colors ${
            snapMode
              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
              : 'bg-black/60 border-white/10 text-white/60'
          }`}
        >
          <Magnet size={12} /> Snap {snapMode ? 'ON' : 'OFF'}
        </button>
        {draggingName && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/30 border border-red-500/40 backdrop-blur-md text-red-300 text-xs font-bold">
            <Move size={12} /> {draggingName}
          </div>
        )}
      </div>

      {/* Joystick */}
      <div
        className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 touch-none flex items-center justify-center z-10"
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onMouseDown={onJoystickStart}
        onMouseMove={(e) => joyRef.current?.active && onJoystickMove(e)}
        onMouseUp={onJoystickEnd}
        onMouseLeave={onJoystickEnd}
      >
        <div
          className="w-7 h-7 rounded-full border-2"
          style={{
            borderColor: '#00F0FF',
            background: 'rgba(0,240,255,0.15)',
            transform: `translate(${joyKnob.x * 0.5}px, ${joyKnob.y * 0.5}px)`,
            transition: joyRef.current?.active ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>
    </div>
  );
}

function createLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, 250, 58);
  ctx.fillStyle = '#e6d3a8';
  ctx.font = 'bold 22px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxChars = 22;
  const displayText = text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : text;
  ctx.fillText(displayText, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function findNearestWall(x, z) {
  const distSouth = Math.abs(z - (-ROOM));
  const distNorth = Math.abs(z - ROOM);
  const distWest = Math.abs(x - (-ROOM));
  const distEast = Math.abs(x - ROOM);
  const min = Math.min(distSouth, distNorth, distWest, distEast);
  if (min === distSouth) return 'south';
  if (min === distNorth) return 'north';
  if (min === distWest) return 'west';
  return 'east';
}

function snapToNearestWall(x, y, z) {
  const wall = findNearestWall(x, z);
  let nx = x, ny = y, nz = z;
  if (wall === 'north') nz = ROOM - 0.16;
  if (wall === 'south') nz = -ROOM + 0.16;
  if (wall === 'east') nx = ROOM - 0.16;
  if (wall === 'west') nx = -ROOM + 0.16;
  ny = Math.max(0.5, Math.min(WALL_H - 0.5, y));
  if (wall === 'north' || wall === 'south') {
    nx = Math.round(nx * 2) / 2;
  } else {
    nz = Math.round(nz * 2) / 2;
  }
  return { x: nx, y: ny, z: nz, wall };
}

function snapWallPoint(point, wall) {
  const normal = wall.userData.wallNormal;
  let x = point.x, y = point.y, z = point.z;
  // Snap to wall surface
  if (normal === 'north') z = ROOM - 0.16;
  if (normal === 'south') z = -ROOM + 0.16;
  if (normal === 'east') x = ROOM - 0.16;
  if (normal === 'west') x = -ROOM + 0.16;
  // Snap Y and the other axis
  y = Math.max(0.5, Math.min(WALL_H - 0.5, y));
  if (normal === 'north' || normal === 'south') {
    x = Math.round(x * 2) / 2;
  } else {
    z = Math.round(z * 2) / 2;
  }
  return { x, y, z };
}

function getDefaultPosition(asset, index, total) {
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const spacing = (BOUND * 2) / Math.max(cols, 1);
  const x = col * spacing - BOUND + spacing / 2;
  const z = row * spacing - BOUND + spacing / 2;
  return { x, y: 0, z };
}

function createPlaceholder(asset, position, scene, surface) {
  const group = new THREE.Group();
  const baseY = surface === 'wall' ? 0 : PEDESTAL_HEIGHT;
  group.position.set(position.x, baseY, position.z);
  group.rotation.y = ((asset.default_rotation || 0) * Math.PI) / 180;
  group.userData.assetId = asset.id;
  group.userData.assetName = asset.name;
  group.userData.surface = surface;
  group.userData.baseScale = 1;
  group.userData.assetScale = asset.default_scale || 1;

  const emissiveColor = 0x222222;
  const makeMat = (color, roughness = 0.7, metalness = 0.1) => new THREE.MeshLambertMaterial({
    color, emissive: emissiveColor, emissiveIntensity: 0.15,
  });

  switch (asset.asset_type) {
    case 'character': {
      const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.85, 4, 12), makeMat(0x3a3a44));
      coat.position.y = 0.75;
      group.add(coat);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), makeMat(0x6a5a4a));
      head.position.y = 1.45;
      group.add(head);
      break;
    }
    case 'decor': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.04, 16), makeMat(0x2a2a2a));
      base.position.y = 0.02;
      group.add(base);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 16, 1, true), makeMat(0x4a3a28));
      shade.position.y = 0.4;
      group.add(shade);
      break;
    }
    default: {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), makeMat(0x5a4a3a));
      crate.position.y = 0.25;
      group.add(crate);
    }
  }

  group.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
  scene.add(group);
  // Note: placeholders aren't added to elementMeshesRef so they can't be dragged
  // But we need them to be draggable — fix:
  return group;
}
