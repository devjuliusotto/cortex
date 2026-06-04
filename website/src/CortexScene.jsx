import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function CortexScene() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.3, 7.6);

    const clock = new THREE.Clock();
    const group = new THREE.Group();
    group.position.set(-2.1, 0.08, 0);
    group.scale.setScalar(1.08);
    scene.add(group);

    const cyan = new THREE.Color("#56f0ff");
    const green = new THREE.Color("#7af7a6");
    const dark = new THREE.Color("#0b0d10");

    const coreGeometry = new THREE.IcosahedronGeometry(1.15, 5);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: dark,
      roughness: 0.38,
      metalness: 0.78,
      emissive: cyan,
      emissiveIntensity: 0.12,
      wireframe: false,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const wire = new THREE.Mesh(
      coreGeometry,
      new THREE.MeshBasicMaterial({
        color: cyan,
        transparent: true,
        opacity: 0.17,
        wireframe: true,
      }),
    );
    wire.scale.setScalar(1.012);
    group.add(wire);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: cyan,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });

    const rings = [0, 1, 2].map(index => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + index * 0.56, 0.009, 12, 160), ringMaterial.clone());
      ring.rotation.x = Math.PI / 2 + index * 0.46;
      ring.rotation.y = index * 0.62;
      group.add(ring);
      return ring;
    });

    const pathMaterial = new THREE.LineBasicMaterial({
      color: green,
      transparent: true,
      opacity: 0.34,
    });
    const pathGroup = new THREE.Group();
    for (let i = 0; i < 18; i += 1) {
      const y = -2.7 + i * 0.32;
      const points = [
        new THREE.Vector3(-4.8, y, -1.2 + Math.sin(i) * 0.45),
        new THREE.Vector3(-2.4, y + Math.sin(i * 0.9) * 0.18, -0.7),
        new THREE.Vector3(0.2, y + Math.cos(i) * 0.12, -0.2),
        new THREE.Vector3(3.9, y + Math.sin(i * 1.7) * 0.18, -1.1),
      ];
      pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), pathMaterial));
    }
    group.add(pathGroup);

    const particleCount = 620;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 3 + Math.random() * 4.2;
      const angle = Math.random() * Math.PI * 2;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 5.4;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius - 1.8;
    }

    const particles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(particlePositions, 3)),
      new THREE.PointsMaterial({
        color: cyan,
        size: 0.025,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    group.add(particles);

    const ambient = new THREE.AmbientLight(0x9fdcff, 1.1);
    const key = new THREE.PointLight(0x56f0ff, 16, 12);
    key.position.set(-2.3, 1.4, 3.4);
    const rim = new THREE.PointLight(0x7af7a6, 10, 10);
    rim.position.set(3, -1.6, 2);
    scene.add(ambient, key, rim);

    function resize() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const interaction = {
      scroll: 0,
      impulse: 0,
    };

    host.style.setProperty("--scene-dim", "0");

    let frameId = 0;
    const still = reducedMotion();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      const speed = still ? 0 : elapsed;
      interaction.impulse *= 0.94;
      const pulse = still ? 0 : interaction.impulse;

      group.rotation.y = -0.38 + Math.sin(speed * 0.18) * 0.09;
      group.rotation.x = Math.sin(speed * 0.12) * 0.045;
      group.position.y = 0.18;
      group.position.x = -2.1;
      core.rotation.y = speed * (0.22 + pulse * 0.5);
      core.rotation.x = speed * 0.12;
      const fade = 0.84;
      core.material.emissiveIntensity = (0.12 + pulse * 0.28) * fade;
      wire.rotation.y = -speed * (0.16 + pulse * 0.7);
      wire.material.opacity = (0.17 + pulse * 0.16) * fade;
      particles.rotation.y = speed * 0.025;
      particles.material.opacity = (0.34 + pulse * 0.16) * fade;
      pathGroup.position.x = Math.sin(speed * 0.4) * 0.18;
      pathGroup.rotation.z = 0;

      rings.forEach((ring, index) => {
        ring.rotation.z = speed * (0.12 + index * 0.045 + pulse * 0.22);
        ring.scale.setScalar(1 + pulse * 0.08);
        ring.material.opacity = (0.22 + Math.sin(speed + index) * 0.08 + pulse * 0.1) * fade;
      });

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      host.removeChild(renderer.domElement);
      scene.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material?.dispose?.();
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div className="cortexScene" aria-hidden="true" ref={hostRef}>
      <div className="sceneFallback" />
    </div>
  );
}
