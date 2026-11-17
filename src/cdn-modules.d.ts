declare module 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js' {
  import type * as THREE from 'three';
  export = THREE;
}

declare module 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js' {
  import type * as THREE from 'three';
  export class RoomEnvironment extends THREE.Scene {}
}
