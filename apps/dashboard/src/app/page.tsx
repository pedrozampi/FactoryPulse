'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Clock,
  Filter,
  Layers,
  RefreshCw,
  Send,
  TrendingUp,
} from 'lucide-react';

interface SensorReading {
  time: string;
  stack: number;
}

interface SensorChannelStats {
  readings: SensorReading[];
  total: number;
  average: number;
}

type QueryReadingsResponse = Record<string, SensorChannelStats>;

const SENSOR_COLORS: Record<string, string> = {
  '0': '#38bdf8', // sky-400
  '1': '#34d399', // emerald-400
  '2': '#f59e0b', // amber-500
  '3': '#a78bfa', // violet-400
  '4': '#f472b6', // pink-400
  '5': '#fb7185', // rose-400
};

function getSensorColor(channel: string, idx: number): string {
  const palette = ['#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#fb7185'];
  return SENSOR_COLORS[channel] ?? palette[idx % palette.length];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<QueryReadingsResponse>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [chartType, setChartType] = useState<'area' | 'line' | 'bar'>('area');

  // Filtros
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [limit, setLimit] = useState<string>('200');

  const fetchReadings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (startTime) payload.startTime = new Date(startTime).toISOString();
      if (endTime) payload.endTime = new Date(endTime).toISOString();
      if (selectedChannels.length > 0) payload.channels = selectedChannels;
      if (limit && Number(limit) > 0) payload.limit = Number(limit);

      const res = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message || 'Erro ao buscar leituras');
      }

      setData(body);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [startTime, endTime, selectedChannels, limit]);

  useEffect(() => {
    void fetchReadings();
  }, [fetchReadings]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void fetchReadings();
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchReadings]);

  const handleSimulatePulse = async () => {
    setSimulating(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const samplePulse = {
        '0': [{ time: nowIso, stack: Math.floor(Math.random() * 4) }],
        '1': [{ time: nowIso, stack: Math.floor(Math.random() * 5) + 1 }],
        '2': [{ time: nowIso, stack: Math.floor(Math.random() * 3) }],
        '3': [{ time: nowIso, stack: Math.floor(Math.random() * 4) }],
      };

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePulse),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || 'Falha ao simular envio de pulso');
      }

      // Aguarda 600ms para o Consumer Worker persistir no TimescaleDB e atualiza a tela
      setTimeout(() => {
        void fetchReadings();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao simular pulso');
    } finally {
      setSimulating(false);
    }
  };

  const channels = useMemo(
    () => Object.keys(data).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [data],
  );

  // Unifica os timestamps de todos os sensores para o gráfico de série temporal
  const timelineChartData = useMemo(() => {
    const timeMap = new Map<string, Record<string, string | number>>();

    for (const channel of channels) {
      const channelStats = data[channel];
      if (!channelStats?.readings) continue;

      for (const reading of channelStats.readings) {
        const key = reading.time;
        if (!timeMap.has(key)) {
          timeMap.set(key, {
            rawTime: key,
            timeLabel: formatTimestamp(key),
          });
        }
        const entry = timeMap.get(key)!;
        entry[`Sensor ${channel}`] = reading.stack;
      }
    }

    return Array.from(timeMap.values()).sort((a, b) =>
      String(a.rawTime).localeCompare(String(b.rawTime)),
    );
  }, [data, channels]);

  // Dados comparativos de Total e Média por sensor
  const summaryChartData = useMemo(() => {
    return channels.map((channel) => ({
      sensor: `Sensor ${channel}`,
      channel,
      total: data[channel]?.total ?? 0,
      average: data[channel]?.average ?? 0,
      readingsCount: data[channel]?.readings?.length ?? 0,
    }));
  }, [data, channels]);

  const globalTotals = useMemo(() => {
    let totalReadings = 0;
    let totalStack = 0;
    for (const ch of channels) {
      totalReadings += data[ch]?.readings?.length ?? 0;
      totalStack += data[ch]?.total ?? 0;
    }
    return {
      sensorsCount: channels.length,
      totalReadings,
      totalStack,
    };
  }, [data, channels]);

  const toggleChannelFilter = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((item) => item !== ch) : [...prev, ch],
    );
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                FactoryPulse Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                Monitoramento em Tempo Real • RabbitMQ + PostgreSQL TimescaleDB
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Atualizado às {lastUpdated}
              </span>
            )}

            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                autoRefresh
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Auto-Refresh (10s): {autoRefresh ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={handleSimulatePulse}
              disabled={simulating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow transition"
            >
              <Send className="w-4 h-4" />
              {simulating ? 'Enviando...' : 'Simular Pulso'}
            </button>

            <button
              onClick={() => void fetchReadings()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </header>

        {/* Barra de Filtros */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mr-2">
              <Filter className="w-4 h-4 text-sky-400" />
              Filtros (POST /readings):
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Inicial</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Final</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Limite de Registros</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Canais / Sensores</label>
              <div className="flex items-center gap-1.5">
                {['0', '1', '2', '3'].map((ch) => {
                  const active = selectedChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannelFilter(ch)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        active
                          ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      Sensor {ch}
                    </button>
                  );
                })}
                {selectedChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedChannels([])}
                    className="text-xs text-slate-400 hover:text-slate-200 ml-1 underline"
                  >
                    Todos
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Cards por Sensor (Total e Média por Sensor) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Métricas por Sensor (Total & Média)
            </h2>
            <span className="text-xs text-slate-400">
              {globalTotals.sensorsCount} sensores ativos • {globalTotals.totalReadings} leituras carregadas
            </span>
          </div>

          {channels.length === 0 && !loading ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              Nenhuma leitura encontrada para os filtros selecionados. Clique em{' '}
              <strong className="text-indigo-400">Simular Pulso</strong> para enviar novos dados!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {channels.map((channel, idx) => {
                const stats = data[channel];
                const color = getSensorColor(channel, idx);
                const lastReading =
                  stats.readings.length > 0
                    ? stats.readings[stats.readings.length - 1]
                    : null;

                return (
                  <div
                    key={channel}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between"
                    style={{ borderTopColor: color, borderTopWidth: '3px' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-base font-bold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        Sensor {channel}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {stats.readings.length}{' '}
                        {stats.readings.length === 1 ? 'leitura' : 'leituras'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-1">
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">
                          Total (Stack)
                        </span>
                        <span className="text-2xl font-bold text-white mt-0.5 block">
                          {stats.total}
                        </span>
                      </div>

                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
                        <span className="text-xs text-slate-400 block">
                          Média (Stack)
                        </span>
                        <span
                          className="text-2xl font-bold mt-0.5 block"
                          style={{ color }}
                        >
                          {stats.average}
                        </span>
                      </div>
                    </div>

                    {lastReading && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>Último stack: <strong className="text-slate-200">{lastReading.stack}</strong></span>
                        <span>{formatTimestamp(lastReading.time)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Gráfico Principal: Leituras no Tempo */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-sky-400" />
                Histórico de Leituras por Sensor (Série Temporal)
              </h2>
              <p className="text-xs text-slate-400">
                Evolução do valor de <code className="text-sky-300">stack</code> ao longo do tempo (<code className="text-sky-300">timestamptz</code>)
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: 'area', label: 'Área' },
                  { id: 'line', label: 'Linha' },
                  { id: 'bar', label: 'Barras' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    chartType === tab.id
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-80 w-full">
            {timelineChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Sem pontos de leitura para exibir no gráfico.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={timelineChartData}>
                    <defs>
                      {channels.map((ch, idx) => {
                        const color = getSensorColor(ch, idx);
                        return (
                          <linearGradient
                            key={ch}
                            id={`grad-${ch}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    {channels.map((ch, idx) => {
                      const color = getSensorColor(ch, idx);
                      return (
                        <Area
                          key={ch}
                          type="monotone"
                          dataKey={`Sensor ${ch}`}
                          stroke={color}
                          strokeWidth={2.5}
                          fill={`url(#grad-${ch})`}
                          activeDot={{ r: 5 }}
                        />
                      );
                    })}
                  </AreaChart>
                ) : chartType === 'line' ? (
                  <LineChart data={timelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    {channels.map((ch, idx) => (
                      <Line
                        key={ch}
                        type="monotone"
                        dataKey={`Sensor ${ch}`}
                        stroke={getSensorColor(ch, idx)}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={timelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    {channels.map((ch, idx) => (
                      <Bar
                        key={ch}
                        dataKey={`Sensor ${ch}`}
                        fill={getSensorColor(ch, idx)}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Gráfico Comparativo: Total vs Média por Sensor */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Comparativo por Sensor: Total Acumulado vs Média
            </h2>
            <p className="text-xs text-slate-400">
              Visão consolidada do total e da média de cada sensor no período filtrado
            </p>
          </div>

          <div className="h-72 w-full">
            {summaryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Sem dados consolidados para exibir.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="sensor" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name="Total por Sensor"
                    fill="#38bdf8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="average"
                    name="Média por Sensor"
                    fill="#34d399"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

