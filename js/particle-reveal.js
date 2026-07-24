/**
 * Particle Reveal — vanilla port of Canvas UI's ParticleReveal (React).
 * The hero renders as fine grayscale dust; the cursor reveals crisp UI.
 *
 * Progressive enhancement: requires the experimental HTML-in-canvas API
 * (canvas `layoutsubtree` + ctx.drawElementImage + canvas.requestPaint)
 * plus WebGL2 and a fine pointer. Anywhere that's missing, the hero is
 * left exactly as authored. prefers-reduced-motion renders crisp.
 */
(function () {
  'use strict';

  var DEFAULTS = {
    radius: 500,
    softness: 0.75,
    size: 1,
    scatter: 25,
    drift: 1,
    aberration: 40,
    bend: 50,
    fade: 0.85,
    threshold: 0.1,
    background: '#000000',
    smoothing: 0.25,
  };

  var VERT = [
    '#version 300 es',
    'precision highp float;',
    'layout(location = 0) in vec2 aPos;',
    'out vec2 vUv;',
    'void main () {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'out vec4 outColor;',
    'uniform sampler2D uContent;',
    'uniform vec2 uRes;',
    'uniform float uDpr;',
    'uniform vec2 uPointer;',
    'uniform float uActive;',
    'uniform float uRadius;',
    'uniform float uSoftness;',
    'uniform float uSize;',
    'uniform float uScatter;',
    'uniform float uDrift;',
    'uniform float uAberration;',
    'uniform float uBend;',
    'uniform float uFade;',
    'uniform float uThreshold;',
    'uniform vec3 uBg;',
    'uniform float uTime;',
    'uniform float uMaxX;',
    'uniform float uCrisp;',
    '',
    'float hash (vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    '',
    'vec4 samp (vec2 p) {',
    '  vec2 uv = p / uRes;',
    '  uv = clamp(uv, vec2(0.001), vec2(uMaxX - 0.001, 0.999));',
    '  return texture(uContent, uv);',
    '}',
    '',
    'void main () {',
    '  vec2 pc = vec2(vUv.x, 1.0 - vUv.y) * uRes;',
    '  if (pc.x > uMaxX * uRes.x) {',
    '    outColor = vec4(0.0);',
    '    return;',
    '  }',
    '  if (uCrisp > 0.5) {',
    '    outColor = samp(pc);',
    '    return;',
    '  }',
    '',
    '  float dist = length(pc - uPointer);',
    '  float radius = max(uRadius, 1.0);',
    '  float inner = radius * (1.0 - clamp(uSoftness, 0.02, 1.0));',
    '  float e = (1.0 - smoothstep(inner, radius, dist)) * uActive;',
    '',
    '  float band = radius * 0.9;',
    '  float ring = smoothstep(inner, radius, dist)',
    '    * (1.0 - smoothstep(radius, radius + band, dist))',
    '    * uActive;',
    '',
    '  vec2 dir = (pc - uPointer) / max(dist, 1e-3);',
    '  vec2 tang = vec2(-dir.y, dir.x);',
    '  vec2 warp = (dir * -1.0 + tang * 0.6) * uBend * ring;',
    '  float ca = uAberration * ring;',
    '',
    '  float cellPx = max(uSize, 0.5) * uDpr;',
    '  vec2 cell = floor(gl_FragCoord.xy / cellPx);',
    '  float n1 = hash(cell);',
    '  float n2 = hash(cell + vec2(3.1, 7.7));',
    '  float n3 = hash(cell + vec2(9.3, 1.3));',
    '  float ft = floor(uTime * (2.0 + uDrift * 6.0));',
    '  float n4 = hash(cell + vec2(ft * 0.613, ft * 0.831));',
    '',
    '  float g0 = uThreshold * 0.6;',
    '  float g1 = uThreshold * 1.6 + 0.01;',
    '  vec3 lw = vec3(0.299, 0.587, 0.114);',
    '',
    '  vec2 bp = pc + warp;',
    '  vec4 bR = samp(bp + dir * ca);',
    '  vec4 bC = samp(bp);',
    '  vec4 bB = samp(bp - dir * ca);',
    '  vec3 baseRgb = vec3(bR.r, bC.g, bB.b);',
    '  float uiHome = smoothstep(g0, g1, dot(abs(baseRgb - uBg), lw));',
    '',
    '  float rad = uScatter * pow(n1, 2.5) * (1.0 - e);',
    '  float ang = n2 * 6.2832 + uTime * uDrift * (0.5 + n3 * 1.5);',
    '  vec2 dustP = bp + vec2(cos(ang), sin(ang)) * rad;',
    '',
    '  vec4 dR = samp(dustP + dir * ca);',
    '  vec4 dC = samp(dustP);',
    '  vec4 dB = samp(dustP - dir * ca);',
    '  vec3 dustRgb = vec3(dR.r, dC.g, dB.b);',
    '  float lumD = dot(dustRgb, lw);',
    '  float dDust = dot(abs(dustRgb - uBg), lw);',
    '',
    '  float gate = smoothstep(g0, g1, dDust);',
    '  float falloff = 1.0 - 0.7 * rad / max(uScatter, 1.0);',
    '  float prob = clamp(gate * (0.15 + 1.2 * sqrt(dDust)) * falloff, 0.0, 1.0) * uiHome;',
    '  float speck = step(n4 * 0.999, prob);',
    '',
    '  float shade = pow(lumD, 0.4) * (0.8 + 0.4 * n3);',
    '  vec3 dustCol = mix(uBg, vec3(shade), clamp(uFade, 0.0, 1.0));',
    '',
    '  vec3 unrevealed = mix(mix(baseRgb, uBg, uiHome), dustCol, speck);',
    '  vec3 col = mix(unrevealed, baseRgb, e);',
    '  float alpha = mix(bC.a, dC.a, speck * (1.0 - e));',
    '  outColor = vec4(col, alpha);',
    '}',
  ].join('\n');

  var colorProbe = null;

  function parseColor(input) {
    if (!colorProbe) {
      var probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      colorProbe = probe.getContext('2d', { willReadFrequently: true });
    }
    if (!colorProbe) return [0, 0, 0];
    colorProbe.fillStyle = '#000000';
    colorProbe.fillStyle = input;
    colorProbe.clearRect(0, 0, 1, 1);
    colorProbe.fillRect(0, 0, 1, 1);
    var data = colorProbe.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255];
  }

  function supportsHtmlInCanvas() {
    var probe = document.createElement('canvas');
    var ctx = probe.getContext('2d');
    return Boolean(
      ctx &&
      typeof ctx.drawElementImage === 'function' &&
      typeof probe.requestPaint === 'function'
    );
  }

  function createParticleReveal(elements, options) {
    var config = Object.assign({}, DEFAULTS, options || {});
    var source = elements.source;
    var content = elements.content;
    var output = elements.output;

    var gl = output.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl || gl.isContextLost()) return null;

    var sourceCtx = source.getContext('2d');
    var htmlInCanvas = Boolean(
      sourceCtx &&
      typeof sourceCtx.drawElementImage === 'function' &&
      typeof source.requestPaint === 'function'
    );

    var contentDirty = false;
    var wake = function () {};

    if (htmlInCanvas) {
      source.onpaint = function () {
        try {
          sourceCtx.reset();
          sourceCtx.drawElementImage(content, 0, 0);
          contentDirty = true;
          wake();
        } catch (e) {}
      };
    }

    function compile(type, text) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('ParticleReveal shader error:', gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    var vertexShader = compile(gl.VERTEX_SHADER, VERT);
    var fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(program, i);
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var contentTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );

    var contentMaxX = 1;

    function syncCanvasSize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var width = Math.max(1, Math.round(output.clientWidth * dpr));
      var height = Math.max(1, Math.round(output.clientHeight * dpr));
      if (output.width !== width || output.height !== height) {
        output.width = width;
        output.height = height;
      }
      contentMaxX = Math.min(
        1,
        Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1))
      );
      if (htmlInCanvas) {
        var cssWidth = Math.max(1, Math.round(source.clientWidth));
        var cssHeight = Math.max(1, Math.round(source.clientHeight));
        if (source.width !== cssWidth || source.height !== cssHeight) {
          source.width = cssWidth;
          source.height = cssHeight;
        }
        source.requestPaint();
      }
    }

    var pointer = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, active: 0, target: 0 };
    var time = 0;
    var bgKey = '';
    var bg = [0, 0, 0];

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reducedMotion = motionQuery.matches;

    syncCanvasSize();

    function uploadContent() {
      if (!htmlInCanvas || !contentDirty) return;
      contentDirty = false;
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }

    function render() {
      uploadContent();
      var w = Math.max(output.clientWidth, 1);
      var h = Math.max(output.clientHeight, 1);
      var dpr = output.width / w;
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.uniform1i(uniforms.uContent, 0);
      gl.uniform2f(uniforms.uRes, w, h);
      gl.uniform1f(uniforms.uDpr, dpr);
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.uActive, pointer.active);
      gl.uniform1f(uniforms.uRadius, Math.max(config.radius, 1));
      gl.uniform1f(uniforms.uSoftness, config.softness);
      gl.uniform1f(uniforms.uSize, Math.max(config.size, 0.5));
      gl.uniform1f(uniforms.uScatter, Math.max(config.scatter, 0));
      gl.uniform1f(uniforms.uDrift, Math.max(config.drift, 0));
      gl.uniform1f(uniforms.uAberration, Math.max(config.aberration, 0));
      gl.uniform1f(uniforms.uBend, Math.max(config.bend, 0));
      gl.uniform1f(uniforms.uFade, config.fade);
      gl.uniform1f(uniforms.uThreshold, Math.max(config.threshold, 0));
      if (config.background !== bgKey) {
        bgKey = config.background;
        bg = parseColor(config.background);
      }
      gl.uniform3f(uniforms.uBg, bg[0], bg[1], bg[2]);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uMaxX, contentMaxX);
      gl.uniform1f(uniforms.uCrisp, reducedMotion || !htmlInCanvas ? 1 : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, output.width, output.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var raf = 0;
    var lastTime = performance.now();
    var destroyed = false;
    var running = false;
    var visible = true;

    function frame(now) {
      if (destroyed) return;
      if (!visible) {
        running = false;
        return;
      }
      var delta = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      time += delta;
      var tau = Math.max(config.smoothing, 1e-4);
      var k = reducedMotion ? 1 : 1 - Math.exp(-delta / tau);
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      pointer.active += (pointer.target - pointer.active) * k;
      render();
      var settled =
        Math.abs(pointer.tx - pointer.x) < 0.1 &&
        Math.abs(pointer.ty - pointer.y) < 0.1 &&
        Math.abs(pointer.target - pointer.active) < 1e-3;
      if (
        settled &&
        !contentDirty &&
        (reducedMotion || !htmlInCanvas || config.drift <= 0)
      ) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.active = pointer.target;
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (destroyed || running || !visible) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    }

    wake = start;
    start();

    function onMotionChange() {
      reducedMotion = motionQuery.matches;
      start();
    }
    motionQuery.addEventListener('change', onMotionChange);

    var observer = new ResizeObserver(function () {
      syncCanvasSize();
      start();
    });
    observer.observe(output);
    observer.observe(content);

    var intersection = new IntersectionObserver(function (entries) {
      var last = entries[entries.length - 1];
      visible = last ? last.isIntersecting : true;
      if (visible) start();
    });
    intersection.observe(output);

    var listenTarget = output.parentElement || output;

    function onPointerMove(event) {
      var rect = output.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      if (pointer.target === 0 && pointer.active < 1e-3) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.tx = x;
      pointer.ty = y;
      pointer.target = 1;
      start();
    }

    function onPointerLeave() {
      pointer.target = 0;
      start();
    }

    listenTarget.addEventListener('pointermove', onPointerMove);
    listenTarget.addEventListener('pointerleave', onPointerLeave);

    return {
      setOptions: function (next) {
        Object.assign(config, next);
        start();
      },
      resize: function () {
        syncCanvasSize();
        start();
      },
      destroy: function () {
        destroyed = true;
        cancelAnimationFrame(raf);
        observer.disconnect();
        intersection.disconnect();
        motionQuery.removeEventListener('change', onMotionChange);
        listenTarget.removeEventListener('pointermove', onPointerMove);
        listenTarget.removeEventListener('pointerleave', onPointerLeave);
        gl.deleteTexture(contentTexture);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(quad);
        if (htmlInCanvas) source.onpaint = null;
      },
    };
  }

  /* Enhance the hero: move its content into a layoutsubtree canvas and
     overlay the WebGL output. Runs only when everything is supported, so
     unsupported browsers never leave the authored DOM. */
  function enhanceHero() {
    if (!supportsHtmlInCanvas()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var hero = document.querySelector('.sk-hero');
    if (!hero) return;

    var source = document.createElement('canvas');
    source.setAttribute('layoutsubtree', 'true');
    source.className = 'sk-fx-source';

    var content = document.createElement('div');
    content.className = 'sk-fx-content';
    while (hero.firstChild) content.appendChild(hero.firstChild);
    source.appendChild(content);

    var output = document.createElement('canvas');
    output.className = 'sk-fx-output';
    output.setAttribute('aria-hidden', 'true');

    hero.appendChild(source);
    hero.appendChild(output);

    var instance = createParticleReveal(
      { source: source, content: content, output: output },
      { background: '#000000' }
    );

    if (!instance) {
      // No WebGL2: restore the authored DOM.
      while (content.firstChild) hero.appendChild(content.firstChild);
      hero.removeChild(source);
      hero.removeChild(output);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceHero);
  } else {
    enhanceHero();
  }
})();
