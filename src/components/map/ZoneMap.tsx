"use client";

import { useEffect, useRef, useState } from "react";
import { ZONE_MAP_DATA, type ZoneMapMeta } from "./zone-coords";
import { zones } from "@/data/zones";

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
interface KakaoMap   { setCenter: (l: object) => void }
interface KakaoMarker { setMap: (m: KakaoMap | null) => void }
interface KakaoOverlay { setMap: (m: KakaoMap | null) => void }

type MapStatus = "idle" | "loading" | "ready" | "error";

interface ZoneMapProps {
  onSelect: (zoneId: string, defaults?: ZoneMapMeta["defaultValues"]) => void;
  selectedZoneId: string;
}

export default function ZoneMap({ onSelect, selectedZoneId }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const initializedRef = useRef(false); // 지도를 한 번만 init

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── 1. Kakao SDK 스크립트 로드
  useEffect(() => {
    if (!apiKey) return;

    // 이미 로드됐으면 바로 진행
    if (window.kakao?.maps) {
      setStatus("ready");
      return;
    }

    setStatus("loading");

    const script = document.createElement("script");
    // 명시적 https:// — 프로토콜 상대 URL(//...)은 localhost(http)에서 실패할 수 있음
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;

    script.addEventListener("load", () => {
      setStatus("ready");
    });

    script.addEventListener("error", () => {
      setStatus("error");
      setErrorMsg("스크립트 로드 실패 — API 키 또는 활성화 상태를 확인하세요.");
    });

    document.head.appendChild(script);
  }, [apiKey]);

  // ── 2. 지도 초기화 (SDK ready + container 마운트 후)
  useEffect(() => {
    if (status !== "ready") return;
    if (!containerRef.current) return;
    if (initializedRef.current) return; // 중복 init 방지
    initializedRef.current = true;

    try {
      window.kakao.maps.load(() => {
        try {
          const center = new window.kakao.maps.LatLng(37.52, 127.00);
          const map = new window.kakao.maps.Map(containerRef.current!, {
            center,
            level: 8,
          });

          ZONE_MAP_DATA.forEach((zone) => {
            const pos = new window.kakao.maps.LatLng(zone.lat, zone.lng);
            const isActive = zone.status === "active";
            const isSelected = zone.zoneId === selectedZoneId;

            // 기본 마커 (클릭 영역 확보용)
            const marker = new window.kakao.maps.Marker({ position: pos, map });

            // 커스텀 라벨 오버레이
            const el = document.createElement("div");
            el.innerHTML = `
              <div style="
                background:${isSelected ? "#2563eb" : isActive ? "#1d4ed8" : "#71717a"};
                color:#fff; border-radius:12px; padding:3px 8px;
                font-size:11px; font-weight:700; white-space:nowrap;
                cursor:${isActive ? "pointer" : "default"};
                box-shadow:0 2px 8px rgba(0,0,0,.3);
                border:2px solid ${isSelected ? "#93c5fd" : "transparent"};
                opacity:${isActive ? 1 : 0.6};
                margin-bottom:4px;
              ">${zones[zone.zoneId] ?? zone.zoneId}${!isActive ? " 🔒" : ""}</div>`;

            new window.kakao.maps.CustomOverlay({
              position: pos,
              content: el,
              yAnchor: 1.5,
              zIndex: isActive ? 10 : 5,
            }).setMap(map);

            marker.setMap(null); // 기본 핀 숨김

            if (isActive) {
              el.addEventListener("click", () => {
                onSelect(zone.zoneId, zone.defaultValues);
              });
            }
          });
        } catch (e) {
          setStatus("error");
          setErrorMsg(`지도 초기화 오류: ${e}`);
        }
      });
    } catch (e) {
      setStatus("error");
      setErrorMsg(`kakao.maps.load 오류: ${e}. 카카오 콘솔에서 플랫폼(Web) 도메인을 등록했는지 확인하세요.`);
    }
  }, [status, selectedZoneId, onSelect]);

  // ── API 키 없음
  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-semibold text-zinc-600">Kakao Maps API 키가 없습니다</p>
        <p className="text-xs text-zinc-400 mt-1">
          .env.local에 <code className="bg-zinc-100 px-1 rounded">NEXT_PUBLIC_KAKAO_MAP_KEY</code> 추가 후 dev 서버 재시작
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
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
          분석 가능 (클릭 시 자동 입력)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-zinc-400 inline-block" />
          준비중
        </span>
      </div>

      {/* 지도 컨테이너 — relative로 오버레이 기준점 확보 */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-200" style={{ height: 400 }}>
        {/* 카카오맵이 채울 div */}
        <div ref={containerRef} className="w-full h-full" />

        {/* 로딩 상태 */}
        {(status === "idle" || status === "loading") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-zinc-400">지도 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-600 mb-1">지도 로드 실패</p>
            <p className="text-xs text-zinc-500 mb-4">{errorMsg}</p>
            <div className="text-xs text-zinc-500 bg-white border border-zinc-200 rounded-xl p-4 text-left max-w-sm w-full space-y-2">
              <p className="font-bold text-zinc-700 mb-2">카카오 콘솔 설정 확인</p>
              <p><span className="font-semibold">1.</span> developers.kakao.com 로그인</p>
              <p><span className="font-semibold">2.</span> 내 애플리케이션 → 앱 선택</p>
              <p><span className="font-semibold">3.</span> 앱 설정 → 플랫폼 → Web → 사이트 도메인</p>
              <p className="pl-3 text-zinc-400">→ <code className="bg-zinc-100 px-1 rounded">https://revo-invest.com</code> 추가</p>
              <p><span className="font-semibold">4.</span> 카카오맵 API 활성화 확인</p>
              <p className="pl-3 text-zinc-400">→ 앱 → 카카오 서비스 → <span className="font-medium text-zinc-600">카카오맵</span> ON</p>
              <p><span className="font-semibold">5.</span> JavaScript 앱 키 사용 여부 확인</p>
              <p className="pl-3 text-zinc-400">→ 앱 키 탭에서 <span className="font-medium text-zinc-600">JavaScript 키</span> 복사</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
