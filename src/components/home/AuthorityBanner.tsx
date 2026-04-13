const stats = [
  { value: '2,400+', label: '누적 분석 건수' },
  { value: '98%', label: '실제 분담금 오차 2% 이내' },
  { value: '15년', label: '재개발·재건축 데이터 기반' },
  { value: '무료', label: '지금 바로 가이드북 수령' },
];

export default function AuthorityBanner() {
  return (
    <section className="bg-blue-600">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold mb-1">{stat.value}</p>
              <p className="text-blue-100 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
