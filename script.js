document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initRevealAnimations();
    initCounterAnimations();
    initCopyBibTeX();
    initMobileMenu();
    initHeroCanvas();
    initSmoothScroll();
    initInkTrail();
});

/* === Navbar scroll behavior === */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 80) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    }, { passive: true });
}

/* === Intersection Observer for reveal animations === */
function initRevealAnimations() {
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger animations for sibling elements
                const siblings = entry.target.parentElement.querySelectorAll('.reveal');
                let delay = 0;
                siblings.forEach((sibling) => {
                    if (sibling === entry.target) {
                        entry.target.style.transitionDelay = `${delay * 0.1}s`;
                    }
                    delay++;
                });

                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.08,
        rootMargin: '0px 0px -60px 0px'
    });

    reveals.forEach(el => observer.observe(el));
}

/* === Animated counters === */
function initCounterAnimations() {
    const stats = document.querySelectorAll('.stat-value');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-count'), 10);
    const suffix = element.getAttribute('data-suffix') || '';
    const duration = 1800;
    const startTime = performance.now();

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);
        const currentValue = Math.floor(easedProgress * target);

        element.textContent = currentValue + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + suffix;
        }
    }

    requestAnimationFrame(update);
}

/* === Copy BibTeX to clipboard === */
function initCopyBibTeX() {
    const copyBtn = document.getElementById('copyBtn');
    const citationText = document.getElementById('citationText');

    if (!copyBtn || !citationText) return;

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(citationText.textContent);
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy BibTeX';
            }, 2500);
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = citationText.textContent;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy BibTeX';
            }, 2500);
        }
    });
}

/* === Mobile menu toggle === */
function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        toggle.classList.toggle('active');
    });

    // Close menu on link click
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            toggle.classList.remove('active');
        });
    });
}

/* === Smooth scroll for anchor links === */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const navHeight = document.getElementById('navbar').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* === Hero canvas — rich annotation-themed background === */
function initHeroCanvas() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let annotations = [];
    let animationId;
    let spawnTimer = 0;
    const SPAWN_INTERVAL = 90; // frames between new spawns

    function resize() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    }

    // ── Hand-tremor utility ──
    // Pre-compute a wobbly path so it doesn't jitter each frame
    function handPoints(x0, y0, x1, y1, segments) {
        const pts = [];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len, ny = dx / len; // normal
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            // Perlin-ish wobble: amplitude tapers at endpoints
            const envelope = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
            const wobble = (Math.sin(t * 17.3 + x0) * 0.6 + Math.sin(t * 7.1 + y0) * 0.4) * envelope;
            const amp = len * 0.012 + 1; // subtle
            pts.push({
                x: x0 + dx * t + nx * wobble * amp,
                y: y0 + dy * t + ny * wobble * amp,
            });
        }
        return pts;
    }

    // Easing: slow start, fast middle, slow end (like a real pen stroke)
    function penEase(t) {
        if (t < 0.15) return t / 0.15 * 0.15; // slow ramp up
        if (t > 0.85) return 0.85 + (t - 0.85) / 0.15 * 0.15; // slow finish
        return 0.15 + (t - 0.15) / 0.7 * 0.7; // steady middle
    }

    // Ink colours
    const inkRed    = 'rgba(220, 38, 38,';
    const inkBlue   = 'rgba(37, 99, 235,';
    const inkGreen  = 'rgba(22, 163, 74,';
    const pencil    = 'rgba(120, 110, 100,';
    const highlightYellow = 'rgba(250, 204, 21,';
    const highlightPink   = 'rgba(244, 114, 182,';
    const highlightGreen  = 'rgba(74, 222, 128,';

    function randomColor() {
        const colors = [inkRed, inkBlue, pencil, pencil]; // pencil more likely
        return colors[Math.floor(Math.random() * colors.length)];
    }
    function randomHighlight() {
        const h = [highlightYellow, highlightYellow, highlightPink, highlightGreen]; // yellow most common
        return h[Math.floor(Math.random() * h.length)];
    }

    // ── Annotation element factories ──

    function createHighlightStreak() {
        const x = Math.random() * width * 0.7 + width * 0.12;
        const y = Math.random() * height;
        const w = 70 + Math.random() * 130;
        const h = 15 + Math.random() * 5;
        // Pre-compute irregular quadrilateral corners for a hand-drawn feel
        const jitter = () => (Math.random() - 0.5) * 4;
        return {
            type: 'highlight',
            x, y, w, h,
            corners: [
                { x: -w/2 + jitter(), y: -h/2 + jitter() },
                { x:  w/2 + jitter(), y: -h/2 + jitter() },
                { x:  w/2 + jitter(), y:  h/2 + jitter() },
                { x: -w/2 + jitter(), y:  h/2 + jitter() },
            ],
            color: randomHighlight(),
            opacity: 0,
            targetOpacity: 0.15 + Math.random() * 0.08,
            fadeSpeed: 0.0008 + Math.random() * 0.0008,
            life: 900 + Math.random() * 1200,
            age: 0,
            angle: (Math.random() - 0.5) * 2 * Math.PI / 180,
        };
    }

    function createUnderline() {
        const x = Math.random() * width * 0.6 + width * 0.15;
        const y = Math.random() * height;
        const w = 70 + Math.random() * 100;
        const wavy = Math.random() > 0.6;
        // Pre-compute the path
        const segments = wavy ? 16 : 8;
        let pts;
        if (wavy) {
            pts = [];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const waveMag = 3 + Math.random() * 1.5;
                const dir = i % 2 === 0 ? -1 : 1;
                pts.push({
                    x: x + w * t,
                    y: y + dir * waveMag * Math.sin(t * Math.PI) * 0.8 + (Math.random() - 0.5) * 0.5,
                });
            }
        } else {
            pts = handPoints(x, y, x + w, y + (Math.random() - 0.5) * 2, segments);
        }
        return {
            type: 'underline',
            pts,
            color: randomColor(),
            progress: 0,
            speed: 0.003 + Math.random() * 0.004, // slower
            baseOpacity: 0.15 + Math.random() * 0.1,
            lineWidth: 1.2 + Math.random() * 1,
            life: 1000 + Math.random() * 800,
            age: 0,
        };
    }

    function createCircleAnnotation() {
        const cx = Math.random() * width * 0.6 + width * 0.2;
        const cy = Math.random() * height;
        const rx = 22 + Math.random() * 30;
        const ry = 12 + Math.random() * 16;
        // Pre-compute wobbly ellipse points
        const pts = [];
        const steps = 40;
        const seed = Math.random() * 100;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const wobble = Math.sin(t * 5 + seed) * 2 + Math.sin(t * 3 + seed * 2) * 1;
            pts.push({
                x: (rx + wobble) * Math.cos(t),
                y: (ry + wobble * 0.6) * Math.sin(t),
            });
        }
        return {
            type: 'circle',
            cx, cy, pts,
            color: inkRed,
            progress: 0,
            speed: 0.003 + Math.random() * 0.005, // slower
            baseOpacity: 0.12 + Math.random() * 0.08,
            lineWidth: 1 + Math.random() * 0.8,
            rotation: (Math.random() - 0.5) * 12 * Math.PI / 180,
            life: 1200 + Math.random() * 600,
            age: 0,
        };
    }

    function createBracket() {
        const isLeft = Math.random() > 0.5;
        const x = isLeft
            ? width * 0.04 + Math.random() * width * 0.05
            : width * 0.88 + Math.random() * width * 0.06;
        const y = Math.random() * height * 0.5 + height * 0.25;
        const h = 50 + Math.random() * 70;
        const side = isLeft ? 1 : -1;
        // Pre-compute bracket curve points
        const indent = 10 * side;
        const pts = handPoints(x + indent, y, x, y + h * 0.15, 4)
            .concat(handPoints(x, y + h * 0.15, x, y + h * 0.85, 6))
            .concat(handPoints(x, y + h * 0.85, x + indent, y + h, 4));
        return {
            type: 'bracket',
            pts,
            color: inkRed,
            progress: 0,
            speed: 0.003 + Math.random() * 0.004,
            baseOpacity: 0.1 + Math.random() * 0.08,
            lineWidth: 1 + Math.random() * 0.6,
            life: 1000 + Math.random() * 600,
            age: 0,
        };
    }

    function createMarginNote() {
        const chars = ['?', '!', '✓', '★', 'NB', '→'];
        const isLeft = Math.random() > 0.5;
        const x = isLeft
            ? width * 0.02 + Math.random() * width * 0.05
            : width * 0.9 + Math.random() * width * 0.06;
        const y = Math.random() * height * 0.7 + height * 0.15;
        return {
            type: 'marginNote',
            x, y,
            text: chars[Math.floor(Math.random() * chars.length)],
            color: randomColor(),
            opacity: 0,
            targetOpacity: 0.14 + Math.random() * 0.08,
            fadeSpeed: 0.001 + Math.random() * 0.001,
            size: 16 + Math.random() * 8,
            rotation: (Math.random() - 0.5) * 12 * Math.PI / 180,
            life: 1200 + Math.random() * 800,
            age: 0,
        };
    }

    function createArrow() {
        const isLeft = Math.random() > 0.5;
        const x = isLeft
            ? width * 0.03 + Math.random() * width * 0.08
            : width * 0.85 + Math.random() * width * 0.08;
        const y = Math.random() * height * 0.6 + height * 0.2;
        const len = 25 + Math.random() * 35;
        const angle = isLeft
            ? -Math.PI / 6 + Math.random() * Math.PI / 3
            : Math.PI - Math.PI / 6 + Math.random() * Math.PI / 3;
        // Pre-compute shaft wobble points
        const ex = x + Math.cos(angle) * len;
        const ey = y + Math.sin(angle) * len;
        const pts = handPoints(x, y, ex, ey, 6);
        return {
            type: 'arrow',
            pts,
            angle,
            color: randomColor(),
            progress: 0,
            speed: 0.004 + Math.random() * 0.005,
            baseOpacity: 0.12 + Math.random() * 0.08,
            lineWidth: 1 + Math.random() * 0.6,
            life: 800 + Math.random() * 600,
            age: 0,
        };
    }

    // ── Spawn annotations (sparse) ──

    const factories = [
        createHighlightStreak,
        createUnderline,
        createCircleAnnotation,
        createBracket,
        createMarginNote,
        createArrow,
    ];

    function spawnInitial() {
        annotations = [];
        // Much sparser: ~8-12 visible at a time
        const count = Math.max(6, Math.floor((width * height) / 80000));
        for (let i = 0; i < count; i++) {
            const factory = factories[Math.floor(Math.random() * factories.length)];
            const a = factory();
            // Stagger widely so they don't all appear at once
            a.age = -Math.floor(Math.random() * 500);
            annotations.push(a);
        }
    }

    // ── Draw helpers ──

    function drawHighlight(a) {
        a.opacity = Math.min(a.opacity + a.fadeSpeed, a.targetOpacity);
        ctx.save();
        ctx.translate(a.x + a.w / 2, a.y);
        ctx.rotate(a.angle);
        ctx.fillStyle = a.color + a.opacity + ')';
        ctx.beginPath();
        ctx.moveTo(a.corners[0].x, a.corners[0].y);
        ctx.lineTo(a.corners[1].x, a.corners[1].y);
        ctx.lineTo(a.corners[2].x, a.corners[2].y);
        ctx.lineTo(a.corners[3].x, a.corners[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawStrokePath(pts, progress, color, opacity, baseWidth) {
        const totalPts = pts.length;
        const drawCount = Math.max(2, Math.floor(penEase(progress) * totalPts));
        if (drawCount < 2) return;

        ctx.save();
        ctx.strokeStyle = color + opacity + ')';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw segment by segment with pressure variation
        for (let i = 1; i < drawCount; i++) {
            const t = i / (totalPts - 1);
            // Pen pressure: lighter at start/end, heavier in middle
            const pressure = 0.6 + 0.4 * Math.sin(t * Math.PI);
            ctx.lineWidth = baseWidth * pressure;

            ctx.beginPath();
            const prev = pts[i - 1];
            const curr = pts[i];
            ctx.moveTo(prev.x, prev.y);
            // Smooth via midpoints
            if (i < drawCount - 1) {
                const next = pts[i + 1];
                const cpX = (curr.x + next.x) / 2;
                const cpY = (curr.y + next.y) / 2;
                ctx.quadraticCurveTo(curr.x, curr.y, cpX, cpY);
            } else {
                ctx.lineTo(curr.x, curr.y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawUnderline(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        // Fade in the opacity over the first 20%
        const fadeIn = Math.min(1, a.age / 60);
        drawStrokePath(a.pts, a.progress, a.color, a.baseOpacity * fadeIn, a.lineWidth);
    }

    function drawCircle(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        const totalPts = a.pts.length;
        const drawCount = Math.max(2, Math.floor(penEase(a.progress) * totalPts));
        const fadeIn = Math.min(1, a.age / 60);

        ctx.save();
        ctx.translate(a.cx, a.cy);
        ctx.rotate(a.rotation);
        ctx.strokeStyle = a.color + (a.baseOpacity * fadeIn) + ')';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < drawCount; i++) {
            const t = i / (totalPts - 1);
            const pressure = 0.5 + 0.5 * Math.sin(t * Math.PI);
            ctx.lineWidth = a.lineWidth * pressure;
            ctx.beginPath();
            ctx.moveTo(a.pts[i-1].x, a.pts[i-1].y);
            ctx.lineTo(a.pts[i].x, a.pts[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawBracket(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        const fadeIn = Math.min(1, a.age / 60);
        drawStrokePath(a.pts, a.progress, a.color, a.baseOpacity * fadeIn, a.lineWidth);
    }

    function drawMarginNote(a) {
        a.opacity = Math.min(a.opacity + a.fadeSpeed, a.targetOpacity);
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        ctx.font = `${a.size}px Caveat, cursive`;
        ctx.fillStyle = a.color + a.opacity + ')';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(a.text, 0, 0);
        ctx.restore();
    }

    function drawArrow(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        const fadeIn = Math.min(1, a.age / 60);
        const opacity = a.baseOpacity * fadeIn;
        drawStrokePath(a.pts, a.progress, a.color, opacity, a.lineWidth);

        // Arrowhead — only once shaft is nearly done
        if (a.progress > 0.85) {
            const last = a.pts[a.pts.length - 1];
            const prev = a.pts[a.pts.length - 2];
            const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
            const headLen = 6;
            const headOpacity = opacity * Math.min(1, (a.progress - 0.85) / 0.15);
            ctx.save();
            ctx.strokeStyle = a.color + headOpacity + ')';
            ctx.lineWidth = a.lineWidth * 0.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(last.x - headLen * Math.cos(ang - 0.5), last.y - headLen * Math.sin(ang - 0.5));
            ctx.lineTo(last.x, last.y);
            ctx.lineTo(last.x - headLen * Math.cos(ang + 0.5), last.y - headLen * Math.sin(ang + 0.5));
            ctx.stroke();
            ctx.restore();
        }
    }

    // ── Main draw loop ──

    function draw() {
        ctx.clearRect(0, 0, width, height);

        annotations.forEach(a => {
            a.age++;
            if (a.age < 0) return; // Staggered start

            // Smooth fade out near end of life
            const fadeOutZone = 200; // longer, gentler fade
            let fadeMult = 1;
            if (a.age > a.life - fadeOutZone) {
                fadeMult = Math.max(0, (a.life - a.age) / fadeOutZone);
                fadeMult = fadeMult * fadeMult; // ease-out curve
            }

            // Save & scale opacities for fade-out
            const savedOpacity = a.baseOpacity ?? a.opacity;
            const savedTarget = a.targetOpacity;
            if (a.baseOpacity !== undefined) a.baseOpacity = savedOpacity * fadeMult;
            if (a.targetOpacity !== undefined) a.targetOpacity = savedTarget * fadeMult;
            if (a.opacity !== undefined && a.baseOpacity === undefined) a.opacity *= fadeMult;

            switch (a.type) {
                case 'highlight':  drawHighlight(a); break;
                case 'underline':  drawUnderline(a); break;
                case 'circle':     drawCircle(a); break;
                case 'bracket':    drawBracket(a); break;
                case 'marginNote': drawMarginNote(a); break;
                case 'arrow':      drawArrow(a); break;
            }

            // Restore
            if (a.baseOpacity !== undefined) a.baseOpacity = savedOpacity;
            if (a.targetOpacity !== undefined) a.targetOpacity = savedTarget;
        });

        // Remove dead annotations; spawn replacements with delay
        spawnTimer++;
        annotations = annotations.filter(a => a.age <= a.life);
        if (spawnTimer >= SPAWN_INTERVAL && annotations.length < Math.max(6, Math.floor((width * height) / 80000))) {
            const factory = factories[Math.floor(Math.random() * factories.length)];
            annotations.push(factory());
            spawnTimer = 0;
        }

        animationId = requestAnimationFrame(draw);
    }

    // Only animate when hero is visible
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!animationId) draw();
            } else {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }
        });
    }, { threshold: 0 });

    heroObserver.observe(canvas.closest('.hero'));

    resize();
    spawnInitial();
    draw();

    window.addEventListener('resize', () => {
        resize();
        spawnInitial();
    });
}

/* === Ink trail cursor effect === */
function initInkTrail() {
    const canvas = document.getElementById('inkTrailCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let dots = [];
    let mouseX = -100, mouseY = -100;
    let lastX = -100, lastY = -100;
    let isMoving = false;
    let moveTimer;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    resize();

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Calculate movement speed
        const dx = mouseX - lastX;
        const dy = mouseY - lastY;
        const speed = Math.sqrt(dx * dx + dy * dy);

        // Only spawn dots when moving fast enough
        if (speed > 3) {
            const dotCount = Math.min(Math.floor(speed / 15), 3);
            for (let i = 0; i < dotCount; i++) {
                dots.push({
                    x: mouseX + (Math.random() - 0.5) * 4,
                    y: mouseY + (Math.random() - 0.5) * 4,
                    radius: Math.random() * 2 + 0.8,
                    opacity: Math.random() * 0.25 + 0.15,
                    life: 1,
                    decay: Math.random() * 0.015 + 0.01,
                });
            }
        }

        lastX = mouseX;
        lastY = mouseY;
        isMoving = true;
        clearTimeout(moveTimer);
        moveTimer = setTimeout(() => { isMoving = false; }, 100);
    });

    function drawTrail() {
        ctx.clearRect(0, 0, width, height);

        dots = dots.filter(d => d.life > 0);

        dots.forEach(d => {
            d.life -= d.decay;
            d.y += 0.2; // Slight "ink drip" gravity

            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(79, 70, 229, ${d.opacity * d.life})`;
            ctx.fill();
        });

        // Keep dot count manageable
        if (dots.length > 300) {
            dots = dots.slice(-200);
        }

        requestAnimationFrame(drawTrail);
    }

    drawTrail();

    window.addEventListener('resize', resize);
}
