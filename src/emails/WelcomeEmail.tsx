import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Preview,
  Hr,
} from '@react-email/components';

interface WelcomeEmailProps {
  guideBookUrl: string;
}

export default function WelcomeEmail({ guideBookUrl }: WelcomeEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>다운로드 후 현재 임장 중인 구역의 예상 분담금을 즉시 검증하십시오.</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: '40px auto', backgroundColor: '#ffffff', borderRadius: 12, padding: '40px 32px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            Revo 데이터 분석팀
          </Text>

          <Text style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: '0 0 24px', lineHeight: '1.4' }}>
            가장 보수적인 투자의 첫걸음, 환영합니다.
          </Text>

          <Text style={{ fontSize: 15, color: '#3f3f46', lineHeight: '1.8', margin: '0 0 16px' }}>
            기존의 장밋빛 브리핑을 맹신하지 않고 객관적인 데이터를 선택하신 것을 환영합니다.
            Revo 시뮬레이터 정식 런칭 시, 본 이메일로 <strong>[1회 무료 분석권]</strong>이 가장 먼저 발급될 예정입니다.
          </Text>

          <Text style={{ fontSize: 15, color: '#3f3f46', lineHeight: '1.8', margin: '0 0 16px' }}>
            그에 앞서, 귀하의 자본을 방어하기 위해 약속드린{' '}
            <strong>[수억 원 잃기 전 반드시 알아야 할, 재개발 분담금 폭탄 피하는 5가지 비밀]</strong>{' '}
            가이드북을 보내드립니다.
          </Text>

          <Text style={{ fontSize: 15, color: '#3f3f46', lineHeight: '1.8', margin: '0 0 32px' }}>
            해당 문서는 단순한 정보 전달이 아닙니다. 현재 임장 중인 구역에 대입하여 즉시 사용할 수 있는
            '최악의 분담금 역산 공식'이 포함되어 있습니다.
            계약금을 입금하기 전, 반드시 아래 버튼을 눌러 문서를 완독하고 철저히 검증하십시오.
          </Text>

          <Button
            href={guideBookUrl}
            style={{
              display: 'block',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 28px',
              borderRadius: 10,
              textDecoration: 'none',
              textAlign: 'center',
              marginBottom: 32,
            }}
          >
            가이드북 무료 다운로드 (PDF)
          </Button>

          <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 24px' }} />

          <Text style={{ fontSize: 12, color: '#9ca3af', lineHeight: '1.6', margin: 0 }}>
            본 메일은 사전 예약 시 마케팅 정보 수신에 동의하신 분께 발송됩니다.<br />
            문의: support@revo-invest.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
