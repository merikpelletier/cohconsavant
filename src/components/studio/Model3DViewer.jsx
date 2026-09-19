import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2, Box } from 'lucide-react';

// Interactive three.js viewer for a single .glb model URL.
export default function Model3DViewer({ url, height = 320 }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url || !mountRef.current) return;
    const container = mountRef.current;
    let renderer, scene, camera, controls, animationId;

    const width = container.clientWidth || 300;
    const heightPx = container.clientHeight || height;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.01, 1000);
    camera.position.set(0, 0.5, 3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, heightPx);
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir2.position.set(-3, -2, -3);
    scene.add(dir2);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    setLoading(true);
    setError('');
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        setError(err?.message || 'Failed to load 3D model');
        setLoading(false);
      }
    );

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      controls?.dispose();
      if (renderer?.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer?.dispose();
      scene?.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [url, height]);

  return (
    <div ref={mountRef} className="relative w-full" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 size={24} className="text-red-500 animate-spin" />
          <p className="text-white text-xs">Loading 3D model…</p>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Box size={28} className="text-red-500" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}