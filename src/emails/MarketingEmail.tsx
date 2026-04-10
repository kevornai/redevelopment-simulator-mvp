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

interface MarketingEmailProps {
  subject?: string;
  bodyHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export default function MarketingEmail({
  subject = 'Revo 업데이트 안내',
  bodyHtml = '',
  ctaText,
  ctaUrl,
}: MarketingEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: '40px auto', backgroundColor: '#ffffff', borderRadius: 12, padding: '40px 32px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            Revo 데이터 분석팀
          </Text>

          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />

          {ctaText && ctaUrl && (
            <Button
              href={ctaUrl}
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
                marginTop: 32,
                marginBottom: 32,
              }}
            >
              {ctaText}
            </Button>
          )}

          <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 24px' }} />

          <Text style={{ fontSize: 12, color: '#9ca3af', lineHeight: '1.6', margin: 0 }}>
            본 메일은 마케팅 정보 수신에 동의하신 분께 발송됩니다.<br />
            문의: support@revo.kr
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
