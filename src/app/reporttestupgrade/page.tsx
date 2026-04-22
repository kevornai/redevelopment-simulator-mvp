import { Metadata } from "next";
import ReportUpgradeClient from "./ReportUpgradeClient";

export const metadata: Metadata = {
  title: "분석 리포트 (신버전) | Revo",
  robots: { index: false, follow: false },
};

export default function ReportUpgradePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <ReportUpgradeClient />
    </main>
  );
}
