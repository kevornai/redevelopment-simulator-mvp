import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat") ?? "37.2613";
  const lng = req.nextUrl.searchParams.get("lng") ?? "126.9946";
  const key = process.env.KAKAO_REST_API_KEY ?? "";

  if (!key) return NextResponse.json({ error: "KAKAO_REST_KEY 없음" }, { status: 500 });

  // 1) coord2regioncode — 법정동코드 10자리
  const regionUrl = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}&input_coord=WGS84`;
  // 2) coord2address — 번지(본번/부번)
  const addrUrl = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`;

  const headers = { Authorization: `KakaoAK ${key}` };
  const [regionRes, addrRes] = await Promise.all([
    fetch(regionUrl, { headers }),
    fetch(addrUrl, { headers }),
  ]);
  const regionJson = await regionRes.json();
  const addrJson = await addrRes.json();

  const region = regionJson.documents?.find((d: { region_type: string }) => d.region_type === "B"); // 법정동
  const addr = addrJson.documents?.[0]?.address;

  return NextResponse.json({
    b_code: region?.code,                          // 법정동코드 10자리
    sigunguCd: region?.code?.slice(0, 5),          // 건축물대장용
    bjdongCd: region?.code?.slice(5, 10),
    main_address_no: addr?.main_address_no,
    sub_address_no: addr?.sub_address_no,
    region_3depth_name: region?.region_3depth_name,
  });
}
