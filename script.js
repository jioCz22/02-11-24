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
    // TRES JS INICIALIZACIÓN
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
    // FUNCIÓN DE CORAZÓN (SOLO CONTORNO)
    // ------------------------------------
    const HEART_SCALE = 2.8; 
    const CONTOUR_DEPTH_FACTOR = 4; 
    // SOLO MANTENEMOS LOS PUNTOS DEL CONTORNO
    const TOTAL_POINTS = 7000; 

    const maxDelay = 3;
    const ANIMATION_DURATION = 4.0; 
    // Las variables de relleno (FILL_*) ya no son necesarias.
    const randomRange = 60;
    
    // Ecuación de Contorno (Cardiode 3D)
    function createHeartContourPoint(i, total) {
        const t = (i / total) * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        let z = (Math.random() * 2 - 1) * CONTOUR_DEPTH_FACTOR; 
        return new THREE.Vector3(x * HEART_SCALE, y * HEART_SCALE, z);
    }
    
    // La función getHeartVolumeTarget ya no se usa.

    // ------------------------------------
    // PARTICULAS Y BUFFERS 
    // ------------------------------------
    // Todos los arrays usan TOTAL_POINTS
    const initial = new Float32Array(TOTAL_POINTS * 3);
    const target = new Float32Array(TOTAL_POINTS * 3);
    const colors = new Float32Array(TOTAL_POINTS * 3);
    const sizes = new Float32Array(TOTAL_POINTS);
    const delays = new Float32Array(TOTAL_POINTS);
    // isContour ya no es necesario, pero lo quitamos del BufferAttribute.

    const neonColors = [
        new THREE.Color(0xff4fa8),
        new THREE.Color(0xff9bd9),
        new THREE.Color(0xffc4ee),
        new THREE.Color(0xff6ec8),
        new THREE.Color(0xffffff)
    ];


    // --- GENERAR PUNTOS DEL CONTORNO (Ahora es el único bucle) ---
    for (let i = 0; i < TOTAL_POINTS; i++) {
        const p = createHeartContourPoint(i, TOTAL_POINTS);
        
        // Retraso individual para la animación de dispersión
        delays[i] = (i / TOTAL_POINTS) * maxDelay; 
        
        // Posición final (forma de corazón)
        target[i * 3]     = p.x;
        target[i * 3 + 1] = p.y;
        target[i * 3 + 2] = p.z;
        
        // Posición inicial (dispersión aleatoria)
        initial[i * 3]     = (Math.random() - 0.5) * randomRange;
        initial[i * 3 + 1] = (Math.random() - 0.5) * randomRange;
        initial[i * 3 + 2] = (Math.random() - 0.5) * randomRange;
        
        // Color
        const c = neonColors[Math.floor(Math.random() * neonColors.length)];
        colors[i * 3]     = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        
        // Tamaño
        sizes[i] = Math.random() * 1.5 + 0.5;
    }


    // Geometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS * 3), 3));
    geo.setAttribute("initialPosition", new THREE.BufferAttribute(initial, 3));
    geo.setAttribute("targetPosition", new THREE.BufferAttribute(target, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("delay", new THREE.BufferAttribute(delays, 1));
    // isContour se ha quitado
    

    // ----------------------
    // MATERIAL / SHADER (Simplificado)
    // ----------------------
    const material = new THREE.ShaderMaterial({
        uniforms: {
            neonColors: { value: neonColors },
            numNeonColors: { value: neonColors.length },
            colorChangeSpeed: { value: 0.5 },
            // Asegúrate de tener la textura 'circle.png' en la misma carpeta
            pointTexture: { value: new THREE.TextureLoader().load("circle.png") }, 
            time: { value: 0.0 },
            animationDuration: { value: ANIMATION_DURATION },
            brightnessIntensity: { value: 5.5 }
        },
        vertexShader: `
            // Attributes (Solo los necesarios)
            attribute float size; 
            attribute vec3 initialPosition; 
            attribute vec3 targetPosition; 
            attribute float delay;

            // Uniforms
            uniform float time; 
            uniform float animationDuration; 
            uniform vec3 neonColors[5]; 
            uniform float numNeonColors; 
            uniform float colorChangeSpeed;
            
            // Varyings
            varying vec3 vColor;
            
            void main() {
                float t_real = time - delay;
                
                // Calculamos el progreso de la animación de dispersión a corazón
                float t = clamp(t_real / animationDuration, 0.0, 1.0);
                
                // Interpolación de posición (de initialPosition a targetPosition)
                vec3 pos;
                if(time < delay){
                    pos = initialPosition;
                } else {
                    // Usamos una interpolación suave para el movimiento
                    pos = mix(initialPosition, targetPosition, smoothstep(0.0, 1.0, t));
                }

                // Animación de color
                float ct = time * colorChangeSpeed + delay * 0.1;
                float ci = mod(ct, numNeonColors);
                int i1 = int(floor(ci));
                int i2 = int(mod(float(i1 + 1), numNeonColors));
                float mf = fract(ci);

                vColor = mix(neonColors[i1], neonColors[i2], mf);

                // Cálculo de punto final (proyección)
                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (500.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            // Uniforms
            uniform sampler2D pointTexture; 
            uniform float brightnessIntensity; 
            
            // Varyings
            varying vec3 vColor;

            void main() {
                // Dibujar el círculo de la partícula
                float r = distance(gl_PointCoord, vec2(0.5));
                if (r > 0.5) discard;
                
                // Aplicar alpha suave para bordes (feathering)
                float alpha = smoothstep(0.5, 0.45, r);
                vec4 c = vec4(vColor, alpha) * texture2D(pointTexture, gl_PointCoord);
                
                // Efecto Bloom/Brillo
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

        // ❤️ LATIDO DEL CORAZÓN (Se mantiene, ahora solo afecta el contorno)
        const s = 1 + Math.sin(t * 4) * 0.12;
        points.scale.set(s, s, s);

        // Ya no es necesario el bloque de código de texto 3D

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
