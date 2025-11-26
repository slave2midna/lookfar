// dungeonMapper.js

const CANVAS_WIDTH  = 360;
const CANVAS_HEIGHT = 360;

// ===== SVG Helpers =====
function createSVG(size = 24) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("xmlns", svgNS);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

function createPolygon(points) {
  const svgNS = "http://www.w3.org/2000/svg";
  const poly = document.createElementNS(svgNS, "polygon");
  poly.setAttribute("points", points);
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "currentColor");
  poly.setAttribute("stroke-width", "2");
  poly.setAttribute("stroke-linejoin", "round");
  return poly;
}

function iconPentagon(size = 24) {
  const svg = createSVG(size);
  svg.appendChild(createPolygon("12 3 20 9.5 16.5 20 7.5 20 4 9.5"));
  return svg;
}

function iconHexagon(size = 24) {
  const svg = createSVG(size);
  svg.appendChild(createPolygon("12 3 19 8 19 16 12 21 5 16 5 8"));
  return svg;
}

function iconHeptagon(size = 24) {
  const svg = createSVG(size);
  svg.appendChild(createPolygon("12 3 18.5 7 20.5 14 16 20 8 20 3.5 14 5.5 7"));
  return svg;
}

function iconOctagon(size = 24) {
  const svg = createSVG(size);
  svg.appendChild(createPolygon("9 3 15 3 21 9 21 15 15 21 9 21 3 15 3 9"));
  return svg;
}

// Small helper to inject SVG icons into the shape buttons
function injectShapeIcons(html) {
  const shapes = {
    pentagon: iconPentagon,
    hexagon: iconHexagon,
    heptagon: iconHeptagon,
    octagon: iconOctagon
  };

  html.find(".lf-dm-shape-icon").each(function () {
    const shape = this.dataset.shape;
    const makeIcon = shapes[shape];
    if (!makeIcon) return;
    const svg = makeIcon(20);
    // Replace any existing contents (e.g. old <i> tags)
    this.replaceChildren(svg);
  });
}

// Simple array shuffle (legacy helper)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Module-level state: remember last generated dungeon this session
let _lastDungeonState = null;
let _builderAppId     = null;

// Remember options per seed for this session
const _dungeonSeedHistory = new Map();

// ----- Core generator class -----
class DungeonMapper {
  constructor(ctx, width, height, iconLayer, seed = null) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.iconLayer = iconLayer || null;  // HTML overlay for Font Awesome icons

    // Logical diagram center
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    // Node "radius" used for egress/stairs offsets (approx 64px overall node size)
    this.nodeRadius = 32;

    this.startIndex = null;
    this.twoIndex   = null;
    this.threeIndex = null;
    this.goalIndex  = null;

    // Options
    this.useKeys    = false;
    this.usePatrols = false;
    this.useTraps   = false;

    // Key locations
    this.key1Index = null;
    this.key2Index = null;

    // Egress & stairs
    this.exitIndex   = null;
    this.stairsIndex = null;

    // Seeded RNG
    this._initRNG(seed);
  }

  // ----- Seeded RNG (mulberry32) -----
  _initRNG(seed) {
    const baseSeed = (seed != null)
      ? seed >>> 0
      : (Date.now() ^ (Math.floor(Math.random() * (0xFFFFFFFF >>> 0)))) >>> 0;
    this.seed = baseSeed;
    this._rngState = baseSeed;
  }

  _rng() {
    // mulberry32
    let t = this._rngState += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), (t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  _shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  setSeed(seed) {
    this._initRNG(seed);
  }

  // Precompute point positions: N outer vertices + optional center
  _computePoints(sides = 6, includeCenter = true) {
    const cx = this.centerX;
    const cy = this.centerY;
    const radius = Math.min(this.width, this.height) * 0.36;

    const points = [];

    // outer points (indices 0..sides-1)
    for (let i = 0; i < sides; i++) {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / sides); // start at top, go around
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push({ id: i + 1, x, y });
    }

    if (includeCenter) {
      points.push({ id: sides + 1, x: cx, y: cy });
    }

    return points;
  }

  // Main entry point
  draw({
    useKeys       = false,
    usePatrols    = false,
    useTraps      = false,
    sides         = 6,
    featureCount  = 3,
    dangerCount   = 2,
    treasureCount = 1,
    pathOpen      = 3,
    pathClosed    = 2,
    pathSecret    = 1
  } = {}) {
    const ctx = this.ctx;

    // Reset transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // Clear ONLY map icons (not party trackers)
    if (this.iconLayer) {
      const mapIcons = this.iconLayer.querySelectorAll('[data-layer="map-icon"]');
      mapIcons.forEach(el => el.remove());
    }

    this.useKeys    = useKeys;
    this.usePatrols = usePatrols;
    this.useTraps   = useTraps;

    this.key1Index  = null;
    this.key2Index  = null;
    this.startIndex = null;
    this.twoIndex   = null;
    this.threeIndex = null;
    this.goalIndex  = null;

    // Shape definition
    const includeCenter = true;
    const points = this._computePoints(sides, includeCenter);

    // Assign point types based on counts
    const pointsWithTypes = this._assignPointTypesAndLabels(
      points,
      sides,
      includeCenter,
      {
        feature:  featureCount,
        danger:   dangerCount,
        treasure: treasureCount
      }
    );

    // Keys
    if (this.useKeys) {
      this._assignKeys(pointsWithTypes);
    }

    // Choose lines based on path totals
    const allLines = this._getAllPossibleLines(pointsWithTypes, sides, includeCenter);
    const totalRequestedPaths = Math.max(0, (pathOpen || 0) + (pathClosed || 0) + (pathSecret || 0));
    const desiredPathCount = Math.min(totalRequestedPaths || 1, allLines.length || 1);

    const lines = this._chooseRandomLines(
      pointsWithTypes,
      sides,
      includeCenter,
      desiredPathCount
    );

    // Draw lines with path-type counts
    this._drawLines(
      pointsWithTypes,
      lines,
      {
        open:   pathOpen,
        closed: pathClosed,
        secret: pathSecret
      }
    );

    // Draw node shapes + labels
    this._drawPoints(pointsWithTypes);
  }

  _assignPointTypesAndLabels(points, sides, includeCenter, counts) {
    let featureCount  = Math.max(0, counts.feature  ?? 0);
    let dangerCount   = Math.max(0, counts.danger   ?? 0);
    let treasureCount = Math.max(0, counts.treasure ?? 0);

    let totalMarked = featureCount + dangerCount + treasureCount;
    const maxNodes  = points.length;

    // Ensure at least one marked node
    if (totalMarked <= 0) {
      featureCount = 1;
      dangerCount  = 0;
      treasureCount = 0;
      totalMarked  = 1;
    }

    // Clamp to available nodes
    if (totalMarked > maxNodes) {
      totalMarked = maxNodes;
    }

    // Distribute counts so they sum to totalMarked
    let remaining = totalMarked;
    let f = Math.min(featureCount,  remaining); remaining -= f;
    let d = Math.min(dangerCount,   remaining); remaining -= d;
    let t = Math.min(treasureCount, remaining); remaining -= t;

    // If there's leftover (because input sums were too small), dump into features
    if (remaining > 0) {
      f += remaining;
      remaining = 0;
    }

    const typePool = [];
    for (let i = 0; i < f; i++) typePool.push("feature");
    for (let i = 0; i < d; i++) typePool.push("danger");
    for (let i = 0; i < t; i++) typePool.push("treasure");

    const shuffledTypes = this._shuffle(typePool);

    // Choose which indices are marked
    const allIndices   = [...Array(points.length).keys()];
    const shuffledIdx  = this._shuffle(allIndices);
    const markedIndices = shuffledIdx.slice(0, totalMarked);

    const typeByIndex = new Map();
    markedIndices.forEach((idx, i) => {
      const tp = shuffledTypes[i] ?? "feature";
      typeByIndex.set(idx, tp);
    });

    const pointsWithTypes = points.map((p, idx) => {
      const type = typeByIndex.has(idx) ? typeByIndex.get(idx) : "blank";
      return { ...p, type, number: null };
    });

    // Now we need adjacency graph to assign S/2/3/G
    const allLines = this._getAllPossibleLines(pointsWithTypes, sides, includeCenter);

    const neighborsOf = (idx) => {
      const result = [];
      for (const [a, b] of allLines) {
        if (a === idx) result.push(b);
        else if (b === idx) result.push(a);
      }
      return result;
    };

    let marked = markedIndices.slice();

    if (!marked.length) {
      // In the pathological case, mark the first point
      marked = [0];
      pointsWithTypes[0].type = "feature";
    }

    // Choose Start index
    let sIdx = null;
    for (const cand of marked) {
      const neigh = neighborsOf(cand).filter(n => marked.includes(n));
      if (neigh.length > 0) {
        sIdx = cand;
        break;
      }
    }
    if (sIdx === null) sIdx = marked[0];

    const sNeighbors = neighborsOf(sIdx).filter(n => marked.includes(n) && n !== sIdx);

    // Pick 2
    let twoIdx = sNeighbors.length
      ? sNeighbors[Math.floor(this._rng() * sNeighbors.length)]
      : null;

    this.startIndex = sIdx;
    this.twoIndex   = twoIdx;

    const remainingAfterS2 = marked.filter(i => i !== sIdx && i !== twoIdx);

    // Pick 3 (adjacent to Start or 2 if possible)
    const twoNeighbors = (twoIdx !== null)
      ? neighborsOf(twoIdx).filter(n => marked.includes(n) && n !== twoIdx)
      : [];

    const threeCandidates = remainingAfterS2.filter(
      i => sNeighbors.includes(i) || twoNeighbors.includes(i)
    );

    let threeIdx = null;
    if (threeCandidates.length > 0) {
      threeIdx = threeCandidates[Math.floor(this._rng() * threeCandidates.length)];
    } else if (remainingAfterS2.length > 0) {
      threeIdx = remainingAfterS2[0];
    }

    this.threeIndex = threeIdx;

    const remainingAfter3 = remainingAfterS2.filter(i => i !== threeIdx);

    // Goal
    let gIdx = null;
    if (remainingAfter3.length > 0) {
      gIdx = remainingAfter3[remainingAfter3.length - 1];
    }
    this.goalIndex = gIdx;

    // Build numeric labels based on shape size.
    // - Pentagon  (5 sides): [4]   -> S, 2, 3, 4, G(5)
    // - Hexagon   (6 sides): [4,5] -> S, 2, 3, 4, 5, G(6)
    // - Heptagon  (7 sides): [4,5,6]
    // - Octagon   (8 sides): [4,5,6,7]
    // We cap at 7 so if we ever add larger shapes, we don't spawn infinite labels.
    const numericLabels = [];
    const maxNumeric = Math.min(sides - 1, 7);
    for (let n = 4; n <= maxNumeric; n++) {
      numericLabels.push(n);
    }

    const middleNumbers = this._shuffle(numericLabels);

    // Assign labels
    pointsWithTypes[sIdx].number = "S";
    if (twoIdx   !== null && pointsWithTypes[twoIdx])   pointsWithTypes[twoIdx].number   = 2;
    if (threeIdx !== null && pointsWithTypes[threeIdx]) pointsWithTypes[threeIdx].number = 3;
    if (gIdx     !== null && pointsWithTypes[gIdx])     pointsWithTypes[gIdx].number     = "G";

    for (const idx of remainingAfter3) {
      if (idx === gIdx) continue;
      const n = middleNumbers.shift();
      if (n !== undefined && pointsWithTypes[idx]) {
        pointsWithTypes[idx].number = n;
      }
    }
    return pointsWithTypes;
  }

  // Assign 1–2 key locations when Keys option is enabled
  _assignKeys(points) {
    this.key1Index = null;
    this.key2Index = null;

    if (this.goalIndex == null) return;

    const labelToIndex = {};
    points.forEach((p, idx) => {
      if (p.number !== null && p.number !== undefined) {
        labelToIndex[p.number] = idx;
      }
    });

    const wantTwoKeys = this._rng() < 0.5;
    const exists = (n) => labelToIndex[n] !== undefined;

    if (wantTwoKeys && (exists(2) || exists(3)) && (exists(4) || exists(5))) {
      const key1Candidates = [2, 3].filter(exists).map(n => labelToIndex[n]);
      const key2Candidates = [4, 5].filter(exists).map(n => labelToIndex[n]);

      if (key1Candidates.length && key2Candidates.length) {
        this.key1Index = key1Candidates[Math.floor(this._rng() * key1Candidates.length)];
        this.key2Index = key2Candidates[Math.floor(this._rng() * key2Candidates.length)];
        return;
      }
    }

    const singleKeyCandidates = [3, 4, 5]
      .filter(exists)
      .map(n => labelToIndex[n]);

    if (singleKeyCandidates.length) {
      this.key1Index = singleKeyCandidates[Math.floor(this._rng() * singleKeyCandidates.length)];
      this.key2Index = null;
      return;
    }

    const fallbackCandidates = points
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) =>
        p.type !== "blank" &&
        p.number !== "S" &&
        p.number !== "G"
      )
      .map(({ idx }) => idx);

    if (fallbackCandidates.length) {
      this.key1Index = fallbackCandidates[Math.floor(this._rng() * fallbackCandidates.length)];
      this.key2Index = null;
    }
  }

  // Egress assignment: entrance at Start, exit at a random non-Start node
  _assignEgress(points) {
    this.exitIndex = null;
    if (this.startIndex == null) return;

    const candidates = points
      .map((p, idx) => ({ p, idx }))
      .filter(({ p, idx }) =>
        p.type !== "blank" &&
        p.number !== "S" &&
        idx !== this.startIndex
      )
      .map(({ idx }) => idx);

    if (!candidates.length) return;

    this.exitIndex = candidates[Math.floor(this._rng() * candidates.length)];
  }

  // Stairs assignment: one non-Start node gets stairs
  _assignStairs(points) {
    this.stairsIndex = null;

    const candidates = points
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) =>
        p.type !== "blank" &&
        p.number !== "S"
      )
      .map(({ idx }) => idx);

    if (!candidates.length) return;

    this.stairsIndex = candidates[Math.floor(this._rng() * candidates.length)];
  }

  _getAllPossibleLines(points, sides, includeCenter) {
    const lines = [];
    const outerCount = sides;
    const centerIndex = includeCenter ? outerCount : null;

    // Ring edges
    for (let i = 0; i < outerCount; i++) {
      const j = (i + 1) % outerCount;
      if (i < points.length && j < points.length) {
        lines.push([i, j]);
      }
    }

    // Radial edges to center
    if (includeCenter && centerIndex != null && centerIndex < points.length) {
      for (let i = 0; i < outerCount; i++) {
        if (i < points.length) {
          lines.push([i, centerIndex]);
        }
      }
    }

    return lines;
  }

  _segmentsCross(points, e1, e2) {
    const [i1, j1] = e1;
    const [i2, j2] = e2;

    if (i1 === i2 || i1 === j2 || j1 === i2 || j1 === j2) return false;

    const p1 = points[i1];
    const q1 = points[j1];
    const p2 = points[i2];
    const q2 = points[j2];

    function cross(ax, ay, bx, by, cx, cy) {
      return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }

    const d1 = cross(p1.x, p1.y, q1.x, q1.y, p2.x, p2.y);
    const d2 = cross(p1.x, p1.y, q1.x, q1.y, q2.x, q2.y);
    const d3 = cross(p2.x, p2.y, q2.x, q2.y, p1.x, p1.y);
    const d4 = cross(p2.x, p2.y, q2.x, q2.y, q1.x, q1.y);

    // Collinear case: treat as non-crossing here
    if ((d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0)) {
      return false;
    }

    return (d1 * d2 < 0) && (d3 * d4 < 0);
  }

  _allMarkedConnected(edges, markedIndices) {
    if (markedIndices.length === 0) return true;

    const adj = new Map();
    for (const idx of markedIndices) {
      adj.set(idx, []);
    }

    for (const [a, b] of edges) {
      if (adj.has(a) && adj.has(b)) {
        adj.get(a).push(b);
        adj.get(b).push(a);
      }
    }

    const start = markedIndices[0];
    const visited = new Set();
    const stack = [start];

    while (stack.length) {
      const v = stack.pop();
      if (visited.has(v)) continue;
      visited.add(v);
      const ns = adj.get(v) || [];
      for (const n of ns) {
        if (!visited.has(n)) stack.push(n);
      }
    }

    return markedIndices.every(i => visited.has(i));
  }

  _isValidEdgeSet(points, edges, markedIndices) {
    // No crossings
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        if (this._segmentsCross(points, edges[i], edges[j])) {
          return false;
        }
      }
    }

    // Degree check: every marked node must have at least one incident edge
    const deg = new Array(points.length).fill(0);
    for (const [a, b] of edges) {
      deg[a]++;
      deg[b]++;
    }

    for (const idx of markedIndices) {
      if (deg[idx] === 0) return false;
    }

    // Connectivity
    if (!this._allMarkedConnected(edges, markedIndices)) return false;

    return true;
  }

  _chooseRandomLines(points, sides, includeCenter, desiredCount) {
    const allLines = this._getAllPossibleLines(points, sides, includeCenter);

    const candidateAll = allLines
      .filter(([i, j]) => points[i].type !== "blank" && points[j].type !== "blank");

    if (!candidateAll.length) return [];

    const candidate = this._shuffle(candidateAll.slice());

    const markedIndices = points
      .map((p, idx) => (p.type === "blank" ? -1 : idx))
      .filter(idx => idx !== -1);

    const requiredEdges = [];

    // Start <-> 2
    if (this.startIndex != null && this.twoIndex != null) {
      const s2 = candidateAll.find(
        ([a, b]) =>
          (a === this.startIndex && b === this.twoIndex) ||
          (a === this.twoIndex && b === this.startIndex)
      );
      if (s2) requiredEdges.push(s2);
    }

    // 3 <-> (Start or 2)
    if (this.threeIndex != null) {
      let edge3 = null;
      if (this.startIndex != null) {
        edge3 = candidateAll.find(
          ([a, b]) =>
            (a === this.threeIndex && b === this.startIndex) ||
            (a === this.startIndex && b === this.threeIndex)
        );
      }
      if (!edge3 && this.twoIndex != null) {
        edge3 = candidateAll.find(
          ([a, b]) =>
            (a === this.threeIndex && b === this.twoIndex) ||
            (a === this.twoIndex && b === this.threeIndex)
        );
      }
      if (edge3) {
        if (!requiredEdges.some(e => e[0] === edge3[0] && e[1] === edge3[1])) {
          requiredEdges.push(edge3);
        }
      }
    }

    const minK = Math.max(requiredEdges.length || 1, 1);
    const maxPossible = candidateAll.length;
    const targetK = Math.max(minK, Math.min(desiredCount || minK, maxPossible));

    const tryWithK = (k) => {
      let found = null;

      const targetExtras = k - requiredEdges.length;
      if (targetExtras < 0) return null;

      const remaining = candidate.filter(
        e => !requiredEdges.some(r => r[0] === e[0] && r[1] === e[1])
      );

      const backtrack = (start, current) => {
        if (found) return;
        if (current.length === targetExtras) {
          const edges = [...requiredEdges, ...current];
          if (this._isValidEdgeSet(points, edges, markedIndices)) {
            found = edges.map(e => e.slice());
          }
          return;
        }

        for (let i = start; i <= remaining.length - (targetExtras - current.length); i++) {
          current.push(remaining[i]);
          backtrack(i + 1, current);
          current.pop();
          if (found) return;
        }
      };

      backtrack(0, []);
      return found;
    };

    for (let k = targetK; k >= minK; k--) {
      const result = tryWithK(k);
      if (result) return result;
    }

    // If nothing works, fallback to just requiredEdges (if valid) or empty
    if (this._isValidEdgeSet(points, requiredEdges, markedIndices)) {
      return requiredEdges;
    }

    return [];
  }

  // ----- Coordinate helpers for overlay scaling -----
  _toOverlayCoords(x, y) {
    if (!this.iconLayer) return { oxPercent: 0, oyPercent: 0 };

    return {
      oxPercent: (x / this.width) * 100,
      oyPercent: (y / this.height) * 100
    };
  }

  _placeFAIcon(
    className,
    x,
    y,
    sizePx   = 14,
    color    = "black",
    extraClass = "",
    offsetX  = 0,
    offsetY  = 0
  ) {
    if (!this.iconLayer) return;

    const { oxPercent, oyPercent } = this._toOverlayCoords(x, y);

    const icon = document.createElement("i");
    icon.className = `${className} ${extraClass}`.trim();
    icon.style.position = "absolute";

    icon.style.left = `${oxPercent}%`;
    icon.style.top  = `${oyPercent}%`;

    icon.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;

    icon.style.fontSize      = `${sizePx}px`;
    icon.style.lineHeight    = "1";
    icon.style.pointerEvents = "none";
    icon.style.color         = color;

    // Mark as a map icon so we can clear them without deleting trackers
    icon.dataset.layer = "map-icon";

    this.iconLayer.appendChild(icon);
  }

  _drawArrow(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const headLength = 10;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- decorated line drawing ----------
  _drawLines(points, lines, pathCounts) {
    const ctx = this.ctx;
    const count = lines.length;
    if (!count) return;

    // Path type counts
    let secretCount = Math.max(0, pathCounts.secret ?? 0);
    let closedCount = Math.max(0, pathCounts.closed ?? 0);
    const totalLines = lines.length;

    if (secretCount > totalLines) secretCount = totalLines;
    if (closedCount > (totalLines - secretCount)) {
      closedCount = totalLines - secretCount;
    }

    // Decide which edge indices are secret / closed
    const indices = Array.from({ length: totalLines }, (_, i) => i);
    const shuffled = this._shuffle(indices);

    const secretIndices = new Set(shuffled.slice(0, secretCount));
    const closedIndices = new Set(
      shuffled.slice(secretCount, secretCount + closedCount)
    );

    // Patrols & traps still layered on top
    let patrolIndices = new Set();
    if (this.usePatrols && totalLines > 0) {
      const openCandidates = indices.filter(
        i => !secretIndices.has(i) && !closedIndices.has(i)
      );
      if (openCandidates.length > 0) {
        const patrolCount = Math.min(
          1 + Math.floor(this._rng() * 2),
          openCandidates.length
        );
        const patrolOrder = this._shuffle(openCandidates.slice());
        patrolIndices = new Set(patrolOrder.slice(0, patrolCount));
      }
    }

    let trapIndices = new Set();
    if (this.useTraps && closedIndices.size > 0) {
      const obstructedIndices = Array.from(closedIndices);
      const trapCount = Math.min(
        1 + Math.floor(this._rng() * 2),
        obstructedIndices.length
      );
      const trapOrder = this._shuffle(obstructedIndices.slice());
      trapIndices = new Set(trapOrder.slice(0, trapCount));
    }

    for (let li = 0; li < totalLines; li++) {
      const [i, j] = lines[li];
      const a = points[i];
      const b = points[j];

      const isSecret = secretIndices.has(li);
      const isClosed = closedIndices.has(li);
      const isPatrol = this.usePatrols && patrolIndices.has(li);
      const isTrap   = this.useTraps   && trapIndices.has(li);

      // Base geometry
      const dx  = b.x - a.x;
      const dy  = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx  = -dy / len;
      const ny  =  dx / len;

      // Simple full segment
      ctx.beginPath();
      ctx.setLineDash(isSecret ? [8, 6] : []);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Midpoint for decorations
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      if (isClosed) {
        const tickLen = 12;
        const hx = (tickLen / 2) * nx;
        const hy = (tickLen / 2) * ny;

        ctx.beginPath();
        ctx.moveTo(mx - hx, my - hy);
        ctx.lineTo(mx + hx, my + hy);
        ctx.stroke();
      }

      if (isPatrol) {
        this._placeFAIcon("fa-solid fa-skull", mx, my, 16, "black");
      }

      if (isTrap) {
        const offset = -24;
        const tx = mx + nx * offset;
        const ty = my + ny * offset;
        this._placeFAIcon("fa-solid fa-land-mine-on", tx, ty, 16, "black");
      }
    }

    ctx.setLineDash([]);
  }
  // ---------- END line drawing ----------

  _drawPoints(points) {
    const ctx = this.ctx;

    for (const p of points) {
      if (p.type === "blank") continue;

      const { x, y, type } = p;
      const r = 20;

      ctx.beginPath();

      if (type === "feature") {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      } else if (type === "danger") {
        ctx.moveTo(x,     y - r);
        ctx.lineTo(x - r, y + r);
        ctx.lineTo(x + r, y + r);
        ctx.closePath();
      } else if (type === "treasure") {
        ctx.moveTo(x,     y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x,     y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
      }

      ctx.fillStyle = "white";
      ctx.fill();
      ctx.stroke();
    }

    points.forEach((p, idx) => {
      const { type, number, x, y } = p;
      if (type === "blank") return;

      let yOffset = 0;
      if (type === "danger") {
        yOffset = 4;
      }

      const isKeyNode    = this.useKeys && (idx === this.key1Index || idx === this.key2Index);
      const isLockedGoal = this.useKeys && (idx === this.goalIndex);

      if (isLockedGoal) {
        this._placeFAIcon(
          "fa-solid fa-lock",
          x,
          y + yOffset,
          16,
          "black"
        );
        return;
      }

      if (isKeyNode) {
        let keyOffsetX = 0;
        let keyOffsetY = 0;

        if (type === "danger") {
          keyOffsetX = -1;
          keyOffsetY = 2;
        }

        this._placeFAIcon(
          "fa-solid fa-key",
          x,
          y + yOffset,
          16,
          "black",
          "",
          keyOffsetX,
          keyOffsetY
        );
        return;
      }

      if (number === null || number === undefined) return;

      ctx.save();
      ctx.font = "16px sans-serif";
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle   = "black";

      if (number === "S" || number === "G") {
        ctx.font = "bold 16px sans-serif";
      }

      ctx.fillText(String(number), x, y + yOffset);
      ctx.restore();
    });
  }

  _drawStairs(points) {
    if (this.stairsIndex == null) return;
    if (!this.iconLayer) return;

    const p = points[this.stairsIndex];

    const cx = this.centerX;
    const cy = this.centerY;
    const vx = p.x - cx;
    const vy = p.y - cy;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;

    const r = this.nodeRadius;
    const badgeDist = r + 5;
    const bx = p.x + ux * badgeDist;
    const by = p.y + uy * badgeDist;

    this._placeFAIcon(
      "fa-sharp-duotone fa-regular fa-stairs",
      bx,
      by,
      14,
      "black"
    );
  }

  _drawEgress(points) {
    const r  = this.nodeRadius;
    const cx = this.centerX;
    const cy = this.centerY;

    if (this.startIndex != null) {
      const s = points[this.startIndex];
      const vx = s.x - cx;
      const vy = s.y - cy;
      const len = Math.hypot(vx, vy) || 1;
      const ux  = vx / len;
      const uy  = vy / len;

      const tailX = s.x + ux * (r + 8);
      const tailY = s.y + uy * (r + 8);
      const tipX  = s.x + ux * (r + 2);
      const tipY  = s.y + uy * (r + 2);

      this._drawArrow(tailX, tailY, tipX, tipY);
    }

    if (this.exitIndex != null) {
      const p = points[this.exitIndex];
      const vx = p.x - cx;
      const vy = p.y - cy;
      const len = Math.hypot(vx, vy) || 1;
      const ux  = vx / len;
      const uy  = vy / len;

      const tailX = p.x + ux * (r + 2);
      const tailY = p.y + uy * (r + 2);
      const tipX  = p.x + ux * (r + 10);
      const tipY  = p.y + uy * (r + 10);

      this._drawArrow(tailX, tailY, tipX, tipY);
    }
  }
}

// ----- Main dialog function (module-style, not macro) -----

export async function openDungeonMapper() {
  if (!game.user.isGM) {
    ui.notifications?.warn?.("Dungeon Mapper is GM-only.");
    return;
  }

  // Ensure singleton on this client
  if (_builderAppId && ui.windows[_builderAppId]) {
    ui.windows[_builderAppId]?.bringToTop?.();
    return;
  }

  // Render Handlebars template and wrap it with the root ID
  const rawContent = await renderTemplate("modules/lookfar/templates/dungeon-mapper.hbs", {});
  const content = `<div id="lookfar-dungeon-mapper">${rawContent}</div>`;

  const dlg = new Dialog({
    title: "Dungeon Mapper",
    content,
    buttons: {},
    render: function(html) {
      const app = this;
      const generatorAppId = app.appId;
      _builderAppId = generatorAppId;

      const $html = html;

      // Inject custom SVG icons into the shape buttons
      injectShapeIcons($html);

      const canvas = $html.find("#dungeon-builder-canvas")[0];
      const ctx    = canvas.getContext("2d");
      const iconLayer = $html.find("#dungeon-builder-icons")[0];

      const lastState = _lastDungeonState || null;

      const generator = new DungeonMapper(
        ctx,
        canvas.width,
        canvas.height,
        iconLayer,
        lastState && typeof lastState.seed === "number" ? lastState.seed : null
      );

      const keysButton    = $html.find("#dungeon-builder-opt-keys")[0];
      const patrolsButton = $html.find("#dungeon-builder-opt-patrols")[0];
      const trapsButton   = $html.find("#dungeon-builder-opt-traps")[0];

      const seedCurrentSpan = $html.find("#dungeon-builder-seed-current")[0];
      const seedInputField  = $html.find("#dungeon-builder-seed-input")[0];
      const seedCopyBtn     = $html.find("#dungeon-builder-seed-copy")[0];
      const seedApplyBtn    = $html.find("#dungeon-builder-seed-apply")[0];

      // Numeric inputs for paths and points
      const pathOpenInput    = $html.find("#dungeon-builder-path-open-count")[0];
      const pathClosedInput  = $html.find("#dungeon-builder-path-closed-count")[0];
      const pathSecretInput  = $html.find("#dungeon-builder-path-secret-count")[0];

      const pointFeatureInput  = $html.find("#dungeon-builder-point-feature-count")[0];
      const pointDangerInput   = $html.find("#dungeon-builder-point-danger-count")[0];
      const pointTreasureInput = $html.find("#dungeon-builder-point-treasure-count")[0];

      // Shape config: sides + defaults per shape
      const SHAPE_CONFIG = {
        pent: {
          sides: 5,
          points: { feature: 3, danger: 1, treasure: 1 },
          paths:  { open: 2, closed: 1, secret: 1 }
        },
        hex: {
          sides: 6,
          points: { feature: 3, danger: 2, treasure: 1 },
          paths:  { open: 3, closed: 2, secret: 1 }
        },
        // Key name remains "sept" for wiring; UI label says Heptagon
        sept: {
          sides: 7,
          points: { feature: 3, danger: 2, treasure: 2 },
          paths:  { open: 2, closed: 3, secret: 2 }
        },
        oct: {
          sides: 8,
          points: { feature: 3, danger: 3, treasure: 2 },
          paths:  { open: 3, closed: 3, secret: 2 }
        }
      };

      const shapeKeyForSides = (sides) => {
        for (const [key, cfg] of Object.entries(SHAPE_CONFIG)) {
          if (cfg.sides === sides) return key;
        }
        return "hex";
      };

      const pathGroupInputs = {
        open:   pathOpenInput,
        closed: pathClosedInput,
        secret: pathSecretInput
      };

      const pointGroupInputs = {
        feature:  pointFeatureInput,
        danger:   pointDangerInput,
        treasure: pointTreasureInput
      };

      // Clamp to [0,3] and return numeric value
      const clampField = (input) => {
        if (!input) return 0;
        let v = parseInt(input.value, 10);
        if (Number.isNaN(v)) v = 0;
        if (v < 0) v = 0;
        if (v > 3) v = 3;
        input.value = String(v);
        return v;
      };

      // Current active shape
      let activeShape = "hex";

      const getShapeConfig = () => SHAPE_CONFIG[activeShape] || SHAPE_CONFIG.hex;

      // Apply default values for a given shape
      const applyShapeDefaults = (shapeKey) => {
        const cfg = SHAPE_CONFIG[shapeKey] || SHAPE_CONFIG.hex;
        activeShape = shapeKey;

        // Points
        if (pointFeatureInput)  pointFeatureInput.value  = cfg.points.feature;
        if (pointDangerInput)   pointDangerInput.value   = cfg.points.danger;
        if (pointTreasureInput) pointTreasureInput.value = cfg.points.treasure;

        // Paths
        if (pathOpenInput)   pathOpenInput.value   = cfg.paths.open;
        if (pathClosedInput) pathClosedInput.value = cfg.paths.closed;
        if (pathSecretInput) pathSecretInput.value = cfg.paths.secret;
      };

      // Enforce per-group total <= sides, adjusting other fields if needed
      const enforceGroupTotals = (groupInputs, changedKey = null) => {
        const cfg = getShapeConfig();
        const maxTotal = cfg.sides;

        const values = {};
        let total = 0;

        const allKeys = Object.keys(groupInputs).filter(k => groupInputs[k]);

        for (const key of allKeys) {
          const input = groupInputs[key];
          const v = clampField(input);
          values[key] = v;
          total += v;
        }

        if (total <= maxTotal) return;

        let overflow = total - maxTotal;

        // Priority: all other fields first, then the changed field last (if provided)
        let priority = allKeys;
        if (changedKey && allKeys.includes(changedKey)) {
          priority = allKeys.filter(k => k !== changedKey);
          priority.push(changedKey);
        }

        while (overflow > 0) {
          let adjustedThisPass = false;

          for (const key of priority) {
            if (overflow <= 0) break;
            if (values[key] > 0) {
              values[key]--;
              overflow--;
              adjustedThisPass = true;
              if (overflow <= 0) break;
            }
          }

          if (!adjustedThisPass) break; // can't reduce any further
        }

        // Push adjusted values back into inputs
        for (const key of allKeys) {
          const input = groupInputs[key];
          if (!input) continue;
          input.value = String(values[key] ?? 0);
        }
      };

      // Wire change handlers for all numeric inputs
      for (const [key, input] of Object.entries(pathGroupInputs)) {
        if (!input) continue;
        input.addEventListener("change", () => enforceGroupTotals(pathGroupInputs, key));
      }

      for (const [key, input] of Object.entries(pointGroupInputs)) {
        if (!input) continue;
        input.addEventListener("change", () => enforceGroupTotals(pointGroupInputs, key));
      }

      // Initialize numeric inputs to current shape defaults (hex by default)
      applyShapeDefaults(activeShape);
      enforceGroupTotals(pathGroupInputs);
      enforceGroupTotals(pointGroupInputs);

      // Seed copy handler
      if (seedCopyBtn && seedCurrentSpan) {
        seedCopyBtn.addEventListener("click", async () => {
          const value = seedCurrentSpan.textContent?.trim();
          if (!value || value === "—") {
            ui.notifications?.warn?.("No seed to copy yet.");
            return;
          }

          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(value);
            } else {
              const ta = document.createElement("textarea");
              ta.value = value;
              ta.style.position = "fixed";
              ta.style.left = "-9999px";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
            ui.notifications?.info?.("Seed copied to clipboard.");
          } catch (err) {
            console.error("[Dungeon Mapper] Failed to copy seed:", err);
            ui.notifications?.error?.("Failed to copy seed to clipboard.");
          }
        });
      }

      // generate-options state (backed by lastState if present)
      let genOptions = {
        useKeys:    !!(lastState?.options?.useKeys),
        usePatrols: !!(lastState?.options?.usePatrols),
        useTraps:   !!(lastState?.options?.useTraps)
      };

      // --- Generate option buttons (multi-toggle) ---
      const genButtons = {
        useKeys:    keysButton,
        usePatrols: patrolsButton,
        useTraps:   trapsButton
      };

      const updateGenButtons = () => {
        for (const [key, btn] of Object.entries(genButtons)) {
          if (!btn) continue;
          const active = !!genOptions[key];
          if (active) {
            btn.style.background  = "#ccc";
            btn.style.borderColor = "#555";
            btn.style.boxShadow   = "inset 0 0 3px rgba(0,0,0,0.5)";
          } else {
            btn.style.background  = "#eee";
            btn.style.borderColor = "#888";
            btn.style.boxShadow   = "none";
          }
        }
      };

      Object.entries(genButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.addEventListener("click", () => {
          genOptions[key] = !genOptions[key]; // toggle on/off
          updateGenButtons();
        });
      });

      // initialize button states from genOptions / lastState
      updateGenButtons();
      // --- end generate option buttons ---

      // --- Shape toggle buttons (single active) ---
      const shapeButtons = {
        pent: $html.find("#dungeon-builder-shape-pent")[0],
        hex:  $html.find("#dungeon-builder-shape-hex")[0],
        sept: $html.find("#dungeon-builder-shape-sept")[0],
        oct:  $html.find("#dungeon-builder-shape-oct")[0]
      };

      const updateShapeButtons = () => {
        for (const [key, btn] of Object.entries(shapeButtons)) {
          if (!btn) continue;
          if (key === activeShape) {
            btn.style.background  = "#ccc";
            btn.style.borderColor = "#555";
            btn.style.boxShadow   = "inset 0 0 3px rgba(0,0,0,0.5)";
          } else {
            btn.style.background  = "#eee";
            btn.style.borderColor = "#888";
            btn.style.boxShadow   = "none";
          }
        }
      };

      Object.entries(shapeButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.addEventListener("click", () => {
          if (activeShape === key) return; // already active
          applyShapeDefaults(key);        // reset inputs to that shape's defaults
          enforceGroupTotals(pathGroupInputs);
          enforceGroupTotals(pointGroupInputs);
          activeShape = key;
          updateShapeButtons();
        });
      });

      // Initialize active shape button state
      updateShapeButtons();
      // --- end shape toggle buttons ---

      const getOptions = () => {
        const cfg = getShapeConfig();
        const sides = cfg.sides || 6;

        // Clamp first, then enforce totals just in case
        const featureCount  = clampField(pointFeatureInput);
        const dangerCount   = clampField(pointDangerInput);
        const treasureCount = clampField(pointTreasureInput);

        const pathOpen   = clampField(pathOpenInput);
        const pathClosed = clampField(pathClosedInput);
        const pathSecret = clampField(pathSecretInput);

        enforceGroupTotals(pointGroupInputs);
        enforceGroupTotals(pathGroupInputs);

        return {
          useKeys:    !!genOptions.useKeys,
          usePatrols: !!genOptions.usePatrols,
          useTraps:   !!genOptions.useTraps,
          sides,
          featureCount,
          dangerCount,
          treasureCount,
          pathOpen,
          pathClosed,
          pathSecret,
          shapeKey: activeShape
        };
      };

      const $generateBtn = $html.find("#dungeon-builder-generate-btn");
      const $saveBtn     = $html.find("#dungeon-builder-save-btn");

      const redrawWith = (options, seed) => {
        if (typeof seed === "number") {
          generator.setSeed(seed);
        }
        generator.draw(options);
      };

      // --- Draggable party trackers on main map ---
      let resetPartyTrackers = null;
      try {
        const trackerLayer = iconLayer;
        if (trackerLayer) {
          // Build one tracker per active user, using their Player Color
          const trackerDefs = game.users.map(u => ({
            id: `db-tracker-user-${u.id}`,
            color: u.color || "#ffffff",
            label: u.name || "Player"
          }));

          const iconSize = 18;
          const margin   = 6;

          const dragState = { icon: null, offsetX: 0, offsetY: 0 };

          const onMouseMove = (ev) => {
            if (!dragState.icon) return;
            const rect = trackerLayer.getBoundingClientRect();

            let newLeft = ev.clientX - rect.left - dragState.offsetX;
            let newTop  = ev.clientY - rect.top  - dragState.offsetY;

            const maxX = trackerLayer.clientWidth  - dragState.icon.offsetWidth;
            const maxY = trackerLayer.clientHeight - dragState.icon.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop  = Math.max(0, Math.min(newTop,  maxY));

            dragState.icon.style.left = `${newLeft}px`;
            dragState.icon.style.top  = `${newTop}px`;
          };

          const endDrag = () => {
            if (!dragState.icon) return;
            dragState.icon.style.cursor = "grab";
            dragState.icon = null;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", endDrag);
          };

          const ensureTrackers = () => {
            trackerDefs.forEach((def) => {
              let icon = trackerLayer.querySelector(`[data-tracker-id="${def.id}"]`);
              if (!icon) {
                icon = document.createElement("i");
                icon.className = "fa-solid fa-person-dress-simple";
                icon.dataset.trackerId = def.id;

                icon.style.position      = "absolute";
                icon.style.fontSize      = `${iconSize}px`;
                icon.style.lineHeight    = "1";
                icon.style.color         = def.color;
                icon.style.cursor        = "grab";
                icon.style.pointerEvents = "auto";
                icon.style.zIndex        = "10";

                // Tooltip / accessibility label (player name)
                if (def.label) {
                  icon.title = def.label;
                  icon.setAttribute("aria-label", def.label);
                }

                icon.addEventListener("mousedown", (ev) => {
                  ev.preventDefault();
                  const rect = trackerLayer.getBoundingClientRect();
                  dragState.icon    = icon;
                  dragState.offsetX = ev.clientX - (rect.left + icon.offsetLeft);
                  dragState.offsetY = ev.clientY - (rect.top  + icon.offsetTop);
                  icon.style.cursor = "grabbing";

                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", endDrag);
                });

                trackerLayer.appendChild(icon);
                console.log("[Dungeon Mapper] created tracker", def.id);
              }
            });
          };

          const resetImpl = () => {
            const rectWidth = trackerLayer.clientWidth;
            if (!rectWidth) return;

            ensureTrackers();

            let baseLeft = rectWidth - iconSize - margin;
            if (!Number.isFinite(baseLeft) || baseLeft < margin) {
              baseLeft = rectWidth > 0 ? rectWidth - iconSize - margin : margin;
            }

            let currentTop = margin;

            trackerDefs.forEach((def) => {
              const icon = trackerLayer.querySelector(`[data-tracker-id="${def.id}"]`);
              if (!icon) return;
              icon.style.left = `${baseLeft}px`;
              icon.style.top  = `${currentTop}px`;
              currentTop += iconSize + 4;
            });
          };

          resetPartyTrackers = resetImpl;

          // Initial placement once layout is ready
          requestAnimationFrame(() => resetImpl());
        }
      } catch (e) {
        console.warn("[Dungeon Mapper] could not create trackers", e);
      }
      // --- end draggable party trackers ---

      $generateBtn.on("click", () => {
        // Always generate a brand-new random seed
        const seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;

        // Use the *current UI* options (buttons, counts, shape)
        const options = getOptions();

        // Draw with these options + random seed
        redrawWith(options, seed);

        // Cache this seed's options so Apply can recall them later
        _lastDungeonState = { seed, options };
        _dungeonSeedHistory.set(seed, { ...options });

        // Update visible seed
        const s = String(seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;

        // Clear the input field (Generate ignores it)
        if (seedInputField) seedInputField.value = "";

        // Reset trackers on every generate (without deleting them)
        if (typeof resetPartyTrackers === "function") {
          resetPartyTrackers();
        }
      });

      if (seedApplyBtn) {
        seedApplyBtn.addEventListener("click", () => {
          // Read & validate seed from input
          const raw = seedInputField?.value?.trim();
          if (!raw) {
            ui.notifications?.warn?.("Enter a seed to apply.");
            return;
          }

          const parsed = Number(raw);
          if (!Number.isFinite(parsed) || parsed < 0) {
            ui.notifications?.warn?.("Invalid seed entered.");
            return;
          }

          const seed = parsed >>> 0;

          // Decide which options to use for this seed
          let options;
          const cached = _dungeonSeedHistory.get(seed);

          if (cached) {
            // Use cached options for this seed
            const opt = { ...cached };
            options = opt;

            // Restore shape selection
            const restoredShapeKey = opt.shapeKey || shapeKeyForSides(opt.sides || 6);
            activeShape = restoredShapeKey;
            updateShapeButtons();

            // Restore numeric inputs (points)
            if (pointFeatureInput)  pointFeatureInput.value  = opt.featureCount  ?? 0;
            if (pointDangerInput)   pointDangerInput.value   = opt.dangerCount   ?? 0;
            if (pointTreasureInput) pointTreasureInput.value = opt.treasureCount ?? 0;

            // Restore numeric inputs (paths)
            if (pathOpenInput)   pathOpenInput.value   = opt.pathOpen   ?? 0;
            if (pathClosedInput) pathClosedInput.value = opt.pathClosed ?? 0;
            if (pathSecretInput) pathSecretInput.value = opt.pathSecret ?? 0;

            // Re-enforce totals with the restored shape
            enforceGroupTotals(pointGroupInputs);
            enforceGroupTotals(pathGroupInputs);

            // Restore toggles (keys / patrols / traps)
            genOptions.useKeys    = !!opt.useKeys;
            genOptions.usePatrols = !!opt.usePatrols;
            genOptions.useTraps   = !!opt.useTraps;
            updateGenButtons();
          } else {
            // No cached options for this seed: fall back to current UI state
            options = getOptions();
          }

          // Draw with chosen options + this seed
          redrawWith(options, seed);

          // Update lastState and cache this seed's options
          _lastDungeonState = { seed, options };
          _dungeonSeedHistory.set(seed, { ...options });

          // Update displayed seed
          const s = String(seed >>> 0);
          if (seedCurrentSpan) seedCurrentSpan.textContent = s;

          // Clear the input so a new seed can be entered
          if (seedInputField) seedInputField.value = "";

          // Reset trackers
          if (typeof resetPartyTrackers === "function") {
            resetPartyTrackers();
          }
        });
      }


      $saveBtn.on("click", () => {
        // Placeholder for future integration (journal entry, note, etc.)
        console.log("[Dungeon Mapper] Save clicked (not yet implemented).");
      });

      // Initial draw: restore last state if present, otherwise roll fresh
      if (lastState && lastState.options && typeof lastState.seed === "number") {
        const opt = lastState.options;

        // --- Restore shape selection from stored seed ---
        const restoredShapeKey = opt.shapeKey || shapeKeyForSides(opt.sides || 6);
        activeShape = restoredShapeKey;
        updateShapeButtons();

        // --- Restore numeric inputs (points) from stored options tied to this seed ---
        if (pointFeatureInput)  pointFeatureInput.value  = opt.featureCount  ?? 0;
        if (pointDangerInput)   pointDangerInput.value   = opt.dangerCount   ?? 0;
        if (pointTreasureInput) pointTreasureInput.value = opt.treasureCount ?? 0;

        // --- Restore numeric inputs (paths) from stored options tied to this seed ---
        if (pathOpenInput)   pathOpenInput.value   = opt.pathOpen   ?? 0;
        if (pathClosedInput) pathClosedInput.value = opt.pathClosed ?? 0;
        if (pathSecretInput) pathSecretInput.value = opt.pathSecret ?? 0;

        // Re-enforce group totals after restoring values
        enforceGroupTotals(pointGroupInputs);
        enforceGroupTotals(pathGroupInputs);

        // --- Restore toggle options (keys / patrols / traps) from this seed ---
        genOptions.useKeys    = !!opt.useKeys;
        genOptions.usePatrols = !!opt.usePatrols;
        genOptions.useTraps   = !!opt.useTraps;
        updateGenButtons();

        // Finally, draw using the restored options + seed
        redrawWith(opt, lastState.seed);

        const s = String(lastState.seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;
      } else {
        const options = getOptions();
        const seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
        redrawWith(options, seed);
        _lastDungeonState = { seed, options };

        const s = String(seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;
      }
    },
    close: () => {
      _builderAppId = null;
    }
  }, {
    width: 400
  });

  dlg.render(true);
}

// Hook: wired by buttonManager.js via Hooks.call("lookfarShowDungeonMapperDialog")
Hooks.on("lookfarShowDungeonMapperDialog", () => {
  openDungeonMapper().catch(err => {
    console.error("[Dungeon Mapper] failed to open:", err);
    ui.notifications?.error("Dungeon Mapper: failed to open (see console).");
  });
});
