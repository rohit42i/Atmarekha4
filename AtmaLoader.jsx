<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Atma Rekha — Main Loader</title>

<style>

* {
    box-sizing: border-box;
}

html,
body {
    width: 100%;
    height: 100%;
}

body {
    margin: 0;
    overflow: hidden;
}


/* =========================================
   MAIN LOADER OVERLAY
   Full screen, dead center, full size
========================================= */

#mainLoader {
    position: fixed;
    inset: 0;

    display: flex;
    align-items: center;
    justify-content: center;

    background: #07070a;

    z-index: 9999;

    opacity: 1;
    transition: opacity .5s ease;
    pointer-events: auto;
}

#mainLoader.hidden {
    opacity: 0;
    pointer-events: none;
}

#mainLoader .loader {
    width: 220px;
    height: 220px;
}

/* Scale down slightly on very small phones */
@media (max-width: 360px) {
    #mainLoader .loader {
        width: 170px;
        height: 170px;
    }
}


/* =========================================
   LOADER (percentage-based so it scales
   cleanly with the container size above)
========================================= */

.loader {
    position: relative;
}

.aura {
    position: absolute;
    inset: 20%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.045), transparent 65%);
    animation: aura 4s ease-in-out infinite;
}

.outer-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 79%;
    height: 79%;
    transform: translate(-50%, -50%);
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(255,255,255,.025);
    opacity: .45;
    z-index: 2;
    animation: ringMove 8s linear infinite, ringPulse 4s ease-in-out infinite;
}

.outer-ring::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg, transparent 300deg,
        rgba(255,255,255,.4) 325deg, rgba(255,255,255,.08) 340deg, transparent 360deg);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - .5px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - .5px));
    animation: ringLight 5s linear infinite;
}

.symbol {
    position: absolute;
    inset: 9%;
    animation: symbolRotate 12s ease-in-out infinite;
    z-index: 4;
}

.loader svg {
    width: 100%;
    height: 100%;
    overflow: visible;
}

.mark {
    fill: none;
    stroke: rgba(255,255,255,.7);
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 80 180;
    animation: markFlow 3.2s linear infinite, markPulse 4s ease-in-out infinite;
}

.mark.two { stroke-dasharray: 45 220; animation-delay: -1.7s; }
.mark.three { stroke-dasharray: 25 260; animation-delay: -2.6s; }

.thread {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2px;
    height: 36%;
    transform-origin: 50% 100%;
    border-radius: 100%;
    background: linear-gradient(to top, rgba(255,255,255,.95), rgba(255,255,255,.45), transparent);
    z-index: 6;
}

.thread.one { animation: seekerOne 4.2s ease-in-out infinite; }
.thread.two { animation: seekerTwo 5s ease-in-out infinite; }

.thread::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    width: 8px;
    height: 100%;
    transform: translateX(-50%);
    background: inherit;
    opacity: .13;
    filter: blur(5px);
}

.fragments {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 8;
}

.fragment {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1px;
    height: 6px;
    border-radius: 100%;
    background: rgba(255,255,255,.9);
    box-shadow: 0 0 4px rgba(255,255,255,.45);
    opacity: 0;
    --angle: 0deg;
    --radius: 29%;
    --drift: 0deg;
    --delay: 0s;
    --duration: 4s;
    animation: fragmentOrbit var(--duration) ease-in-out infinite;
    animation-delay: var(--delay);
}

.fragment:nth-child(1)  { --angle: 5deg;   --radius: 28%; --drift: 38deg;  --delay: -1.2s; --duration: 4.6s; }
.fragment:nth-child(2)  { --angle: 20deg;  --radius: 34%; --drift: -42deg; --delay: -.4s;  --duration: 5.2s; }
.fragment:nth-child(3)  { --angle: 35deg;  --radius: 31%; --drift: 52deg;  --delay: -2.8s; --duration: 4.1s; }
.fragment:nth-child(4)  { --angle: 51deg;  --radius: 37%; --drift: -30deg; --delay: -1.7s; --duration: 5.8s; }
.fragment:nth-child(5)  { --angle: 68deg;  --radius: 28%; --drift: 44deg;  --delay: -3.1s; --duration: 4.8s; }
.fragment:nth-child(6)  { --angle: 84deg;  --radius: 34%; --drift: -52deg; --delay: -.8s;  --duration: 5.2s; }
.fragment:nth-child(7)  { --angle: 101deg; --radius: 30%; --drift: 35deg;  --delay: -2.1s; --duration: 4.4s; }
.fragment:nth-child(8)  { --angle: 119deg; --radius: 38%; --drift: -48deg; --delay: -3.6s; --duration: 5.7s; }
.fragment:nth-child(9)  { --angle: 137deg; --radius: 29%; --drift: 50deg;  --delay: -1.4s; --duration: 4.3s; }
.fragment:nth-child(10) { --angle: 154deg; --radius: 34%; --drift: -36deg; --delay: -2.6s; --duration: 5.1s; }
.fragment:nth-child(11) { --angle: 171deg; --radius: 32%; --drift: 42deg;  --delay: -.6s;  --duration: 4.7s; }
.fragment:nth-child(12) { --angle: 188deg; --radius: 37%; --drift: -55deg; --delay: -3.4s; --duration: 5.6s; }
.fragment:nth-child(13) { --angle: 205deg; --radius: 28%; --drift: 47deg;  --delay: -1.9s; --duration: 4.5s; }
.fragment:nth-child(14) { --angle: 222deg; --radius: 33%; --drift: -40deg; --delay: -2.9s; --duration: 5.3s; }
.fragment:nth-child(15) { --angle: 239deg; --radius: 39%; --drift: 32deg;  --delay: -4.1s; --duration: 6s;   }
.fragment:nth-child(16) { --angle: 256deg; --radius: 31%; --drift: -46deg; --delay: -4.7s; --duration: 5.9s; }
.fragment:nth-child(17) { --angle: 273deg; --radius: 36%; --drift: 54deg;  --delay: -1.1s; --duration: 5s;   }
.fragment:nth-child(18) { --angle: 289deg; --radius: 29%; --drift: -35deg; --delay: -3.8s; --duration: 4.6s; }
.fragment:nth-child(19) { --angle: 305deg; --radius: 38%; --drift: 48deg;  --delay: -2.3s; --duration: 5.5s; }
.fragment:nth-child(20) { --angle: 321deg; --radius: 32%; --drift: -58deg; --delay: -.9s;  --duration: 4.9s; }
.fragment:nth-child(21) { --angle: 337deg; --radius: 40%; --drift: 36deg;  --delay: -3.2s; --duration: 6s;   }
.fragment:nth-child(22) { --angle: 350deg; --radius: 30%; --drift: -44deg; --delay: -1.6s; --duration: 4.2s; }
.fragment:nth-child(23) { --angle: 145deg; --radius: 40%; --drift: 62deg;  --delay: -4.4s; --duration: 5.8s; }
.fragment:nth-child(24) { --angle: 275deg; --radius: 41%; --drift: -51deg; --delay: -5s;   --duration: 6.2s; }

@keyframes fragmentOrbit {
    0% {
        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(var(--radius) - 8%)) scale(.15);
        opacity: 0;
    }
    15% { opacity: .12; }
    32% { opacity: .85; }
    50% {
        transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--drift))) translateY(var(--radius)) scale(1);
        opacity: .7;
    }
    68% {
        transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--drift) + 18deg)) translateY(calc(var(--radius) + 4%)) scale(.65);
        opacity: .3;
    }
    82% { opacity: .06; }
    100% {
        transform: translate(-50%, -50%) rotate(calc(var(--angle) + var(--drift) + 35deg)) translateY(calc(var(--radius) + 8%)) scale(.05);
        opacity: 0;
    }
}

.burst {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4.5%;
    height: 4.5%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    z-index: 15;
    pointer-events: none;
    animation: burstPulse 5.8s ease-out infinite;
}

.burst span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1px;
    height: 7px;
    border-radius: 100%;
    background: linear-gradient(to top, rgba(255,255,255,.95), transparent);
    transform-origin: 50% 0;
    opacity: 0;
    animation: sparkBurst 5.8s ease-out infinite;
}

.burst span:nth-child(1)  { --r: 0deg; }
.burst span:nth-child(2)  { --r: 30deg; }
.burst span:nth-child(3)  { --r: 60deg; }
.burst span:nth-child(4)  { --r: 90deg; }
.burst span:nth-child(5)  { --r: 120deg; }
.burst span:nth-child(6)  { --r: 150deg; }
.burst span:nth-child(7)  { --r: 180deg; }
.burst span:nth-child(8)  { --r: 210deg; }
.burst span:nth-child(9)  { --r: 240deg; }
.burst span:nth-child(10) { --r: 270deg; }
.burst span:nth-child(11) { --r: 300deg; }
.burst span:nth-child(12) { --r: 330deg; }

@keyframes sparkBurst {
    0%, 45% { transform: rotate(var(--r)) translateY(3px) scaleY(.2); opacity: 0; }
    50% { opacity: 1; }
    62% { transform: rotate(var(--r)) translateY(32px) scaleY(1); opacity: .75; }
    72% { transform: rotate(var(--r)) translateY(45px) scaleY(.35); opacity: 0; }
    100% { opacity: 0; }
}

@keyframes burstPulse {
    0%, 42% { transform: translate(-50%, -50%) scale(.15); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(.8); opacity: 1; }
    60% { transform: translate(-50%, -50%) scale(1.15); opacity: .7; }
    70%, 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.node {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2.3%;
    height: 2.3%;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 10px rgba(255,255,255,.7);
    z-index: 20;
}

.node.one { animation: nodeOne 4.2s ease-in-out infinite; }
.node.two { animation: nodeTwo 5s ease-in-out infinite; }

.center {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2.3%;
    height: 2.3%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 12px rgba(255,255,255,.8);
    z-index: 25;
    animation: centerPulse 2.5s ease-in-out infinite;
}

@keyframes symbolRotate {
    0%   { transform: rotate(-12deg) scale(.92); }
    50%  { transform: rotate(12deg) scale(1.04); }
    100% { transform: rotate(-12deg) scale(.92); }
}

@keyframes markFlow {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: -260; }
}

@keyframes markPulse {
    0%, 100% { opacity: .12; }
    40%      { opacity: .7; }
    60%      { opacity: .35; }
}

@keyframes seekerOne {
    0%   { transform: translate(-50%, -100%) rotate(-140deg) scaleY(.55); opacity: .25; }
    20%  { transform: translate(-50%, -100%) rotate(-65deg) scaleY(1);    opacity: 1; }
    40%  { transform: translate(-50%, -100%) rotate(15deg) scaleY(.75);  opacity: .8; }
    55%  { transform: translate(-50%, -100%) rotate(70deg) scaleY(1.15); opacity: 1; }
    75%  { transform: translate(-50%, -100%) rotate(150deg) scaleY(.6);  opacity: .35; }
    100% { transform: translate(-50%, -100%) rotate(220deg) scaleY(.55); opacity: .25; }
}

@keyframes seekerTwo {
    0%   { transform: translate(-50%, -100%) rotate(50deg) scaleY(.6);   opacity: .25; }
    25%  { transform: translate(-50%, -100%) rotate(130deg) scaleY(1.1); opacity: .9; }
    45%  { transform: translate(-50%, -100%) rotate(210deg) scaleY(.7);  opacity: 1; }
    65%  { transform: translate(-50%, -100%) rotate(285deg) scaleY(1.15);opacity: .8; }
    80%  { transform: translate(-50%, -100%) rotate(345deg) scaleY(.5);  opacity: .3; }
    100% { transform: translate(-50%, -100%) rotate(410deg) scaleY(.6);  opacity: .25; }
}

@keyframes nodeOne {
    0%   { transform: translate(-50%, -50%) rotate(-140deg) translateY(42px); opacity: .2; }
    40%  { transform: translate(-50%, -50%) rotate(15deg) translateY(78px);   opacity: 1; }
    75%  { transform: translate(-50%, -50%) rotate(150deg) translateY(52px); opacity: .3; }
    100% { opacity: .2; }
}

@keyframes nodeTwo {
    0%   { transform: translate(-50%, -50%) rotate(50deg) translateY(50px); opacity: .2; }
    45%  { transform: translate(-50%, -50%) rotate(210deg) translateY(80px); opacity: 1; }
    80%  { transform: translate(-50%, -50%) rotate(345deg) translateY(45px); opacity: .25; }
    100% { opacity: .2; }
}

@keyframes centerPulse {
    0%, 100% { transform: translate(-50%, -50%) scale(.6); opacity: .45; }
    50%      { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
}

@keyframes aura {
    0%, 100% { transform: scale(.8); opacity: .25; }
    50%      { transform: scale(1.15); opacity: .8; }
}

@keyframes ringMove {
    0%   { transform: translate(-50%, -50%) rotate(0deg) scale(.98); }
    50%  { transform: translate(-50%, -50%) rotate(180deg) scale(1.015); }
    100% { transform: translate(-50%, -50%) rotate(360deg) scale(.98); }
}

@keyframes ringPulse {
    0%, 100% { opacity: .25; }
    50%      { opacity: .55; }
}

@keyframes ringLight {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
    }
}

</style>
</head>
<body>

<!-- =========================================
     MAIN LOADER
     Full screen, dead center. Shows on page load,
     hides once your content is ready.
========================================= -->

<div id="mainLoader">
    <div class="loader">
        <div class="aura"></div>
        <div class="outer-ring"></div>

        <div class="symbol">
            <svg viewBox="0 0 220 220">
                <path class="mark" d="M110 38 C155 60 170 90 145 110 C120 130 75 120 70 155" />
                <path class="mark two" d="M65 75 C95 45 135 55 150 85 C165 115 140 145 105 155" />
                <path class="mark three" d="M110 40 C90 75 95 100 110 110 C125 120 130 145 110 180" />
            </svg>
        </div>

        <div class="fragments">
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
            <div class="fragment"></div><div class="fragment"></div><div class="fragment"></div>
        </div>

        <div class="burst">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
        </div>

        <div class="thread one"></div>
        <div class="thread two"></div>

        <div class="node one"></div>
        <div class="node two"></div>

        <div class="center"></div>
    </div>
</div>

<script>
/* =========================================
   Control functions for the main loader.

   showMainLoader()  -> show it
   hideMainLoader()  -> fade it out

   By default it's visible immediately and
   auto-hides once the page finishes loading.
   Replace the auto-hide logic with your own
   "content ready" check if you load data via JS.
========================================= */

function showMainLoader() {
    document.getElementById('mainLoader').classList.remove('hidden');
}

function hideMainLoader() {
    document.getElementById('mainLoader').classList.add('hidden');
}

window.addEventListener('load', () => {
    setTimeout(hideMainLoader, 400);
});
</script>

<style>
#mainLoader.hidden {
    opacity: 0;
    pointer-events: none;
}
</style>

</body>
</html>
      clearTimeout(timerRef.current);
      if (window.AtmaLoader?.showLoader === showLoader) delete window.AtmaLoader;
    };
  }, []);

  return (
    <>
      <style>{LOADER_CSS}</style>
      <div ref={viewportRef} className="atma-main-loader" data-atma-main-loader role="status" aria-label="Loading Atma Rekha">
        <LoaderArtwork />
      </div>
    </>
  );
}
