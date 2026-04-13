/**
 * 구역별 지도 좌표 (WGS84)
 * 각 구역의 중심점 기준 좌표 (핀 위치)
 */
export interface ZoneMapMeta {
  zoneId: string;
  lat: number;
  lng: number;
  status: "active" | "coming_soon"; // active = 현재 지원, coming_soon = 준비중
  projectType: "reconstruction" | "redevelopment";
  defaultValues?: {
    purchasePrice?: number;
    officialValuation?: number;
    landShareSqm?: number;
    desiredPyung?: number;
  };
}

export const ZONE_MAP_DATA: ZoneMapMeta[] = [
  // ── 재건축 (강남권) ── active
  { zoneId: "banpo",    lat: 37.5065, lng: 126.9987, status: "active",      projectType: "reconstruction",
    defaultValues: { purchasePrice: 4500000000, officialValuation: 2800000000, landShareSqm: 16, desiredPyung: 59 } },
  { zoneId: "gaepo",    lat: 37.4803, lng: 127.0677, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "gaepo4",   lat: 37.4785, lng: 127.0630, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "dunchon",  lat: 37.4930, lng: 127.1218, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "chamsil",  lat: 37.5093, lng: 127.0917, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "seocho",   lat: 37.4840, lng: 127.0070, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "heukseok9",lat: 37.5085, lng: 126.9702, status: "coming_soon", projectType: "reconstruction" },

  // ── 재건축 (경기)
  { zoneId: "gwacheon",  lat: 37.4249, lng: 126.9954, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "gwacheon1", lat: 37.4278, lng: 126.9875, status: "coming_soon", projectType: "reconstruction" },
  { zoneId: "gwacheon2", lat: 37.4261, lng: 126.9895, status: "coming_soon", projectType: "reconstruction" },

  // ── 재개발 (용산/강북권) ── 준비중
  { zoneId: "hannam3",    lat: 37.5373, lng: 126.9993, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "hannam2",    lat: 37.5390, lng: 127.0003, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "hannam4",    lat: 37.5360, lng: 127.0010, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "hannam5",    lat: 37.5345, lng: 127.0020, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "noryangjin1",lat: 37.5098, lng: 126.9435, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "noryangjin2",lat: 37.5103, lng: 126.9442, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "noryangjin3",lat: 37.5109, lng: 126.9450, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "noryangjin5",lat: 37.5115, lng: 126.9458, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "heukseok2",  lat: 37.5102, lng: 126.9668, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "heukseok3",  lat: 37.5110, lng: 126.9680, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "singil1",    lat: 37.5112, lng: 126.9255, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "singil4",    lat: 37.5108, lng: 126.9263, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "singil5",    lat: 37.5106, lng: 126.9270, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "singil6",    lat: 37.5102, lng: 126.9278, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "dapsimni",   lat: 37.5618, lng: 127.0530, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "wangsimni",  lat: 37.5617, lng: 127.0285, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "majang",     lat: 37.5600, lng: 127.0214, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "seongsu",    lat: 37.5448, lng: 127.0556, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "ahyeon",     lat: 37.5568, lng: 126.9635, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "mapo",       lat: 37.5553, lng: 126.9491, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "gajwa",      lat: 37.5700, lng: 126.9090, status: "coming_soon", projectType: "redevelopment" },
  { zoneId: "yeonsinnae", lat: 37.6193, lng: 126.9181, status: "coming_soon", projectType: "redevelopment" },
];
