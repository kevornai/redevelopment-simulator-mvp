"use client";

import { useEffect, useRef, useState } from "react";
import { ZONE_MAP_DATA, type ZoneMapMeta } from "./zone-coords";
import { zones } from "@/data/zones";

// Kakao Maps 전역 타입 선언
declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: object) => KakaoMap;
        LatLng: new (lat: number, lng: number) => object;
        Marker: new (options: object) => KakaoMarker;
        InfoWindow: new (options: object) => KakaoInfoWindow;
        event: {
          addListener: (target: object, event: string, handler: () => void) => void;
        };
        CustomOverlay: new (options: object) => KakaoOverlay;
      };
    };
  }
}

interface KakaoMap {
  setCenter: (latlng: object) => void;
}
interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
}
interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
}
interface KakaoOverlay {
  setMap: (map: KakaoMap | null) => void;
}

interface ZoneMapProps {
  onSelect: (zoneId: string, defaults?: ZoneMapMeta["defaultValues"]) => void;
  selectedZoneId: string;
}

export default function ZoneMap({ onSelect, selectedZoneId }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    if (window.kakao?.maps) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);

    return () => {
      // cleanup: 스크립트 제거하지 않음 (다른 페이지에서도 쓸 수 있으므로)
    };
  }, [apiKey]);

  useEffect(() => {
    if (!loaded || !containerRef.current) return;

    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(37.5200, 127.0000);
      const map = new window.kakao.maps.Map(containerRef.current!, {
        center,
        level: 8, // 서울 전체가 보이는 줌 레벨
      });
      mapRef.current = map;

      ZONE_MAP_DATA.forEach((zone) => {
        const pos = new window.kakao.maps.LatLng(zone.lat, zone.lng);
        const marker = new window.kakao.maps.Marker({
          position: pos,
          map,
        });

        // 커스텀 오버레이 (라벨)
        const isActive = zone.status === "active";
        const isSelected = zone.zoneId === selectedZoneId;

        const overlayContent = document.createElement("div");
        overlayContent.innerHTML = `
          <div
            data-zoneid="${zone.zoneId}"
            style="
              background: ${isSelected ? "#2563eb" : isActive ? "#1d4ed8" : "#71717a"};
              color: white;
              border-radius: 12px;
              padding: 4px 8px;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              cursor: ${isActive ? "pointer" : "default"};
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              border: 2px solid ${isSelected ? "#93c5fd" : "transparent"};
              opacity: ${isActive ? 1 : 0.65};
              transform: translateY(-100%) translateX(-50%);
              position: relative;
              top: -4px;
            "
          >
            ${zones[zone.zoneId] ?? zone.zoneId}
            ${!isActive ? " 🔒" : ""}
          </div>
        `;

        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos,
          content: overlayContent,
          yAnchor: 1,
          zIndex: isActive ? 10 : 5,
        });
        overlay.setMap(map);
        marker.setMap(null); // 기본 마커 숨기고 커스텀 오버레이만 사용

        // 클릭 이벤트 (active 구역만)
        if (isActive) {
          overlayContent.addEventListener("click", () => {
            onSelect(zone.zoneId, zone.defaultValues);
          });
        }
      });
    });
  }, [loaded, selectedZoneId, onSelect]);

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-semibold text-zinc-600">지도를 사용하려면 Kakao Maps API 키가 필요합니다</p>
        <p className="text-xs text-zinc-400 mt-1">
          .env.local에 <code className="bg-zinc-100 px-1 rounded">NEXT_PUBLIC_KAKAO_MAP_KEY</code> 추가 후 재시작
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          발급: developers.kakao.com → 내 애플리케이션 → JavaScript 키
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
          분석 가능 구역 (클릭하면 자동 입력)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-zinc-400 inline-block" />
          준비중 구역
        </span>
      </div>

      {/* 지도 */}
      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-zinc-200"
        style={{ height: "400px" }}
      />

      {/* API 키 있지만 로딩 중 */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 rounded-2xl">
          <p className="text-sm text-zinc-400">지도 로딩 중...</p>
        </div>
      )}
    </div>
  );
}
