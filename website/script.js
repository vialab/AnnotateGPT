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

    // Pre-compute stagger delay index for each element among its siblings
    const delayMap = new Map();
    const parentCounts = new Map();
    reveals.forEach(el => {
        const parent = el.parentElement;
        const idx = parentCounts.get(parent) || 0;
        delayMap.set(el, idx);
        parentCounts.set(parent, idx + 1);
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = delayMap.get(entry.target) || 0;
                entry.target.style.transitionDelay = `${delay * 0.1}s`;
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
                // Also animate any detail-counter spans in the same card
                const card = entry.target.closest('.stat-card');
                if (card) {
                    card.querySelectorAll('.detail-counter').forEach(span => {
                        animateDetailCounter(span);
                    });
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateDetailCounter(element) {
    const target = parseInt(element.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
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
        element.textContent = Math.floor(easedProgress * target) + suffix;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + suffix;
        }
    }

    requestAnimationFrame(update);
}

function animateCounter(element) {
    const duration = 1800;
    const startTime = performance.now();

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    // Dual-number cards (e.g., "44 → 13")
    const countFrom = element.getAttribute('data-count-from');
    const countTo = element.getAttribute('data-count-to');
    if (countFrom !== null && countTo !== null) {
        const fromTarget = parseInt(countFrom, 10);
        const toTarget = parseInt(countTo, 10);
        const sep = element.getAttribute('data-separator') || ' → ';

        function updateDual(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutExpo(progress);
            const curFrom = Math.floor(easedProgress * fromTarget);
            const curTo = Math.floor(easedProgress * toTarget);

            element.innerHTML = curFrom + sep + curTo;

            if (progress < 1) {
                requestAnimationFrame(updateDual);
            } else {
                element.innerHTML = fromTarget + sep + toTarget;
            }
        }

        requestAnimationFrame(updateDual);
        return;
    }

    // Single-number cards
    const target = parseInt(element.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    const suffix = element.getAttribute('data-suffix') || '';

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
        }

        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy BibTeX';
        }, 2500);
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

/* === Hero canvas — annotated notetaking background === */
function initHeroCanvas() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let annotations = [];
    let textBlocks = [];
    let occupiedRects = []; // collision tracking
    let animationId;
    let spawnTimer = 0;
    const SPAWN_INTERVAL = 120;
    let drawQueue = [];       // sorted annotations waiting to be revealed
    let activeDrawing = null; // the annotation group currently being drawn
    let textLayerCanvas = null; // offscreen canvas for cached text lines

    function resize() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    }

    // ── Bounding-box collision system ──
    // Each annotation gets a bbox { x, y, w, h } with some padding
    function getBBox(a) {
        const pad = 6;
        switch (a.type) {
            case 'highlight':
                return { x: a.x - pad, y: a.y - pad, w: a.w + pad * 2, h: a.h + pad * 2 };
            case 'underline': {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                a.pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
                return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
            }
            case 'circle':
                // pts are relative to cx, cy
                let rMaxX = 0;
                let rMaxY = 0;
                a.pts.forEach(p => { rMaxX = Math.max(rMaxX, Math.abs(p.x)); rMaxY = Math.max(rMaxY, Math.abs(p.y)); });
                return { x: a.cx - rMaxX - pad, y: a.cy - rMaxY - pad, w: rMaxX * 2 + pad * 2, h: rMaxY * 2 + pad * 2 };
            case 'bracket': {
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                a.pts.forEach(p => { bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x); bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y); });
                return { x: bMinX - pad, y: bMinY - pad, w: bMaxX - bMinX + pad * 2, h: bMaxY - bMinY + pad * 2 };
            }
            case 'marginNote': {
                const estW = a.text.length * a.size * 0.5;
                return { x: a.x - estW / 2 - pad, y: a.y - a.size / 2 - pad, w: estW + pad * 2, h: a.size + pad * 2 };
            }
            case 'arrow': {
                let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
                a.pts.forEach(p => { aMinX = Math.min(aMinX, p.x); aMaxX = Math.max(aMaxX, p.x); aMinY = Math.min(aMinY, p.y); aMaxY = Math.max(aMaxY, p.y); });
                return { x: aMinX - pad, y: aMinY - pad, w: aMaxX - aMinX + pad * 2, h: aMaxY - aMinY + pad * 2 };
            }
            case 'connector': {
                let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
                a.pts.forEach(p => { cMinX = Math.min(cMinX, p.x); cMaxX = Math.max(cMaxX, p.x); cMinY = Math.min(cMinY, p.y); cMaxY = Math.max(cMaxY, p.y); });
                return { x: cMinX - 2, y: cMinY - 2, w: cMaxX - cMinX + 4, h: cMaxY - cMinY + 4 };
            }
            default:
                return { x: 0, y: 0, w: 0, h: 0 };
        }
    }

    function rectsOverlap(a, b) {
        return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    }

    function wouldOverlap(candidateBBox) {
        for (const rect of occupiedRects) {
            if (rectsOverlap(candidateBBox, rect.bbox)) return true;
        }
        return false;
    }

    function registerAnnotation(a) {
        const bbox = getBBox(a);
        a._bbox = bbox;
        occupiedRects.push({ bbox, id: a });
    }

    // Try to create an annotation, checking for overlap. Retries a few times.
    function tryCreate(factory, maxAttempts) {
        maxAttempts = maxAttempts || 5;
        for (let i = 0; i < maxAttempts; i++) {
            const a = factory();
            if (!a) continue;
            const bbox = getBBox(a);
            if (!wouldOverlap(bbox)) {
                registerAnnotation(a);
                return a;
            }
        }
        return null;
    }

    // ── Hand-tremor utility ──
    function handPoints(x0, y0, x1, y1, segments) {
        const pts = [];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return [{ x: x0, y: y0 }];
        const nx = -dy / len, ny = dx / len;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const envelope = Math.sin(t * Math.PI);
            // Multiple harmonics for organic feel
            const wobble = (Math.sin(t * 17.3 + x0) * 0.6
                          + Math.sin(t * 7.1 + y0) * 0.4
                          + Math.sin(t * 31.7 + x0 * 0.3) * 0.2) * envelope;
            const amp = len * 0.014 + 1.2;
            pts.push({
                x: x0 + dx * t + nx * wobble * amp,
                y: y0 + dy * t + ny * wobble * amp,
            });
        }
        return pts;
    }

    function penEase(t) {
        // Realistic pen: slow start, variable middle, slow end
        if (t < 0.1) return t / 0.1 * 0.08;
        if (t > 0.88) return 0.88 + (t - 0.88) / 0.12 * 0.12;
        // Add slight hesitation bumps in the middle
        const mid = 0.08 + (t - 0.1) / 0.78 * 0.80;
        return mid + Math.sin(t * 5.3) * 0.01;
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
        const colors = [inkRed, inkBlue, pencil, pencil];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    function randomHighlight() {
        const h = [highlightYellow, highlightYellow, highlightPink, highlightGreen];
        return h[Math.floor(Math.random() * h.length)];
    }

    // ── Generate structured text blocks (simulated document) ──
    function generateTextBlocks() {
        textBlocks = [];
        const lineHeight = 22;
        const margin = width * 0.1;
        const textWidth = width * 0.84;

        // Calculate paragraphs needed to fill the full canvas height
        const avgLinesPerPara = 3.5;
        const avgParaH = avgLinesPerPara * lineHeight;
        const numParagraphs = Math.max(5, Math.floor(height / (avgParaH + 35)));

        // Distribute evenly across full height
        const usableH = height - 200; // 20px top/bottom margin
        const gapBetween = Math.max(18, usableH / numParagraphs - avgParaH);

        let currentY = 100;

        for (let p = 0; p < numParagraphs; p++) {
            const numLines = 2 + Math.floor(Math.random() * 5);
            const paraX = margin;
            const paraWidth = textWidth;
            const lines = [];

            for (let l = 0; l < numLines; l++) {
                const lineW = (l === numLines - 1)
                    ? paraWidth * (0.3 + Math.random() * 0.4)
                    : paraWidth * (0.8 + Math.random() * 0.2);
                lines.push({
                    x: paraX,
                    y: currentY + l * lineHeight,
                    w: lineW,
                    h: lineHeight,
                });
            }

            textBlocks.push({
                x: paraX,
                y: currentY,
                w: paraWidth,
                lines: lines,
                lineHeight: lineHeight,
            });

            currentY += numLines * lineHeight + gapBetween + Math.random() * 15;
        }
    }

    function getRandomLine() {
        if (textBlocks.length === 0) return null;
        const block = textBlocks[Math.floor(Math.random() * textBlocks.length)];
        return block.lines[Math.floor(Math.random() * block.lines.length)];
    }

    function getRandomBlock() {
        if (textBlocks.length === 0) return null;
        return textBlocks[Math.floor(Math.random() * textBlocks.length)];
    }

    // -- Draw faint text lines (the "document") -- cached to offscreen canvas --
    function renderTextLines(targetCtx) {
        let seed = 42;
        function seeded() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; }

        textBlocks.forEach(block => {
            block.lines.forEach(line => {
                targetCtx.save();
                const dashY = line.y + line.h * 0.65;
                let cx = line.x;
                const endX = line.x + line.w;
                targetCtx.strokeStyle = 'rgba(160, 160, 170, 0.12)';
                targetCtx.lineWidth = 2.5;
                targetCtx.lineCap = 'round';

                while (cx < endX) {
                    const wordLen = 15 + seeded() * 40;
                    const gap = 8 + seeded() * 6;
                    const wordEnd = Math.min(cx + wordLen, endX);
                    targetCtx.beginPath();
                    targetCtx.moveTo(cx, dashY + (seeded() - 0.5) * 0.5);
                    targetCtx.lineTo(wordEnd, dashY + (seeded() - 0.5) * 0.5);
                    targetCtx.stroke();
                    cx = wordEnd + gap;
                }
                targetCtx.restore();
            });
        });
    }

    function cacheTextLayer() {
        textLayerCanvas = document.createElement('canvas');
        textLayerCanvas.width = width;
        textLayerCanvas.height = height;
        renderTextLines(textLayerCanvas.getContext('2d'));
    }

    // ── Companion margin note creator ──
    // Always creates a margin note near the annotation
    // opts: { tailX, tailY } for arrows (note near the tail)
    //        { refX, refY, refW } for everything else
    function createCompanionNote(refX, refY, refW, refColor, refLife, opts) {
        const noteTexts = {
            short: ['?', '!', '✓', '★', '×'],
            medium: ['key!', 'good', 'fix', 'why?', 'cite?', 'awk', 'yes!', 'no!', 'ok'],
            long: ['check this', 'important', 'see §2', 'revisit', 'unclear', 'expand', 'source?', 'agree', 'rephrase'],
        };
        const categories = ['short', 'medium', 'medium', 'long', 'long'];
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const pool = noteTexts[cat];
        const text = pool[Math.floor(Math.random() * pool.length)];
        const size = 18 + Math.random() * 8;

        let noteX, noteY;

        if (opts && opts.tailX !== undefined) {
            // Arrow: place note near the tail (start) of the arrow
            const tailX = opts.tailX;
            const tailY = opts.tailY;
            const tailIsLeft = opts.arrowIsLeft;
            // Note goes further out from the tail, away from the text
            noteX = tailIsLeft
                ? tailX - 10 - Math.random() * 25
                : tailX + 10 + Math.random() * 25;
            noteY = tailY + (Math.random() - 0.5) * 10;
        } else if (opts && opts.bracketIsLeft !== undefined) {
            // Bracket: place note on the outside of the curve
            if (opts.bracketIsLeft) {
                // Bracket is on left side of text → note goes further left
                noteX = refX - 20 - Math.random() * 30;
            } else {
                // Bracket is on right side of text → note goes further right
                noteX = refX + refW + 15 + Math.random() * 30;
            }
            noteY = refY + (Math.random() - 0.5) * 14;
        } else {
            // Non-arrow, non-bracket: place in margin beside the annotation
            const isLeft = refX > width * 0.5;
            noteX = isLeft
                ? refX - 25 - Math.random() * 30
                : refX + refW + 12 + Math.random() * 25;
            noteY = refY + (Math.random() - 0.5) * 14;
        }

        const note = {
            type: 'marginNote',
            x: noteX,
            y: noteY,
            text: text,
            color: refColor || randomColor(),
            opacity: 0,
            targetOpacity: 0.35 + Math.random() * 0.15,
            fadeSpeed: 0.008 + Math.random() * 0.006,
            size: size,
            rotation: (Math.random() - 0.5) * 14 * Math.PI / 180,
            life: refLife + 50 + Math.random() * 100,
            age: -30 - Math.floor(Math.random() * 40),
        };

        // Check overlap — if it overlaps, try shifting vertically a couple times
        for (let shift = 0; shift < 5; shift++) {
            const bbox = getBBox(note);
            if (!wouldOverlap(bbox)) {
                registerAnnotation(note);
                return note;
            }
            note.y += (12 + Math.random() * 8) * (shift % 2 === 0 ? 1 : -1);
        }
        // Last resort: still register if no space found
        const bbox = getBBox(note);
        registerAnnotation(note);
        return note;
    }

    // ── Connector line from annotation to its margin note ──
    function createConnectorLine(fromX, fromY, toX, toY, color, parentLife) {
        // wiggly thin connecting line
        const pts = handPoints(fromX, fromY, toX, toY, 5);
        const conn = {
            type: 'connector',
            pts,
            color: color,
            progress: 0,
            speed: 0.025 + Math.random() * 0.015,
            baseOpacity: 0.06 + Math.random() * 0.04,
            lineWidth: 0.5 + Math.random() * 0.4,
            life: parentLife + 60,
            age: -20 - Math.floor(Math.random() * 30),
        };
        registerAnnotation(conn);
        return conn;
    }

    // ── Annotation element factories (positioned on text) ──

    function createHighlightStreak() {
        const line = getRandomLine();
        if (!line) return null;
        const spanFrac = 0.1 + Math.random() * 0.2;
        const startFrac = Math.random() * (1 - spanFrac);
        const x = line.x + line.w * startFrac;
        const w = line.w * spanFrac;
        const y = line.y + line.h * 0.3;
        const h = line.h * 0.55;
        const jitter = () => (Math.random() - 0.5) * 3;
        return {
            type: 'highlight',
            x, y, w, h,
            // Companion anchor info
            _anchorX: x, _anchorY: y + h / 2, _anchorW: w,
            corners: [
                { x: -w/2 + jitter(), y: -h/2 + jitter() },
                { x:  w/2 + jitter(), y: -h/2 + jitter() },
                { x:  w/2 + jitter(), y:  h/2 + jitter() },
                { x: -w/2 + jitter(), y:  h/2 + jitter() },
            ],
            color: randomHighlight(),
            opacity: 0,
            targetOpacity: 0.35 + Math.random() * 0.12,
            fadeSpeed: 0.008 + Math.random() * 0.006,
            progress: 0,
            drawSpeed: 0.035 + Math.random() * 0.02,
            life: 900 + Math.random() * 1200,
            age: 0,
            angle: (Math.random() - 0.5) * 1.5 * Math.PI / 180,
        };
    }

    function createUnderline() {
        const line = getRandomLine();
        if (!line) return null;
        const spanFrac = 0.1 + Math.random() * 0.2;
        const startFrac = Math.random() * (1 - spanFrac);
        const x = line.x + line.w * startFrac;
        const w = line.w * spanFrac;
        const y = line.y + line.h * 0.78;
        const wavy = Math.random() > 0.55;
        const segments = wavy ? 32 : 20;
        let pts;
        if (wavy) {
            pts = [];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const waveMag = 2 + Math.random() * 1.5;
                const dir = i % 2 === 0 ? -1 : 1;
                pts.push({
                    x: x + w * t,
                    y: y + dir * waveMag * Math.sin(t * Math.PI) * 0.8 + (Math.random() - 0.5) * 0.4,
                });
            }
        } else {
            pts = handPoints(x, y, x + w, y + (Math.random() - 0.5) * 1.5, segments);
        }
        return {
            type: 'underline',
            pts,
            _anchorX: x, _anchorY: y, _anchorW: w,
            color: randomColor(),
            progress: 0,
            speed: 0.012 + Math.random() * 0.01,
            baseOpacity: 0.35 + Math.random() * 0.15,
            lineWidth: 1.2 + Math.random() * 1,
            life: 1000 + Math.random() * 800,
            age: 0,
        };
    }

    function createCircleAnnotation() {
        const line = getRandomLine();
        if (!line) return null;
        const startFrac = Math.random() * 0.85;
        const wordW = 20 + Math.random() * 40;
        const cx = line.x + line.w * startFrac + wordW / 2;
        const cy = line.y + line.h * 0.55;
        const rx = wordW / 2 + 6;
        const ry = line.h * 0.45 + 3;
        const pts = [];
        const steps = 40;
        const seed = Math.random() * 100;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const wobble = Math.sin(t * 5 + seed) * 1.5 + Math.sin(t * 3 + seed * 2) * 0.8;
            pts.push({
                x: (rx + wobble) * Math.cos(t),
                y: (ry + wobble * 0.5) * Math.sin(t),
            });
        }
        return {
            type: 'circle',
            cx, cy, pts,
            _anchorX: cx - rx, _anchorY: cy, _anchorW: rx * 2,
            color: inkRed,
            progress: 0,
            speed: 0.012 + Math.random() * 0.01,
            baseOpacity: 0.3 + Math.random() * 0.15,
            lineWidth: 1.1 + Math.random() * 0.8,
            rotation: (Math.random() - 0.5) * 8 * Math.PI / 180,
            life: 1200 + Math.random() * 600,
            age: 0,
        };
    }

    function createBracket() {
        const block = getRandomBlock();
        if (!block) return null;
        const isLeft = Math.random() > 0.3;
        const x = isLeft
            ? block.x - 15 - Math.random() * 10
            : block.x + block.w + 10 + Math.random() * 10;
        const startLine = Math.floor(Math.random() * Math.max(1, block.lines.length - 2));
        const spanLines = 2 + Math.floor(Math.random() * Math.min(3, block.lines.length - startLine));
        const y = block.lines[startLine].y;
        const h = spanLines * block.lineHeight;
        const side = isLeft ? 1 : -1;
        const indent = 8 * side;
        const pts = handPoints(x + indent, y, x, y + h * 0.15, 4)
            .concat(handPoints(x, y + h * 0.15, x, y + h * 0.85, 6))
            .concat(handPoints(x, y + h * 0.85, x + indent, y + h, 4));
        return {
            type: 'bracket',
            pts,
            _anchorX: x, _anchorY: y + h / 2, _anchorW: 15,
            _bracketIsLeft: isLeft,
            color: inkRed,
            progress: 0,
            speed: 0.012 + Math.random() * 0.008,
            baseOpacity: 0.28 + Math.random() * 0.12,
            lineWidth: 1 + Math.random() * 0.6,
            life: 1000 + Math.random() * 600,
            age: 0,
        };
    }

    function createMarginNote() {
        const block = getRandomBlock();
        if (!block) return null;
        const notes = ['?', '!', '✓', '★', 'key!', 'good', 'fix', 'check', 'important', 'see §2', 'why?', 'cite?'];
        const isLeft = Math.random() > 0.5;
        const lineIdx = Math.floor(Math.random() * block.lines.length);
        const line = block.lines[lineIdx];
        const x = isLeft
            ? line.x - 30 - Math.random() * 25
            : line.x + line.w + 15 + Math.random() * 20;
        const y = line.y + line.h * 0.55;
        return {
            type: 'marginNote',
            x, y,
            text: notes[Math.floor(Math.random() * notes.length)],
            color: randomColor(),
            opacity: 0,
            targetOpacity: 0.35 + Math.random() * 0.15,
            fadeSpeed: 0.008 + Math.random() * 0.006,
            size: 18 + Math.random() * 8,
            rotation: (Math.random() - 0.5) * 10 * Math.PI / 180,
            life: 1200 + Math.random() * 800,
            age: 0,
        };
    }

    function createArrow() {
        const block = getRandomBlock();
        if (!block) return null;
        const lineIdx = Math.floor(Math.random() * block.lines.length);
        const line = block.lines[lineIdx];
        const isLeft = Math.random() > 0.5;
        const startX = isLeft
            ? line.x - 40 - Math.random() * 20
            : line.x + line.w + 30 + Math.random() * 20;
        const startY = line.y + line.h * 0.5 + (Math.random() - 0.5) * 10;
        const endX = isLeft
            ? line.x - 5
            : line.x + line.w + 5;
        const endY = line.y + line.h * 0.55;
        const pts = handPoints(startX, startY, endX, endY, 6);
        const angle = Math.atan2(endY - startY, endX - startX);
        return {
            type: 'arrow',
            pts,
            _anchorX: Math.min(startX, endX), _anchorY: startY, _anchorW: Math.abs(endX - startX),
            _arrowIsLeft: isLeft,
            angle,
            color: randomColor(),
            progress: 0,
            speed: 0.015 + Math.random() * 0.01,
            baseOpacity: 0.3 + Math.random() * 0.12,
            lineWidth: 1 + Math.random() * 0.6,
            life: 900 + Math.random() * 600,
            age: 0,
        };
    }

    // ── Spawn annotations with collision checks + companion notes ──

    // Primary annotation factories (no standalone marginNote — they come as companions)
    const primaryFactories = [
        createHighlightStreak,
        createHighlightStreak,
        createUnderline,
        createUnderline,
        createCircleAnnotation,
        createBracket,
        createArrow,
    ];

    // Also allow standalone margin notes at lower frequency
    const allFactories = [...primaryFactories, createMarginNote];

    function spawnAnnotationWithCompanion(factory) {
        const a = tryCreate(factory);
        if (!a) return [];
        const result = [a];

        // Every annotation gets a companion margin note
        if (a.type !== 'marginNote' && a.type !== 'connector') {
            let note;
            if (a.type === 'arrow' && a.pts && a.pts.length > 0) {
                // Arrow: place note near the tail (first point = start of stroke)
                const tail = a.pts[0];
                note = createCompanionNote(
                    a._anchorX, a._anchorY, a._anchorW || 0,
                    a.color, a.life,
                    { tailX: tail.x, tailY: tail.y, arrowIsLeft: a._arrowIsLeft }
                );
            } else if (a.type === 'bracket' && a._bracketIsLeft !== undefined) {
                // Bracket: pass bracket side so note goes on the outside
                note = createCompanionNote(
                    a._anchorX, a._anchorY, a._anchorW || 0,
                    a.color, a.life,
                    { bracketIsLeft: a._bracketIsLeft }
                );
            } else if (a._anchorX !== undefined) {
                note = createCompanionNote(
                    a._anchorX, a._anchorY, a._anchorW || 0,
                    a.color, a.life, null
                );
            }

            if (note) {
                note.age = a.age - 15 - Math.floor(Math.random() * 25);
                result.push(note);

                // Draw a thin wobbly connector line (~60% chance)
                if (Math.random() > 0.4) {
                    let fromX, fromY;
                    if (a.type === 'arrow' && a.pts && a.pts.length > 0) {
                        // Connect from arrow tail
                        fromX = a.pts[0].x;
                        fromY = a.pts[0].y;
                    } else {
                        fromX = note.x > a._anchorX ? a._anchorX + (a._anchorW || 0) : a._anchorX;
                        fromY = a._anchorY;
                    }
                    const conn = createConnectorLine(fromX, fromY, note.x, note.y, a.color, a.life);
                    result.push(conn);
                }
            }
        }
        return result;
    }

    function spawnInitial() {
        annotations = [];
        occupiedRects = [];
        drawQueue = [];
        activeDrawing = null;
        const count = Math.max(6, Math.floor((width * height) / 80000));

        // Pre-generate all annotation groups
        const allGroups = [];
        let spawned = 0;
        let attempts = 0;
        while (spawned < count && attempts < count * 4) {
            attempts++;
            const factory = primaryFactories[Math.floor(Math.random() * primaryFactories.length)];
            const group = spawnAnnotationWithCompanion(factory);
            if (group.length > 0) {
                // Find the primary annotation's position for sorting
                const primary = group[0];
                const bbox = getBBox(primary);
                allGroups.push({ group, sortX: bbox.x, sortY: bbox.y });
                spawned++;
            }
        }

        // Sort groups from top-left to bottom-right
        // Primary sort by Y (top to bottom), secondary by X (left to right)
        allGroups.sort((a, b) => {
            const rowA = Math.floor(a.sortY / 60);
            const rowB = Math.floor(b.sortY / 60);
            if (rowA !== rowB) return rowA - rowB;
            return a.sortX - b.sortX;
        });

        // Queue them — all start hidden (age deeply negative)
        allGroups.forEach(({ group }) => {
            group.forEach(a => {
                a.age = -999999; // hidden until activated
                annotations.push(a);
            });
            drawQueue.push(group);
        });

        // Activate the first group
        activateNextGroup();
    }

    function activateNextGroup() {
        if (drawQueue.length === 0) {
            activeDrawing = null;
            return;
        }
        const group = drawQueue.shift();
        activeDrawing = group;
        group.forEach((a, idx) => {
            // Primary annotation starts immediately, companions slightly delayed
            a.age = idx === 0 ? 0 : -8;
        });
    }

    function isGroupDrawingDone(group) {
        if (!group || group.length === 0) return true;
        const primary = group[0];
        // For highlights: check progress
        if (primary.progress !== undefined && primary.progress >= 1) return true;
        // For margin notes: check opacity reached target
        if (primary.type === 'marginNote' && primary.opacity >= primary.targetOpacity * 0.9) return true;
        return false;
    }

    // ── Draw helpers ──

    function drawHighlight(a) {
        // Animate progress: sweep left to right like a real highlighter
        a.progress = Math.min(1, a.progress + a.drawSpeed);
        // Smooth easing for pen-like feel
        const ease = a.progress < 0.5
            ? 2 * a.progress * a.progress
            : 1 - Math.pow(-2 * a.progress + 2, 2) / 2;
        // Fade opacity in gently as the stroke appears
        a.opacity = Math.min(a.opacity + a.fadeSpeed, a.targetOpacity);

        ctx.save();
        ctx.translate(a.x + a.w / 2, a.y);
        ctx.rotate(a.angle);

        // Clip to the revealed portion (left to right sweep)
        const revealW = a.w * ease;
        ctx.beginPath();
        ctx.rect(-a.w / 2 - 2, -a.h, revealW + 2, a.h * 3);
        ctx.clip();

        ctx.fillStyle = a.color + a.opacity + ')';
        ctx.beginPath();
        ctx.moveTo(a.corners[0].x, a.corners[0].y);
        // Smooth curves through corners for organic shape
        ctx.quadraticCurveTo(
            (a.corners[0].x + a.corners[1].x) / 2, a.corners[0].y - 1,
            a.corners[1].x, a.corners[1].y
        );
        ctx.quadraticCurveTo(
            a.corners[1].x + 1, (a.corners[1].y + a.corners[2].y) / 2,
            a.corners[2].x, a.corners[2].y
        );
        ctx.quadraticCurveTo(
            (a.corners[2].x + a.corners[3].x) / 2, a.corners[2].y + 1,
            a.corners[3].x, a.corners[3].y
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawStrokePath(pts, progress, color, opacity, baseWidth) {
        const totalPts = pts.length;
        // Smooth eased progress for fluid drawing animation
        const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        // Allow fractional point index for sub-point interpolation
        const drawFrac = eased * (totalPts - 1);
        const drawCount = Math.floor(drawFrac) + 1;
        if (drawCount < 2) return;
        const subT = drawFrac - Math.floor(drawFrac); // fractional part for tip interpolation

        ctx.save();
        ctx.strokeStyle = color + opacity + ')';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw completed segments as one smooth path
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < drawCount; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            // Use midpoint smoothing for continuous curves
            if (i < drawCount - 1) {
                const next = pts[i + 1];
                const cpX = curr.x;
                const cpY = curr.y;
                const endX = (curr.x + next.x) / 2;
                const endY = (curr.y + next.y) / 2;
                ctx.quadraticCurveTo(cpX, cpY, endX, endY);
            } else {
                // Last completed point — interpolate to the sub-point for smooth tip
                if (subT > 0 && i < totalPts - 1) {
                    const next = pts[i + 1];
                    const tipX = curr.x + (next.x - curr.x) * subT;
                    const tipY = curr.y + (next.y - curr.y) * subT;
                    ctx.quadraticCurveTo(curr.x, curr.y, tipX, tipY);
                } else {
                    ctx.lineTo(curr.x, curr.y);
                }
            }
        }

        // Variable pressure along the full stroke
        const t = eased;
        const pressure = 0.55 + 0.45 * Math.sin(t * Math.PI) + Math.sin(t * 11) * 0.04;
        ctx.lineWidth = baseWidth * Math.max(0.3, pressure);
        ctx.stroke();
        ctx.restore();
    }

    function drawUnderline(a) {
        a.progress = Math.min(1, a.progress + a.speed);
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
            const pressure = 0.5 + 0.5 * Math.sin(t * Math.PI) + Math.sin(t * 9) * 0.05;
            ctx.lineWidth = a.lineWidth * Math.max(0.3, pressure);
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

    function drawConnector(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        const fadeIn = Math.min(1, a.age / 80);
        drawStrokePath(a.pts, a.progress, a.color, a.baseOpacity * fadeIn, a.lineWidth);
    }

    function drawArrow(a) {
        a.progress = Math.min(1, a.progress + a.speed);
        const fadeIn = Math.min(1, a.age / 60);
        const opacity = a.baseOpacity * fadeIn;
        drawStrokePath(a.pts, a.progress, a.color, opacity, a.lineWidth);

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

        // Draw the underlying "document text" first
        if (textLayerCanvas) ctx.drawImage(textLayerCanvas, 0, 0);

        annotations.forEach(a => {
            a.age++;
            if (a.age < 0) return;

            const fadeOutZone = 200;
            let fadeMult = 1;
            if (a.age > a.life - fadeOutZone) {
                fadeMult = Math.max(0, (a.life - a.age) / fadeOutZone);
                fadeMult = fadeMult * fadeMult;
            }

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
                case 'connector':  drawConnector(a); break;
                case 'arrow':      drawArrow(a); break;
            }

            if (a.baseOpacity !== undefined) a.baseOpacity = savedOpacity;
            if (a.targetOpacity !== undefined) a.targetOpacity = savedTarget;
        });

        // Check if current drawing group is done → activate next
        if (activeDrawing && isGroupDrawingDone(activeDrawing)) {
            activateNextGroup();
        }

        // Remove dead annotations + their occupied rects; spawn replacements
        spawnTimer++;
        const before = annotations.length;
        annotations = annotations.filter(a => a.age <= a.life);
        // Clean up occupied rects for dead annotations
        if (annotations.length < before) {
            const aliveSet = new Set(annotations);
            occupiedRects = occupiedRects.filter(r => aliveSet.has(r.id));
        }

        if (drawQueue.length === 0 && !activeDrawing && spawnTimer >= SPAWN_INTERVAL && annotations.length < Math.max(6, Math.floor((width * height) / 80000))) {
            const factory = primaryFactories[Math.floor(Math.random() * primaryFactories.length)];
            const group = spawnAnnotationWithCompanion(factory);
            group.forEach(a => annotations.push(a));
            activeDrawing = group;
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
    generateTextBlocks();
    cacheTextLayer();
    spawnInitial();
    draw();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            generateTextBlocks();
            cacheTextLayer();
            spawnInitial();
        }, 150);
    });
}

/* === Ink trail cursor effect === */
function initInkTrail() {
    const canvas = document.getElementById('inkTrailCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let dots = [];
    let lastX = -100, lastY = -100;
    let trailRunning = false;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    resize();

    function startTrail() {
        if (!trailRunning) {
            trailRunning = true;
            requestAnimationFrame(drawTrail);
        }
    }

    window.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const dx = mouseX - lastX;
        const dy = mouseY - lastY;
        const speed = Math.sqrt(dx * dx + dy * dy);

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
            startTrail();
        }

        lastX = mouseX;
        lastY = mouseY;
    }, { passive: true });

    function drawTrail() {
        ctx.clearRect(0, 0, width, height);

        dots = dots.filter(d => d.life > 0);

        if (dots.length === 0) {
            trailRunning = false;
            return;
        }

        dots.forEach(d => {
            d.life -= d.decay;
            d.y += 0.2;

            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(79, 70, 229, ${d.opacity * d.life})`;
            ctx.fill();
        });

        if (dots.length > 300) {
            dots = dots.slice(-200);
        }

        requestAnimationFrame(drawTrail);
    }

    window.addEventListener('resize', resize);
}
