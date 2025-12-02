document.addEventListener('DOMContentLoaded', () => {

    // ----------------------
    // 🎵 MÚSICA
    // ----------------------
    const audio = new Audio("peep.mp3");
    audio.loop = true;
    audio.volume = 0.7;

    document.body.addEventListener("click", () => {
        audio.play().catch(() => {
            console.error("Error al intentar reproducir el audio.");
        });
    }, { once: true });

    // ----------------------
    // TRES JS INICIALIZACIÓN (Se mantiene igual)
    // ----------------------
    const canvas = document.getElementById("scene");
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 70); 

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);


    // ------------------------------------
    // FUNCIÓN DE CORAZÓN (Contorno y Volumen)
    // ------------------------------------
    const HEART_SCALE = 2.8; // <<< AUMENTAMOS LA ESCALA PARA HACERLO MÁS GRUESO
    const CONTOUR_DEPTH_FACTOR = 4; // <<< AUMENTAMOS ESTE FACTOR PARA DARLE MÁS PROFUNDIDAD AL CONTORNO
    const TOTAL_CONTOUR_POINTS = 3000;
    const TOTAL_VOLUME_POINTS = 4000;
    const TOTAL_POINTS = TOTAL_CONTOUR_POINTS + TOTAL_VOLUME_POINTS;

    const maxDelay = 3;
    const ANIMATION_DURATION = 4.0;
    const FILL_START_DELAY = ANIMATION_DURATION + 0.5;
    const FILL_DURATION = 3.0; 
    const randomRange = 60;
    
    // Ecuación de Contorno (Cardiode 3D - MÁS GRUESO)
    function createHeartContourPoint(i, total) {
        const t = (i / total) * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        // Usamos Math.random() para dar más volumen al eje Z
        let z = (Math.random() * 2 - 1) * CONTOUR_DEPTH_FACTOR; 

        return new THREE.Vector3(x * HEART_SCALE, y * HEART_SCALE, z);
    }
    
    // Función para Rellenar el Volumen (Mantenemos la lógica de dentro)
    function getHeartVolumeTarget() {
        const x = (Math.random() * 2 - 1) * 45; // Aumentar rango de búsqueda
        const y = (Math.random() * 2 - 1) * 45;
        const z = (Math.random() * 2 - 1) * 6; 
        const normalizedX = x / 40; 
        const normalizedY = y / 40; 
        
        const check = Math.pow(normalizedX * normalizedX + normalizedY * normalizedY - 1.2, 3) - normalizedX * normalizedX * normalizedY * normalizedY * normalizedY;
        
        if (check < 0) {
            return new THREE.Vector3(x, y + 15, z); // Ajuste de centrado
        }
        return null;
    }

    // ------------------------------------
    // PARTICULAS Y BUFFERS (Se mantiene la lógica de relleno por hilos)
    // ------------------------------------
    const initial = new Float32Array(TOTAL_POINTS * 3);
    const target = new Float32Array(TOTAL_POINTS * 3);
    const colors = new Float32Array(TOTAL_POINTS * 3);
    const sizes = new Float32Array(TOTAL_POINTS);
    const delays = new Float32Array(TOTAL_POINTS);

    const neonColors = [
        new THREE.Color(0xff4fa8),
        new THREE.Color(0xff9bd9),
        new THREE.Color(0xffc4ee),
        new THREE.Color(0xff6ec8),
        new THREE.Color(0xffffff)
    ];


    // --- 1. GENERAR PUNTOS DEL CONTORNO ---
    let heartContourPoints = [];

    for (let i = 0; i < TOTAL_CONTOUR_POINTS; i++) {
        const p = createHeartContourPoint(i, TOTAL_CONTOUR_POINTS);
        heartContourPoints.push({ index: i, x: p.x, y: p.y, z: p.z });
        
        delays[i] = (i / TOTAL_CONTOUR_POINTS) * maxDelay; 
        target[i * 3]     = p.x;
        target[i * 3 + 1] = p.y;
        target[i * 3 + 2] = p.z;
        initial[i * 3]     = (Math.random() - 0.5) * randomRange;
        initial[i * 3 + 1] = (Math.random() - 0.5) * randomRange;
        initial[i * 3 + 2] = (Math.random() - 0.5) * randomRange;
        const c = neonColors[Math.floor(Math.random() * neonColors.length)];
        colors[i * 3]     = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        sizes[i] = Math.random() * 1.5 + 0.5;
    }


    // --- 2. GENERAR PUNTOS DE RELLENO (Estilo HILOS/VIAJE) ---
    let volumeCount = 0;
    let attempts = 0;
    
    while(volumeCount < TOTAL_VOLUME_POINTS && attempts < TOTAL_VOLUME_POINTS * 10) {
        attempts++;
        const targetPos = getHeartVolumeTarget();
        
        if (targetPos) {
            const i = TOTAL_CONTOUR_POINTS + volumeCount; 
            
            const contourIndex = Math.floor(Math.random() * TOTAL_CONTOUR_POINTS);
            let initPos = createHeartContourPoint(contourIndex, TOTAL_CONTOUR_POINTS); 

            delays[i] = FILL_START_DELAY + (volumeCount / TOTAL_VOLUME_POINTS) * FILL_DURATION;

            target[i * 3]     = targetPos.x;
            target[i * 3 + 1] = targetPos.y;
            target[i * 3 + 2] = targetPos.z;
            
            initial[i * 3]     = initPos.x;
            initial[i * 3 + 1] = initPos.y;
            initial[i * 3 + 2] = initPos.z;
            
            const c = neonColors[Math.floor(Math.random() * 3)];
            colors[i * 3]     = c.r * 0.8;
            colors[i * 3 + 1] = c.g * 0.8;
            colors[i * 3 + 2] = c.b * 0.8;

            sizes[i] = Math.random() * 0.8 + 0.2; 
            
            volumeCount++;
        }
    }


    // Geometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS * 3), 3));
    geo.setAttribute("initialPosition", new THREE.BufferAttribute(initial, 3));
    geo.setAttribute("targetPosition", new THREE.BufferAttribute(target, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("delay", new THREE.BufferAttribute(delays, 1));


    // ----------------------
    // MATERIAL / SHADER (Se mantiene igual)
    // ----------------------
    const material = new THREE.ShaderMaterial({
        uniforms: {
            neonColors: { value: neonColors },
            numNeonColors: { value: neonColors.length },
            colorChangeSpeed: { value: 0.5 },
            pointTexture: { value: new THREE.TextureLoader().load("circle.png") },
            time: { value: 0.0 },
            animationDuration: { value: FILL_DURATION }, 
            brightnessIntensity: { value: 5.5 }
        },
        vertexShader: `
            attribute float size; attribute vec3 initialPosition; attribute vec3 targetPosition; attribute float delay;
            uniform float time; uniform float animationDuration; uniform vec3 neonColors[5]; uniform float numNeonColors; uniform float colorChangeSpeed;
            varying vec3 vColor;
            void main() {
                float t_real = time - delay;
                float t = clamp(t_real / animationDuration, 0.0, 1.0);
                
                vec3 pos;
                if(time < delay){
                    pos = initialPosition;
                } else {
                    pos = mix(initialPosition, targetPosition, t);
                }

                float ct = time * colorChangeSpeed + delay * 0.1;
                float ci = mod(ct, numNeonColors);
                int i1 = int(floor(ci));
                int i2 = int(mod(float(i1 + 1), numNeonColors));
                float mf = fract(ci);

                vColor = mix(neonColors[i1], neonColors[i2], mf);

                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (500.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture; uniform float brightnessIntensity; varying vec3 vColor;
            void main() {
                float r = distance(gl_PointCoord, vec2(0.5));
                if (r > 0.5) discard;
                float alpha = smoothstep(0.5, 0.45, r);
                vec4 c = vec4(vColor, alpha) * texture2D(pointTexture, gl_PointCoord);
                float grey = dot(c.rgb, vec3(0.299, 0.587, 0.114));
                c.rgb *= (brightnessIntensity + grey * 1.5);
                gl_FragColor = c;
            }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true
    });

    const points = new THREE.Points(geo, material);
    scene.add(points);
    points.rotation.set(0, 0, 0); 


   

    // ----------------------
    // LOOP DE ANIMACIÓN
    // ----------------------
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const t = clock.getElapsedTime();
        material.uniforms.time.value = t;

        // ❤️ LATIDO DEL CORAZÓN
        const s = 1 + Math.sin(t * 4) * 0.12;
        points.scale.set(s, s, s);

        // 📝 ANIMACIÓN DEL TEXTO (MOVIMIENTO Y LATIDO)
        if (animate.text && animate.text.visible) {
            // MOVIMIENTO VERTICAL (Arriba y Abajo)
            const yOffset = Math.sin(t * 2) * 1.5; // Frecuencia 2, Amplitud 1.5
            animate.text.position.y = originalTextYPosition + yOffset;

            // LATIDO (Escala)
            const ss = 1 + Math.sin(t * 3) * 0.08;
            animate.text.scale.set(ss, ss, ss);
        }

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    window.addEventListener("resize", () => {
        let w = canvas.parentNode.clientWidth;
        let h = canvas.parentNode.clientHeight;

        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    });
});