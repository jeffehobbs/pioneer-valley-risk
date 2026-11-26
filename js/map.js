/* Pioneer Valley Risk — map geometry.
 *
 * Builds the cell grid from RV.MAP_ROWS (map-data.js) and computes:
 *  - RV.grid[y][x]        -> territory index or -1
 *  - RV.riverSet          -> "x,y" lookup for water cells (river + lake)
 *  - RV.lakeSet           -> "x,y" lookup for reservoir cells only
 *  - RV.adj[i]            -> arrays of neighboring territory indices
 *    (neighbors may touch directly OR across a single river cell)
 *  - RV.centroid[i]       -> [cx, cy] label anchor in cell units
 *  - RV.regionOf[i]       -> region index for territory i
 *  - RV.regionTowns[r]    -> territory indices in region r
 */
(function () {
  'use strict';

  var W = RV.MAP_W, H = RV.MAP_H;
  var n = RV.TERRITORIES.length;
  var i, j, x, y;

  var keyIndex = {};
  RV.TERRITORIES.forEach(function (t, idx) {
    if (keyIndex[t.id] != null) console.warn('map: duplicate key ' + t.id);
    keyIndex[t.id] = idx;
    t.cells = 0;
  });

  // --- build grid -----------------------------------------------------------
  var grid = [];
  var riverSet = {}, lakeSet = {};
  for (y = 0; y < H; y++) {
    var row = RV.MAP_ROWS[y];
    if (row.length !== W) console.warn('map: row ' + y + ' has width ' + row.length);
    var out = new Array(W).fill(-1);
    for (x = 0; x < W; x++) {
      var ch = row.charAt(x);
      if (ch === '~' || ch === '=') {
        riverSet[x + ',' + y] = true;
        if (ch === '=') lakeSet[x + ',' + y] = true;
      } else if (ch !== '.' && ch !== '') {
        var idx = keyIndex[ch];
        if (idx == null) { console.warn('map: unknown key ' + ch); continue; }
        out[x] = idx;
        RV.TERRITORIES[idx].cells++;
      }
    }
    grid.push(out);
  }

  // --- adjacency ------------------------------------------------------------
  // Direct contact (incl. diagonal), plus contact across one river cell.
  var adj = [], direct = [], bridgeCells = {};
  for (i = 0; i < n; i++) { adj.push({}); direct.push({}); }

  function link(a, b) {
    if (a !== b) { adj[a][b] = true; adj[b][a] = true; }
  }
  function linkDirect(a, b) {
    if (a !== b) { direct[a][b] = true; direct[b][a] = true; }
  }

  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      var t = grid[y][x];
      if (t < 0) continue;
      for (j = 0; j < 4; j++) {
        var nx = x + DIRS[j][0], ny = y + DIRS[j][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var other = grid[ny][nx];
        var diagonal = DIRS[j][0] !== 0 && DIRS[j][1] !== 0;
        if (other >= 0) {
          // a corner touch where the river bends between them isn't a border
          if (diagonal && riverSet[nx + ',' + y] && riverSet[x + ',' + ny]) continue;
          link(t, other);
          linkDirect(t, other);
        } else if (!diagonal && riverSet[nx + ',' + ny] && !lakeSet[nx + ',' + ny]) {
          // bridge straight across one river cell
          var ax = x + DIRS[j][0] * 2, ay = y + DIRS[j][1] * 2;
          if (ax >= 0 && ay >= 0 && ax < W && ay < H && grid[ay][ax] >= 0 && grid[ay][ax] !== t) {
            var o2 = grid[ay][ax];
            link(t, o2);
            var bk = Math.min(t, o2) + ',' + Math.max(t, o2);
            (bridgeCells[bk] = bridgeCells[bk] || []).push([nx, ny, DIRS[j][0] !== 0 ? 'h' : 'v']);
          }
        }
      }
    }
  }

  var adjList = [];
  for (i = 0; i < n; i++) {
    var arr = [];
    for (j = 0; j < n; j++) if (i !== j && adj[i][j]) arr.push(j);
    adjList.push(arr);
  }

  // --- river crossings ----------------------------------------------------------
  // A pair that only meets across a river: attacking over it costs a die.
  // One bridge is drawn per crossing, on the middle river cell between them.
  var crossing = {}, bridges = [];
  Object.keys(bridgeCells).forEach(function (bk) {
    var ab = bk.split(',').map(Number);
    if (direct[ab[0]][ab[1]]) return;
    crossing[bk] = true;
    var cells = bridgeCells[bk];
    var mid = cells[Math.floor(cells.length / 2)];
    bridges.push({ a: ab[0], b: ab[1], x: mid[0], y: mid[1], dir: mid[2] });
  });
  function isCrossing(a, b) {
    return !!crossing[Math.min(a, b) + ',' + Math.max(a, b)];
  }

  // --- centroids (snapped to a cell the town actually owns) ------------------
  var centroid = [];
  for (i = 0; i < n; i++) {
    var sx = 0, sy = 0, cnt = 0;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        if (grid[y][x] === i) { sx += x + 0.5; sy += y + 0.5; cnt++; }
      }
    }
    var c = cnt ? [sx / cnt, sy / cnt] : [0, 0];
    var gx = Math.floor(c[0]), gy = Math.floor(c[1]);
    if (!grid[gy] || grid[gy][gx] !== i) {
      // L-shaped town: use the owned cell closest to the mean
      var best = null, bd = 1e9;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (grid[y][x] !== i) continue;
        var d = (x + 0.5 - c[0]) * (x + 0.5 - c[0]) + (y + 0.5 - c[1]) * (y + 0.5 - c[1]);
        if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
      }
      c = best || c;
    }
    centroid.push(c);
  }

  // --- regions ----------------------------------------------------------------
  var regionIndex = {};
  RV.REGIONS.forEach(function (r, ri) { regionIndex[r.id] = ri; });
  var regionOf = [], regionTowns = RV.REGIONS.map(function () { return []; });
  for (i = 0; i < n; i++) {
    var ri = regionIndex[RV.TERRITORIES[i].region];
    regionOf.push(ri);
    regionTowns[ri].push(i);
  }

  // --- expose ---------------------------------------------------------------
  RV.grid = grid;
  RV.riverSet = riverSet;
  RV.lakeSet = lakeSet;
  RV.adj = adjList;
  RV.isCrossing = isCrossing;
  RV.bridges = bridges;
  RV.centroid = centroid;
  RV.regionOf = regionOf;
  RV.regionTowns = regionTowns;

  // --- dev self-check (returns a report) -------------------------------------
  RV.checkMap = function () {
    var lines = [];
    var seen = {}, stack = [0], count = 0;
    while (stack.length) {
      var v = stack.pop();
      if (seen[v]) continue;
      seen[v] = true; count++;
      adjList[v].forEach(function (w) { if (!seen[w]) stack.push(w); });
    }
    lines.push('territories: ' + n + ', connected component: ' + count + '/' + n);
    for (var i = 0; i < n; i++) {
      var t = RV.TERRITORIES[i];
      lines.push(
        t.id + ' ' + t.name + ' [' + t.terrain + ', ' + t.region + '] cells=' + t.cells +
        ' adj(' + adjList[i].length + '): ' +
        adjList[i].map(function (a) { return RV.TERRITORIES[a].name; }).join(', ')
      );
    }
    return { text: lines.join('\n'), connected: count === n };
  };
})();
