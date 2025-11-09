// --- Scene setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.getElementById('model-container').appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Subtle pointer light
const pointerLight = new THREE.PointLight(0xffffff, 0.6, 20, 1);
pointerLight.position.set(0, 0, 2);
scene.add(pointerLight);

// Mouse tracking
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}, false);

// --- Channel / Audio setup ---
const channels = [
    { src: 'Music/SilentHill2-BlackFairy-AkiraTomaoka-Konami.mp3', info: 'Game: Silent Hill 2\nSong: Black Fairy\nArtist: Akira Tomaoka\nRights: Konami' },
    { src: 'Music/SilentHill2-WhiteNoiz-AkiraTamaoka-Konami.mp3', info: 'Game: Silent Hill 2\nSong: White Noiz\nArtist: Akira Tomaoka\nRights: Konami' },
    { src: 'Music/LuigisMansion-Mansion-KazumiTotaka-ShinobuTanaka-Nintendo.mp3', info: "Game: Luigi's Mansion\nSong: Mansion\nArtist: Kazumi Totaka & Shinobu Tanaka\nRights: Nintendo" },
    { src: 'Music/PokemonRedAndGreen-LavenderTown-JunichiMasuda-Nintendo.mp3', info: 'Game: Pokemon Red and Green\nSong: Lavender Town\nArtist: Junichi Masuda\nRights: Nintendo' },
    { src: 'Music/HalfLife2-DistortedTrumpets-KellyBailey-Valve.mp3', info: 'Game: Half-Life 2\nSong: Distorted Trumpets\nArtist: Kelly Bailey\nRights: Valve' },
    { src: 'Music/DokiDokiLiteratureClub-Sayonara-DanSalvato-TeamSalvato.mp3', info: 'Game: Doki Doki Literature Club\nSong: Sayo-nara\nArtist: Dan Salvato\nRights: Team Salvato' }
];

const staticAudio = new Audio('Music/RadioStatic.mp3');
staticAudio.loop = true;
staticAudio.volume = 0.6;
let currentChannelAudio = null;

const songInfoEl = document.getElementById('song-info');
let songTimeout = null;

function showSongInfo(text) {
    if (songTimeout) { clearTimeout(songTimeout); songTimeout = null; }
    songInfoEl.textContent = text;
    songInfoEl.style.opacity = '1';
    songTimeout = setTimeout(() => { songInfoEl.style.opacity = '0'; }, 5000);
}

// Scanning state
let scanTimer = null;
const scanDelay = 800;

function startScanning() {
    if (currentChannelAudio && !currentChannelAudio.paused) currentChannelAudio.pause();
    if (staticAudio.paused) staticAudio.play().catch(() => {});
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { findAndPlayChannel(); scanTimer = null; }, scanDelay);
}

function findAndPlayChannel() {
    const TWO_PI_local = Math.PI * 2;
    const angle = (typeof targetPlaneRotationY === 'number') ? targetPlaneRotationY : 0;
    const idx = Math.floor(angle / (TWO_PI_local / channels.length)) % channels.length;
    const ch = channels[idx];
    if (!ch) return;

    staticAudio.pause();
    if (currentChannelAudio) try { currentChannelAudio.pause(); } catch (e) {}
    currentChannelAudio = new Audio(ch.src);
    currentChannelAudio.loop = false;
    currentChannelAudio.volume = 0.95;
    currentChannelAudio.play().catch(() => {});
    showSongInfo(ch.info);
}

window.addEventListener('load', () => {
    staticAudio.play().catch(() => {
        console.log('Static autoplay blocked — will play on interaction');
    });
});

// --- Knob rotation & controls ---
const TWO_PI = Math.PI * 2;
let model = null;
let planeChild = null;
let planeZeroOffset = 0;
let targetPlaneRotationY = 0;
let wheelRotation = 0;

const wheelSensitivity = 0.0025;
const dragSensitivity = 0.01;

function onWheel(e) {
    const overCanvas = e.target === renderer.domElement || (e.target.closest && e.target.closest('#model-container'));
    if (!overCanvas) return;
    e.preventDefault();
    wheelRotation += e.deltaY * wheelSensitivity;
    wheelRotation = THREE.MathUtils.clamp(wheelRotation, 0, TWO_PI);
    targetPlaneRotationY = wheelRotation;
    startScanning();
}
window.addEventListener('wheel', onWheel, { passive: false });

// Drag to rotate
let isDragging = false;
let dragStartY = 0;
let dragStartRotation = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartY = e.clientY;
    dragStartRotation = targetPlaneRotationY;
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (e) {}
});
window.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    startScanning();
    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (e) {}
});
window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dy = dragStartY - e.clientY;
    let newRot = dragStartRotation + dy * dragSensitivity;
    newRot = THREE.MathUtils.clamp(newRot, 0, TWO_PI);
    targetPlaneRotationY = newRot;
    wheelRotation = newRot;
    startScanning();
});

// --- Model loading & animation ---
const loader = new THREE.GLTFLoader();
loader.load('Models/Radio.glb', (gltf) => {
    model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.scale.set(1, 1, 1);

    planeChild = model.getObjectByName('Knob') || model.getObjectByName('Plane.002') || model.getObjectByProperty('name', 'Knob');
    if (planeChild) {
        planeChild.rotation.y = planeChild.rotation.y || 0;
        planeZeroOffset = planeChild.rotation.y;
        targetPlaneRotationY = 0;
        wheelRotation = 0;
        planeChild.rotation.y = planeZeroOffset + targetPlaneRotationY;
    } else {
        console.warn('Knob child not found in GLTF — knob controls disabled');
    }
}, undefined, (err) => { console.error('GLTF load error', err); });

const maxYRotation = 0.15;
const maxXRotation = 0.08;

function animate() {
    requestAnimationFrame(animate);
    if (model) {
        model.position.y = Math.sin(Date.now() * 0.0005) * 0.05;
        const targetY = mouse.x * maxYRotation;
        const targetX = -mouse.y * maxXRotation;
        model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, targetY, 0.08);
        model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, targetX, 0.06);
        const lightTarget = new THREE.Vector3(mouse.x * 0.8, -mouse.y * 0.5, 2);
        pointerLight.position.lerp(lightTarget, 0.12);
        if (planeChild) {
            const desired = planeZeroOffset + targetPlaneRotationY;
            planeChild.rotation.y = THREE.MathUtils.lerp(planeChild.rotation.y || 0, desired, 0.08);
        }
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Ensure static starts after user interaction
document.addEventListener('pointerdown', () => {
    if (staticAudio.paused && (!currentChannelAudio || currentChannelAudio.paused)) {
        staticAudio.play().catch(() => {});
    }
});