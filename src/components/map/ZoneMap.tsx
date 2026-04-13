"use client";

import { useEffect, useRef, useState } from "react";
import type { ZoneMapMeta } from "./zone-coords";

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: object) => KakaoMap;
        LatLng: new (lat: number, lng: number) => object;
        Marker: new (options: object) => KakaoMarker;
        CustomOverlay: new (options: object) => KakaoOverlay;
      };
    };
  }
}
interface KakaoMap    { setCenter: (l: object) => void }
interface KakaoMarker { setMap: (m: KakaoMap | null) => void }
interface KakaoOverlay { setMap: (m: KakaoMap | null) => void }

type MapStatus = "idle" | "loading" | "ready" | "error";

// DB에서 오는 구역 데이터
interface ZoneRow {
  zone_id: string;
  zone_name: string | null;
  project_type: "reconstruction" | "redevelopment";
  project_stage: string;
  lat: number;
  lng: number;
}

// 단계 → 한글 + 색상
const STAGE_META: Record<string, { label: string; color: string; textColor: string }> = {
  zone_designation:       { label: "구역지정",   color: "#71717a", textColor: "#fff" },
  basic_plan:             { label: "기본계획",   color: "#71717a", textColor: "#fff" },
  project_implementation: { label: "사업시행",   color: "#d97706", textColor: "#fff" },
  management_disposal:    { label: "관리처분",   color: "#ea580c", textColor: "#fff" },
  relocation:             { label: "이주·철거", color: "#dc2626", textColor: "#fff" },
  construction_start:     { label: "착공",       color: "#2563eb", textColor: "#fff" },
  completion:             { label: "준공",       color: "#16a34a", textColor: "#fff" },
};

interface ZoneMapProps {
  onSelect: (zoneId: string, defaults?: ZoneMapMeta["defaultValues"]) => void;
  selectedZoneId: string;
}

export default function ZoneMap({ onSelect, selectedZoneId }: ZoneMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [status, setStatus]   = useState<MapStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [zones, setZones]     = useState<ZoneRow[]>([]);
  const initializedRef = useRef(false);

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── 1. 구역 목록 fetch (DB)
  useEffect(() => {
    fetch("/api/zones")
      .then((r) => r.json())
      .then((d) => { if (d.zones) setZones(d.zones); })
      .catch(() => {});
  }, []);

  // ── 2. Kakao SDK 스크립트 로드
  useEffect(() => {
    if (!apiKey) return;
    if (window.kakao?.maps) { setStatus("ready"); return; }
    setStatus("loading");

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.addEventListener("load", () => setStatus("ready"));
    script.addEventListener("error", () => {
      setStatus("error");
      setErrorMsg("스크립트 로드 실패 — API 키 또는 활성화 상태를 확인하세요.");
    });
    document.head.appendChild(script);
  }, [apiKey]);

  // ── 3. 지도 초기화 (SDK ready + 구역 데이터 둘 다 있을 때)
  useEffect(() => {
    if (status !== "ready") return;
    if (!containerRef.current) return;
    if (zones.length === 0) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      window.kakao.maps.load(() => {
        try {
          const center = new window.kakao.maps.LatLng(37.52, 127.05);
          const map = new window.kakao.maps.Map(containerRef.current!, {
            center,
            level: 10,
          });

          zones.forEach((zone) => {
            const pos = new window.kakao.maps.LatLng(zone.lat, zone.lng);
            const isSelected = zone.zone_id === selectedZoneId;
            const stageMeta = STAGE_META[zone.project_stage] ?? STAGE_META.zone_designation;
            const isActive = zone.project_type === "reconstruction";
            const displayName = zone.zone_name ?? zone.zone_id;

            const el = document.createElement("div");
            el.innerHTML = `
              <div style="
                display:flex; flex-direction:column; align-items:center; gap:2px;
                cursor:${isActive ? "pointer" : "default"};
              ">
                <div style="
                  background:${isSelected ? "#1e40af" : isActive ? stageMeta.color : "#a1a1aa"};
                  color:${stageMeta.textColor};
                  border-radius:10px; padding:3px 8px;
                  font-size:11px; font-weight:700; white-space:nowrap;
                  box-shadow:0 2px 8px rgba(0,0,0,.25);
                  border:2px solid ${isSelected ? "#93c5fd" : "transparent"};
                  opacity:${isActive ? 1 : 0.65};
                ">${displayName}${!isActive ? " 🔒" : ""}</div>
                <div style="
                  background:${isActive ? stageMeta.color : "#d4d4d8"};
                  color:#fff;
                  border-radius:6px; padding:1px 6px;
                  font-size:9px; font-weight:600; white-space:nowrap;
                  opacity:${isActive ? 0.9 : 0.6};
                ">${stageMeta.label}</div>
              </div>`;

            new window.kakao.maps.CustomOverlay({
              position: pos,
              content: el,
              yAnchor: 1.5,
              zIndex: isActive ? 10 : 5,
            }).setMap(map);

            // 기본 마커 숨김
            const marker = new window.kakao.maps.Marker({ position: pos, map });
            marker.setMap(null);

            if (isActive) {
              el.addEventListener("click", () => onSelect(zone.zone_id));
            }
          });
        } catch (e) {
          setStatus("error");
          setErrorMsg(`지도 초기화 오류: ${e}`);
        }
      });
    } catch (e) {
      setStatus("error");
      setErrorMsg(`kakao.maps.load 오류: ${e}`);
    }
  }, [status, zones, selectedZoneId, onSelect]);

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-semibold text-zinc-600">Kakao Maps API 키가 없습니다</p>
      </div>
    );
  }

  // 단계별 범례 (active 구역에 나타나는 것만)
  const legendStages = ["management_disposal", "relocation", "construction_start", "project_implementation"] as const;

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {legendStages.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: STAGE_META[s].color }}
            />
            {STAGE_META[s].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-zinc-400" />
          재개발(준비중)
        </span>
      </div>

      {/* 지도 컨테이너 */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-200" style={{ height: 440 }}>
        <div ref={containerRef} className="w-full h-full" />

        {(status === "idle" || status === "loading" || zones.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-zinc-400">지도 불러오는 중...</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-600 mb-1">지도 로드 실패</p>
            <p className="text-xs text-zinc-500 mb-4">{errorMsg}</p>
            <div className="text-xs text-zinc-500 bg-white border border-zinc-200 rounded-xl p-4 text-left max-w-sm w-full space-y-1.5">
              <p className="font-bold text-zinc-700 mb-2">카카오 콘솔 설정 확인</p>
              <p><span className="font-semibold">1.</span> developers.kakao.com → 앱 → 플랫폼 키</p>
              <p><span className="font-semibold">2.</span> JavaScript 키 → 더보기 → JavaScript SDK 도메인</p>
              <p className="pl-3 text-zinc-400">→ <code className="bg-zinc-100 px-1 rounded">https://revo-invest.com</code> 등록</p>
              <p><span className="font-semibold">3.</span> 제품 설정 → 카카오맵 → 사용 설정 ON</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400 text-right">
        재건축 {zones.filter(z => z.project_type === "reconstruction").length}개 ·
        재개발 {zones.filter(z => z.project_type === "redevelopment").length}개
      </p>
    </div>
  );
}
