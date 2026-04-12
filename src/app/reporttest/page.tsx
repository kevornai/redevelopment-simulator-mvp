import { Metadata } from "next";
import ReportTestClient from "./ReportTestClient";

export const metadata: Metadata = {
  title: "계산 엔진 테스트 | Revo",
  robots: { index: false, follow: false },
};

export default function ReportTestPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <ReportTestClient />
    </main>
  );
}
