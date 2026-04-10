import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const GUIDE_BOOK_URL = Deno.env.get('GUIDE_BOOK_URL') ?? '';
const FROM = 'Revo 데이터 분석팀 <revo@revo-invest.com>';
const SUBJECT = "[Revo] 수억 원의 손실을 막아낼 '분담금 방어 가이드북' 발송 안내";

function buildHtml(guideBookUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
  <!-- Preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    다운로드 후 현재 임장 중인 구역의 예상 분담금을 즉시 검증하십시오.
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #e4e4e7;max-width:560px;">
          <tr>
            <td>
              <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Revo 데이터 분석팀</p>

              <p style="font-size:20px;font-weight:700;color:#18181b;margin:0 0 24px;line-height:1.4;">
                가장 보수적인 투자의 첫걸음, 환영합니다.
              </p>

              <p style="font-size:15px;color:#3f3f46;line-height:1.8;margin:0 0 16px;">
                기존의 장밋빛 브리핑을 맹신하지 않고 객관적인 데이터를 선택하신 것을 환영합니다.<br/>
                Revo 시뮬레이터 정식 런칭 시, 본 이메일로 <b>[1회 무료 분석권]</b>이 가장 먼저 발급될 예정입니다.
              </p>

              <p style="font-size:15px;color:#3f3f46;line-height:1.8;margin:0 0 16px;">
                그에 앞서, 귀하의 자본을 방어하기 위해 약속드린
                <b>[수억 원 잃기 전 반드시 알아야 할, 재개발 분담금 폭탄 피하는 5가지 비밀]</b>
                가이드북을 보내드립니다.
              </p>

              <p style="font-size:15px;color:#3f3f46;line-height:1.8;margin:0 0 32px;">
                해당 문서는 단순한 정보 전달이 아닙니다. 현재 임장 중인 구역에 대입하여 즉시 사용할 수 있는
                '최악의 분담금 역산 공식'이 포함되어 있습니다.<br/>
                계약금을 입금하기 전, 반드시 아래 버튼을 눌러 문서를 완독하고 철저히 검증하십시오.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${guideBookUrl}"
                       style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                      가이드북 무료 다운로드 (PDF)
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 24px;"/>

              <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
                본 메일은 사전 예약 시 마케팅 정보 수신에 동의하신 분께 발송됩니다.<br/>
                문의: support@revo.kr
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record = payload?.record ?? payload;
    const email: string = record?.email;
    const marketingConsent: boolean = record?.marketing_consent === true;

    if (!email) {
      return new Response(JSON.stringify({ error: 'No email in payload' }), { status: 400 });
    }

    if (!marketingConsent) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'marketing_consent is false' }),
        { status: 200 }
      );
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: SUBJECT,
        html: buildHtml(GUIDE_BOOK_URL),
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Email send failed', detail: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
