if (typeof cytoscape === "undefined") {
  throw new Error("Cytoscape failed to load");
}

if (typeof cytoscapeDagre !== "undefined") {
  cytoscape.use(cytoscapeDagre);
}
/* ─── 1. GED parser ─────────────────────────────────────────────────────── */
function parseGED(text) {
  const individuals = {},
    families = {};
  let curId = null,
    curType = null,
    curSub = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sp1 = line.indexOf(" ");
    if (sp1 < 0) continue;
    const level = parseInt(line.slice(0, sp1), 10);
    const rest = line.slice(sp1 + 1).trim();
    const sp2 = rest.indexOf(" ");
    const tag = sp2 < 0 ? rest : rest.slice(0, sp2);
    const val = sp2 < 0 ? "" : rest.slice(sp2 + 1).trim();

    if (level === 0) {
      curSub = null;
      if (val === "INDI") {
        curId = tag;
        curType = "INDI";
        individuals[curId] = {
          id: curId,
          name: "",
          sex: "",
          birth: "",
          birthPlace: "",
          death: "",
          famc: [],
          fams: [],
        };
      } else if (val === "FAM") {
        curId = tag;
        curType = "FAM";
        families[curId] = {
          id: curId,
          husb: null,
          wife: null,
          children: [],
          marr: "",
        };
      } else {
        curId = null;
        curType = null;
      }
      continue;
    }

    if (!curId) continue;

    if (curType === "INDI") {
      const r = individuals[curId];
      if (level === 1) {
        curSub = tag;
        if (tag === "NAME")
          r.name = val.replace(/\//g, "").replace(/\s+/g, " ").trim();
        else if (tag === "SEX") r.sex = val;
        else if (tag === "FAMC") r.famc.push(val);
        else if (tag === "FAMS") r.fams.push(val);
      } else if (level === 2) {
        if (tag === "DATE") {
          const yr = val.match(/\d{4}/)?.[0] || "";
          if (curSub === "BIRT") r.birth = yr;
          if (curSub === "DEAT") r.death = yr;
        } else if (tag === "CITY" || (tag === "ADDR" && !r.birthPlace)) {
          if (curSub === "BIRT") r.birthPlace = val;
        }
      }
    } else if (curType === "FAM") {
      const r = families[curId];
      if (level === 1) {
        curSub = tag;
        if (tag === "HUSB") r.husb = val;
        else if (tag === "WIFE") r.wife = val;
        else if (tag === "CHIL") r.children.push(val);
      } else if (level === 2 && tag === "DATE" && curSub === "MARR") {
        r.marr = val;
      }
    }
  }
  return { individuals, families };
}

/* ─── 2. Assign family branches (surname heuristic) ─────────────────────── */
const BRANCHES = [
  "Гаврюшенко",
  "Кривошеин",
  "Лалаян",
  "Иванчиков",
  "Кимлык",
  "Семащук",
  "Макаренко",
  "Шелег",
  "Шестаков",
];

function getBranch(nameStr) {
  for (const b of BRANCHES) {
    if (nameStr.includes(b)) return b;
  }
  return "Другие";
}

/* ─── 3. Build cytoscape elements ──────────────────────────────────────── */
function stripAt(id) {
  return id ? id.replace(/@/g, "") : "";
}

function buildElements(data) {
  const els = [];
  const { individuals, families } = data;

  /* person nodes */
  for (const [id, p] of Object.entries(individuals)) {
    const nid = stripAt(id);
    const name = p.name || "?";
    const branch = getBranch(name);
    // Label: name on line 1, years on line 2 (if known)
    const yr = p.birth
      ? p.death
        ? `${p.birth} – ${p.death}`
        : `р. ${p.birth}`
      : p.death
        ? `† ${p.death}`
        : "";
    const label = yr ? `${name}\n${yr}` : name;

    els.push({
      group: "nodes",
      data: {
        id: nid,
        label,
        name,
        birth: p.birth,
        death: p.death,
        birthPlace: p.birthPlace,
        sex: p.sex,
        branch,
        type: "person",
        famc: p.famc.map(stripAt),
        fams: p.fams.map(stripAt),
      },
    });
  }

  /* family (union) nodes + edges */
  for (const [id, f] of Object.entries(families)) {
    const fid = stripAt(id) + "_F";
    const marrYr = f.marr.match(/\d{4}/)?.[0] || "";

    els.push({
      group: "nodes",
      data: { id: fid, type: "family", marr: marrYr },
    });

    if (f.husb) {
      els.push({
        group: "edges",
        data: {
          id: `${fid}_h`,
          source: stripAt(f.husb),
          target: fid,
          type: "spouse",
        },
      });
    }
    if (f.wife) {
      els.push({
        group: "edges",
        data: {
          id: `${fid}_w`,
          source: stripAt(f.wife),
          target: fid,
          type: "spouse",
        },
      });
    }
    for (const child of f.children) {
      els.push({
        group: "edges",
        data: {
          id: `${fid}_c_${stripAt(child)}`,
          source: fid,
          target: stripAt(child),
          type: "child",
        },
      });
    }
  }

  return els;
}

/* ─── 4. Cytoscape styles ───────────────────────────────────────────────── */
const NODE_W = 168,
  NODE_H = 52;

const CY_STYLE = [
  // Male
  {
    selector: 'node[type="person"][sex="M"]',
    style: {
      shape: "roundrectangle",
      width: NODE_W,
      height: NODE_H,
      "background-color": "#d6e8f7",
      "border-color": "#6b9ec4",
      "border-width": 1.5,
      label: "data(label)",
      "text-wrap": "wrap",
      "text-valign": "center",
      "text-halign": "center",
      "font-family": "Georgia, serif",
      "font-size": "10.5px",
      color: "#152535",
      padding: "6px",
    },
  },
  // Female
  {
    selector: 'node[type="person"][sex="F"]',
    style: {
      shape: "roundrectangle",
      width: NODE_W,
      height: NODE_H,
      "background-color": "#fde0ec",
      "border-color": "#c4789a",
      "border-width": 1.5,
      label: "data(label)",
      "text-wrap": "wrap",
      "text-valign": "center",
      "text-halign": "center",
      "font-family": "Georgia, serif",
      "font-size": "10.5px",
      color: "#2a1020",
      padding: "6px",
    },
  },
  // Unknown sex
  {
    selector: 'node[type="person"]:not([sex="M"]):not([sex="F"])',
    style: {
      shape: "roundrectangle",
      width: NODE_W,
      height: NODE_H,
      "background-color": "#f5ede3",
      "border-color": "#c9b8a8",
      "border-width": 1.5,
      label: "data(label)",
      "text-wrap": "wrap",
      "text-valign": "center",
      "text-halign": "center",
      "font-family": "Georgia, serif",
      "font-size": "10.5px",
      color: "#2d241f",
      padding: "6px",
    },
  },
  // Family node (small diamond)
  {
    selector: 'node[type="family"]',
    style: {
      shape: "diamond",
      width: 13,
      height: 13,
      "background-color": "#8b5e3c",
      "border-width": 0,
      label: "",
    },
  },
  // Spouse edges
  {
    selector: 'edge[type="spouse"]',
    style: {
      width: 2,
      "line-color": "#8b5e3c",
      "target-arrow-shape": "none",
      "curve-style": "bezier",
      "line-style": "solid",
    },
  },
  // Child edges (with arrow)
  {
    selector: 'edge[type="child"]',
    style: {
      width: 1.5,
      "line-color": "#9c856e",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#9c856e",
      "curve-style": "bezier",
      "arrow-scale": 0.75,
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
    },
  },
  // Highlighted person
  {
    selector: 'node[type="person"].hl',
    style: {
      "border-width": 3,
      "border-color": "#8b5e3c",
      "background-color": "#f0d8c0",
      "z-index": 20,
    },
  },
  // Highlighted family node
  {
    selector: 'node[type="family"].hl',
    style: {
      width: 18,
      height: 18,
      "background-color": "#5c3a1e",
      "z-index": 20,
    },
  },
  // Highlighted edges
  {
    selector: "edge.hl",
    style: {
      width: 3,
      "line-color": "#8b5e3c",
      "target-arrow-color": "#8b5e3c",
      "z-index": 20,
    },
  },
  // Faded
  { selector: ".faded", style: { opacity: 0.12 } },
];

/* ─── 5. Main init ──────────────────────────────────────────────────────── */
fetch("gavrushenko-family-tree.ged")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  })
  .then((text) => {
    const data = parseGED(text);
    const elements = buildElements(data);

    const cy = cytoscape({
      container: document.getElementById("cy"),
      elements,
      style: CY_STYLE,
      layout: {
        name: "dagre",
        rankDir: "TB", // top → bottom generations
        nodeSep: 20, // horizontal gap between nodes in same rank
        rankSep: 55, // vertical gap between ranks
        edgeSep: 8,
        ranker: "network-simplex",
        animate: false,
      },
      minZoom: 0.05,
      maxZoom: 3,
    });

    document.getElementById("loading").style.display = "none";

    /* ── Zoom / fit controls ── */
    const midPt = () => ({ x: cy.width() / 2, y: cy.height() / 2 });
    document.getElementById("btn-fit").onclick = () => cy.fit(undefined, 30);
    document.getElementById("btn-zin").onclick = () =>
      cy.zoom({ level: cy.zoom() * 1.35, renderedPosition: midPt() });
    document.getElementById("btn-zout").onclick = () =>
      cy.zoom({ level: cy.zoom() / 1.35, renderedPosition: midPt() });

    /* ── Search ── */
    const searchEl = document.getElementById("tree-search");
    searchEl.addEventListener("input", () => {
      const q = searchEl.value.trim().toLowerCase();
      cy.elements().removeClass("faded hl");
      if (!q) return;
      const hits = cy
        .nodes('[type="person"]')
        .filter((n) => n.data("name").toLowerCase().includes(q));
      if (!hits.length) return;
      cy.elements().addClass("faded");
      hits.removeClass("faded").addClass("hl");
      // also un-fade their connected family nodes and edges
      hits.connectedEdges().removeClass("faded").addClass("hl");
      hits.connectedEdges().connectedNodes().removeClass("faded");
      cy.animate({ fit: { eles: hits, padding: 80 }, duration: 400 });
    });

    /* ── Branch filter ── */
    document.getElementById("branch-filters").addEventListener("click", (e) => {
      const btn = e.target.closest(".tbtn[data-branch]");
      if (!btn) return;
      document
        .querySelectorAll("#branch-filters .tbtn")
        .forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      searchEl.value = "";

      const branch = btn.dataset.branch;
      cy.elements().removeClass("faded hl");
      if (!branch) return; // "all"

      const hits = cy
        .nodes('[type="person"]')
        .filter(
          (n) => n.data("branch") === branch || n.data("name").includes(branch),
        );
      if (!hits.length) return;
      cy.elements().addClass("faded");
      hits.removeClass("faded");
      hits.connectedEdges().removeClass("faded");
      hits.connectedEdges().connectedNodes().removeClass("faded");
      cy.animate({
        fit: {
          eles: hits.connectedEdges().connectedNodes().add(hits),
          padding: 40,
        },
        duration: 500,
      });
    });

    /* ── Info panel ── */
    const panel = document.getElementById("info-panel");
    const infoName = document.getElementById("info-name");
    const infoYears = document.getElementById("info-years");
    const infoBirth = document.getElementById("info-birth");
    const infoDeath = document.getElementById("info-death");
    const infoSpouse = document.getElementById("info-spouses");
    const infoKids = document.getElementById("info-children");
    const infoParent = document.getElementById("info-parents");

    function showInfo(n) {
      panel.style.display = "block";
      infoName.textContent = n.data("name") || "?";

      const b = n.data("birth"),
        d = n.data("death"),
        bp = n.data("birthPlace");
      infoYears.innerHTML =
        b || d
          ? `<strong>${b || "?"}</strong> – <strong>${d || "…"}</strong>`
          : "";
      infoBirth.textContent = b
        ? `Родился(ась): ${b}${bp ? ", " + bp : ""}`
        : "";
      infoDeath.textContent = d ? `Умер(ла): ${d}` : "";

      // Spouses: person → family(spouse) node → other person(spouse)
      const famSpousal = n
        .connectedEdges('[type="spouse"]')
        .connectedNodes('[type="family"]');
      const spouses = famSpousal
        .connectedEdges('[type="spouse"]')
        .connectedNodes('[type="person"]')
        .not(n);
      infoSpouse.textContent = spouses.length
        ? "Супруг(а): " + spouses.map((s) => s.data("name")).join(", ")
        : "";

      // Children: famNode → child
      const children = famSpousal
        .connectedEdges('[type="child"]')
        .connectedNodes('[type="person"]');
      infoKids.textContent = children.length
        ? `Дети (${children.length}): ` +
          children.map((c) => c.data("name")).join(", ")
        : "";

      // Parents: person ← child edge ← famNode ← spouse edge ← parent
      const famParental = n
        .connectedEdges('[type="child"]')
        .connectedNodes('[type="family"]');
      const parents = famParental
        .connectedEdges('[type="spouse"]')
        .connectedNodes('[type="person"]');
      infoParent.textContent = parents.length
        ? "Родители: " + parents.map((p) => p.data("name")).join(", ")
        : "";
    }

    cy.on("tap", 'node[type="person"]', (evt) => {
      const n = evt.target;
      showInfo(n);

      // highlight the person + immediate family (parents, spouses, siblings, children)
      const famSpousal = n
        .connectedEdges('[type="spouse"]')
        .connectedNodes('[type="family"]');
      const famParent = n
        .connectedEdges('[type="child"]')
        .connectedNodes('[type="family"]');
      const neighborhood = n
        .add(famSpousal)
        .add(famParent)
        .add(famSpousal.connectedEdges())
        .add(famParent.connectedEdges())
        .add(famSpousal.connectedEdges().connectedNodes())
        .add(famParent.connectedEdges().connectedNodes());

      cy.elements().removeClass("faded hl");
      cy.elements().not(neighborhood).addClass("faded");
      neighborhood.addClass("hl");
    });

    // tap on background → clear
    cy.on("tap", (evt) => {
      if (evt.target !== cy) return;
      panel.style.display = "none";
      cy.elements().removeClass("faded hl");
    });

    document.getElementById("info-close").addEventListener("click", () => {
      panel.style.display = "none";
      cy.elements().removeClass("faded hl");
    });

    // Initial fit
    cy.fit(undefined, 30);
  })
  .catch((err) => {
    const ld = document.getElementById("loading");
    ld.innerHTML = `<span style="color:#c0392b">Ошибка: ${err.message}</span><br><small>Ошибка при зачитывании и обработке архива</small>`;
  });
