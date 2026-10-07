// GAMIQ（ゲーミック） v2 - Three.js Renderer Core

let THREE = null;

const THREE_URL =
  "https://cdn.jsdelivr.net/npm/three@0.169.0/+esm";


export async function loadThree() {
  if (THREE) {
    return THREE;
  }

  try {
    THREE =
      await import(
        THREE_URL
      );

    return THREE;
  } catch (error) {
    console.error(
      "Three.js load failed",
      error
    );

    return null;
  }
}


export class GamiqThreeScene {
  constructor({
    container,
    cameraZ = 7,
    background = 0x05070c
  }) {
    this.container =
      container;

    this.cameraZ =
      cameraZ;

    this.background =
      background;

    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.clock = null;

    this.running = false;

    this.animationId = null;

    this.objects = [];

    this.updateFunctions = [];

    this.resizeObserver = null;

    this.THREE = null;
  }


  async init() {
    this.THREE =
      await loadThree();

    if (
      !this.THREE ||
      !this.container
    ) {
      return false;
    }

    const T =
      this.THREE;


    this.scene =
      new T.Scene();

    this.scene.background =
      new T.Color(
        this.background
      );


    this.camera =
      new T.PerspectiveCamera(
        55,
        1,
        0.1,
        100
      );

    this.camera.position.set(
      0,
      1.2,
      this.cameraZ
    );


    this.renderer =
      new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference:
          "high-performance"
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        1.6
      )
    );

    this.renderer.outputColorSpace =
      T.SRGBColorSpace;

    this.renderer.shadowMap.enabled =
      true;

    this.renderer.shadowMap.type =
      T.PCFSoftShadowMap;


    this.renderer.domElement.className =
      "gamiq-three-canvas";


    this.container.innerHTML = "";

    this.container.appendChild(
      this.renderer.domElement
    );


    this.clock =
      new T.Clock();


    this.addDefaultLights();

    this.resize();

    this.resizeObserver =
      new ResizeObserver(
        () => this.resize()
      );

    this.resizeObserver.observe(
      this.container
    );


    return true;
  }


  addDefaultLights() {
    const T =
      this.THREE;

    if (!T) {
      return;
    }


    const ambient =
      new T.AmbientLight(
        0xffffff,
        1.7
      );

    this.scene.add(
      ambient
    );


    const key =
      new T.DirectionalLight(
        0xffffff,
        2.4
      );

    key.position.set(
      4,
      8,
      5
    );

    key.castShadow =
      true;

    this.scene.add(
      key
    );


    const fill =
      new T.DirectionalLight(
        0x61eaff,
        1.3
      );

    fill.position.set(
      -4,
      2,
      3
    );

    this.scene.add(
      fill
    );
  }


  addFloor({
    width = 14,
    depth = 20,
    color = 0x10151d,
    y = -2
  } = {}) {
    const T =
      this.THREE;

    const geometry =
      new T.PlaneGeometry(
        width,
        depth
      );

    const material =
      new T.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.05
      });

    const floor =
      new T.Mesh(
        geometry,
        material
      );

    floor.rotation.x =
      -Math.PI / 2;

    floor.position.y =
      y;

    floor.receiveShadow =
      true;

    this.scene.add(
      floor
    );

    this.objects.push(
      floor
    );

    return floor;
  }


  addBox({
    width = 1,
    height = 1,
    depth = 1,
    color = 0xffffff,
    x = 0,
    y = 0,
    z = 0
  } = {}) {
    const T =
      this.THREE;

    const geometry =
      new T.BoxGeometry(
        width,
        height,
        depth
      );

    const material =
      new T.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.1
      });

    const mesh =
      new T.Mesh(
        geometry,
        material
      );

    mesh.position.set(
      x,
      y,
      z
    );

    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;

    this.scene.add(
      mesh
    );

    this.objects.push(
      mesh
    );

    return mesh;
  }


  addSphere({
    radius = 1,
    color = 0xffffff,
    x = 0,
    y = 0,
    z = 0
  } = {}) {
    const T =
      this.THREE;

    const geometry =
      new T.SphereGeometry(
        radius,
        24,
        18
      );

    const material =
      new T.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.15
      });

    const mesh =
      new T.Mesh(
        geometry,
        material
      );

    mesh.position.set(
      x,
      y,
      z
    );

    mesh.castShadow =
      true;

    this.scene.add(
      mesh
    );

    this.objects.push(
      mesh
    );

    return mesh;
  }


  addGroup() {
    const group =
      new this.THREE.Group();

    this.scene.add(
      group
    );

    this.objects.push(
      group
    );

    return group;
  }


  addUpdate(
    callback
  ) {
    if (
      typeof callback !==
      "function"
    ) {
      return;
    }

    this.updateFunctions.push(
      callback
    );
  }


  removeUpdate(
    callback
  ) {
    this.updateFunctions =
      this.updateFunctions.filter(
        fn => fn !== callback
      );
  }


  resize() {
    if (
      !this.renderer ||
      !this.camera ||
      !this.container
    ) {
      return;
    }

    const width =
      Math.max(
        1,
        this.container.clientWidth
      );

    const height =
      Math.max(
        1,
        this.container.clientHeight
      );

    this.camera.aspect =
      width / height;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
      false
    );
  }


  start() {
    if (
      this.running ||
      !this.renderer
    ) {
      return;
    }

    this.running =
      true;

    this.clock.start();

    this.animate();
  }


  animate() {
    if (!this.running) {
      return;
    }

    const delta =
      Math.min(
        this.clock.getDelta(),
        0.05
      );

    const elapsed =
      this.clock.elapsedTime;


    for (
      const update of
      this.updateFunctions
    ) {
      try {
        update(
          delta,
          elapsed
        );
      } catch (error) {
        console.error(
          "3D update error",
          error
        );
      }
    }


    this.renderer.render(
      this.scene,
      this.camera
    );


    this.animationId =
      requestAnimationFrame(
        () => this.animate()
      );
  }


  stop() {
    this.running =
      false;

    if (
      this.animationId !== null
    ) {
      cancelAnimationFrame(
        this.animationId
      );

      this.animationId =
        null;
    }
  }


  worldToScreen(
    object
  ) {
    if (
      !object ||
      !this.camera ||
      !this.renderer
    ) {
      return null;
    }

    const vector =
      object.position.clone();

    vector.project(
      this.camera
    );

    const rect =
      this.renderer.domElement
        .getBoundingClientRect();

    return {
      x:
        rect.left +
        (
          vector.x + 1
        ) *
        rect.width /
        2,

      y:
        rect.top +
        (
          -vector.y + 1
        ) *
        rect.height /
        2
    };
  }


  disposeObject(
    object
  ) {
    if (!object) {
      return;
    }

    object.traverse?.(
      child => {

        if (
          child.geometry
        ) {
          child.geometry.dispose?.();
        }

        if (
          child.material
        ) {
          const materials =
            Array.isArray(
              child.material
            )
              ? child.material
              : [child.material];

          materials.forEach(
            material => {

              Object.values(
                material
              ).forEach(
                value => {

                  if (
                    value &&
                    typeof value ===
                      "object" &&
                    typeof value.dispose ===
                      "function"
                  ) {
                    value.dispose();
                  }

                }
              );

              material.dispose?.();
            }
          );
        }

      }
    );


    object.parent?.remove(
      object
    );
  }


  destroy() {
    this.stop();

    this.resizeObserver?.disconnect();

    this.updateFunctions = [];


    for (
      const object of
      this.objects
    ) {
      this.disposeObject(
        object
      );
    }

    this.objects = [];


    if (
      this.renderer
    ) {
      this.renderer.dispose();

      this.renderer.forceContextLoss?.();

      this.renderer.domElement.remove();
    }


    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
  }
}
