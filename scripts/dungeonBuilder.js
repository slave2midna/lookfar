const CANVAS_WIDTH  = 360;
const CANVAS_HEIGHT = 360;

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

// ----- Core generator class -----
class DungeonBuilderGenerator {
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

    this.points = this._computePoints();

    this.startIndex = null;
    this.twoIndex = null;
    this.threeIndex = null;
    this.goalIndex = null;

    // Options
    this.useKeys = false;
    this.usePatrols = false;
    this.useTraps = false;
    this.useEgress = false;
    this.useStairs = false;

    // Key locations
    this.key1Index = null;
    this.key2Index = null;

    // Egress & stairs
    this.exitIndex = null;
    this.stairsIndex = null;

    // Seeded RNG
    this._initRNG(seed);
  }

  // ----- Seeded RNG (mulberry32) -----
  _initRNG(seed) {
    const baseSeed = (seed != null)
      ? seed >>> 0
      : (Date.now() ^ (Math.floor(Math.random() * 0xFFFFFFFF))) >>> 0;
    this.seed = baseSeed;
    this._rngState = baseSeed;
  }

  _rng() {
    // mulberry32
    let t = this._rngState += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
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

  // Precompute 7 point positions: 6 outer in a hex, 1 center
  _computePoints() {
    const cx = this.centerX;
    const cy = this.centerY;
    const radius = Math.min(this.width, this.height) * 0.36;

    const points = [];

    // 6 outer points (indices 0–5)
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + i * (Math.PI / 3); // start at top, go around
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push({ id: i + 1, x, y });
    }

    // center point (index 6, id 7)
    points.push({ id: 7, x: cx, y: cy });

    return points;
  }

  // Main entry point
  draw({
    useKeys = false,
    usePatrols = false,
    useTraps = false,
    useEgress = false,
    useStairs = false
  } = {}) {
    const ctx = this.ctx;

    // Reset transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, this.width, this.height);

    // Clear overlay icons
    if (this.iconLayer) {
      this.iconLayer.innerHTML = "";
    }

    this.useKeys = useKeys;
    this.usePatrols = usePatrols;
    this.useTraps = useTraps;
    this.useEgress = useEgress;
    this.useStairs = useStairs;

    this.key1Index = null;
    this.key2Index = null;
    this.exitIndex = null;
    this.stairsIndex = null;

    // Assign roles + labels
    const points = this._assignPointTypesAndLabels();

    // Keys
    if (this.useKeys) {
      this._assignKeys(points);
    }

    // Egress (entrance/exit arrows)
    if (this.useEgress) {
      this._assignEgress(points);
    }

    // Stairs
    if (this.useStairs) {
      this._assignStairs(points);
    }

    // Choose lines
    const lines = this._chooseRandomLines(points);

    // Draw lines on canvas
    this._drawLines(points, lines);

    // Draw node shapes + labels + stairs + egress
    this._drawPoints(points);
  }

  _assignPointTypesAndLabels() {
    const types = ["feature", "feature", "feature", "danger", "danger", "treasure", "blank"];
    const shuffledTypes = this._shuffle(types);

    const pointsWithTypes = this.points.map((p, idx) => {
      const type = shuffledTypes[idx];
      return { ...p, type, number: null };
    });

    let markedIndices = pointsWithTypes
      .map((p, idx) => (p.type === "blank" ? -1 : idx))
      .filter(idx => idx !== -1);

    const allLines = this._getAllPossibleLines();

    const neighborsOf = (idx) => {
      const result = [];
      for (const [a, b] of allLines) {
        if (a === idx) result.push(b);
        else if (b === idx) result.push(a);
      }
      return result;
    };

    // Choose Start index
    let sIdx = null;
    for (const cand of markedIndices) {
      const neigh = neighborsOf(cand).filter(n => markedIndices.includes(n));
      if (neigh.length > 0) {
        sIdx = cand;
        break;
      }
    }
    if (sIdx === null) sIdx = markedIndices[0];

    const sNeighbors = neighborsOf(sIdx).filter(n => markedIndices.includes(n) && n !== sIdx);

    // Pick 2
    let twoIdx = sNeighbors.length
      ? sNeighbors[Math.floor(this._rng() * sNeighbors.length)]
      : null;

    this.startIndex = sIdx;
    this.twoIndex = twoIdx;

    const remaining = markedIndices.filter(i => i !== sIdx && i !== twoIdx);

    // Pick 3 (adjacent to Start or 2 if possible)
    const twoNeighbors = (twoIdx !== null)
      ? neighborsOf(twoIdx).filter(n => markedIndices.includes(n) && n !== twoIdx)
      : [];

    const threeCandidates = remaining.filter(
      i => sNeighbors.includes(i) || twoNeighbors.includes(i)
    );

    let threeIdx = null;
    if (threeCandidates.length > 0) {
      threeIdx = threeCandidates[Math.floor(this._rng() * threeCandidates.length)];
    } else if (remaining.length > 0) {
      threeIdx = remaining[0];
    }

    this.threeIndex = threeIdx;

    const remainingAfter3 = remaining.filter(i => i !== threeIdx);

    // Goal
    let gIdx = null;
    if (remainingAfter3.length > 0) {
      gIdx = remainingAfter3[remainingAfter3.length - 1];
    }
    this.goalIndex = gIdx;

    // 4 & 5
    const middleNumbers = this._shuffle([4, 5]);

    // S / G instead of Start / Goal
    pointsWithTypes[sIdx].number = "S";
    if (twoIdx !== null) pointsWithTypes[twoIdx].number = 2;
    if (threeIdx !== null) pointsWithTypes[threeIdx].number = 3;
    if (gIdx !== null) pointsWithTypes[gIdx].number = "G";

    for (const idx of remainingAfter3) {
      if (idx === gIdx) continue;
      const n = middleNumbers.shift();
      if (n !== undefined) pointsWithTypes[idx].number = n;
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

  _getAllPossibleLines() {
    const lines = [];

    // Ring edges
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      lines.push([i, j]);
    }

    // Radial edges
    for (let i = 0; i < 6; i++) {
      lines.push([i, 6]);
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

  _chooseRandomLines(points) {
    const allLines = this._getAllPossibleLines();

    const candidateAll = allLines
      .filter(([i, j]) => points[i].type !== "blank" && points[j].type !== "blank");

    if (candidateAll.length === 0) return [];

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

    const maxLines = Math.min(6, candidateAll.length);

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

    for (let k = maxLines; k >= 1; k--) {
      const result = tryWithK(k);
      if (result) return result;
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
    sizePx = 14,
    color = "black",
    extraClass = "",
    offsetX = 0,
    offsetY = 0
  ) {
    if (!this.iconLayer) return;

    const { oxPercent, oyPercent } = this._toOverlayCoords(x, y);

    const icon = document.createElement("i");
    icon.className = `${className} ${extraClass}`.trim();
    icon.style.position = "absolute";

    icon.style.left = `${oxPercent}%`;
    icon.style.top  = `${oyPercent}%`;

    icon.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;

    icon.style.fontSize = `${sizePx}px`;
    icon.style.lineHeight = "1";
    icon.style.pointerEvents = "none";
    icon.style.color = color;

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
  _drawLines(points, lines) {
    const ctx = this.ctx;
    const count = lines.length;
    if (!count) return;

    const indices = Array.from({ length: count }, (_, i) => i);
    const shuffledIndices = this._shuffle(indices.slice());

    const secretIndex = shuffledIndices.shift();
    const maxDoorLines = Math.min(2, count - 1);
    const doorIndices = new Set(shuffledIndices.slice(0, maxDoorLines));

    let patrolIndices = new Set();
    if (this.usePatrols && count > 0) {
      const openIndices = indices.filter(
        i => i !== secretIndex && !doorIndices.has(i)
      );
      if (openIndices.length > 0) {
        const patrolCount = Math.min(
          1 + Math.floor(this._rng() * 2),
          openIndices.length
        );
        const patrolOrder = this._shuffle(openIndices.slice());
        patrolIndices = new Set(patrolOrder.slice(0, patrolCount));
      }
    }

    let trapIndices = new Set();
    if (this.useTraps && doorIndices.size > 0) {
      const obstructedIndices = Array.from(doorIndices);
      const trapCount = Math.min(
        1 + Math.floor(this._rng() * 2),
        obstructedIndices.length
      );
      const trapOrder = this._shuffle(obstructedIndices.slice());
      trapIndices = new Set(trapOrder.slice(0, trapCount));
    }

    for (let li = 0; li < count; li++) {
      const [i, j] = lines[li];
      const a = points[i];
      const b = points[j];

      const isSecret = li === secretIndex;
      const isDoor = doorIndices.has(li);
      const isPatrol = this.usePatrols && patrolIndices.has(li);
      const isTrap = this.useTraps && trapIndices.has(li);

      ctx.beginPath();
      ctx.setLineDash(isSecret ? [8, 6] : []);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      if (isDoor) {
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
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "black";

      if (number === "S" || number === "G") {
        ctx.font = "bold 16px sans-serif";
      }

      ctx.fillText(String(number), x, y + yOffset);
      ctx.restore();
    });

    if (this.useStairs) {
      this._drawStairs(points);
    }
    if (this.useEgress) {
      this._drawEgress(points);
    }
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
    const r = this.nodeRadius;
    const cx = this.centerX;
    const cy = this.centerY;

    if (this.startIndex != null) {
      const s = points[this.startIndex];
      const vx = s.x - cx;
      const vy = s.y - cy;
      const len = Math.hypot(vx, vy) || 1;
      const ux = vx / len;
      const uy = vy / len;

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
      const ux = vx / len;
      const uy = vy / len;

      const tailX = p.x + ux * (r + 2);
      const tailY = p.y + uy * (r + 2);
      const tipX  = p.x + ux * (r + 10);
      const tipY  = p.y + uy * (r + 10);

      this._drawArrow(tailX, tailY, tipX, tipY);
    }
  }
}

// ----- Build dialog contents -----

const dialogContent = `
<div style="text-align:center;">

  <div id="dungeon-builder-wrapper"
       style="position:relative; display:block; width:100%; margin:0 auto;">
    <canvas id="dungeon-builder-canvas"
            width="${CANVAS_WIDTH}"
            height="${CANVAS_HEIGHT}"
            style="border:1px solid #666; display:block; margin:0 auto; width:100%; height:auto;">
    </canvas>
    <div id="dungeon-builder-icons"
         style="position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none;"></div>
  </div>

  <div style="margin-top:8px; font-size:12px; width:100%; margin-left:auto; margin-right:auto; text-align:left;">

    <div style="display:flex; gap:8px; margin-bottom:6px; width:100%;">
      <!-- Paths -->
      <fieldset style="flex:1; padding:6px 8px; border:1px solid #aaa; margin:0; width:100%;">
        <legend style="font-weight:bold; padding:0 4px;">Paths</legend>
        <div style="line-height:1.4;">
          <div>
            <span style="display:inline-block; width:28px; border-top:1px solid #000; margin-right:4px; vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Open</span>
          </div>
          <div style="margin-top:2px;">
            <span style="position:relative; display:inline-block; vertical-align:middle;">
              <span style="display:inline-block; width:28px; border-top:1px solid #000; margin-right:4px; position:relative; vertical-align:middle;">
                <span style="position:absolute; left:50%; top:-5px; height:10px; border-left:1px solid #000; transform:translateX(-50%);"></span>
              </span>
              <span style="vertical-align:middle;">Closed</span>
            </span>
          </div>
          <div style="margin-top:2px;">
            <span style="display:inline-block; width:28px; border-top:1px dashed #000; margin-right:4px; vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Secret</span>
          </div>
        </div>
      </fieldset>

      <!-- Points -->
      <fieldset style="flex:1; padding:6px 8px; border:1px solid #aaa; margin:0; width:100%;">
        <legend style="font-weight:bold; padding:0 4px;">Points</legend>
        <div style="line-height:1.4;">
          <div>
            <i class="fa-sharp fa-solid fa-circle" style="font-size:12px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Feature</span>
          </div>
          <div style="margin-top:2px;">
            <i class="fa-sharp fa-solid fa-triangle" style="font-size:12px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Danger</span>
          </div>
          <div style="margin-top:2px;">
            <i class="fa-sharp fa-solid fa-diamond" style="font-size:12px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Treasure</span>
          </div>
        </div>
      </fieldset>

      <!-- Seed -->
      <fieldset style="flex:1; padding:6px 8px; border:1px solid #aaa; margin:0; width:100%;">
        <legend style="font-weight:bold; padding:0 4px;">Seed</legend>
        <div style="line-height:1.4;">
          <div>
            <span style="font-weight:bold;">Current:</span>
            <span id="dungeon-builder-seed-current">—</span>
          </div>
          <div style="margin-top:2px;">
            <label style="display:block;">
              <span style="font-weight:bold;">Input:</span>
              <input type="text"
                     id="dungeon-builder-seed-input"
                     style="width:100%; box-sizing:border-box; margin-top:2px; font-size:11px;">
            </label>
          </div>
        </div>
      </fieldset>
    </div>

    <fieldset style="margin:4px 0 0 0; padding:6px 8px; border:1px solid #aaa; width:100%;">
      <legend style="font-weight:bold; padding:0 4px;">Generate</legend>
      <div style="margin-top:2px; line-height:1.4; display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px;">
        <label><input type="checkbox" id="dungeon-builder-opt-keys"> Keys</label>
        <label><input type="checkbox" id="dungeon-builder-opt-patrols"> Patrols</label>
        <label><input type="checkbox" id="dungeon-builder-opt-traps"> Traps</label>
        <label><input type="checkbox" id="dungeon-builder-opt-egress"> Egress</label>
        <label><input type="checkbox" id="dungeon-builder-opt-stairs"> Stairs</label>
      </div>
    </fieldset>
  </div>

  <div style="margin-top:8px; width:100%; display:flex; gap:4px;">
    <button type="button"
            id="dungeon-builder-pin-btn"
            style="flex:1; box-sizing:border-box;">
      Pin
    </button>
    <button type="button"
            id="dungeon-builder-generate-btn"
            style="flex:1; box-sizing:border-box;">
      Generate
    </button>
    <button type="button"
            id="dungeon-builder-save-btn"
            style="flex:1; box-sizing:border-box;">
      Save
    </button>
  </div>
</div>
`;

const pinnedDialogContent = `
<div style="text-align:center;">
  <div id="dungeon-builder-pinned-wrapper"
       style="position:relative; display:block; width:100%; margin:0 auto;">
    <canvas id="dungeon-builder-pinned-canvas"
            width="${CANVAS_WIDTH}"
            height="${CANVAS_HEIGHT}"
            style="border:1px solid #666; display:block; margin:0 auto; width:100%; height:auto;">
    </canvas>
    <div id="dungeon-builder-pinned-icons"
         style="position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:auto;"></div>
  </div>

  <div style="margin-top:8px; font-size:12px; width:100%; margin-left:auto; margin-right:auto; text-align:left;">
    <div style="display:flex; gap:8px; margin-bottom:0; width:100%;">
      <fieldset style="flex:1; padding:4px 6px; border:1px solid #aaa; margin:0; width:100%;">
        <legend style="font-weight:bold; padding:0 4px;">Paths</legend>
        <div style="line-height:1.3;">
          <div>
            <span style="display:inline-block; width:24px; border-top:1px solid #000; margin-right:4px; vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Cleared</span>
            &nbsp;&nbsp;
            <span style="position:relative; display:inline-block; margin-left:6px; vertical-align:middle;">
              <span style="display:inline-block; width:24px; border-top:1px solid #000; margin-right:4px; position:relative; vertical-align:middle;">
                <span style="position:absolute; left:50%; top:-5px; height:10px; border-left:1px solid #000; transform:translateX(-50%);"></span>
              </span>
              <span style="vertical-align:middle;">Blocked</span>
            </span>
          </div>
          <div style="margin-top:2px;">
            <span style="display:inline-block; width:24px; border-top:1px dashed #000; margin-right:4px; vertical-align:middle;"></span>
            <span style="vertical-align:middle;">Secret</span>
          </div>
        </div>
      </fieldset>

      <fieldset style="flex:1; padding:4px 6px; border:1px solid #aaa; margin:0; width:100%;">
        <legend style="font-weight:bold; padding:0 4px;">Points</legend>
        <div style="line-height:1.3;">
          <div>
            <i class="fa-sharp fa-solid fa-circle" style="font-size:11px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Feature</span>
            &nbsp;&nbsp;
            <i class="fa-sharp fa-solid fa-triangle" style="font-size:11px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Danger</span>
          </div>
          <div style="margin-top:2px;">
            <i class="fa-sharp fa-solid fa-diamond" style="font-size:11px; vertical-align:middle;"></i>
            <span style="vertical-align:middle;">&nbsp;Treasure</span>
          </div>
        </div>
      </fieldset>
    </div>
  </div>
</div>
`;

// ----- Main dialog function (module-style, not macro) -----

export function openDungeonBuilderDialog() {
  if (!game.user.isGM) {
    ui.notifications?.warn?.("Dungeon Builder is GM-only.");
    return;
  }

  // Ensure singleton on this client
  if (_builderAppId && ui.windows[_builderAppId]) {
    ui.windows[_builderAppId]?.bringToTop?.();
    return;
  }

  const dlg = new Dialog({
    title: "Dungeon Builder",
    content: dialogContent,
    buttons: {},
    render: function(html) {
      const app = this;
      const generatorAppId = app.appId;
      _builderAppId = generatorAppId;

      const $html = html;
      const canvas = $html.find("#dungeon-builder-canvas")[0];
      const ctx = canvas.getContext("2d");
      const iconLayer = $html.find("#dungeon-builder-icons")[0];

      const lastState = _lastDungeonState || null;

      const generator = new DungeonBuilderGenerator(
        ctx,
        canvas.width,
        canvas.height,
        iconLayer,
        lastState && typeof lastState.seed === "number" ? lastState.seed : null
      );

      const keysCheckbox    = $html.find("#dungeon-builder-opt-keys")[0];
      const patrolsCheckbox = $html.find("#dungeon-builder-opt-patrols")[0];
      const trapsCheckbox   = $html.find("#dungeon-builder-opt-traps")[0];
      const egressCheckbox  = $html.find("#dungeon-builder-opt-egress")[0];
      const stairsCheckbox  = $html.find("#dungeon-builder-opt-stairs")[0];

      const seedCurrentSpan = $html.find("#dungeon-builder-seed-current")[0];
      const seedInputField  = $html.find("#dungeon-builder-seed-input")[0];

      if (lastState && lastState.options) {
        const opt = lastState.options;
        if (keysCheckbox)    keysCheckbox.checked    = !!opt.useKeys;
        if (patrolsCheckbox) patrolsCheckbox.checked = !!opt.usePatrols;
        if (trapsCheckbox)   trapsCheckbox.checked   = !!opt.useTraps;
        if (egressCheckbox)  egressCheckbox.checked  = !!opt.useEgress;
        if (stairsCheckbox)  stairsCheckbox.checked  = !!opt.useStairs;
      }

      const getOptions = () => ({
        useKeys:   !!keysCheckbox?.checked,
        usePatrols:!!patrolsCheckbox?.checked,
        useTraps:  !!trapsCheckbox?.checked,
        useEgress: !!egressCheckbox?.checked,
        useStairs: !!stairsCheckbox?.checked
      });

      const $pinBtn      = $html.find("#dungeon-builder-pin-btn");
      const $generateBtn = $html.find("#dungeon-builder-generate-btn");
      const $saveBtn     = $html.find("#dungeon-builder-save-btn");

      const redrawWith = (options, seed) => {
        if (typeof seed === "number") {
          generator.setSeed(seed);
        }
        generator.draw(options);
      };

      $generateBtn.on("click", () => {
        const options = getOptions();

        let seed;
        const raw = seedInputField?.value?.trim();
        if (raw) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= 0) {
            seed = parsed >>> 0;
          } else {
            ui.notifications?.warn?.("Invalid seed; using random instead.");
            seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
          }
        } else {
          seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
        }

        redrawWith(options, seed);
        _lastDungeonState = { seed, options };

        const s = String(seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;
        if (seedInputField && !raw) seedInputField.value = s;
      });

      $pinBtn.on("click", () => {
        const last = _lastDungeonState;
        if (!last || typeof last.seed !== "number" || !last.options) {
          ui?.notifications?.warn?.("No dungeon to pin yet. Generate one first.");
          return;
        }

        const pinnedDialog = new Dialog({
          title: "Pinned Dungeon",
          content: pinnedDialogContent,
          buttons: {},
          render: function(pinnedHtml) {
            const pinnedApp = this;
            const $p = pinnedHtml;
            const pinnedCanvas  = $p.find("#dungeon-builder-pinned-canvas")[0];
            const pinnedCtx     = pinnedCanvas.getContext("2d");
            const pinnedIcons   = $p.find("#dungeon-builder-pinned-icons")[0];

            const pinnedGen = new DungeonBuilderGenerator(
              pinnedCtx,
              pinnedCanvas.width,
              pinnedCanvas.height,
              pinnedIcons,
              last.seed
            );
            pinnedGen.draw(last.options);

                        // --- Draggable party trackers on pinned map ---
            try {
              const trackerLayer = pinnedIcons;
              if (trackerLayer) {
                // Defer until after layout so clientWidth/clientHeight are correct
                requestAnimationFrame(() => {
                  const trackerDefs = [
                    { id: "db-tracker-red",    color: "red" },
                    { id: "db-tracker-blue",   color: "blue" },
                    { id: "db-tracker-green",  color: "green" },
                    { id: "db-tracker-purple", color: "purple" }
                  ];

                  const iconSize = 18;
                  const margin = 6;
                  let currentTop = margin;

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

                  // Place them along the top-right edge, but fully inside the overlay
                  let baseLeft = trackerLayer.clientWidth - iconSize - margin;
                  if (!Number.isFinite(baseLeft) || baseLeft < margin) {
                    baseLeft = trackerLayer.clientWidth > 0
                      ? trackerLayer.clientWidth - iconSize - margin
                      : margin;
                  }

                  trackerDefs.forEach((def) => {
                    const icon = document.createElement("i");
                    // Use the requested icon for party markers
                    icon.className = "fa-solid fa-person-dress-simple";
                    icon.dataset.trackerId = def.id;

                    icon.style.position = "absolute";
                    icon.style.left     = `${baseLeft}px`;
                    icon.style.top      = `${currentTop}px`;
                    icon.style.fontSize = `${iconSize}px`;
                    icon.style.lineHeight = "1";
                    icon.style.color    = def.color;
                    icon.style.cursor   = "grab";
                    icon.style.pointerEvents = "auto";
                    icon.style.zIndex   = "10";

                    trackerLayer.appendChild(icon);
                    console.log("[Dungeon Builder] created tracker", def.id);

                    currentTop += iconSize + 4;

                    icon.addEventListener("mousedown", (ev) => {
                      ev.preventDefault();
                      const rect = trackerLayer.getBoundingClientRect();
                      dragState.icon = icon;
                      dragState.offsetX = ev.clientX - (rect.left + icon.offsetLeft);
                      dragState.offsetY = ev.clientY - (rect.top  + icon.offsetTop);
                      icon.style.cursor = "grabbing";

                      document.addEventListener("mousemove", onMouseMove);
                      document.addEventListener("mouseup", endDrag);
                    });
                  });
                });
              }
            } catch (e) {
              console.warn("[Dungeon Builder] could not create trackers", e);
            }
            // --- end draggable party trackers ---

            // Attempt to position pinned dialog near the Players list sidebar
            const players = document.getElementById("players");
            if (players && pinnedApp.element?.length) {
              const rect = players.getBoundingClientRect();
              const el   = pinnedApp.element[0];

              el.style.position = "fixed";
              el.style.left = `${rect.right + 10}px`;
              el.style.top  = `${rect.top}px`;
            }
          }
        }, {
          width: 320,
          resizable: false,
          minimizable: false
        });

        pinnedDialog.render(true);

        // Close the main Dungeon Builder dialog when pinning
        const win = ui?.windows?.[generatorAppId];
        if (win && typeof win.close === "function") {
          try {
            win.close();
          } catch (e) {
            console.warn("[Dungeon Builder] ui.windows[appId].close() failed", e);
          }
        } else if (typeof app.close === "function") {
          try {
            app.close();
          } catch (e) {
            console.warn("[Dungeon Builder] app.close() failed", e);
          }
        }

        try {
          const $window = $html.closest(".app.window-app.dialog");
          if ($window && $window.length) {
            $window.remove();
          }
        } catch (e) {
          console.warn("[Dungeon Builder] hard DOM removal failed", e);
        }
      });

      $saveBtn.on("click", () => {
        // Placeholder for future integration (journal entry, note, etc.)
        console.log("[Dungeon Builder] Save clicked (not yet implemented).");
      });

      // Initial draw: restore last state if present, otherwise roll fresh
      if (lastState && lastState.options && typeof lastState.seed === "number") {
        redrawWith(lastState.options, lastState.seed);

        const s = String(lastState.seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;
        if (seedInputField && !seedInputField.value) seedInputField.value = s;
      } else {
        const options = getOptions();
        const seed = (Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
        redrawWith(options, seed);
        _lastDungeonState = { seed, options };

        const s = String(seed >>> 0);
        if (seedCurrentSpan) seedCurrentSpan.textContent = s;
        if (seedInputField && !seedInputField.value) seedInputField.value = s;
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

// Hook: wired by buttonManager.js via Hooks.call("lookfarShowDungeonBuilderDialog")
Hooks.on("lookfarShowDungeonBuilderDialog", () => {
  try {
    openDungeonBuilderDialog();
  } catch (err) {
    console.error("[Dungeon Builder] failed to open:", err);
    ui.notifications?.error("Dungeon Builder: failed to open (see console).");
  }
});
