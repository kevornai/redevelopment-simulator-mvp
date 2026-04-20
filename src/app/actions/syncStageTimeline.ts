"use server";

export interface GyeonggiApiRow {
  SIGUN_NM: string;
  SIGUN_CD: string;
  BIZ_TYPE_NM: string;
  IMPRV_ZONE_NM: string;
  IMPRV_ZONE_APPONT_FIRST_DE: string | null;
  PROPLSN_COMMISN_APRV_DE: string | null;
  ASSOCTN_FOUND_CONFMTN_DE: string | null;
  BIZ_IMPLMTN_CONFMTN_DE: string | null;
  MANAGE_DISPOSIT_CONFMTN_DE: string | null;
  STRCONTR_DE: string | null;
  GENRL_LOTOUT_DE: string | null;
  COMPLTN_DE: string | null;
}

/**
 * @deprecated gyeonggi_zones로 완전 전환됨 — 이 함수는 호환성을 위해 남겨둠
 * 실제 저장은 /api/admin/sync-gyeonggi POST에서 처리
 */
export async function saveGyeonggiRows(_rows: GyeonggiApiRow[]): Promise<{ saved: number; synced: number; error?: string }> {
  return { saved: 0, synced: 0, error: "deprecated: /api/admin/sync-gyeonggi 를 사용하세요" };
}
