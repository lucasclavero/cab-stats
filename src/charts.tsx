type Slice = { label: string; value: number; color: string };

export function Donut({ data, size = 220 }: { data: Slice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2;
  const ir = r * 0.62;
  const cx = r;
  const cy = r;
  let acc = 0;
  const tau = Math.PI * 2;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d) => {
          if (d.value <= 0) return null;
          const from = acc / total;
          acc += d.value;
          const to = acc / total;
          const a0 = -Math.PI / 2 + from * tau;
          const a1 = -Math.PI / 2 + to * tau;
          const large = to - from > 0.5 ? 1 : 0;
          const x0o = cx + r * Math.cos(a0);
          const y0o = cy + r * Math.sin(a0);
          const x1o = cx + r * Math.cos(a1);
          const y1o = cy + r * Math.sin(a1);
          const x1i = cx + ir * Math.cos(a1);
          const y1i = cy + ir * Math.sin(a1);
          const x0i = cx + ir * Math.cos(a0);
          const y0i = cy + ir * Math.sin(a0);
          const dPath = `M ${x0o} ${y0o} A ${r} ${r} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${ir} ${ir} 0 ${large} 0 ${x0i} ${y0i} Z`;
          return <path key={d.label} d={dPath} fill={d.color} />;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="donut-total">
          {data.reduce((s, d) => s + d.value, 0)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="donut-caption">
          pts
        </text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="swatch" style={{ background: d.color }} />
            {d.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBar({
  labels,
  values,
  suffix = "",
}: {
  labels: string[];
  values: number[];
  suffix?: string;
}) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <div className="hbar">
      {labels.map((label, i) => (
        <div className="hbar-row" key={`${label}-${i}`}>
          <span className="hbar-label">{label}</span>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{ width: `${(100 * Math.abs(values[i])) / max}%` }}
            />
          </div>
          <span className="hbar-val">
            {Number.isInteger(values[i]) ? values[i] : values[i].toFixed(1)}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  categories,
  series,
}: {
  categories: string[];
  series: { name: string; data: number[]; color: string }[];
}) {
  const w = 720;
  const h = 240;
  const pad = { l: 36, r: 12, t: 16, b: 56 };
  const all = series.flatMap((s) => s.data);
  const yMax = Math.max(...all, 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = Math.max(categories.length - 1, 1);
  const xAt = (i: number) => pad.l + (innerW * i) / n;
  const yAt = (v: number) => pad.t + innerH - (innerH * v) / yMax;

  return (
    <div>
      <svg className="linechart" viewBox={`0 0 ${w} ${h}`} role="img">
        {[0, 0.5, 1].map((t) => {
          const v = yMax * (1 - t);
          const yy = pad.t + innerH * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} className="grid" />
              <text x={pad.l - 6} y={yy + 3} textAnchor="end" className="axis">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {series.map((s) => {
          const d = s.data
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" />
              {s.data.map((v, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3" fill={s.color} />
              ))}
            </g>
          );
        })}
        {categories.map((c, i) => (
          <text
            key={c + i}
            x={xAt(i)}
            y={h - 10}
            textAnchor="end"
            transform={`rotate(-38 ${xAt(i)} ${h - 10})`}
            className="axis"
          >
            {c}
          </text>
        ))}
      </svg>
      <ul className="legend">
        {series.map((s) => (
          <li key={s.name}>
            <span className="swatch" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
