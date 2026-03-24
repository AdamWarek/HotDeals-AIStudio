import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/* ─── INJECT FONTS & SCOPED STYLES ─────────────────────────────────────────── */
const styleEl = document.createElement("style");
styleEl.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,700;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  
  .special-offers-page {
    background: #FAF8F4;
    font-family: 'DM Sans', sans-serif;
    color: #1A1A1A;
    min-height: 100vh;
  }
  .special-offers-page ::-webkit-scrollbar { width:4px; height:4px; }
  .special-offers-page ::-webkit-scrollbar-track { background:transparent; }
  .special-offers-page ::-webkit-scrollbar-thumb { background:#D8D0C8; border-radius:99px; }
  
  @keyframes fadeSlideIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes popHeart { 0%,100% { transform:scale(1); } 40% { transform:scale(1.4); } 70% { transform:scale(0.9); } }
  @keyframes shimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }
  
  .card-hover { transition: transform 0.22s ease, box-shadow 0.22s ease; }
  .card-hover:hover { transform:translateY(-5px); box-shadow:0 12px 32px rgba(0,0,0,0.10) !important; }
  .pill-btn { transition: all 0.16s ease; }
  .pill-btn:hover { opacity:.85; transform:scale(1.03); }
  .cta-btn { transition: opacity 0.15s, transform 0.15s; }
  .cta-btn:hover { opacity:.88; transform:scale(1.02); }
  .heart-pop { animation: popHeart 0.35s ease; }
  .img-zoom { transition: transform 0.35s ease; }
  .card-hover:hover .img-zoom { transform: scale(1.06); }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(styleEl);
}

/* ─── BRAND CONFIG ──────────────────────────────────────────────────────────── */
const B: Record<string, any> = {
  "Pull&Bear":        { accent:"#1C1C1C", light:"#EDEDEB", emoji:"🐻", saleUrl:"https://www.pullandbear.com/pl/wyprzedaz/kobieta" },
  "Bershka":          { accent:"#E8003D", light:"#FFF0F3", emoji:"⚡", saleUrl:"https://www.bershka.com/pl/wyprzedaz/kobieta" },
  "Urban Outfitters": { accent:"#5C4132", light:"#F5EDE7", emoji:"🌿", saleUrl:"https://www.urbanoutfitters.com/sale/womens" },
  "Adidas":           { accent:"#000000", light:"#EBEBEB", emoji:"🔥", saleUrl:"https://www.adidas.pl/kobiety-wyprzedaz" },
  "Nike":             { accent:"#E84500", light:"#FFF2EC", emoji:"✔️", saleUrl:"https://www.nike.com/pl/w/damskie-wyprzedaz-6ymx6znik1" },
  "Stradivarius":     { accent:"#8B7150", light:"#F5EDE2", emoji:"🌸", saleUrl:"https://www.stradivarius.com/pl/wyprzedaz/kobieta" },
  "H&M":              { accent:"#CC0028", light:"#FFF0F3", emoji:"🛍️", saleUrl:"https://www2.hm.com/pl_pl/wyprzedaz/kobiety.html" },
  "Rossmann":         { accent:"#D10019", light:"#FFF0F1", emoji:"💊", saleUrl:"https://www.rossmann.pl/promocje" },
  "Hebe":             { accent:"#C2007A", light:"#FEF0F8", emoji:"💄", saleUrl:"https://www.hebe.pl/promocje" },
  "Sephora":          { accent:"#1A1A1A", light:"#EBEBED", emoji:"✨", saleUrl:"https://www.sephora.pl/l/promocje" },
  "Douglas":          { accent:"#90002E", light:"#F8EDF1", emoji:"🌹", saleUrl:"https://www.douglas.pl/pl/promocje" },
};

/* ─── PROMOTIONS DATA ───────────────────────────────────────────────────────── */
const PROMOS = [
  { id:1,  brand:"Pull&Bear",        name:"Oversized Kurtka Jeansowa",        orig:229.90, sale:114.90, pct:50, cat:"Kurtki",       img:"https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=500&h=600&fit=crop", url:"https://www.pullandbear.com/pl/wyprzedaz/kobieta", isNew:false },
  { id:2,  brand:"Pull&Bear",        name:"Prążkowany Crop Top",              orig: 89.90, sale: 44.90, pct:50, cat:"Bluzki",       img:"https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500&h=600&fit=crop", url:"https://www.pullandbear.com/pl/wyprzedaz/kobieta", isNew:true  },
  { id:3,  brand:"Pull&Bear",        name:"Spodnie Cargo Y2K",                orig:149.90, sale: 89.90, pct:40, cat:"Spodnie",      img:"https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&h=600&fit=crop", url:"https://www.pullandbear.com/pl/wyprzedaz/kobieta", isNew:false },
  { id:4,  brand:"Bershka",          name:"Proste Jeansy Low-Rise",           orig:139.90, sale: 69.90, pct:50, cat:"Spodnie",      img:"https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&h=600&fit=crop", url:"https://www.bershka.com/pl/wyprzedaz/kobieta",    isNew:false },
  { id:5,  brand:"Bershka",          name:"Brokatowa Mini Sukienka Y2K",      orig: 99.90, sale: 49.90, pct:50, cat:"Sukienki",     img:"https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&h=600&fit=crop", url:"https://www.bershka.com/pl/wyprzedaz/kobieta",    isNew:true  },
  { id:6,  brand:"Bershka",          name:"Spódnica Midi ze Sztucznej Skóry", orig:119.90, sale: 71.90, pct:40, cat:"Spódnice",     img:"https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500&h=600&fit=crop", url:"https://www.bershka.com/pl/wyprzedaz/kobieta",    isNew:false },
  { id:7,  brand:"Urban Outfitters", name:"Kurtka Bomber Varsity",            orig:299.90, sale:179.90, pct:40, cat:"Kurtki",       img:"https://images.unsplash.com/photo-1551803091-e20673f15770?w=500&h=600&fit=crop", url:"https://www.urbanoutfitters.com/sale/womens",      isNew:false },
  { id:8,  brand:"Urban Outfitters", name:"Mini Sukienka w Kwiaty",           orig:249.90, sale:124.90, pct:50, cat:"Sukienki",     img:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&h=600&fit=crop", url:"https://www.urbanoutfitters.com/sale/womens",      isNew:false },
  { id:9,  brand:"Urban Outfitters", name:"Mini Torebka Sztruksowa",          orig:169.90, sale: 84.90, pct:50, cat:"Torby",        img:"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=600&fit=crop", url:"https://www.urbanoutfitters.com/sale/womens",      isNew:true  },
  { id:10, brand:"Adidas",           name:"Bluza z Kapturem Adicolor Trefoil",orig:249.90, sale:149.90, pct:40, cat:"Bluzy",        img:"https://images.unsplash.com/photo-1556821840-3a63f22e1b8c?w=500&h=600&fit=crop", url:"https://www.adidas.pl/kobiety-wyprzedaz",          isNew:false },
  { id:11, brand:"Adidas",           name:"Buty Superstar",                   orig:379.90, sale:265.90, pct:30, cat:"Obuwie",       img:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=600&fit=crop", url:"https://www.adidas.pl/kobiety-wyprzedaz",          isNew:false },
  { id:12, brand:"Adidas",           name:"Spodnie Dresowe 3-Stripe",         orig:199.90, sale:119.90, pct:40, cat:"Spodnie",      img:"https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=500&h=600&fit=crop", url:"https://www.adidas.pl/kobiety-wyprzedaz",          isNew:true  },
  { id:13, brand:"Nike",             name:"Air Max 90 Damskie",               orig:499.90, sale:349.90, pct:30, cat:"Obuwie",       img:"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=500&h=600&fit=crop", url:"https://www.nike.com/pl/w/damskie-wyprzedaz-6ymx6znik1", isNew:false },
  { id:14, brand:"Nike",             name:"Bluza Sportswear Essential Fleece",orig:199.90, sale:139.90, pct:30, cat:"Bluzy",        img:"https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=500&h=600&fit=crop", url:"https://www.nike.com/pl/w/damskie-wyprzedaz-6ymx6znik1", isNew:false },
  { id:15, brand:"Nike",             name:"Legginsy Dri-FIT One",             orig:179.90, sale:107.90, pct:40, cat:"Spodnie",      img:"https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500&h=600&fit=crop", url:"https://www.nike.com/pl/w/damskie-wyprzedaz-6ymx6znik1", isNew:true  },
  { id:16, brand:"Stradivarius",     name:"Satynowa Spódnica Midi Slip",      orig:119.90, sale: 59.90, pct:50, cat:"Spódnice",     img:"https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=500&h=600&fit=crop", url:"https://www.stradivarius.com/pl/wyprzedaz/kobieta", isNew:false },
  { id:17, brand:"Stradivarius",     name:"Lniane Spodnie Wide-Leg",          orig:149.90, sale: 89.90, pct:40, cat:"Spodnie",      img:"https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=500&h=600&fit=crop", url:"https://www.stradivarius.com/pl/wyprzedaz/kobieta", isNew:false },
  { id:18, brand:"H&M",              name:"Oversized Marynarka Taliowana",    orig:179.90, sale: 89.90, pct:50, cat:"Kurtki",       img:"https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=500&h=600&fit=crop", url:"https://www2.hm.com/pl_pl/wyprzedaz/kobiety.html", isNew:false },
  { id:19, brand:"H&M",              name:"Sweter z Golfem w Prążki",         orig: 79.90, sale: 39.90, pct:50, cat:"Bluzki",       img:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=600&fit=crop", url:"https://www2.hm.com/pl_pl/wyprzedaz/kobiety.html", isNew:false },
  { id:20, brand:"H&M",              name:"Mini Sukienka z Baloniastymi Rękawami", orig:129.90, sale:77.90, pct:40, cat:"Sukienki", img:"https://images.unsplash.com/photo-1483985988355-763728e1802d?w=500&h=600&fit=crop", url:"https://www2.hm.com/pl_pl/wyprzedaz/kobiety.html", isNew:true  },
  { id:21, brand:"Rossmann",         name:"Garnier SkinActive Zestaw Micelarny", orig:32.99, sale:19.99, pct:39, cat:"Pielęgnacja", img:"https://images.unsplash.com/photo-1599305090598-fe179d501227?w=500&h=600&fit=crop", url:"https://www.rossmann.pl/promocje",                isNew:false },
  { id:22, brand:"Rossmann",         name:"Zestaw Matowych Błyszczyków NYX", orig: 49.99, sale: 24.99, pct:50, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1512496522427-4d032d8fa7e5?w=500&h=600&fit=crop", url:"https://www.rossmann.pl/promocje",                isNew:true  },
  { id:23, brand:"Rossmann",         name:"Podkład Maybelline Fit Me",        orig: 34.99, sale: 20.99, pct:40, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&h=600&fit=crop", url:"https://www.rossmann.pl/promocje",                isNew:false },
  { id:24, brand:"Hebe",             name:"Zestaw Nivea Glow do Pielęgnacji", orig: 59.90, sale: 35.90, pct:40, cat:"Pielęgnacja",  img:"https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&h=600&fit=crop", url:"https://www.hebe.pl/promocje",                    isNew:false },
  { id:25, brand:"Hebe",             name:"Rozświetlacz Essence All-Over Glow",orig:29.90, sale: 17.90, pct:40, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=500&h=600&fit=crop", url:"https://www.hebe.pl/promocje",                    isNew:false },
  { id:26, brand:"Hebe",             name:"Zestaw do Brwi Catrice",           orig: 39.90, sale: 23.90, pct:40, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500&h=600&fit=crop", url:"https://www.hebe.pl/promocje",                    isNew:true  },
  { id:27, brand:"Sephora",          name:"Paleta Róży NARS Blush",           orig:149.90, sale:104.90, pct:30, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&h=600&fit=crop", url:"https://www.sephora.pl/l/promocje",                isNew:false },
  { id:28, brand:"Sephora",          name:"Zestaw Serum The Ordinary",        orig:129.90, sale: 90.90, pct:30, cat:"Pielęgnacja",  img:"https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&h=600&fit=crop", url:"https://www.sephora.pl/l/promocje",                isNew:false },
  { id:29, brand:"Sephora",          name:"Błyszczyk Fenty Beauty Gloss Bomb",orig: 89.90, sale: 62.90, pct:30, cat:"Makijaż",      img:"https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=500&h=600&fit=crop", url:"https://www.sephora.pl/l/promocje",                isNew:true  },
  { id:30, brand:"Douglas",          name:"Balsam do Ciała Jimmy Choo 150ml", orig:159.90, sale: 95.90, pct:40, cat:"Pielęgnacja",  img:"https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=500&h=600&fit=crop", url:"https://www.douglas.pl/pl/promocje",               isNew:false },
  { id:31, brand:"Douglas",          name:"Woda Toaletowa Marc Jacobs Daisy EDT 30ml", orig:299.90, sale:209.90, pct:30, cat:"Zapachy", img:"https://images.unsplash.com/photo-1541101767792-f9b2b1c4f127?w=500&h=600&fit=crop", url:"https://www.douglas.pl/pl/promocje",          isNew:false },
  { id:32, brand:"Douglas",          name:"Serum Lancôme Génifique",          orig:349.90, sale:244.90, pct:30, cat:"Pielęgnacja",  img:"https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=500&h=600&fit=crop", url:"https://www.douglas.pl/pl/promocje",               isNew:true  },
];

const fmt = (n: number) => n.toFixed(2).replace(".", ",") + " zł";
const ALL_BRANDS = Object.keys(B).sort();

/* ─── FAV PANEL ─────────────────────────────────────────────────────────────── */
function FavPanel({ items, favorites, onFav, onClose }: any) {
  if (items.length === 0) return null;
  return (
    <div style={{
      background:"#fff",
      borderBottom:"1px solid #EDE8E2",
      padding:"12px 16px",
      animation:"fadeSlideIn 0.22s ease",
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <span style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"16px", fontWeight:700, color:"#1A1A1A" }}>
          ♥ Ulubione ({items.length})
        </span>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"18px", color:"#999", lineHeight:1 }}>×</button>
      </div>
      <div style={{ display:"flex", gap:"10px", overflowX:"auto", paddingBottom:"4px" }}>
        {items.map((item: any) => {
          const brand = B[item.brand];
          return (
            <div key={item.id} style={{
              flexShrink:0, width:"88px",
              background:"#FAF8F4", borderRadius:"12px",
              overflow:"hidden", position:"relative",
            }}>
              <img src={item.img} alt={item.name} style={{ width:"88px", height:"88px", objectFit:"cover", display:"block" }} />
              <button onClick={() => onFav(item.id)} style={{
                position:"absolute", top:4, right:4,
                background:"#FF3B30", border:"none", borderRadius:"50%",
                width:"20px", height:"20px", fontSize:"10px",
                cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
              }}>♥</button>
              <div style={{ padding:"5px 6px" }}>
                <p style={{ fontSize:"9px", fontWeight:600, color:"#1A1A1A", lineHeight:1.3, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{item.name}</p>
                <p style={{ fontSize:"10px", fontWeight:700, color:brand.accent, marginTop:"2px" }}>{fmt(item.sale)}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:"9px", color:brand.accent, textDecoration:"none", fontWeight:600 }}>Zobacz →</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PROMO CARD ─────────────────────────────────────────────────────────────── */
function PromoCard({ item, isFav, onFav, size }: any) {
  const brand = B[item.brand];
  const isSmall  = size === "small";
  const isLarge  = size === "large";
  const imgH     = isSmall ? "130px" : isLarge ? "280px" : "200px";
  const [heartAnim, setHeartAnim] = useState(false);

  const handleFav = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setHeartAnim(true);
    onFav(item.id);
    setTimeout(() => setHeartAnim(false), 400);
  };

  return (
    <div className="card-hover" style={{
      background:"#fff",
      borderRadius: isLarge ? "18px" : "14px",
      overflow:"hidden",
      boxShadow:"0 2px 14px rgba(0,0,0,0.065)",
      display:"flex",
      flexDirection: isLarge ? "row" : "column",
      position:"relative",
    }}>
      {/* Image */}
      <div style={{
        position:"relative",
        width: isLarge ? "150px" : "100%",
        flexShrink:0,
        height: isLarge ? "170px" : imgH,
        overflow:"hidden",
        background: brand.light,
      }}>
        <img
          className="img-zoom"
          src={item.img}
          alt={item.name}
          loading="lazy"
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
          onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${item.id * 17}/500/600`; }}
        />
        {/* Badges */}
        <div style={{ position:"absolute", top:8, left:8, display:"flex", flexDirection:"column", gap:"4px" }}>
          <span style={{
            background:"#FF3B30", color:"#fff",
            fontSize: isSmall ? "9px" : "10px", fontWeight:700,
            padding:"2px 7px", borderRadius:"20px",
            fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.02em",
          }}>−{item.pct}%</span>
          {item.isNew && (
            <span style={{
              background: brand.accent, color:"#fff",
              fontSize: isSmall ? "8px" : "9px", fontWeight:700,
              padding:"2px 6px", borderRadius:"20px",
              fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.03em",
            }}>NEW</span>
          )}
        </div>
        {/* Heart */}
        <button
          onClick={handleFav}
          className={heartAnim ? "heart-pop" : ""}
          style={{
            position:"absolute", top:7, right:7,
            width: isSmall ? "26px" : "32px",
            height: isSmall ? "26px" : "32px",
            borderRadius:"50%",
            background: isFav ? "#FF3B30" : "rgba(255,255,255,0.88)",
            border:"none", cursor:"pointer",
            fontSize: isSmall ? "12px" : "14px",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 1px 6px rgba(0,0,0,0.12)",
            backdropFilter:"blur(4px)",
            transition:"background 0.2s",
          }}
        >{isFav ? "♥" : "♡"}</button>
      </div>

      {/* Info */}
      <div style={{
        padding: isSmall ? "8px 9px 10px" : isLarge ? "14px 16px" : "11px 13px 14px",
        display:"flex", flexDirection:"column",
        gap: isSmall ? "3px" : "6px",
        flex:1,
      }}>
        {/* Category pill */}
        <span style={{
          alignSelf:"flex-start",
          background: brand.light, color: brand.accent,
          fontSize: isSmall ? "8px" : "9px",
          fontWeight:700, padding:"2px 8px",
          borderRadius:"20px", letterSpacing:"0.05em",
          textTransform:"uppercase",
        }}>{item.cat}</span>

        {/* Name */}
        <p style={{
          fontFamily:"'DM Sans', sans-serif",
          fontSize: isSmall ? "11px" : isLarge ? "15px" : "13px",
          fontWeight:600, color:"#1A1A1A",
          lineHeight:1.35,
          display:"-webkit-box", WebkitLineClamp: isSmall ? 2 : 3,
          WebkitBoxOrient:"vertical", overflow:"hidden",
        }}>{item.name}</p>

        {/* Prices */}
        <div style={{ display:"flex", alignItems:"baseline", gap:"6px", flexWrap:"wrap", marginTop:"auto" }}>
          <span style={{
            fontFamily:"'Cormorant Garamond', serif",
            fontSize: isSmall ? "15px" : isLarge ? "22px" : "18px",
            fontWeight:700, color:"#1A1A1A",
          }}>{fmt(item.sale)}</span>
          <span style={{
            fontSize: isSmall ? "10px" : "11px",
            color:"#ABABAB", textDecoration:"line-through",
          }}>{fmt(item.orig)}</span>
        </div>

        {/* CTA */}
        {!isSmall ? (
          <a
            href={item.url} target="_blank" rel="noopener noreferrer"
            className="cta-btn"
            style={{
              display:"block",
              background: brand.accent, color:"#fff",
              padding: isLarge ? "9px 16px" : "8px 14px",
              borderRadius:"10px",
              textDecoration:"none",
              fontSize:"12px", fontWeight:600,
              textAlign:"center",
            }}
          >Zobacz ofertę →</a>
        ) : (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:"10px", fontWeight:700, color: brand.accent, textDecoration:"none" }}>
            Zobacz →
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── BRAND SECTION ──────────────────────────────────────────────────────────── */
function BrandSection({ brand, items, favorites, onFav, cardSize }: any) {
  const cfg = B[brand];
  const cols = cardSize === "small" ? 3 : cardSize === "large" ? 1 : 2;

  return (
    <section style={{ marginBottom:"32px" }}>
      {/* Brand header */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:"14px", padding:"0 16px",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ fontSize:"18px" }}>{cfg.emoji}</span>
          <span style={{
            fontFamily:"'Cormorant Garamond', serif",
            fontSize:"22px", fontWeight:700,
            color:"#1A1A1A", letterSpacing:"-0.01em",
          }}>{brand}</span>
          <span style={{
            background: cfg.light, color: cfg.accent,
            fontSize:"10px", fontWeight:700,
            padding:"2px 8px", borderRadius:"20px",
            letterSpacing:"0.03em",
          }}>{items.length} ofert</span>
        </div>
        <a
          href={cfg.saleUrl} target="_blank" rel="noopener noreferrer"
          style={{
            fontSize:"11px", fontWeight:600,
            color: cfg.accent, textDecoration:"none",
            display:"flex", alignItems:"center", gap:"3px",
          }}
        >Wszystkie →</a>
      </div>

      {/* Cards grid */}
      <div style={{
        display:"grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: cardSize === "small" ? "8px" : cardSize === "large" ? "12px" : "10px",
        padding:"0 16px",
      }}>
        {items.map((item: any) => (
          <PromoCard
            key={item.id}
            item={item}
            isFav={favorites.has(item.id)}
            onFav={onFav}
            size={cardSize}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────────── */
export default function SpecialOffers() {
  const [favorites,      setFavorites]      = useState(new Set());
  const [search,         setSearch]         = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [cardSize,       setCardSize]       = useState("medium");
  const [showFavPanel,   setShowFavPanel]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleFav = (id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  /* Filter & group */
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = PROMOS.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q);
      const matchBrand  = selectedBrands.length === 0 || selectedBrands.includes(p.brand);
      return matchSearch && matchBrand;
    });

    const map: Record<string, any[]> = {};
    filtered.forEach(p => {
      if (!map[p.brand]) map[p.brand] = [];
      map[p.brand].push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [search, selectedBrands]);

  const favItems = PROMOS.filter(p => favorites.has(p.id));
  const totalDeals = grouped.reduce((n, [, items]) => n + items.length, 0);

  const SIZE_OPTS = [
    { key:"small",  label:"S" },
    { key:"medium", label:"M" },
    { key:"large",  label:"L" },
  ];

  return (
    <div className="special-offers-page">
      <div style={{ maxWidth:"430px", margin:"0 auto", minHeight:"100vh", background:"#FAF8F4" }}>

        {/* ── STICKY HEADER ── */}
        <div style={{
          position:"sticky", top:0, zIndex:100,
          background:"rgba(250,248,244,0.96)",
          backdropFilter:"blur(12px)",
          borderBottom:"1px solid #EDE8E2",
        }}>
          {/* Top bar */}
          <div style={{
            display:"flex", alignItems:"center", gap:"10px",
            padding:"12px 16px 10px",
          }}>
            {/* Back Button */}
            <Link to="/" style={{ color: "#1A1A1A", textDecoration: "none", display: "flex", alignItems: "center" }}>
              <ArrowLeft size={24} />
            </Link>

            {/* Logo */}
            <div style={{ flexShrink:0 }}>
              <div style={{
                fontFamily:"'Cormorant Garamond', serif",
                fontSize:"22px", fontWeight:700,
                color:"#1A1A1A", lineHeight:1,
                letterSpacing:"-0.02em",
              }}>✦ deal<em>s</em></div>
              <div style={{ fontSize:"8px", fontWeight:600, color:"#ABABAB", letterSpacing:"0.12em", textTransform:"uppercase", marginTop:"1px" }}>Dla dziewczyn · Rozmiar M</div>
            </div>

            {/* Search */}
            <div style={{ flex:1, position:"relative" }}>
              <span style={{ position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", fontSize:"14px", color:"#ABABAB" }}>🔍</span>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj ofert…"
                style={{
                  width:"100%",
                  background:"#EDEBE7",
                  border:"none", borderRadius:"12px",
                  padding:"9px 12px 9px 32px",
                  fontSize:"13px", fontFamily:"'DM Sans', sans-serif",
                  color:"#1A1A1A", outline:"none",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{
                  position:"absolute", right:"8px", top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", fontSize:"14px", color:"#ABABAB",
                }}>×</button>
              )}
            </div>

            {/* Fav button */}
            <button
              onClick={() => setShowFavPanel(v => !v)}
              style={{
                flexShrink:0,
                background: showFavPanel ? "#FF3B30" : favItems.length > 0 ? "#FFF0EE" : "#EDEBE7",
                border:"none", borderRadius:"12px",
                padding:"8px 12px",
                cursor:"pointer",
                display:"flex", alignItems:"center", gap:"4px",
                transition:"all 0.2s",
              }}
            >
              <span style={{ fontSize:"15px" }}>{showFavPanel ? "♥" : favItems.length > 0 ? "♥" : "♡"}</span>
              {favItems.length > 0 && (
                <span style={{ fontSize:"12px", fontWeight:700, color: showFavPanel ? "#fff" : "#FF3B30" }}>
                  {favItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Fav panel */}
          {showFavPanel && (
            <FavPanel items={favItems} favorites={favorites} onFav={toggleFav} onClose={() => setShowFavPanel(false)} />
          )}

          {/* Brand filter + size toggle row */}
          <div style={{
            display:"flex", alignItems:"center",
            padding:"0 16px 12px",
            gap:"10px",
          }}>
            {/* Brand pills – scrollable */}
            <div style={{ flex:1, overflowX:"auto", display:"flex", gap:"6px", paddingBottom:"2px" }}>
              {ALL_BRANDS.map(brand => {
                const cfg = B[brand];
                const active = selectedBrands.includes(brand);
                return (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="pill-btn"
                    style={{
                      flexShrink:0,
                      background: active ? cfg.accent : cfg.light,
                      color: active ? "#fff" : cfg.accent,
                      border:"none", borderRadius:"20px",
                      padding:"5px 11px",
                      fontSize:"11px", fontWeight:600,
                      cursor:"pointer",
                      fontFamily:"'DM Sans', sans-serif",
                      whiteSpace:"nowrap",
                    }}
                  >{brand}</button>
                );
              })}
            </div>

            {/* Size toggle */}
            <div style={{
              flexShrink:0,
              display:"flex",
              background:"#EDEBE7",
              borderRadius:"10px",
              padding:"3px",
              gap:"2px",
            }}>
              {SIZE_OPTS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCardSize(key)}
                  style={{
                    background: cardSize === key ? "#1A1A1A" : "transparent",
                    color: cardSize === key ? "#fff" : "#888",
                    border:"none", borderRadius:"8px",
                    width:"26px", height:"26px",
                    fontSize:"11px", fontWeight:700,
                    cursor:"pointer", transition:"all 0.15s",
                    fontFamily:"'DM Sans', sans-serif",
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ paddingTop:"16px", paddingBottom:"40px" }}>
          {/* Results summary */}
          <div style={{ padding:"0 16px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:"12px", color:"#ABABAB", fontWeight:500 }}>
              {totalDeals} ofert · {grouped.length} marek
            </span>
            {selectedBrands.length > 0 && (
              <button onClick={() => setSelectedBrands([])} style={{
                background:"none", border:"none", cursor:"pointer",
                fontSize:"11px", color:"#888", fontWeight:600,
                textDecoration:"underline",
              }}>Wyczyść filtry</button>
            )}
          </div>

          {/* Brand sections */}
          {grouped.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#ABABAB" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>🔍</div>
              <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:"20px", fontWeight:600 }}>Brak ofert</p>
              <p style={{ fontSize:"13px", marginTop:"6px" }}>Spróbuj innego wyszukiwania lub wyczyść filtry.</p>
            </div>
          ) : (
            grouped.map(([brand, items]) => (
              <BrandSection
                key={brand}
                brand={brand}
                items={items}
                favorites={favorites}
                onFav={toggleFav}
                cardSize={cardSize}
              />
            ))
          )}

          {/* Footer note */}
          <div style={{
            margin:"8px 16px 0",
            background:"#EDEBE7",
            borderRadius:"14px",
            padding:"14px 16px",
          }}>
            <p style={{ fontSize:"11px", color:"#888", lineHeight:1.6, textAlign:"center" }}>
              ✦ Oferty skierowane do <strong>dziewczyn w wieku 14–18 lat, rozmiar M</strong>.<br />
              Kliknij <strong>Zobacz ofertę</strong>, aby zobaczyć aktualne ceny na stronie marki.<br />
              Lista ofert jest aktualizowana ręcznie — sprawdź dostępność bezpośrednio w sklepie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
