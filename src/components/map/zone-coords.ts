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
  { zoneId: "banpo",   lat: 37.5065, lng: 126.9987, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 4500000000, officialValuation: 2800000000, landShareSqm: 16, desiredPyung: 59 } },
  { zoneId: "gaepo",   lat: 37.4803, lng: 127.0677, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 3500000000, officialValuation: 2200000000, landShareSqm: 15, desiredPyung: 59 } },
  { zoneId: "gaepo4",  lat: 37.4785, lng: 127.0630, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 3000000000, officialValuation: 1800000000, landShareSqm: 13, desiredPyung: 59 } },
  { zoneId: "dunchon", lat: 37.4930, lng: 127.1218, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 2800000000, officialValuation: 1600000000, landShareSqm: 12, desiredPyung: 59 } },
  { zoneId: "chamsil", lat: 37.5093, lng: 127.0917, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 4000000000, officialValuation: 2500000000, landShareSqm: 18, desiredPyung: 84 } },
  { zoneId: "seocho",  lat: 37.4840, lng: 127.0070, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 4800000000, officialValuation: 3000000000, landShareSqm: 17, desiredPyung: 84 } },

  // ── 재개발 (흑석) ── 준비중
  { zoneId: "heukseok9", lat: 37.5085, lng: 126.9702, status: "coming_soon", projectType: "redevelopment" },

  // ── 재건축 (경기 과천) ── active
  { zoneId: "gwacheon",  lat: 37.4249, lng: 126.9954, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1800000000, officialValuation: 1000000000, landShareSqm: 14, desiredPyung: 59 } },
  { zoneId: "gwacheon1", lat: 37.4278, lng: 126.9875, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1700000000, officialValuation: 950000000,  landShareSqm: 13, desiredPyung: 59 } },
  { zoneId: "gwacheon2", lat: 37.4261, lng: 126.9895, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1650000000, officialValuation: 900000000,  landShareSqm: 13, desiredPyung: 59 } },

  // ── 재건축 (경기 분당) ── active
  { zoneId: "bundang_sunae", lat: 37.3796, lng: 127.1219, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1500000000, officialValuation: 850000000,  landShareSqm: 12, desiredPyung: 59 } },
  { zoneId: "bundang_seohyeon", lat: 37.3836, lng: 127.1188, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1400000000, officialValuation: 800000000,  landShareSqm: 11, desiredPyung: 59 } },

  // ── 재건축 (경기 평촌) ── active
  { zoneId: "pyeongchon", lat: 37.3894, lng: 126.9529, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1200000000, officialValuation: 650000000,  landShareSqm: 11, desiredPyung: 59 } },

  // ── 재건축 (경기 일산) ── active
  { zoneId: "ilsan",  lat: 37.6580, lng: 126.7701, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 900000000,  officialValuation: 480000000,  landShareSqm: 10, desiredPyung: 59 } },

  // ── 재건축 (서울 노원/목동) ── active
  { zoneId: "nowon",  lat: 37.6550, lng: 127.0562, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1100000000, officialValuation: 600000000,  landShareSqm: 10, desiredPyung: 59 } },
  { zoneId: "mokdong", lat: 37.5265, lng: 126.8746, status: "active", projectType: "reconstruction",
    defaultValues: { purchasePrice: 1800000000, officialValuation: 1050000000, landShareSqm: 13, desiredPyung: 59 } },

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
