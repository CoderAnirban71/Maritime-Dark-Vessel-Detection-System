import { useState } from 'react';
import { useAnalytics } from '../../hooks/useDataHooks';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  ShieldAlert,
  Waves,
  Download,
  Filter,
} from 'lucide-react';
import { ProvenanceTag } from '../ui/Badge';

const WORKSTATION_COLORS = ['#5EE6C0', '#38B99A', '#E8A84E', '#F05D5E', '#A5B1AC'];

export function AnalyticsView() {
  const { analytics, loading } = useAnalytics();
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [timeWindow, setTimeWindow] = useState<'2026_YTD' | '2017_BENCHMARK'>('2026_YTD');

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-full text-[#68746F] font-mono text-xs">
        LOADING ANALYTICAL TELEMETRY...
      </div>
    );
  }

  const handleExportSummaryCsv = () => {
    const headers = ['Metric', 'Value', 'Unit'];
    const rows = [
      ['Total Slicks Tracked', '58', 'cases'],
      ['Attribution Success Rate', '88.4', '%'],
      ['Total Discharged Volume', '1485', 'm3'],
      ['Mean Ingestion Latency', '32', 'minutes'],
      ...analytics.detectionsByMonth.map((d) => [`Monthly Count - ${d.month}`, d.count.toString(), 'detections']),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maritime_attribution_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHeatmap = selectedRegion === 'ALL'
    ? analytics.seaAreaHeatmap
    : analytics.seaAreaHeatmap.filter((h) => h.region.toLowerCase().includes(selectedRegion.toLowerCase()));

  return (
    <div className="h-full w-full bg-[#080C0B] p-3 overflow-y-auto space-y-3 font-sans text-xs select-none">
      {/* 1. Header with Filters & CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111716] p-3 rounded-xs border border-[#29332F]">
        <div>
          <div className="flex items-center gap-2 font-mono font-bold text-xs text-[#E8EFEC]">
            <BarChart3 className="w-4 h-4 text-[#5EE6C0]" />
            <span>OPERATIONAL MARITIME TELEMETRY & ATTRIBUTION ANALYTICS</span>
          </div>
          <p className="text-[#68746F] font-mono text-[10px] mt-0.5">
            Statistical aggregation across Indian EEZ and major shipping corridors
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          {/* Region Filter */}
          <div className="flex items-center gap-1 bg-[#161D1B] border border-[#29332F] px-2 py-1 rounded-xs">
            <Filter className="w-3 h-3 text-[#68746F]" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent border-none text-[#E8EFEC] focus:outline-none cursor-pointer text-[10px]"
            >
              <option value="ALL" className="bg-[#111716]">ALL SECTORS</option>
              <option value="Ennore" className="bg-[#111716]">ENNORE / CHENNAI</option>
              <option value="Mumbai" className="bg-[#111716]">MUMBAI HIGH</option>
              <option value="Kutch" className="bg-[#111716]">GULF OF KUTCH</option>
              <option value="Mannar" className="bg-[#111716]">GULF OF MANNAR</option>
            </select>
          </div>

          {/* Time Window Switcher */}
          <div className="flex items-center gap-1 bg-[#161D1B] border border-[#29332F] p-0.5 rounded-xs">
            <button
              type="button"
              onClick={() => setTimeWindow('2026_YTD')}
              className={`px-2 py-0.5 rounded-xs uppercase cursor-pointer ${
                timeWindow === '2026_YTD'
                  ? 'bg-[#236B5B] text-slate-950 font-bold'
                  : 'text-[#68746F] hover:text-[#A5B1AC]'
              }`}
            >
              2026 YTD
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('2017_BENCHMARK')}
              className={`px-2 py-0.5 rounded-xs uppercase cursor-pointer ${
                timeWindow === '2017_BENCHMARK'
                  ? 'bg-[#236B5B] text-slate-950 font-bold'
                  : 'text-[#68746F] hover:text-[#A5B1AC]'
              }`}
            >
              2017 CASE BENCHMARK
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportSummaryCsv}
            className="px-2.5 py-1 bg-[#161D1B] hover:bg-[#1C2522] border border-[#29332F] text-[#5EE6C0] font-bold rounded-xs flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT CSV</span>
          </button>

          <ProvenanceTag provenance="DERIVED" />
        </div>
      </div>

      {/* 2. Four Operational KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-0.5">
          <span className="text-[#68746F] text-[9px] block uppercase">TOTAL SLICKS DETECTED</span>
          <div className="text-xl font-bold text-[#E8EFEC]">
            {timeWindow === '2026_YTD' ? '58 CASES' : '1 MAJOR (19.45 km²)'}
          </div>
          <div className="text-[9px] text-[#5EE6C0]">↑ 12% VS PREV CYCLE</div>
        </div>
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-0.5">
          <span className="text-[#68746F] text-[9px] block uppercase">ATTRIBUTION CERTAINTY RATE</span>
          <div className="text-xl font-bold text-[#5EE6C0]">88.4%</div>
          <div className="text-[9px] text-[#A5B1AC]">43 OF 58 CASES CONFIRMED</div>
        </div>
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-0.5">
          <span className="text-[#68746F] text-[9px] block uppercase">TOTAL DISCHARGED HYDROCARBON</span>
          <div className="text-xl font-bold text-[#E8A84E]">
            {timeWindow === '2026_YTD' ? '1,485 m³' : '2,850 m³'}
          </div>
          <div className="text-[9px] text-[#D5B76A]">HEAVY BUNKER HYDROCARBONS</div>
        </div>
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-0.5">
          <span className="text-[#68746F] text-[9px] block uppercase">MEAN SENSOR-TO-ATTRIBUTION LATENCY</span>
          <div className="text-xl font-bold text-[#E8EFEC]">32 MIN</div>
          <div className="text-[9px] text-[#5EE6C0]">SAR INGESTION TO CANDIDATE DOSSIER</div>
        </div>
      </div>

      {/* 3. Main Analytical Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* 1. Monthly Incidents & Volumes */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#5EE6C0]" />
              SLICK INCIDENTS & DISCHARGE VOLUME
            </span>
            <span className="text-[9px] text-[#68746F]">MONTHLY AGGREGATE</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.detectionsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#202925" />
                <XAxis dataKey="month" stroke="#68746F" tick={{ fontSize: 10, fill: '#A5B1AC', fontFamily: 'JetBrains Mono' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#5EE6C0" tick={{ fontSize: 10, fill: '#5EE6C0', fontFamily: 'JetBrains Mono' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#E8A84E" tick={{ fontSize: 10, fill: '#E8A84E', fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111716', borderRadius: '2px', border: '1px solid #29332F', fontSize: '10px', color: '#E8EFEC', fontFamily: 'JetBrains Mono' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} />
                <Bar yAxisId="left" dataKey="count" name="Slick Detections" fill="#5EE6C0" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="volumeM3" name="Est. Volume (m³)" fill="#E8A84E" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Vessel Types Involved */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-[#5EE6C0]" />
              VESSEL CATEGORY DISTRIBUTION IN ATTRIBUTIONS
            </span>
            <span className="text-[9px] text-[#68746F]">CLASSIFICATION</span>
          </div>

          <div className="h-56 w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.vesselTypeInvolvement}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="type"
                >
                  {analytics.vesselTypeInvolvement.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={WORKSTATION_COLORS[index % WORKSTATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111716', borderRadius: '2px', border: '1px solid #29332F', fontSize: '10px', color: '#E8EFEC', fontFamily: 'JetBrains Mono' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Confidence Buckets */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#5EE6C0]" />
              ATTRIBUTION CONFIDENCE SCORE DISTRIBUTION
            </span>
            <span className="text-[9px] text-[#68746F]">STATISTICAL RELIABILITY</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.attributionConfidenceBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#202925" />
                <XAxis dataKey="range" stroke="#68746F" tick={{ fontSize: 10, fill: '#A5B1AC', fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="#68746F" tick={{ fontSize: 10, fill: '#A5B1AC', fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111716', borderRadius: '2px', border: '1px solid #29332F', fontSize: '10px', color: '#E8EFEC', fontFamily: 'JetBrains Mono' }}
                />
                <Bar dataKey="count" name="Investigations" fill="#38B99A" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Regional Heatmap */}
        <div className="bg-[#111716] p-3 rounded-xs border border-[#29332F] space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-[#E8EFEC] flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-[#5EE6C0]" />
              REGIONAL MARITIME EEZ RISK BREAKDOWN [{filteredHeatmap.length}]
            </span>
            <span className="text-[9px] text-[#68746F]">HOTSPOTS</span>
          </div>

          <div className="divide-y divide-[#202925] max-h-52 overflow-y-auto">
            {filteredHeatmap.map((item, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between text-[11px]">
                <div>
                  <div className="font-bold text-[#E8EFEC]">{item.region}</div>
                  <div className="text-[9px] text-[#68746F]">{item.spillCount} INCIDENTS RECORDED</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#5EE6C0]">{item.avgAttributionRate}%</div>
                  <div className="text-[8px] text-[#68746F]">ATTRIBUTION RATE</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
