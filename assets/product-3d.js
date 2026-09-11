(function () {
  'use strict';
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const subtract = (a, b) => a.map((value, i) => value - b[i]);
  function normalize(vector) {
    const length = Math.hypot(...vector);
    if (!Number.isFinite(length) || length < 1e-9) throw new TypeError('Degenerate mesh segment');
    return vector.map(value => value / length);
  }
  function triangle(output, a, b, c) { output.push(...a, ...b, ...c); }

  function buildTube(points, radius = .026, sides = 10, flattenedFeet = false) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 512) throw new TypeError('Invalid tube path');
    if (!Number.isFinite(radius) || radius <= 0 || radius > 1) throw new TypeError('Invalid tube radius');
    if (!Number.isInteger(sides) || sides < 3 || sides > 32) throw new TypeError('Invalid tube sides');
    if (typeof flattenedFeet !== 'boolean') throw new TypeError('Invalid tube foot profile');
    points.forEach((point, i) => {
      if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new TypeError('Invalid tube point');
      if (i && Math.hypot(...subtract(point, points[i - 1])) < 1e-8) throw new TypeError('Degenerate tube segment');
    });
    const rings = points.map((point, i) => {
      const tangent = normalize(subtract(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]));
      const first = normalize(cross(tangent, Math.abs(tangent[2]) < .9 ? [0, 0, 1] : [0, 1, 0]));
      const second = cross(tangent, first);
      return Array.from({ length: sides }, (_, j) => {
        const theta = j / sides * Math.PI * 2;
        const compression = flattenedFeet ? .65 + .35 * Math.min(1, i / 10, (points.length - 1 - i) / 10) : 1;
        const normal = first.map((value, axis) => value * Math.cos(theta) + second[axis] * Math.sin(theta) * compression);
        const twist = 1 + .08 * Math.cos(theta * 2 - i * .12) + .012 * Math.sin(theta * 3 + i * .27);
        return [...point.map((value, axis) => value + radius * twist * normal[axis]), ...normal, .90];
      });
    });
    // Normals follow the actual twisted tube, so ridges catch light instead of appearing painted on.
    rings.forEach((ring, i) => ring.forEach((vertex, j) => {
      const along = subtract(rings[Math.min(i + 1, rings.length - 1)][j].slice(0, 3), rings[Math.max(0, i - 1)][j].slice(0, 3));
      const around = subtract(ring[(j + 1) % sides].slice(0, 3), ring[(j + sides - 1) % sides].slice(0, 3));
      vertex.splice(3, 3, ...normalize(cross(around, along)));
    }));
    const vertices = [];
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
      const next = (j + 1) % sides;
      triangle(vertices, rings[i][j], rings[i + 1][next], rings[i + 1][j]);
      triangle(vertices, rings[i][j], rings[i][next], rings[i + 1][next]);
    }
    return new Float32Array(vertices);
  }

  function buildBag(type = 'twisted') {
    if (!['twisted', 'flat', 'sos'].includes(type)) throw new TypeError('Unsupported product');
    const vertices = [], handles = [], patches = [], gussets = [], seams = [];
    function surface(point, columns, rows, tone, reverse = false) {
      const grid = [];
      for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
        const u = x / columns, v = y / rows, step = .0001;
        const du = subtract(point(Math.min(1, u + step), v), point(Math.max(0, u - step), v));
        const dv = subtract(point(u, Math.min(1, v + step)), point(u, Math.max(0, v - step)));
        const normal = normalize(cross(normalize(du), normalize(dv))).map(value => reverse ? -value : value);
        grid.push([...point(u, v), ...normal, typeof tone === 'function' ? tone(u, v) : tone]);
      }
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const a = grid[y * (columns + 1) + x], b = grid[y * (columns + 1) + x + 1];
        const c = grid[(y + 1) * (columns + 1) + x + 1], d = grid[(y + 1) * (columns + 1) + x];
        triangle(vertices, a, reverse ? c : b, reverse ? b : c);
        triangle(vertices, a, reverse ? d : c, reverse ? c : d);
      }
    }
    const width = v => .865 + .095 * v;
    const depth = v => .29 + .12 * v;
    const height = (u, v) => -1.05 + 1.93 * v + .004 * Math.sin(u * Math.PI * 7) * v
      + (type === 'sos' ? .018 * Math.sin(u * Math.PI) * Math.sin(u * 8 + .7) * Math.pow(v, 9) : 0);
    function panel(u, v, side, inside = false) {
      const envelope = Math.sin(u * Math.PI);
      const foot = Math.min(1, v * 16), edge = Math.min(u, 1 - u);
      const crease = -(type === 'sos' ? .022 : .016) * Math.exp(-Math.pow((v - (type === 'sos' ? .20 : .25) - .008 * envelope - .01 * u) * 25, 2)) * envelope * foot;
      const diagonal = -(type === 'sos' ? .021 : .015) * Math.exp(-Math.pow((v - .22 + .7 * edge) * 38, 2))
        * Math.exp(-Math.pow(edge / .29, 4)) * Math.min(1, edge * 14) * foot;
      const relaxed = envelope * Math.sin(v * Math.PI);
      const bow = (type === 'sos' ? .034 : .018) * (1 + side * .13) * relaxed;
      const handling = (.007 * Math.sin(u * 8.5 + side * .7) - .012 * Math.exp(-Math.pow((u - .3 - .2 * v - side * .035) * 23, 2))) * relaxed;
      const fibre = .0012 * Math.sin(u * 41 + v * 7) * Math.sin(v * 19) * relaxed;
      const lip = type === 'sos' ? -.04 * envelope * (.6 + .4 * Math.sin(u * 4.4 + side)) * Math.pow(v, 7) : 0;
      return [(u * 2 - 1) * width(v), height(u, v), side * (depth(v) + bow + crease + diagonal + handling + fibre + lip - (inside ? .006 : 0))];
    }
    function gusset(u, v, side, inside = false) {
      const pleat = 1 - Math.abs(2 * u - 1), foot = Math.min(1, v * 16);
      const fold = (type === 'sos' ? .108 + .012 * Math.sin(v * 5 + side * .7) : .145) * pleat * Math.min(1, v * 4) * (.72 + .28 * v);
      const diagonal = (type === 'sos' ? .032 : .018) * Math.exp(-Math.pow((v - .22 * pleat) * 34, 2)) * pleat * foot;
      return [side * (width(v) - fold - diagonal - (inside ? .006 : 0)), height(u, v), (1 - 2 * u) * depth(v)];
    }
    [-1, 1].forEach(side => {
      surface((u, v) => panel(u, v, side), 28, 32, 1, side < 0);
      surface((u, v) => panel(u, v, side, true), 28, 32, (_, v) => .52 + .25 * Math.sqrt(v), side > 0);
      const gussetStart = vertices.length / 7;
      // Separate halves retain the crease normal instead of rounding the V into a smooth valley.
      [0, 1].forEach(half => {
        surface((u, v) => gusset((half + u) / 2, v, side), 6, 24, .9, side < 0);
        surface((u, v) => gusset((half + u) / 2, v, side, true), 6, 24,
          (u, v) => .48 + .25 * Math.sqrt(v) - .035 * Math.sin((half + u) / 2 * Math.PI), side > 0);
      });
      gussets.push({ start: gussetStart, count: vertices.length / 7 - gussetStart });
      // The narrow top rims and interior surfaces give the opening actual paper thickness.
      surface((u, v) => {
        const p = panel(u, 1, side); return [p[0], p[1], p[2] - side * .006 * v];
      }, 28, 1, 1.03, side < 0);
      surface((u, v) => {
        const p = gusset(u, 1, side); return [p[0] - side * .006 * v, p[1], p[2]];
      }, 12, 1, .94, side < 0);
      if (type === 'twisted') [-1, 1].forEach(foot => {
        const start = vertices.length / 7;
        surface((u, v) => {
          const heightRatio = .78 + v * .19;
          const x = foot * .425 + (u - .5) * .24;
          const p = panel((x / width(heightRatio) + 1) / 2, heightRatio, side, true);
          const cover = .004 + .029 * Math.exp(-Math.pow((x - foot * .425) / .038, 2));
          return [p[0], p[1], p[2] - side * cover];
        }, 12, 6, .80, side > 0);
        patches.push({ start, count: vertices.length / 7 - start });
      });
    });
    // A paper-thin glued lap sits on the rear wall; the underlying wall remains continuous.
    const seamStart = vertices.length / 7;
    const seam = (u, v, lift = .003) => {
      const p = panel(.77 + .024 * u, v, -1);
      return [p[0], p[1], p[2] - lift];
    };
    surface((u, v) => seam(u, v), 2, 32, .94, true);
    [0, 1].forEach(edge => {
      surface((u, v) => seam(edge, u, .003 * v), 32, 1, .88, edge > 0);
      surface((u, v) => seam(u, edge, .003 * v), 2, 1, .98, edge < 1);
    });
    seams.push({ start: seamStart, count: vertices.length / 7 - seamStart });
    surface((u, v) => [(u * 2 - 1) * .865, -1.05, (v * 2 - 1) * .29], 1, 1, .8);
    surface((u, v) => [(u * 2 - 1) * .865, -1.036, (v * 2 - 1) * .29], 1, 1, .55, true);
    if (type !== 'sos') [-1, 1].forEach(side => {
      const attachmentDepth = (x, y, fold = 0) => {
        const v = Math.max(0, Math.min(1, (y + 1.05) / 1.93));
        const p = panel((x / width(v) + 1) / 2, v, side, type === 'twisted');
        const rise = .052 * Math.max(0, Math.min(1, (y - .88) / .7));
        const release = Math.max(0, Math.min(1, (y - .88) / .18));
        // Move flat tails behind the paper wall; blend above the rim into the unchanged upper grip.
        const inset = type === 'flat' ? .012 * (1 - release * release * (3 - 2 * release)) : 0;
        return p[2] + side * (rise + fold + (type === 'twisted' ? -.013 : .003) - inset);
      };
      const start = vertices.length / 7;
      if (type === 'twisted') {
        const path = Array.from({ length: 97 }, (_, i) => {
          const t = i / 96, s = 1 - t;
          const x = -.425 * s * s * s - 1.38 * s * s * t + 1.29 * s * t * t + .425 * t * t * t + .022 * Math.sin(Math.PI * t);
          const y = .56 + 4.3 * s * t + .035 * Math.sin(Math.PI * 2 * t) + side * .018 * Math.sin(Math.PI * t);
          return [x, y, attachmentDepth(x, y)];
        });
        vertices.push(...buildTube(path, .016, 12, true));
      } else {
        // Short folded handles retain rectangular tails pasted against the inner walls.
        const corners = [[-.375, .56, 0], [-.375, .865, 0], [-.375 + side * .003, 1.247 + side * .007, .005], [-.278, 1.397 + side * .016, .012],
          [.267, 1.383 - side * .009, -.002], [.375 + side * .002, 1.244 - side * .006, .003], [.375, .865, 0], [.375, .56, 0]];
        const path = [];
        // Small rounded folds keep the paper-strip silhouette without hard machined miters.
        corners.forEach((point, index) => {
          if (index < 2 || index > 5) { path.push(point); return; }
          const before = subtract(corners[index - 1], point), after = subtract(corners[index + 1], point);
          // Equal-length trims keep the inner bend wider than the paper strip's half-width.
          const trim = Math.min(.052, Math.hypot(...before) / 3, Math.hypot(...after) / 3);
          const entry = normalize(before).map((value, axis) => point[axis] + value * trim);
          const exit = normalize(after).map((value, axis) => point[axis] + value * trim);
          for (let step = 0; step <= 4; step++) {
            const t = step / 4;
            path.push(point.map((value, axis) => entry[axis] * (1 - t) ** 2 + 2 * value * t * (1 - t) + exit[axis] * t * t));
          }
        });
        const laterals = path.slice(1).map((p, i) => normalize([p[1] - path[i][1], path[i][0] - p[0], 0]));
        const miters = path.map((_, i) => {
          const before = laterals[Math.max(0, i - 1)], after = laterals[Math.min(laterals.length - 1, i)];
          const normal = normalize(before.map((value, axis) => value + after[axis]));
          const projection = normal[0] * before[0] + normal[1] * before[1];
          return normal.map(value => value / projection);
        });
        const ribbon = (segment, u, v, thickness) => {
          const p = path[segment], q = path[segment + 1], offset = (u - .5) * .14;
          const x = (p[0] + miters[segment][0] * offset) * (1 - v) + (q[0] + miters[segment + 1][0] * offset) * v;
          let y = (p[1] + miters[segment][1] * offset) * (1 - v) + (q[1] + miters[segment + 1][1] * offset) * v;
          y -= .026 * Math.max(0, 1 - (x / .31) ** 2) * Math.max(0, Math.min(1, (y - 1.24) / .10));
          const release = Math.max(0, Math.min(1, (y - .88) / .28));
          const curl = release * release * (3 - 2 * release) * Math.sin(u * Math.PI) * (.007 + .004 * Math.sin(x * 4 + y * 3 + side));
          return [x, y, attachmentDepth(x, y, p[2] * (1 - v) + q[2] * v) + side * curl + thickness];
        };
        for (let segment = 0; segment < path.length - 1; segment++) {
          const tail = segment === 0 || segment === path.length - 2, tailStart = vertices.length / 7;
          const rows = Math.max(2, Math.ceil(Math.hypot(...subtract(path[segment + 1], path[segment])) * 24));
          surface((u, v) => ribbon(segment, u, v, .002), 4, rows, .94);
          surface((u, v) => ribbon(segment, u, v, -.002), 4, rows, .88, true);
          [0, 1].forEach(edge => surface((u, v) => ribbon(segment, edge, u, (v - .5) * .004), rows, 1, .82, edge === 0));
          if (segment === 0) surface((u, v) => ribbon(segment, u, 0, (v - .5) * .004), 2, 1, .86);
          if (segment === path.length - 2) surface((u, v) => ribbon(segment, u, 1, (v - .5) * .004), 2, 1, .86, true);
          if (tail) patches.push({ start: tailStart, count: vertices.length / 7 - tailStart });
        }
      }
      handles.push({ start, count: vertices.length / 7 - start });
    });
    if (type === 'sos') {
      // The SOS grocery silhouette is taller and narrower; inverse scaling preserves normal directions.
      for (let i = 0; i < vertices.length; i += 7) {
        vertices[i] *= .7; vertices[i + 1] = vertices[i + 1] * 1.25 + .32; vertices[i + 2] *= .95;
        const normal = normalize([vertices[i + 3] / .7, vertices[i + 4] / 1.25, vertices[i + 5] / .95]);
        for (let axis = 0; axis < 3; axis++) vertices[i + 3 + axis] = normal[axis];
      }
    }
    if (type === 'flat') {
      // Landscape proportions apply only to this reference model; keep its visual centre in the existing camera.
      for (let i = 0; i < vertices.length; i += 7) {
        vertices[i] *= 1.12; vertices[i + 1] = vertices[i + 1] * .86 + .1;
        const normal = normalize([vertices[i + 3] / 1.12, vertices[i + 4] / .86, vertices[i + 5]]);
        for (let axis = 0; axis < 3; axis++) vertices[i + 3 + axis] = normal[axis];
      }
    }
    return { vertices: new Float32Array(vertices), handles, patches, gussets, seams };
  }

  function buildPaperTexture() {
    const size = 256, heights = new Float32Array(size * size), pixels = new Uint8Array(size * size * 4);
    let seed = 21871;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const at = (x, y) => ((y + size) % size) * size + ((x + size) % size);
    const cells = Float32Array.from({ length:64 }, () => .25 + random() * .5);
    const formation = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
      const tx = x / 32 - cx, ty = y / 32 - cy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const cell = (dx, dy) => cells[((cy + dy) % 8) * 8 + (cx + dx) % 8];
      const formed = (cell(0, 0) * (1 - sx) + cell(1, 0) * sx) * (1 - sy) + (cell(0, 1) * (1 - sx) + cell(1, 1) * sx) * sy;
      formation[at(x, y)] = formed;
      heights[at(x, y)] = .42 + random() * .14 + formed * .12;
    }
    for (let fibre = 0; fibre < 1400; fibre++) {
      const x = random() * size, y = random() * size, length = 3 + Math.floor(random() * 12);
      const slant = (random() - .5) * 1.7, relief = (random() - .5) * .12;
      for (let step = 0; step < length; step++) heights[at(Math.floor(x + step * slant), Math.floor(y + step))] += relief * Math.sin(Math.PI * step / length);
    }
    const byte = value => Math.round(Math.max(0, Math.min(255, value)));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const index = at(x, y), offset = index * 4;
      pixels[offset] = byte(heights[index] * 255);
      pixels[offset + 1] = byte(128 + (heights[at(x + 1, y)] - heights[at(x - 1, y)]) * 190);
      pixels[offset + 2] = byte(128 + (heights[at(x, y + 1)] - heights[at(x, y - 1)]) * 190);
      // Alpha is material data, not transparency: broad fibre formation varies matte response.
      pixels[offset + 3] = byte(formation[index] * 255);
    }
    return { width: size, height: size, pixels };
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
    return out;
  }
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aTone;
    uniform mediump mat4 uModel;
    uniform mat4 uMVP;
    varying mediump vec3 vNormal;
    varying mediump vec3 vPosition;
    varying mediump vec3 vObject;
    varying mediump float vTone;
    void main() {
      vec4 position = vec4(aPosition - vec3(0.0, 0.28, 0.0), 1.0);
      vNormal = aNormal;
      vPosition = (uModel * position).xyz;
      vObject = aPosition;
      vTone = aTone;
      gl_Position = uMVP * position;
    }`;
  const fragmentShader = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform mediump mat4 uModel;
    uniform sampler2D uPaper;
    uniform float uCameraDistance;
    varying mediump vec3 vNormal;
    varying mediump vec3 vPosition;
    varying mediump vec3 vObject;
    varying mediump float vTone;
    void main() {
      vec3 objectNormal = normalize(vNormal);
      vec3 weights = pow(abs(objectNormal), vec3(6.0));
      weights /= max(weights.x + weights.y + weights.z, 0.001);
      vec4 front = texture2D(uPaper, vObject.xy * vec2(2.0, 2.2));
      vec4 side = texture2D(uPaper, vObject.zy * vec2(2.0, 2.2));
      vec4 base = texture2D(uPaper, vObject.xz * 2.0);
      vec3 relief = vec3(front.g - 0.5, front.b - 0.5, 0.0) * weights.z
        + vec3(0.0, side.b - 0.5, side.g - 0.5) * weights.x
        + vec3(base.g - 0.5, 0.0, base.b - 0.5) * weights.y;
      relief -= objectNormal * dot(relief, objectNormal);
      vec3 n = normalize(mat3(uModel) * normalize(objectNormal - relief * 0.22));
      vec3 light = normalize(vec3(-0.65, 1.0, 1.3));
      vec3 fill = normalize(vec3(1.0, 0.35, -0.4));
      vec3 rim = normalize(vec3(-0.3, 0.8, -1.0));
      float diffuse = max(dot(n, light), 0.0) * 0.65 + max(dot(n, normalize(vec3(-1.4, 0.6, 1.5))), 0.0) * 0.35;
      float bounce = max(dot(n, fill), 0.0);
      float grain = front.r * weights.z + side.r * weights.x + base.r * weights.y;
      float formation = front.a * weights.z + side.a * weights.x + base.a * weights.y;
      float variation = 0.94 + grain * 0.12 + (formation - 0.5) * 0.035;
      vec3 kraft = vec3(0.65, 0.50, 0.33) * variation * vTone;
      vec3 ambient = mix(vec3(0.67, 0.63, 0.55), vec3(0.79, 0.80, 0.78), n.y * 0.5 + 0.5);
      vec3 illumination = ambient * 0.58 + vec3(1.0, 0.96, 0.88) * diffuse * 0.75
        + vec3(0.87, 0.93, 1.0) * bounce * 0.20 + vec3(0.93, 0.98, 1.0) * max(dot(n, rim), 0.0) * 0.11;
      vec3 view = normalize(vec3(0.0, 0.0, uCameraDistance) - vPosition);
      float sheen = pow(max(dot(n, normalize(light + view)), 0.0), mix(12.0, 6.0, formation));
      vec3 color = kraft * illumination + vec3(0.016, 0.014, 0.011) * sheen;
      gl_FragColor = vec4(pow(max(color, vec3(0.0)), vec3(0.85)), 1.0);
    }`;

  function mount(canvas) {
    if (!canvas?.getContext || typeof window === 'undefined') return null;
    const cleanups = [], resources = [];
    let gl, program, buffer, mesh, locations, resizeObserver, visibilityObserver;
    let frame = 0, lastTime = 0, rotation = -.42, visible = false, paused = false, destroyed = false, failed = false, validated = false, pointer;
    let product = 'twisted', dirty = false;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function on(target, name, callback, options) {
      target?.addEventListener(name, callback, options);
      cleanups.push(() => target?.removeEventListener(name, callback, options));
    }
    function stop() { if (frame) window.cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      cleanups.forEach(remove => remove());
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      if (gl && !gl.isContextLost()) resources.forEach(([type, resource]) => gl[type](resource));
    }
    function fail() {
      if (failed) return;
      failed = true;
      destroy();
      canvas.dispatchEvent(new window.CustomEvent('pd3d:unavailable'));
    }
    function render() {
      if (destroyed || !program) return false;
      try {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
        const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / width, 4096 / height);
        const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
        const aspect = width / height, focal = 1 / Math.tan(32 * Math.PI / 360);
        const distance = Math.max(5.7, 3.4 / Math.max(aspect, .2));
        const c = Math.cos(rotation), s = Math.sin(rotation), tilt = .30, ct = Math.cos(tilt), st = Math.sin(tilt);
        const turn = new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
        const lean = new Float32Array([1, 0, 0, 0, 0, ct, st, 0, 0, -st, ct, 0, 0, 0, 0, 1]);
        const model = multiply(lean, turn);
        const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -distance, 1]);
        const near = .1, far = 40;
        const projection = new Float32Array([focal / aspect, 0, 0, 0, 0, focal, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(locations.model, false, model);
        gl.uniform1f(locations.cameraDistance, distance);
        gl.uniformMatrix4fv(locations.mvp, false, multiply(projection, multiply(view, model)));
        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices.length / 7);
        // Validate the first frame; context-loss events handle runtime GPU failure without per-frame readbacks.
        if (!validated && (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)) throw new Error('3D render unavailable');
        validated = true;
        dirty = false;
        return true;
      } catch { fail(); return false; }
    }
    function active() { return !destroyed && visible && !paused && !pointer && !document.hidden && !preference?.matches; }
    function tick(time) {
      frame = 0;
      if (!active()) { lastTime = 0; return; }
      if (lastTime) rotation = (rotation + Math.min(time - lastTime, 80) * Math.PI * 2 / 40000) % (Math.PI * 2);
      lastTime = time;
      if (render()) frame = window.requestAnimationFrame(tick);
    }
    function sync() {
      if (dirty && !destroyed && !document.hidden && (visible || !window.IntersectionObserver)) render();
      if (active()) { if (!frame) frame = window.requestAnimationFrame(tick); }
      else stop();
    }
    function setProduct(type) {
      if (destroyed || !['twisted', 'flat', 'sos'].includes(type)) return false;
      if (type === product) return true;
      try {
        const next = buildBag(type);
        if (gl.isContextLost()) throw new Error('3D context unavailable');
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, next.vertices, gl.STATIC_DRAW);
        // Check only on a replacement upload, never on the ongoing turntable frames.
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Product upload unavailable');
        mesh = next; product = type; dirty = true;
        sync();
        return !destroyed;
      } catch { fail(); return false; }
    }
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
      if (!gl || !window.requestAnimationFrame) return null;
      const shaders = [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]].map(([type, source]) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Shader unavailable');
        resources.push(['deleteShader', shader]);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
        return shader;
      });
      program = gl.createProgram();
      if (!program) throw new Error('Program unavailable');
      resources.push(['deleteProgram', program]);
      shaders.forEach(shader => gl.attachShader(program, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program linking failed');
      gl.useProgram(program);
      // A fixed local mipmapped map keeps paper fibres stable as the product turns or shrinks.
      const paper = buildPaperTexture(), texture = gl.createTexture();
      if (!texture) throw new Error('Paper material unavailable');
      resources.push(['deleteTexture', texture]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, paper.width, paper.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, paper.pixels);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
      const sampler = gl.getUniformLocation(program, 'uPaper');
      if (sampler === null) throw new Error('Paper sampler unavailable');
      gl.uniform1i(sampler, 0);
      mesh = buildBag();
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Buffer unavailable');
      resources.push(['deleteBuffer', buffer]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      [['aPosition', 3, 0], ['aNormal', 3, 12], ['aTone', 1, 24]].forEach(([name, size, offset]) => {
        const attribute = gl.getAttribLocation(program, name);
        if (attribute < 0) throw new Error('Attribute unavailable');
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 28, offset);
      });
      locations = { model: gl.getUniformLocation(program, 'uModel'), mvp: gl.getUniformLocation(program, 'uMVP'), cameraDistance: gl.getUniformLocation(program, 'uCameraDistance') };
      if (Object.values(locations).some(value => value === null)) throw new Error('Uniform unavailable');
      gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
      if (!render()) return null;
      const bounds = canvas.getBoundingClientRect();
      visible = bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
      if (window.IntersectionObserver) {
        visibilityObserver = new window.IntersectionObserver(entries => {
          entries.forEach(entry => { if (entry.target === canvas) visible = entry.isIntersecting; });
          sync();
        }, { threshold: .05 });
        visibilityObserver.observe(canvas);
      } else visible = false;
      const resized = () => { if (!destroyed && !document.hidden) render(); };
      if (window.ResizeObserver) { resizeObserver = new window.ResizeObserver(resized); resizeObserver.observe(canvas); }
      else on(window, 'resize', resized, { passive: true });
      on(preference, 'change', sync);
      on(document, 'visibilitychange', sync);
      on(canvas, 'webglcontextlost', event => { event.preventDefault(); fail(); });
      on(canvas, 'pointerdown', event => {
        if (event.isPrimary === false || event.button !== 0) return;
        pointer = { id: event.pointerId, x: event.clientX };
        canvas.setPointerCapture?.(event.pointerId); sync();
      });
      on(canvas, 'pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        rotation += (event.clientX - pointer.x) * .009;
        pointer.x = event.clientX;
        render();
      });
      const release = event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const id = pointer.id; pointer = null;
        if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
        sync();
      };
      on(canvas, 'pointerup', release); on(canvas, 'pointercancel', release); on(canvas, 'lostpointercapture', release);
      on(canvas, 'keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        rotation += event.key === 'ArrowLeft' ? -.15 : .15;
        render();
      });
      sync();
      return { setPaused(value) { paused = !!value; sync(); }, setProduct, destroy };
    } catch { fail(); return null; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildBag, buildTube, buildPaperTexture, mount };
  if (typeof window !== 'undefined') window.PactapDirect3D = { mount };
})();
